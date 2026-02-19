"""
Email related data models
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class CrewInviteEmailRequest(BaseModel):
    to_email: EmailStr
    crew_name: str
    inviter_name: str
    invite_link: str
