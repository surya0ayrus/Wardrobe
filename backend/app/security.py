"""Password hashing. Hashes use the same bcrypt format as Laravel ($2y$), so logins created by
the Laravel version keep working on an existing database."""
import bcrypt

from app.config import settings


def _bytes(password: str) -> bytes:
    return password.encode()[:72]  # bcrypt only looks at the first 72 bytes


def is_hashed(value: str) -> bool:
    return value.startswith(("$2y$", "$2b$", "$2a$")) and len(value) == 60


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_bytes(password), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()
    return "$2y$" + hashed[4:]


def check_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_bytes(password), ("$2b$" + hashed[4:]).encode())
    except ValueError:
        return False
