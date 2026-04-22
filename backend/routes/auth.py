"""
Authentication API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
import uuid
import bcrypt
import jwt
import logging
import secrets
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
    
    # Generate 6-digit email OTP (valid for 15 minutes). The OTP itself is
    # stored hashed in the DB so a stolen DB snapshot can't be used to verify
    # accounts; only the user has the plain-text code in their inbox.
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = bcrypt.hashpw(otp_code.encode(), bcrypt.gensalt()).decode()
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Calculate age (DOB required for age-verification — 18+ enforced per ToS §2)
    age = None
    if request.date_of_birth:
        try:
            dob = datetime.strptime(request.date_of_birth, "%Y-%m-%d")
            today = datetime.now()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date of birth format. Use YYYY-MM-DD.")

    # Enforce 18+ eligibility (Queensland legal drinking age)
    if age is not None and age < 18:
        raise HTTPException(status_code=403, detail="You must be at least 18 years old to use Luna Group.")

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
        "email_otp_hash": otp_hash,
        "email_otp_expiry": otp_expiry,
        "email_otp_attempts": 0,
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
    
    # Send verification OTP email (fire-and-forget; swallow errors so a
    # transient Resend outage can't block the signup response)
    try:
        from utils.email_service import send_verification_email_otp
        await send_verification_email_otp(request.email, request.name, otp_code)
    except Exception as exc:
        logger.error(f"Signup OTP email failed for {request.email[:3]}***: {exc}")
    
    token_payload = {
        "user_id": user_id,
        "email": request.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Remove sensitive fields (including OTP hash — never leak to client)
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id", "email_otp_hash"]}
    
    return {
        "user": user_copy,
        "token": token,
        "verification_required": True,
        "message": "We've sent a 6-digit code to your email. Enter it to verify your account.",
    }


@router.post("/verify-email")
async def verify_email(request: Request):
    """
    Verify user's email address by submitting the 6-digit OTP sent via email.

    Body: {"code": "123456"}
    Auth: Bearer token required (issued at /register).

    Rate limiting: after 5 failed attempts for a given OTP, the OTP is
    invalidated and the user must request a new one via /resend-verification.
    """
    body = await request.json()
    code = str(body.get("code", "")).strip()
    if not code or len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Enter the 6-digit code from your email.")

    # Identify the current user via JWT
    auth_header = request.headers.get("authorization")
    current = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": current["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified", "user_id": user["user_id"]}

    # Expiry check — Mongo may round-trip datetimes as naive UTC; normalize
    expiry = user.get("email_otp_expiry")
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if not expiry or datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="This code has expired. Tap 'Resend code' to get a new one.")

    # Attempt-limit check (prevents brute-forcing the 6-digit space)
    attempts = int(user.get("email_otp_attempts", 0))
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Tap 'Resend code' to get a new one.")

    stored_hash = user.get("email_otp_hash", "")
    if not stored_hash or not bcrypt.checkpw(code.encode(), stored_hash.encode()):
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"email_otp_attempts": 1}}
        )
        remaining = max(0, 4 - attempts)
        raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.")

    # Success — mark verified and scrub OTP fields
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email_verified": True,
                "email_verified_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "email_otp_hash": "",
                "email_otp_expiry": "",
                "email_otp_attempts": "",
                # Legacy fields from the previous link-based flow
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
    """Resend a fresh 6-digit OTP email for unverified users."""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    
    # Generate new 6-digit OTP (15 min expiry, resets attempt counter)
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = bcrypt.hashpw(otp_code.encode(), bcrypt.gensalt()).decode()
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "email_otp_hash": otp_hash,
            "email_otp_expiry": otp_expiry,
            "email_otp_attempts": 0,
        }}
    )
    
    try:
        from utils.email_service import send_verification_email_otp
        await send_verification_email_otp(user["email"], user.get("name", ""), otp_code)
    except Exception as exc:
        logger.error(f"Resend OTP email failed for {user['email'][:3]}***: {exc}")
    
    return {
        "success": True,
        "message": "A new 6-digit code has been sent to your email.",
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


from pydantic import BaseModel, EmailStr
from typing import Optional

class UpdateProfileRequest(BaseModel):
    """Request model for profile updates"""
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    instagram_handle: Optional[str] = None
    favorite_venue: Optional[str] = None
    music_preferences: Optional[list] = None
    notification_preferences: Optional[dict] = None


@router.put("/profile")
async def update_profile(request: Request, profile_data: UpdateProfileRequest):
    """Update user profile information"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Get current user
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update dict with only provided fields
    update_data = {}
    
    if profile_data.name is not None:
        update_data["name"] = profile_data.name.strip()
    
    if profile_data.phone is not None:
        # Clean phone number
        phone = profile_data.phone.strip()
        # Basic validation - allow digits, +, -, spaces, parentheses
        import re
        phone_clean = re.sub(r'[^\d+\-\s\(\)]', '', phone)
        if len(phone_clean) >= 8:  # Minimum phone length
            update_data["phone"] = phone_clean
        elif phone == "":  # Allow clearing
            update_data["phone"] = None
    
    if profile_data.date_of_birth is not None:
        # Validate date format (YYYY-MM-DD)
        try:
            if profile_data.date_of_birth:
                dob = datetime.strptime(profile_data.date_of_birth, "%Y-%m-%d")
                # Check age (must be at least 18)
                today = datetime.now()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 18:
                    raise HTTPException(status_code=400, detail="You must be at least 18 years old")
                if age > 120:
                    raise HTTPException(status_code=400, detail="Invalid date of birth")
                update_data["date_of_birth"] = profile_data.date_of_birth
            else:
                update_data["date_of_birth"] = None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if profile_data.gender is not None:
        if profile_data.gender in ["male", "female", "non-binary", "prefer-not-to-say", ""]:
            update_data["gender"] = profile_data.gender if profile_data.gender else None
    
    if profile_data.bio is not None:
        # Limit bio length
        bio = profile_data.bio.strip()[:500]
        update_data["bio"] = bio
    
    if profile_data.instagram_handle is not None:
        # Clean Instagram handle
        handle = profile_data.instagram_handle.strip().lstrip('@')
        if len(handle) <= 30:  # Instagram max username length
            update_data["instagram_handle"] = handle if handle else None
    
    if profile_data.favorite_venue is not None:
        update_data["favorite_venue"] = profile_data.favorite_venue
    
    if profile_data.music_preferences is not None:
        # Validate music preferences
        valid_genres = ["house", "techno", "hip-hop", "rnb", "pop", "latin", "edm", "dnb", "disco", "afrobeats", "rock", "indie", "other"]
        filtered_prefs = [g for g in profile_data.music_preferences if g.lower() in valid_genres]
        update_data["music_preferences"] = filtered_prefs
    
    if profile_data.notification_preferences is not None:
        # Validate notification preferences
        valid_keys = ["push_enabled", "email_enabled", "sms_enabled", "events", "auctions", "rewards", "crew", "marketing"]
        filtered_prefs = {k: v for k, v in profile_data.notification_preferences.items() if k in valid_keys}
        update_data["notification_preferences"] = filtered_prefs
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Update user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    # Return updated user
    updated_user = await db.users.find_one({"user_id": user_id})
    user_copy = {k: v for k, v in updated_user.items() if k not in ["hashed_password", "_id"]}
    
    logger.info(f"Profile updated for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Profile updated successfully",
        "user": user_copy
    }


class ChangeEmailRequest(BaseModel):
    """Request model for email change"""
    new_email: EmailStr
    password: str


@router.post("/change-email")
async def change_email(request: Request, email_data: ChangeEmailRequest):
    """Request email change (requires password verification)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Get current user with password
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if not bcrypt.checkpw(email_data.password.encode('utf-8'), user["hashed_password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Check if new email is already in use
    existing = await db.users.find_one({"email": email_data.new_email})
    if existing and existing["user_id"] != user_id:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    # For now, directly update email (in production, you'd send a verification email)
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "email": email_data.new_email,
                "email_updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"Email changed for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Email updated successfully",
        "new_email": email_data.new_email
    }


class ChangePasswordRequest(BaseModel):
    """Request model for password change"""
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(request: Request, password_data: ChangePasswordRequest):
    """Change user password"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Get current user
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not bcrypt.checkpw(password_data.current_password.encode('utf-8'), user["hashed_password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash new password
    new_hashed = bcrypt.hashpw(password_data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Update password
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "hashed_password": new_hashed,
                "password_updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"Password changed for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Password updated successfully"
    }


@router.delete("/account")
async def delete_account(request: Request):
    """Delete user account. Anonymises all PII immediately; full DB row cleanup runs within 30 days per our Privacy Policy."""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]

    # Hard-anonymise all personally identifying fields immediately.
    # Data we MUST retain for tax/accounting law (payment transactions,
    # anonymised spend totals) remain under the user_id but no longer link to a real person.
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "deleted": True,
                "deleted_at": datetime.now(timezone.utc),
                "email": f"deleted_{user_id}@deleted.local",
                "name": "[deleted]",
                "phone": None,
                "date_of_birth": None,
                "age": None,
                "address": None,
                "gender": None,
                "bio": None,
                "instagram_handle": None,
                "push_token": None,
                "profile_photo": None,
                "email_verified": False,
                "email_verification_token": None,
                "password_reset_token": None,
            }
        }
    )

    # Revoke any active subscriptions immediately so no further billing.
    await db.subscriptions.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc), "cancel_reason": "account_deleted"}}
    )

    # Invalidate any active milestone tickets and redemption QRs bound to this user.
    await db.milestone_tickets.delete_many({"user_id": user_id, "status": "active"})
    await db.wallet_passes.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "revoked", "revoked_reason": "account_deleted", "revoked_at": datetime.now(timezone.utc)}}
    )

    logger.info(f"Account deleted for user: {user_id[:8]}... — PII purged, subscriptions cancelled, tickets revoked")

    return {
        "success": True,
        "message": "Your account has been deleted. All personal information has been removed and any active subscription has been cancelled."
    }


@router.get("/my-data")
async def export_my_data(request: Request):
    """
    Export all personal data we hold for the current user (Privacy Policy §8 / APP 12).
    Returns a JSON blob the user can save. Mirrors what we'd email on request.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]

    # Core profile
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "hashed_password": 0, "email_verification_token": 0, "password_reset_token": 0})

    # Related data (exclude internal _id)
    subscriptions = await db.subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    # Related data (exclude internal _id). Graceful if a collection doesn't exist.
    try:
        check_ins = await db.check_ins.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    except Exception:
        check_ins = []
    points_transactions = await db.points_transactions.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    redemptions = await db.redemptions.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    milestone_claims = await db.milestone_claims.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    bookings = await db.bookings.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    payment_transactions = await db.payment_transactions.find(
        {"user_id": user_id}, {"_id": 0, "metadata": 1, "amount": 1, "currency": 1, "payment_status": 1, "created_at": 1, "package_name": 1}
    ).to_list(500)

    return {
        "export_generated_at": datetime.now(timezone.utc).isoformat(),
        "profile": user,
        "subscriptions": subscriptions,
        "check_ins": check_ins,
        "points_transactions": points_transactions,
        "redemptions": redemptions,
        "milestone_claims": milestone_claims,
        "bookings": bookings,
        "payment_transactions": payment_transactions,
        "notice": "This is a complete export of personal data held by Luna Group for this account as of the time above. For questions contact privacy@lunagroupapp.com.au."
    }



# ========== FORGOT PASSWORD ==========

class ForgotPasswordRequest:
    email: str

class ResetPasswordRequest:
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(request: Request):
    """
    Request password reset. Generates a reset token.
    In production, this would send an email with a reset link.
    """
    try:
        body = await request.json()
        email = body.get("email", "").lower().strip()
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = await db.users.find_one({"email": email, "deleted": {"$ne": True}})
    
    # Always return success to prevent email enumeration
    if not user:
        logger.info(f"Password reset requested for non-existent email: {email[:3]}***")
        return {
            "success": True,
            "message": "If an account exists with this email, a reset link has been sent."
        }
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "password_reset_token": reset_token,
                "password_reset_expiry": reset_expiry
            }
        }
    )
    
    # Send password reset email via Resend (branded sender)
    from utils.email_service import send_password_reset_email
    try:
        await send_password_reset_email(email, user.get("name", ""), reset_token)
    except Exception as exc:  # never leak email send failures to the client
        logger.error(f"Password reset email failed for {email[:3]}***: {exc}")

    # Generic success response — do NOT leak the token. Email enumeration safe.
    return {
        "success": True,
        "message": "If an account exists with this email, a reset link has been sent.",
        "expires_in": "1 hour"
    }


@router.post("/reset-password")
async def reset_password(request: Request):
    """
    Reset password using the token from forgot-password.
    """
    try:
        body = await request.json()
        token = body.get("token", "").strip()
        new_password = body.get("new_password", "")
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find user with this reset token
    user = await db.users.find_one({
        "password_reset_token": token,
        "deleted": {"$ne": True}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    expiry = user.get("password_reset_expiry")
    if expiry:
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        elif isinstance(expiry, datetime) and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Hash new password
    hashed_password = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    
    # Update password and clear reset token
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {"hashed_password": hashed_password},
            "$unset": {
                "password_reset_token": "",
                "password_reset_expiry": ""
            }
        }
    )
    
    logger.info(f"Password reset completed for user: {user['user_id'][:8]}...")
    
    return {
        "success": True,
        "message": "Password has been reset successfully. You can now log in with your new password."
    }



# ========== LOGOUT / TOKEN INVALIDATION ==========

@router.post("/logout")
async def logout(request: Request):
    """
    Logout user and invalidate their current token.
    Adds token to blacklist so it can't be used again.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Extract token from header
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if token:
        # Add token to blacklist collection
        await db.token_blacklist.insert_one({
            "token": token,
            "user_id": user_id,
            "invalidated_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7)  # Keep for token expiry period
        })
        
        # Create TTL index if not exists (tokens auto-delete after expiry)
        try:
            await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)
        except:
            pass  # Index might already exist
    
    logger.info(f"User logged out: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.post("/logout-all")
async def logout_all_devices(request: Request):
    """
    Logout user from all devices by incrementing their token version.
    All existing tokens become invalid.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Increment token version - all tokens with old version become invalid
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {"token_version": 1},
            "$set": {"all_tokens_invalidated_at": datetime.now(timezone.utc)}
        }
    )
    
    logger.info(f"All sessions invalidated for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Logged out from all devices successfully"
    }


# ========== AVATAR / PROFILE PHOTO ==========

import base64
import os
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "avatars"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/avatar")
async def upload_avatar(request: Request):
    """
    Upload a profile avatar image.
    Accepts base64 encoded image data or multipart form data.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        # Handle base64 encoded image
        try:
            body = await request.json()
            image_data = body.get("image")
            
            if not image_data:
                raise HTTPException(status_code=400, detail="No image data provided")
            
            # Parse data URL if present
            if image_data.startswith("data:"):
                # Format: data:image/jpeg;base64,/9j/4AAQ...
                header, encoded = image_data.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0]
            else:
                encoded = image_data
                mime_type = "image/jpeg"  # Default
            
            if mime_type not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid image type: {mime_type}")
            
            # Decode base64
            try:
                image_bytes = base64.b64decode(encoded)
            except:
                raise HTTPException(status_code=400, detail="Invalid base64 encoding")
            
            if len(image_bytes) > MAX_AVATAR_SIZE:
                raise HTTPException(status_code=400, detail="Image too large. Max 5MB allowed.")
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    
    elif "multipart/form-data" in content_type:
        # Handle multipart form upload
        from fastapi import UploadFile
        form = await request.form()
        file = form.get("avatar") or form.get("image") or form.get("file")
        
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        mime_type = file.content_type
        if mime_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid image type: {mime_type}")
        
        image_bytes = await file.read()
        
        if len(image_bytes) > MAX_AVATAR_SIZE:
            raise HTTPException(status_code=400, detail="Image too large. Max 5MB allowed.")
    
    else:
        raise HTTPException(status_code=400, detail="Content-Type must be application/json or multipart/form-data")
    
    # Generate filename
    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif"
    }.get(mime_type, ".jpg")
    
    filename = f"{user_id}{ext}"
    filepath = UPLOAD_DIR / filename
    
    # Delete old avatar if exists (different extension)
    for old_file in UPLOAD_DIR.glob(f"{user_id}.*"):
        try:
            old_file.unlink()
        except:
            pass
    
    # Save new avatar
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    
    # Generate avatar URL
    avatar_url = f"/api/auth/avatar/{user_id}"
    
    # Update user record
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "avatar_url": avatar_url,
                "avatar_updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"Avatar uploaded for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "avatar_url": avatar_url,
        "message": "Avatar uploaded successfully"
    }


@router.get("/avatar/{user_id}")
async def get_avatar(user_id: str):
    """
    Get a user's avatar image.
    Returns the image file directly.
    """
    from fastapi.responses import FileResponse
    
    # Find avatar file
    for ext in [".jpg", ".png", ".webp", ".gif"]:
        filepath = UPLOAD_DIR / f"{user_id}{ext}"
        if filepath.exists():
            media_type = {
                ".jpg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif"
            }.get(ext, "image/jpeg")
            return FileResponse(filepath, media_type=media_type)
    
    # Return default avatar or 404
    raise HTTPException(status_code=404, detail="Avatar not found")


@router.delete("/avatar")
async def delete_avatar(request: Request):
    """
    Delete user's avatar and reset to default.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Delete avatar files
    for ext in [".jpg", ".png", ".webp", ".gif"]:
        filepath = UPLOAD_DIR / f"{user_id}{ext}"
        try:
            if filepath.exists():
                filepath.unlink()
        except:
            pass
    
    # Update user record
    await db.users.update_one(
        {"user_id": user_id},
        {"$unset": {"avatar_url": "", "avatar_updated_at": ""}}
    )
    
    logger.info(f"Avatar deleted for user: {user_id[:8]}...")
    
    return {
        "success": True,
        "message": "Avatar deleted successfully"
    }
