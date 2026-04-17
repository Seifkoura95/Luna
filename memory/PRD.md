# Luna Group VIP App - Product Requirements Document

## Latest Updates (April 17, 2026 - Session 3)

### COMPLETED: Geofence Admin Push Message System (P0 Fix)
- **Fixed**: `check-location` endpoint now uses async DB-backed message pickers (`pick_notification_async`, `pick_cluster_notification_async`) so Lovable dashboard edits actually reach users
- Admin CRUD endpoints verified working:
  - `GET/POST/PUT/DELETE /api/admin/push-messages` (venue-specific)
  - `GET/POST/PUT/DELETE /api/admin/cluster-messages` (cluster-wide)
- Geofence analytics: `GET /api/admin/geofence-analytics`

### COMPLETED: VIP Table Deposit System
- **9 venues** with unique VIP table inventory (2-4 tables per venue)
- `GET /api/venues/{venue_id}/tables?date=YYYY-MM-DD` — Lists tables with availability and venue closure checks
- `POST /api/bookings/table` — Create table booking (pending deposit)
- `POST /api/bookings/table/{id}/deposit` — Get deposit payment intent (DEMO MODE, Stripe in production)
- `POST /api/bookings/table/{id}/confirm` — Confirm after deposit payment, awards loyalty points
- `DELETE /api/bookings/table/{id}` — Cancel booking
- `GET /api/bookings/my-tables` — User's table bookings
- Operating day checks: Eclipse/After Dark (Fri-Sat), Su Casa BNE (Wed-Sun), Juju (Wed-Sun), etc.
- Duplicate booking prevention per table+date

### COMPLETED: Bottle Service Pre-Orders
- **All 9 venues** with curated bottle menus (3-6 items each)
- Categories: Vodka, Champagne, Cognac, Tequila, Wine, Sake, Soju, Cocktails, Packages
- `GET /api/bookings/bottle-menu/{venue_id}` — Menu with items grouped by category
- `POST /api/bookings/bottle-preorder` — Place pre-order (validates items, calculates total, awards 10% of total as Luna Points)
- `GET /api/bookings/bottle-orders` — User's bottle orders
- `DELETE /api/bookings/bottle-order/{id}` — Cancel pending orders
- Frontend: `/bottle-service` page with venue picker, date selector, category tabs, cart system, order modal
- Accessible from: Profile > Quick Actions > "Bottle Service" and Venue Detail > Bottom CTA > "Bottles"

### COMPLETED: Venue Detail Page CTA Row
- Bottom CTA now shows 3 buttons: "VIP Tables", "Bottles", and main booking action
- Glass-morphism styled secondary buttons with venue-colored accents

---

## Overview
Premium hospitality VIP operating system for Luna Group venues (Eclipse, After Dark, Su Casa Brisbane/Gold Coast, Juju, Night Market, Ember & Ash, Pump, Mamacita) — native iOS/Android app built with Expo React Native.

## Technical Stack
- Frontend: Expo React Native (expo-router, Zustand, custom Luna UI Kit with glassmorphism)
- Backend: FastAPI + MongoDB (41 modular route modules)
- Auth: JWT-based authentication
- Payments: Stripe (test keys active, awaiting production keys)
- AI: Claude Sonnet 4.5 via Emergent LLM Key
- Wallet: Apple Wallet (.pkpass via py-pkpass) + Google Wallet (JWT)
- Push: Expo Push API with geofence-based notifications

## Brand Colors
- Background: #101018 | Cards: #202034 | Glass: #1E1E30
- Accent Blue: #2563EB | Gold: #D4A832 | Luna Red: #E31837
- Success: #10B981 | Error: #EF4444

## Architecture
```
/app/backend/
├── server.py           # Entry point (597 lines)
├── routes/             # 41 modular route modules
│   ├── admin.py        # Missions/Rewards/Auctions/Geofence/Push Messages CRUD
│   ├── bookings.py     # VIP Tables + Bottle Service + Legacy Bookings
│   ├── venues.py       # Venue listing + VIP table inventory
│   ├── geofences.py    # Clustered geofencing with async DB message lookup
│   ├── payments.py     # Stripe checkout for gift cards, packages
│   ├── loyalty.py      # Apple/Google Wallet pass generation
│   └── ... (35 more)
├── services/           # AI, WebSocket, Churn, Scheduled Jobs
├── models/             # Pydantic models
└── certs/              # Apple Wallet certificates

/app/frontend/
├── app/
│   ├── (tabs)/         # Main tabs: Tonight, Venues, Luna AI, Wallet, Profile
│   ├── table-booking.tsx
│   ├── bottle-service.tsx
│   ├── rewards-shop.tsx
│   ├── staff-portal.tsx
│   ├── member-card.tsx
│   └── ... (20+ screens)
├── src/
│   ├── components/     # Icon.tsx, LunaIcons.tsx, GlassCard.tsx
│   ├── theme/colors.ts # Design system tokens
│   └── utils/api.ts    # 100+ API methods
```

## Key DB Collections
- `users`: email, tier, points_balance, wallet_balance, push_tokens
- `table_bookings`: booking_id, venue_id, table_id, date, party_size, deposit_paid, status
- `bottle_orders`: order_id, venue_id, items[], total, status
- `geofences`: venue_id, cluster, coordinates, radius (1km)
- `venue_push_messages`: venue_id, time_slot, title, body (admin-editable)
- `cluster_push_messages`: cluster, time_slot, title, body (admin-editable)
- `geofence_triggers`: user_id, cluster, triggered_at (once per cluster per day)

## Known MOCKED Services
- **Table Deposit Payments**: Demo mode (returns fake payment_intent_id). Needs Stripe production keys.
- **Stripe**: Using test keys (`sk_test_emergent`). Awaiting production keys from user.
- **CherryHub Points**: Disabled due to 500/404 errors. Using native Luna Loyalty Engine.
- **Instagram**: Demo mode (no API credentials)

## Pending Tasks
### P1 — Blocked
- Stripe production keys integration (awaiting `sk_live_...` from user)

### P2 — Future
- Server.py continued cleanup (remaining unique endpoints)
- Connect table deposit flow to real Stripe payment
- Bottle service payment via Stripe checkout

## Test Reports
- `/app/test_reports/iteration_28.json` — 100% pass (41/41 tests) — VIP Tables, Bottles, Admin Messages, Geofence
- `/app/test_reports/iteration_27.json` — 97% backend pass (prior session)

## Credentials
- User: `luna@test.com` / `test123`
- Admin: `admin@lunagroup.com.au` / `Trent69!`
- Venue Portal: `venue@eclipse.com` / `venue123`
