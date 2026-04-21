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
        # ── Vodka ───────────────────────────────────────────
        {"id": "ecl_belvedere_700", "name": "Belvedere", "category": "Vodka", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_belvedere_700.png", "description": "Polish luxury rye vodka, 700mL"},
        {"id": "ecl_belvedere_175", "name": "Belvedere Magnum", "category": "Vodka", "size": "1.75L", "price": 800, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_belvedere_175.png", "description": "Belvedere, 1.75L magnum"},
        {"id": "ecl_belvedere_3", "name": "Belvedere Jeroboam", "category": "Vodka", "size": "3L", "price": 1600, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_belvedere_3.png", "description": "Belvedere, 3L jeroboam"},
        {"id": "ecl_belvedere_6", "name": "Belvedere Imperial", "category": "Vodka", "size": "6L", "price": 2500, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_belvedere_6.png", "description": "Belvedere, 6L imperial"},
        {"id": "ecl_belvedere_10", "name": "Belvedere 10", "category": "Vodka", "size": "700mL", "price": 950, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_belvedere_10.png", "description": "Belvedere 10, 700mL"},
        {"id": "ecl_grey_goose", "name": "Grey Goose", "category": "Vodka", "size": "700mL", "price": 450, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_grey_goose.png", "description": "French premium vodka, 700mL"},
        {"id": "ecl_ciroc_750", "name": "Cîroc", "category": "Vodka", "size": "750mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_ciroc_750.png", "description": "French grape vodka, 750mL"},
        {"id": "ecl_ciroc_175", "name": "Cîroc Magnum", "category": "Vodka", "size": "1.75L", "price": 900, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_ciroc_175.png", "description": "Cîroc, 1.75L magnum"},
        # ── Gin ─────────────────────────────────────────────
        {"id": "ecl_bombay", "name": "Bombay Sapphire", "category": "Gin", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_bombay.png", "description": "London dry gin, 700mL"},
        {"id": "ecl_tanq10", "name": "Tanqueray 10", "category": "Gin", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_tanq10.png", "description": "Tanqueray No. 10, 700mL"},
        # ── Tequila ─────────────────────────────────────────
        {"id": "ecl_patron_silver", "name": "Patrón Silver", "category": "Tequila", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_patron_silver.png", "description": "Patrón Silver blanco, 700mL"},
        {"id": "ecl_patron_repo", "name": "Patrón Reposado", "category": "Tequila", "size": "700mL", "price": 450, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_patron_repo.png", "description": "Patrón Reposado, 700mL"},
        {"id": "ecl_1800_silver", "name": "1800 Silver", "category": "Tequila", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_1800_silver.png", "description": "1800 Silver blanco, 700mL"},
        {"id": "ecl_1800_coconut", "name": "1800 Coconut", "category": "Tequila", "size": "700mL", "price": 450, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_1800_coconut.png", "description": "1800 Coconut, 700mL"},
        {"id": "ecl_1800_anejo", "name": "1800 Añejo", "category": "Tequila", "size": "700mL", "price": 500, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_1800_anejo.png", "description": "1800 Añejo, 700mL"},
        {"id": "ecl_1800_crist", "name": "1800 Cristalino", "category": "Tequila", "size": "700mL", "price": 550, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_1800_crist.png", "description": "1800 Cristalino, 700mL"},
        {"id": "ecl_dj_blanco", "name": "Don Julio Blanco", "category": "Tequila", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_dj_blanco.png", "description": "Don Julio Blanco, 700mL"},
        {"id": "ecl_dj_repo", "name": "Don Julio Reposado", "category": "Tequila", "size": "700mL", "price": 500, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_dj_repo.png", "description": "Don Julio Reposado, 700mL"},
        {"id": "ecl_dj_1942", "name": "Don Julio 1942", "category": "Tequila", "size": "700mL", "price": 1000, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_dj_1942.png", "description": "Don Julio 1942 Añejo, 700mL"},
        {"id": "ecl_volcan_blanco", "name": "Volcán Blanco", "category": "Tequila", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_volcan_blanco.png", "description": "Volcán Blanco, 700mL"},
        {"id": "ecl_volcan_xa", "name": "Volcán XA Luminous", "category": "Tequila", "size": "700mL", "price": 1000, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_volcan_xa.png", "description": "Volcán XA Luminous, 700mL"},
        {"id": "ecl_volando", "name": "Volando Blanco", "category": "Tequila", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_volando.png", "description": "Volando Blanco, 700mL"},
        {"id": "ecl_clase_azul", "name": "Clase Azul Reposado", "category": "Tequila", "size": "700mL", "price": 1500, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_clase_azul.png", "description": "Clase Azul Reposado, 700mL"},
        {"id": "ecl_cincoro_gold", "name": "Cincoro Gold", "category": "Tequila", "size": "700mL", "price": 1600, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_cincoro_gold.png", "description": "Cincoro Gold, 700mL"},
        {"id": "ecl_cincoro_blanco_175", "name": "Cincoro Blanco Magnum", "category": "Tequila", "size": "1.75L", "price": 1800, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_cincoro_blanco_175.png", "description": "Cincoro Blanco, 1.75L"},
        {"id": "ecl_cincoro_repo", "name": "Cincoro Reposado", "category": "Tequila", "size": "700mL", "price": 1000, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_cincoro_repo.png", "description": "Cincoro Reposado, 700mL"},
        {"id": "ecl_cincoro_blanco", "name": "Cincoro Blanco", "category": "Tequila", "size": "700mL", "price": 850, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_cincoro_blanco.png", "description": "Cincoro Blanco, 700mL"},
        {"id": "ecl_cincoro_anejo", "name": "Cincoro Añejo", "category": "Tequila", "size": "700mL", "price": 1300, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_cincoro_anejo.png", "description": "Cincoro Añejo, 700mL"},
        # ── Scotch ──────────────────────────────────────────
        {"id": "ecl_jameson", "name": "Jameson", "category": "Scotch", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_jameson.png", "description": "Jameson Irish whiskey, 700mL"},
        {"id": "ecl_jw_black", "name": "Johnnie Walker Black", "category": "Scotch", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_jw_black.png", "description": "JW Black Label 12yo, 700mL"},
        {"id": "ecl_chivas", "name": "Chivas Regal", "category": "Scotch", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_chivas.png", "description": "Chivas Regal, 700mL"},
        {"id": "ecl_glenm", "name": "Glenmorangie Original", "category": "Scotch", "size": "700mL", "price": 500, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_glenm.png", "description": "Glenmorangie 10yo Original, 700mL"},
        {"id": "ecl_glenfiddich", "name": "Glenfiddich", "category": "Scotch", "size": "700mL", "price": 450, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_glenfiddich.png", "description": "Glenfiddich single malt, 700mL"},
        {"id": "ecl_macallan12", "name": "Macallan 12 Year Old", "category": "Scotch", "size": "700mL", "price": 600, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_macallan12.png", "description": "Macallan 12yo Double Cask, 700mL"},
        # ── Rum ─────────────────────────────────────────────
        {"id": "ecl_captain", "name": "Captain Morgan", "category": "Rum", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_captain.png", "description": "Captain Morgan Original, 700mL"},
        {"id": "ecl_kraken", "name": "The Kraken", "category": "Rum", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_kraken.png", "description": "The Kraken Black Spiced, 700mL"},
        {"id": "ecl_bacardi", "name": "Bacardi", "category": "Rum", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_bacardi.png", "description": "Bacardi Superior, 700mL"},
        # ── Bourbon ─────────────────────────────────────────
        {"id": "ecl_jd", "name": "Jack Daniel's", "category": "Bourbon", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_jd.png", "description": "Jack Daniel's Old No. 7, 700mL"},
        {"id": "ecl_makers", "name": "Maker's Mark", "category": "Bourbon", "size": "700mL", "price": 450, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_makers.png", "description": "Maker's Mark, 700mL"},
        {"id": "ecl_gent_jack", "name": "Gentleman Jack Magnum", "category": "Bourbon", "size": "1.75L", "price": 750, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_gent_jack.png", "description": "Gentleman Jack, 1.75L"},
        # ── Liqueur ─────────────────────────────────────────
        {"id": "ecl_alize", "name": "Alizé", "category": "Liqueur", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_alize.png", "description": "Alizé passion liqueur, 700mL"},
        {"id": "ecl_sourpuss", "name": "Sour Puss Collection", "category": "Liqueur", "size": "4x 700mL", "price": 300, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_sourpuss.png", "description": "Watermelon, Apple, Grape, Passionfruit"},
        {"id": "ecl_wetpussy", "name": "Wet Pussy", "category": "Liqueur", "size": "700mL", "price": 300, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_wetpussy.png", "description": "Wet Pussy shooter mix, 700mL"},
        # ── Cognac ──────────────────────────────────────────
        {"id": "ecl_henn_vs", "name": "Hennessy VS", "category": "Cognac", "size": "700mL", "price": 400, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_henn_vs.png", "description": "Hennessy VS, 700mL"},
        {"id": "ecl_henn_vsop", "name": "Hennessy VSOP", "category": "Cognac", "size": "700mL", "price": 600, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_henn_vsop.png", "description": "Hennessy VSOP Privilège, 700mL"},
        # ── Champagne ───────────────────────────────────────
        {"id": "ecl_veuve", "name": "Veuve Clicquot", "category": "Champagne", "size": "750mL", "price": 250, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_veuve.png", "description": "Veuve Clicquot Yellow Label, 750mL"},
        {"id": "ecl_moet", "name": "Moët & Chandon", "category": "Champagne", "size": "750mL", "price": 200, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_moet.png", "description": "Moët & Chandon Brut Impérial, 750mL"},
        {"id": "ecl_dom", "name": "Dom Pérignon", "category": "Champagne", "size": "750mL", "price": 800, "image_url": "https://birthday-rewards-1.preview.emergentagent.com/api/static/bottles/ecl_dom.png", "description": "Dom Pérignon Vintage, 750mL"},
    ],
}


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

    # Bottle service is Eclipse-only
    if body.venue_id != "eclipse":
        raise HTTPException(status_code=400, detail="Bottle service is only available at Eclipse.")

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

    # Deposit = $50 flat OR 10% of total, whichever is higher
    deposit_amount = max(50, round(total * 0.10, 2))
    balance_due = max(0, round(total - deposit_amount, 2))

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
        "deposit_amount": deposit_amount,
        "balance_due": balance_due,
        "special_requests": body.special_requests,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.bottle_orders.insert_one(order)

    from config import POINTS_PER_DOLLAR

    # DEV_MODE bypass for test account
    if user.get("email") == "luna@test.com":
        points_earned = int(total * POINTS_PER_DOLLAR)
        await db.bottle_orders.update_one(
            {"order_id": order_id},
            {"$set": {"status": "confirmed", "payment_status": "paid_dev",
                      "confirmed_at": datetime.now(timezone.utc)}},
        )
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"points_balance": points_earned}},
        )
        return {
            "success": True,
            "dev_mode": True,
            "order": clean_mongo_doc(order),
            "points_earned": points_earned,
            "deposit_amount": deposit_amount,
            "balance_due": balance_due,
            "message": f"DEV_MODE: Bottle service order confirmed at {venue['name']}. ${total} total (skipped Stripe).",
        }

    # Real Stripe checkout for all other users — only charge deposit now, balance at venue
    from routes.payments import get_stripe_checkout
    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

    origin = request.headers.get("origin") or str(request.base_url).rstrip('/')
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment-cancelled"

    metadata = {
        "user_id": user["user_id"],
        "package_type": "bottle_service",
        "order_id": order_id,
        "venue_id": body.venue_id,
        "booking_date": body.date,
        "order_total": str(total),
        "balance_due": str(balance_due),
    }

    stripe_checkout = get_stripe_checkout(request)
    checkout_request = CheckoutSessionRequest(
        amount=float(deposit_amount),
        currency="aud",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "amount": float(deposit_amount),
        "currency": "aud",
        "package_id": f"bottle_{body.venue_id}",
        "package_name": f"Bottle service deposit - {venue['name']}",
        "package_type": "bottle_service",
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc),
    })

    await db.bottle_orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_session_id": session.session_id}},
    )

    return {
        "success": True,
        "order": clean_mongo_doc(order),
        "checkout_url": session.url,
        "session_id": session.session_id,
        "deposit_amount": deposit_amount,
        "balance_due": balance_due,
        "message": f"${deposit_amount} deposit due now. Balance of ${balance_due} payable at {venue['name']} on the night.",
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



