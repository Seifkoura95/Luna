"""
Authentication related data models
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None  # ISO format: YYYY-MM-DD
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    preferred_venues: Optional[list] = None
    referral_code: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_venues: Optional[list] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PushTokenRequest(BaseModel):
    push_token: str


class RegisterPushTokenRequest(BaseModel):
    push_token: str
    device_type: str = "mobile"
