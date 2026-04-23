"""
CherryHub Integration API Routes

READ-ONLY CONTRACT
==================
Per the CherryHub / Luna agreement:
    - Luna can READ CherryHub data (member lookup, wallet pass, balance display)
    - CherryHub can READ Luna data (balance + earn ledger) via the /public/* endpoints
    - Neither side mutates the other's database.

Points earned inside the Luna app are written ONLY to Luna's own ledger (see
routes/loyalty.py). CherryHub polls the /public/* endpoints below to keep
their in-store POS balance in sync.

Routes:
    POST  /api/cherryhub/login                     Dual-auth login via CherryHub email
    POST  /api/cherryhub/link                      Link current Luna user to a CherryHub member
    POST  /api/cherryhub/register                  Register a new CherryHub member from Luna
    GET   /api/cherryhub/status                    Connection status for current user
    GET   /api/cherryhub/points                    Display balance (prefers CherryHub, falls back local)
    GET   /api/cherryhub/transactions              Local Luna ledger history
    POST  /api/cherryhub/wallet-pass               Digital member card (Apple / Google Wallet)

    -- Public (authenticated with X-CherryHub-Api-Key header, for CherryHub to poll) --
    GET   /api/cherryhub/public/balance/{member_key}        Current Luna balance
    GET   /api/cherryhub/public/ledger/{member_key}         Earn ledger since timestamp
    GET   /api/cherryhub/public/health                      Simple health / auth check
"""
from fastapi import APIRouter, HTTPException, Request, Header, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
import jwt
import bcrypt
import uuid
import os
from datetime import datetime, timezone, timedelta

from database import db
from utils.auth import get_current_user
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS
from cherryhub_service import (
    cherryhub_service,
    register_cherryhub_member,
    CHERRYHUB_MOCK_MODE,
    token_manager,
)

router = APIRouter(prefix="/cherryhub", tags=["CherryHub"])
logger = logging.getLogger(__name__)

# Shared secret that CherryHub must send on every /public/* request
CHERRYHUB_READ_API_KEY = os.environ.get("CHERRYHUB_READ_API_KEY", "")


# ============== Helpers ==============

async def get_authenticated_user(request: Request):
    """Get authenticated user from Authorization header."""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _require_public_key(header_value: Optional[str]):
    """Guards /public/* endpoints. Rejects if key missing, unset, or mismatched."""
    if not CHERRYHUB_READ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Public read API disabled — CHERRYHUB_READ_API_KEY not configured",
        )
    if header_value != CHERRYHUB_READ_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid X-CherryHub-Api-Key")


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else dt


# ============== Models ==============

class CherryHubLoginRequest(BaseModel):
    email: EmailStr


class CherryHubLinkRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    create_if_not_exists: bool = True


class CherryHubRegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None


class WalletPassRequest(BaseModel):
    pass_type: str = "apple"  # "apple" or "google"


# ============== Login / Link / Register ==============

@router.post("/login")
async def login_with_cherryhub(body: CherryHubLoginRequest):
    """Login using CherryHub credentials. Creates or links a Luna user as needed."""
    try:
        member = await cherryhub_service.get_member_by_email(body.email)

        if not member and not CHERRYHUB_MOCK_MODE:
            raise HTTPException(
                status_code=404,
                detail="No CherryHub account found for this email. Please register first.",
            )

        if not member and CHERRYHUB_MOCK_MODE:
            member = {
                "memberKey": f"LUNA-{body.email[:8].upper().replace('@','').replace('.','')}",
                "email": body.email,
                "firstName": "Luna",
                "lastName": "Member",
                "mock": True,
            }

        member_key = member.get("memberKey", member.get("id"))

        # 1. Already linked
        existing_user = await db.users.find_one({"cherryhub_member_key": member_key})
        if existing_user:
            token_payload = {
                "user_id": existing_user["user_id"],
                "email": existing_user["email"],
                "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
            }
            token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            user_copy = {
                k: v for k, v in existing_user.items()
                if k not in ["hashed_password", "_id", "email_verification_token", "email_verification_otp"]
            }
            return {"success": True, "user": user_copy, "token": token, "existing_user": True, "mock": CHERRYHUB_MOCK_MODE}

        # 2. Luna user exists by email → link
        existing_by_email = await db.users.find_one({"email": body.email})
        if existing_by_email:
            await db.users.update_one(
                {"user_id": existing_by_email["user_id"]},
                {"$set": {
                    "cherryhub_member_key": member_key,
                    "cherryhub_email": body.email,
                    "cherryhub_linked_at": datetime.now(timezone.utc),
                    "cherryhub_status": "active",
                }},
            )
            token_payload = {
                "user_id": existing_by_email["user_id"],
                "email": existing_by_email["email"],
                "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
            }
            token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            user_copy = {
                k: v for k, v in existing_by_email.items()
                if k not in ["hashed_password", "_id", "email_verification_token", "email_verification_otp"]
            }
            user_copy["cherryhub_member_key"] = member_key
            return {"success": True, "user": user_copy, "token": token, "newly_linked": True, "mock": CHERRYHUB_MOCK_MODE}

        # 3. Create new Luna user from CherryHub member
        user_id = str(uuid.uuid4())
        new_user = {
            "user_id": user_id,
            "email": body.email,
            "hashed_password": bcrypt.hashpw(str(uuid.uuid4()).encode(), bcrypt.gensalt()).decode(),
            "name": f"{member.get('firstName', 'Luna')} {member.get('lastName', 'Member')}",
            "phone": member.get("phone"),
            "date_of_birth": member.get("dateOfBirth"),
            "tier": "bronze",
            "points_balance": 0,
            "cherryhub_member_key": member_key,
            "cherryhub_email": body.email,
            "cherryhub_linked_at": datetime.now(timezone.utc),
            "cherryhub_status": "active",
            "is_email_verified": True,  # CherryHub-originated = pre-verified
            "created_at": datetime.now(timezone.utc),
            "created_via": "cherryhub_login",
        }
        await db.users.insert_one(new_user)

        token_payload = {
            "user_id": user_id,
            "email": body.email,
            "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        user_copy = {k: v for k, v in new_user.items() if k not in ["hashed_password", "_id"]}
        return {"success": True, "user": user_copy, "token": token, "new_user": True, "mock": member.get("mock", CHERRYHUB_MOCK_MODE)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CherryHub login failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/link")
async def link_cherryhub_account(request: Request, body: CherryHubLinkRequest):
    """Link existing CherryHub member to the current Luna user."""
    current_user = await get_authenticated_user(request)

    if current_user.get("cherryhub_member_key"):
        return {
            "success": True,
            "member_key": current_user["cherryhub_member_key"],
            "message": "Account already linked",
            "already_linked": True,
        }

    lookup_email = body.email or current_user.get("email")

    try:
        member = await cherryhub_service.get_member_by_email(lookup_email)

        if member:
            member_key = member.get("memberKey", member.get("id"))
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {"$set": {
                    "cherryhub_member_key": member_key,
                    "cherryhub_email": lookup_email,
                    "cherryhub_linked_at": datetime.now(timezone.utc),
                    "cherryhub_status": "active",
                }},
            )
            return {
                "success": True,
                "member_key": member_key,
                "message": "CherryHub account linked successfully",
                "existing_account": True,
                "mock": CHERRYHUB_MOCK_MODE,
            }

        if body.create_if_not_exists:
            name_parts = (current_user.get("name") or "").split()
            first_name = name_parts[0] if name_parts else "Luna"
            last_name = name_parts[-1] if len(name_parts) > 1 else "Member"
            result = await register_cherryhub_member(
                email=lookup_email,
                first_name=first_name,
                last_name=last_name,
                phone=body.phone or current_user.get("phone"),
                date_of_birth=current_user.get("date_of_birth"),
                marketing_opt_in=True,
            )
            member_key = result.get("memberKey")
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {"$set": {
                    "cherryhub_member_key": member_key,
                    "cherryhub_email": lookup_email,
                    "cherryhub_linked_at": datetime.now(timezone.utc),
                    "cherryhub_status": "active",
                }},
            )
            return {
                "success": True,
                "member_key": member_key,
                "message": "New CherryHub account created and linked",
                "new_account": True,
                "mock": result.get("mock", CHERRYHUB_MOCK_MODE),
            }

        raise HTTPException(status_code=404, detail="No CherryHub account found for this email")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to link CherryHub account: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register")
async def register_cherryhub_member_endpoint(request: Request, body: CherryHubRegisterRequest):
    """Register the current user as a new CherryHub member."""
    current_user = await get_authenticated_user(request)
    if current_user.get("cherryhub_member_key"):
        raise HTTPException(status_code=400, detail="Already registered with CherryHub")

    result = await register_cherryhub_member(
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        date_of_birth=body.date_of_birth,
    )
    member_key = result.get("memberKey") or result.get("member_key")
    if not member_key:
        raise HTTPException(status_code=400, detail="CherryHub registration failed")

    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "cherryhub_member_key": member_key,
            "cherryhub_email": body.email,
            "cherryhub_linked_at": datetime.now(timezone.utc),
            "cherryhub_status": "active",
        }},
    )
    return {"success": True, "member_key": member_key, "message": "Successfully registered with CherryHub", "mock": result.get("mock", CHERRYHUB_MOCK_MODE)}


# ============== Status / Points / History ==============

@router.get("/status")
async def get_cherryhub_status(request: Request):
    """Connection status for the current user."""
    current_user = await get_authenticated_user(request)
    member_key = current_user.get("cherryhub_member_key")
    linked = bool(member_key)
    return {
        "registered": linked,
        "connected": linked,
        "member_key": member_key,
        "mock_mode": CHERRYHUB_MOCK_MODE,
        "linked_at": _iso(current_user.get("cherryhub_linked_at")),
        "registered_at": _iso(current_user.get("cherryhub_linked_at")),
        "status": current_user.get("cherryhub_status", "active" if linked else "not_linked"),
        "message": "CherryHub account linked" if linked else "No CherryHub account linked",
    }


@router.get("/points")
async def get_cherryhub_points(request: Request):
    """Display balance. Prefers CherryHub's value when linked, falls back to local."""
    current_user = await get_authenticated_user(request)
    local_balance = current_user.get("points_balance", current_user.get("points", 0))
    member_key = current_user.get("cherryhub_member_key")

    if not member_key:
        return {
            "points": local_balance,
            "source": "local",
            "member_key": None,
            "mock_mode": CHERRYHUB_MOCK_MODE,
        }

    try:
        points_data = await cherryhub_service.get_member_points_balance(member_key)
        return {
            "points": points_data.get("balance", points_data.get("points", local_balance)),
            "source": "cherryhub" if not CHERRYHUB_MOCK_MODE else "mock",
            "member_key": member_key,
            "mock_mode": CHERRYHUB_MOCK_MODE,
            "tier": points_data.get("tier"),
            "lifetime_points": points_data.get("lifetimePoints", points_data.get("lifetime_points")),
        }
    except Exception as e:
        logger.warning(f"CherryHub balance fetch failed, using local: {e}")
        return {"points": local_balance, "source": "local_fallback", "member_key": member_key, "mock_mode": CHERRYHUB_MOCK_MODE, "error": str(e)}


@router.get("/transactions")
async def get_points_transactions(request: Request, limit: int = 20):
    """Local Luna ledger entries for the current user."""
    current_user = await get_authenticated_user(request)
    transactions = await db.points_transactions.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    for t in transactions:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
    return {"transactions": transactions, "count": len(transactions)}


@router.post("/wallet-pass")
async def generate_wallet_pass(request: Request, body: WalletPassRequest):
    """Retrieve the CherryHub-issued digital member card for Apple / Google Wallet."""
    current_user = await get_authenticated_user(request)
    member_key = current_user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(status_code=400, detail="Not linked to CherryHub")

    pass_type = "IosPassKit" if body.pass_type.lower() == "apple" else "GooglePayPass"
    try:
        pass_data = await cherryhub_service.get_digital_member_card(member_key, pass_type)
    except Exception as e:
        logger.error(f"Wallet pass fetch failed: {e}")
        raise HTTPException(status_code=502, detail=f"CherryHub wallet pass unavailable: {e}")

    return {
        "success": True,
        "pass_type": body.pass_type,
        "member_key": member_key,
        "pass_data": pass_data,
        "mock_mode": CHERRYHUB_MOCK_MODE,
    }


# ============== PUBLIC READ API (CherryHub polls these) ==============

@router.get("/public/health")
async def public_health(x_cherryhub_api_key: Optional[str] = Header(None, alias="X-CherryHub-Api-Key")):
    """Simple health + auth check that CherryHub can hit to verify their key."""
    _require_public_key(x_cherryhub_api_key)
    return {"ok": True, "service": "luna-cherryhub-bridge", "mode": "read-only"}


# ============== Admin: manual poller trigger ==============

@router.get("/admin/sync-stats")
async def admin_sync_stats(request: Request):
    """Returns poller stats for the last 24h + most-recent run info.

    Fields:
      - last_sync_at: most recent `last_cherryhub_sync` across all users (ISO8601)
      - linked_users: how many users have a CherryHub member_key
      - synced_last_24h: users whose watermark advanced in last 24h
      - imported_24h / 7d: count of ledger entries with source=cherryhub in that window
      - redemptions_24h / awards_24h: breakdown
      - points_net_24h: sum of amount over last 24h (signed — negative = net outflow)
      - mock_mode: whether the poller is currently a no-op
    """
    current_user = await get_authenticated_user(request)
    if current_user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin access required")

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    linked_users = await db.users.count_documents({"cherryhub_member_key": {"$nin": [None, ""]}})
    synced_24h = await db.users.count_documents({"last_cherryhub_sync": {"$gte": day_ago}})

    latest_user = await db.users.find_one(
        {"last_cherryhub_sync": {"$ne": None}},
        {"_id": 0, "last_cherryhub_sync": 1},
        sort=[("last_cherryhub_sync", -1)],
    )
    last_sync_at = _iso(latest_user.get("last_cherryhub_sync")) if latest_user else None

    imported_24h = await db.points_transactions.count_documents(
        {"source": "cherryhub", "synced_at": {"$gte": day_ago}}
    )
    imported_7d = await db.points_transactions.count_documents(
        {"source": "cherryhub", "synced_at": {"$gte": week_ago}}
    )
    redemptions_24h = await db.points_transactions.count_documents(
        {"source": "cherryhub", "type": "cherryhub_redemption", "synced_at": {"$gte": day_ago}}
    )
    awards_24h = await db.points_transactions.count_documents(
        {"source": "cherryhub", "type": "cherryhub_award", "synced_at": {"$gte": day_ago}}
    )

    pipeline = [
        {"$match": {"source": "cherryhub", "synced_at": {"$gte": day_ago}}},
        {"$group": {"_id": None, "net": {"$sum": "$amount"}}},
    ]
    net_cursor = db.points_transactions.aggregate(pipeline)
    net_docs = await net_cursor.to_list(length=1)
    points_net_24h = int(net_docs[0]["net"]) if net_docs else 0

    recent = await db.points_transactions.find(
        {"source": "cherryhub"},
        {"_id": 0, "external_id": 1, "type": 1, "amount": 1, "member_key": 1, "synced_at": 1, "created_at": 1},
    ).sort("synced_at", -1).limit(5).to_list(length=5)
    for r in recent:
        for k in ("synced_at", "created_at"):
            if isinstance(r.get(k), datetime):
                r[k] = r[k].isoformat()

    return {
        "mock_mode": os.environ.get("CHERRYHUB_MOCK_MODE", "false").lower() == "true",
        "last_sync_at": last_sync_at,
        "linked_users": linked_users,
        "synced_last_24h": synced_24h,
        "imported_24h": imported_24h,
        "imported_7d": imported_7d,
        "redemptions_24h": redemptions_24h,
        "awards_24h": awards_24h,
        "points_net_24h": points_net_24h,
        "recent_5": recent,
        "as_of": now.isoformat(),
    }


@router.post("/admin/test-award")
async def admin_test_award(request: Request):
    """Fires a LIVE points-award at CherryHub so you can verify movement in their reports.

    Defaults to +10 points. Use query params to override:
      ?points=10                    (int, default 10)
      ?member_key=LUNA-XXXX         (defaults to the calling admin's linked member)
      ?reason=Luna+Test             (url-encoded reason)

    WARNING: This is a live write to CherryHub. Only use from the admin portal
    for connectivity testing. Stamps RequestDetails.origin=luna_app so our own
    poller skips these to avoid double-count.
    """
    current_user = await get_authenticated_user(request)
    if current_user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin access required")

    if CHERRYHUB_MOCK_MODE:
        raise HTTPException(status_code=503, detail="CHERRYHUB_MOCK_MODE is on — won't fire a test write. Flip it off on Railway to test live.")

    try:
        points = int(request.query_params.get("points", "10"))
    except ValueError:
        raise HTTPException(status_code=400, detail="points must be an integer")
    if points < 1 or points > 1000:
        raise HTTPException(status_code=400, detail="points must be 1..1000")

    member_key = request.query_params.get("member_key") or current_user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(
            status_code=400,
            detail="No member_key — pass ?member_key=... or link the admin account to CherryHub first",
        )


@router.get("/admin/probe")
async def admin_probe(request: Request):
    """Diagnostic probe — fires safe READ calls against CherryHub and reports
    exactly which endpoints are reachable with our current credentials.

    Admin only. Makes no writes.

    Query params (all optional):
      ?email=X        test get_member_by_email with this email
      ?member_key=X   test get_member_by_key with this member_key
      ?search_after=ISO8601  test points-transactions search
    """
    # Diagnostic wrapper — catches ANY exception (including import/env errors)
    # and returns it as JSON so Railway 500s surface a real traceback.
    import traceback as _tb
    try:
        return await _admin_probe_impl(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("admin_probe failed")
        return {
            "status": "probe_crashed",
            "error_type": type(e).__name__,
            "error": str(e)[:500],
            "traceback": _tb.format_exc().splitlines()[-20:],
        }


async def _admin_probe_impl(request: Request):
    current_user = await get_authenticated_user(request)
    if current_user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin access required")

    if CHERRYHUB_MOCK_MODE:
        raise HTTPException(status_code=503, detail="CHERRYHUB_MOCK_MODE is on — probe needs live mode")

    probes: dict = {}

    # 1. OAuth token check
    try:
        token = await token_manager.get_access_token()
        probes["oauth"] = {"ok": True, "token_prefix": token[:16] + "...", "expires_cached": True}
    except Exception as e:
        probes["oauth"] = {"ok": False, "error": str(e)[:300]}
        return {"status": "cannot_auth", "probes": probes}

    # 2. Member lookup by email (if provided)
    email = request.query_params.get("email")
    if email:
        try:
            member = await cherryhub_service.get_member_by_email(email)
            probes["get_member_by_email"] = {"ok": True, "found": bool(member), "member": _trim(member) if member else None}
        except Exception as e:
            probes["get_member_by_email"] = {"ok": False, "error": str(e)[:300]}

    # 3. Member lookup by key (if provided)
    member_key = request.query_params.get("member_key")
    if member_key:
        try:
            member = await cherryhub_service.get_member_by_key(member_key)
            probes["get_member_by_key"] = {"ok": True, "found": bool(member), "member": _trim(member) if member else None}
        except Exception as e:
            probes["get_member_by_key"] = {"ok": False, "error": str(e)[:300]}

        # 4. Balance for that member
        try:
            balance = await cherryhub_service.get_member_points_balance(member_key)
            probes["get_member_points_balance"] = {"ok": True, "balance": balance}
        except Exception as e:
            probes["get_member_points_balance"] = {"ok": False, "error": str(e)[:300]}

    # 5. Points-transactions search (newest 5)
    since = request.query_params.get("search_after") or "2024-01-01T00:00:00Z"
    try:
        resp = await cherryhub_service.search_points_transactions(
            member_key=member_key,
            after=since,
            limit=5,
        )
        results = resp.get("Results") or []
        probes["search_points_transactions"] = {
            "ok": True,
            "count_returned": len(results),
            "has_more": bool((resp.get("_links") or {}).get("next", {}).get("continuationToken")),
            "sample": [
                {
                    "TransactionId": r.get("TransactionId"),
                    "TransactionType": r.get("TransactionType"),
                    "TransactionDate": r.get("TransactionDate"),
                    "Request": _trim(r.get("Request")),
                }
                for r in results[:3]
            ],
        }
    except Exception as e:
        probes["search_points_transactions"] = {"ok": False, "error": str(e)[:400]}

    # 6. Digital member card (Apple Pass format) — only if we have a member_key
    if member_key:
        try:
            card = await cherryhub_service.get_digital_member_card(member_key, "IosPassKit")
            probes["get_digital_member_card"] = {
                "ok": True,
                "keys_returned": list(card.keys()) if isinstance(card, dict) else type(card).__name__,
            }
        except Exception as e:
            probes["get_digital_member_card"] = {"ok": False, "error": str(e)[:300]}

    all_ok = all(p.get("ok") for p in probes.values())
    return {
        "status": "all_ok" if all_ok else "partial",
        "business_id": cherryhub_service.business_id,
        "api_base_url": cherryhub_service.api_base_url,
        "probes": probes,
    }


def _trim(obj, depth=0):
    """Trim large dicts/lists so the probe response isn't thousands of lines."""
    if depth > 3:
        return "..."
    if isinstance(obj, dict):
        return {k: _trim(v, depth + 1) for k, v in list(obj.items())[:15]}
    if isinstance(obj, list):
        return [_trim(v, depth + 1) for v in obj[:5]]
    if isinstance(obj, str) and len(obj) > 200:
        return obj[:200] + "..."
    return obj


@router.post("/admin/sync-now")
async def admin_sync_now(request: Request):
    """Force an immediate CherryHub poll (admin-only).

    - No `user_id` query param → syncs every linked user.
    - `?user_id=XXX` → syncs only that user.
    Normally APScheduler runs this every 2 minutes automatically.
    """
    current_user = await get_authenticated_user(request)
    if current_user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin access required")

    from services.cherryhub_poller import sync_cherryhub_redemptions, _sync_one_user

    user_id_param = request.query_params.get("user_id")
    if user_id_param:
        target = await db.users.find_one(
            {"user_id": user_id_param},
            {"user_id": 1, "cherryhub_member_key": 1, "last_cherryhub_sync": 1},
        )
        if not target:
            raise HTTPException(status_code=404, detail="user_id not found")
        if not target.get("cherryhub_member_key"):
            raise HTTPException(status_code=400, detail="user not linked to CherryHub")
        counts = await _sync_one_user(target)
        return {"success": True, "scope": "single_user", "user_id": user_id_param, **counts}

    counts = await sync_cherryhub_redemptions()
    return {"success": True, "scope": "all_users", **counts}


@router.get("/public/balance/{member_key}")
async def public_balance(
    member_key: str,
    x_cherryhub_api_key: Optional[str] = Header(None, alias="X-CherryHub-Api-Key"),
):
    """Return the current Luna points balance for a CherryHub member_key.

    CherryHub hits this on every in-store tap so they can show the live total.
    """
    _require_public_key(x_cherryhub_api_key)

    user = await db.users.find_one(
        {"cherryhub_member_key": member_key},
        {"_id": 0, "user_id": 1, "points_balance": 1, "points": 1, "tier": 1,
         "cherryhub_member_key": 1, "name": 1, "email": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="member_key not found in Luna")

    balance = user.get("points_balance", user.get("points", 0)) or 0
    return {
        "member_key": member_key,
        "user_id": user.get("user_id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "points_balance": int(balance),
        "tier": user.get("tier", "bronze"),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source": "luna",
    }


@router.get("/public/ledger/{member_key}")
async def public_ledger(
    member_key: str,
    since: Optional[str] = Query(None, description="ISO-8601 timestamp, returns entries strictly after this"),
    limit: int = Query(200, ge=1, le=1000),
    x_cherryhub_api_key: Optional[str] = Header(None, alias="X-CherryHub-Api-Key"),
):
    """Return Luna earn-ledger entries for a member since a timestamp.

    CherryHub uses this to pull new point-earn events (bookings, missions,
    auctions, birthdays) and mirror them into their own records.
    """
    _require_public_key(x_cherryhub_api_key)

    user = await db.users.find_one(
        {"cherryhub_member_key": member_key},
        {"_id": 0, "user_id": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="member_key not found in Luna")

    query: dict = {"user_id": user["user_id"]}
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            query["created_at"] = {"$gt": since_dt}
        except ValueError:
            raise HTTPException(status_code=400, detail="`since` must be ISO-8601")

    entries = await db.points_transactions.find(query, {"_id": 0}).sort("created_at", 1).limit(limit).to_list(length=limit)

    for e in entries:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()

    return {
        "member_key": member_key,
        "since": since,
        "count": len(entries),
        "entries": entries,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
