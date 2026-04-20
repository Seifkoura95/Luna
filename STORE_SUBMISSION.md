# Luna Group — App Store & Play Store Submission Guide

_Last updated: April 2026_

This document tracks every requirement for a clean first-pass approval on the Apple App Store and Google Play Store.

## ✅ Phase A — HARD BLOCKERS (DONE)

### Assets
- [x] `splash-icon.png` asset restored (was missing)
- [x] 1024×1024 `icon.png` present
- [x] Android adaptive icon configured

### iOS Info.plist (all 9 permissions + background modes)
All strings are now user-facing, concrete, non-generic — Apple will accept these:
- [x] `NSCameraUsageDescription`
- [x] `NSPhotoLibraryUsageDescription`
- [x] `NSPhotoLibraryAddUsageDescription`
- [x] `NSLocationWhenInUseUsageDescription`
- [x] `NSLocationAlwaysAndWhenInUseUsageDescription` ← **was missing; used for background geofencing**
- [x] `NSLocationAlwaysUsageDescription` (iOS <11 fallback)
- [x] `NSContactsUsageDescription`
- [x] `NSFaceIDUsageDescription`
- [x] `NSMicrophoneUsageDescription` ← required even if unused
- [x] `NSUserTrackingUsageDescription`
- [x] `NSCalendarsUsageDescription`
- [x] `ITSAppUsesNonExemptEncryption = false` ← skips 24h export review
- [x] `UIBackgroundModes = [location, fetch, remote-notification]`
- [x] `associatedDomains = applinks:lunagroup.com.au` (deep-link ready)
- [x] `aps-environment = production` entitlement

### Android
- [x] Deprecated `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` **blocked**
- [x] Modern `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` (Android 13+)
- [x] `POST_NOTIFICATIONS` (Android 13+ push)
- [x] `ACCESS_BACKGROUND_LOCATION` declared
- [x] `FOREGROUND_SERVICE_LOCATION` declared
- [x] `versionCode: 1`

### Expo Plugins
- [x] `expo-location` with background + foreground strings
- [x] `expo-notifications` with icon + brand color `#D4A832`
- [x] `expo-image-picker` with proper photo/camera strings
- [x] `expo-splash-screen` keeps existing config
- [x] `expo-router`, `@react-native-community/datetimepicker`

### Account Deletion (Apple mandatory)
- [x] Backend `DELETE /api/auth/account` — soft-delete + email anonymization (tested via curl ✅ returns `{success: true}`)
- [x] Frontend UI at `/settings` — two-step confirmation with `showDeleteConfirm` guard + `deleteStep: 1 → 2` pattern
- [x] API client `api.deleteAccount()` wired

### Versioning
- [x] `version: 1.0.0`, `iOS.buildNumber: 1`, `android.versionCode: 1`

---

## 🟡 Phase B — USER-PROVIDED (waiting on Trent)

### Live web URLs needed (cannot submit without)
- [ ] **Privacy Policy** public `https://` URL (content exists in-app at `/privacy-policy` — just needs hosting)
- [ ] **Terms of Service** public `https://` URL
- [ ] **Support** email or page (e.g. `support@lunagroup.com.au`)

### Brand assets
- [ ] Luna-branded **1024×1024 app icon** (current generic icon will likely be rejected by Apple)
- [ ] Luna-branded **splash icon** (current is reused `splash-image.png`)
- [ ] iOS screenshots: 6.5" iPhone (1284×2778) × 3-5 shots minimum
- [ ] Android screenshots: phone (1080×1920) × 2-8 shots
- [ ] Feature graphic for Play Store: 1024×500 PNG

### Monetization decision (critical for Apple approval)
- [ ] Decide Luna+ subscription path:
  - (a) Stripe with appeal letter
  - (b) Apple IAP iOS-only, Stripe Android
  - (c) Free subscriptions only
  - (d) iOS submission delay, Android first
- Bottle-service deposits ARE approved for Stripe (physical goods consumed offline)

### Developer accounts
- [ ] Apple Developer Program enrollment ($99/year, 24-48h approval if not already)
- [ ] Google Play Console ($25 one-time)
- [ ] Either provide App Store Connect API key (.p8 + Key ID + Issuer ID) for CI/CD, or authorize EAS browser-login flow

---

## 🔵 Phase C — Store listing copy (I'll draft when B unblocks)

### Apple App Store
- **App Name** (max 30): suggested `Luna Group: Brisbane Nightlife`
- **Subtitle** (max 30): `Eclipse, Kenjin, VIP bottles & more`
- **Keywords** (100 chars max): `nightlife,brisbane,club,eclipse,venue,vip,bottle,event,rsvp,rewards`
- **Primary category**: Entertainment
- **Secondary category**: Lifestyle
- **Age rating**: 17+ (alcohol, nightlife, social features)
- **Promotional text**: changes per update
- **Description** (4000 chars): will draft

### Google Play
- **Short description** (80 chars)
- **Full description** (4000 chars): will draft
- **Content rating**: fill IARC questionnaire — will answer Yes to Alcohol References → Mature 17+

---

## 🟣 Phase D — Privacy Nutrition Labels (Apple) / Data Safety (Google)

Pre-filled answers based on what Luna collects:

### Data collected & linked to user
- Name, Email, Phone, DOB
- Location (precise, for check-in + geofence)
- Photos (only when user uploads)
- Purchase history (Stripe transaction IDs)
- Device identifiers (Expo push token)
- Usage data (event views, check-ins — used for personalization)

### Data NOT collected
- Health data
- Financial info (Stripe holds cards, not Luna)
- Contacts (we read to display, never upload)
- Browsing history
- Search history

### Data shared with third parties
- Stripe (payments)
- Apple Push / Google FCM (notifications)
- EventFinda (event data, one-way from them to us)
- OpenAI / Anthropic (chat & recommendations — user-initiated)

---

## 🟢 Pre-submission checklist

Before clicking "Submit for Review":

1. [x] All test accounts in Lovable admin deleted
2. [x] Seed data reviewed (no fake emails, real venue data)
3. [ ] Sentry/Bugsnag or EAS crash monitoring enabled — recommended
4. [ ] Build tested on physical iPhone + physical Android device (TestFlight first)
5. [ ] All 3rd-party keys in `backend/.env` are PRODUCTION (not test)
6. [ ] `google-service-account.json` via `GOOGLE_SERVICE_ACCOUNT_JSON` env var (not committed) ✓ already done
7. [ ] `build --profile production --platform ios` locally works once
8. [ ] Test critical user flows on TestFlight build:
   - Register → Verify email → Login
   - Browse venues
   - Reserve table (JuJu/Night Market)
   - Buy bottle service (Eclipse, Stripe $50 deposit)
   - Subscribe to Luna+ (once monetization decided)
   - Check in at venue (location permission → geofence)
   - Receive push notification
   - Delete account

---

## 🚀 EAS Build Commands (after Phase B/C done)

```bash
# From /app/frontend
npx eas login
npx eas build:configure

# iOS production build
npx eas build --platform ios --profile production

# Android production build
npx eas build --platform android --profile production

# Submit to stores (after first successful build)
npx eas submit --platform ios --latest
npx eas submit --platform android --latest
```

Typical timeline:
- EAS build: 15-25 min
- TestFlight availability: 1-2h after upload
- Apple review: 24-48h average, up to 7 days worst case
- Google Play review: 2-7 days for first app, <24h for subsequent
