# Luna Group VIP App - Product Requirements Document

## Latest Updates (April 17, 2026 - Session 3)

### COMPLETED: Staff Portal Overhaul — Primary Points-Awarding Mechanism
- **Quick Award Flow**: Scan member QR → select venue → pick spending category → enter $ amount → points auto-calculated with tier multiplier → full audit trail
- **3-Tab Interface**: Award Points | Validate Reward | History
- **Venue Selector**: All 9 Luna venues selectable (was hardcoded to Eclipse)
- **Spending Categories**: Food, Drinks, Entry, Booth, Bottle Service, Merchandise, Other
- **Quick Amount Buttons**: $20, $50, $100, $200, $500 for fast entry
- **Real-time Preview**: Shows "85 base pts x 1.5 = 128 pts" as staff types
- **Success Confirmation**: Green card with points awarded, tier info, new balance
- **Receipt/Docket Reference**: Optional field for POS receipt tracking
- **Reward QR Validation**: Staff scans customer's reward QR → validates → marks used
- **Transaction History**: Per-venue log with revenue, points, and category breakdowns
- **Staff Summary Dashboard**: Today's transactions, total revenue, points given, unique members

### COMPLETED: SwiftPOS Integration Readiness
- **Webhook Endpoint**: `POST /api/perks/swiftpos/sale` — receives POS sale data, auto-matches member by email or SwiftPOS member key, awards tier-adjusted points
- **Unmatched Sales Queue**: Sales that can't match to a Luna member are logged for manual reconciliation
- **Manual Match**: `POST /api/perks/swiftpos/match/{receipt}` — staff matches unmatched sale to a member
- **Auth**: Supports both staff Bearer token and X-SwiftPOS-Key header (for direct POS→API integration)
- **Production Setup Required**: Set `SWIFTPOS_WEBHOOK_KEY` env var and configure SwiftPOS POS API middleware

### COMPLETED: Geofence Admin Push Message Fix (P0)
- Fixed `check-location` to use async DB-backed message pickers
- Dashboard edits now reach users via push notifications

### COMPLETED: VIP Table Deposit System
- 9 venues with unique VIP table inventory, operating day checks, deposit flow

### COMPLETED: Bottle Service Pre-Orders
- All 9 venues with curated menus, cart system, 10% points reward

---

## Points System Architecture

### How Points Flow
```
PHYSICAL VENUE                    LUNA APP                     DASHBOARD
┌──────────────┐            ┌──────────────────┐          ┌────────────┐
│  SwiftPOS    │───webhook──│  /perks/swiftpos  │          │  Lovable   │
│  (POS)       │   (future) │  /sale            │          │  Dashboard │
└──────┬───────┘            └────────┬─────────┘          └──────┬─────┘
       │                             │                            │
       │  Staff scans QR      ┌──────▼──────────┐         Admin CRUD
       │  enters $ amount     │  points_balance  │     (missions, rewards)
       └──────────────────────│  (MongoDB)       │◄────────────────┘
           Staff Portal       │  Source of Truth  │
           /perks/quick-award └──────────────────┘
```

### Earning Sources: 1pt per $1 × tier multiplier
- In-venue spending (Staff Portal quick-award)
- SwiftPOS webhook (auto-award when POS sale completes)
- Table booking (50 × party size), Bottle pre-order (10% of total)
- Missions, Referrals, Birthday, Story shares, Promo codes
- Points purchase via Stripe

### Tier Multipliers
- Bronze (Free): 1.0× | Silver ($39.99/mo): 1.5× | Gold ($79.99/mo): 2.0×

### Redemption: 10 pts = $1 value
- Rewards Shop → QR code → Staff validates via Staff Portal

---

## Technical Stack
- Frontend: Expo React Native (expo-router, Zustand, custom Luna UI Kit)
- Backend: FastAPI + MongoDB (41 modular route modules)
- Auth: JWT-based | Payments: Stripe (test keys) | AI: Claude via Emergent LLM Key
- Wallet: Apple Wallet (.pkpass) + Google Wallet (JWT)
- Push: Expo Push API with clustered geofence notifications

## Known MOCKED Services
- Table Deposit Payments (demo mode — awaiting Stripe production keys)
- Stripe (test keys `sk_test_emergent`)
- CherryHub Points (disabled — read-only CRM, not for points)
- Instagram (demo mode)

## Pending Tasks
### P1 — Blocked
- Stripe production keys (awaiting `sk_live_...`)

### P2 — Future
- SwiftPOS middleware deployment (configure POS API → webhook → Luna backend)
- Real Stripe payments for table deposits and bottle pre-orders
- Server.py continued cleanup

## Test Reports
- `/app/test_reports/iteration_29.json` — 100% (28/28) Staff Portal + SwiftPOS
- `/app/test_reports/iteration_28.json` — 100% (41/41) VIP Tables + Bottles
- `/app/test_reports/iteration_27.json` — 97% (prior session)

## Credentials
- User: `luna@test.com` / `test123`
- Admin: `admin@lunagroup.com.au` / `Trent69!`
- Venue Portal: `venue@eclipse.com` / `venue123`
