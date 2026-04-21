"""
Entry Tickets - Gifted free-entry QR tickets.

Admins/managers gift free entry tickets to users from the Lovable portal.
Users see these in the mobile app and can show the QR at the venue door.
Staff scan the QR to consume the ticket (single-use, 24h expiry).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import hmac
import hashlib
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/entry-tickets", tags=["Entry Tickets"])
logger = logging.getLogger(__name__)

QR_SECRET = "luna_entry_ticket_qr_2026"


def _generate_qr(ticket_id: str, user_id: str) -> str:
    data = f"LUNA-ENTRY:{ticket_id}:{user_id}"
    sig = hmac.new(QR_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:10]
    return f"LUNA-ENT-{ticket_id[:8].upper()}-{sig.upper()}"


def _current_status(ticket: dict) -> str:
    """Compute live status based on timestamps."""
    if ticket.get("status") == "used":
        return "used"
    if ticket.get("status") == "revoked":
        return "revoked"
    now = datetime.now(timezone.utc)
    valid_from = ticket.get("valid_from")
    valid_until = ticket.get("valid_until")
    if isinstance(valid_from, str):
        valid_from = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
    if isinstance(valid_until, str):
        valid_until = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
    if valid_from and now < valid_from:
        return "scheduled"  # Not yet active
    if valid_until and now >= valid_until:
        return "expired"
    return "active"


def _serialize(ticket: dict) -> dict:
    """Strip _id, add computed status, normalise ISO strings."""
    out = {k: v for k, v in ticket.items() if k != "_id"}
    out["live_status"] = _current_status(ticket)
    for dk in ("valid_from", "valid_until", "used_at", "created_at", "revoked_at"):
        v = out.get(dk)
        if hasattr(v, "isoformat"):
            out[dk] = v.isoformat()
    return out


class ValidateQRRequest(BaseModel):
    qr_code: str
    venue_id: str


@router.get("/my")
async def list_my_tickets(request: Request, status: Optional[str] = None):
    """List entry tickets gifted to the authenticated user."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    tickets = await db.entry_tickets.find(
        {"user_id": current["user_id"]}
    ).sort("created_at", -1).to_list(200)

    serialized = [_serialize(t) for t in tickets]
    if status:
        serialized = [t for t in serialized if t["live_status"] == status]
    return {"tickets": serialized, "total": len(serialized)}


@router.get("/{ticket_id}")
async def get_ticket(request: Request, ticket_id: str):
    """Get a specific ticket (must belong to the caller)."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    ticket = await db.entry_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Entry ticket not found")
    if ticket["user_id"] != current["user_id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    return {"ticket": _serialize(ticket)}


@router.post("/validate-qr")
async def validate_entry_qr(request: Request, body: ValidateQRRequest):
    """Venue staff scan — consume a single-use entry ticket.
    Accepts either staff JWT (role in staff/manager/admin) or the venue dashboard token.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(auth_header)
    staff = await db.users.find_one({"user_id": user_data.get("user_id")})
    if not staff or staff.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Staff access required")

    ticket = await db.entry_tickets.find_one({"qr_code": body.qr_code})
    if not ticket:
        return {"success": False, "reason": "invalid_qr", "message": "QR code not recognised"}

    # Check venue
    if ticket["venue_id"] != body.venue_id:
        return {
            "success": False,
            "reason": "wrong_venue",
            "message": f"This ticket is for {ticket.get('venue_name', 'another venue')}, not this one.",
        }

    live = _current_status(ticket)
    if live == "used":
        return {"success": False, "reason": "already_used", "message": "Ticket has already been used", "used_at": ticket.get("used_at")}
    if live == "revoked":
        return {"success": False, "reason": "revoked", "message": "Ticket was revoked"}
    if live == "expired":
        return {"success": False, "reason": "expired", "message": "Ticket has expired"}
    if live == "scheduled":
        return {"success": False, "reason": "not_yet_active", "message": "Ticket is not yet active"}

    # Consume
    now = datetime.now(timezone.utc).isoformat()
    await db.entry_tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {"status": "used", "used_at": now, "used_by_staff_id": staff["user_id"]}}
    )
    # Fetch user for nice response
    user = await db.users.find_one({"user_id": ticket["user_id"]}, {"_id": 0, "name": 1, "email": 1})
    return {
        "success": True,
        "message": "Entry granted",
        "ticket_id": ticket["id"],
        "user_name": (user or {}).get("name"),
        "user_email": (user or {}).get("email"),
        "venue_id": ticket["venue_id"],
    }
