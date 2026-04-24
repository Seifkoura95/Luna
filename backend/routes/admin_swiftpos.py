"""
Admin SwiftPOS Reporting Routes — for the Lovable admin portal.

Exposes a read-only view into the SwiftPOS ↔ app points pipeline:
  - Overall integration health (mock_mode, users linked, pending/failed dispatches)
  - Paginated points_transactions ledger (filter by status / event / user / date)
  - Paginated user link status (linked vs unlinked vs pending)
  - PLU catalog (app event → SwiftPOS product code)
  - Retry actions for pending/failed SwiftPOS dispatches

Access is gated through the shared `require_admin` helper which accepts either
a JWT admin/staff/manager bearer OR the `X-Luna-Hub-Key` header used by the
Lovable portal for server-to-server access.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timedelta, timezone

from database import db
from routes.admin import require_admin
from services.swiftpos_service import (
    swiftpos_service,
    SwiftPOSError,
    SWIFTPOS_BASE_URL,
    SWIFTPOS_AUTH_PATH,
    SWIFTPOS_ORDERS_PATH,
    SWIFTPOS_INTEGRATOR_NAME,
    SWIFTPOS_INTEGRATOR_KEY,
    SWIFTPOS_CUSTOMER_REF,
    SWIFTPOS_CLIENT_ID,
    SWIFTPOS_CLERK_ID,
    SWIFTPOS_CLERK_PASSWORD,
)
from services.swiftpos_plu_map import MISSION_PLUS, REWARD_PLUS, POINT_DOLLAR_VALUE


router = APIRouter(prefix="/admin/swiftpos", tags=["admin-swiftpos"])


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def _clean_tx(tx: dict) -> dict:
    tx.pop("_id", None)
    for key in ("created_at", "dispatched_at", "retried_at"):
        if key in tx:
            tx[key] = _iso(tx[key])
    return tx


def _parse_range(range_key: str) -> datetime:
    now = datetime.now(timezone.utc)
    if range_key == "24h":
        return now - timedelta(hours=24)
    if range_key == "7d":
        return now - timedelta(days=7)
    if range_key == "30d":
        return now - timedelta(days=30)
    if range_key == "all":
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    return now - timedelta(hours=24)


# ────────────── SUMMARY ──────────────

@router.get("/summary")
async def swiftpos_summary(
    request: Request,
    range: str = Query("7d", description="24h | 7d | 30d | all"),
):
    """Top-line KPIs for the SwiftPOS integration."""
    await require_admin(request)
    since = _parse_range(range)

    # User link status
    total_users = await db.users.count_documents({})
    linked_users = await db.users.count_documents({"cherryhub_member_key": {"$exists": True, "$ne": None}})
    swiftpos_ready = await db.users.count_documents({"swiftpos_customer_id": {"$exists": True, "$ne": None}})
    link_pending = await db.users.count_documents({"swiftpos_link_pending": True})

    # Transaction dispatch status (over window)
    tx_filter_since = {"created_at": {"$gte": since}}
    dispatched = await db.points_transactions.count_documents(
        {**tx_filter_since, "dispatched_to_swiftpos": True}
    )
    pending = await db.points_transactions.count_documents(
        {**tx_filter_since, "pending_swiftpos_dispatch": True}
    )
    failed = await db.points_transactions.count_documents(
        {**tx_filter_since, "dispatch_error": {"$ne": None}}
    )
    total_tx = await db.points_transactions.count_documents(tx_filter_since)

    # Points totals over window
    agg = await db.points_transactions.aggregate([
        {"$match": tx_filter_since},
        {"$group": {
            "_id": None,
            "total_points": {"$sum": {"$ifNull": ["$total_points", 0]}},
            "dispatched_points": {
                "$sum": {
                    "$cond": [{"$eq": ["$dispatched_to_swiftpos", True]},
                              {"$ifNull": ["$total_points", 0]}, 0]
                }
            },
        }},
    ]).to_list(1)
    totals = agg[0] if agg else {"total_points": 0, "dispatched_points": 0}

    # All-time pending queue (not just window)
    pending_all_time = await db.points_transactions.count_documents(
        {"pending_swiftpos_dispatch": True}
    )

    return {
        "range": range,
        "since": _iso(since),
        "swiftpos_mock_mode": swiftpos_service.is_mock,
        "credentials_configured": bool(
            SWIFTPOS_INTEGRATOR_KEY and SWIFTPOS_CUSTOMER_REF and SWIFTPOS_CLIENT_ID and SWIFTPOS_CLERK_ID
        ),
        "users": {
            "total": total_users,
            "linked_to_cherryhub": linked_users,
            "swiftpos_ready": swiftpos_ready,
            "link_pending": link_pending,
            "unlinked": max(0, total_users - linked_users),
        },
        "transactions": {
            "total": total_tx,
            "dispatched": dispatched,
            "pending": pending,
            "failed": failed,
            "pending_all_time": pending_all_time,
        },
        "points": {
            "total_awarded": int(totals.get("total_points", 0)),
            "dispatched_to_swiftpos": int(totals.get("dispatched_points", 0)),
            "dollar_value_per_point": POINT_DOLLAR_VALUE,
        },
    }


# ────────────── TRANSACTIONS ──────────────

@router.get("/transactions")
async def swiftpos_transactions(
    request: Request,
    status: Optional[str] = Query(None, description="dispatched | pending | failed"),
    event_type: Optional[str] = Query(None, description="mission | reward | referral | birthday | nightly_crown | manual"),
    user_id: Optional[str] = None,
    range: str = Query("7d"),
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0),
):
    """Paginated ledger of points_transactions. Defaults to newest first."""
    await require_admin(request)
    since = _parse_range(range)

    q: dict = {"created_at": {"$gte": since}}
    if status == "dispatched":
        q["dispatched_to_swiftpos"] = True
    elif status == "pending":
        q["pending_swiftpos_dispatch"] = True
    elif status == "failed":
        q["dispatch_error"] = {"$ne": None}
    if event_type:
        q["source"] = event_type
    if user_id:
        q["user_id"] = user_id

    total = await db.points_transactions.count_documents(q)
    cursor = db.points_transactions.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = [_clean_tx(dict(tx)) async for tx in cursor]

    # Enrich with user name/email (single round trip)
    user_ids = list({it["user_id"] for it in items if it.get("user_id")})
    users = {}
    if user_ids:
        async for u in db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "cherryhub_member_key": 1},
        ):
            users[u["user_id"]] = u
    for it in items:
        u = users.get(it.get("user_id"))
        if u:
            it["user_name"] = u.get("name")
            it["user_email"] = u.get("email")
            it["user_cherryhub_member_key"] = u.get("cherryhub_member_key")

    return {"total": total, "limit": limit, "skip": skip, "items": items}


# ────────────── USERS ──────────────

@router.get("/users")
async def swiftpos_users(
    request: Request,
    link_status: Optional[str] = Query(None, description="linked | unlinked | pending"),
    q: Optional[str] = Query(None, description="name/email fuzzy match"),
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0),
):
    """Paginated user list with link status + live balance (as mirrored)."""
    await require_admin(request)

    mongo_q: dict = {}
    if link_status == "linked":
        mongo_q["cherryhub_member_key"] = {"$exists": True, "$ne": None}
    elif link_status == "unlinked":
        mongo_q["$and"] = [
            {"$or": [
                {"cherryhub_member_key": {"$exists": False}},
                {"cherryhub_member_key": None},
            ]},
            {"$or": [
                {"swiftpos_link_pending": {"$exists": False}},
                {"swiftpos_link_pending": False},
            ]},
        ]
    elif link_status == "pending":
        mongo_q["swiftpos_link_pending"] = True

    if q:
        mongo_q["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]

    total = await db.users.count_documents(mongo_q)
    cursor = db.users.find(
        mongo_q,
        {
            "_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1,
            "cherryhub_member_key": 1, "swiftpos_customer_id": 1,
            "swiftpos_link_pending": 1, "points_balance": 1,
            "points_balance_refreshed_at": 1, "created_at": 1,
        },
    ).sort("created_at", -1).skip(skip).limit(limit)

    items = []
    async for u in cursor:
        u["points_balance_refreshed_at"] = _iso(u.get("points_balance_refreshed_at"))
        u["created_at"] = _iso(u.get("created_at"))
        u["linked"] = bool(u.get("cherryhub_member_key"))
        items.append(u)

    return {"total": total, "limit": limit, "skip": skip, "items": items}


# ────────────── CONFIG / PLUs ──────────────

@router.get("/config")
async def swiftpos_config(request: Request):
    """Surface (redacted) config + PLU catalog for the admin UI."""
    await require_admin(request)

    def _mask(v: str) -> str:
        if not v:
            return ""
        return f"{v[:2]}…{v[-2:]}" if len(v) > 6 else "***"

    return {
        "mock_mode": swiftpos_service.is_mock,
        "base_url": SWIFTPOS_BASE_URL,
        "auth_path": SWIFTPOS_AUTH_PATH,
        "orders_path": SWIFTPOS_ORDERS_PATH,
        "integrator_name": SWIFTPOS_INTEGRATOR_NAME,
        "credentials": {
            "integrator_key": _mask(SWIFTPOS_INTEGRATOR_KEY),
            "customer_ref": _mask(SWIFTPOS_CUSTOMER_REF),
            "client_id": _mask(SWIFTPOS_CLIENT_ID),
            "clerk_id": _mask(SWIFTPOS_CLERK_ID),
            "clerk_password": "set" if SWIFTPOS_CLERK_PASSWORD else "missing",
        },
        "plu_catalog": {
            "point_dollar_value": POINT_DOLLAR_VALUE,
            "missions": [
                {"event_key": k, **v, "points_per_unit": int(v["unit_price"] / POINT_DOLLAR_VALUE)}
                for k, v in MISSION_PLUS.items()
            ],
            "rewards": [
                {"event_key": k, **v, "points_per_unit": int(v["unit_price"] / POINT_DOLLAR_VALUE)}
                for k, v in REWARD_PLUS.items()
            ],
        },
    }


# ────────────── RETRY DISPATCH ──────────────

async def _retry_single_tx(tx: dict) -> dict:
    """Re-send a pending/failed points_transactions row to SwiftPOS."""
    from services.swiftpos_plu_map import plu_for_mission, plu_for_reward

    if tx.get("dispatched_to_swiftpos"):
        return {"tx_id": tx["id"], "skipped": True, "reason": "already_dispatched"}

    user = await db.users.find_one(
        {"user_id": tx["user_id"]},
        {"_id": 0, "cherryhub_member_key": 1, "swiftpos_customer_id": 1},
    )
    if not user:
        return {"tx_id": tx["id"], "success": False, "reason": "user_missing"}

    swiftpos_customer_id = user.get("swiftpos_customer_id") or user.get("cherryhub_member_key")
    if not swiftpos_customer_id:
        return {"tx_id": tx["id"], "success": False, "reason": "user_not_linked"}

    # Resolve PLU from source + event_key
    plu_info = None
    source = tx.get("source")
    event_key = tx.get("event_key")
    if source == "mission" and event_key:
        plu_info = plu_for_mission(event_key)
    elif source == "reward" and event_key:
        plu_info = plu_for_reward(event_key)
    if not plu_info:
        return {"tx_id": tx["id"], "success": False, "reason": "no_plu_mapping"}

    multiplier = int(tx.get("multiplier") or 1)
    try:
        sp_resp = await swiftpos_service.submit_transaction(
            swiftpos_customer_id=swiftpos_customer_id,
            line_items=[{
                "plu": plu_info["plu"],
                "quantity": multiplier,
                "unit_price": -abs(plu_info["unit_price"]),
                "description": f"Luna {source.title()} (retry): {plu_info['name']}",
            }],
            external_reference=f"retry-{tx['id']}",
            notes=tx.get("reason"),
        )
    except SwiftPOSError as e:
        await db.points_transactions.update_one(
            {"id": tx["id"]},
            {"$set": {
                "dispatch_error": str(e)[:300],
                "retried_at": datetime.now(timezone.utc),
            }},
        )
        return {"tx_id": tx["id"], "success": False, "reason": "swiftpos_error", "error": str(e)[:300]}

    await db.points_transactions.update_one(
        {"id": tx["id"]},
        {"$set": {
            "dispatched_to_swiftpos": True,
            "pending_swiftpos_dispatch": False,
            "dispatch_error": None,
            "retried_at": datetime.now(timezone.utc),
            "swiftpos_transaction_id": sp_resp.get("TransactionId"),
        }},
    )
    return {"tx_id": tx["id"], "success": True, "swiftpos_transaction_id": sp_resp.get("TransactionId")}


@router.post("/retry/{tx_id}")
async def retry_one(request: Request, tx_id: str):
    await require_admin(request)
    tx = await db.points_transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await _retry_single_tx(tx)


@router.post("/retry-pending")
async def retry_pending(
    request: Request,
    limit: int = Query(25, le=100, description="Max retries in one call"),
):
    """Bulk-retry the oldest pending SwiftPOS dispatches. Bounded per call."""
    await require_admin(request)
    cursor = db.points_transactions.find(
        {"pending_swiftpos_dispatch": True},
        {"_id": 0},
    ).sort("created_at", 1).limit(limit)

    results = []
    async for tx in cursor:
        results.append(await _retry_single_tx(tx))

    return {
        "attempted": len(results),
        "succeeded": sum(1 for r in results if r.get("success")),
        "failed": sum(1 for r in results if r.get("success") is False),
        "skipped": sum(1 for r in results if r.get("skipped")),
        "results": results,
    }
