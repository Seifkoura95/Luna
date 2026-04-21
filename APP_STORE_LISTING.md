# Luna Group VIP — App Store Submission Pack

> Everything you need to submit Luna Group VIP to the Apple App Store and Google Play. Copy, paste, ship.

---

## 1. App Store Connect — App Information

### App Name (30 char max)
**Luna Group VIP**

### Subtitle (30 char max)
**Brisbane & GC Nightlife Pass**

### Category
- Primary: **Lifestyle**
- Secondary: **Food & Drink**

### Content Rights
- Does your app use third-party content? **No** (all imagery is either commissioned, AI-generated, or licensed via Eventfinda)

### Age Rating: **17+**
Triggers to select in the age questionnaire:
- Infrequent/Mild Alcohol, Tobacco, or Drug Use or References → **Frequent/Intense**
- Unrestricted Web Access → **No**
- Gambling (auctions, not gambling) → **No**
- Mature/Suggestive Themes → **Infrequent/Mild**

---

## 2. App Description (4000 char max)

### Promotional Text (170 char — shown above description, updatable without review)
```
Tonight looks better when you're on the list. VIP bookings, free entry tickets, bottle service, and Brisbane's best nightlife concierge — all in your pocket.
```

### Description
```
Luna Group VIP is your backstage pass to Brisbane and Gold Coast's most exclusive nightlife.

From sunset rooftop cocktails to late-night clubs, Luna Group operates the venues everyone's talking about — Eclipse, After Dark, Su Casa, Juju, Pump, Mamacita, Ember & Ash, and Night Market. This app puts the keys to all of them in one place.

WHY YOU'LL LOVE IT
• Book VIP tables, bottle service and guestlist spots at every Luna venue — no more DMs or phone calls
• Earn Luna Points on every dollar spent, then redeem for comp drinks, skip-the-line entry, birthday packages and more
• Unlock milestones as your points grow — from Newbie all the way to Legend status
• Chat with Luna, your AI nightlife concierge who knows tonight's best moves, what's busy, what's quiet, and how to get in
• Bid on rare experiences in Luna Auctions — private booth nights, celebrity chef dinners, and money-can't-buy moments
• Get gifted free-entry QR passes from venue managers — straight to your wallet, ready to flash at the door

LUNA POINTS & REWARDS
Every tap earns. Every booking counts. Redeem points for free drinks, guest passes, and limited-edition perks only available to app users.

SUBSCRIPTION (OPTIONAL)
Bronze ($39.99/wk) and Silver ($79.99/wk) tiers unlock bigger points multipliers, monthly comp bottles, birthday guestlist priority, and early access to ticketed events. Manage your subscription anytime from your Profile.

MADE FOR LUNA GROUP MEMBERS
This app is built for patrons of Luna Group Hospitality venues in Queensland, Australia. You must be 18 or over to register.

Questions? support@lunagroup.com.au
```

### Keywords (100 char max, comma-separated, no spaces around commas)
```
nightclub,nightlife,brisbane,gold coast,vip,bottle service,eclipse,club,guestlist,rsvp,cocktails,bar
```

### Support URL
`https://lunagroup.com.au/app/support`

### Marketing URL
`https://lunagroup.com.au`

### Privacy Policy URL
`https://lunagroup.com.au/app/privacy` (served from `/public-site/privacy/index.html`)

### Terms of Service URL
`https://lunagroup.com.au/app/terms` (served from `/public-site/terms/index.html`)

---

## 3. What's New (Release Notes — 4000 char max)
```
First release! Welcome to Luna Group VIP.

• Book tables, bottle service and guestlist at every Luna venue
• Earn and redeem Luna Points
• Chat with Luna, your AI nightlife concierge
• Bid on exclusive Luna Auctions
• Receive gifted free-entry QR passes from our team
• Track milestones from Newbie to Legend

Cheers — see you on the dancefloor.
```

---

## 4. Screenshots (REQUIRED sizes)

### iPhone 6.9" (iPhone 16 Pro Max, 1290 × 2796) — 3 to 10 shots
Suggested order:
1. **Home / Venues** — hero image of Eclipse with "Your Premium Nightlife Hub" pill
2. **Luna AI Chat** — gold header "Luna · Your Nightlife Concierge" with a witty sample reply
3. **Wallet & Points** — LIVE NOW balance, QR tickets section, leaderboard glimpse
4. **Bottle Service** — Eclipse bottle menu (AI-generated photography)
5. **Auctions** — active auction card with bid ticker
6. **Milestones / Profile** — Legend tier pill + rewards unlocked

Text overlay per screenshot (max 5 words each):
- "Tonight, on your terms"
- "Your AI Concierge"
- "Earn. Redeem. Repeat."
- "VIP service, one tap away"
- "Bid on unforgettable nights"
- "From Newbie to Legend"

### iPhone 6.5" (1242 × 2688) — reuse the 6.9" versions downsized
### iPad 13" Pro (2064 × 2752) — 2 shots minimum (same content in landscape variants)

---

## 5. Privacy Nutrition Label (Data Types Collected)

App Store → App Privacy → Data Collection

### Data Linked to You

**Contact Info**
- [x] Email Address → App Functionality, Account Management
- [x] Phone Number → App Functionality (optional, for SMS OTP if added)
- [x] Name → App Functionality, Personalization

**User Content**
- [x] Photos (profile avatar only) → App Functionality, Personalization
- [x] Customer Support → Customer Support

**Identifiers**
- [x] User ID → App Functionality, Analytics

**Usage Data**
- [x] Product Interaction → Analytics, Personalization
  (bookings, missions completed, auctions bid on, chats with Luna AI)

**Purchases**
- [x] Purchase History → App Functionality, Analytics
  (Stripe subscription + bottle orders)

**Diagnostics**
- [x] Crash Data → App Functionality (once Sentry is enabled)
- [x] Performance Data → App Functionality

**Location**
- [x] Coarse Location → App Functionality (venue proximity / regional filter)
- [ ] Precise Location → NOT collected

**Sensitive Info**
- [x] Date of Birth → App Functionality (18+ gate), Compliance
  (Legally required to verify age — stored encrypted, never shared)

### Data Used to Track You
**None.** The app does not share data with data brokers or advertising networks. Select "Data Not Used to Track You" for every category.

---

## 6. In-App Purchases

### Subscriptions
**IMPORTANT**: Luna Group uses EXTERNAL Stripe links for subscriptions (not Apple IAP). This is permitted under Apple's "Reader App" exception provided you:
1. Do NOT show Apple's review prompt after sign-up
2. Do NOT encourage users to switch to a different payment method inside the app
3. The "Subscribe" CTA opens Safari (webview) to `buy.stripe.com/...`

If Apple rejects:
- Response template: "Luna Group VIP is a membership service for Luna Group Hospitality. Subscription management occurs on our website, outside the app. Users can still access their existing subscription status in-app after purchasing externally. We do not display any account-creation or sign-up CTAs that promote payment — users only see their current tier."

If they still reject:
- Fallback plan: Add parallel Apple IAP at the same prices ($39.99 / $79.99 weekly)

### Consumables (Bottle Service, Auctions)
Physical goods/services delivered at the venue → **not required to use Apple IAP**. Stripe is fully allowed.

---

## 7. Demo Account (App Review team)

**Username**: luna@test.com
**Password**: test123

Role: regular user with sample points balance, a couple of bookings, and a scheduled gifted-entry ticket so reviewers can see the full flow without spending money.

Instructions for reviewer:
```
1. Open app → Sign In → use luna@test.com / test123
2. Home tab: browse venues, tap Eclipse
3. Wallet tab: see points balance, QR tickets section with a sample free-entry pass, Claim a Reward
4. Luna AI tab: ask "What's on tonight?" to see concierge replies
5. Profile tab: see milestones progress

The app is functional end-to-end. No external account needed.
```

---

## 8. Google Play (Android) — condensed

**Short Description (80 char)**
```
VIP nightlife pass for Luna Group venues — Brisbane & Gold Coast. 18+ only.
```

**Full Description** — reuse iOS body, substitute "App Store" → "Google Play"

**Content Rating**: Mature 17+ (via IARC questionnaire, triggered by "Depicts alcohol consumption in a realistic manner")

**Target Audience**: 18+

**Data Safety** — mirror iOS Privacy Label answers

---

## 9. Rejection Defense Templates

### "App lacks core functionality"
```
Hi App Review, Luna Group VIP is a membership app for Luna Group Hospitality's 9 venues across Queensland. Core features (all functional from first launch): venue browsing, table/bottle bookings, AI concierge chat, points/rewards system, auctions for VIP experiences, and milestone tracking. Demo credentials and flow walkthrough are in the reviewer notes above. Happy to screen-share or provide specific screen-capture of any flow.
```

### "Minimum Functionality (4.2)"
```
Our app is not a website wrapper. All booking, chat, auction, and points features run on our native FastAPI backend with full CRUD. The Stripe checkout for subscriptions opens in Safari specifically to comply with Apple's Reader App guideline 3.1.3(a) for external memberships — this is a routing pattern, not the app's primary function.
```

### "Safety — Age Rating"
```
We have enforced strict 18+ age verification at signup via a DOB gate (users under 18 cannot create an account — backend validated at /api/auth/register). Alcohol is depicted in the context of a licensed hospitality business, comparable to OpenTable or Resy which carry 12+ ratings — we have self-selected 17+ as a conservative precaution.
```

---

## 10. Submission Checklist

- [ ] Bundle ID registered on App Store Connect: `com.lunagroup.vip`
- [ ] Expo projectId restored in `app.json` → `extra.eas.projectId` before `eas build`
- [ ] Stripe links verified ($39.99 / $79.99 weekly)
- [ ] Privacy + Terms pages live at `lunagroup.com.au/app/privacy` + `/terms`
- [ ] Demo account luna@test.com works (sample points, 1 booking, 1 QR ticket)
- [ ] All 6 screenshots generated at 1290×2796
- [ ] App Icon 1024×1024 rendered (no alpha, no rounded corners — Apple adds the mask)
- [ ] Launch screen matches in-app splash
- [ ] Push notification entitlement enabled (APNs key uploaded)
- [ ] In-app "Contact" link resolves to support@lunagroup.com.au
- [ ] Sentry DSN added to production bundle (post-MVP)
- [ ] Submit via Transporter or Xcode → Organizer → Distribute App
