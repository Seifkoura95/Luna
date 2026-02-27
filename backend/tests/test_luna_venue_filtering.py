"""
Test Luna Group Venue Filtering for Events Feed
Tests that the /api/events/feed endpoint ONLY returns events at Luna Group venues.

Luna Group Venues:
- Eclipse (Brisbane)
- After Dark (Brisbane)
- Su Casa Brisbane
- Su Casa Gold Coast
- Juju Mermaid Beach (Gold Coast)
- Night Market (Brisbane)
- Ember & Ash (Brisbane - coming soon)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luna-venue-admin.preview.emergentagent.com').rstrip('/')

# Luna Group venue names (must match eventfinda_service.py LUNA_VENUES keys)
LUNA_VENUE_IDS = [
    "eclipse",
    "after_dark",
    "su_casa_brisbane",
    "su_casa_gold_coast",
    "juju",
    "night_market",
    "ember_and_ash"
]

LUNA_VENUE_NAMES = [
    "Eclipse",
    "After Dark",
    "Su Casa Brisbane",
    "Su Casa Gold Coast",
    "Juju",
    "Night Market",
    "Ember & Ash"
]


class TestLunaVenueFiltering:
    """Test that /api/events/feed returns ONLY Luna Group venue events"""
    
    def test_events_feed_has_luna_filtered_source(self):
        """
        Test that /api/events/feed response has source='eventfinda_luna_filtered'
        This indicates the filtering is active
        """
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "source" in data, "Response should contain 'source' key"
        assert data["source"] == "eventfinda_luna_filtered", \
            f"Source should be 'eventfinda_luna_filtered' to indicate Luna venue filtering, got '{data['source']}'"
        
        print(f"SUCCESS: Events feed source is '{data['source']}' - filtering is active")
    
    def test_events_have_luna_venue_field(self):
        """
        Test that all returned events have the 'luna_venue' field set
        This field identifies which Luna Group venue the event is at
        """
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200
        data = response.json()
        
        upcoming_events = data.get("upcoming", [])
        if not upcoming_events:
            pytest.skip("No upcoming events to test")
        
        # Check that ALL events have luna_venue field
        events_without_luna_venue = []
        for event in upcoming_events:
            if "luna_venue" not in event or not event["luna_venue"]:
                events_without_luna_venue.append({
                    "id": event.get("id"),
                    "title": event.get("title"),
                    "venue_name": event.get("venue_name")
                })
        
        assert len(events_without_luna_venue) == 0, \
            f"All events should have 'luna_venue' field. Missing on {len(events_without_luna_venue)} events: {events_without_luna_venue[:3]}"
        
        print(f"SUCCESS: All {len(upcoming_events)} events have 'luna_venue' field")
    
    def test_events_only_from_luna_venues(self):
        """
        Test that returned events are ONLY from Luna Group venues
        No events from other venues should be returned
        """
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200
        data = response.json()
        
        # Collect unique luna_venue values
        luna_venues_found = set()
        for event in data.get("upcoming", []):
            luna_venue = event.get("luna_venue")
            if luna_venue:
                luna_venues_found.add(luna_venue)
        
        print(f"Luna venues found in response: {sorted(luna_venues_found)}")
        
        # Verify all found venues are valid Luna Group venues
        for venue in luna_venues_found:
            assert venue in LUNA_VENUE_NAMES, \
                f"Found event at non-Luna venue: '{venue}'. Valid venues are: {LUNA_VENUE_NAMES}"
        
        print(f"SUCCESS: All events are from Luna Group venues: {sorted(luna_venues_found)}")
    
    def test_response_structure_complete(self):
        """
        Test that response has all required fields for events feed
        """
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required top-level fields
        required_fields = ["tonight", "tomorrow", "featured", "upcoming", "total_count", "source", "updated_at"]
        for field in required_fields:
            assert field in data, f"Response missing required field: '{field}'"
        
        # tonight, tomorrow, featured, upcoming should be arrays
        array_fields = ["tonight", "tomorrow", "featured", "upcoming"]
        for field in array_fields:
            assert isinstance(data[field], list), f"'{field}' should be a list, got {type(data[field])}"
        
        print(f"SUCCESS: Response structure is complete with all required fields")
        print(f"  Tonight: {len(data['tonight'])} events")
        print(f"  Tomorrow: {len(data['tomorrow'])} events")
        print(f"  Featured: {len(data['featured'])} events")
        print(f"  Upcoming: {len(data['upcoming'])} events")
        print(f"  Total Count: {data['total_count']}")
    
    def test_event_venue_id_matches_luna_venues(self):
        """
        Test that event venue_id matches Luna venue IDs
        """
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        
        assert response.status_code == 200
        data = response.json()
        
        upcoming_events = data.get("upcoming", [])
        if not upcoming_events:
            pytest.skip("No upcoming events to test")
        
        venue_ids_found = set()
        for event in upcoming_events:
            venue_id = event.get("venue_id")
            if venue_id and venue_id != "external":
                venue_ids_found.add(venue_id)
        
        print(f"Venue IDs found: {sorted(venue_ids_found)}")
        
        # All venue_ids should be Luna venue IDs (or 'external' for unmapped)
        for vid in venue_ids_found:
            assert vid in LUNA_VENUE_IDS, \
                f"Found event with non-Luna venue_id: '{vid}'. Valid IDs are: {LUNA_VENUE_IDS}"
        
        print(f"SUCCESS: All venue_ids are Luna Group venues")


class TestEventsFeedCategories:
    """Test that events are correctly categorized by date"""
    
    def test_tonight_events_have_correct_date(self):
        """Test that 'tonight' events have today's date"""
        from datetime import datetime
        
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        data = response.json()
        
        today = datetime.now().strftime("%Y-%m-%d")
        tonight_events = data.get("tonight", [])
        
        for event in tonight_events:
            event_date = event.get("date", "")
            assert event_date == today, \
                f"Tonight event '{event.get('title')}' has date {event_date}, expected {today}"
        
        print(f"SUCCESS: All {len(tonight_events)} tonight events have today's date ({today})")
    
    def test_tomorrow_events_have_correct_date(self):
        """Test that 'tomorrow' events have tomorrow's date"""
        from datetime import datetime, timedelta
        
        response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert response.status_code == 200
        data = response.json()
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_events = data.get("tomorrow", [])
        
        for event in tomorrow_events:
            event_date = event.get("date", "")
            assert event_date == tomorrow, \
                f"Tomorrow event '{event.get('title')}' has date {event_date}, expected {tomorrow}"
        
        print(f"SUCCESS: All {len(tomorrow_events)} tomorrow events have tomorrow's date ({tomorrow})")


class TestEventsEndpointComparison:
    """Compare /api/events vs /api/events/feed to verify filtering"""
    
    def test_feed_is_subset_of_all_events(self):
        """
        Verify that feed events are a filtered subset
        The events/feed should only return Luna venue events
        while events/ returns all Eventfinda events
        """
        # Get all events (no Luna filtering)
        all_response = requests.get(f"{BASE_URL}/api/events?location=brisbane&limit=50")
        assert all_response.status_code == 200
        all_data = all_response.json()
        
        # Get Luna-filtered feed
        feed_response = requests.get(f"{BASE_URL}/api/events/feed?limit=30")
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        
        # Compare sources
        all_source = all_data.get("source", "")
        feed_source = feed_data.get("source", "")
        
        print(f"/api/events source: {all_source}")
        print(f"/api/events/feed source: {feed_source}")
        
        # All events endpoint should NOT be luna-filtered
        assert all_source == "eventfinda", \
            f"/api/events should have source='eventfinda', got '{all_source}'"
        
        # Feed endpoint SHOULD be luna-filtered
        assert feed_source == "eventfinda_luna_filtered", \
            f"/api/events/feed should have source='eventfinda_luna_filtered', got '{feed_source}'"
        
        print(f"SUCCESS: /api/events returns all events ({all_data.get('total')}), /api/events/feed returns Luna-filtered events ({feed_data.get('total_count')})")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
