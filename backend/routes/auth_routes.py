"""
Phantoms Music — Authentication Routes
User registration, login, and profile endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, EmailStr
from auth import hash_password, verify_password, create_token, require_auth
import database as db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ─── Request Models ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)

class LoginRequest(BaseModel):
    username: str
    password: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    """
    Register a new user account.
    Returns a JWT token on success.
    """
    # Check if username already exists
    existing = await db.get_user_by_username(req.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )

    # Create user with hashed password
    try:
        hashed = hash_password(req.password)
        user = await db.create_user(req.username, req.email, hashed)
        token = create_token(user["id"], user["username"])

        return {
            "message": "Account created successfully",
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"]
            }
        }
    except Exception as e:
        if "UNIQUE constraint" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create account"
        )


@router.post("/login")
async def login(req: LoginRequest):
    """
    Login with username and password.
    Returns a JWT token on success.
    """
    user = await db.get_user_by_username(req.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_token(user["id"], user["username"])

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }


@router.get("/me")
async def get_profile(user: dict = Depends(require_auth)):
    """Get the current authenticated user's profile."""
    profile = await db.get_user_by_id(user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": profile}
