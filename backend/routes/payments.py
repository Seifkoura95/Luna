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
}


class CreateCheckoutRequest(BaseModel):
    package_id: str
    origin_url: str
    venue_id: Optional[str] = None
    event_id: Optional[str] = None
    booking_date: Optional[str] = None
    guests: Optional[int] = None


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
            # Create table booking
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
            # Create bottle service order
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
            # Update user subscription
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
                            "payment_session_id": transaction["session_id"]
                        }
                    }
                }
            )
            logger.info(f"Activated Luna+ subscription for user {user_id}")
            
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
