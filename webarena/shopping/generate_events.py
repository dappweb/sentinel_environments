"""
Script to generate, add, and remove products in Adobe Commerce (Magento) via REST API.
"""

from datetime import datetime
import os
from pathlib import Path
from time import sleep
import json
import time
import argparse
from auth import get_admin_token, get_customer_token
from store_requests import make_authenticated_request
from products import (
    remove_product,
    add_product,
    generate_product_from_catalog,
    get_random_product_from_catalog,
)
from product_sales import (
    generate_sales_rule_for_product,
    add_product_sales_rule,
    remove_product_sales_rule,
)


def example_api_calls(token):
    """
    Example API calls using Bearer token.
    """

    print("\n" + "=" * 60)
    print("Example API Calls")
    print("=" * 60)

    # Example 1: Get store configuration
    print("\n1. Getting store configuration...")
    config = make_authenticated_request(token, "/rest/V1/store/storeConfigs")
    if config:
        print(f"Found {len(config)} store(s)")
        if config:
            print(f"Store URL: {config[0].get('base_url')}")
            print(f"Store Code: {config[0].get('code')}")

    # Example 2: Get products (with pagination)
    print("\n2. Getting products...")
    products = make_authenticated_request(
        token, "/rest/V1/products?searchCriteria[pageSize]=5"
    )
    if products:
        items = products.get("items", [])
        total = products.get("total_count", 0)
        print(f"Found {total} total products, showing {len(items)}")
        for product in items[:3]:
            print(product)

    # Example 3: Get customers (admin token required)
    print("\n3. Getting customers...")
    customers = make_authenticated_request(
        token, "/rest/V1/customers/search?searchCriteria[pageSize]=5"
    )
    if customers:
        items = customers.get("items", [])
        total = customers.get("total_count", 0)
        print(f"Found {total} total customers, showing {len(items)}")
        for customer in items[:3]:
            print(
                f"  - {customer.get('firstname')} {customer.get('lastname')} ({customer.get('email')})"
            )

    # Example 4: Get categories
    print("\n4. Getting categories...")
    categories = make_authenticated_request(token, "/rest/V1/categories")
    if categories:
        print(f"Root Category: {categories.get('name')}")
        children = categories.get("children_data", [])
        print(f"Found {len(children)} child categories")
        for cat in children[:3]:
            print(f"  - {cat.get('name')} (ID: {cat.get('id')})")

    # Example 5: Post a sale for a product
    print("\n5. Posting a sale for a product...")
    make_authenticated_request(
        token,
        "/rest/V1/salesRules",
    )


def generate_product_sales_events(token, num_sales):
    num_sales_created = 0
    sales_added = []
    for i in range(num_sales):
        print(f"\nGenerating sale {i + 1} of {num_sales}...")
        # Use the adobe commerce API to create a product sale event modifying the salesrule table
        product = get_random_product_from_catalog(token)
        if not product:
            print("✗ No products found in catalog to create sales event.")
            return

        sku = product.get("sku")
        print(f"Creating sale event for product SKU: {sku}...")

        # Get the rest API endpoint to modify sales rules
        result = generate_sales_rule_for_product(token, product)
        if result:
            sales_added.append(result)
            num_sales_created += 1

    return sales_added


def generate_product_add_events(token, num_products):
    # Generate a set of products based on the existing catalog and save to JSON file
    num_added = 0
    products_added = []
    while True:
        if num_added >= num_products:
            break

        print(f"\nGenerating product {num_added + 1} of {num_products}...")

        product = generate_product_from_catalog(token, num_added)
        if product:
            # Get a timestamp for when the product was created
            products_added.append(product)
            num_added += 1

    return products_added


def combine_and_output_events(events, output_path):
    # Collapse items in events into a single list
    events = [item for sublist in events for item in sublist]

    # Sort the items by their created_at key
    events.sort(key=lambda x: x["created_at"])

    # Convert product payloads into required JSONL format
    events = [
        {
            "time": p["created_at"],
            "type": "add_product" if "product" in p else "add_sale",
            "payload": p,
        }
        for p in events
    ]

    # Remove created_at key from payload to avoid redundancy
    for event in events:
        if "created_at" in event.get("payload", {}):
            del event["payload"]["created_at"]

    output_path = Path(__file__).parent.absolute() / Path(output_path)

    # Write each event as a line in the output JSONL file
    with open(output_path, "w") as f:
        for event in events:
            f.write(json.dumps(event) + "\n")


def display_product_pages(sku, product):
    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            product["custom_attributes"],
        )
    )
    if len(url_key) > 0:
        url_key = url_key[0]["value"]
        sku = product.get("sku")

        # Open up Edge browser at the specified URL for demo purposes to show the product was added
        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
        os.system(os_command)
        print(f"Opened Edge browser for product SKU: {sku}")

        # open advanced search page as well
        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/catalogsearch/advanced/result/?sku={sku}'"
        os.system(os_command)


def display_product_in_cart(customer_token, sales_rule):
    sku = sales_rule.get("condition", {}).get("conditions", [])[0].get("value")
    if not sku:
        print("✗ Could not determine SKU from sales rule to display in cart.")
        return

    # get the cart idea
    cart = make_authenticated_request(
        customer_token,
        "/rest/V1/carts/mine",
    )

    if not cart:
        print("✗ Could not retrieve cart for customer.")
        return

    cart_id = cart.get("id")

    # Add the product to cart for the customer
    cart_payload = {
        "cartItem": {
            "qty": 1,
            "sku": sku,
            "quote_id": cart_id,  # assuming quote_id 1 for simplicity; in real cases, fetch/create cart for customer
        }
    }

    cart_result = make_authenticated_request(
        customer_token,
        "/rest/V1/carts/mine/items",
        method="POST",
        data=cart_payload,
    )

    if cart_result:
        # Open up Edge browser at the cart URL with the product added for demo purposes
        os_command = "open -a 'Microsoft Edge' 'http://localhost:7770/checkout/cart/'"
        os.system(os_command)
        print(
            "Opened Edge browser to show the product in the cart, where you can see the sale posted."
        )


if __name__ == "__main__":
    # Add arguments for add or remove products
    parser = argparse.ArgumentParser(description="Manage products in Adobe Commerce")
    parser.add_argument(
        "--option",
        type=str,
        help="Option to add or remove products",
        choices=["init", "add", "reset", "test"],
        required=True,
    )
    parser.add_argument(
        "--num-products",
        type=int,
        help="Number of products to add",
        default=0,
    )
    parser.add_argument(
        "--num-sales",
        type=int,
        help="Number of sales to add",
        default=0,
    )
    parser.add_argument(
        "--output-file",
        type=str,
        help="where to output the generated events JSON file",
        default="events.jsonl",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Whether running this script for a demo (will open browser windows to view products)",
    )
    args = parser.parse_args()

    token = get_admin_token()

    if args.option == "test":
        print(f"Bearer Token: {token}")
        example_api_calls(token)

    if not token:
        print("\n✗ Authentication failed")
        exit(1)

    if args.option == "init":
        # Generate N events of adding new products to the catalog
        product_add_events = generate_product_add_events(token, args.num_products)

        # Generate N events of posting product sales to the catalog (not implemented yet)
        product_sales_events = generate_product_sales_events(token, args.num_sales)

        # Combine and output all events to a single JSON file
        combine_and_output_events(
            [product_add_events, product_sales_events], args.output_file
        )

    elif args.option == "add":
        # Open the products_added.json file and add all products in the json file
        try:
            output_path = Path(__file__).parent.absolute() / Path(args.output_file)
            with open(output_path, "r") as f:
                lines = f.readlines()
                events = [json.loads(l) for l in lines]

                previous_timestamp = None
                for event in events:
                    created_at = event.get("time")
                    if previous_timestamp is not None:
                        # Calculate time difference and sleep accordingly to simulate original timing
                        created = datetime.fromisoformat(created_at)
                        previous = datetime.fromisoformat(previous_timestamp)
                        time_diff = created - previous
                        if time_diff.total_seconds() > 0:
                            print(
                                f"Sleeping for {time_diff} seconds to simulate original timing before executing next event..."
                            )
                            sleep(time_diff.total_seconds())

                    payload = event.get("payload", {})
                    if event.get("type") == "add_product":
                        sku = payload["product"].get("sku")
                        if sku:
                            add_product(token, sku, payload)

                            if args.demo:
                                display_product_pages(sku, payload["product"])

                    elif event.get("type") == "add_sale":
                        product_id = payload.get("rule", {}).get("product_ids")[0]
                        if product_id:
                            sales_rule = add_product_sales_rule(
                                token, product_id, payload
                            )

                            if args.demo:
                                token = get_customer_token()
                                display_product_in_cart(token, sales_rule)

                    previous_timestamp = created_at

        except FileNotFoundError:
            print(
                f"✗ File {args.output_file} not found. Run init option first to generate products_added.json."
            )
            exit(1)
    elif args.option == "reset":
        try:
            with open(args.output_file, "r") as f:
                line = f.readlines()
                events = [json.loads(l) for l in line]
                for event in events:
                    if event.get("type") == "add_product":
                        sku = event.get("payload").get("product").get("sku")
                        if sku:
                            remove_product(token, sku)

                            url_key = list(
                                filter(
                                    lambda x: x["attribute_code"] == "url_key",
                                    event["payload"]["product"]["custom_attributes"],
                                )
                            )
                            if len(url_key) > 0:
                                url_key = url_key[0]["value"]

                                if args.demo:
                                    # Open up Edge browser at the specified URL for demo purposes to show the product was removed
                                    os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
                                    os.system(os_command)
                                    print(
                                        f"Opened Edge browser for product SKU: {sku}. It should give a page not found message."
                                    )
                    elif event.get("type") == "add_sale":
                        product_id = (
                            event.get("payload").get("rule").get("product_ids")[0]
                        )
                        if product_id:
                            remove_product_sales_rule(token, product_id)

            # remove events.json file after removal of products
            os.remove(args.output_file)

        except FileNotFoundError:
            print(f"✗ File {args.output_file} not found.")
            exit(1)
