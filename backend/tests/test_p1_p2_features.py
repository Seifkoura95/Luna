"""
Test P1 and P2 Features:
- Buy Points API (CherryHub integration)
- Promo Code System (one-time use per user)
- Vouchers API
- Instagram Integration (demo mode)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://event-discovery-app-1.preview.emergentagent.com"


class TestBuyPointsAPI:
    """Buy Points with CherryHub integration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - seed data and login"""
        # Seed the database
        seed_resp = requests.post(f"{BASE_URL}/api/admin/seed")
        assert seed_resp.status_code == 200, f"Failed to seed data: {seed_resp.text}"
        
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        if login_resp.status_code != 200:
            # Register if not exists
            reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "luna@test.com",
                "password": "test123",
                "name": "Luna Test"
            })
            assert reg_resp.status_code in [200, 400], f"Failed to register: {reg_resp.text}"
            
            # Try login again
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "luna@test.com",
                "password": "test123"
            })
        
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.initial_balance = login_resp.json().get("user", {}).get("points_balance", 0)
    
    def test_buy_points_package_p1(self):
        """Test buying p1 package (100 pts/$10)"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "p1",
                "points": 100,
                "price": 10,
                "bonus": 0,
                "payment_method": "card"
            },
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Buy points failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["points_added"] == 100
        assert data["base_points"] == 100
        assert data["bonus_points"] == 0
        assert "transaction_id" in data
        assert "new_balance" in data
        assert data["new_balance"] >= self.initial_balance + 100
        print(f"✅ P1 package purchased: {data['points_added']} points added, new balance: {data['new_balance']}")
    
    def test_buy_points_package_p2_with_bonus(self):
        """Test buying p2 package (500 pts + 50 bonus/$45)"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "p2",
                "points": 500,
                "price": 45,
                "bonus": 50,
                "payment_method": "card"
            },
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Buy points failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["points_added"] == 550  # 500 + 50 bonus
        assert data["base_points"] == 500
        assert data["bonus_points"] == 50
        print(f"✅ P2 package purchased: {data['points_added']} points (500+50 bonus)")
    
    def test_buy_points_package_p3(self):
        """Test buying p3 package (1000 pts + 150 bonus/$80)"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "p3",
                "points": 1000,
                "price": 80,
                "bonus": 150,
                "payment_method": "card"
            },
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Buy points failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["points_added"] == 1150  # 1000 + 150 bonus
        print(f"✅ P3 package purchased: {data['points_added']} points")
    
    def test_buy_points_package_p4(self):
        """Test buying p4 package (2500 pts + 500 bonus/$180)"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "p4",
                "points": 2500,
                "price": 180,
                "bonus": 500,
                "payment_method": "card"
            },
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Buy points failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["points_added"] == 3000  # 2500 + 500 bonus
        print(f"✅ P4 package purchased: {data['points_added']} points")
    
    def test_buy_points_invalid_package(self):
        """Test buying invalid package returns error"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "invalid_pkg",
                "points": 100,
                "price": 10,
                "bonus": 0,
                "payment_method": "card"
            },
            headers=self.headers
        )
        
        assert response.status_code == 400
        print("✅ Invalid package correctly rejected")
    
    def test_buy_points_without_auth(self):
        """Test buying points without authentication fails"""
        response = requests.post(
            f"{BASE_URL}/api/cherryhub/buy-points",
            json={
                "package_id": "p1",
                "points": 100,
                "price": 10,
                "bonus": 0,
                "payment_method": "card"
            }
        )
        
        assert response.status_code == 401
        print("✅ Unauthenticated request correctly rejected")


class TestPromoCodeAPI:
    """Promo Code System tests - one-time use per user"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create a fresh test user for promo testing"""
        import uuid
        self.test_email = f"promo_test_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register new user
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "test123",
            "name": "Promo Test User"
        })
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        self.token = reg_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print(f"Created test user: {self.test_email}")
    
    def test_validate_promo_welcome50(self):
        """Test validating WELCOME50 promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/WELCOME50",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["code"] == "WELCOME50"
        assert data["type"] == "bonus_points"
        print(f"✅ WELCOME50 validated: {data['description']}")
    
    def test_validate_promo_luna100(self):
        """Test validating LUNA100 promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/LUNA100",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["code"] == "LUNA100"
        print(f"✅ LUNA100 validated: {data['description']}")
    
    def test_validate_promo_freeentry(self):
        """Test validating FREEENTRY promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/FREEENTRY",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["type"] == "free_entry"
        print(f"✅ FREEENTRY validated: {data['description']}")
    
    def test_validate_promo_freedrink(self):
        """Test validating FREEDRINK promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/FREEDRINK",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["type"] == "drink_voucher"
        print(f"✅ FREEDRINK validated: {data['description']}")
    
    def test_validate_promo_vip2024(self):
        """Test validating VIP2024 combo promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/VIP2024",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["type"] == "combo"
        print(f"✅ VIP2024 validated: {data['description']}")
    
    def test_validate_invalid_promo(self):
        """Test validating invalid promo code"""
        response = requests.get(
            f"{BASE_URL}/api/promo/validate/INVALIDCODE",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == False
        print("✅ Invalid promo code correctly rejected")
    
    def test_apply_promo_welcome50(self):
        """Test applying WELCOME50 promo code"""
        response = requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "WELCOME50"},
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["code"] == "WELCOME50"
        assert data["points_added"] == 50
        print(f"✅ WELCOME50 applied: +{data['points_added']} points")
    
    def test_apply_promo_one_time_enforcement(self):
        """Test that promo code can only be used once per user"""
        # First use - apply LUNA100 (we haven't used it yet in this test class)
        first_response = requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "LUNA100"},
            headers=self.headers
        )
        
        assert first_response.status_code == 200, f"First use should succeed: {first_response.text}"
        print(f"✅ First use of LUNA100 succeeded")
        
        # Second use - same code should fail
        second_response = requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "LUNA100"},
            headers=self.headers
        )
        
        # Should fail - already used
        assert second_response.status_code == 400, f"Expected 400, got {second_response.status_code}"
        data = second_response.json()
        assert "already used" in data.get("detail", "").lower()
        print("✅ One-time use enforcement works - second use correctly rejected")
    
    def test_apply_promo_freedrink(self):
        """Test applying FREEDRINK promo code creates voucher"""
        response = requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "FREEDRINK"},
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["vouchers_added"] == 1
        print(f"✅ FREEDRINK applied: {data['vouchers_added']} voucher added")
    
    def test_apply_promo_freeentry(self):
        """Test applying FREEENTRY promo code creates voucher"""
        response = requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "FREEENTRY"},
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["vouchers_added"] == 1
        print(f"✅ FREEENTRY applied: {data['vouchers_added']} voucher added")


class TestVouchersAPI:
    """Vouchers API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create user and apply promo for vouchers"""
        import uuid
        self.test_email = f"voucher_test_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register new user
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "test123",
            "name": "Voucher Test User"
        })
        assert reg_resp.status_code == 200
        self.token = reg_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Apply a promo to get vouchers
        requests.post(
            f"{BASE_URL}/api/promo/apply",
            json={"code": "FREEDRINK"},
            headers=self.headers
        )
    
    def test_get_vouchers(self):
        """Test retrieving user vouchers"""
        response = requests.get(
            f"{BASE_URL}/api/vouchers",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "vouchers" in data
        assert "total" in data
        assert len(data["vouchers"]) >= 1
        
        voucher = data["vouchers"][0]
        assert "voucher_id" in voucher
        assert "type" in voucher
        assert "status" in voucher
        assert voucher["status"] == "active"
        print(f"✅ Retrieved {data['total']} voucher(s)")
    
    def test_get_vouchers_without_auth(self):
        """Test vouchers endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/vouchers")
        
        assert response.status_code == 401
        print("✅ Vouchers endpoint correctly requires authentication")


class TestInstagramIntegrationAPI:
    """Instagram Integration tests (demo mode) - Requires authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login user for authenticated requests"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "luna@test.com",
            "password": "test123"
        })
        if login_resp.status_code != 200:
            # Try register
            requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "luna@test.com",
                "password": "test123",
                "name": "Luna Test"
            })
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "luna@test.com",
                "password": "test123"
            })
        
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_instagram_feed(self):
        """Test getting Instagram feed"""
        response = requests.get(
            f"{BASE_URL}/api/instagram/feed?limit=5",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Instagram feed failed: {response.text}"
        data = response.json()
        
        assert "posts" in data
        assert "total" in data
        assert "accounts" in data
        assert "hashtags" in data
        assert "demo_mode" in data
        
        # Verify demo mode is active (since no API keys configured)
        assert data["demo_mode"] == True
        
        if len(data["posts"]) > 0:
            post = data["posts"][0]
            assert "id" in post
            assert "media_url" in post
            assert "username" in post
        
        print(f"✅ Instagram feed retrieved: {len(data['posts'])} posts (demo_mode: {data['demo_mode']})")
    
    def test_instagram_account_eclipse(self):
        """Test getting Instagram posts for Eclipse Brisbane"""
        response = requests.get(
            f"{BASE_URL}/api/instagram/account/eclipsebrisbane?limit=5",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "account" in data
        assert data["account"] == "eclipsebrisbane"
        assert "posts" in data
        print(f"✅ Eclipse Brisbane Instagram: {len(data['posts'])} posts")
    
    def test_instagram_config(self):
        """Test getting Instagram configuration"""
        response = requests.get(
            f"{BASE_URL}/api/instagram/config",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "demo_mode" in data
        assert "configured" in data
        assert "accounts" in data
        assert "hashtags" in data
        
        # Verify we have Luna accounts configured
        assert "eclipsebrisbane" in data["accounts"]
        assert "sucasabrisbane" in data["accounts"]
        
        print(f"✅ Instagram config: demo_mode={data['demo_mode']}, {len(data['accounts'])} accounts")
    
    def test_instagram_invalid_account(self):
        """Test getting posts for invalid account returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/instagram/account/invalid_account_xyz",
            headers=self.headers
        )
        
        # Invalid account should return 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Invalid account correctly rejected with 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
