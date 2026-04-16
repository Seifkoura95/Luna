"""
Luna Loyalty Engine — Replaces CherryHub
Full points system with digital member cards and wallet passes.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import qrcode
import io
import base64
import os
import logging

from dotenv import load_dotenv
load_dotenv()

from config import SUBSCRIPTION_TIERS
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/loyalty", tags=["Luna Loyalty"])

# MongoDB
from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'luna_vip')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ── Models ────────────────────────────────────────────────────────────────────

class AwardPointsRequest(BaseModel):
    user_id: Optional[str] = None  # Staff awards to this user; if None, self
    amount_spent: float
    venue_id: str
    description: str = "In-venue purchase"
    category: str = "general"  # drinks, food, entry, booth


class RedeemPointsRequest(BaseModel):
    points: int
    reason: str
    venue_id: Optional[str] = None


class StaffAwardRequest(BaseModel):
    member_user_id: str
    amount_spent: float
    venue_id: str
    category: str = "general"
    description: str = "Staff-recorded purchase"


# ── Points Engine ─────────────────────────────────────────────────────────────

POINTS_PER_DOLLAR = 1  # Base: 1 point per $1 spent


async def _get_tier_multiplier(user_id: str) -> tuple:
    """Get the user's tier and multiplier"""
    sub = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    tier_id = sub.get("tier_id", "bronze") if sub else "bronze"
    # Also check user's tier field
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "tier": 1})
    if user and user.get("tier") and not sub:
        tier_id = user["tier"].lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    multiplier = tier.get("points_multiplier", 1.0)
    return tier_id, multiplier


@router.post("/points/award")
async def award_points(request: Request, body: AwardPointsRequest):
    """Award points for a purchase. Staff can award to any user, members award to self."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    target_id = body.user_id or current["user_id"]
    tier_id, multiplier = await _get_tier_multiplier(target_id)
    
    base_points = int(body.amount_spent * POINTS_PER_DOLLAR)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points
    
    # Update balance
    await db.users.update_one(
        {"user_id": target_id},
        {"$inc": {"points_balance": total_points}}
    )
    
    # Log transaction
    txn = {
        "id": str(uuid.uuid4())[:8],
        "user_id": target_id,
        "type": "earn",
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "amount_spent": body.amount_spent,
        "venue_id": body.venue_id,
        "category": body.category,
        "description": body.description,
        "awarded_by": current["user_id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.loyalty_transactions.insert_one(txn)
    
    # Get new balance
    user = await db.users.find_one({"user_id": target_id}, {"_id": 0, "points_balance": 1})
    
    return {
        "success": True,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "new_balance": user.get("points_balance", 0) if user else total_points,
    }


@router.post("/points/redeem")
async def redeem_points(request: Request, body: RedeemPointsRequest):
    """Redeem points (deduct from balance)"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "points_balance": 1})
    balance = user.get("points_balance", 0) if user else 0
    
    if balance < body.points:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Have {balance}, need {body.points}")
    
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$inc": {"points_balance": -body.points}}
    )
    
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": current["user_id"],
        "type": "redeem",
        "total_points": -body.points,
        "reason": body.reason,
        "venue_id": body.venue_id,
        "created_at": datetime.now(timezone.utc),
    })
    
    return {"success": True, "points_redeemed": body.points, "new_balance": balance - body.points}


@router.post("/staff/award")
async def staff_award_points(request: Request, body: StaffAwardRequest):
    """Staff-only: Award points to a member after recording a purchase"""
    auth = request.headers.get("authorization")
    staff = get_current_user(auth)
    
    # Verify target user exists
    target = await db.users.find_one({"user_id": body.member_user_id}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    
    tier_id, multiplier = await _get_tier_multiplier(body.member_user_id)
    
    base_points = int(body.amount_spent * POINTS_PER_DOLLAR)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points
    
    await db.users.update_one(
        {"user_id": body.member_user_id},
        {"$inc": {"points_balance": total_points}}
    )
    
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": body.member_user_id,
        "type": "earn",
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "amount_spent": body.amount_spent,
        "venue_id": body.venue_id,
        "category": body.category,
        "description": body.description,
        "awarded_by": staff["user_id"],
        "source": "staff_portal",
        "created_at": datetime.now(timezone.utc),
    })
    
    updated = await db.users.find_one({"user_id": body.member_user_id}, {"_id": 0, "points_balance": 1})
    
    return {
        "success": True,
        "member_name": target.get("name", target.get("email")),
        "amount_spent": body.amount_spent,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "new_balance": updated.get("points_balance", 0) if updated else 0,
    }


@router.get("/transactions")
async def get_transactions(request: Request, limit: int = 20):
    """Get user's loyalty transaction history"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    txns = await db.loyalty_transactions.find(
        {"user_id": current["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for t in txns:
        if "created_at" in t and hasattr(t["created_at"], "isoformat"):
            t["created_at"] = t["created_at"].isoformat()
    
    return {"transactions": txns}


# ── Digital Member Card ───────────────────────────────────────────────────────

@router.get("/member-card")
async def get_member_card(request: Request):
    """Get digital member card data with QR code"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier_id = user.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    
    # Generate QR code with member ID
    qr_data = f"LUNA-MEMBER:{current['user_id']}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="white", back_color="black")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "user_id": current["user_id"],
        "name": user.get("name", user.get("email", "Member")),
        "email": user.get("email"),
        "tier": tier.get("name", "Bronze"),
        "tier_id": tier_id,
        "tier_color": tier.get("color", "#CD7F32"),
        "points_balance": user.get("points_balance", 0),
        "wallet_balance": user.get("wallet_balance", 0.0),
        "member_since": user.get("created_at", "2024-01-01"),
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "qr_data": qr_data,
        "multiplier": tier.get("points_multiplier", 1.0),
    }


@router.get("/member-card/qr.png")
async def get_member_card_qr_image(request: Request):
    """Get QR code image directly (for sharing/printing)"""
    from fastapi.responses import Response
    
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    qr_data = f"LUNA-MEMBER:{current['user_id']}"
    qr = qrcode.QRCode(version=1, box_size=12, border=3)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="white", back_color="#0A0A10")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return Response(content=buffer.read(), media_type="image/png")


# ── Apple Wallet Pass ─────────────────────────────────────────────────────────

APPLE_PASS_CERTS_DIR = os.path.join(os.path.dirname(__file__), "certs", "apple")
APPLE_PASS_TYPE_ID = os.environ.get("APPLE_PASS_TYPE_ID", "")
APPLE_TEAM_ID = os.environ.get("APPLE_TEAM_ID", "")


@router.get("/member-card/preview.png")
async def get_member_card_preview():
    """Get a rendered preview of the member card (for sharing/display)"""
    from fastapi.responses import FileResponse
    preview = os.path.join(os.path.dirname(__file__), "..", "static", "luna-wallet-card-preview.png")
    if os.path.exists(preview):
        return FileResponse(preview, media_type="image/png")
    raise HTTPException(status_code=404, detail="Preview not available")


@router.get("/wallet-pass/apple")
async def generate_apple_wallet_pass(request: Request, token: str = ""):
    """Generate Apple Wallet .pkpass file for the member"""
    from fastapi.responses import Response
    
    authorization = request.headers.get("authorization") or (f"Bearer {token}" if token else "")
    current = get_current_user(authorization)
    
    if not APPLE_PASS_TYPE_ID or not APPLE_TEAM_ID:
        raise HTTPException(status_code=503, detail="Apple Wallet pass not configured. Certificates required.")
    
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier_id = user.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    
    try:
        from py_pkpass.models import Pass, Barcode, BarcodeFormat, StoreCard
        
        points = user.get("points_balance", 0)
        wallet_bal = user.get("wallet_balance", 0.0)
        member_since = "2024"
        if user.get("created_at"):
            try:
                member_since = str(user["created_at"].year) if hasattr(user["created_at"], "year") else "2024"
            except:
                pass
        issue_num = str(abs(hash(current["user_id"])) % 99999).zfill(5)
        
        card = StoreCard()
        # Header: Points balance (top right, prominent)
        card.addHeaderField("points", f"{points:,}", "LUNA POINTS")
        # Primary: Member name
        card.addPrimaryField("name", user.get("name", "Luna Member"), "MEMBER")
        # Secondary: Tier + Multiplier
        card.addSecondaryField("tier", tier.get("name", "Bronze").upper(), "TIER")
        card.addSecondaryField("multiplier", f"{tier.get('points_multiplier', 1.0)}x", "MULTIPLIER")
        # Auxiliary: Wallet Balance + Member Since
        card.addAuxiliaryField("wallet", f"${wallet_bal:.2f}", "WALLET BALANCE")
        card.addAuxiliaryField("since", member_since, "MEMBER SINCE")
        # Back fields
        card.addBackField("email", user.get("email", ""), "Email")
        card.addBackField("member_id", current["user_id"], "Member ID")
        card.addBackField("issue", f"#{issue_num}", "Issue Number")
        card.addBackField("org", "Luna Group Hospitality", "Organization")
        card.addBackField("website", "https://lunagroup.com.au", "Website")
        
        passfile = Pass(
            card,
            passTypeIdentifier=APPLE_PASS_TYPE_ID,
            organizationName="Luna Group Hospitality",
            teamIdentifier=APPLE_TEAM_ID,
        )
        passfile.serialNumber = f"LUNA-{current['user_id']}"
        passfile.description = "Luna Group VIP Membership Card"
        passfile.logoText = "LUNA"
        # Dark background matching the design
        passfile.backgroundColor = "rgb(12, 12, 24)"
        passfile.foregroundColor = "rgb(245, 245, 250)"
        passfile.labelColor = "rgb(120, 120, 140)"
        passfile.barcode = Barcode(
            message=f"LUNA-MEMBER:{current['user_id']}",
            format=BarcodeFormat.QR,
            altText="Ready to scan",
        )
        
        cert_path = os.path.join(APPLE_PASS_CERTS_DIR, "certificate.pem")
        key_path = os.path.join(APPLE_PASS_CERTS_DIR, "pass_private.key")
        wwdr_path = os.path.join(APPLE_PASS_CERTS_DIR, "wwdr.pem")
        password = os.environ.get("APPLE_PASS_CERT_PASSWORD", "")
        
        # Add icon and logo images (all required variants)
        for fname in ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"]:
            fpath = os.path.join(APPLE_PASS_CERTS_DIR, fname)
            if os.path.exists(fpath):
                passfile.addFile(fname, open(fpath, "rb"))
        
        output = io.BytesIO()
        passfile.create(cert_path, key_path, wwdr_path, password, output)
        output.seek(0)
        pkpass_data = output.read()
        
        if len(pkpass_data) < 100:
            raise HTTPException(status_code=500, detail="Failed to generate pass file")
        
        return Response(
            content=pkpass_data,
            media_type="application/vnd.apple.pkpass",
            headers={"Content-Disposition": f"attachment; filename=luna-vip-{current['user_id']}.pkpass"}
        )
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Apple Wallet pass library not available")
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Apple Wallet certificates not found")
    except Exception as e:
        logger.error(f"Apple Wallet pass generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Google Wallet Pass ────────────────────────────────────────────────────────

GOOGLE_WALLET_ISSUER_ID = os.environ.get("GOOGLE_WALLET_ISSUER_ID", "")
GOOGLE_SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), "certs", "google-service-account.json")


@router.get("/wallet-pass/google")
async def generate_google_wallet_link(request: Request):
    """Generate Google Wallet save link for the member's loyalty card"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)
    
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier_id = user.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    
    issuer_id = GOOGLE_WALLET_ISSUER_ID
    if not issuer_id:
        raise HTTPException(status_code=503, detail="Google Wallet not configured")
    
    try:
        from google.auth.transport.requests import Request as GoogleRequest
        from google.oauth2 import service_account
        import jwt as pyjwt
        import json
        import time
        
        sa_file = GOOGLE_SERVICE_ACCOUNT_FILE
        if not os.path.exists(sa_file):
            raise HTTPException(status_code=503, detail="Google service account not found")
        
        with open(sa_file) as f:
            sa_info = json.load(f)
        
        class_id = f"{issuer_id}.luna_vip_loyalty"
        object_id = f"{issuer_id}.luna-{current['user_id'].replace('-', '')}"
        
        points = user.get("points_balance", 0)
        wallet_bal = user.get("wallet_balance", 0.0)
        member_since = "2024"
        issue_num = str(abs(hash(current["user_id"])) % 99999).zfill(5)
        
        loyalty_class = {
            "id": class_id,
            "issuerName": "Luna Group Hospitality",
            "reviewStatus": "UNDER_REVIEW",
            "programName": "LUNA",
            "programLogo": {
                "sourceUri": {"uri": "https://birthday-rewards-1.preview.emergentagent.com/api/loyalty/member-card/qr.png"},
                "contentDescription": {"defaultValue": {"language": "en-AU", "value": "Luna Group"}}
            },
            "hexBackgroundColor": "#0C0C18",
        }
        
        loyalty_object = {
            "id": object_id,
            "classId": class_id,
            "state": "ACTIVE",
            "loyaltyPoints": {
                "balance": {"int": points},
                "label": "Luna Points",
            },
            "accountName": user.get("name", user.get("email", "Member")),
            "accountId": current["user_id"][:8],
            "barcode": {
                "type": "QR_CODE",
                "value": f"LUNA-MEMBER:{current['user_id']}",
                "alternateText": "Ready to scan",
            },
            "textModulesData": [
                {"header": "TIER", "body": tier.get("name", "Bronze").upper()},
                {"header": "MULTIPLIER", "body": f"{tier.get('points_multiplier', 1.0)}x"},
                {"header": "WALLET BALANCE", "body": f"${wallet_bal:.2f}"},
                {"header": "MEMBER SINCE", "body": member_since},
                {"header": "ISSUE", "body": f"#{issue_num}"},
            ],
        }
        
        # Create JWT for save link
        claims = {
            "iss": sa_info["client_email"],
            "aud": "google",
            "origins": ["https://birthday-rewards-1.preview.emergentagent.com"],
            "typ": "savetowallet",
            "payload": {
                "loyaltyClasses": [loyalty_class],
                "loyaltyObjects": [loyalty_object],
            },
            "iat": int(time.time()),
        }
        
        token = pyjwt.encode(claims, sa_info["private_key"], algorithm="RS256")
        save_url = f"https://pay.google.com/gp/v/save/{token}"
        
        return {
            "save_url": save_url,
            "object_id": object_id,
            "status": "ready",
            "message": "Google Wallet pass ready",
        }
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Missing dependency: {e}")
    except Exception as e:
        logger.error(f"Google Wallet error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Scan Member (Staff endpoint) ─────────────────────────────────────────────

@router.post("/scan")
async def scan_member_qr(request: Request, qr_data: str = ""):
    """Staff scans a member QR code and gets their profile"""
    auth = request.headers.get("authorization")
    get_current_user(auth)  # Verify authenticated
    
    # Parse QR data: "LUNA-MEMBER:{user_id}"
    user_id = qr_data.replace("LUNA-MEMBER:", "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid QR code")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    
    tier_id = user.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    
    return {
        "user_id": user.get("user_id"),
        "name": user.get("name", user.get("email")),
        "email": user.get("email"),
        "tier": tier.get("name", "Bronze"),
        "tier_color": tier.get("color", "#CD7F32"),
        "points_balance": user.get("points_balance", 0),
        "wallet_balance": user.get("wallet_balance", 0.0),
        "multiplier": tier.get("points_multiplier", 1.0),
    }
