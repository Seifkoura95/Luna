"""
Configuration constants for Luna Group VIP API
"""

import os

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'luna-jwt-secret-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# QR Code Configuration
QR_SECRET = os.environ.get('QR_SECRET', 'luna-group-vip-2024')

# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_demo_key')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_demo_key')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_demo_secret')

# Email Configuration
EMAIL_VERIFICATION_EXPIRY_HOURS = 24

# Referral Configuration
REFERRAL_POINTS_REWARD = 10

# Points Configuration
POINTS_PER_DOLLAR = 1
POINTS_PER_CHECKIN = 5
POINTS_PER_MISSION = 25

# Venues that charge entry
ENTRY_CHARGING_VENUES = ["eclipse", "afterdark", "su-casa-brisbane", "su-casa-gold-coast"]

# Subscription Tiers
SUBSCRIPTION_TIERS = {
    "lunar": {
        "id": "lunar",
        "name": "Lunar",
        "price": 0,
        "billing_period": "monthly",
        "color": "#C0C0C0",
        "points_multiplier": 1.0,
        "benefits": {
            "free_entries_per_month": 0,
            "free_drinks_before_10pm": 0,
            "priority_queue": False,
            "skip_the_line": False,
            "early_auction_access": False,
            "exclusive_auctions": False,
            "birthday_booth_upgrade": False,
            "birthday_free_booth": False,
            "coat_check": False,
            "priority_booking": False,
            "private_events_access": False,
        },
        "description": "Basic access to Luna Group venues",
        "perks_list": [
            "Earn 1 point per $1 spent",
            "Access to all public auctions",
            "Digital membership card",
            "Event notifications",
        ]
    },
    "eclipse": {
        "id": "eclipse",
        "name": "Eclipse",
        "price": 29.99,
        "billing_period": "monthly",
        "color": "#E31837",
        "points_multiplier": 1.5,
        "benefits": {
            "free_entries_per_month": 2,
            "free_drinks_before_10pm": 1,
            "priority_queue": True,
            "skip_the_line": False,
            "early_auction_access": True,
            "exclusive_auctions": False,
            "birthday_booth_upgrade": True,
            "birthday_free_booth": False,
            "coat_check": False,
            "priority_booking": False,
            "private_events_access": False,
        },
        "description": "Enhanced nightlife experience",
        "perks_list": [
            "Earn 1.5x points on all spending",
            "2 free venue entries per month",
            "1 complimentary drink before 10 PM",
            "Priority queue access",
            "Early access to auctions",
            "Birthday booth upgrade",
        ]
    },
    "aurora": {
        "id": "aurora",
        "name": "Aurora",
        "price": 79.99,
        "billing_period": "monthly",
        "color": "#D4AF37",
        "points_multiplier": 2.0,
        "benefits": {
            "free_entries_per_month": 999,
            "free_drinks_before_10pm": 2,
            "priority_queue": True,
            "skip_the_line": True,
            "early_auction_access": True,
            "exclusive_auctions": True,
            "birthday_booth_upgrade": False,
            "birthday_free_booth": True,
            "coat_check": True,
            "priority_booking": True,
            "private_events_access": True,
        },
        "description": "VIP treatment at all Luna venues",
        "perks_list": [
            "Earn 2x points on all spending",
            "Unlimited free venue entries",
            "2 complimentary drinks before 10 PM",
            "Skip the line at all venues",
            "Priority booking",
            "Exclusive VIP-only auctions",
            "Free birthday booth (up to 6 people)",
            "Free coat check",
            "Access to private member events",
        ]
    }
}
