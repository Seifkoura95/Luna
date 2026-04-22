# Luna Group — App Store Submission Kit

All copy below is copy-paste-ready for App Store Connect. Save a backup of this file — you'll paste most of these into fields on appstoreconnect.apple.com under your app → **App Information** / **1.0 Prepare for Submission**.

---

## 1. App Information

| Field | Value |
|---|---|
| **App Name** (30 chars max) | `Luna Group` |
| **Subtitle** (30 chars max) | `VIP Booths, Points & Rewards` |
| **Primary Category** | Entertainment |
| **Secondary Category** | Lifestyle |
| **Bundle ID** | `com.lunagroup.app` |
| **SKU** | `lunagroup-ios-001` |
| **Primary Language** | English (Australia) |
| **Age Rating** | 17+ (alcohol references, mature nightlife content — answer Apple's rating questionnaire honestly: "Infrequent/Mild Alcohol, Tobacco, or Drug Use or References" = **Frequent/Intense**; all other categories = None) |

---

## 2. Pricing & Availability

| Field | Value |
|---|---|
| **Price** | Free |
| **Availability** | Australia only (v1) — expand to NZ later |
| **Pre-Orders** | No |

---

## 3. Promotional Text (170 chars — editable after release without re-review)

> 🎉 NEW: Birthday rewards, auctions on VIP booths, and up to 2x points this month. Book, earn, and unlock perks across every Luna Group venue.

---

## 4. Description (4000 chars max)

```
Luna Group is your all-access pass to Brisbane and Gold Coast's most iconic nightlife venues.

From walking through the door to the last drink of the night, every moment earns you points, unlocks perks and pulls you closer to free VIP booths, premium champagne and exclusive events.

⚡ EARN POINTS ON EVERYTHING
Check in at any Luna Group venue, buy tickets to events, book a booth or order from the bar. Every dollar spent and every visit clocks points toward your next reward — automatically.

🏆 REWARDS THAT ACTUALLY FEEL VIP
Redeem points for complimentary cocktails, skip-the-line entry, private booth upgrades, bottle service and limited-edition experiences. Your wallet holds everything as scannable QR codes — just show staff at the door or bar.

🔥 LIVE AUCTIONS
Bid against other VIPs in real time on booths, bottle service, suites and once-in-a-lifetime experiences. Watch the timer, get outbid, auto-bid up to your max — if it ends with your name on top, collection details are in your inbox before you leave the app.

🎂 BIRTHDAY CLUB
Your birthday week unlocks special rewards every year — premium cocktails, free entry upgrades and points multipliers. Because you deserve to be celebrated.

📅 FIND EVENTS FAST
All Luna Group events in one feed — concerts, DJ sets, themed nights, private parties. Filter by venue, date or vibe. Book tickets in-app and they're added to your wallet instantly.

🍾 EXPLORE VENUES
Every Luna Group location with opening hours, dress code, directions, booking links and photos. Know before you go.

🎁 REFER FRIENDS
Invite your crew. When they sign up and check in for the first time, you both score bonus points.

🔐 SECURE AND PRIVATE
Your account is protected by modern encryption. Face ID/Touch ID unlocks the app. We never sell your data — ever.

Download Luna Group and start earning rewards tonight. Your next free booth might only be a few points away.

---
Luna Group covers these venues:
• Eclipse Nightclub — Brisbane
• Luna Rooftop — Gold Coast
• Moonlight Lounge — Fortitude Valley
• Solara Day Club — Surfers Paradise
• Bar Belle — Brisbane CBD
(and more coming soon)

Questions or support? Email hello@lunagroupapp.com.au
```

---

## 5. Keywords (100 chars max, comma-separated, no spaces after commas)

```
nightlife,vip,rewards,nightclub,brisbane,gold coast,booth,bottle service,bar,auctions,loyalty,events
```

**Keyword strategy notes:**
- "nightlife" + "vip" = intent-heavy
- "brisbane" + "gold coast" = geo targeting
- "auctions" = unique wedge vs generic loyalty apps
- Avoid trademarks like "Hospoz" / competitor names (Apple rejects)

---

## 6. Support & Marketing URLs

| Field | URL |
|---|---|
| **Support URL** (required) | `https://lunagroupapp.com.au/support` |
| **Marketing URL** (optional) | `https://lunagroupapp.com.au` |
| **Privacy Policy URL** (required) | `https://lunagroupapp.com.au/privacy` |

⚠️ **All three URLs MUST be live and reachable when you submit.** Apple's reviewer clicks them. A 404 = automatic rejection.

---

## 7. App Review Information (what the reviewer sees)

| Field | Value |
|---|---|
| **First Name** | Trent |
| **Last Name** | [Your Last Name] |
| **Phone** | [Your AU number in +61...] |
| **Email** | hello@lunagroupapp.com.au |
| **Demo Account Username** | `luna@test.com` |
| **Demo Account Password** | `test123` |
| **Notes for Reviewer** | See below 👇 |

### 📝 Notes for Reviewer (paste this verbatim)

```
Thank you for reviewing Luna Group.

DEMO ACCOUNT:
Email: luna@test.com
Password: test123

This account is pre-loaded with ~20,000 points, active reward redemptions in the wallet, and "Supernova" tier status so you can fully explore the VIP features, auction bidding, birthday rewards and staff QR scanning flow.

BACKGROUND LOCATION:
We request background location to enable automatic venue check-ins when a user arrives at a Luna Group venue (geo-fenced around each physical address). This powers entry rewards and points accrual. Location is never shared with third parties or used for advertising.

CAMERA:
The camera is used exclusively to scan reward/entry QR codes in the Staff Portal flow and to scan the user's own wallet QR when they choose.

USER TRACKING (ATT):
We request App Tracking Transparency permission only to measure marketing campaign attribution (e.g., which Instagram ad drove a signup). If the user declines, full app functionality is preserved — no features are gated.

CONTACTS:
Contacts access is ONLY requested when the user taps the "Invite Friends" button. It is not requested on launch.

AUCTIONS:
The in-app auction feature is NOT real-money gambling. Users bid with in-app points they have already earned from check-ins/purchases, OR with fiat via our secure Stripe flow. Prizes are tangible experiences (VIP booths, bottle service) fulfilled by Luna Group venues directly. No winnings are paid out in cash.

HOW TO TEST KEY FLOWS:
1. Sign in with the demo account.
2. Tap "Birthday" tab → claim a reward (demo account has birthday this week).
3. Tap "Auctions" tab → place a bid on any active auction.
4. Tap "Wallet" tab → view the redeemable QR codes.
5. Sign out. Sign in as venue@eclipse.com / venue123 to view the Staff Portal → Validate Reward flow.

Support contact during review: hello@lunagroupapp.com.au (replies within 4 business hours).
```

---

## 8. Version Release (first version: 1.0)

| Field | Value |
|---|---|
| **What's New in This Version** | *(leave blank or use):* "Welcome to Luna Group — your VIP pass to Brisbane and Gold Coast nightlife. Earn points, unlock rewards, bid on booths." |
| **Release Type** | Automatically release after approval (recommended) OR Manually release |
| **Phased Release for Automatic Updates** | ✅ **ENABLE** (rolls out over 7 days — catches any v1 production crashes before 100% of users hit them) |

---

## 9. App Privacy (Privacy Q&A on App Store Connect)

Answer these honestly — lying about data collection gets the app pulled.

### Data We Collect
| Data | Collected? | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info – Name** | ✅ Yes | ✅ Yes | ❌ No | App Functionality, Analytics |
| **Contact Info – Email Address** | ✅ Yes | ✅ Yes | ❌ No | App Functionality, Customer Support |
| **Contact Info – Phone Number** (if you wire Twilio) | ✅ Yes | ✅ Yes | ❌ No | App Functionality |
| **Financial Info – Payment Info** (Stripe) | ✅ Yes | ✅ Yes | ❌ No | App Functionality (Stripe handles PCI) |
| **Location – Precise Location** | ✅ Yes | ✅ Yes | ❌ No | App Functionality (check-in geo-fence) |
| **Identifiers – User ID** | ✅ Yes | ✅ Yes | ❌ No | App Functionality |
| **Identifiers – Device ID (IDFA)** | ✅ Yes (if ATT approved) | ✅ Yes | ✅ Yes | Third-Party Advertising |
| **Usage Data – Product Interaction** | ✅ Yes | ✅ Yes | ❌ No | Analytics, Product Improvement |
| **Diagnostics – Crash Data** | ✅ Yes | ❌ No | ❌ No | Analytics |
| **Purchases – Purchase History** | ✅ Yes | ✅ Yes | ❌ No | App Functionality |
| **Contacts** | ❌ No (we read at point-of-use for invites, never stored) | — | — | — |

---

## 10. Screenshots Required

Apple requires screenshots for these sizes (minimum 3 per size, maximum 10):

| Device | Resolution | Required? |
|---|---|---|
| **6.7″ iPhone** (14/15/16 Pro Max) | 1290 × 2796 | ✅ REQUIRED |
| **6.5″ iPhone** (14/15 Plus) | 1284 × 2778 | ✅ REQUIRED |
| **5.5″ iPhone** (8 Plus — legacy) | 1242 × 2208 | ⚪ Optional, boosts older-device visibility |
| **iPad 12.9″** | 2048 × 2732 | ⚪ Only if your Expo app supports iPad |

**Recommended screenshot sequence (tells the story top-to-bottom):**
1. **Home feed / points balance** — hero shot with user name + gold points balance
2. **Live auction** — show the countdown + current bid + "PLACE BID" CTA
3. **Wallet with QR code** — proves reward is tangible/scannable
4. **Birthday reward** — the birthday week banner + reward cards
5. **Venue detail** — Eclipse/Luna Rooftop photo with "Book a Booth" button
6. **Staff portal** (optional) — shows the B2B side for venue owners

Use [shotsnapp.com](https://shotsnapp.com) or Figma with Apple's device frames to add branded text overlays ("Earn points on every visit", "Outbid? Auto-bid to win") — increases App Store conversion by 20-35%.

---

## 11. App Icon

| Requirement | Value |
|---|---|
| **Size** | 1024 × 1024 px |
| **Format** | PNG |
| **Transparency** | ❌ No alpha channel (flat PNG only) |
| **Rounded Corners** | ❌ NO — Apple rounds them automatically |
| **Source** | Export from `/app/frontend/assets/images/icon.png` (already 1024×1024) |

Double-check by opening the icon in Preview and running:
```bash
sips -g hasAlpha /app/frontend/assets/images/icon.png
# Should output: hasAlpha: no
```

---

## 12. Pre-Submission Self-Audit Checklist

Run through this 30 min before hitting "Submit for Review":

- [ ] `lunagroupapp.com.au/privacy` returns 200 with a real privacy policy (not "Coming Soon")
- [ ] `lunagroupapp.com.au/support` returns 200 with a real contact form or email
- [ ] Demo account `luna@test.com` / `test123` logs in successfully on the LATEST production build
- [ ] Demo account has at least 1 active auction bid, 1 wallet reward, and "Birthday Week = true" configured so reviewer sees the full flow
- [ ] Screenshots match the CURRENT UI (not an old version)
- [ ] App Icon has no alpha channel
- [ ] Build does not crash on launch in Airplane Mode (reviewer tests this)
- [ ] Background location prompt appears with clear reason (our Info.plist is already correct)
- [ ] ATT prompt only shows once, with a clear reason — OR we remove it entirely if we don't actually track
- [ ] `apple-app-site-association` is live at `https://lunagroupapp.com.au/.well-known/apple-app-site-association` (for Universal Links)

---

## 13. Common Rejection Triggers (and how we've addressed them)

| Trigger | Status | Notes |
|---|---|---|
| **Guideline 5.1.1 – Data Collection and Storage** | ✅ Handled | Privacy Q&A above, Privacy Policy URL |
| **Guideline 4.3 – Spam / Duplicates** | ✅ OK | Unique brand + functionality |
| **Guideline 2.1 – App Completeness** | ⚠️ Risk | Make sure no "Coming Soon" screens or broken buttons ship in v1. Remove placeholder tabs. |
| **Guideline 2.3.1 – Misleading Screenshots** | ✅ Handled | Screenshots must be real app UI, no fake stats |
| **Guideline 5.3.5 – Contests / Gambling** | ⚠️ Risk | We call this out in Review Notes (auctions are point-based rewards, not gambling) |
| **Guideline 1.1.6 – False Information** | ✅ Handled | Review Notes are accurate |
| **Guideline 3.2.2 – Unacceptable** | ✅ OK | No cryptocurrency, no pyramid schemes |
| **Alcohol references** | ✅ Handled | 17+ rating selected |
| **Background location without clear justification** | ✅ Handled | Review Notes explicitly explain the geo-fence check-in use case |

---

## 14. After Submission — Expected Timeline

| Stage | Duration |
|---|---|
| Waiting for Review | 1–24 hours |
| In Review | ~24 hours (can be faster if reviewer hits it quickly) |
| Approved → Live | Instant (if auto-release) or manual click |
| Phased Release | 7 days (1% → 100%) |

If rejected, you'll get a message in App Store Connect under "Resolution Center." Reply there directly — Apple reviewers are responsive and a well-written reply often flips a rejection.

---

## 15. Ongoing — Post-Launch Ops

Create a recurring calendar reminder for these:

- **Weekly:** Check App Store Connect → Analytics for crash rate + conversion. If crash rate > 1%, investigate.
- **Monthly:** Review user ratings. Respond to 1-star reviews publicly (with empathy) — it materially improves store rating.
- **Per Version:** Update "What's New" with actual user-facing changes, not engineering jargon.
- **Every 6 months:** Re-check Privacy Policy is still accurate (new features = new data types).

---

## 🎯 Ready? Here's the command:

```bash
cd /app/frontend
eas submit --platform ios --profile production --latest
```

Fill out the metadata above in App Store Connect while the binary uploads (~15 min).
