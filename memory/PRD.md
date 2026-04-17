# Luna Group VIP App - Product Requirements Document

## Latest Updates (April 17, 2026 - Session 3)

### COMPLETED: Milestones System with One-Use QR Ticket Rewards
- **6 Milestones**: Newbie (0pts), Rising Star (500pts), VIP Status (1000pts), Luna Elite (5000pts), Supernova (10000pts), Legend (25000pts)
- **Exact rewards per milestone**:
  - Rising Star: 5 free drinks
  - VIP Status: 10 free drinks + 4 free entries
  - Luna Elite: Free VIP booth + 20 drinks + 5 entries
  - Supernova: Free VIP booth + 30 drinks + 5 entries + 5 express entries + DJ shoutout
  - Legend: Gold status upgrade + booth with bottle + 50 drinks + 10 giftable entries
- **QR Ticket System**: Each reward becomes a one-use QR code ticket. Staff scans → ticket permanently deleted from user's account
- **Backend**: `GET /api/milestones`, `POST /api/milestones/claim/{id}`, `GET /api/milestones/tickets`, `POST /api/milestones/tickets/{id}/use`, `POST /api/milestones/tickets/validate-qr`
- **Frontend**: Dedicated `/milestones` page with progress tracker, claim flow, ticket list, and QR code display modal

### COMPLETED: Wallet Page Fixes
- Milestones section now shows only 3 milestones with "See All" → milestones page
- Missions "See All" now goes to milestones page (was going to rewards-shop)
- Missions now load from API (Lovable dashboard sync) instead of hardcoded data

### COMPLETED: Staff Portal Overhaul (Primary Points Engine)
- Quick Award: Scan QR → venue → category → $ amount → auto-calculated with tier multiplier
- Reward QR Validation + Transaction History + Summary Dashboard

### COMPLETED: SwiftPOS Integration Readiness
- Webhook: `POST /api/perks/swiftpos/sale` auto-matches members, awards points
- Unmatched sales queue + manual match

### COMPLETED: VIP Table Deposits + Bottle Service Pre-Orders
### COMPLETED: Geofence Admin Push Message Fix (P0)

---

## Points System
```
EARNING: 1pt per $1 × tier multiplier (Bronze 1x, Silver 1.5x, Gold 2x)
SPENDING: 10 pts = $1 in Rewards Shop | Milestones = claim tickets at point thresholds
```

## Technical Stack
- Frontend: Expo React Native | Backend: FastAPI + MongoDB
- Auth: JWT | Payments: Stripe (test) | AI: Claude via Emergent LLM Key
- Wallet: Apple/Google Wallet passes | Push: Geofenced

## Pending Tasks
### P1 — Blocked
- Stripe production keys (awaiting `sk_live_...`)

### P2 — Future
- SwiftPOS middleware deployment
- Real Stripe for table deposits + bottle pre-orders

## Test Reports
- `/app/test_reports/iteration_30.json` — 100% (22/22) Milestones + QR Tickets
- `/app/test_reports/iteration_29.json` — 100% (28/28) Staff Portal + SwiftPOS
- `/app/test_reports/iteration_28.json` — 100% (41/41) VIP Tables + Bottles

## Credentials
- User: `luna@test.com` / `test123`
- Admin: `admin@lunagroup.com.au` / `Trent69!`
- Venue Portal: `venue@eclipse.com` / `venue123`
