"""
Test suite for Luna Group VIP - Send Gift Card & QR Scanner Features
Tests: 
- POST /api/payments/gift-card/send - creates gift card for sending with Stripe checkout
- GET /api/payments/gift-card/redeem/{gift_code} - returns gift card info (public)
- POST /api/payments/gift-card/claim/{gift_code} - claims gift card for authenticated user
- Send gift card detects existing member (is_existing_member: true/false)
- Send gift card correctly calculates 10% bonus
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


class TestSendGiftCardAPI:
    """Tests for POST /api/payments/gift-card/send"""
    
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
    
    def test_send_gift_card_requires_auth(self):
        """Test send gift card requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            json={
                "amount": 25,
                "origin_url": "https://test.com",
                "recipient_email": "friend@example.com"
            }
        )
        assert response.status_code == 401
        print("PASS: Send gift card requires authentication")
    
    def test_send_gift_card_creates_checkout(self, auth_token):
        """Test send gift card creates Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 25,
                "origin_url": "https://luna-mobile-stage.preview.emergentagent.com",
                "recipient_email": "newfriend@example.com",
                "sender_message": "Happy Birthday!"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "checkout_url" in data
        assert "session_id" in data
        assert "gift_code" in data
        assert "share_url" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
        assert data["gift_code"].startswith("LUNA-GIFT-")
        print(f"PASS: Send gift card created checkout, gift_code: {data['gift_code']}")
        return data["gift_code"]
    
    def test_send_gift_card_returns_share_url(self, auth_token):
        """Test send gift card returns share URL"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 50,
                "origin_url": "https://luna-mobile-stage.preview.emergentagent.com",
                "recipient_email": "friend2@example.com"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "share_url" in data
        assert data["gift_code"] in data["share_url"]
        assert "/redeem-gift?code=" in data["share_url"]
        print(f"PASS: Share URL generated: {data['share_url']}")
    
    def test_send_gift_card_detects_existing_member(self, auth_token):
        """Test send gift card detects existing Luna member"""
        # Send to existing member (luna@test.com)
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 25,
                "origin_url": "https://test.com",
                "recipient_email": "admin@lunagroup.com.au"  # Existing admin user
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "is_existing_member" in data
        assert data["is_existing_member"] == True
        print(f"PASS: Detected existing member: is_existing_member={data['is_existing_member']}")
    
    def test_send_gift_card_detects_new_user(self, auth_token):
        """Test send gift card detects new user (not existing member)"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 25,
                "origin_url": "https://test.com",
                "recipient_email": "nonexistent_user_12345@example.com"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "is_existing_member" in data
        assert data["is_existing_member"] == False
        print(f"PASS: Detected new user: is_existing_member={data['is_existing_member']}")
    
    def test_send_gift_card_calculates_10_percent_bonus(self, auth_token):
        """Test send gift card correctly calculates 10% bonus"""
        test_amounts = [
            (25, 27.50, 2.50),
            (50, 55.00, 5.00),
            (100, 110.00, 10.00),
            (75, 82.50, 7.50),  # Custom amount
        ]
        
        for amount, expected_credit, expected_bonus in test_amounts:
            response = requests.post(
                f"{BASE_URL}/api/payments/gift-card/send",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "amount": amount,
                    "origin_url": "https://test.com",
                    "recipient_email": f"test_{amount}@example.com"
                }
            )
            assert response.status_code == 200
            data = response.json()
            
            assert data["gift_card_amount"] == amount
            assert data["wallet_credit"] == expected_credit
            assert data["bonus"] == expected_bonus
            print(f"PASS: ${amount} -> ${data['wallet_credit']} wallet credit (+${data['bonus']} bonus)")
    
    def test_send_gift_card_minimum_amount(self, auth_token):
        """Test send gift card enforces $10 minimum"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 5,
                "origin_url": "https://test.com",
                "recipient_email": "friend@example.com"
            }
        )
        assert response.status_code == 400
        assert "minimum" in response.json().get("detail", "").lower()
        print("PASS: Send gift card enforces $10 minimum")
    
    def test_send_gift_card_maximum_amount(self, auth_token):
        """Test send gift card enforces $500 maximum"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 600,
                "origin_url": "https://test.com",
                "recipient_email": "friend@example.com"
            }
        )
        assert response.status_code == 400
        assert "maximum" in response.json().get("detail", "").lower()
        print("PASS: Send gift card enforces $500 maximum")


class TestGiftCardRedeemInfo:
    """Tests for GET /api/payments/gift-card/redeem/{gift_code}"""
    
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
    
    @pytest.fixture
    def gift_code(self, auth_token):
        """Create a gift card and return its code"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 25,
                "origin_url": "https://test.com",
                "recipient_email": "test_redeem@example.com"
            }
        )
        if response.status_code == 200:
            return response.json().get("gift_code")
        pytest.skip("Failed to create gift card")
    
    def test_get_gift_card_info_public(self, gift_code):
        """Test get gift card info is public (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/payments/gift-card/redeem/{gift_code}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["gift_code"] == gift_code
        assert "amount" in data
        assert "wallet_credit" in data
        assert "bonus" in data
        assert "status" in data
        print(f"PASS: Gift card info retrieved (public): {gift_code}")
    
    def test_get_gift_card_info_returns_correct_values(self, gift_code):
        """Test gift card info returns correct bonus values"""
        response = requests.get(f"{BASE_URL}/api/payments/gift-card/redeem/{gift_code}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["amount"] == 25
        assert data["wallet_credit"] == 27.50
        assert data["bonus"] == 2.50
        print(f"PASS: Gift card info correct: ${data['amount']} -> ${data['wallet_credit']}")
    
    def test_get_gift_card_info_not_found(self):
        """Test gift card info returns 404 for invalid code"""
        response = requests.get(f"{BASE_URL}/api/payments/gift-card/redeem/INVALID-CODE-12345")
        assert response.status_code == 404
        print("PASS: Gift card info returns 404 for invalid code")


class TestGiftCardClaim:
    """Tests for POST /api/payments/gift-card/claim/{gift_code}"""
    
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
    
    @pytest.fixture
    def gift_code(self, auth_token):
        """Create a gift card and return its code"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 25,
                "origin_url": "https://test.com",
                "recipient_email": "test_claim@example.com"
            }
        )
        if response.status_code == 200:
            return response.json().get("gift_code")
        pytest.skip("Failed to create gift card")
    
    def test_claim_gift_card_requires_auth(self, gift_code):
        """Test claim gift card requires authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/gift-card/claim/{gift_code}")
        assert response.status_code == 401
        print("PASS: Claim gift card requires authentication")
    
    def test_claim_gift_card_pending_payment(self, auth_token, gift_code):
        """Test claim gift card fails if payment not completed"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/claim/{gift_code}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Gift card is pending_payment, not paid yet
        assert response.status_code == 400
        assert "pending_payment" in response.json().get("detail", "")
        print("PASS: Claim gift card fails for pending_payment status")
    
    def test_claim_gift_card_not_found(self, auth_token):
        """Test claim gift card returns 404 for invalid code"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/claim/INVALID-CODE-12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print("PASS: Claim gift card returns 404 for invalid code")


class TestStaffPortalMemberSearch:
    """Tests for Staff Portal member search (existing functionality)"""
    
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
    
    def test_member_search_still_works(self, auth_token):
        """Test member search still works correctly"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        assert len(data["members"]) > 0
        print(f"PASS: Member search works, found {len(data['members'])} members")
    
    def test_member_profile_still_works(self, auth_token):
        """Test member profile still works correctly"""
        # First search for a member
        search_response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert search_response.status_code == 200
        members = search_response.json().get("members", [])
        assert len(members) > 0
        
        user_id = members[0]["user_id"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/perks/member/{user_id}/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tier" in data
        assert "benefits" in data
        assert "today" in data
        print(f"PASS: Member profile works for {data['name']} ({data['tier']})")


class TestPreviousFeaturesStillWork:
    """Tests to ensure previous features still work"""
    
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
    
    def test_gift_card_checkout_still_works(self, auth_token):
        """Test regular gift card checkout still works"""
        response = requests.post(
            f"{BASE_URL}/api/payments/gift-card/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"amount": 25, "origin_url": "https://test.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "checkout_url" in data
        assert "wallet_credit" in data
        assert data["wallet_credit"] == 27.50
        print("PASS: Regular gift card checkout still works")
    
    def test_wallet_balance_still_works(self, auth_token):
        """Test wallet balance endpoint still works"""
        response = requests.get(
            f"{BASE_URL}/api/payments/wallet/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "wallet_balance" in data
        print(f"PASS: Wallet balance works: ${data['wallet_balance']}")
    
    def test_packages_endpoint_still_works(self):
        """Test packages endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        data = response.json()
        
        assert "packages" in data
        gift_cards = [p for p in data["packages"] if p["type"] == "gift_card"]
        assert len(gift_cards) == 4
        print(f"PASS: Packages endpoint works, {len(gift_cards)} gift cards available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
