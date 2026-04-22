"""
CherryHub Integration Service for Luna Group VIP App

This service handles:
1. OAuth2 authentication with CherryHub
2. Member registration via Third Party On-Demand Membership API
3. Digital Member Card retrieval (Apple Wallet / Google Wallet)
"""

import os
import aiohttp
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# CherryHub Configuration
CHERRYHUB_CLIENT_ID = os.environ.get('CHERRYHUB_CLIENT_ID', '4884860603804c33b5285ff051374638')
CHERRYHUB_CLIENT_SECRET = os.environ.get('CHERRYHUB_CLIENT_SECRET', 'MdGxQK0gtEM8wlsFAbRUcQqWm3SkOrDf')
CHERRYHUB_BUSINESS_ID = os.environ.get('CHERRYHUB_BUSINESS_ID', '81654767334')
CHERRYHUB_INTEGRATION_ID = os.environ.get('CHERRYHUB_INTEGRATION_ID', '81654767334.0')

# Mock mode - set to False for production with live credentials
CHERRYHUB_MOCK_MODE = os.environ.get('CHERRYHUB_MOCK_MODE', 'false').lower() == 'true'

# CherryHub API Base URLs
# Staging/Test environment - use test.api.cherryhub.com.au
# Production environment - use api.cherryhub.com.au (when ready)
CHERRYHUB_API_BASE_URL = os.environ.get('CHERRYHUB_API_URL', 'https://api.cherryhub.com.au')
CHERRYHUB_AUTH_URL = f"{CHERRYHUB_API_BASE_URL}/oauth2/v2.0/token"
CHERRYHUB_DATA_API_VERSION = "v1"

# Service Account Refresh Token (stored securely)
CHERRYHUB_REFRESH_TOKEN = os.environ.get(
    'CHERRYHUB_REFRESH_TOKEN',
    'AMf-vBzC-6FkmP2O4i88ZpGUukaaiFZaRUQrnSDr1vBabN9FhYKL3tRDjtR4MED4V36RqUvgoKr8bB3R_e_Hkh3ypoP75TX3Lgj8iAcKZ53ur62B1O2_JDCP1TAZC93GtbPKhpawCHoypDcNheHSCK46kktWDDk27PjJtoMEpKwN2vjfnksqD-1cDkOZLz7H-Ay4DcjsWWhqBpdHiNiC6nmnxoKBfuF0UxarxhG2SGahDkPNMrNnZyh5ScvP5kJ5qNHNoSkjJJynVZvyJbjm61-0cOgnmyKw0NLKWFZiY5xGvTIsUYQyBTAvVZMkjMSj_d1GeQ7POCJQ4WYdfLUcI5PZ2dSxWoMLuxGmSGMwcI0mLllQBV7t3xW_egdtCgg9yKZI9k8xJ2FmzGmcJTekbqeHe20EIvpWIJgXsIkd-CdO3usEkFEZXn4'
)


class CherryHubTokenManager:
    """Manages OAuth2 tokens for CherryHub API access"""
    
    def __init__(self):
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.refresh_token: str = CHERRYHUB_REFRESH_TOKEN
    
    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary"""
        if self._is_token_valid():
            return self.access_token
        
        await self._refresh_access_token()
        return self.access_token
    
    def _is_token_valid(self) -> bool:
        """Check if current access token is valid and not expired"""
        if not self.access_token or not self.token_expiry:
            return False
        # Add 5 minute buffer before expiry
        return datetime.now(timezone.utc) < (self.token_expiry - timedelta(minutes=5))
    
    async def _refresh_access_token(self) -> None:
        """Get access token using client credentials or refresh token"""
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # First try client_credentials grant (server-to-server)
            # Request the specific scopes CherryHub requires
            try:
                async with session.post(
                    CHERRYHUB_AUTH_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": CHERRYHUB_CLIENT_ID,
                        "client_secret": CHERRYHUB_CLIENT_SECRET,
                        "scope": "Members-Points.Manage Members-Points.Read Members.Read",
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.access_token = data.get("access_token")
                        expires_in = data.get("expires_in", 3600)
                        self.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                        logger.info(f"CherryHub access token obtained via client_credentials, expires in {expires_in}s")
                        return
                    else:
                        text = await response.text()
                        logger.warning(f"CherryHub client_credentials failed: {response.status} - {text}")
            except Exception as e:
                logger.warning(f"CherryHub client_credentials error: {e}")
            
            # Fallback to refresh_token grant if available
            if self.refresh_token:
                try:
                    async with session.post(
                        CHERRYHUB_AUTH_URL,
                        data={
                            "grant_type": "refresh_token",
                            "client_id": CHERRYHUB_CLIENT_ID,
                            "client_secret": CHERRYHUB_CLIENT_SECRET,
                            "refresh_token": self.refresh_token,
                        },
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                    ) as response:
                        if response.status != 200:
                            text = await response.text()
                            logger.error(f"CherryHub token refresh failed: {response.status} - {text}")
                            raise Exception(f"Token refresh failed: {response.status}")
                        
                        data = await response.json()
                        self.access_token = data.get("access_token")
                        expires_in = data.get("expires_in", 3600)
                        self.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                        
                        if "refresh_token" in data:
                            self.refresh_token = data["refresh_token"]
                            logger.info("CherryHub refresh token updated")
                        
                        logger.info(f"CherryHub access token refreshed, expires at {self.token_expiry}")
                        return
                        
                except aiohttp.ClientError as e:
                    logger.error(f"CherryHub token refresh request error: {e}")
                    raise
            
            raise Exception("Unable to obtain CherryHub access token")


# Global token manager instance
token_manager = CherryHubTokenManager()


class MemberRegistrationRequest(BaseModel):
    """Request model for registering a new member"""
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None  # Format: YYYY-MM-DD
    marketing_opt_in: bool = False


class CherryHubService:
    """Service class for CherryHub API interactions"""
    
    def __init__(self):
        self.business_id = CHERRYHUB_BUSINESS_ID
        self.integration_id = CHERRYHUB_INTEGRATION_ID
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        use_data_api: bool = True
    ) -> Dict[str, Any]:
        """Make an authenticated request to CherryHub API"""
        access_token = await token_manager.get_access_token()
        
        # Build URL with Data API versioning if needed
        if use_data_api:
            url = f"{CHERRYHUB_API_BASE_URL}/data/{CHERRYHUB_DATA_API_VERSION}{endpoint}"
        else:
            url = f"{CHERRYHUB_API_BASE_URL}{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                if method.upper() == "GET":
                    async with session.get(url, headers=headers, params=params) as response:
                        if response.status >= 400:
                            text = await response.text()
                            logger.error(f"CherryHub API error: {response.status} - {text}")
                            raise Exception(f"CherryHub API error: {response.status}")
                        return await response.json() if response.content_length else {}
                elif method.upper() == "POST":
                    async with session.post(url, headers=headers, json=data) as response:
                        if response.status >= 400:
                            text = await response.text()
                            logger.error(f"CherryHub API error: {response.status} - {text}")
                            raise Exception(f"CherryHub API error: {response.status}")
                        return await response.json() if response.content_length else {}
                elif method.upper() == "PUT":
                    async with session.put(url, headers=headers, json=data) as response:
                        if response.status >= 400:
                            text = await response.text()
                            logger.error(f"CherryHub API error: {response.status} - {text}")
                            raise Exception(f"CherryHub API error: {response.status}")
                        return await response.json() if response.content_length else {}
                elif method.upper() == "DELETE":
                    async with session.delete(url, headers=headers) as response:
                        if response.status >= 400:
                            text = await response.text()
                            logger.error(f"CherryHub API error: {response.status} - {text}")
                            raise Exception(f"CherryHub API error: {response.status}")
                        return await response.json() if response.content_length else {}
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
            except aiohttp.ClientError as e:
                logger.error(f"CherryHub API request error: {e}")
                raise
    
    async def register_member(self, request: MemberRegistrationRequest, registration_form_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new member via Third Party On-Demand Membership API
        
        Returns member data including MemberKey (SwiftPOS Member Number)
        """
        # Mock mode for testing
        if CHERRYHUB_MOCK_MODE:
            member_key = f"LUNA-{str(uuid.uuid4())[:8].upper()}"
            logger.info(f"[MOCK] Registering CherryHub member: {request.email} -> {member_key}")
            return {
                "memberKey": member_key,
                "email": request.email,
                "firstName": request.first_name,
                "lastName": request.last_name,
                "status": "active",
                "created": datetime.now(timezone.utc).isoformat(),
                "mock": True
            }
        
        # Build registration data
        member_data = {
            "email": request.email,
            "firstName": request.first_name,
            "lastName": request.last_name,
            "marketingOptIn": request.marketing_opt_in,
        }
        
        if request.phone:
            member_data["phone"] = request.phone
        
        if request.date_of_birth:
            member_data["dateOfBirth"] = request.date_of_birth
        
        # Use registration form endpoint if form ID is provided
        if registration_form_id:
            endpoint = f"/{self.business_id}/forms/{registration_form_id}/register"
        else:
            # Direct member creation endpoint
            endpoint = f"/{self.business_id}/members"
        
        try:
            result = await self._make_request("POST", endpoint, data=member_data)
            logger.info(f"Successfully registered CherryHub member: {request.email}")
            return result
        except Exception as e:
            logger.error(f"Failed to register CherryHub member: {e}")
            raise
    
    async def get_member_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Look up a member by email address
        """
        endpoint = f"/{self.business_id}/members"
        params = {"email": email}
        
        try:
            result = await self._make_request("GET", endpoint, params=params)
            members = result.get("data", result.get("members", []))
            if members and len(members) > 0:
                return members[0]
            return None
        except Exception as e:
            logger.error(f"Failed to lookup CherryHub member: {e}")
            return None
    
    async def get_member_by_key(self, member_key: str) -> Optional[Dict[str, Any]]:
        """
        Get member details by MemberKey (SwiftPOS Member Number)
        CherryHub requires composite ID format: {business_id}.0.{member_key}
        """
        composite_id = member_key
        if not member_key.startswith(self.business_id):
            composite_id = f"{self.business_id}.0.{member_key}"
        
        endpoint = f"/{self.business_id}/members/{composite_id}"
        
        try:
            result = await self._make_request("GET", endpoint)
            return result
        except Exception as e:
            logger.error(f"Failed to get CherryHub member by key: {e}")
            return None
    
    async def get_digital_member_card(self, member_key: str, pass_type: str) -> Dict[str, Any]:
        """
        Retrieve Digital Member Card for Apple Wallet or Google Wallet
        
        Args:
            member_key: SwiftPOS Member Number (primary key)
            pass_type: "GooglePayPass" or "IosPassKit"
        
        Returns:
            For GooglePayPass: {"GooglePassUrl": "https://..."}
            For IosPassKit: {"IosPassContentBase64": "base64encoded..."}
        """
        if pass_type not in ["GooglePayPass", "IosPassKit"]:
            raise ValueError(f"Invalid pass type: {pass_type}. Must be 'GooglePayPass' or 'IosPassKit'")
        
        # Mock mode for testing
        if CHERRYHUB_MOCK_MODE:
            logger.info(f"[MOCK] Getting digital member card for {member_key} ({pass_type})")
            if pass_type == "GooglePayPass":
                return {
                    "GooglePassUrl": f"https://pay.google.com/gp/v/save/mock_luna_pass_{member_key}",
                    "mock": True
                }
            else:
                # Return a mock base64 string (would be actual .pkpass content in production)
                return {
                    "IosPassContentBase64": "UEsDBBQAAAAIAMockLunaPassContentBase64==",
                    "mock": True
                }
        
        composite_id = member_key if member_key.startswith(self.business_id) else f"{self.business_id}.0.{member_key}"
        endpoint = f"/{self.business_id}/members/{composite_id}/dmc"
        params = {"passType": pass_type}
        
        try:
            result = await self._make_request("GET", endpoint, params=params)
            logger.info(f"Retrieved digital member card for member {member_key} ({pass_type})")
            return result
        except Exception as e:
            logger.error(f"Failed to get digital member card: {e}")
            raise
    
    async def update_member(self, member_key: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update member information
        """
        composite_id = member_key if member_key.startswith(self.business_id) else f"{self.business_id}.0.{member_key}"
        endpoint = f"/{self.business_id}/members/{composite_id}"
        
        try:
            result = await self._make_request("PUT", endpoint, data=update_data)
            logger.info(f"Updated CherryHub member: {member_key}")
            return result
        except Exception as e:
            logger.error(f"Failed to update CherryHub member: {e}")
            raise
    
    async def get_member_points_balance(self, member_key: str) -> Dict[str, Any]:
        """
        Get member's loyalty points balance
        """
        if CHERRYHUB_MOCK_MODE:
            logger.info(f"[MOCK] Getting points balance for {member_key}")
            return {"points": 1250, "balance": 1250, "tier": "Gold", "lifetimePoints": 5000, "mock": True}
        
        composite_id = member_key
        if not member_key.startswith(self.business_id):
            composite_id = f"{self.business_id}.0.{member_key}"
        
        endpoint = f"/{self.business_id}/members/{composite_id}/points"
        
        try:
            result = await self._make_request("GET", endpoint)
            return result
        except Exception as e:
            logger.error(f"Failed to get member points balance: {e}")
            return {"points": 0, "error": str(e)}
    
    async def add_points(self, member_key: str, points: int, reason: str = "Luna Group App") -> Dict[str, Any]:
        """
        Add loyalty points to a member's account
        
        Args:
            member_key: CherryHub member key
            points: Number of points to add
            reason: Description of why points are being added
        
        Returns:
            Updated points balance
        """
        # Mock mode for testing
        if CHERRYHUB_MOCK_MODE:
            logger.info(f"[MOCK] Adding {points} points to member {member_key} - {reason}")
            return {
                "success": True,
                "pointsAdded": points,
                "newBalance": 1250 + points,
                "reason": reason,
                "mock": True
            }
        
        composite_id = member_key
        if not member_key.startswith(self.business_id):
            composite_id = f"{self.business_id}.0.{member_key}"
        
        endpoint = f"/{self.business_id}/members/{composite_id}/points/add"
        data = {
            "points": points,
            "reason": reason,
            "source": "LunaGroupApp",
            "RequestDetails": {"origin": "luna_app", "reason": reason},
        }
        
        try:
            result = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Added {points} points to CherryHub member {member_key}")
            return result
        except Exception as e:
            logger.error(f"Failed to add points to CherryHub: {e}")
            raise
    
    async def deduct_points(self, member_key: str, points: int, reason: str = "Redemption") -> Dict[str, Any]:
        """
        Deduct loyalty points from a member's account
        """
        # Mock mode for testing
        if CHERRYHUB_MOCK_MODE:
            logger.info(f"[MOCK] Deducting {points} points from member {member_key} - {reason}")
            return {
                "success": True,
                "pointsDeducted": points,
                "newBalance": max(0, 1250 - points),
                "reason": reason,
                "mock": True
            }
        
        composite_id = member_key if member_key.startswith(self.business_id) else f"{self.business_id}.0.{member_key}"
        endpoint = f"/{self.business_id}/members/{composite_id}/points/deduct"
        data = {
            "points": points,
            "reason": reason,
            "source": "LunaGroupApp"
        }
        
        try:
            result = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Deducted {points} points from CherryHub member {member_key}")
            return result
        except Exception as e:
            logger.error(f"Failed to deduct points from CherryHub: {e}")
            raise

    async def search_points_transactions(
        self,
        member_key: Optional[str] = None,
        transaction_type: Optional[str] = None,   # "Redeem" | "Award"
        status: str = "Success",
        state: str = "Completed",
        after: Optional[str] = None,              # ISO-8601 datetime string
        limit: int = 200,
        continuation_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Pull PointsTransactions from CherryHub via the search endpoint.

        Returns the raw response: {"_links": {...}, "Results": [...]}
        """
        if CHERRYHUB_MOCK_MODE:
            return {"_links": {}, "Results": [], "mock": True}

        endpoint = f"/{self.business_id}/points-transactions/search"
        params: Dict[str, Any] = {
            "pointsTransactionStatus": status,
            "pointsTransactionState": state,
            "limit": limit,
        }
        if transaction_type:
            params["pointsTransactionType"] = transaction_type
        if member_key:
            composite_id = member_key if member_key.startswith(self.business_id) else f"{self.business_id}.0.{member_key}"
            params["memberId"] = composite_id
        if after:
            params["transactionDateAfter"] = after
        if continuation_token:
            params["continuationToken"] = continuation_token

        return await self._make_request("GET", endpoint, params=params)


# Global service instance
cherryhub_service = CherryHubService()


# Utility functions for easy access
async def register_cherryhub_member(
    email: str,
    first_name: str,
    last_name: str,
    phone: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    marketing_opt_in: bool = False
) -> Dict[str, Any]:
    """Convenience function to register a new CherryHub member"""
    request = MemberRegistrationRequest(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        date_of_birth=date_of_birth,
        marketing_opt_in=marketing_opt_in
    )
    return await cherryhub_service.register_member(request)


async def get_wallet_pass(member_key: str, platform: str) -> Dict[str, Any]:
    """
    Get digital wallet pass for a member
    
    Args:
        member_key: CherryHub member key
        platform: "ios" or "android"
    
    Returns:
        Wallet pass data (URL for Google, base64 for Apple)
    """
    pass_type = "IosPassKit" if platform.lower() == "ios" else "GooglePayPass"
    return await cherryhub_service.get_digital_member_card(member_key, pass_type)
