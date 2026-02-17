"""
Tests for Luna Group VIP App - Events and Auth features
Testing: Events feed, Event detail, Login
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://luna-vip-app-1.preview.emergentagent.com')

class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_venues_endpoint(self):
        """Test venues endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/venues")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify venue structure
        venue = data[0]
        assert "id" in venue
        assert "name" in venue
        assert "type" in venue
        print(f"Found {len(data)} venues")

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "luna@test.com"
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        print(f"Login successful for user: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")

class TestEventsFeed:
    """Events feed endpoint tests - Core feature"""
    
    def test_events_feed_returns_data(self):
        """Test events feed returns Luna Group filtered events"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify structure
        assert "tonight" in data
        assert "tomorrow" in data
        assert "featured" in data
        assert "upcoming" in data
        assert "total_count" in data
        assert "source" in data
        
        # Verify source indicates Luna filtering
        assert data["source"] == "eventfinda_luna_filtered"
        print(f"Events feed returned {data['total_count']} Luna Group events")
    
    def test_events_feed_has_featured_events(self):
        """Test that featured events are returned"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["featured"]) > 0, "Should have featured events"
        
        # Check featured event structure
        featured = data["featured"][0]
        assert "id" in featured
        assert "title" in featured
        assert "venue_name" in featured
        assert "date" in featured
        assert "image" in featured
        print(f"Featured event: {featured['title']} at {featured['venue_name']}")
    
    def test_events_have_luna_venue_field(self):
        """Test that all events have luna_venue field"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        for event in upcoming[:5]:  # Check first 5
            assert "luna_venue" in event, f"Event {event['title']} missing luna_venue field"
            print(f"Event '{event['title']}' -> luna_venue: {event['luna_venue']}")

class TestEventDetail:
    """Event detail endpoint tests - Reported bug area"""
    
    def test_event_detail_by_id(self):
        """Test fetching a specific event by ID"""
        # First get an event ID from the feed
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=5")
        assert feed_response.status_code == 200
        
        feed_data = feed_response.json()
        if not feed_data.get("upcoming"):
            pytest.skip("No events available in feed")
        
        event_id = feed_data["upcoming"][0]["id"]
        print(f"Testing event detail for ID: {event_id}")
        
        # Fetch event detail
        response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        
        event = response.json()
        assert "id" in event
        assert "title" in event
        assert "venue_name" in event
        assert "description" in event
        print(f"Event detail fetched: {event['title']}")
    
    def test_event_detail_ef_398404(self):
        """Test specific event ID from user report"""
        response = requests.get(f"{BASE_URL}/api/events/ef_398404")
        assert response.status_code == 200
        
        event = response.json()
        assert event["id"] == "ef_398404"
        assert "title" in event
        assert "venue_name" in event
        assert "date" in event
        assert "time" in event
        assert "url" in event  # Eventfinda ticket URL
        print(f"Event: {event['title']} at {event['venue_name']}")
        print(f"Date: {event['date']}, Time: {event['time']}")
    
    def test_event_detail_has_complete_data(self):
        """Test event detail has all required fields for display"""
        response = requests.get(f"{BASE_URL}/api/events/ef_398404")
        assert response.status_code == 200
        
        event = response.json()
        
        # Required fields for event detail page
        required_fields = [
            "id", "title", "description", "date", "time",
            "venue_name", "location", "address", "image",
            "category", "is_free", "url"
        ]
        
        for field in required_fields:
            assert field in event, f"Missing required field: {field}"
            assert event[field] is not None or field in ["end_time", "restrictions"], f"Field {field} is None"
        
        print(f"All required fields present for event: {event['title']}")

class TestEventsListEndpoint:
    """Events list endpoint tests"""
    
    def test_events_brisbane(self):
        """Test Brisbane events endpoint"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"Brisbane events: {len(data['events'])}")
    
    def test_events_search(self):
        """Test events search endpoint"""
        response = requests.get(f"{BASE_URL}/api/events/search?q=Eclipse&location=brisbane&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        print(f"Search results for 'Eclipse': {len(data['events'])} events")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
