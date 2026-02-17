"""
Backend Tests for App Store Readiness Features
- Tests DELETE /api/user/delete endpoint for account deletion
- Tests login/register flows to verify auth token generation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestAccountDeletion:
    """Tests for App Store required account deletion feature"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user and return credentials"""
        test_email = f"test_delete_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "test123"
        test_name = "Test Delete User"
        
        # Register user
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": test_name
            }
        )
        
        if response.status_code != 200:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        data = response.json()
        return {
            "email": test_email,
            "password": test_password,
            "name": test_name,
            "token": data.get("token"),
            "user_id": data.get("user", {}).get("user_id")
        }
    
    def test_delete_account_success(self, test_user):
        """Test successful account deletion with valid auth token"""
        # Delete account
        response = requests.delete(
            f"{BASE_URL}/api/user/delete",
            headers={"Authorization": f"Bearer {test_user['token']}"}
        )
        
        # Verify response status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify response structure
        data = response.json()
        assert data.get("success") is True, "Expected success to be True"
        assert "message" in data, "Expected message in response"
        assert "deletion_summary" in data, "Expected deletion_summary in response"
        
        # Verify deletion message
        assert "permanently deleted" in data["message"].lower(), "Expected deletion confirmation message"
        
        # Verify user can no longer access protected endpoints
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user['token']}"}
        )
        # Should return 404 (user not found) since account was deleted
        assert me_response.status_code == 404, f"User should not exist after deletion, got {me_response.status_code}"
        
    def test_delete_account_without_auth(self):
        """Test account deletion fails without authentication"""
        response = requests.delete(f"{BASE_URL}/api/user/delete")
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_delete_account_with_invalid_token(self):
        """Test account deletion fails with invalid token"""
        response = requests.delete(
            f"{BASE_URL}/api/user/delete",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestLoginAuth:
    """Tests for login authentication needed for other flows"""
    
    def test_login_with_test_account(self):
        """Test login with provided test account credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "luna@test.com",
                "password": "test123"
            }
        )
        
        # First time, user might not exist, so register if needed
        if response.status_code == 401:
            # Try to register the test user first
            reg_response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": "luna@test.com",
                    "password": "test123",
                    "name": "Luna Test User"
                }
            )
            
            if reg_response.status_code == 200:
                data = reg_response.json()
                assert "token" in data, "Expected token in response"
                assert "user" in data, "Expected user in response"
                print("Test user registered successfully")
                return
            elif reg_response.status_code == 400:
                # User already exists, try login again
                response = requests.post(
                    f"{BASE_URL}/api/auth/login",
                    json={
                        "email": "luna@test.com",
                        "password": "test123"
                    }
                )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Expected token in response"
        assert "user" in data, "Expected user in response"
        
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test that API is responding"""
        response = requests.get(f"{BASE_URL}/api/venues")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of venues"
        assert len(data) > 0, "Expected at least one venue"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
