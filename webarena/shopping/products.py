import base64
import copy
import mimetypes
from pathlib import Path
from urllib.parse import urljoin
from uuid import uuid4
import random
import requests

from auth import STORE_URL
from store_requests import make_authenticated_request
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException, TimeoutException
import time

from completions import get_completion_from_openai


def get_image_sources(url):
    """Fetch all <img> tag src attributes from a given URL using ChromeDriver."""
    # Configure Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in headless mode (no GUI)
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")

    # Path to your ChromeDriver (ensure it matches your Chrome version)
    service = Service("/opt/homebrew/bin/chromedriver")  # <-- Change this path

    try:
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(15)  # Timeout for page load

        driver.get(url)
        time.sleep(2)  # Wait for DOM to load (can be replaced with WebDriverWait)

        # Select all <img> elements
        img_elements = driver.find_elements(By.CLASS_NAME, "fotorama__img")

        # Extract src attributes
        img_sources = []
        for img in img_elements:
            src = img.get_attribute("src")
            if src:  # Only add if src is not None
                img_sources.append(src)

        return img_sources

    except (WebDriverException, TimeoutException) as e:
        print(f"Error: {e}")
        return []
    finally:
        try:
            driver.quit()
        except:
            pass


def post_product_image(token, sku, image_path):
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
                "name": f"product_image_{sku}.jpg",
            },
        }
    }

    endpoint = f"/rest/V1/products/{sku}/media"
    result = make_authenticated_request(
        token, endpoint, method="POST", data=image_payload
    )

    if result:
        print(f"✓ Added image to product with SKU: {sku}")
    else:
        print(f"✗ Failed to add image to product with SKU: {sku}")

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
            f"product_images/{result.get('sku')}.jpg"
        )
        post_product_image(token, result.get("sku"), image_path)
    else:
        print("✗ Failed to create product")


def get_random_product_from_catalog(token, in_stock=True):
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
        print(
            f"✓ Found {total} total products, In stock={in_stock}, showing {len(items)}"
        )

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


def get_product_name_from_description(original_name, description):
    """
    Generate a new product name based on the original name and description, using an LLM.
    """
    prompt = """Using the following product description and original name from an online store, 
    generate a concise and catchy test product name that accurately reflects the product's features and benefits.
    
    Original Product Name: "{original_name}"
    Product Description: "{description}"""

    # Get API provider for GPT-5
    response = get_completion_from_openai(
        prompt.format(original_name=original_name, description=description),
        model="gpt-5",
    )

    return response.strip()


def download_product_image(url_key, new_sku):
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

    images = get_image_sources(product_url)
    if images:
        first_url = images[0]

        # Download the image using requests
        response = requests.get(first_url)
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


def generate_product_from_catalog(token):
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

    new_product = {"product": new_product}
    product_id = uuid4()
    new_product["product"]["sku"] = f"{new_product['product']['sku']}-{product_id}"

    image_path = download_product_image(
        url_key[0]["value"], new_product["product"]["sku"]
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


def generate_restock_event(token, sku):
    """Generate a restock event payload for a given product SKU."""
    endpoint = f"/rest/V1/stockItems/{sku}"
    stock_item_response = make_authenticated_request(token, endpoint)

    if stock_item_response:
        additional_quantity = random.randint(20, 100)
        current_qty = stock_item_response.get("qty", 0)
        new_qty = current_qty + additional_quantity

        stock_payload = {
            "stockItem": {
                "qty": new_qty,
                "is_in_stock": True,
            },
            "sku": sku,
        }
        return stock_payload
    else:
        print(f"✗ Failed to fetch stock item for SKU: {sku}")
        return None


def update_stock_for_product(token, sku, payload):
    """
    Restock a product by increasing its quantity.

    Args:
        token: Bearer token
        sku: Product SKU
        payload: Payload containing updated stock information

    Returns:
        Response JSON or None
    """
    print(f"\nRestocking product with SKU: {sku}...")

    # Update the stock item with the new quantity
    result = make_authenticated_request(
        token,
        f"/rest/V1/products/{sku}/stockItems/1",
        method="PUT",
        data=payload,
    )

    if result:
        print(
            f"✓ Restocked product with SKU: {sku}. New quantity: {payload['stockItem']['qty']}"
        )
    else:
        print(f"✗ Failed to restock product with SKU: {sku}")

    return result
