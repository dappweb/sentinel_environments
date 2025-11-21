import requests

STORE_URL = "http://localhost:7770"  # Your Adobe Commerce store URL
ADMIN_USERNAME = "admin"  # Admin username
ADMIN_PASSWORD = "admin1234"  # Admin password

CUSTOMER_USERNAME = "mandamarie05@gmail.com"
CUSTOMER_PASSWORD = "test1234!"


def create_customer_account():
    """
    Use the Magento REST API to create a new customer account.
    """
    url = f"{STORE_URL}/rest/V1/customers"

    payload = {
        "customer": {
            "email": CUSTOMER_USERNAME,
            "firstname": "Sentinel",
            "lastname": "User",
            "store_id": 1,
            "website_id": 1,
        },
        "password": CUSTOMER_PASSWORD,
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print("✓ Successfully created customer account")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error creating customer account: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None


def get_customer_token():
    """
    Get customer token using customer email and password.

    Returns:
        Bearer token string
    """
    url = f"{STORE_URL}/rest/V1/integration/customer/token"

    payload = {"username": CUSTOMER_USERNAME, "password": CUSTOMER_PASSWORD}

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        token = response.json()
        print("✓ Successfully obtained customer token")
        return token
    except requests.exceptions.RequestException as e:
        print(f"Error getting customer token: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None


def get_admin_token():
    """
    Get admin token using username and password.
    This is the simplest authentication method for testing.

    Returns:
        Bearer token string
    """
    url = f"{STORE_URL}/rest/V1/integration/admin/token"

    payload = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        token = response.json()
        print("✓ Successfully obtained admin token")
        return token
    except requests.exceptions.RequestException as e:
        print(f"Error getting admin token: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None
