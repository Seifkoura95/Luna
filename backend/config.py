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
# 10 points per $1 spent. Points redeem at 10 pts = $0.25 (25% cashback advertised).
POINTS_PER_DOLLAR = 10
POINTS_REDEEM_CENTS = 25  # 10 pts = 25 cents
POINTS_PER_CHECKIN = 5
POINTS_PER_MISSION = 25

# Venues that charge entry
ENTRY_CHARGING_VENUES = ["eclipse", "afterdark", "su-casa-brisbane", "su-casa-gold-coast"]

# Subscription Tiers - Luna Group Membership Structure
SUBSCRIPTION_TIERS = {
    "bronze": {
        "id": "bronze",
        "name": "Bronze",
        "price": 0,
        "billing_period": "monthly",
        "color": "#CD7F32",
        "icon": "bronze",
        "points_multiplier": 1.0,
        "benefits": {
            "free_entry_before_time": "10pm",
            "free_entries_per_month": 0,
            "skip_the_line": False,
            "priority_booking": False,
            "complimentary_drink": False,
            "guest_entry": 0,
            "sky_lounge_access": False,
            "reserved_section": False,
            "restaurant_discount": 5,
            "restaurant_discount_days": "weeknights",
            "birthday_dessert": True,
            "birthday_surprise": True,
            "private_events_access": False,
            "concierge_access": False,
            "points_expire": True,
        },
        "description": "Free membership with great perks",
        "perks_list": [
            "Free entry before 10pm (excludes ticketed events)",
            "Birthday surprise (shown at door)",
            "Early access to event announcements",
            "Points earned on every spend",
            "5% off food on weeknights (Sun-Thu)",
            "Complimentary birthday dessert",
            "Points earned on every spend",
            "Access to member pre-sale tickets",
            "Access to Bronze members only parties",
        ],
        "nightclub_perks": [
            "Free entry before 10pm (excludes ticketed events)",
            "Birthday surprise (shown at door)",
            "Early access to event announcements before public release",
            "1x points on all purchases",
        ],
        "restaurant_perks": [
            "5% off food on weeknights (Sunday – Thursday)",
            "Complimentary birthday dessert",
        ],
        "general_perks": [
            "Points earned on every spend across all Luna venues",
            "Access to member-only pre-sale tickets for events",
            "Access to Bronze members only parties",
        ]
    },
    "silver": {
        "id": "silver",
        "name": "Silver",
        "price": 39.99,
        "billing_period": "monthly",
        "color": "#C0C0C0",
        "icon": "silver",
        "points_multiplier": 1.5,
        "benefits": {
            "free_entry_before_time": "11pm",
            "free_entries_per_month": 999,
            "skip_the_line": True,
            "priority_booking": True,
            "complimentary_drink": True,
            "complimentary_drink_excludes": "Saturdays",
            "guest_entry": 0,
            "sky_lounge_access": False,
            "reserved_section": False,
            "restaurant_discount": 10,
            "restaurant_discount_days": "all",
            "welcome_drink": True,
            "birthday_dessert": True,
            "birthday_surprise": True,
            "private_events_access": True,
            "concierge_access": True,
            "points_expire": False,
            "silver_wristband": True,
        },
        "description": "Premium nightlife experience",
        "perks_list": [
            "Express entry – skip the queue entirely",
            "Free entry before 11pm (excludes ticketed events)",
            "10% discount on pre-purchased items",
            "Complimentary beverage every night (except Saturdays)",
            "Invitations to Silver/Gold-only events",
            "Complimentary Silver Eclipse Wristband",
            "10% off total bill any day at restaurants",
            "Complimentary welcome drink on arrival",
            "Priority table reservation (48hr advance)",
            "1.5x accelerated points earning",
            "Points never expire",
            "Dedicated member contact line",
        ],
        "nightclub_perks": [
            "Express entry every visit (skip the queue entirely)",
            "Free entry before 11pm (excludes ticketed events)",
            "10% discount on pre-purchased items (tickets, booths)",
            "Complimentary beverage every night excluding Saturdays",
            "Invitations to Silver/Gold-only events and themed nights",
            "Complimentary Silver Eclipse Wristband",
        ],
        "restaurant_perks": [
            "10% off total bill any day of the week",
            "Complimentary welcome drink on arrival (house wine/beer/soft drink)",
            "Priority table reservation (48-hour advance booking access before public)",
            "Access to members-only dining events or chef's table evenings",
        ],
        "general_perks": [
            "Accelerated points earning (1.5x on all spend)",
            "Points never expire",
            "Dedicated member contact line for bookings/enquiries",
        ]
    },
    "gold": {
        "id": "gold",
        "name": "Gold",
        "price": 79.99,
        "billing_period": "monthly",
        "color": "#FFD700",
        "icon": "gold",
        "points_multiplier": 2.0,
        "benefits": {
            "free_entry_before_time": "all_night",
            "free_entries_per_month": 999,
            "skip_the_line": True,
            "priority_booking": True,
            "complimentary_drink": True,
            "complimentary_drink_excludes": None,
            "guest_entry": 1,
            "sky_lounge_access": True,
            "reserved_section": True,
            "restaurant_discount": 15,
            "restaurant_discount_days": "all",
            "welcome_drink": True,
            "birthday_dessert": True,
            "birthday_surprise": True,
            "private_events_access": True,
            "concierge_access": True,
            "whatsapp_concierge": True,
            "points_expire": False,
            "anniversary_bonus": True,
            "premium_member_card": True,
            "early_holiday_booking": True,
        },
        "description": "Ultimate VIP treatment at all Luna venues",
        "perks_list": [
            "Unlimited free entry every night (subject to availability)",
            "Complimentary Sky Lounge access at Eclipse",
            "Reserved section/booth access (guaranteed with booking)",
            "Complimentary beverage at each venue every night",
            "Complimentary entry for 1 guest per visit",
            "Exclusive Gold member-only events",
            "First access to artist/DJ bookings",
            "15% off total bill at restaurants, any time",
            "Guaranteed table reservation – no waitlist",
            "Exclusive dining experiences invitation",
            "2x points on all spend",
            "Annual bonus points on membership anniversary",
            "Personalised premium member card",
            "Direct WhatsApp/concierge line",
            "Early access to NYE & holiday bookings",
        ],
        "nightclub_perks": [
            "Unlimited free entry every night, no booking required (subject to availability)",
            "Complimentary Sky Lounge access at Eclipse",
            "Reserved section or booth access (guaranteed on key nights with booking)",
            "Complimentary beverage at each venue every night",
            "Complimentary entry for 1 guest per visit",
            "Exclusive Gold member-only events (pre-season parties, artist meet & greets, launch nights)",
            "First access to artist/DJ bookings before anyone else",
        ],
        "restaurant_perks": [
            "15% off total bill, any time, any day",
            "Complimentary welcome drink",
            "Guaranteed table reservation – no waitlist",
            "Invitation to exclusive dining experiences (degustation evenings, new menu previews)",
            "Complimentary dessert",
        ],
        "general_perks": [
            "2x points on all spend",
            "Annual bonus points credit on membership anniversary",
            "Personalised member card (physical, premium feel)",
            "Direct WhatsApp or concierge line for all Luna venues",
            "Early access to New Year's Eve, special event, and public holiday bookings",
        ]
    }
}
