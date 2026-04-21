# Luna Group VIP App - Product Requirements Document

## Latest Update: April 21, 2026 - Session 9

### COMPLETED: Brand Assets + Live Stripe + Subscription Web-Out

- **New Luna Group Hospitality brand icon** applied: source logo (594×1146) processed into:
  - `icon.png` 1024×1024 (iOS App Store)
  - `splash-icon.png` 512×512
  - `adaptive-icon.png` 1024×1024 with 700×700 safe-zone foreground (Android)
  - `favicon.png` 48×48
- **Live Stripe secret key** (restricted key) added to `backend/.env` → `STRIPE_API_KEY=rk_live_51KOwmp...`. Backend restarted; bottle service deposits now charge real money.
- **Subscriptions moved OUTSIDE the app** (Apple IAP compliance) — paid tier tap opens `https://lunagroup.com.au/subscribe?tier={tierId}` in system browser via `expo-web-browser`. Free tier still switches in-app. This uses Apple's "reader app" exception which is the cleanest path to approval.

## Latest Update: April 20, 2026 - Session 8

### COMPLETED: Phase A — Hard Blockers for App Store + Play Store Approval

**iOS submission-blocking issues resolved:**
- `splash-icon.png` asset restored (was missing, causing build failure)
- Added 9 concrete iOS Info.plist permission strings (Location background, Microphone, FaceID, Tracking, Calendars, etc.)
- Added `ITSAppUsesNonExemptEncryption = false` — skips Apple's 24h encryption review delay
- Added `UIBackgroundModes: [location, fetch, remote-notification]`
- Added `associatedDomains: applinks:lunagroup.com.au` + APS production entitlement
- Added `buildNumber: 1`

**Android submission-blocking issues resolved:**
- Blocked deprecated `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` (Play Store auto-flags these)
- Added Android 13+ modern permissions: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `POST_NOTIFICATIONS`
- Added background location permissions: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`
- Added `versionCode: 1`

**Expo plugins properly registered** (were missing — would crash on fresh iOS 18):
- `expo-location` with foreground + background permission strings
- `expo-notifications` with icon + brand gold `#D4A832`
- `expo-image-picker` with photo/camera strings

**Apple-mandatory Account Deletion verified:**
- Backend `DELETE /api/auth/account` endpoint confirmed (soft-delete + email anonymization). Tested via curl: returns `{success: true}`.
- Frontend UI exists at `/settings` with 2-step confirmation flow.

**Submission guide created:** `/app/STORE_SUBMISSION.md` — tracks all remaining Phase B (user-provided URLs + brand assets + monetization decision), Phase C (store listing copy drafts), Phase D (Privacy Nutrition / Data Safety answers), and EAS build commands.

**Awaiting from user (blocks submission):**
- Public Privacy Policy + Terms + Support URLs
- Luna-branded 1024×1024 app icon + splash icon
- Luna+ subscription monetization decision (Stripe/IAP/free)
- Apple Developer + Google Play Console access/credentials

## Latest Update: April 20, 2026 - Session 7

### COMPLETED: Ember & Ash Menus + Coming Soon Removed + Gold Rays on Hero Card
- **Coming Soon removed** — `/app/frontend/app/venue/[id].tsx` now returns 'Book a Table' for `ember_and_ash` (was 'Coming Soon'). Venue is live.
- **Ember & Ash menus** — added to `/app/backend/routes/venue_menus.py`:
  - `ember_and_ash` — Restaurant: Snacks, Small Plates, Large Plates, Steaks, Sides, Chef's Experiences ($99 pp), Wagyu Tasting ($225 pp), Desserts, Signature Cocktails, Wine By Glass, Spirits
  - `ember_and_ash_cafe` — Cafe: Bagels, Sourdough, Signature Dishes, Coffee & Matcha (espresso $4.50 etc.), Cold Drinks
  - Items without explicit prices from the source website are labelled **MP** (market price). Frontend `venue-menu.tsx` renders `MP` cleanly.
- **View Menu CTA** — `ember_and_ash` added alongside `juju` and `night_market` on venue detail page.
- **Hero Card — Gold Glow + Rotating Rays** — new `HeroGlow` component in `/app/frontend/app/(tabs)/index.tsx`: 12 SVG polygon rays rotating every 24s + pulsing radial gold halo (2.2s breath). Card border swapped from `rgba(255,255,255,0.15)` to `rgba(212,168,50,0.65)` (brand gold).
- **Testing** — Backend JuJu/Night Market/Ember & Ash/Ember & Ash Cafe menu endpoints all return 200 with correct category counts via curl.

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
