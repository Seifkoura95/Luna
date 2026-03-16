# Luna Group VIP App - Product Requirements Document

## Overview
Premium hospitality VIP operating system for Luna Group venues (Eclipse, After Dark, Su Casa Brisbane/Gold Coast) - a native iOS/Android app built with Expo React Native.

## Core Product Vision
- Luna Points system powered by CherryHub
- Digital membership card via CherryHub integration
- VIP experience across all Luna Group venues
- Navigation to features via Profile > Quick Actions
- Consistent Montserrat font family throughout app

## Phase 1 MVP Features ✅ COMPLETE

### Authentication ✅
- Emergent Google OAuth integration
- Profile management with membership tiers

### Tonight Pass ✅
- QR code check-in system
- Points awarded on check-in
- Queue status display

### Points & Rewards ✅
- Points balance dashboard
- Rewards catalog (8 items)
- Redemption system with QR codes

### Missions System ✅
- Check-in streaks
- Early bird bonuses
- Spending milestones

### Boosts ✅
- Time-based point multipliers
- Special event boosts

### Events Calendar ✅ (Powered by Eventfinda)
- Real-time events from Eventfinda API
- Brisbane and Gold Coast coverage
- Event categories: concerts, festivals, nightlife, DJ nights
- Tonight, Tomorrow, Weekend, Upcoming views
- Event search functionality
- Featured events display

### Membership Tiers (Mock) ✅
- Bronze (Free)
- Silver ($29/mo)
- Gold ($79/mo)
- Platinum ($199/mo)

## Phase 3: Live Auctions ✅ COMPLETE

### Features:
- Real-time auction listing (active/upcoming)
- Live countdown timers
- Bid placement with quick bid buttons (+$5, +$10, +$20)
- Bid history tracking
- Winner determination
- Claim code generation for prizes
- Auction types: booth_upgrade, fast_lane, bottle_service, vip_experience

### APIs:
- GET /api/auctions - List auctions
- GET /api/auctions/{id} - Auction detail with bids
- POST /api/auctions/bid - Place bid
- GET /api/auctions/user/won - User's won auctions
- POST /api/auctions/{id}/claim - Claim prize

## Phase 4: Photo System ✅ COMPLETE

### Features:
- Photo tagging via QR scan
- Pending photo review/approval
- Photo purchase (individual or bundle)
- AI enhancement option (+$2/photo)
- Bundle discount ($25 for 5+ photos)
- Purchased photo gallery
- Night recap with stats

### APIs:
- GET /api/photos - User's tagged photos
- GET /api/photos/pending - Photos awaiting approval
- POST /api/photos/approve - Approve/decline photo
- POST /api/photos/purchase - Purchase photos
- GET /api/photos/purchased - Purchased photos
- GET /api/photos/recap - Night recap
- POST /api/admin/photos/tag - Photographer tags photo

## Brand Colors
- Primary Background: #000000
- Card Background: #1A1A1A
- Text Primary: #FFFFFF
- Accent Red: #E31837 (Luna Red)
- Success Green: #00D26A
- Warning Gold: #FFD700
- Premium Gold: #D4AF37

## Technical Stack
- Frontend: Expo React Native
- Backend: FastAPI + MongoDB
- Auth: JWT-based authentication
- State: Zustand
- Image Loading: expo-image

## App Store Readiness ✅ COMPLETE (Feb 2025)

### Settings Page (/settings)
- Account section (Notifications link)
- Legal section (Privacy Policy, Terms of Service)
- Danger Zone (Delete Account with 2-step confirmation)

### Privacy Policy (/privacy-policy) ✅
- 10 comprehensive sections covering data collection, usage, sharing, security, user rights

### Terms of Service (/terms-of-service) ✅
- 13 comprehensive sections covering eligibility, account registration, bookings, loyalty program, etc.

### Account Deletion ✅
- DELETE /api/user/delete endpoint
- 2-step confirmation modal showing data to be deleted
- Properly deletes all user data from all collections
- Redirects to login after successful deletion

## Recent Completions (Feb 2025)
- Home page redesigned with Featured Events, What's On timeline, Venues carousel
- Photo Gallery with venue albums from /backend/static/photos
- Social Feed with Instagram integration
- Venues page with category filters (All/Nightclubs/Dining)
- Rewards page overhauled with new missions and Buy Points UI
- App-wide font standardization to Montserrat
- Header redesign (removed rotating moon, larger logo 260x75)
- Profile page with Quick Actions hub for Photos, Social, Auctions, Rewards, Referrals
- **Eventfinda Integration** - Real-time events from Brisbane & Gold Coast
- **Luna Group Venue Filtering** - Events feed now only shows Luna Group venues (Feb 17, 2025)
- **Improved Text Readability** - Enhanced gradients and text shadows on event cards (Feb 17, 2025)
- **Black Background** - Simple black background with subtle gradient glow (Feb 17, 2025)
  - Replaced video background for better performance
  - Luna red and gold gradient effects in top corners
  - Works on both native (Expo Go) and web preview
- **Video Background Restored** (Feb 17, 2025)
  - Uses compressed Darude Recap video (~2.5MB)
  - Optimized for speed: memoized components, lazy loading
  - 55% dark overlay for text readability
  - Muted and looped playback
  - Black background fallback for web preview
  - Video only loads on native iOS/Android (Expo Go)
- **Event Pages Fixed** (Feb 17, 2025)
  - /events page now correctly loads and displays Luna Group events
  - /event/[id] detail page fully functional with event data
  - Fixed "unmatched route" error when clicking events
  - Book Tickets button links to Eventfinda for ticket purchase

## Eventfinda Integration ✅ COMPLETE (Feb 2025)

### Features:
- Real-time events from Eventfinda API
- **Luna Group Venue Filtering** - Events filtered to ONLY show events AT Luna Group venues
- Proper venue matching: checks venue_name, location, and address fields
- Brisbane and Gold Coast location support
- 10-minute cache for rate limit compliance
- Event categories: concerts, festivals, nightlife, DJ nights

### Luna Group Venues (Filtered):
- Eclipse Brisbane (Fortitude Valley)
- After Dark Brisbane (Fortitude Valley)
- Su Casa Brisbane (Fortitude Valley)
- Su Casa Gold Coast (Surfers Paradise)
- Juju Mermaid Beach (Gold Coast)
- Night Market Brisbane (Fortitude Valley)
- Ember & Ash Brisbane (Coming Soon)

### Filtering Logic:
Events are matched by checking if the venue_name, location, or address contains:
- "eclipse"
- "after dark" / "afterdark"
- "su casa" / "sucasa"
- "juju"
- "night market" / "nightmarket"
- "ember & ash" / "ember and ash"

### API Endpoints:
- GET /api/events - All events (unfiltered)
- GET /api/events/feed - **Luna Group filtered** feed (tonight, tomorrow, featured, upcoming)
- GET /api/events/tonight - Tonight's events
- GET /api/events/featured - Featured/popular events
- GET /api/events/weekend - Weekend events
- GET /api/events/upcoming - Next 30 days
- GET /api/events/search?q= - Search events
- GET /api/events/{id} - Event detail

### Event Data Structure:
- id: ef_XXXXXX (Eventfinda ID)
- title, description, date (YYYY-MM-DD), time (HH:MM)
- venue_name, location, address
- **luna_venue**: Luna Group venue name (Eclipse, Su Casa, etc.)
- image (from Eventfinda CDN)
- category, is_free, is_featured, url
- source: "eventfinda_luna_filtered"

### Credentials (backend/.env):
- EVENTFINDA_USERNAME=lunagrouployaltyapp
- EVENTFINDA_PASSWORD=xytjdrgk6rjs

## Buy Points System ✅ COMPLETE (Feb 2025)

### Point Packages:
- p1: 100 points for $10
- p2: 500 points + 50 bonus for $45 (Popular)
- p3: 1,000 points + 150 bonus for $80
- p4: 2,500 points + 500 bonus for $180

### APIs:
- POST /api/cherryhub/buy-points - Purchase points (integrates with CherryHub)
- Points are tracked locally and synced to CherryHub when live

## Promo Code System ✅ COMPLETE (Feb 2025)

### Features:
- One-time use per user enforcement
- Multiple reward types: bonus points, free entry, drink vouchers, combo rewards
- Voucher expiration (90 days)

### Pre-configured Promo Codes:
- WELCOME50: 50 bonus points (Welcome bonus)
- LUNA100: 100 bonus points (Luna VIP)
- FREEENTRY: 1 free venue entry voucher
- FREEDRINK: 1 free drink voucher  
- VIP2024: Combo - 75 points + 2 free drinks

### APIs:
- GET /api/promo/validate/{code} - Validate promo code
- POST /api/promo/apply - Apply promo code
- GET /api/vouchers - Get user's active vouchers

## Instagram Integration ✅ COMPLETE (Feb 2025)

### Features:
- Combined feed from official accounts and hashtags
- Demo mode with sample images (ready for production API)
- Instagram tab in Social Feed
- Post previews with captions, likes, and links

### Configured Accounts:
- @eclipsebrisbane
- @sucasabrisbane
- @nightmarketbrisbane
- @jujumermaidbeach
- @eclipse.afterdark
- @sucasa.gc
- @lunagrouphospitality

### Tracked Hashtags:
#eclipsebrisbane, #nightmarket, #nightmarketbrisbane, #Afterdarkbrisbane, #sucasabrisbane, #sucasagoldcoast, #sucasagc, #juju

### APIs:
- GET /api/instagram/feed - Combined feed
- GET /api/instagram/account/{account} - Account posts
- GET /api/instagram/hashtag/{hashtag} - Hashtag posts
- GET /api/instagram/config - Integration configuration

### To Enable Live Instagram:
1. Set INSTAGRAM_ACCESS_TOKEN environment variable
2. Set INSTAGRAM_APP_ID environment variable
3. Set INSTAGRAM_APP_SECRET environment variable

## Recent Completions (Feb 2025)

### Geofencing System ✅ COMPLETE (Mar 2026)
**Location-based proximity alerts for Luna Group venues**

#### Features:
- Admin-defined custom geofence zones with custom notification messages
- Background location tracking (works when app is closed)
- 200-meter radius detection for all Luna Group venues
- Once-per-day notification limit per venue (prevents spam)
- User opt-in/opt-out via Settings > Location Settings
- Location Settings page with permission status display
- Privacy-focused: data only used for venue proximity

#### Pre-configured Geofences:
- Eclipse Brisbane (-27.4567, 153.0368)
- After Dark Brisbane (-27.4572, 153.0372)
- Su Casa Brisbane (-27.4580, 153.0365)
- Su Casa Gold Coast (-28.0024, 153.4296)
- Juju Mermaid Beach (-28.0456, 153.4432)

### Birthday Club ✅ COMPLETE (Mar 2026)
**Automated birthday rewards and celebrations**

#### Features:
- Auto-detects user birthday from profile
- Birthday Week rewards (3 days before/after)
- 4 Birthday Rewards:
  - Free Entry (any Luna venue)
  - Free Birthday Drink
  - 250 Bonus Points
  - 2x Point Multiplier (7 days)
- One-time claim per year per reward
- Rewards expire after 7 days

#### APIs:
- GET /api/birthday/status - Check birthday status and available rewards
- POST /api/birthday/claim/{reward_id} - Claim a birthday reward
- GET /api/birthday/my-rewards - View reward history
- POST /api/birthday/redeem/{id} - Redeem at venue

### Leaderboard System ✅ COMPLETE (Mar 2026)
**Rankings, competition, and point-earning strategies**

#### Features:
- New Rankings tab in bottom navigation (trophy icon)
- Top 3 podium display with medals
- Full ranking list with user positions
- Filter by period: All Time, Monthly, Weekly
- Filter by category: Points, Visits, Spend
- "Your Position" card with:
  - Current rank
  - Points/score
  - Gap to first place
  - Progress bar to #1
- "Climb Faster" strategies section:
  - 10 point-earning strategies
  - Quick wins highlighted
  - Personalized recommendations
  - Difficulty ratings (Easy/Medium/Hard)
  - Pro tips for each strategy

#### Point Strategies Include:
- Weekend Warrior Combo (150 pts)
- Auction Snipe Strategy (500 pts)
- Referral Chain (750 pts)
- Birthday Point Stack (500 pts)
- Mission Sweep (690 pts)
- Tier Upgrade Bonus (ongoing multiplier)
- Early Bird Check-in (50 pts)
- Social Media Boost (75 pts)
- Crew Night Bonus (100 pts)
- VIP Table Points (300 pts)

#### APIs:
- GET /api/leaderboard - Get rankings with filters
- GET /api/leaderboard/my-stats - User's detailed stats
- GET /api/leaderboard/strategies - Point-earning tips
- GET /api/leaderboard/top-earners - This week's top earners

#### APIs:
- GET /api/geofences - Get active geofence zones
- POST /api/geofences/check-location - Check if user is within any zones
- GET /api/geofences/my-triggers - User's trigger history
- POST /api/geofences/admin/create - Create new geofence (admin)
- PUT /api/geofences/admin/{id} - Update geofence (admin)
- DELETE /api/geofences/admin/{id} - Delete geofence (admin)
- GET /api/geofences/admin/analytics - Trigger analytics (admin)
- POST /api/geofences/seed - Seed default venue geofences

#### Mobile Integration:
- Uses expo-location and expo-task-manager for background tracking
- Auth token persisted for background task API calls
- Automatic start on login if enabled
- Automatic stop on logout

### App Deep Dive & Testing (Feb 27, 2025)
- **Backend API**: 87.5% passing (170+ endpoints work correctly)
- **Frontend Pages**: 100% functional (all pages load correctly)
- **Venue Portal**: 100% functional (all analytics sections working)
- Fixed QR Code import in wallet.tsx for ticket display
- All major features verified working

- **Auction UI Premium Redesign V2 (Feb 27, 2025)**:
  - Full-screen hero image with gradient overlay showing venue atmosphere
  - Timer badge on image (2h 34m 46s countdown)
  - Close button (X) in top-right with blur effect
  - AFTER DARK venue name in red accent, large title below
  - Feature chips with green checkmarks (Fast Lane Entry, Premium Bottle, VIP Area, 4 Guests)
  - Clean bid stats row: CURRENT BID ($95), MIN INCREMENT (+$5), DEPOSIT ($25)
  - YOUR BID input with red accent border
  - Quick Add buttons (+$10, +$25, +$50, +$100)
  - "Notify if Outbid" card with bell icon and toggle for push notifications
  - "Enable auto-bid" checkbox option
  - "Place Bid · $100" red gradient button
  - Security badge: "Secure · Deposit refundable if you don't win"
  - Scrollable content area with proper padding

- **Auction UI Redesign (Feb 27, 2025)**:
  - Completely redesigned auction detail modal with premium layout
  - New sections: Description, INCLUDES features, CURRENT BID card with min increment
  - YOUR BID section with large input field and red accent border
  - QUICK ADD buttons (+$10, +$25, +$50, +$100) in horizontal row
  - Prominent "Notify me if outbid" toggle card with push notification description
  - Optional "Set auto-bid maximum" feature
  - Place Bid button shows dynamic amount
  - Bid history section at bottom
  - Clean, premium design matching Luna Group branding

- **Venue Portal Connected to Real APIs (Feb 27, 2025)**:
  - Connected venue portal dashboard to real backend analytics endpoints
  - Added fallback to mock data when real data is unavailable
  - Backend endpoints: /venue/analytics/revenue, /checkins, /demographics, /auctions, /points, /activity, /top-spenders, /vip-alerts
  - Dashboard now fetches live data on mount and when period changes

- **Logo Spacing Fix (Feb 27, 2025)**:
  - Increased top padding for logo on all pages from 16px to 32px
  - Updated PageHeader component and index.tsx home page
  - Logo now has better breathing room in the header area

- **Venue Portal Dashboard Complete (Feb 26, 2025)**:
  - Built premium, high-budget venue analytics dashboard at `/api/venue-portal`
  - Features: QR Code Scanner, User Analytics, Revenue Analytics, Auction Analytics, Points Analytics
  - VIP Alerts with arriving/expected status, Real-time Activity Feed, Top Spenders leaderboard
  - Charts: Revenue Trend, Peak Hours Heatmap, Membership Demographics
  - Export functionality for reports (PDF/CSV)
  - Responsive design for mobile and desktop
  - Login credentials: `venue@eclipse.com` / `venue123`

- **Venue Images Fixed (Feb 26, 2025)**:
  - Updated Eclipse, After Dark, Su Casa Brisbane, and Su Casa Gold Coast venues to use user-provided images
  - Images now served from `/app/backend/static/photos/` via `/api/photos/image/{folder}/{filename}`
  - Fixed missing `ROOT_DIR` in server.py that was causing 500 errors on photo endpoints

## server.py Refactoring ✅ IN PROGRESS (Feb 27, 2025)

### Completed:
- Created modular route architecture in `/app/backend/routes/`
- Extracted 17 route modules (3,400+ lines) from monolithic server.py
- All routes tested and working with 100% pass rate (23/23 tests)
- Testing agent fixed 2 bugs (points_multiplier key access)

### Route Modules Created:
1. `health.py` - Health check endpoint
2. `auth.py` - Authentication (login, register, me)
3. `venues.py` - Venue listing and details
4. `events.py` - Eventfinda integration
5. `auctions.py` - Auction system with auto-bid
6. `rewards.py` - Rewards and redemptions
7. `missions.py` - Missions with progress tracking
8. `referrals.py` - Referral code system
9. `boosts.py` - Point multiplier boosts
10. `photos.py` - Photo galleries
11. `venue_dashboard.py` - Venue staff analytics
12. `bookings.py` - Table reservations
13. `subscriptions.py` - Membership tiers
14. `points.py` - Points balance and history
15. `tickets.py` - Ticket wallet
16. `friends.py` - Friends and social
17. `notifications.py` - Notification management
18. `shared.py` - Shared utilities (push notifications)

### Remaining to Extract:
- Crews API
- Safety/Emergency API
- Payments (Stripe)
- CherryHub integration
- Admin/Seed endpoints
- VIP Table Booking
- Lost & Found
- Promo Codes
- Instagram integration
- Venue Portal static files

## Future Tasks
- Continue server.py refactoring (remaining routes)
- Remove duplicate code from server.py once all routes migrated
- Remove CherryHub mock mode (when DNS available)
- Stripe payment integration for VIP bookings/auctions
- Connect Instagram with production API credentials
- Add "Luna glow" effect enhancement to background
- Implement custom loading screen with Luna logo

## Known Mocked Services
- **CherryHub Integration**: Running in mock mode (DNS not resolvable)
- **Instagram Integration**: Running in demo mode (no API credentials yet)
- **Venue Portal Analytics**: Currently using mock data for demonstration

## Technical Documentation ✅ COMPLETE (Dec 2025)

### Backend API Specification
**Location:** `/app/memory/technical_specification.md` (2,025 lines)

A comprehensive technical specification has been generated covering:
- **Authentication**: JWT token-based auth with HS256 algorithm
- **API Endpoints**: All 75+ endpoints documented with request/response structures
- **Data Models**: 16 MongoDB collection schemas with field types and relationships
- **Real-Time Features**: Push notification system via Expo
- **Configuration**: Environment variables and constants

### Owner's Manual ✅ COMPLETE (Dec 2025)
**Location:** `/app/memory/owners_manual.md`

A comprehensive owner's manual has been created covering:
- **Application Overview**: Full tech stack and architecture
- **Mobile App Features**: All 16+ screens documented with functionality
- **Venue Portal**: Staff dashboard features and usage
- **Third-Party Integrations**: Eventfinda, CherryHub, Instagram
- **Database Structure**: All collections and key schemas
- **Administrator Guide**: User roles, auction management, redemptions
- **Troubleshooting**: Common issues and solutions
- **Future Roadmap**: Planned features and enhancements

### Documented API Groups:
1. Authentication & Users (register, login, profile, email verification)
2. Venues (listing, details, status)
3. Bookings & Guestlist (reservations, availability)
4. Points & Rewards (balance, history, redemption)
5. Missions & Achievements (progress, claiming)
6. Auctions & Bids (bidding, auto-bid, notifications)
7. Subscriptions (tiers, subscribe, cancel)
8. Events (Eventfinda integration, RSVP)
9. Tickets (purchase, guests)
10. Friends & Social (requests, connections)
11. Notifications (preferences, push tokens)
12. Referrals (codes, history)
13. Venue Admin Dashboard (analytics, user management)
14. Venue Admin Auction CRUD (create, update, delete)
15. Venue Admin User Analytics (comprehensive user profiles)

## Phase 10: Leaderboard & Birthday Club ✅ COMPLETE (March 2026)

### Leaderboard Feature ✅
- **UI**: Fun scoreboard list on Wallet page with crown/medal emojis for top 3
- **Rankings**: Shows top 5 users with points, tier badges, and display names
- **Current User Position**: Highlights user's rank if not in top 5
- **Gap to #1**: Shows points needed to reach first place
- **APIs**:
  - GET /api/leaderboard - Rankings by period (all_time, monthly, weekly) and category (points, visits, spend)
  - GET /api/leaderboard/my-stats - Detailed user stats
  - GET /api/leaderboard/strategies - Point-earning tips
  - POST /api/leaderboard/seed-sample-users - Seed demo data

### Birthday Club Feature ✅
- **Birthday Detection**: Rewards unlock 3 days before/after birthday
- **Available Rewards**:
  - Free Entry (any Luna venue)
  - Free Birthday Drink
  - 250 Bonus Points (instant)
  - 2x Points Multiplier (7 days)
- **UI**: Dedicated birthday-club.tsx screen with reward cards, claim buttons
- **Navigation**: Access via Profile > Quick Actions > Birthday Club
- **APIs**:
  - GET /api/birthday/status - Birthday week status and available rewards
  - POST /api/birthday/claim/{reward_id} - Claim birthday reward
  - GET /api/birthday/my-rewards - Claimed rewards history
  - POST /api/birthday/redeem/{claim_id} - Redeem at venue

## Test Reports
- /app/test_reports/iteration_10.json - Modular routes refactoring test (Feb 27, 2025) - 100% pass rate
- /app/test_reports/iteration_12.json - Full app deep-dive (Feb 27, 2025)
- /app/test_reports/iteration_7.json - Backend test (Feb 25, 2025)

## Pending Technical Debt
- **server.py Cleanup**: Remove duplicated endpoint definitions (7745 lines → ~500 lines)
  - Routes have been modularized into `/app/backend/routes/`
  - Old inline definitions in server.py should be removed
  - Risk: Medium - requires careful testing after cleanup

## Known Infrastructure Issues
- **CherryHub Integration**: Network DNS resolution blocked in container (use MOCK_MODE=true)
- **Venue Portal Caching**: CDN caches aggressively, use hard refresh (Cmd+Shift+R)
- **Expo Tunnel**: Occasional ngrok timeout, restart expo service if needed

