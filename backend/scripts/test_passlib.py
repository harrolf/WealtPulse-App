from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hash = pwd_context.hash("testpassword")
print(f"Hash: {hash}")
verify = pwd_context.verify("testpassword", hash)
print(f"Verify: {verify}")
