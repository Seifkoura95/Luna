# Luna Group VIP API - Technical Specification

**Version:** 1.0  
**Base URL:** `https://fastapi-restructure-3.preview.emergentagent.com/api`  
**Last Updated:** February 2025

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [API Endpoints](#2-api-endpoints)
3. [Data Models](#3-data-models)
4. [Real-Time Features](#4-real-time-features)
5. [File Storage](#5-file-storage)
6. [Environment & Config](#6-environment--config)

---

## 1. AUTHENTICATION

### Authentication Method
- **Type:** JWT (JSON Web Token)
- **Algorithm:** HS256
- **Token Expiry:** 7 days
- **Header Format:** `Authorization: Bearer <token>`

### JWT Token Payload Structure
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "exp": 1709251200  // Unix timestamp
}
```

### How to Authenticate
1. Call `POST /api/auth/login` with email and password
2. Receive token in response
3. Include token in all subsequent requests: `Authorization: Bearer <token>`

### User Roles
| Role | Description | Access Level |
|------|-------------|--------------|
| `user` | Regular app user | Standard features |
| `venue_staff` | Venue employee | QR scanning, basic dashboard |
| `venue_manager` | Venue manager | Full dashboard, auction management |
| `admin` | System administrator | All features, all venues |

---

## 2. API ENDPOINTS

### 2.1 Authentication & Users

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "phone": "+61400000000",           // optional
  "date_of_birth": "1995-05-15",     // optional, ISO format
  "gender": "male",                   // optional
  "address": "123 Main St",           // optional
  "city": "Brisbane",                 // optional
  "preferred_venues": ["eclipse"],    // optional
  "referral_code": "LUNA123"          // optional
}
```

**Response:**
```json
{
  "user": {
    "user_id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "bronze",
    "points_balance": 500,
    "email_verified": false,
    "created_at": "2025-02-27T10:00:00Z"
  },
  "token": "jwt-token-string",
  "verification_required": true,
  "message": "Please check your email to verify your account"
}
```

#### POST /api/auth/login
Authenticate user and get token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "user_id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "bronze",
    "points_balance": 1500,
    "subscription_tier": "eclipse",
    "role": null
  },
  "token": "jwt-token-string"
}
```

#### GET /api/auth/me
Get current authenticated user profile.

**Auth Required:** Yes

**Response:**
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+61400000000",
  "date_of_birth": "1995-05-15",
  "age": 29,
  "gender": "male",
  "tier": "bronze",
  "points_balance": 1500,
  "subscription_tier": "eclipse",
  "home_region": "brisbane",
  "favorite_venues": ["eclipse", "su_casa_brisbane"],
  "total_visits": 15,
  "total_spend": 2500.00,
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### POST /api/auth/verify-email
Verify email with token.

**Query Params:** `token=verification-token`

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully!",
  "user_id": "uuid-string"
}
```

#### DELETE /api/user/delete
Delete user account (GDPR compliance).

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### 2.2 Venues

#### GET /api/venues
Get all venues.

**Query Params:**
- `region` (optional): Filter by region (brisbane, gold_coast)

**Response:**
```json
[
  {
    "id": "eclipse",
    "name": "Eclipse",
    "type": "nightclub",
    "region": "brisbane",
    "location": "Fortitude Valley, Brisbane",
    "address": "247 Brunswick St, Fortitude Valley QLD 4006",
    "coordinates": {"lat": -27.4572, "lng": 153.0347},
    "accent_color": "#E31837",
    "tagline": "Discover New Nightlife",
    "logo_url": "https://...",
    "image_url": "https://...",
    "description": "Brisbane's transformative super club...",
    "features": ["booth_booking", "fast_lane", "auctions", "photos"],
    "points_rate": 1.0,
    "operating_hours": {
      "friday": "9:00 PM - 3:00 AM",
      "saturday": "9:00 PM - 3:00 AM"
    },
    "music_genres": ["Hip Hop", "RnB", "House"],
    "dress_code": "Smart casual to upscale",
    "age_restriction": "18+"
  }
]
```

#### GET /api/venues/{venue_id}
Get single venue details with live status.

**Response:**
```json
{
  "id": "eclipse",
  "name": "Eclipse",
  "status": "busy",  // open, busy, closed
  // ... all venue fields
}
```

#### GET /api/venues/{venue_id}/tables
Get available VIP tables.

**Response:**
```json
[
  {
    "id": "eclipse-vip-1",
    "name": "VIP Booth 1",
    "capacity": 8,
    "min_spend": 500,
    "deposit_required": 200,
    "position": "Main Room",
    "features": ["Private area", "Dedicated waitress"],
    "image_url": "https://...",
    "available_dates": ["2025-03-01", "2025-03-08"]
  }
]
```

---

### 2.3 Events

#### GET /api/events
Get events from Eventfinda.

**Query Params:**
- `venue_id` (optional): Filter by venue
- `location` (optional): City name, default "brisbane"
- `limit` (optional): Max results, default 20
- `category` (optional): Event category

**Response:**
```json
{
  "events": [
    {
      "id": "ef_123456",
      "title": "Saturday Night Live",
      "venue_id": "eclipse",
      "venue_name": "Eclipse",
      "date": "2025-03-01",
      "time": "21:00",
      "description": "Weekly party event...",
      "image_url": "https://...",
      "ticket_url": "https://...",
      "is_featured": true
    }
  ],
  "total": 25,
  "source": "eventfinda"
}
```

#### GET /api/events/tonight
Get events happening tonight.

#### GET /api/events/weekend
Get events this weekend.

#### GET /api/events/feed
Get Luna Group venue events feed.

**Response:**
```json
{
  "tonight": [...],
  "tomorrow": [...],
  "featured": [...],
  "upcoming": [...],
  "total_count": 45
}
```

#### POST /api/events/{event_id}/rsvp
RSVP to an event.

**Auth Required:** Yes

**Request Body:**
```json
{
  "status": "going"  // going, interested, not_going
}
```

#### GET /api/events/{event_id}/attendees
Get event attendees (respects privacy settings).

**Auth Required:** Yes

---

### 2.4 Auctions & Bids

#### GET /api/auctions
Get all auctions.

**Query Params:**
- `venue_id` (optional): Filter by venue
- `status` (optional): active, ended, draft

**Response:**
```json
[
  {
    "id": "AUC001",
    "title": "VIP Booth Experience",
    "description": "Premium booth for 8 guests...",
    "image_url": "https://...",
    "venue_id": "eclipse",
    "venue_name": "Eclipse",
    "category": "vip_experience",
    "starting_bid": 100,
    "current_bid": 350,
    "min_increment": 10,
    "max_bid_limit": 5000,
    "status": "active",
    "start_time": "2025-02-27T18:00:00Z",
    "end_time": "2025-02-28T18:00:00Z",
    "winner_id": null,
    "winner_name": null,
    "total_bids": 12
  }
]
```

#### GET /api/auctions/{auction_id}
Get auction details with bid history.

#### POST /api/auctions/bid
Place a bid.

**Auth Required:** Yes

**Request Body:**
```json
{
  "auction_id": "AUC001",
  "amount": 400,
  "max_bid": 600,        // optional, for auto-bidding
  "notify_outbid": true  // optional, default true
}
```

**Response:**
```json
{
  "message": "Bid placed successfully!",
  "auction": {...},
  "auto_bid_active": true,
  "your_max_bid": 600,
  "final_amount": 400,
  "you_are_winning": true
}
```

#### GET /api/auctions/{auction_id}/bids
Get bid history.

#### POST /api/auctions/subscribe
Subscribe to auction notifications.

**Auth Required:** Yes

**Request Body:**
```json
{
  "auction_id": "AUC001"
}
```

#### GET /api/auctions/notifications
Get user's auction notifications.

**Auth Required:** Yes

---

### 2.5 Points & Rewards

#### GET /api/points/balance
Get user's points balance.

**Auth Required:** Yes

**Response:**
```json
{
  "points_balance": 1500,
  "tier_id": "eclipse",
  "tier_name": "Eclipse",
  "multiplier": 1.5,
  "next_tier_points": 5000
}
```

#### GET /api/points/history
Get points transaction history.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": "txn123",
    "type": "earn",
    "base_points": 100,
    "bonus_points": 50,
    "total_points": 150,
    "multiplier": 1.5,
    "source": "spending",
    "description": "Purchase at Eclipse",
    "created_at": "2025-02-27T10:00:00Z"
  }
]
```

#### POST /api/points/simulate-purchase
Simulate purchase for testing.

**Auth Required:** Yes

**Query Params:**
- `amount`: Purchase amount
- `venue_id` (optional): Venue ID

#### GET /api/rewards
Get available rewards.

**Query Params:**
- `category` (optional): Filter by category
- `venue_id` (optional): Filter by venue

**Response:**
```json
[
  {
    "id": "reward123",
    "name": "Free Drink",
    "description": "One complimentary drink",
    "points_cost": 500,
    "category": "drinks",
    "image_url": "https://...",
    "venue_restriction": null,
    "is_active": true
  }
]
```

#### POST /api/rewards/redeem-with-qr
Redeem reward and get QR code.

**Auth Required:** Yes

**Query Params:**
- `reward_id`: Reward to redeem
- `venue_id` (optional): Venue for redemption

**Response:**
```json
{
  "success": true,
  "message": "Reward redeemed! Show QR code at venue.",
  "redemption": {
    "id": "red123",
    "reward_name": "Free Drink",
    "qr_code": "LUNA-RED123AB-SIGNATURE",
    "status": "pending",
    "expires_at": "2025-03-01T00:00:00Z"
  },
  "new_balance": 1000
}
```

#### GET /api/redemptions/my
Get user's redemptions.

**Auth Required:** Yes

---

### 2.6 Missions & Achievements

#### GET /api/missions
Get available missions with progress.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": "mission1",
    "name": "First Timer",
    "description": "Visit your first Luna venue",
    "points_reward": 100,
    "target": 1,
    "progress": 0,
    "completed": false,
    "claimed": false,
    "icon": "star",
    "is_active": true
  }
]
```

#### POST /api/missions/progress
Update mission progress.

**Auth Required:** Yes

**Request Body:**
```json
{
  "mission_id": "mission1",
  "progress_increment": 1
}
```

#### POST /api/missions/{mission_id}/claim
Claim mission reward.

**Auth Required:** Yes

---

### 2.7 Subscriptions

#### GET /api/subscriptions/tiers
Get all subscription tiers.

**Response:**
```json
{
  "tiers": [
    {
      "id": "lunar",
      "name": "Lunar",
      "price": 0,
      "billing_period": "monthly",
      "color": "#C0C0C0",
      "benefits": {
        "points_multiplier": 1.0,
        "free_entries_per_month": 0,
        "priority_queue": false,
        "skip_the_line": false
      },
      "perks_list": ["Earn 1 point per $1 spent", "..."]
    },
    {
      "id": "eclipse",
      "name": "Eclipse",
      "price": 29.99,
      "benefits": {
        "points_multiplier": 1.5,
        "free_entries_per_month": 2,
        "priority_queue": true
      }
    },
    {
      "id": "aurora",
      "name": "Aurora",
      "price": 79.99,
      "benefits": {
        "points_multiplier": 2.0,
        "free_entries_per_month": 999,
        "skip_the_line": true
      }
    }
  ]
}
```

#### GET /api/subscriptions/my
Get current user's subscription.

**Auth Required:** Yes

#### POST /api/subscriptions/subscribe
Subscribe to a tier.

**Auth Required:** Yes

**Request Body:**
```json
{
  "tier_id": "eclipse"
}
```

#### POST /api/subscriptions/cancel
Cancel subscription.

**Auth Required:** Yes

#### POST /api/subscriptions/use-entry
Use free entry benefit.

**Auth Required:** Yes

**Query Params:**
- `venue_id`: Venue to enter

---

### 2.8 Bookings

#### GET /api/bookings/availability
Check table availability.

**Query Params:**
- `venue_id`: Venue ID
- `date`: Date (YYYY-MM-DD)
- `party_size` (optional): Number of guests

**Response:**
```json
{
  "venue_id": "eclipse",
  "venue_name": "Eclipse",
  "date": "2025-03-01",
  "time_slots": [
    {"time": "21:00", "available": true, "spots": 50},
    {"time": "22:00", "available": true, "spots": 30}
  ]
}
```

#### POST /api/bookings/reserve
Create restaurant reservation.

**Auth Required:** Yes

**Request Body:**
```json
{
  "venue_id": "juju",
  "date": "2025-03-01",
  "time": "19:00",
  "party_size": 4,
  "special_requests": "Window seat preferred",
  "occasion": "birthday"
}
```

#### POST /api/bookings/guestlist
Add to nightclub guestlist.

**Auth Required:** Yes

**Request Body:**
```json
{
  "venue_id": "eclipse",
  "date": "2025-03-01",
  "party_size": 4,
  "arrival_time": "22:00",
  "vip_booth": false
}
```

#### POST /api/bookings/table
Book VIP table.

**Auth Required:** Yes

**Request Body:**
```json
{
  "venue_id": "eclipse",
  "date": "2025-03-01",
  "time": "22:00",
  "guests": 6
}
```

#### POST /api/bookings/table/{booking_id}/deposit
Pay table deposit.

**Auth Required:** Yes

**Request Body:**
```json
{
  "booking_id": "book123",
  "amount": 200
}
```

#### GET /api/bookings/my-reservations
Get user's bookings.

**Auth Required:** Yes

#### GET /api/bookings/my-tables
Get user's table bookings.

**Auth Required:** Yes

---

### 2.9 Tickets

#### GET /api/tickets
Get user's tickets.

**Auth Required:** Yes

**Response:**
```json
{
  "active": [...],
  "upcoming": [...],
  "history": [...]
}
```

#### POST /api/tickets/purchase
Purchase event ticket.

**Auth Required:** Yes

**Request Body:**
```json
{
  "event_id": "event123",
  "quantity": 2,
  "ticket_type": "general"
}
```

#### POST /api/tickets/add-guest
Add guest to ticket.

**Auth Required:** Yes

**Request Body:**
```json
{
  "ticket_id": "tkt123",
  "guest_name": "Jane Doe",
  "guest_email": "jane@example.com"
}
```

---

### 2.10 Friends & Social

#### GET /api/friends
Get user's friends list.

**Auth Required:** Yes

**Response:**
```json
{
  "friends": [
    {
      "user_id": "uuid",
      "name": "Jane Doe",
      "avatar": "https://...",
      "tier": "eclipse"
    }
  ],
  "count": 5
}
```

#### POST /api/friends/request
Send friend request.

**Auth Required:** Yes

**Request Body:**
```json
{
  "email": "friend@example.com"
}
// OR
{
  "username": "janedoe"
}
```

#### GET /api/friends/requests
Get pending friend requests.

**Auth Required:** Yes

#### POST /api/friends/requests/{request_id}/accept
Accept friend request.

**Auth Required:** Yes

#### POST /api/friends/requests/{request_id}/decline
Decline friend request.

**Auth Required:** Yes

#### DELETE /api/friends/{friend_id}
Remove friend.

**Auth Required:** Yes

#### GET /api/friends/activity
Get friends' activity feed.

**Auth Required:** Yes

---

### 2.11 Safety & Emergency

#### POST /api/safety/alert
Send safety alert.

**Auth Required:** Yes

**Request Body:**
```json
{
  "alert_type": "emergency",  // emergency, uncomfortable, need_help, lost
  "latitude": -27.4572,
  "longitude": 153.0347,
  "venue_id": "eclipse"
}
```

#### POST /api/safety/silent-alert
Send silent distress signal.

**Auth Required:** Yes

**Request Body:**
```json
{
  "latitude": -27.4572,
  "longitude": 153.0347,
  "venue_id": "eclipse",
  "activation_method": "shake"  // button, shake, hidden
}
```

#### GET /api/safety/alerts/active
Get active alerts (staff only).

**Auth Required:** Yes (venue_staff+)

#### POST /api/safety/alerts/{alert_id}/acknowledge
Acknowledge alert (staff only).

**Auth Required:** Yes (venue_staff+)

#### POST /api/safety/alerts/{alert_id}/resolve
Resolve alert (staff only).

**Auth Required:** Yes (venue_staff+)

#### GET /api/safety/emergency-contacts
Get user's emergency contacts.

**Auth Required:** Yes

#### POST /api/safety/emergency-contacts
Add emergency contact.

**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "Mom",
  "phone": "+61400000000",
  "relationship": "family",
  "email": "mom@example.com"
}
```

#### DELETE /api/safety/emergency-contacts/{contact_id}
Remove emergency contact.

**Auth Required:** Yes

---

### 2.12 Lost & Found

#### POST /api/lost-found/report-lost
Report lost item.

**Auth Required:** Yes

**Request Body:**
```json
{
  "venue_id": "eclipse",
  "item_description": "Black leather wallet",
  "date_lost": "2025-02-27",
  "contact_phone": "+61400000000"
}
```

#### POST /api/lost-found/report-found
Report found item (staff).

**Auth Required:** Yes (venue_staff+)

#### GET /api/lost-found/my-reports
Get user's lost item reports.

**Auth Required:** Yes

#### GET /api/lost-found/venue/{venue_id}
Get venue's found items.

**Auth Required:** Yes

#### POST /api/lost-found/{item_id}/claim
Claim found item.

**Auth Required:** Yes

---

### 2.13 Notifications

#### GET /api/notifications
Get user's notifications.

**Auth Required:** Yes

**Query Params:**
- `unread_only` (optional): boolean

**Response:**
```json
[
  {
    "id": "notif123",
    "type": "auction",
    "title": "You've been outbid!",
    "message": "Someone bid $400 on VIP Booth",
    "data": {"auction_id": "AUC001"},
    "read": false,
    "created_at": "2025-02-27T10:00:00Z"
  }
]
```

#### POST /api/notifications/mark-read
Mark notifications as read.

**Auth Required:** Yes

**Request Body:**
```json
{
  "notification_ids": ["notif123", "notif456"]  // optional, marks all if empty
}
```

#### POST /api/notifications/register-push-token
Register device for push notifications.

**Auth Required:** Yes

**Request Body:**
```json
{
  "token": "ExponentPushToken[xxx]"
}
```

#### GET /api/notifications/preferences
Get notification preferences.

**Auth Required:** Yes

#### PUT /api/notifications/preferences
Update notification preferences.

**Auth Required:** Yes

**Request Body:**
```json
{
  "event_reminders": true,
  "auction_updates": true,
  "friend_activity": true,
  "promotions": false,
  "safety_alerts": true
}
```

---

### 2.14 Payments (Stripe)

#### GET /api/payments/publishable-key
Get Stripe publishable key.

**Response:**
```json
{
  "publishable_key": "pk_test_..."
}
```

#### POST /api/payments/create-payment-intent
Create payment intent.

**Auth Required:** Yes

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "aud",
  "description": "VIP Table Deposit"
}
```

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "payment_intent_id": "pi_xxx"
}
```

#### POST /api/payments/confirm-bid
Confirm winning auction bid payment.

**Auth Required:** Yes

#### POST /api/payments/webhook
Stripe webhook handler.

---

### 2.15 Referrals

#### GET /api/referral/code
Get user's referral code.

**Auth Required:** Yes

**Response:**
```json
{
  "referral_code": "LUNA123ABC",
  "referral_link": "https://lunagroup.app/join?ref=LUNA123ABC",
  "stats": {
    "successful_referrals": 5,
    "pending_referrals": 2,
    "total_points_earned": 50,
    "points_per_referral": 10
  }
}
```

#### GET /api/referral/history
Get referral history.

**Auth Required:** Yes

#### POST /api/referral/apply
Apply referral code.

**Auth Required:** Yes

**Query Params:**
- `referral_code`: Code to apply

---

### 2.16 Promo Codes & Vouchers

#### POST /api/promo/apply
Apply promo code.

**Auth Required:** Yes

**Request Body:**
```json
{
  "promo_code": "WELCOME20"
}
```

#### GET /api/promo/validate/{code}
Validate promo code without applying.

#### GET /api/vouchers
Get user's vouchers.

**Auth Required:** Yes

---

### 2.17 Venue Admin (Dashboard)

#### GET /api/venue/dashboard
Get venue dashboard data.

**Auth Required:** Yes (venue_staff+)

**Response:**
```json
{
  "stats": {
    "total_redemptions": 150,
    "today_redemptions": 12,
    "week_redemptions": 85,
    "pending_redemptions": 5,
    "unique_visitors": 234
  },
  "recent_redemptions": [...],
  "venue_id": "eclipse",
  "is_admin": false
}
```

#### POST /api/venue/scan-qr
Scan and validate QR code.

**Auth Required:** Yes (venue_staff+)

**Request Body:**
```json
{
  "qr_code": "LUNA-RED123AB-SIGNATURE",
  "venue_id": "eclipse"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reward redeemed successfully!",
  "reward_name": "Free Drink",
  "customer_name": "John Doe",
  "points_spent": 500
}
```

#### GET /api/venue/analytics
Get venue analytics.

**Auth Required:** Yes (venue_staff+)

**Query Params:**
- `period`: day, week, month

#### GET /api/venue/analytics/revenue
Get revenue analytics.

**Auth Required:** Yes (venue_staff+)

#### GET /api/venue/analytics/auctions
Get auction analytics.

**Auth Required:** Yes (venue_staff+)

#### GET /api/venue/analytics/points
Get points analytics.

**Auth Required:** Yes (venue_staff+)

---

### 2.18 Venue Admin - Auction Management

#### GET /api/venue-admin/auctions
Get all auctions for management.

**Auth Required:** Yes (venue_staff+)

#### POST /api/venue-admin/auctions
Create new auction.

**Auth Required:** Yes (venue_staff+)

**Request Body:**
```json
{
  "title": "VIP Booth Experience",
  "description": "Premium booth for 8 guests",
  "image_url": "https://...",
  "starting_bid": 100,
  "min_increment": 10,
  "max_bid_limit": 5000,
  "duration_hours": 24,
  "venue_id": "eclipse",
  "category": "vip_experience",
  "terms": "Must be redeemed within 30 days",
  "publish_immediately": false
}
```

#### GET /api/venue-admin/auctions/{auction_id}
Get auction details for editing.

**Auth Required:** Yes (venue_staff+)

#### PUT /api/venue-admin/auctions/{auction_id}
Update auction.

**Auth Required:** Yes (venue_staff+)

**Request Body:**
```json
{
  "title": "Updated Title",
  "status": "active"
  // Any field can be updated
}
```

#### POST /api/venue-admin/auctions/{auction_id}/publish
Publish draft auction.

**Auth Required:** Yes (venue_staff+)

#### POST /api/venue-admin/auctions/{auction_id}/unpublish
Unpublish auction (no bids only).

**Auth Required:** Yes (venue_staff+)

#### DELETE /api/venue-admin/auctions/{auction_id}
Delete auction (no bids only).

**Auth Required:** Yes (venue_manager+)

---

### 2.19 Venue Admin - User Management

#### GET /api/venue-admin/users
Get all users with analytics.

**Auth Required:** Yes (venue_staff+)

**Query Params:**
- `search` (optional): Search by name, email, phone
- `tier` (optional): Filter by subscription tier
- `sort_by` (optional): total_spend, visits, points, created, name
- `limit` (optional): default 50
- `offset` (optional): default 0

**Response:**
```json
{
  "total": 2500,
  "users": [
    {
      "user_id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+61400000000",
      "age": 29,
      "subscription_tier": "eclipse",
      "points_balance": 1500,
      "total_spend": 2500,
      "total_visits": 15,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### GET /api/venue-admin/users/{user_id}
Get comprehensive user profile.

**Auth Required:** Yes (venue_staff+)

**Response:**
```json
{
  "user_id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+61400000000",
  "date_of_birth": "1995-05-15",
  "age": 29,
  "gender": "male",
  "address": "123 Main St",
  "city": "Brisbane",
  "subscription_tier": "eclipse",
  "points_balance": 1500,
  "created_at": "2025-01-15T10:00:00Z",
  "analytics": {
    "total_spend": 2500,
    "spending_by_category": {
      "drinks": 1500,
      "food": 500,
      "entry": 500
    },
    "spending_by_venue": {
      "eclipse": 2000,
      "su_casa_brisbane": 500
    },
    "total_visits": 15,
    "favorite_venue": "eclipse",
    "venue_visit_count": {
      "eclipse": 10,
      "su_casa_brisbane": 5
    },
    "points_earned": 3000,
    "points_spent": 1500,
    "total_redemptions": 3,
    "total_bids": 8,
    "auctions_won": 2,
    "tickets_purchased": 5
  },
  "history": {
    "recent_spending": [...],
    "recent_redemptions": [...],
    "recent_bookings": [...],
    "recent_bids": [...],
    "recent_points": [...]
  },
  "subscription": {...}
}
```

#### PUT /api/venue-admin/users/{user_id}
Update user profile.

**Auth Required:** Yes (venue_manager+)

#### POST /api/venue-admin/users/{user_id}/add-points
Manually adjust user points.

**Auth Required:** Yes (venue_manager+)

**Query Params:**
- `points`: Number of points (+/-)
- `reason` (optional): Reason for adjustment

---

### 2.20 CherryHub Integration (Membership)

#### POST /api/cherryhub/register
Link CherryHub membership.

**Auth Required:** Yes

**Request Body:**
```json
{
  "cherryhub_id": "CH123456"
}
```

#### GET /api/cherryhub/status
Get CherryHub sync status.

**Auth Required:** Yes

#### GET /api/cherryhub/points
Get points from CherryHub.

**Auth Required:** Yes

#### POST /api/cherryhub/buy-points
Purchase CherryHub points.

**Auth Required:** Yes

---

## 3. DATA MODELS

### 3.1 Users Collection

**Collection Name:** `users`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | string (UUID) | Yes | Primary identifier |
| email | string | Yes | Unique, lowercase |
| hashed_password | string | Yes | bcrypt hash |
| name | string | Yes | Display name |
| phone | string | No | Phone number |
| date_of_birth | string | No | ISO date format |
| age | integer | No | Calculated from DOB |
| gender | string | No | male/female/other |
| address | string | No | Street address |
| city | string | No | City name |
| tier | string | Yes | bronze/silver/gold |
| points_balance | integer | Yes | Current points |
| subscription_tier | string | No | lunar/eclipse/aurora |
| home_region | string | Yes | brisbane/gold_coast |
| favorite_venues | array | Yes | List of venue IDs |
| preferred_venues | array | No | User preferences |
| friends | array | No | List of user IDs |
| role | string | No | null/venue_staff/venue_manager/admin |
| venue_id | string | No | Assigned venue (staff only) |
| referral_code | string | No | Unique referral code |
| referred_by | string | No | Referrer user_id |
| email_verified | boolean | Yes | Email verification status |
| email_verification_token | string | No | Temporary token |
| push_token | string | No | Expo push token |
| push_tokens | array | No | All registered tokens |
| total_visits | integer | No | Visit counter |
| total_spend | float | No | Lifetime spend |
| last_visit | datetime | No | Last check-in |
| visit_history | array | No | Visit records |
| created_at | datetime | Yes | Account creation |
| updated_at | datetime | No | Last update |

**Indexes:**
- `email` (unique)
- `user_id` (unique)
- `referral_code` (unique, sparse)

---

### 3.2 Auctions Collection

**Collection Name:** `auctions`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Auction ID (8 chars) |
| title | string | Yes | Auction title |
| description | string | No | Full description |
| image_url | string | No | Item image |
| starting_bid | float | Yes | Initial bid |
| current_bid | float | Yes | Highest bid |
| min_increment | float | Yes | Minimum bid increase |
| max_bid_limit | float | No | Maximum allowed bid |
| duration_hours | integer | Yes | Auction duration |
| venue_id | string | Yes | Host venue |
| venue_name | string | Yes | Venue display name |
| category | string | No | vip_experience/bottle_service/etc |
| terms | string | No | Terms & conditions |
| status | string | Yes | draft/active/paused/ended |
| start_time | datetime | No | When auction started |
| end_time | datetime | No | When auction ends |
| winner_id | string | No | Winning user ID |
| winner_name | string | No | Winner display name |
| created_by | string | Yes | Creator user ID |
| created_at | datetime | Yes | Creation timestamp |
| updated_at | datetime | Yes | Last update |

**Indexes:**
- `id` (unique)
- `status`
- `venue_id`

---

### 3.3 Bids Collection

**Collection Name:** `bids`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Bid ID |
| auction_id | string | Yes | Parent auction |
| user_id | string | Yes | Bidder |
| user_name | string | Yes | Bidder name |
| amount | float | Yes | Bid amount |
| max_bid | float | No | Auto-bid maximum |
| is_auto_bid | boolean | No | Was this auto-placed |
| notify_outbid | boolean | No | Send notifications |
| timestamp | datetime | Yes | When placed |

**Indexes:**
- `auction_id`
- `user_id`

---

### 3.4 Rewards Collection

**Collection Name:** `rewards`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Reward ID |
| name | string | Yes | Reward name |
| description | string | No | Description |
| points_cost | integer | Yes | Points required |
| category | string | Yes | drinks/food/entry/etc |
| image_url | string | No | Reward image |
| venue_restriction | string | No | Specific venue only |
| is_active | boolean | Yes | Available for redemption |
| quantity_limit | integer | No | Stock limit |
| expires_at | datetime | No | Expiration date |

---

### 3.5 Redemptions Collection

**Collection Name:** `redemptions`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Redemption ID |
| user_id | string | Yes | User who redeemed |
| reward_id | string | Yes | Redeemed reward |
| reward_name | string | Yes | Reward name copy |
| reward_description | string | No | Description copy |
| points_spent | integer | Yes | Points used |
| venue_id | string | No | Target venue |
| qr_code | string | Yes | Unique QR code |
| status | string | Yes | pending/redeemed/expired |
| created_at | datetime | Yes | When redeemed |
| expires_at | datetime | Yes | QR expiration |
| redeemed_at | datetime | No | When scanned |
| redeemed_by | string | No | Staff who scanned |
| redeemed_venue | string | No | Venue scanned at |

---

### 3.6 Subscriptions Collection

**Collection Name:** `subscriptions`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Subscription ID |
| user_id | string | Yes | Subscriber |
| tier_id | string | Yes | lunar/eclipse/aurora |
| tier_name | string | Yes | Display name |
| price | float | Yes | Monthly price |
| status | string | Yes | active/cancelled/expired |
| billing_period | string | Yes | monthly/annual |
| current_period_start | datetime | Yes | Period start |
| current_period_end | datetime | Yes | Period end |
| free_entries_remaining | integer | Yes | Entries left this month |
| stripe_subscription_id | string | No | Stripe reference |
| cancelled_at | datetime | No | Cancellation date |
| cancel_at_period_end | boolean | No | Cancel flag |
| created_at | datetime | Yes | Creation date |

---

### 3.7 Points Transactions Collection

**Collection Name:** `points_transactions`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Transaction ID |
| user_id | string | Yes | User |
| type | string | Yes | earn/redeem/deduct |
| base_points | integer | No | Base points earned |
| bonus_points | integer | No | Multiplier bonus |
| total_points | integer | Yes | Net points change |
| multiplier | float | No | Applied multiplier |
| source | string | Yes | spending/mission/referral/etc |
| source_id | string | No | Reference ID |
| description | string | No | Human-readable |
| amount_spent | float | No | Purchase amount |
| venue_id | string | No | Associated venue |
| created_at | datetime | Yes | Transaction time |

---

### 3.8 Bookings Collection

**Collection Name:** `bookings`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| booking_id | string | Yes | Unique booking ID |
| user_id | string | Yes | User who booked |
| venue_id | string | Yes | Venue |
| venue_name | string | Yes | Venue name |
| date | string | Yes | Booking date |
| time | string | Yes | Booking time |
| party_size | integer | Yes | Number of guests |
| special_requests | string | No | Notes |
| occasion | string | No | birthday/anniversary/etc |
| status | string | Yes | confirmed/cancelled |
| confirmation_code | string | Yes | Reference code |
| points_earned | integer | No | Points for booking |
| created_at | datetime | Yes | When booked |

---

### 3.9 Safety Alerts Collection

**Collection Name:** `safety_alerts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Alert ID |
| user_id | string | Yes | User who triggered |
| alert_type | string | Yes | emergency/uncomfortable/etc |
| latitude | float | Yes | Location |
| longitude | float | Yes | Location |
| venue_id | string | No | Nearby venue |
| status | string | Yes | active/acknowledged/resolved |
| is_silent | boolean | No | Silent alert flag |
| activation_method | string | No | button/shake/hidden |
| created_at | datetime | Yes | When triggered |
| acknowledged_at | datetime | No | Staff response |
| acknowledged_by | string | No | Staff user_id |
| resolved_at | datetime | No | Resolution time |
| resolved_by | string | No | Resolver user_id |
| notes | string | No | Resolution notes |

---

### 3.10 Notifications Collection

**Collection Name:** `notifications`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Notification ID |
| user_id | string | Yes | Recipient |
| type | string | Yes | event/auction/friend/etc |
| title | string | Yes | Notification title |
| message | string | Yes | Body text |
| data | object | No | Additional payload |
| priority | string | No | normal/high |
| read | boolean | Yes | Read status |
| read_at | datetime | No | When read |
| created_at | datetime | Yes | When created |

---

## 4. REAL-TIME FEATURES

### Current Implementation
The app currently uses **polling** for real-time updates, not WebSockets.

### Push Notifications
- **Provider:** Expo Push Notifications
- **Token Format:** `ExponentPushToken[xxxxxx]`
- **Events that trigger push:**
  - Outbid on auction
  - Friend request received/accepted
  - Safety alert nearby
  - Event reminder
  - Reward expiring soon
  - Auction ending soon

### Polling Endpoints
For real-time-like updates, poll these endpoints:
- `GET /api/notifications` - Check for new notifications
- `GET /api/auctions/{id}` - Get current bid
- `GET /api/friends/requests` - Check friend requests
- `GET /api/safety/alerts/active` - Active safety alerts (staff)

---

## 5. FILE STORAGE

### Image Storage
- **Location:** Static files served from `/app/static/photos/`
- **URL Pattern:** `/api/photos/image/{folder}/{filename}`
- **Supported Folders:**
  - `eclipse` - Eclipse venue photos
  - `afterdark` - After Dark photos
  - `sucasa-brisbane` - Su Casa Brisbane photos
  - `sucasa-goldcoast` - Su Casa Gold Coast photos

### Accessing Photos

#### GET /api/photos/venues
Get all venue galleries with counts.

**Response:**
```json
[
  {
    "venue_id": "eclipse",
    "venue_name": "Eclipse",
    "folder": "eclipse",
    "photo_count": 45,
    "cover_image": "/api/photos/image/eclipse/photo1.jpg",
    "accent_color": "#E31837"
  }
]
```

#### GET /api/photos/venue/{venue_id}
Get all photos for a venue.

#### GET /api/photos/image/{folder}/{filename}
Get actual image file.

**Response Headers:**
- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=86400`

### Video Storage

#### GET /api/video/background
Get background video for app.

**Response:** MP4 video file

### External Image URLs
Many images are stored externally:
- Venue logos: `https://customer-assets.emergentagent.com/...`
- Event images: From Eventfinda CDN
- User avatars: External URLs

---

## 6. ENVIRONMENT & CONFIG

### Base API URL
```
Production: https://[your-domain]/api
Preview: https://fastapi-restructure-3.preview.emergentagent.com/api
```

### Required Environment Variables

#### Backend (.env)
```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=luna_group_vip

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
QR_SECRET=your-qr-secret-key

# Stripe (optional, for payments)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# CherryHub Integration (optional)
CHERRYHUB_API_KEY=xxx
CHERRYHUB_BASE_URL=https://api.cherryhub.com.au
MOCK_MODE=true  # Set to false for live integration

# External APIs
EVENTFINDA_API_KEY=xxx
```

### Rate Limits
Currently no rate limiting implemented at the application level.
Infrastructure may impose limits.

### CORS
All origins allowed in development.
Configure for production deployment.

### Authentication Notes
- Tokens expire after 7 days
- Include `Authorization: Bearer <token>` header
- 401 response means token invalid/expired
- 403 response means insufficient permissions

---

## Quick Reference

### Common Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid data) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 500 | Server Error |

### Venue IDs
- `eclipse` - Eclipse Nightclub
- `after_dark` - After Dark
- `su_casa_brisbane` - Su Casa Brisbane
- `su_casa_gold_coast` - Su Casa Gold Coast
- `juju` - Juju Mermaid Beach
- `night_market` - Night Market
- `ember_and_ash` - Ember & Ash

### Subscription Tiers
- `lunar` - Free ($0/mo)
- `eclipse` - $29.99/mo
- `aurora` - $79.99/mo

### User Roles
- `null` - Regular user
- `venue_staff` - Can scan QR, view basic dashboard
- `venue_manager` - Full dashboard access, auction management
- `admin` - All access, all venues

---

*Document generated: February 2025*
*API Version: 1.0*
