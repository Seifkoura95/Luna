"""
CherryHub Integration Service for Luna Group VIP App

This service handles:
1. OAuth2 authentication with CherryHub
2. Member registration via Third Party On-Demand Membership API
3. Digital Member Card retrieval (Apple Wallet / Google Wallet)
"""

import os
import httpx
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

# Mock mode - set to True for local testing when CherryHub API is not reachable
CHERRYHUB_MOCK_MODE = os.environ.get('CHERRYHUB_MOCK_MODE', 'true').lower() == 'true'

# CherryHub API Base URLs
# Staging/Test environment
CHERRYHUB_AUTH_URL = "https://accounts.cherryhub.com.au/oauth2/token"
CHERRYHUB_API_BASE_URL = "https://api-staging.cherryhub.com.au"

# Production environment (uncomment when ready)
# CHERRYHUB_API_BASE_URL = "https://api.cherryhub.com.au"

# Service Account Refresh Token (stored securely)
CHERRYHUB_REFRESH_TOKEN = os.environ.get('CHERRYHUB_REFRESH_TOKEN', '')


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
        """Refresh the access token using the refresh token"""
        if not self.refresh_token:
            raise ValueError("No refresh token configured for CherryHub")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    CHERRYHUB_AUTH_URL,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": CHERRYHUB_CLIENT_ID,
                        "client_secret": CHERRYHUB_CLIENT_SECRET,
                        "refresh_token": self.refresh_token,
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    logger.error(f"CherryHub token refresh failed: {response.status_code} - {response.text}")
                    raise Exception(f"Token refresh failed: {response.status_code}")
                
                data = response.json()
                self.access_token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)  # Default 1 hour
                self.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                
                # Update refresh token if a new one is provided
                if "refresh_token" in data:
                    self.refresh_token = data["refresh_token"]
                    logger.info("CherryHub refresh token updated")
                
                logger.info(f"CherryHub access token refreshed, expires at {self.token_expiry}")
                
            except httpx.RequestError as e:
                logger.error(f"CherryHub token refresh request error: {e}")
                raise


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
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an authenticated request to CherryHub API"""
        access_token = await token_manager.get_access_token()
        
        url = f"{CHERRYHUB_API_BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers, params=params, timeout=30.0)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, json=data, timeout=30.0)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=headers, json=data, timeout=30.0)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=headers, timeout=30.0)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                if response.status_code >= 400:
                    logger.error(f"CherryHub API error: {response.status_code} - {response.text}")
                    raise Exception(f"CherryHub API error: {response.status_code}")
                
                return response.json() if response.text else {}
                
            except httpx.RequestError as e:
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
        """
        endpoint = f"/{self.business_id}/members/{member_key}"
        
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
        
        endpoint = f"/{self.business_id}/members/{member_key}/dmc/passtype/{pass_type}"
        
        try:
            result = await self._make_request("GET", endpoint)
            logger.info(f"Retrieved digital member card for member {member_key} ({pass_type})")
            return result
        except Exception as e:
            logger.error(f"Failed to get digital member card: {e}")
            raise
    
    async def update_member(self, member_key: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update member information
        """
        endpoint = f"/{self.business_id}/members/{member_key}"
        
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
        endpoint = f"/{self.business_id}/members/{member_key}/points"
        
        try:
            result = await self._make_request("GET", endpoint)
            return result
        except Exception as e:
            logger.error(f"Failed to get member points balance: {e}")
            return {"points": 0, "error": str(e)}


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
