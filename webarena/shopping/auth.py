import requests

STORE_URL = "http://localhost:7770"  # Your Adobe Commerce store URL
ADMIN_USERNAME = "admin"  # Admin username
ADMIN_PASSWORD = "admin1234"  # Admin password


def get_customer_token(username, password):
    """
    Get customer token using customer email and password.

    Args:
        username: Customer email
        password: Customer password

    Returns:
        Bearer token string
    """
    url = f"{STORE_URL}/rest/V1/integration/customer/token"

    payload = {"username": username, "password": password}

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


def get_admin_token(username, password):
    """
    Get admin token using username and password.
    This is the simplest authentication method for testing.

    Args:
        username: Admin username
        password: Admin password

    Returns:
        Bearer token string
    """
    url = f"{STORE_URL}/rest/V1/integration/admin/token"

    payload = {"username": username, "password": password}

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
