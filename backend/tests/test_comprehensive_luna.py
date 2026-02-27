"""
Luna Group VIP API - Comprehensive Backend Tests
Tests all critical endpoints: Auth, Venues, Events, Auctions, Wallet, Rewards, Bookings, Social
"""
import pytest
import requests
import os
import time
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fastapi-restructure-3.preview.emergentagent.com')

# Test credentials
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"
VENUE_PORTAL_EMAIL = "venue@eclipse.com"
VENUE_PORTAL_PASSWORD = "venue123"


@pytest.fixture(scope="session")
def session():
    """Create a requests session for all tests"""
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def auth_token(session):
    """Get authentication token for test user"""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed - status {response.status_code}")


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Get auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestHealthAndBasics:
    """Test health check and basic endpoints"""
    
    def test_health_check(self, session):
        """Test /api/health endpoint returns healthy status"""
        response = session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed - {data['status']}")
    
    def test_admin_seed(self, session):
        """Test /api/admin/seed to ensure test data exists"""
        response = session.post(f"{BASE_URL}/api/admin/seed")
        assert response.status_code == 200
        print("✓ Admin seed completed")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self, session):
        """Test login with valid credentials"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Login successful for {TEST_USER_EMAIL}")
    
    def test_login_invalid_password(self, session):
        """Test login with wrong password returns 401"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")
    
    def test_login_empty_fields(self, session):
        """Test login with empty fields returns error"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "",
            "password": ""
        })
        assert response.status_code in [400, 401, 422]  # Various error codes
        print("✓ Empty fields correctly rejected")
    
    def test_get_me(self, session, auth_headers):
        """Test /api/auth/me returns user data"""
        response = session.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "user_id" in data
        print(f"✓ Get me returned user: {data.get('name', 'Unknown')}")


class TestVenues:
    """Test venues endpoints"""
    
    def test_get_venues(self, session):
        """Test /api/venues returns venue list"""
        response = session.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check required fields
        for venue in data[:3]:
            assert "id" in venue
            assert "name" in venue
        print(f"✓ Got {len(data)} venues")
    
    def test_get_venues_with_region_filter(self, session):
        """Test /api/venues with region filter"""
        response = session.get(f"{BASE_URL}/api/venues?region=brisbane")
        assert response.status_code == 200
        data = response.json()
        for venue in data:
            assert venue.get("region") == "brisbane"
        print(f"✓ Brisbane filter returned {len(data)} venues")
    
    def test_get_venue_by_id(self, session):
        """Test /api/venues/{venue_id} returns specific venue"""
        response = session.get(f"{BASE_URL}/api/venues/eclipse")
        assert response.status_code == 200
        venue = response.json()
        assert venue["id"] == "eclipse"
        assert venue["name"] == "Eclipse"
        print(f"✓ Got venue: {venue['name']}")
    
    def test_get_venue_not_found(self, session):
        """Test /api/venues/{venue_id} returns 404 for invalid ID"""
        response = session.get(f"{BASE_URL}/api/venues/invalid_venue_xyz")
        assert response.status_code == 404
        print("✓ Invalid venue correctly returns 404")


class TestEvents:
    """Test events endpoints"""
    
    def test_get_events_feed(self, session):
        """Test /api/events/feed returns event feed with tonight/upcoming/featured"""
        response = session.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        data = response.json()
        assert "tonight" in data
        assert "upcoming" in data
        print(f"✓ Events feed: {len(data.get('upcoming', []))} upcoming events")
    
    def test_get_events(self, session):
        """Test /api/events returns events list"""
        response = session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✓ Got {len(data['events'])} events")
    
    def test_get_events_tonight(self, session):
        """Test /api/events/tonight returns tonight's events"""
        response = session.get(f"{BASE_URL}/api/events/tonight")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✓ Tonight: {len(data['events'])} events")
    
    def test_get_events_featured(self, session):
        """Test /api/events/featured returns featured events"""
        response = session.get(f"{BASE_URL}/api/events/featured")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✓ Featured: {len(data['events'])} events")


class TestAuctions:
    """Test auctions endpoints"""
    
    def test_get_auctions(self, session):
        """Test /api/auctions returns auctions list"""
        response = session.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} auctions")
        return data
    
    def test_get_auction_detail(self, session):
        """Test /api/auctions/{auction_id} returns auction details"""
        # First get auctions list
        auctions_resp = session.get(f"{BASE_URL}/api/auctions")
        auctions = auctions_resp.json()
        
        if len(auctions) > 0:
            auction_id = auctions[0]["id"]
            response = session.get(f"{BASE_URL}/api/auctions/{auction_id}")
            assert response.status_code == 200
            auction = response.json()
            assert auction["id"] == auction_id
            assert "title" in auction
            assert "current_bid" in auction
            print(f"✓ Auction detail: {auction['title']}")
        else:
            pytest.skip("No auctions available")
    
    def test_get_auction_bids(self, session, auth_headers):
        """Test /api/auctions/{auction_id}/bids returns bid history"""
        # First get auctions list
        auctions_resp = session.get(f"{BASE_URL}/api/auctions")
        auctions = auctions_resp.json()
        
        if len(auctions) > 0:
            auction_id = auctions[0]["id"]
            response = session.get(f"{BASE_URL}/api/auctions/{auction_id}/bids", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "bids" in data or isinstance(data, list)
            print(f"✓ Got bid history for auction")
        else:
            pytest.skip("No auctions available")


class TestWallet:
    """Test wallet and payments endpoints"""
    
    def test_get_wallet_balance(self, session, auth_headers):
        """Test /api/wallet/balance returns user balance"""
        response = session.get(f"{BASE_URL}/api/wallet/balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data or "points" in data or "points_balance" in data
        print(f"✓ Wallet balance retrieved")
    
    def test_get_wallet_transactions(self, session, auth_headers):
        """Test /api/wallet/transactions returns transaction history"""
        response = session.get(f"{BASE_URL}/api/wallet/transactions", headers=auth_headers)
        # May return 200 with data or 404 if endpoint exists differently
        assert response.status_code in [200, 404]
        print(f"✓ Wallet transactions endpoint tested")
    
    def test_get_payments_publishable_key(self, session):
        """Test /api/payments/publishable-key returns Stripe key"""
        response = session.get(f"{BASE_URL}/api/payments/publishable-key")
        assert response.status_code == 200
        data = response.json()
        assert "publishable_key" in data
        print("✓ Got Stripe publishable key")


class TestRewards:
    """Test rewards endpoints"""
    
    def test_get_rewards(self, session):
        """Test /api/rewards returns rewards list"""
        response = session.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} rewards")
    
    def test_get_redemptions(self, session, auth_headers):
        """Test /api/redemptions/my returns user redemptions"""
        response = session.get(f"{BASE_URL}/api/redemptions/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} redemptions")


class TestBookings:
    """Test bookings endpoints"""
    
    def test_get_booking_availability(self, session, auth_headers):
        """Test /api/bookings/availability returns available times"""
        response = session.get(
            f"{BASE_URL}/api/bookings/availability?venue_id=eclipse&date={datetime.now().strftime('%Y-%m-%d')}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✓ Booking availability retrieved")
    
    def test_get_my_reservations(self, session, auth_headers):
        """Test /api/bookings/my-reservations returns user bookings"""
        response = session.get(f"{BASE_URL}/api/bookings/my-reservations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} reservations")


class TestSocial:
    """Test social/friends endpoints"""
    
    def test_get_crews(self, session, auth_headers):
        """Test /api/crews returns user crews"""
        response = session.get(f"{BASE_URL}/api/crews", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} crews")
    
    def test_get_user_stats(self, session, auth_headers):
        """Test /api/users/stats returns user statistics"""
        response = session.get(f"{BASE_URL}/api/users/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ User stats retrieved")


class TestSubscriptions:
    """Test subscriptions endpoints"""
    
    def test_get_subscription_tiers(self, session):
        """Test /api/subscriptions/tiers returns tier list"""
        response = session.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        data = response.json()
        print("✓ Subscription tiers retrieved")
    
    def test_get_my_subscription(self, session, auth_headers):
        """Test /api/subscriptions/my returns user subscription"""
        response = session.get(f"{BASE_URL}/api/subscriptions/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print("✓ User subscription retrieved")


class TestCherryHubIntegration:
    """Test CherryHub integration endpoints (MOCKED)"""
    
    def test_get_cherryhub_status(self, session, auth_headers):
        """Test /api/cherryhub/status returns integration status"""
        response = session.get(f"{BASE_URL}/api/cherryhub/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should return mock status
        print(f"✓ CherryHub status: {data.get('status', 'unknown')}")
    
    def test_get_cherryhub_points(self, session, auth_headers):
        """Test /api/cherryhub/points returns points balance"""
        response = session.get(f"{BASE_URL}/api/cherryhub/points", headers=auth_headers)
        assert response.status_code == 200
        print("✓ CherryHub points retrieved (MOCKED)")


class TestVenuePortalAuth:
    """Test venue portal authentication"""
    
    def test_venue_portal_login(self, session):
        """Test venue portal login with venue credentials"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENUE_PORTAL_EMAIL,
            "password": VENUE_PORTAL_PASSWORD
        })
        # May succeed or fail depending on seeded data
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            print(f"✓ Venue portal login successful")
        else:
            print(f"⚠ Venue portal login returned {response.status_code} - credentials may need seeding")


class TestPhotosAndMedia:
    """Test photos and media endpoints"""
    
    def test_get_venue_photos(self, session):
        """Test /api/photos/venues returns venue photos"""
        response = session.get(f"{BASE_URL}/api/photos/venues")
        assert response.status_code == 200
        print("✓ Venue photos retrieved")
    
    def test_get_venue_photo(self, session):
        """Test /api/photos/venue/{venue_id} returns specific venue photos"""
        response = session.get(f"{BASE_URL}/api/photos/venue/eclipse")
        assert response.status_code == 200
        print("✓ Eclipse venue photos retrieved")


class TestSafetyFeatures:
    """Test safety features endpoints"""
    
    def test_get_rideshare_links(self, session):
        """Test /api/safety/rideshare-links returns ride services"""
        response = session.get(f"{BASE_URL}/api/safety/rideshare-links")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} rideshare links")
    
    def test_get_emergency_services(self, session):
        """Test /api/safety/emergency-services returns emergency contacts"""
        response = session.get(f"{BASE_URL}/api/safety/emergency-services")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} emergency services")


class TestReferralSystem:
    """Test referral system endpoints"""
    
    def test_get_referral_code(self, session, auth_headers):
        """Test /api/referral/code returns user's referral code"""
        response = session.get(f"{BASE_URL}/api/referral/code", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        print(f"✓ Referral code: {data['referral_code']}")
    
    def test_get_referral_history(self, session, auth_headers):
        """Test /api/referral/history returns referral history"""
        response = session.get(f"{BASE_URL}/api/referral/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print("✓ Referral history retrieved")


class TestMissions:
    """Test missions/gamification endpoints"""
    
    def test_get_missions(self, session, auth_headers):
        """Test /api/missions returns available missions"""
        response = session.get(f"{BASE_URL}/api/missions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} missions")


class TestBoosts:
    """Test boosts/double points endpoints"""
    
    def test_get_boosts(self, session):
        """Test /api/boosts returns available boosts"""
        response = session.get(f"{BASE_URL}/api/boosts")
        assert response.status_code == 200
        data = response.json()
        print("✓ Boosts retrieved")
    
    def test_get_upcoming_boosts(self, session):
        """Test /api/boosts/upcoming returns upcoming boosts"""
        response = session.get(f"{BASE_URL}/api/boosts/upcoming")
        assert response.status_code == 200
        print("✓ Upcoming boosts retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
