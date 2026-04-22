"""
CherryHub → Luna redemption & external-award poller.

Runs every 2 minutes on the backend scheduler. For every Luna user linked
to a CherryHub member, it pulls NEW points-transactions (redemptions that
happened in-store and awards written by SwiftPOS) from CherryHub and mirrors
them into Luna's ledger + user balance.

Key guarantees:
- **Idempotent:** each CherryHub TransactionId is stored as `external_id` on
  the Luna ledger entry. Re-running the poller on the same window never
  double-applies.
- **Non-blocking:** runs in the background APScheduler job loop; failures
  for one user don't halt the batch.
- **Read-only on CherryHub:** only hits `GET /points-transactions/search`.
  Never writes.
- **Skips Luna-originated awards:** when Luna eventually pushes awards TO
  CherryHub, they're tagged `RequestDetails.origin=luna_app` so the poller
  can filter them out to prevent double-counting.

State tracked per user: `users.last_cherryhub_sync` (datetime).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from database import db
from cherryhub_service import cherryhub_service, CHERRYHUB_MOCK_MODE

logger = logging.getLogger(__name__)

# How far back to look on first sync (no `last_cherryhub_sync` yet)
INITIAL_LOOKBACK_DAYS = 30


def _points_from_request(txn: Dict[str, Any]) -> int:
    """Extract the points amount from a CherryHub PointsTransaction record.

    CherryHub stores the request either as `PointsByQuantity` (direct) or
    `PointsByDollarValue` (which we multiply by `PointsType.PointsToDollarRatio`).
    """
    req = txn.get("Request") or {}
    qty = req.get("PointsByQuantity")
    if qty:
        return int(round(float(qty)))
    dollar_value = req.get("PointsByDollarValue")
    if dollar_value:
        ratio = float((txn.get("PointsType") or {}).get("PointsToDollarRatio") or 100)
        return int(round(float(dollar_value) * ratio))
    # Fallback: first IntegrationPointsHistory entry's implied delta
    return 0


def _is_luna_originated(txn: Dict[str, Any]) -> bool:
    """Skip awards we pushed from the Luna app (prevents double-counting).

    We tag those with `Request.RequestDetails.origin = "luna_app"` when we
    push them to CherryHub. (Luna currently does NOT push awards, so nothing
    is tagged yet — this check is future-proofing.)
    """
    details = ((txn.get("Request") or {}).get("RequestDetails") or {}) if isinstance(
        (txn.get("Request") or {}).get("RequestDetails"), dict
    ) else {}
    return details.get("origin") == "luna_app"


async def _sync_one_user(user: Dict[str, Any]) -> Dict[str, int]:
    """Sync all new CherryHub points-transactions for a single user.

    Returns counts: {"imported": N, "skipped": N, "errors": N}
    """
    member_key = user.get("cherryhub_member_key")
    user_id = user["user_id"]
    counts = {"imported": 0, "skipped": 0, "errors": 0}
    if not member_key:
        return counts

    last_sync: Optional[datetime] = user.get("last_cherryhub_sync")
    if not last_sync:
        last_sync = datetime.now(timezone.utc) - timedelta(days=INITIAL_LOOKBACK_DAYS)

    after_iso = last_sync.isoformat().replace("+00:00", "Z")
    continuation: Optional[str] = None
    newest_seen: datetime = last_sync

    try:
        while True:
            # Single call per page. Pull both Redeem + Award in one pass by NOT
            # passing transaction_type (CherryHub returns both).
            resp = await cherryhub_service.search_points_transactions(
                member_key=member_key,
                transaction_type=None,
                status="Success",
                state="Completed",
                after=after_iso,
                limit=200,
                continuation_token=continuation,
            )
            results = resp.get("Results") or []

            for txn in results:
                txn_id = txn.get("TransactionId") or txn.get("id")
                if not txn_id:
                    counts["skipped"] += 1
                    continue

                if _is_luna_originated(txn):
                    counts["skipped"] += 1
                    continue

                # Idempotency: skip if we already imported this CherryHub txn
                existing = await db.points_transactions.find_one(
                    {"external_id": txn_id}, {"_id": 1}
                )
                if existing:
                    counts["skipped"] += 1
                    continue

                txn_type = txn.get("TransactionType", "")
                points_qty = _points_from_request(txn)
                if points_qty <= 0:
                    counts["skipped"] += 1
                    continue

                # Redeem → negative, Award → positive
                delta = -points_qty if txn_type == "Redeem" else points_qty
                txn_date_raw = txn.get("TransactionDate") or ""
                try:
                    txn_date = datetime.fromisoformat(txn_date_raw.replace("Z", "+00:00"))
                except Exception:
                    txn_date = datetime.now(timezone.utc)

                await db.points_transactions.insert_one({
                    "user_id": user_id,
                    "type": "cherryhub_redemption" if txn_type == "Redeem" else "cherryhub_award",
                    "source": "cherryhub",
                    "external_id": txn_id,
                    "member_key": member_key,
                    "amount": delta,
                    "cherryhub_type": txn_type,
                    "cherryhub_status": txn.get("TransactionStatus"),
                    "cherryhub_state": txn.get("TransactionState"),
                    "points_type_id": (txn.get("PointsType") or {}).get("PointsTypeId"),
                    "reason": f"CherryHub {txn_type}",
                    "created_at": txn_date,
                    "synced_at": datetime.now(timezone.utc),
                })

                await db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"points_balance": delta}},
                )

                counts["imported"] += 1
                if txn_date > newest_seen:
                    newest_seen = txn_date

            # Pagination
            next_link = (resp.get("_links") or {}).get("next") or {}
            continuation = next_link.get("continuationToken")
            if not continuation:
                break

    except Exception as e:
        logger.warning(f"CherryHub sync failed for user {user_id}: {e}")
        counts["errors"] += 1

    # Advance the watermark (even if we imported 0 — prevents repeatedly scanning
    # the initial 30-day window on every tick for inactive members)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_cherryhub_sync": max(newest_seen, datetime.now(timezone.utc))}},
    )

    return counts


async def sync_cherryhub_redemptions() -> Dict[str, int]:
    """APScheduler entrypoint. Runs every 2 minutes.

    Returns aggregate counts for the whole batch.
    """
    if CHERRYHUB_MOCK_MODE:
        logger.debug("CherryHub poller skipped — MOCK mode")
        return {"imported": 0, "skipped": 0, "errors": 0, "users": 0, "mock": True}

    if not os.environ.get("CHERRYHUB_CLIENT_ID") or not os.environ.get("CHERRYHUB_CLIENT_SECRET"):
        logger.debug("CherryHub poller skipped — credentials missing")
        return {"imported": 0, "skipped": 0, "errors": 0, "users": 0}

    totals = {"imported": 0, "skipped": 0, "errors": 0, "users": 0}

    cursor = db.users.find(
        {"cherryhub_member_key": {"$nin": [None, ""]}},
        {"user_id": 1, "cherryhub_member_key": 1, "last_cherryhub_sync": 1},
    )

    async for user in cursor:
        totals["users"] += 1
        user_counts = await _sync_one_user(user)
        totals["imported"] += user_counts["imported"]
        totals["skipped"] += user_counts["skipped"]
        totals["errors"] += user_counts["errors"]

    if totals["imported"] or totals["errors"]:
        logger.info(
            f"CherryHub poll: {totals['users']} users, "
            f"{totals['imported']} imported, "
            f"{totals['skipped']} skipped, "
            f"{totals['errors']} errors"
        )

    return totals
