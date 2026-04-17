# Luna Group VIP App - Product Requirements Document

## Latest Updates (April 17, 2026 - Session 3)

### COMPLETED: SwiftPOS Middleware (Plug-and-Play Module)
- **Standalone middleware**: `swiftpos_middleware.py` — bridges SwiftPOS POS terminals to Luna loyalty API
- **3 integration modes**: Poll (recommended to start), Webhook (push events), and POS API (real-time)
- **Test simulator**: `python swiftpos_middleware.py test` — verified working against live Luna API
- **Member matching**: SwiftPOS member key → email fallback → unmatched queue
- **Unmatched sales dashboard**: Staff can manually reconcile unmatched POS sales
- **Full setup guide**: `/app/SWIFTPOS_SETUP_GUIDE.md` — lists exactly what credentials to request from SwiftPOS reseller
- **Webhook auth key**: `SWIFTPOS_WEBHOOK_KEY` set in backend `.env` and validated on every request
- **Staff Portal integration**: Validate Reward tab now handles both reward QR codes AND milestone ticket QR codes (LUNA-TKT-*)

### COMPLETED: Milestones with One-Use QR Tickets
- 6 milestones (Newbie → Rising Star → VIP Status → Luna Elite → Supernova → Legend)
- Each reward = one-use QR ticket. Staff scans → ticket permanently deleted.
- Dedicated `/milestones` page + wallet page shows 3 milestones with "See All"
- Missions "See All" fixed, now loads from Lovable dashboard API

### COMPLETED: Staff Portal (Primary Points Engine)
- Quick Award + Reward/Ticket Validation + Transaction History
- Spending categories, receipt ref, tier multiplier preview

### COMPLETED: VIP Tables + Bottle Service + Geofence Admin Fix

---

## Architecture
```
/app/backend/
├── server.py
├── swiftpos_middleware.py    (NEW — standalone POS bridge)
├── routes/
│   ├── milestones.py         (NEW — milestone claims + QR tickets)
│   ├── perks.py              (Enhanced — quick award + SwiftPOS webhook)
│   ├── admin.py              (Venue messages CRUD)
│   ├── bookings.py           (VIP tables + bottle service)
│   └── ... (38 more)
├── SWIFTPOS_SETUP_GUIDE.md   (NEW — deployment instructions)
└── certs/
```

## Credentials
- User: `luna@test.com` / `test123`
- Admin: `admin@lunagroup.com.au` / `Trent69!`
- Venue: `venue@eclipse.com` / `venue123`
- SwiftPOS webhook key: `luna_swiftpos_prod_2026`

## Test Reports
- iteration_30: 100% (22/22) Milestones + QR Tickets
- iteration_29: 100% (28/28) Staff Portal + SwiftPOS
- iteration_28: 100% (41/41) VIP Tables + Bottles

## Pending
- Stripe production keys (P1, blocked)
- SwiftPOS reseller credentials (P2, user action needed)
