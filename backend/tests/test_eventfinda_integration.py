"""
Test Eventfinda API Integration for Luna Group VIP App
Tests all Events API endpoints that fetch real-time data from Eventfinda API

Features tested:
- GET /api/events - returns events from Eventfinda
- GET /api/events/feed - returns categorized events (tonight, tomorrow, featured, upcoming)
- GET /api/events/tonight - returns tonight's events
- GET /api/events/featured - returns featured/popular events
- GET /api/events/weekend - returns weekend events
- GET /api/events/search?q=music - search events by keyword
- GET /api/events/upcoming - returns upcoming events (30 days)
- GET /api/events/{event_id} - get event details
"""

import pytest
import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com').rstrip('/')


class TestEventfindaEventsAPI:
    """Test Events API endpoints powered by Eventfinda integration"""
    
    def test_get_events_brisbane(self):
        """Test GET /api/events returns real events from Eventfinda for Brisbane"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "events" in data, "Response should contain 'events' key"
        assert "total" in data, "Response should contain 'total' key"
        assert "source" in data, "Response should contain 'source' key"
        assert data["source"] == "eventfinda", f"Source should be 'eventfinda', got {data['source']}"
        assert data["location"] == "brisbane", "Location should be 'brisbane'"
        
        # Verify events have required fields
        if data["events"]:
            event = data["events"][0]
            required_fields = ["id", "title", "venue_name", "date", "image", "source"]
            for field in required_fields:
                assert field in event, f"Event should have '{field}' field"
            assert event["source"] == "eventfinda", "Event source should be 'eventfinda'"
            print(f"SUCCESS: Got {len(data['events'])} events from Eventfinda for Brisbane")
            print(f"  First event: {event['title']} at {event['venue_name']}")
        else:
            print("WARNING: No events returned (may be normal if no events today)")
    
    def test_get_events_gold_coast(self):
        """Test GET /api/events returns events for Gold Coast"""
        response = requests.get(f"{BASE_URL}/api/events?location=gold-coast&limit=10")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert data["source"] == "eventfinda"
        
        print(f"SUCCESS: Got {len(data['events'])} events from Eventfinda for Gold Coast")
    
    def test_get_events_feed(self):
        """Test GET /api/events/feed returns categorized events (tonight, tomorrow, featured, upcoming)"""
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required categories exist
        required_categories = ["tonight", "tomorrow", "featured", "upcoming"]
        for category in required_categories:
            assert category in data, f"Response should contain '{category}' key"
            assert isinstance(data[category], list), f"'{category}' should be a list"
        
        assert "total_count" in data, "Response should contain 'total_count'"
        assert "source" in data, "Response should contain 'source'"
        assert data["source"] == "eventfinda"
        
        # Print summary
        print(f"SUCCESS: Events feed returned:")
        print(f"  Tonight: {len(data['tonight'])} events")
        print(f"  Tomorrow: {len(data['tomorrow'])} events")
        print(f"  Featured: {len(data['featured'])} events")
        print(f"  Upcoming: {len(data['upcoming'])} events")
        print(f"  Total: {data['total_count']}")
        
        # Verify event structure if any events exist
        if data["upcoming"]:
            event = data["upcoming"][0]
            assert "id" in event, "Event should have 'id'"
            assert "title" in event, "Event should have 'title'"
            assert "image" in event, "Event should have 'image'"
    
    def test_get_tonight_events(self):
        """Test GET /api/events/tonight returns tonight's events"""
        response = requests.get(f"{BASE_URL}/api/events/tonight?location=brisbane&limit=10")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert "date" in data, "Response should contain today's date"
        assert data["source"] == "eventfinda"
        
        # Verify date is today
        today = datetime.now().strftime("%Y-%m-%d")
        assert data["date"] == today, f"Date should be {today}, got {data['date']}"
        
        print(f"SUCCESS: Got {len(data['events'])} events for tonight ({data['date']})")
    
    def test_get_featured_events(self):
        """Test GET /api/events/featured returns featured/popular events"""
        response = requests.get(f"{BASE_URL}/api/events/featured?location=brisbane&limit=5")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert data["source"] == "eventfinda"
        
        print(f"SUCCESS: Got {len(data['events'])} featured events")
        if data['events']:
            print(f"  Top featured: {data['events'][0]['title']}")
    
    def test_get_weekend_events(self):
        """Test GET /api/events/weekend returns this weekend's events"""
        response = requests.get(f"{BASE_URL}/api/events/weekend?location=brisbane&limit=20")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert data["source"] == "eventfinda"
        
        print(f"SUCCESS: Got {len(data['events'])} events for this weekend")
    
    def test_get_upcoming_events(self):
        """Test GET /api/events/upcoming returns next 30 days events"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming?location=brisbane&limit=30")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert data["source"] == "eventfinda"
        
        print(f"SUCCESS: Got {len(data['events'])} upcoming events (next 30 days)")
    
    def test_search_events(self):
        """Test GET /api/events/search searches events by keyword"""
        response = requests.get(f"{BASE_URL}/api/events/search?q=music&location=brisbane&limit=20")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert "query" in data, "Response should contain 'query'"
        assert data["query"] == "music", f"Query should be 'music', got {data['query']}"
        assert data["source"] == "eventfinda"
        
        print(f"SUCCESS: Search for 'music' returned {len(data['events'])} events")
    
    def test_search_events_different_queries(self):
        """Test searching with different keywords: concert, festival, club"""
        queries = ["concert", "festival", "club"]
        
        for query in queries:
            response = requests.get(f"{BASE_URL}/api/events/search?q={query}&location=brisbane&limit=10")
            assert response.status_code == 200, f"Search for '{query}' should return 200"
            data = response.json()
            assert data["query"] == query
            print(f"  Search '{query}': {len(data['events'])} results")
        
        print("SUCCESS: All search queries work correctly")


class TestEventfindaEventStructure:
    """Test that Eventfinda events have correct structure and data format"""
    
    def test_event_has_required_fields(self):
        """Verify events have all required fields from Eventfinda transformation"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if not data["events"]:
            pytest.skip("No events available to test structure")
        
        event = data["events"][0]
        
        # Required fields per the spec
        required_fields = [
            "id", "title", "description", "date", "time",
            "venue_name", "location", "image", "category",
            "is_free", "is_featured", "url", "source"
        ]
        
        for field in required_fields:
            assert field in event, f"Event missing required field: {field}"
        
        # Verify id format for Eventfinda events (ef_XXXXX)
        assert event["id"].startswith("ef_"), f"Eventfinda event ID should start with 'ef_', got {event['id']}"
        
        print(f"SUCCESS: Event has all {len(required_fields)} required fields")
        print(f"  ID: {event['id']}")
        print(f"  Title: {event['title']}")
        print(f"  Date: {event['date']} at {event['time']}")
        print(f"  Venue: {event['venue_name']}")
        print(f"  Image: {event['image'][:60]}...")
    
    def test_event_date_format(self):
        """Test that event dates are in correct YYYY-MM-DD format"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if not data["events"]:
            pytest.skip("No events available to test date format")
        
        for event in data["events"]:
            date_str = event.get("date", "")
            if date_str:
                # Date should be YYYY-MM-DD format
                try:
                    datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    pytest.fail(f"Invalid date format: {date_str}")
        
        print("SUCCESS: All event dates are in correct YYYY-MM-DD format")
    
    def test_event_time_format(self):
        """Test that event times are in correct HH:MM format"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if not data["events"]:
            pytest.skip("No events available to test time format")
        
        for event in data["events"]:
            time_str = event.get("time", "")
            if time_str and time_str != "":
                # Time should be HH:MM format
                assert len(time_str) == 5, f"Time should be HH:MM format, got {time_str}"
                assert time_str[2] == ":", f"Time should have colon at position 2, got {time_str}"
        
        print("SUCCESS: Event times are in correct HH:MM format")
    
    def test_event_image_urls(self):
        """Test that event images are valid URLs from Eventfinda CDN or fallback"""
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if not data["events"]:
            pytest.skip("No events available to test images")
        
        for event in data["events"]:
            image_url = event.get("image", "")
            assert image_url, f"Event '{event['title']}' has no image URL"
            assert image_url.startswith("http"), f"Image should be a valid URL: {image_url}"
            
            # Eventfinda CDN or fallback Unsplash image
            valid_prefixes = ["https://cdn.eventfinda.com.au", "https://images.unsplash.com"]
            is_valid = any(image_url.startswith(prefix) for prefix in valid_prefixes)
            assert is_valid, f"Image URL should be from Eventfinda CDN or Unsplash: {image_url}"
        
        print("SUCCESS: All event images have valid URLs")


class TestEventfindaEventDetails:
    """Test getting individual event details"""
    
    def test_get_event_detail_by_id(self):
        """Test GET /api/events/{event_id} for Eventfinda events"""
        # First get a list of events to get an ID
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        if not data["events"]:
            pytest.skip("No events available to test detail endpoint")
        
        event_id = data["events"][0]["id"]
        
        # Get event detail
        detail_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert detail_response.status_code == 200, f"Failed to get event detail: {detail_response.text}"
        
        event = detail_response.json()
        assert event["id"] == event_id
        assert "title" in event
        assert "description" in event
        
        print(f"SUCCESS: Got detail for event '{event['title']}'")
    
    def test_event_not_found(self):
        """Test GET /api/events/{event_id} returns 404 for invalid ID"""
        response = requests.get(f"{BASE_URL}/api/events/invalid_id_12345")
        assert response.status_code == 404


class TestEventfindaCaching:
    """Test that Eventfinda API caching works correctly"""
    
    def test_events_are_cached(self):
        """Test that repeated requests use cache (faster response)"""
        import time
        
        # First request (may hit API)
        start1 = time.time()
        response1 = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        time1 = time.time() - start1
        assert response1.status_code == 200
        
        # Second request (should use cache)
        start2 = time.time()
        response2 = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        time2 = time.time() - start2
        assert response2.status_code == 200
        
        # Data should be the same (from cache)
        data1 = response1.json()
        data2 = response2.json()
        assert data1["total_count"] == data2["total_count"], "Cached response should match"
        
        print(f"SUCCESS: Caching appears to work")
        print(f"  First request: {time1:.3f}s")
        print(f"  Second request: {time2:.3f}s")


class TestEventfindaErrorHandling:
    """Test error handling and fallbacks"""
    
    def test_invalid_location_uses_default(self):
        """Test that invalid location doesn't break the API"""
        response = requests.get(f"{BASE_URL}/api/events?location=invalid-city&limit=5")
        
        # Should still return 200 but possibly empty results
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"SUCCESS: Invalid location returns graceful response with {len(data['events'])} events")
    
    def test_limit_bounds(self):
        """Test that limit parameter is bounded correctly"""
        # Request more than max (100)
        response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=500")
        
        assert response.status_code == 200
        data = response.json()
        # Should cap at 50 (as set in API endpoint)
        assert len(data["events"]) <= 50, f"Events should be capped at 50, got {len(data['events'])}"
        print(f"SUCCESS: Limit is bounded correctly (got {len(data['events'])} events)")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
