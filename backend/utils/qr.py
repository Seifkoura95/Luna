"""
QR Code utilities for Luna Group VIP API
Handles QR code generation and verification for rewards redemption
"""

import hmac
import hashlib
from datetime import datetime, timezone
from config import QR_SECRET


def generate_qr_code(redemption_id: str, user_id: str) -> str:
    """
    Generate a secure one-time use QR code
    
    Args:
        redemption_id: Unique redemption identifier
        user_id: User's unique identifier
    
    Returns:
        str: QR code string in format LUNA-{redemption_id[:8]}-{signature}
    """
    timestamp = int(datetime.now(timezone.utc).timestamp())
    data = f"{redemption_id}:{user_id}:{timestamp}"
    signature = hmac.new(QR_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:12]
    return f"LUNA-{redemption_id[:8].upper()}-{signature.upper()}"


def verify_qr_code(qr_code: str, redemption_id: str) -> bool:
    """
    Verify QR code is valid
    
    Args:
        qr_code: QR code string to verify
        redemption_id: Expected redemption ID
    
    Returns:
        bool: True if QR code is valid, False otherwise
    """
    if not qr_code.startswith("LUNA-"):
        return False
    parts = qr_code.split("-")
    if len(parts) != 3:
        return False
    return parts[1].lower() == redemption_id[:8].lower()
