"""
Stripe Webhook Handler for Luna Group VIP App
"""
from fastapi import APIRouter, Request, HTTPException
import os
import logging

from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.payments.stripe.checkout import StripeCheckout
from database import db
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Webhooks"])


@router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        api_key = os.environ.get("STRIPE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        
        # Get raw body
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Webhook received: {webhook_response.event_type} for session {webhook_response.session_id}")
        
        # Update transaction based on event
        if webhook_response.session_id:
            update_data = {
                "webhook_event_id": webhook_response.event_id,
                "webhook_event_type": webhook_response.event_type,
                "payment_status": webhook_response.payment_status,
                "updated_at": datetime.now(timezone.utc)
            }
            
            if webhook_response.payment_status == "paid":
                update_data["status"] = "completed"
            elif webhook_response.event_type == "checkout.session.expired":
                update_data["status"] = "expired"
            
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": update_data}
            )
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        # Return 200 to prevent Stripe from retrying
        return {"status": "error", "message": str(e)}
