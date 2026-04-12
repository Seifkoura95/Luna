"""
Luna Group VIP - UI Audit Regression Tests (Iteration 27)
Tests all APIs after design system token fixes to ensure nothing is broken.
Focus: Health, Auth, Payments (Gift Card, Wallet), Staff Portal (Member Search/Profile)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')

# Test credentials from test_credentials.md
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def user_auth_token(api_client):
    """Get authentication token for test user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"User authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, user_auth_token):
    """Session with user auth header"""
    api_client.headers.update({"Authorization": f"Bearer {user_auth_token}"})
    return api_client


@pytest.fixture(scope="module")
def admin_client(api_client, admin_auth_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_auth_token}"
    })
    return session


# ============ HEALTH CHECK ============

class TestHealthEndpoint:
    """Health endpoint tests - verify API is running"""
    
    def test_health_endpoint_returns_200(self, api_client):
        """GET /api/health should return 200"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


# ============ AUTH TESTS ============

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_with_valid_credentials(self, api_client):
        """POST /api/auth/login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Login successful for {TEST_USER_EMAIL}")
    
    def test_login_with_invalid_credentials(self, api_client):
        """POST /api/auth/login with invalid credentials should return 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid login correctly rejected")
    
    def test_get_me_authenticated(self, authenticated_client):
        """GET /api/auth/me should return current user"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert "email" in data
        assert "user_id" in data
        print(f"✓ Get me returned user: {data.get('email')}")


# ============ PAYMENT TESTS ============

class TestPaymentEndpoints:
    """Payment endpoint tests - Gift Cards, Wallet, Packages"""
    
    def test_get_packages(self, api_client):
        """GET /api/payments/packages should return available packages"""
        response = api_client.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200, f"Get packages failed: {response.text}"
        data = response.json()
        assert "packages" in data
        packages = data["packages"]
        assert len(packages) > 0, "No packages returned"
        
        # Verify gift card packages exist
        gift_cards = [p for p in packages if p.get("type") == "gift_card"]
        assert len(gift_cards) >= 4, f"Expected at least 4 gift cards, got {len(gift_cards)}"
        print(f"✓ Got {len(packages)} packages including {len(gift_cards)} gift cards")
    
    def test_wallet_balance_authenticated(self, authenticated_client):
        """GET /api/payments/wallet/balance should return wallet balance"""
        response = authenticated_client.get(f"{BASE_URL}/api/payments/wallet/balance")
        assert response.status_code == 200, f"Get wallet balance failed: {response.text}"
        data = response.json()
        assert "wallet_balance" in data
        print(f"✓ Wallet balance: ${data['wallet_balance']}")
    
    def test_wallet_balance_unauthenticated(self, api_client):
        """GET /api/payments/wallet/balance without auth should return 401"""
        # Create a new session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.get(f"{BASE_URL}/api/payments/wallet/balance")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Wallet balance correctly requires authentication")
    
    def test_gift_card_checkout_creates_session(self, authenticated_client):
        """POST /api/payments/gift-card/checkout should create Stripe session"""
        response = authenticated_client.post(f"{BASE_URL}/api/payments/gift-card/checkout", json={
            "amount": 25,
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Gift card checkout failed: {response.text}"
        data = response.json()
        assert "checkout_url" in data, "No checkout_url in response"
        assert "session_id" in data, "No session_id in response"
        assert "wallet_credit" in data, "No wallet_credit in response"
        assert data["wallet_credit"] == 27.50, f"Expected 27.50 wallet credit, got {data['wallet_credit']}"
        print(f"✓ Gift card checkout created: ${data.get('gift_card_amount', 25)} -> ${data['wallet_credit']} credit")
    
    def test_gift_card_checkout_minimum_amount(self, authenticated_client):
        """POST /api/payments/gift-card/checkout with amount < 10 should fail"""
        response = authenticated_client.post(f"{BASE_URL}/api/payments/gift-card/checkout", json={
            "amount": 5,
            "origin_url": BASE_URL
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Gift card minimum amount validation works")
    
    def test_send_gift_card_creates_session(self, authenticated_client):
        """POST /api/payments/gift-card/send should create gift card for friend"""
        response = authenticated_client.post(f"{BASE_URL}/api/payments/gift-card/send", json={
            "amount": 50,
            "origin_url": BASE_URL,
            "recipient_email": "friend@test.com",
            "sender_message": "Happy Birthday!"
        })
        assert response.status_code == 200, f"Send gift card failed: {response.text}"
        data = response.json()
        assert "checkout_url" in data, "No checkout_url in response"
        assert "gift_code" in data, "No gift_code in response"
        assert "share_url" in data, "No share_url in response"
        assert data["wallet_credit"] == 55.00, f"Expected 55.00 wallet credit, got {data['wallet_credit']}"
        print(f"✓ Send gift card created: code={data['gift_code']}, credit=${data['wallet_credit']}")


# ============ STAFF PORTAL TESTS ============

class TestStaffPortalEndpoints:
    """Staff Portal endpoint tests - Member Search, Profile"""
    
    def test_member_search_requires_auth(self, api_client):
        """GET /api/perks/member/search without auth should return 401"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.get(f"{BASE_URL}/api/perks/member/search?q=luna")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Member search correctly requires authentication")
    
    def test_member_search_with_admin(self, admin_client):
        """GET /api/perks/member/search with admin auth should return results"""
        response = admin_client.get(f"{BASE_URL}/api/perks/member/search?q=luna")
        assert response.status_code == 200, f"Member search failed: {response.text}"
        data = response.json()
        assert "members" in data, "No members in response"
        print(f"✓ Member search returned {len(data['members'])} results")
    
    def test_member_search_minimum_query(self, admin_client):
        """GET /api/perks/member/search with short query should return 400"""
        response = admin_client.get(f"{BASE_URL}/api/perks/member/search?q=a")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Member search minimum query validation works")
    
    def test_member_profile_with_admin(self, admin_client):
        """GET /api/perks/member/{user_id}/profile should return member details"""
        # First search for a member
        search_response = admin_client.get(f"{BASE_URL}/api/perks/member/search?q=luna")
        if search_response.status_code != 200 or not search_response.json().get("members"):
            pytest.skip("No members found to test profile")
        
        member = search_response.json()["members"][0]
        user_id = member["user_id"]
        
        response = admin_client.get(f"{BASE_URL}/api/perks/member/{user_id}/profile")
        assert response.status_code == 200, f"Member profile failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "tier" in data
        assert "benefits" in data
        assert "today" in data
        print(f"✓ Member profile returned: {data.get('name')} ({data.get('tier')})")


# ============ PERKS STATUS TEST ============

class TestPerksStatus:
    """Perks status endpoint test"""
    
    def test_perks_status_authenticated(self, authenticated_client):
        """GET /api/perks/status should return user's perk status"""
        response = authenticated_client.get(f"{BASE_URL}/api/perks/status")
        assert response.status_code == 200, f"Perks status failed: {response.text}"
        data = response.json()
        assert "tier" in data
        assert "perks" in data
        print(f"✓ Perks status returned for tier: {data['tier'].get('name')}")


# ============ VENUES TEST ============

class TestVenuesEndpoint:
    """Venues endpoint test"""
    
    def test_get_venues(self, api_client):
        """GET /api/venues should return list of venues"""
        response = api_client.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200, f"Get venues failed: {response.text}"
        data = response.json()
        # Response could be a list or dict with venues key
        venues = data if isinstance(data, list) else data.get("venues", [])
        assert len(venues) > 0, "No venues returned"
        print(f"✓ Got {len(venues)} venues")


# ============ EVENTS TEST ============

class TestEventsEndpoint:
    """Events endpoint test"""
    
    def test_get_events(self, api_client):
        """GET /api/events should return list of events"""
        response = api_client.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200, f"Get events failed: {response.text}"
        data = response.json()
        # Response could be a list or dict with events key
        events = data if isinstance(data, list) else data.get("events", [])
        print(f"✓ Got {len(events)} events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
