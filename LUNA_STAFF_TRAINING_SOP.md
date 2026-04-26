# LUNA GROUP VIP — STAFF TRAINING SOP

**Document Version:** 1.0
**Last Updated:** February 2026
**Audience:** Door staff, bar staff, floor staff, supervisors, venue managers, marketing, support
**Estimated Training Time:** 2 hours classroom + 1 shift shadowing

---

## TABLE OF CONTENTS

1. [Welcome & Overview](#1-welcome--overview)
2. [Roles & Access Matrix](#2-roles--access-matrix)
3. [Member App — Screen-by-Screen Walkthrough](#3-member-app--screen-by-screen-walkthrough)
4. [Staff Portal — Operating Manual](#4-staff-portal--operating-manual)
5. [Venue Manager Dashboard](#5-venue-manager-dashboard)
6. [QR Code Reference Sheet](#6-qr-code-reference-sheet)
7. [Loyalty Points Rules](#7-loyalty-points-rules)
8. [Tier System & Subscriptions](#8-tier-system--subscriptions)
9. [Safety / SOS Workflow](#9-safety--sos-workflow)
10. [Common Member Questions (Cheat Sheet)](#10-common-member-questions-cheat-sheet)
11. [Troubleshooting Playbook](#11-troubleshooting-playbook)
12. [Escalation & Support](#12-escalation--support)
13. [Daily / Shift Checklists](#13-daily--shift-checklists)
14. [Training Sign-Off](#14-training-sign-off)

---

## 1. WELCOME & OVERVIEW

### 1.1 What is the Luna Group VIP App?
The Luna Group VIP App is a loyalty + lifestyle app for guests of the **9 Luna Group venues**. Members earn points for everything they spend, redeem rewards, book bottle service / events, get free entry, plan nights with friends ("Crews"), and receive personalised perks.

### 1.2 The 9 Venues
| ID | Brand | City |
|---|---|---|
| `eclipse` | **Eclipse** | Brisbane |
| `after_dark` | **After Dark** | Brisbane |
| `pump` | **Pump** | Brisbane |
| `mamacita` | **Mamacita** | Brisbane |
| `juju` | **Juju** | Brisbane |
| `night_market` | **Night Market** | Brisbane |
| `ember_and_ash` | **Ember & Ash** | Brisbane |
| `su_casa_brisbane` | **Su Casa BNE** | Brisbane |
| `su_casa_gold_coast` | **Su Casa GC** | Gold Coast |

### 1.3 The Three Pillars
1. **Earn** — every dollar a guest spends becomes points (synced to SwiftPOS).
2. **Enjoy** — drinks, entries, bottle service, VIP tables, events, auctions.
3. **Engage** — Luna AI concierge, leaderboards, missions, milestones, crews.

### 1.4 Core Principle for Staff
> **SwiftPOS is the source of truth for points.** Anything you award through the app flows back into SwiftPOS as a transaction. Never tell a guest their points "didn't go through" — always check the Staff Portal first.

---

## 2. ROLES & ACCESS MATRIX

The system has **four user roles**. Your access is set by the admin team.

| Capability | Member | Venue Staff | Venue Manager | Admin |
|---|:---:|:---:|:---:|:---:|
| Sign in to consumer app | ✅ | ✅ | ✅ | ✅ |
| Earn / spend points | ✅ | ✅ | ✅ | ✅ |
| Access **Staff Portal** | ❌ | ✅ | ✅ | ✅ |
| Award points (Quick Award) | ❌ | ✅ | ✅ | ✅ |
| Validate reward / entry QRs | ❌ | ✅ | ✅ | ✅ |
| Gift points (bypass earn-guard) | ❌ | ❌ | ✅ | ✅ |
| Access **Venue Dashboard** | ❌ | ❌ | ✅ | ✅ |
| Manage menus / events / auctions | ❌ | ❌ | ✅ | ✅ |
| Run reports (SwiftPOS / payments) | ❌ | ❌ | ⚠️ Limited | ✅ |
| Manage users / roles | ❌ | ❌ | ❌ | ✅ |

**How members are granted staff access:** Admin updates the user document in the database with `role: venue_staff` (or `venue_manager`), `venue_id: <one of the 9 IDs>`, and `is_venue_staff: true`. The change is live next time the user logs in.

---

## 3. MEMBER APP — SCREEN-BY-SCREEN WALKTHROUGH

The member app has **5 main tabs** (bottom nav) plus a deep stack of detail screens.

### 3.1 Bottom Tabs

#### TAB 1 — TONIGHT (Home)
*The "what's on right now" feed.*
- Live events at all 9 venues
- Personalised picks from Luna AI
- Tonight's auctions
- Quick links: Bottle Service, Member Card, Refer Friend
- Pull-to-refresh

**What staff should know:** if a guest says "the event isn't showing", make sure their app is on the latest version and they have location turned on for personalised ranking.

#### TAB 2 — VENUES (Explore)
- Map + list view of all 9 venues
- Filter by city / category / open-now
- Tap a venue → **Venue Detail Screen** (`/venue/[id]`)
  - Live capacity / vibe (if pushed by manager)
  - Current promos
  - Menu (food + drinks)
  - Upcoming events
  - "Get directions" / "Call venue" / "Book a table"

#### TAB 3 — WALLET
The financial heart of the app.
- **Points balance** (synced from SwiftPOS)
- **Points history** (every earn / spend / gift)
- **Member Card** button → opens digital QR card (Apple Wallet + Google Wallet ready)
- Active rewards / vouchers
- Subscription status (Aurora / Lunar / Legend)
- Transaction list with venue + category breakdown

#### TAB 4 — LUNA AI
Personalised AI concierge.
- Plan a night ("I'm with 4 friends, budget $400, like house music")
- Bottle recommendations
- Event discovery
- General Luna Group questions
- Multi-turn chat (session persisted)

**Staff note:** Luna AI is powered by an LLM. It will never give incorrect venue info if the venue data is up-to-date in the manager dashboard.

#### TAB 5 — PROFILE
- Name, photo, tier badge, lifetime points
- Edit profile, DOB, music preferences
- Quick links: Missions, Milestones, Birthday Club, Subscriptions, Refer Friend, Notifications, Settings, Safety, Help

### 3.2 Detail Screens (Stack Routes)

| Screen | Purpose |
|---|---|
| `/login` | Sign in / Join Luna |
| `/onboarding` | First-time tour after registration |
| `/verify-email` | Email OTP verification |
| `/edit-profile` | Update name, DOB, photo, bio, instagram, music prefs, gender |
| `/settings` | Master menu for all sub-settings |
| `/notification-settings` | Toggle push / email categories |
| `/location-settings` | Location permissions, geofence opt-in |
| `/safety-settings` | Emergency contacts, SOS preferences |
| `/payment-methods` | Saved cards (Stripe) |
| `/help-support` | FAQs + contact form |
| `/about` / `/privacy-policy` / `/terms-of-service` | Static legal pages |
| `/member-card` | Full-screen QR card for door + bar |
| `/rewards-shop` | Redeem points for vouchers, drinks, entries |
| `/claim-reward` | Confirmation screen post-redemption |
| `/bottle-service` | Browse + order bottle packages |
| `/venue/[id]` | Venue detail page |
| `/venue-menu` | Standalone menu viewer |
| `/events` + `/event/[id]` | Event list + RSVP / ticket purchase |
| `/auctions` | Bid on premium experiences (booths, bottles) |
| `/missions` | Daily / weekly tasks → bonus points |
| `/milestones` | Lifetime achievement tickets (e.g., "10 nights at Eclipse") |
| `/leaderboard` | "Nightly Crown" — top spenders / most-active |
| `/birthday-club` | Birthday week rewards |
| `/refer-friend` | Referral code + share sheet |
| `/lost-found` | Report or claim items |
| `/safety` | One-tap SOS button |
| `/ai-concierge` | Full-screen AI chat |
| `/cherryhub` | Digital wallet linking (CherryHub) |
| `/how-points-work` | In-app explainer |
| `/subscriptions` | Buy / manage paid subscription tiers |
| `/my-entry-tickets` | Free-entry passes earned via subscription |
| `/notifications` | In-app notification centre |
| `/payment-success` / `/payment-cancelled` | Stripe checkout returns |
| `/staff-portal` | **STAFF ONLY** — see Section 4 |
| `/venue-dashboard` | **MANAGER ONLY** — see Section 5 |

### 3.3 Navigation Cheat-Sheet for Staff
- **Member's QR is on the door / bar → tap "Wallet" → "Member Card"** (full-screen QR).
- **Member wants to redeem a reward → "Wallet" → tap reward → tap "Show QR".**
- **Member can't find a screen → "Profile" → "Help & Support".**

---

## 4. STAFF PORTAL — OPERATING MANUAL

> **Route:** `/staff-portal` — accessible only to roles `venue_staff`, `venue_manager`, `admin`.

The Staff Portal has **3 tabs**: **Award**, **Validate**, **History**.

### 4.1 Selecting Your Venue
Top of the screen: a horizontal venue selector. **Always confirm the correct venue is highlighted before any action.** Awarding points to the wrong venue forces a manager reversal in SwiftPOS.

### 4.2 Tab 1 — AWARD (Quick Award Points)
Used after any in-venue purchase that wasn't run through SwiftPOS directly (e.g., split bills, manual add-ons, comp upgrades).

**Step-by-step:**
1. Confirm venue selector is on the correct venue.
2. **Find the member** — three methods:
   - Type name / email / phone in the search bar (min 2 chars).
   - Tap **Scan QR** and scan the member's Member Card (`LUNA-MEMBER:<id>` or bare user_id).
   - Pick from search results if multiple.
3. Member profile loads (tier, balance, today's activity).
4. Enter **dollar amount spent** (max $50,000 per transaction).
5. Tap a **category**: Drinks · Food · Entry · Booth · Bottles · Other.
6. (Optional) Enter a **receipt reference** for reconciliation.
7. Tap **Award Points**.
8. Confirmation card shows: points awarded, new balance, tier change (if any).

**Rule of thumb (default):**
- Bronze: 1 point per $1
- Silver: 1.25 points per $1
- Gold: 1.5 points per $1
- Legend: 2 points per $1
*(Actual multiplier is calculated server-side from the user's tier + active subscription + active boosts.)*

### 4.3 Gift Points (Manager-only override)
For comps / artist hospitality / VIP gestures that bypass the earn-guard.
- Inside a member profile → **"Gift Points"** button.
- Enter amount + reason (audited).
- Use sparingly — every gift is logged with your staff ID.

### 4.4 Tab 2 — VALIDATE (Redeem & Door Scan)
Used at the door, the bar, the booth host, or the cashier when a member wants to redeem something.

**Step-by-step:**
1. Confirm venue selector.
2. Tap **Scan QR**, or paste the QR string into the input box.
3. The portal automatically routes the QR based on its prefix (see Section 6).
4. Result card shows:
   - ✅ **Success** (green) — proceed; the reward is now consumed.
   - ❌ **Failure** (red) — read the message (expired / wrong venue / already used).

**Critical:** **never** strip the `LUNA-…` prefix. The backend matches on the full string.

### 4.5 Tab 3 — HISTORY
- Filter: today / 7-day / 30-day, and per-venue.
- Shows every award + every validation you (or your team) executed.
- Use this to investigate disputes ("I didn't get my points").
- Tap a row → full transaction detail (receipt ref, amount, member).

### 4.6 Camera & Permissions
- First time you tap **Scan QR**, iOS / Android will prompt for camera access. Tap **Allow**.
- If permission was denied, go to phone Settings → Luna Group → Camera → Allow, then re-launch the app.

---

## 5. VENUE MANAGER DASHBOARD

> **Route:** `/venue-dashboard` — accessible only to roles `venue_manager` and `admin`.

### 5.1 Dashboard Tab
At-a-glance cards:
- **Total redemptions** (lifetime)
- **Today's redemptions**
- **This week's redemptions**
- **Pending redemptions**
- **Unique visitors**

### 5.2 Scan Tab
Same QR flow as Staff Portal, dedicated to managers running the door.

### 5.3 History Tab
Ledger of all redemptions for **your venue only** (managers are scoped to their venue_id).
- Search by reward name / customer.
- Status filter: pending / redeemed / expired.

### 5.4 Manager-only Operations (via Lovable Admin Portal)
The Lovable web admin (separate URL, given to managers) lets managers also:
- Edit venue menu (food / drinks / categories / pricing)
- Create / edit events + ticketing
- Create + run auctions
- Push live notifications to members in your venue's geofence
- View SwiftPOS reporting for your venue
- Override venue capacity / vibe display

> **Manager training on the Lovable portal is a separate 30-minute module** — see your area manager.

---

## 6. QR CODE REFERENCE SHEET

The portal recognises **5 QR prefixes**. Match the prefix to know what's about to happen.

| Prefix | Type | What It Means | Where to Scan |
|---|---|---|---|
| `LUNA-MEMBER:` | Member ID card | Identifies a guest for awarding points | **Award tab** |
| *(bare user_id)* | Member ID card (legacy) | Same as above | Award tab |
| `LUNA-ENT-` | Gifted Free Entry | Free door entry from subscription / promo | **Validate tab** (door) |
| `LUNA-TKT-` | Milestone Ticket | Earned by hitting a lifetime milestone | Validate tab (door) |
| `LUNA-DRINK-` | Drink reward | One free drink (varies by tier) | Validate tab (bar) |
| `LUNA-BDAY-` | Birthday reward | Birthday week perk | Validate tab |
| `LUNA-<uuid>-<userid>` | Generic reward | Anything from the Rewards Shop | Validate tab |

**Always-true rule:** if the QR doesn't start with `LUNA-` it's not a Luna QR. Reject it politely.

---

## 7. LOYALTY POINTS RULES

### 7.1 Earning
- 1 dollar = ~1 point (modified by tier + subscription + boost).
- Awarded via SwiftPOS (automatic) **or** Staff Portal Quick Award.
- App-only earns (missions, story shares, referrals) flow back to SwiftPOS as **negative-value transactions** so SwiftPOS stays the single ledger.

### 7.2 Spending
- Members redeem in the Rewards Shop, Bottle Service, Auctions, or events.
- A redemption produces a QR — you scan it via Staff Portal Validate tab.
- Once validated, the points are gone — **a refusal at this stage requires manager approval** because the points have already been deducted on the member side.

### 7.3 Expiry
- Standard points: rolling **24 months** from earn date.
- Birthday / promo points: shorter expiry (per campaign).
- Subscription bonus points: expire at end of subscription period if unused.

### 7.4 Disputes
1. Pull up the member in Staff Portal.
2. Open **History** tab — does the transaction appear?
3. If yes → confirm with member, end of dispute.
4. If no → ask manager to check **Lovable Payment Diagnostics** (`/api/admin/payments/health`) and **SwiftPOS Reporting** (`/api/admin/swiftpos/summary`) — could be a webhook delay (max 5 min in normal operation).

---

## 8. TIER SYSTEM & SUBSCRIPTIONS

### 8.1 Base Tiers (Earned via lifetime points)
| Tier | Lifetime Points | Earn Multiplier | Perks |
|---|---|---|---|
| **Bronze** | 0 | 1.0× | Standard rewards |
| **Silver** | 5,000 | 1.25× | Priority entry occasionally |
| **Gold** | 25,000 | 1.5× | Free drinks, line-skip select nights |
| **Legend** | 100,000 | 2.0× | All-access, dedicated host |

### 8.2 Paid Subscription Tiers (Stripe — monthly/annual)
| Subscription | Price | Key Perks |
|---|---|---|
| **Aurora** | Entry-tier | Bonus points multiplier, early access |
| **Lunar** | Mid-tier | Free entries (`LUNA-ENT-` QRs), monthly drink, priority bookings |
| **Legend** (paid) | Premium | All Lunar perks + complimentary table credits, concierge |

> **Subscription tier is independent of base tier.** A Bronze member can hold a Lunar subscription. Total earn multiplier = base tier × subscription bonus × any active boost.

### 8.3 Renewals & Cancellations
- Stripe handles both. Cancellations remain active until period-end.
- Webhook events keep the member's `subscription_tier` field in sync. If you see a member showing the wrong tier, check `/api/admin/payments/health`.

---

## 9. SAFETY / SOS WORKFLOW

### 9.1 What members can do
- Add up to 5 **emergency contacts** (name + phone + email) in `/safety-settings`.
- Trigger an SOS from `/safety` (one big red button) — this:
  1. Sends their location + venue to **Luna Hub** (the support / security team).
  2. Notifies all emergency contacts (currently in-app + email; **SMS via Twilio coming soon**).
  3. Logs an `incidents` record for review.

### 9.2 What staff should do if a guest activates SOS in your venue
1. Manager will get an immediate alert in the **Lovable admin portal**.
2. Locate the guest (their last known venue is included).
3. Provide assistance: water, escort to first aid, contact ride-share, etc.
4. Write a 2-line incident note in the Lovable portal **Resolve** action.
5. If serious (medical / police), call 000 first, then update the portal.

### 9.3 Geofencing
- The app uses geofences around each venue. When a member crosses one:
  - "Welcome to <Venue>" push (if opted in)
  - Auto-claim of any pending entry QR
  - Mission / milestone progression
- Members can opt out in `/location-settings`.

---

## 10. COMMON MEMBER QUESTIONS (CHEAT SHEET)

| Question | One-Line Answer |
|---|---|
| "How do I get my points?" | "I'll scan your member QR and award them now." |
| "Where's my member QR?" | "Open the app → Wallet → Member Card." |
| "I didn't get points from yesterday." | "Let me check the History — sometimes SwiftPOS takes a few minutes." |
| "How do I get free entry?" | "Lunar subscription gives monthly free entries; your tier may also unlock them." |
| "What's my tier?" | "It's shown on your Profile screen — Bronze, Silver, Gold, or Legend." |
| "How do referrals work?" | "Profile → Refer a Friend. You both get bonus points after their first visit." |
| "My birthday reward isn't showing." | "It unlocks during your birthday week — check Profile → Birthday Club." |
| "I lost something." | "Open the app → Lost & Found → Report Missing. We'll match it." |
| "Can I link my CherryHub wallet?" | "Yes — Profile → CherryHub → Link Account." |
| "How do I cancel my subscription?" | "Profile → Subscriptions → Manage. Stripe handles it; access continues until period end." |
| "Why can't I sign in?" | "Try forgot password. If still broken, ask a manager to look you up in the staff portal." |

---

## 11. TROUBLESHOOTING PLAYBOOK

### 11.1 "Points not showing"
1. Open Staff Portal → History → search member.
2. If the transaction is there → done; ask member to pull-to-refresh Wallet.
3. If not there → re-award via Quick Award and write a note for the manager to investigate.

### 11.2 "QR won't scan"
1. Increase phone brightness fully.
2. Ask member to switch to the full-screen Member Card (`Wallet → Member Card`).
3. If still failing, ask for the member's email/phone and use Search instead.
4. If reward QR fails, ask member for the **redemption ID** shown beneath the QR — paste it into the Validate input box.

### 11.3 "App keeps crashing"
1. Force-close and reopen.
2. Check internet (WiFi vs mobile).
3. Update to latest version (App Store / Play Store).
4. If still broken, capture screenshot + member ID and send to support.

### 11.4 "Wrong venue on the receipt"
1. **Don't reverse via the app** — call your manager.
2. The manager will use the Lovable Admin Portal to issue a correction.

### 11.5 "Duplicate award"
- Ask the member to confirm both transactions on their Wallet.
- Manager → Lovable Admin Portal → reverse the duplicate.

---

## 12. ESCALATION & SUPPORT

| Severity | Example | Action |
|---|---|---|
| **P0 — Emergency** | SOS triggered, medical / safety | Call 000 → notify duty manager → resolve in Lovable portal |
| **P1 — Service-impacting** | Staff Portal won't load, payments offline | Duty manager → escalate to Luna Hub support immediately |
| **P2 — Member dispute** | Missing points, failed redemption | Resolve in venue if possible; manager logs ticket if not |
| **P3 — Feedback / suggestion** | Feature request | Manager logs in support channel weekly |

**Support channels (in order):**
1. Duty Manager (in-venue)
2. Luna Hub on-call line (issued by your venue)
3. `support@lunagroupapp.com.au`

---

## 13. DAILY / SHIFT CHECKLISTS

### 13.1 Pre-Shift (Door / Floor)
- [ ] Phone fully charged + spare power bank
- [ ] Logged into Staff Portal with the **correct venue** selected
- [ ] Camera permission verified (do a test scan)
- [ ] Awareness of tonight's events / promos
- [ ] Awareness of any active boosts (e.g., "2× points 9–11pm")

### 13.2 During Shift
- [ ] Greet members by tier (gold/legend → priority service)
- [ ] Award points within 5 minutes of any manual transaction
- [ ] Validate QRs only after confirming the green "Success" indicator
- [ ] Log incidents in real time

### 13.3 Post-Shift (Manager)
- [ ] Reconcile Staff Portal History against SwiftPOS day-end
- [ ] Resolve any open redemptions (pending → redeemed/expired)
- [ ] Review any flagged disputes
- [ ] Push any post-event broadcast (Lovable portal)

---

## 14. TRAINING SIGN-OFF

Each staff member must demonstrate they can:

- [ ] Log into the Staff Portal and select the correct venue
- [ ] Search for a member by name, email, and QR scan (all three methods)
- [ ] Quick-award points with the correct category and a receipt reference
- [ ] Validate each QR type (`MEMBER`, `ENT`, `TKT`, `DRINK`, `BDAY`, generic reward)
- [ ] Explain the difference between base tier and subscription tier
- [ ] Walk a member through finding their Member Card
- [ ] Triage a "missing points" complaint
- [ ] Trigger and explain the SOS workflow (without actually firing one!)
- [ ] Identify when a manager / Luna Hub escalation is required

---

| Trainee Name | Role | Venue | Trainer | Date | Signature |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
|  |  |  |  |  |  |

---

### APPENDIX A — Glossary
- **SwiftPOS** — the point-of-sale system at every venue, source of truth for all loyalty points.
- **CherryHub** — third-party digital wallet integration; members can sync their Luna points.
- **Lovable Admin Portal** — web dashboard for managers and admins (separate URL).
- **Geofence** — invisible "fence" around a venue that triggers app actions.
- **Earn-guard** — backend rule that prevents duplicate / inflated awards. Gift Points bypasses it.
- **Boost** — temporary points multiplier (manager-set, time-limited).
- **Crew** — a friend group inside the app; nights can be planned together.
- **Nightly Crown** — the leaderboard of top guests each night.

### APPENDIX B — Useful Internal Docs (linked in Drive)
- `LUNA_API_MASTER_REFERENCE.md` — full backend API documentation
- `LUNA_LOVABLE_MASTER_PROMPT.md` — admin-portal component spec
- App Store / TestFlight links (issued by IT)

---

*If you spot something inaccurate in this document, message the Luna Group Tech team — the SOP is updated every release.*
