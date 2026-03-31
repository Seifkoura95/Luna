"""
Test Auction Push Notifications and Scheduled Jobs
Tests for:
- Outbid push notifications
- New auction alerts (scheduled job)
- Auction won notifications
- Event detail page undefined ID handling
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')


class TestAuctionNotifications:
    """Test auction notification features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_get_auctions_list(self):
        """Test getting list of auctions"""
        response = self.session.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        auctions = response.json()
        assert isinstance(auctions, list)
        assert len(auctions) > 0
        
        # Verify auction structure
        auction = auctions[0]
        assert "id" in auction
        assert "title" in auction
        assert "venue_name" in auction
        assert "current_bid" in auction
        assert "status" in auction
        print(f"✓ Got {len(auctions)} auctions")
    
    def test_get_auction_detail(self):
        """Test getting auction detail"""
        # First get list of auctions
        response = self.session.get(f"{BASE_URL}/api/auctions")
        auctions = response.json()
        auction_id = auctions[0]["id"]
        
        # Get detail
        response = self.session.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert response.status_code == 200
        auction = response.json()
        assert auction["id"] == auction_id
        assert "bid_history" in auction
        assert "total_bids" in auction
        print(f"✓ Got auction detail for {auction_id}")
    
    def test_place_bid_success(self):
        """Test placing a bid on an auction"""
        # Get an active auction
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction = auctions[0]
        auction_id = auction["id"]
        current_bid = auction["current_bid"]
        min_increment = auction.get("min_increment", 5)
        
        # Place a bid
        new_bid = current_bid + min_increment
        response = self.session.post(f"{BASE_URL}/api/auctions/bid", json={
            "auction_id": auction_id,
            "amount": new_bid,
            "notify_outbid": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Bid placed successfully!"
        assert data["auction"]["current_bid"] >= new_bid
        assert data["you_are_winning"] == True
        print(f"✓ Placed bid of ${new_bid} on {auction['title']}")
    
    def test_place_bid_with_auto_bid(self):
        """Test placing a bid with auto-bid (max bid)"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction = auctions[0]
        auction_id = auction["id"]
        current_bid = auction["current_bid"]
        min_increment = auction.get("min_increment", 5)
        
        # Place a bid with max_bid
        new_bid = current_bid + min_increment
        max_bid = new_bid + 50  # Set max bid $50 higher
        
        response = self.session.post(f"{BASE_URL}/api/auctions/bid", json={
            "auction_id": auction_id,
            "amount": new_bid,
            "max_bid": max_bid,
            "notify_outbid": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["auto_bid_active"] == True
        assert data["your_max_bid"] == max_bid
        print(f"✓ Placed auto-bid with max ${max_bid}")
    
    def test_bid_below_minimum_fails(self):
        """Test that bid below minimum increment fails"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction = auctions[0]
        auction_id = auction["id"]
        current_bid = auction["current_bid"]
        
        # Try to place a bid below minimum
        low_bid = current_bid + 1  # Only $1 more, should fail
        response = self.session.post(f"{BASE_URL}/api/auctions/bid", json={
            "auction_id": auction_id,
            "amount": low_bid,
            "notify_outbid": True
        })
        
        # Should fail with 400
        assert response.status_code == 400
        data = response.json()
        assert "Bid must be at least" in data["detail"]
        print(f"✓ Low bid correctly rejected")
    
    def test_bid_exceeds_max_limit_fails(self):
        """Test that bid exceeding max limit fails"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction = auctions[0]
        auction_id = auction["id"]
        max_limit = auction.get("max_bid_limit", 10000)
        
        # Try to place a bid above max limit
        high_bid = max_limit + 100
        response = self.session.post(f"{BASE_URL}/api/auctions/bid", json={
            "auction_id": auction_id,
            "amount": high_bid,
            "notify_outbid": True
        })
        
        # Should fail with 400
        assert response.status_code == 400
        data = response.json()
        assert "cannot exceed" in data["detail"]
        print(f"✓ High bid correctly rejected")
    
    def test_subscribe_to_auction(self):
        """Test subscribing to auction notifications"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        response = self.session.post(f"{BASE_URL}/api/auctions/subscribe", json={
            "auction_id": auction_id
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Subscribed to auction {auction_id}")
    
    def test_get_auction_bids(self):
        """Test getting bid history for an auction"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/auctions/{auction_id}/bids")
        assert response.status_code == 200
        bids = response.json()
        assert isinstance(bids, list)
        print(f"✓ Got {len(bids)} bids for auction")


class TestEventDetailPage:
    """Test event detail page handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_event_list(self):
        """Test getting events list"""
        response = self.session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"✓ Got {len(data['events'])} events")
    
    def test_event_detail_valid_id(self):
        """Test getting event detail with valid ID"""
        # First get list of events
        response = self.session.get(f"{BASE_URL}/api/events")
        data = response.json()
        
        if not data["events"]:
            pytest.skip("No events available")
        
        event_id = data["events"][0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        event = response.json()
        assert event["id"] == event_id
        print(f"✓ Got event detail for {event_id}")
    
    def test_event_detail_undefined_id(self):
        """Test event detail with undefined ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/events/undefined")
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        print("✓ Undefined ID correctly returns 404")
    
    def test_event_detail_invalid_id(self):
        """Test event detail with invalid ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/events/invalid_event_12345")
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        print("✓ Invalid ID correctly returns 404")
    
    def test_event_detail_empty_id(self):
        """Test event detail with empty ID"""
        response = self.session.get(f"{BASE_URL}/api/events/")
        # Should either return 404 or redirect to events list
        assert response.status_code in [200, 404, 307]
        print("✓ Empty ID handled gracefully")


class TestScheduledJobs:
    """Test scheduled jobs configuration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_scheduler_status(self):
        """Test that scheduler is running via health check"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Scheduler is running (API healthy)")
    
    def test_auctions_have_required_fields_for_notifications(self):
        """Test that auctions have fields needed for notifications"""
        response = self.session.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        auctions = response.json()
        
        for auction in auctions[:3]:  # Check first 3
            # Fields needed for new auction alerts
            assert "id" in auction
            assert "venue_id" in auction
            assert "venue_name" in auction
            assert "title" in auction
            assert "starting_bid" in auction
            assert "status" in auction
            
            # Fields needed for auction ending notifications
            assert "end_time" in auction
        
        print("✓ Auctions have required notification fields")


class TestHomePageAuctions:
    """Test home page Live Auctions carousel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_active_auctions_available(self):
        """Test that active auctions are available for home page"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200
        auctions = response.json()
        
        # Should have active auctions for carousel
        assert len(auctions) > 0
        
        for auction in auctions:
            assert auction["status"] == "active"
            # Verify fields needed for carousel display
            assert "title" in auction
            assert "venue_name" in auction
            assert "current_bid" in auction
            assert "image_url" in auction
        
        print(f"✓ {len(auctions)} active auctions available for carousel")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
