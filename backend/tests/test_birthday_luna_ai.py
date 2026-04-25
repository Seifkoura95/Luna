"""
Test Birthday Club and Luna AI Features
Tests for:
- Birthday Club endpoints (/api/birthday/status, /api/birthday/claim, /api/birthday/redeem)
- Luna AI Chat endpoint (/api/ai/chat)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com')

# Test credentials from previous test reports
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"


class TestAuth:
    """Authentication tests to get token for other tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Login successful for {TEST_USER_EMAIL}")


class TestBirthdayClub:
    """Birthday Club endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_birthday_status_endpoint(self, auth_token):
        """Test GET /api/birthday/status returns proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/birthday/status",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Birthday status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "has_birthday_set" in data, "Missing has_birthday_set field"
        assert "is_birthday_today" in data, "Missing is_birthday_today field"
        assert "is_birthday_week" in data, "Missing is_birthday_week field"
        assert "available_rewards" in data, "Missing available_rewards field"
        assert "claimed_rewards" in data, "Missing claimed_rewards field"
        assert "message" in data, "Missing message field"
        
        print(f"✓ Birthday status endpoint working")
        print(f"  - has_birthday_set: {data['has_birthday_set']}")
        print(f"  - is_birthday_today: {data['is_birthday_today']}")
        print(f"  - is_birthday_week: {data['is_birthday_week']}")
        print(f"  - available_rewards count: {len(data['available_rewards'])}")
        print(f"  - claimed_rewards count: {len(data['claimed_rewards'])}")
    
    def test_birthday_claim_without_birthday_week(self, auth_token):
        """Test claiming reward when not birthday week returns appropriate error"""
        # Try to claim a reward - should fail if not birthday week
        response = requests.post(
            f"{BASE_URL}/api/birthday/claim/free_entry",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        # Either 400 (not birthday week) or 200 (if it is birthday week)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, "Missing error detail"
            print(f"✓ Birthday claim correctly rejected (not birthday week): {data['detail']}")
        else:
            data = response.json()
            print(f"✓ Birthday claim succeeded (is birthday week): {data.get('message')}")
    
    def test_birthday_claim_invalid_reward(self, auth_token):
        """Test claiming invalid reward returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/birthday/claim/invalid_reward_id",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid reward: {response.status_code}"
        print("✓ Invalid reward claim correctly rejected")
    
    def test_birthday_my_rewards(self, auth_token):
        """Test GET /api/birthday/my-rewards returns rewards history"""
        response = requests.get(
            f"{BASE_URL}/api/birthday/my-rewards",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"My rewards failed: {response.text}"
        data = response.json()
        assert "rewards" in data, "Missing rewards field"
        print(f"✓ Birthday my-rewards endpoint working, found {len(data['rewards'])} rewards")


class TestLunaAIChat:
    """Luna AI Chat endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_ai_health_endpoint(self):
        """Test AI health endpoint (no auth required)"""
        response = requests.get(
            f"{BASE_URL}/api/ai/health",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"AI health check failed: {response.text}"
        data = response.json()
        assert "status" in data, "Missing status field"
        assert "ai_enabled" in data, "Missing ai_enabled field"
        print(f"✓ AI health endpoint working")
        print(f"  - status: {data['status']}")
        print(f"  - ai_enabled: {data['ai_enabled']}")
    
    def test_ai_chat_simple_message(self, auth_token):
        """Test AI chat with a simple message"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "What's on tonight?"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=30  # AI responses can take time
        )
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        data = response.json()
        
        assert "response" in data, "Missing response field"
        assert "session_id" in data, "Missing session_id field"
        assert len(data["response"]) > 0, "Empty AI response"
        
        print(f"✓ AI chat endpoint working")
        print(f"  - session_id: {data['session_id']}")
        print(f"  - response length: {len(data['response'])} chars")
        print(f"  - response preview: {data['response'][:100]}...")
    
    def test_ai_chat_with_session_continuity(self, auth_token):
        """Test AI chat maintains session continuity"""
        # First message
        response1 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "My name is TestUser"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        assert response1.status_code == 200, f"First AI chat failed: {response1.text}"
        data1 = response1.json()
        session_id = data1.get("session_id")
        
        # Second message with same session
        response2 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "What is my name?", "session_id": session_id},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        assert response2.status_code == 200, f"Second AI chat failed: {response2.text}"
        data2 = response2.json()
        
        # Session should be maintained
        assert data2.get("session_id") == session_id, "Session ID changed unexpectedly"
        print(f"✓ AI chat session continuity working")
        print(f"  - session_id maintained: {session_id}")
    
    def test_ai_chat_quick_questions(self, auth_token):
        """Test AI chat with quick question options"""
        quick_questions = [
            "What's on tonight?",
            "Book a VIP table",
            "What's the dress code?",
            "How do Luna Points work?"
        ]
        
        for question in quick_questions:
            response = requests.post(
                f"{BASE_URL}/api/ai/chat",
                json={"message": question},
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            assert response.status_code == 200, f"AI chat failed for '{question}': {response.text}"
            data = response.json()
            assert "response" in data, f"Missing response for '{question}'"
            print(f"✓ Quick question '{question}' - got response ({len(data['response'])} chars)")


class TestBottomNavigation:
    """Test that required endpoints for bottom navigation tabs work"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_venues_endpoint(self):
        """Test venues endpoint (for Venues tab)"""
        response = requests.get(
            f"{BASE_URL}/api/venues",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Venues endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Venues should return a list"
        print(f"✓ Venues endpoint working, found {len(data)} venues")
    
    def test_events_feed_endpoint(self):
        """Test events feed endpoint (for Tonight tab)"""
        response = requests.get(
            f"{BASE_URL}/api/events/feed",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Events feed failed: {response.text}"
        data = response.json()
        assert "tonight" in data or "upcoming" in data, "Missing events data"
        print(f"✓ Events feed endpoint working")
    
    def test_user_stats_endpoint(self, auth_token):
        """Test user stats endpoint (for Profile tab)"""
        response = requests.get(
            f"{BASE_URL}/api/users/stats",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"User stats failed: {response.text}"
        print(f"✓ User stats endpoint working")
    
    def test_tickets_endpoint(self, auth_token):
        """Test tickets endpoint (for Wallet tab)"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Tickets endpoint failed: {response.text}"
        print(f"✓ Tickets endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
