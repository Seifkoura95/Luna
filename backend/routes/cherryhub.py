"""
CherryHub Integration API Routes (Extended)

Handles NEW endpoints not in server.py:
1. CherryHub login (dual auth support)
2. Linking existing users to CherryHub
3. Real-time points operations (award/redeem)
4. Transaction history

NOTE: The following endpoints exist in server.py:
- POST /cherryhub/register
- GET /cherryhub/status  
- POST /cherryhub/wallet-pass
- GET /cherryhub/points
- POST /cherryhub/buy-points
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
import jwt
import bcrypt
import uuid
from datetime import datetime, timezone, timedelta

from database import db
from utils.auth import get_current_user
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS
from cherryhub_service import (
    cherryhub_service, 
    register_cherryhub_member, 
    CHERRYHUB_MOCK_MODE
)

router = APIRouter(prefix="/cherryhub", tags=["CherryHub"])
logger = logging.getLogger(__name__)


# ============== Helper Functions ==============

async def get_authenticated_user(request: Request):
    """Get authenticated user from request"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


# ============== Request Models ==============

class CherryHubLoginRequest(BaseModel):
    """Request to login with CherryHub credentials"""
    email: EmailStr


class CherryHubLinkRequest(BaseModel):
    """Request to link existing user to CherryHub"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    create_if_not_exists: bool = True


class AwardPointsRequest(BaseModel):
    """Request to award points to user"""
    points: int
    reason: str
    source: str = "app_reward"


class RedeemPointsRequest(BaseModel):
    """Request to redeem/deduct points"""
    points: int
    reason: str
    redemption_type: str = "reward"


# ============== NEW Endpoints ==============

@router.post("/login")
async def login_with_cherryhub(body: CherryHubLoginRequest):
    """
    Login using CherryHub credentials (dual auth support).
    Looks up user by CherryHub email and creates/links if needed.
    """
    try:
        # Look up member in CherryHub
        member = await cherryhub_service.get_member_by_email(body.email)
        
        if not member and not CHERRYHUB_MOCK_MODE:
            raise HTTPException(
                status_code=404,
                detail="No CherryHub account found for this email. Please register first."
            )
        
        # In mock mode, create a mock member if not found
        if not member and CHERRYHUB_MOCK_MODE:
            member = {
                "memberKey": f"LUNA-{body.email[:8].upper().replace('@', '').replace('.', '')}",
                "email": body.email,
                "firstName": "Luna",
                "lastName": "Member",
                "mock": True
            }
        
        member_key = member.get("memberKey", member.get("id"))
        
        # Check if we have a user with this CherryHub account
        existing_user = await db.users.find_one({"cherryhub_member_key": member_key})
        
        if existing_user:
            # Login existing user
            token_payload = {
                "user_id": existing_user["user_id"],
                "email": existing_user["email"],
                "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
            }
            token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            user_copy = {k: v for k, v in existing_user.items() 
                        if k not in ["hashed_password", "_id", "email_verification_token"]}
            
            logger.info(f"CherryHub login successful for existing user: {body.email}")
            
            return {
                "success": True,
                "user": user_copy,
                "token": token,
                "cherryhub_login": True,
                "existing_user": True,
                "mock": CHERRYHUB_MOCK_MODE
            }
        
        # Check if user exists by email but not linked
        existing_by_email = await db.users.find_one({"email": body.email})
        
        if existing_by_email:
            # Link CherryHub to existing user
            await db.users.update_one(
                {"user_id": existing_by_email["user_id"]},
                {
                    "$set": {
                        "cherryhub_member_key": member_key,
                        "cherryhub_email": body.email,
                        "cherryhub_linked_at": datetime.now(timezone.utc),
                        "cherryhub_status": "active"
                    }
                }
            )
            
            token_payload = {
                "user_id": existing_by_email["user_id"],
                "email": existing_by_email["email"],
                "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
            }
            token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            user_copy = {k: v for k, v in existing_by_email.items() 
                        if k not in ["hashed_password", "_id", "email_verification_token"]}
            user_copy["cherryhub_member_key"] = member_key
            
            logger.info(f"CherryHub login linked existing user: {body.email}")
            
            return {
                "success": True,
                "user": user_copy,
                "token": token,
                "cherryhub_login": True,
                "newly_linked": True,
                "mock": CHERRYHUB_MOCK_MODE
            }
        
        # Create new user from CherryHub account
        user_id = str(uuid.uuid4())
        
        new_user = {
            "user_id": user_id,
            "email": body.email,
            "hashed_password": bcrypt.hashpw(str(uuid.uuid4()).encode(), bcrypt.gensalt()).decode(),
            "name": f"{member.get('firstName', 'Luna')} {member.get('lastName', 'Member')}",
            "phone": member.get("phone"),
            "date_of_birth": member.get("dateOfBirth"),
            "tier": "bronze",
            "points_balance": 500,
            "cherryhub_member_key": member_key,
            "cherryhub_email": body.email,
            "cherryhub_linked_at": datetime.now(timezone.utc),
            "cherryhub_status": "active",
            "email_verified": True,  # CherryHub accounts are pre-verified
            "created_at": datetime.now(timezone.utc),
            "created_via": "cherryhub_login"
        }
        
        await db.users.insert_one(new_user)
        
        token_payload = {
            "user_id": user_id,
            "email": body.email,
            "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        user_copy = {k: v for k, v in new_user.items() 
                    if k not in ["hashed_password", "_id"]}
        
        logger.info(f"CherryHub login created new user: {body.email}")
        
        return {
            "success": True,
            "user": user_copy,
            "token": token,
            "cherryhub_login": True,
            "new_user": True,
            "mock": member.get("mock", CHERRYHUB_MOCK_MODE)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CherryHub login failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/link")
async def link_cherryhub_account(request: Request, body: CherryHubLinkRequest):
    """Link existing CherryHub account to current user"""
    current_user = await get_authenticated_user(request)
    
    # Check if user already linked
    if current_user.get("cherryhub_member_key"):
        return {
            "success": True,
            "member_key": current_user["cherryhub_member_key"],
            "message": "Account already linked",
            "already_linked": True
        }
    
    # Use provided email or user's email
    lookup_email = body.email or current_user.get("email")
    
    try:
        # Look up member in CherryHub
        member = await cherryhub_service.get_member_by_email(lookup_email)
        
        if member:
            # Found existing member - link it
            member_key = member.get("memberKey", member.get("id"))
            
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {
                    "$set": {
                        "cherryhub_member_key": member_key,
                        "cherryhub_email": lookup_email,
                        "cherryhub_linked_at": datetime.now(timezone.utc),
                        "cherryhub_status": "active"
                    }
                }
            )
            
            logger.info(f"Linked existing CherryHub account: {lookup_email} -> {member_key}")
            
            return {
                "success": True,
                "member_key": member_key,
                "message": "CherryHub account linked successfully",
                "existing_account": True,
                "mock": CHERRYHUB_MOCK_MODE
            }
        
        elif body.create_if_not_exists:
            # Create new CherryHub account
            user_name = current_user.get("name", "").split()
            first_name = user_name[0] if user_name else "Luna"
            last_name = user_name[-1] if len(user_name) > 1 else "Member"
            
            result = await register_cherryhub_member(
                email=lookup_email,
                first_name=first_name,
                last_name=last_name,
                phone=body.phone or current_user.get("phone"),
                date_of_birth=current_user.get("date_of_birth"),
                marketing_opt_in=True
            )
            
            member_key = result.get("memberKey")
            
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {
                    "$set": {
                        "cherryhub_member_key": member_key,
                        "cherryhub_email": lookup_email,
                        "cherryhub_linked_at": datetime.now(timezone.utc),
                        "cherryhub_status": "active"
                    }
                }
            )
            
            logger.info(f"Created new CherryHub account and linked: {lookup_email} -> {member_key}")
            
            return {
                "success": True,
                "member_key": member_key,
                "message": "New CherryHub account created and linked",
                "new_account": True,
                "mock": result.get("mock", CHERRYHUB_MOCK_MODE)
            }
        else:
            raise HTTPException(
                status_code=404,
                detail="No CherryHub account found for this email"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to link CherryHub account: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/points/award")
async def award_points_realtime(request: Request, body: AwardPointsRequest):
    """Award points to user (synced to CherryHub in real-time)"""
    current_user = await get_authenticated_user(request)
    member_key = current_user.get("cherryhub_member_key")
    
    # Always update local points
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": body.points}}
    )
    
    result = {
        "success": True,
        "points_awarded": body.points,
        "reason": body.reason,
        "local_updated": True,
        "new_balance": current_user.get("points_balance", 0) + body.points
    }
    
    # If linked to CherryHub, sync there too
    if member_key:
        try:
            cherryhub_result = await cherryhub_service.add_points(
                member_key, 
                body.points, 
                f"{body.reason} ({body.source})"
            )
            result["cherryhub_synced"] = True
            result["cherryhub_result"] = cherryhub_result
            logger.info(f"Points awarded and synced to CherryHub: {body.points} for {member_key}")
        except Exception as e:
            logger.error(f"Failed to sync points to CherryHub: {e}")
            result["cherryhub_synced"] = False
            result["cherryhub_error"] = str(e)
    
    # Log the points transaction
    await db.points_transactions.insert_one({
        "user_id": current_user["user_id"],
        "member_key": member_key,
        "type": "award",
        "points": body.points,
        "reason": body.reason,
        "source": body.source,
        "cherryhub_synced": result.get("cherryhub_synced", False),
        "created_at": datetime.now(timezone.utc)
    })
    
    return result


@router.post("/points/redeem")
async def redeem_points_realtime(request: Request, body: RedeemPointsRequest):
    """Redeem/deduct points from user (synced to CherryHub in real-time)"""
    current_user = await get_authenticated_user(request)
    member_key = current_user.get("cherryhub_member_key")
    current_points = current_user.get("points_balance", 0)
    
    if current_points < body.points:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient points. You have {current_points} but need {body.points}"
        )
    
    # Update local points
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": -body.points}}
    )
    
    result = {
        "success": True,
        "points_redeemed": body.points,
        "reason": body.reason,
        "new_balance": current_points - body.points,
        "local_updated": True
    }
    
    # If linked to CherryHub, sync there too
    if member_key:
        try:
            cherryhub_result = await cherryhub_service.deduct_points(
                member_key,
                body.points,
                f"{body.reason} ({body.redemption_type})"
            )
            result["cherryhub_synced"] = True
            result["cherryhub_result"] = cherryhub_result
            logger.info(f"Points redeemed and synced to CherryHub: {body.points} for {member_key}")
        except Exception as e:
            logger.error(f"Failed to sync point redemption to CherryHub: {e}")
            result["cherryhub_synced"] = False
            result["cherryhub_error"] = str(e)
    
    # Log the transaction
    await db.points_transactions.insert_one({
        "user_id": current_user["user_id"],
        "member_key": member_key,
        "type": "redeem",
        "points": -body.points,
        "reason": body.reason,
        "redemption_type": body.redemption_type,
        "cherryhub_synced": result.get("cherryhub_synced", False),
        "created_at": datetime.now(timezone.utc)
    })
    
    return result


@router.get("/transactions")
async def get_points_transactions(request: Request, limit: int = 20):
    """Get user's points transaction history"""
    current_user = await get_authenticated_user(request)
    
    transactions = await db.points_transactions.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    # Convert datetime objects to ISO strings for JSON serialization
    for t in transactions:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
    
    return {
        "transactions": transactions,
        "count": len(transactions)
    }


# ============== Status & Points Endpoints ==============

@router.get("/status")
async def get_cherryhub_status(request: Request):
    """Get CherryHub connection status for current user"""
    current_user = await get_authenticated_user(request)
    
    cherryhub_member_key = current_user.get("cherryhub_member_key")
    cherryhub_linked = bool(cherryhub_member_key)
    
    return {
        "connected": cherryhub_linked,
        "member_key": cherryhub_member_key,
        "mock_mode": CHERRYHUB_MOCK_MODE,
        "linked_at": current_user.get("cherryhub_linked_at"),
        "status": current_user.get("cherryhub_status", "active" if cherryhub_linked else "not_linked")
    }


@router.get("/points")
async def get_cherryhub_points(request: Request):
    """Get user's CherryHub points balance"""
    current_user = await get_authenticated_user(request)
    
    member_key = current_user.get("cherryhub_member_key")
    if not member_key:
        # Return local points if not linked
        return {
            "points": current_user.get("points", 0),
            "source": "local",
            "member_key": None,
            "mock_mode": CHERRYHUB_MOCK_MODE
        }
    
    # Get points from CherryHub (or mock)
    points_data = await cherryhub_service.get_points_balance(member_key)
    
    return {
        "points": points_data.get("balance", current_user.get("points", 0)),
        "source": "cherryhub" if not CHERRYHUB_MOCK_MODE else "mock",
        "member_key": member_key,
        "mock_mode": CHERRYHUB_MOCK_MODE,
        "tier": points_data.get("tier"),
        "lifetime_points": points_data.get("lifetime_points")
    }


class CherryHubRegisterRequest(BaseModel):
    """Request model for CherryHub registration"""
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None


@router.post("/register")
async def register_cherryhub_member_endpoint(request: Request, body: CherryHubRegisterRequest):
    """Register user as a new CherryHub member"""
    current_user = await get_authenticated_user(request)
    user_id = current_user["user_id"]
    
    # Check if already registered
    if current_user.get("cherryhub_member_key"):
        raise HTTPException(status_code=400, detail="Already registered with CherryHub")
    
    # Register with CherryHub
    result = await register_cherryhub_member(
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        date_of_birth=body.date_of_birth
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Registration failed"))
    
    # Update user with CherryHub data
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "cherryhub_member_key": result.get("member_key"),
                "cherryhub_registered_at": datetime.now(timezone.utc).isoformat(),
                "cherryhub_data": result.get("member_data"),
                "cherryhub_email": body.email
            }
        }
    )
    
    return {
        "success": True,
        "member_key": result.get("member_key"),
        "message": "Successfully registered with CherryHub"
    }


class WalletPassRequest(BaseModel):
    """Request model for wallet pass generation"""
    pass_type: str = "apple"  # apple or google


@router.post("/wallet-pass")
async def generate_wallet_pass(request: Request, body: WalletPassRequest):
    """Generate Apple or Google Wallet pass for membership"""
    current_user = await get_authenticated_user(request)
    
    member_key = current_user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(status_code=400, detail="Not linked to CherryHub")
    
    # Generate wallet pass (mock for now)
    pass_url = f"https://wallet.lunagroup.com.au/pass/{member_key}?type={body.pass_type}"
    
    return {
        "success": True,
        "pass_type": body.pass_type,
        "pass_url": pass_url,
        "member_key": member_key,
        "message": f"{'Apple' if body.pass_type == 'apple' else 'Google'} Wallet pass ready"
    }


class BuyPointsRequest(BaseModel):
    """Request model for buying points"""
    amount: int  # Points to buy
    payment_method_id: Optional[str] = None


@router.post("/buy-points")
async def buy_cherryhub_points(request: Request, body: BuyPointsRequest):
    """Purchase CherryHub points"""
    current_user = await get_authenticated_user(request)
    user_id = current_user["user_id"]
    
    member_key = current_user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(status_code=400, detail="Not linked to CherryHub")
    
    # Calculate price ($1 = 100 points)
    price_cents = body.amount  # 1 point = 1 cent
    
    # In mock mode, just add the points
    if CHERRYHUB_MOCK_MODE:
        current_points = current_user.get("points", 0)
        new_balance = current_points + body.amount
        
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {"points": new_balance},
                "$push": {
                    "points_history": {
                        "amount": body.amount,
                        "type": "purchase",
                        "description": f"Purchased {body.amount} points",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        return {
            "success": True,
            "points_added": body.amount,
            "new_balance": new_balance,
            "price_cents": price_cents,
            "mock_mode": True
        }
    
    # Live mode would integrate with Stripe and CherryHub
    raise HTTPException(status_code=501, detail="Live point purchase not yet implemented")

