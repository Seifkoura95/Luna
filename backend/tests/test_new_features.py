"""
Test suite for new features:
1. AI Personalized Events (Tonight's Pick)
2. Stories API
3. Venue Portal AI Insights (backend endpoints)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com')

# Test credentials
MOBILE_USER = {"email": "luna@test.com", "password": "test123"}
VENUE_USER = {"email": "venue@eclipse.com", "password": "venue123"}


class TestAuth:
    """Authentication tests"""
    
    def test_mobile_login(self):
        """Test mobile app login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=MOBILE_USER
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == MOBILE_USER["email"]
        print(f"✓ Mobile login successful for {MOBILE_USER['email']}")
        return data["token"]


class TestAIPersonalizedEvents:
    """Tests for AI Personalized Events (Tonight's Pick feature)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=MOBILE_USER
        )
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_ai_personalized_events_endpoint(self, auth_token):
        """Test POST /api/ai/personalized-events returns personalized event list"""
        test_events = [
            {"id": "test1", "title": "Test Event 1", "venue_name": "Eclipse"},
            {"id": "test2", "title": "DJ Night", "venue_name": "After Dark"},
            {"id": "test3", "title": "VIP Party", "venue_name": "Su Casa"}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/ai/personalized-events",
            json={"events": test_events},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "personalized" in data
        assert data["personalized"] == True
        assert len(data["events"]) > 0
        print(f"✓ AI personalized events returned {len(data['events'])} events")
    
    def test_ai_personalized_events_with_ai_recommended_flag(self, auth_token):
        """Test that events can have ai_recommended flag"""
        test_events = [
            {"id": "test1", "title": "Test Event", "venue_name": "Eclipse", "ai_recommended": True}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/ai/personalized-events",
            json={"events": test_events},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print("✓ AI personalized events accepts ai_recommended flag")
    
    def test_ai_health_endpoint(self):
        """Test AI health endpoint"""
        response = requests.get(f"{BASE_URL}/api/ai/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "ai_enabled" in data
        print(f"✓ AI health: status={data['status']}, ai_enabled={data['ai_enabled']}")


class TestStoriesAPI:
    """Tests for Stories API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=MOBILE_USER
        )
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_get_my_stories(self, auth_token):
        """Test GET /api/stories/my-stories returns user's stories"""
        response = requests.get(
            f"{BASE_URL}/api/stories/my-stories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "stories" in data
        print(f"✓ My stories returned {len(data['stories'])} stories")
        
        # Verify story structure if stories exist
        if len(data["stories"]) > 0:
            story = data["stories"][0]
            assert "id" in story
            assert "photo_url" in story
            assert "caption" in story
            assert "venue_name" in story
            assert "shares" in story
            assert "created_at" in story
            print("✓ Story structure verified")
    
    def test_get_story_feed(self, auth_token):
        """Test GET /api/stories/feed returns community story feed"""
        response = requests.get(
            f"{BASE_URL}/api/stories/feed?limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "stories" in data
        print(f"✓ Story feed returned {len(data['stories'])} stories")
        
        # Verify feed story structure includes user info
        if len(data["stories"]) > 0:
            story = data["stories"][0]
            assert "user" in story
            assert "name" in story["user"]
            assert "tier" in story["user"]
            print("✓ Feed story includes user info")
    
    def test_create_story(self, auth_token):
        """Test POST /api/stories/create creates a new story"""
        story_data = {
            "photo_url": "https://example.com/test-story.jpg",
            "venue_id": "eclipse",
            "venue_name": "Eclipse Brisbane",
            "caption": "Test story from automated tests"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stories/create",
            json=story_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "story" in data
        assert data["story"]["venue_name"] == story_data["venue_name"]
        print(f"✓ Story created with id: {data['story']['id']}")
        return data["story"]["id"]
    
    def test_share_story(self, auth_token):
        """Test POST /api/stories/share records share and awards points"""
        # First create a story
        story_data = {
            "photo_url": "https://example.com/share-test.jpg",
            "venue_id": "eclipse",
            "venue_name": "Eclipse Brisbane",
            "caption": "Story for share test"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/stories/create",
            json=story_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert create_response.status_code == 200
        story_id = create_response.json()["story"]["id"]
        
        # Test sharing to different platforms
        platforms = ["instagram", "facebook", "twitter", "copy_link"]
        for platform in platforms:
            share_response = requests.post(
                f"{BASE_URL}/api/stories/share",
                json={"story_id": story_id, "platform": platform},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            assert share_response.status_code == 200
            share_data = share_response.json()
            assert share_data["success"] == True
            assert share_data["points_earned"] == 25
            print(f"✓ Story shared to {platform}, earned {share_data['points_earned']} points")
    
    def test_stories_require_auth(self):
        """Test that stories endpoints require authentication"""
        # Test my-stories without auth
        response = requests.get(f"{BASE_URL}/api/stories/my-stories")
        assert response.status_code == 401
        
        # Test feed without auth
        response = requests.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code == 401
        
        print("✓ Stories endpoints properly require authentication")


class TestVenuePortalAI:
    """Tests for Venue Portal AI endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=MOBILE_USER
        )
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_ai_chat_endpoint(self, auth_token):
        """Test POST /api/ai/chat for venue AI insights"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={
                "message": "What are the peak hours for my venue?",
                "session_id": "test-venue-session"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 0
        print(f"✓ AI chat response received: {data['response'][:100]}...")


class TestEventsFeed:
    """Tests for Events Feed API (used by Tonight's Pick)"""
    
    def test_events_feed(self):
        """Test GET /api/events/feed returns event categories"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected fields
        assert "tonight" in data or "upcoming" in data
        assert "source" in data
        print(f"✓ Events feed returned, source: {data.get('source', 'unknown')}")
        
        # Check upcoming events
        upcoming = data.get("upcoming", [])
        if len(upcoming) > 0:
            event = upcoming[0]
            assert "id" in event
            assert "title" in event
            print(f"✓ Found {len(upcoming)} upcoming events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
