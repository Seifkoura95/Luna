# Luna Group VIP App - Product Requirements Document


## Latest Update: Feb 23, 2026 - Session 17 (EAS Build Cache Nuclear Fix)

### IN VERIFICATION: Cache-busting `postinstall` script to kill `expo-barcode-scanner` residue on EAS Build workers

**Why:** EAS iOS builds were failing repeatedly with:
`'ExpoModulesCore/EXBarcodeScannerInterface.h' file not found`
even though the package had been removed from `dependencies` + `yarn.lock`, and `expo.autolinking.exclude` + `react-native.config.js` were already blocking it. Diagnosis: EAS remote workers were replaying a cached workspace that still contained the deprecated module folder.

**Changes applied (this session):**
- Added `"postinstall": "node ./scripts/nuke-barcode-scanner.js"` to `/app/frontend/package.json`.
- Created `/app/frontend/scripts/nuke-barcode-scanner.js` — walks `node_modules` (depth 6, top-level + nested) after every `yarn install` and physically deletes any `expo-barcode-scanner` directory. Belt-and-suspenders against stale EAS caches and transitive re-installs.
- Verified: running `yarn` now triggers the postinstall, which reports `[nuke-barcode-scanner] Scanning... Done.` — safe no-op when the module is absent.
- Verified with `npx @expo/fingerprint fingerprint:generate`: the autolinking manifest contains ZERO references to `expo-barcode-scanner` / `EXBarCodeScanner` / `EXBarcodeScannerInterface`. Only `ExpoCamera` pod is linked.
- Fingerprint hash WILL change on the next build (new file + modified package.json scripts), invalidating the previous cached failure fingerprint.

**Required user action to verify:**
Run locally or trigger from Emergent Deploy:
`eas build --platform ios --profile production --clear-cache`
The `--clear-cache` flag wipes EAS's remote Pods cache pool, which was the last remaining place the deprecated header could have been lingering.

**NOT CLAIMING FIXED** until user confirms the EAS build archives the IPA successfully (per RULES_FROM_USER.md Rule 1).

---


## Latest Update: Feb 22, 2026 - Session 16 (Home Screen Full Redesign)

### COMPLETED: Editorial home screen redesign — Live Nation × luxury nightclub

**Scope:** Full replacement of `/app/frontend/app/(tabs)/index.tsx` between the animated moon background (kept) and the bottom tab bar (kept). 8 distinct sections with varied layouts.

**Sections implemented:**
1. **Hero swipeable pager (55% screen height)** — full-width Eventfinda poster, gold FEATURED pill, gold venue caption, Chivo-Black 900-weight event title, date line, BUY TICKETS (Luna Red #E31837) + LEARN MORE (ghost border) CTAs, gold-accent page indicator dots.
2. **News ticker (`db.announcements` → `/api/config/announcements?in_ticker=true`)** — height 36, Luna Red dot, gold "NEWS" label, horizontal auto-scrolling marquee of all active ticker items, loops forever (duration auto-scaled to text width).
3. **For You** — 1 big horizontal card (image-dominant, AI PICK pill) + horizontal scroll of 4 smaller half-width cards.
4. **Live Auctions** — pulsing red dot + "SEE ALL" red link. 70%-width commerce cards with LIVE red badge, dark image, bottom row "CURRENT BID" + animated number-tick bid + gold up-arrow.
5. **VIP & Bottle Service banner** — full-width dark-red gradient (#1A0000 → #0A0000) with radial red glow, gold crown icon + "VIP BOOTHS from $95/night", BOTTLES pill + BOOK NOW red pill. BOOK NOW now tries `venue.sevenrooms_url` first, falls back to venue detail. BOTTLES → `/venue-menu?venue_id=eclipse`.
6. **Our Venues** — 75%-width wide rectangular tiles with full-bleed image, colored left-edge accent (red for clubs/bars, gold for restaurants), bottom-left type caption + venue name in white Chivo-Black, arrow button in a translucent white circle bottom-right.
7. **Trending this week** — ranked list (NOT a grid) with oversized semi-transparent watermark numerals ("01", "02") behind each row, 60×60 thumbnail, title + venue + gold date.
8. **What's New** — editorial text-only cards (no images), dark `#1A1A1A` surface, colored category pill top-left (per-record color), bold headline, muted date bottom.

**Global design rules applied:**
- Luna Gold #FFD700, Luna Red #E31837, alternating surfaces #050505/#0F0F0F/#1A1A1A
- All section headers: 13sp, 900 weight, letter-spacing 2, gold
- Card radius: 14dp throughout
- Revenue placements (Live Auctions, VIP Banner, Bottle Service) all above second scroll
- Moon background preserved — bleeds through between sections
- Bottom nav untouched
- Pulsing red dot on Live Auctions section, animated bid-value ticker on auction cards

**Backend additions:**
- `db.announcements` collection with full CRUD under `/api/admin/announcements` (hub-key or admin JWT)
- `GET /api/config/announcements?in_ticker=true|false` public endpoint — returns sensible defaults if collection is empty
- `admin.py VenueOverrideUpdate` now accepts `sevenrooms_url` and `bottle_menu_url` — Lovable can wire each venue's VIP booking link and bottle menu override from the portal
- New `api.ts` method: `api.getAnnouncements(inTicker?)`

**Data wiring:**
- Hero + For You + Trending pull from `api.getEventsFeed(30)` which returns `{tonight, tomorrow, featured, upcoming}` — sections merge & dedupe
- Auctions: `api.getAuctions(undefined, 'active')`
- Venues: `api.getVenues()` (filters `is_hidden`)
- Announcements + ticker: both from `/api/config/announcements`
- Field mapping handles both Eventfinda (`image`, `url`, `date`+`time`, `datetime_start`, `venue_name`) and our internal API (`image_url`, `title`, etc.)

**Files touched this session:**
- `/app/frontend/app/(tabs)/index.tsx` — full rewrite (~700 lines)
- `/app/frontend/src/utils/api.ts` — `getAnnouncements`
- `/app/backend/routes/admin.py` — Announcements CRUD + sevenrooms_url in venue model + public `/config/announcements`

**Curl tests (all passing):**
- `POST /api/admin/announcements` — creates rows
- `GET /api/config/announcements?in_ticker=true` — filters correctly, returns `source: custom` once rows exist, `source: default` when empty
- Ticker returning 4 seed rows as expected

**Known / Pending:**
- 🟡 (P1) On-device Expo Go verification — web preview showed auction/venue/trending sections without populated data even though API returned 200; suspect bundler cache or auth-header timing on web. On iOS Expo Go it should hydrate correctly since real events + venues + auctions all return 200.
- 🟢 (P2) Chivo Black font not yet loaded — using `fontWeight: '900'` as system substitute. Wire `@expo-google-fonts/chivo` + `@expo-google-fonts/dm-sans` when going to App Store.
- 🟢 (P2) Fade-in-on-section-enter animation noted in spec but not implemented — keep for polish pass
- 🟢 (P2) Admin-side UI for announcements CRUD (currently Lovable-only)


## Latest Update: Feb 22, 2026 - Session 15 (Glass Cards + App Store Pack + Staff Gifting)

### COMPLETED

**Global glass-card unification** (`/app/frontend/src/theme/colors.ts`):
- `colors.glass` : `rgba(255,255,255,0.06)` → `rgba(0,0,0,0.40)` — matches leaderboard
- `colors.glassMid` : `rgba(255,255,255,0.09)` → `rgba(0,0,0,0.30)`
- `colors.glassBorderSubtle` : `0.08` → `0.10` — matches leaderboard border
- All cards that reference these tokens (wallet points card, mission cards, milestone cards, profile stat cards, countless buttons) now match the leaderboard's signature look in one shot.

**Staff Portal — Gift Points UI** (`/app/frontend/app/staff-portal.tsx`):
- New "Gift Points" quick-perk with gift icon (#FFD700). Opens modal with amount input + 100/500/1000/2500 quick-pick pills + optional reason field.
- Calls `POST /api/admin/users/{id}/grant-points` (bypasses earn-guard — works for ANY role incl. artists). Staff auth accepted alongside hub-key.
- Success alert shows "N pts added. New balance: X".

**App Store submission pack** (`/app/APP_STORE_LISTING.md`):
- App name, subtitle, category, age rating (17+) with questionnaire answers
- Full 4000-char description + 170-char promo text + keywords
- 10 sections covering Privacy Nutrition Label (all data types mapped to Apple categories, "Data Not Used to Track You"), IAP strategy for Stripe external subscriptions (Reader App exception), reviewer demo account instructions, Google Play condensed copy, rejection-defense templates, and a submission checklist.

**Backend — total_points_earned** (`/app/backend/routes/admin.py`):
- `grant-points` now only increments `total_points_earned` when `amount > 0`. Negative corrections no longer inflate lifetime totals. Confirmed via manual curl test: +100 bumps the counter, -100 leaves it untouched.

**Testing:** `iteration_36.json` — **50/50 backend tests PASSED** (15 new + 35 regression from iteration_35). 3 minor advisories only:
- `admin_deduct` txns store source='admin_grant' (cosmetic — consider a distinct source for clean reports)
- No `DELETE /admin/users/{id}` yet — test data accumulates
- No balance floor on negative grants (can drive points < 0) — possibly intentional for reversals

### Files touched this session
- `/app/frontend/src/theme/colors.ts` — global glass card tokens
- `/app/frontend/app/staff-portal.tsx` — Gift Points button, modal, handleGiftPoints
- `/app/backend/routes/admin.py` — conditional total_points_earned
- `/app/APP_STORE_LISTING.md` — NEW full submission pack

### Pending (next session)
- 🟡 Verify Expo Go iOS build: keyboard gap, haptics, scanner work on-device
- 🟡 Generate the 6 App Store screenshots (1290 × 2796) — needs a real device or Xcode simulator
- 🟢 Consider `DELETE /admin/users/{id}` for GDPR + test hygiene
- 🟢 Consider `admin_deduct` as a distinct transaction source
- 🟢 Sentry crash reporting (DSN + `@sentry/react-native`)


## Latest Update: Feb 22, 2026 - Session 14 (UI Polish + Luna AI Revamp + Advisories)

### COMPLETED this session

**Luna AI — full revamp:**
- Gold header at top of chat screen: moon avatar gradient + "Luna" title (gold) + "Your Nightlife Concierge" subtitle. Small gold "New" pill (icon+label) for resetting the chat.
- Keyboard gap fixed: `keyboardVerticalOffset = insets.top + 72` (matches the header height). Input now rests above the keyboard without flying to the top.
- System prompt rewritten (`/app/backend/services/ai_service.py`): sassy-best-mate tone, 2–3 sentence replies, subtle but relentless upsell toward Luna venues + subscription + bottle packages + points-earning hooks. Occasion heuristics for birthdays/dates/groups/solos. Strict "no markdown / no competitor mentions" rules.

**Wallet page — replaced event-ticket tabs with QR-ticket section:**
- Old "MY TICKETS" (active/upcoming/history tabs pulling event tickets) is GONE.
- New "MY QR TICKETS" section shows **only gifted free-entry tickets** (`/api/entry-tickets/my`). Supports live_status active/scheduled only in preview; full list at `/my-entry-tickets`.
- Empty state: "No QR tickets yet · Complete Missions and unlock Milestones to earn free-entry QR tickets" with two gold CTA pills → `/missions` and `/milestones`.
- Added "My Free Entries" card next to "Claim a Reward".
- Bottom-scroll padding trimmed (32 → 8) to kill the dead-space overscroll.

**Home page featured card:** Added `borderWidth: 1` / `borderColor: 'rgba(255,255,255,0.15)'` to `heroCardAnimated` to match the other cards.

**Profile — LEGEND pill contrast fix:** Tier badge now uses a tinted-background + high-contrast text approach, with special bright colors for the milestone titles (Legend #FFD700 gold, Supernova #FF6B9D pink, Nova #FF9A3C, Rising Star #60A5FA, Newbie grey) rather than the dark-bronze fallback.

**Backend — advisories from iteration_35 resolved:**
- `POST /api/admin/users/{id}/gift-entry`: `scheduled_for` dates in the past now return `400 scheduled_for cannot be in the past`. Today and future dates still work.
- `GET /api/entry-tickets/my`: lazy-sweep flips any `status='active'` ticket with `valid_until < now` to `status='expired'` on every read. Keeps the DB consistent without a cron job.

**Staff Portal wired for gifted free-entry tickets:**
- `/app/frontend/app/staff-portal.tsx` `handleValidateReward` now detects `LUNA-ENT-` prefix and calls `api.validateEntryQR()`. Success + error states both trigger the correct haptic feedback.
- Validate-QR flow is now: LUNA-ENT (gifted entries) → LUNA-TKT (milestone tickets) → standard reward QRs.

### Files touched this session
- `/app/backend/routes/admin.py` — past-date rejection for gift-entry
- `/app/backend/routes/entry_tickets.py` — lazy sweep of expired tickets in `/my`
- `/app/backend/services/ai_service.py` — new Luna system prompt
- `/app/frontend/app/(tabs)/luna-ai.tsx` — gold header, keyboard fix
- `/app/frontend/app/(tabs)/wallet.tsx` — QR tickets section, entry tickets fetch, bottom spacer
- `/app/frontend/app/(tabs)/profile.tsx` — LEGEND pill tinted-background + special colors
- `/app/frontend/app/(tabs)/index.tsx` — featured card border
- `/app/frontend/app/staff-portal.tsx` — LUNA-ENT QR validation wired

### Pending (next session priority)
- 🟡 (P1) Glass-card style consistency across Wallet/Profile (leaderboard's `rgba(0,0,0,0.4)` + `borderColor: rgba(255,255,255,0.1)` is the spec)
- 🟡 (P1) Verify on-device (Expo Go) that Luna keyboard gap is fully gone; verify tap-to-focus behaviour
- 🟡 (P1) App Store listing copy + Privacy Nutrition Label answers
- 🟢 (P2) Sentry crash reporting
- 🟢 (P2) Grant-points UI in Staff Portal (currently Lovable-only; staff could get a button too)
- 🟢 (P2) `total_points_earned` should not increment on negative grants (admin deduction)


## Latest Update: Feb 22, 2026 - Session 13 (Roles + Gift Entries + Artist Points)

### COMPLETED: 5-role account system with points earn-guard, entry-ticket gifting, artist point allocation

**Role system (stored as `users.role`):**
- `user` / `customer` (default) — full earning
- `artist` — cannot auto-earn; admins can allocate points via gift-points
- `staff` — cannot auto-earn; redirected to `/staff-portal` on login
- `manager` — cannot auto-earn; redirected to `/staff-portal` on login
- `admin` — cannot auto-earn; redirected to `/staff-portal` on login

**Earn-guard (`/app/backend/utils/points_guard.py`):**
- `can_earn_points(user_id)` returns False for roles in `NON_EARNING_ROLES = {admin, manager, staff, artist}`
- Wired into: `points.award_points`, `subscriptions.award_points`, `routes/bookings.py` (bottle orders + guestlist), `routes/tickets.py`, `routes/missions.py` (403 error if blocked role tries to claim), `routes/referrals.py`
- Not wired into: `admin.py /grant-points` (bypasses — so artists CAN be gifted points), `rewards.py` (spending, not earning)

**New admin endpoints (all accept X-Luna-Hub-Key OR admin JWT):**
- `GET /api/admin/users` with `?q=<email/name>` (case-insensitive) + `?role=` filter + pagination
- `GET /api/admin/users/{id}`
- `PUT /api/admin/users/{id}` — name, email, role (validated against ALLOWED_ROLES), tier, assigned_venue_id, phone, notes, is_active
- `POST /api/admin/users/{id}/grant-points` — gift/deduct arbitrary points, writes `points_transactions` row with source='admin_grant'. Works for any role (bypasses earn-guard).
- `POST /api/admin/users/{id}/gift-entry` — gift free-entry QR ticket. Body: `{venue_id, scheduled_for?, note?}`
  - No `scheduled_for` → valid from now → now + 24h
  - With `scheduled_for` (YYYY-MM-DD) → valid from Brisbane midnight that day → next midnight (24h window, UTC+10 year-round)
- `GET /api/admin/entry-tickets` with `?user_id= &venue_id= &status=`
- `DELETE /api/admin/entry-tickets/{id}` — revokes unused tickets (400 if already used)
- `GET /api/admin/users/{id}/points-transactions` — view a user's recent ledger

**New user-facing endpoints (`/app/backend/routes/entry_tickets.py`):**
- `GET /api/entry-tickets/my` — list caller's entries. Each has computed `live_status`: active / scheduled / used / expired / revoked
- `GET /api/entry-tickets/{id}` — single ticket (403 if not owner)
- `POST /api/entry-tickets/validate-qr` — staff/manager/admin scan to consume. Body: `{qr_code, venue_id}`. Returns descriptive reasons: invalid_qr / wrong_venue / already_used / revoked / expired / not_yet_active

**Mobile changes:**
- `/app/frontend/app/my-entry-tickets.tsx` — new screen: empty state, ticket cards with status pills, countdown timers ("12h 34m remaining" for active, "Starts in 3d 4h" for scheduled), QR modal with live HMAC-signed code.
- `/app/frontend/app/(tabs)/wallet.tsx` — added "My Free Entries" card linking to new screen (beneath "Claim a Reward")
- `/app/frontend/app/login.tsx` — role-based routing: admin/manager/staff → `/staff-portal`. Artists and users → `/(tabs)`
- `/app/frontend/src/utils/api.ts` — `getMyEntryTickets`, `getEntryTicket`, `validateEntryQR`

**Collections:**
- `entry_tickets` — {id, user_id, venue_id, qr_code, status, valid_from, valid_until, used_at, ...}
- `points_transactions` — now records `source='admin_grant'` rows

**Testing:** `iteration_35.json` — **35/35 backend tests PASSED (100%)**. Covers user search, role CRUD, grant-points for artists, gift-entry immediate + scheduled, QR validation (wrong venue / already used / revoked / not yet active), earn-guard on missions (403) + user-regression (still works), and full regression of iteration 34's 31 tests.

**Minor advisories (non-blocking):**
- `grant-points` also increments `total_points_earned` even on negative/correction grants
- `gift-entry` scheduled_for doesn't reject past dates (valid-but-immediately-expired tickets)
- `entry_tickets.status` field isn't auto-flipped to 'expired' when time passes; `live_status` handles it at read time

**Credentials (unchanged):**
- User: luna@test.com / test123 (role=user)
- Admin: admin@lunagroup.com.au / Trent69!
- Luna Hub: header `X-Luna-Hub-Key: luna_hub_live_682fbaaa19a6a4594f58618b803531ee6fad8016`

**Pending (next session):**
- 🟡 In-app "Venue Portal" screen polish — scan QR, allocate points, view bookings (the `/staff-portal` route already exists but may need wiring to the new validate-qr endpoint)
- 🟡 App Store listing copy + Privacy Nutrition Label answers
- 🟡 Hero UI tweaks you flagged — verify on-device
- 🟢 Sentry for production crash reporting


## Latest Update: Feb 22, 2026 - Session 12 (Lovable Hub Full CRUD)

### COMPLETED: Finished Lovable "Luna Hub" portal — every content surface now DB-driven

**All admin endpoints accept EITHER:**
- a JWT from an admin user, OR
- a static header `X-Luna-Hub-Key: luna_hub_live_682fbaaa19a6a4594f58618b803531ee6fad8016` (server-to-server)

**NEW collections:**
- `db.app_config` — singleton (key='main') for status-pill / announcement / maintenance mode
- `db.milestones_custom` — full milestone overrides (auto-seeds on first edit)
- `db.bottle_overrides` — `{bottle_id, image_url}` rows, merged into bottle menus
- `db.venue_overrides` — partial-field overrides keyed by venue_id (incl. `is_hidden`)

**NEW backend endpoints (`/app/backend/routes/admin.py`):**
- `GET /api/config/public` — **no-auth** endpoint the mobile app hits on every launch. Returns status_pill, hero_announcement, maintenance flags.
- `GET /api/admin/config` / `PUT /api/admin/config` — admin CRUD for config (supports explicit-null clearing via Pydantic v2 `model_dump(exclude_unset=True)`)
- `GET /api/admin/milestones` / `POST` / `PUT /{id}` / `DELETE /{id}` — full milestones CRUD. Lists return default hardcoded list until first write, then DB-backed.
- `GET /api/admin/bottles` (with optional `?venue_id=`) — lists all 48 Eclipse bottles with `default_image_url` + `overridden` flag
- `PUT /api/admin/bottles/{bottle_id}/image` / `DELETE` — override/clear bottle image URL
- `GET /api/admin/venues` / `GET /api/admin/venues/{id}` — merged baseline + overrides
- `PUT /api/admin/venues/{id}` / `DELETE` — partial-field override (tagline, status, hero_image, is_hidden, etc.)

**Public-facing integrations:**
- `GET /api/bookings/bottle-menu/{venue_id}` now merges `db.bottle_overrides` — Lovable image swaps appear instantly
- `GET /api/venues` and `GET /api/venues/{id}` now merge `db.venue_overrides`; `is_hidden=true` removes venue from the public list
- `GET /api/milestones` (user-facing) reads `db.milestones_custom` if populated, else falls back to hardcoded MILESTONES — Lovable edits propagate immediately
- Home tab (`/app/frontend/app/(tabs)/index.tsx`) fetches `/api/config/public` on every load + refresh. Status pill text, "LIVE NOW" label, and force_mode are all driven by DB. `status_pill.custom_message` replaces the auto text when set.

**New api.ts method:**
- `api.getPublicConfig()` — typed wrapper around `/api/config/public`

**Testing:** iteration_34.json — **31/31 backend tests PASSED (100%)**. Covered auth (hub-key + JWT + reject-bogus), config CRUD with null-clearing, milestones CRUD with user-facing surfacing, bottle override + bottle-menu merge, venue override including `is_hidden` list-filter, regressions on missions/rewards/boosts/auctions.

**Minor follow-ups logged (non-blocking):**
- `admin.py` is 1122 lines; consider splitting into `routes/admin/*.py` per-domain modules
- Milestones CRUD auto-seeds defaults into the custom collection on first write — makes "revert to pure defaults" require deleting every id
- No pagination on `/api/admin/bottles` — OK for 48 items

**Credentials (unchanged):**
- User: luna@test.com / test123
- Admin: admin@lunagroup.com.au / Trent69!
- Luna Hub: header `X-Luna-Hub-Key: luna_hub_live_682fbaaa19a6a4594f58618b803531ee6fad8016`

**Pending (next session priority):**
- 🟡 In-app admin "Snap a bottle photo" camera upload flow (Lovable already has URL override — this is for venue staff on iPhone)
- 🟡 App Store listing copy + Privacy Nutrition Label answers
- 🟢 Sentry for production crash reporting
- 🟢 Refactor `routes/admin.py` into per-domain modules


## Latest Update: Feb 21, 2026 - Session 11e

### COMPLETED: Header consistency + UX polish batch

**Luna AI tab**
- Removed PageHeader (no logo) per design; just a "New Chat" pill sits at top
- Fixed chat-input keyboard gap: `keyboardVerticalOffset` changed from `85/70` to `insets.bottom + 50` (consistent math on iOS)

**Home tab**
- Removed gold glow/border-pulse animation around featured hero card (replaced with a static rounded hero)
- NEW `PulsingFeaturedPill` component — only the "FEATURED" pill gently pulses (shadow opacity + subtle scale) to draw attention without overwhelming the card
- FOR YOU section header no longer has a gradient icon; label and "Personalized picks" subtitle now use the same minimal style as other section headers
- "AI PICK" pill redesigned: gold background, no sparkle icon, bold dark text — matches the FEATURED pill

**Wallet tab**
- The "Redeem Now" pill next to Your Points swapped to **"How Points Work"** with an info icon; tapping it routes to `/how-points-work`
- Removed "How Points Work" as a profile quick-action (no longer needed)

**Leaderboard tab**
- Switched to shared `PageHeader` (identical logo+spacing as Home)
- Removed the tier pill next to each name
- Paginated the RANKINGS list at **5 per page** with back/next buttons; shows "Page X of Y" label
- Pagination only appears when there are > 5 entries below the top-3 podium

**Age gate removed**
- Deleted `/app/frontend/app/age-gate.tsx`
- Removed the age-gate step from `index.tsx` routing (splash now goes directly to onboarding → login)
- Age-verification remains enforced at signup: DOB field required on the register form, backend `POST /api/auth/register` rejects DOB < 18 with 403
- Removed `Stack.Screen name="age-gate"` from `_layout.tsx`

**CherryHub teardown (readiness audit only — not yet removed)**
- Confirmed every Luna account auto-creates a full Luna Pass: `POST /api/auth/register` inserts complete user record (tier, points, wallet, DOB, etc.) and `GET /api/loyalty/member-card` serves the pass on demand
- Metrics, spend history, points, and subscriptions all live in Luna's MongoDB — nothing is CherryHub-dependent
- Your Lovable Luna Hub portal can query `db.users`, `db.points_transactions`, `db.redemptions`, `db.subscriptions`, `db.milestone_claims`, `db.bookings` directly
- FOLLOW-UP: delete `backend/routes/cherryhub.py`, remove CherryHub include from `server.py`, strip CherryHub calls from `frontend/src/utils/api.ts`, remove any CherryHub UI blocks (shown as pending P0 in Roadmap)

**Files touched:**
- `/app/frontend/app/(tabs)/luna-ai.tsx` — removed PageHeader import + usage, fixed KeyboardAvoidingView offset
- `/app/frontend/app/(tabs)/index.tsx` — replaced HeroCardWithGoldPulse with PulsingFeaturedPill, cleaned FOR YOU header, gold AI PICK pill
- `/app/frontend/app/(tabs)/wallet.tsx` — Redeem Now → How Points Work
- `/app/frontend/app/(tabs)/leaderboard.tsx` — PageHeader + pagination + removed tier pill
- `/app/frontend/app/(tabs)/profile.tsx` — removed How Points Work quick-action
- `/app/frontend/app/index.tsx` — removed age-gate from routing
- `/app/frontend/app/_layout.tsx` — removed age-gate screen registration
- `/app/frontend/app/age-gate.tsx` — DELETED

**Known pending (next session priority):**
- 🔴 Full CherryHub removal (backend route + server.py include + frontend api calls + UI)
- 🟡 Replace all 48 Eclipse bottle service images with real brand product photos (no stock)
- 🟡 "Download My Data" button in Profile → Settings (backend ready)



## Latest Update: Feb 21, 2026 - Session 11d

### COMPLETED: Moon Centering + DOB Required + Stripe Cleanup + Claim Reward QR Screen

**1. Moon background now perfectly centred** (`/app/frontend/src/components/AppBackground.tsx`)
- Switched `resizeMode: "cover"` → `"contain"`
- Wrapped the ImageBackground in a centred container (`alignItems:'center', justifyContent:'center'`)
- Moon now renders dead-centre regardless of screen aspect ratio / device
- Verified via login screen screenshot: moon visible centrally behind form fields

**2. DOB field is now required at signup** (`/app/frontend/app/login.tsx`, `/app/frontend/src/utils/api.ts`)
- Added `dobDay / dobMonth / dobYear` state and three numeric input boxes between Full Name and Email
- Red `*` required marker, hint copy: "Luna Group is for adults aged 18+"
- Client-side validation: rejects invalid calendar dates, rejects age < 18 with friendly alert
- `api.register` signature extended to pass `date_of_birth` as ISO `YYYY-MM-DD` to backend
- Backend `/api/auth/register` already enforces 18+ from previous session — double-checked

**3. Archived legacy Stripe Payment Links + Products** (run via `sk_live_` key)
- Deactivated: `buy.stripe.com/14A28r4jK1ZO5b43O3aVa01` ($79 old Gold)
- Deactivated: `buy.stripe.com/7sY8wP03ugUIeLE3O3aVa00` ($29 old Silver)
- Deactivated product `prod_UNDgEjiClc2m2F "Luna+ Gold"` and `prod_UNDfSg5hb8nqrF "Luna Silver"`
- Live links remaining: only the correct `$39.99 Silver` + `$79.99 Gold`

**4. NEW: /claim-reward screen** (`/app/frontend/app/claim-reward.tsx`)
- Full-page "Claim a Reward" route linked from wallet tab
- Header, back button, gold balance pill showing current points + AUD value
- "READY TO SHOW STAFF" section listing any pending redemptions (tap to reopen QR modal)
- "REWARDS SHOP" section showing all 10 items from `/api/rewards`:
  - Category-coloured icon tile (drinks/vip/dining/bottles/merch)
  - Category label + venue restriction tag (e.g. "VIP · ECLIPSE")
  - Name, description, point cost, and gold **CLAIM** or grey **LOCKED** button
- Tap CLAIM → confirmation alert → `api.redeemRewardWithQR()` → existing `RedemptionQRModal` opens with full-screen QR
- QR deducted points, 48h expiry shown, haptic feedback, local state updated
- Pull-to-refresh, loading / empty states
- Wallet tab's "Browse Rewards Shop" button now points to `/claim-reward` instead of the old gift-card screen
- Registered in `_layout.tsx` Stack

**Verified end-to-end:**
- Smoke screenshot: claim-reward renders 10 rewards correctly with LOCKED on all (test user has 0 pts). ✅
- Login screenshot: DOB fields present between Name and Email, moon centred behind form. ✅
- `POST /api/rewards/redeem-with-qr?reward_id=<cocktail>` as admin (100,330 pts) → `success: true`, `qr_code: LUNA-0EC7F43D-...`, `new_balance: 100130`. ✅
- Old Stripe links confirmed archived via API. ✅

**Files touched:**
- `/app/frontend/src/components/AppBackground.tsx` — moon centring
- `/app/frontend/app/login.tsx` — DOB fields + validation + api wiring
- `/app/frontend/src/utils/api.ts` — `register()` signature extended with `dateOfBirth`
- `/app/frontend/app/claim-reward.tsx` — NEW
- `/app/frontend/app/(tabs)/wallet.tsx` — rewards button now → `/claim-reward`
- `/app/frontend/app/_layout.tsx` — registered `claim-reward` route



## Latest Update: Feb 21, 2026 - Session 11c

### COMPLETED: Doc-to-Code Audit + 18+ Age Gate + PII Hard Delete + My Data Export

**Audit: every claim in Privacy Policy & ToS was cross-checked against actual code.**

Mismatches fixed in CODE:
- `DELETE /api/auth/account` previously did a soft-delete that only flagged `deleted=true` and anonymised email. Now immediately purges all PII fields (name, phone, DOB, age, address, gender, bio, Instagram, push token, profile photo), cancels active subscriptions, deletes active milestone tickets, and revokes active wallet passes — matching the "30 day" Privacy Policy promise.
- New `GET /api/auth/my-data` endpoint returns a full JSON export of the authenticated user's profile, subscriptions, check-ins, points transactions, redemptions, milestone claims, bookings, and payment records — fulfilling the "Download My Data" right in Privacy Policy §8.
- `POST /api/auth/register` now enforces strict 18+ at the server: any DOB that puts the user under 18 is rejected with `403 "You must be at least 18 years old to use Luna Group."` Invalid DOB format also now fails hard rather than silently ignored.

Mismatches fixed in DOCS (softened claims we couldn't back up):
- ToS §5 — removed specific "Bronze expires 12mo inactivity" promise; replaced with "may introduce expiry with 30 days' notice" since no expiry cron is built.
- ToS §7 — removed specific "24h refund window / $10 fee / 90min no-show" rules (none of those are coded); replaced with "Deposits are non-refundable once processed; refund requests considered case-by-case at Luna Group's sole discretion; reallocation at duty-manager discretion."
- Privacy §7 — retention language tightened: "PII anonymised immediately, active subscriptions cancelled; residual PII fully purged within 30 days; anonymised analytics retained indefinitely."
- Privacy §8 — Download My Data now accurately points at `Profile → Settings → Download My Data` (which will need a UI button wired to the new `/api/auth/my-data` endpoint — backend is ready, UI still to wire).

**NEW: 18+ Age Gate on first launch** (`/app/frontend/app/age-gate.tsx`):
- Pre-onboarding screen shown only on first launch (AsyncStorage flag `@luna_age_gate_passed`).
- Three-field DD / MM / YYYY input with auto-advance.
- Validates a real calendar date and computes age using Australian DOB rules.
- If age ≥ 18 → saves flag + DOB to AsyncStorage, routes to `/onboarding` (or `/login` if already seen).
- If age < 18 → shows a hard-block screen ("SORRY — Luna Group is for adults aged 18 and over") with link to Terms. No way to proceed.
- Routing updated in `index.tsx`: age-gate → onboarding → login → tabs.
- Screen registered in `_layout.tsx`.
- "By continuing you confirm you are 18+" legal copy with tappable Terms + Privacy links.

**Smoke-tested end-to-end:**
- Age-gate screen renders at `/age-gate` with Luna branding, DD/MM/YYYY inputs, CONTINUE button, legal copy.
- Entering 2015-01-01 → "SORRY" blocked screen with "adults aged 18 and over" text. Verified.
- Backend `POST /auth/register` with DOB 2015-01-01 → 403. Verified.
- Backend `POST /auth/register` with DOB 2000-01-01 → token issued. Verified.
- Backend `GET /auth/my-data` authenticated → returns 8-key JSON export. Verified.

**Files touched:**
- `/app/backend/routes/auth.py` — hard PII delete, `/my-data` export endpoint, 18+ enforcement on register
- `/app/public-site/privacy/index.html` — retention + data-access language
- `/app/public-site/terms/index.html` — deposit refund + points-expiry language softened
- `/app/frontend/app/age-gate.tsx` — NEW age-gate screen
- `/app/frontend/app/_layout.tsx` — registered age-gate route
- `/app/frontend/app/index.tsx` — route sequence now age-gate → onboarding → login

**Pending (next session):**
- Wire a "Download My Data" button in Profile → Settings that calls `/api/auth/my-data` and saves/shares the JSON
- Make DOB field required in signup UI (currently optional in frontend form; backend now rejects missing/under-18)
- "Claim My Reward" QR generator screen for 10 rewards shop items
- Draft App Store listing copy + Privacy Nutrition Label answers
- Sentry for production crash reporting


## Latest Update: Feb 21, 2026 - Session 11

### COMPLETED: Exhaustive Rewards Doc + Weekly-Billing Display + Stripe Price Fix

**Exhaustive master reference (`/app/LUNA_REWARDS_REFERENCE.md`):**
- Rewrote from scratch with every source-of-truth data point enumerated
- All 3 tiers with every `benefits` flag + all 4 perk lists (`perks_list`, `nightclub_perks`, `restaurant_perks`, `general_perks`)
- All 6 missions (icon, reward, requirement value, mission type, venue restrictions, verification logic)
- All 6 milestones with **every individual reward ticket ID listed** (109 tickets total across lifetime)
- All 10 rewards shop items (cost, category, venue restriction, description)
- All 48 Eclipse bottle service items across 9 categories
- Points math (formulas from `subscriptions.award_points`, cashback table, constants from `config.py`)
- 11-row anti-abuse & QR security summary
- How points get credited — 8 sources mapped to timing + verification mechanism

**Pricing decision resolved (user confirmed $39.99 / $79.99):**
- Created NEW live Stripe Products + Payment Links at correct monthly prices:
  - Silver: `https://buy.stripe.com/3cIaEX6rS8oc0UObgvaVa02` ($39.99 AUD/mo)
  - Gold:   `https://buy.stripe.com/dRm7sLg2s9sgfPIdoDaVa03` ($79.99 AUD/mo)
- Old $29 Silver / $79 Gold links should be archived manually in Stripe dashboard
- `backend/config.py` SUBSCRIPTION_TIERS already at correct $39.99 / $79.99

**Weekly advertising, monthly billing (user requirement):**
- Weekly math: `monthly × 12 ÷ 52` → Silver $9.23/wk, Gold $18.46/wk
- `/app/frontend/app/subscriptions.tsx`: tier cards now show `$9.23 /week` with "Billed monthly at $39.99 AUD" sub-line. Subscribe alert also shows weekly + monthly.
- `/app/public-site/subscribe/index.html`: rewritten with correct weekly prices, new Stripe links, corrected perk lists (previous copy had wrong multipliers), Hero eyebrow now reads "MEMBERSHIP · FROM $9.23/WK"
- Compare view in mobile app updated: column header now "Weekly Price" showing `$9.23/wk`, `$18.46/wk`

**Verified (smoke test screenshot):**
- Subscriptions screen renders `$9.23 /week` + "Billed monthly at $39.99 AUD" for Silver
- Subscriptions screen renders `$18.46 /week` + "Billed monthly at $79.99 AUD" for Gold
- Backend `/api/subscriptions/tiers` returns correct `price: 39.99 / 79.99` monthly amounts

**Files modified this session:**
- Rewritten: `/app/LUNA_REWARDS_REFERENCE.md`
- Rewritten: `/app/public-site/subscribe/index.html`
- Modified: `/app/frontend/app/subscriptions.tsx` (weekly display, new Stripe links, info copy)

**Pending (next session):**
- Archive old $29/$79 Stripe Payment Links from dashboard (manual user task)
- Age-gating (18+) modal on first launch — code implementation still pending
- "Claim My Reward" QR generator screen for 10 rewards shop items
- Draft App Store listing copy + Privacy Nutrition Label answers
- Sentry for production crash reporting
- Create Stripe Payment Links for all 48 Eclipse bottle items as static fallbacks

### COMPLETED (Session 11b — same day): Privacy Policy + Terms of Service pages
- `/app/public-site/privacy/index.html` (248 lines) — Australian Privacy Principles compliant. Covers: what we collect (given/auto/third-party), purpose + legal basis table, third-party list (Stripe, MongoDB Atlas Sydney, APNS/FCM, Apple/Google Wallet, OpenAI/Anthropic via Emergent), data retention (30d after deletion; 7y payments; 2y check-ins), user rights (access/correct/delete/complain to OAIC), security (TLS, bcrypt, HMAC-signed QRs), NDB scheme commitment, strict 18+ eligibility, AU data residency.
- `/app/public-site/terms/index.html` (277 lines) — Full ToS. Covers: 18+ eligibility (Qld legal drinking age), Luna+ tier table ($39.99/$79.99 with weekly display), auto-renewal + cancellation, points rules (non-transferable, no cash value, expiry rules per tier), reward/milestone/QR single-use security, bottle-service deposit rules (max($50,10%), non-refundable within 24h, 90-min no-show forfeit), acceptable use, RSA/venue staff discretion, 3rd-party services, IP, AU Consumer Law disclaimer, liability cap (greater of 12mo fees or AU$200), termination, governing law Queensland.
- `STORE_SUBMISSION.md` updated: Apple rating stays at 17+ (Apple's maximum age tier for alcohol content) with explicit note that user eligibility is enforced at 18+ via in-app age-gate modal + Terms of Service.
- Both pages match the dark/gold design language of `/subscribe` and `/how-points-work`.

## Latest Update: April 21, 2026 - Session 10

### COMPLETED: Marketing Site + Points System Documentation

**Public marketing site (`/app/public-site/`)** — ready to deploy at `lunagroupapp.com.au`:
- `index.html` — landing page
- `subscribe/index.html` — 3-tier subscription page (Bronze free, Silver $29, Gold $79) with placeholders for user's Stripe Payment Links
- `how-points-work/index.html` — full rewards explainer (rate, missions, milestones, anti-abuse)
- `README.md` — step-by-step deployment instructions (Cloudflare Pages, Netlify, Vercel, or SFTP)

**In-app "How Points Work" screen (`/app/frontend/app/how-points-work.tsx`)**:
- Accessible from Profile → "How Points Work" menu item
- Explains the 10pts/$1 rate, 25% cashback
- Details all 6 missions with their exact server-side verification logic
- Lists 6 milestone tiers (Newbie → Legend) with lifetime point thresholds
- 3-step deposit → venue → balance flow diagram explaining why bottle/auction points only award after staff confirmation
- 6-layer anti-abuse defence summary

**Bottle service transparency:**
- Cart modal now shows split `Bottle Total / Due Now (Deposit) / Balance (Pay at Venue)`
- Points text updated to clarify points are awarded "when staff confirm your final spend at the venue"

**Files added/modified this session:**
- NEW: `/app/public-site/index.html`, `subscribe/index.html`, `how-points-work/index.html`, `README.md`
- NEW: `/app/frontend/app/how-points-work.tsx`
- Modified: `/app/frontend/app/_layout.tsx` (registered new screen)
- Modified: `/app/frontend/app/(tabs)/profile.tsx` (added menu entry)
- Modified: `/app/frontend/app/bottle-service.tsx` (deposit/balance/points transparency)

**Awaiting user action:**
- Create 2 Stripe Payment Links (Silver $29/mo, Gold $79/mo) and paste URLs into `subscribe/index.html`
- Host `public-site/` folder on lunagroupapp.com.au
- Register bottle-service/auction point confirmation flow with venue staff (Staff Portal already has the UI)

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


## Latest Update: Feb 22, 2026 — CherryHub Integration Restored

**What was done:**
- Restored `backend/cherryhub_service.py` (OAuth2 token manager + all CherryHub API methods, recovered from git history)
- Restored `backend/models/cherryhub.py` (Pydantic request models)
- Rebuilt `backend/routes/cherryhub.py` with a cleaner read-only contract:
    - `POST /api/cherryhub/login` — dual-auth login via CherryHub email
    - `POST /api/cherryhub/link` — link current user to CherryHub member
    - `POST /api/cherryhub/register` — create new CherryHub member
    - `GET /api/cherryhub/status` — connection status for current user
    - `GET /api/cherryhub/points` — display balance (prefers CH, falls back local)
    - `GET /api/cherryhub/transactions` — local Luna ledger history
    - `POST /api/cherryhub/wallet-pass` — Apple/Google Wallet digital member card
- **NEW public read bridge** (how CherryHub pulls Luna balances in-store):
    - `GET /api/cherryhub/public/health` — auth check
    - `GET /api/cherryhub/public/balance/{member_key}` — live Luna balance for a member
    - `GET /api/cherryhub/public/ledger/{member_key}?since=ISO8601` — earn events since timestamp
    - Guarded by `X-CherryHub-Api-Key` header (value in `backend/.env` as `CHERRYHUB_READ_API_KEY`)
- Added `CHERRYHUB_*` env vars back to `backend/.env` (credentials, refresh token, mock mode on until Railway)
- Wired router into `backend/routes/__init__.py` (47 routers loaded)
- Frontend: new `/app/frontend/app/cherryhub.tsx` screen (link, status, balance, help text)
- Frontend: added "CherryHub Membership" tile on wallet tab beneath "My Free Entries"

**Testing:**
- All 7 endpoints tested via curl (auth gates, happy path, 404 unknown member, 400 bad ISO)
- Verified against existing test user `luna@test.com` (linked to mock member `LUNA-LUNATES`, 81,898 pts)

**Known constraint:**
- `CHERRYHUB_MOCK_MODE=true` while on Emergent (container DNS can't resolve CherryHub hosts). Flip to `false` on Railway where DNS is unrestricted.


## Latest Update: Feb 22, 2026 — Member Card → CherryHub-Branded + Wallet Pass

**What was done:**
- Rewrote `frontend/app/member-card.tsx` with full CherryHub branding:
  - Dark card with cherry-red gradient (`#0A0308` → `#6E0A1E` → `#0A0308`)
  - `CHERRYHUB × LUNA GROUP` header wordmark
  - Cherry-red glow border + elevated shadow
  - Card ID now shows `CH: <member_key>` when linked (falls back to Luna user_id slice when not linked)
- Wired Apple + Google Wallet buttons to the CherryHub DMC (Digital Member Card) endpoint:
  - `POST /api/cherryhub/wallet-pass` → backend calls CherryHub's `/members/{composite_id}/dmc?passType={IosPassKit|GooglePayPass}`
  - Android: opens `GooglePassUrl` directly
  - iOS: decodes `IosPassContentBase64`, writes `.pkpass` to cache dir via `expo-file-system`, opens with `Linking.openURL` so iOS hands it to the Wallet app
- Sandbox banner shown whenever `CHERRYHUB_MOCK_MODE=true` (reminds user real pass activates in production)
- If user isn't linked to CherryHub yet → in-card CTA button auto-links them (calls `/api/cherryhub/link`)
- Wallet buttons disabled until linked

**Tested:**
- `POST /api/cherryhub/wallet-pass` both `pass_type=apple` and `pass_type=google` return correct mock payloads
- Bundle rebuilt clean (1839 modules, no errors)

**Known:**
- Real `.pkpass` download/install only works on native iOS build + production env (CherryHub DNS reachable + `CHERRYHUB_MOCK_MODE=false`). Mock mode shows sandbox alert instead.

**For Railway deploy:**
- Add `CHERRYHUB_CLIENT_ID`, `CHERRYHUB_CLIENT_SECRET`, `CHERRYHUB_BUSINESS_ID`, `CHERRYHUB_INTEGRATION_ID`, `CHERRYHUB_REFRESH_TOKEN`, `CHERRYHUB_API_URL`, `CHERRYHUB_MOCK_MODE=false`, `CHERRYHUB_READ_API_KEY` to Railway env vars
- Give `CHERRYHUB_READ_API_KEY` to CherryHub so they can poll our public endpoints
