"""Points earning guard.

Staff, managers, admins, and artists cannot AUTO-EARN points from in-app actions
(missions, bookings, referrals, social posts, etc.).

Artists can still RECEIVE points via admin gift (POST /api/admin/users/{id}/grant-points),
so this guard only runs on auto-earn paths. The gift-points endpoint bypasses it.
"""
from database import db

# Roles that CANNOT auto-earn points from in-app actions
NON_EARNING_ROLES = {"admin", "manager", "staff", "artist"}


async def can_earn_points(user_id: str) -> bool:
    """Return True if this user is allowed to auto-earn points from in-app actions."""
    if not user_id:
        return False
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "role": 1})
    if not user:
        return False
    role = (user.get("role") or "user").lower()
    return role not in NON_EARNING_ROLES
