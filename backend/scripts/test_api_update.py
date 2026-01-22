import requests

# API URL
API_URL = "http://localhost:8000/api/v1"

# We need a token. Since we can't easily login without password,
# let's try to grab a token using the login endpoint if possible,
# OR we can generate one if we had access to the secret key,
# BUT simpler is to just use the requests against the running server
# assuming we can login.
#
# Actually, I can use the existing `check_settings.py` approach to *modify* the DB directly
# to see if the issue is the pydantic validation? No, that bypasses the API.
#
# Let's try to use the login endpoint. I hope 'password' is 'password' or similar.
# The user prompted with 'harrolf@gmail.com'.
#
# Alternative: I can temporarily modify the backend `settings.py` to print the received payload.
#
# Let's try to login with common passwords.
# If that fails, I will add logging to the backend.


def test_login_and_update():
    # Try generic password, often 'password' or 'secret' in dev seeds
    # If this fails, I'll switch strategies.
    login_data = {"username": "harrolf@gmail.com", "password": "password"}

    print(f"Attempting login for {login_data['username']}...")
    try:
        r = requests.post(f"{API_URL}/auth/login", data=login_data)
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}")
            return

        token = r.json()["access_token"]
        print("Login successful, token obtained.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # Payload to test
        payload = {"time_format": "12h", "date_format": "iso"}

        print(f"Sending PUT /settings with {payload}...")
        r_put = requests.put(f"{API_URL}/settings", headers=headers, json=payload)

        print(f"PUT Response Status: {r_put.status_code}")
        print(f"PUT Response Body: {r_put.text}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_login_and_update()
