# Luna Group — Public Site (lunagroupapp.com.au)

Static HTML files for the marketing site + Apple-compliant subscription portal.

## Structure
```
public-site/
├── index.html                # Landing page
├── subscribe/index.html      # 3 Luna+ tiers with Stripe Payment Links
├── how-points-work/index.html # Rewards program explainer
├── privacy/                  # (TODO: add Privacy Policy HTML)
├── terms/                    # (TODO: add Terms of Service HTML)
└── favicon.png               # Luna icon
```

## Before going live — REQUIRED

### 1. Create 2 Stripe Payment Links
In your Stripe Dashboard → **Payment Links** → **New**:

**Silver tier:**
- Product name: `Luna+ Silver Subscription`
- Price: `$29.00 AUD` — recurring monthly
- Success URL: `https://lunagroupapp.com.au/subscribe/success?tier=silver`
- Copy the resulting URL (starts with `https://buy.stripe.com/...`)

**Gold tier:**
- Product name: `Luna+ Gold Subscription`
- Price: `$79.00 AUD` — recurring monthly
- Success URL: `https://lunagroupapp.com.au/subscribe/success?tier=gold`

### 2. Paste the URLs into `subscribe/index.html`
Find and replace:
- `PASTE_STRIPE_PAYMENT_LINK_SILVER_HERE` → your Silver payment link URL
- `PASTE_STRIPE_PAYMENT_LINK_GOLD_HERE` → your Gold payment link URL

### 3. Host it
Options (all free or cheap):
- **Cloudflare Pages** (recommended): push this `public-site/` folder to a GitHub repo, connect to Cloudflare, auto-deploys to `lunagroupapp.com.au`
- **Netlify**: drag & drop this folder into Netlify dashboard
- **Vercel**: `vercel --prod` from this folder
- **Your own server**: upload via SFTP to any Apache/nginx static host

### 4. Point your domain
In your registrar's DNS panel, add:
- `A` record for `lunagroupapp.com.au` → your host's IP
- OR `CNAME` for `www` → your Cloudflare/Netlify/Vercel address

### 5. Test
- Visit `https://lunagroupapp.com.au` → landing loads
- Click "Join Luna+" → 3 tiers visible
- Click "SUBSCRIBE — $29/MO" → redirects to Stripe Checkout
- Complete test payment → Stripe webhook fires → user subscription activated

## Stripe webhook → backend
Your backend (`/app/backend/routes/webhook.py`) already handles `checkout.session.completed` for `package_type: "subscription"`. In Stripe Dashboard → Developers → Webhooks → make sure you have an endpoint pointing at:
```
https://api.lunagroupapp.com.au/api/webhooks/stripe
```
Events to send: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

## Why subscriptions are web-only (not in-app)
Apple requires all **digital subscriptions** to use Apple IAP with a 30% cut. By keeping Luna+ subscriptions on the web — accessed via "Subscribe" button in the app that opens a browser tab — we use Apple's "reader app" exception and keep 100% of revenue. Free tier and bottle service deposits remain in-app (they're physical goods consumed at the venue, which is allowed).
