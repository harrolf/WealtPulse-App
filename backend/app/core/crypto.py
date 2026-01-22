from cryptography.fernet import Fernet
from functools import lru_cache
from app.core.config import settings


@lru_cache()
def get_fernet() -> Fernet:
    """
    Return a cached Fernet instance to avoid expensive re-initialization.
    """
    return Fernet(settings.ENCRYPTION_KEY)


def encrypt_string(plaintext: str) -> str:
    """
    Encrypt a string using the app's ENCRYPTION_KEY.
    """
    if not plaintext:
        return plaintext
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_string(ciphertext: str) -> str:
    """
    Decrypt a string using the app's ENCRYPTION_KEY.
    Raises an exception if decryption fails to prevent data corruption.
    """
    if not ciphertext:
        return ciphertext
    f = get_fernet()
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception as e:
        # CRITICAL: Do NOT return ciphertext on failure.
        raise ValueError("Decryption failed. Invalid key or corrupted data.") from e
