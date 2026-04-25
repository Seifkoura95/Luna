# Luna Group VIP API — Master Reference

**Generated:** 2026-04-25 · **Endpoints:** 404 · **Tags:** 51 · **Schemas:** 109

**Production base URL:** `https://luna-production-889c.up.railway.app/api`  
**Local dev base URL:** `http://localhost:8001/api`  
**Swagger UI:** `<base>/docs`  ·  **OpenAPI JSON:** `<base>/openapi.json` (no `/api` prefix)

---

## 📖 Read me first

### Auth
- Most endpoints require a JWT **Bearer** token in `Authorization` header.
- Obtain via `POST /api/auth/login` → `{ token, user }`.
- Token expires in 7 days. Refresh via `POST /api/auth/refresh`.
- Admin/staff/manager endpoints additionally accept the `X-Luna-Hub-Key` header for server-to-server calls from Lovable.

### Role model
| Role | Can access |
|---|---|
| `user` | All consumer endpoints (own data only) |
| `staff` | Consumer + venue dashboard (own venue) + limited admin |
| `manager` | Staff + full venue admin for assigned venue |
| `venue_manager` | Same as manager |
| `venue_staff` | Same as staff |
| `admin` | Everything, all venues |
| `super_admin` | Same as admin |

### Response conventions
- All responses are JSON (except `.pkpass` downloads + static files).
- Timestamps are **ISO-8601 UTC** (`2026-04-24T22:15:00Z` or `...+00:00`).
- Monetary amounts are AUD decimal.
- Points are integers; `$0.025/point` conversion rate.
- MongoDB `_id` is **always stripped** from responses. Every resource has a human-friendly `id` string.

### Error shape
```json
{"detail": "Human-readable reason"}
```
Standard HTTP codes: `400` validation, `401` no/bad auth, `403` wrong role, `404` not found, `409` conflict, `422` pydantic validation, `500` server error, `503` integration offline.

### Feature flags in production (.env)
| Key | Current | Meaning |
|---|---|---|
| `SWIFTPOS_MOCK_MODE` | `true` | SwiftPOS calls are simulated (no live points dispatch). |
| `CHERRYHUB_MOCK_MODE` | `false` (prod) / `true` (local) | CherryHub OAuth + member reads live on Railway. |
| `POINTS_LEGACY_DIRECT_MONGO` | `true` | While SwiftPOS creds missing, points increment in Mongo instead of being pushed to SwiftPOS. Flip to `false` once creds arrive. |

---

## 📑 Table of contents

- [Health](#health) — 3 endpoints
- [public-config](#public-config) — 2 endpoints
- [Authentication](#authentication) — 17 endpoints
- [users](#users) — 1 endpoint
- [Venues](#venues) — 3 endpoints
- [venue-menus](#venue-menus) — 1 endpoint
- [Events](#events) — 11 endpoints
- [Missions](#missions) — 3 endpoints
- [Rewards](#rewards) — 8 endpoints
- [Points](#points) — 6 endpoints
- [Bookings](#bookings) — 9 endpoints
- [Subscriptions](#subscriptions) — 5 endpoints
- [Referrals](#referrals) — 4 endpoints
- [Tickets](#tickets) — 4 endpoints
- [Entry Tickets](#entry-tickets) — 3 endpoints
- [birthday](#birthday) — 7 endpoints
- [Boosts](#boosts) — 2 endpoints
- [Milestones](#milestones) — 5 endpoints
- [Stories](#stories) — 5 endpoints
- [Social](#social) — 20 endpoints
- [crews](#crews) — 8 endpoints
- [Friends](#friends) — 6 endpoints
- [Auctions](#auctions) — 11 endpoints
- [leaderboard](#leaderboard) — 7 endpoints
- [Campaigns](#campaigns) — 11 endpoints
- [promo](#promo) — 3 endpoints
- [vouchers](#vouchers) — 1 endpoint
- [Photos](#photos) — 5 endpoints
- [Notifications](#notifications) — 11 endpoints
- [Notifications WebSocket](#notifications-websocket) — 2 endpoints
- [WebSocket](#websocket) — 1 endpoint
- [Notification Tracking](#notification-tracking) — 2 endpoints
- [Push Broadcasts](#push-broadcasts) — 9 endpoints
- [location](#location) — 6 endpoints
- [geofences](#geofences) — 9 endpoints
- [safety](#safety) — 13 endpoints
- [Luna Loyalty](#luna-loyalty) — 11 endpoints
- [CherryHub](#cherryhub) — 14 endpoints
- [Perks](#perks) — 25 endpoints
- [Payments](#payments) — 9 endpoints
- [AI](#ai) — 14 endpoints
- [Churn Prediction](#churn-prediction) — 7 endpoints
- [Scheduled Jobs](#scheduled-jobs) — 6 endpoints
- [Webhooks](#webhooks) — 1 endpoint
- [Venue Admin — Auctions](#venue-admin-auctions) — 9 endpoints
- [Venue Admin — Users](#venue-admin-users) — 4 endpoints
- [Venue Dashboard](#venue-dashboard) — 8 endpoints
- [admin](#admin) — 58 endpoints
- [admin-safety](#admin-safety) — 5 endpoints
- [admin-swiftpos](#admin-swiftpos) — 6 endpoints
- [Misc](#misc) — 3 endpoints
- [Data models (schemas)](#data-models-schemas)

---

## Health
_Service liveness + deep dependency probes (Mongo / CherryHub / Resend)._

**Auth:** Not required.

### `GET /api/health` — Health Check
Shallow liveness check — just confirms the process is up.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/health/deep` — Health Deep
Deep health check — pings MongoDB, CherryHub OAuth, Resend in parallel.

Returns 200 regardless of individual check status — caller should inspect
the `ok` field on each sub-check and the overall `status`.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/health/version` — Health Version
Deploy-verification endpoint.

Returns the git SHA of the currently-running code, boot time, uptime, and
a list of **marker endpoints** that were added in this session (session 18).
Hit this after every Railway redeploy — if any marker shows `available: false`,
the deploy is still stale.

**Responses:**
  - `200` →  — Successful Response

---

## public-config
_Public config endpoints — no auth, safe to call from signup._

**Auth:** Not required.

### `GET /api/config/announcements` — Get Public Announcements
Public read of active announcements. Used by the home-screen ticker + What's New cards.

**Parameters:**
- `in_ticker` (query, boolean/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/config/public` — Get Public Config
Public config consumed by the mobile app on every launch/foreground.
Exposes only safe, display-level data (never secrets).

**Responses:**
  - `200` →  — Successful Response

---

## Authentication
_Login, registration, JWT refresh, password reset. JWT is required on every other authed endpoint._

**Auth:** Bearer JWT.

### `GET /api/auth/avatar/{user_id}` — Get Avatar
Get a user's avatar image.
Returns the image file directly.

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/auth/me` — Get Me
Get current authenticated user profile

**Responses:**
  - `200` →  — Successful Response

### `GET /api/auth/my-data` — Export My Data
Export all personal data we hold for the current user (Privacy Policy §8 / APP 12).
Returns a JSON blob the user can save. Mirrors what we'd email on request.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/avatar` — Upload Avatar
Upload a profile avatar image.
Accepts base64 encoded image data or multipart form data.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/change-email` — Change Email
Request email change (requires password verification)

**Request body:**
- Body (required): `application/json` → `ChangeEmailRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auth/change-password` — Change Password
Change user password

**Request body:**
- Body (required): `application/json` → `ChangePasswordRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auth/forgot-password` — Forgot Password
Request password reset. Generates a reset token.
In production, this would send an email with a reset link.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/login` — Login
Login with email and password

**Request body:**
- Body (required): `application/json` → `LoginRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auth/logout` — Logout
Logout user and invalidate their current token.
Adds token to blacklist so it can't be used again.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/logout-all` — Logout All Devices
Logout user from all devices by incrementing their token version.
All existing tokens become invalid.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/register` — Register
Register a new user account

**Request body:**
- Body (required): `application/json` → `RegisterRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auth/resend-verification` — Resend Verification Email Endpoint
Resend a fresh 6-digit OTP email for unverified users.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/reset-password` — Reset Password
Reset password using the token from forgot-password.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/auth/verify-email` — Verify Email
Verify user's email address by submitting the 6-digit OTP sent via email.

Body: {"code": "123456"}
Auth: Bearer token required (issued at /register).

Rate limiting: after 5 failed attempts for a given OTP, the OTP is
invalidated and the user must request a new one via /resend-verification.

**Responses:**
  - `200` →  — Successful Response

### `PUT /api/auth/profile` — Update Profile
Update user profile information

**Request body:**
- Body (required): `application/json` → `UpdateProfileRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/auth/account` — Delete Account
Delete user account. Anonymises all PII immediately; full DB row cleanup runs within 30 days per our Privacy Policy.

**Responses:**
  - `200` →  — Successful Response

### `DELETE /api/auth/avatar` — Delete Avatar
Delete user's avatar and reset to default.

**Responses:**
  - `200` →  — Successful Response

---

## users
_Current user mgmt (me, stats, settings)._

**Auth:** Bearer JWT.

### `GET /api/users/stats` — Get User Stats
Get current user's statistics

**Responses:**
  - `200` →  — Successful Response

---

## Venues
_The 9 Luna venues (Eclipse, After Dark, Su Casa BNE/GC, JuJu, Night Market, Ember & Ash, Pump, Mamacita)._

**Auth:** Bearer JWT.

### `GET /api/venues` — Get Venues
Get all venues, optionally filtered by region. Merges Lovable Hub overrides.

**Parameters:**
- `region` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venues/{venue_id}` — Get Venue
Get a specific venue by ID with live status. Merges Lovable Hub overrides.

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venues/{venue_id}/tables` — Get Venue Tables
Get available VIP tables for a venue on a given date

**Parameters:**
- `venue_id` (path, string, required)
- `date` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## venue-menus
_Per-venue food & drink menus._

**Auth:** Bearer JWT.

### `GET /api/venues/{venue_id}/menu` — Get Venue Menu
View-only food + drinks menu for JuJu's and Night Market.

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Events
_Nightlife events feed — mix of Luna-curated + Eventfinda imports._

**Auth:** Bearer JWT.

### `GET /api/events` — Get Events
Get events from Eventfinda (real-time data) with database fallback

**Parameters:**
- `venue_id` (query, string/null, optional)
- `location` (query, string/null, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `20`
- `category` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/featured` — Get Featured Events
Get featured/popular events

**Parameters:**
- `location` (query, string, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `5`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/feed` — Get Events Feed
Get events feed ONLY for Luna Group venues

**Parameters:**
- `limit` (query, integer, optional) — default `30`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/search` — Search Events Api
Search events by keyword

**Parameters:**
- `q` (query, string, required)
- `location` (query, string, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/tonight` — Get Tonight Events
Get events happening tonight

**Parameters:**
- `location` (query, string, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `10`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/upcoming` — Get Upcoming Events
Get upcoming events (next 30 days)

**Parameters:**
- `location` (query, string, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `30`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/weekend` — Get Weekend Events
Get events happening this weekend

**Parameters:**
- `location` (query, string, optional) — default `brisbane`
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/{event_id}` — Get Event Detail
Get event details by ID

**Parameters:**
- `event_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/{event_id}/attendees` — Get Event Attendees
Get list of attendees for an event (respects privacy settings)

**Parameters:**
- `event_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/events/{event_id}/rsvp` — Get My Rsvp
Get current user's RSVP status for an event

**Parameters:**
- `event_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/events/{event_id}/rsvp` — Rsvp To Event
RSVP to an event

**Parameters:**
- `event_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `EventRSVP`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Missions
_Gamification — complete a mission, earn points via SwiftPOS._

**Auth:** Bearer JWT.

### `GET /api/missions` — Get Missions
Get missions with user progress

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/missions/progress` — Update Mission Progress
Update progress on a mission

**Request body:**
- Body (required): `application/json` → `MissionProgressRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/missions/{mission_id}/claim` — Claim Mission Reward
Claim reward for completed mission - one time only

**Parameters:**
- `mission_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Rewards
_Catalog of redeemable rewards + redemption flow._

**Auth:** Bearer JWT.

### `GET /api/checkin/qr` — Generate Checkin Qr
Generate QR code for venue check-in

**Parameters:**
- `venue_id` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/redemptions/my` — Get My Redemptions
Get user's redemptions with QR codes

**Parameters:**
- `status` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/redemptions/{redemption_id}` — Get Redemption
Get a specific redemption with QR code

**Parameters:**
- `redemption_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/rewards` — Get Rewards
Get available rewards

**Parameters:**
- `category` (query, string/null, optional)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/wallet-passes` — Get Wallet Passes
Get all wallet passes for the current user

**Responses:**
  - `200` →  — Successful Response

### `POST /api/rewards/redeem` — Redeem Reward
Redeem a reward using points

**Parameters:**
- `reward_id` (query, string, required)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/rewards/redeem-with-qr` — Redeem Reward With Qr
Redeem reward and get a QR code for redemption

**Parameters:**
- `reward_id` (query, string, required)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/validate-qr` — Validate And Redeem Qr
Validate and redeem a QR code (one-time use) - for venue staff

**Parameters:**
- `qr_code` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Points
_Real-time balance pull + link status. Source of truth = SwiftPOS via CherryHub._

**Auth:** Bearer JWT.

### `GET /api/points/balance` — Get Points Balance
Get user's points balance and tier info

**Responses:**
  - `200` →  — Successful Response

### `GET /api/points/history` — Get Points History
Get user's points transaction history

**Parameters:**
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/points/my-balance` — My Balance
Refresh the user's balance from CherryHub (real-time SwiftPOS pull).
Used by the mobile wallet screen's pull-to-refresh + foreground sync.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/points/status` — Points Status
Is this user linked to CherryHub? Any pending SwiftPOS dispatches?

**Responses:**
  - `200` →  — Successful Response

### `POST /api/points/record-spending` — Record Spending
Record spending and award points (venue staff endpoint)

**Request body:**
- Body (required): `application/json` → `RecordSpendingRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/points/simulate-purchase` — Simulate Purchase
Simulate a purchase and award points (for testing)

**Parameters:**
- `amount` (query, number, required)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Bookings
_Booth / table / bottle reservations._

**Auth:** Bearer JWT.

### `GET /api/bookings/availability` — Get Availability
Get available time slots for a venue

**Parameters:**
- `venue_id` (query, string, required)
- `date` (query, string, required)
- `party_size` (query, integer, optional) — default `2`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/bookings/bottle-menu/{venue_id}` — Get Bottle Menu
Get bottle service menu for a venue. Merges admin image overrides from db.bottle_overrides.

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/bookings/bottle-orders` — Get My Bottle Orders
Get user's bottle service orders

**Responses:**
  - `200` →  — Successful Response

### `GET /api/bookings/my-reservations` — Get My Reservations
Get user's bookings and guestlist entries

**Responses:**
  - `200` →  — Successful Response

### `POST /api/bookings/bottle-preorder` — Create Bottle Preorder
Create a bottle service pre-order

**Request body:**
- Body (required): `application/json` → `BottlePreOrderCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/bookings/guestlist` — Add To Guestlist
Add to nightclub guestlist

**Request body:**
- Body (required): `application/json` → `GuestlistRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/bookings/reserve` — Create Booking
Create a restaurant reservation

**Request body:**
- Body (required): `application/json` → `BookingRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/bookings/bottle-order/{order_id}` — Cancel Bottle Order
Cancel a bottle service pre-order

**Parameters:**
- `order_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/bookings/{booking_id}` — Cancel Booking
Cancel a booking or guestlist entry

**Parameters:**
- `booking_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Subscriptions
_Stripe-backed tiered subscriptions (bronze → aurora)._

**Auth:** Bearer JWT.

### `GET /api/subscriptions/my` — Get My Subscription
Get current user's subscription

**Responses:**
  - `200` →  — Successful Response

### `GET /api/subscriptions/tiers` — Get Subscription Tiers
Get all available subscription tiers

**Responses:**
  - `200` →  — Successful Response

### `POST /api/subscriptions/cancel` — Cancel Subscription
Cancel current subscription

**Responses:**
  - `200` →  — Successful Response

### `POST /api/subscriptions/subscribe` — Subscribe To Tier
Subscribe to a tier.

- Free (bronze) tier: activates instantly.
- Paid tiers: creates a Stripe checkout session — the webhook activates
  the subscription only after payment.succeeded.
- DEV_MODE bypass for `luna@test.com`.

**Request body:**
- Body (required): `application/json` → `SubscribeRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/subscriptions/use-entry` — Use Free Entry
Use a free entry from subscription

**Parameters:**
- `venue_id` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Referrals
_Refer-a-friend with auto-award on both sides._

**Auth:** Bearer JWT.

### `GET /api/referral/code` — Get Referral Code
Get or generate user's unique referral code

**Responses:**
  - `200` →  — Successful Response

### `GET /api/referral/history` — Get Referral History
Get user's referral history

**Responses:**
  - `200` →  — Successful Response

### `POST /api/referral/apply` — Apply Referral Code
Apply a referral code for a new user

**Parameters:**
- `referral_code` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/referral/verify/{user_id}` — Verify And Complete Referral
Admin endpoint to verify a user and complete their referral

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Tickets
_Per-event tickets._

**Auth:** Bearer JWT.

### `GET /api/tickets` — Get User Tickets
Get user's tickets - active, upcoming, or history

**Parameters:**
- `status` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/tickets/add-guest` — Add Guest To Ticket
Add a guest to a ticket

**Request body:**
- Body (required): `application/json` → `AddGuestRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/tickets/purchase` — Purchase Ticket
Purchase tickets for an event

**Request body:**
- Body (required): `application/json` → `PurchaseTicketRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/tickets/{ticket_id}/guest/{guest_id}` — Remove Guest
Remove a guest from a ticket

**Parameters:**
- `ticket_id` (path, string, required)
- `guest_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Entry Tickets
_QR-scan door entry tickets._

**Auth:** Bearer JWT.

### `GET /api/entry-tickets/my` — List My Tickets
List entry tickets gifted to the authenticated user.

**Parameters:**
- `status` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/entry-tickets/{ticket_id}` — Get Ticket
Get a specific ticket (must belong to the caller).

**Parameters:**
- `ticket_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/entry-tickets/validate-qr` — Validate Entry Qr
Venue staff scan — consume a single-use entry ticket.
Accepts either staff JWT (role in staff/manager/admin) or the venue dashboard token.

**Request body:**
- Body (required): `application/json` → `ValidateQRRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## birthday
_Birthday voucher + branded email._

**Auth:** Bearer JWT.

### `GET /api/birthday/my-rewards` — Get My Birthday Rewards
Get user's birthday rewards history

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/birthday/status` — Get Birthday Status
Get user's birthday status and available rewards

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/birthday/upcoming` — Get Upcoming Birthdays
Get users with upcoming birthdays (for admin dashboard).
Returns users whose birthdays fall within the next N days.

**Parameters:**
- `days` (query, integer, optional) — default `7`
- `authorization` (header, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/birthday/wallet-passes` — Get Birthday Wallet Passes
Get user's birthday reward passes in wallet

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/birthday/admin/trigger-reminders` — Trigger Birthday Reminders
Admin endpoint to manually trigger birthday reminder job.
Useful for testing the scheduled job.

**Parameters:**
- `authorization` (header, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/birthday/claim/{reward_id}` — Claim Birthday Reward
Claim a birthday reward

**Parameters:**
- `reward_id` (path, string, required)
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/birthday/redeem/{reward_claim_id}` — Redeem Birthday Reward
Redeem a claimed birthday reward at venue

**Parameters:**
- `reward_claim_id` (path, string, required)
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Boosts
_Paid temporary multipliers / perks._

**Auth:** Bearer JWT.

### `GET /api/boosts` — Get Active Boosts
Get currently active point boosts

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/boosts/upcoming` — Get Upcoming Boosts
Get upcoming point boosts

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Milestones
_Lifetime achievement tracking._

**Auth:** Bearer JWT.

### `GET /api/milestones` — Get Milestones
Get all milestones with user progress and claimed/unclaimed ticket counts

**Responses:**
  - `200` →  — Successful Response

### `GET /api/milestones/tickets` — Get My Tickets
Get user's active milestone reward tickets

**Parameters:**
- `milestone_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/milestones/claim/{milestone_id}` — Claim Milestone
Claim a milestone. Generates one-use QR tickets for each reward.
User must have enough points (lifetime earned, not deducted).

**Parameters:**
- `milestone_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/milestones/tickets/validate-qr` — Validate Ticket Qr
Staff scans a milestone ticket QR code.
Validates and deletes the ticket in one step.

**Parameters:**
- `qr_code` (query, string, required)
- `venue_id` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/milestones/tickets/{ticket_id}/use` — Use Ticket
Staff uses (validates) a milestone reward ticket.
The ticket is permanently deleted after use.

**Parameters:**
- `ticket_id` (path, string, required)
- `venue_id` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Stories
_24h user-generated content feed._

**Auth:** Bearer JWT.

### `GET /api/stories/feed` — Get Story Feed
Get public story feed from all users

**Parameters:**
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/stories/my-stories` — Get My Stories
Get user's stories

**Responses:**
  - `200` →  — Successful Response

### `POST /api/stories/create` — Create Story
Create a story from a venue photo

**Request body:**
- Body (required): `application/json` → `CreateStoryRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/stories/generate-caption` — Generate Caption
Generate AI caption for a photo

**Parameters:**
- `venue_name` (query, string, required)
- `event_name` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/stories/share` — Share Story
Record a story share to social media

**Request body:**
- Body (required): `application/json` → `ShareStoryRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Social
_Social feed (posts, likes, comments) — the Instagram replacement._

**Auth:** Bearer JWT.

### `GET /api/social/feed` — Get Social Feed
Get social activity feed — shows public event interests from all users
and friends-only interests from your friends.

**Parameters:**
- `limit` (query, integer, optional) — default `30`
- `offset` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/social/interested/{event_id}` — Get Event Interested
Get who's interested in an event (respects visibility).

**Parameters:**
- `event_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/social/night-plan/{plan_id}` — Get Night Plan
Get a specific night plan with all details.

**Parameters:**
- `plan_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/social/night-plans` — Get My Night Plans
Get user's night plans (created or invited to).

**Responses:**
  - `200` →  — Successful Response

### `GET /api/social/poll/{poll_id}` — Get Poll
Get poll details and results.

**Parameters:**
- `poll_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/interest` — Express Interest
Express interest in an event — creates a social activity post.

**Request body:**
- Body (required): `application/json` → `EventInterestCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/like/{activity_id}` — Like Activity
Like someone's activity.

**Parameters:**
- `activity_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/night-plan` — Create Night Plan
Create a night plan with multiple venue stops.

**Request body:**
- Body (required): `application/json` → `NightPlanCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/night-plan/{plan_id}/invite` — Invite To Plan
Invite more friends or a crew to an existing plan.

**Parameters:**
- `plan_id` (path, string, required)
- `crew_id` (query, string/null, optional)

**Request body:**
- Body (optional): `application/json` → ``string`[]`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/night-plan/{plan_id}/like` — Like Plan
Like a crew night plan — crew members vote on the plan.

**Parameters:**
- `plan_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/night-plan/{plan_id}/respond` — Respond To Invite
Accept or decline a night plan invitation.

**Parameters:**
- `plan_id` (path, string, required)
- `accept` (query, boolean, optional) — default `True`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/poll` — Create Poll
Create a poll within a night plan. Only allowed for crew plans (not solo).

**Request body:**
- Body (required): `application/json` → `PollCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/poll/{poll_id}/close` — Close Poll
Close a poll and determine the winner.

**Parameters:**
- `poll_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/social/poll/{poll_id}/vote` — Vote On Poll
Vote on a poll option.

**Parameters:**
- `poll_id` (path, string, required)
- `option_id` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/social/night-plan/{plan_id}` — Update Night Plan
Update a night plan (title, date, or stops).

**Parameters:**
- `plan_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `NightPlanUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/social/night-plan/{plan_id}/stop` — Update Stop Time
Update the time or notes for a specific stop in a plan.

**Parameters:**
- `plan_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `StopTimeUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/social/interest/{event_id}` — Remove Interest
Remove interest from an event.

**Parameters:**
- `event_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/social/like/{activity_id}` — Unlike Activity
Unlike an activity.

**Parameters:**
- `activity_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/social/night-plan/{plan_id}` — Delete Night Plan
Delete a night plan.

**Parameters:**
- `plan_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/social/night-plan/{plan_id}/like` — Unlike Plan
Unlike a crew night plan.

**Parameters:**
- `plan_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## crews
_Friend-group scheduling + social nights._

**Auth:** Bearer JWT.

### `GET /api/crews` — Get User Crews
Get all crews the user is part of

**Responses:**
  - `200` →  — Successful Response

### `GET /api/crews/{crew_id}` — Get Crew Detail
Get detailed crew info

**Parameters:**
- `crew_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/crews/{crew_id}/split-status` — Get Split Status
Get payment split status for a crew

**Parameters:**
- `crew_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/crews/booth-bid` — Submit Crew Booth Bid
Submit a collective booth bid as a crew

**Request body:**
- Body (required): `application/json` → `BoothBidRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/crews/create` — Create Crew
Create a new crew for group planning

**Request body:**
- Body (required): `application/json` → `CreateCrewRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/crews/invite` — Invite To Crew
Invite someone to join a crew

**Request body:**
- Body (required): `application/json` → `InviteToCrewRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/crews/{crew_id}/join` — Join Crew
Accept crew invitation and join

**Parameters:**
- `crew_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/crews/{crew_id}/leave` — Leave Crew
Leave a crew

**Parameters:**
- `crew_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Friends
_Friend graph._

**Auth:** Bearer JWT.

### `GET /api/friends` — Get Friends
Get user's friends list

**Responses:**
  - `200` →  — Successful Response

### `GET /api/friends/requests` — Get Friend Requests
Get pending friend requests

**Responses:**
  - `200` →  — Successful Response

### `POST /api/friends/request` — Send Friend Request
Send a friend request by email or username

**Request body:**
- Body (required): `application/json` → `FriendRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/friends/requests/{request_id}/accept` — Accept Friend Request
Accept a friend request

**Parameters:**
- `request_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/friends/requests/{request_id}/decline` — Decline Friend Request
Decline a friend request

**Parameters:**
- `request_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/friends/{friend_id}` — Remove Friend
Remove a friend

**Parameters:**
- `friend_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Auctions
_Live auctions with bidding + activity heat._

**Auth:** Bearer JWT.

### `GET /api/auctions` — Get Auctions
Get all auctions with optional filters

**Parameters:**
- `venue_id` (query, string/null, optional)
- `status` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/auctions/notifications` — Get Auction Notifications
Get auction notifications for current user

**Responses:**
  - `200` →  — Successful Response

### `GET /api/auctions/watchlist` — Get Watchlist
Get user's auction watchlist

**Responses:**
  - `200` →  — Successful Response

### `GET /api/auctions/{auction_id}` — Get Auction Detail
Get detailed auction info with bid history

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/auctions/{auction_id}/activity` — Get Auction Activity
Get recent bidding activity for an auction (last 30 mins)

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/auctions/{auction_id}/bids` — Get Auction Bids
Get bid history for an auction

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auctions/bid` — Place Bid
Place a bid on an auction with optional auto-bid

**Request body:**
- Body (required): `application/json` → `PlaceBidRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auctions/notifications/mark-read` — Mark Auction Notifications Read
Mark auction notifications as read

**Request body:**
- Body (optional): `multipart/form-data` → `Body_mark_auction_notifications_read_api_auctions_notifications_mark_read_post`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auctions/subscribe` — Subscribe To Auction
Subscribe to auction notifications

**Request body:**
- Body (required): `application/json` → `AuctionSubscribeRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/auctions/watch` — Watch Auction
Add auction to user's watchlist for activity notifications

**Request body:**
- Body (required): `application/json` → `WatchlistRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/auctions/watch/{auction_id}` — Unwatch Auction
Remove auction from user's watchlist

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## leaderboard
_Points / visits / spend leaderboards + Nightly Crown daily prize._

**Auth:** Bearer JWT.

### `GET /api/leaderboard` — Get Leaderboard
Get the leaderboard rankings

period: all_time, monthly, weekly
category: points, visits, spend

**Parameters:**
- `period` (query, string, optional) — default `all_time`
- `category` (query, string, optional) — default `points`
- `limit` (query, integer, optional) — default `50`
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/leaderboard/daily-prize` — Get Daily Prize Info
Get info about the Nightly Crown daily prize:
- Prize amount & timezone
- Current #1 (live leader) so users can see who's in pole position
- Countdown target: next midnight (Australia/Brisbane) in UTC ISO
- Last night's winner (if any)
- Recent winners (last 7)

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/leaderboard/my-stats` — Get My Stats
Get detailed stats for current user

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/leaderboard/strategies` — Get Point Strategies
Get point-earning strategies and tips

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/leaderboard/top-earners` — Get Top Earners This Week
Get users who earned the most points this week

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/leaderboard/admin/award-now` — Admin Trigger Daily Award
Admin-only: manually trigger the Nightly Crown award (for testing).

- `force=true` bypasses the once-per-day idempotency guard.

**Parameters:**
- `force` (query, boolean, optional) — default `False`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/leaderboard/seed-sample-users` — Seed Sample Leaderboard Users
Seed sample users for leaderboard demonstration

**Responses:**
  - `200` →  — Successful Response

---

## Campaigns
_Marketing campaigns (venue-led)._

**Auth:** Bearer JWT.

### `GET /api/campaigns` — List Campaigns
List all campaigns with optional filtering

**Parameters:**
- `status` (query, string/null, optional)
- `campaign_type` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/campaigns/templates` — Get Campaign Templates
Get pre-built campaign templates

**Responses:**
  - `200` →  — Successful Response

### `GET /api/campaigns/{campaign_id}` — Get Campaign
Get a single campaign by ID

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/campaigns/{campaign_id}/stats` — Get Campaign Stats
Get detailed statistics for a campaign

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/campaigns` — Create Campaign
Create a new push notification campaign

**Request body:**
- Body (required): `application/json` → `CampaignCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/campaigns/preview-audience` — Preview Audience
Preview the estimated audience for targeting criteria

**Parameters:**
- `target_audience` (query, string, optional) — default `all`
- `target_venue` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/campaigns/{campaign_id}/cancel` — Cancel Campaign
Cancel a scheduled campaign

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/campaigns/{campaign_id}/duplicate` — Duplicate Campaign
Duplicate a campaign as a new draft

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/campaigns/{campaign_id}/send` — Send Campaign
Immediately send a campaign

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/campaigns/{campaign_id}` — Update Campaign
Update an existing campaign

**Parameters:**
- `campaign_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `CampaignUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/campaigns/{campaign_id}` — Delete Campaign
Delete a campaign

**Parameters:**
- `campaign_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## promo
_Promo codes._

**Auth:** Bearer JWT.

### `GET /api/promo/codes` — Get Available Promo Codes
Get list of available promo codes (for admin/testing)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/promo/validate/{code}` — Validate Promo Code
Validate a promo code without applying it

**Parameters:**
- `code` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/promo/apply` — Apply Promo Code
Apply a promo code to the user's account

**Request body:**
- Body (required): `application/json` → `ApplyPromoRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## vouchers
_One-off vouchers._

**Auth:** Bearer JWT.

### `GET /api/vouchers` — Get User Vouchers
Get all vouchers for the current user

**Responses:**
  - `200` →  — Successful Response

---

## Photos
_Venue photo galleries._

**Auth:** Bearer JWT.

### `GET /api/photos` — Get User Photos
Get photos user is tagged in

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/photos/image/{folder}/{filename}` — Serve Photo
Serve a photo file

**Parameters:**
- `folder` (path, string, required)
- `filename` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/photos/venue/{venue_id}` — Get Venue Photos
Get all photos for a specific venue

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/photos/venues` — Get Venue Galleries
Get list of all venue photo galleries with counts

**Responses:**
  - `200` →  — Successful Response

### `GET /api/video/background` — Serve Background Video
Serve the background video file

**Responses:**
  - `200` →  — Successful Response

---

## Notifications
_In-app notifications feed._

**Auth:** Bearer JWT.

### `GET /api/notifications` — Get Notifications
Get user's notifications

**Parameters:**
- `unread_only` (query, boolean, optional) — default `False`
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/notifications/preferences` — Get Notification Preferences
Get user's notification preferences

**Responses:**
  - `200` →  — Successful Response

### `GET /api/notifications/push-status` — Get Push Token Status
Get user's push notification token status

**Responses:**
  - `200` →  — Successful Response

### `GET /api/notifications/unread-count` — Get Unread Count
Get count of unread notifications

**Responses:**
  - `200` →  — Successful Response

### `POST /api/notifications/mark-read` — Mark Notifications Read
Mark notifications as read

**Request body:**
- Body (optional): `multipart/form-data` → `Body_mark_notifications_read_api_notifications_mark_read_post`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/notifications/register-push-token` — Register Push Token
Register device push token for notifications

**Request body:**
- Body (required): `application/json` → `RegisterPushTokenRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/notifications/test-push` — Test Push Notification
Admin: Send a test push notification to a user (or self)

**Request body:**
- Body (required): `application/json` → `TestPushRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/notifications/preferences` — Update Notification Preferences
Update notification preferences

**Request body:**
- Body (required): `application/json` → `NotificationPreferencesRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/notifications/push-token` — Remove Push Token
Remove a push token

**Parameters:**
- `token` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/notifications/push-tokens/all` — Remove All Push Tokens
Remove all push tokens for the current user

**Responses:**
  - `200` →  — Successful Response

### `DELETE /api/notifications/{notification_id}` — Delete Notification
Delete a notification

**Parameters:**
- `notification_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Notifications WebSocket
_Live WS push into the mobile app._

**Auth:** Bearer JWT.

### `GET /api/ws/notifications/online/{user_id}` — Check User Online
Check if a specific user is currently connected.

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/ws/notifications/stats` — Get Notification Ws Stats
Get notification WebSocket statistics.

**Responses:**
  - `200` →  — Successful Response

---

## WebSocket
_Generic WebSocket endpoint._

**Auth:** Bearer JWT.

### `GET /api/ws/stats` — Get Websocket Stats
Get WebSocket connection statistics.

**Responses:**
  - `200` →  — Successful Response

---

## Notification Tracking
_Public open/click pixels for email & push analytics._

**Auth:** Not required.

### `POST /api/notifications/{notification_id}/track-click` — Track Click
Mobile app calls this when the deep link from a push is followed.

**Parameters:**
- `notification_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/notifications/{notification_id}/track-open` — Track Open
Mobile app calls this when a push notification is opened.

**Parameters:**
- `notification_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Push Broadcasts
_Admin CRUD for Expo push notifications with scheduling + targeting._

**Auth:** Bearer JWT.

### `GET /api/admin/push-broadcasts` — List Broadcasts
List push broadcasts, newest first.

**Parameters:**
- `status` (query, string/null, optional)
- `audience` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/push-broadcasts/audience-preview` — Audience Preview
Preview how many users an audience string will reach — before sending.

Returns `{user_count, with_push_token_count, sample_names}`.
The `user_count` is total users that match the audience filter; the
`with_push_token_count` is the subset actually reachable via push.

**Parameters:**
- `audience` (query, string, optional) — default `all`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/push-broadcasts/users-search` — Users Search
Typeahead search for the individual-user audience picker.

Matches name / email / phone (case-insensitive). Only returns users who
have at least one push token so ops don't pick unreachable users.

**Parameters:**
- `q` (query, string, optional) — default ``
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/push-broadcasts/{broadcast_id}` — Get Broadcast
Get a single broadcast by ID.

**Parameters:**
- `broadcast_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/push-broadcasts` — Create Broadcast
Create a push broadcast (draft, scheduled, or send immediately).

**Request body:**
- Body (required): `application/json` → `BroadcastCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/push-broadcasts/{broadcast_id}/send` — Send Broadcast
Send a draft or scheduled broadcast immediately.

**Parameters:**
- `broadcast_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/push-broadcasts/{broadcast_id}/test` — Send Test Broadcast
Send this broadcast to the calling admin's own device(s) only.

Does NOT mark the broadcast as sent. Perfect for previewing copy + deep-link
behaviour before dispatching to the full audience.

**Parameters:**
- `broadcast_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/push-broadcasts/{broadcast_id}` — Update Broadcast
Update a broadcast. Only allowed for draft/scheduled status.

**Parameters:**
- `broadcast_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `BroadcastUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/push-broadcasts/{broadcast_id}` — Delete Broadcast
Delete a broadcast (any status).

**Parameters:**
- `broadcast_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## location
_User location updates + venue proximity._

**Auth:** Bearer JWT.

### `GET /api/location/crew/{crew_id}` — Get Crew Locations
Get locations of all crew members

**Parameters:**
- `crew_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/location/me` — Get My Location
Get current user's last known location

**Responses:**
  - `200` →  — Successful Response

### `GET /api/location/nearby-friends` — Get Nearby Friends
Get friends who are nearby or at the same venue

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/location/share/{crew_id}` — Toggle Location Sharing
Enable/disable location sharing with crew

**Parameters:**
- `crew_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `LocationShareRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/location/update` — Update Location
Update user's current location

**Request body:**
- Body (required): `application/json` → `LocationUpdateRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/location/share` — Stop Location Sharing
Stop sharing location with all crews

**Responses:**
  - `200` →  — Successful Response

---

## geofences
_Venue geofence definitions + enter/exit events._

**Auth:** Bearer JWT.

### `GET /api/geofences` — Get Active Geofences
Get all active geofence zones for the mobile app

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/geofences/admin/all` — Get All Geofences
Get all geofences (admin only)

**Parameters:**
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/geofences/admin/analytics` — Get Geofence Analytics
Get geofence trigger analytics (admin only)

**Parameters:**
- `period` (query, string, optional) — default `week`
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/geofences/my-triggers` — Get My Triggers
Get user's recent geofence trigger history

**Parameters:**
- `limit` (query, integer, optional) — default `20`
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/geofences/admin/create` — Create Geofence
Create a new geofence zone (admin only)

**Parameters:**
- `authorization` (header, string, optional)

**Request body:**
- Body (required): `application/json` → `routes__geofences__GeofenceCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/geofences/check-location` — Check Location
Check if user is within any geofence zones.
If multiple venues in the same cluster are nearby, send ONE generic notification.
Otherwise send the venue-specific message.

**Parameters:**
- `authorization` (header, string, optional)

**Request body:**
- Body (required): `application/json` → `LocationUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/geofences/seed` — Seed Geofences
Seed default geofences for Luna Group venues

**Responses:**
  - `200` →  — Successful Response

### `PUT /api/geofences/admin/{geofence_id}` — Update Geofence
Update a geofence zone (admin only)

**Parameters:**
- `geofence_id` (path, string, required)
- `authorization` (header, string, optional)

**Request body:**
- Body (required): `application/json` → `routes__geofences__GeofenceUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/geofences/admin/{geofence_id}` — Delete Geofence
Delete a geofence zone (admin only)

**Parameters:**
- `geofence_id` (path, string, required)
- `authorization` (header, string, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## safety
_Silent SOS alerts + emergency contacts._

**Auth:** Bearer JWT.

### `GET /api/safety/alerts/active` — Get Active Alerts
Get active safety alerts for user's crews

**Responses:**
  - `200` →  — Successful Response

### `GET /api/safety/emergency-contacts` — Get Emergency Contacts
Get user's emergency contacts

**Responses:**
  - `200` →  — Successful Response

### `GET /api/safety/emergency-services` — Get Emergency Services
Get emergency services contact numbers

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/safety/notifications` — Get Safety Notifications
Get safety-related notifications

**Responses:**
  - `200` →  — Successful Response

### `GET /api/safety/rideshare-links` — Get Rideshare Links
Get rideshare deep links for a venue

**Parameters:**
- `venue_id` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/alert` — Send Safety Alert
Send a safety alert to crew members or venue security

**Request body:**
- Body (required): `application/json` → `SafetyAlertRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/alerts/{alert_id}/acknowledge` — Acknowledge Alert
Acknowledge a safety alert

**Parameters:**
- `alert_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/alerts/{alert_id}/resolve` — Resolve Alert
Mark a safety alert as resolved

**Parameters:**
- `alert_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/emergency-contacts` — Add Emergency Contact
Add an emergency contact

**Request body:**
- Body (required): `application/json` → `EmergencyContactRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/lost-property` — Report Lost Property
Report lost property

**Request body:**
- Body (required): `application/json` → `LostPropertyRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/report-incident` — Report Incident
Report a safety incident

**Request body:**
- Body (required): `application/json` → `IncidentReportRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/safety/silent-alert` — Send Silent Alert
Send a silent SOS alert.

Body: { latitude: float, longitude: float, venue_id?: str, activation_method?: str }

Actions:
1. Persists the alert with GPS coords and a Google Maps link.
2. If no `venue_id` supplied, resolves the closest Luna venue (within 2 km).
3. Notifies in-app + push to:
     - the user's crew members (all crews they belong to)
     - every `venue_manager` / `venue_staff` / `staff` assigned to the matched venue
     - every `admin` / `super_admin` (Luna ops)
4. Logs emergency contacts count (SMS dispatch will be wired to Twilio in a later pass).

**Responses:**
  - `200` →  — Successful Response

### `DELETE /api/safety/emergency-contacts/{contact_id}` — Delete Emergency Contact
Delete an emergency contact

**Parameters:**
- `contact_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Luna Loyalty
_Apple Wallet / Google Wallet pass generation._

**Auth:** Bearer JWT.

### `GET /api/loyalty/member-card` — Get Member Card
Get digital member card data with QR code

**Responses:**
  - `200` →  — Successful Response

### `GET /api/loyalty/member-card/preview` — Get Member Card Html
Serve the dynamic HTML member card with real user data

**Parameters:**
- `token` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/loyalty/member-card/preview.png` — Get Member Card Preview
Redirect to the dynamic HTML card preview

**Responses:**
  - `200` →  — Successful Response

### `GET /api/loyalty/member-card/qr.png` — Get Member Card Qr Image
Get QR code image directly (for sharing/printing)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/loyalty/transactions` — Get Transactions
Get user's loyalty transaction history

**Parameters:**
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/loyalty/wallet-pass/apple` — Generate Apple Wallet Pass
Generate Apple Wallet .pkpass file for the member

**Parameters:**
- `token` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/loyalty/wallet-pass/google` — Generate Google Wallet Link
Generate Google Wallet save link for the member's loyalty card

**Responses:**
  - `200` →  — Successful Response

### `POST /api/loyalty/points/award` — Award Points
Award points for a purchase. Staff can award to any user, members award to self.

**Request body:**
- Body (required): `application/json` → `AwardPointsRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/loyalty/points/redeem` — Redeem Points
Redeem points (deduct from balance)

**Request body:**
- Body (required): `application/json` → `RedeemPointsRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/loyalty/scan` — Scan Member Qr
Staff scans a member QR code and gets their profile

**Parameters:**
- `qr_data` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/loyalty/staff/award` — Staff Award Points
Staff-only: Award points to a member after recording a purchase

**Request body:**
- Body (required): `application/json` → `StaffAwardRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## CherryHub
_CherryHub OAuth + member key + wallet pass + live points read._

**Auth:** Bearer JWT.

### `GET /api/cherryhub/admin/probe` — Admin Probe
Diagnostic probe — fires safe READ calls against CherryHub and reports
exactly which endpoints are reachable with our current credentials.

Admin only. Makes no writes.

Query params (all optional):
  ?email=X        test get_member_by_email with this email
  ?member_key=X   test get_member_by_key with this member_key
  ?search_after=ISO8601  test points-transactions search

**Responses:**
  - `200` →  — Successful Response

### `GET /api/cherryhub/admin/sync-stats` — Admin Sync Stats
Returns poller stats for the last 24h + most-recent run info.

Fields:
  - last_sync_at: most recent `last_cherryhub_sync` across all users (ISO8601)
  - linked_users: how many users have a CherryHub member_key
  - synced_last_24h: users whose watermark advanced in last 24h
  - imported_24h / 7d: count of ledger entries with source=cherryhub in that window
  - redemptions_24h / awards_24h: breakdown
  - points_net_24h: sum of amount over last 24h (signed — negative = net outflow)
  - mock_mode: whether the poller is currently a no-op

**Responses:**
  - `200` →  — Successful Response

### `GET /api/cherryhub/points` — Get Cherryhub Points
Display balance. Prefers CherryHub's value when linked, falls back to local.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/cherryhub/public/balance/{member_key}` — Public Balance
Return the current Luna points balance for a CherryHub member_key.

CherryHub hits this on every in-store tap so they can show the live total.

**Parameters:**
- `member_key` (path, string, required)
- `X-CherryHub-Api-Key` (header, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/cherryhub/public/health` — Public Health
Simple health + auth check that CherryHub can hit to verify their key.

**Parameters:**
- `X-CherryHub-Api-Key` (header, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/cherryhub/public/ledger/{member_key}` — Public Ledger
Return Luna earn-ledger entries for a member since a timestamp.

CherryHub uses this to pull new point-earn events (bookings, missions,
auctions, birthdays) and mirror them into their own records.

**Parameters:**
- `member_key` (path, string, required)
- `since` (query, string/null, optional) — ISO-8601 timestamp, returns entries strictly after this
- `limit` (query, integer, optional) — default `200`
- `X-CherryHub-Api-Key` (header, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/cherryhub/status` — Get Cherryhub Status
Connection status for the current user.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/cherryhub/transactions` — Get Points Transactions
Local Luna ledger entries for the current user.

**Parameters:**
- `limit` (query, integer, optional) — default `20`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/cherryhub/admin/sync-now` — Admin Sync Now
Force an immediate CherryHub poll (admin-only).

- No `user_id` query param → syncs every linked user.
- `?user_id=XXX` → syncs only that user.
Normally APScheduler runs this every 2 minutes automatically.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/cherryhub/admin/test-award` — Admin Test Award
Fires a LIVE points-award at CherryHub so you can verify movement in their reports.

Defaults to +10 points. Use query params to override:
  ?points=10                    (int, default 10)
  ?member_key=LUNA-XXXX         (defaults to the calling admin's linked member)
  ?reason=Luna+Test             (url-encoded reason)

WARNING: This is a live write to CherryHub. Only use from the admin portal
for connectivity testing. Stamps RequestDetails.origin=luna_app so our own
poller skips these to avoid double-count.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/cherryhub/link` — Link Cherryhub Account
Link existing CherryHub member to the current Luna user.

**Request body:**
- Body (required): `application/json` → `CherryHubLinkRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/cherryhub/login` — Login With Cherryhub
Login using CherryHub credentials. Creates or links a Luna user as needed.

**Request body:**
- Body (required): `application/json` → `CherryHubLoginRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/cherryhub/register` — Register Cherryhub Member Endpoint
Register the current user as a new CherryHub member.

**Request body:**
- Body (required): `application/json` → `CherryHubRegisterRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/cherryhub/wallet-pass` — Generate Wallet Pass
Retrieve the CherryHub-issued digital member card for Apple / Google Wallet.

**Request body:**
- Body (required): `application/json` → `WalletPassRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Perks
_Legacy SwiftPOS webhook + perks ledger._

**Auth:** Bearer JWT.

### `GET /api/perks/admin/logs` — Get All Perk Logs
Get all perk logs for admin/dashboard

**Parameters:**
- `log_type` (query, string/null, optional)
- `venue_id` (query, string/null, optional)
- `date` (query, string/null, optional)
- `limit` (query, integer, optional) — default `100`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/admin/stats` — Get Perk Stats
Get perk usage statistics

**Parameters:**
- `days` (query, integer, optional) — default `30`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/discounts/eligibility/{user_id}` — Check Discount Eligibility
Check user's restaurant discount eligibility

**Parameters:**
- `user_id` (path, string, required)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/discounts/history/{user_id}` — Get Discount History
Get discount application history for a user

**Parameters:**
- `user_id` (path, string, required)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/drinks/history/{user_id}` — Get Drink History
Get drink redemption history for a user

**Parameters:**
- `user_id` (path, string, required)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/drinks/voucher/{user_id}` — Get Drink Voucher
Get user's complimentary drink voucher status

**Parameters:**
- `user_id` (path, string, required)
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/entry/guest/history/{user_id}` — Get Guest History
Get guest entry history for a member

**Parameters:**
- `user_id` (path, string, required)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/entry/guest/remaining/{user_id}` — Get Guest Remaining
Check remaining guest slots for today

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/entry/history/{user_id}` — Get Entry History
Get entry history for a user

**Parameters:**
- `user_id` (path, string, required)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/member/search` — Search Member
Search for a member by name, email, or phone

**Parameters:**
- `q` (query, string, optional) — default ``

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/member/{user_id}/profile` — Get Member Profile
Get full member profile for staff view

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/spending-categories` — Get Spending Categories
Return the list of spending categories for the staff award UI

**Responses:**
  - `200` →  — Successful Response

### `GET /api/perks/staff/transactions` — Get Staff Transactions
Get staff transaction log (all quick awards, entries, redemptions at a venue)

**Parameters:**
- `venue_id` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/staff/transactions/summary` — Get Staff Transaction Summary
Get summary stats for staff transactions (today / week / month)

**Parameters:**
- `venue_id` (query, string/null, optional)
- `period` (query, string, optional) — default `today`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/perks/status` — Get Perks Status
Get all perk statuses for the current user

**Responses:**
  - `200` →  — Successful Response

### `GET /api/perks/swiftpos/unmatched` — Get Unmatched Sales
Get sales that couldn't be matched to a Luna member (for manual reconciliation)

**Parameters:**
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/discounts/apply` — Apply Discount
Apply and log a restaurant discount

**Request body:**
- Body (required): `application/json` → `DiscountApplyRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/drinks/redeem` — Redeem Drink
Redeem a complimentary drink

**Request body:**
- Body (required): `application/json` → `DrinkRedeemRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/entry/guest` — Log Guest Entry
Log a guest entry for a Gold member

**Request body:**
- Body (required): `application/json` → `GuestEntryRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/entry/log` — Log Entry
Log a venue entry

**Request body:**
- Body (required): `application/json` → `EntryLogRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/entry/verify` — Verify Entry
Verify if a member is eligible for free entry.
Called when staff scans member QR at venue entrance.

**Request body:**
- Body (required): `application/json` → `EntryVerifyRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/quick-award` — Quick Award Points
Fast points award: staff scans member QR → enters $ amount → points auto-calculated.
Designed for speed during busy service. Logs full audit trail.

**Request body:**
- Body (required): `application/json` → `QuickAwardRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/swiftpos/match/{receipt_number}` — Match Swiftpos Sale
Manually match an unmatched SwiftPOS sale to a Luna member

**Parameters:**
- `receipt_number` (path, string, required)
- `user_id` (query, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/swiftpos/sale` — Handle Swiftpos Sale
SwiftPOS Sale Webhook — auto-awards points when a sale is completed at the POS.

Integration options:
1. SwiftPOS POS API (port 33300) → middleware → this endpoint
2. SwiftPOS Web API → direct POST to this endpoint  
3. Manual trigger from SwiftPOS Back Office via HTTP call

The endpoint looks up the member by member_key or email,
calculates tier-adjusted points, and credits them immediately.

**Request body:**
- Body (required): `application/json` → `SwiftPOSSaleWebhook`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/perks/validate-reward` — Validate Reward Qr
Staff scans a customer's reward redemption QR code.
Validates it, marks as used, returns reward details.

**Request body:**
- Body (required): `application/json` → `ValidateRewardQRRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Payments
_Stripe checkout initialisation._

**Auth:** Bearer JWT.

### `GET /api/payments/gift-card/redeem/{gift_code}` — Get Gift Card Info
Get gift card info by code (public endpoint for share links)

**Parameters:**
- `gift_code` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/payments/history` — Get Payment History
Get user's payment history

**Responses:**
  - `200` →  — Successful Response

### `GET /api/payments/packages` — Get Packages
Get all available payment packages

**Responses:**
  - `200` →  — Successful Response

### `GET /api/payments/status/{session_id}` — Get Payment Status
Get payment status for a checkout session

**Parameters:**
- `session_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/payments/wallet/balance` — Get Wallet Balance
Get user's wallet balance

**Responses:**
  - `200` →  — Successful Response

### `POST /api/payments/checkout` — Create Checkout Session
Create a Stripe checkout session for a package

**Request body:**
- Body (required): `application/json` → `CreateCheckoutRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/payments/gift-card/checkout` — Create Gift Card Checkout
Create a Stripe checkout for a gift card with 10% bonus value

**Request body:**
- Body (required): `application/json` → `GiftCardCheckoutRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/payments/gift-card/claim/{gift_code}` — Claim Gift Card
Claim a gift card (existing member credits wallet, new member creates pending)

**Parameters:**
- `gift_code` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/payments/gift-card/send` — Send Gift Card
Create a gift card to send to a friend via email/share link

**Request body:**
- Body (required): `application/json` → `SendGiftCardRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## AI
_GPT-powered personalisation (event picks, chat, etc.)._

**Auth:** Bearer JWT.

### `GET /api/ai/admin/chat-logs` — Get All Chat Logs
Admin endpoint to view chat logs.
Requires admin/staff role.

**Parameters:**
- `user_id` (query, string/null, optional)
- `limit` (query, integer, optional) — default `100`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/ai/admin/chat-stats` — Get Chat Stats
Admin endpoint to get chat usage statistics.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/ai/chat/history` — Get My Chat History
Get chat history for the current user.
Only returns messages belonging to the authenticated user.

**Parameters:**
- `session_id` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/ai/chat/sessions` — Get My Chat Sessions
Get list of chat sessions for the current user.
Each session is isolated to this user only.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/ai/health` — Ai Health Check
Check if AI service is operational.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/ai/my-churn-status` — Get My Churn Status
Get current user's engagement status (used internally for win-back campaigns).

**Responses:**
  - `200` →  — Successful Response

### `POST /api/ai/auction-nudge` — Generate Auction Nudge
Dynamic Auction Bid Nudging - Generate AI-powered outbid notification.

**Request body:**
- Body (required): `application/json` → `AuctionNudgeRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/chat` — Ai Chat
AI Concierge Chat - Chat with Luna AI for venue questions and recommendations.
Chat history is stored per-user with strict isolation.

**Request body:**
- Body (required): `application/json` → `ChatRequest`

**Responses:**
  - `200` → `ChatResponse` — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/churn-analysis` — Analyze Churn Risk
Churn Prediction - Analyze user churn risk and generate win-back message.
Admin endpoint for batch processing.

**Request body:**
- Body (required): `application/json` → `ChurnAnalysisRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/memory-recap` — Generate Memory Recap
AI Memory Recap - Generate personalized night recap summary.

**Request body:**
- Body (required): `application/json` → `MemoryRecapRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/personalized-events` — Get Personalized Events
Personalized "Tonight for You" - Get AI-curated event recommendations.

**Request body:**
- Body (required): `application/json` → `PersonalizedEventsRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/photo-caption` — Generate Photo Caption
AI Photo Captioning - Generate captions for venue photos.

**Request body:**
- Body (required): `application/json` → `PhotoCaptionRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/ai/smart-mission` — Generate Smart Mission
Smart Mission Generation - Create AI-powered personalized missions.

**Request body:**
- Body (optional): `application/json` → `SmartMissionRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/ai/chat/history` — Clear My Chat History
Clear chat history for the current user.
Can clear all history or a specific session.

**Parameters:**
- `session_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Churn Prediction
_Churn-risk scoring + win-back dispatch._

**Auth:** Bearer JWT.

### `GET /api/churn/analyze/{user_id}` — Analyze User Churn
Analyze churn risk for a specific user.
Returns detailed risk metrics and win-back recommendations.

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/churn/campaigns` — Get Win Back Campaigns
Get win-back campaign history.

**Parameters:**
- `status` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/churn/dashboard` — Get Churn Dashboard
Get churn statistics for venue dashboard.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/churn/my-status` — Get My Churn Status
Get current user's engagement status and any available offers.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/churn/batch-analyze` — Run Batch Analysis
Run batch churn analysis on users.
Admin/staff only endpoint.

**Request body:**
- Body (required): `application/json` → `BatchAnalysisRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/churn/claim-offer` — Claim Win Back Offer
User claims their win-back offer.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/churn/trigger-winback` — Trigger Win Back
Trigger a win-back campaign for a user.
Admin/staff only endpoint.

**Request body:**
- Body (required): `application/json` → `TriggerWinBackRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Scheduled Jobs
_Admin triggers for scheduler-run tasks._

**Auth:** Bearer JWT.

### `GET /api/jobs/churn-summary` — Get Churn Summary
Get summary of churn analysis results.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/jobs/status` — Get Jobs Status
Get status of scheduled jobs.
Admin only endpoint.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/jobs/win-back-summary` — Get Win Back Summary
Get summary of win-back campaign results.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/jobs/start-scheduler` — Start Scheduler
Start the scheduled jobs scheduler.
Admin only endpoint.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/jobs/stop-scheduler` — Stop Scheduler
Stop the scheduled jobs scheduler.
Admin only endpoint.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/jobs/trigger` — Trigger Job
Manually trigger a scheduled job.
Admin only endpoint.

**Request body:**
- Body (required): `application/json` → `TriggerJobRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Webhooks
_Inbound webhooks (Stripe)._

**Auth:** Not required.

### `POST /api/api/webhook/stripe` — Stripe Webhook
Handle Stripe webhook events

**Responses:**
  - `200` →  — Successful Response

---

## Venue Admin — Auctions
_Venue manager CRUD for auctions + image upload._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/venue-admin/auctions` — Get All Auctions

**Parameters:**
- `status` (query, string/null, optional)
- `venue_id` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue-admin/auctions/image/{filename}` — Serve Auction Image
Serve an uploaded auction image. Public (no auth).

**Parameters:**
- `filename` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue-admin/auctions/{auction_id}` — Get Auction Details

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue-admin/auctions` — Create Auction

**Request body:**
- Body (required): `application/json` → `CreateAuctionRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue-admin/auctions/upload-image` — Upload Auction Image
Upload an image for an auction.

Accepts:
  - `multipart/form-data` with field name `file` (recommended from Lovable)
  - `application/json` with `{"image": "data:image/...;base64,..."}`

Returns the URL to store on `auctions.image_url`.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/venue-admin/auctions/{auction_id}/publish` — Publish Auction

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue-admin/auctions/{auction_id}/unpublish` — Unpublish Auction

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/venue-admin/auctions/{auction_id}` — Update Auction

**Parameters:**
- `auction_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `UpdateAuctionRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/venue-admin/auctions/{auction_id}` — Delete Auction

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Venue Admin — Users
_Venue manager user lookups._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/venue-admin/users` — Get All Users
Get all users with full analytics for venue dashboard.

**Parameters:**
- `search` (query, string/null, optional)
- `tier` (query, string/null, optional)
- `sort_by` (query, string, optional) — default `total_spend`
- `limit` (query, integer, optional) — default `50`
- `offset` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue-admin/users/{user_id}` — Get User Full Profile
Get comprehensive user profile with all analytics.

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue-admin/users/{user_id}/add-points` — Add Points To User
Manually add (or deduct) points for a user (manager/admin only).

**Parameters:**
- `user_id` (path, string, required)
- `points` (query, integer, required)
- `reason` (query, string, optional) — default `Manual adjustment`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/venue-admin/users/{user_id}` — Update User Profile
Update user profile (manager/admin only).

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Venue Dashboard
_Venue manager operational dashboard._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/venue/analytics` — Get Venue Analytics
Get detailed analytics for venue

**Parameters:**
- `period` (query, string, optional) — default `week`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue/analytics/auctions` — Get Venue Auction Analytics
Get auction analytics for venue

**Parameters:**
- `period` (query, string, optional) — default `month`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue/analytics/points` — Get Venue Points Analytics
Get points analytics for venue

**Parameters:**
- `period` (query, string, optional) — default `month`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue/analytics/revenue` — Get Venue Revenue Analytics
Get revenue analytics for venue

**Parameters:**
- `period` (query, string, optional) — default `month`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/venue/dashboard` — Get Venue Dashboard
Get venue dashboard data

**Responses:**
  - `200` →  — Successful Response

### `GET /api/venue/redemptions` — Get Venue Redemptions
Get redemptions for venue dashboard

**Parameters:**
- `status` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`
- `offset` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue/register-staff` — Register Venue Staff
Register venue staff - requires admin or venue_manager

**Request body:**
- Body (required): `application/json` → `VenueStaffRegister`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/venue/scan-qr` — Venue Scan Qr
Venue scans and validates a QR code - marks as redeemed

**Request body:**
- Body (required): `application/json` → `ScanQRRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## admin
_Global admin — stats, users, venues, config, milestones, bottles, entry tickets, announcements._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/admin/announcements` — List Announcements Admin

**Parameters:**
- `active` (query, boolean/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/auctions` — List Auctions Admin
List all auctions (admin view)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/boosts` — List Boosts
List all boosts (admin view)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/bottles` — List Bottles Admin
List all bottles with their current (potentially overridden) image URLs.

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/cluster-messages` — List Cluster Messages
List all custom cluster push messages

**Parameters:**
- `cluster` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/config` — Get App Config Admin
Admin view of the app config.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/entry-tickets` — List Entry Tickets Admin
List entry tickets (admin view). Filter by user_id / venue_id / status.

**Parameters:**
- `user_id` (query, string/null, optional)
- `venue_id` (query, string/null, optional)
- `status` (query, string/null, optional)
- `limit` (query, integer, optional) — default `100`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/geofence-analytics` — Get Geofence Analytics
Get geofence trigger analytics

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/geofences` — List Geofences
List all geofences

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/milestones` — List Milestones Admin
List milestones. Reads from db.milestones_custom, falls back to code defaults.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/missions` — List Missions
List all missions (admin view)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/push-messages` — List Push Messages
List all custom venue push messages (from DB). Falls back to code defaults if empty.

**Parameters:**
- `venue_id` (query, string/null, optional)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/rewards` — List Rewards Admin
List all rewards (admin view)

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/stats` — Get Admin Stats
Get admin dashboard statistics

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/users` — List Users Admin
List users with optional search (matches email or name, case-insensitive) and role filter.

**Parameters:**
- `q` (query, string/null, optional)
- `role` (query, string/null, optional)
- `limit` (query, integer, optional) — default `50`
- `skip` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/users/{user_id}` — Get User Admin
Get a single user by user_id.

**Parameters:**
- `user_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/users/{user_id}/points-transactions` — Get User Points History Admin
View a user's recent points transactions (admin).

**Parameters:**
- `user_id` (path, string, required)
- `limit` (query, integer, optional) — default `100`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/venues` — List Venues Admin
List all venues with any overrides merged in.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/venues/{venue_id}` — Get Venue Admin
Get a single venue with overrides merged.

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/announcements` — Create Announcement

**Request body:**
- Body (required): `application/json` → `AnnouncementCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/auctions` — Create Auction
Create a new auction

**Request body:**
- Body (required): `application/json` → `AuctionCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/boosts` — Create Boost
Create a new boost

**Request body:**
- Body (required): `application/json` → `BoostCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/cleanup-stale-seed` — Cleanup Stale Seed
Wipes seed-generated events / rewards / auctions from DB.

Safe to run on production. Only removes documents that came from the dev
seed (matched by the exact seed titles/IDs in seed_data.py) or everything
if ?all=true.

Auth: admin Bearer token OR X-Seed-Key header (LUNA_HUB_API_KEY).

**Responses:**
  - `200` →  — Successful Response

### `POST /api/admin/cluster-messages` — Create Cluster Message
Add a new cluster push notification message

**Request body:**
- Body (required): `application/json` → `ClusterMessageCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/geofences` — Create Geofence
Create a new geofence zone

**Request body:**
- Body (required): `application/json` → `routes__admin__GeofenceCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/milestones` — Create Milestone
Create/override a milestone. If it's the first write, seeds the collection with defaults first.

**Request body:**
- Body (required): `application/json` → `MilestoneCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/missions` — Create Mission
Create a new mission

**Request body:**
- Body (required): `application/json` → `MissionCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/push-messages` — Create Push Message
Add a new push notification message for a venue

**Request body:**
- Body (required): `application/json` → `VenueMessageCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/rewards` — Create Reward
Create a new reward

**Request body:**
- Body (required): `application/json` → `RewardCreate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/seed` — Seed Data
⚠️ DEPRECATED: use /seed-essentials for admin + /cleanup-stale-seed to wipe.

This endpoint re-creates test events / rewards / auctions. DO NOT call it
on production — it'll repopulate stale dev data. Kept for backward compat
but gated behind LUNA_HUB_API_KEY so it can't be triggered accidentally.

**Responses:**
  - `200` →  — Successful Response

### `POST /api/admin/seed-admin-user` — Seed Admin User
One-time seed of the Luna admin account on a fresh database.

Protected by a secret header so you can call it once from any browser/curl
immediately after switching to a new Mongo cluster. Idempotent: if the
user already exists it just returns 'already_exists'.

Usage:
    curl -X POST https://.../api/admin/seed-admin-user              -H "X-Seed-Key: {LUNA_HUB_API_KEY value}"

**Responses:**
  - `200` →  — Successful Response

### `POST /api/admin/users/{user_id}/gift-entry` — Gift Entry Ticket
Gift a free-entry QR ticket to a user, valid for 24h.

- If `scheduled_for` is omitted → valid from now to now + 24h.
- If `scheduled_for` is an ISO date (YYYY-MM-DD) → valid from that date 00:00 AEST
  to the next day 00:00 AEST (so a full 24-hour window midnight→midnight in Brisbane).

**Parameters:**
- `user_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `GiftEntryRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/users/{user_id}/grant-points` — Grant Points
Gift arbitrary points to a user (any role — bypasses the earn-guard).
Primarily used for allocating points to artists.

**Parameters:**
- `user_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `GrantPointsRequest`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/announcements/{announcement_id}` — Update Announcement

**Parameters:**
- `announcement_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `AnnouncementUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/auctions/{auction_id}` — Update Auction
Update an existing auction

**Parameters:**
- `auction_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `AuctionUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/boosts/{boost_id}` — Update Boost
Update an existing boost

**Parameters:**
- `boost_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `BoostUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/bottles/{bottle_id}/image` — Override Bottle Image
Override the image URL for a specific bottle. Lovable portal uploads a URL and passes it here.

**Parameters:**
- `bottle_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `BottleImageOverride`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/cluster-messages/{message_id}` — Update Cluster Message
Update a cluster push notification message

**Parameters:**
- `message_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `VenueMessageUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/config` — Update App Config
Partial-update the app config (status pill, announcement, maintenance).
Use `exclude_unset` so Lovable can explicitly clear a field by passing `null`.

**Request body:**
- Body (required): `application/json` → `AppConfigUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/geofences/{geofence_id}` — Update Geofence
Update a geofence

**Parameters:**
- `geofence_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `routes__admin__GeofenceUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/milestones/{milestone_id}` — Update Milestone
Update an existing milestone. Seeds collection on first edit.

**Parameters:**
- `milestone_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `MilestoneUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/missions/{mission_id}` — Update Mission
Update an existing mission

**Parameters:**
- `mission_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `MissionUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/push-messages/{message_id}` — Update Push Message
Update a push notification message

**Parameters:**
- `message_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `VenueMessageUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/rewards/{reward_id}` — Update Reward
Update an existing reward

**Parameters:**
- `reward_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `RewardUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/users/{user_id}` — Update User Admin
Update a user's profile fields and role.

**Parameters:**
- `user_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `AdminUserUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `PUT /api/admin/venues/{venue_id}` — Update Venue Override
Update venue overrides. Partial update — only fields you send are changed.

**Parameters:**
- `venue_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `VenueOverrideUpdate`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/announcements/{announcement_id}` — Delete Announcement

**Parameters:**
- `announcement_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/auctions/{auction_id}` — Delete Auction
Delete an auction

**Parameters:**
- `auction_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/boosts/{boost_id}` — Delete Boost
Delete a boost

**Parameters:**
- `boost_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/bottles/{bottle_id}/image` — Clear Bottle Image Override
Remove the override and revert to the default AI-generated image.

**Parameters:**
- `bottle_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/cluster-messages/{message_id}` — Delete Cluster Message
Delete a cluster push notification message

**Parameters:**
- `message_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/entry-tickets/{ticket_id}` — Revoke Entry Ticket
Revoke an unused entry ticket.

**Parameters:**
- `ticket_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/geofences/{geofence_id}` — Delete Geofence
Delete a geofence

**Parameters:**
- `geofence_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/milestones/{milestone_id}` — Delete Milestone
Delete a milestone from the custom overrides.

**Parameters:**
- `milestone_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/missions/{mission_id}` — Delete Mission
Delete a mission

**Parameters:**
- `mission_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/push-messages/{message_id}` — Delete Push Message
Delete a push notification message

**Parameters:**
- `message_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/rewards/{reward_id}` — Delete Reward
Delete a reward

**Parameters:**
- `reward_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `DELETE /api/admin/venues/{venue_id}` — Clear Venue Override
Remove all overrides for a venue, reverting it to baseline config.

**Parameters:**
- `venue_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## admin-safety
_Admin triage of silent SOS alerts._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/admin/safety/alerts` — List Safety Alerts
List safety alerts for the admin/lovable portal.

Query:
  - `status`: `active` (default) | `resolved` | `all`
  - `venue_id`: filter to one venue (admins only; venue roles are already scoped)
  - `hours`: lookback window (default 48h)
  - `limit`: max rows (default 100, capped at 500)

**Parameters:**
- `status` (query, string/null, optional)
- `venue_id` (query, string/null, optional)
- `hours` (query, integer, optional) — default `48`
- `limit` (query, integer, optional) — default `100`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/safety/alerts/{alert_id}` — Get Safety Alert

**Parameters:**
- `alert_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/safety/summary` — Safety Summary
Quick dashboard summary: counts by status + by venue + last 5 active alerts.

**Parameters:**
- `hours` (query, integer, optional) — default `24`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/safety/alerts/{alert_id}/acknowledge` — Acknowledge Safety Alert

**Parameters:**
- `alert_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `NotePayload`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/safety/alerts/{alert_id}/resolve` — Resolve Safety Alert

**Parameters:**
- `alert_id` (path, string, required)

**Request body:**
- Body (required): `application/json` → `NotePayload`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## admin-swiftpos
_SwiftPOS pipeline monitoring + retry (mirrors LunaSwiftPOSReporting Lovable component)._

**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only).

### `GET /api/admin/swiftpos/config` — Swiftpos Config
Surface (redacted) config + PLU catalog for the admin UI.

**Responses:**
  - `200` →  — Successful Response

### `GET /api/admin/swiftpos/summary` — Swiftpos Summary
Top-line KPIs for the SwiftPOS integration.

**Parameters:**
- `range` (query, string, optional) — default `7d` — 24h | 7d | 30d | all

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/swiftpos/transactions` — Swiftpos Transactions
Paginated ledger of points_transactions. Defaults to newest first.

**Parameters:**
- `status` (query, string/null, optional) — dispatched | pending | failed
- `event_type` (query, string/null, optional) — mission | reward | referral | birthday | nightly_crown | manual
- `user_id` (query, string/null, optional)
- `range` (query, string, optional) — default `7d`
- `limit` (query, integer, optional) — default `50`
- `skip` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `GET /api/admin/swiftpos/users` — Swiftpos Users
Paginated user list with link status + live balance (as mirrored).

**Parameters:**
- `link_status` (query, string/null, optional) — linked | unlinked | pending
- `q` (query, string/null, optional) — name/email fuzzy match
- `limit` (query, integer, optional) — default `50`
- `skip` (query, integer, optional) — default `0`

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/swiftpos/retry-pending` — Retry Pending
Bulk-retry the oldest pending SwiftPOS dispatches. Bounded per call.

**Parameters:**
- `limit` (query, integer, optional) — default `25` — Max retries in one call

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

### `POST /api/admin/swiftpos/retry/{tx_id}` — Retry One

**Parameters:**
- `tx_id` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Misc

**Auth:** Bearer JWT.

### `GET /` — Root

**Responses:**
  - `200` →  — Successful Response

### `GET /api/venue-portal` — Serve Venue Portal Root
Serve the venue portal SPA root

**Responses:**
  - `200` →  — Successful Response

### `GET /api/venue-portal/{path}` — Serve Venue Portal
Serve venue portal static files with SPA fallback

**Parameters:**
- `path` (path, string, required)

**Responses:**
  - `200` →  — Successful Response
  - `422` → `HTTPValidationError` — Validation Error

---

## Data models (schemas)

_109 Pydantic models, auto-generated by FastAPI. Only the most-used are expanded — use `/openapi.json` for the full surface._

### `RegisterRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `string` | ✓ |  |
| `password` | `string` | ✓ |  |
| `name` | `string` | ✓ |  |
| `phone` | `string / null` |  |  |
| `date_of_birth` | `string / null` |  |  |
| `gender` | `string / null` |  |  |
| `address` | `string / null` |  |  |
| `city` | `string / null` |  |  |
| `preferred_venues` | `array / null` |  |  |
| `referral_code` | `string / null` |  |  |

### `LoginRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `string` | ✓ |  |
| `password` | `string` | ✓ |  |

### `BookingRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `venue_id` | `string` | ✓ |  |
| `date` | `string` | ✓ |  |
| `time` | `string` | ✓ |  |
| `party_size` | `integer` | ✓ |  |
| `special_requests` | `string / null` |  |  |
| `occasion` | `string / null` |  |  |

### `AuctionCreate`

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `venue_id` | `string` | ✓ |  |
| `venue_name` | `string` | ✓ |  |
| `auction_type` | `string` |  | default `booth` |
| `starting_bid` | `number` | ✓ |  |
| `min_increment` | `number` |  | default `10` |
| `max_bid_limit` | `number` |  | default `5000` |
| `deposit_required` | `number` |  | default `0` |
| `deposit_rules` | `string` |  | default `` |
| `image_url` | `string` | ✓ |  |
| `features` | `string[]` |  | default `[]` |
| `start_time` | `string` | ✓ |  |
| `end_time` | `string` | ✓ |  |

### `AuctionUpdate`

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string / null` |  |  |
| `description` | `string / null` |  |  |
| `venue_id` | `string / null` |  |  |
| `venue_name` | `string / null` |  |  |
| `auction_type` | `string / null` |  |  |
| `starting_bid` | `number / null` |  |  |
| `min_increment` | `number / null` |  |  |
| `max_bid_limit` | `number / null` |  |  |
| `deposit_required` | `number / null` |  |  |
| `deposit_rules` | `string / null` |  |  |
| `image_url` | `string / null` |  |  |
| `features` | `array / null` |  |  |
| `start_time` | `string / null` |  |  |
| `end_time` | `string / null` |  |  |
| `status` | `string / null` |  |  |

### `CherryHubLoginRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `string` | ✓ |  |

### `CherryHubLinkRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `string / null` |  |  |
| `phone` | `string / null` |  |  |
| `create_if_not_exists` | `boolean` |  | default `True` |

### `CherryHubRegisterRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `string` | ✓ |  |
| `first_name` | `string` | ✓ |  |
| `last_name` | `string` | ✓ |  |
| `phone` | `string / null` |  |  |
| `date_of_birth` | `string / null` |  |  |

### `WalletPassRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `pass_type` | `string` |  | default `apple` |

### `RecordSpendingRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | `string` | ✓ |  |
| `venue_id` | `string` | ✓ |  |
| `amount` | `number` | ✓ |  |
| `category` | `string` |  | default `general` |

### `AdminUserUpdate`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string / null` |  |  |
| `email` | `string / null` |  |  |
| `role` | `string / null` |  |  |
| `tier` | `string / null` |  |  |
| `assigned_venue_id` | `string / null` |  |  |
| `phone` | `string / null` |  |  |
| `notes` | `string / null` |  |  |
| `is_active` | `boolean / null` |  |  |


_(Other schemas — see `<base>/openapi.json` for the full list.)_

---

## 🔚 End of master API reference

_Regenerate this doc any time by running `/app/tools/generate_api_master.py`. Source of truth is always the live FastAPI `openapi.json`._