"""
Test Suite for Server.py Refactoring and New Venue Analytics APIs
Tests that all existing APIs still function after code reorganization
and new analytics endpoints work correctly.

Iteration 7 - Tests:
- Auth APIs (login, register, me)
- Venue APIs 
- Rewards APIs
- Events APIs (Eventfinda integration)
- NEW: Venue Analytics APIs (revenue, checkins, demographics)
- NEW: Venue Dashboard API
- CherryHub Integration (MOCK MODE)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://cherryub-mock.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasicConnectivity:
    """Verify backend is accessible and core endpoints work"""
    
    def test_venues_endpoint_accessible(self):
        """Ensure venues endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify venue data structure
        venue = data[0]
        assert "id" in venue
        assert "name" in venue
        assert "region" in venue
        print(f"✅ Venues API returns {len(data)} venues")
    
    def test_venue_detail_endpoint(self):
        """Get specific venue details"""
        response = requests.get(f"{BASE_URL}/api/venues/eclipse")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "eclipse"
        assert data["name"] == "Eclipse"
        print(f"✅ Venue detail API working for Eclipse")


class TestAuthAPIs:
    """Test authentication endpoints after refactoring"""
    
    def test_login_regular_user(self):
        """Test login with regular user credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "luna@test.com"
        print(f"✅ Regular user login successful")
        return data["token"]
    
    def test_login_venue_manager(self):
        """Test login with venue manager credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "venue@eclipse.com", "password": "venue123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "venue_manager"
        assert data["user"]["venue_id"] == "eclipse"
        print(f"✅ Venue manager login successful")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print(f"✅ Invalid credentials properly rejected")
    
    def test_get_current_user(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        token = login_response.json()["token"]
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "luna@test.com"
        assert "points_balance" in data
        print(f"✅ /auth/me returns correct user data")
    
    def test_auth_me_without_token(self):
        """Test /auth/me without authorization"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print(f"✅ /auth/me properly rejects unauthorized requests")


class TestEventsAPI:
    """Test Eventfinda integration endpoints"""
    
    def test_events_feed(self):
        """Test events feed endpoint"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "tonight" in data
        assert "tomorrow" in data
        assert "featured" in data
        assert "upcoming" in data
        print(f"✅ Events feed returns categorized events")
    
    def test_events_featured(self):
        """Test featured events endpoint"""
        response = requests.get(f"{BASE_URL}/api/events/featured?location=brisbane")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✅ Featured events API working")
    
    def test_events_list(self):
        """Test main events list endpoint"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "source" in data
        print(f"✅ Events list API returns {len(data.get('events', []))} events")


class TestRewardsAPI:
    """Test rewards system endpoints"""
    
    def test_get_rewards_list(self):
        """Test getting available rewards"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            reward = data[0]
            assert "id" in reward
            assert "name" in reward
            assert "points_cost" in reward
            assert "category" in reward
        print(f"✅ Rewards API returns {len(data)} rewards")
    
    def test_get_rewards_by_category(self):
        """Test filtering rewards by category"""
        response = requests.get(f"{BASE_URL}/api/rewards?category=drinks")
        assert response.status_code == 200
        data = response.json()
        # All returned rewards should be in drinks category
        for reward in data:
            assert reward["category"] == "drinks"
        print(f"✅ Rewards filtering by category works")


class TestCherryHubIntegration:
    """Test CherryHub integration (MOCK MODE)"""
    
    def test_cherryhub_status(self):
        """Test CherryHub status endpoint"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/cherryhub/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # CherryHub should show registered status for test user
        assert "registered" in data
        print(f"✅ CherryHub status API working (MOCK MODE)")


class TestNewVenueAnalyticsAPIs:
    """Test NEW venue analytics endpoints added for venue portal"""
    
    @pytest.fixture
    def venue_token(self):
        """Get venue manager token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "venue@eclipse.com", "password": "venue123"}
        )
        return response.json()["token"]
    
    def test_venue_analytics_revenue(self, venue_token):
        """Test /api/venue/analytics/revenue endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/venue/analytics/revenue?period=week",
            headers={"Authorization": f"Bearer {venue_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert "total_revenue" in data
        assert "booking_revenue" in data
        assert "combined_revenue" in data
        assert "category_breakdown" in data
        assert "daily_revenue" in data
        assert "average_spend_per_customer" in data
        assert "total_transactions" in data
        
        # Verify period is correct
        assert data["period"] == "week"
        print(f"✅ Revenue analytics API returns correct structure")
    
    def test_venue_analytics_revenue_periods(self, venue_token):
        """Test different period filters for revenue"""
        for period in ["week", "month", "year"]:
            response = requests.get(
                f"{BASE_URL}/api/venue/analytics/revenue?period={period}",
                headers={"Authorization": f"Bearer {venue_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
        print(f"✅ Revenue analytics supports all period filters")
    
    def test_venue_analytics_checkins(self, venue_token):
        """Test /api/venue/analytics/checkins endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/venue/analytics/checkins?period=month",
            headers={"Authorization": f"Bearer {venue_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert "total_checkins" in data
        assert "unique_visitors" in data
        assert "avg_checkins_per_user" in data
        assert "peak_hours" in data
        assert "peak_days" in data
        assert "daily_checkins" in data
        assert "top_visitors" in data
        
        print(f"✅ Check-ins analytics API returns correct structure")
    
    def test_venue_analytics_demographics(self, venue_token):
        """Test /api/venue/analytics/demographics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/venue/analytics/demographics",
            headers={"Authorization": f"Bearer {venue_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_customers" in data
        assert "membership_tiers" in data
        assert "age_distribution" in data
        assert "gender_distribution" in data
        assert "loyalty_breakdown" in data
        
        # Verify age distribution structure
        age_dist = data["age_distribution"]
        assert "18-24" in age_dist
        assert "25-34" in age_dist
        assert "35-44" in age_dist
        assert "45+" in age_dist
        
        # Verify loyalty breakdown structure
        loyalty = data["loyalty_breakdown"]
        assert "new_visitors" in loyalty
        assert "regular_visitors" in loyalty
        assert "vip_visitors" in loyalty
        
        print(f"✅ Demographics analytics API returns correct structure")
    
    def test_venue_dashboard(self, venue_token):
        """Test /api/venue/dashboard endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/venue/dashboard",
            headers={"Authorization": f"Bearer {venue_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "stats" in data
        assert "recent_redemptions" in data
        assert "venue_id" in data
        assert "is_admin" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_redemptions" in stats
        assert "today_redemptions" in stats
        assert "week_redemptions" in stats
        assert "pending_redemptions" in stats
        assert "unique_visitors" in stats
        
        print(f"✅ Venue dashboard API returns correct structure")
    
    def test_analytics_unauthorized_access(self):
        """Test analytics endpoints reject unauthorized users"""
        # Regular user should not access venue analytics
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        user_token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/venue/analytics/revenue",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        print(f"✅ Analytics endpoints properly reject unauthorized users")
    
    def test_analytics_without_auth(self):
        """Test analytics endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/venue/analytics/revenue")
        assert response.status_code == 401
        print(f"✅ Analytics endpoints require authentication")


class TestRefactoredModules:
    """Verify refactored modules are working correctly"""
    
    def test_config_module_used(self):
        """Verify JWT token generation uses config module"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        assert response.status_code == 200
        token = response.json()["token"]
        # Token should be valid JWT
        assert token.count(".") == 2
        print(f"✅ Config module JWT settings working")
    
    def test_database_module_used(self):
        """Verify database operations work via database module"""
        response = requests.get(f"{BASE_URL}/api/venues/eclipse")
        assert response.status_code == 200
        print(f"✅ Database module connected and working")
    
    def test_auth_utils_working(self):
        """Verify auth utilities from utils/auth.py work"""
        # Test token validation
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        token = login_response.json()["token"]
        
        # Use token to access protected endpoint
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"✅ Auth utils module working correctly")
    
    def test_mongo_utils_clean_response(self):
        """Verify mongo utils remove _id from responses"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        data = response.json()
        # None of the rewards should have MongoDB _id field
        for reward in data:
            assert "_id" not in reward, "MongoDB _id should be removed from response"
        print(f"✅ Mongo utils clean_mongo_doc working")


class TestExistingCoreAPIs:
    """Verify existing APIs still work after refactoring"""
    
    @pytest.fixture
    def user_token(self):
        """Get regular user token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "luna@test.com", "password": "test123"}
        )
        return response.json()["token"]
    
    def test_boosts_endpoint(self):
        """Test boosts API"""
        response = requests.get(f"{BASE_URL}/api/boosts")
        assert response.status_code == 200
        print(f"✅ Boosts API working")
    
    def test_auctions_endpoint(self):
        """Test auctions API"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        print(f"✅ Auctions API working")
    
    def test_referral_code_endpoint(self, user_token):
        """Test referral code generation"""
        response = requests.get(
            f"{BASE_URL}/api/referral/code",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        assert "referral_link" in data
        print(f"✅ Referral system working")
    
    def test_missions_endpoint(self, user_token):
        """Test missions API"""
        response = requests.get(
            f"{BASE_URL}/api/missions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        print(f"✅ Missions API working")
    
    def test_redemptions_my_endpoint(self, user_token):
        """Test user redemptions"""
        response = requests.get(
            f"{BASE_URL}/api/redemptions/my",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        print(f"✅ User redemptions API working")
    
    def test_friends_endpoint(self, user_token):
        """Test friends API"""
        response = requests.get(
            f"{BASE_URL}/api/friends",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        print(f"✅ Friends API working")
    
    def test_lost_found_endpoint(self, user_token):
        """Test lost & found API"""
        response = requests.get(
            f"{BASE_URL}/api/lost-found/my-reports",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        print(f"✅ Lost & Found API working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
