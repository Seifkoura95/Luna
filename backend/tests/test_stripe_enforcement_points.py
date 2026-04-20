"""
Stripe enforcement + 10pts/$1 regression tests.

Covers:
- Paid subscription => Stripe checkout URL (NEW user)
- Free bronze => instant activation
- DEV_MODE bypass for luna@test.com (subscribe/table deposit/bottle preorder)
- Table deposit => Stripe checkout URL (NEW user)
- Bottle preorder => Stripe checkout URL (NEW user)
- Loyalty award 10pts/$1
- Leaderboard endpoints
- Regression endpoints
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://birthday-rewards-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEV_EMAIL = "luna@test.com"
DEV_PASSWORD = "test123"


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def dev_token(s):
    r = s.post(f"{API}/auth/login", json={"email": DEV_EMAIL, "password": DEV_PASSWORD})
    assert r.status_code == 200, f"dev login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def new_user(s):
    """Register a fresh user for Stripe-enforced tests."""
    uniq = uuid.uuid4().hex[:8]
    email = f"stripetest_{uniq}@lunatest.com"
    payload = {
        "email": email,
        "password": "Test123!",
        "name": "Stripe Tester",
        "phone": f"+6140000{uniq[:4]}",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    # Some backends may omit phone/name - try minimal
    if r.status_code >= 400:
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Test123!", "name": "Stripe Tester"
        })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        # try login
        lr = s.post(f"{API}/auth/login", json={"email": email, "password": "Test123!"})
        assert lr.status_code == 200, lr.text
        token = lr.json().get("token") or lr.json().get("access_token")
    assert token
    return {"email": email, "token": token}


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
            "origin": "https://birthday-rewards-1.preview.emergentagent.com"}


# ── P0: Paid subscription for NEW user must require Stripe ──────────────────

class TestPaidSubscriptionStripe:

    def test_free_bronze_instant(self, s, new_user):
        r = s.post(f"{API}/subscriptions/subscribe", json={"tier_id": "bronze"},
                   headers=_h(new_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        # free tier => no checkout_url, instant
        assert not data.get("requires_payment")
        assert "checkout_url" not in data or data.get("checkout_url") in (None, "")
        assert data.get("subscription", {}).get("status") == "active"

    def test_silver_requires_stripe(self, s, new_user):
        r = s.post(f"{API}/subscriptions/subscribe", json={"tier_id": "silver"},
                   headers=_h(new_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, data
        assert data.get("requires_payment") is True, f"Silver should require Stripe payment: {data}"
        assert isinstance(data.get("checkout_url"), str)
        assert data["checkout_url"].startswith("https://checkout.stripe.com/") or \
               "stripe.com" in data["checkout_url"], f"Unexpected checkout_url: {data['checkout_url']}"
        assert data.get("session_id", "").startswith("cs_")

    def test_gold_requires_stripe(self, s, new_user):
        r = s.post(f"{API}/subscriptions/subscribe", json={"tier_id": "gold"},
                   headers=_h(new_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("requires_payment") is True
        assert "stripe.com" in (data.get("checkout_url") or "")
        assert (data.get("session_id") or "").startswith("cs_")


# ── P0: Table deposit for NEW user must require Stripe ──────────────────────

class TestTableDepositStripe:

    def test_table_deposit_requires_stripe(self, s, new_user):
        # Create a booking first
        venues_r = s.get(f"{API}/venues/eclipse/tables", headers=_h(new_user["token"]))
        assert venues_r.status_code == 200, venues_r.text
        tables = venues_r.json().get("tables") or venues_r.json().get("data") or []
        assert tables, f"No tables: {venues_r.json()}"
        tid = tables[0]["id"]

        booking_r = s.post(f"{API}/bookings/table", json={
            "venue_id": "eclipse",
            "table_id": tid,
            "date": "2026-06-15",
            "party_size": 2,
            "contact_phone": "+61400000000",
        }, headers=_h(new_user["token"]))
        # 409 means already booked for same date by another run — retry future date
        if booking_r.status_code == 409:
            booking_r = s.post(f"{API}/bookings/table", json={
                "venue_id": "eclipse", "table_id": tid,
                "date": f"2027-{(int(time.time())%12)+1:02d}-{(int(time.time())%28)+1:02d}",
                "party_size": 2,
            }, headers=_h(new_user["token"]))
        assert booking_r.status_code == 200, booking_r.text
        booking_id = booking_r.json()["booking"]["booking_id"]

        dep_r = s.post(f"{API}/bookings/table/{booking_id}/deposit", headers=_h(new_user["token"]))
        assert dep_r.status_code == 200, dep_r.text
        data = dep_r.json()
        assert data.get("success") is True
        # MUST NOT be dev_mode, no pi_demo_xxx
        assert not data.get("dev_mode"), f"NEW user should not get dev_mode: {data}"
        pi = data.get("payment_intent_id", "")
        assert not pi.startswith("pi_demo"), f"Got fake payment intent: {pi}"
        assert isinstance(data.get("checkout_url"), str)
        assert "stripe.com" in data["checkout_url"]
        assert (data.get("session_id") or "").startswith("cs_")


# ── P0: Bottle preorder for NEW user must require Stripe ────────────────────

class TestBottlePreorderStripe:

    def test_bottle_preorder_requires_stripe(self, s, new_user):
        # Get menu to find a real package_id
        menu_r = s.get(f"{API}/bookings/bottle-menu/eclipse", headers=_h(new_user["token"]))
        assert menu_r.status_code == 200, menu_r.text
        menu = menu_r.json().get("menu") or []
        assert menu, menu_r.json()
        pkg_id = menu[0]["id"]

        r = s.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse",
            "date": "2026-06-15",
            "items": [{"package_id": pkg_id, "quantity": 1}],
        }, headers=_h(new_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert not data.get("dev_mode"), f"NEW user must not get dev_mode: {data}"
        # MUST NOT award points up-front for real users
        assert not data.get("points_earned"), f"points should not be awarded pre-payment: {data}"
        assert isinstance(data.get("checkout_url"), str)
        assert "stripe.com" in data["checkout_url"]
        assert (data.get("session_id") or "").startswith("cs_")


# ── DEV_MODE bypass for luna@test.com ────────────────────────────────────────

class TestDevModeBypass:

    def test_dev_subscribe_silver_instant(self, s, dev_token):
        r = s.post(f"{API}/subscriptions/subscribe", json={"tier_id": "silver"},
                   headers=_h(dev_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert not data.get("requires_payment"), f"dev user should be instant: {data}"
        assert data.get("dev_mode") is True
        # 10pts/$1 * 39.99 = 399 base (plus multiplier)
        assert data.get("points_earned", 0) >= 399, f"expected >=399 pts for $39.99 at 10/$, got {data}"

    def test_dev_table_deposit_instant(self, s, dev_token):
        # Get a table
        venues_r = s.get(f"{API}/venues/eclipse/tables", headers=_h(dev_token))
        assert venues_r.status_code == 200
        tables = venues_r.json().get("tables") or []
        tid = tables[0]["id"]
        # Use unique future date to avoid 409
        date = f"2028-{(int(time.time())%12)+1:02d}-{(int(time.time())%28)+1:02d}"
        booking_r = s.post(f"{API}/bookings/table", json={
            "venue_id": "eclipse", "table_id": tid,
            "date": date, "party_size": 2,
        }, headers=_h(dev_token))
        if booking_r.status_code == 409:
            pytest.skip("table already booked for generated date")
        assert booking_r.status_code == 200, booking_r.text
        booking_id = booking_r.json()["booking"]["booking_id"]
        deposit_amt = booking_r.json()["booking"]["deposit_amount"]

        dep_r = s.post(f"{API}/bookings/table/{booking_id}/deposit", headers=_h(dev_token))
        assert dep_r.status_code == 200, dep_r.text
        data = dep_r.json()
        assert data.get("dev_mode") is True
        assert data.get("success") is True
        expected_pts = int(deposit_amt * 10)
        assert data.get("points_earned") == expected_pts, f"expected {expected_pts} pts got {data}"

    def test_dev_bottle_preorder_instant(self, s, dev_token):
        menu_r = s.get(f"{API}/bookings/bottle-menu/eclipse", headers=_h(dev_token))
        pkg_id = menu_r.json()["menu"][0]["id"]
        price = menu_r.json()["menu"][0]["price"]
        r = s.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse", "date": "2026-07-01",
            "items": [{"package_id": pkg_id, "quantity": 1}],
        }, headers=_h(dev_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("dev_mode") is True
        assert data.get("points_earned") == int(price * 10), \
            f"expected {int(price*10)} got {data.get('points_earned')}"


# ── Points rate: 10 pts per $1 via loyalty award ─────────────────────────────

class TestPointsRate:

    def test_loyalty_award_10_per_dollar(self, s, new_user):
        # bronze (default) user; award for $10 -> expect 100 pts
        r = s.post(f"{API}/loyalty/points/award",
                   json={"amount_spent": 10, "venue_id": "eclipse", "description": "test"},
                   headers=_h(new_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        # Response shape varies; look for total or base
        earned = data.get("points_earned") or data.get("total_points") or \
                 data.get("base_points") or data.get("points")
        assert earned is not None, f"no points field in {data}"
        assert int(earned) >= 100, f"expected >=100 pts for $10 at 10/$1, got {earned}: {data}"


# ── Leaderboard ──────────────────────────────────────────────────────────────

class TestLeaderboard:

    def test_leaderboard_ok(self, s, dev_token):
        r = s.get(f"{API}/leaderboard", headers=_h(dev_token))
        assert r.status_code == 200, r.text
        data = r.json()
        leaders = data.get("leaders") or data.get("leaderboard") or []
        assert isinstance(leaders, list)
        assert len(leaders) >= 1, f"empty leaderboard: {data}"

    def test_leaderboard_strategies(self, s, dev_token):
        r = s.get(f"{API}/leaderboard/strategies", headers=_h(dev_token))
        assert r.status_code == 200, r.text


# ── Regression endpoints ─────────────────────────────────────────────────────

class TestRegression:

    def test_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEV_EMAIL, "password": DEV_PASSWORD})
        assert r.status_code == 200

    def test_venues_list(self, s, dev_token):
        r = s.get(f"{API}/venues", headers=_h(dev_token))
        assert r.status_code == 200

    def test_eclipse_tables(self, s, dev_token):
        r = s.get(f"{API}/venues/eclipse/tables", headers=_h(dev_token))
        assert r.status_code == 200
        assert (r.json().get("tables") or [])

    def test_missions(self, s, dev_token):
        r = s.get(f"{API}/missions", headers=_h(dev_token))
        assert r.status_code == 200

    def test_rewards(self, s, dev_token):
        r = s.get(f"{API}/rewards", headers=_h(dev_token))
        assert r.status_code == 200

    def test_user_stats(self, s, dev_token):
        r = s.get(f"{API}/users/stats", headers=_h(dev_token))
        assert r.status_code == 200

    def test_points_balance(self, s, dev_token):
        r = s.get(f"{API}/points/balance", headers=_h(dev_token))
        assert r.status_code == 200
