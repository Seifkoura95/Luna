"""
Bookings API - VIP Table Booking with Deposits & Bottle Service Pre-Orders
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime, timezone

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ── Models ────────────────────────────────────────────────────────────────────

class TableBookingCreate(BaseModel):
    venue_id: str
    table_id: str
    date: str  # YYYY-MM-DD
    party_size: int
    special_requests: Optional[str] = None
    contact_phone: Optional[str] = None


class BottlePreOrderCreate(BaseModel):
    venue_id: str
    booking_id: Optional[str] = None  # Link to existing table booking
    date: str  # YYYY-MM-DD
    items: List[dict]  # [{package_id, quantity}]
    special_requests: Optional[str] = None


class BookingRequest(BaseModel):
    venue_id: str
    date: str
    time: str
    party_size: int
    special_requests: Optional[str] = None
    occasion: Optional[str] = None


class GuestlistRequest(BaseModel):
    venue_id: str
    date: str
    party_size: int
    arrival_time: Optional[str] = None
    vip_booth: bool = False


# ── Bottle Service Menus ──────────────────────────────────────────────────────

BOTTLE_MENUS = {
    "eclipse": [
        {"id": "ecl_grey_goose", "name": "Grey Goose Vodka", "category": "Vodka", "price": 350, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml premium French vodka with mixers"},
        {"id": "ecl_moet", "name": "Moet & Chandon", "category": "Champagne", "price": 250, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Brut Imperial champagne"},
        {"id": "ecl_dom_p", "name": "Dom Perignon", "category": "Champagne", "price": 650, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml vintage champagne"},
        {"id": "ecl_hennessy", "name": "Hennessy VS", "category": "Cognac", "price": 400, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml cognac with mixers"},
        {"id": "ecl_premium_pkg", "name": "Premium Package", "category": "Package", "price": 800, "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400", "description": "2x bottles (vodka + champagne), mixers, ice, garnishes, dedicated host"},
        {"id": "ecl_ultra_pkg", "name": "Ultra VIP Package", "category": "Package", "price": 1500, "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400", "description": "3x premium bottles, Dom Perignon, sparklers, VIP host, priority entry x10"},
    ],
    "after_dark": [
        {"id": "ad_ciroc", "name": "Ciroc Vodka", "category": "Vodka", "price": 320, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml premium vodka with mixers"},
        {"id": "ad_hennessy", "name": "Hennessy VS", "category": "Cognac", "price": 380, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml cognac with mixers"},
        {"id": "ad_ace", "name": "Ace of Spades", "category": "Champagne", "price": 800, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Armand de Brignac Gold Brut"},
        {"id": "ad_hiphop_pkg", "name": "Hip Hop Package", "category": "Package", "price": 900, "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400", "description": "Hennessy + Ciroc + mixers + sparklers + VIP host"},
    ],
    "su_casa_brisbane": [
        {"id": "scb_aperol", "name": "Aperol Spritz Jug", "category": "Cocktails", "price": 85, "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400", "description": "1.5L jug of Aperol Spritz (serves 4-6)"},
        {"id": "scb_espresso", "name": "Espresso Martini Jug", "category": "Cocktails", "price": 95, "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400", "description": "1.5L jug of Espresso Martini (serves 4-6)"},
        {"id": "scb_prosecco", "name": "Prosecco Bottle", "category": "Wine", "price": 60, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Italian Prosecco"},
        {"id": "scb_rooftop_pkg", "name": "Rooftop Package", "category": "Package", "price": 450, "image_url": "https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=400", "description": "2x cocktail jugs + prosecco + grazing board + reserved seating"},
    ],
    "su_casa_gold_coast": [
        {"id": "scgc_ciroc", "name": "Ciroc Vodka", "category": "Vodka", "price": 300, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml premium vodka with mixers"},
        {"id": "scgc_moet", "name": "Moet & Chandon", "category": "Champagne", "price": 230, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Brut Imperial champagne"},
        {"id": "scgc_coast_pkg", "name": "Coast Package", "category": "Package", "price": 700, "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400", "description": "2x bottles + champagne + mixers + VIP host + sparklers"},
    ],
    "pump": [
        {"id": "pump_absolut", "name": "Absolut Vodka", "category": "Vodka", "price": 280, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml vodka with energy drinks & mixers"},
        {"id": "pump_jager", "name": "Jagermeister", "category": "Spirits", "price": 250, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml Jagermeister with Red Bull"},
        {"id": "pump_edm_pkg", "name": "EDM Package", "category": "Package", "price": 750, "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400", "description": "2x bottles + Red Bull supply + LED sparklers + VIP wristbands x8"},
    ],
    "mamacita": [
        {"id": "mama_patron", "name": "Patron Silver", "category": "Tequila", "price": 350, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "700ml premium tequila with limes & salt"},
        {"id": "mama_don_julio", "name": "Don Julio 1942", "category": "Tequila", "price": 550, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "750ml premium aged tequila"},
        {"id": "mama_latin_pkg", "name": "Latin Heat Package", "category": "Package", "price": 850, "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400", "description": "Patron + Don Julio + margarita pitcher + sparklers + VIP host"},
    ],
    "juju": [
        {"id": "juju_wine_w", "name": "Premium White Wine", "category": "Wine", "price": 65, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml house premium Sauvignon Blanc"},
        {"id": "juju_wine_r", "name": "Premium Red Wine", "category": "Wine", "price": 75, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml house premium Shiraz"},
        {"id": "juju_dining_pkg", "name": "Dining Experience", "category": "Package", "price": 350, "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", "description": "2x wine bottles + chef's grazing platter + dessert board"},
    ],
    "night_market": [
        {"id": "nm_sake", "name": "Premium Sake Carafe", "category": "Sake", "price": 55, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "500ml house premium sake"},
        {"id": "nm_soju", "name": "Soju Tower", "category": "Soju", "price": 45, "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400", "description": "Soju tower with fruit flavours (serves 4)"},
        {"id": "nm_feast_pkg", "name": "Night Market Feast", "category": "Package", "price": 250, "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400", "description": "Sake + soju + shared banquet menu (8 dishes) for up to 6 people"},
    ],
    "ember_and_ash": [
        {"id": "ea_penfolds", "name": "Penfolds Bin 389", "category": "Wine", "price": 120, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Cabernet Shiraz"},
        {"id": "ea_veuve", "name": "Veuve Clicquot", "category": "Champagne", "price": 200, "image_url": "https://images.unsplash.com/photo-1592845539422-7c8e1f95fa31?w=400", "description": "750ml Yellow Label Brut"},
        {"id": "ea_fine_pkg", "name": "Fine Dining Package", "category": "Package", "price": 500, "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", "description": "Veuve Clicquot + Penfolds + wagyu sharing board + dessert"},
    ],
}


# ── VIP Table Booking ─────────────────────────────────────────────────────────

@router.post("/table")
async def create_table_booking(request: Request, body: TableBookingCreate):
    """Create a VIP table booking (pending deposit payment)"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    if body.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Import VENUE_TABLES from venues route
    from routes.venues import VENUE_TABLES
    tables = VENUE_TABLES.get(body.venue_id, [])
    table = next((t for t in tables if t["id"] == body.table_id), None)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if body.party_size > table["capacity"]:
        raise HTTPException(status_code=400, detail=f"Max capacity is {table['capacity']} guests")

    # Check if table is already booked
    existing = await db.table_bookings.find_one({
        "venue_id": body.venue_id,
        "table_id": body.table_id,
        "date": body.date,
        "status": {"$in": ["confirmed", "pending"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="This table is already booked for that date")

    booking_id = f"TB-{uuid.uuid4().hex[:8].upper()}"
    venue = LUNA_VENUES[body.venue_id]

    booking = {
        "booking_id": booking_id,
        "user_id": user["user_id"],
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "table_id": body.table_id,
        "table_name": table["name"],
        "table_location": table["location"],
        "date": body.date,
        "party_size": body.party_size,
        "min_spend": table["min_spend"],
        "deposit_amount": table["deposit_amount"],
        "deposit_paid": False,
        "special_requests": body.special_requests,
        "contact_phone": body.contact_phone,
        "status": "pending",
        "features": table["features"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.table_bookings.insert_one(booking)

    return {
        "success": True,
        "booking": clean_mongo_doc(booking),
        "message": f"Table reserved at {venue['name']}! Pay the ${table['deposit_amount']} deposit to confirm.",
    }


@router.post("/table/{booking_id}/deposit")
async def create_deposit_intent(request: Request, booking_id: str):
    """Create a payment intent for the table deposit"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": user["user_id"],
    })
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("deposit_paid"):
        raise HTTPException(status_code=400, detail="Deposit already paid")

    # Demo mode — simulate Stripe payment
    payment_intent_id = f"pi_demo_{uuid.uuid4().hex[:12]}"
    return {
        "success": True,
        "payment_intent_id": payment_intent_id,
        "amount": booking["deposit_amount"],
        "currency": "aud",
        "demo_mode": True,
        "message": "Demo payment mode — in production this connects to Stripe",
    }


@router.post("/table/{booking_id}/confirm")
async def confirm_table_booking(request: Request, booking_id: str, payment_intent_id: str = ""):
    """Confirm table booking after deposit payment"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": user["user_id"],
    })
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    points_earned = 50 * booking.get("party_size", 2)

    await db.table_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "confirmed",
            "deposit_paid": True,
            "payment_intent_id": payment_intent_id,
            "confirmed_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    # Award loyalty points
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": points_earned}},
    )

    return {
        "success": True,
        "message": f"Your {booking['table_name']} at {booking['venue_name']} is confirmed!",
        "points_earned": points_earned,
    }


@router.delete("/table/{booking_id}")
async def cancel_table_booking(request: Request, booking_id: str):
    """Cancel a table booking"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": user["user_id"],
    })
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    await db.table_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )

    return {"success": True, "message": "Booking cancelled"}


# ── Bottle Service ────────────────────────────────────────────────────────────

@router.get("/bottle-menu/{venue_id}")
async def get_bottle_menu(venue_id: str):
    """Get bottle service menu for a venue"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    menu = BOTTLE_MENUS.get(venue_id, [])
    venue = LUNA_VENUES[venue_id]

    # Group by category
    categories = {}
    for item in menu:
        cat = item["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)

    return {
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "menu": menu,
        "categories": categories,
    }


@router.post("/bottle-preorder")
async def create_bottle_preorder(request: Request, body: BottlePreOrderCreate):
    """Create a bottle service pre-order"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    if body.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    menu = BOTTLE_MENUS.get(body.venue_id, [])
    menu_map = {item["id"]: item for item in menu}

    # Validate and calculate total
    order_items = []
    total = 0
    for item in body.items:
        pkg = menu_map.get(item.get("package_id"))
        if not pkg:
            raise HTTPException(status_code=400, detail=f"Invalid item: {item.get('package_id')}")
        qty = max(1, item.get("quantity", 1))
        line_total = pkg["price"] * qty
        total += line_total
        order_items.append({
            "package_id": pkg["id"],
            "name": pkg["name"],
            "category": pkg["category"],
            "price": pkg["price"],
            "quantity": qty,
            "line_total": line_total,
        })

    venue = LUNA_VENUES[body.venue_id]
    order_id = f"BO-{uuid.uuid4().hex[:8].upper()}"

    order = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "booking_id": body.booking_id,
        "date": body.date,
        "items": order_items,
        "total": total,
        "special_requests": body.special_requests,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.bottle_orders.insert_one(order)

    points_earned = int(total * 0.1)  # 10% of total as points
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": points_earned}},
    )

    return {
        "success": True,
        "order": clean_mongo_doc(order),
        "points_earned": points_earned,
        "message": f"Bottle service pre-order placed at {venue['name']}! ${total} total.",
    }


@router.get("/bottle-orders")
async def get_my_bottle_orders(request: Request):
    """Get user's bottle service orders"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    orders = await db.bottle_orders.find(
        {"user_id": user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    for o in orders:
        for key in ("created_at", "updated_at"):
            if key in o and hasattr(o[key], "isoformat"):
                o[key] = o[key].isoformat()

    return {"orders": orders}


@router.delete("/bottle-order/{order_id}")
async def cancel_bottle_order(request: Request, order_id: str):
    """Cancel a bottle service pre-order"""
    auth_header = request.headers.get("authorization")
    user = get_current_user(auth_header)

    order = await db.bottle_orders.find_one({
        "order_id": order_id,
        "user_id": user["user_id"],
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "confirmed":
        raise HTTPException(status_code=400, detail="Cannot cancel confirmed orders")

    await db.bottle_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )

    return {"success": True, "message": "Bottle order cancelled"}


# ── Legacy Booking Endpoints ──────────────────────────────────────────────────

@router.get("/availability")
async def get_availability(venue_id: str, date: str, party_size: int = 2):
    """Get available time slots for a venue"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue = LUNA_VENUES[venue_id]

    if venue["type"] == "restaurant":
        time_slots = [
            {"time": "12:00", "available": True, "tables": 3},
            {"time": "12:30", "available": True, "tables": 2},
            {"time": "13:00", "available": True, "tables": 4},
            {"time": "18:00", "available": True, "tables": 5},
            {"time": "18:30", "available": True, "tables": 3},
            {"time": "19:00", "available": party_size <= 4, "tables": 2},
            {"time": "19:30", "available": True, "tables": 4},
            {"time": "20:00", "available": party_size <= 6, "tables": 1},
            {"time": "20:30", "available": True, "tables": 3},
            {"time": "21:00", "available": True, "tables": 2},
        ]
    else:
        time_slots = [
            {"time": "21:00", "available": True, "spots": 50},
            {"time": "22:00", "available": True, "spots": 30},
            {"time": "23:00", "available": True, "spots": 20},
        ]

    return {
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "date": date,
        "party_size": party_size,
        "time_slots": time_slots,
    }


@router.post("/reserve")
async def create_booking(request: Request, booking: BookingRequest):
    """Create a restaurant reservation"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    if booking.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue = LUNA_VENUES[booking.venue_id]

    booking_id = str(uuid.uuid4())[:8].upper()
    booking_record = {
        "booking_id": booking_id,
        "user_id": current_user["user_id"],
        "venue_id": booking.venue_id,
        "venue_name": venue["name"],
        "date": booking.date,
        "time": booking.time,
        "party_size": booking.party_size,
        "special_requests": booking.special_requests,
        "occasion": booking.occasion,
        "status": "confirmed",
        "confirmation_code": f"SR-{booking_id}",
        "created_at": datetime.now(timezone.utc),
        "points_earned": 50 * booking.party_size,
    }

    await db.bookings.insert_one(booking_record)

    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": booking_record["points_earned"]}},
    )

    return {
        "success": True,
        "booking": clean_mongo_doc(booking_record),
        "message": f"Your reservation at {venue['name']} is confirmed!",
    }


@router.post("/guestlist")
async def add_to_guestlist(request: Request, guestlist: GuestlistRequest):
    """Add to nightclub guestlist"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    if guestlist.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue = LUNA_VENUES[guestlist.venue_id]

    guestlist_id = str(uuid.uuid4())[:8].upper()
    guestlist_record = {
        "guestlist_id": guestlist_id,
        "user_id": current_user["user_id"],
        "venue_id": guestlist.venue_id,
        "venue_name": venue["name"],
        "date": guestlist.date,
        "party_size": guestlist.party_size,
        "arrival_time": guestlist.arrival_time or "22:00",
        "vip_booth": guestlist.vip_booth,
        "status": "confirmed",
        "confirmation_code": f"GL-{guestlist_id}",
        "created_at": datetime.now(timezone.utc),
        "entry_priority": "VIP" if guestlist.vip_booth else "Priority",
        "points_earned": 100 if guestlist.vip_booth else 25,
    }

    await db.guestlist.insert_one(guestlist_record)

    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": guestlist_record["points_earned"]}},
    )

    return {
        "success": True,
        "guestlist": clean_mongo_doc(guestlist_record),
        "message": f"You're on the list for {venue['name']}! Show your QR code at the door.",
    }


@router.get("/my-reservations")
async def get_my_reservations(request: Request):
    """Get user's bookings and guestlist entries"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    bookings = await db.bookings.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    guestlist = await db.guestlist.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)

    return {
        "bookings": clean_mongo_docs(bookings),
        "guestlist": clean_mongo_docs(guestlist),
    }


@router.delete("/{booking_id}")
async def cancel_booking(request: Request, booking_id: str):
    """Cancel a booking or guestlist entry"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    booking = await db.bookings.find_one({"booking_id": booking_id, "user_id": current_user["user_id"]})
    if booking:
        await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "cancelled"}})
        return {"success": True, "message": "Reservation cancelled"}

    guestlist = await db.guestlist.find_one({"guestlist_id": booking_id, "user_id": current_user["user_id"]})
    if guestlist:
        await db.guestlist.update_one({"guestlist_id": booking_id}, {"$set": {"status": "cancelled"}})
        return {"success": True, "message": "Guestlist entry cancelled"}

    raise HTTPException(status_code=404, detail="Booking not found")


@router.get("/my-tables")
async def get_my_table_bookings(request: Request):
    """Get user's VIP table bookings"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    bookings = await db.table_bookings.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    for b in bookings:
        for key in ("created_at", "updated_at", "confirmed_at"):
            if key in b and hasattr(b[key], "isoformat"):
                b[key] = b[key].isoformat()

    return {"bookings": bookings}
