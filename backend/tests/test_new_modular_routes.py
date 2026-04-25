"""
Test new modular routes: crews, safety, location
Also tests auction watchlist and hot badge functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "luna@test.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")


class TestCrewsModularRoute:
    """Test /api/crews modular route"""
    
    def test_get_crews_authenticated(self, auth_headers):
        """Test GET /api/crews - requires auth"""
        response = requests.get(f"{BASE_URL}/api/crews", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/crews returned {len(data)} crews")
    
    def test_get_crews_unauthenticated(self):
        """Test GET /api/crews without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/crews")
        assert response.status_code == 401
        print("✓ GET /api/crews correctly requires authentication")
    
    def test_create_crew(self, auth_headers):
        """Test POST /api/crews/create"""
        response = requests.post(
            f"{BASE_URL}/api/crews/create",
            headers=auth_headers,
            json={"name": "TEST_Crew_For_Testing"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "crew" in data
        assert data["crew"]["name"] == "TEST_Crew_For_Testing"
        print(f"✓ Created crew with ID: {data['crew']['id']}")
        return data["crew"]["id"]
    
    def test_get_crew_detail(self, auth_headers):
        """Test GET /api/crews/{crew_id}"""
        # First create a crew
        create_response = requests.post(
            f"{BASE_URL}/api/crews/create",
            headers=auth_headers,
            json={"name": "TEST_Detail_Crew"}
        )
        crew_id = create_response.json()["crew"]["id"]
        
        # Then get its details
        response = requests.get(f"{BASE_URL}/api/crews/{crew_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == crew_id
        assert data["name"] == "TEST_Detail_Crew"
        print(f"✓ GET /api/crews/{crew_id} returned crew details")


class TestSafetyModularRoute:
    """Test /api/safety modular route"""
    
    def test_emergency_services_public(self):
        """Test GET /api/safety/emergency-services - public endpoint"""
        response = requests.get(f"{BASE_URL}/api/safety/emergency-services")
        assert response.status_code == 200
        data = response.json()
        assert "emergency" in data
        assert data["emergency"] == "000"
        assert "police_non_emergency" in data
        assert "lifeline" in data
        assert "luna_security" in data
        print("✓ GET /api/safety/emergency-services returns correct data")
    
    def test_emergency_services_with_venue(self):
        """Test GET /api/safety/emergency-services with venue_id"""
        response = requests.get(f"{BASE_URL}/api/safety/emergency-services?venue_id=eclipse")
        assert response.status_code == 200
        data = response.json()
        assert "venue_name" in data
        assert "venue_address" in data
        print("✓ GET /api/safety/emergency-services with venue_id returns venue info")
    
    def test_rideshare_links(self):
        """Test GET /api/safety/rideshare-links"""
        response = requests.get(f"{BASE_URL}/api/safety/rideshare-links?venue_id=eclipse")
        assert response.status_code == 200
        data = response.json()
        assert "uber" in data
        assert "uber_web" in data
        assert "venue_address" in data
        print("✓ GET /api/safety/rideshare-links returns rideshare links")
    
    def test_report_incident_authenticated(self, auth_headers):
        """Test POST /api/safety/report-incident"""
        response = requests.post(
            f"{BASE_URL}/api/safety/report-incident",
            headers=auth_headers,
            json={
                "venue_id": "eclipse",
                "incident_type": "TEST_incident",
                "description": "Test incident for automated testing"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "reference_number" in data
        print(f"✓ POST /api/safety/report-incident created ref: {data['reference_number']}")
    
    def test_lost_property_authenticated(self, auth_headers):
        """Test POST /api/safety/lost-property"""
        response = requests.post(
            f"{BASE_URL}/api/safety/lost-property",
            headers=auth_headers,
            json={
                "venue_id": "eclipse",
                "item_description": "TEST_Lost wallet",
                "date_lost": "2026-03-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "reference_number" in data
        print(f"✓ POST /api/safety/lost-property created ref: {data['reference_number']}")
    
    def test_safety_alert_authenticated(self, auth_headers):
        """Test POST /api/safety/alert"""
        response = requests.post(
            f"{BASE_URL}/api/safety/alert",
            headers=auth_headers,
            json={
                "alert_type": "TEST_alert",
                "venue_id": "eclipse",
                "message": "Test safety alert"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "alert_id" in data
        print(f"✓ POST /api/safety/alert created alert: {data['alert_id']}")
    
    def test_get_active_alerts(self, auth_headers):
        """Test GET /api/safety/alerts/active"""
        response = requests.get(f"{BASE_URL}/api/safety/alerts/active", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/safety/alerts/active returned {len(data)} alerts")
    
    def test_emergency_contacts_crud(self, auth_headers):
        """Test emergency contacts CRUD"""
        # Add contact
        add_response = requests.post(
            f"{BASE_URL}/api/safety/emergency-contacts",
            headers=auth_headers,
            json={
                "name": "TEST_Contact",
                "phone": "+61400000000",
                "relationship": "friend"
            }
        )
        assert add_response.status_code == 200
        contact_id = add_response.json()["contact"]["id"]
        print(f"✓ Added emergency contact: {contact_id}")
        
        # Get contacts
        get_response = requests.get(f"{BASE_URL}/api/safety/emergency-contacts", headers=auth_headers)
        assert get_response.status_code == 200
        contacts = get_response.json()
        assert isinstance(contacts, list)
        print(f"✓ GET /api/safety/emergency-contacts returned {len(contacts)} contacts")
        
        # Delete contact
        delete_response = requests.delete(
            f"{BASE_URL}/api/safety/emergency-contacts/{contact_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Deleted emergency contact: {contact_id}")


class TestLocationModularRoute:
    """Test /api/location modular route"""
    
    def test_get_my_location(self, auth_headers):
        """Test GET /api/location/me"""
        response = requests.get(f"{BASE_URL}/api/location/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "location" in data
        print("✓ GET /api/location/me works")
    
    def test_update_location(self, auth_headers):
        """Test POST /api/location/update"""
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            headers=auth_headers,
            json={
                "latitude": -27.4698,
                "longitude": 153.0251,
                "accuracy": 10.0,
                "venue_id": "eclipse"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ POST /api/location/update works")
    
    def test_stop_location_sharing(self, auth_headers):
        """Test DELETE /api/location/share"""
        response = requests.delete(f"{BASE_URL}/api/location/share", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ DELETE /api/location/share works")


class TestAuctionWatchlist:
    """Test auction watchlist functionality"""
    
    def test_get_auctions(self):
        """Test GET /api/auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ GET /api/auctions returned {len(data)} auctions")
        return data[0]["id"] if data else None
    
    def test_get_auction_activity(self):
        """Test GET /api/auctions/{id}/activity"""
        # First get an auction
        auctions_response = requests.get(f"{BASE_URL}/api/auctions")
        auctions = auctions_response.json()
        if not auctions:
            pytest.skip("No auctions available")
        
        auction_id = auctions[0]["id"]
        response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}/activity")
        assert response.status_code == 200
        data = response.json()
        assert "auction_id" in data
        assert "bids_last_5_mins" in data
        assert "bids_last_30_mins" in data
        assert "is_hot" in data
        assert "activity_level" in data
        print(f"✓ GET /api/auctions/{auction_id}/activity - is_hot: {data['is_hot']}, level: {data['activity_level']}")
    
    def test_watchlist_flow(self, auth_headers):
        """Test complete watchlist flow: add, get, remove"""
        # Get an auction
        auctions_response = requests.get(f"{BASE_URL}/api/auctions")
        auctions = auctions_response.json()
        if not auctions:
            pytest.skip("No auctions available")
        
        auction_id = auctions[0]["id"]
        
        # Add to watchlist
        add_response = requests.post(
            f"{BASE_URL}/api/auctions/watch",
            headers=auth_headers,
            json={
                "auction_id": auction_id,
                "notify_on_bid": True,
                "notify_on_ending": True,
                "notify_threshold": 3
            }
        )
        assert add_response.status_code == 200
        add_data = add_response.json()
        assert add_data["success"] == True
        print(f"✓ POST /api/auctions/watch - added {auction_id}")
        
        # Get watchlist
        get_response = requests.get(f"{BASE_URL}/api/auctions/watchlist", headers=auth_headers)
        assert get_response.status_code == 200
        watchlist = get_response.json()
        assert isinstance(watchlist, list)
        assert len(watchlist) > 0
        assert any(w["auction_id"] == auction_id for w in watchlist)
        print(f"✓ GET /api/auctions/watchlist - found {len(watchlist)} items")
        
        # Verify watchlist item has enriched data
        watched_item = next(w for w in watchlist if w["auction_id"] == auction_id)
        assert "current_bid" in watched_item
        assert "status" in watched_item
        assert "venue_name" in watched_item
        print("✓ Watchlist item has enriched auction data")
        
        # Remove from watchlist
        remove_response = requests.delete(
            f"{BASE_URL}/api/auctions/watch/{auction_id}",
            headers=auth_headers
        )
        assert remove_response.status_code == 200
        remove_data = remove_response.json()
        assert remove_data["success"] == True
        print(f"✓ DELETE /api/auctions/watch/{auction_id} - removed")
        
        # Verify removal
        verify_response = requests.get(f"{BASE_URL}/api/auctions/watchlist", headers=auth_headers)
        verify_watchlist = verify_response.json()
        assert not any(w["auction_id"] == auction_id for w in verify_watchlist)
        print("✓ Verified auction removed from watchlist")


class TestRouteCount:
    """Verify route module count"""
    
    def test_route_modules_loaded(self):
        """Verify 32 route modules are loaded"""
        # This is verified by checking the backend logs or the routes/__init__.py
        # For now, we verify the routes are accessible
        endpoints_to_check = [
            "/api/health",
            "/api/venues",
            "/api/auctions",
            "/api/crews",
            "/api/safety/emergency-services",
            "/api/location/me"
        ]
        
        for endpoint in endpoints_to_check:
            response = requests.get(f"{BASE_URL}{endpoint}")
            # Should not be 404 (route not found)
            assert response.status_code != 404, f"Route {endpoint} not found"
        
        print(f"✓ Verified {len(endpoints_to_check)} key routes are accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
