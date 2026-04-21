# Luna Group — Complete Rewards Program Reference
_Last updated: Feb 2026 · Source of truth for all tiers, missions, milestones, rewards, bottles, and points math._

This document is built directly from the production source files:
- `backend/config.py` → `SUBSCRIPTION_TIERS`
- `backend/routes/milestones.py` → `MILESTONES`
- `backend/seed_data.py` → `rewards`, `missions`
- `backend/routes/bookings.py` → Eclipse bottle menu
- `backend/routes/venue_menus.py` → Juju / Night Market / Ember & Ash menus
- `backend/routes/subscriptions.py` → subscribe / award-points logic

Every single reward ticket, perk line, price, and point value is enumerated verbatim below. Nothing is paraphrased.

---

## 💵 Subscription pricing — confirmed

| Tier | Monthly billing (actual charge) | Advertised weekly equivalent | Stripe Payment Link |
|---|---|---|---|
| Bronze | $0 (free) | $0 | — (free tier, auto-assigned) |
| **Silver** | **$39.99 AUD/mo** | **$9.23/wk** | _needs refresh — currently live at $29, must re-create at $39.99_ |
| **Gold** | **$79.99 AUD/mo** | **$18.46/wk** | _needs refresh — currently live at $79, must re-create at $79.99_ |

**Marketing rule:** Prices are always displayed as a weekly figure (e.g. "$9.23/week") with a sub-line that reads "billed monthly at $39.99". Stripe is configured for monthly recurring billing only; the weekly figure is a display convention.

Weekly math: `monthly × 12 ÷ 52`.

---

## 🏆 Subscription Tiers — full perk lists

### 🥉 BRONZE — $0 (free default)
- **Price**: $0 / month · billing period: `monthly`
- **Points multiplier**: `1.0×` → 10 pts per $1
- **Points expire**: ✅ YES
- **Color**: `#CD7F32` · Icon: `bronze`
- **Description**: _"Free membership with great perks"_

**Benefits flags (from `SUBSCRIPTION_TIERS.bronze.benefits`):**
- `free_entry_before_time`: `10pm`
- `free_entries_per_month`: `0`
- `skip_the_line`: ❌
- `priority_booking`: ❌
- `complimentary_drink`: ❌
- `guest_entry`: `0`
- `sky_lounge_access`: ❌
- `reserved_section`: ❌
- `restaurant_discount`: `5%`
- `restaurant_discount_days`: `weeknights`
- `birthday_dessert`: ✅
- `birthday_surprise`: ✅
- `private_events_access`: ❌
- `concierge_access`: ❌
- `points_expire`: ✅ YES (points expire on Bronze)

**`perks_list` (combined display list):**
1. Free entry before 10pm (excludes ticketed events)
2. Birthday surprise (shown at door)
3. Early access to event announcements
4. Points earned on every spend
5. 5% off food on weeknights (Sun–Thu)
6. Complimentary birthday dessert
7. Points earned on every spend
8. Access to member pre-sale tickets
9. Access to Bronze members only parties

**`nightclub_perks`:**
1. Free entry before 10pm (excludes ticketed events)
2. Birthday surprise (shown at door)
3. Early access to event announcements before public release
4. 1× points on all purchases

**`restaurant_perks`:**
1. 5% off food on weeknights (Sunday – Thursday)
2. Complimentary birthday dessert

**`general_perks`:**
1. Points earned on every spend across all Luna venues
2. Access to member-only pre-sale tickets for events
3. Access to Bronze members only parties

---

### 🥈 SILVER — $39.99 / month ($9.23/wk advertised)
- **Price**: $39.99 / month · billing period: `monthly`
- **Points multiplier**: `1.5×` → 15 pts per $1
- **Points expire**: ❌ NO
- **Color**: `#C0C0C0` · Icon: `silver`
- **Description**: _"Premium nightlife experience"_

**Benefits flags:**
- `free_entry_before_time`: `11pm`
- `free_entries_per_month`: `999` (effectively unlimited)
- `skip_the_line`: ✅
- `priority_booking`: ✅
- `complimentary_drink`: ✅
- `complimentary_drink_excludes`: `Saturdays`
- `guest_entry`: `0`
- `sky_lounge_access`: ❌
- `reserved_section`: ❌
- `restaurant_discount`: `10%`
- `restaurant_discount_days`: `all`
- `welcome_drink`: ✅
- `birthday_dessert`: ✅
- `birthday_surprise`: ✅
- `private_events_access`: ✅
- `concierge_access`: ✅
- `points_expire`: ❌ NO (points never expire on Silver)
- `silver_wristband`: ✅

**`perks_list`:**
1. Express entry – skip the queue entirely
2. Free entry before 11pm (excludes ticketed events)
3. 10% discount on pre-purchased items
4. Complimentary beverage every night (except Saturdays)
5. Invitations to Silver/Gold-only events
6. Complimentary Silver Eclipse Wristband
7. 10% off total bill any day at restaurants
8. Complimentary welcome drink on arrival
9. Priority table reservation (48hr advance)
10. 1.5× accelerated points earning
11. Points never expire
12. Dedicated member contact line

**`nightclub_perks`:**
1. Express entry every visit (skip the queue entirely)
2. Free entry before 11pm (excludes ticketed events)
3. 10% discount on pre-purchased items (tickets, booths)
4. Complimentary beverage every night excluding Saturdays
5. Invitations to Silver/Gold-only events and themed nights
6. Complimentary Silver Eclipse Wristband

**`restaurant_perks`:**
1. 10% off total bill any day of the week
2. Complimentary welcome drink on arrival (house wine/beer/soft drink)
3. Priority table reservation (48-hour advance booking access before public)
4. Access to members-only dining events or chef's table evenings

**`general_perks`:**
1. Accelerated points earning (1.5× on all spend)
2. Points never expire
3. Dedicated member contact line for bookings/enquiries

---

### 🥇 GOLD — $79.99 / month ($18.46/wk advertised)
- **Price**: $79.99 / month · billing period: `monthly`
- **Points multiplier**: `2.0×` → 20 pts per $1
- **Points expire**: ❌ NO
- **Color**: `#FFD700` · Icon: `gold`
- **Description**: _"Ultimate VIP treatment at all Luna venues"_

**Benefits flags:**
- `free_entry_before_time`: `all_night`
- `free_entries_per_month`: `999` (effectively unlimited)
- `skip_the_line`: ✅
- `priority_booking`: ✅
- `complimentary_drink`: ✅ (no exclusions)
- `complimentary_drink_excludes`: `None`
- `guest_entry`: `1` (one free guest per visit)
- `sky_lounge_access`: ✅
- `reserved_section`: ✅
- `restaurant_discount`: `15%`
- `restaurant_discount_days`: `all`
- `welcome_drink`: ✅
- `birthday_dessert`: ✅
- `birthday_surprise`: ✅
- `private_events_access`: ✅
- `concierge_access`: ✅
- `whatsapp_concierge`: ✅
- `points_expire`: ❌ NO
- `anniversary_bonus`: ✅
- `premium_member_card`: ✅
- `early_holiday_booking`: ✅

**`perks_list`:**
1. Unlimited free entry every night (subject to availability)
2. Complimentary Sky Lounge access at Eclipse
3. Reserved section/booth access (guaranteed with booking)
4. Complimentary beverage at each venue every night
5. Complimentary entry for 1 guest per visit
6. Exclusive Gold member-only events
7. First access to artist/DJ bookings
8. 15% off total bill at restaurants, any time
9. Guaranteed table reservation – no waitlist
10. Exclusive dining experiences invitation
11. 2× points on all spend
12. Annual bonus points on membership anniversary
13. Personalised premium member card
14. Direct WhatsApp/concierge line
15. Early access to NYE & holiday bookings

**`nightclub_perks`:**
1. Unlimited free entry every night, no booking required (subject to availability)
2. Complimentary Sky Lounge access at Eclipse
3. Reserved section or booth access (guaranteed on key nights with booking)
4. Complimentary beverage at each venue every night
5. Complimentary entry for 1 guest per visit
6. Exclusive Gold member-only events (pre-season parties, artist meet & greets, launch nights)
7. First access to artist/DJ bookings before anyone else

**`restaurant_perks`:**
1. 15% off total bill, any time, any day
2. Complimentary welcome drink
3. Guaranteed table reservation – no waitlist
4. Invitation to exclusive dining experiences (degustation evenings, new menu previews)
5. Complimentary dessert

**`general_perks`:**
1. 2× points on all spend
2. Annual bonus points credit on membership anniversary
3. Personalised member card (physical, premium feel)
4. Direct WhatsApp or concierge line for all Luna venues
5. Early access to New Year's Eve, special event, and public holiday bookings

---

## 💰 Points Rate & Effective Cashback

| Action | Formula | Bronze (1.0×) | Silver (1.5×) | Gold (2.0×) |
|---|---|---|---|---|
| $1 spent at any venue | `amount × 10 × multiplier` | 10 pts | 15 pts | 20 pts |
| $100 spend | | 1,000 pts | 1,500 pts | 2,000 pts |
| Redemption rate | 10 pts = $0.25 | — | — | — |
| **Effective cashback** | | **25%** | **37.5%** | **50%** |

**Constants (from `config.py`):**
- `POINTS_PER_DOLLAR = 10`
- `POINTS_REDEEM_CENTS = 25` (10 pts → $0.25)
- `POINTS_PER_CHECKIN = 5`
- `POINTS_PER_MISSION = 25` (default; each mission overrides with its own `points_reward`)
- `REFERRAL_POINTS_REWARD = 10`

**Implementation (`subscriptions.award_points`):**
```python
base_points = int(amount_spent * 10)            # 10 pts / $1
bonus_points = int(base_points * (multiplier - 1))
total_points = base_points + bonus_points
```
Points balance has no upper cap. Points never negatively reset — only deducted on voluntary redemption.

---

## 🎯 Missions (6 active — from `seed_data.py`)

Every mission below is server-verified. Clients cannot self-report completion — progress is derived from verified check-ins, Stripe webhooks, or staff validations.

### 1. Early Bird Special · `icon: moon`
- **Description**: Check in before 10:30pm at any Luna nightclub tonight
- **Points reward**: **+150 pts**
- **Requirement value**: `1` (one qualifying check-in)
- **Mission type**: `early_bird`
- **Venue requirements**: none (any Luna nightclub)
- **Cross-venue flag**: `false`
- **Verification**: geofence + timestamp; 1× per week

### 2. Luna Explorer · `icon: planet`
- **Description**: Visit 3 different Luna venues this month
- **Points reward**: **+750 pts**
- **Requirement value**: `3` (distinct `venue_id` count)
- **Mission type**: `cross_venue`
- **Venue requirements**: none
- **Cross-venue flag**: `true`
- **Verification**: rolling 7-day window of distinct `venue_id` in `check_ins`

### 3. Dine & Dance · `icon: stars`
- **Description**: Have dinner at a Luna restaurant then hit the club same night
- **Points reward**: **+400 pts**
- **Requirement value**: `2` (1 restaurant + 1 nightclub)
- **Mission type**: `cross_venue`
- **Venue requirements**: none
- **Cross-venue flag**: `true`
- **Verification**: 1 restaurant-type + 1 nightclub-type check-in within 24h window

### 4. Eclipse Loyalist · `icon: rocket`
- **Description**: Check in at Eclipse 3 times this month
- **Points reward**: **+500 pts**
- **Requirement value**: `3`
- **Mission type**: `venue_specific`
- **Venue requirements**: `["eclipse"]`
- **Cross-venue flag**: `false`
- **Verification**: monthly count of `venue_id=eclipse`; same-day duplicates collapsed to 1

### 5. Weekend Warrior · `icon: galaxy`
- **Description**: Visit any Luna venue every weekend this month
- **Points reward**: **+600 pts**
- **Requirement value**: `4` (4 consecutive Saturdays)
- **Mission type**: `consistency`
- **Venue requirements**: none
- **Cross-venue flag**: `false`
- **Verification**: consecutive Saturday streak tracked server-side; missing one resets the streak

### 6. Social Butterfly · `icon: constellation`
- **Description**: Bring 5 friends who check in with you
- **Points reward**: **+800 pts**
- **Requirement value**: `5` (5 referred friends with verified check-in)
- **Mission type**: `social`
- **Venue requirements**: none
- **Cross-venue flag**: `false`
- **Verification**: points release on the 5th invitee's verified check-in, not on signup

**Total potential from completing all missions (non-repeatable): 3,200 pts** (Bronze value ≈ $80 cashback, Silver ≈ $120, Gold ≈ $160).

**Claim flow (`POST /api/missions/{mission_id}/claim`):**
- Requires `mission_progress.completed = true` AND `claimed = false`
- Increments `users.points_balance` by `mission.points_reward`
- Writes `points_transactions` record with `type: mission_reward`
- Sets `mission_progress.claimed = true` + `claimed_at` → prevents double-claim

---

## 🏁 Milestones — Every Reward Ticket Enumerated

Milestones are lifetime-cumulative. Points never reset for milestone purposes. Unlocking a milestone is a one-time event that generates **individual one-use QR tickets**, each bound to the user and validated server-side.

Total reward tickets if a user unlocks every milestone: **109 individual QR tickets** (0 + 5 + 14 + 26 + 42 + 62 / note: Legend has 62, Supernova 42).

---

### 1. Newbie · 0 pts · `icon: person-add` · `#8B8B8B`
- **Description**: "Welcome to Luna Group! Your journey starts here."
- **Unlock condition**: automatic on signup
- **Total reward tickets**: `0`
- **Rewards array**: `[]` (empty — this is a status marker only, no redeemable items)

---

### 2. Rising Star · 500 pts · `icon: trending-up` · `#10B981`
- **Description**: "You're making moves! Enjoy 5 free drinks on us."
- **Total reward tickets**: `5`

| Ticket ID | Type | Label | Description |
|---|---|---|---|
| `rs_drink_1` | `free_drink` | Free Drink 1/5 | Redeem for any house drink |
| `rs_drink_2` | `free_drink` | Free Drink 2/5 | Redeem for any house drink |
| `rs_drink_3` | `free_drink` | Free Drink 3/5 | Redeem for any house drink |
| `rs_drink_4` | `free_drink` | Free Drink 4/5 | Redeem for any house drink |
| `rs_drink_5` | `free_drink` | Free Drink 5/5 | Redeem for any house drink |

---

### 3. VIP Status · 1,000 pts · `icon: flash` · `#2563EB`
- **Description**: "You've hit VIP. 10 free drinks and 4 free entries!"
- **Total reward tickets**: `14` (10 drinks + 4 entries)

| Ticket ID | Type | Label | Description |
|---|---|---|---|
| `vip_drink_1` through `vip_drink_10` | `free_drink` | Free Drink 1/10 … 10/10 | Redeem for any house drink |
| `vip_entry_1` through `vip_entry_4` | `free_entry` | Free Entry 1/4 … 4/4 | Free entry to any Luna venue |

Explicit list:
- `vip_drink_1` … `vip_drink_10` — 10 × Free Drink ticket
- `vip_entry_1` … `vip_entry_4` — 4 × Free Entry ticket

---

### 4. Luna Elite · 5,000 pts · `icon: diamond` · `#D4A832`
- **Description**: "Elite status unlocked. Free VIP booth, 20 drinks, and 5 entries."
- **Total reward tickets**: `26` (1 booth + 20 drinks + 5 entries)

| Ticket ID | Type | Label | Description |
|---|---|---|---|
| `elite_booth` | `free_vip_booth` | Free VIP Booth | One free VIP booth reservation at any venue |
| `elite_drink_1` … `elite_drink_20` | `free_drink` | Free Drink 1/20 … 20/20 | Redeem for any house drink |
| `elite_entry_1` … `elite_entry_5` | `free_entry` | Free Entry 1/5 … 5/5 | Free entry to any Luna venue |

Explicit list:
- `elite_booth` — 1 × VIP Booth reservation
- `elite_drink_1` through `elite_drink_20` — 20 × Free Drink
- `elite_entry_1` through `elite_entry_5` — 5 × Free Entry

---

### 5. Supernova · 10,000 pts · `icon: star` · `#F59E0B`
- **Description**: "Supernova status! Free VIP booth, 30 drinks, 5 entries, 5 express entries, and a DJ shoutout."
- **Total reward tickets**: `42` (1 booth + 30 drinks + 5 entries + 5 express + 1 DJ shoutout)

| Ticket ID | Type | Label | Description |
|---|---|---|---|
| `sn_booth` | `free_vip_booth` | Free VIP Booth | One free VIP booth reservation at any venue |
| `sn_drink_1` … `sn_drink_30` | `free_drink` | Free Drink 1/30 … 30/30 | Redeem for any house drink |
| `sn_entry_1` … `sn_entry_5` | `free_entry` | Free Entry 1/5 … 5/5 | Free entry to any Luna venue |
| `sn_express_1` … `sn_express_5` | `express_entry` | Express Entry 1/5 … 5/5 | Skip the line at any venue, any time |
| `sn_shoutout` | `dj_shoutout` | DJ Shoutout | Get a personal DJ shoutout at any Luna nightclub |

Explicit list:
- `sn_booth` — 1 × VIP Booth reservation
- `sn_drink_1` through `sn_drink_30` — 30 × Free Drink
- `sn_entry_1` through `sn_entry_5` — 5 × Free Entry
- `sn_express_1` through `sn_express_5` — 5 × Express (line-skip) Entry
- `sn_shoutout` — 1 × Personal DJ Shoutout

---

### 6. Legend · 25,000 pts · `icon: trophy` · `#F0C850`
- **Description**: "Ultimate Legend status. Gold VIP, unlimited entries, 1 booth with bottle, 50 drinks, 10 giftable entries."
- **Total reward tickets**: `62` (1 gold upgrade + 1 booth+bottle + 50 drinks + 10 giftable entries)

| Ticket ID | Type | Label | Description |
|---|---|---|---|
| `leg_gold_status` | `gold_upgrade` | Ultimate Gold Status | Free Gold membership upgrade for **3 months** |
| `leg_booth_bottle` | `booth_with_bottle` | VIP Booth + Bottle | One VIP booth with a premium bottle at any venue |
| `leg_drink_1` … `leg_drink_50` | `free_drink` | Free Drink 1/50 … 50/50 | Redeem for any house drink |
| `leg_gift_entry_1` … `leg_gift_entry_10` | `giftable_entry` | Giftable Entry 1/10 … 10/10 | Free entry ticket you can give to a friend |

Explicit list:
- `leg_gold_status` — 1 × 3-month Gold membership upgrade (auto-applied on scan)
- `leg_booth_bottle` — 1 × VIP Booth + Premium Bottle
- `leg_drink_1` through `leg_drink_50` — 50 × Free Drink
- `leg_gift_entry_1` through `leg_gift_entry_10` — 10 × Giftable Entry

---

### Milestone ticket security & flow

**Generation** (`POST /api/milestones/claim/{milestone_id}`):
- Verifies `users.points_balance >= points_required` (lifetime, not deducted on unlock)
- Prevents double-claim via `milestone_claims` unique record
- Creates one `milestone_tickets` row per reward, each with a signed QR code:
  ```
  LUNA-TKT-{ticket_id[:8].upper()}-{HMAC_SHA256(ticket_id+user_id, QR_SECRET)[:10].upper()}
  ```

**Listing** (`GET /api/milestones/tickets`): returns all `status=active` tickets for the user.

**Validation** (staff-only, `POST /api/milestones/tickets/validate-qr`):
- Requires `users.role ∈ {admin, staff, manager}`
- Looks up by `qr_code` + `status=active`
- Writes to `milestone_ticket_usage` with `validated_by`, `venue_id`, `used_at`
- **Permanently deletes the ticket row** — physically impossible to re-use even by screenshot

**Why this is secure**: the QR signature embeds the ticket_id and user_id under `QR_SECRET` (in code: `"luna_milestone_qr_2026"`). A screenshot of a used ticket returns `404 Invalid or already-used ticket QR code` because the database row no longer exists.

---

## 🎁 Rewards Shop (10 items · from `seed_data.py → rewards[]`)

Rewards are **purchasable with points** (points deducted on redemption) and generate a **one-use QR** that lives in the Wallet tab (`wallet_passes` collection) for 48h.

| # | Name | Points Cost | Category | Venue Restriction | Description |
|---|---|---|---|---|---|
| 1 | Complimentary Premium Cocktail | 200 | `drinks` | — (any Luna venue) | Choose from our signature cocktail menu at any Luna venue |
| 2 | Fast Lane Access – Any Venue | 300 | `vip` | — | Skip the queue at any Luna nightclub this weekend |
| 3 | Luna Credits – $50 | 600 | `vip` | — | Spend at any Luna Group venue on anything you want |
| 4 | Eclipse VIP Booth – 4 Hours | 1,500 | `vip` | `eclipse` | Premium booth with bottle service for you and 6 guests |
| 5 | Premium Bottle Service | 800 | `bottles` | `eclipse` | Choose from Grey Goose, Belvedere, or Patron at Eclipse |
| 6 | After Dark Party Package | 500 | `vip` | `after_dark` | Entry + 2 drinks + VIP area access for 4 people |
| 7 | Night Market Dining Credit – $100 | 1,200 | `dining` | `night_market` | Enjoy authentic Asian cuisine with this dining voucher |
| 8 | Juju Rooftop Experience | 2,000 | `dining` | `juju` | 3-course dinner for 2 with ocean views |
| 9 | Complimentary Drinks – Pack of 4 | 350 | `drinks` | — | 4 standard drinks valid at any Luna nightclub |
| 10 | Luna Group Merch Pack | 450 | `merch` | — | Exclusive Luna Group t-shirt and cap |

**Redemption flow** (`POST /api/rewards/redeem-with-qr?reward_id=…&venue_id=…`):
1. Verify user has sufficient points; else `400 Insufficient points`
2. If `venue_restriction` set, reject if `venue_id` doesn't match
3. Deduct `points_cost` from `users.points_balance`
4. Create `redemptions` row (status `pending`, expires in 48h)
5. Generate QR: `LUNA-{redemption_id[:8].upper()}-{HMAC_SHA256(redemption_id+user_id+ts, QR_SECRET)[:12].upper()}`
6. Create mirrored `wallet_passes` entry so the reward shows in the Wallet tab
7. Write negative `points_transactions` entry (`type: reward_redemption`)

**Validation** (staff, `POST /api/validate-qr`):
- Requires staff role
- Marks `redemptions.status = redeemed` + `wallet_passes.redeemed = true` + `redeemed_by = staff_user_id`
- Rejects re-scan with `400 This QR code has already been used`

---

## 🍾 Eclipse Bottle Service — full menu (48 items)

**Venue**: Eclipse only (only venue offering bottle service in app).
**Deposit model** (`backend/routes/bookings.py`): `max($50 AUD, 10% of cart subtotal)` charged via live Stripe checkout. Balance paid at venue on arrival.
**Points**: awarded on final confirmed amount at venue (not deposit) via Staff Portal → `10 pts × $spend × tier_multiplier`.

### Vodka (8)
| Item | Price AUD |
|---|---|
| Belvedere 700mL | $400 |
| Belvedere Magnum 1.75L | $800 |
| Belvedere Jeroboam 3L | $1,600 |
| Belvedere Imperial 6L | $2,500 |
| Belvedere 10 | $950 |
| Grey Goose 700mL | $450 |
| Cîroc 750mL | $400 |
| Cîroc Magnum 1.75L | $900 |

### Gin (2)
| Item | Price AUD |
|---|---|
| Bombay Sapphire 700mL | $400 |
| Tanqueray 10 700mL | $400 |

### Tequila (18)
| Item | Price AUD |
|---|---|
| Patrón Silver | $400 |
| Patrón Reposado | $450 |
| 1800 Silver | $400 |
| 1800 Coconut | $450 |
| 1800 Añejo | $500 |
| 1800 Cristalino | $550 |
| Don Julio Blanco | $400 |
| Don Julio Reposado | $500 |
| Don Julio 1942 | $1,000 |
| Volcán Blanco | $400 |
| Volcán XA Luminous | $1,000 |
| Volando Blanco | $400 |
| Clase Azul Reposado | $1,500 |
| Cincoro Gold | $1,600 |
| Cincoro Blanco Magnum 1.75L | $1,800 |
| Cincoro Reposado | $1,000 |
| Cincoro Blanco | $850 |
| Cincoro Añejo | $1,300 |

### Scotch (6)
| Item | Price AUD |
|---|---|
| Jameson | $400 |
| Johnnie Walker Black | $400 |
| Chivas Regal | $400 |
| Glenmorangie Original | $500 |
| Glenfiddich | $450 |
| Macallan 12yo | $600 |

### Rum (3)
| Item | Price AUD |
|---|---|
| Captain Morgan | $400 |
| The Kraken | $400 |
| Bacardi | $400 |

### Bourbon (3)
| Item | Price AUD |
|---|---|
| Jack Daniel's | $400 |
| Maker's Mark | $450 |
| Gentleman Jack Magnum 1.75L | $750 |

### Liqueur (3)
| Item | Price AUD |
|---|---|
| Alizé | $400 |
| Sour Puss Collection 4×700mL | $300 |
| Wet Pussy 700mL | $300 |

### Cognac (2)
| Item | Price AUD |
|---|---|
| Hennessy VS | $400 |
| Hennessy VSOP | $600 |

### Champagne (3)
| Item | Price AUD |
|---|---|
| Moët & Chandon | $200 |
| Veuve Clicquot | $250 |
| Dom Pérignon | $800 |

**Total items: 48** across 9 categories. Cheapest $200 (Moët), priciest $2,500 (Belvedere Imperial 6L).

---

## 🏢 Venue Menus (digital, served via `/api/venues/{id}/menu`)

### JuJu's (Mermaid Beach)
- **Food categories**: Lighter Plates · Signature Wagyu · Mains · Sides · Desserts
- **Drink categories**: Signature Cocktails · Classics · Wine By Glass · Beer · Spirits

### Night Market
- **Food categories**: Raw · Snacks · Skewers · Sandos · Share Plates · Sides · Sweet · **Chef's Banquet $95pp**
- **Drink categories**: Cocktails · Sake · Wines · Beers · Highballs

### Ember & Ash (Restaurant)
- **Food categories**: Snacks · Small Plates · Large Plates · Steaks (9+ Rump Cap · 5+ Tomahawk) · Sides · **Chef's Menu $99pp** · **Wagyu Tasting $225pp** · Desserts
- **Drink categories**: Cocktails · Wine · Spirits

### Ember & Ash (Cafe)
- **Food categories**: Bagels · Sourdough · Signature Dishes · Coffee & Matcha ($4.50–$6.50) · Cold Drinks

Full item-level data lives in `/app/backend/routes/venue_menus.py`. Menus are read-only in the mobile app (view via Venues tab → Menu button).

---

## 📱 Push Broadcast Audience Segments (Admin Dashboard)

Configured in `backend/routes/push_broadcasts.py`. Every broadcast can be targeted to one or more of:

- **All users**
- **Bronze only** — `subscription_tier = bronze`
- **Silver+** — `subscription_tier IN (silver, gold)`
- **Gold only** — `subscription_tier = gold`
- **Active in last 7 days** — at least one `check_ins` in past 7d
- **Active in last 30 days**
- **Active in last 90 days**
- **Churned** — no `check_ins` for 30+ days
- **Birthday this week** — `dob` month+day within next 7 days
- **Specific venue check-in history** — user has ever checked in at `venue_id = X`

---

## 🎤 How Points Actually Get Credited

| Source | Timing | Triggered by | Verification |
|---|---|---|---|
| Subscribe to Luna+ paid tier | Instant | Stripe webhook `checkout.session.completed` | `payment_transactions.payment_status = paid` |
| Mission completion | On claim (not auto) | `POST /api/missions/{id}/claim` after server detects criteria met | `mission_progress.completed = true` gated server-side |
| Milestone unlock | Instant on claim | `POST /api/milestones/claim/{id}` | Lifetime `points_balance >= points_required` |
| Bottle service (final spend) | After venue | Staff Portal confirms final tab → `/api/staff/award-points` | Staff role required |
| Auction win (final spend) | After venue | Staff Portal confirms final tab | Staff role required |
| In-app Stripe purchase | After webhook | Webhook emits `checkout.session.completed` for non-subscription | Verified payment status |
| Venue check-in | Instant | QR scan at door OR geofence + staff door code | `geofences.distance_m < radius_m` + rate limit |
| Referral bonus (Social Butterfly) | After 5th verified check-in | `friends.referred_by` chain + invitee check-ins counted | Server tallies only verified visits, not signups |

**Golden rule**: _Points are never user-reported._ Every credit either comes from a verified Stripe webhook, staff confirmation, or a sensor-verified action (geofence + timestamp + rate limit).

---

## 🔒 Anti-Abuse & QR Security Summary

| Control | Applied to | Mechanism |
|---|---|---|
| Server-only progress | Missions | Client can't set `completed` — only server reading `check_ins`, `points_transactions`, `referrals` can mark it true |
| Geofence radius check | Check-ins | `geofences.py` enforces `haversine(user_loc, venue_loc) < radius_m` |
| 4h same-venue rate limit | Check-ins | `rate_limits` table; no double-check-in to farm points |
| Email + phone verification | Account | Required before any points-earning action |
| Idempotency keys | Stripe webhooks, QR validations | Duplicate events are no-ops |
| Signed QR codes | Rewards, milestones, check-ins | HMAC-SHA256 truncated signature bound to user+resource+ts |
| Physical ticket deletion | Milestone tickets | Row deleted on successful scan → screenshot re-scan returns 404 |
| One-time redemption status | Rewards | `redemptions.status = redeemed` + `redeemed_by` + `redeemed_at` |
| Staff-role gating | All validation endpoints | `users.role ∈ {admin, staff, manager}` |
| Expiry timestamps | Reward QRs | `expires_at = now + 48h`; check-in QRs `expires_at = now + 60s` |
| Staff revocation panel | Any fraudulent claim | Admin can null out points and invalidate tickets |

---

## 📋 Entry-Charging Venues

From `config.py → ENTRY_CHARGING_VENUES`:
- `eclipse`
- `afterdark`
- `su-casa-brisbane`
- `su-casa-gold-coast`

Only these venues consume `free_entries_remaining` from a subscription. Juju, Night Market, Ember & Ash are free entry regardless of tier.

---

## 🧮 Quick Reference Totals

| Metric | Value |
|---|---|
| Subscription tiers | 3 (Bronze, Silver, Gold) |
| Paid tier prices | $39.99 / $79.99 per month |
| Points multipliers | 1.0× / 1.5× / 2.0× |
| Missions | 6 active |
| Max points from missions (one-time) | 3,200 pts |
| Milestones | 6 tiers |
| Total milestone reward tickets (lifetime if user unlocks all) | 109 |
| Rewards shop items | 10 |
| Eclipse bottle service items | 48 |
| Venue digital menus | 4 (Juju, Night Market, Ember & Ash Restaurant, Ember & Ash Cafe) |
| Points-earning sources | 8 (subscribe, mission, milestone, bottle, auction, IAP, check-in, referral) |
| Effective cashback range | 25% – 50% (Bronze to Gold) |

---

_This document is the master source of truth for Luna Group's rewards structure. All marketing, customer service scripts, and staff training material should reference this file. Update it whenever `backend/config.py`, `backend/routes/milestones.py`, or `backend/seed_data.py` changes._
