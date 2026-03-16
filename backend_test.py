#!/usr/bin/env python3
"""
Backend API Testing for Luna Group VIP App
Testing the 3 new production readiness APIs:
1. Venue Details & Operating Hours API
2. Push Notification Token Registration API  
3. Email Verification Flow API
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://birthday-rewards-1.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "demo@luna.com"
TEST_PASSWORD = "test123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def login(self):
        """Login to get auth token"""
        print("\n🔐 Logging in...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                user_name = data.get("user", {}).get("name", "Unknown")
                self.log_result("Login", True, f"Logged in as {user_name}")
                return True
            else:
                self.log_result("Login", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Login", False, f"Exception: {str(e)}")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_venue_details_api(self):
        """Test GET /api/venues/{venue_id} for venue details and operating hours"""
        print("\n🏢 Testing Venue Details & Operating Hours API...")
        
        # Test venues as specified in the review request
        test_venues = ["eclipse", "su_casa_brisbane"]
        
        for venue_id in test_venues:
            try:
                response = self.session.get(
                    f"{BACKEND_URL}/venues/{venue_id}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check if operating_hours field exists
                    if "operating_hours" in data:
                        operating_hours = data["operating_hours"]
                        
                        # Verify it has days and hours structure
                        if isinstance(operating_hours, dict) and len(operating_hours) > 0:
                            # Check if it has day entries with time strings
                            sample_day = list(operating_hours.keys())[0]
                            day_info = operating_hours[sample_day]
                            
                            # The format should be day -> time string (e.g., "9:00 PM - 3:00 AM")
                            if isinstance(day_info, str) and ("-" in day_info or "closed" in day_info.lower()):
                                self.log_result(
                                    f"Venue Details API - {venue_id}",
                                    True,
                                    f"Found operating_hours with {len(operating_hours)} days. Sample: {sample_day} = {day_info}"
                                )
                            else:
                                self.log_result(
                                    f"Venue Details API - {venue_id}",
                                    False,
                                    f"operating_hours exists but invalid format: {day_info} (expected time string)"
                                )
                        else:
                            self.log_result(
                                f"Venue Details API - {venue_id}",
                                False,
                                f"operating_hours exists but is empty or invalid: {operating_hours}"
                            )
                    else:
                        self.log_result(
                            f"Venue Details API - {venue_id}",
                            False,
                            f"Missing operating_hours field. Available fields: {list(data.keys())}"
                        )
                        
                elif response.status_code == 404:
                    self.log_result(
                        f"Venue Details API - {venue_id}",
                        False,
                        f"Venue not found (404). Check if venue_id '{venue_id}' exists"
                    )
                else:
                    self.log_result(
                        f"Venue Details API - {venue_id}",
                        False,
                        f"Status {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Venue Details API - {venue_id}",
                    False,
                    f"Exception: {str(e)}"
                )
    
    def test_push_notification_api(self):
        """Test POST /api/notifications/register-push-token"""
        print("\n📱 Testing Push Notification Token Registration API...")
        
        if not self.auth_token:
            self.log_result("Push Notification API", False, "No auth token available")
            return
        
        # Test with valid Expo push token format
        test_token = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/notifications/register-push-token",
                json={
                    "push_token": test_token,
                    "device_type": "expo"
                },
                headers=self.get_auth_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Push Notification API",
                    True,
                    f"Token registered successfully. Response: {data}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "Push Notification API",
                    False,
                    "Authentication failed - endpoint requires valid auth token"
                )
            else:
                self.log_result(
                    "Push Notification API",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_result(
                "Push Notification API",
                False,
                f"Exception: {str(e)}"
            )
        
        # Test without auth token (should fail)
        try:
            response = self.session.post(
                f"{BACKEND_URL}/notifications/register-push-token",
                json={
                    "push_token": test_token,
                    "device_type": "expo"
                },
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Push Notification API (No Auth)",
                    True,
                    "Correctly rejected request without auth token"
                )
            else:
                self.log_result(
                    "Push Notification API (No Auth)",
                    False,
                    f"Should have returned 401, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_result(
                "Push Notification API (No Auth)",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_email_verification_api(self):
        """Test POST /api/auth/verify-email with token parameter"""
        print("\n📧 Testing Email Verification Flow API...")
        
        # Test with invalid token (should return error)
        invalid_token = "invalid_token_12345"
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/verify-email",
                params={"token": invalid_token},
                timeout=10
            )
            
            if response.status_code == 400:
                data = response.json()
                if "Invalid verification token" in data.get("detail", ""):
                    self.log_result(
                        "Email Verification API (Invalid Token)",
                        True,
                        f"Correctly returned error for invalid token: {data.get('detail')}"
                    )
                else:
                    self.log_result(
                        "Email Verification API (Invalid Token)",
                        False,
                        f"Returned 400 but unexpected error message: {data}"
                    )
            else:
                self.log_result(
                    "Email Verification API (Invalid Token)",
                    False,
                    f"Expected 400 error, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_result(
                "Email Verification API (Invalid Token)",
                False,
                f"Exception: {str(e)}"
            )
        
        # Test with missing token parameter
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/verify-email",
                timeout=10
            )
            
            # Should return validation error for missing token
            if response.status_code in [400, 422]:
                self.log_result(
                    "Email Verification API (Missing Token)",
                    True,
                    f"Correctly returned error for missing token parameter (status {response.status_code})"
                )
            else:
                self.log_result(
                    "Email Verification API (Missing Token)",
                    False,
                    f"Expected 400/422 error, got {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_result(
                "Email Verification API (Missing Token)",
                False,
                f"Exception: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Backend API Tests for Luna Group VIP App")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Login first
        if not self.login():
            print("\n❌ Cannot proceed without authentication")
            return False
        
        # Run the 3 specific API tests
        self.test_venue_details_api()
        self.test_push_notification_api()
        self.test_email_verification_api()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed - check details above")
        sys.exit(1)