# Luna Group - Subscription Perks Implementation Plan

## Overview
This document outlines how each subscription perk will be tracked, verified, and controlled across:
- **Mobile App** (User-facing)
- **Venue App/Portal** (Staff verification)
- **Lovable Dashboard** (Admin management)

---

## 1. ENTRY PERKS

### 1.1 Free Entry Before X Time (Bronze: 10pm, Silver: 11pm, Gold: All Night)

**How it works:**
- User shows QR code at venue entrance
- Staff scans QR → System checks:
  1. User's subscription tier
  2. Current time vs. tier's `free_entry_before_time`
  3. Whether it's a ticketed event (excluded)

**Database Schema:**
```python
# entry_logs collection
{
    "id": "entry_xxx",
    "user_id": "user_xxx",
    "venue_id": "eclipse",
    "entry_time": "2026-04-12T21:30:00Z",
    "entry_type": "free_member",  # free_member, paid, guest, comp
    "tier_at_entry": "silver",
    "verified_by": "staff_xxx",
    "event_id": null  # or event_id if ticketed
}
```

**API Endpoints Needed:**
- `POST /api/entry/verify` - Staff scans QR, returns eligibility
- `POST /api/entry/log` - Records the entry
- `GET /api/entry/history/{user_id}` - Admin view of entries

**Venue Portal UI:**
- Scan QR → Shows: "✅ SILVER MEMBER - Free Entry (before 11pm)"
- If after cutoff: "⚠️ SILVER MEMBER - Entry fee applies (after 11pm)"

**Lovable Dashboard:**
- View all entry logs
- Filter by venue, date, tier
- Export reports

---

### 1.2 Skip the Line / Express Entry (Silver & Gold)

**How it works:**
- Digital "Express Pass" shown in app
- Visual indicator for door staff
- Separate express queue at venue

**Implementation:**
- App shows animated "EXPRESS ENTRY" badge for Silver/Gold
- Badge includes QR code for verification
- Staff scans → Confirms express privilege

**Database:**
- No additional tracking needed (tier-based)
- Optional: Log express entries for analytics

---

### 1.3 Guest Entry (+1 for Gold)

**How it works:**
- Gold member can bring 1 guest free per visit
- Guest gets logged under member's account
- Limit: 1 guest per calendar day per venue

**Database Schema:**
```python
# guest_entries collection
{
    "id": "guest_xxx",
    "member_user_id": "user_xxx",
    "guest_name": "John Doe",  # Optional
    "venue_id": "eclipse",
    "entry_date": "2026-04-12",
    "entry_time": "2026-04-12T22:00:00Z",
    "verified_by": "staff_xxx"
}
```

**API Endpoints:**
- `POST /api/entry/guest` - Log guest entry
- `GET /api/entry/guest/remaining/{user_id}` - Check if guest slot used today
- `GET /api/entry/guest/history/{user_id}` - View guest history

**Verification Flow:**
1. Staff scans Gold member QR
2. System shows: "✅ GOLD MEMBER - +1 Guest Available Today"
3. Staff clicks "Add Guest" → Logs entry
4. If already used: "⚠️ Guest slot used today at [venue] at [time]"

**Lovable Dashboard:**
- View guest entry logs
- Set limits per tier (currently: Gold = 1)
- View abuse patterns

---

## 2. COMPLIMENTARY DRINKS

### 2.1 Free Drink Per Visit (Silver: excl. Saturdays, Gold: Every Night)

**How it works:**
- Member shows "Drink Voucher" in app
- Bar staff scans → Marks as redeemed
- Limit: 1 per venue per night

**Database Schema:**
```python
# drink_redemptions collection
{
    "id": "drink_xxx",
    "user_id": "user_xxx",
    "venue_id": "eclipse",
    "redemption_date": "2026-04-12",
    "redemption_time": "2026-04-12T23:15:00Z",
    "drink_type": "house_wine",  # Options based on tier
    "redeemed_by": "staff_xxx"
}
```

**API Endpoints:**
- `GET /api/drinks/voucher` - Get user's drink voucher status
- `POST /api/drinks/redeem` - Staff redeems drink
- `GET /api/drinks/history/{user_id}` - View redemption history

**App UI:**
- Shows "Complimentary Drink" card in Wallet
- Status: "Available" or "Redeemed tonight at [venue]"
- QR code for bar staff to scan

**Venue Portal:**
- Bar tab shows: "SILVER MEMBER - 1 Comp Drink"
- Saturday auto-disable for Silver
- Drink options dropdown (house wine, beer, soft drink)

**Lovable Dashboard:**
- Set drink options per tier
- Set day exclusions
- View redemption stats

---

### 2.2 Welcome Drink at Restaurants (Silver & Gold)

**How it works:**
- Host checks reservation against member database
- Marks welcome drink as "to be served"
- Server confirms delivery

**Database:**
```python
# reservation_perks collection
{
    "reservation_id": "res_xxx",
    "user_id": "user_xxx",
    "welcome_drink": {
        "eligible": true,
        "status": "pending",  # pending, served, declined
        "served_at": null,
        "served_by": null
    }
}
```

---

## 3. RESTAURANT DISCOUNTS

### 3.1 Food Discount (Bronze: 5% weeknights, Silver: 10% all, Gold: 15% all)

**How it works:**
- Member shows QR at payment
- POS integration OR manual verification
- Discount applied to food items only

**Implementation Options:**

**Option A: QR Verification (No POS Integration)**
```python
# discount_applications collection
{
    "id": "disc_xxx",
    "user_id": "user_xxx",
    "venue_id": "ember_and_ash",
    "bill_amount": 150.00,
    "discount_percent": 15,
    "discount_amount": 22.50,
    "final_amount": 127.50,
    "applied_at": "2026-04-12T20:30:00Z",
    "applied_by": "staff_xxx"
}
```

**Option B: POS Integration (Future)**
- API webhook from POS system
- Auto-apply discount based on member lookup

**API Endpoints:**
- `GET /api/discounts/eligibility` - Check user's discount
- `POST /api/discounts/apply` - Log discount application
- `GET /api/discounts/history/{user_id}` - View history

**Venue Portal:**
- Enter bill amount → Shows eligible discount
- Confirm application → Logs to system

**Day Restrictions (Bronze):**
- System checks if current day is Sun-Thu
- Friday/Saturday: No discount for Bronze

---

## 4. PRIORITY BOOKING

### 4.1 48-Hour Advance Booking (Silver & Gold)

**How it works:**
- Silver/Gold members see bookings 48hrs before public
- Booking system filters available slots by tier

**Implementation:**
```python
# In booking availability endpoint
def get_available_slots(user_tier, date):
    public_release = date - timedelta(hours=24)
    member_release = date - timedelta(hours=72)  # 48hr head start
    
    if user_tier in ['silver', 'gold']:
        if now >= member_release:
            return slots
    else:
        if now >= public_release:
            return slots
    return []
```

**Database:**
```python
# bookings collection - add field
{
    "booking_type": "priority_member",  # priority_member, public, waitlist
    "booked_during_priority": true
}
```

### 4.2 Guaranteed Table - No Waitlist (Gold)

**How it works:**
- Gold members bypass waitlist
- System reserves X tables for Gold daily

**Implementation:**
```python
# venue_config collection
{
    "venue_id": "ember_and_ash",
    "gold_reserved_tables": 2,
    "gold_reserved_until": "19:00"  # After this, released to public
}
```

---

## 5. SKY LOUNGE ACCESS (Gold Only)

**How it works:**
- Sky Lounge at Eclipse is Gold-exclusive area
- Staff verifies at lounge entrance
- Capacity managed separately

**Database:**
```python
# sky_lounge_entries collection
{
    "id": "sky_xxx",
    "user_id": "user_xxx",
    "entry_time": "2026-04-12T23:00:00Z",
    "exit_time": null,
    "verified_by": "staff_xxx"
}
```

**Venue Portal:**
- Dedicated "Sky Lounge" section
- Real-time capacity counter
- Quick member verification

---

## 6. VIP EVENTS ACCESS

### 6.1 Member-Only Events (Bronze+, Silver+, Gold+)

**How it works:**
- Events tagged with minimum tier requirement
- Ticket purchase restricted by tier
- QR verification at door

**Database Schema:**
```python
# events collection - add fields
{
    "min_tier_required": "silver",  # null = public
    "tier_exclusive": true,
    "tier_ticket_limits": {
        "gold": 2,
        "silver": 1
    }
}
```

**App UI:**
- Events show tier badge: "🥈 Silver+ Event"
- Non-eligible users see: "Upgrade to Silver to access"

---

## 7. POINTS SYSTEM

### 7.1 Points Multiplier (Bronze: 2x pre-purchase, Silver: 1.5x all, Gold: 2x all)

**Current Implementation:** ✅ Already in `/api/points/earn`

**Enhancement Needed:**
- Bronze 2x only on pre-purchased items
- Add `purchase_type` field to distinguish

```python
# points_transactions collection
{
    "user_id": "user_xxx",
    "amount_spent": 100.00,
    "purchase_type": "pre_purchase",  # pre_purchase, venue_spend, restaurant
    "base_points": 100,
    "multiplier": 2.0,
    "bonus_points": 100,
    "total_points": 200
}
```

### 7.2 Points Expiry (Bronze: Yes, Silver/Gold: Never)

**Implementation:**
```python
# Background job - runs daily
async def expire_bronze_points():
    expiry_date = datetime.now() - timedelta(days=365)
    bronze_users = await db.users.find({"tier": "bronze"})
    for user in bronze_users:
        # Expire points older than 1 year
        await db.points_transactions.update_many(
            {"user_id": user["user_id"], "created_at": {"$lt": expiry_date}, "expired": False},
            {"$set": {"expired": True}}
        )
```

---

## 8. BIRTHDAY PERKS

### 8.1 Birthday Surprise (All Tiers)

**Current Implementation:** ✅ Partially done in `/api/birthday`

**Enhancement:**
- Generate unique "Birthday Pass" valid for birthday week
- Pass shows at venue entrance
- Staff marks as "surprise delivered"

### 8.2 Birthday Dessert at Restaurants (All Tiers)

**Implementation:**
```python
# birthday_redemptions collection
{
    "user_id": "user_xxx",
    "year": 2026,
    "dessert_redeemed": true,
    "redeemed_at": "ember_and_ash",
    "redeemed_on": "2026-04-15"
}
```

---

## 9. CONCIERGE ACCESS

### 9.1 Member Contact Line (Silver)
- Dedicated phone/email for Silver members
- Display in app profile

### 9.2 WhatsApp Concierge (Gold)
- Direct WhatsApp line to concierge
- Integration with WhatsApp Business API

**Implementation:**
- Store WhatsApp number in config
- App shows "Message Concierge" button for Gold
- Link: `https://wa.me/61XXXXXXXXX?text=Hi, I'm Gold member [name]`

---

## 10. PHYSICAL ITEMS

### 10.1 Silver Wristband (Silver)
### 10.2 Premium Member Card (Gold)

**Implementation:**
```python
# member_items collection
{
    "user_id": "user_xxx",
    "item_type": "silver_wristband",  # silver_wristband, gold_card
    "status": "pending",  # pending, shipped, delivered
    "shipping_address": {...},
    "tracking_number": null,
    "ordered_at": "2026-04-12",
    "delivered_at": null
}
```

**Lovable Dashboard:**
- View pending item shipments
- Update tracking numbers
- Mark as delivered

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Critical - Week 1)
1. ✅ Entry verification with tier check
2. ✅ Guest entry tracking (+1 for Gold)
3. ✅ Drink redemption system
4. ✅ Restaurant discount verification

### Phase 2 (Important - Week 2)
5. Priority booking system
6. VIP events access control
7. Points expiry for Bronze

### Phase 3 (Enhancement - Week 3)
8. Sky Lounge access tracking
9. Birthday pass system
10. Concierge integration

### Phase 4 (Nice to Have - Week 4)
11. Physical item fulfillment
12. POS integration for discounts
13. Analytics dashboard

---

## API ENDPOINTS SUMMARY

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/entry/verify` | POST | Verify member entry eligibility |
| `/api/entry/log` | POST | Log venue entry |
| `/api/entry/guest` | POST | Log guest entry |
| `/api/entry/guest/remaining` | GET | Check guest slots |
| `/api/drinks/voucher` | GET | Get drink voucher status |
| `/api/drinks/redeem` | POST | Redeem complimentary drink |
| `/api/discounts/eligibility` | GET | Check discount eligibility |
| `/api/discounts/apply` | POST | Apply & log discount |
| `/api/perks/status` | GET | Get all perk statuses for user |
| `/api/admin/perks/config` | GET/PUT | Manage perk settings |

---

## LOVABLE DASHBOARD FEATURES

1. **Perk Configuration**
   - Edit tier benefits
   - Set day/time restrictions
   - Configure drink options

2. **Redemption Logs**
   - View all drink redemptions
   - View discount applications
   - View guest entries

3. **Analytics**
   - Most redeemed perks
   - Peak redemption times
   - Tier conversion drivers

4. **Abuse Detection**
   - Flag suspicious patterns
   - Multiple venue same-day redemptions
   - Guest entry abuse

---

## NEXT STEPS

Would you like me to implement Phase 1 now? This includes:
1. Entry verification system with QR scanning
2. Guest entry tracking for Gold members
3. Complimentary drink redemption
4. Restaurant discount verification

Each will have:
- Backend API endpoints
- Venue portal UI updates
- Lovable dashboard management
