# Luna Group — Complete Rewards Program Reference
_Last updated: April 2026_

This is the master reference for every tier, reward, mission, milestone, and points rule in the Luna Group app.

---

## ⚠️ Price mismatch — needs your decision

| Item | Backend config (`backend/config.py`) | Stripe Payment Link I created | Public subscribe page |
|---|---|---|---|
| Silver | **$39.99 AUD/mo** | **$29 AUD/mo** | $29 |
| Gold | **$79.99 AUD/mo** | **$79 AUD/mo** | $79 |

**Which price is correct?** Tell me and I'll fix everything in one sweep:
- (A) `$29 / $79` — I'll update backend config to match the Stripe link
- (B) `$39.99 / $79.99` — I'll archive current Stripe links and create new ones at the correct prices
- (C) Something else

---

## 🏆 Subscription Tiers

### 🥉 BRONZE — $0 / month (FREE default for all users)
- **Points multiplier**: 1× (10 pts per $1)
- **Points expire**: Yes
- **Nightclub perks**:
  - Free entry before 10pm (excludes ticketed events)
  - Birthday surprise shown at the door
  - Early access to event announcements
  - 1× points on all purchases
- **Restaurant perks**:
  - 5% off food on weeknights (Sunday – Thursday)
  - Complimentary birthday dessert
- **General perks**:
  - Points earned on every spend across all Luna venues
  - Member-only pre-sale tickets
  - Access to Bronze members-only parties

### 🥈 SILVER — $29 / month (pending price decision)
- **Points multiplier**: 1.5× (15 pts per $1)
- **Points expire**: No
- **Free entries**: Unlimited (subject to venue capacity)
- **Nightclub perks**:
  - Express entry — skip the queue every visit
  - Free entry before 11pm (excludes ticketed events)
  - 10% discount on pre-purchased items (tickets, booths)
  - Complimentary drink every night (except Saturdays)
  - Invitations to Silver/Gold-only events & themed nights
  - Complimentary Silver Eclipse wristband
- **Restaurant perks**:
  - 10% off total bill, any day of the week
  - Complimentary welcome drink on arrival
  - Priority table reservation — 48h early access before public
  - Members-only dining events / chef's table evenings
- **General perks**:
  - 1.5× accelerated points earning
  - Points never expire
  - Dedicated member contact line
  - Private events access
  - Concierge access

### 🥇 GOLD — $79 / month (pending price decision)
- **Points multiplier**: 2× (20 pts per $1)
- **Points expire**: No
- **Free entries**: Unlimited
- **Guest passes**: 1 per visit
- **Nightclub perks**:
  - Unlimited free entry every night (subject to availability)
  - Complimentary Sky Lounge access at Eclipse
  - Reserved section / booth access (guaranteed with booking)
  - Complimentary drink at each venue every night
  - Complimentary entry for 1 guest per visit
  - Exclusive Gold member-only events (pre-season parties, artist meet-and-greets, launch nights)
  - First access to artist / DJ bookings
- **Restaurant perks**:
  - 15% off total bill, any time, any day
  - Guaranteed table reservation — no waitlist
  - Exclusive dining experiences invitations
- **General perks**:
  - 2× points on all spend
  - Annual bonus points on membership anniversary
  - Personalised premium member card
  - Direct WhatsApp / concierge line
  - Early access to NYE & holiday bookings

---

## 💰 Points Rate

| Action | Earn | Value at Bronze | Silver (1.5×) | Gold (2×) |
|---|---|---|---|---|
| $1 spent at any venue | 10 pts | 10 pts | 15 pts | 20 pts |
| Redemption ratio | — | 10 pts = $0.25 | Same | Same |
| Effective cashback | — | **25%** | **37.5%** | **50%** |

Minimum redemption: Any reward tier (starts from 200 pts). Maximum points balance: no cap.

---

## 🎯 Missions (6 active — all server-verified)

| Name | Reward | Requirement | Verification |
|---|---|---|---|
| **Early Bird Special** | +150 pts | Check in before 10:30pm at any Luna nightclub tonight | Geofence + timestamp, 1× per week |
| **Luna Explorer** | +750 pts | Visit 3 different Luna venues this week | Distinct `venue_id` in `check_ins` within 7-day rolling window |
| **Dine & Dance** | +400 pts | Eat at restaurant + dance at nightclub same night | 1 restaurant-type + 1 nightclub-type check-in within 24h |
| **Eclipse Loyalist** | +500 pts | Check in at Eclipse 3 times this month | Monthly count of `venue_id=eclipse`, same-day collapsed to 1 |
| **Weekend Warrior** | +600 pts | Hit a Luna venue 4 Saturdays in a row | Consecutive Saturday streak tracked server-side; miss one, resets |
| **Social Butterfly** | +800 pts | Invite 5 friends who sign up AND visit a venue | Points release on the 5th invitee's verified check-in, not on signup |

**Anti-abuse controls** on every mission:
- Server-side-only progress state (client cannot self-report)
- Geofence + timestamp verification for check-ins
- Idempotency keys — same action replayed does nothing
- Rate limits: 1 check-in per venue per 4h per user
- Account binding: requires verified email + phone
- Staff revoke panel for fraudulent claims

---

## 🏁 Milestones (6 tiers — lifetime points, never reset)

| Tier | Threshold | Reward | Format |
|---|---|---|---|
| **Newbie** | 0 pts | Welcome pack | Unlocked on sign-up |
| **Rising Star** | 500 pts | 5 free drinks | Single-use QR ticket (30-day expiry after unlock) |
| **VIP Status** | 1,000 pts | 10 free drinks + 4 free entries | Single-use QR tickets |
| **Luna Elite** | 5,000 pts | VIP booth + 20 drinks + 5 entries | Bookable booth + QR tickets |
| **Supernova** | 10,000 pts | VIP booth + 30 drinks + 5 entries + 5 exclusive perks | Booth + QR + perk bundle |
| **Legend** | 25,000 pts | Gold VIP status + unlimited entries + 1 booth per month + dedicated host line | Ongoing perks, not single-use |

**Milestone protection:**
- Single-use QR codes — server-marked `redeemed` on first scan, screenshots don't work on a 2nd scan
- Tier unlock is lifetime — once Luna Elite, always Luna Elite
- Booth reservations surface in Staff Portal with user name + photo for same-night verification

---

## 🎁 Rewards Shop (10 live rewards — redeemable with points)

| Reward | Cost | Category |
|---|---|---|
| Complimentary Premium Cocktail | 200 pts | drinks |
| Fast Lane Access — Any Venue | 300 pts | vip |
| Complimentary Drinks — Pack of 4 | 350 pts | drinks |
| Luna Group Merch Pack | 450 pts | merch |
| After Dark Party Package | 500 pts | vip |
| Luna Credits — $50 | 600 pts | vip |
| Premium Bottle Service | 800 pts | bottles |
| Night Market Dining Credit — $100 | 1,200 pts | dining |
| Eclipse VIP Booth — 4 Hours | 1,500 pts | vip |
| Juju Rooftop Experience | 2,000 pts | dining |

All rewards:
- Deducted from your points balance instantly on redemption
- Generate a single-use QR ticket in the Wallet tab
- Scanned at the door / bar / host stand to mark `status: redeemed`
- Cannot be re-scanned, transferred, or resold

---

## 🍾 Eclipse Bottle Service (48 items)

Deposit model: **$50 flat OR 10% of cart total, whichever is higher**. Balance paid at the venue on the night. Points awarded on the **final confirmed amount** via Staff Portal, not on the deposit.

### Vodka
Belvedere 700mL $400 · Belvedere Magnum 1.75L $800 · Belvedere Jeroboam 3L $1,600 · Belvedere Imperial 6L $2,500 · Belvedere 10 $950 · Grey Goose 700mL $450 · Cîroc 750mL $400 · Cîroc Magnum 1.75L $900

### Gin
Bombay Sapphire 700mL $400 · Tanqueray 10 700mL $400

### Tequila
Patrón Silver $400 · Patrón Reposado $450 · 1800 Silver $400 · 1800 Coconut $450 · 1800 Añejo $500 · 1800 Cristalino $550 · Don Julio Blanco $400 · Don Julio Reposado $500 · Don Julio 1942 $1,000 · Volcán Blanco $400 · Volcán XA Luminous $1,000 · Volando Blanco $400 · Clase Azul Reposado $1,500 · Cincoro Gold $1,600 · Cincoro Blanco Magnum 1.75L $1,800 · Cincoro Reposado $1,000 · Cincoro Blanco $850 · Cincoro Añejo $1,300

### Scotch
Jameson $400 · Johnnie Walker Black $400 · Chivas Regal $400 · Glenmorangie Original $500 · Glenfiddich $450 · Macallan 12yo $600

### Rum
Captain Morgan $400 · The Kraken $400 · Bacardi $400

### Bourbon
Jack Daniel's $400 · Maker's Mark $450 · Gentleman Jack Magnum 1.75L $750

### Liqueur
Alizé $400 · Sour Puss Collection 4×700mL $300 · Wet Pussy 700mL $300

### Cognac
Hennessy VS $400 · Hennessy VSOP $600

### Champagne
Moët & Chandon $200 · Veuve Clicquot $250 · Dom Pérignon $800

---

## 🏢 Venue Menus (view-only, served via `/api/venues/{id}/menu`)

### JuJu's
5 food categories (Lighter Plates, Signature Wagyu, Mains, Sides, Desserts) · 5 drink categories (Signature Cocktails, Classics, Wine By Glass, Beer, Spirits)

### Night Market
8 food categories (Raw, Snacks, Skewers, Sandos, Share Plates, Sides, Sweet, Chef's Banquet $95pp) · 5 drink categories (Cocktails, Sake, Wines, Beers, Highballs)

### Ember & Ash (Restaurant)
Categories: Snacks, Small Plates, Large Plates, Steaks (9+ Rump Cap, 5+ Tomahawk), Sides, **Chef's Menu $99pp**, **Wagyu Tasting $225pp**, Desserts. Cocktails + Wine + Spirits.

### Ember & Ash (Cafe)
Categories: Bagels, Sourdough, Signature Dishes, Coffee & Matcha ($4.50–$6.50), Cold Drinks

---

## 📱 Push Broadcast Audience Segments (admin dashboard)

Configured per broadcast:
- All users
- Bronze only / Silver+ / Gold only
- Active in last 7 days / 30 days / 90 days
- Churned (no check-in 30+ days)
- Birthday this week
- Specific venue check-in history

---

## 🎤 How Points Actually Get Credited

| Source | Timing | Triggered by |
|---|---|---|
| Subscribe to Luna+ paid tier | Instant | Stripe webhook `checkout.session.completed` |
| Mission completion | Instant | Server auto-detects when all criteria met |
| Milestone tier unlock | Instant | Lifetime points threshold crossed |
| Bottle service / auction / in-app purchase | After venue | Staff confirms final spend via Staff Portal → award at 10pts/$1 × tier multiplier |
| Check-in at venue | Instant | QR scan at door OR geofence + staff-verified door code |
| Referral bonus | After 5th friend visits | Server counts verified check-ins from invitee users |

**Points are never user-reported.** Every credit either comes from a verified Stripe webhook, staff confirmation, or a sensor-verified action (geofence + timestamp).
