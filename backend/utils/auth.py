"""
Authentication utilities for Luna Group VIP API
Handles JWT token generation, validation, and user authentication
"""

import jwt
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS, EMAIL_VERIFICATION_EXPIRY_HOURS


def get_current_user(authorization: Optional[str] = None) -> dict:
    """
    Validate JWT token and return user data
    
    Args:
        authorization: Authorization header value (Bearer token)
    
    Returns:
        dict: Decoded JWT payload with user_id and email
    
    Raises:
        HTTPException: If token is missing, expired, or invalid
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def create_access_token(user_id: str, email: str) -> str:
    """
    Create a new JWT access token for a user
    
    Args:
        user_id: Unique user identifier
        email: User's email address
    
    Returns:
        str: Encoded JWT token
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_verification_token() -> str:
    """Generate a secure email verification token"""
    return secrets.token_urlsafe(32)


async def send_verification_email(email: str, name: str, token: str) -> str:
    """
    Send verification email via Resend (branded lunagroup.com.au sender).
    Falls back to logging-only if RESEND_API_KEY is missing.

    Returns:
        str: Verification link (for logging / testing callers).
    """
    from utils.email_service import send_verification_email as _send
    return await _send(email, name, token)
