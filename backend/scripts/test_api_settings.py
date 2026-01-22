import requests

BASE_URL = "http://localhost:8000/api/v1"
EMAIL = "harrolf@gmail.com"
PASSWORD = "password"  # Assuming default password from seed/dev


def test_settings():
    # 1. Login
    print("Logging in...")
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/login", data={"username": EMAIL, "password": PASSWORD}
        )
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return

        token = resp.json()["access_token"]
        print("Login successful.")
    except Exception as e:
        print(f"Connection error: {e}")
        return

    # 2. Get Settings
    headers = {"Authorization": f"Bearer {token}"}
    print("Fetching settings...")
    try:
        resp = requests.get(f"{BASE_URL}/settings", headers=headers)
        if resp.status_code == 200:
            print("Settings Response:")
            print(resp.json())
        else:
            print(f"Get settings failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Request error: {e}")


if __name__ == "__main__":
    test_settings()
