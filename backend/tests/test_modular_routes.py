"""
Test Suite for Luna Group VIP Modular Routes Refactoring
Tests all 17 route modules extracted from server.py

Modules tested:
1. Health - /api/health
2. Auth - /api/auth/login, /api/auth/me
3. Venues - /api/venues, /api/venues/{id}
4. Events - /api/events/tonight, /api/events/feed
5. Auctions - /api/auctions
6. Rewards - /api/rewards
7. Missions - /api/missions (auth required)
8. Notifications - /api/notifications (auth required)
9. Points - /api/points/balance (auth required)
10. Subscriptions - /api/subscriptions/tiers
11. Bookings - /api/bookings/availability
12. Tickets - /api/tickets (auth required)
13. Friends - /api/friends (auth required)
14. Referrals - /api/referral/code (auth required)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://owner-manual-docs.preview.emergentagent.com').rstrip('/')


class TestHealth:
    """Health endpoint - Module 1"""
    
    def test_health_endpoint_returns_200(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert "service" in data
        assert "timestamp" in data
        print(f"✓ Health check: {data['status']}")


class TestAuth:
    """Authentication endpoints - Module 2"""
    
    def test_login_with_valid_credentials(self):
        """Test /api/auth/login with test user credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "luna@test.com"
        print(f"✓ Login successful: {data['user']['email']}")
        return data["token"]
    
    def test_login_with_invalid_credentials(self):
        """Test /api/auth/login rejects invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "wrongpassword"
        }, timeout=10)
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_get_me_with_auth(self):
        """Test /api/auth/me returns user profile"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        token = login_response.json()["token"]
        
        # Then get profile
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "luna@test.com"
        print(f"✓ Profile retrieved: {data.get('name', 'Unknown')}")


class TestVenues:
    """Venues endpoints - Module 3"""
    
    def test_get_all_venues(self):
        """Test /api/venues returns venues list"""
        response = requests.get(f"{BASE_URL}/api/venues", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Retrieved {len(data)} venues")
    
    def test_get_venue_by_id(self):
        """Test /api/venues/{venue_id} for eclipse"""
        response = requests.get(f"{BASE_URL}/api/venues/eclipse", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("id") == "eclipse"
        assert "name" in data
        print(f"✓ Retrieved venue: {data.get('name')}")
    
    def test_get_invalid_venue(self):
        """Test /api/venues/{venue_id} returns 404 for invalid venue"""
        response = requests.get(f"{BASE_URL}/api/venues/nonexistent", timeout=10)
        assert response.status_code == 404
        print("✓ Invalid venue correctly returns 404")


class TestEvents:
    """Events endpoints - Module 4"""
    
    def test_get_tonight_events(self):
        """Test /api/events/tonight returns events"""
        response = requests.get(f"{BASE_URL}/api/events/tonight", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "total" in data
        print(f"✓ Tonight events: {data.get('total', 0)} events")
    
    def test_get_events_feed(self):
        """Test /api/events/feed returns Luna Group events"""
        response = requests.get(f"{BASE_URL}/api/events/feed", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "tonight" in data
        assert "upcoming" in data
        print(f"✓ Events feed: {data.get('total_count', 0)} total events")


class TestAuctions:
    """Auctions endpoints - Module 5"""
    
    def test_get_auctions_list(self):
        """Test /api/auctions returns auctions list"""
        response = requests.get(f"{BASE_URL}/api/auctions", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} auctions")


class TestRewards:
    """Rewards endpoints - Module 6"""
    
    def test_get_rewards_list(self):
        """Test /api/rewards returns rewards list"""
        response = requests.get(f"{BASE_URL}/api/rewards", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} rewards")


class TestMissions:
    """Missions endpoints - Module 7 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_missions_with_auth(self, auth_token):
        """Test /api/missions returns missions with progress"""
        response = requests.get(f"{BASE_URL}/api/missions", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} missions")


class TestNotifications:
    """Notifications endpoints - Module 8 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_notifications_with_auth(self, auth_token):
        """Test /api/notifications returns notifications list"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} notifications")


class TestPoints:
    """Points endpoints - Module 9 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_points_balance(self, auth_token):
        """Test /api/points/balance returns user's points"""
        response = requests.get(f"{BASE_URL}/api/points/balance", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "points_balance" in data
        assert "tier_id" in data
        print(f"✓ Points balance: {data.get('points_balance')} ({data.get('tier_name', 'Unknown')})")


class TestSubscriptions:
    """Subscriptions endpoints - Module 10"""
    
    def test_get_subscription_tiers(self):
        """Test /api/subscriptions/tiers returns available tiers"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "tiers" in data
        assert len(data["tiers"]) > 0
        print(f"✓ Retrieved {len(data['tiers'])} subscription tiers")


class TestBookings:
    """Bookings endpoints - Module 11"""
    
    def test_get_availability(self):
        """Test /api/bookings/availability returns time slots"""
        response = requests.get(f"{BASE_URL}/api/bookings/availability", params={
            "venue_id": "eclipse",
            "date": "2026-03-01"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "venue_id" in data
        assert "time_slots" in data
        print(f"✓ Booking availability: {len(data.get('time_slots', []))} slots")


class TestTickets:
    """Tickets endpoints - Module 12 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_user_tickets(self, auth_token):
        """Test /api/tickets returns user's tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        # Response can be dict with active/upcoming/history or list
        assert isinstance(data, (dict, list))
        print(f"✓ Retrieved tickets data")


class TestFriends:
    """Friends endpoints - Module 13 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_friends_list(self, auth_token):
        """Test /api/friends returns friends list"""
        response = requests.get(f"{BASE_URL}/api/friends", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "friends" in data
        assert "count" in data
        print(f"✓ Friends list: {data.get('count')} friends")


class TestReferrals:
    """Referrals endpoints - Module 14 (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        return response.json()["token"]
    
    def test_get_referral_code(self, auth_token):
        """Test /api/referral/code returns user's referral code"""
        response = requests.get(f"{BASE_URL}/api/referral/code", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        assert "stats" in data
        print(f"✓ Referral code: {data.get('referral_code')}")


class TestVenueStaffAuth:
    """Test venue staff authentication"""
    
    def test_venue_staff_login(self):
        """Test /api/auth/login with venue staff credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "venue@eclipse.com",
            "password": "venue123"
        }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Venue staff login: {data['user'].get('email')}")


class TestModularRoutesIntegration:
    """Integration tests - ensure routes are properly registered"""
    
    def test_health_from_modular_routes(self):
        """Verify health endpoint is served from modular routes"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        print("✓ Health route working from modular setup")
    
    def test_venues_from_modular_routes(self):
        """Verify venues endpoint is served from modular routes"""
        response = requests.get(f"{BASE_URL}/api/venues", timeout=10)
        assert response.status_code == 200
        print("✓ Venues route working from modular setup")
    
    def test_auth_from_modular_routes(self):
        """Verify auth endpoints are served from modular routes"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        }, timeout=10)
        assert response.status_code == 200
        print("✓ Auth route working from modular setup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
