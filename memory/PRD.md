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
- **Venue Images Fixed (Feb 26, 2025)**:
  - Updated Eclipse, After Dark, Su Casa Brisbane, and Su Casa Gold Coast venues to use user-provided images
  - Images now served from `/app/backend/static/photos/` via `/api/photos/image/{folder}/{filename}`
  - Fixed missing `ROOT_DIR` in server.py that was causing 500 errors on photo endpoints

## Future Tasks
- Complete server.py refactoring (move API routes to /routes directory)
- Complete Venue Web Portal UI and make externally accessible
- Remove CherryHub mock mode (when DNS available)
- Stripe payment integration for VIP bookings/auctions
- Connect Instagram with production API credentials
- Add "Luna glow" effect enhancement to background
- Implement custom loading screen with Luna logo

## Known Mocked Services
- **CherryHub Integration**: Running in mock mode (DNS not resolvable)
- **Instagram Integration**: Running in demo mode (no API credentials yet)

## Test Reports
- /app/test_reports/iteration_7.json - Latest backend test (Feb 25, 2025)

