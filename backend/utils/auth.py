"""
Authentication utilities for Luna Group VIP API
Handles JWT token generation, validation, and user authentication
"""

import jwt
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'luna-jwt-secret-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7


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
