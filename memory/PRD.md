# Eclipse VIP App - Product Requirements Document

## Overview
Premium nightclub VIP operating system for Eclipse Brisbane - a native iOS/Android app built with Expo React Native.

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
- Accent Red: #CC0000
- Success Green: #00FF00
- Warning Gold: #FFD700
- Premium Gold: #D4AF37

## Technical Stack
- Frontend: Expo React Native
- Backend: FastAPI + MongoDB
- Auth: Emergent Google OAuth
- State: Zustand

