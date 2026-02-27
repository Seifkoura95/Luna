# Luna Group VIP API - Technical Specification

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Base URL:** `{REACT_APP_BACKEND_URL}/api`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [API Endpoints](#2-api-endpoints)
   - [Authentication & Users](#21-authentication--users)
   - [Venues](#22-venues)
   - [Bookings & Guestlist](#23-bookings--guestlist)
   - [Points & Rewards](#24-points--rewards)
   - [Missions & Achievements](#25-missions--achievements)
   - [Auctions & Bids](#26-auctions--bids)
   - [Subscriptions & Payments](#27-subscriptions--payments)
   - [Events](#28-events)
   - [Tickets](#29-tickets)
   - [Friends & Social](#210-friends--social)
   - [Notifications](#211-notifications)
   - [Referrals](#212-referrals)
   - [Venue Admin Dashboard](#213-venue-admin-dashboard)
3. [Data Models](#3-data-models)
4. [Real-Time Features](#4-real-time-features)
5. [File Storage](#5-file-storage)
6. [Environment & Configuration](#6-environment--configuration)

---

## 1. Authentication

### Authentication Method
- **Type:** JWT (JSON Web Token)
- **Algorithm:** HS256
- **Token Expiry:** 7 days
- **Header Format:** `Authorization: Bearer <token>`

### Token Payload Structure
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "exp": 1735689600
}
```

### User Roles
| Role | Access Level | Description |
|------|--------------|-------------|
| `user` | Standard | Regular app users |
| `venue_staff` | Elevated | Can scan QR codes, view basic dashboard |
| `venue_manager` | High | Full venue dashboard access, staff management |
| `admin` | Full | System-wide access |

### Authenticating API Requests
1. Obtain token via `/api/auth/login` or `/api/auth/register`
2. Include token in all subsequent requests:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. API Endpoints

### 2.1 Authentication & Users

#### Register New User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "phone": "+61400000000",
  "date_of_birth": "1995-06-15",
  "gender": "male",
  "address": "123 Main St",
  "city": "brisbane",
  "preferred_venues": ["eclipse", "su-casa-brisbane"],
  "referral_code": "JOHN1234"
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
    "created_at": "2025-12-01T00:00:00Z"
  },
  "token": "jwt-token-string",
  "verification_required": true,
  "message": "Please check your email to verify your account",
  "demo_verification_link": "https://..."
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "user": {
    "user_id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "tier": "bronze",
    "points_balance": 1500,
    "subscription_tier": "lunar"
  },
  "token": "jwt-token-string"
}
```

#### Get Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+61400000000",
  "date_of_birth": "1995-06-15",
  "age": 30,
  "gender": "male",
  "tier": "bronze",
  "points_balance": 1500,
  "subscription_tier": "eclipse",
  "total_visits": 15,
  "total_spend": 850.00,
  "favorite_venues": ["eclipse"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

#### Verify Email
```http
POST /api/auth/verify-email?token=<verification_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! Welcome to Luna Group.",
  "user_id": "uuid-string",
  "referral_bonus": "You and your friend each earned 10 points!"
}
```

#### Resend Verification Email
```http
POST /api/auth/resend-verification
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent",
  "demo_verification_link": "https://..."
}
```

---

### 2.2 Venues

#### Get All Venues
```http
GET /api/venues
GET /api/venues?region=brisbane
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `region` | string | Filter by region (brisbane, gold-coast) |

**Response:**
```json
[
  {
    "id": "eclipse",
    "name": "Eclipse Nightclub",
    "type": "nightclub",
    "region": "brisbane",
    "address": "123 Queen St, Brisbane",
    "status": "open",
    "image_url": "https://...",
    "features": ["rooftop", "vip_booths", "live_dj"]
  }
]
```

#### Get Single Venue
```http
GET /api/venues/{venue_id}
```

**Response:**
```json
{
  "id": "eclipse",
  "name": "Eclipse Nightclub",
  "type": "nightclub",
  "region": "brisbane",
  "address": "123 Queen St, Brisbane",
  "status": "busy",
  "description": "Brisbane's premier nightclub",
  "opening_hours": {
    "friday": "21:00-03:00",
    "saturday": "21:00-03:00"
  },
  "features": ["rooftop", "vip_booths", "live_dj"],
  "image_url": "https://..."
}
```

---

### 2.3 Bookings & Guestlist

#### Get Availability
```http
GET /api/bookings/availability?venue_id=eclipse&date=2025-12-20&party_size=4
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | string | Yes | Venue identifier |
| `date` | string | Yes | Date in YYYY-MM-DD format |
| `party_size` | int | No | Number of guests (default: 2) |

**Response:**
```json
{
  "venue_id": "eclipse",
  "venue_name": "Eclipse Nightclub",
  "date": "2025-12-20",
  "party_size": 4,
  "time_slots": [
    {"time": "21:00", "available": true, "spots": 50},
    {"time": "22:00", "available": true, "spots": 30},
    {"time": "23:00", "available": true, "spots": 20}
  ],
  "powered_by": "SevenRooms"
}
```

#### Create Reservation
```http
POST /api/bookings/reserve
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "venue_id": "su-casa-brisbane",
  "date": "2025-12-20",
  "time": "19:00",
  "party_size": 4,
  "special_requests": "Window seat preferred",
  "occasion": "birthday"
}
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "booking_id": "ABC12345",
    "venue_id": "su-casa-brisbane",
    "venue_name": "Su Casa Brisbane",
    "date": "2025-12-20",
    "time": "19:00",
    "party_size": 4,
    "status": "confirmed",
    "confirmation_code": "SR-ABC12345",
    "points_earned": 200
  },
  "message": "Your reservation at Su Casa Brisbane is confirmed!",
  "powered_by": "SevenRooms"
}
```

#### Add to Guestlist
```http
POST /api/bookings/guestlist
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "venue_id": "eclipse",
  "date": "2025-12-20",
  "party_size": 6,
  "arrival_time": "22:00",
  "vip_booth": true
}
```

**Response:**
```json
{
  "success": true,
  "guestlist": {
    "guestlist_id": "GL123456",
    "venue_id": "eclipse",
    "venue_name": "Eclipse Nightclub",
    "date": "2025-12-20",
    "party_size": 6,
    "status": "confirmed",
    "confirmation_code": "GL-GL123456",
    "entry_priority": "VIP",
    "points_earned": 100
  },
  "message": "You're on the list for Eclipse Nightclub! Show your QR code at the door."
}
```

#### Get My Reservations
```http
GET /api/bookings/my-reservations
Authorization: Bearer <token>
```

**Response:**
```json
{
  "bookings": [...],
  "guestlist": [...]
}
```

#### Cancel Booking
```http
DELETE /api/bookings/{booking_id}
Authorization: Bearer <token>
```

---

### 2.4 Points & Rewards

#### Get Points Balance
```http
GET /api/points/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "points_balance": 2500,
  "tier_id": "eclipse",
  "tier_name": "Eclipse",
  "multiplier": 1.5,
  "next_tier_points": 5000
}
```

#### Get Points History
```http
GET /api/points/history?limit=50
Authorization: Bearer <token>
```

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
    "amount_spent": 100.00,
    "created_at": "2025-12-01T20:00:00Z"
  }
]
```

#### Record Spending (Venue Staff Only)
```http
POST /api/points/record-spending
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "user_id": "target-user-uuid",
  "venue_id": "eclipse",
  "amount": 150.00,
  "category": "drinks"
}
```

**Categories:** `drinks`, `food`, `entry`, `booth`, `general`, `other`

#### Get Available Rewards
```http
GET /api/rewards
GET /api/rewards?category=drinks&venue_id=eclipse
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category |
| `venue_id` | string | Filter by venue availability |

**Response:**
```json
[
  {
    "id": "reward-001",
    "name": "Free Cocktail",
    "description": "Redeem for any house cocktail",
    "points_cost": 500,
    "category": "drinks",
    "venue_restriction": null,
    "is_active": true,
    "image_url": "https://..."
  }
]
```

#### Redeem Reward
```http
POST /api/rewards/redeem?reward_id=reward-001&venue_id=eclipse
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Reward redeemed successfully!",
  "redemption": {
    "id": "redemption-uuid",
    "reward_name": "Free Cocktail",
    "points_spent": 500,
    "validation_code": "ABC12345",
    "status": "pending",
    "expires_at": "2025-12-02T00:00:00Z"
  },
  "new_balance": 2000
}
```

#### Redeem with QR Code
```http
POST /api/rewards/redeem-with-qr?reward_id=reward-001&venue_id=eclipse
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Reward redeemed! Show QR code at venue.",
  "redemption": {...},
  "qr_code": "LUNA-ABC12345-XYZ",
  "new_balance": 2000
}
```

#### Get My Redemptions
```http
GET /api/redemptions/my
GET /api/redemptions/my?status=pending
Authorization: Bearer <token>
```

---

### 2.5 Missions & Achievements

#### Get Missions
```http
GET /api/missions
GET /api/missions?venue_id=eclipse
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "mission-001",
    "name": "Night Owl",
    "description": "Check in at 3 different venues this week",
    "points_reward": 500,
    "target": 3,
    "progress": 1,
    "completed": false,
    "claimed": false,
    "is_active": true,
    "venue_requirements": null,
    "expires_at": "2025-12-31T23:59:59Z"
  }
]
```

#### Update Mission Progress
```http
POST /api/missions/progress
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "mission_id": "mission-001",
  "progress_increment": 1
}
```

**Response:**
```json
{
  "message": "Progress updated",
  "progress": 2,
  "target": 3,
  "completed": false
}
```

#### Claim Mission Reward
```http
POST /api/missions/{mission_id}/claim
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Claimed 500 points!",
  "points_awarded": 500,
  "new_balance": 3000
}
```

---

### 2.6 Auctions & Bids

#### Get All Auctions
```http
GET /api/auctions
GET /api/auctions?venue_id=eclipse&status=active
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `venue_id` | string | Filter by venue |
| `status` | string | Filter by status (active, ended, draft) |

**Response:**
```json
[
  {
    "id": "AUCT001",
    "title": "VIP Booth Experience",
    "description": "Private booth for 8 people with bottle service",
    "image_url": "https://...",
    "starting_bid": 200,
    "current_bid": 450,
    "min_increment": 25,
    "max_bid_limit": 5000,
    "venue_id": "eclipse",
    "venue_name": "Eclipse Nightclub",
    "status": "active",
    "start_time": "2025-12-01T18:00:00Z",
    "end_time": "2025-12-20T23:59:59Z",
    "winner_id": "user-uuid",
    "winner_name": "John D."
  }
]
```

#### Get Auction Details
```http
GET /api/auctions/{auction_id}
```

**Response:**
```json
{
  "id": "AUCT001",
  "title": "VIP Booth Experience",
  "description": "...",
  "current_bid": 450,
  "total_bids": 12,
  "bid_history": [
    {
      "id": "bid-001",
      "user_name": "John D.",
      "amount": 450,
      "is_auto_bid": false,
      "timestamp": "2025-12-15T20:30:00Z"
    }
  ]
}
```

#### Place Bid
```http
POST /api/auctions/bid
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "auction_id": "AUCT001",
  "amount": 500,
  "max_bid": 750,
  "notify_outbid": true
}
```

**Response:**
```json
{
  "message": "Bid placed successfully!",
  "auction": {...},
  "auto_bid_active": true,
  "your_max_bid": 750,
  "final_amount": 500,
  "you_are_winning": true
}
```

#### Get Bid History
```http
GET /api/auctions/{auction_id}/bids
```

#### Subscribe to Auction Notifications
```http
POST /api/auctions/subscribe
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "auction_id": "AUCT001"
}
```

#### Get Auction Notifications
```http
GET /api/auctions/notifications
Authorization: Bearer <token>
```

---

### 2.7 Subscriptions & Payments

#### Get Subscription Tiers
```http
GET /api/subscriptions/tiers
```

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
      "points_multiplier": 1.0,
      "benefits": {
        "free_entries_per_month": 0,
        "free_drinks_before_10pm": 0,
        "priority_queue": false,
        "skip_the_line": false,
        "early_auction_access": false,
        "exclusive_auctions": false
      },
      "perks_list": [
        "Earn 1 point per $1 spent",
        "Access to all public auctions",
        "Digital membership card"
      ]
    },
    {
      "id": "eclipse",
      "name": "Eclipse",
      "price": 29.99,
      "billing_period": "monthly",
      "color": "#E31837",
      "points_multiplier": 1.5,
      "benefits": {...},
      "perks_list": [...]
    },
    {
      "id": "aurora",
      "name": "Aurora",
      "price": 79.99,
      "billing_period": "monthly",
      "color": "#D4AF37",
      "points_multiplier": 2.0,
      "benefits": {...},
      "perks_list": [...]
    }
  ],
  "entry_venues": ["eclipse", "afterdark", "su-casa-brisbane", "su-casa-gold-coast"]
}
```

#### Get My Subscription
```http
GET /api/subscriptions/my
Authorization: Bearer <token>
```

**Response:**
```json
{
  "subscription": {
    "id": "sub-123",
    "tier_id": "eclipse",
    "tier_name": "Eclipse",
    "price": 29.99,
    "status": "active",
    "current_period_start": "2025-12-01T00:00:00Z",
    "current_period_end": "2025-12-31T23:59:59Z",
    "free_entries_remaining": 2
  },
  "tier": {...},
  "is_subscribed": true
}
```

#### Subscribe to Tier
```http
POST /api/subscriptions/subscribe
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "tier_id": "eclipse",
  "payment_method_id": "pm_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Welcome to Eclipse!",
  "subscription": {...},
  "tier": {...},
  "points_earned": 30,
  "mock": true
}
```

#### Cancel Subscription
```http
POST /api/subscriptions/cancel
Authorization: Bearer <token>
```

#### Use Free Entry
```http
POST /api/subscriptions/use-entry?venue_id=eclipse
Authorization: Bearer <token>
```

---

### 2.8 Events

#### Get Events
```http
GET /api/events
GET /api/events?venue_id=eclipse&location=brisbane&limit=20&category=music
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `venue_id` | string | Filter by venue |
| `location` | string | brisbane or gold-coast (default: brisbane) |
| `limit` | int | Max results (default: 20, max: 50) |
| `category` | string | Event category filter |

**Response:**
```json
{
  "events": [
    {
      "id": "ef_12345",
      "title": "Saturday Night Live DJ Set",
      "description": "...",
      "venue_id": "eclipse",
      "venue_name": "Eclipse Nightclub",
      "event_date": "2025-12-20T22:00:00Z",
      "ticket_price": 25.00,
      "image_url": "https://...",
      "is_featured": true
    }
  ],
  "total": 15,
  "source": "eventfinda",
  "location": "brisbane"
}
```

#### Get Featured Events
```http
GET /api/events/featured?location=brisbane&limit=5
```

#### Get Tonight's Events
```http
GET /api/events/tonight?location=brisbane&limit=10
```

#### Get Weekend Events
```http
GET /api/events/weekend?location=brisbane&limit=20
```

#### Get Upcoming Events
```http
GET /api/events/upcoming?location=brisbane&limit=30
```

#### Get Events Feed (Luna Venues Only)
```http
GET /api/events/feed?limit=30
```

**Response:**
```json
{
  "tonight": [...],
  "tomorrow": [...],
  "featured": [...],
  "upcoming": [...],
  "total_count": 45,
  "source": "eventfinda_luna_filtered",
  "updated_at": "2025-12-15T12:00:00Z"
}
```

#### Search Events
```http
GET /api/events/search?q=dj&location=brisbane&limit=20
```

#### Get Event Details
```http
GET /api/events/{event_id}
```

#### RSVP to Event
```http
POST /api/events/{event_id}/rsvp
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "going"
}
```

**Status Options:** `going`, `interested`, `not_going`

#### Get Event Attendees
```http
GET /api/events/{event_id}/attendees
Authorization: Bearer <token>
```

---

### 2.9 Tickets

#### Get My Tickets
```http
GET /api/tickets
GET /api/tickets?status=active
Authorization: Bearer <token>
```

**Status Options:** `active`, `upcoming`, `history`

**Response:**
```json
{
  "active": [...],
  "upcoming": [
    {
      "id": "TKT12345",
      "event_id": "ef_12345",
      "event_title": "Saturday Night Live DJ Set",
      "venue_id": "eclipse",
      "venue_name": "Eclipse Nightclub",
      "event_date": "2025-12-20T22:00:00Z",
      "ticket_type": "general",
      "qr_code": "TKT-TKT12345-abc123",
      "status": "active",
      "guests": [],
      "price": 25.00
    }
  ],
  "history": [...]
}
```

#### Purchase Ticket
```http
POST /api/tickets/purchase
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "event_id": "ef_12345",
  "quantity": 2,
  "ticket_type": "general"
}
```

**Response:**
```json
{
  "success": true,
  "tickets": [...],
  "points_earned": 100,
  "message": "Successfully purchased 2 ticket(s)!"
}
```

#### Add Guest to Ticket
```http
POST /api/tickets/add-guest
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "ticket_id": "TKT12345",
  "guest_name": "Jane Smith",
  "guest_email": "jane@example.com"
}
```

#### Remove Guest
```http
DELETE /api/tickets/{ticket_id}/guest/{guest_id}
Authorization: Bearer <token>
```

---

### 2.10 Friends & Social

#### Get Friends List
```http
GET /api/friends
Authorization: Bearer <token>
```

**Response:**
```json
{
  "friends": [
    {
      "user_id": "friend-uuid",
      "name": "Jane Smith",
      "username": "janesmith",
      "avatar": "https://...",
      "tier": "eclipse"
    }
  ],
  "count": 5
}
```

#### Send Friend Request
```http
POST /api/friends/request
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "friend@example.com"
}
```
OR
```json
{
  "username": "janesmith"
}
```

#### Get Pending Friend Requests
```http
GET /api/friends/requests
Authorization: Bearer <token>
```

**Response:**
```json
{
  "incoming": [...],
  "outgoing": [...]
}
```

#### Accept Friend Request
```http
POST /api/friends/requests/{request_id}/accept
Authorization: Bearer <token>
```

#### Decline Friend Request
```http
POST /api/friends/requests/{request_id}/decline
Authorization: Bearer <token>
```

#### Remove Friend
```http
DELETE /api/friends/{friend_id}
Authorization: Bearer <token>
```

---

### 2.11 Notifications

#### Get Notifications
```http
GET /api/notifications
GET /api/notifications?unread_only=true&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "notif-001",
    "type": "auction",
    "title": "You've Been Outbid!",
    "message": "Someone bid $500 on VIP Booth Experience",
    "data": {"auction_id": "AUCT001", "new_bid": 500},
    "read": false,
    "created_at": "2025-12-15T20:30:00Z"
  }
]
```

#### Mark Notifications as Read
```http
POST /api/notifications/mark-read
Authorization: Bearer <token>
```

**Request Body (optional):**
```json
{
  "notification_ids": ["notif-001", "notif-002"]
}
```

#### Delete Notification
```http
DELETE /api/notifications/{notification_id}
Authorization: Bearer <token>
```

#### Get Notification Preferences
```http
GET /api/notifications/preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "event_reminders": true,
  "auction_updates": true,
  "friend_activity": true,
  "promotions": true,
  "safety_alerts": true,
  "favorite_venues": true
}
```

#### Update Notification Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "event_reminders": true,
  "auction_updates": false,
  "promotions": false
}
```

#### Register Push Token
```http
POST /api/notifications/register-push-token
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "token": "ExponentPushToken[xxxxxx]"
}
```

#### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

---

### 2.12 Referrals

#### Get My Referral Code
```http
GET /api/referral/code
Authorization: Bearer <token>
```

**Response:**
```json
{
  "referral_code": "JOHN1234",
  "referral_link": "https://lunagroup.app/join?ref=JOHN1234",
  "stats": {
    "successful_referrals": 5,
    "pending_referrals": 2,
    "total_points_earned": 50,
    "points_per_referral": 10
  }
}
```

#### Get Referral History
```http
GET /api/referral/history
Authorization: Bearer <token>
```

#### Apply Referral Code
```http
POST /api/referral/apply?referral_code=JANE5678
Authorization: Bearer <token>
```

---

### 2.13 Venue Admin Dashboard

**Note:** All venue admin endpoints require `venue_staff`, `venue_manager`, or `admin` role.

#### Scan QR Code (Redeem Reward)
```http
POST /api/venue/scan-qr
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "qr_code": "LUNA-ABC12345-XYZ",
  "venue_id": "eclipse"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reward redeemed successfully!",
  "reward_name": "Free Cocktail",
  "customer_name": "John Doe",
  "points_spent": 500,
  "redeemed_at": "2025-12-15T20:30:00Z"
}
```

#### Get Dashboard Overview
```http
GET /api/venue/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "stats": {
    "total_redemptions": 150,
    "today_redemptions": 12,
    "week_redemptions": 45,
    "pending_redemptions": 8,
    "unique_visitors": 89
  },
  "recent_redemptions": [...],
  "venue_id": "eclipse",
  "is_admin": false
}
```

#### Get Venue Redemptions
```http
GET /api/venue/redemptions?status=redeemed&limit=50&offset=0
Authorization: Bearer <token>
```

#### Get Venue Analytics
```http
GET /api/venue/analytics?period=week
Authorization: Bearer <token>
```

**Period Options:** `day`, `week`, `month`

**Response:**
```json
{
  "period": "week",
  "daily_stats": {
    "2025-12-14": {"count": 15, "points": 7500},
    "2025-12-15": {"count": 12, "points": 6000}
  },
  "top_rewards": [
    {"name": "Free Cocktail", "count": 25},
    {"name": "VIP Entry", "count": 10}
  ],
  "total_redemptions": 45,
  "total_points_redeemed": 22500
}
```

#### Get Revenue Analytics
```http
GET /api/venue/analytics/revenue?period=month
Authorization: Bearer <token>
```

#### Get Auction Analytics
```http
GET /api/venue/analytics/auctions?period=month
Authorization: Bearer <token>
```

#### Get Points Analytics
```http
GET /api/venue/analytics/points?period=month
Authorization: Bearer <token>
```

#### Register Venue Staff
```http
POST /api/venue/register-staff
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "staff@eclipse.com",
  "password": "securepassword",
  "name": "Staff Member",
  "venue_id": "eclipse",
  "role": "venue_staff"
}
```

**Role Options:** `venue_staff`, `venue_manager`

---

### 2.14 Venue Admin - Auction Management

#### Get All Auctions (Admin)
```http
GET /api/venue-admin/auctions?status=active&venue_id=eclipse&limit=50
Authorization: Bearer <token>
```

#### Create Auction
```http
POST /api/venue-admin/auctions
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "VIP Booth Package",
  "description": "Premium booth for 8 with bottle service",
  "image_url": "https://...",
  "starting_bid": 200,
  "min_increment": 25,
  "max_bid_limit": 5000,
  "duration_hours": 48,
  "venue_id": "eclipse",
  "category": "vip_experience",
  "terms": "Valid for 30 days from auction end",
  "publish_immediately": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auction 'VIP Booth Package' created successfully!",
  "auction": {
    "id": "AUCT002",
    "status": "draft",
    ...
  }
}
```

#### Get Auction Details (Admin)
```http
GET /api/venue-admin/auctions/{auction_id}
Authorization: Bearer <token>
```

#### Update Auction
```http
PUT /api/venue-admin/auctions/{auction_id}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "active",
  "duration_hours": 72
}
```

#### Publish Auction
```http
POST /api/venue-admin/auctions/{auction_id}/publish
Authorization: Bearer <token>
```

#### Unpublish Auction
```http
POST /api/venue-admin/auctions/{auction_id}/unpublish
Authorization: Bearer <token>
```

#### Delete Auction
```http
DELETE /api/venue-admin/auctions/{auction_id}
Authorization: Bearer <token>
```

**Note:** Can only delete auctions with no bids.

---

### 2.15 Venue Admin - User Analytics

#### Get All Users
```http
GET /api/venue-admin/users?search=john&tier=eclipse&sort_by=total_spend&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name, email, or phone |
| `tier` | string | Filter by subscription tier |
| `sort_by` | string | Sort field: `total_spend`, `visits`, `points`, `created`, `name` |
| `limit` | int | Results per page (default: 50) |
| `offset` | int | Pagination offset |

**Response:**
```json
{
  "total": 150,
  "users": [
    {
      "user_id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+61400000000",
      "date_of_birth": "1995-06-15",
      "age": 30,
      "gender": "male",
      "subscription_tier": "eclipse",
      "points_balance": 2500,
      "total_visits": 15,
      "total_spend": 850.00,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Get User Full Profile
```http
GET /api/venue-admin/users/{user_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+61400000000",
  "date_of_birth": "1995-06-15",
  "age": 30,
  "gender": "male",
  "analytics": {
    "total_spend": 850.00,
    "spending_by_category": {
      "drinks": 500,
      "food": 250,
      "entry": 100
    },
    "spending_by_venue": {
      "eclipse": 600,
      "su-casa-brisbane": 250
    },
    "total_visits": 15,
    "favorite_venue": "eclipse",
    "venue_visit_count": {
      "eclipse": 10,
      "su-casa-brisbane": 5
    },
    "points_earned": 1275,
    "points_spent": 500,
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

#### Update User Profile (Admin)
```http
PUT /api/venue-admin/users/{user_id}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "phone": "+61400000001",
  "subscription_tier": "aurora",
  "points_balance": 5000,
  "notes": "VIP customer"
}
```

#### Add Points to User
```http
POST /api/venue-admin/users/{user_id}/add-points?points=500&reason=Loyalty%20bonus
Authorization: Bearer <token>
```

---

## 3. Data Models

### 3.1 Users Collection

```javascript
{
  "_id": ObjectId,
  "user_id": "uuid-string",           // Primary identifier
  "email": "user@example.com",        // Unique, lowercase
  "hashed_password": "bcrypt-hash",
  "name": "John Doe",
  "phone": "+61400000000",            // Optional
  "date_of_birth": "1995-06-15",      // ISO format, optional
  "age": 30,                          // Calculated from DOB
  "gender": "male",                   // Optional: male, female, other, prefer_not_to_say
  "address": "123 Main St",           // Optional
  "city": "brisbane",                 // Optional
  "role": "user",                     // user, venue_staff, venue_manager, admin
  "venue_id": "eclipse",              // For staff accounts only
  "tier": "bronze",                   // Legacy tier field
  "subscription_tier": "eclipse",     // Current subscription tier
  "points_balance": 2500,
  "home_region": "brisbane",
  "favorite_venues": ["eclipse"],
  "preferred_venues": [],
  "friends": ["friend-user-id"],
  "referral_code": "JOHN1234",
  "referred_by": "referrer-user-id",
  "email_verified": true,
  "email_verification_token": null,
  "email_verification_expiry": null,
  "email_verified_at": ISODate,
  "push_token": "ExponentPushToken[xxx]",
  "push_tokens": ["token1", "token2"],
  "total_visits": 15,
  "total_spend": 850.00,
  "last_visit": ISODate,
  "visit_history": [],
  "notes": "Admin notes",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### 3.2 Auctions Collection

```javascript
{
  "_id": ObjectId,
  "id": "AUCT001",                    // Short ID for display
  "title": "VIP Booth Experience",
  "description": "Premium booth for 8",
  "image_url": "https://...",
  "starting_bid": 200,
  "current_bid": 450,
  "min_increment": 25,
  "max_bid_limit": 5000,
  "duration_hours": 48,
  "venue_id": "eclipse",
  "venue_name": "Eclipse Nightclub",
  "category": "vip_experience",       // vip_experience, drinks, entry, merch
  "terms": "Valid for 30 days",
  "status": "active",                 // draft, active, paused, ended, completed
  "start_time": ISODate,
  "end_time": ISODate,
  "winner_id": "user-uuid",
  "winner_name": "John D.",
  "last_bid_time": ISODate,
  "created_by": "admin-uuid",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### 3.3 Bids Collection

```javascript
{
  "_id": ObjectId,
  "id": "bid-uuid",
  "auction_id": "AUCT001",
  "user_id": "user-uuid",
  "user_name": "John Doe",
  "amount": 450,
  "max_bid": 750,                     // For auto-bidding, optional
  "notify_outbid": true,
  "is_auto_bid": false,
  "timestamp": ISODate
}
```

### 3.4 Bookings Collection

```javascript
{
  "_id": ObjectId,
  "booking_id": "ABC12345",
  "user_id": "user-uuid",
  "venue_id": "su-casa-brisbane",
  "venue_name": "Su Casa Brisbane",
  "date": "2025-12-20",
  "time": "19:00",
  "party_size": 4,
  "special_requests": "Window seat",
  "occasion": "birthday",
  "status": "confirmed",              // confirmed, pending, cancelled
  "confirmation_code": "SR-ABC12345",
  "points_earned": 200,
  "created_at": ISODate
}
```

### 3.5 Guestlist Collection

```javascript
{
  "_id": ObjectId,
  "guestlist_id": "GL123456",
  "user_id": "user-uuid",
  "venue_id": "eclipse",
  "venue_name": "Eclipse Nightclub",
  "date": "2025-12-20",
  "party_size": 6,
  "arrival_time": "22:00",
  "vip_booth": true,
  "status": "confirmed",
  "confirmation_code": "GL-GL123456",
  "entry_priority": "VIP",
  "points_earned": 100,
  "created_at": ISODate
}
```

### 3.6 Redemptions Collection

```javascript
{
  "_id": ObjectId,
  "id": "redemption-uuid",
  "user_id": "user-uuid",
  "reward_id": "reward-001",
  "reward_name": "Free Cocktail",
  "reward_description": "Any house cocktail",
  "reward_category": "drinks",
  "points_spent": 500,
  "venue_id": "eclipse",
  "venue_redeemed": "eclipse",
  "qr_code": "LUNA-ABC12345-XYZ",
  "validation_code": "ABC12345",
  "status": "pending",                // pending, redeemed, expired
  "redeemed_at": ISODate,
  "redeemed_by": "staff-uuid",
  "redeemed_venue": "eclipse",
  "created_at": ISODate,
  "expires_at": ISODate
}
```

### 3.7 Rewards Collection

```javascript
{
  "_id": ObjectId,
  "id": "reward-001",
  "name": "Free Cocktail",
  "description": "Redeem for any house cocktail",
  "points_cost": 500,
  "category": "drinks",               // drinks, food, entry, merch, experience
  "venue_restriction": null,          // null = all venues, or venue_id
  "is_active": true,
  "image_url": "https://...",
  "quantity_available": 100,
  "created_at": ISODate
}
```

### 3.8 Subscriptions Collection

```javascript
{
  "_id": ObjectId,
  "id": "sub-123",
  "user_id": "user-uuid",
  "tier_id": "eclipse",
  "tier_name": "Eclipse",
  "price": 29.99,
  "status": "active",                 // active, cancelled, expired
  "billing_period": "monthly",
  "current_period_start": ISODate,
  "current_period_end": ISODate,
  "free_entries_remaining": 2,
  "cancel_at_period_end": false,
  "cancelled_at": null,
  "mock": true,
  "created_at": ISODate
}
```

### 3.9 Points Transactions Collection

```javascript
{
  "_id": ObjectId,
  "id": "txn-123",
  "user_id": "user-uuid",
  "type": "earn",                     // earn, redeem, manual_adjustment
  "base_points": 100,
  "bonus_points": 50,
  "total_points": 150,
  "multiplier": 1.5,
  "source": "spending",               // spending, mission_reward, subscription, etc.
  "source_id": "spending-id",
  "amount_spent": 100.00,
  "description": "Spending at Eclipse",
  "venue_id": "eclipse",
  "created_at": ISODate
}
```

### 3.10 Spending Collection

```javascript
{
  "_id": ObjectId,
  "id": "spend-123",
  "user_id": "user-uuid",
  "venue_id": "eclipse",
  "amount": 150.00,
  "category": "drinks",               // drinks, food, entry, booth, general
  "recorded_by": "staff-uuid",
  "simulated": false,
  "created_at": ISODate
}
```

### 3.11 Notifications Collection

```javascript
{
  "_id": ObjectId,
  "id": "notif-001",
  "user_id": "user-uuid",
  "type": "auction",                  // auction, event, friend_request, referral, etc.
  "title": "You've Been Outbid!",
  "message": "Someone bid $500...",
  "body": "...",                      // Alternative to message
  "data": {
    "auction_id": "AUCT001",
    "action": "view_auction"
  },
  "priority": "high",                 // low, normal, medium, high
  "read": false,
  "read_at": null,
  "created_at": ISODate
}
```

### 3.12 Tickets Collection

```javascript
{
  "_id": ObjectId,
  "id": "TKT12345",
  "user_id": "user-uuid",
  "event_id": "ef_12345",
  "event_title": "Saturday Night DJ Set",
  "venue_id": "eclipse",
  "venue_name": "Eclipse Nightclub",
  "event_date": ISODate,
  "ticket_type": "general",           // general, vip, early_bird
  "qr_code": "TKT-TKT12345-abc123",
  "status": "active",                 // active, used, cancelled, expired
  "guests": [
    {
      "id": "guest-123",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "added_at": ISODate
    }
  ],
  "price": 25.00,
  "created_at": ISODate
}
```

### 3.13 Missions Collection

```javascript
{
  "_id": ObjectId,
  "id": "mission-001",
  "name": "Night Owl",
  "description": "Check in at 3 different venues",
  "points_reward": 500,
  "target": 3,
  "type": "checkin",
  "venue_requirements": null,         // null = any venue, or array of venue_ids
  "is_active": true,
  "expires_at": ISODate
}
```

### 3.14 Mission Progress Collection

```javascript
{
  "_id": ObjectId,
  "user_id": "user-uuid",
  "mission_id": "mission-001",
  "progress": 2,
  "completed": false,
  "claimed": false,
  "claimed_at": null,
  "updated_at": ISODate
}
```

### 3.15 Referrals Collection

```javascript
{
  "_id": ObjectId,
  "id": "ref-123",
  "referrer_user_id": "referrer-uuid",
  "referrer_name": "John Doe",
  "referred_user_id": "referred-uuid",
  "referred_name": "Jane Smith",
  "referral_code": "JOHN1234",
  "status": "pending",                // pending, completed
  "completed_at": null,
  "created_at": ISODate
}
```

### 3.16 Friend Requests Collection

```javascript
{
  "_id": ObjectId,
  "id": "freq-123",
  "from_user_id": "user-uuid-1",
  "from_name": "John Doe",
  "to_user_id": "user-uuid-2",
  "to_name": "Jane Smith",
  "status": "pending",                // pending, accepted, declined
  "accepted_at": null,
  "declined_at": null,
  "created_at": ISODate
}
```

---

## 4. Real-Time Features

### Push Notifications

The API uses Expo's push notification service for real-time alerts.

**Push Token Format:** `ExponentPushToken[xxxxxx...]`

**Notification Types:**
| Type | Trigger | Priority |
|------|---------|----------|
| `outbid` | User outbid in auction | High |
| `auto_bid_exhausted` | Auto-bid limit reached | High |
| `auction_ending` | Auction ending soon | Medium |
| `auction_won` | User won auction | High |
| `friend_request` | New friend request | Medium |
| `friend_accepted` | Friend request accepted | Medium |
| `event_reminder` | Event starting soon | High |
| `referral` | Referral completed | High |

**No WebSocket Support:** The current API uses polling and push notifications rather than WebSocket connections.

---

## 5. File Storage

### Image URLs
- Event images: Provided by Eventfinda API
- Auction images: External URLs stored in database
- User avatars: External URLs or UI Avatars service
- Venue images: Static URLs from Luna Group CDN

### QR Codes
- Format: `LUNA-{ID}-{SIGNATURE}`
- Generated server-side using HMAC-SHA256
- Valid for 48 hours after creation
- One-time use only

---

## 6. Environment & Configuration

### Base API URL
```
Production: https://owner-manual-docs.preview.emergentagent.com/api
```

### Required Environment Variables

**Backend (.env):**
```
MONGO_URL=mongodb://...
DB_NAME=luna_group
JWT_SECRET=your-secret-key
QR_SECRET=your-qr-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Configuration Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `JWT_EXPIRY_DAYS` | 7 | Token validity period |
| `EMAIL_VERIFICATION_EXPIRY_HOURS` | 24 | Email verification link validity |
| `REFERRAL_POINTS_REWARD` | 10 | Points awarded per referral |
| `POINTS_PER_DOLLAR` | 1 | Base points earning rate |
| `POINTS_PER_CHECKIN` | 5 | Points for venue check-in |
| `POINTS_PER_MISSION` | 25 | Default mission completion points |

### Subscription Tier Multipliers

| Tier | Price | Points Multiplier |
|------|-------|-------------------|
| Lunar | $0 | 1.0x |
| Eclipse | $29.99 | 1.5x |
| Aurora | $79.99 | 2.0x |

### Rate Limits
- No explicit rate limiting implemented
- Recommended: 100 requests/minute per user

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "detail": "Error message description"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Test Credentials

### Regular User
```
Email: luna@test.com
Password: test123
```

### Venue Staff/Manager
```
Email: venue@eclipse.com
Password: venue123
```

---

*Document generated from Luna Group VIP API codebase analysis*
