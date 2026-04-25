"""
Test suite for WebSocket and Churn Prediction features
Tests:
- WebSocket stats endpoint
- Churn analysis endpoints
- Win-back campaign endpoints
- Role-based access control
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luna-mobile-stage.preview.emergentagent.com').rstrip('/')


class TestWebSocketEndpoints:
    """WebSocket-related endpoint tests"""
    
    def test_ws_stats_returns_connection_statistics(self):
        """GET /api/ws/stats returns WebSocket connection statistics"""
        response = requests.get(f"{BASE_URL}/api/ws/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_global_subscribers" in data
        assert "total_user_connections" in data
        assert "auction_subscribers" in data
        assert isinstance(data["total_global_subscribers"], int)
        assert isinstance(data["total_user_connections"], int)
        assert isinstance(data["auction_subscribers"], dict)
        print(f"✓ WebSocket stats: {data['total_global_subscribers']} global, {data['total_user_connections']} user connections")


class TestChurnUserEndpoints:
    """Churn endpoints for regular users"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def user_id(self):
        """Get user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        return response.json()["user"]["user_id"]
    
    def test_my_status_returns_engagement_level(self, user_token):
        """GET /api/churn/my-status returns user engagement status"""
        response = requests.get(
            f"{BASE_URL}/api/churn/my-status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "engagement_level" in data
        assert "risk_level" in data
        assert "days_since_visit" in data
        assert data["engagement_level"] in ["healthy", "at_risk"]
        assert data["risk_level"] in ["low", "medium", "high"]
        print(f"✓ User engagement: {data['engagement_level']}, risk: {data['risk_level']}")
    
    def test_analyze_own_account(self, user_token, user_id):
        """GET /api/churn/analyze/{user_id} returns detailed analysis for own account"""
        response = requests.get(
            f"{BASE_URL}/api/churn/analyze/{user_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "metrics" in data
        assert "win_back_offer" in data
        assert "analyzed_at" in data
        
        # Validate risk score is 0-100
        assert 0 <= data["risk_score"] <= 100
        
        # Validate metrics structure
        metrics = data["metrics"]
        assert "days_inactive" in metrics
        assert "recent_visits_90d" in metrics
        assert "engagement_change" in metrics
        assert "points_balance" in metrics
        assert "tier" in metrics
        
        print(f"✓ Churn analysis: risk_score={data['risk_score']}, level={data['risk_level']}")
    
    def test_analyze_other_account_forbidden(self, user_token):
        """GET /api/churn/analyze/{other_user_id} returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/churn/analyze/some-other-user-id",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        print("✓ Non-admin cannot analyze other users")
    
    def test_my_status_requires_auth(self):
        """GET /api/churn/my-status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/churn/my-status")
        assert response.status_code == 401
        print("✓ my-status requires authentication")


class TestChurnStaffEndpoints:
    """Churn endpoints for staff/admin users"""
    
    @pytest.fixture
    def staff_token(self):
        """Get staff authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "venue@eclipse.com",
            "password": "venue123"
        })
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def user_id(self):
        """Get regular user ID for testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        return response.json()["user"]["user_id"]
    
    def test_dashboard_returns_churn_stats(self, staff_token):
        """GET /api/churn/dashboard returns churn statistics for staff"""
        response = requests.get(
            f"{BASE_URL}/api/churn/dashboard",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "risk_distribution" in data
        assert "total_at_risk" in data
        assert "churned_60d" in data
        assert "recent_campaigns_7d" in data
        assert "high_risk_users" in data
        assert "recent_campaigns" in data
        
        # Validate risk distribution structure
        risk_dist = data["risk_distribution"]
        assert "high" in risk_dist
        assert "medium" in risk_dist
        assert "low" in risk_dist
        
        print(f"✓ Churn dashboard: {data['total_at_risk']} at risk, {data['churned_60d']} churned")
    
    def test_dashboard_requires_staff_role(self):
        """GET /api/churn/dashboard requires staff role"""
        # Login as regular user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        user_token = response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/churn/dashboard",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        print("✓ Dashboard requires staff role")
    
    def test_trigger_winback_creates_campaign(self, staff_token, user_id):
        """POST /api/churn/trigger-winback creates win-back campaign"""
        response = requests.post(
            f"{BASE_URL}/api/churn/trigger-winback",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"user_id": user_id}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "campaign_id" in data
        assert "offer" in data
        assert data["notification_sent"] == True
        
        # Validate offer structure
        offer = data["offer"]
        assert "type" in offer
        assert "value" in offer
        assert "points" in offer
        
        print(f"✓ Win-back campaign created: {data['campaign_id']}, offer: {offer['type']}")
    
    def test_trigger_winback_with_specific_offer(self, staff_token, user_id):
        """POST /api/churn/trigger-winback with specific offer type"""
        response = requests.post(
            f"{BASE_URL}/api/churn/trigger-winback",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"user_id": user_id, "offer_type": "bonus_points"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["offer"]["type"] == "bonus_points"
        print(f"✓ Win-back with specific offer: {data['offer']['type']}")
    
    def test_trigger_winback_requires_staff_role(self, user_id):
        """POST /api/churn/trigger-winback requires staff role"""
        # Login as regular user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        user_token = response.json()["token"]
        
        response = requests.post(
            f"{BASE_URL}/api/churn/trigger-winback",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"user_id": user_id}
        )
        assert response.status_code == 403
        print("✓ Trigger winback requires staff role")
    
    def test_campaigns_list_returns_history(self, staff_token):
        """GET /api/churn/campaigns returns campaign history"""
        response = requests.get(
            f"{BASE_URL}/api/churn/campaigns",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "campaigns" in data
        assert isinstance(data["campaigns"], list)
        
        if len(data["campaigns"]) > 0:
            campaign = data["campaigns"][0]
            assert "user_id" in campaign
            assert "offer_type" in campaign
            assert "status" in campaign
        
        print(f"✓ Campaigns list: {len(data['campaigns'])} campaigns")
    
    def test_staff_can_analyze_any_user(self, staff_token, user_id):
        """Staff can analyze any user's churn risk"""
        response = requests.get(
            f"{BASE_URL}/api/churn/analyze/{user_id}",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["user_id"] == user_id
        print(f"✓ Staff can analyze any user: {user_id}")


class TestChurnClaimOffer:
    """Tests for user claiming win-back offers"""
    
    @pytest.fixture
    def setup_offer(self):
        """Create a win-back offer for testing"""
        # Login as staff
        staff_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "venue@eclipse.com",
            "password": "venue123"
        })
        staff_token = staff_response.json()["token"]
        
        # Get user ID
        user_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        user_id = user_response.json()["user"]["user_id"]
        user_token = user_response.json()["token"]
        
        # Create win-back offer
        requests.post(
            f"{BASE_URL}/api/churn/trigger-winback",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"user_id": user_id}
        )
        
        return user_token
    
    def test_claim_offer_success(self, setup_offer):
        """POST /api/churn/claim-offer claims active offer"""
        user_token = setup_offer
        
        response = requests.post(
            f"{BASE_URL}/api/churn/claim-offer",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # May return 200 (claimed) or 404 (no active offer if already claimed)
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "offer_type" in data
            assert "offer_value" in data
            assert "message" in data
            print(f"✓ Offer claimed: {data['offer_value']}")
        else:
            print("✓ No active offer to claim (already claimed)")
    
    def test_claim_offer_requires_auth(self):
        """POST /api/churn/claim-offer requires authentication"""
        response = requests.post(f"{BASE_URL}/api/churn/claim-offer")
        assert response.status_code == 401
        print("✓ Claim offer requires authentication")


class TestChurnRiskCalculation:
    """Tests for churn risk score calculation"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def user_id(self):
        """Get user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        return response.json()["user"]["user_id"]
    
    def test_risk_score_based_on_metrics(self, user_token, user_id):
        """Churn analysis calculates risk score based on behavioral metrics"""
        response = requests.get(
            f"{BASE_URL}/api/churn/analyze/{user_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        metrics = data["metrics"]
        risk_score = data["risk_score"]
        
        # Verify metrics are used in calculation
        # High days_inactive should increase risk
        if metrics["days_inactive"] > 45:
            assert risk_score >= 30, "High inactivity should increase risk score"
        
        # Verify risk level matches score
        if risk_score >= 70:
            assert data["risk_level"] == "high"
        elif risk_score >= 40:
            assert data["risk_level"] == "medium"
        else:
            assert data["risk_level"] == "low"
        
        print(f"✓ Risk calculation: score={risk_score}, days_inactive={metrics['days_inactive']}")
    
    def test_win_back_offer_matches_risk_level(self, user_token, user_id):
        """Win-back offer is selected based on risk level"""
        response = requests.get(
            f"{BASE_URL}/api/churn/analyze/{user_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        risk_level = data["risk_level"]
        offer = data["win_back_offer"]
        
        # High risk should get better offers
        high_risk_offers = ["vip_upgrade", "free_entry", "exclusive_event"]
        medium_risk_offers = ["bonus_points", "discount"]
        low_risk_offers = ["reminder"]
        
        if risk_level == "high":
            assert offer["type"] in high_risk_offers, f"High risk should get premium offer, got {offer['type']}"
        elif risk_level == "medium":
            assert offer["type"] in medium_risk_offers, f"Medium risk should get standard offer, got {offer['type']}"
        
        print(f"✓ Offer matches risk: {risk_level} -> {offer['type']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
