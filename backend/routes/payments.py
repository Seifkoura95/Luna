"""
Stripe Payment Routes for Luna Group VIP App
Handles VIP table bookings, bottle service, and auction payments.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import os
import logging
import uuid

from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionRequest, 
    CheckoutSessionResponse,
    CheckoutStatusResponse
)
from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

# Fixed package definitions - NEVER accept amounts from frontend
PACKAGES = {
    # VIP Table Deposits
    "vip_table_eclipse": {"name": "VIP Table - Eclipse", "amount": 500.00, "type": "table_deposit"},
    "vip_table_afterdark": {"name": "VIP Table - After Dark", "amount": 300.00, "type": "table_deposit"},
    "vip_table_sucasa": {"name": "VIP Table - Su Casa", "amount": 250.00, "type": "table_deposit"},
    "vip_table_juju": {"name": "VIP Table - Juju", "amount": 200.00, "type": "table_deposit"},
    
    # Bottle Service Packages
    "bottle_premium": {"name": "Premium Bottle Package", "amount": 350.00, "type": "bottle_service"},
    "bottle_vip": {"name": "VIP Bottle Package", "amount": 600.00, "type": "bottle_service"},
    "bottle_ultra": {"name": "Ultra VIP Package", "amount": 1200.00, "type": "bottle_service"},
    
    # Points Packages
    "points_500": {"name": "500 Luna Points", "amount": 5.00, "type": "points", "points": 500},
    "points_1500": {"name": "1500 Luna Points", "amount": 12.00, "type": "points", "points": 1500},
    "points_5000": {"name": "5000 Luna Points", "amount": 35.00, "type": "points", "points": 5000},
    
    # Subscription
    "luna_plus_monthly": {"name": "Luna+ Monthly", "amount": 9.99, "type": "subscription"},
    "luna_plus_yearly": {"name": "Luna+ Yearly", "amount": 79.99, "type": "subscription"},
    
    # Gift Cards (10% bonus value added to wallet)
    "gift_card_25": {"name": "$25 Luna Gift Card", "amount": 25.00, "type": "gift_card", "wallet_credit": 27.50},
    "gift_card_50": {"name": "$50 Luna Gift Card", "amount": 50.00, "type": "gift_card", "wallet_credit": 55.00},
    "gift_card_100": {"name": "$100 Luna Gift Card", "amount": 100.00, "type": "gift_card", "wallet_credit": 110.00},
    "gift_card_150": {"name": "$150 Luna Gift Card", "amount": 150.00, "type": "gift_card", "wallet_credit": 165.00},
}


class CreateCheckoutRequest(BaseModel):
    package_id: str
    origin_url: str
    venue_id: Optional[str] = None
    event_id: Optional[str] = None
    booking_date: Optional[str] = None
    guests: Optional[int] = None


class GiftCardCheckoutRequest(BaseModel):
    amount: int  # Dollar amount (minimum 10)
    origin_url: str


class SendGiftCardRequest(BaseModel):
    amount: int  # Dollar amount (minimum 10)
    origin_url: str
    recipient_email: str
    sender_message: Optional[str] = None


class PaymentStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount: float
    currency: str
    package_name: str


def get_stripe_checkout(request: Request) -> StripeCheckout:
    """Initialize Stripe checkout with webhook URL"""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


@router.get("/packages")
async def get_packages():
    """Get all available payment packages"""
    return {
        "packages": [
            {"id": k, **v} for k, v in PACKAGES.items()
        ]
    }


@router.post("/checkout")
async def create_checkout_session(
    request: Request,
    body: CreateCheckoutRequest
):
    """Create a Stripe checkout session for a package"""
    # Verify auth
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    # Validate package
    if body.package_id not in PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = PACKAGES[body.package_id]
    
    # Build URLs from frontend origin
    success_url = f"{body.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url}/payment-cancelled"
    
    # Build metadata
    metadata = {
        "user_id": user["user_id"],
        "package_id": body.package_id,
        "package_type": package["type"],
    }
    
    if body.venue_id:
        metadata["venue_id"] = body.venue_id
    if body.event_id:
        metadata["event_id"] = body.event_id
    if body.booking_date:
        metadata["booking_date"] = body.booking_date
    if body.guests:
        metadata["guests"] = str(body.guests)
    
    try:
        stripe_checkout = get_stripe_checkout(request)
        
        checkout_request = CheckoutSessionRequest(
            amount=package["amount"],
            currency="aud",  # Australian dollars for Luna Group
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = {
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "package_id": body.package_id,
            "package_name": package["name"],
            "package_type": package["type"],
            "amount": package["amount"],
            "currency": "aud",
            "status": "initiated",
            "payment_status": "pending",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gift-card/checkout")
async def create_gift_card_checkout(
    request: Request,
    body: GiftCardCheckoutRequest
):
    """Create a Stripe checkout for a gift card with 10% bonus value"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    if body.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum gift card amount is $10")
    if body.amount > 500:
        raise HTTPException(status_code=400, detail="Maximum gift card amount is $500")
    
    # Check if it's a predefined package
    package_id = f"gift_card_{body.amount}"
    if package_id in PACKAGES:
        package = PACKAGES[package_id]
        wallet_credit = package["wallet_credit"]
    else:
        # Custom amount: 10% bonus
        wallet_credit = round(body.amount * 1.10, 2)
    
    success_url = f"{body.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url}/payment-cancelled"
    
    metadata = {
        "user_id": user["user_id"],
        "package_id": package_id,
        "package_type": "gift_card",
        "gift_card_amount": str(body.amount),
        "wallet_credit": str(wallet_credit),
    }
    
    try:
        stripe_checkout = get_stripe_checkout(request)
        
        checkout_request = CheckoutSessionRequest(
            amount=float(body.amount),
            currency="aud",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        transaction = {
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "package_id": package_id,
            "package_name": f"${body.amount} Luna Gift Card",
            "package_type": "gift_card",
            "amount": float(body.amount),
            "wallet_credit": wallet_credit,
            "currency": "aud",
            "status": "initiated",
            "payment_status": "pending",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "gift_card_amount": body.amount,
            "wallet_credit": wallet_credit,
            "bonus": round(wallet_credit - body.amount, 2)
        }
        
    except Exception as e:
        logger.error(f"Gift card checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wallet/balance")
async def get_wallet_balance(request: Request):
    """Get user's wallet balance"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "wallet_balance": 1})
    
    return {
        "wallet_balance": user_data.get("wallet_balance", 0.0) if user_data else 0.0
    }


@router.post("/gift-card/send")
async def send_gift_card(request: Request, body: SendGiftCardRequest):
    """Create a gift card to send to a friend via email/share link"""
    authorization = request.headers.get("authorization")
    sender = get_current_user(authorization)
    
    if body.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum gift card amount is $10")
    if body.amount > 500:
        raise HTTPException(status_code=400, detail="Maximum gift card amount is $500")
    
    wallet_credit = round(body.amount * 1.10, 2)
    gift_code = f"LUNA-GIFT-{uuid.uuid4().hex[:8].upper()}"
    
    # Check if recipient is an existing member
    recipient = await db.users.find_one({"email": body.recipient_email.lower().strip()})
    
    success_url = f"{body.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url}/payment-cancelled"
    
    metadata = {
        "user_id": sender["user_id"],
        "package_type": "gift_card_send",
        "gift_card_amount": str(body.amount),
        "wallet_credit": str(wallet_credit),
        "gift_code": gift_code,
        "recipient_email": body.recipient_email.lower().strip(),
        "recipient_user_id": recipient.get("user_id", "") if recipient else "",
        "sender_message": body.sender_message or "",
    }
    
    try:
        stripe_checkout = get_stripe_checkout(request)
        
        checkout_request = CheckoutSessionRequest(
            amount=float(body.amount),
            currency="aud",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create the pending gift card
        gift_card = {
            "gift_code": gift_code,
            "sender_user_id": sender["user_id"],
            "sender_email": sender.get("email", ""),
            "recipient_email": body.recipient_email.lower().strip(),
            "recipient_user_id": recipient.get("user_id") if recipient else None,
            "amount": float(body.amount),
            "wallet_credit": wallet_credit,
            "bonus": round(wallet_credit - body.amount, 2),
            "sender_message": body.sender_message,
            "status": "pending_payment",
            "payment_session_id": session.session_id,
            "is_existing_member": recipient is not None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.sent_gift_cards.insert_one(gift_card)
        
        # Also create payment transaction
        transaction = {
            "session_id": session.session_id,
            "user_id": sender["user_id"],
            "package_id": f"gift_card_send_{body.amount}",
            "package_name": f"${body.amount} Gift Card for {body.recipient_email}",
            "package_type": "gift_card_send",
            "amount": float(body.amount),
            "wallet_credit": wallet_credit,
            "currency": "aud",
            "status": "initiated",
            "payment_status": "pending",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.payment_transactions.insert_one(transaction)
        
        # Build share link
        share_url = f"{body.origin_url}/redeem-gift?code={gift_code}"
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "gift_code": gift_code,
            "share_url": share_url,
            "recipient_email": body.recipient_email,
            "is_existing_member": recipient is not None,
            "gift_card_amount": body.amount,
            "wallet_credit": wallet_credit,
            "bonus": round(wallet_credit - body.amount, 2),
        }
        
    except Exception as e:
        logger.error(f"Send gift card error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gift-card/redeem/{gift_code}")
async def get_gift_card_info(gift_code: str):
    """Get gift card info by code (public endpoint for share links)"""
    gift_card = await db.sent_gift_cards.find_one(
        {"gift_code": gift_code}, {"_id": 0}
    )
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    
    # Convert datetime
    if "created_at" in gift_card and hasattr(gift_card["created_at"], "isoformat"):
        gift_card["created_at"] = gift_card["created_at"].isoformat()
    
    return {
        "gift_code": gift_card["gift_code"],
        "amount": gift_card["amount"],
        "wallet_credit": gift_card["wallet_credit"],
        "bonus": gift_card["bonus"],
        "sender_message": gift_card.get("sender_message"),
        "status": gift_card["status"],
        "is_existing_member": gift_card.get("is_existing_member", False),
    }


@router.post("/gift-card/claim/{gift_code}")
async def claim_gift_card(request: Request, gift_code: str):
    """Claim a gift card (existing member credits wallet, new member creates pending)"""
    authorization = request.headers.get("authorization")
    claimer = get_current_user(authorization)
    
    gift_card = await db.sent_gift_cards.find_one({"gift_code": gift_code})
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    if gift_card["status"] != "paid":
        raise HTTPException(status_code=400, detail=f"Gift card is {gift_card['status']}")
    
    wallet_credit = gift_card["wallet_credit"]
    
    # Credit the claimer's wallet
    await db.users.update_one(
        {"user_id": claimer["user_id"]},
        {"$inc": {"wallet_balance": wallet_credit}}
    )
    
    # Mark as claimed
    await db.sent_gift_cards.update_one(
        {"gift_code": gift_code},
        {"$set": {
            "status": "claimed",
            "claimed_by": claimer["user_id"],
            "claimed_at": datetime.now(timezone.utc),
        }}
    )
    
    logger.info(f"Gift card {gift_code} claimed by {claimer['user_id']}: ${wallet_credit}")
    
    return {
        "success": True,
        "wallet_credit": wallet_credit,
        "message": f"${wallet_credit:.2f} added to your wallet!"
    }


@router.get("/status/{session_id}")
async def get_payment_status(request: Request, session_id: str):
    """Get payment status for a checkout session"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    # Find transaction
    transaction = await db.payment_transactions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    try:
        stripe_checkout = get_stripe_checkout(request)
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        new_status = "completed" if status.payment_status == "paid" else status.status
        
        # Only update if status changed and not already processed
        if transaction.get("payment_status") != status.payment_status:
            update_data = {
                "status": new_status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc)
            }
            
            # If payment successful, process the purchase
            if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
                await process_successful_payment(transaction)
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
        
        return PaymentStatusResponse(
            status=new_status,
            payment_status=status.payment_status,
            amount=transaction["amount"],
            currency=transaction["currency"],
            package_name=transaction["package_name"]
        )
        
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_successful_payment(transaction: dict):
    """Process successful payment - add points, create booking, etc."""
    user_id = transaction["user_id"]
    package_type = transaction.get("package_type")
    metadata = transaction.get("metadata", {})
    
    try:
        if package_type == "points":
            # Add Luna Points to user
            package = PACKAGES.get(transaction["package_id"], {})
            points_to_add = package.get("points", 0)
            
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$inc": {"points_balance": points_to_add},
                    "$push": {
                        "points_history": {
                            "amount": points_to_add,
                            "type": "purchase",
                            "description": f"Purchased {transaction['package_name']}",
                            "date": datetime.now(timezone.utc)
                        }
                    }
                }
            )
            logger.info(f"Added {points_to_add} points to user {user_id}")
            
        elif package_type == "table_deposit":
            # Confirm the existing booking (created before checkout)
            booking_id = metadata.get("booking_id")
            if booking_id:
                await db.table_bookings.update_one(
                    {"booking_id": booking_id},
                    {"$set": {
                        "status": "confirmed",
                        "deposit_paid": True,
                        "payment_session_id": transaction["session_id"],
                        "confirmed_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }},
                )
                # Award points at 10pts/$1 (POINTS_PER_DOLLAR)
                from config import POINTS_PER_DOLLAR
                points_earned = int(transaction["amount"] * POINTS_PER_DOLLAR)
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"points_balance": points_earned}},
                )
                logger.info(f"Confirmed table booking {booking_id} for user {user_id} (+{points_earned} pts)")
            else:
                # Legacy path — create fresh booking from metadata
                booking = {
                    "user_id": user_id,
                    "venue_id": metadata.get("venue_id"),
                    "booking_date": metadata.get("booking_date"),
                    "guests": int(metadata.get("guests", 2)),
                    "status": "confirmed",
                    "deposit_paid": transaction["amount"],
                    "payment_session_id": transaction["session_id"],
                    "created_at": datetime.now(timezone.utc)
                }
                await db.table_bookings.insert_one(booking)
                logger.info(f"Created table booking for user {user_id}")
            
        elif package_type == "bottle_service":
            # Confirm the existing bottle_order (created before checkout)
            order_id = metadata.get("order_id")
            if order_id:
                await db.bottle_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": "confirmed",
                        "payment_status": "paid",
                        "payment_session_id": transaction["session_id"],
                        "confirmed_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }},
                )
                from config import POINTS_PER_DOLLAR
                points_earned = int(transaction["amount"] * POINTS_PER_DOLLAR)
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"points_balance": points_earned}},
                )
                logger.info(f"Confirmed bottle order {order_id} for user {user_id} (+{points_earned} pts)")
            else:
                order = {
                    "user_id": user_id,
                    "venue_id": metadata.get("venue_id"),
                    "package_name": transaction["package_name"],
                    "booking_date": metadata.get("booking_date"),
                    "status": "confirmed",
                    "amount_paid": transaction["amount"],
                    "payment_session_id": transaction["session_id"],
                    "created_at": datetime.now(timezone.utc)
                }
                await db.bottle_orders.insert_one(order)
                logger.info(f"Created bottle service order for user {user_id}")
            
        elif package_type == "subscription":
            # Paid tier subscription — activate and award points
            tier_id = metadata.get("tier_id")
            from config import SUBSCRIPTION_TIERS, POINTS_PER_DOLLAR
            tier = SUBSCRIPTION_TIERS.get(tier_id) if tier_id else None
            if tier:
                # Cancel any existing active sub
                await db.subscriptions.update_many(
                    {"user_id": user_id, "status": "active"},
                    {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
                )
                from datetime import timedelta as _td
                subscription = {
                    "id": transaction["session_id"][-8:],
                    "user_id": user_id,
                    "tier_id": tier_id,
                    "tier_name": tier["name"],
                    "price": tier["price"],
                    "status": "active",
                    "billing_period": tier["billing_period"],
                    "current_period_start": datetime.now(timezone.utc),
                    "current_period_end": datetime.now(timezone.utc) + _td(days=30),
                    "free_entries_remaining": tier["benefits"]["free_entries_per_month"],
                    "payment_session_id": transaction["session_id"],
                    "created_at": datetime.now(timezone.utc),
                }
                await db.subscriptions.insert_one(subscription)
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"subscription_tier": tier_id}},
                )
                points_earned = int(transaction["amount"] * POINTS_PER_DOLLAR)
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"points_balance": points_earned}},
                )
                logger.info(f"Activated {tier['name']} subscription for user {user_id} (+{points_earned} pts)")
            else:
                # Legacy Luna+ plan fallback
                is_yearly = "yearly" in transaction["package_id"]
                expires_at = datetime.now(timezone.utc)
                if is_yearly:
                    expires_at = expires_at.replace(year=expires_at.year + 1)
                else:
                    if expires_at.month == 12:
                        expires_at = expires_at.replace(year=expires_at.year + 1, month=1)
                    else:
                        expires_at = expires_at.replace(month=expires_at.month + 1)
                await db.users.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "subscription": {
                                "plan": "luna_plus",
                                "status": "active",
                                "started_at": datetime.now(timezone.utc),
                                "expires_at": expires_at,
                                "payment_session_id": transaction["session_id"],
                            }
                        }
                    },
                )
                logger.info(f"Activated Luna+ subscription for user {user_id}")
            
        elif package_type == "gift_card":
            # Add wallet balance (gift card value + 10% bonus)
            wallet_credit = transaction.get("wallet_credit")
            if not wallet_credit:
                # Fallback: calculate from metadata
                gift_amount = float(metadata.get("gift_card_amount", transaction["amount"]))
                wallet_credit = round(gift_amount * 1.10, 2)
            
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"wallet_balance": wallet_credit}}
            )
            
            # Log the gift card purchase
            await db.gift_card_purchases.insert_one({
                "user_id": user_id,
                "card_amount": transaction["amount"],
                "bonus_amount": round(wallet_credit - transaction["amount"], 2),
                "wallet_credit": wallet_credit,
                "payment_session_id": transaction["session_id"],
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.info(f"Gift card purchased: ${transaction['amount']} -> ${wallet_credit} wallet credit for user {user_id}")
            
        elif package_type == "gift_card_send":
            # Gift card sent to someone - mark as paid
            gift_code = metadata.get("gift_code")
            recipient_user_id = metadata.get("recipient_user_id")
            wallet_credit = float(metadata.get("wallet_credit", 0))
            
            update_data = {"status": "paid", "paid_at": datetime.now(timezone.utc)}
            
            # If recipient is an existing member, auto-credit their wallet
            if recipient_user_id:
                await db.users.update_one(
                    {"user_id": recipient_user_id},
                    {"$inc": {"wallet_balance": wallet_credit}}
                )
                update_data["status"] = "claimed"
                update_data["claimed_by"] = recipient_user_id
                update_data["claimed_at"] = datetime.now(timezone.utc)
                logger.info(f"Gift card {gift_code} auto-credited ${wallet_credit} to existing member {recipient_user_id}")
            else:
                logger.info(f"Gift card {gift_code} paid, waiting for new member to claim ${wallet_credit}")
            
            await db.sent_gift_cards.update_one(
                {"gift_code": gift_code},
                {"$set": update_data}
            )
            
    except Exception as e:
        logger.error(f"Error processing payment for {user_id}: {e}")


@router.get("/history")
async def get_payment_history(request: Request):
    """Get user's payment history"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    transactions = await db.payment_transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Convert datetime to ISO strings
    for t in transactions:
        if "created_at" in t:
            t["created_at"] = t["created_at"].isoformat()
        if "updated_at" in t:
            t["updated_at"] = t["updated_at"].isoformat()
    
    return {"transactions": transactions}
