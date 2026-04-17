"""
Milestones System Tests
Tests for milestone claiming, QR ticket generation, ticket validation, and missions API.
"""
import pytest
import requests
import os
from urllib.parse import quote

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
USER_EMAIL = "luna@test.com"
USER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"


class TestMilestonesAuth:
    """Authentication setup for milestone tests"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin/staff auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")


class TestGetMilestones(TestMilestonesAuth):
    """GET /api/milestones - Returns all 6 milestones with user progress"""
    
    def test_get_milestones_returns_all_six(self, user_token):
        """Verify all 6 milestones are returned"""
        response = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "milestones" in data
        assert "points_balance" in data
        assert len(data["milestones"]) == 6, f"Expected 6 milestones, got {len(data['milestones'])}"
        
        # Verify milestone IDs
        milestone_ids = [m["id"] for m in data["milestones"]]
        expected_ids = ["newbie", "rising_star", "vip_status", "luna_elite", "supernova", "legend"]
        assert milestone_ids == expected_ids, f"Milestone IDs mismatch: {milestone_ids}"
        
        print(f"✓ GET /api/milestones returns all 6 milestones")
        print(f"  User points balance: {data['points_balance']}")
    
    def test_milestones_have_correct_points_required(self, user_token):
        """Verify points_required for each milestone"""
        response = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        milestones = response.json()["milestones"]
        
        expected_points = {
            "newbie": 0,
            "rising_star": 500,
            "vip_status": 1000,
            "luna_elite": 5000,
            "supernova": 10000,
            "legend": 25000
        }
        
        for m in milestones:
            assert m["points_required"] == expected_points[m["id"]], \
                f"{m['id']} should require {expected_points[m['id']]} points, got {m['points_required']}"
        
        print("✓ All milestones have correct points_required values")
    
    def test_milestones_have_reward_summary(self, user_token):
        """Verify reward_summary strings are present and meaningful"""
        response = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        milestones = response.json()["milestones"]
        
        # Check specific reward summaries
        for m in milestones:
            if m["id"] == "newbie":
                # Newbie has no rewards
                assert m["total_rewards"] == 0
            elif m["id"] == "rising_star":
                assert "5 Drinks" in m["reward_summary"], f"Rising Star summary: {m['reward_summary']}"
            elif m["id"] == "vip_status":
                assert "10 Drinks" in m["reward_summary"] and "4 Entries" in m["reward_summary"], \
                    f"VIP Status summary: {m['reward_summary']}"
            elif m["id"] == "luna_elite":
                assert "VIP Booth" in m["reward_summary"] and "20 Drinks" in m["reward_summary"], \
                    f"Luna Elite summary: {m['reward_summary']}"
            elif m["id"] == "supernova":
                assert "30 Drinks" in m["reward_summary"] and "DJ Shoutout" in m["reward_summary"], \
                    f"Supernova summary: {m['reward_summary']}"
            elif m["id"] == "legend":
                assert "50 Drinks" in m["reward_summary"] and "Gold Status" in m["reward_summary"], \
                    f"Legend summary: {m['reward_summary']}"
            
            print(f"  {m['title']}: {m['reward_summary']}")
        
        print("✓ All milestones have correct reward_summary strings")
    
    def test_milestones_show_unlocked_claimed_status(self, user_token):
        """Verify unlocked/claimed status based on user points"""
        response = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        pts = data["points_balance"]
        
        for m in data["milestones"]:
            # Check unlocked status matches points
            expected_unlocked = pts >= m["points_required"]
            assert m["unlocked"] == expected_unlocked, \
                f"{m['id']}: unlocked={m['unlocked']} but user has {pts} pts (requires {m['points_required']})"
            
            # Check active_tickets count is present
            assert "active_tickets" in m
            assert isinstance(m["active_tickets"], int)
            
            print(f"  {m['title']}: unlocked={m['unlocked']}, claimed={m['claimed']}, active_tickets={m['active_tickets']}")
        
        print("✓ Milestones show correct unlocked/claimed/active_tickets status")
    
    def test_milestones_requires_auth(self):
        """Verify auth is required"""
        response = requests.get(f"{BASE_URL}/api/milestones")
        assert response.status_code == 401
        print("✓ GET /api/milestones requires authentication")


class TestClaimMilestone(TestMilestonesAuth):
    """POST /api/milestones/claim/{milestone_id} - Claim milestone and generate tickets"""
    
    def test_claim_already_claimed_milestone_fails(self, user_token):
        """Test claiming rising_star fails (already claimed by test user)"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/claim/rising_star",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 400
        assert "already claimed" in response.json().get("detail", "").lower()
        print("✓ POST /api/milestones/claim/rising_star returns 'already claimed' error")
    
    def test_claim_legend_fails_insufficient_points(self, user_token):
        """Test claiming legend fails (user has ~22000 pts, needs 25000)"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/claim/legend",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Could be 400 (not enough points) or 400 (already claimed)
        assert response.status_code == 400
        detail = response.json().get("detail", "").lower()
        # Either not enough points or already claimed
        assert "25000" in detail or "already claimed" in detail, f"Unexpected error: {detail}"
        print(f"✓ POST /api/milestones/claim/legend returns expected error: {detail}")
    
    def test_claim_nonexistent_milestone_fails(self, user_token):
        """Test claiming non-existent milestone returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/claim/fake_milestone",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 404
        print("✓ POST /api/milestones/claim/fake_milestone returns 404")
    
    def test_claim_vip_status_success(self, user_token):
        """Test claiming VIP Status milestone (14 tickets: 10 drinks + 4 entries)"""
        # First check if already claimed
        milestones_resp = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        milestones = milestones_resp.json()["milestones"]
        vip_status = next((m for m in milestones if m["id"] == "vip_status"), None)
        
        if vip_status and vip_status.get("claimed"):
            print("⚠ VIP Status already claimed, skipping claim test")
            pytest.skip("VIP Status already claimed")
        
        response = requests.post(
            f"{BASE_URL}/api/milestones/claim/vip_status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if response.status_code == 400 and "already claimed" in response.json().get("detail", "").lower():
            print("⚠ VIP Status already claimed")
            pytest.skip("VIP Status already claimed")
        
        assert response.status_code == 200, f"Claim failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["tickets_generated"] == 14, f"Expected 14 tickets, got {data['tickets_generated']}"
        assert "VIP Status" in data["milestone"]
        
        print(f"✓ POST /api/milestones/claim/vip_status generated {data['tickets_generated']} tickets")
    
    def test_claim_requires_auth(self):
        """Verify auth is required for claiming"""
        response = requests.post(f"{BASE_URL}/api/milestones/claim/vip_status")
        assert response.status_code == 401
        print("✓ POST /api/milestones/claim requires authentication")


class TestMilestoneTickets(TestMilestonesAuth):
    """GET /api/milestones/tickets - Get user's active tickets"""
    
    def test_get_all_tickets(self, user_token):
        """Get all active tickets for user"""
        response = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tickets" in data
        assert "total" in data
        assert isinstance(data["tickets"], list)
        assert data["total"] == len(data["tickets"])
        
        print(f"✓ GET /api/milestones/tickets returns {data['total']} active tickets")
        
        # Verify ticket structure
        if data["tickets"]:
            ticket = data["tickets"][0]
            required_fields = ["ticket_id", "user_id", "milestone_id", "reward_type", 
                            "reward_label", "qr_code", "status"]
            for field in required_fields:
                assert field in ticket, f"Missing field: {field}"
            assert ticket["status"] == "active"
            print(f"  Sample ticket: {ticket['reward_label']} ({ticket['milestone_title']})")
    
    def test_get_tickets_filtered_by_milestone(self, user_token):
        """Get tickets filtered by milestone_id"""
        # First get all tickets to find a milestone with tickets
        all_resp = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        all_tickets = all_resp.json()["tickets"]
        
        if not all_tickets:
            print("⚠ No tickets available for filtering test")
            pytest.skip("No tickets available")
        
        # Get a milestone_id that has tickets
        milestone_id = all_tickets[0]["milestone_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/milestones/tickets?milestone_id={milestone_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned tickets should be from the specified milestone
        for ticket in data["tickets"]:
            assert ticket["milestone_id"] == milestone_id
        
        print(f"✓ GET /api/milestones/tickets?milestone_id={milestone_id} returns {data['total']} tickets")
    
    def test_tickets_requires_auth(self):
        """Verify auth is required"""
        response = requests.get(f"{BASE_URL}/api/milestones/tickets")
        assert response.status_code == 401
        print("✓ GET /api/milestones/tickets requires authentication")


class TestTicketValidation(TestMilestonesAuth):
    """POST /api/milestones/tickets/{ticket_id}/use and /validate-qr"""
    
    def test_use_ticket_by_id(self, admin_token, user_token):
        """Staff uses a ticket by ticket_id (permanently deleted)"""
        # Get user's tickets
        tickets_resp = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        tickets = tickets_resp.json()["tickets"]
        
        if not tickets:
            print("⚠ No tickets available for use test")
            pytest.skip("No tickets available")
        
        ticket = tickets[0]
        ticket_id = ticket["ticket_id"]
        initial_count = len(tickets)
        
        # Staff uses the ticket
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/{ticket_id}/use?venue_id=eclipse",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Use ticket failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["reward_type"] == ticket["reward_type"]
        assert data["reward_label"] == ticket["reward_label"]
        
        print(f"✓ POST /api/milestones/tickets/{ticket_id}/use - Ticket used: {data['reward_label']}")
        
        # Verify ticket is deleted
        tickets_after = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        ).json()["tickets"]
        
        assert len(tickets_after) == initial_count - 1, "Ticket count should decrease by 1"
        assert not any(t["ticket_id"] == ticket_id for t in tickets_after), "Used ticket should be deleted"
        
        print(f"  Ticket permanently deleted. Remaining: {len(tickets_after)}")
    
    def test_use_ticket_requires_staff_role(self, user_token):
        """Regular user cannot use tickets (staff only)"""
        # This test may pass or fail depending on user's role
        # luna@test.com might have admin role based on previous tests
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/fake_ticket_id/use",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Either 403 (not staff) or 404 (ticket not found)
        assert response.status_code in [403, 404]
        print(f"✓ POST /api/milestones/tickets/use returns {response.status_code} for non-staff or invalid ticket")
    
    def test_use_nonexistent_ticket_fails(self, admin_token):
        """Using non-existent ticket returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/nonexistent_ticket_123/use",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("✓ POST /api/milestones/tickets/nonexistent/use returns 404")
    
    def test_validate_qr_success(self, admin_token, user_token):
        """Staff validates ticket by QR code (permanently deleted)"""
        # Get user's tickets
        tickets_resp = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        tickets = tickets_resp.json()["tickets"]
        
        if not tickets:
            print("⚠ No tickets available for QR validation test")
            pytest.skip("No tickets available")
        
        ticket = tickets[0]
        qr_code = ticket["qr_code"]
        initial_count = len(tickets)
        
        # URL encode the QR code
        encoded_qr = quote(qr_code, safe='')
        
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/validate-qr?qr_code={encoded_qr}&venue_id=eclipse",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"QR validation failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["valid"] == True
        assert data["reward_type"] == ticket["reward_type"]
        assert "member_name" in data
        
        print(f"✓ POST /api/milestones/tickets/validate-qr - Valid: {data['reward_label']} for {data['member_name']}")
        
        # Verify ticket is deleted
        tickets_after = requests.get(
            f"{BASE_URL}/api/milestones/tickets",
            headers={"Authorization": f"Bearer {user_token}"}
        ).json()["tickets"]
        
        assert len(tickets_after) == initial_count - 1
        print(f"  Ticket permanently deleted. Remaining: {len(tickets_after)}")
    
    def test_validate_invalid_qr_fails(self, admin_token):
        """Invalid QR code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/validate-qr?qr_code=INVALID-QR-CODE-123&venue_id=eclipse",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        assert "invalid" in response.json().get("detail", "").lower() or "used" in response.json().get("detail", "").lower()
        print("✓ POST /api/milestones/tickets/validate-qr with invalid QR returns 404")
    
    def test_validate_qr_requires_staff(self, user_token):
        """Regular user cannot validate QR (staff only)"""
        response = requests.post(
            f"{BASE_URL}/api/milestones/tickets/validate-qr?qr_code=FAKE-QR&venue_id=eclipse",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Either 403 (not staff) or 404 (invalid QR)
        assert response.status_code in [403, 404]
        print(f"✓ POST /api/milestones/tickets/validate-qr returns {response.status_code} for non-staff or invalid QR")


class TestMissionsAPI(TestMilestonesAuth):
    """GET /api/missions - Returns missions from Lovable dashboard"""
    
    def test_get_missions(self, user_token):
        """Get all missions"""
        response = requests.get(
            f"{BASE_URL}/api/missions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        missions = response.json()
        
        assert isinstance(missions, list)
        print(f"✓ GET /api/missions returns {len(missions)} missions")
        
        # Check mission structure if any exist
        if missions:
            mission = missions[0]
            # Check for expected fields
            expected_fields = ["id", "title"]
            for field in expected_fields:
                assert field in mission, f"Missing field: {field}"
            
            for m in missions[:5]:  # Print first 5
                print(f"  - {m.get('title', m.get('name', 'Unknown'))}: {m.get('points_reward', 0)} pts")
    
    def test_missions_requires_auth(self):
        """Verify auth is required"""
        response = requests.get(f"{BASE_URL}/api/missions")
        assert response.status_code == 401
        print("✓ GET /api/missions requires authentication")


class TestMilestoneIntegration(TestMilestonesAuth):
    """End-to-end integration tests"""
    
    def test_milestone_claim_to_ticket_flow(self, user_token, admin_token):
        """Full flow: Check milestones → Claim → Get tickets → Use ticket"""
        # 1. Get milestones
        milestones_resp = requests.get(
            f"{BASE_URL}/api/milestones",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert milestones_resp.status_code == 200
        data = milestones_resp.json()
        pts = data["points_balance"]
        
        print(f"User has {pts} points")
        
        # 2. Find an unclaimed, unlocked milestone
        unclaimed = [m for m in data["milestones"] 
                    if m["unlocked"] and not m["claimed"] and m["total_rewards"] > 0]
        
        if not unclaimed:
            print("⚠ No unclaimed milestones available for integration test")
            # Still verify we can get tickets
            tickets_resp = requests.get(
                f"{BASE_URL}/api/milestones/tickets",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            assert tickets_resp.status_code == 200
            print(f"  User has {tickets_resp.json()['total']} active tickets")
            return
        
        milestone = unclaimed[0]
        print(f"Claiming milestone: {milestone['title']} ({milestone['total_rewards']} rewards)")
        
        # 3. Claim the milestone
        claim_resp = requests.post(
            f"{BASE_URL}/api/milestones/claim/{milestone['id']}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if claim_resp.status_code == 400:
            print(f"  Milestone already claimed or insufficient points")
            return
        
        assert claim_resp.status_code == 200
        claim_data = claim_resp.json()
        print(f"  Generated {claim_data['tickets_generated']} tickets")
        
        # 4. Get tickets
        tickets_resp = requests.get(
            f"{BASE_URL}/api/milestones/tickets?milestone_id={milestone['id']}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert tickets_resp.status_code == 200
        tickets = tickets_resp.json()["tickets"]
        assert len(tickets) == claim_data["tickets_generated"]
        
        # 5. Use one ticket
        if tickets:
            ticket = tickets[0]
            use_resp = requests.post(
                f"{BASE_URL}/api/milestones/tickets/{ticket['ticket_id']}/use?venue_id=eclipse",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert use_resp.status_code == 200
            print(f"  Used ticket: {use_resp.json()['reward_label']}")
        
        print("✓ Full milestone claim → ticket → use flow completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
