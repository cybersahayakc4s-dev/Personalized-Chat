import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Any, Tuple
from passlib.context import CryptContext
from jose import jwt, JWTError, ExpiredSignatureError
from .config import settings

# Password hashing context with bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generates a secure one-way bcrypt hash."""
    return pwd_context.hash(password)

def hash_token(token: str) -> str:
    """Generates sha256 hex digest of a token string for safe database persistence."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def generate_refresh_token() -> str:
    """Generates a high-entropy cryptographically secure refresh token string."""
    return secrets.token_urlsafe(48)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encodes JWT access token with payload and expiry."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def decode_access_token_full(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """Decodes token and returns (payload, error_type). error_type is 'expired', 'invalid', or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload, None
    except ExpiredSignatureError:
        return None, "expired"
    except JWTError:
        return None, "invalid"
