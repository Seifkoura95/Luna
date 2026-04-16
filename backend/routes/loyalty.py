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
    """Redirect to the dynamic HTML card preview"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/api/loyalty/member-card/preview")


@router.get("/member-card/preview")
async def get_member_card_html(request: Request, token: str = ""):
    """Serve the dynamic HTML member card with real user data"""
    from fastapi.responses import HTMLResponse
    
    authorization = request.headers.get("authorization") or (f"Bearer {token}" if token else "")
    
    try:
        current = get_current_user(authorization)
        user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password": 0})
    except:
        user = None
    
    if user:
        tier_id = user.get("tier", "bronze").lower()
        tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
        name = user.get("name", user.get("email", "Luna Member"))
        email = user.get("email", "")
        points = user.get("points_balance", 0)
        wallet = user.get("wallet_balance", 0.0)
        multiplier = tier.get("points_multiplier", 1.0)
        tier_name = tier.get("name", "Bronze")
        member_since = "2024"
        issue_num = str(abs(hash(current["user_id"])) % 99999).zfill(5)
    else:
        name, email, points, wallet = "Luna Member", "", 0, 0.0
        multiplier, tier_name, tier_id = 1.0, "Bronze", "bronze"
        member_since, issue_num = "2024", "00000"
    
    tier_class = f"tier-{tier_id}" if tier_id in ("bronze","silver","gold","platinum") else "tier-bronze"
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Luna Member Card</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Outfit',sans-serif;background:#080808;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}}
.card{{width:100%;max-width:380px;border-radius:20px;overflow:hidden;position:relative;background:#08080A;box-shadow:0 2px 0 rgba(255,255,255,0.08),0 20px 60px rgba(0,0,0,0.8),0 0 0 0.5px rgba(255,255,255,0.08)}}
.card-bg{{position:absolute;inset:0;overflow:hidden;z-index:0}}
.card-bg::before{{content:'';position:absolute;width:300px;height:300px;background:radial-gradient(circle,rgba(37,99,235,0.45) 0%,transparent 65%);top:-60px;right:-60px;animation:d1 8s ease-in-out infinite alternate}}
.card-bg::after{{content:'';position:absolute;width:280px;height:280px;background:radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 65%);bottom:-40px;left:-60px;animation:d2 10s ease-in-out infinite alternate}}
@keyframes d1{{0%{{transform:translate(0,0) scale(1)}}100%{{transform:translate(-20px,15px) scale(1.1)}}}}
@keyframes d2{{0%{{transform:translate(0,0) scale(1)}}100%{{transform:translate(20px,-20px) scale(1.08)}}}}
.card-grain{{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");z-index:1;pointer-events:none;opacity:0.6}}
.card-shimmer{{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}}
.card-shimmer::after{{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.03) 40%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 60%,transparent 80%);animation:shimmer 4s ease-in-out infinite}}
@keyframes shimmer{{0%{{left:-100%}}60%,100%{{left:160%}}}}
.card-highlight{{position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.4) 30%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0.4) 70%,transparent 100%);z-index:10}}
.card-content{{position:relative;z-index:5}}
.card-top{{padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:flex-start}}
.brand-mark{{display:flex;align-items:center;gap:8px}}
.brand-icon{{width:28px;height:28px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,0.5)}}
.brand-icon svg{{width:14px;height:14px}}
.brand-name{{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:0.12em;color:#fff;line-height:1}}
.brand-sub{{font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-left:36px;margin-top:3px}}
.points-block{{text-align:right}}
.points-label{{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:3px}}
.points-value{{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:0.04em;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;line-height:1}}
.points-unit{{font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3)}}
.card-rule{{height:0.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 20%,rgba(255,255,255,0.18) 50%,rgba(255,255,255,0.12) 80%,transparent 100%);margin:0 24px}}
.card-member{{padding:18px 24px;display:flex;justify-content:space-between;align-items:center}}
.info-label{{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.3)}}
.info-value{{font-size:15px;font-weight:600;color:#fff;letter-spacing:0.01em}}
.tier-badge{{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}}
.tier-bronze{{background:rgba(180,100,30,0.2);border:0.5px solid rgba(212,160,80,0.4);color:#e2a550}}
.tier-silver{{background:rgba(180,180,200,0.15);border:0.5px solid rgba(200,200,220,0.35);color:#c8c8d8}}
.tier-gold{{background:rgba(201,168,76,0.15);border:0.5px solid rgba(212,180,80,0.45);color:#e2c06e}}
.multiplier-value{{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#fff;letter-spacing:0.06em}}
.qr-panel{{margin:0 18px 18px;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:14px;position:relative;overflow:hidden}}
.qr-panel::before{{content:'';position:absolute;top:0;left:0;right:0;height:0.5px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)}}
.qr-inner{{width:180px;height:180px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);position:relative}}
.qr-inner::before{{content:'';position:absolute;inset:-1px;border-radius:13px;background:linear-gradient(135deg,rgba(37,99,235,0.5),rgba(124,58,237,0.5));z-index:-1}}
.qr-inner img{{width:156px;height:156px;border-radius:4px}}
.qr-scan-label{{font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)}}
.qr-venue-label{{font-size:13px;font-weight:500;color:rgba(255,255,255,0.6)}}
.qr-pulse{{width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 0 0 rgba(34,197,94,0.4);animation:pulse 2s infinite;display:inline-block;margin-right:6px;vertical-align:middle}}
@keyframes pulse{{0%{{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}}70%{{box-shadow:0 0 0 8px rgba(34,197,94,0)}}100%{{box-shadow:0 0 0 0 rgba(34,197,94,0)}}}}
.card-footer{{padding:14px 24px 22px;display:flex;justify-content:space-between;align-items:flex-end}}
.footer-col{{display:flex;flex-direction:column;gap:4px}}
.wallet-balance{{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:0.04em;background:linear-gradient(135deg,#22c55e,#86efac);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}}
.footer-meta{{font-size:10px;color:rgba(255,255,255,0.25);font-weight:500;letter-spacing:0.04em}}
</style>
</head>
<body>
<div class="card">
  <div class="card-bg"></div>
  <div class="card-grain"></div>
  <div class="card-shimmer"></div>
  <div class="card-highlight"></div>
  <div class="card-content">
    <div class="card-top">
      <div>
        <div class="brand-mark">
          <div class="brand-icon"><svg viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.6 4H13l-3.5 2.6 1.3 4.2L7 9.8l-3.8 2.5 1.3-4.2L1 5.5h4.4L7 1.5z" fill="white"/></svg></div>
          <div class="brand-name">LUNA</div>
        </div>
        <div class="brand-sub">Membership Card</div>
      </div>
      <div class="points-block">
        <div class="points-label">Points</div>
        <div class="points-value">{points:,}</div>
        <div class="points-unit">Luna Points</div>
      </div>
    </div>
    <div class="card-rule"></div>
    <div class="card-member">
      <div>
        <div class="info-label">Member</div>
        <div class="info-value">{name}</div>
        <div style="margin-top:8px">
          <div class="info-label">Tier</div>
          <div style="margin-top:4px"><span class="tier-badge {tier_class}">{tier_name}</span></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:12px">
        <div><div class="info-label">Multiplier</div><div class="multiplier-value">{multiplier}x</div></div>
      </div>
    </div>
    <div class="card-rule"></div>
    <div class="qr-panel">
      <div class="qr-inner"><img src="/api/loyalty/member-card/qr.png" alt="QR Code"/></div>
      <div class="qr-scan-label"><span class="qr-pulse"></span>Ready to scan</div>
      <div class="qr-venue-label">Scan at any Luna venue</div>
    </div>
    <div class="card-footer">
      <div class="footer-col">
        <div class="info-label">Wallet Balance</div>
        <div class="wallet-balance">${wallet:.2f}</div>
        <div class="footer-meta">{email}</div>
        <div class="footer-meta">Luna Group Hospitality</div>
      </div>
      <div class="footer-col" style="align-items:flex-end">
        <div class="info-label">Member Since</div>
        <div class="info-value" style="font-size:18px;font-family:'Bebas Neue',sans-serif;letter-spacing:.06em">{member_since}</div>
        <div class="footer-meta" style="margin-top:4px">Issue #{issue_num}</div>
      </div>
    </div>
  </div>
</div>
</body></html>"""
    
    return HTMLResponse(content=html)


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
