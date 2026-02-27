# Luna Group VIP App - Owner's Manual

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Application:** Luna Group VIP Hospitality Operating System

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Application Overview](#2-application-overview)
3. [Mobile App - User-Facing Features](#3-mobile-app---user-facing-features)
4. [Venue Portal - Staff Dashboard](#4-venue-portal---staff-dashboard)
5. [Technical Architecture](#5-technical-architecture)
6. [Third-Party Integrations](#6-third-party-integrations)
7. [Database Structure](#7-database-structure)
8. [Administrator Guide](#8-administrator-guide)
9. [Troubleshooting](#9-troubleshooting)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Introduction

### What is Luna Group VIP?

Luna Group VIP is a comprehensive mobile application designed for the Luna Group hospitality business. It serves as a premium VIP operating system for nightclub and hospitality venues including:

- **Eclipse** (Brisbane)
- **After Dark** (Brisbane)
- **Su Casa Brisbane** (Brisbane)
- **Su Casa Gold Coast** (Gold Coast)
- **Juju Mermaid Beach** (Gold Coast)
- **Ember & Ash** (Coming Soon)
- **Night Market Brisbane** (Brisbane)

### Core Value Proposition

The app provides a complete loyalty ecosystem that:
- Rewards customers for spending and engagement
- Drives repeat visits through gamification (missions, milestones, badges)
- Enables VIP experiences through auctions and table bookings
- Provides venue staff with real-time analytics and customer management tools

---

## 2. Application Overview

### Technology Stack

| Component | Technology |
|-----------|------------|
| Mobile App | Expo React Native (iOS & Android) |
| Web Portal | React + Vite + TypeScript |
| Backend | FastAPI (Python) |
| Database | MongoDB |
| Authentication | JWT-based + Google OAuth |
| Events Data | Eventfinda API |
| Loyalty System | CherryHub Integration |

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     USERS                                    │
├──────────────────────┬──────────────────────────────────────┤
│   Mobile App         │        Venue Portal (Web)            │
│   (Expo React Native)│        (React + Vite)                │
└──────────┬───────────┴───────────────────┬──────────────────┘
           │                               │
           └───────────┬───────────────────┘
                       ▼
           ┌───────────────────────┐
           │   FastAPI Backend     │
           │   (/api endpoints)    │
           └───────────┬───────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  MongoDB    │ │ Eventfinda  │ │  CherryHub  │
│  Database   │ │    API      │ │    API      │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

## 3. Mobile App - User-Facing Features

### 3.1 Home Screen (`/app/(tabs)/index.tsx`)

The home screen is the main hub of the app, featuring:

**Components:**
- **Luna Group Logo** - Centered at the top
- **Live Status Indicator** - Shows "LIVE NOW" (green pulsing dot) when venues are open (8PM-4AM Brisbane time) or "Opens Tonight at 8PM" when closed
- **Featured Event Hero** - Large card showcasing the most popular upcoming event
- **Trending Events Grid** - 4 trending events in a 2x2 grid with ranking numbers
- **What's On Section** - List view of upcoming events with thumbnails
- **Venues Carousel** - Horizontally scrolling cards for all Luna Group venues
- **Friends Activity Card** - Shows friends heading out tonight

**Data Sources:**
- Events: Eventfinda API (filtered to Luna Group venues only)
- Venues: Static venue data from backend

---

### 3.2 Events & Calendar (`/app/events.tsx`, `/app/event/[id].tsx`)

**Events List Page:**
- Displays all events at Luna Group venues
- Timeline filter tabs: Tonight, Tomorrow, This Weekend, Upcoming
- Search functionality
- Each event card shows: image, title, venue, date/time, price

**Event Detail Page:**
- Full event information
- Event image with gradient overlay
- Venue location and timing
- "Book Tickets" button (links to Eventfinda for purchase)
- RSVP functionality (Going, Interested, Not Going)
- Points earned for attending

**API Endpoints:**
- `GET /api/events/feed` - Luna Group filtered events
- `GET /api/events/{id}` - Single event detail
- `POST /api/events/{id}/rsvp` - RSVP to event

---

### 3.3 Profile Screen (`/app/(tabs)/profile.tsx`)

The central hub for user account management featuring:

**Luna Points Card:**
- Current points balance (large display)
- Subscription tier badge (Lunar/Eclipse/Aurora)
- Points multiplier display (1x, 1.5x, 2x based on tier)
- Free entries remaining counter
- "Upgrade Membership" button

**Your Perks Section:**
- Grid showing active tier benefits:
  - Points multiplier rate
  - Free entries remaining
  - Free drinks allowance
  - Priority booking status

**Earned Badges:**
- Horizontally scrolling badge collection
- Badges: First Visit, Party Starter, VIP, Rising Star, Legend, On Fire, Promo King/Queen, Ambassador, Review Star, Influencer
- Locked badges show requirements

**Stats Grid:**
- Total Visits
- Missions Completed
- Current Streak
- Auctions Won

**Quick Actions Grid (12 items):**
1. **Tonight's Pass** - QR code for venue entry
2. **VIP Tables** - Table booking
3. **Crew Plan** - Group coordination
4. **Wallet** - Tickets & rewards
5. **Photo Gallery** - Venue photos
6. **Social Feed** - Friend activity
7. **Rewards** - Earn & redeem points
8. **Auctions** - Bid on VIP experiences
9. **Lost & Found** - Report lost items
10. **Refer Friends** - Earn referral points
11. **Safety** - Emergency alerts
12. **Lost & Found** - Item recovery

**Settings Section:**
- Settings
- Notifications
- Payment Methods
- Safety Settings
- Help & Support
- About Luna Group
- Sign Out

---

### 3.4 Wallet (`/app/(tabs)/wallet.tsx`)

Digital wallet for tickets, passes, and memberships.

**Points Card:**
- Current Luna Points balance
- "Redeem Rewards" button

**Cherry Hub Membership Card:**
- Digital membership card display
- Member key number
- Add to Apple Wallet / Google Wallet functionality

**Active Missions:**
- Shows 3 current missions with progress bars
- Example missions: Weekend Warrior, First Timer, Social Butterfly

**Ticket Tabs:**
- **Tonight** - Tickets for tonight's events
- **Upcoming** - Future event tickets
- **History** - Past tickets

**Each Ticket Shows:**
- Event name and venue
- Date and ticket type (VIP, General, Booth)
- Guest count
- QR code for entry
- Ability to add/remove guests

---

### 3.5 Auctions (`/app/(tabs)/auctions.tsx`)

Live auction system for VIP experiences.

**Auction Categories:**
- VIP Booth upgrades
- Fast lane entry
- Bottle service
- VIP experiences

**Auction Card Features:**
- Venue image and name
- Auction title and description
- Current bid amount
- Time remaining (countdown)
- "Place Bid" button

**Bidding Modal:**
- Hero image with timer badge
- Current bid and minimum increment
- Quick add buttons (+$10, +$25, +$50, +$100)
- "Notify if Outbid" toggle
- Auto-bid maximum setting
- Deposit information

**API Endpoints:**
- `GET /api/auctions` - List all auctions
- `GET /api/auctions/{id}` - Auction detail
- `POST /api/auctions/bid` - Place bid
- `GET /api/auctions/user/won` - User's won auctions

---

### 3.6 Explore/Venues (`/app/(tabs)/explore.tsx`, `/app/venue/[id].tsx`)

**Venue Listing:**
- Category filters: All, Nightclubs, Dining
- Venue cards with images and status

**Venue Detail Page:**
- Large hero image
- Venue name, type, and region
- Current status (Open/Closed)
- Opening hours
- Features list (rooftop, VIP booths, live DJ, etc.)
- "Add to Guestlist" button
- "Book Table" button
- Upcoming events at this venue

---

### 3.7 Rewards System (`/app/rewards.tsx`)

Comprehensive rewards and points system.

**Three Tabs:**

**1. Missions Tab:**
Active challenges to earn bonus points:
- Leave a Review (50 pts)
- Instagram Tag (25 pts)
- Squad Night (100 pts)
- Venue Explorer (75 pts)
- Weekly Regular (50 pts)
- VIP Experience (150 pts)
- Photo Star (40 pts)
- Promo Champion (200 pts)

**2. Milestones Tab:**
Points-based reward tiers:

| Milestone | Points Required | Rewards |
|-----------|----------------|---------|
| Rising Star | 250 pts | 5 Free Drinks |
| VIP Status | 500 pts | 10 Free Drinks, 5 Free Entries |
| Luna Elite | 1,000 pts | Free VIP Booth, 20 Free Drinks, 10 Free Entries |
| Supernova | 2,500 pts | 3 Free VIP Booths, 50 Free Drinks, Unlimited Entries, Permanent Fast Lane |
| Legend | 5,000 pts | Gold VIP Card, 5 Free VIP Booths, Personal Concierge |

**3. Buy Points Tab:**
Point packages for purchase:

| Package | Points | Bonus | Price |
|---------|--------|-------|-------|
| Starter | 100 | 0 | $10 |
| Popular | 500 | +50 | $45 |
| Premium | 1,000 | +150 | $80 |
| Ultimate | 2,500 | +500 | $180 |

**Promo Codes:**
- WELCOME50: 50 bonus points
- LUNA100: 100 bonus points
- FREEENTRY: 1 free entry voucher
- FREEDRINK: 1 free drink voucher
- VIP2024: 75 points + 2 free drinks

---

### 3.8 Photos (`/app/photos.tsx`, `/app/(tabs)/photos.tsx`)

**Photo Gallery:**
- Browse venue photo albums
- Photos organized by venue and date
- Photo tagging via QR scan

**Photo Features:**
- Pending photo review/approval
- Photo purchase (individual or bundle)
- AI enhancement option (+$2/photo)
- Bundle discount ($25 for 5+ photos)
- Purchased photo gallery
- Night recap with stats

---

### 3.9 Social Feed (`/app/social.tsx`)

**Features:**
- Combined feed from Instagram accounts and hashtags
- Friend activity feed
- Instagram posts from Luna Group venues
- "Going Out Tonight" status sharing

**Connected Instagram Accounts:**
- @eclipsebrisbane
- @sucasabrisbane
- @nightmarketbrisbane
- @jujumermaidbeach
- And more...

---

### 3.10 Subscriptions (`/app/subscriptions.tsx`)

Membership tier management.

**Tiers:**

| Tier | Price | Multiplier | Free Entries | Free Drinks | Skip Line |
|------|-------|------------|--------------|-------------|-----------|
| Lunar (Free) | $0 | 1.0x | 0 | 0 | No |
| Eclipse | $29.99/mo | 1.5x | 2 | 2 (before 10PM) | Yes |
| Aurora | $79.99/mo | 2.0x | Unlimited | 4 (before 10PM) | Yes + Priority |

---

### 3.11 Table Booking (`/app/table-booking.tsx`)

VIP table reservation system.

**Features:**
- Venue selection
- Date and time picker
- Party size selection
- Special requests field
- Occasion selection (birthday, celebration, etc.)
- Confirmation with booking code
- Points earned for booking

---

### 3.12 Safety Features (`/app/safety.tsx`, `/app/safety-settings.tsx`)

**Safety Alert System:**
- Emergency call button (000)
- Report incident functionality
- Rideshare integration (Uber, DiDi)
- Send location to crew members
- "Get me out of here" feature

**Safety Settings:**
- Enable emergency alerts
- Set trusted contacts
- Location sharing preferences

---

### 3.13 Refer a Friend (`/app/refer-friend.tsx`)

**Referral System:**
- Unique referral code generation
- Share link via SMS, WhatsApp, Email
- Track successful referrals
- Earn 100 points per referral
- Both referrer and referee earn points

---

### 3.14 Lost & Found (`/app/lost-found.tsx`)

**Features:**
- Report lost items
- Browse found items
- Claim matching items
- Notification when item is found

---

### 3.15 Crew System

**Crew Plan Features:**
- Create crews for group outings
- Invite members via email
- Share invite codes
- Track crew member locations (with consent)
- Plan venue visits together

---

### 3.16 Settings & Legal Pages

**Settings Page (`/app/settings.tsx`):**
- Account section
- Notifications link
- Legal section (Privacy Policy, Terms of Service)
- Danger Zone (Delete Account)

**Privacy Policy (`/app/privacy-policy.tsx`):**
- 10 comprehensive sections
- Data collection, usage, sharing, security, user rights

**Terms of Service (`/app/terms-of-service.tsx`):**
- 13 comprehensive sections
- Eligibility, account registration, bookings, loyalty program

**Account Deletion:**
- 2-step confirmation modal
- Lists all data to be deleted
- Properly removes all user data from database

---

## 4. Venue Portal - Staff Dashboard

### Location
`/app/venue-portal/` - Separate React + Vite application

### Access
- URL: `{BASE_URL}/venue-portal`
- Login: `venue@eclipse.com` / `venue123`

### 4.1 Dashboard Overview

**Key Metrics Cards:**
- Total Revenue (period)
- Check-ins Today
- Active Auctions
- Points Redeemed

**Charts & Analytics:**
- Revenue Trend Line Chart
- Peak Hours Heatmap
- Membership Demographics Pie Chart

**Real-Time Sections:**
- VIP Alerts (arriving VIPs)
- Live Activity Feed
- Top Spenders Leaderboard

### 4.2 User Management

**User List:**
- Search by name, email, or phone
- Filter by subscription tier
- Sort by spend, visits, points, etc.

**User Profile Drawer:**
- Full user details (name, email, phone, DOB, gender)
- Spending analytics by category
- Visit history by venue
- Points earned/spent
- Auction history
- Recent activity

**Admin Actions:**
- Add points to user
- Update subscription tier
- Add admin notes

### 4.3 Auction Management

**Auction CRUD:**
- Create new auctions
- Set title, description, images
- Configure starting bid and increments
- Set duration and end time
- Publish/unpublish auctions
- View bid history
- Declare winners

**Auction Modal:**
- Full auction editing interface
- Status management (draft, active, ended)
- Bidder list with amounts

### 4.4 Analytics Sections

**Revenue Analytics:**
- Total revenue by period
- Revenue by category (drinks, food, entry, booth)
- Comparison to previous periods

**Check-in Analytics:**
- Daily/weekly/monthly check-ins
- Peak hours identification
- Venue comparison

**Auction Analytics:**
- Total auction revenue
- Average winning bid
- Most popular auction types

**Points Analytics:**
- Points earned vs redeemed
- Top point earners
- Point velocity trends

### 4.5 Export Functionality

- Export reports as PDF
- Export data as CSV
- Period selection (day, week, month)

---

## 5. Technical Architecture

### 5.1 Backend Structure

```
/app/backend/
├── server.py              # Main FastAPI application
├── models/
│   └── user.py            # Pydantic models
├── routes/
│   ├── __init__.py        # Route registration
│   ├── auth.py            # Authentication endpoints
│   ├── venues.py          # Venue endpoints
│   ├── events.py          # Eventfinda integration
│   ├── auctions.py        # Auction system
│   ├── rewards.py         # Rewards & redemptions
│   ├── missions.py        # Mission tracking
│   ├── bookings.py        # Table reservations
│   ├── subscriptions.py   # Membership tiers
│   ├── points.py          # Points system
│   ├── tickets.py         # Ticket management
│   ├── friends.py         # Social features
│   ├── notifications.py   # Push notifications
│   ├── referrals.py       # Referral system
│   ├── photos.py          # Photo galleries
│   ├── venue_dashboard.py # Staff analytics
│   ├── venue_admin.py     # Auction/User management
│   └── shared.py          # Shared utilities
└── requirements.txt
```

### 5.2 Frontend Structure (Mobile)

```
/app/frontend/
├── app/                   # Expo Router pages
│   ├── (tabs)/            # Tab-based navigation
│   │   ├── index.tsx      # Home
│   │   ├── profile.tsx    # Profile
│   │   ├── wallet.tsx     # Wallet
│   │   ├── auctions.tsx   # Auctions
│   │   ├── explore.tsx    # Venues
│   │   └── photos.tsx     # Photos
│   ├── event/
│   │   └── [id].tsx       # Event detail
│   ├── venue/
│   │   └── [id].tsx       # Venue detail
│   └── [other pages].tsx
├── src/
│   ├── components/        # Reusable components
│   ├── store/             # Zustand state
│   ├── theme/             # Colors and styling
│   ├── hooks/             # Custom hooks
│   └── utils/
│       └── api.ts         # API client
└── package.json
```

### 5.3 Venue Portal Structure

```
/app/venue-portal/
├── src/
│   ├── App.tsx            # Main app with routing
│   ├── pages/
│   │   ├── Login.tsx      # Staff login
│   │   └── Dashboard.tsx  # Main dashboard
│   ├── components/
│   │   ├── AuctionModal.tsx
│   │   └── UserProfileDrawer.tsx
│   ├── utils/
│   │   ├── api.ts         # API client
│   │   └── auth.ts        # Auth utilities
│   └── data/
│       └── mockData.ts    # Fallback mock data
└── package.json
```

---

## 6. Third-Party Integrations

### 6.1 Eventfinda API

**Purpose:** Real-time event data for Brisbane and Gold Coast

**Configuration:**
```
EVENTFINDA_USERNAME=lunagrouployaltyapp
EVENTFINDA_PASSWORD=xytjdrgk6rjs
```

**Filtering Logic:**
Events are automatically filtered to show only Luna Group venue events by matching:
- "eclipse"
- "after dark" / "afterdark"
- "su casa" / "sucasa"
- "juju"
- "night market" / "nightmarket"
- "ember & ash" / "ember and ash"

**Caching:**
- 10-minute cache for API compliance
- Rate limit protection built-in

### 6.2 CherryHub API

**Purpose:** Loyalty points and membership integration

**Features:**
- Member registration
- Points balance sync
- Digital wallet pass generation
- Apple Wallet / Google Wallet integration

**Status:** Currently in MOCK mode due to DNS/network limitations

### 6.3 Instagram API

**Purpose:** Social feed integration

**Configured Accounts:**
- @eclipsebrisbane
- @sucasabrisbane
- @nightmarketbrisbane
- @jujumermaidbeach
- @eclipse.afterdark
- @sucasa.gc
- @lunagrouphospitality

**Tracked Hashtags:**
- #eclipsebrisbane
- #nightmarket
- #nightmarketbrisbane
- #afterdarkbrisbane
- #sucasabrisbane
- #sucasagoldcoast
- And more...

**Status:** Currently in DEMO mode (requires API credentials to activate)

---

## 7. Database Structure

### 7.1 Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and profiles |
| `auctions` | Auction listings |
| `bids` | Bid records |
| `bookings` | Table reservations |
| `guestlist` | Venue guestlist entries |
| `redemptions` | Reward redemptions |
| `rewards` | Available rewards catalog |
| `subscriptions` | User subscriptions |
| `points_transactions` | Points history |
| `spending` | Spending records |
| `notifications` | Push notifications |
| `tickets` | Event tickets |
| `missions` | Mission definitions |
| `mission_progress` | User mission progress |
| `referrals` | Referral tracking |
| `friend_requests` | Social connections |

### 7.2 Key User Schema

```javascript
{
  user_id: "uuid",
  email: "user@example.com",
  name: "John Doe",
  phone: "+61400000000",
  date_of_birth: "1995-06-15",
  gender: "male",
  role: "user", // user, venue_staff, venue_manager, admin
  tier: "bronze",
  subscription_tier: "eclipse",
  points_balance: 2500,
  total_visits: 15,
  total_spend: 850.00,
  referral_code: "JOHN1234",
  push_token: "ExponentPushToken[xxx]"
}
```

---

## 8. Administrator Guide

### 8.1 User Roles

| Role | Access Level |
|------|--------------|
| `user` | Regular app users |
| `venue_staff` | QR scanning, basic dashboard |
| `venue_manager` | Full dashboard, staff management |
| `admin` | System-wide access |

### 8.2 Creating Staff Accounts

**Via API:**
```http
POST /api/venue/register-staff
{
  "email": "staff@eclipse.com",
  "password": "securepassword",
  "name": "Staff Member",
  "venue_id": "eclipse",
  "role": "venue_staff"
}
```

### 8.3 Managing Auctions

1. Log into Venue Portal
2. Navigate to Auctions section
3. Click "Create New Auction"
4. Fill in:
   - Title and description
   - Starting bid and increment
   - Duration
   - Category
5. Save as draft or publish immediately
6. Monitor bids and declare winner when ended

### 8.4 Processing Redemptions

1. User shows QR code at venue
2. Staff scans via `POST /api/venue/scan-qr`
3. System validates and marks redemption complete
4. Customer receives reward

---

## 9. Troubleshooting

### 9.1 Common Issues

**Issue: Events not loading**
- Check Eventfinda API credentials
- Verify network connectivity
- Check cache expiration

**Issue: Points not syncing**
- CherryHub integration may be in mock mode
- Check `MOCK_MODE` environment variable

**Issue: Push notifications not working**
- Verify Expo push token registration
- Check notification preferences
- Ensure valid token format: `ExponentPushToken[xxx]`

### 9.2 Environment Variables

**Backend (.env):**
```
MONGO_URL=mongodb://...
DB_NAME=luna_group
JWT_SECRET=your-secret-key
QR_SECRET=your-qr-secret
EVENTFINDA_USERNAME=lunagrouployaltyapp
EVENTFINDA_PASSWORD=xytjdrgk6rjs
MOCK_MODE=true
```

### 9.3 Log Locations

- Backend logs: `/var/log/supervisor/backend.*.log`
- Check for import errors, API failures

---

## 10. Future Roadmap

### Planned Features

1. **Stripe Payment Integration**
   - Real payment processing for subscriptions
   - Auction deposits and payments
   - Point purchases

2. **Live CherryHub Integration**
   - Remove mock mode
   - Real-time points sync
   - Wallet pass generation

3. **Instagram Live API**
   - Connect production API credentials
   - Real social feed

4. **Enhanced Analytics**
   - Customer segmentation
   - Predictive insights
   - Marketing automation

5. **Multi-Venue Management**
   - Per-venue dashboards
   - Cross-venue analytics
   - Staff management

---

## Test Credentials

### Mobile App (Regular User)
- Email: `luna@test.com`
- Password: `test123`

### Venue Portal (Staff/Manager)
- Email: `venue@eclipse.com`
- Password: `venue123`

---

## Support & Documentation

- **Technical Specification:** `/app/memory/technical_specification.md`
- **API Documentation:** All endpoints documented in technical specification
- **Design Guidelines:** `/app/design_guidelines.md`

---

*This manual provides a comprehensive overview of the Luna Group VIP application. For detailed API documentation, refer to the Technical Specification document.*
