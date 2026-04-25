# 🚀 Luna Group VIP — App Store Submission Runbook

**Current status:** Everything in the repo is submission-ready. The only thing I can't automate for you is the Expo account login + `eas build` trigger — those require your credentials.

## Pre-flight checklist ✅

- [x] `ios.bundleIdentifier` = `com.lunagroup.app`
- [x] `projectId` = `70fc7d51-2dd0-447d-b040-8cba149152a6`
- [x] `version` = `1.0.0`, `buildNumber` = `1`
- [x] Icon 1024×1024 RGB at `assets/images/icon.png`
- [x] Splash video + image wired
- [x] 18 Info.plist usage descriptions (camera, location, photos, contacts, FaceID, etc.)
- [x] APNs `aps-environment: production` entitlement
- [x] `eas.json` has your Apple Team ID `BZRA747G9M`, ASC API Key `WGLASK4H5W`
- [x] `.p8` key present at `/app/secrets/AuthKey_WGLASK4H5W.p8`
- [x] `expo-camera@17.0.10` (SDK 54 compatible)
- [x] Privacy Policy + Terms pages at `/public-site/privacy/` + `/public-site/terms/`
- [x] App Store copy at `/app/APP_STORE_LISTING.md`
- [x] 18+ DOB gate enforced server-side (`POST /api/auth/register`)
- [x] All Stripe subscriptions go through external Safari (Reader App exception)

## ⚠️ ONE CRITICAL BLOCKER YOU MUST DECIDE ON

**`EXPO_PUBLIC_BACKEND_URL` is currently set to `https://luna-mobile-stage.preview.emergentagent.com`** — this is the Emergent **preview** environment. A production iOS app CANNOT ship pointing at a preview URL because:

1. Preview URLs can be recycled/shut down
2. Apple reviewers will reject if the backend becomes unreachable
3. You have no SLA on preview infrastructure

### You need to pick one of these 2 paths:

**Option A (recommended) — Deploy the backend to Emergent Native Deployment**
- Go to the Emergent dashboard → "Deploy" → you'll get a stable URL like `https://luna-api.emergent.host`
- Update `/app/frontend/.env` → `EXPO_PUBLIC_BACKEND_URL=https://luna-api.emergent.host`
- Rebuild the app

**Option B — Deploy backend to your own infrastructure**
- Deploy FastAPI to Vercel/Railway/Fly.io/AWS/etc. at `api.lunagroup.com.au`
- Update env var, rebuild

**Without fixing this, your App Store app will hit a preview URL that could break at any time.** Say the word and I'll invoke the deployment agent.

---

## The actual submission steps (on your Mac or from this container once you're logged in)

### Step 1 — Create App in App Store Connect (one-time, ~5 min)
1. Log in to https://appstoreconnect.apple.com
2. **My Apps → "+" → New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Luna Group VIP
   - **Primary Language:** English (Australia)
   - **Bundle ID:** `com.lunagroup.app` (pick from dropdown — if not there, go to Developer Portal first and register it)
   - **SKU:** `luna-vip-001`
   - **User Access:** Full Access
4. Click Create. You now have an empty app record.

### Step 2 — Fill in the listing copy (one-time, ~10 min)
Open `/app/APP_STORE_LISTING.md` and copy-paste into the App Store Connect fields:
- **App Information → Name / Subtitle / Privacy Policy URL / Category**
- **Pricing and Availability → Free**
- **App Privacy → Data Collection** (use the Privacy Nutrition Label section verbatim)
- **Version 1.0 → Description, Keywords, Promotional Text, Support URL, Marketing URL, What's New**
- **Age Rating → 17+** (triggers: frequent alcohol references)
- **App Review Information → Demo account: `luna@test.com` / `test123`**

### Step 3 — Log into Expo (one-time)
```bash
cd /app/frontend
npx expo login        # your Expo username + password
# OR, for CI: export EXPO_TOKEN=...your-token...
```

### Step 4 — Build & submit (the magic command)
```bash
cd /app/frontend

# Triggers a cloud build on EAS servers (~15-20 min)
npx eas build --platform ios --profile production

# When the build succeeds, submit it to App Store Connect automatically:
npx eas submit --platform ios --latest
```

The `submit` command reads your `eas.json` and uses the `.p8` key at `/app/secrets/` to push the build to App Store Connect with zero manual steps.

### Step 5 — Screenshots (you need a device or simulator)
- Open the app on a real iPhone 16 Pro Max, OR Xcode → Simulator → iPhone 16 Pro Max
- Capture 6 shots listed in `APP_STORE_LISTING.md` Section 4
- Upload under App Store Connect → Version 1.0 → iPhone 6.9"

### Step 6 — Hit "Submit for Review"
- App Store Connect → Version 1.0 → top right → Submit for Review
- Answer the IDFA / export compliance questions (both `No`)
- Apple review takes 24-72 hours typically

---

## If Apple rejects

See Section 9 of `/app/APP_STORE_LISTING.md` — I've pre-written defence templates for the 3 most likely rejection reasons (minimum functionality, external payments, age rating).

---

## Tell me what to do next

Reply with one of:
- **"Deploy the backend first"** → I'll invoke the deployment agent to push the FastAPI backend to Emergent's native deployment and update `EXPO_PUBLIC_BACKEND_URL`
- **"Backend is already at X URL"** → Tell me the production URL and I'll update the env
- **"I'll handle the backend separately; just build"** → I'll commit the repo in a submission-ready state and give you the exact local commands to run on your Mac
