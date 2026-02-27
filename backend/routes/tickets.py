"""
Tickets Wallet API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/tickets", tags=["Tickets"])


class PurchaseTicketRequest(BaseModel):
    event_id: str
    quantity: int = 1
    ticket_type: str = "general"


class AddGuestRequest(BaseModel):
    ticket_id: str
    guest_name: str
    guest_email: Optional[str] = None


@router.get("")
async def get_user_tickets(request: Request, status: Optional[str] = None):
    """Get user's tickets - active, upcoming, or history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    now = datetime.now(timezone.utc)
    query = {"user_id": current_user["user_id"]}
    
    tickets = await db.tickets.find(query).sort("event_date", -1).to_list(100)
    
    active = []
    upcoming = []
    history = []
    
    for ticket in tickets:
        ticket_clean = clean_mongo_doc(ticket)
        event_date = ticket.get("event_date")
        
        if isinstance(event_date, str):
            event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
        
        if ticket.get("status") == "cancelled":
            history.append(ticket_clean)
        elif event_date:
            if event_date.date() == now.date():
                active.append(ticket_clean)
            elif event_date > now:
                upcoming.append(ticket_clean)
            else:
                history.append(ticket_clean)
        else:
            upcoming.append(ticket_clean)
    
    if status == "active":
        return active
    elif status == "upcoming":
        return upcoming
    elif status == "history":
        return history
    
    return {
        "active": active,
        "upcoming": upcoming,
        "history": history
    }


@router.post("/purchase")
async def purchase_ticket(request: Request, ticket_req: PurchaseTicketRequest):
    """Purchase tickets for an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    event = await db.events.find_one({"id": ticket_req.event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    tickets_created = []
    for i in range(ticket_req.quantity):
        ticket_id = str(uuid.uuid4())[:8].upper()
        ticket = {
            "id": ticket_id,
            "user_id": current_user["user_id"],
            "event_id": ticket_req.event_id,
            "event_title": event.get("title"),
            "venue_id": event.get("venue_id"),
            "venue_name": event.get("venue_name"),
            "event_date": event.get("event_date"),
            "ticket_type": ticket_req.ticket_type,
            "qr_code": f"TKT-{ticket_id}-{current_user['user_id'][:8]}",
            "status": "active",
            "guests": [],
            "created_at": datetime.now(timezone.utc),
            "price": event.get("ticket_price", 0)
        }
        await db.tickets.insert_one(ticket)
        tickets_created.append(clean_mongo_doc(ticket))
    
    points = 50 * ticket_req.quantity
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": points}}
    )
    
    return {
        "success": True,
        "tickets": tickets_created,
        "points_earned": points,
        "message": f"Successfully purchased {ticket_req.quantity} ticket(s)!"
    }


@router.post("/add-guest")
async def add_guest_to_ticket(request: Request, guest_req: AddGuestRequest):
    """Add a guest to a ticket"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    ticket = await db.tickets.find_one({
        "id": guest_req.ticket_id,
        "user_id": current_user["user_id"]
    })
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    guest = {
        "id": str(uuid.uuid4())[:8],
        "name": guest_req.guest_name,
        "email": guest_req.guest_email,
        "added_at": datetime.now(timezone.utc)
    }
    
    await db.tickets.update_one(
        {"id": guest_req.ticket_id},
        {"$push": {"guests": guest}}
    )
    
    return {"success": True, "guest": guest, "message": f"Guest {guest_req.guest_name} added!"}


@router.delete("/{ticket_id}/guest/{guest_id}")
async def remove_guest(request: Request, ticket_id: str, guest_id: str):
    """Remove a guest from a ticket"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.tickets.update_one(
        {"id": ticket_id, "user_id": current_user["user_id"]},
        {"$pull": {"guests": {"id": guest_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    return {"success": True, "message": "Guest removed"}
