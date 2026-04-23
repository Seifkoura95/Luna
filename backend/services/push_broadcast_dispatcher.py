"""
Scheduled push broadcasts dispatcher.
Runs every minute and fires any `scheduled` broadcasts whose
`scheduled_for` timestamp has passed. Marks them `sent` and
records per-user notification rows (same behaviour as manual /send).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from database import db

logger = logging.getLogger(__name__)


async def dispatch_due_push_broadcasts() -> dict:
    """Fire any scheduled broadcasts whose time has come.

    Returns a summary dict: `{fired, sent_count, total_recipients, errors}`.
    Safe to call repeatedly — uses a Mongo `find_one_and_update` guard so each
    broadcast can only fire once even if two workers race.
    """
    from routes.push_broadcasts import _resolve_audience, _send_expo_push  # lazy

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    summary = {"fired": 0, "sent_count": 0, "total_recipients": 0, "errors": []}

    while True:
        due = await db.push_broadcasts.find_one_and_update(
            {
                "status": "scheduled",
                "scheduled_for": {"$lte": now_iso},
            },
            {"$set": {"status": "dispatching", "updated_at": now_iso}},
            return_document=True,
        )
        if not due:
            break

        try:
            users = await _resolve_audience(due.get("audience", "all"))
            all_tokens: list[str] = []
            for u in users:
                for t in (u.get("push_tokens") or []):
                    if t and t not in all_tokens:
                        all_tokens.append(t)
                if u.get("push_token") and u["push_token"] not in all_tokens:
                    all_tokens.append(u["push_token"])

            push_data = {
                "type": "broadcast",
                "broadcast_id": due["id"],
                "deep_link": due.get("deep_link", "home"),
            }
            sent = await _send_expo_push(all_tokens, due["title"], due["body"], push_data)

            await db.push_broadcasts.update_one(
                {"id": due["id"]},
                {
                    "$set": {
                        "status": "sent",
                        "sent_at": now_iso,
                        "audience_size": len(users),
                        "updated_at": now_iso,
                    }
                },
            )

            if users:
                notif_records = []
                for u in users:
                    notif_records.append({
                        "notification_id": str(uuid.uuid4()),
                        "broadcast_id": due["id"],
                        "user_id": u["user_id"],
                        "title": due["title"],
                        "body": due["body"],
                        "deep_link": due.get("deep_link", "home"),
                        "opened": False,
                        "clicked": False,
                        "created_at": now_iso,
                    })
                await db.user_notifications.insert_many(notif_records)

            summary["fired"] += 1
            summary["sent_count"] += sent
            summary["total_recipients"] += len(users)
            logger.info(
                "Scheduled broadcast %s fired: %s/%s tokens, %s users",
                due["id"], sent, len(all_tokens), len(users),
            )
        except Exception as e:
            logger.error("Scheduled broadcast %s failed: %s", due.get("id"), e)
            summary["errors"].append({"id": due.get("id"), "error": str(e)[:200]})
            # Flip back to scheduled so it can retry next tick
            await db.push_broadcasts.update_one(
                {"id": due["id"]},
                {"$set": {"status": "scheduled", "last_error": str(e)[:300]}},
            )

    return summary
