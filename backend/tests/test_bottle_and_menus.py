"""
Tests for iteration 33:
- VIP Table Booking endpoints removed
- Eclipse 48-item bottle menu
- Bottle service Eclipse-only + deposit formula max($50, 10%)
- JuJu's & Night Market view-only menus
- Regression on existing endpoints
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "https://luna-mobile-stage.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def luna_token(session):
    r = session.post(f"{API}/auth/login", json={"email": "luna@test.com", "password": "test123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def fresh_user_token(session):
    email = f"TEST_stripe_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "Stripe Tester", "date_of_birth": "1995-05-15"
    })
    if r.status_code not in (200, 201):
        pytest.skip(f"Register failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token
    return token


# ── VIP Table Booking endpoints removed ─────────────────────────────
class TestVIPTableRemoved:
    def test_post_bookings_table(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/table", json={"venue_id": "eclipse"}, headers=h)
        # 404 (route does not exist) or 405 are acceptable — endpoint removed
        assert r.status_code in (404, 405), f"Expected 404/405, got {r.status_code}"

    def test_post_table_deposit(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/table/abc/deposit", json={}, headers=h)
        assert r.status_code in (404, 405)

    def test_post_table_confirm(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/table/abc/confirm", json={}, headers=h)
        assert r.status_code in (404, 405)

    def test_get_my_tables(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/bookings/my-tables", headers=h)
        assert r.status_code in (404, 405)


# ── Eclipse bottle menu ─────────────────────────────────────────────
class TestEclipseBottleMenu:
    def test_menu_returns_48_items(self, session):
        r = session.get(f"{API}/bookings/bottle-menu/eclipse")
        assert r.status_code == 200
        data = r.json()
        assert data["venue_id"] == "eclipse"
        menu = data["menu"]
        assert len(menu) == 48, f"Expected 48 items, got {len(menu)}"

        required_cats = {"Vodka", "Gin", "Tequila", "Scotch", "Rum", "Bourbon", "Cognac", "Champagne"}
        cats = set(data["categories"].keys())
        missing = required_cats - cats
        assert not missing, f"Missing categories: {missing}. Got: {cats}"
        # Liquor/Liqueur check — either naming allowed
        assert ("Liqueur" in cats) or ("Liquor" in cats), f"Missing Liqueur/Liquor category: {cats}"

    def test_key_item_prices(self, session):
        r = session.get(f"{API}/bookings/bottle-menu/eclipse")
        menu_by_id = {i["id"]: i for i in r.json()["menu"]}
        expected = {
            "ecl_belvedere_700": ("Belvedere", 400),
            "ecl_moet": ("Moët & Chandon", 200),
            "ecl_dom": ("Dom Pérignon", 800),
            "ecl_clase_azul": ("Clase Azul Reposado", 1500),
            "ecl_dj_1942": ("Don Julio 1942", 1000),
        }
        for pid, (name, price) in expected.items():
            assert pid in menu_by_id, f"Missing item {pid}"
            item = menu_by_id[pid]
            assert item["price"] == price, f"{pid} expected ${price}, got ${item['price']}"


# ── Bottle service only at Eclipse ──────────────────────────────────
class TestBottleServiceEclipseOnly:
    @pytest.mark.parametrize("venue_id", ["juju", "night_market", "sky_bar"])
    def test_non_eclipse_rejected(self, session, luna_token, venue_id):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": venue_id, "date": "2026-06-01", "items": [{"package_id": "x", "quantity": 1}]
        }, headers=h)
        # Either 400 (valid venue, blocked by rule) or 404 (invalid venue)
        if venue_id in ("juju", "night_market"):
            assert r.status_code == 400, f"{venue_id}: expected 400, got {r.status_code} {r.text}"
            assert "eclipse" in r.text.lower()
        else:
            assert r.status_code in (400, 404)


# ── Deposit formula ─────────────────────────────────────────────────
class TestDepositFormula:
    def test_small_order_flat_50(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        # Moet $200 — 10% = $20, so deposit should be $50 flat
        r = session.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse", "date": "2026-06-10",
            "items": [{"package_id": "ecl_moet", "quantity": 1}]
        }, headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["deposit_amount"] == 50, f"Expected $50 flat, got ${data['deposit_amount']}"
        assert data.get("dev_mode") is True  # luna is dev

    def test_large_order_ten_percent(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        # Dom $800 x 2 = $1600 — 10% = $160
        r = session.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse", "date": "2026-06-11",
            "items": [{"package_id": "ecl_dom", "quantity": 2}]
        }, headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["deposit_amount"] == 160, f"Expected $160 (10%), got ${data['deposit_amount']}"
        assert data["balance_due"] == 1440


# ── DEV_MODE points award ───────────────────────────────────────────
class TestDevModePoints:
    def test_luna_awards_points(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        # Belvedere $400 → 10 pts/$1 = 4000 points
        r = session.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse", "date": "2026-06-12",
            "items": [{"package_id": "ecl_belvedere_700", "quantity": 1}]
        }, headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("dev_mode") is True
        assert data.get("points_earned") == 4000, f"Expected 4000 pts, got {data.get('points_earned')}"


# ── Real Stripe for non-dev user ────────────────────────────────────
class TestStripeForRealUser:
    def test_fresh_user_gets_checkout_url(self, session, fresh_user_token):
        h = {"Authorization": f"Bearer {fresh_user_token}"}
        r = session.post(f"{API}/bookings/bottle-preorder", json={
            "venue_id": "eclipse", "date": "2026-06-15",
            "items": [{"package_id": "ecl_dom", "quantity": 1}]  # $800 → deposit $80
        }, headers=h)
        assert r.status_code == 200, f"Stripe checkout failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert "checkout_url" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/"), f"Invalid checkout_url: {data.get('checkout_url')}"
        assert "session_id" in data
        assert data["deposit_amount"] == 80
        assert data["balance_due"] == 720
        # No points awarded on this step for real user
        assert "points_earned" not in data or data.get("points_earned") in (None, 0)
        assert data.get("dev_mode") is not True


# ── Venue menus (JuJu's / Night Market) ─────────────────────────────
class TestVenueMenus:
    def test_juju_menu(self, session):
        r = session.get(f"{API}/venues/juju/menu")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["venue_name"] == "JuJu's"
        food_cats = set(data["food"].keys())
        for c in ["Lighter Plates", "Signature Wagyu Range", "Mains", "Sides", "Desserts"]:
            assert c in food_cats, f"JuJu missing food cat: {c}"
        drink_cats = set(data["drinks"].keys())
        for c in ["Signature Cocktails", "Classics", "Wine By Glass", "Beer", "Spirits"]:
            assert c in drink_cats, f"JuJu missing drink cat: {c}"

    def test_night_market_menu(self, session):
        r = session.get(f"{API}/venues/night_market/menu")
        assert r.status_code == 200, r.text
        data = r.json()
        food_cats = set(data["food"].keys())
        for c in ["Raw", "Snacks", "Skewers", "Sandos", "Share Plates", "Sides", "Sweet"]:
            assert c in food_cats, f"NM missing food cat: {c}"
        drink_cats = set(data["drinks"].keys())
        for c in ["Cocktails", "Sake", "Wines", "Beers", "Highballs"]:
            assert c in drink_cats, f"NM missing drink cat: {c}"

    def test_invalid_venue_menu(self, session):
        r = session.get(f"{API}/venues/xyz/menu")
        assert r.status_code == 404


# ── Regression: existing endpoints still work ───────────────────────
class TestRegression:
    def test_venues_list(self, session):
        r = session.get(f"{API}/venues")
        assert r.status_code == 200

    def test_venue_detail(self, session):
        r = session.get(f"{API}/venues/eclipse")
        assert r.status_code == 200

    def test_subscriptions_my(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/subscriptions/my", headers=h)
        assert r.status_code == 200

    def test_points_balance(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/points/balance", headers=h)
        assert r.status_code == 200

    def test_leaderboard(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/leaderboard", headers=h)
        assert r.status_code == 200

    def test_rewards(self, session):
        r = session.get(f"{API}/rewards")
        assert r.status_code == 200

    def test_missions(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/missions", headers=h)
        assert r.status_code == 200

    def test_my_reservations(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.get(f"{API}/bookings/my-reservations", headers=h)
        assert r.status_code == 200

    def test_reserve(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/reserve", json={
            "venue_id": "juju", "date": "2026-07-01", "time": "19:00", "party_size": 2
        }, headers=h)
        assert r.status_code == 200, r.text

    def test_guestlist(self, session, luna_token):
        h = {"Authorization": f"Bearer {luna_token}"}
        r = session.post(f"{API}/bookings/guestlist", json={
            "venue_id": "eclipse", "date": "2026-07-01", "party_size": 2
        }, headers=h)
        assert r.status_code == 200, r.text
