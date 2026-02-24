"""Fernet symmetric encryption for storing user API keys at rest."""

import base64
import hashlib

from cryptography.fernet import Fernet

from backend.config import settings

# Derive a stable Fernet key from the JWT secret (SHA-256 → base64-url 32 bytes)
_key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret_key.encode()).digest())
_fernet = Fernet(_key)


def encrypt(plaintext: str) -> str:
    """Encrypt a string and return the ciphertext as a UTF-8 string."""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string back to plaintext."""
    return _fernet.decrypt(ciphertext.encode()).decode()
