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

### Events Calendar ✅
- Upcoming events display
- RSVP functionality

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
- Social Feed (mock data)
- Venues page with category filters (All/Nightclubs/Dining)
- Rewards page overhauled with new missions and Buy Points UI
- App-wide font standardization to Montserrat
- Header redesign (removed rotating moon, larger logo)
- Profile page with Quick Actions hub for Photos, Social, Auctions, Rewards, Referrals

## Upcoming Tasks (P1)
- Connect "Buy Points" UI to CherryHub API
- Implement Promo Code validation feature
- Instagram integration for Social Feed

## Future Tasks
- Remove CherryHub mock mode (when DNS available)
- Stripe payment integration for VIP bookings/auctions

## Known Mocked Services
- **CherryHub Integration**: Running in mock mode (DNS not resolvable)
- **Social Feed**: Using hardcoded mock data
