"""
VIP Table Booking, Bottle Service Pre-Orders, Admin Push Messages, and Geofence Location Check Tests
Tests for Luna Group VIP App - New features implemented in this iteration

Endpoints tested:
- GET /api/venues/{venue_id}/tables - VIP table inventory with availability
- POST /api/bookings/table - Create VIP table booking
- POST /api/bookings/table/{booking_id}/deposit - Get deposit payment intent
- POST /api/bookings/table/{booking_id}/confirm - Confirm booking after deposit
- DELETE /api/bookings/table/{booking_id} - Cancel table booking
- GET /api/bookings/my-tables - Get user's table bookings
- GET /api/bookings/bottle-menu/{venue_id} - Bottle service menu
- POST /api/bookings/bottle-preorder - Create bottle pre-order
- GET /api/bookings/bottle-orders - Get user's bottle orders
- DELETE /api/bookings/bottle-order/{order_id} - Cancel bottle order
- GET /api/admin/push-messages - Admin push messages list
- POST /api/admin/push-messages - Create push message
- PUT /api/admin/push-messages/{id} - Update push message
- DELETE /api/admin/push-messages/{id} - Delete push message
- POST /api/geofences/check-location - Geofence location check
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://birthday-rewards-1.preview.emergentagent.com')

# Test credentials
USER_EMAIL = "luna@test.com"
USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"


@pytest.fixture(scope="module")
def user_token():
    """Get user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"User authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def user_headers(user_token):
    """Headers with user auth token"""
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ═══════════════════════════════════════════════════════════════════════════════
# VIP TABLE INVENTORY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestVIPTableInventory:
    """Tests for GET /api/venues/{venue_id}/tables endpoint"""

    def test_get_eclipse_tables_with_friday_date(self, user_headers):
        """Eclipse is open Fri/Sat - should return tables on Friday"""
        # Find next Friday
        today = datetime.now()
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0 and today.hour >= 12:
            days_until_friday = 7
        next_friday = today + timedelta(days=days_until_friday)
        date_str = next_friday.strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/venues/eclipse/tables?date={date_str}",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["venue_id"] == "eclipse"
        assert data["venue_closed"] == False
        assert "tables" in data
        assert len(data["tables"]) > 0, "Eclipse should have VIP tables"
        
        # Verify table structure
        table = data["tables"][0]
        assert "id" in table
        assert "name" in table
        assert "capacity" in table
        assert "min_spend" in table
        assert "deposit_amount" in table
        assert "available" in table

    def test_get_eclipse_tables_without_date(self, user_headers):
        """Get all tables without date filtering"""
        response = requests.get(
            f"{BASE_URL}/api/venues/eclipse/tables",
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["venue_id"] == "eclipse"
        assert "tables" in data
        # Without date, all tables should be marked available
        for table in data["tables"]:
            assert table["available"] == True

    def test_get_eclipse_tables_tuesday_closed(self, user_headers):
        """Eclipse is closed on Tuesdays - should return venue_closed=true"""
        # Find next Tuesday
        today = datetime.now()
        days_until_tuesday = (1 - today.weekday()) % 7
        if days_until_tuesday == 0:
            days_until_tuesday = 7
        next_tuesday = today + timedelta(days=days_until_tuesday)
        date_str = next_tuesday.strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/venues/eclipse/tables?date={date_str}",
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["venue_closed"] == True
        assert "closed_reason" in data
        assert "Tuesday" in data["closed_reason"]
        assert len(data["tables"]) == 0

    def test_get_juju_tables_sunday(self, user_headers):
        """Juju is open Wed-Sun - should return tables on Sunday"""
        # Find next Sunday
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        next_sunday = today + timedelta(days=days_until_sunday)
        date_str = next_sunday.strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/venues/juju/tables?date={date_str}",
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["venue_id"] == "juju"
        assert data["venue_closed"] == False
        assert len(data["tables"]) > 0

    def test_get_tables_invalid_venue(self, user_headers):
        """Invalid venue should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/venues/invalid_venue/tables",
            headers=user_headers
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# VIP TABLE BOOKING CRUD TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestVIPTableBooking:
    """Tests for VIP table booking CRUD operations"""
    
    booking_id = None  # Class variable to store booking ID for subsequent tests

    def test_create_table_booking(self, user_headers):
        """POST /api/bookings/table - Create a new VIP table booking"""
        # Find next Friday for booking
        today = datetime.now()
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0:
            days_until_friday = 7
        next_friday = today + timedelta(days=days_until_friday)
        date_str = next_friday.strftime("%Y-%m-%d")
        
        payload = {
            "venue_id": "eclipse",
            "table_id": "ecl_vip1",
            "date": date_str,
            "party_size": 6,
            "special_requests": "TEST_Birthday celebration",
            "contact_phone": "+61400000000"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/table",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "booking" in data
        assert data["booking"]["venue_id"] == "eclipse"
        assert data["booking"]["table_id"] == "ecl_vip1"
        assert data["booking"]["status"] == "pending"
        assert data["booking"]["deposit_paid"] == False
        assert "booking_id" in data["booking"]
        
        # Store booking ID for subsequent tests
        TestVIPTableBooking.booking_id = data["booking"]["booking_id"]

    def test_create_deposit_intent(self, user_headers):
        """POST /api/bookings/table/{booking_id}/deposit - Get deposit payment intent"""
        if not TestVIPTableBooking.booking_id:
            pytest.skip("No booking ID from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/table/{TestVIPTableBooking.booking_id}/deposit",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "payment_intent_id" in data
        assert data["demo_mode"] == True  # Demo mode for testing
        assert "amount" in data
        assert data["currency"] == "aud"

    def test_confirm_table_booking(self, user_headers):
        """POST /api/bookings/table/{booking_id}/confirm - Confirm booking after deposit"""
        if not TestVIPTableBooking.booking_id:
            pytest.skip("No booking ID from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/table/{TestVIPTableBooking.booking_id}/confirm?payment_intent_id=pi_demo_test123",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "points_earned" in data
        assert data["points_earned"] > 0

    def test_get_my_table_bookings(self, user_headers):
        """GET /api/bookings/my-tables - Get user's table bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/my-tables",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "bookings" in data
        # Should have at least the booking we just created
        if TestVIPTableBooking.booking_id:
            booking_ids = [b["booking_id"] for b in data["bookings"]]
            assert TestVIPTableBooking.booking_id in booking_ids

    def test_cancel_table_booking(self, user_headers):
        """DELETE /api/bookings/table/{booking_id} - Cancel a table booking"""
        if not TestVIPTableBooking.booking_id:
            pytest.skip("No booking ID from previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/bookings/table/{TestVIPTableBooking.booking_id}",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True

    def test_create_booking_invalid_table(self, user_headers):
        """Creating booking with invalid table should return 404"""
        payload = {
            "venue_id": "eclipse",
            "table_id": "invalid_table",
            "date": "2026-04-18",
            "party_size": 4
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/table",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 404

    def test_create_booking_exceeds_capacity(self, user_headers):
        """Creating booking exceeding table capacity should return 400"""
        payload = {
            "venue_id": "eclipse",
            "table_id": "ecl_vip2",  # Capacity is 6
            "date": "2026-04-25",
            "party_size": 20  # Exceeds capacity
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/table",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# BOTTLE SERVICE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestBottleService:
    """Tests for bottle service menu and pre-orders"""
    
    order_id = None

    def test_get_bottle_menu_eclipse(self, user_headers):
        """GET /api/bookings/bottle-menu/eclipse - Returns bottle service menu"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-menu/eclipse",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["venue_id"] == "eclipse"
        assert "menu" in data
        assert len(data["menu"]) > 0
        assert "categories" in data
        
        # Verify menu item structure
        item = data["menu"][0]
        assert "id" in item
        assert "name" in item
        assert "category" in item
        assert "price" in item

    def test_get_bottle_menu_after_dark(self, user_headers):
        """GET /api/bookings/bottle-menu/after_dark - Returns bottle service menu"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-menu/after_dark",
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["venue_id"] == "after_dark"
        assert len(data["menu"]) > 0

    def test_get_bottle_menu_pump(self, user_headers):
        """GET /api/bookings/bottle-menu/pump - Returns bottle service menu"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-menu/pump",
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["venue_id"] == "pump"
        assert len(data["menu"]) > 0

    def test_get_bottle_menu_invalid_venue(self, user_headers):
        """Invalid venue should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-menu/invalid_venue",
            headers=user_headers
        )
        assert response.status_code == 404

    def test_create_bottle_preorder(self, user_headers):
        """POST /api/bookings/bottle-preorder - Create a bottle service pre-order"""
        payload = {
            "venue_id": "eclipse",
            "date": "2026-04-18",
            "items": [
                {"package_id": "ecl_grey_goose", "quantity": 1},
                {"package_id": "ecl_moet", "quantity": 2}
            ],
            "special_requests": "TEST_Chilled bottles please"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/bottle-preorder",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "order" in data
        assert data["order"]["venue_id"] == "eclipse"
        assert data["order"]["status"] == "pending"
        assert "total" in data["order"]
        assert data["order"]["total"] == 350 + (250 * 2)  # Grey Goose + 2x Moet
        assert "points_earned" in data
        
        TestBottleService.order_id = data["order"]["order_id"]

    def test_get_my_bottle_orders(self, user_headers):
        """GET /api/bookings/bottle-orders - Get user's bottle orders"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-orders",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data
        
        if TestBottleService.order_id:
            order_ids = [o["order_id"] for o in data["orders"]]
            assert TestBottleService.order_id in order_ids

    def test_cancel_bottle_order(self, user_headers):
        """DELETE /api/bookings/bottle-order/{order_id} - Cancel a bottle order"""
        if not TestBottleService.order_id:
            pytest.skip("No order ID from previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/bookings/bottle-order/{TestBottleService.order_id}",
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True

    def test_create_preorder_invalid_item(self, user_headers):
        """Creating pre-order with invalid item should return 400"""
        payload = {
            "venue_id": "eclipse",
            "date": "2026-04-18",
            "items": [
                {"package_id": "invalid_item", "quantity": 1}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/bottle-preorder",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN PUSH MESSAGES CRUD TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminPushMessages:
    """Tests for admin push message CRUD operations"""
    
    message_id = None

    def test_list_push_messages(self, admin_headers):
        """GET /api/admin/push-messages - List all push messages"""
        response = requests.get(
            f"{BASE_URL}/api/admin/push-messages",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "messages" in data
        assert "total" in data

    def test_create_push_message(self, admin_headers):
        """POST /api/admin/push-messages - Create a new push message"""
        payload = {
            "venue_id": "eclipse",
            "time_slot": "prime",
            "title": "TEST_Special Night Tonight",
            "body": "TEST_Don't miss our exclusive event!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/push-messages",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        assert data["message"]["venue_id"] == "eclipse"
        assert data["message"]["time_slot"] == "prime"
        assert "id" in data["message"]
        
        TestAdminPushMessages.message_id = data["message"]["id"]

    def test_update_push_message(self, admin_headers):
        """PUT /api/admin/push-messages/{id} - Update a push message"""
        if not TestAdminPushMessages.message_id:
            pytest.skip("No message ID from previous test")
        
        payload = {
            "title": "TEST_Updated Title",
            "body": "TEST_Updated body text"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/push-messages/{TestAdminPushMessages.message_id}",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True

    def test_delete_push_message(self, admin_headers):
        """DELETE /api/admin/push-messages/{id} - Delete a push message"""
        if not TestAdminPushMessages.message_id:
            pytest.skip("No message ID from previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/push-messages/{TestAdminPushMessages.message_id}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True

    def test_push_messages_requires_auth(self):
        """Unauthenticated requests should get 401"""
        response = requests.get(
            f"{BASE_URL}/api/admin/push-messages"
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# GEOFENCE LOCATION CHECK TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestGeofenceLocationCheck:
    """Tests for POST /api/geofences/check-location endpoint"""

    def test_check_location_brisbane_cbd(self, user_headers):
        """Check location in Brisbane CBD (near Eclipse/After Dark/Su Casa)"""
        # Brisbane CBD coordinates (near Luna venues)
        payload = {
            "latitude": -27.4572,
            "longitude": 153.0347
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geofences/check-location",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "triggered" in data
        assert "notifications_sent" in data
        assert "message" in data

    def test_check_location_gold_coast(self, user_headers):
        """Check location in Gold Coast (near Su Casa GC/Pump/Mamacita)"""
        # Surfers Paradise coordinates
        payload = {
            "latitude": -28.0033,
            "longitude": 153.4300
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geofences/check-location",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "triggered" in data
        assert "message" in data

    def test_check_location_outside_geofences(self, user_headers):
        """Check location far from any venues"""
        # Sydney coordinates (far from Brisbane/Gold Coast)
        payload = {
            "latitude": -33.8688,
            "longitude": 151.2093
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geofences/check-location",
            json=payload,
            headers=user_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["triggered"] == []
        assert data["notifications_sent"] == 0

    def test_check_location_requires_auth(self):
        """Check location without auth should fail"""
        payload = {
            "latitude": -27.4572,
            "longitude": 153.0347
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geofences/check-location",
            json=payload
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# ADDITIONAL BOTTLE MENU COVERAGE
# ═══════════════════════════════════════════════════════════════════════════════

class TestBottleMenuAllVenues:
    """Test bottle menus exist for all venues"""

    @pytest.mark.parametrize("venue_id", [
        "eclipse", "after_dark", "su_casa_brisbane", "su_casa_gold_coast",
        "juju", "night_market", "ember_and_ash", "pump", "mamacita"
    ])
    def test_bottle_menu_exists(self, user_headers, venue_id):
        """Each venue should have a bottle menu"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/bottle-menu/{venue_id}",
            headers=user_headers
        )
        assert response.status_code == 200, f"Venue {venue_id} bottle menu failed: {response.status_code}"
        
        data = response.json()
        assert data["venue_id"] == venue_id
        assert len(data["menu"]) > 0, f"Venue {venue_id} has empty bottle menu"


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN CLUSTER MESSAGES TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminClusterMessages:
    """Tests for admin cluster message CRUD operations"""
    
    message_id = None

    def test_list_cluster_messages(self, admin_headers):
        """GET /api/admin/cluster-messages - List all cluster messages"""
        response = requests.get(
            f"{BASE_URL}/api/admin/cluster-messages",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "messages" in data
        assert "total" in data

    def test_create_cluster_message(self, admin_headers):
        """POST /api/admin/cluster-messages - Create a new cluster message"""
        payload = {
            "cluster": "brisbane_cbd",
            "time_slot": "prime",
            "title": "TEST_Big Night in Brisbane",
            "body": "TEST_Multiple venues are going off tonight!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/cluster-messages",
            json=payload,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        assert data["message"]["cluster"] == "brisbane_cbd"
        
        TestAdminClusterMessages.message_id = data["message"]["id"]

    def test_delete_cluster_message(self, admin_headers):
        """DELETE /api/admin/cluster-messages/{id} - Delete a cluster message"""
        if not TestAdminClusterMessages.message_id:
            pytest.skip("No message ID from previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/cluster-messages/{TestAdminClusterMessages.message_id}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
