"""
Backend tests for the Nightly Crown (daily leaderboard winner) feature.

Covers:
- GET /api/leaderboard/daily-prize (public/optional auth)
- POST /api/leaderboard/admin/award-now (admin-only, idempotent per Brisbane day)
- Award side-effects: +50 points, points_transactions ledger entry,
  leaderboard_winners document, last_winner populated on daily-prize
- Non-admin is forbidden
- Winner selection excludes admin + sample_user_ seeds
- next_midnight_utc == 00:00 Brisbane next day (UTC+10)

Cleans up all side-effects on the prod DB after the run.
"""
import os
import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

# Use local URL for speed (public external URL also works).
BASE_URL = "http://localhost:8001"
BRISBANE_TZ = ZoneInfo("Australia/Brisbane")
DAILY_PRIZE_POINTS = 50

ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"
USER_EMAIL = "luna@test.com"
USER_PASSWORD = "test123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_auth(api):
    data = _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def user_auth(api):
    data = _login(api, USER_EMAIL, USER_PASSWORD)
    return {"token": data["token"], "user": data["user"]}


# ---------- auth smoke ----------
def test_logins(admin_auth, user_auth):
    assert admin_auth["user"].get("role") == "admin"
    assert user_auth["user"].get("email") == USER_EMAIL


# ---------- GET /api/leaderboard/daily-prize ----------
def test_daily_prize_public_shape(api):
    r = api.get(f"{BASE_URL}/api/leaderboard/daily-prize")
    assert r.status_code == 200, r.text
    data = r.json()
    # Core static fields
    assert data["prize_amount"] == DAILY_PRIZE_POINTS
    assert data["timezone"] == "Australia/Brisbane"
    # Promo block
    promo = data.get("promo")
    assert promo, "promo block missing"
    assert promo["title"] == "Nightly Crown"
    assert promo.get("tagline")
    assert promo.get("description")
    # Recent winners is a list (may be empty)
    assert isinstance(data.get("recent_winners"), list)
    # next_midnight_utc is valid ISO and in the future
    nmu = data["next_midnight_utc"]
    dt = datetime.fromisoformat(nmu)
    assert dt > datetime.now(timezone.utc), "next_midnight_utc must be in the future"


def test_daily_prize_current_leader_exists(api):
    r = api.get(f"{BASE_URL}/api/leaderboard/daily-prize")
    data = r.json()
    cl = data.get("current_leader")
    # luna@test.com has ~20k pts so some leader must exist
    assert cl is not None, "current_leader should not be None (there are real users with points)"
    assert "display_name" in cl
    assert isinstance(cl.get("points_balance"), int)
    assert cl["points_balance"] > 0


def test_next_midnight_is_brisbane_midnight_next_day(api):
    r = api.get(f"{BASE_URL}/api/leaderboard/daily-prize")
    data = r.json()
    nmu = datetime.fromisoformat(data["next_midnight_utc"])
    # Convert to Brisbane local time
    local = nmu.astimezone(BRISBANE_TZ)
    assert local.hour == 0 and local.minute == 0 and local.second == 0, (
        f"Expected 00:00 Brisbane, got {local.isoformat()}"
    )
    # Must be the *next* Brisbane day (strictly after "now" in Brisbane)
    now_bris = datetime.now(BRISBANE_TZ)
    assert local.date() > now_bris.date(), (
        f"next_midnight local date {local.date()} should be after today {now_bris.date()}"
    )
    # Brisbane is UTC+10, so the UTC ISO string should carry that offset relationship.
    # utcoffset of Brisbane moment should be exactly +10h.
    assert local.utcoffset() == timedelta(hours=10)


# ---------- Non-admin forbidden ----------
def test_award_now_non_admin_forbidden(api, user_auth):
    r = api.post(
        f"{BASE_URL}/api/leaderboard/admin/award-now?force=true",
        headers={"Authorization": f"Bearer {user_auth['token']}"},
    )
    assert r.status_code in (401, 403), f"Expected 401/403 for non-admin, got {r.status_code}: {r.text}"


def test_award_now_no_auth_unauthorized(api):
    r = api.post(f"{BASE_URL}/api/leaderboard/admin/award-now?force=true")
    assert r.status_code in (401, 403)


# ---------- Admin award + idempotency + side-effects ----------
@pytest.fixture(scope="module")
def award_state():
    """Tracks winner info + original balance so we can roll back."""
    return {}


def _get_user_by_id(user_id, admin_token):
    """Fetch a user by user_id through admin users endpoint or /api/auth/me substitute.
    We'll hit /api/users/{user_id} if available, else fall back to a leaderboard lookup.
    """
    # /api/admin/users? Let's just use a direct DB-like path via admin endpoint
    # The safest public path: leaderboard with auth returns points_balance for top users.
    return None  # unused; we read balance via leaderboard or daily-prize instead


def test_award_now_force_succeeds(api, admin_auth, award_state):
    # Capture leader + their current balance BEFORE awarding
    pre = api.get(f"{BASE_URL}/api/leaderboard/daily-prize").json()
    pre_leader = pre.get("current_leader")
    assert pre_leader, "Must have a current leader to test award"
    award_state["pre_leader_balance"] = pre_leader["points_balance"]

    r = api.post(
        f"{BASE_URL}/api/leaderboard/admin/award-now?force=true",
        headers={"Authorization": f"Bearer {admin_auth['token']}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True, f"Award failed: {data}"
    winner = data.get("winner") or {}
    assert winner.get("amount") == DAILY_PRIZE_POINTS
    assert winner.get("user_id")
    assert winner.get("display_name")
    award_state["winner_user_id"] = winner["user_id"]
    award_state["display_name"] = winner["display_name"]
    award_state["day_key"] = data.get("day_key")
    # points_balance_at_win reflects balance BEFORE the +50 credit
    assert winner.get("points_balance_at_win") == award_state["pre_leader_balance"]


def test_award_now_idempotent_without_force(api, admin_auth, award_state):
    assert award_state.get("winner_user_id"), "Prior award must have run"
    r = api.post(
        f"{BASE_URL}/api/leaderboard/admin/award-now",
        headers={"Authorization": f"Bearer {admin_auth['token']}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is False
    assert data.get("reason") == "already_awarded"
    assert data.get("day_key") == award_state["day_key"]


def test_side_effects_points_credited_and_ledger_and_winner_doc(api, admin_auth, award_state):
    """Verify +50 on user, ledger entry, winner doc, and last_winner on daily-prize."""
    # After award, the same user should still appear as current_leader (since they just got +50)
    post = api.get(f"{BASE_URL}/api/leaderboard/daily-prize").json()
    leader = post.get("current_leader")
    assert leader, "Leader should exist post-award"
    expected_new_balance = award_state["pre_leader_balance"] + DAILY_PRIZE_POINTS
    # Leader display should match winner display (same user likely remains #1 after +50)
    assert leader["display_name"] == award_state["display_name"], (
        f"Expected leader {award_state['display_name']} to still be #1, got {leader['display_name']}"
    )
    assert leader["points_balance"] == expected_new_balance, (
        f"Expected balance {expected_new_balance}, got {leader['points_balance']}"
    )

    # last_winner populated
    lw = post.get("last_winner")
    assert lw is not None, "last_winner should be populated after award"
    assert lw.get("display_name") == award_state["display_name"]
    assert lw.get("amount") == DAILY_PRIZE_POINTS
    assert lw.get("day_key") == award_state["day_key"]


def test_side_effects_via_mongo(award_state):
    """Directly verify ledger (points_transactions) + leaderboard_winners via Mongo."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from database import db  # noqa: E402

    async def _check():
        uid = award_state["winner_user_id"]
        day_key = award_state["day_key"]
        # points_transactions entry
        tx = await db.points_transactions.find_one({
            "user_id": uid,
            "source": "daily_leaderboard_winner",
            "day_key": day_key,
        })
        assert tx is not None, "points_transactions entry missing"
        assert tx.get("amount") == DAILY_PRIZE_POINTS
        # leaderboard_winners doc
        lw = await db.leaderboard_winners.find_one({"day_key": day_key, "user_id": uid})
        assert lw is not None, "leaderboard_winners document missing"
        assert lw.get("amount") == DAILY_PRIZE_POINTS
        # user points actually incremented
        u = await db.users.find_one({"user_id": uid})
        assert u is not None
        assert u.get("points_balance") == award_state["pre_leader_balance"] + DAILY_PRIZE_POINTS

    asyncio.get_event_loop().run_until_complete(_check())


def test_winner_excludes_admin_and_sample_users(award_state):
    """Ensure the selection never picks an admin or a sample_user_*."""
    uid = award_state["winner_user_id"]
    assert not uid.startswith("sample_user_"), f"Winner {uid} is a sample user"

    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from database import db  # noqa: E402

    async def _check():
        u = await db.users.find_one({"user_id": uid})
        assert u is not None
        assert u.get("role") != "admin", "Winner should not be an admin"

    asyncio.get_event_loop().run_until_complete(_check())


# ---------- Teardown: clean up prod side-effects ----------
def test_cleanup_award_side_effects(award_state):
    """Roll back: remove winner doc, remove ledger tx, and subtract +50 from user."""
    if not award_state.get("winner_user_id"):
        pytest.skip("No award happened; nothing to clean up")

    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from database import db  # noqa: E402

    async def _cleanup():
        uid = award_state["winner_user_id"]
        day_key = award_state["day_key"]
        # Remove ledger entries
        await db.points_transactions.delete_many({
            "user_id": uid,
            "source": "daily_leaderboard_winner",
            "day_key": day_key,
        })
        # Remove winner docs for today
        await db.leaderboard_winners.delete_many({"day_key": day_key, "user_id": uid})
        # Remove notifications we created
        await db.notifications.delete_many({
            "user_id": uid,
            "type": "leaderboard_winner",
            "data.day_key": day_key,
        })
        # Remove scheduled_job_runs record for today (best-effort)
        await db.scheduled_job_runs.delete_many({
            "job_name": "daily_leaderboard_winner",
            "day_key": day_key,
        })
        # Rollback balance: -50 from user's points_balance + total_points_earned
        await db.users.update_one(
            {"user_id": uid},
            {"$inc": {
                "points_balance": -DAILY_PRIZE_POINTS,
                "total_points_earned": -DAILY_PRIZE_POINTS,
            }},
        )
        # Verify
        u = await db.users.find_one({"user_id": uid})
        assert u.get("points_balance") == award_state["pre_leader_balance"], (
            f"Rollback failed: expected {award_state['pre_leader_balance']}, got {u.get('points_balance')}"
        )

    asyncio.get_event_loop().run_until_complete(_cleanup())
