# Luna Group VIP App - Product Requirements Document

## Latest Update: April 17, 2026 - Session 3

### COMPLETED: Social Feed + Night Builder
- **Instagram removed** entirely (routes, backend, references)
- **Social tab** replaces Photos in the tab bar (Tonight | Venues | Wallet | Social | Profile)
- **Activity Feed**: See what Luna members are interested in (Facebook-style). Like activity. Visibility: public/friends/private
- **Night Builder**: Plan multi-venue nights (dinner → drinks → dance), invite friends/crew, create polls, vibe score gamification
- **Points**: +5 for expressing interest, +10 for creating a night plan, +5 for accepting an invite

### COMPLETED: Google Wallet (was blocked)
- `GOOGLE_SERVICE_ACCOUNT_JSON` env var set — Google Wallet pass generation now working

### COMPLETED: Push Broadcasts API for Lovable Dashboard
### COMPLETED: Lovable Admin CRUD (Missions/Rewards/Boosts)
### COMPLETED: Milestones with QR Tickets
### COMPLETED: Staff Portal + SwiftPOS Middleware
### COMPLETED: VIP Tables + Bottle Service + Geofence Fix

## Tab Bar (5 tabs)
Tonight | Venues | Wallet | **Social** | Profile

## Test Reports
- iteration_31: 100% (40/40) Social Feed + Night Builder
- iteration_30: 100% (22/22) Milestones + QR Tickets
- iteration_29: 100% (28/28) Staff Portal + SwiftPOS
- iteration_28: 100% (41/41) VIP Tables + Bottles

## Pending
- Stripe live keys (P1, user providing)
- SwiftPOS reseller credentials (P2)
- EAS production build for App Store

## Credentials
- User: `luna@test.com` / `test123`
- Admin: `admin@lunagroup.com.au` / `Trent69!`
- Venue: `venue@eclipse.com` / `venue123`
