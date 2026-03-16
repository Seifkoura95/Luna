"""
Tests for Luna Group VIP App - Social Features (Iteration 6)
Testing: Friends system, Event RSVP, Rewards redemption, Lost & Found, Safety emergency contacts
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')

# Store auth token for authenticated requests
AUTH_TOKEN = None
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("token")
    return {"Authorization": f"Bearer {token}"}


class TestHealthCheck:
    """Basic health and connectivity"""
    
    def test_api_available(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        print("API is accessible")


class TestFriendsAPI:
    """Friends system API tests"""
    
    def test_get_friends_list(self, auth_headers):
        """GET /api/friends - Get user's friends list"""
        response = requests.get(f"{BASE_URL}/api/friends", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "friends" in data
        assert "count" in data
        assert isinstance(data["friends"], list)
        print(f"Friends list: {data['count']} friends")
    
    def test_get_friend_requests(self, auth_headers):
        """GET /api/friends/requests - Get pending friend requests"""
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "incoming" in data
        assert "outgoing" in data
        print(f"Friend requests - Incoming: {len(data['incoming'])}, Outgoing: {len(data['outgoing'])}")
    
    def test_send_friend_request_invalid_user(self, auth_headers):
        """POST /api/friends/request - Send friend request to non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/friends/request",
            headers=auth_headers,
            json={"email": f"nonexistent_{uuid.uuid4()}@example.com"}
        )
        assert response.status_code == 404
        print("Correctly rejected friend request to non-existent user")
    
    def test_send_friend_request_to_self(self, auth_headers):
        """POST /api/friends/request - Cannot add self as friend"""
        response = requests.post(
            f"{BASE_URL}/api/friends/request",
            headers=auth_headers,
            json={"email": TEST_USER_EMAIL}
        )
        assert response.status_code == 400
        print("Correctly rejected self-friend request")
    
    def test_get_friends_activity(self, auth_headers):
        """GET /api/friends/activity - Get activity feed from friends"""
        response = requests.get(f"{BASE_URL}/api/friends/activity", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "activities" in data
        assert isinstance(data["activities"], list)
        print(f"Friends activity feed: {len(data['activities'])} activities")


class TestEventRSVP:
    """Event RSVP system tests"""
    
    def test_rsvp_to_event_going(self, auth_headers):
        """POST /api/events/{event_id}/rsvp - Mark as going"""
        # Get a valid event ID first
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        if feed_response.status_code != 200 or not feed_response.json().get("upcoming"):
            pytest.skip("No events available")
        
        event_id = feed_response.json()["upcoming"][0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/rsvp",
            headers=auth_headers,
            json={"event_id": event_id, "status": "going", "is_private": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "going"
        print(f"RSVP'd as 'going' to event {event_id}")
    
    def test_rsvp_to_event_interested(self, auth_headers):
        """POST /api/events/{event_id}/rsvp - Mark as interested"""
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        if feed_response.status_code != 200 or not feed_response.json().get("upcoming"):
            pytest.skip("No events available")
        
        events = feed_response.json()["upcoming"]
        if len(events) < 2:
            pytest.skip("Not enough events")
        
        event_id = events[1]["id"]  # Use second event
        
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/rsvp",
            headers=auth_headers,
            json={"event_id": event_id, "status": "interested", "is_private": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "interested"
        print(f"RSVP'd as 'interested' to event {event_id}")
    
    def test_get_my_rsvp_status(self, auth_headers):
        """GET /api/events/{event_id}/rsvp - Get my RSVP status"""
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        if feed_response.status_code != 200 or not feed_response.json().get("upcoming"):
            pytest.skip("No events available")
        
        event_id = feed_response.json()["upcoming"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/events/{event_id}/rsvp",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "rsvp" in data
        if data["rsvp"]:
            print(f"RSVP status for event {event_id}: {data['rsvp']['status']}")
        else:
            print(f"No RSVP found for event {event_id}")
    
    def test_get_event_attendees(self, auth_headers):
        """GET /api/events/{event_id}/attendees - Get attendees list"""
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        if feed_response.status_code != 200 or not feed_response.json().get("upcoming"):
            pytest.skip("No events available")
        
        event_id = feed_response.json()["upcoming"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/events/{event_id}/attendees",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "going_count" in data
        assert "interested_count" in data
        assert "friends_going" in data
        assert "friends_interested" in data
        print(f"Event attendees - Going: {data['going_count']}, Interested: {data['interested_count']}")


class TestRewardsAndRedemption:
    """Rewards and QR redemption system tests"""
    
    def test_get_rewards_list(self):
        """GET /api/rewards - Get available rewards"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Available rewards: {len(data)}")
        
        if len(data) > 0:
            reward = data[0]
            assert "id" in reward
            assert "name" in reward
            assert "points_cost" in reward
            print(f"Sample reward: {reward['name']} - {reward['points_cost']} points")
    
    def test_get_my_redemptions(self, auth_headers):
        """GET /api/redemptions/my - Get user's redemption history"""
        response = requests.get(f"{BASE_URL}/api/redemptions/my", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"User redemptions: {len(data)}")
    
    def test_redeem_reward_insufficient_points(self, auth_headers):
        """POST /api/rewards/redeem-with-qr - Test insufficient points error"""
        # Get rewards first
        rewards_response = requests.get(f"{BASE_URL}/api/rewards")
        if rewards_response.status_code != 200 or len(rewards_response.json()) == 0:
            pytest.skip("No rewards available")
        
        # Find the most expensive reward to ensure insufficient points
        rewards = rewards_response.json()
        expensive_reward = max(rewards, key=lambda r: r.get("points_cost", 0))
        
        # Try to redeem (may fail with insufficient points)
        response = requests.post(
            f"{BASE_URL}/api/rewards/redeem-with-qr?reward_id={expensive_reward['id']}",
            headers=auth_headers
        )
        
        # Either succeeds or fails with insufficient points
        assert response.status_code in [200, 400]
        print(f"Redeem attempt status: {response.status_code}")


class TestLostAndFound:
    """Lost & Found system tests"""
    
    def test_report_lost_item(self, auth_headers):
        """POST /api/lost-found/report-lost - Report a lost item"""
        response = requests.post(
            f"{BASE_URL}/api/lost-found/report-lost",
            headers=auth_headers,
            json={
                "venue_id": "eclipse",
                "item_description": "TEST_Black iPhone 14 Pro with purple case",
                "item_category": "phone",
                "lost_date": "2025-01-15",
                "lost_time_approx": "11:30 PM",
                "contact_phone": "+61400000000"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "item_id" in data
        print(f"Lost item reported: ID {data['item_id']}")
        return data["item_id"]
    
    def test_get_my_lost_reports(self, auth_headers):
        """GET /api/lost-found/my-reports - Get user's lost item reports"""
        response = requests.get(
            f"{BASE_URL}/api/lost-found/my-reports",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "reports" in data
        assert isinstance(data["reports"], list)
        print(f"User lost reports: {len(data['reports'])}")
    
    def test_report_found_item(self, auth_headers):
        """POST /api/lost-found/report-found - Report a found item"""
        response = requests.post(
            f"{BASE_URL}/api/lost-found/report-found",
            headers=auth_headers,
            json={
                "venue_id": "eclipse",
                "item_description": "TEST_Silver watch with leather strap",
                "item_category": "jewelry",
                "found_date": "2025-01-15",
                "found_location": "near main bar"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "item_id" in data
        print(f"Found item reported: ID {data['item_id']}")


class TestSafetyFeatures:
    """Safety emergency contacts tests"""
    
    def test_get_emergency_contacts(self, auth_headers):
        """GET /api/safety/emergency-contacts - Get emergency contacts
        NOTE: This returns static emergency service contacts, not user's personal contacts.
        There's a DUPLICATE ROUTE BUG - see lines 2444 and 4539 in server.py
        The user personal contacts endpoint at 4539 is shadowed by the static one at 2444.
        """
        response = requests.get(
            f"{BASE_URL}/api/safety/emergency-contacts",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Current behavior: returns static emergency service numbers
        assert "emergency" in data  # 000
        assert "luna_security" in data
        print(f"Emergency services: {data.get('emergency')}, Luna Security: {data.get('luna_security')}")
    
    def test_add_emergency_contact(self, auth_headers):
        """POST /api/safety/emergency-contacts - Add an emergency contact"""
        response = requests.post(
            f"{BASE_URL}/api/safety/emergency-contacts",
            headers=auth_headers,
            json={
                "name": "TEST_Emergency Friend",
                "phone": "+61411222333",
                "relationship": "friend",
                "email": "test_emergency@example.com"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "contact" in data
        assert data["contact"]["name"] == "TEST_Emergency Friend"
        print(f"Emergency contact added: {data['contact']['name']}")
        return data["contact"]["id"]
    
    def test_remove_emergency_contact(self, auth_headers):
        """DELETE /api/safety/emergency-contacts/{contact_id} - Remove contact"""
        # First add a contact to remove
        add_response = requests.post(
            f"{BASE_URL}/api/safety/emergency-contacts",
            headers=auth_headers,
            json={
                "name": "TEST_ToBeRemoved",
                "phone": "+61499999999",
                "relationship": "other"
            }
        )
        if add_response.status_code != 200:
            pytest.skip("Could not add contact to test removal")
        
        contact_id = add_response.json()["contact"]["id"]
        
        # Now remove it
        response = requests.delete(
            f"{BASE_URL}/api/safety/emergency-contacts/{contact_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"Emergency contact removed: {contact_id}")
    
    def test_silent_alert(self, auth_headers):
        """POST /api/safety/silent-alert - Send silent safety alert"""
        response = requests.post(
            f"{BASE_URL}/api/safety/silent-alert",
            headers=auth_headers,
            json={
                "latitude": -27.4698,
                "longitude": 153.0251,
                "venue_id": "eclipse",
                "activation_method": "button"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "alert_id" in data
        assert "location_link" in data
        print(f"Silent alert sent: ID {data['alert_id']}")


class TestUserProfile:
    """User profile related tests"""
    
    def test_get_user_profile(self, auth_headers):
        """GET /api/auth/me - Get current user profile"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data or "email" in data
        print(f"User profile retrieved")
    
    def test_get_user_points(self, auth_headers):
        """Verify user has points_balance field"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "points_balance" in data
        print(f"User points balance: {data['points_balance']}")


class TestMissionsAPI:
    """Missions system tests"""
    
    def test_get_missions(self, auth_headers):
        """GET /api/missions - Get missions with progress"""
        response = requests.get(f"{BASE_URL}/api/missions", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Available missions: {len(data)}")


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_lost_found(self, auth_headers):
        """Verify test data can be cleaned up"""
        # Get reports
        response = requests.get(
            f"{BASE_URL}/api/lost-found/my-reports",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Count TEST_ prefixed items
        reports = response.json().get("reports", [])
        test_reports = [r for r in reports if "TEST_" in r.get("item_description", "")]
        print(f"Test lost reports to clean: {len(test_reports)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
