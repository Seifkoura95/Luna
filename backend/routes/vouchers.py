"""
Vouchers Routes - Manage user vouchers
"""
from fastapi import APIRouter, Request
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/vouchers", tags=["vouchers"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_user_vouchers(request: Request):
    """Get all vouchers for the current user"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    vouchers = await db.vouchers.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(length=100)
    
    for v in vouchers:
        v.pop("_id", None)
    
    return {
        "vouchers": vouchers,
        "total": len(vouchers)
    }
