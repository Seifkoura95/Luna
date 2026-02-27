# Luna Group VIP App - Owner's Manual

**Version:** 1.0.0  
**Platform:** iOS & Android (Expo React Native)  
**Last Updated:** December 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [App Overview](#2-app-overview)
3. [User App Features](#3-user-app-features)
4. [Venue Staff Portal](#4-venue-staff-portal)
5. [Backend Administration](#5-backend-administration)
6. [Technical Architecture](#6-technical-architecture)
7. [External Integrations](#7-external-integrations)
8. [Customization Guide](#8-customization-guide)
9. [Troubleshooting](#9-troubleshooting)
10. [Support & Maintenance](#10-support--maintenance)

---

## 1. Introduction

### What is Luna Group VIP?

Luna Group VIP is a premium hospitality loyalty and membership app designed for nightclub and venue groups. It provides a complete ecosystem for:

- **Customers**: Digital membership cards, loyalty points, event tickets, VIP auctions, table bookings, and social features
- **Venue Staff**: QR code scanning, customer verification, redemption processing
- **Venue Managers**: Analytics dashboard, auction management, user insights

### Target Audience

- Nightclub chains and venue groups
- Hospitality businesses with multiple locations
- Entertainment venues wanting to build customer loyalty
- VIP membership programs

### Key Value Propositions

1. **Increase Customer Retention**: Points system rewards repeat visits
2. **Drive Revenue**: VIP auctions create urgency and premium pricing
3. **Reduce Friction**: Digital check-ins and mobile tickets
4. **Build Community**: Social features keep users engaged
5. **Data Insights**: Comprehensive analytics on customer behavior

---

## 2. App Overview

### App Structure

The app consists of **5 main navigation tabs**:

| Tab | Icon | Purpose |
|-----|------|---------|
| **Home** | 🏠 | Featured events, trending, venues, social |
| **Explore** | 🔍 | Browse all events and venues |
| **Auctions** | 🏆 | Bid on VIP experiences |
| **Photos** | 📸 | Venue photo galleries |
| **Profile** | 👤 | Account, points, settings |

### Additional Pages

- `/wallet` - Tickets, rewards, missions
- `/events` - Full events calendar
- `/event/[id]` - Event details
- `/venue/[id]` - Venue details
- `/rewards` - Rewards catalog
- `/subscriptions` - Membership tiers
- `/settings` - Account settings
- `/safety` - Emergency features
- `/social` - Friend activity
- `/refer-friend` - Referral program
- `/table-booking` - VIP table reservations
- `/lost-found` - Lost item reporting

---

## 3. User App Features

### 3.1 Home Screen

**What Users See:**
- Luna Group logo with live/closed status indicator
- Featured event hero card
- "Trending" events grid (4 events)
- "What's On" event list with dates
- "Our Venues" horizontal carousel
- "Friends heading out tonight" social card

**How It Works:**
- Events are pulled from Eventfinda API in real-time
- Only shows events at Luna Group venues (filtered)
- Pull-to-refresh updates all data
- Brisbane timezone awareness (shows "LIVE NOW" from 8PM-4AM)

---

### 3.2 Points & Loyalty System

**How Users Earn Points:**
| Action | Points Earned |
|--------|---------------|
| Check-in at venue | 5 points |
| $1 spent | 1 point (multiplied by tier) |
| Complete mission | 25-500 points |
| Refer a friend | 10 points |
| Purchase ticket | Varies |

**Point Multipliers by Tier:**
| Tier | Price | Multiplier | Color |
|------|-------|------------|-------|
| Lunar (Free) | $0/mo | 1.0x | Silver |
| Eclipse | $29.99/mo | 1.5x | Red |
| Aurora | $79.99/mo | 2.0x | Gold |

**Spending Points:**
- Rewards catalog with drinks, entry passes, merchandise
- Redemption generates QR code valid 48 hours
- Staff scans QR to validate redemption

---

### 3.3 Subscription Tiers

**Lunar (Free Tier)**
- Earn 1 point per $1 spent
- Access to all public auctions
- Digital membership card
- Event notifications

**Eclipse ($29.99/month)**
- Earn 1.5x points on all spending
- 2 free venue entries per month
- 1 complimentary drink before 10 PM
- Priority queue access
- Early access to auctions
- Birthday booth upgrade

**Aurora ($79.99/month)**
- Earn 2x points on all spending
- Unlimited free venue entries
- 2 complimentary drinks before 10 PM
- Skip the line at all venues
- Priority booking
- Exclusive VIP-only auctions
- Free birthday booth (up to 6 people)
- Free coat check
- Access to private member events

---

### 3.4 Auctions System

**How Auctions Work:**

1. **Browse Auctions**: Active auctions show on the Auctions tab
2. **Auction Cards Display**:
   - Venue name and auction title
   - Hero image
   - Current bid amount
   - Time remaining countdown
   - Features included (e.g., "Fast Lane Entry", "Premium Bottle")
   
3. **Place a Bid**:
   - Tap auction card to open detail modal
   - Quick bid buttons: +$10, +$25, +$50, +$100
   - Manual bid input
   - Optional: Set max bid for auto-bidding
   - Toggle: "Notify if outbid" push notification
   
4. **Auto-Bidding**:
   - User sets maximum they're willing to pay
   - System automatically bids minimum increment when outbid
   - Continues until max is reached
   - User notified when outbid by auto-bidder

5. **Winning**:
   - Winner receives push notification
   - Claim button appears
   - QR code generated for redemption

**Auction Types:**
- VIP Booth experiences
- Fast lane entry
- Bottle service packages
- Meet & greet experiences
- Private events

---

### 3.5 Events & Tickets

**Events Source:**
- Real-time data from Eventfinda API
- Filtered to show ONLY events at Luna Group venues
- Categories: concerts, festivals, nightlife, DJ nights

**Event Views:**
- Tonight's events
- Tomorrow's events  
- Weekend events
- Upcoming (30 days)
- Featured/popular events

**Ticket Purchase Flow:**
1. Browse events on Home or Events page
2. Tap event for details
3. "Book Tickets" links to Eventfinda for purchase
4. Purchased tickets appear in Wallet tab

**Ticket Features:**
- QR code for entry
- Add guests to ticket
- View ticket history
- Transfer tickets (future feature)

---

### 3.6 Wallet

**Wallet Contains:**
- **Luna Points balance** with tier badge
- **Cherry Hub Membership card** (if connected)
- **Active Missions** with progress bars
- **Tickets**: Tonight / Upcoming / History tabs

**Missions Examples:**
| Mission | Description | Reward |
|---------|-------------|--------|
| Weekend Warrior | Visit 3 venues this weekend | 50 pts |
| First Timer | Buy your first ticket | 25 pts |
| Social Butterfly | Refer 2 friends | 100 pts |
| Night Owl | Check in at 3 different venues | 500 pts |
| Early Bird | Check in before 10 PM | 25 pts |

---

### 3.7 Profile & Quick Actions

**Profile Displays:**
- User name and welcome message
- Luna Points card with balance
- Current tier with perks
- Earned badges
- Stats grid (Visits, Missions, Streak, Auctions Won)

**Quick Actions Grid:**
| Action | Description |
|--------|-------------|
| Tonight's Pass | QR code for venue entry |
| VIP Tables | Book booth reservations |
| Crew Plan | Create groups with friends |
| Wallet | View tickets & rewards |
| Photo Gallery | Browse venue photos |
| Social Feed | See friend activity |
| Rewards | Earn & redeem points |
| Auctions | Bid on VIP experiences |
| Lost & Found | Report lost items |
| Refer Friends | Earn 100 points per referral |
| Safety | Emergency alerts |

---

### 3.8 Crew (Group) Planning

**What is a Crew?**
- Groups of friends planning nights out together
- Shared location tracking (opt-in)
- Coordinated venue planning

**Crew Features:**
1. **Create Crew**: Name your group
2. **Invite Members**: Send email invitations
3. **Invite Code**: Share code for quick join
4. **Track Crew**: See where crew members are (map view)
5. **Crew Details**: View all members and their status

**Use Cases:**
- Planning birthday nights out
- Bachelor/bachelorette parties
- Regular friend groups
- Safety check-ins

---

### 3.9 Safety Features

**Emergency Alert System:**
- Discreet emergency button
- Sends alert to venue security
- Shares location with selected crew members
- One-tap rideshare links (Uber/DiDi)

**Safety Options:**
- Report incident at venue
- Contact security
- Call emergency services (000)
- Share location with friends

---

### 3.10 Referral Program

**How It Works:**
1. User gets unique referral code (e.g., "JOHN1234")
2. Share code with friends
3. Friend registers with code
4. Both earn 10 points when friend is verified

**Referral Dashboard Shows:**
- Unique referral code
- Shareable link
- Successful referrals count
- Pending referrals
- Total points earned from referrals

---

### 3.11 Rewards Shop

**Reward Categories:**
- **Drinks**: Free cocktails, premium spirits
- **Entry**: Free entry passes
- **Food**: Complimentary appetizers
- **Merchandise**: Luna Group branded items
- **Experiences**: VIP upgrades, booth access

**Redemption Process:**
1. Browse rewards catalog
2. Select reward (check point cost)
3. Choose venue (if applicable)
4. Confirm redemption
5. QR code generated
6. Show QR to venue staff
7. Staff scans to validate
8. Reward fulfilled

**QR Code Details:**
- Format: `LUNA-{ID}-{SIGNATURE}`
- Valid for 48 hours
- One-time use
- Secured with HMAC-SHA256

---

### 3.12 Table Booking

**VIP Table Booking Flow:**
1. Select venue from profile quick actions
2. Choose date and time
3. Select party size
4. Add special requests (optional)
5. Mark occasion (birthday, celebration, etc.)
6. Confirm booking
7. Receive confirmation code

**Booking Includes:**
- Confirmation code
- Points earned for booking
- Option to add to calendar
- Modification/cancellation

---

### 3.13 Venue Pages

**Each Venue Page Shows:**
- Hero image
- Venue name and type
- Address and region
- Current status (Open/Closed/Busy)
- Description
- Opening hours
- Features (rooftop, VIP booths, live DJ)
- Upcoming events at this venue

**Luna Group Venues:**
1. **Eclipse** - Brisbane's premier nightclub
2. **After Dark** - Late-night entertainment
3. **Su Casa Brisbane** - Dining & nightlife
4. **Su Casa Gold Coast** - Coastal venue
5. **Juju Mermaid Beach** - Gold Coast nightlife
6. **Night Market** - Street food & entertainment
7. **Ember & Ash** - Coming soon

---

## 4. Venue Staff Portal

### 4.1 Accessing the Portal

**URL:** `{your-domain}/venue-portal`

**Login Credentials:**
- Use venue staff email and password
- Roles: `venue_staff` or `venue_manager`

**Test Credentials:**
```
Email: venue@eclipse.com
Password: venue123
```

---

### 4.2 Dashboard Overview

**Stats Cards:**
- Total redemptions
- Today's redemptions
- Week's redemptions
- Pending redemptions
- Unique visitors

**Dashboard Sections:**
1. **QR Scanner** - Scan customer redemptions
2. **Recent Redemptions** - Activity feed
3. **Analytics** - Charts and insights
4. **User Management** - Customer search

---

### 4.3 QR Code Scanning

**Scan Process:**
1. Open QR Scanner
2. Point camera at customer's phone
3. System validates:
   - Is code valid?
   - Is it expired?
   - Has it been used?
4. If valid: Shows reward details + customer name
5. Confirm to mark as redeemed
6. Customer sees "Redeemed" status

**What Staff Sees:**
- Reward name
- Points spent
- Customer name
- Redemption ID
- Timestamp

---

### 4.4 Analytics Dashboard

**Revenue Analytics:**
- Daily/weekly/monthly revenue trends
- Revenue by category (drinks, food, entry)
- Revenue by venue comparison

**Check-in Analytics:**
- Peak hours heatmap
- Daily check-in counts
- Busiest days visualization

**Demographics:**
- Membership tier distribution
- Age demographics
- Gender split

**Auction Analytics:**
- Total auction revenue
- Bids placed
- Average winning bid
- Top auction items

**Points Analytics:**
- Points issued vs redeemed
- Top earners leaderboard
- Redemption patterns

---

### 4.5 User Management (Venue Admin)

**Search Users By:**
- Name
- Email
- Phone number

**Filter By:**
- Subscription tier
- Visit count
- Total spend

**Sort By:**
- Total spend (highest first)
- Visit count
- Points balance
- Registration date
- Name (A-Z)

**User Profile View:**
- Contact information
- Demographics (age, gender)
- Visit history
- Spending breakdown by category
- Spending breakdown by venue
- Redemption history
- Auction participation
- Points earned/spent

---

### 4.6 Auction Management (Admin)

**Create New Auction:**
1. Title and description
2. Upload image
3. Set starting bid
4. Set minimum increment
5. Set maximum bid limit
6. Set duration (hours)
7. Select venue
8. Choose category
9. Add terms & conditions
10. Publish immediately or save as draft

**Manage Existing Auctions:**
- View all auctions (active/upcoming/ended)
- Edit auction details
- Publish/unpublish
- Delete (only if no bids)
- View bid history

**Auction Categories:**
- VIP Experience
- Drinks package
- Entry pass
- Merchandise

---

## 5. Backend Administration

### 5.1 Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and profiles |
| `auctions` | Auction listings |
| `bids` | Bid history |
| `bookings` | Table reservations |
| `guestlist` | Guestlist entries |
| `redemptions` | Reward redemptions |
| `rewards` | Rewards catalog |
| `subscriptions` | User subscriptions |
| `points_transactions` | Points history |
| `spending` | Spending records |
| `notifications` | User notifications |
| `tickets` | Event tickets |
| `missions` | Mission definitions |
| `mission_progress` | User mission progress |
| `referrals` | Referral tracking |
| `friend_requests` | Social connections |
| `crews` | Group planning |

---

### 5.2 API Structure

**Base URL:** `{domain}/api`

**Route Groups:**
- `/auth/*` - Authentication
- `/venues/*` - Venue data
- `/events/*` - Events (Eventfinda)
- `/auctions/*` - Auction system
- `/rewards/*` - Rewards & redemptions
- `/points/*` - Points management
- `/bookings/*` - Reservations
- `/subscriptions/*` - Memberships
- `/tickets/*` - Event tickets
- `/friends/*` - Social features
- `/notifications/*` - Push & in-app
- `/referral/*` - Referral program
- `/venue/*` - Staff dashboard
- `/venue-admin/*` - Admin functions

---

### 5.3 Authentication

**Method:** JWT (JSON Web Token)

**Token Details:**
- Algorithm: HS256
- Expiry: 7 days
- Header: `Authorization: Bearer {token}`

**User Roles:**
| Role | Access |
|------|--------|
| `user` | Standard app access |
| `venue_staff` | QR scanning, basic dashboard |
| `venue_manager` | Full dashboard, auction management |
| `admin` | System-wide access |

---

## 6. Technical Architecture

### 6.1 Tech Stack

**Frontend (Mobile App):**
- Expo React Native (iOS & Android)
- expo-router for navigation
- Zustand for state management
- expo-image for optimized images
- react-native-reanimated for animations

**Backend:**
- FastAPI (Python)
- MongoDB (database)
- JWT authentication
- Pydantic for data validation

**External Services:**
- Eventfinda API (events)
- CherryHub (loyalty integration)
- Expo Push Notifications

---

### 6.2 File Structure

```
/app
├── frontend/           # Expo React Native app
│   ├── app/           # Pages (expo-router)
│   │   ├── (tabs)/    # Main tab screens
│   │   └── *.tsx      # Individual pages
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── store/       # Zustand stores
│   │   ├── theme/       # Colors & styling
│   │   └── utils/       # API & helpers
│   └── assets/        # Images, fonts
│
├── backend/           # FastAPI server
│   ├── routes/        # API route modules
│   ├── models/        # Pydantic models
│   ├── static/        # Static files (photos)
│   └── server.py      # Main server file
│
├── venue-portal/      # Staff dashboard (React)
│   └── src/
│       ├── components/
│       └── pages/
│
└── memory/           # Documentation
    ├── PRD.md
    ├── technical_specification.md
    └── OWNERS_MANUAL.md
```

---

### 6.3 Environment Variables

**Backend (.env):**
```
MONGO_URL=mongodb://...
DB_NAME=luna_group
JWT_SECRET=your-secret-key
QR_SECRET=your-qr-secret
EVENTFINDA_USERNAME=...
EVENTFINDA_PASSWORD=...
STRIPE_SECRET_KEY=sk_test_...
```

**Frontend (.env):**
```
EXPO_PUBLIC_BACKEND_URL=https://your-domain.com
```

---

## 7. External Integrations

### 7.1 Eventfinda (Events)

**What It Does:**
- Provides real-time event listings
- Covers Brisbane and Gold Coast regions
- Categories: concerts, festivals, nightlife

**How It's Used:**
- Events feed on Home page
- Events calendar
- Event search
- Tonight/Weekend filters

**Luna Group Filtering:**
Events are filtered to show ONLY those at Luna venues by checking venue_name, location, and address for:
- Eclipse
- After Dark
- Su Casa
- Juju
- Night Market
- Ember & Ash

---

### 7.2 CherryHub (Loyalty)

**What It Does:**
- External loyalty points system
- Digital membership cards
- Wallet pass generation

**Integration Status:**
- Currently in MOCK mode
- Ready for live connection when DNS resolves
- Toggle via `MOCK_MODE` in backend/.env

**Features:**
- Points synchronization
- Apple Wallet / Google Wallet passes
- Member key generation

---

### 7.3 Stripe (Payments)

**What It Does:**
- Subscription billing
- Auction deposits
- Ticket purchases

**Current Status:**
- Test mode enabled
- Ready for production keys

**Subscription Flow:**
1. User selects tier
2. Stripe checkout
3. Webhook confirms payment
4. User upgraded

---

## 8. Customization Guide

### 8.1 Branding

**Colors (in `/frontend/src/theme/colors.ts`):**
```javascript
primary: '#000000'      // Background
accent: '#E31837'       // Luna Red
gold: '#D4AF37'         // Premium Gold
success: '#00D26A'      // Green
error: '#E31837'        // Red
```

**Logo:**
- Located at URL in `index.tsx`
- Recommended size: 260x75px
- Format: WebP or PNG with transparency

**Fonts:**
- Primary: Montserrat (app-wide)
- Loaded via expo-font

---

### 8.2 Adding New Venues

1. **Update venue config:**
   - Edit `/backend/luna_venues_config.py`
   - Add venue object with id, name, type, region, address

2. **Add venue images:**
   - Place in `/backend/static/photos/{venue-id}/`
   - Update image_url in venue config

3. **Update Eventfinda filter:**
   - Edit `/backend/eventfinda_service.py`
   - Add venue name variations to filter

---

### 8.3 Adding New Rewards

**Via API:**
```bash
POST /api/admin/rewards
{
  "name": "Free Cocktail",
  "description": "Any house cocktail",
  "points_cost": 500,
  "category": "drinks",
  "venue_restriction": null,
  "is_active": true
}
```

**Categories:** drinks, food, entry, merch, experience

---

### 8.4 Modifying Subscription Tiers

Edit `/backend/config.py`:
```python
SUBSCRIPTION_TIERS = {
    "lunar": {
        "id": "lunar",
        "name": "Lunar",
        "price": 0,
        "points_multiplier": 1.0,
        "benefits": {...}
    },
    # Add or modify tiers here
}
```

---

## 9. Troubleshooting

### 9.1 Common Issues

**App Won't Load Events:**
- Check Eventfinda credentials in backend/.env
- Verify API quota hasn't been exceeded
- Check backend logs for errors

**Points Not Updating:**
- Refresh app (pull down)
- Check if CherryHub is in mock mode
- Verify user is authenticated

**QR Codes Not Scanning:**
- Ensure good lighting
- Check code hasn't expired (48hr limit)
- Verify staff has correct permissions

**Push Notifications Not Working:**
- Check device permissions
- Verify push token is registered
- Check Expo push service status

---

### 9.2 Backend Logs

**View logs:**
```bash
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/backend.out.log
```

**Common error patterns:**
- `CherryHub token refresh error` - DNS issue, use mock mode
- `MongoDB connection error` - Check MONGO_URL
- `JWT decode error` - Token expired or invalid

---

### 9.3 Database Issues

**Access MongoDB:**
```bash
mongosh "mongodb://..."
use luna_group
```

**Common queries:**
```javascript
// Find user by email
db.users.findOne({email: "user@example.com"})

// Check user points
db.users.findOne({email: "..."}, {points_balance: 1})

// View recent redemptions
db.redemptions.find().sort({created_at: -1}).limit(10)
```

---

## 10. Support & Maintenance

### 10.1 Regular Maintenance

**Daily:**
- Monitor error logs
- Check API response times

**Weekly:**
- Review analytics
- Check subscription renewals
- Verify external API connections

**Monthly:**
- Database backup
- Review and archive old data
- Update dependencies

---

### 10.2 Updating the App

**Backend Updates:**
1. Push changes to repository
2. Backend auto-restarts via supervisor
3. Check logs for errors

**Frontend Updates:**
1. Push changes
2. Rebuild Expo bundle
3. For app store: Create new build with EAS

---

### 10.3 Test Accounts

**Regular User:**
```
Email: luna@test.com
Password: test123
```

**Venue Staff:**
```
Email: venue@eclipse.com
Password: venue123
```

---

### 10.4 Key Files Reference

| Purpose | File |
|---------|------|
| API routes | `/backend/routes/*.py` |
| Database models | `/backend/models/*.py` |
| Configuration | `/backend/config.py` |
| Venue data | `/backend/luna_venues_config.py` |
| Events integration | `/backend/eventfinda_service.py` |
| Main server | `/backend/server.py` |
| Mobile app pages | `/frontend/app/**/*.tsx` |
| Theme colors | `/frontend/src/theme/colors.ts` |
| API client | `/frontend/src/utils/api.ts` |
| Auth store | `/frontend/src/store/authStore.ts` |

---

### 10.5 Contact & Resources

**Documentation:**
- Technical Specification: `/app/memory/technical_specification.md`
- Product Requirements: `/app/memory/PRD.md`
- This Manual: `/app/memory/OWNERS_MANUAL.md`

**External Documentation:**
- Expo: https://docs.expo.dev
- FastAPI: https://fastapi.tiangolo.com
- MongoDB: https://docs.mongodb.com
- Eventfinda API: https://api.eventfinda.com.au

---

## Quick Start Checklist

For the new owner:

- [ ] Review this manual completely
- [ ] Access test accounts and explore all features
- [ ] Review technical specification for API details
- [ ] Update environment variables with your credentials
- [ ] Customize branding (colors, logo)
- [ ] Update venue information
- [ ] Configure payment processing (Stripe)
- [ ] Set up push notification service
- [ ] Train venue staff on QR scanning
- [ ] Plan marketing for app launch

---

*Document generated for Luna Group VIP App*
*Version 1.0.0 - December 2025*
