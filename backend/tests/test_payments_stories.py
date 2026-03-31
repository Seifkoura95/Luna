"""
Test Suite for Stripe Payments and Stories Features
Tests:
- GET /api/payments/packages - Returns 12 payment packages
- POST /api/payments/checkout - Creates Stripe checkout session
- POST /api/payments/checkout - Requires authentication (401 without token)
- GET /api/payments/status/{session_id} - Returns payment status
- POST /api/stories/create - Creates story with AI-generated caption
- GET /api/stories/my-stories - Returns user's stories
- POST /api/stories/share - Records share and awards 25 points
- GET /api/stories/feed - Returns public story feed
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "luna@test.com"
TEST_USER_PASSWORD = "test123"


class TestPaymentsPackages:
    """Test payment packages endpoint"""
    
    def test_get_packages_returns_12_packages(self):
        """GET /api/payments/packages should return 12 packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "packages" in data, "Response should contain 'packages' key"
        
        packages = data["packages"]
        assert len(packages) == 12, f"Expected 12 packages, got {len(packages)}"
        
        # Verify package structure
        for pkg in packages:
            assert "id" in pkg, "Package should have 'id'"
            assert "name" in pkg, "Package should have 'name'"
            assert "amount" in pkg, "Package should have 'amount'"
            assert "type" in pkg, "Package should have 'type'"
        
        # Verify package types
        types = [pkg["type"] for pkg in packages]
        assert "table_deposit" in types, "Should have table_deposit packages"
        assert "bottle_service" in types, "Should have bottle_service packages"
        assert "points" in types, "Should have points packages"
        assert "subscription" in types, "Should have subscription packages"
        
        print(f"✓ GET /api/payments/packages returns {len(packages)} packages")


class TestPaymentsCheckout:
    """Test payment checkout endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    def test_checkout_requires_authentication(self):
        """POST /api/payments/checkout should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            json={
                "package_id": "points_500",
                "origin_url": "https://example.com"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ POST /api/payments/checkout requires authentication (401 without token)")
    
    def test_checkout_creates_stripe_session(self, auth_token):
        """POST /api/payments/checkout should create Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "package_id": "points_500",
                "origin_url": "https://birthday-rewards-1.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, "Response should contain 'checkout_url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        
        # Verify checkout URL is a valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "stripe.com" in checkout_url or "checkout" in checkout_url.lower(), \
            f"checkout_url should be a Stripe URL, got: {checkout_url}"
        
        print(f"✓ POST /api/payments/checkout creates Stripe session: {data['session_id'][:20]}...")
        return data["session_id"]
    
    def test_checkout_invalid_package(self, auth_token):
        """POST /api/payments/checkout should reject invalid package"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "package_id": "invalid_package",
                "origin_url": "https://example.com"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ POST /api/payments/checkout rejects invalid package")


class TestPaymentStatus:
    """Test payment status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    @pytest.fixture
    def checkout_session(self, auth_token):
        """Create a checkout session for testing"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "package_id": "points_500",
                "origin_url": "https://birthday-rewards-1.preview.emergentagent.com"
            }
        )
        if response.status_code == 200:
            return response.json()
        pytest.skip(f"Failed to create checkout session: {response.text}")
    
    def test_get_payment_status(self, auth_token, checkout_session):
        """GET /api/payments/status/{session_id} should return payment status"""
        session_id = checkout_session["session_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/payments/status/{session_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert "payment_status" in data, "Response should contain 'payment_status'"
        assert "amount" in data, "Response should contain 'amount'"
        assert "currency" in data, "Response should contain 'currency'"
        assert "package_name" in data, "Response should contain 'package_name'"
        
        # Verify values
        assert data["amount"] == 5.0, f"Expected amount 5.0, got {data['amount']}"
        assert data["currency"] == "aud", f"Expected currency 'aud', got {data['currency']}"
        assert data["package_name"] == "500 Luna Points", f"Expected '500 Luna Points', got {data['package_name']}"
        
        print(f"✓ GET /api/payments/status/{session_id[:15]}... returns status: {data['payment_status']}")
    
    def test_payment_status_not_found(self, auth_token):
        """GET /api/payments/status/{session_id} should return 404 for invalid session"""
        response = requests.get(
            f"{BASE_URL}/api/payments/status/invalid_session_id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ GET /api/payments/status returns 404 for invalid session")


class TestStoriesCreate:
    """Test story creation endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    def test_create_story_with_ai_caption(self, auth_token):
        """POST /api/stories/create should create story with AI-generated caption"""
        response = requests.post(
            f"{BASE_URL}/api/stories/create",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "photo_url": "https://example.com/test-photo.jpg",
                "venue_id": "test_venue_1",
                "venue_name": "Eclipse Nightclub",
                "event_name": "Saturday Night Party"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "story" in data, "Response should contain 'story'"
        
        story = data["story"]
        assert "id" in story, "Story should have 'id'"
        assert "photo_url" in story, "Story should have 'photo_url'"
        assert "caption" in story, "Story should have 'caption'"
        assert "venue_name" in story, "Story should have 'venue_name'"
        
        # Verify AI caption was generated (since no caption was provided)
        assert story["caption"], "Caption should not be empty"
        assert len(story["caption"]) > 0, "Caption should have content"
        
        print(f"✓ POST /api/stories/create creates story with AI caption: '{story['caption'][:50]}...'")
        return story["id"]
    
    def test_create_story_with_custom_caption(self, auth_token):
        """POST /api/stories/create should use custom caption when provided"""
        custom_caption = "Best night ever at Eclipse!"
        
        response = requests.post(
            f"{BASE_URL}/api/stories/create",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "photo_url": "https://example.com/test-photo2.jpg",
                "venue_id": "test_venue_1",
                "venue_name": "Eclipse Nightclub",
                "caption": custom_caption
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        story = data["story"]
        assert story["caption"] == custom_caption, f"Expected custom caption, got: {story['caption']}"
        
        print(f"✓ POST /api/stories/create uses custom caption when provided")
    
    def test_create_story_requires_auth(self):
        """POST /api/stories/create should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/stories/create",
            json={
                "photo_url": "https://example.com/test.jpg",
                "venue_id": "test_venue",
                "venue_name": "Test Venue"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ POST /api/stories/create requires authentication")


class TestStoriesMyStories:
    """Test my-stories endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    def test_get_my_stories(self, auth_token):
        """GET /api/stories/my-stories should return user's stories"""
        response = requests.get(
            f"{BASE_URL}/api/stories/my-stories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stories" in data, "Response should contain 'stories'"
        
        stories = data["stories"]
        assert isinstance(stories, list), "Stories should be a list"
        
        # If there are stories, verify structure
        if len(stories) > 0:
            story = stories[0]
            assert "id" in story, "Story should have 'id'"
            assert "photo_url" in story, "Story should have 'photo_url'"
            assert "caption" in story, "Story should have 'caption'"
            assert "venue_name" in story, "Story should have 'venue_name'"
            assert "shares" in story, "Story should have 'shares'"
            assert "created_at" in story, "Story should have 'created_at'"
        
        print(f"✓ GET /api/stories/my-stories returns {len(stories)} stories")


class TestStoriesShare:
    """Test story sharing endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    @pytest.fixture
    def story_id(self, auth_token):
        """Create a story for testing"""
        response = requests.post(
            f"{BASE_URL}/api/stories/create",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "photo_url": "https://example.com/share-test.jpg",
                "venue_id": "test_venue_share",
                "venue_name": "Test Venue for Sharing",
                "caption": "Test story for sharing"
            }
        )
        if response.status_code == 200:
            return response.json()["story"]["id"]
        pytest.skip(f"Failed to create story: {response.text}")
    
    def test_share_story_awards_25_points(self, auth_token, story_id):
        """POST /api/stories/share should record share and award 25 points"""
        response = requests.post(
            f"{BASE_URL}/api/stories/share",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "story_id": story_id,
                "platform": "instagram"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "Share should be successful"
        assert "points_earned" in data, "Response should contain 'points_earned'"
        assert data["points_earned"] == 25, f"Expected 25 points, got {data['points_earned']}"
        assert "share_data" in data, "Response should contain 'share_data'"
        
        print(f"✓ POST /api/stories/share awards {data['points_earned']} points for sharing to instagram")
    
    def test_share_story_multiple_platforms(self, auth_token, story_id):
        """POST /api/stories/share should work with different platforms"""
        platforms = ["facebook", "twitter", "snapchat", "tiktok", "copy_link"]
        
        for platform in platforms:
            response = requests.post(
                f"{BASE_URL}/api/stories/share",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "story_id": story_id,
                    "platform": platform
                }
            )
            
            assert response.status_code == 200, f"Expected 200 for {platform}, got {response.status_code}"
            data = response.json()
            assert data["points_earned"] == 25, f"Expected 25 points for {platform}"
        
        print(f"✓ POST /api/stories/share works with all platforms: {platforms}")
    
    def test_share_story_invalid_platform(self, auth_token, story_id):
        """POST /api/stories/share should reject invalid platform"""
        response = requests.post(
            f"{BASE_URL}/api/stories/share",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "story_id": story_id,
                "platform": "invalid_platform"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ POST /api/stories/share rejects invalid platform")


class TestStoriesFeed:
    """Test story feed endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    def test_get_story_feed(self, auth_token):
        """GET /api/stories/feed should return public story feed"""
        response = requests.get(
            f"{BASE_URL}/api/stories/feed",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stories" in data, "Response should contain 'stories'"
        
        stories = data["stories"]
        assert isinstance(stories, list), "Stories should be a list"
        
        # If there are stories, verify structure includes user info
        if len(stories) > 0:
            story = stories[0]
            assert "id" in story, "Story should have 'id'"
            assert "photo_url" in story, "Story should have 'photo_url'"
            assert "caption" in story, "Story should have 'caption'"
            assert "venue_name" in story, "Story should have 'venue_name'"
            assert "shares" in story, "Story should have 'shares'"
            assert "created_at" in story, "Story should have 'created_at'"
            assert "user" in story, "Story should have 'user' info"
            
            user = story["user"]
            assert "name" in user, "User should have 'name'"
            assert "tier" in user, "User should have 'tier'"
        
        print(f"✓ GET /api/stories/feed returns {len(stories)} stories with user info")
    
    def test_story_feed_requires_auth(self):
        """GET /api/stories/feed should require authentication"""
        response = requests.get(f"{BASE_URL}/api/stories/feed")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ GET /api/stories/feed requires authentication")


class TestPaymentHistory:
    """Test payment history endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.text}")
    
    def test_get_payment_history(self, auth_token):
        """GET /api/payments/history should return user's payment history"""
        response = requests.get(
            f"{BASE_URL}/api/payments/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions'"
        
        transactions = data["transactions"]
        assert isinstance(transactions, list), "Transactions should be a list"
        
        print(f"✓ GET /api/payments/history returns {len(transactions)} transactions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
