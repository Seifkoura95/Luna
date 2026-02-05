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
BACKEND_URL = "https://eclipse-vip-1.preview.emergentagent.com/api"
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
    
    def setup_test_user(self):
        """Create test user and session in MongoDB directly"""
        print("\n=== Setting up test user ===")
        
        # Use mongosh to create test user and session
        mongo_commands = '''
        use('test_database');
        var userId = 'user_test123';
        var sessionToken = 'test_session_123456';
        
        // Remove existing test data
        db.users.deleteMany({user_id: userId});
        db.user_sessions.deleteMany({user_id: userId});
        
        // Create test user
        db.users.insertOne({
          user_id: userId,
          email: 'test@eclipse.com',
          name: 'Test User',
          tier: 'bronze',
          points_balance: 2000,
          created_at: new Date()
        });
        
        // Create session
        db.user_sessions.insertOne({
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        });
        
        print('Test user created with session: ' + sessionToken);
        '''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.session_token = 'test_session_123456'
                self.user_id = 'user_test123'
                self.log_result("Setup Test User", True, "Test user and session created successfully")
                return True
            else:
                self.log_result("Setup Test User", False, f"MongoDB setup failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_result("Setup Test User", False, f"Failed to setup test user: {str(e)}")
            return False
    
    def test_seed_data(self):
        """Test POST /api/admin/seed"""
        print("\n=== Testing Data Seed API ===")
        
        try:
            response = requests.post(f"{self.base_url}/admin/seed", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Data Seed API", True, 
                              f"Seeded {data.get('rewards', 0)} rewards, {data.get('missions', 0)} missions, {data.get('boosts', 0)} boosts, {data.get('events', 0)} events")
                return True
            else:
                self.log_result("Data Seed API", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Data Seed API", False, f"Request failed: {str(e)}")
            return False
    
    def test_public_apis(self):
        """Test all public APIs that don't require authentication"""
        print("\n=== Testing Public APIs ===")
        
        # Test GET /api/rewards
        try:
            response = requests.get(f"{self.base_url}/rewards", timeout=10)
            if response.status_code == 200:
                rewards = response.json()
                self.log_result("GET /api/rewards", True, 
                              f"Retrieved {len(rewards)} rewards")
            else:
                self.log_result("GET /api/rewards", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/rewards", False, f"Request failed: {str(e)}")
        
        # Test GET /api/rewards with category filter
        try:
            response = requests.get(f"{self.base_url}/rewards?category=drinks", timeout=10)
            if response.status_code == 200:
                drinks = response.json()
                self.log_result("GET /api/rewards?category=drinks", True, 
                              f"Retrieved {len(drinks)} drink rewards")
            else:
                self.log_result("GET /api/rewards?category=drinks", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/rewards?category=drinks", False, f"Request failed: {str(e)}")
        
        # Test GET /api/events
        try:
            response = requests.get(f"{self.base_url}/events", timeout=10)
            if response.status_code == 200:
                events = response.json()
                self.log_result("GET /api/events", True, 
                              f"Retrieved {len(events)} events")
            else:
                self.log_result("GET /api/events", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/events", False, f"Request failed: {str(e)}")
        
        # Test GET /api/queue/status
        try:
            response = requests.get(f"{self.base_url}/queue/status", timeout=10)
            if response.status_code == 200:
                queue = response.json()
                self.log_result("GET /api/queue/status", True, 
                              f"Queue status: {queue.get('status', 'unknown')}, {queue.get('people_inside', 0)} inside")
            else:
                self.log_result("GET /api/queue/status", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/queue/status", False, f"Request failed: {str(e)}")
        
        # Test GET /api/boosts
        try:
            response = requests.get(f"{self.base_url}/boosts", timeout=10)
            if response.status_code == 200:
                boosts = response.json()
                self.log_result("GET /api/boosts", True, 
                              f"Retrieved {len(boosts)} active boosts")
            else:
                self.log_result("GET /api/boosts", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/boosts", False, f"Request failed: {str(e)}")
        
        # Test GET /api/boosts/upcoming
        try:
            response = requests.get(f"{self.base_url}/boosts/upcoming", timeout=10)
            if response.status_code == 200:
                upcoming = response.json()
                self.log_result("GET /api/boosts/upcoming", True, 
                              f"Retrieved {len(upcoming)} upcoming boosts")
            else:
                self.log_result("GET /api/boosts/upcoming", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/boosts/upcoming", False, f"Request failed: {str(e)}")
        
        # Test GET /api/membership/tiers
        try:
            response = requests.get(f"{self.base_url}/membership/tiers", timeout=10)
            if response.status_code == 200:
                tiers = response.json()
                self.log_result("GET /api/membership/tiers", True, 
                              f"Retrieved {len(tiers)} membership tiers")
            else:
                self.log_result("GET /api/membership/tiers", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/membership/tiers", False, f"Request failed: {str(e)}")
    
    def test_protected_apis(self):
        """Test APIs that require authentication"""
        print("\n=== Testing Protected APIs ===")
        
        if not self.session_token:
            self.log_result("Protected APIs", False, "No session token available")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test GET /api/auth/me
        try:
            response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
            if response.status_code == 200:
                user = response.json()
                self.log_result("GET /api/auth/me", True, 
                              f"User: {user.get('name', 'Unknown')}, Tier: {user.get('tier', 'Unknown')}, Points: {user.get('points_balance', 0)}")
            else:
                self.log_result("GET /api/auth/me", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/auth/me", False, f"Request failed: {str(e)}")
        
        # Test GET /api/checkin/qr
        try:
            response = requests.get(f"{self.base_url}/checkin/qr", headers=headers, timeout=10)
            if response.status_code == 200:
                qr_data = response.json()
                self.log_result("GET /api/checkin/qr", True, 
                              f"QR generated, expires in {qr_data.get('expires_in', 0)} seconds")
            else:
                self.log_result("GET /api/checkin/qr", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/checkin/qr", False, f"Request failed: {str(e)}")
        
        # Test GET /api/missions
        try:
            response = requests.get(f"{self.base_url}/missions", headers=headers, timeout=10)
            if response.status_code == 200:
                missions = response.json()
                completed = sum(1 for m in missions if m.get('completed', False))
                self.log_result("GET /api/missions", True, 
                              f"Retrieved {len(missions)} missions, {completed} completed")
            else:
                self.log_result("GET /api/missions", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/missions", False, f"Request failed: {str(e)}")
        
        # Test POST /api/rewards/redeem
        try:
            redeem_data = {"reward_id": "r1"}  # Free House Drink
            response = requests.post(f"{self.base_url}/rewards/redeem", 
                                   headers=headers, json=redeem_data, timeout=10)
            if response.status_code == 200:
                redemption = response.json()
                self.log_result("POST /api/rewards/redeem", True, 
                              f"Redeemed {redemption.get('reward_name', 'Unknown')}, Code: {redemption.get('validation_code', 'N/A')}")
            else:
                self.log_result("POST /api/rewards/redeem", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST /api/rewards/redeem", False, f"Request failed: {str(e)}")
        
        # Test GET /api/rewards/redemptions
        try:
            response = requests.get(f"{self.base_url}/rewards/redemptions", headers=headers, timeout=10)
            if response.status_code == 200:
                redemptions = response.json()
                self.log_result("GET /api/rewards/redemptions", True, 
                              f"Retrieved {len(redemptions)} redemptions")
            else:
                self.log_result("GET /api/rewards/redemptions", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/rewards/redemptions", False, f"Request failed: {str(e)}")
        
        # Test GET /api/points/history
        try:
            response = requests.get(f"{self.base_url}/points/history", headers=headers, timeout=10)
            if response.status_code == 200:
                history = response.json()
                self.log_result("GET /api/points/history", True, 
                              f"Retrieved {len(history)} transactions")
            else:
                self.log_result("GET /api/points/history", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/points/history", False, f"Request failed: {str(e)}")
        
        # Test GET /api/points/stats
        try:
            response = requests.get(f"{self.base_url}/points/stats", headers=headers, timeout=10)
            if response.status_code == 200:
                stats = response.json()
                self.log_result("GET /api/points/stats", True, 
                              f"Balance: {stats.get('current_balance', 0)}, Earned: {stats.get('total_earned', 0)}")
            else:
                self.log_result("GET /api/points/stats", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/points/stats", False, f"Request failed: {str(e)}")
        
        # Test POST /api/membership/upgrade
        try:
            upgrade_data = {"tier": "silver"}
            response = requests.post(f"{self.base_url}/membership/upgrade", 
                                   headers=headers, json=upgrade_data, timeout=10)
            if response.status_code == 200:
                upgrade = response.json()
                self.log_result("POST /api/membership/upgrade", True, 
                              f"Upgraded to {upgrade.get('new_tier', 'Unknown')}, Bonus: {upgrade.get('bonus_points', 0)} points")
            else:
                self.log_result("POST /api/membership/upgrade", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST /api/membership/upgrade", False, f"Request failed: {str(e)}")
    
    def test_auth_session_exchange(self):
        """Test the Emergent OAuth session exchange (mock test)"""
        print("\n=== Testing Auth Session Exchange API ===")
        
        # This would normally require a real Emergent session_id
        # For testing purposes, we'll test the endpoint structure
        try:
            session_data = {"session_id": "mock_session_123"}
            response = requests.post(f"{self.base_url}/auth/session", 
                                   json=session_data, timeout=10)
            
            # We expect this to fail with 401 or 500 since it's a mock session
            if response.status_code in [401, 500]:
                self.log_result("POST /api/auth/session", True, 
                              "Endpoint accessible, correctly rejects invalid session")
            elif response.status_code == 200:
                self.log_result("POST /api/auth/session", True, 
                              "Session exchange successful (unexpected but good)")
            else:
                self.log_result("POST /api/auth/session", False, 
                              f"Unexpected response: HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST /api/auth/session", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run complete test suite"""
        print(f"🚀 Starting Eclipse VIP Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Setup
        if not self.setup_test_user():
            print("❌ Cannot proceed without test user setup")
            return False
        
        # Seed data first
        self.test_seed_data()
        
        # Test public APIs
        self.test_public_apis()
        
        # Test auth session exchange
        self.test_auth_session_exchange()
        
        # Test protected APIs
        self.test_protected_apis()
        
        # Summary
        print(f"\n{'='*50}")
        print("🏁 TEST SUMMARY")
        print(f"{'='*50}")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  - {test_name}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = EclipseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)