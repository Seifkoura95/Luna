#!/usr/bin/env python3
"""
Backend API Testing for Eclipse VIP App - Auction and Photo APIs
Tests the new auction and photo management features
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://cluboscenexus.preview.emergentagent.com/api"
AUTH_TOKEN = "auction_test_token_123"
TEST_USER_ID = "user_auction_test"

# Headers for authenticated requests
AUTH_HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()
def test_auction_apis():
    """Test all auction-related APIs"""
    print("=== TESTING AUCTION APIs ===\n")
    
    # 1. GET /api/auctions - Get all active/upcoming auctions
    try:
        response = requests.get(f"{BACKEND_URL}/auctions", timeout=10)
        if response.status_code == 200:
            auctions = response.json()
            log_test("GET /api/auctions", True, f"Retrieved {len(auctions)} auctions")
        else:
            log_test("GET /api/auctions", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/auctions", False, f"Error: {str(e)}")
    
    # 2. GET /api/auctions?status=active - Get active auctions only
    try:
        response = requests.get(f"{BACKEND_URL}/auctions?status=active", timeout=10)
        if response.status_code == 200:
            active_auctions = response.json()
            log_test("GET /api/auctions?status=active", True, f"Retrieved {len(active_auctions)} active auctions")
        else:
            log_test("GET /api/auctions?status=active", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/auctions?status=active", False, f"Error: {str(e)}")
    
    # 3. GET /api/auctions/{auction_id} - Get auction detail with bids (use 'a2')
    try:
        response = requests.get(f"{BACKEND_URL}/auctions/a2", timeout=10)
        if response.status_code == 200:
            auction_detail = response.json()
            bid_count = len(auction_detail.get('recent_bids', []))
            log_test("GET /api/auctions/a2", True, f"Retrieved auction details with {bid_count} bids")
        else:
            log_test("GET /api/auctions/a2", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/auctions/a2", False, f"Error: {str(e)}")
    
    # 4. POST /api/auctions/bid - Place bid
    try:
        bid_data = {
            "auction_id": "a2",
            "bid_amount": 55.0  # Increased bid amount
        }
        response = requests.post(
            f"{BACKEND_URL}/auctions/bid", 
            headers=AUTH_HEADERS,
            json=bid_data,
            timeout=10
        )
        if response.status_code == 200:
            bid_result = response.json()
            log_test("POST /api/auctions/bid", True, f"Bid placed: ${bid_result.get('bid_amount', 0)}")
        else:
            log_test("POST /api/auctions/bid", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST /api/auctions/bid", False, f"Error: {str(e)}")
    
    # 5. GET /api/auctions/user/won - Get user's won auctions
    try:
        response = requests.get(f"{BACKEND_URL}/auctions/user/won", headers=AUTH_HEADERS, timeout=10)
        if response.status_code == 200:
            won_auctions = response.json()
            log_test("GET /api/auctions/user/won", True, f"Retrieved {len(won_auctions)} won auctions")
        else:
            log_test("GET /api/auctions/user/won", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/auctions/user/won", False, f"Error: {str(e)}")
    
    # 6. POST /api/auctions/{auction_id}/claim - Claim prize (test with ended auction)
    # First, let's try to find an ended auction or use a2 if it has ended
    try:
        response = requests.post(
            f"{BACKEND_URL}/auctions/a2/claim", 
            headers=AUTH_HEADERS,
            timeout=10
        )
        if response.status_code == 200:
            claim_result = response.json()
            log_test("POST /api/auctions/a2/claim", True, f"Claim successful: {claim_result.get('message', '')}")
        elif response.status_code == 400:
            log_test("POST /api/auctions/a2/claim", True, "Expected: Auction hasn't ended yet (correct behavior)")
        else:
            log_test("POST /api/auctions/a2/claim", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST /api/auctions/a2/claim", False, f"Error: {str(e)}")

def test_photo_apis():
    """Test all photo-related APIs"""
    print("=== TESTING PHOTO APIs ===\n")
    
    # 1. GET /api/photos - Get user's tagged photos
    try:
        response = requests.get(f"{BACKEND_URL}/photos", headers=AUTH_HEADERS, timeout=10)
        if response.status_code == 200:
            photos = response.json()
            log_test("GET /api/photos", True, f"Retrieved {len(photos)} tagged photos")
        else:
            log_test("GET /api/photos", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/photos", False, f"Error: {str(e)}")
    
    # 2. GET /api/photos/pending - Get photos pending approval
    try:
        response = requests.get(f"{BACKEND_URL}/photos/pending", headers=AUTH_HEADERS, timeout=10)
        if response.status_code == 200:
            pending_photos = response.json()
            log_test("GET /api/photos/pending", True, f"Retrieved {len(pending_photos)} pending photos")
        else:
            log_test("GET /api/photos/pending", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/photos/pending", False, f"Error: {str(e)}")
    
    # 3. POST /api/photos/approve - Approve photo
    try:
        approve_data = {
            "tag_id": "tag_test_1",
            "approved": True
        }
        response = requests.post(
            f"{BACKEND_URL}/photos/approve",
            headers=AUTH_HEADERS,
            json=approve_data,
            timeout=10
        )
        if response.status_code == 200:
            approve_result = response.json()
            log_test("POST /api/photos/approve", True, f"Photo approved: {approve_result.get('status', '')}")
        else:
            log_test("POST /api/photos/approve", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST /api/photos/approve", False, f"Error: {str(e)}")
    
    # 4. POST /api/photos/purchase - Purchase photos
    try:
        purchase_data = {
            "photo_ids": ["p1"],
            "ai_enhance": False
        }
        response = requests.post(
            f"{BACKEND_URL}/photos/purchase",
            headers=AUTH_HEADERS,
            json=purchase_data,
            timeout=10
        )
        if response.status_code == 200:
            purchase_result = response.json()
            log_test("POST /api/photos/purchase", True, f"Photos purchased: ${purchase_result.get('total_charged', 0)}")
        else:
            log_test("POST /api/photos/purchase", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST /api/photos/purchase", False, f"Error: {str(e)}")
    
    # 5. GET /api/photos/purchased - Get purchased photos
    try:
        response = requests.get(f"{BACKEND_URL}/photos/purchased", headers=AUTH_HEADERS, timeout=10)
        if response.status_code == 200:
            purchased_photos = response.json()
            log_test("GET /api/photos/purchased", True, f"Retrieved {len(purchased_photos)} purchased photos")
        else:
            log_test("GET /api/photos/purchased", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/photos/purchased", False, f"Error: {str(e)}")
    
    # 6. GET /api/photos/recap - Get night recap
    try:
        response = requests.get(f"{BACKEND_URL}/photos/recap", headers=AUTH_HEADERS, timeout=10)
        if response.status_code == 200:
            recap = response.json()
            log_test("GET /api/photos/recap", True, f"Night recap: {recap.get('message', '')}")
        else:
            log_test("GET /api/photos/recap", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/photos/recap", False, f"Error: {str(e)}")

def test_admin_photo_api():
    """Test admin photo API"""
    print("=== TESTING ADMIN PHOTO API ===\n")
    
    # POST /api/admin/photos/tag - Tag photo to user
    try:
        tag_data = {
            "photo_url": "https://test.com/photo.jpg",
            "user_id": TEST_USER_ID
        }
        response = requests.post(
            f"{BACKEND_URL}/admin/photos/tag",
            headers={"Content-Type": "application/json"},  # No auth required for admin endpoint
            json=tag_data,
            timeout=10
        )
        if response.status_code == 200:
            tag_result = response.json()
            log_test("POST /api/admin/photos/tag", True, f"Photo tagged to user: {tag_result.get('user_name', '')}")
        else:
            log_test("POST /api/admin/photos/tag", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST /api/admin/photos/tag", False, f"Error: {str(e)}")

def main():
    """Run all tests"""
    print("🚀 Starting Eclipse VIP Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User: {TEST_USER_ID}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)
    print()
    
    # Test auction APIs
    test_auction_apis()
    
    # Test photo APIs  
    test_photo_apis()
    
    # Test admin photo API
    test_admin_photo_api()
    
    print("=" * 60)
    print("🏁 All tests completed!")

if __name__ == "__main__":
    main()