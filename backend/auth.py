
import os
import bcrypt

from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from jose import jwt
from pwdlib import PasswordHash

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY or SECRET_KEY == "development-secret":
    raise RuntimeError(
        "Set a strong SECRET_KEY in your backend .env file."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Keep support for existing Argon2id password hashes.
legacy_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash new passwords using bcrypt."""
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError(
            "Password must not exceed 72 UTF-8 bytes."
        )

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(rounds=12)
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Verify bcrypt and legacy Argon2id hashes."""
    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        password_bytes = plain_password.encode("utf-8")

        if len(password_bytes) > 72:
            return False

        try:
            return bcrypt.checkpw(
                password_bytes,
                hashed_password.encode("utf-8")
            )
        except (ValueError, TypeError):
            return False

    try:
        return legacy_password_hash.verify(
            plain_password,
            hashed_password
        )
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict) -> str:
    """Create a signed JWT that expires after 60 minutes."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
