"""
Test Auction Watchlist Feature
Tests for:
- POST /api/auctions/watch - Add auction to watchlist
- DELETE /api/auctions/watch/{auction_id} - Remove from watchlist
- GET /api/auctions/watchlist - Get user's watchlist
- GET /api/auctions/{auction_id}/activity - Get bidding activity
- Bidding still works with watchlist integration
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')


class TestAuctionWatchlist:
    """Test auction watchlist feature"""
    
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
        print(f"✓ Got {len(auctions)} auctions")
        return auctions
    
    # ============ WATCHLIST TESTS ============
    
    def test_add_auction_to_watchlist(self):
        """Test adding an auction to watchlist"""
        # Get an active auction
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        auction_title = auctions[0]["title"]
        
        # Add to watchlist
        response = self.session.post(f"{BASE_URL}/api/auctions/watch", json={
            "auction_id": auction_id,
            "notify_on_bid": True,
            "notify_on_ending": True,
            "notify_threshold": 3
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "watching" in data["message"].lower() or auction_title in data["message"]
        assert "watchlist_id" in data
        print(f"✓ Added auction {auction_id} to watchlist")
        return auction_id
    
    def test_add_auction_to_watchlist_with_custom_threshold(self):
        """Test adding auction with custom notification threshold"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if len(auctions) < 2:
            pytest.skip("Need at least 2 active auctions")
        
        auction_id = auctions[1]["id"]
        
        # Add with custom threshold
        response = self.session.post(f"{BASE_URL}/api/auctions/watch", json={
            "auction_id": auction_id,
            "notify_on_bid": True,
            "notify_on_ending": False,
            "notify_threshold": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Added auction with custom threshold (5 bids)")
    
    def test_add_nonexistent_auction_to_watchlist(self):
        """Test adding non-existent auction to watchlist fails"""
        response = self.session.post(f"{BASE_URL}/api/auctions/watch", json={
            "auction_id": "nonexistent_auction_12345",
            "notify_on_bid": True
        })
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        print("✓ Non-existent auction correctly rejected")
    
    def test_get_user_watchlist(self):
        """Test getting user's watchlist"""
        # First add an auction to watchlist
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        # Add to watchlist
        self.session.post(f"{BASE_URL}/api/auctions/watch", json={
            "auction_id": auction_id,
            "notify_on_bid": True
        })
        
        # Get watchlist
        response = self.session.get(f"{BASE_URL}/api/auctions/watchlist")
        assert response.status_code == 200
        watchlist = response.json()
        assert isinstance(watchlist, list)
        
        # Verify watchlist item structure
        if watchlist:
            item = watchlist[0]
            assert "auction_id" in item
            assert "current_bid" in item
            assert "status" in item
            assert "bid_count" in item
            print(f"✓ Got watchlist with {len(watchlist)} items")
        else:
            print("✓ Watchlist endpoint works (empty list)")
    
    def test_remove_auction_from_watchlist(self):
        """Test removing an auction from watchlist"""
        # First add an auction to watchlist
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        # Add to watchlist
        self.session.post(f"{BASE_URL}/api/auctions/watch", json={
            "auction_id": auction_id,
            "notify_on_bid": True
        })
        
        # Remove from watchlist
        response = self.session.delete(f"{BASE_URL}/api/auctions/watch/{auction_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "removed" in data["message"].lower()
        print(f"✓ Removed auction {auction_id} from watchlist")
    
    def test_remove_nonexistent_watchlist_item(self):
        """Test removing non-existent item from watchlist"""
        response = self.session.delete(f"{BASE_URL}/api/auctions/watch/nonexistent_auction_12345")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "not in watchlist" in data["message"].lower()
        print("✓ Non-existent watchlist item handled gracefully")
    
    # ============ ACTIVITY TESTS ============
    
    def test_get_auction_activity(self):
        """Test getting auction bidding activity"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        # Get activity
        response = self.session.get(f"{BASE_URL}/api/auctions/{auction_id}/activity")
        assert response.status_code == 200
        data = response.json()
        
        # Verify activity structure
        assert data["auction_id"] == auction_id
        assert "recent_bids" in data
        assert "bids_last_5_mins" in data
        assert "bids_last_30_mins" in data
        assert "is_hot" in data
        assert "activity_level" in data
        assert data["activity_level"] in ["hot", "active", "normal"]
        
        print(f"✓ Got activity for auction: {data['bids_last_5_mins']} bids in 5 mins, level: {data['activity_level']}")
    
    def test_get_activity_nonexistent_auction(self):
        """Test getting activity for non-existent auction"""
        response = self.session.get(f"{BASE_URL}/api/auctions/nonexistent_auction_12345/activity")
        # Should return empty activity, not 404
        assert response.status_code == 200
        data = response.json()
        assert data["bids_last_5_mins"] == 0
        assert data["bids_last_30_mins"] == 0
        print("✓ Non-existent auction returns empty activity")
    
    # ============ BIDDING WITH WATCHLIST INTEGRATION ============
    
    def test_bidding_still_works_with_watchlist(self):
        """Test that bidding still works after watchlist feature added"""
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
        print(f"✓ Bidding works: placed ${new_bid} on {auction['title']}")
    
    def test_bidding_with_auto_bid_still_works(self):
        """Test auto-bid still works with watchlist integration"""
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
        max_bid = new_bid + 50
        
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
        print(f"✓ Auto-bid works: max ${max_bid}")


class TestLiveAuctionsCarousel:
    """Test Live Auctions carousel on home page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_active_auctions_for_carousel(self):
        """Test that active auctions are available for home page carousel"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200
        auctions = response.json()
        
        assert len(auctions) > 0, "Should have active auctions for carousel"
        
        for auction in auctions:
            assert auction["status"] == "active"
            # Verify fields needed for carousel display
            assert "title" in auction
            assert "venue_name" in auction
            assert "current_bid" in auction
            assert "image_url" in auction
        
        print(f"✓ {len(auctions)} active auctions available for carousel")
    
    def test_auction_detail_for_carousel_click(self):
        """Test auction detail endpoint for when user clicks carousel item"""
        response = self.session.get(f"{BASE_URL}/api/auctions?status=active")
        auctions = response.json()
        
        if not auctions:
            pytest.skip("No active auctions available")
        
        auction_id = auctions[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert response.status_code == 200
        auction = response.json()
        assert auction["id"] == auction_id
        assert "bid_history" in auction
        print(f"✓ Auction detail works for carousel click")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
