"""
Authentication API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
import uuid
import bcrypt
import jwt
import logging
from datetime import datetime, timezone, timedelta

from database import db
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS, EMAIL_VERIFICATION_EXPIRY_HOURS, REFERRAL_POINTS_REWARD
from utils.auth import get_current_user, generate_verification_token, send_verification_email
from models.auth import RegisterRequest, LoginRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


async def complete_referral(referred_user_id: str):
    """
    Complete a referral and award points to the referrer.
    Called automatically when a referred user is verified/completes signup.
    """
    from routes.shared import create_notification
    
    # Find pending referral for this user
    referral = await db.referrals.find_one({
        "referred_user_id": referred_user_id,
        "status": "pending"
    })
    
    if not referral:
        return None
    
    # Update referral status
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc)
        }}
    )
    
    # Award points to referrer
    await db.users.update_one(
        {"user_id": referral["referrer_user_id"]},
        {"$inc": {"points_balance": REFERRAL_POINTS_REWARD}}
    )
    
    # Create notification for referrer
    await create_notification(
        user_id=referral["referrer_user_id"],
        notification_type="referral",
        title="Referral Bonus!",
        message=f"Your friend just joined Luna! You earned {REFERRAL_POINTS_REWARD} points.",
        data={
            "points_earned": REFERRAL_POINTS_REWARD,
            "referral_id": referral["id"]
        },
        priority="high"
    )
    
    logger.info(f"Referral completed: {referral['referrer_user_id']} earned {REFERRAL_POINTS_REWARD} points")
    
    return referral


@router.post("/register")
async def register(request: RegisterRequest):
    """Register a new user account"""
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate referral code if provided
    referrer = None
    if request.referral_code:
        referrer = await db.users.find_one({"referral_code": request.referral_code.upper()})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")
    
    hashed = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt())
    user_id = str(uuid.uuid4())
    
    # Generate email verification token
    verification_token = generate_verification_token()
    verification_expiry = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    # Calculate age if DOB provided
    age = None
    if request.date_of_birth:
        try:
            dob = datetime.strptime(request.date_of_birth, "%Y-%m-%d")
            today = datetime.now()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except:
            pass
    
    user = {
        "user_id": user_id,
        "email": request.email,
        "hashed_password": hashed.decode(),
        "name": request.name,
        "phone": request.phone,
        "date_of_birth": request.date_of_birth,
        "age": age,
        "gender": request.gender,
        "address": request.address,
        "city": request.city or "brisbane",
        "preferred_venues": request.preferred_venues or [],
        "tier": "bronze",
        "points_balance": 500,
        "home_region": "brisbane",
        "favorite_venues": [],
        "referred_by": referrer["user_id"] if referrer else None,
        "email_verified": False,
        "email_verification_token": verification_token,
        "email_verification_expiry": verification_expiry,
        "push_token": None,
        "total_visits": 0,
        "total_spend": 0,
        "last_visit": None,
        "visit_history": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user)
    
    # Create referral record if code was provided
    if referrer:
        referral = {
            "id": str(uuid.uuid4())[:8],
            "referrer_user_id": referrer["user_id"],
            "referrer_name": referrer.get("name", "Luna Member"),
            "referred_user_id": user_id,
            "referred_name": request.name,
            "referral_code": request.referral_code.upper(),
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.referrals.insert_one(referral)
    
    # Send verification email
    verification_link = await send_verification_email(request.email, request.name, verification_token)
    
    token_payload = {
        "user_id": user_id,
        "email": request.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Remove sensitive fields
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id", "email_verification_token"]}
    
    return {
        "user": user_copy,
        "token": token,
        "verification_required": True,
        "message": "Please check your email to verify your account",
        "demo_verification_link": verification_link
    }


@router.post("/verify-email")
async def verify_email(token: str):
    """Verify user's email address using the token sent via email"""
    user = await db.users.find_one({"email_verification_token": token})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    # Check if token has expired
    expiry = user.get("email_verification_expiry")
    if expiry and datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Verification token has expired. Please request a new one.")
    
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    
    # Mark email as verified
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email_verified": True,
                "email_verified_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "email_verification_token": "",
                "email_verification_expiry": ""
            }
        }
    )
    
    # Complete any pending referral
    referral_completed = await complete_referral(user["user_id"])
    
    response = {
        "success": True,
        "message": "Email verified successfully! Welcome to Luna Group.",
        "user_id": user["user_id"]
    }
    
    if referral_completed:
        response["referral_bonus"] = f"You and your friend each earned {REFERRAL_POINTS_REWARD} points!"
    
    return response


@router.post("/resend-verification")
async def resend_verification_email_endpoint(request: Request):
    """Resend verification email for unverified users"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    
    # Generate new verification token
    verification_token = generate_verification_token()
    verification_expiry = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "email_verification_token": verification_token,
            "email_verification_expiry": verification_expiry
        }}
    )
    
    # Send new verification email
    verification_link = await send_verification_email(user["email"], user["name"], verification_token)
    
    return {
        "success": True,
        "message": "Verification email sent",
        "demo_verification_link": verification_link
    }


@router.post("/login")
async def login(request: LoginRequest):
    """Login with email and password"""
    logger.info(f"Login attempt for: {request.email}")
    query = {"email": request.email}
    user = await db.users.find_one(query)
    
    if not user:
        all_users = await db.users.find({}, {"email": 1, "_id": 0}).to_list(100)
        logger.warning(f"User not found: {request.email}. Available emails: {[u['email'] for u in all_users[:5]]}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    logger.info(f"User found: {user.get('email')}, role: {user.get('role')}")
    
    if not bcrypt.checkpw(request.password.encode(), user["hashed_password"].encode()):
        logger.warning(f"Password check failed for: {request.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token_payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Remove sensitive fields
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id"]}
    
    logger.info(f"Login successful for: {request.email}")
    return {"user": user_copy, "token": token}


@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user profile"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Remove sensitive fields
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id"]}
    return user_copy
