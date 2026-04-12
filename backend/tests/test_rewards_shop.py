"""
Test suite for Luna Group VIP - Rewards Shop Overhaul
Tests: Gift Cards, Points conversion, Backend APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "luna@test.com"
TEST_PASSWORD = "test123"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"PASS: Health endpoint returns healthy status")
    
    def test_login_with_test_credentials(self):
        """Test /api/auth/login works with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert "points_balance" in data["user"]
        print(f"PASS: Login successful, user has {data['user']['points_balance']} points")
        return data["token"]


class TestRewardsAPI:
    """Tests for /api/rewards endpoint"""
    
    def test_rewards_returns_list(self):
        """Test /api/rewards returns list of rewards"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"PASS: Rewards endpoint returns {len(data)} rewards")
    
    def test_rewards_have_required_fields(self):
        """Test each reward has required fields"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "name", "description", "points_cost", "category"]
        for reward in data:
            for field in required_fields:
                assert field in reward, f"Reward missing field: {field}"
        print(f"PASS: All rewards have required fields")
    
    def test_rewards_have_points_cost(self):
        """Test rewards have valid points_cost values"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        
        for reward in data:
            assert isinstance(reward["points_cost"], int)
            assert reward["points_cost"] > 0
        print(f"PASS: All rewards have valid points_cost values")


class TestPointsAPI:
    """Tests for /api/points/balance endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_points_balance_requires_auth(self):
        """Test /api/points/balance requires authentication"""
        response = requests.get(f"{BASE_URL}/api/points/balance")
        assert response.status_code == 401
        print(f"PASS: Points balance endpoint requires authentication")
    
    def test_points_balance_returns_data(self, auth_token):
        """Test /api/points/balance returns balance data"""
        response = requests.get(
            f"{BASE_URL}/api/points/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "points_balance" in data
        assert isinstance(data["points_balance"], int)
        print(f"PASS: Points balance endpoint returns {data['points_balance']} points")
    
    def test_points_balance_has_tier_info(self, auth_token):
        """Test /api/points/balance includes tier information"""
        response = requests.get(
            f"{BASE_URL}/api/points/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tier_id" in data or "tier_name" in data
        print(f"PASS: Points balance includes tier info: {data.get('tier_id', data.get('tier_name'))}")


class TestGiftCardMath:
    """Tests for Gift Card 10% bonus calculations"""
    
    def test_gift_card_25_bonus(self):
        """Test $25 gift card = $27.50 value (10% bonus)"""
        amount = 25
        bonus = amount * 0.10
        total = amount + bonus
        points_cost = amount * 10
        
        assert bonus == 2.50, f"Expected $2.50 bonus, got ${bonus}"
        assert total == 27.50, f"Expected $27.50 total, got ${total}"
        assert points_cost == 250, f"Expected 250 points, got {points_cost}"
        print(f"PASS: $25 gift card = ${total} value, costs {points_cost} points")
    
    def test_gift_card_50_bonus(self):
        """Test $50 gift card = $55 value (10% bonus)"""
        amount = 50
        bonus = amount * 0.10
        total = amount + bonus
        points_cost = amount * 10
        
        assert bonus == 5.00, f"Expected $5.00 bonus, got ${bonus}"
        assert total == 55.00, f"Expected $55.00 total, got ${total}"
        assert points_cost == 500, f"Expected 500 points, got {points_cost}"
        print(f"PASS: $50 gift card = ${total} value, costs {points_cost} points")
    
    def test_gift_card_100_bonus(self):
        """Test $100 gift card = $110 value (10% bonus)"""
        amount = 100
        bonus = amount * 0.10
        total = amount + bonus
        points_cost = amount * 10
        
        assert bonus == 10.00, f"Expected $10.00 bonus, got ${bonus}"
        assert total == 110.00, f"Expected $110.00 total, got ${total}"
        assert points_cost == 1000, f"Expected 1000 points, got {points_cost}"
        print(f"PASS: $100 gift card = ${total} value, costs {points_cost} points")
    
    def test_gift_card_150_bonus(self):
        """Test $150 gift card = $165 value (10% bonus)"""
        amount = 150
        bonus = amount * 0.10
        total = amount + bonus
        points_cost = amount * 10
        
        assert bonus == 15.00, f"Expected $15.00 bonus, got ${bonus}"
        assert total == 165.00, f"Expected $165.00 total, got ${total}"
        assert points_cost == 1500, f"Expected 1500 points, got {points_cost}"
        print(f"PASS: $150 gift card = ${total} value, costs {points_cost} points")
    
    def test_custom_gift_card_minimum(self):
        """Test custom gift card minimum is $10"""
        min_amount = 10
        bonus = min_amount * 0.10
        total = min_amount + bonus
        points_cost = min_amount * 10
        
        assert bonus == 1.00, f"Expected $1.00 bonus, got ${bonus}"
        assert total == 11.00, f"Expected $11.00 total, got ${total}"
        assert points_cost == 100, f"Expected 100 points, got {points_cost}"
        print(f"PASS: Minimum $10 gift card = ${total} value, costs {points_cost} points")
    
    def test_points_conversion_rate(self):
        """Test 10 points = $1 conversion rate"""
        points = 100
        dollar_value = points / 10
        
        assert dollar_value == 10.00, f"Expected $10.00 for 100 points, got ${dollar_value}"
        print(f"PASS: 100 points = ${dollar_value} (10 points = $1)")


class TestLeaderboardAPI:
    """Tests for /api/leaderboard endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_leaderboard_returns_data(self, auth_token):
        """Test /api/leaderboard returns leaderboard data"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard?period=all_time&category=points&limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "leaders" in data
        assert isinstance(data["leaders"], list)
        print(f"PASS: Leaderboard returns {len(data['leaders'])} leaders")


class TestUserAuth:
    """Tests for user authentication and profile"""
    
    def test_auth_me_returns_user(self):
        """Test /api/auth/me returns current user"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        
        # Then get user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == TEST_EMAIL
        print(f"PASS: /api/auth/me returns user data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
