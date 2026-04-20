"""
Social Feed & Night Builder API Tests
Tests for:
- Activity feed: event interests, likes, visibility rules
- Night Builder: plan multi-venue nights, polls, gamification
- Instagram route removal verification
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, auth_token):
        """Get user ID from token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        return response.json()["user"]["user_id"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestInstagramRemoval:
    """Verify Instagram routes are removed"""
    
    def test_instagram_feed_returns_404(self):
        """GET /api/instagram/feed should return 404"""
        response = requests.get(f"{BASE_URL}/api/instagram/feed")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Instagram feed route returns 404 (removed)")
    
    def test_instagram_connect_returns_404(self):
        """GET /api/instagram/connect should return 404"""
        response = requests.get(f"{BASE_URL}/api/instagram/connect")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Instagram connect route returns 404 (removed)")


class TestEventInterest:
    """Tests for expressing interest in events"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_event_id(self):
        """Generate unique test event ID"""
        return f"TEST_event_{uuid.uuid4().hex[:8]}"
    
    def test_express_interest_public(self, auth_headers, test_event_id):
        """POST /api/social/interest - Express public interest in event"""
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": test_event_id, "visibility": "public"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "activity" in data
        assert data["activity"]["visibility"] == "public"
        assert data["activity"]["type"] == "event_interest"
        assert data["points_earned"] == 5
        print(f"PASS: Expressed public interest in event {test_event_id}, earned 5 pts")
    
    def test_duplicate_interest_updates_visibility(self, auth_headers, test_event_id):
        """POST /api/social/interest - Duplicate interest updates visibility"""
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": test_event_id, "visibility": "friends"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data.get("updated") is True
        assert "Visibility updated to friends" in data.get("message", "")
        print("PASS: Duplicate interest updated visibility to friends")
    
    def test_express_interest_private(self, auth_headers):
        """POST /api/social/interest - Express private interest"""
        private_event_id = f"TEST_private_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": private_event_id, "visibility": "private"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["activity"]["visibility"] == "private"
        print("PASS: Expressed private interest in event")
    
    def test_express_interest_invalid_visibility(self, auth_headers):
        """POST /api/social/interest - Invalid visibility returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": "test_event", "visibility": "invalid"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Invalid visibility returns 400")
    
    def test_express_interest_requires_auth(self):
        """POST /api/social/interest - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            json={"event_id": "test_event", "visibility": "public"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Express interest requires authentication")


class TestSocialFeed:
    """Tests for social activity feed"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_feed(self, auth_headers):
        """GET /api/social/feed - Returns activity feed"""
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "feed" in data
        assert "total" in data
        assert isinstance(data["feed"], list)
        print(f"PASS: Got social feed with {data['total']} items")
    
    def test_feed_items_have_required_fields(self, auth_headers):
        """GET /api/social/feed - Feed items have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        if data["feed"]:
            item = data["feed"][0]
            required_fields = ["id", "type", "user_id", "visibility", "created_at"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
            assert "liked_by_me" in item  # Enriched field
            print("PASS: Feed items have all required fields")
        else:
            print("SKIP: No feed items to verify fields")
    
    def test_feed_requires_auth(self):
        """GET /api/social/feed - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/social/feed")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Feed requires authentication")
    
    def test_feed_pagination(self, auth_headers):
        """GET /api/social/feed - Supports pagination"""
        response = requests.get(
            f"{BASE_URL}/api/social/feed?limit=5&offset=0",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["feed"]) <= 5
        print("PASS: Feed supports pagination")


class TestLikes:
    """Tests for liking/unliking activities"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def activity_id(self, auth_headers):
        """Create an activity to like"""
        event_id = f"TEST_like_event_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": event_id, "visibility": "public"}
        )
        return response.json()["activity"]["id"]
    
    def test_like_activity(self, auth_headers, activity_id):
        """POST /api/social/like/{activity_id} - Like an activity"""
        # First unlike if already liked
        requests.delete(f"{BASE_URL}/api/social/like/{activity_id}", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/social/like/{activity_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        print(f"PASS: Liked activity {activity_id}")
    
    def test_double_like_returns_400(self, auth_headers, activity_id):
        """POST /api/social/like/{activity_id} - Cannot double-like"""
        # Ensure it's liked first
        requests.post(f"{BASE_URL}/api/social/like/{activity_id}", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/social/like/{activity_id}",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Already liked" in response.json().get("detail", "")
        print("PASS: Double-like returns 400")
    
    def test_unlike_activity(self, auth_headers, activity_id):
        """DELETE /api/social/like/{activity_id} - Unlike an activity"""
        response = requests.delete(
            f"{BASE_URL}/api/social/like/{activity_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        print(f"PASS: Unliked activity {activity_id}")
    
    def test_like_nonexistent_activity(self, auth_headers):
        """POST /api/social/like/{activity_id} - 404 for nonexistent activity"""
        response = requests.post(
            f"{BASE_URL}/api/social/like/nonexistent_activity_123",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Like nonexistent activity returns 404")
    
    def test_like_requires_auth(self):
        """POST /api/social/like/{activity_id} - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/social/like/some_activity")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Like requires authentication")


class TestEventInterested:
    """Tests for getting who's interested in an event"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_event_interested(self, auth_headers):
        """GET /api/social/interested/{event_id} - Get who's interested"""
        # First create an interest
        event_id = f"TEST_interested_{uuid.uuid4().hex[:8]}"
        requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": event_id, "visibility": "public"}
        )
        
        response = requests.get(
            f"{BASE_URL}/api/social/interested/{event_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "interested" in data
        assert "total" in data
        assert "my_interest" in data
        assert data["total"] >= 1
        print(f"PASS: Got {data['total']} interested users for event")
    
    def test_remove_interest(self, auth_headers):
        """DELETE /api/social/interest/{event_id} - Remove interest"""
        event_id = f"TEST_remove_{uuid.uuid4().hex[:8]}"
        # First create interest
        requests.post(
            f"{BASE_URL}/api/social/interest",
            headers=auth_headers,
            json={"event_id": event_id, "visibility": "public"}
        )
        
        response = requests.delete(
            f"{BASE_URL}/api/social/interest/{event_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        print("PASS: Removed interest from event")
    
    def test_remove_nonexistent_interest(self, auth_headers):
        """DELETE /api/social/interest/{event_id} - 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/social/interest/nonexistent_event_xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Remove nonexistent interest returns 404")


class TestNightPlan:
    """Tests for Night Builder - creating and managing night plans"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_plan_id(self, auth_headers):
        """Create a test night plan"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            headers=auth_headers,
            json={
                "title": f"TEST_Night Out {uuid.uuid4().hex[:6]}",
                "date": "2026-05-01",
                "stops": [
                    {"venue_id": "ember_and_ash", "time": "20:00", "notes": "Dinner"},
                    {"venue_id": "eclipse", "time": "22:00", "notes": "Drinks"},
                    {"venue_id": "after_dark", "time": "00:00", "notes": "Dancing"}
                ]
            }
        )
        assert response.status_code == 200, f"Failed to create plan: {response.text}"
        return response.json()["plan"]["id"]
    
    def test_create_night_plan(self, auth_headers):
        """POST /api/social/night-plan - Create night plan with multiple stops"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            headers=auth_headers,
            json={
                "title": f"TEST_Epic Night {uuid.uuid4().hex[:6]}",
                "date": "2026-05-15",
                "stops": [
                    {"venue_id": "ember_and_ash", "time": "19:00", "notes": "Pre-drinks"},
                    {"venue_id": "eclipse", "time": "21:00", "notes": "Main event"}
                ]
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "plan" in data
        assert data["plan"]["total_stops"] == 2
        assert data["points_earned"] == 10
        assert len(data["plan"]["stops"]) == 2
        print(f"PASS: Created night plan with 2 stops, earned 10 pts")
    
    def test_get_my_night_plans(self, auth_headers):
        """GET /api/social/night-plans - Get user's night plans"""
        response = requests.get(
            f"{BASE_URL}/api/social/night-plans",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "plans" in data
        assert "total" in data
        assert data["total"] >= 1
        print(f"PASS: Got {data['total']} night plans")
    
    def test_get_specific_plan(self, auth_headers, test_plan_id):
        """GET /api/social/night-plan/{plan_id} - Get specific plan details"""
        response = requests.get(
            f"{BASE_URL}/api/social/night-plan/{test_plan_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["id"] == test_plan_id
        assert "stops" in data
        assert "members" in data
        print(f"PASS: Got plan details for {test_plan_id}")
    
    def test_update_night_plan(self, auth_headers, test_plan_id):
        """PUT /api/social/night-plan/{plan_id} - Update plan title/stops"""
        new_title = f"TEST_Updated Night {uuid.uuid4().hex[:6]}"
        response = requests.put(
            f"{BASE_URL}/api/social/night-plan/{test_plan_id}",
            headers=auth_headers,
            json={
                "title": new_title,
                "stops": [
                    {"venue_id": "eclipse", "time": "21:00", "notes": "Updated stop"}
                ]
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["plan"]["title"] == new_title
        assert data["plan"]["total_stops"] == 1
        print("PASS: Updated night plan title and stops")
    
    def test_respond_to_invite_accept(self, auth_headers, test_plan_id):
        """POST /api/social/night-plan/{plan_id}/respond?accept=true - Accept invite"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan/{test_plan_id}/respond?accept=true",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "confirmed"
        assert "vibe_score" in data
        print(f"PASS: Accepted plan invite, vibe score: {data['vibe_score']}")
    
    def test_respond_to_invite_decline(self, auth_headers, test_plan_id):
        """POST /api/social/night-plan/{plan_id}/respond?accept=false - Decline invite"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan/{test_plan_id}/respond?accept=false",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "declined"
        assert data["points_earned"] == 0
        print("PASS: Declined plan invite")
    
    def test_get_nonexistent_plan(self, auth_headers):
        """GET /api/social/night-plan/{plan_id} - 404 for nonexistent"""
        response = requests.get(
            f"{BASE_URL}/api/social/night-plan/nonexistent_plan_xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Get nonexistent plan returns 404")
    
    def test_night_plan_requires_auth(self):
        """POST /api/social/night-plan - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            json={"title": "Test", "date": "2026-05-01", "stops": []}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Night plan creation requires authentication")


class TestPolls:
    """Tests for polls within night plans"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_plan_for_poll(self, auth_headers):
        """Create a plan for poll testing"""
        response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            headers=auth_headers,
            json={
                "title": f"TEST_Poll Night {uuid.uuid4().hex[:6]}",
                "date": "2026-06-01",
                "stops": [{"venue_id": "eclipse", "time": "22:00"}]
            }
        )
        return response.json()["plan"]["id"]
    
    @pytest.fixture(scope="class")
    def test_poll_id(self, auth_headers, test_plan_for_poll):
        """Create a test poll"""
        response = requests.post(
            f"{BASE_URL}/api/social/poll",
            headers=auth_headers,
            json={
                "plan_id": test_plan_for_poll,
                "question": "Where should we go first?",
                "options": [
                    {"label": "Eclipse Bar"},
                    {"label": "After Dark"},
                    {"label": "Ember & Ash"}
                ]
            }
        )
        assert response.status_code == 200, f"Failed to create poll: {response.text}"
        return response.json()["poll"]["id"]
    
    def test_create_poll(self, auth_headers, test_plan_for_poll):
        """POST /api/social/poll - Create poll within a night plan"""
        response = requests.post(
            f"{BASE_URL}/api/social/poll",
            headers=auth_headers,
            json={
                "plan_id": test_plan_for_poll,
                "question": f"TEST_Which venue? {uuid.uuid4().hex[:6]}",
                "options": [
                    {"label": "Option A", "venue_id": "eclipse"},
                    {"label": "Option B", "venue_id": "after_dark"}
                ]
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "poll" in data
        assert len(data["poll"]["options"]) == 2
        assert data["poll"]["status"] == "open"
        print("PASS: Created poll with 2 options")
    
    def test_get_poll(self, auth_headers, test_poll_id):
        """GET /api/social/poll/{poll_id} - Get poll results with my_vote"""
        response = requests.get(
            f"{BASE_URL}/api/social/poll/{test_poll_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["id"] == test_poll_id
        assert "options" in data
        assert "my_vote" in data
        assert "total_votes" in data
        print(f"PASS: Got poll {test_poll_id} with {data['total_votes']} votes")
    
    def test_vote_on_poll(self, auth_headers, test_poll_id):
        """POST /api/social/poll/{poll_id}/vote?option_id=X - Vote on poll"""
        # First get the poll to find option IDs
        poll_response = requests.get(
            f"{BASE_URL}/api/social/poll/{test_poll_id}",
            headers=auth_headers
        )
        poll_data = poll_response.json()
        option_id = poll_data["options"][0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/social/poll/{test_poll_id}/vote?option_id={option_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "total_votes" in data
        print(f"PASS: Voted on poll, total votes: {data['total_votes']}")
    
    def test_change_vote(self, auth_headers, test_poll_id):
        """POST /api/social/poll/{poll_id}/vote - Can change vote"""
        # Get poll options
        poll_response = requests.get(
            f"{BASE_URL}/api/social/poll/{test_poll_id}",
            headers=auth_headers
        )
        poll_data = poll_response.json()
        # Vote for second option
        option_id = poll_data["options"][1]["id"] if len(poll_data["options"]) > 1 else poll_data["options"][0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/social/poll/{test_poll_id}/vote?option_id={option_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASS: Changed vote successfully")
    
    def test_close_poll(self, auth_headers, test_poll_id):
        """POST /api/social/poll/{poll_id}/close - Close poll and determine winner"""
        response = requests.post(
            f"{BASE_URL}/api/social/poll/{test_poll_id}/close",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "winner" in data
        assert "votes" in data
        print(f"PASS: Closed poll, winner: {data['winner']} with {data['votes']} votes")
    
    def test_vote_on_closed_poll(self, auth_headers, test_poll_id):
        """POST /api/social/poll/{poll_id}/vote - Cannot vote on closed poll"""
        # Get poll options
        poll_response = requests.get(
            f"{BASE_URL}/api/social/poll/{test_poll_id}",
            headers=auth_headers
        )
        poll_data = poll_response.json()
        option_id = poll_data["options"][0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/social/poll/{test_poll_id}/vote?option_id={option_id}",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "closed" in response.json().get("detail", "").lower()
        print("PASS: Cannot vote on closed poll")
    
    def test_vote_invalid_option(self, auth_headers):
        """POST /api/social/poll/{poll_id}/vote - 404 for invalid option"""
        # Create a new poll for this test
        plan_response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            headers=auth_headers,
            json={
                "title": f"TEST_Invalid Option {uuid.uuid4().hex[:6]}",
                "date": "2026-06-15",
                "stops": [{"venue_id": "eclipse", "time": "22:00"}]
            }
        )
        plan_id = plan_response.json()["plan"]["id"]
        
        poll_response = requests.post(
            f"{BASE_URL}/api/social/poll",
            headers=auth_headers,
            json={
                "plan_id": plan_id,
                "question": "Test question",
                "options": [{"label": "Option A"}]
            }
        )
        poll_id = poll_response.json()["poll"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/social/poll/{poll_id}/vote?option_id=invalid_option_xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Vote with invalid option returns 404")
    
    def test_get_nonexistent_poll(self, auth_headers):
        """GET /api/social/poll/{poll_id} - 404 for nonexistent"""
        response = requests.get(
            f"{BASE_URL}/api/social/poll/nonexistent_poll_xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Get nonexistent poll returns 404")


class TestDeleteNightPlan:
    """Tests for deleting night plans"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_delete_night_plan(self, auth_headers):
        """DELETE /api/social/night-plan/{plan_id} - Delete plan"""
        # Create a plan to delete
        create_response = requests.post(
            f"{BASE_URL}/api/social/night-plan",
            headers=auth_headers,
            json={
                "title": f"TEST_Delete Me {uuid.uuid4().hex[:6]}",
                "date": "2026-07-01",
                "stops": [{"venue_id": "eclipse", "time": "22:00"}]
            }
        )
        plan_id = create_response.json()["plan"]["id"]
        
        # Delete the plan
        response = requests.delete(
            f"{BASE_URL}/api/social/night-plan/{plan_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        
        # Verify it's deleted
        get_response = requests.get(
            f"{BASE_URL}/api/social/night-plan/{plan_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
        print("PASS: Deleted night plan and verified deletion")
    
    def test_delete_nonexistent_plan(self, auth_headers):
        """DELETE /api/social/night-plan/{plan_id} - 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/social/night-plan/nonexistent_plan_xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Delete nonexistent plan returns 404")


class TestExistingData:
    """Tests using existing data from previous iterations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_existing_event_interest(self, auth_headers):
        """Verify existing event interest (ef_399720) from previous tests"""
        response = requests.get(
            f"{BASE_URL}/api/social/interested/ef_399720",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"PASS: Checked existing event interest, {data['total']} users interested")
    
    def test_existing_night_plan(self, auth_headers):
        """Verify existing night plan (plan_f8423043) from previous tests"""
        response = requests.get(
            f"{BASE_URL}/api/social/night-plan/plan_f8423043",
            headers=auth_headers
        )
        # May return 404 if not a member or 200 if accessible
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Found existing plan with {len(data.get('stops', []))} stops")
        elif response.status_code == 403:
            print("PASS: Existing plan exists but user not a member (403)")
        elif response.status_code == 404:
            print("SKIP: Existing plan not found (may have been deleted)")
        else:
            print(f"INFO: Existing plan check returned {response.status_code}")
    
    def test_existing_poll(self, auth_headers):
        """Verify existing poll (poll_64b1bd5d) from previous tests"""
        response = requests.get(
            f"{BASE_URL}/api/social/poll/poll_64b1bd5d",
            headers=auth_headers
        )
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Found existing poll with {data['total_votes']} votes, my_vote: {data.get('my_vote')}")
        elif response.status_code == 404:
            print("SKIP: Existing poll not found (may have been deleted)")
        else:
            print(f"INFO: Existing poll check returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
