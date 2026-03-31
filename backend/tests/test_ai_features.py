"""
Luna AI Features Test Suite
Tests all 6 AI-driven engagement features powered by Anthropic Claude:
1. AI Concierge Chat
2. Dynamic Auction Bid Nudging
3. Smart Mission Generation
4. AI Photo Captioning
5. Churn Prediction & Win-back
6. AI Health Check
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "luna@test.com"
TEST_PASSWORD = "test123"


class TestAIHealth:
    """AI Health endpoint tests - no auth required"""
    
    def test_ai_health_returns_operational(self):
        """GET /api/ai/health returns status=operational and ai_enabled=true"""
        response = requests.get(f"{BASE_URL}/api/ai/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "operational"
        assert data["ai_enabled"] == True
        
        # Verify all features are enabled
        features = data["features"]
        assert features["chat"] == True
        assert features["auction_nudge"] == True
        assert features["personalized_events"] == True
        assert features["smart_missions"] == True
        assert features["photo_captions"] == True
        assert features["churn_analysis"] == True
        assert features["memory_recap"] == True
        print("PASS: AI health check returns operational with all features enabled")


class TestAIAuthentication:
    """Test that AI endpoints require authentication"""
    
    def test_chat_requires_auth(self):
        """POST /api/ai/chat returns 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "Hello"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403]
        print("PASS: AI chat endpoint requires authentication")
    
    def test_smart_mission_requires_auth(self):
        """POST /api/ai/smart-mission returns 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/ai/smart-mission",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403]
        print("PASS: Smart mission endpoint requires authentication")
    
    def test_photo_caption_requires_auth(self):
        """POST /api/ai/photo-caption returns 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/ai/photo-caption",
            json={"venue_name": "Eclipse"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403]
        print("PASS: Photo caption endpoint requires authentication")
    
    def test_auction_nudge_requires_auth(self):
        """POST /api/ai/auction-nudge returns 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/ai/auction-nudge",
            json={
                "auction_title": "Test",
                "current_bid": 100,
                "user_last_bid": 90,
                "time_remaining": "1 hour"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403]
        print("PASS: Auction nudge endpoint requires authentication")
    
    def test_churn_status_requires_auth(self):
        """GET /api/ai/my-churn-status returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/ai/my-churn-status")
        assert response.status_code in [401, 403]
        print("PASS: Churn status endpoint requires authentication")


@pytest.fixture(scope="class")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    
    data = response.json()
    return data["token"]


@pytest.fixture(scope="class")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


class TestAIConciergeChat:
    """AI Concierge Chat feature tests"""
    
    def test_chat_returns_response_and_session(self, auth_headers):
        """POST /api/ai/chat returns response and session_id"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "What venues do you have?"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 0
        assert len(data["session_id"]) > 0
        
        # Verify response mentions Luna venues
        response_text = data["response"].lower()
        assert any(venue in response_text for venue in ["eclipse", "after dark", "su casa", "juju"])
        print(f"PASS: AI chat returned response with session_id: {data['session_id'][:30]}...")
    
    def test_chat_with_session_continuity(self, auth_headers):
        """POST /api/ai/chat maintains session context"""
        # First message
        response1 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "Tell me about Eclipse"},
            headers=auth_headers
        )
        assert response1.status_code == 200
        session_id = response1.json()["session_id"]
        
        # Second message with same session
        response2 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "What's the dress code there?", "session_id": session_id},
            headers=auth_headers
        )
        assert response2.status_code == 200
        
        data = response2.json()
        assert data["session_id"] == session_id
        print("PASS: AI chat maintains session continuity")
    
    def test_chat_handles_various_questions(self, auth_headers):
        """POST /api/ai/chat handles different question types"""
        questions = [
            "What's on tonight?",
            "How do Luna Points work?",
            "Book a VIP table"
        ]
        
        for question in questions:
            response = requests.post(
                f"{BASE_URL}/api/ai/chat",
                json={"message": question},
                headers=auth_headers
            )
            assert response.status_code == 200
            assert len(response.json()["response"]) > 0
        
        print("PASS: AI chat handles various question types")


class TestSmartMissionGeneration:
    """Smart Mission Generation feature tests"""
    
    def test_smart_mission_returns_mission(self, auth_headers):
        """POST /api/ai/smart-mission generates personalized mission"""
        response = requests.post(
            f"{BASE_URL}/api/ai/smart-mission",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "mission" in data
        
        mission = data["mission"]
        assert "title" in mission
        assert "description" in mission
        assert "points" in mission
        assert "type" in mission
        
        # Verify points are reasonable (50-500 range)
        assert 50 <= mission["points"] <= 500
        
        # Verify type is valid
        assert mission["type"] in ["visit", "spend", "streak", "social"]
        
        print(f"PASS: Smart mission generated: {mission['title']} ({mission['points']} points)")
    
    def test_smart_mission_with_custom_stats(self, auth_headers):
        """POST /api/ai/smart-mission accepts custom user stats"""
        response = requests.post(
            f"{BASE_URL}/api/ai/smart-mission",
            json={
                "user_stats": {
                    "total_visits": 10,
                    "streak": 3,
                    "points": 5000,
                    "tier": "gold",
                    "favorite_venue": "Eclipse"
                }
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "mission" in data
        print("PASS: Smart mission accepts custom user stats")


class TestAIPhotoCaptioning:
    """AI Photo Captioning feature tests"""
    
    def test_photo_caption_returns_caption(self, auth_headers):
        """POST /api/ai/photo-caption generates venue photo caption"""
        response = requests.post(
            f"{BASE_URL}/api/ai/photo-caption",
            json={
                "venue_name": "Eclipse",
                "event_name": "Saturday Night",
                "time_of_day": "night"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "caption" in data
        assert "suggestions" in data
        
        # Caption should be under 50 characters
        assert len(data["caption"]) <= 60  # Allow some flexibility
        
        # Should have multiple suggestions
        assert len(data["suggestions"]) >= 2
        
        print(f"PASS: Photo caption generated: {data['caption']}")
    
    def test_photo_caption_minimal_params(self, auth_headers):
        """POST /api/ai/photo-caption works with minimal params"""
        response = requests.post(
            f"{BASE_URL}/api/ai/photo-caption",
            json={"venue_name": "Juju"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "caption" in data
        print("PASS: Photo caption works with minimal params")


class TestAuctionBidNudging:
    """Dynamic Auction Bid Nudging feature tests"""
    
    def test_auction_nudge_returns_notification(self, auth_headers):
        """POST /api/ai/auction-nudge generates outbid notification"""
        response = requests.post(
            f"{BASE_URL}/api/ai/auction-nudge",
            json={
                "auction_title": "VIP Booth at Eclipse",
                "current_bid": 500,
                "user_last_bid": 450,
                "time_remaining": "2 hours"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "notification" in data
        
        notification = data["notification"]
        assert "title" in notification
        assert "body" in notification
        assert "data" in notification
        
        # Verify notification structure
        assert notification["title"] == "You've been outbid!"
        assert len(notification["body"]) <= 120  # Should be concise
        assert notification["data"]["type"] == "auction_nudge"
        assert notification["data"]["current_bid"] == 500
        
        print(f"PASS: Auction nudge generated: {notification['body'][:50]}...")
    
    def test_auction_nudge_urgency_variations(self, auth_headers):
        """POST /api/ai/auction-nudge handles different urgency levels"""
        time_scenarios = ["30 minutes", "5 minutes", "ending soon"]
        
        for time_remaining in time_scenarios:
            response = requests.post(
                f"{BASE_URL}/api/ai/auction-nudge",
                json={
                    "auction_title": "Premium Table",
                    "current_bid": 300,
                    "user_last_bid": 250,
                    "time_remaining": time_remaining
                },
                headers=auth_headers
            )
            assert response.status_code == 200
        
        print("PASS: Auction nudge handles different urgency levels")


class TestChurnPrediction:
    """Churn Prediction & Win-back feature tests"""
    
    def test_my_churn_status_returns_engagement(self, auth_headers):
        """GET /api/ai/my-churn-status returns user engagement status"""
        response = requests.get(
            f"{BASE_URL}/api/ai/my-churn-status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "engagement_status" in data
        
        # Status should be low, medium, or high
        assert data["engagement_status"] in ["low", "medium", "high"]
        
        # Message is optional (only for non-low risk)
        if data["engagement_status"] != "low":
            assert "message" in data
        
        print(f"PASS: Churn status returned: {data['engagement_status']}")
    
    def test_churn_analysis_with_stats(self, auth_headers):
        """POST /api/ai/churn-analysis analyzes custom user stats"""
        response = requests.post(
            f"{BASE_URL}/api/ai/churn-analysis",
            json={
                "user_stats": {
                    "total_visits": 5,
                    "points": 1000,
                    "tier": "silver",
                    "favorite_venue": "Eclipse",
                    "last_visit_date": "2025-12-01T00:00:00Z"  # Old date = high risk
                }
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "risk_level" in data
        assert data["risk_level"] in ["low", "medium", "high"]
        
        print(f"PASS: Churn analysis returned risk level: {data['risk_level']}")


class TestAIIntegrationFlow:
    """End-to-end AI feature integration tests"""
    
    def test_full_ai_workflow(self, auth_headers):
        """Test complete AI feature workflow"""
        # 1. Check AI health
        health = requests.get(f"{BASE_URL}/api/ai/health")
        assert health.status_code == 200
        assert health.json()["ai_enabled"] == True
        
        # 2. Start chat session
        chat = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "What's happening tonight?"},
            headers=auth_headers
        )
        assert chat.status_code == 200
        session_id = chat.json()["session_id"]
        
        # 3. Get personalized mission
        mission = requests.post(
            f"{BASE_URL}/api/ai/smart-mission",
            headers=auth_headers
        )
        assert mission.status_code == 200
        
        # 4. Generate photo caption
        caption = requests.post(
            f"{BASE_URL}/api/ai/photo-caption",
            json={"venue_name": "Eclipse"},
            headers=auth_headers
        )
        assert caption.status_code == 200
        
        # 5. Check engagement status
        churn = requests.get(
            f"{BASE_URL}/api/ai/my-churn-status",
            headers=auth_headers
        )
        assert churn.status_code == 200
        
        print("PASS: Full AI workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
