"""
Adobe Commerce (Magento 2) REST API Authentication with Client ID/Secret

This script demonstrates authentication using Client ID and Client Secret.
This is typically used for Adobe I/O integrations.
"""

import copy
import os
from time import sleep
import json
import time
from uuid import uuid4
from auth import get_admin_token
from auth import ADMIN_USERNAME, ADMIN_PASSWORD
import base64
from store_requests import make_authenticated_request
from product_operations import remove_product, add_product, generate_product_from_catalog

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

if __name__ == "__main__":
    import argparse

    # Add arugments for add or remove products
    parser = argparse.ArgumentParser(description="Manage products in Adobe Commerce")
    parser.add_argument(
        "--option",
        type=str,
        help="Option to add or remove products",
        choices=["init", "add", "reset", "test"],
        required=True,
    )
    parser.add_argument(
        "--num_to_add",
        type=int,
        help="Number of products to add",
        default=10,
    )
    parser.add_argument(
        "--output_file",
        type=str,
        help="Path to output JSON file for added products",
        default="products_added.json",
    )
    args = parser.parse_args()

    token = get_admin_token(ADMIN_USERNAME, ADMIN_PASSWORD)

    if args.option == "test":
        print(f"Bearer Token: {token}")
        example_api_calls(token)

    if not token:
        print("\n✗ Authentication failed")
        exit(1)

    if args.option == "init":
        # Generate a set of products based on the existing catalog and save to JSON file
        num_added = 0
        products_added = []
        while True:
            if num_added >= args.num_to_add:
                break

            print(f"\nGenerating product {num_added + 1} of {args.num_to_add}...")

            product = generate_product_from_catalog(token, num_added)
            if product:
                # Get a timestamp for when the product was created
                product["created_at"] = time.time()
                products_added.append(product)

            sleep(3)
            num_added += 1

        # Save added products to JSON file
        with open(args.output_file, "w") as f:
            json.dump(products_added, f, indent=2)
            print(f"✓ Saved products to {args.output_file}")

    elif args.option == "add":
        # Open the products_added.json file and add all products
        try:
            with open(args.output_file, "r") as f:
                products_to_add = json.load(f)

                previous_timestamp = None
                for product in products_to_add:
                    created_at = product.get("created_at")
                    if previous_timestamp is not None:
                        # Calculate time difference and sleep accordingly to simulate original timing
                        time_diff = created_at - previous_timestamp
                        if time_diff > 0:
                            print(f"Sleeping for {time_diff} seconds to simulate original timing before adding product to catalog...")
                            sleep(time_diff)

                    sku = product.get("product", {}).get("sku")
                    if sku:
                        add_product(token, sku, product)

                    previous_timestamp = created_at

                    url_key = list(filter(lambda x: x["attribute_code"] == "url_key", product["product"]["custom_attributes"]))
                    if len(url_key) > 0:
                        url_key = url_key[0]["value"]
                        sku = product.get("product").get("sku")

                        # Open up Edge browser at the specified URL for demo purposes to show the product was added 
                        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
                        os.system(os_command)
                        print(f"Opened Edge browser for product SKU: {sku}")

                        # open advanced search page as well
                        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/catalogsearch/advanced/result/?sku={sku}'"
                        os.system(os_command)
                    
        except FileNotFoundError:
            print(
                f"✗ File {args.output_file} not found. Run init option first to generate products_added.json."
            )
            exit(1)
    elif args.option == "reset":
        # Check for products_added.json file and remove all products listed
        try:
            with open(args.output_file, "r") as f:
                products_to_remove = json.load(f)

                for product in products_to_remove:
                    sku = product.get("product", {}).get("sku")
                    if sku:
                        remove_product(token, sku)

                        url_key = list(filter(lambda x: x["attribute_code"] == "url_key", product["product"]["custom_attributes"]))
                        if len(url_key) > 0:
                            url_key = url_key[0]["value"]

                            # Open up Edge browser at the specified URL for demo purposes to show the product was removed 
                            os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
                            os.system(os_command)
                            print(f"Opened Edge browser for product SKU: {sku}. It should give a page not found message.")

                        sleep(2)

            # remove products_added.json file after removal of products
            os.remove(args.output_file)

        except FileNotFoundError:
            print(f"✗ File {args.output_file} not found.")
            exit(1)

