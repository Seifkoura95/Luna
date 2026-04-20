# Luna Group VIP App - Product Requirements Document

## Latest Update: April 20, 2026 - Session 6

### COMPLETED: VIP Table Removal + Eclipse Real Menu + Venue Menus
- **VIP Table Booking REMOVED** globally — deleted `table-booking.tsx`, 4 backend endpoints (`POST /table`, `/table/{id}/deposit`, `/table/{id}/confirm`, `GET /my-tables`), `TableBookingCreate` model, all api.ts methods, Profile quick-action, and venue-page CTA.
- **Eclipse bottle menu** — replaced 7 mock items with 48 real items from client's PDF across Vodka, Gin, Tequila, Scotch, Rum, Bourbon, Liquor, Cognac, Champagne. Prices $200–$2500.
- **Bottle service Eclipse-only** — BOTTLE_MENUS now has only 'eclipse' key; backend rejects non-Eclipse orders with 400; frontend picker collapsed to single venue.
- **Deposit formula** — `max($50, total × 10%)`. Stripe charges deposit only; balance collected at venue. DEV_MODE for `luna@test.com` skips Stripe.
- **JuJu's & Night Market view-only menus** — new `/app/backend/routes/venue_menus.py` endpoint `GET /api/venues/{id}/menu` + new `/app/frontend/app/venue-menu.tsx` screen with Food/Drinks tabs, category sections, $price display. Reachable via "View Menu" CTA on venue detail.
- **Testing** — `iteration_33.json`: 26/26 backend tests PASSED (100%).

## Latest Update: April 20, 2026 - Session 5

### COMPLETED: Stripe Enforcement + Points Overhaul + Luna AI Polish
- **P0 Stripe enforcement** — All paid flows (table deposits, bottle pre-orders, paid subscriptions) now create real Stripe checkout sessions and return `checkout_url`. Points awarded ONLY after `checkout.session.completed` webhook. DEV_MODE bypass gated to `luna@test.com` for testing.
- **Points rate** — Changed `POINTS_PER_DOLLAR` from 1 → 10. 10 pts = $0.25 = 25% effective cashback.
- **Leaderboard fix** — Replaced broken `api.get()` with `apiFetch()` in `/app/frontend/app/(tabs)/leaderboard.tsx` (backend was always fine).
- **Luna AI UI** — New `aiMoon` crescent+sparkle SVG icon replaces generic sparkles in tab bar, header avatar, and message bubbles. Fixed the input-bar-to-tab-bar gap by removing redundant `insets.bottom` padding and tuning `keyboardVerticalOffset`.
- **Cashback messaging** — "Earn 25% back in Luna Points" on Rewards Shop header + Profile points label ("LUNA POINTS · 25% BACK"). Conversion badge updated: 10 pts → $0.25 back. Onboarding Rewards slide updated with exact ratio.
- **Testing** — iteration_32.json: 18/18 backend tests PASSED.

## Latest Update: April 20, 2026 - Session 4

### COMPLETED: First-Time Onboarding Carousel
- **5-slide animated onboarding** added at `/app/frontend/app/onboarding.tsx` (Welcome → Venues → Events → Rewards → VIP)
- Gated by AsyncStorage key `luna_onboarding_complete` — shown once per install
- `index.tsx` routes unauth'd first-time users to `/onboarding`; returning users go straight to `/login`
- Adapted to expo-router + existing app design tokens (blue accent, gold for Rewards slide, system fonts)
- Skip button + final "Get Started" both mark complete and navigate to `/login`

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
