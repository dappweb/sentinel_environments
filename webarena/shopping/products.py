import base64
import copy
import mimetypes
from pathlib import Path
from urllib.parse import urljoin
from uuid import uuid4
import random
from datetime import datetime
import requests
from playwright.sync_api import sync_playwright

from auth import STORE_URL
from store_requests import make_authenticated_request
from openai import OpenAI


def post_product_image(token, product_id, image_path):
    """
    Post product image to the catalog.

    Args:
        token: Bearer token
        product_id: ID of the product to which the image will be added
        image_path: Path to the image file

    Returns:
        Response JSON or None
    """
    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
        encoded_string = base64.b64encode(image_data).decode("utf-8")

    image_payload = {
        "entry": {
            "media_type": "image",
            "label": "Product Image",
            "position": 1,
            "disabled": False,
            "types": ["image", "small_image", "thumbnail", "swatch_image"],
            "content": {
                "base64_encoded_data": encoded_string,
                "type": "image/jpeg",
                "name": f"product_image_{product_id}.jpg",
            },
        }
    }

    endpoint = f"/rest/V1/products/{product_id}/media"
    result = make_authenticated_request(
        token, endpoint, method="POST", data=image_payload
    )

    if result:
        print(f"✓ Added image to product ID: {product_id}")
    else:
        print(f"✗ Failed to add image to product ID: {product_id}")

    return result


def remove_product(token, sku):
    print(f"\nRemoving product with SKU: {sku}...")
    endpoint = f"/rest/V1/products/{sku}"
    result = make_authenticated_request(token, endpoint, method="DELETE")
    if result is not None:
        print(f"✓ Removed product with SKU: {sku}")
    else:
        print(f"✗ Failed to remove product with SKU: {sku}")


def add_product(token, sku, product):
    print(f"\nAdding product with SKU: {sku}...")
    result = make_authenticated_request(
        token,
        "/rest/V1/products",
        method="POST",
        data=product,
    )

    if result:
        print(f"✓ Created product: {result.get('name')}")
        print(f"  SKU: {result.get('sku')}")
        print(f"  ID: {result.get('id')}")

        # Post product image after creating the product
        image_path = Path(__file__).parent.absolute() / Path(
            f"product_images/{sku}.jpg"
        )
        post_product_image(token, result.get("sku"), image_path)
    else:
        print("✗ Failed to create product")


def get_random_product_from_catalog(token):
    """
    Get a random product from the catalog.

    Args:
        token: Bearer token
    Returns:
        List of products or None
    """
    print("Fetching products from catalog...")
    endpoint = "/rest/V1/products?searchCriteria[pageSize]=100"
    result = make_authenticated_request(token, endpoint)

    if result:
        items = result.get("items", [])
        total = result.get("total_count", 0)
        print(f"✓ Found {total} total products, showing {len(items)}")

        # Request a range of products
        pages = total // 10
        random_page = random.randint(1, pages)
        print(f"Fetching products from random page: {random_page + 1}...")
        endpoint = f"/rest/V1/products?searchCriteria[pageSize]=10&searchCriteria[currentPage]={random_page}"
        result = make_authenticated_request(token, endpoint)
        if result:
            items = result.get("items", [])

            # filter out products that are not simple
            print("Filtering for simple products...")
            all_types = set([item.get("type_id") for item in items])
            print(f"Found product types on this page: {all_types}")
            items = [item for item in items if item.get("type_id") == "simple"]

            # Select a random item
            random_item = random.choice(items)
            print(
                f"Randomly selected product: SKU={random_item.get('sku')}, Name={random_item.get('name')}"
            )
            return random_item

        return None
    else:
        print("✗ Failed to fetch products from catalog")
        return None


def _is_chat_model(model):
    """Heuristic to determine whether a model expects the chat completions API."""
    normalized = model.lower()
    if "instruct" in normalized or normalized.startswith("text-"):
        return False
    return True


def get_completion_from_openai(prompt, model="gpt-5"):
    """Return the completion text for the given prompt using the appropriate OpenAI API."""
    client = OpenAI()
    if _is_chat_model(model):
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            reasoning_effort="minimal",
        )
    message = completion.choices[0].message.content
    return message if isinstance(message, str) else message or ""


def get_product_name_from_description(original_name, description):
    """
    Generate a new product name based on the original name and description, using an LLM.
    """
    prompt = """Using the following product description and original from an online store, 
    generate a concise and catchy test product name that accurately reflects the product's features and benefits.
    
    Original Product Name: "{original_name}"
    Product Description: "{description}"""

    # Get API provider for GPT-5
    response = get_completion_from_openai(
        prompt.format(original_name=original_name, description=description),
        model="gpt-5",
    )

    return response.strip()


def download_product_image(url_key, sku, new_sku):
    """
    Download the main product image for a given SKU.

    Args:
        token: Bearer token
        sku: Product SKU
    Returns:
        Path to downloaded image or None
    """
    # Use playwright to open the product page, query img tags, and get the first image URL
    product_url = urljoin(STORE_URL, f"{url_key}.html")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(product_url, wait_until="domcontentloaded")

        # query the first img tag
        img_elements = page.locator("img.fotorama__img")
        if img_elements:
            img_url = img_elements.nth(0).get_attribute("src")
            print(f"Found image URL: {img_url}")

            # Download the image using requests
            response = requests.get(img_url)
            if response.status_code == 200:
                # Save the image under the new SKU name
                image_path = Path.cwd() / Path(f"product_images/{new_sku}.jpg")
                with open(image_path, "wb") as f:
                    f.write(response.content)
                print(f"✓ Downloaded image to {image_path}")
                return image_path

        else:
            print("No image found on the product page.")
            return None


def generate_product_from_catalog(token, index):
    """
    Create a new product in the catalog, as a JSON.
    """
    random_product = get_random_product_from_catalog(token)
    if not random_product:
        return None

    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            random_product["custom_attributes"],
        )
    )

    # Update the SKU and name of the product to make it unique
    new_product = copy.deepcopy(random_product)
    del new_product["created_at"]
    del new_product["updated_at"]
    del new_product["extension_attributes"]["website_ids"]
    del new_product["id"]
    del new_product["options"]  # not handling options for now.

    # Add random quantity
    new_product["extension_attributes"]["stock_item"] = {
        "qty": random.randint(10, 100),
        "is_in_stock": True,
    }

    # Clear out prior image content from custom_attributes. Otherwise this will cause issues when adding the product.
    custom_attributes = list(
        filter(
            lambda x: x["attribute_code"]
            not in ["image", "small_image", "thumbnail", "swatch_image"],
            new_product["custom_attributes"],
        )
    )
    new_product["custom_attributes"] = custom_attributes

    del new_product["media_gallery_entries"]

    new_product = {
        "product": new_product,
        "created_at": datetime.now().isoformat(
            timespec="milliseconds"
        ),  # TODO: verify we are using consistent timestamp format
    }

    product_id = uuid4()
    new_product["product"]["sku"] = f"{new_product['product']['sku']}-{product_id}"

    image_path = download_product_image(
        url_key[0]["value"], random_product["sku"], new_product["product"]["sku"]
    )
    if image_path is None:
        return None

    product_description = list(
        filter(
            lambda x: x["attribute_code"] == "description",
            new_product["product"]["custom_attributes"],
        )
    )
    if len(product_description) > 0:
        product_description = product_description[0]["value"]
    else:
        product_description = ""

    new_product["product"]["name"] = get_product_name_from_description(
        new_product["product"]["name"], product_description
    )
    print(f"Generated new product name: {new_product['product']['name']}")

    # Make URL key unique
    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            new_product["product"]["custom_attributes"],
        )
    )
    if url_key:
        url_key[0]["value"] = f"{url_key[0]['value']}-{product_id}"

    return new_product
