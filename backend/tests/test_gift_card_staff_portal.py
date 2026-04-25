"""
Test suite for Luna Group VIP - Gift Card Checkout & Staff Portal APIs
Tests: Gift card checkout with Stripe, wallet balance, member search, member profile, staff actions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "luna@test.com"
TEST_PASSWORD = "test123"
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"


class TestGiftCardPackages:
    """Tests for gift card packages in /api/payments/packages"""
    
    def test_packages_endpoint_returns_gift_cards(self):
        """Test /api/payments/packages includes gift card packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        data = response.json()
        assert "packages" in data
        
        gift_cards = [p for p in data["packages"] if p["type"] == "gift_card"]
        assert len(gift_cards) == 4, f"Expected 4 gift cards, got {len(gift_cards)}"
        print(f"PASS: Found {len(gift_cards)} gift card packages")
    
    def test_gift_card_25_package(self):
        """Test $25 gift card package has correct values"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        gc25 = next((p for p in data["packages"] if p["id"] == "gift_card_25"), None)
        assert gc25 is not None, "gift_card_25 not found"
        assert gc25["amount"] == 25.0
        assert gc25["wallet_credit"] == 27.5
        print(f"PASS: gift_card_25: ${gc25['amount']} -> ${gc25['wallet_credit']} wallet credit")
    
    def test_gift_card_50_package(self):
        """Test $50 gift card package has correct values"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        gc50 = next((p for p in data["packages"] if p["id"] == "gift_card_50"), None)
        assert gc50 is not None, "gift_card_50 not found"
        assert gc50["amount"] == 50.0
        assert gc50["wallet_credit"] == 55.0
        print(f"PASS: gift_card_50: ${gc50['amount']} -> ${gc50['wallet_credit']} wallet credit")
    
    def test_gift_card_100_package(self):
        """Test $100 gift card package has correct values"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        gc100 = next((p for p in data["packages"] if p["id"] == "gift_card_100"), None)
        assert gc100 is not None, "gift_card_100 not found"
        assert gc100["amount"] == 100.0
        assert gc100["wallet_credit"] == 110.0
        print(f"PASS: gift_card_100: ${gc100['amount']} -> ${gc100['wallet_credit']} wallet credit")
    
    def test_gift_card_150_package(self):
        """Test $150 gift card package has correct values"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        gc150 = next((p for p in data["packages"] if p["id"] == "gift_card_150"), None)
        assert gc150 is not None, "gift_card_150 not found"
        assert gc150["amount"] == 150.0
        assert gc150["wallet_credit"] == 165.0
        print(f"PASS: gift_card_150: ${gc150['amount']} -> ${gc150['wallet_credit']} wallet credit")


class TestGiftCardCheckout:
    """Tests for POST /api/payments/gift-card/checkout"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_gift_card_checkout_requires_auth(self):
        """Test gift card checkout requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            json={"amount": 25, "origin_url": "https://test.com"}
        )
        assert response.status_code == 401
        print("PASS: Gift card checkout requires authentication")
    
    def test_gift_card_checkout_creates_stripe_session(self, auth_token):
        """Test gift card checkout creates Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 25, "origin_url": "https://luna-mobile-stage.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
        print(f"PASS: Stripe checkout session created: {data['session_id'][:30]}...")
    
    def test_gift_card_checkout_returns_bonus_info(self, auth_token):
        """Test gift card checkout returns correct bonus calculation"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 50, "origin_url": "https://test.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["gift_card_amount"] == 50
        assert data["wallet_credit"] == 55.0
        assert data["bonus"] == 5.0
        print(f"PASS: $50 gift card -> ${data['wallet_credit']} wallet credit (+${data['bonus']} bonus)")
    
    def test_gift_card_checkout_minimum_amount(self, auth_token):
        """Test gift card checkout enforces $10 minimum"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 5, "origin_url": "https://test.com"}
        )
        assert response.status_code == 400
        assert "minimum" in response.json().get("detail", "").lower()
        print("PASS: Gift card checkout enforces $10 minimum")
    
    def test_gift_card_checkout_maximum_amount(self, auth_token):
        """Test gift card checkout enforces $500 maximum"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 600, "origin_url": "https://test.com"}
        )
        assert response.status_code == 400
        assert "maximum" in response.json().get("detail", "").lower()
        print("PASS: Gift card checkout enforces $500 maximum")
    
    def test_gift_card_custom_amount_bonus(self, auth_token):
        """Test custom amount gift card gets 10% bonus"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 75, "origin_url": "https://test.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["gift_card_amount"] == 75
        assert data["wallet_credit"] == 82.5  # 75 * 1.10
        assert data["bonus"] == 7.5
        print(f"PASS: Custom $75 gift card -> ${data['wallet_credit']} wallet credit")


class TestWalletBalance:
    """Tests for GET /api/payments/wallet/balance"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_wallet_balance_requires_auth(self):
        """Test wallet balance requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/wallet/balance")
        assert response.status_code == 401
        print("PASS: Wallet balance requires authentication")
    
    def test_wallet_balance_returns_balance(self, auth_token):
        """Test wallet balance returns balance value"""
        response = requests.get(
            f"{BASE_URL}/api/payments/wallet/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "wallet_balance" in data
        assert isinstance(data["wallet_balance"], (int, float))
        print(f"PASS: Wallet balance returned: ${data['wallet_balance']}")


class TestMemberSearch:
    """Tests for GET /api/perks/member/search"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token (admin role required)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_member_search_requires_auth(self):
        """Test member search requires authentication"""
        response = requests.get(f"{BASE_URL}/api/perks/member/search?q=luna")
        assert response.status_code == 401
        print("PASS: Member search requires authentication")
    
    def test_member_search_returns_results(self, auth_token):
        """Test member search returns matching members"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        assert "total" in data
        assert len(data["members"]) > 0
        print(f"PASS: Member search returned {data['total']} results for 'luna'")
    
    def test_member_search_returns_tier_info(self, auth_token):
        """Test member search results include tier information"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for member in data["members"]:
            assert "tier" in member
            assert "tier_color" in member
            assert "points_balance" in member
        print("PASS: Member search results include tier info")
    
    def test_member_search_minimum_query_length(self, auth_token):
        """Test member search requires at least 2 characters"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=a",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400
        print("PASS: Member search requires minimum 2 characters")


class TestMemberProfile:
    """Tests for GET /api/perks/member/{user_id}/profile"""
    
    @pytest.fixture
    def auth_token_and_user_id(self):
        """Get authentication token and user_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {}).get("user_id")
        pytest.skip("Authentication failed")
    
    def test_member_profile_requires_auth(self):
        """Test member profile requires authentication"""
        response = requests.get(f"{BASE_URL}/api/perks/member/test-id/profile")
        assert response.status_code == 401
        print("PASS: Member profile requires authentication")
    
    def test_member_profile_returns_data(self, auth_token_and_user_id):
        """Test member profile returns detailed member data"""
        token, user_id = auth_token_and_user_id
        response = requests.get(
            f"{BASE_URL}/api/perks/member/{user_id}/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "user_id" in data
        assert "name" in data
        assert "tier" in data
        assert "benefits" in data
        assert "today" in data
        print(f"PASS: Member profile returned for {data['name']} ({data['tier']})")
    
    def test_member_profile_includes_benefits(self, auth_token_and_user_id):
        """Test member profile includes tier benefits"""
        token, user_id = auth_token_and_user_id
        response = requests.get(
            f"{BASE_URL}/api/perks/member/{user_id}/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        benefits = data.get("benefits", {})
        assert "free_entry_before_time" in benefits
        assert "complimentary_drink" in benefits
        assert "guest_entry" in benefits
        print(f"PASS: Member profile includes benefits: free_entry_before={benefits.get('free_entry_before_time')}")
    
    def test_member_profile_includes_today_activity(self, auth_token_and_user_id):
        """Test member profile includes today's activity"""
        token, user_id = auth_token_and_user_id
        response = requests.get(
            f"{BASE_URL}/api/perks/member/{user_id}/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        today = data.get("today", {})
        assert "entries" in today
        assert "drink_redeemed" in today
        assert "guest_used" in today
        print(f"PASS: Member profile includes today activity: entries={today.get('entries')}")
    
    def test_member_profile_not_found(self, auth_token_and_user_id):
        """Test member profile returns 404 for non-existent user"""
        token, _ = auth_token_and_user_id
        response = requests.get(
            f"{BASE_URL}/api/perks/member/non-existent-user-id/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404
        print("PASS: Member profile returns 404 for non-existent user")


class TestStaffEntryLog:
    """Tests for POST /api/perks/entry/log"""
    
    @pytest.fixture
    def auth_token_and_user_id(self):
        """Get authentication token and user_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {}).get("user_id")
        pytest.skip("Authentication failed")
    
    def test_entry_log_requires_auth(self):
        """Test entry log requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/perks/entry/log",
            json={"user_id": "test", "venue_id": "eclipse", "entry_type": "free_member"}
        )
        assert response.status_code == 401
        print("PASS: Entry log requires authentication")
    
    def test_entry_log_success(self, auth_token_and_user_id):
        """Test entry log creates entry record"""
        token, user_id = auth_token_and_user_id
        response = requests.post(
            f"{BASE_URL}/api/perks/entry/log",
            headers={"Authorization": f"Bearer {token}"},
            json={"user_id": user_id, "venue_id": "eclipse", "entry_type": "free_member"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "entry" in data
        assert "points_awarded" in data
        print(f"PASS: Entry logged, {data['points_awarded']} points awarded")


class TestStaffDrinksRedeem:
    """Tests for POST /api/perks/drinks/redeem"""
    
    @pytest.fixture
    def auth_token_and_user_id(self):
        """Get authentication token and user_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {}).get("user_id")
        pytest.skip("Authentication failed")
    
    def test_drinks_redeem_requires_auth(self):
        """Test drinks redeem requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/perks/drinks/redeem",
            json={"user_id": "test", "venue_id": "eclipse", "drink_type": "house_wine"}
        )
        assert response.status_code == 401
        print("PASS: Drinks redeem requires authentication")
    
    def test_drinks_redeem_tier_restriction(self, auth_token_and_user_id):
        """Test drinks redeem enforces tier restrictions (Bronze has no comp drinks)"""
        token, user_id = auth_token_and_user_id
        response = requests.post(
            f"{BASE_URL}/api/perks/drinks/redeem",
            headers={"Authorization": f"Bearer {token}"},
            json={"user_id": user_id, "venue_id": "eclipse", "drink_type": "house_wine"}
        )
        # Bronze tier doesn't have complimentary drinks
        assert response.status_code == 403
        assert "don't have complimentary drinks" in response.json().get("detail", "")
        print("PASS: Drinks redeem enforces tier restrictions (Bronze denied)")


class TestStaffGuestEntry:
    """Tests for POST /api/perks/entry/guest"""
    
    @pytest.fixture
    def auth_token_and_user_id(self):
        """Get authentication token and user_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {}).get("user_id")
        pytest.skip("Authentication failed")
    
    def test_guest_entry_requires_auth(self):
        """Test guest entry requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/perks/entry/guest",
            json={"member_user_id": "test", "venue_id": "eclipse"}
        )
        assert response.status_code == 401
        print("PASS: Guest entry requires authentication")
    
    def test_guest_entry_tier_restriction(self, auth_token_and_user_id):
        """Test guest entry enforces tier restrictions (Bronze has no guest entry)"""
        token, user_id = auth_token_and_user_id
        response = requests.post(
            f"{BASE_URL}/api/perks/entry/guest",
            headers={"Authorization": f"Bearer {token}"},
            json={"member_user_id": user_id, "venue_id": "eclipse", "guest_name": "Test Guest"}
        )
        # Bronze tier doesn't have guest entry privileges
        assert response.status_code == 403
        assert "don't have guest entry privileges" in response.json().get("detail", "")
        print("PASS: Guest entry enforces tier restrictions (Bronze denied)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
