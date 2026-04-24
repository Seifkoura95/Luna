# Luna Group VIP App - Product Requirements Document


## Latest Update: Apr 24, 2026 - Session 18 (Phase 2 + 4 — migrate all points call-sites + pause CherryHub poller)

### Migrated to `points_service.award_points()` (7 call-sites)
All backwards-compatible via `POINTS_LEGACY_DIRECT_MONGO=true` / `SWIFTPOS_MOCK_MODE=true` flags:
- `routes/missions.py` — mission claim (Phase 1)
- `routes/bookings.py` × 3 — bottle service order, reservation confirm, guestlist arrival
- `routes/loyalty.py` × 2 — `/points/award` (member self-award) + `/staff/award`
- `routes/birthday.py` — birthday bonus points
- `routes/auth.py` — referral bonus
- `services/leaderboard_winner_job.py` — Nightly Crown (+50 pts at midnight Brisbane)

Left unchanged: `loyalty.py::redeem_points` (reward redemption). This is a negative flow that should push POSITIVE PLU prices to SwiftPOS so the POS deducts points. Needs a small design conversation with the user before migrating (which of the reward PLUs are "redeemable" vs "staff-gift"?). Flagged for Phase 3.

### Phase 4 — CherryHub 2-min poller DISABLED
`server.py` no longer registers `sync_cherryhub_redemptions` with the scheduler unless `CHERRYHUB_POLLER_ENABLED=true` is set in env. The whole point of the poller was to pull SwiftPOS-awarded transactions into Luna's ledger — but with the new on-demand model (`GET /api/points/my-balance` → CherryHub → SwiftPOS real-time), we don't need to poll. Also unblocks us from CherryHub's 500 "Unexpected" bug on `points-transactions/search` since we no longer depend on it.

### Verified
- ✅ All 4 event types (`mission`, `birthday`, `referral`, `nightly_crown`) dispatch correctly via `award_points()`
- ✅ PLU resolution working (luna_loyalist → 100253)
- ✅ `POST /api/leaderboard/admin/award-now?force=true` still succeeds (uses new service)
- ✅ Backend clean reload after every edit
- ✅ Test data cleaned, Luna's balance restored to 81,898

### Still pending
- 🔴 3 SwiftPOS customer creds → flip `SWIFTPOS_MOCK_MODE=false` + `POINTS_LEGACY_DIRECT_MONGO=false` → test full live loop
- 🟠 Phase 3: mobile app onboarding UI for "Link your CherryHub account" + pull-to-refresh on wallet
- 🟠 Reward redemption flow (positive PLU price) — design conversation needed

---


## Latest Update: Apr 23, 2026 - Session 18 (SwiftPOS integration — Phase 1 foundations)

### Architecture shift acknowledged
CherryHub is NOT source of truth. The new model is:
```
SwiftPOS (source of truth) → CherryHub reads real-time on demand → App reads via CherryHub
```
Confirmed by CherryHub: `GET /{businessId}/members/{memberId}/points` is both "trigger" and "read" in one call (real-time SwiftPOS pull, no persistence on their side).

### Built this session
- **`services/swiftpos_service.py`** — async SwiftPOS client with token caching + 401 refresh. Mock mode default on (`SWIFTPOS_MOCK_MODE=true`). Configurable endpoint paths via env (`SWIFTPOS_AUTH_PATH`, `SWIFTPOS_ORDERS_PATH`) so we can swap paths without redeployment once Swagger confirms them. Env creds partially populated (Integrator name + Key), still need 3 customer creds (Customer Ref, Client ID, Clerk ID/password).
- **`services/swiftpos_plu_map.py`** — PLU mapping Trent supplied: 5 missions (100251-110255) + 10 rewards (100256-100265). Value: 10 points = $0.25. Auto-calc `points_for_plu(unit_price, multiplier)`.
- **`services/points_service.py`** — orchestrator. `award_points()` pushes SwiftPOS → refreshes via CherryHub → falls back to local Mongo if user not linked or SwiftPOS mock mode. `refresh_balance_for_user()` for pull-to-refresh. Feature flag `POINTS_LEGACY_DIRECT_MONGO=true` keeps the old direct-Mongo flow until SwiftPOS is live.
- **New endpoints** `/api/points/my-balance` (pull-to-refresh from CherryHub→SwiftPOS) and `/api/points/status` (linked? any pending dispatches? mock mode?).
- **`routes/cherryhub.py::link`** enhanced — now picks up SwiftPOS `customerId` (multiple possible field names) from CherryHub response on link, stores on user. New-account flow sets `swiftpos_link_pending=true` so the app UI can show a "Staff will link your POS account soon" banner until Trent's team finishes the CherryHub↔SwiftPOS manual link in the CherryHub portal.
- **`routes/missions.py`** — mission claim endpoint refactored to call `award_points()` instead of direct Mongo inc. Verified end-to-end via direct call (award_points for `luna_explorer` → PLU 100251 → 750 pts → fallback to Mongo in mock mode → `new_balance: 82648`).

### Not yet refactored to award_points (Phase 1 follow-up)
The other 8 points-award call-sites still use direct Mongo `$inc`: `loyalty.py:78,160`, `bookings.py:224,411,457`, `birthday.py:233`, `auth.py:49`, `leaderboard.py` (Nightly Crown). Will batch-migrate in Phase 2 once SwiftPOS creds arrive + mock→live is verified via mission flow first.

### Still blocked on (user-side action)
- 🔴 3 SwiftPOS customer creds (Customer Ref, Client ID, Clerk ID) from Trent or SwiftPOS support
- 🔴 Confirm Luna's SwiftPOS install is v10.58+ (required per SwiftPOS docs)
- 🔴 Once creds arrive: flip `SWIFTPOS_MOCK_MODE=false` + `POINTS_LEGACY_DIRECT_MONGO=false` → run `luna_explorer` mission claim → verify points appear in SwiftPOS + CherryHub balance updates

---


## Latest Update: Apr 23, 2026 - Session 18 (Deploy-verification endpoint + CherryHub probe diagnostic wrapper)

### ✅ Railway deploy is now current
After the user pushed to GitHub:
- `/api/health/version` on Railway returns `sha_short=3a860da`, `all_markers_available=true`, environment=production, python=3.12.7, deployment_id=`470c9ed1-e77a-4810-ba33-376c6ac1f2f1`. Uptime 2m 43s confirms fresh container boot.

### 🔴 CherryHub probe — still 500 on Railway, NOT the `get_access_token` bug
Ran the probe against Railway with a valid admin token; response is bare text `"Internal Server Error"` (not JSON). That means an exception is bubbling out **BEFORE** any of the `try/except` blocks in `_admin_probe_impl` catch it — likely during env/config evaluation or auth resolution on Railway (python 3.12 vs local 3.11, or a differently-configured CHERRYHUB env var).

**Wrapped probe with a diagnostic try/except** in `/app/backend/routes/cherryhub.py` that returns the error type + message + last 20 lines of traceback as JSON (`status: "probe_crashed"`). Preserves HTTPException passthrough so 403/503 guards still work. Locally still returns 503 MOCK_MODE as expected.

**Action:** after the user's NEXT "Save to Github" push, re-run the probe — the response will now include the actual exception so we can fix the root cause.

---


## Latest Update: Apr 23, 2026 - Session 18 (venue_admin.py refactor + CherryHub status)

### Refactor: `venue_admin.py` (654 lines) → split into two focused modules

- `/app/backend/routes/venue_admin_auctions.py` (370 lines) — auction CRUD + image upload/serve. Tag: `Venue Admin — Auctions`.
- `/app/backend/routes/venue_admin_users.py` (203 lines) — user list, 360° profile, edit, add points. Tag: `Venue Admin — Users`.
- Both routers keep the `/api/venue-admin` prefix → **zero URL changes** for mobile app + Lovable components.
- Shared `_require_venue_role(request, manager_only=False)` helper deduplicates the auth check (was repeated 10× in the old file).
- Deleted `/app/backend/routes/venue_admin.py`. Updated `routes/__init__.py` to import both new routers.
- Verified via curl: POST upload-image, POST create auction, PUT update image_url, DELETE, GET users analytics — all 200 OK.

### CherryHub Probe — still blocked on GitHub push

Re-ran probe against Railway: still **HTTP 500** with the `get_access_token` AttributeError. Confirmed Railway is running **stale code** by probing endpoints from recent sessions:
- ✅ `/api/leaderboard/daily-prize` → 200 (Nightly Crown push reached Railway)
- ❌ `/api/admin/safety/*` → 404 (session 18 safety routes NOT on Railway)
- ❌ `/api/admin/push-broadcasts/audience-preview` → 404 (new routes NOT on Railway)
- ❌ `/api/venue-admin/auctions/upload-image` → 405 (matched as stale `{auction_id}`)

**Action required:** user must click "Save to Github" → wait ~2 min for Railway redeploy → re-run the probe curl documented in test_credentials.md. Until then the CherryHub probe + all other new endpoints shipped this session are not reachable from Lovable / Railway.

---


## Latest Update: Apr 23, 2026 - Session 18 (Push Notifications + Auction Image Upload)

### Push registration — fixed for production iOS / TestFlight

**What was broken:**
1. `usePushNotifications.ts` read `projectId` from `process.env.EXPO_PUBLIC_PROJECT_ID` which is not set in `.env` — so in EAS builds it relied on Expo's fragile auto-fallback.
2. `/app/frontend/src/utils/notifications.ts` had a dead duplicate `NotificationService` with the literal placeholder `projectId: 'your-project-id'`.

**Fixed:**
- `usePushNotifications.ts` now resolves projectId via a safe chain: `EXPO_PUBLIC_PROJECT_ID → Constants.expoConfig.extra.eas.projectId → Constants.easConfig.projectId`. Works in dev, EAS preview, TestFlight, and App Store. EAS projectId (`70fc7d51-2dd0-447d-b040-8cba149152a6`) is already in `app.json`.
- Deleted `/app/frontend/src/utils/notifications.ts` (dead code, nothing imported it).

### Lovable Push Broadcasts module — full CRUD

**Backend extensions (`/app/backend/routes/push_broadcasts.py`):**
- `audience` now supports `user:<email_or_user_id>` (single) and `users:<id1,id2,...>` (multi-user, max 50).
- `GET /audience-preview?audience=...` — returns `{user_count, with_push_token_count, sample_names}` so ops see reach before firing.
- `GET /users-search?q=...` — typeahead user picker (min 2 chars, only users with push tokens).
- `POST /{id}/test` — sends the broadcast to the admin's own device(s) only; does not flip status to sent.

**Scheduler (`/app/backend/services/push_broadcast_dispatcher.py`):** new APScheduler cron (every minute at `:00`) fires any `scheduled` broadcast whose `scheduled_for <= now`. Idempotent via Mongo `find_one_and_update` guard. Writes `user_notifications` rows + updates status to `sent` with `sent_at` + `audience_size`.

**Lovable component `/app/LUNA_PUSH_BROADCASTS_LOVABLE.tsx`:**
- Tabs: All / Draft / Scheduled / Sent. Polls every 15 s.
- Composer: title (65 char) + body (178 char) with counters, deep-link, image URL, audience picker (All / Subscribers / Tier / Venue / 1 user with typeahead / multi-user up to 50 with chip list), schedule datetime (Brisbane local), audience-reach preview.
- Actions: Save draft · Send test to me · Schedule · Send now · Edit · Delete.
- Open/Click rate % columns on sent broadcasts.

**Known bug fixed during testing:** `users:<ids>` audience-preview had a dict-merge collision that clobbered the `user_id: {"$in": [...]}` filter with the sample-user exclusion filter (both use `user_id` top-level key). Testing agent caught it — fixed by wrapping in `$and` when a `user_id` or `$or` key is already present.

### Auction image upload — new endpoint + Lovable editor

**Backend (`/app/backend/routes/venue_admin.py`):**
- `POST /api/venue-admin/auctions/upload-image` — accepts multipart `file=` OR JSON `{"image": "data:image/...;base64,..."}`. Validates MIME (JPG/PNG/WebP), size ≤ 8 MB, writes to `/app/backend/uploads/auctions/`. Returns `{image_id, filename, image_url, relative_url, size_bytes, mime_type}`.
- `GET /api/venue-admin/auctions/image/{filename}` — public image serve, path-traversal guarded.

**Lovable component `/app/LUNA_AUCTION_EDITOR_LOVABLE.tsx`:**
- Full create/edit form: title, description, image (upload file OR paste URL, with live preview), starting bid, min increment, max bid limit, venue picker, category, duration hours, status (draft/active/paused/ended), terms.
- Actions: Save / Save & Publish / Delete.

### Testing results
- Backend: **20/21 pytest tests pass** (1 bug caught + fixed + re-verified).
- Curl verification post-fix: `users:<id>` now returns `user_count=1` correctly; all other audiences unaffected.
- Test artifacts cleaned. Luna's balance, admin's balance, real auctions untouched.

### Outstanding for production push delivery
The backend is 100% ready. For real pushes to hit iPhones:
1. APNs `.p8` must be uploaded to EAS (user confirmed this is done).
2. A fresh **EAS production iOS build → TestFlight** — every install from there registers a real `ExponentPushToken[...]` via the fixed hook.
3. Current DB has only 2 sandbox tokens; this will scale automatically as TestFlight users register.

---


## Latest Update: Apr 23, 2026 - Session 18 (Safety / Silent SOS — Real Dispatch + Lovable Ops View)

### SHIPPED: Silent SOS now actually does something

**What was broken:** `POST /api/safety/silent-alert` was a stub — it ignored the request body (latitude/longitude dropped), sent no notifications, and returned a response shape the mobile app didn't match (the success popup would have shown `undefined`). There was also no way for Luna ops or a venue to view alerts.

**Fixed:**
- `/app/backend/routes/safety.py::send_silent_alert` now parses `{latitude, longitude, venue_id?, activation_method?, message?}`, stores GPS on the alert, auto-resolves the nearest Luna venue via haversine (≤ 2 km radius), generates a `https://www.google.com/maps/search/?api=1&query=LAT,LNG` link, and dispatches:
  - Crew members: in-app notification + Expo push
  - Venue roles (manager/staff) matched to the resolved venue (`venue_id` or `assigned_venue_id`): in-app + push **with the exact GPS coords in the push body**
  - All admin/super_admin (Luna ops): in-app + push
  - Emergency contacts: count reported (SMS/Twilio P2 as requested)
  Returns the `notified` + `location_link` payload the mobile app already expects.

### NEW: Admin/Lovable safety console

- New router `/app/backend/routes/admin_safety.py` mounted at `/api/admin/safety/*`:
  - `GET /api/admin/safety/alerts?status=active|resolved|all&hours=48&venue_id=...&limit=100` — enriched with user (name, email, phone, picture, tier) + viewer context + counts.
  - `GET /api/admin/safety/alerts/{id}` — full detail with venue metadata.
  - `POST /api/admin/safety/alerts/{id}/acknowledge` (body `{note?}`) — staff/admin stamp (with note).
  - `POST /api/admin/safety/alerts/{id}/resolve` (body `{note?}`) — closes alert, pushes a `safety_alert_resolved` notification to the original user.
  - `GET /api/admin/safety/summary?hours=24` — dashboard counts + by-venue breakdown + last 5 active.
- Access model: `admin` / `super_admin` see everything. `venue_manager` / `venue_staff` / `staff` / `manager` are automatically scoped to their own `venue_id` / `assigned_venue_id` — no extra filter work needed in Lovable.

### NEW: Lovable drop-in component

- `/app/LUNA_SAFETY_ALERTS_LOVABLE.tsx` — single-file React/TS component for the Lovable admin portal. Polls `/api/admin/safety/alerts` every 10s, shows live card grid with: status pill (ACTIVE / ACKNOWLEDGED / RESOLVED), user name + phone + tier, venue + nearest distance, 📍 GPS coords + Google Maps link button, notified-roles summary, acknowledgement log, note field, and action buttons (Acknowledge / Mark Resolved / Call user / Open map). Status tabs: Active / Resolved / All.
- Setup: stores admin JWT at `localStorage.getItem('luna_admin_token')`, uses `VITE_LUNA_API_URL` env (default `https://luna-production-889c.up.railway.app`).

**Deferred (P2):** Twilio SMS dispatch to emergency contacts — user said "we'll do Twilio soon". Backend already has `emergency_contacts_count` on the alert and returns the contact names; plugging in Twilio later is additive.

**Tested locally via curl:** full flow — trigger → list → detail → ack → resolve → summary → non-admin 403. All green. Test DB rows cleaned up.

---


## Latest Update: Apr 23, 2026 - Session 18 (Nightly Crown — Daily Leaderboard Winner)

### SHIPPED: 50-pt daily prize for whoever sits at #1 at midnight Brisbane

**Feature:** Every night at **12:00 AM Australia/Brisbane (AEST, UTC+10)**, whoever is currently #1 on the all-time points leaderboard is automatically awarded **+50 bonus points**. A gold-accented "Nightly Crown" promo card on the leaderboard screen explains the prize, shows a live countdown to midnight, who's currently on the throne, and last night's winner.

**Backend (all tested — 12/12 pytest pass, prod data cleaned):**
- `/app/backend/services/leaderboard_winner_job.py` — `award_daily_leaderboard_winner()` (idempotent per Brisbane calendar day; excludes admins and `sample_user_*` seed users; credits points + writes `points_transactions` (source=`daily_leaderboard_winner`) + `leaderboard_winners` (history) + `notifications` + push).
- `/app/backend/services/scheduled_jobs.py` — APScheduler `CronTrigger(hour=0, minute=0, timezone=ZoneInfo("Australia/Brisbane"))` job `daily_leaderboard_winner`.
- `GET /api/leaderboard/daily-prize` (public) — returns `{prize_amount, timezone, next_midnight_utc, current_leader, last_winner, recent_winners[7], promo{title, tagline, description}}`.
- `POST /api/leaderboard/admin/award-now?force=true|false` (admin only) — manual trigger for testing; `force=true` bypasses the once-per-day guard.

**Frontend (`/app/frontend/app/(tabs)/leaderboard.tsx`):**
- New "Nightly Crown" card above the podium: gold gradient, live `HH:MM:SS` countdown digit boxes, promo copy explaining the 50-pt prize, "On the throne" (live leader) + "Last night's winner" footer. Auto-refreshes the leader 5 s after midnight rolls over.
- `data-testid`: `nightly-crown-card`, `crown-countdown-0..2`.

**Constants:** `DAILY_PRIZE_POINTS = 50`, timezone `Australia/Brisbane`.

**Test credentials used:** admin@lunagroup.com.au / Trent69! and luna@test.com / test123.

---


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

## Latest Update: Feb 22, 2026 — CherryHub Poller + Deep Health Check

**1) Deep health endpoint** (`GET /api/health/deep`)
- Parallel pings: MongoDB, CherryHub OAuth2, Resend `/domains`
- Returns per-check `ok`, `latency_ms`, error details
- Locally: all 3 green. On Railway (mock_mode=false) shows live `expires_in: 3600` from CherryHub

**2) CherryHub → Luna Poller** (`services/cherryhub_poller.py`)
Per your "read-only both ways" constraint, Luna now auto-mirrors in-store redemptions + SwiftPOS awards from CherryHub into Luna's ledger every 2 minutes.

Implementation:
- `cherryhub_service.search_points_transactions(...)` — hits `GET /data/v1/{businessId}/points-transactions/search` with `pointsTransactionStatus=Success&pointsTransactionState=Completed&transactionDateAfter={ISO}&limit=200&continuationToken={...}`
- `sync_cherryhub_redemptions()` — APScheduler job, every 2 min:
    - iterates every user with `cherryhub_member_key`
    - pulls new txns since `users.last_cherryhub_sync` (or 30d lookback on first sync)
    - inserts into `points_transactions` with `source=cherryhub`, `external_id=TransactionId` (idempotent)
    - updates `users.points_balance` via `$inc`
    - advances `last_cherryhub_sync` watermark
    - skips any txn tagged `Request.RequestDetails.origin=luna_app` (prevents double-count when Luna eventually pushes awards back to CH)
- No-op in mock mode or when credentials missing
- Pagination via `_links.next.continuationToken`
- **Point amount extraction:** prefers `Request.PointsByQuantity`, falls back to `PointsByDollarValue × PointsType.PointsToDollarRatio`
- **Admin trigger:** `POST /api/cherryhub/admin/sync-now` (all users) or `?user_id=XXX` (single user) — requires admin role

**CherryHub OAuth finding:**
`client_credentials` grant returns 400 — `refresh_token` grant works. Service already has fallback; no code change needed. Long-term: ask CherryHub to enable `client_credentials` so we don't depend on the rotating refresh token.

**Tested:**
- `POST /admin/sync-now` as admin → `{mock: true, imported: 0}` in mock mode ✓
- Same as non-admin → 403 ✓
- Scheduler registered with `max_instances=1` + `coalesce=True` (no overlapping runs)

- Give `CHERRYHUB_READ_API_KEY` to CherryHub so they can poll our public endpoints

## Latest Update: Apr 24, 2026 — SwiftPOS Reporting Lovable Component

**New backend routes** (`routes/admin_swiftpos.py`) gated by existing `require_admin` (JWT admin/staff/manager OR `X-Luna-Hub-Key`):
- `GET  /api/admin/swiftpos/summary?range=24h|7d|30d|all` — KPIs: mock_mode, credentials_configured, users (total/linked/ready/pending/unlinked), transactions (total/dispatched/pending/failed + all-time pending), points (total_awarded / dispatched / dollar value).
- `GET  /api/admin/swiftpos/transactions?status=dispatched|pending|failed&event_type=&user_id=&range=&limit=&skip=` — paginated ledger (max 200), newest first, enriched with user name/email/member_key.
- `GET  /api/admin/swiftpos/users?link_status=linked|unlinked|pending&q=&limit=&skip=` — paginated user roster with link state, member_key, swiftpos_customer_id, mirrored balance, last refresh.
- `GET  /api/admin/swiftpos/config` — redacted credentials + endpoint paths + full PLU catalog (mission + reward PLUs with points-per-unit precomputed).
- `POST /api/admin/swiftpos/retry/:tx_id` — manually re-dispatch a single pending/failed tx (resolves PLU, resubmits, updates ledger flags).
- `POST /api/admin/swiftpos/retry-pending?limit=25` — bulk retry oldest N pending dispatches (bounded per call).

**Dropin Lovable component** (`/app/LUNA_SWIFTPOS_REPORTING_LOVABLE.tsx`):
- 4 tabs: Summary (KPI cards + Retry All), Transactions (filters by range/status/event, inline Retry per row, pagination), Users (link status filter + search + balance), Config/PLU (redacted creds + full PLU table).
- Reuses the same `localStorage.getItem('luna_admin_token')` JWT pattern as LunaSafetyAlerts / PushBroadcasts, same inline-style dark theme.
- Verified all 6 endpoints return 200 with real prod data (103 users, 5 linked, 7 transactions, mock_mode=true, creds not configured).

**Still blocked on:** SwiftPOS live credentials (Customer ref, Client ID, Clerk ID) to flip `SWIFTPOS_MOCK_MODE=false`.
