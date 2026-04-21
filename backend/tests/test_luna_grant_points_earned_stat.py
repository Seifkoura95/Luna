"""
Iteration 36 — Incremental tests for:
  - POST /api/admin/users/{id}/grant-points: total_points_earned should ONLY
    increment on positive grants (negative deductions should not inflate
    the lifetime-earn stat).
  - Verify grant-points works via STAFF JWT (require_admin accepts staff).
  - Verify grant-points works via X-Luna-Hub-Key header.
  - Verify amount=0 -> 400.

Runs against the live preview URL and uses the shared luna@test.com user;
resets luna's role=user and cleans up test staff user at the end.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://birthday-rewards-1.preview.emergentagent.com",
).rstrip("/")

HUB_KEY = "luna_hub_live_682fbaaa19a6a4594f58618b803531ee6fad8016"
HUB_HEADERS = {"X-Luna-Hub-Key": HUB_KEY, "Content-Type": "application/json"}

ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASS = "Trent69!"
LUNA_EMAIL = "luna@test.com"
LUNA_PASS = "test123"


state = {
    "admin_token": None,
    "luna_user_id": None,
    "luna_token": None,
    "staff_email": None,
    "staff_password": "StaffTest123!",
    "staff_user_id": None,
    "staff_token": None,
}


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data.get("user", {}).get("user_id") or data.get("user_id")


def _get_user(user_id):
    r = requests.get(
        f"{BASE_URL}/api/admin/users/{user_id}", headers=HUB_HEADERS, timeout=30
    )
    assert r.status_code == 200, r.text
    return r.json()["user"]


@pytest.fixture(scope="module", autouse=True)
def session():
    # Admin + luna tokens
    state["admin_token"], _ = _login(ADMIN_EMAIL, ADMIN_PASS)
    state["luna_token"], state["luna_user_id"] = _login(LUNA_EMAIL, LUNA_PASS)

    # Make sure luna is role=user
    requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS,
        json={"role": "user"},
        timeout=30,
    )

    # Create a staff user for JWT testing
    suffix = uuid.uuid4().hex[:8]
    state["staff_email"] = f"TEST_staff_{suffix}@test.com"
    reg = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": state["staff_email"],
            "password": state["staff_password"],
            "name": "TEST Staff",
            "phone": f"04{uuid.uuid4().hex[:8]}",
            "date_of_birth": "1995-01-01",
        },
        timeout=30,
    )
    if reg.status_code in (200, 201):
        body = reg.json()
        state["staff_user_id"] = (body.get("user") or {}).get("user_id") or body.get("user_id")
        # promote to staff via hub-key
        up = requests.put(
            f"{BASE_URL}/api/admin/users/{state['staff_user_id']}",
            headers=HUB_HEADERS,
            json={"role": "staff"},
            timeout=30,
        )
        assert up.status_code == 200, up.text
        # login as staff to get JWT
        state["staff_token"], _ = _login(state["staff_email"], state["staff_password"])

    yield

    # CLEANUP: reset luna to user
    try:
        requests.put(
            f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
            headers=HUB_HEADERS,
            json={"role": "user"},
            timeout=30,
        )
    except Exception:
        pass
    # Demote staff back to user (best-effort)
    if state["staff_user_id"]:
        try:
            requests.put(
                f"{BASE_URL}/api/admin/users/{state['staff_user_id']}",
                headers=HUB_HEADERS,
                json={"role": "user"},
                timeout=30,
            )
        except Exception:
            pass


# ===================== CORE: total_points_earned incremental logic =====================

def test_positive_grant_increments_balance_and_total_earned():
    before = _get_user(state["luna_user_id"])
    bal_before = before.get("points_balance", 0)
    earned_before = before.get("total_points_earned", 0)

    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS,
        json={"amount": 500, "reason": "TEST iter36 positive"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["new_balance"] == bal_before + 500

    after = _get_user(state["luna_user_id"])
    assert after.get("points_balance", 0) == bal_before + 500, (
        f"points_balance: expected {bal_before+500}, got {after.get('points_balance')}"
    )
    assert after.get("total_points_earned", 0) == earned_before + 500, (
        f"total_points_earned: expected {earned_before+500}, got {after.get('total_points_earned')}"
    )


def test_negative_grant_decrements_balance_but_preserves_total_earned():
    before = _get_user(state["luna_user_id"])
    bal_before = before.get("points_balance", 0)
    earned_before = before.get("total_points_earned", 0)

    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS,
        json={"amount": -500, "reason": "TEST iter36 negative — adjustment"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["new_balance"] == bal_before - 500

    after = _get_user(state["luna_user_id"])
    assert after.get("points_balance", 0) == bal_before - 500
    # KEY ASSERTION: negative grant must NOT change total_points_earned.
    assert after.get("total_points_earned", 0) == earned_before, (
        f"total_points_earned inflated by a negative grant. "
        f"Before={earned_before}, after={after.get('total_points_earned')}"
    )

    # Also: transaction type should be 'admin_deduct'
    tx = data["transaction"]
    assert tx["amount"] == -500
    assert tx["type"] == "admin_deduct"
    assert tx["source"] == "admin_grant"


def test_zero_amount_returns_400():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS,
        json={"amount": 0, "reason": "TEST zero"},
        timeout=30,
    )
    assert r.status_code == 400, r.text


# ===================== AUTH SURFACES: STAFF JWT + HUB KEY + USER JWT =====================

def test_grant_points_with_staff_jwt_accepted():
    """Staff Portal Gift Points UI will call this with a staff JWT — require_admin
    accepts {admin, staff, manager}, so this MUST succeed."""
    if not state["staff_token"]:
        pytest.skip("staff user not provisioned")
    before = _get_user(state["luna_user_id"])
    bal_before = before.get("points_balance", 0)
    earned_before = before.get("total_points_earned", 0)

    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers={
            "Authorization": f"Bearer {state['staff_token']}",
            "Content-Type": "application/json",
        },
        json={"amount": 100, "reason": "TEST staff JWT gift"},
        timeout=30,
    )
    assert r.status_code == 200, f"Staff JWT rejected by grant-points: {r.status_code} {r.text}"
    data = r.json()
    assert data["new_balance"] == bal_before + 100
    tx = data["transaction"]
    # granted_by should be the staff user id, via=jwt
    assert tx["granted_by"] == state["staff_user_id"]
    assert tx["granted_via"] == "jwt"

    after = _get_user(state["luna_user_id"])
    assert after.get("total_points_earned", 0) == earned_before + 100


def test_grant_points_with_hub_key_still_works():
    before = _get_user(state["luna_user_id"])
    bal_before = before.get("points_balance", 0)
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS,
        json={"amount": 50, "reason": "TEST hub-key regression"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["new_balance"] == bal_before + 50
    assert data["transaction"]["granted_by"] == "luna_hub"
    assert data["transaction"]["granted_via"] == "hub_key"


def test_grant_points_with_regular_user_jwt_rejected_403():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers={
            "Authorization": f"Bearer {state['luna_token']}",
            "Content-Type": "application/json",
        },
        json={"amount": 10, "reason": "TEST unauthorised"},
        timeout=30,
    )
    assert r.status_code == 403, f"expected 403 for regular user JWT, got {r.status_code}"


def test_grant_points_no_auth_401():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        json={"amount": 10},
        timeout=30,
    )
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ===================== REGRESSION: gift-entry scheduled past date =====================

def test_gift_entry_scheduled_in_past_400():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS,
        json={"venue_id": "eclipse", "scheduled_for": "1999-01-01"},
        timeout=30,
    )
    assert r.status_code == 400, r.text
    assert "past" in r.text.lower()


def test_gift_entry_immediate_still_works():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS,
        json={"venue_id": "eclipse", "note": "TEST iter36 immediate"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    t = r.json()["ticket"]
    assert t["status"] == "active"
    assert t["qr_code"].startswith("LUNA-ENT-")
    # Immediately revoke to clean up
    requests.delete(
        f"{BASE_URL}/api/admin/entry-tickets/{t['id']}",
        headers=HUB_HEADERS,
        timeout=30,
    )


# ===================== REGRESSION: /api/entry-tickets/my live_status sweep =====================

def test_entry_tickets_my_live_status_field():
    r = requests.get(
        f"{BASE_URL}/api/entry-tickets/my",
        headers={"Authorization": f"Bearer {state['luna_token']}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "tickets" in data
    for t in data["tickets"]:
        assert "live_status" in t
        assert t["live_status"] in (
            "active",
            "scheduled",
            "used",
            "expired",
            "revoked",
        )


# ===================== REGRESSION: earn-guard still blocks artist =====================

def test_earn_guard_artist_still_blocked():
    # Flip luna to artist
    up = requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS,
        json={"role": "artist"},
        timeout=30,
    )
    assert up.status_code == 200
    try:
        ml = requests.get(
            f"{BASE_URL}/api/missions",
            headers={"Authorization": f"Bearer {state['luna_token']}"},
            timeout=30,
        )
        if ml.status_code != 200:
            pytest.skip("missions list unavailable")
        missions = ml.json() if isinstance(ml.json(), list) else ml.json().get("missions", [])
        if not missions:
            pytest.skip("no missions")
        mid = missions[0].get("id")
        r = requests.post(
            f"{BASE_URL}/api/missions/{mid}/claim",
            headers={"Authorization": f"Bearer {state['luna_token']}"},
            timeout=30,
        )
        assert r.status_code != 200, f"artist should not successfully claim: {r.text}"
        if r.status_code == 403:
            assert (
                "cannot earn" in r.text.lower() or "account type" in r.text.lower()
            )
    finally:
        # restore luna to user
        requests.put(
            f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
            headers=HUB_HEADERS,
            json={"role": "user"},
            timeout=30,
        )


# ===================== REGRESSION: CRUD still passes =====================

def test_regression_admin_milestones_list():
    r = requests.get(f"{BASE_URL}/api/admin/milestones", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200
    assert r.json().get("total", 0) >= 1


def test_regression_admin_bottles_list():
    r = requests.get(f"{BASE_URL}/api/admin/bottles", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200
    assert r.json().get("total", 0) >= 1


def test_regression_admin_venues_list():
    r = requests.get(f"{BASE_URL}/api/admin/venues", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200


def test_regression_public_config():
    r = requests.get(f"{BASE_URL}/api/config/public", timeout=30)
    assert r.status_code == 200
