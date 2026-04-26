"""
One-shot migration:
  1) Seed db.milestones_custom from the hardcoded MILESTONES list (only if the
     collection is empty).
  2) Delete duplicate / orphan missions that have no target/reward.

Idempotent — safe to run multiple times.

Run:
    python3 /app/backend/tools/seed_milestones_and_cleanup.py
"""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    env = dotenv_values("/app/backend/.env")
    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]

    # ── 1) Seed milestones_custom if empty ────────────────────────────────
    from routes.milestones import MILESTONES  # legacy hardcoded list

    existing = await db.milestones_custom.count_documents({})
    if existing == 0:
        from datetime import datetime, timezone
        docs = []
        for m in MILESTONES:
            doc = {
                "id": m["id"],
                "title": m["title"],
                "points_required": m["points_required"],
                "icon": m.get("icon", "trophy"),
                "color": m.get("color", "#D4A832"),
                "description": m.get("description", ""),
                "rewards": [
                    {
                        "id": r["id"],
                        "type": r["type"],
                        "label": r["label"],
                        "description": r.get("description", ""),
                    }
                    for r in m.get("rewards", [])
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "seeded_from_legacy": True,
            }
            docs.append(doc)
        if docs:
            await db.milestones_custom.insert_many(docs)
        print(f"Seeded {len(docs)} milestones into milestones_custom")
    else:
        print(f"milestones_custom already has {existing} rows — skipping seed")

    # ── 2) Cleanup orphan / duplicate missions ────────────────────────────
    # Delete missions with no target/requirement_value AND no points_reward
    # (these are stub/empty rows from earlier Lovable forms).
    orphans = await db.missions.find(
        {
            "$and": [
                {"$or": [{"target": {"$in": [None, 0]}}, {"target": {"$exists": False}}]},
                {"$or": [{"requirement_value": {"$in": [None, 0]}}, {"requirement_value": {"$exists": False}}]},
                {"$or": [{"target_value": {"$in": [None, 0]}}, {"target_value": {"$exists": False}}]},
                {"$or": [{"points_reward": {"$in": [None, 0]}}, {"points_reward": {"$exists": False}}]},
            ]
        },
        {"_id": 0, "id": 1, "title": 1, "name": 1},
    ).to_list(50)

    if orphans:
        ids = [o.get("id") for o in orphans if o.get("id")]
        result = await db.missions.delete_many({"id": {"$in": ids}})
        print(f"Deleted {result.deleted_count} orphan missions: {ids}")
    else:
        print("No orphan missions found")

    # Print final counts
    print()
    print("FINAL STATE")
    print(f"  milestones_custom: {await db.milestones_custom.count_documents({})}")
    print(f"  missions:          {await db.missions.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(main())
