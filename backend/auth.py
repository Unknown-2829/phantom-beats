"""
Phantoms Music — Authentication
JWT token creation/validation and password hashing with bcrypt.
"""

import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS

security = HTTPBearer(auto_error=False)


# ═══════════════════════════════════════════════════════════════════════════════
# Password Hashing
# ═══════════════════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ═══════════════════════════════════════════════════════════════════════════════
# JWT Token Management
# ═══════════════════════════════════════════════════════════════════════════════

def create_token(user_id: int, username: str) -> str:
    """Create a JWT access token."""
    payload = {
        "sub": str(user_id),  # PyJWT 2.10+ requires sub to be a string
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI Dependencies
# ═══════════════════════════════════════════════════════════════════════════════

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict | None:
    """
    Dependency that extracts user from JWT.
    Returns None if no token is provided OR if the token is invalid.
    This ensures public endpoints (search, trending) still work with stale tokens.
    """
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return {"id": int(payload["sub"]), "username": payload["username"]}
    except (HTTPException, Exception):
        # Invalid or expired token — treat as unauthenticated for optional auth
        return None


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency that REQUIRES a valid JWT.
    Raises 401 if not authenticated.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_token(credentials.credentials)
    return {"id": int(payload["sub"]), "username": payload["username"]}
