# Luna Group VIP App ↔ SwiftPOS Integration — Technical Brief

**Date:** April 2026
**From:** Luna Group Hospitality (Trent Murphy)
**To:** SwiftPOS Integrations Team
**Subject:** Detailed brief of all required data exchanges across the SwiftPOS API for the Luna Group VIP loyalty app

---

## 1. Project Context

Luna Group operates **9 venues** (8 Brisbane, 1 Gold Coast). We have built a member-facing iOS/Android app and a Lovable web admin portal that work together as a single VIP loyalty + lifestyle platform. The architecture treats **SwiftPOS as the absolute source of truth for loyalty points** — every points event ultimately lands as a SwiftPOS transaction; the app's `points_balance` is a real-time mirror of what SwiftPOS reports.

| Venue ID | Venue | Location |
|---|---|---|
| `eclipse` | Eclipse | Brisbane |
| `after_dark` | After Dark | Brisbane |
| `pump` | Pump | Brisbane |
| `mamacita` | Mamacita | Brisbane |
| `juju` | Juju | Brisbane |
| `night_market` | Night Market | Brisbane |
| `ember_and_ash` | Ember & Ash | Brisbane |
| `su_casa_brisbane` | Su Casa BNE | Brisbane |
| `su_casa_gold_coast` | Su Casa GC | Gold Coast |

**Loyalty rules (configured in SwiftPOS):**
- $1 spent = **10 points** (base rate, before tier multipliers)
- Tier multipliers: Bronze 1.0× · Silver 1.25× · Gold 1.5× · Legend 2.0×
- Subscription bonus: Aurora 1.1× · Lunar 1.25× · Legend (paid) 1.5×
- Final multiplier = base × tier × subscription × any active boost
- Redemption value: 10 points = $0.25 (≈ 25% loyalty back-rate before multipliers)
- Points expiry: 24 months rolling

**Anticipated transaction volume at MVP launch:**
- ~15,000 active members
- ~3,000–5,000 transactions/day across all venues at peak (Friday/Saturday nights)
- Burst rate at venue open / closing hour: ~150 transactions/minute per venue

---

## 2. Authentication (we believe we have this — please confirm)

### Endpoint we plan to call
```
POST https://api.swiftpos.com.au/api/v3/authorisation
Content-Type: application/json

{
  "integratorName": "Swift-Luna Group",
  "integratorKey":  "<provided by SwiftPOS>",
  "customerRef":    "<our customer reference number>",
  "clientId":       "<our location/client id>",
  "clerkId":        "<integration clerk id>",
  "clerkPassword":  "<integration clerk password>"
}

→ 200 { "authorizationToken": "<jwt-or-opaque-bearer>", "expiresAt": "ISO-8601" }
```

### Questions for SwiftPOS
1. **Confirm the exact path** — we are using `/api/v3/authorisation`. Some 2025 docs reference `/api/v3/authorise` or `/api/v3/auth`. Which is current for v10.58+?
2. **Token TTL** — what is the issued-token lifetime, and is it the same across tenants?
3. **Refresh strategy** — is there a refresh endpoint or do we always re-authorise?
4. **Per-venue vs. tenant-wide token** — do we need one set of credentials per venue, or one tenant-level credential that covers all 9 venues with a `locationId` per call? **Strong preference for the latter.**
5. **Concurrency** — how many simultaneous authorised tokens may we hold?

### Credentials we are still missing (please supply)
- `integratorKey` (Integrator name we have: `Swift-Luna Group`)
- `customerRef` (Luna Group's SwiftPOS customer reference)
- For each of the 9 venues: `clientId` (location ID) — OR confirm one umbrella ID that scopes across all locations
- `clerkId` + `clerkPassword` for an "integration clerk" account (read+write on customers, transactions, sales lookups)

---

## 3. Member ↔ SwiftPOS Customer Linking

Every Luna app user is mapped 1:1 to a SwiftPOS customer record. The link is stored on our side as `users.swiftpos_customer_id`.

### 3.1 Lookup an existing customer by phone or email
We need this so a guest who already exists in SwiftPOS (e.g. created at the door from a paper sign-up) can be claimed by the app on first login.

```
GET /api/v3/customers?phone={mobile}
GET /api/v3/customers?email={email}
→ 200 [{ "customerId": "...", "firstName": "...", "lastName": "...",
         "email": "...", "phone": "...", "memberStatus": "active",
         "pointsBalance": 1234, "tier": "Bronze",
         "createdAt": "...", "lastTransactionAt": "..." }]
```

**Question:** does the SwiftPOS Customers API support these query parameters? If not, what is the supported lookup pattern?

### 3.2 Create a new customer when a user signs up
```
POST /api/v3/customers
{
  "firstName":  "Trent",
  "lastName":   "Murphy",
  "email":      "trent@…",
  "phone":      "+61400000000",
  "dateOfBirth":"1990-05-12",
  "marketingOptIn": true,
  "externalReference": "<our user_id (UUID)>",
  "homeLocationId":   "eclipse"   // primary venue
}

→ 201 { "customerId": "...", ... }
```

**Questions:**
- Confirm payload field names + casing.
- Does SwiftPOS support an `externalReference` field that we can use to round-trip our `user_id`?
- What's the correct validation contract for `dateOfBirth` (used for birthday-club perks)?
- Is `marketingOptIn` honoured globally or per-venue?

### 3.3 Update a customer
```
PATCH /api/v3/customers/{customerId}
{ "email": "new@…", "phone": "+61400000001", "homeLocationId": "after_dark" }
```

### 3.4 Bulk import (one-time backfill)
We have ~5,000 existing app users created in our DB before SwiftPOS came online. We need a way to push them all in **one batch** so SwiftPOS owns the master list. Either:
- a bulk-create endpoint, OR
- a CSV-import process via your portal we can trigger via API.

**Questions:**
- What's the recommended path for a one-off 5K-record import?
- What rate limits apply during the backfill?

---

## 4. Real-Time Sale Awards (POS → App)

This is the **primary earn path**. When a guest pays at the bar / door / booth / cashier through SwiftPOS, the sale should automatically credit points and propagate to the app within a few seconds.

### 4.1 Preferred mechanism: WEBHOOKS
Luna provides a public HTTPS endpoint:

```
POST https://api.lunagroupapp.com.au/api/swiftpos/webhook/transaction
X-Swiftpos-Signature: <HMAC-SHA256 of body using shared secret>
Content-Type: application/json

{
  "eventId":      "<unique UUID per webhook delivery>",
  "eventType":    "transaction.completed",
  "transactionId":"<SwiftPOS txn ID>",
  "customerId":   "<SwiftPOS customer ID>",
  "locationId":   "eclipse",
  "transactionDateTime": "ISO-8601",
  "totalAmount":  85.50,
  "lineItems": [
     { "plu": "...", "description": "Bottle Service", "quantity": 1, "unitPrice": 85.50, "category": "drinks" }
  ],
  "pointsAwarded": 855,
  "pointsBalanceAfter": 12340,
  "tierAfter": "Silver",
  "originalReceiptNumber": "ECL-2026-00123"
}
```

**Questions for SwiftPOS:**
1. **Does SwiftPOS support outbound webhooks for transaction events?** If yes, what URL/secret registration process do we follow?
2. If no native webhook: confirm whether we should use **Server-Sent Events** or **long-polling** as a fallback.
3. What's the expected latency from POS settle → webhook delivery? (We need <5 s end-to-end for a good UX.)
4. **Retry policy** — on a 5xx from us, will SwiftPOS retry? With what backoff?
5. **Idempotency** — guarantee that the same `transactionId` won't be delivered twice with different payloads?
6. **Signing** — is HMAC-SHA256 the supported signing algorithm? What header name + secret-rotation policy?
7. **Event types** we ideally want:
   - `transaction.completed` (sale rung up)
   - `transaction.voided` (refund/reversal — must roll back points)
   - `customer.updated` (tier change, contact-detail change)
   - `customer.deleted` (so we can soft-delete in app)

### 4.2 Fallback mechanism: POLLING
If webhooks are not available, we will poll. We need an endpoint that returns **all transactions modified since timestamp T**, sorted by transactionDateTime ascending, with a stable cursor:

```
GET /api/v3/transactions?since=2026-04-26T08:00:00Z&limit=500&cursor=<opaque>
→ 200 {
   "transactions": [ ... same shape as webhook payload ... ],
   "nextCursor":   "<opaque>",
   "hasMore":      true
}
```

**Questions:**
1. Does SwiftPOS expose a "modified-since" listing for transactions?
2. What's the maximum window we can request in one call?
3. What rate limit applies? (We'd poll every 30–60 s if no webhook is available.)

---

## 5. App-Side Awards (Backend → SwiftPOS)

These are points awarded for **in-app activity** that has no real money attached:

| Reason | Examples |
|---|---|
| Mission completion | "Visit 3 venues this weekend" → +600 pts |
| Reward redemption | Member spends 200 pts on a drink voucher → −200 |
| Referral bonus | Referrer +1,000 pts when their referee signs up |
| Birthday gift | +500 pts in birthday week |
| Manual hospitality (manager Gift Points) | +1,000 pts comp |
| Nightly Crown leaderboard | top 3 of the night get bonus pts |
| Cash-only / off-system / SwiftPOS-outage manual award | $80 spend → 800 pts |

We push these to SwiftPOS as a "transaction" with **negative-price line items** so SwiftPOS still owns the ledger:

```
POST /api/v3/orders                                 (or /transactions)
{
  "customerId":        "<sp customer id>",
  "locationId":        "eclipse",
  "externalReference": "<luna_user_id>-mission-<mission_id>-<our_uuid>",
  "notes":             "Mission complete: Weekend Warrior",
  "transactionDateTime": "ISO-8601",
  "transactionItems": [
    {
      "plu":         "MISSION_AWARD",     // or a venue-specific PLU we'll map
      "quantity":    1,
      "unitPrice":   -60.00,              // dollars-equivalent (negative)
      "description": "Luna Mission: Weekend Warrior"
    }
  ]
}

→ 201 { "TransactionId": "...", "pointsAwarded": 600, "pointsBalanceAfter": 13800 }
```

### Questions
1. **PLU strategy** — what's the recommended way to set up "loyalty award PLUs" in SwiftPOS so they award points without affecting financial reporting? Should we create one PLU per category (`MISSION`, `REWARD`, `REFERRAL`, `MANUAL_VENUE`, `BIRTHDAY`, `NIGHTLY_CROWN`) per venue, or one global set?
2. **Negative unit price** — confirm SwiftPOS accepts negative `unitPrice` for points-only adjustments, and that those lines do NOT appear in financial day-end reports.
3. **`externalReference` idempotency** — if we resend the same `externalReference`, will SwiftPOS reject it as a duplicate (preferred), or create a second transaction?
4. **Reversal endpoint** — when a member's claim is reversed (e.g. abuse or admin error), how do we negate a previously submitted award? Is it a separate `/transactions/{id}/void` or do we post a positive-price compensating line?

---

## 6. Balance Reads

The app shows the member's current points balance on every Wallet load. Since SwiftPOS is the source of truth, we need a fast read:

```
GET /api/v3/customers/{customerId}/points
→ 200 { "pointsBalance": 12340, "tier": "Silver", "lifetimePoints": 38900,
        "nextTier": "Gold", "pointsToNextTier": 11900, "expiringSoon": 250 }
```

### Questions
1. Confirm endpoint path + response shape.
2. **Latency target** — we need ≤300 ms p99 because this is on the critical render path of the Wallet screen. Acceptable?
3. **Caching** — is the balance computed on-demand or precomputed? If we hit the endpoint 5 times in 1 s for the same customer, are we throttled?
4. **Rate limit** — what's the per-tenant calls-per-second limit?

---

## 7. Transaction History (per-member, paginated)

The member's Wallet shows their full points history. Each row needs venue, date, amount, points, type:

```
GET /api/v3/customers/{customerId}/transactions?limit=50&cursor=<opaque>
→ 200 {
   "transactions": [
     { "transactionId": "...", "datetime": "...", "locationId": "eclipse",
       "totalAmount": 85.50, "pointsDelta": +855, "type": "earn",
       "description": "Bottle Service" },
     { "transactionId": "...", "datetime": "...", "locationId": null,
       "totalAmount": -20.00, "pointsDelta": -200, "type": "redeem",
       "description": "Free Drink Voucher" }
   ],
   "nextCursor": "...",
   "hasMore": true
}
```

### Questions
1. Confirm endpoint + cursor semantics.
2. Are reversed/voided transactions returned with `pointsDelta: 0` or as separate rows?
3. Do we get the venue's display name in the response or just the `locationId`?

---

## 8. Reporting & Aggregates (admin / Lovable)

Our manager-facing **Lovable admin portal** needs daily/weekly aggregates per venue. These power our `/api/admin/swiftpos/summary` page:

```
GET /api/v3/reports/loyalty-summary?locationId=eclipse&from=2026-04-19&to=2026-04-26
→ 200 {
   "locationId": "eclipse",
   "uniqueMembers": 412,
   "transactionCount": 1187,
   "grossSpendCents": 8345600,
   "pointsAwarded": 8345600,
   "pointsRedeemed": 412300,
   "newMembers": 38,
   "topSpenders": [ { "customerId": "...", "spendCents": 250000, "points": 25000 } ]
}
```

### Questions
1. Does SwiftPOS expose a reporting/analytics endpoint, or do we aggregate from the transaction stream ourselves?
2. **Grouping** — can we get daily/hourly buckets in the response so we don't have to pull every txn?
3. **All-venues view** — can we omit `locationId` to get the tenant-wide rollup?

---

## 9. Reversals & Refunds

Equally important as awards — when a transaction is voided in SwiftPOS, we need to mirror that in our database (rollback points, mark mission progress dirty, etc.).

We expect either:
- A `transaction.voided` webhook (preferred — see §4.1), or
- Reversed transactions visible via the polling endpoint with a `voidedAt` timestamp.

### Questions
1. Which path does SwiftPOS support?
2. Does a void return the **original transactionId** so we can locate it on our side, or a new compensating transactionId?
3. If the original sale awarded points and the member has since redeemed some of those points, does SwiftPOS allow the balance to go negative, or is the void rejected?

---

## 10. Tier Management

SwiftPOS calculates tiers based on lifetime points. We mirror the tier on `users.tier` for fast app reads.

We need to know:
1. **Tier bands** — confirm the configurable thresholds (`Bronze 0` / `Silver 5,000` / `Gold 25,000` / `Legend 100,000`).
2. **Tier-up event** — does SwiftPOS emit a webhook when a member crosses a threshold? (We currently sniff this from the `tierAfter` field on each transaction.)
3. **Tier downgrades** — what's the policy if points expire and the member falls below a threshold?

---

## 11. Promotions / Boosts

Occasionally Luna runs "2× points 9–11 PM" or "all venues triple points NYE". Currently we want to apply these as **multipliers on the SwiftPOS side** so all earn paths benefit consistently.

### Questions
1. Does SwiftPOS support time-windowed multipliers configurable per location?
2. Can we drive these via API (`POST /api/v3/promotions`) or are they admin-portal only?
3. What's the precedence between tier multiplier × promo multiplier × subscription multiplier?

---

## 12. Sandbox / Test Environment

Before flipping production traffic we need to integrate-test against a sandbox.

### Questions
1. Is there a SwiftPOS staging endpoint (e.g. `https://sandbox.api.swiftpos.com.au`) or do we test against a tenant in your dev cluster?
2. Sandbox credentials — same shape as production?
3. **Replay support** — can we wipe and re-seed a sandbox tenant to reset state during integration testing?

---

## 13. Multi-Venue Routing (the 9 venues)

Our app shows transactions per-venue, geofences alerts per-venue, and routes app awards (mission with `venue_id: eclipse`) to the right location.

### Questions
1. Confirm the canonical SwiftPOS `locationId` for each of our 9 venues — supplied by you.
2. When a member transacts at venue A but is "homed" at venue B, where does the points-earned figure roll up in your reporting?
3. Cross-venue redemption — is there any constraint stopping a member from redeeming a voucher earned at Eclipse at, say, Mamacita?

---

## 14. Rate Limits & SLAs (please confirm)

| Concern | Our expectation | Please confirm |
|---|---|---|
| Auth requests | 1/min average, 10/min burst | OK? |
| Customer lookup | 50 rps tenant-wide | OK? |
| Balance reads | 200 rps tenant-wide | OK? |
| Order/transaction posts | 100 rps tenant-wide | OK? |
| Webhook delivery latency p95 | <5 s | OK? |
| API uptime SLA | 99.9% | OK? |
| Maintenance windows | Pre-announced ≥48 h | OK? |

---

## 15. Security & Compliance

1. **TLS 1.2+ only** — confirmed.
2. **PII fields** — when we write a customer, what is the minimum PII set you require, and what is your data-retention / GDPR-equivalent policy?
3. **Audit log** — does SwiftPOS provide an admin audit endpoint we can query for reconciliation? (Who changed customer X, when, what fields.)
4. **Field-level encryption at rest** — confirm for PII (email, phone, DOB).

---

## 16. Open Questions Summary (single list for SwiftPOS to action)

For your convenience, here is every numbered question consolidated into one to-do list:

### Authentication (§2)
1. Confirm the live path: `/api/v3/authorisation` vs alternatives.
2. Token TTL.
3. Refresh strategy.
4. Per-venue vs tenant-wide token.
5. Concurrency limit on tokens.
6. Provide: integratorKey, customerRef, 9 × clientId (or umbrella), clerkId, clerkPassword.

### Customer API (§3)
7. Lookup-by-phone / lookup-by-email — supported?
8. POST /customers field names + DOB validation contract.
9. `externalReference` round-trip for our `user_id`.
10. Bulk import path for 5K backfill + rate limit during backfill.

### Real-time sale events (§4)
11. Native outbound webhooks supported?
12. Retry + backoff policy.
13. Idempotency guarantee on `transactionId`.
14. HMAC signing algorithm & header.
15. Latency p95.
16. List of supported event types (we want: transaction.completed, transaction.voided, customer.updated, customer.deleted).
17. If no webhook: polling endpoint shape + max window + rate limit.

### App-side awards (§5)
18. Recommended PLU layout for award categories.
19. Negative `unitPrice` accepted? Excluded from financial reports?
20. `externalReference` idempotency on retry.
21. Reversal/void endpoint path.

### Balance reads (§6)
22. Endpoint path + response shape.
23. Latency target ≤300 ms p99 — feasible?
24. Per-tenant rps limit.

### History (§7)
25. Pagination cursor semantics.
26. Voided txns — separate rows or in-place updates?
27. Venue display name in response or only ID?

### Reporting (§8)
28. Loyalty summary endpoint or DIY aggregate?
29. Time-bucket grouping support.
30. Tenant-wide rollup.

### Reversals (§9)
31. Webhook event for void / available via polling?
32. Same transactionId or compensating txn?
33. Negative-balance behaviour after void post-redemption.

### Tiers (§10)
34. Configurable thresholds — confirm our values.
35. Tier-up webhook event.
36. Downgrade policy on expiry.

### Promotions (§11)
37. Time-windowed multipliers per-location supported?
38. API-driveable or admin-portal only?
39. Multiplier precedence rules.

### Sandbox (§12)
40. Sandbox URL.
41. Sandbox credential shape.
42. Tenant-reset support.

### Multi-venue (§13)
43. 9 × locationId supplied.
44. Roll-up rules when member transacts away from home venue.
45. Cross-venue redemption constraints (if any).

### Limits & SLAs (§14)
46. Confirm/adjust the rate-limit table.
47. Confirm webhook latency p95.
48. Confirm API uptime SLA.
49. Maintenance-window notice.

### Security (§15)
50. Min PII set.
51. Retention / data-deletion policy.
52. Audit log endpoint.

---

## 17. What we will provide back to SwiftPOS

Once we have the answers above, we will send:
- A **complete request log** of every endpoint we will call, with worked examples.
- An **events catalogue** of every reason we award/redeem points app-side, with anticipated daily volume.
- The **list of 5,000 backfill customers** in SwiftPOS-import format.
- A **scheduled UAT plan** — 1 week sandbox, 1 week side-by-side production shadowing, then cutover.
- A **24/7 escalation contact** at Luna for production incidents.

---

## 18. Project Stakeholders

| Role | Name | Contact |
|---|---|---|
| Product owner | Trent Murphy | trent@lunagroupapp.com.au |
| Tech lead | (Luna engineering) | dev@lunagroupapp.com.au |
| Operations | (Luna ops manager) | ops@lunagroupapp.com.au |

We're aiming to flip from mock-mode to production within **2 weeks of receiving live SwiftPOS credentials**, so an early reply on the items in §16 will keep us on schedule for App Store submission.

Many thanks — looking forward to your detailed responses.

— Luna Group VIP team
