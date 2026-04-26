# Luna Group VIP — CHANGELOG

> Append-only log of shipped work. PRD.md = static product spec; ROADMAP.md = forward backlog.

## 2026-04-26 — Session: Missions trigger system + Push-token fix

### Mission Trigger System (server-side, anti-cheat)
- **NEW** `/app/backend/services/mission_events.py` — `emit_mission_event(user_id, event_type, increment, **filters)` exporting whitelist `SUPPORTED_EVENT_TYPES = { venue_visit, purchase_amount, purchase_count, social_share, referral_signup, event_rsvp, auction_bid, consecutive_days }`.
- Wired into 5 verified-action paths:
  - `routes/perks.py · quick_award` → `purchase_amount`, `purchase_count`, `venue_visit`
  - `routes/stories.py · share_story` → `social_share`
  - `routes/events.py · rsvp` → `event_rsvp`
  - `routes/auctions.py · place_bid` → `auction_bid`
  - `routes/auth.py · complete_referral` → `referral_signup` (fires for the referrer)
- Mission progress is now atomic, idempotent, and re-fires only on first completion.

### Lovable Mission/Milestone Editor — Backend
- `MissionCreate`/`MissionUpdate` now accept `event_type` + `event_filter` (validated against the whitelist; 400 on unsupported).
- **NEW** `GET /api/admin/mission-event-types` — dropdown schema for the Lovable form.
- **NEW** `POST /api/admin/missions/test-fire` — Lovable "Test trigger" button; emits a synthetic event and returns matched-mission progress.
- **NEW** `GET /api/admin/missions/activity` — diagnostic timeline (filters: user, mission, event_type, only_completed).
- **NEW** `POST /api/admin/milestones/{id}/rewards` + `DELETE /api/admin/milestones/{id}/rewards/{reward_id}` — granular reward editing.

### `/api/missions/progress` Lock-down
- Endpoint now admin-only (403 for users, 401 for no-auth). Marked as "admin override" in mission_progress doc when used.

### Data migration
- **Seeded** `db.milestones_custom` from the legacy hardcoded `MILESTONES` list — 6 records (newbie / rising_star / vip_status / luna_elite / supernova / legend).
- **Deleted** orphan duplicate "Weekend Warrior" mission (`mission_bfdddfb5`). Mission count: 7 → 6.
- Migration script: `/app/backend/tools/seed_milestones_and_cleanup.py` (idempotent).

### Mobile App: Push Token Registration BUG FIX
- **Root cause:** `usePushNotifications` hook ran on cold-boot before `authStore` had hydrated the JWT. The registration POST went out unauthenticated, was silently 401-rejected, and the device token was never stored against any user → Lovable broadcasts found `audience_size: 0`.
- **Fix:** rewrote `/app/frontend/src/hooks/usePushNotifications.ts` to gate registration on `useAuthStore.user.user_id && token`. Re-runs on every login/logout, so the token is always linked to the active user.
- **Verified:** backend round-trip via `/api/notifications/register-push-token` + `/api/notifications/push-status`.
- **User action required:** rebuild the EAS production build for TestFlight to pick up the fix; Expo Go works after a hot reload.

### Documentation
- **NEW** `/app/LUNA_STAFF_TRAINING_SOP.md` — 14-section training SOP (Welcome, Roles, App Tour, Staff Portal, Manager Dashboard, QR codes, Points, Tiers, Safety, Cheat Sheet, Troubleshooting, Escalation, Checklists, Sign-off + glossary).
- **NEW** `/app/LUNA_STAFF_TRAINING_SOP.pdf` (140 KB, 17 pages, custom Luna cover page).
- **NEW** `/app/LUNA_STAFF_TRAINING_DECK.pptx` (70 KB, 28 slides, ~2-hour facilitator deck).
- Build script: `/app/backend/tools/build_training_assets.py` (regenerate both with one command).

### UI tweak
- Removed three perks-teaser bullets from the login screen (`/app/frontend/app/login.tsx`); footer spacing rebalanced.

---
