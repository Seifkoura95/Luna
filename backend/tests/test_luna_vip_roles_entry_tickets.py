"""
Luna Group VIP role system + admin user CRUD + points gifting + free-entry ticket
gifting + staff QR validation + earn-guard regression.

Iteration 35 — incremental addition on top of iteration 34 (Lovable Hub CRUD).
External preview URL: https://luna-mobile-stage.preview.emergentagent.com
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://luna-mobile-stage.preview.emergentagent.com",
).rstrip("/")

HUB_KEY = "luna_hub_live_682fbaaa19a6a4594f58618b803531ee6fad8016"
HUB_HEADERS = {"X-Luna-Hub-Key": HUB_KEY, "Content-Type": "application/json"}

ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASS = "Trent69!"
LUNA_EMAIL = "luna@test.com"
LUNA_PASS = "test123"


# --------------------------- shared session state ---------------------------
state = {
    "admin_token": None,
    "admin_user_id": None,
    "luna_token": None,
    "luna_user_id": None,
    "userB_token": None,
    "userB_user_id": None,
    "userB_email": None,
    "created_tickets": [],
    "granted_tx_ids": [],
}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data.get("user", {}).get("user_id") or data.get("user_id")


@pytest.fixture(scope="module", autouse=True)
def session():
    # Login admin & luna
    state["admin_token"], state["admin_user_id"] = _login(ADMIN_EMAIL, ADMIN_PASS)
    state["luna_token"], state["luna_user_id"] = _login(LUNA_EMAIL, LUNA_PASS)

    # Make sure luna is role=user before we start
    requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS, json={"role": "user"}, timeout=30,
    )

    # Register a throwaway user B for access-control test
    email_b = f"TEST_userb_{uuid.uuid4().hex[:8]}@test.com"
    reg = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email_b,
            "password": "pwd12345",
            "name": "TEST UserB",
            "phone": f"04{uuid.uuid4().hex[:8]}",
            "date_of_birth": "1995-01-01",
        },
        timeout=30,
    )
    if reg.status_code in (200, 201):
        body = reg.json()
        state["userB_token"] = body.get("token")
        state["userB_user_id"] = (body.get("user") or {}).get("user_id") or body.get("user_id")
        state["userB_email"] = email_b

    yield

    # --------- CLEANUP ---------
    # Reset luna to role=user
    try:
        requests.put(
            f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
            headers=HUB_HEADERS, json={"role": "user"}, timeout=30,
        )
    except Exception:
        pass
    # Revoke any non-used tickets we created
    for tid in state["created_tickets"]:
        try:
            requests.delete(f"{BASE_URL}/api/admin/entry-tickets/{tid}", headers=HUB_HEADERS, timeout=15)
        except Exception:
            pass


# =======================  ADMIN USER CRUD  =======================

def test_list_users_search_by_email():
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=HUB_HEADERS, params={"q": LUNA_EMAIL}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "users" in data and isinstance(data["users"], list)
    assert data["total"] >= 1
    emails = [u.get("email") for u in data["users"]]
    assert LUNA_EMAIL in emails
    # password stripped
    for u in data["users"]:
        assert "password_hash" not in u
        assert "password" not in u


def test_list_users_filter_role_admin():
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=HUB_HEADERS, params={"role": "admin"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    for u in data["users"]:
        assert u.get("role") == "admin"


def test_get_single_user():
    r = requests.get(f"{BASE_URL}/api/admin/users/{state['luna_user_id']}", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200
    u = r.json()["user"]
    assert u["user_id"] == state["luna_user_id"]
    assert "password_hash" not in u and "password" not in u


def test_update_user_name_tier():
    r = requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS,
        json={"name": "Luna Test", "tier": "gold"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["name"] == "Luna Test"
    assert u.get("tier") == "gold"


def test_update_user_invalid_role_400():
    r = requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS,
        json={"role": "superuser"},
        timeout=30,
    )
    assert r.status_code == 400, r.text


def test_update_user_nonexistent_404():
    r = requests.put(
        f"{BASE_URL}/api/admin/users/user_does_not_exist_xyz",
        headers=HUB_HEADERS,
        json={"name": "Nope"},
        timeout=30,
    )
    assert r.status_code == 404


# ======================  GRANT POINTS  ======================

def test_grant_points_positive_and_transaction_record():
    # Ensure we are role=user at this point
    before = requests.get(f"{BASE_URL}/api/admin/users/{state['luna_user_id']}", headers=HUB_HEADERS).json()["user"]
    bal_before = before.get("points_balance", 0)

    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS, json={"amount": 500, "reason": "TEST grant"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["success"] is True
    assert data["new_balance"] == bal_before + 500
    tx = data["transaction"]
    assert tx["source"] == "admin_grant"
    assert tx["amount"] == 500
    state["granted_tx_ids"].append(tx["id"])

    # Verify via points-transactions endpoint
    tr = requests.get(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/points-transactions",
        headers=HUB_HEADERS, timeout=30,
    )
    assert tr.status_code == 200
    txs = tr.json()["transactions"]
    assert any(t.get("id") == tx["id"] and t.get("source") == "admin_grant" for t in txs)


def test_grant_points_negative_deduct():
    before = requests.get(f"{BASE_URL}/api/admin/users/{state['luna_user_id']}", headers=HUB_HEADERS).json()["user"]
    bal_before = before.get("points_balance", 0)
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS, json={"amount": -100, "reason": "TEST deduct"}, timeout=30,
    )
    assert r.status_code == 200
    assert r.json()["new_balance"] == bal_before - 100


def test_grant_points_zero_amount_400():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS, json={"amount": 0, "reason": "TEST"}, timeout=30,
    )
    assert r.status_code == 400


def test_grant_points_to_artist_bypasses_earn_guard():
    # Flip luna to artist
    r = requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS, json={"role": "artist"}, timeout=30,
    )
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "artist"

    before = requests.get(f"{BASE_URL}/api/admin/users/{state['luna_user_id']}", headers=HUB_HEADERS).json()["user"]
    bal_before = before.get("points_balance", 0)

    g = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/grant-points",
        headers=HUB_HEADERS, json={"amount": 250, "reason": "TEST artist grant"}, timeout=30,
    )
    assert g.status_code == 200, g.text
    assert g.json()["new_balance"] == bal_before + 250


# ======================  EARN GUARD  ======================

def test_earn_guard_artist_cannot_claim_mission():
    # Luna is currently artist (from previous test). Find a mission and try to claim.
    # We need mission_progress to be 'completed' for a real 403. Since we can't fabricate
    # progress easily, we still attempt claim — expect either 403 (guard) or 400 (not completed).
    # The important check is: it should NEVER be 200 for an artist.
    ml = requests.get(f"{BASE_URL}/api/missions", headers={"Authorization": f"Bearer {state['luna_token']}"}, timeout=30)
    if ml.status_code != 200:
        pytest.skip("missions list unavailable")
    missions = ml.json() if isinstance(ml.json(), list) else ml.json().get("missions", [])
    if not missions:
        pytest.skip("no missions in system to test")
    mid = missions[0].get("id")
    r = requests.post(
        f"{BASE_URL}/api/missions/{mid}/claim",
        headers={"Authorization": f"Bearer {state['luna_token']}"},
        timeout=30,
    )
    # Must not succeed
    assert r.status_code != 200, f"artist should not claim successfully, got {r.status_code}"
    # If 403, message should mention earn-guard
    if r.status_code == 403:
        assert "cannot earn" in r.text.lower() or "account type" in r.text.lower()


def test_earn_guard_regression_regular_user_not_blocked():
    # Reset luna back to 'user'
    rr = requests.put(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}",
        headers=HUB_HEADERS, json={"role": "user"}, timeout=30,
    )
    assert rr.status_code == 200
    ml = requests.get(f"{BASE_URL}/api/missions", headers={"Authorization": f"Bearer {state['luna_token']}"}, timeout=30)
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
    # Should NOT be 403 earn-guard. May be 400 "not completed" or 200 or 400 "already claimed".
    assert r.status_code != 403, f"regular user blocked by earn-guard: {r.text}"


# ======================  GIFT ENTRY TICKETS  ======================

def test_gift_entry_immediate():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS, json={"venue_id": "eclipse", "note": "TEST immediate"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    t = r.json()["ticket"]
    assert t["status"] == "active"
    assert t["qr_code"].startswith("LUNA-ENT-")
    assert t["venue_id"] == "eclipse"
    vf = datetime.fromisoformat(t["valid_from"].replace("Z", "+00:00"))
    vu = datetime.fromisoformat(t["valid_until"].replace("Z", "+00:00"))
    # valid_until - valid_from ≈ 24h
    diff = (vu - vf).total_seconds()
    assert 86000 < diff < 86800  # ~24h
    state["created_tickets"].append(t["id"])
    state["immediate_ticket"] = t


def test_gift_entry_scheduled_brisbane_window():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS,
        json={"venue_id": "eclipse", "scheduled_for": "2026-06-15", "note": "TEST scheduled"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    t = r.json()["ticket"]
    state["created_tickets"].append(t["id"])
    state["scheduled_ticket"] = t
    # Expect valid_from = 2026-06-14T14:00:00+00:00, valid_until = 2026-06-15T14:00:00+00:00
    vf = datetime.fromisoformat(t["valid_from"].replace("Z", "+00:00"))
    vu = datetime.fromisoformat(t["valid_until"].replace("Z", "+00:00"))
    assert vf == datetime(2026, 6, 14, 14, 0, 0, tzinfo=timezone.utc), f"valid_from={vf}"
    assert vu == datetime(2026, 6, 15, 14, 0, 0, tzinfo=timezone.utc), f"valid_until={vu}"


def test_gift_entry_invalid_date_400():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS, json={"venue_id": "eclipse", "scheduled_for": "15/06/2026"}, timeout=30,
    )
    assert r.status_code == 400


def test_gift_entry_invalid_date_foo_400():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS, json={"venue_id": "eclipse", "scheduled_for": "foo"}, timeout=30,
    )
    assert r.status_code == 400


def test_gift_entry_bad_venue_404():
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{state['luna_user_id']}/gift-entry",
        headers=HUB_HEADERS, json={"venue_id": "nonexistent_venue_xyz"}, timeout=30,
    )
    assert r.status_code == 404


# ======================  USER-FACING: /entry-tickets/my  ======================

def test_user_list_own_tickets():
    r = requests.get(
        f"{BASE_URL}/api/entry-tickets/my",
        headers={"Authorization": f"Bearer {state['luna_token']}"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] >= 2
    # Each ticket has live_status
    for t in data["tickets"]:
        assert "live_status" in t
        assert t["live_status"] in ("active", "scheduled", "used", "expired", "revoked")


def test_user_list_filter_active():
    r = requests.get(
        f"{BASE_URL}/api/entry-tickets/my",
        headers={"Authorization": f"Bearer {state['luna_token']}"},
        params={"status": "active"}, timeout=30,
    )
    assert r.status_code == 200
    for t in r.json()["tickets"]:
        assert t["live_status"] == "active"


def test_user_cannot_access_other_users_ticket():
    if not state["userB_token"]:
        pytest.skip("user B not registered")
    ticket_id = state["immediate_ticket"]["id"]
    r = requests.get(
        f"{BASE_URL}/api/entry-tickets/{ticket_id}",
        headers={"Authorization": f"Bearer {state['userB_token']}"}, timeout=30,
    )
    assert r.status_code == 403


# ======================  STAFF QR VALIDATION  ======================

def test_validate_qr_non_staff_403():
    qr = state["immediate_ticket"]["qr_code"]
    r = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['luna_token']}"},
        json={"qr_code": qr, "venue_id": "eclipse"}, timeout=30,
    )
    assert r.status_code == 403


def test_validate_qr_invalid_code():
    r = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": "LUNA-ENT-BADCODE-XXXXXXXX", "venue_id": "eclipse"}, timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["reason"] == "invalid_qr"


def test_validate_qr_wrong_venue():
    qr = state["immediate_ticket"]["qr_code"]
    r = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": qr, "venue_id": "after_dark"}, timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["reason"] == "wrong_venue"


def test_validate_qr_not_yet_active():
    qr = state["scheduled_ticket"]["qr_code"]
    r = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": qr, "venue_id": "eclipse"}, timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["reason"] == "not_yet_active"


def test_validate_qr_success_then_already_used():
    qr = state["immediate_ticket"]["qr_code"]
    r1 = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": qr, "venue_id": "eclipse"}, timeout=30,
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["success"] is True

    # Second scan
    r2 = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": qr, "venue_id": "eclipse"}, timeout=30,
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["success"] is False
    assert body["reason"] == "already_used"


# ======================  ADMIN ENTRY-TICKET LIST + REVOKE  ======================

def test_admin_list_entry_tickets_filter_user():
    r = requests.get(
        f"{BASE_URL}/api/admin/entry-tickets",
        headers=HUB_HEADERS, params={"user_id": state["luna_user_id"]}, timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 2
    for t in data["tickets"]:
        assert t["user_id"] == state["luna_user_id"]


def test_admin_list_entry_tickets_filter_venue():
    r = requests.get(
        f"{BASE_URL}/api/admin/entry-tickets",
        headers=HUB_HEADERS, params={"venue_id": "eclipse"}, timeout=30,
    )
    assert r.status_code == 200
    for t in r.json()["tickets"]:
        assert t["venue_id"] == "eclipse"


def test_admin_list_entry_tickets_filter_status():
    r = requests.get(
        f"{BASE_URL}/api/admin/entry-tickets",
        headers=HUB_HEADERS, params={"status": "used"}, timeout=30,
    )
    assert r.status_code == 200
    for t in r.json()["tickets"]:
        assert t["status"] == "used"


def test_revoke_unused_ticket_then_validate():
    # The scheduled ticket is unused — revoke it
    tid = state["scheduled_ticket"]["id"]
    r = requests.delete(f"{BASE_URL}/api/admin/entry-tickets/{tid}", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    # Validate → should say revoked
    v = requests.post(
        f"{BASE_URL}/api/entry-tickets/validate-qr",
        headers={"Authorization": f"Bearer {state['admin_token']}"},
        json={"qr_code": state["scheduled_ticket"]["qr_code"], "venue_id": "eclipse"}, timeout=30,
    )
    assert v.status_code == 200
    assert v.json()["reason"] == "revoked"


def test_revoke_used_ticket_400():
    tid = state["immediate_ticket"]["id"]  # this was consumed earlier
    r = requests.delete(f"{BASE_URL}/api/admin/entry-tickets/{tid}", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 400


# ======================  REGRESSION — previous CRUD still works  ======================

def test_regression_public_config():
    r = requests.get(f"{BASE_URL}/api/config/public", timeout=30)
    assert r.status_code == 200
    assert "app_config" in r.json() or "config" in r.json() or isinstance(r.json(), dict)


def test_regression_admin_milestones_list():
    r = requests.get(f"{BASE_URL}/api/admin/milestones", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("total", 0) >= 1


def test_regression_admin_bottles_list():
    r = requests.get(f"{BASE_URL}/api/admin/bottles", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200
    assert r.json().get("total", 0) >= 10


def test_regression_admin_venues_list():
    r = requests.get(f"{BASE_URL}/api/admin/venues", headers=HUB_HEADERS, timeout=30)
    assert r.status_code == 200


def test_regression_authenticated_missions_list():
    # /api/missions requires auth (returns user's mission progress)
    r = requests.get(
        f"{BASE_URL}/api/missions",
        headers={"Authorization": f"Bearer {state['luna_token']}"}, timeout=30,
    )
    assert r.status_code == 200
