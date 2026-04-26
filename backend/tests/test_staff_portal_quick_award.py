"""
Staff Portal Quick Award, Validate Reward, Staff Transactions, and SwiftPOS Integration Tests

Tests for the enhanced Staff Portal endpoints:
- POST /api/perks/quick-award - Quick points award (main feature)
- GET /api/perks/spending-categories - Spending categories list
- POST /api/perks/validate-reward - Reward QR validation
- GET /api/perks/staff/transactions - Staff transaction log
- GET /api/perks/staff/transactions/summary - Transaction summary stats
- POST /api/perks/swiftpos/sale - SwiftPOS webhook
- GET /api/perks/swiftpos/unmatched - Unmatched SwiftPOS sales
- POST /api/perks/swiftpos/match/{receipt} - Manual match unmatched sale
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://luna-mobile-stage.preview.emergentagent.com").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"
USER_EMAIL = "luna@test.com"
USER_PASSWORD = "test123"


class TestAuthentication:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, user_token):
        """Get user_id for luna@test.com"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        return data.get("user_id")
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"✓ Admin login successful, token length: {len(admin_token)}")


class TestSpendingCategories:
    """Test GET /api/perks/spending-categories"""
    
    def test_get_spending_categories(self):
        """Get list of spending categories - no auth required"""
        response = requests.get(f"{BASE_URL}/api/perks/spending-categories")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) > 0, "No categories returned"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "label" in cat
            assert "icon" in cat
        
        # Verify expected categories exist
        cat_ids = [c["id"] for c in categories]
        expected = ["food", "drinks", "entry", "booth", "bottle_service", "merchandise", "general"]
        for exp in expected:
            assert exp in cat_ids, f"Missing category: {exp}"
        
        print(f"✓ Got {len(categories)} spending categories: {cat_ids}")


class TestQuickAward:
    """Test POST /api/perks/quick-award - Main Staff Portal feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, admin_token):
        """Get user_id for luna@test.com"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna@test.com",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("members"):
                return data["members"][0]["user_id"]
        
        # Fallback: login as user and get user_id
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json()["token"]
            me_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            if me_response.status_code == 200:
                return me_response.json().get("user_id")
        
        pytest.skip("Could not get user_id for testing")
    
    def test_quick_award_success(self, admin_token, user_id):
        """Test successful quick award - staff enters amount, points auto-calculated"""
        # Get initial balance
        response = requests.get(
            f"{BASE_URL}/api/perks/member/{user_id}/profile",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        initial_balance = 0
        if response.status_code == 200:
            initial_balance = response.json().get("points_balance", 0)
        
        # Award points
        test_amount = 50.00
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": user_id,
                "amount_spent": test_amount,
                "venue_id": "eclipse",
                "category": "drinks",
                "receipt_ref": f"TEST_QA_{uuid.uuid4().hex[:6]}"
            }
        )
        
        assert response.status_code == 200, f"Quick award failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") is True
        assert "transaction_id" in data
        assert "member_name" in data
        assert data.get("amount_spent") == test_amount
        assert data.get("category") == "drinks"
        assert "base_points" in data
        assert "bonus_points" in data
        assert "total_points" in data
        assert "multiplier" in data
        assert "tier" in data
        assert "new_balance" in data
        
        # Verify points calculation (10 points per $1 base — POINTS_PER_DOLLAR)
        assert data["base_points"] == int(test_amount * 10)
        assert data["total_points"] >= data["base_points"]  # With multiplier
        
        # Verify balance increased
        assert data["new_balance"] >= initial_balance + data["total_points"]
        
        print(f"✓ Quick award success: ${test_amount} → {data['total_points']} points (x{data['multiplier']} multiplier)")
        print(f"  Member: {data['member_name']}, Tier: {data['tier']}, New Balance: {data['new_balance']}")
    
    def test_quick_award_validation_zero_amount(self, admin_token, user_id):
        """Test validation: amount <= 0 returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": user_id,
                "amount_spent": 0,
                "venue_id": "eclipse",
                "category": "food"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "greater than" in data["detail"].lower() or "0" in data["detail"]
        print(f"✓ Zero amount correctly rejected: {data['detail']}")
    
    def test_quick_award_validation_negative_amount(self, admin_token, user_id):
        """Test validation: negative amount returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": user_id,
                "amount_spent": -50,
                "venue_id": "eclipse",
                "category": "food"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Negative amount correctly rejected")
    
    def test_quick_award_validation_exceeds_limit(self, admin_token, user_id):
        """Test validation: amount > 50000 returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": user_id,
                "amount_spent": 50001,
                "venue_id": "eclipse",
                "category": "booth"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "50,000" in data["detail"] or "50000" in data["detail"] or "limit" in data["detail"].lower()
        print(f"✓ Amount exceeding limit correctly rejected: {data['detail']}")
    
    def test_quick_award_invalid_user(self, admin_token):
        """Test: invalid user_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": "nonexistent_user_12345",
                "amount_spent": 100,
                "venue_id": "eclipse",
                "category": "food"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print(f"✓ Invalid user correctly rejected: {data['detail']}")
    
    def test_quick_award_requires_auth(self, user_id):
        """Test: endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            json={
                "user_id": user_id,
                "amount_spent": 100,
                "venue_id": "eclipse",
                "category": "food"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated request correctly rejected with 401")
    
    def test_quick_award_different_categories(self, admin_token, user_id):
        """Test quick award with different spending categories"""
        categories = ["food", "drinks", "entry", "booth", "bottle_service", "merchandise", "general"]
        
        for category in categories:
            response = requests.post(
                f"{BASE_URL}/api/perks/quick-award",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "user_id": user_id,
                    "amount_spent": 10.00,
                    "venue_id": "eclipse",
                    "category": category,
                    "receipt_ref": f"TEST_CAT_{category}_{uuid.uuid4().hex[:4]}"
                }
            )
            
            assert response.status_code == 200, f"Failed for category {category}: {response.text}"
            data = response.json()
            assert data.get("category") == category
        
        print(f"✓ All {len(categories)} categories work correctly")


class TestValidateReward:
    """Test POST /api/perks/validate-reward - Staff validates customer reward QR"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_validate_reward_invalid_qr(self, admin_token):
        """Test: invalid QR code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/perks/validate-reward",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "qr_code": "INVALID_QR_CODE_12345",
                "venue_id": "eclipse"
            }
        )
        
        # Per the agent context: "since no redemptions exist in test data, all validate calls will return 404"
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "not found" in data["detail"].lower()
        print(f"✓ Invalid QR code correctly rejected: {data['detail']}")
    
    def test_validate_reward_requires_auth(self):
        """Test: endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/perks/validate-reward",
            json={
                "qr_code": "SOME_QR_CODE",
                "venue_id": "eclipse"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated request correctly rejected with 401")


class TestStaffTransactions:
    """Test GET /api/perks/staff/transactions and summary endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_staff_transactions(self, admin_token):
        """Test: get staff transaction log"""
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "transactions" in data
        assert "total" in data
        assert isinstance(data["transactions"], list)
        
        # If there are transactions, verify structure
        if data["transactions"]:
            txn = data["transactions"][0]
            # Quick award transactions should have these fields
            expected_fields = ["id", "type", "user_id", "amount_spent", "venue_id"]
            for field in expected_fields:
                assert field in txn, f"Missing field: {field}"
        
        print(f"✓ Got {data['total']} staff transactions")
    
    def test_get_staff_transactions_with_venue_filter(self, admin_token):
        """Test: filter transactions by venue"""
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions?venue_id=eclipse",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All returned transactions should be for eclipse venue
        for txn in data["transactions"]:
            assert txn.get("venue_id") == "eclipse", f"Wrong venue: {txn.get('venue_id')}"
        
        print(f"✓ Venue filter works: {data['total']} transactions for eclipse")
    
    def test_get_staff_transactions_requires_auth(self):
        """Test: endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/perks/staff/transactions")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated request correctly rejected with 401")
    
    def test_get_staff_transaction_summary_today(self, admin_token):
        """Test: get transaction summary for today"""
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions/summary?period=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify summary structure
        assert data.get("period") == "today"
        assert "total_transactions" in data
        assert "total_revenue" in data
        assert "total_points_awarded" in data
        assert "unique_members_served" in data
        assert "by_category" in data
        assert "by_staff" in data
        
        print(f"✓ Today summary: {data['total_transactions']} txns, ${data['total_revenue']} revenue, {data['total_points_awarded']} points")
    
    def test_get_staff_transaction_summary_week(self, admin_token):
        """Test: get transaction summary for week"""
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions/summary?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("period") == "week"
        print(f"✓ Week summary: {data['total_transactions']} txns, ${data['total_revenue']} revenue")
    
    def test_get_staff_transaction_summary_month(self, admin_token):
        """Test: get transaction summary for month"""
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions/summary?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("period") == "month"
        print(f"✓ Month summary: {data['total_transactions']} txns, ${data['total_revenue']} revenue")
    
    def test_get_staff_transaction_summary_requires_auth(self):
        """Test: summary endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/perks/staff/transactions/summary")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated request correctly rejected with 401")


class TestSwiftPOSIntegration:
    """Test SwiftPOS webhook and reconciliation endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, admin_token):
        """Get user_id for luna@test.com"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna@test.com",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("members"):
                return data["members"][0]["user_id"]
        
        # Fallback
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json()["token"]
            me_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            if me_response.status_code == 200:
                return me_response.json().get("user_id")
        
        pytest.skip("Could not get user_id for testing")
    
    def test_swiftpos_sale_with_staff_auth_matched(self, admin_token):
        """Test: SwiftPOS sale webhook with staff auth - member matched by email"""
        receipt_num = f"TEST_SPOS_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "terminal_id": "POS_01",
                "receipt_number": receipt_num,
                "member_email": USER_EMAIL,  # luna@test.com
                "venue_id": "eclipse",
                "total_amount": 75.50,
                "payment_method": "card",
                "items": [
                    {"name": "Cocktail", "qty": 2, "price": 25.00, "category": "drinks"},
                    {"name": "Nachos", "qty": 1, "price": 25.50, "category": "food"}
                ]
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert data.get("matched") is True
        assert "transaction_id" in data
        assert "member_name" in data
        assert data.get("receipt_number") == receipt_num
        assert data.get("amount") == 75.50
        assert "total_points" in data
        assert "multiplier" in data
        assert "new_balance" in data
        
        print(f"✓ SwiftPOS sale matched: ${data['amount']} → {data['total_points']} points for {data['member_name']}")
    
    def test_swiftpos_sale_unmatched(self, admin_token):
        """Test: SwiftPOS sale with unknown member - logged for reconciliation"""
        receipt_num = f"TEST_UNMATCHED_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "terminal_id": "POS_02",
                "receipt_number": receipt_num,
                "member_email": "nonexistent_member@test.com",
                "venue_id": "eclipse",
                "total_amount": 45.00,
                "payment_method": "cash"
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is False
        assert data.get("matched") is False
        assert "reconciliation" in data.get("message", "").lower()
        assert data.get("receipt_number") == receipt_num
        
        print(f"✓ Unmatched sale logged for reconciliation: {receipt_num}")
    
    def test_swiftpos_sale_requires_auth(self):
        """Test: SwiftPOS webhook requires auth (staff token or X-SwiftPOS-Key)"""
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            json={
                "terminal_id": "POS_01",
                "receipt_number": "TEST_123",
                "member_email": USER_EMAIL,
                "venue_id": "eclipse",
                "total_amount": 50.00
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated SwiftPOS request correctly rejected with 401")
    
    def test_swiftpos_sale_invalid_webhook_key(self):
        """Test: Invalid X-SwiftPOS-Key is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            headers={"X-SwiftPOS-Key": "invalid_key_12345"},
            json={
                "terminal_id": "POS_01",
                "receipt_number": "TEST_123",
                "member_email": USER_EMAIL,
                "venue_id": "eclipse",
                "total_amount": 50.00
            }
        )
        
        # Per agent context: SWIFTPOS_WEBHOOK_KEY is not set, so any key will be rejected
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Invalid webhook key correctly rejected with 401")
    
    def test_get_unmatched_sales(self, admin_token):
        """Test: get unmatched SwiftPOS sales for reconciliation"""
        response = requests.get(
            f"{BASE_URL}/api/perks/swiftpos/unmatched",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "sales" in data
        assert "total" in data
        assert isinstance(data["sales"], list)
        
        # If there are unmatched sales, verify structure
        if data["sales"]:
            sale = data["sales"][0]
            expected_fields = ["terminal_id", "receipt_number", "venue_id", "total_amount", "status"]
            for field in expected_fields:
                assert field in sale, f"Missing field: {field}"
            assert sale.get("status") == "unmatched"
        
        print(f"✓ Got {data['total']} unmatched sales for reconciliation")
    
    def test_get_unmatched_sales_requires_auth(self):
        """Test: unmatched sales endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/perks/swiftpos/unmatched")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Unauthenticated request correctly rejected with 401")
    
    def test_match_unmatched_sale(self, admin_token, user_id):
        """Test: manually match an unmatched sale to a member"""
        # First create an unmatched sale
        receipt_num = f"TEST_MATCH_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "terminal_id": "POS_03",
                "receipt_number": receipt_num,
                "member_email": "unknown_customer@test.com",
                "venue_id": "juju",
                "total_amount": 120.00
            }
        )
        assert response.status_code == 200
        assert response.json().get("matched") is False
        
        # Now match it to the known user
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/match/{receipt_num}?user_id={user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert "points" in data.get("message", "").lower() or "matched" in data.get("message", "").lower()
        assert "total_points" in data
        assert data["total_points"] > 0
        
        print(f"✓ Manually matched sale: {receipt_num} → {data['total_points']} points awarded")
    
    def test_match_nonexistent_sale(self, admin_token, user_id):
        """Test: matching nonexistent receipt returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/match/NONEXISTENT_RECEIPT_12345?user_id={user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Nonexistent receipt correctly rejected with 404")
    
    def test_match_to_nonexistent_user(self, admin_token):
        """Test: matching to nonexistent user returns 404"""
        # First create an unmatched sale
        receipt_num = f"TEST_BADUSER_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/sale",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "terminal_id": "POS_04",
                "receipt_number": receipt_num,
                "member_email": "another_unknown@test.com",
                "venue_id": "pump",
                "total_amount": 50.00
            }
        )
        assert response.status_code == 200
        
        # Try to match to nonexistent user
        response = requests.post(
            f"{BASE_URL}/api/perks/swiftpos/match/{receipt_num}?user_id=nonexistent_user_xyz",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Nonexistent user correctly rejected with 404")


class TestEndToEndFlow:
    """End-to-end test of the staff portal flow"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, admin_token):
        """Get user_id for luna@test.com"""
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna@test.com",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("members"):
                return data["members"][0]["user_id"]
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json()["token"]
            me_response = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            if me_response.status_code == 200:
                return me_response.json().get("user_id")
        
        pytest.skip("Could not get user_id for testing")
    
    def test_full_staff_portal_flow(self, admin_token, user_id):
        """
        Complete staff portal flow:
        1. Get spending categories
        2. Search for member
        3. Award points
        4. Check transaction appears in log
        5. Check summary updated
        """
        # 1. Get spending categories
        response = requests.get(f"{BASE_URL}/api/perks/spending-categories")
        assert response.status_code == 200
        categories = response.json()["categories"]
        print(f"Step 1: Got {len(categories)} spending categories")
        
        # 2. Search for member
        response = requests.get(
            f"{BASE_URL}/api/perks/member/search?q=luna",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        members = response.json().get("members", [])
        assert len(members) > 0, "No members found"
        member = members[0]
        print(f"Step 2: Found member: {member.get('name')} ({member.get('tier')})")
        
        # 3. Award points
        test_receipt = f"TEST_E2E_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/perks/quick-award",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": user_id,
                "amount_spent": 150.00,
                "venue_id": "eclipse",
                "category": "bottle_service",
                "receipt_ref": test_receipt
            }
        )
        assert response.status_code == 200
        award_data = response.json()
        txn_id = award_data["transaction_id"]
        print(f"Step 3: Awarded {award_data['total_points']} points (txn: {txn_id})")
        
        # 4. Check transaction appears in log
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        transactions = response.json()["transactions"]
        txn_ids = [t.get("id") for t in transactions]
        assert txn_id in txn_ids, f"Transaction {txn_id} not found in log"
        print(f"Step 4: Transaction found in staff log")
        
        # 5. Check summary
        response = requests.get(
            f"{BASE_URL}/api/perks/staff/transactions/summary?period=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        summary = response.json()
        assert summary["total_transactions"] > 0
        assert summary["total_revenue"] >= 150.00
        print(f"Step 5: Summary shows {summary['total_transactions']} txns, ${summary['total_revenue']} revenue")
        
        print("✓ Full staff portal flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
