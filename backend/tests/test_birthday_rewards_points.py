"""
Test Birthday Club, Rewards, and Points Balance APIs
Tests for iteration 23 - Unified points system, Redeem Rewards, Birthday Club
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "luna@test.com"
TEST_PASSWORD = "test123"


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["token"]


class TestPointsBalance:
    """Points Balance API tests - Unified points system"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_points_balance(self, auth_token):
        """Test /api/points/balance endpoint returns unified points"""
        response = requests.get(
            f"{BASE_URL}/api/points/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Points balance failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "points_balance" in data, "Missing points_balance field"
        assert isinstance(data["points_balance"], (int, float)), "points_balance should be numeric"
        
        print(f"✓ Points balance: {data['points_balance']}")
        print(f"  Full response: {data}")
        
        # Check for tier info if present
        if "tier_id" in data:
            print(f"  Tier: {data.get('tier_name', data.get('tier_id'))}")
        
        return data


class TestRewardsAPI:
    """Rewards API tests - Redeem Rewards section"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_rewards_list(self, auth_token):
        """Test /api/rewards endpoint returns available rewards"""
        response = requests.get(
            f"{BASE_URL}/api/rewards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get rewards failed: {response.text}"
        data = response.json()
        
        # Response should be a list of rewards
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"✓ Found {len(data)} rewards")
        
        # Check reward structure if any exist
        if len(data) > 0:
            reward = data[0]
            print(f"  Sample reward: {reward.get('name', 'N/A')}")
            print(f"  Points cost: {reward.get('points_cost', 'N/A')}")
        
        return data
    
    def test_get_my_redemptions(self, auth_token):
        """Test /api/redemptions/my endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/redemptions/my",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get redemptions failed: {response.text}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"✓ Found {len(data)} redemptions")
        return data


class TestLeaderboard:
    """Leaderboard API tests - Scoreboard on Wallet page"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_leaderboard(self, auth_token):
        """Test /api/leaderboard endpoint returns top users"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard?period=all_time&category=points&limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "leaders" in data, "Missing leaders field"
        assert isinstance(data["leaders"], list), "leaders should be a list"
        
        print(f"✓ Leaderboard has {len(data['leaders'])} entries")
        
        # Check top 5 if available
        for i, leader in enumerate(data["leaders"][:5]):
            print(f"  #{i+1}: {leader.get('display_name', 'N/A')} - {leader.get('points_balance', 0)} pts")
        
        return data


class TestBirthdayClub:
    """Birthday Club API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_birthday_status(self, auth_token):
        """Test /api/birthday/status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/birthday/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get birthday status failed: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "has_birthday_set" in data, "Missing has_birthday_set field"
        assert "is_birthday_today" in data, "Missing is_birthday_today field"
        assert "is_birthday_week" in data, "Missing is_birthday_week field"
        
        print(f"✓ Birthday status retrieved")
        print(f"  Has birthday set: {data['has_birthday_set']}")
        print(f"  Is birthday today: {data['is_birthday_today']}")
        print(f"  Is birthday week: {data['is_birthday_week']}")
        print(f"  Days until birthday: {data.get('days_until_birthday', 'N/A')}")
        print(f"  Available rewards: {len(data.get('available_rewards', []))}")
        print(f"  Claimed rewards: {len(data.get('claimed_rewards', []))}")
        
        return data
    
    def test_get_my_birthday_rewards(self, auth_token):
        """Test /api/birthday/my-rewards endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/birthday/my-rewards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get birthday rewards failed: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "rewards" in data, "Missing rewards field"
        assert isinstance(data["rewards"], list), "rewards should be a list"
        
        print(f"✓ Found {len(data['rewards'])} birthday rewards")
        return data


class TestUserProfile:
    """User profile tests - verify points display"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_user_me(self, auth_token):
        """Test /api/users/me endpoint returns user with points"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        
        # Check user has points field
        assert "points_balance" in data or "points" in data, "User should have points field"
        
        points = data.get("points_balance", data.get("points", 0))
        print(f"✓ User profile retrieved")
        print(f"  Email: {data.get('email', 'N/A')}")
        print(f"  Points: {points}")
        print(f"  Tier: {data.get('tier', 'N/A')}")
        
        return data
    
    def test_get_user_stats(self, auth_token):
        """Test /api/users/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        data = response.json()
        
        print(f"✓ User stats retrieved: {data}")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
