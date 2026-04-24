"""
SwiftPOS PLU mapping — app events → SwiftPOS product codes.

All PLUs live under Sell Category "Bulk Beer" / Report Group "App Item".
Unit prices are *negative* when pushed to SwiftPOS (they cost the business).
Value rule: 10 points = $0.25 → $0.025 per point.

Quantity on the transaction line = multiplier (1 = normal, 2 = double points, ...).
"""
from typing import Optional

# Points economy
POINT_DOLLAR_VALUE = 0.025  # $0.025 per point

# ────── Mission PLUs ──────
MISSION_PLUS: dict[str, dict] = {
    "luna_explorer":     {"plu": "100251", "unit_price": 18.75, "name": "Luna Explorer"},
    "dine_and_dance":    {"plu": "100252", "unit_price": 10.00, "name": "Dine & Dance"},
    "luna_loyalist":     {"plu": "100253", "unit_price": 12.50, "name": "Luna Loyalist"},
    "weekend_warrior":   {"plu": "100254", "unit_price": 15.00, "name": "Weekend Warrior"},
    "social_butterfly":  {"plu": "110255", "unit_price": 20.00, "name": "Social Butterfly"},
}

# ────── Reward PLUs ──────
REWARD_PLUS: dict[str, dict] = {
    "complimentary_cocktail":  {"plu": "100256", "unit_price":  5.00, "name": "Complimentary Premium Cocktail"},
    "fast_lane":               {"plu": "100257", "unit_price":  7.50, "name": "Fast Lane Access"},
    "luna_credits":            {"plu": "100258", "unit_price": 15.00, "name": "Luna Credits"},
    "eclipse_vip_booth":       {"plu": "100259", "unit_price": 37.50, "name": "Eclipse VIP Booth / 4 Hours"},
    "premium_bottle_service":  {"plu": "100260", "unit_price": 20.00, "name": "Premium Bottle Service"},
    "after_dark_party_pack":   {"plu": "100261", "unit_price": 12.50, "name": "After Dark Party Package"},
    "night_mark_dining_100":   {"plu": "100262", "unit_price": 30.00, "name": "Night Mark Dining Credit $100"},
    "juju_rooftop":            {"plu": "100263", "unit_price": 50.00, "name": "Juju Rooftop Experience"},
    "drinks_pack_4":           {"plu": "100264", "unit_price":  8.75, "name": "Complimentary Drinks Pack of 4"},
    "luna_merch_pack":         {"plu": "100265", "unit_price": 11.25, "name": "Luna Group Merch Pack"},
}


def plu_for_mission(mission_id: str) -> Optional[dict]:
    return MISSION_PLUS.get(mission_id)


def plu_for_reward(reward_id: str) -> Optional[dict]:
    return REWARD_PLUS.get(reward_id)


def points_for_plu(unit_price: float, multiplier: int = 1) -> int:
    """How many points SwiftPOS will award for this line. Mirror of SwiftPOS math."""
    return int((unit_price * multiplier) / POINT_DOLLAR_VALUE)
