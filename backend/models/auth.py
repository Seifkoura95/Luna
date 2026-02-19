"""
Authentication related data models
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PushTokenRequest(BaseModel):
    push_token: str


class RegisterPushTokenRequest(BaseModel):
    push_token: str
    device_type: str = "mobile"
