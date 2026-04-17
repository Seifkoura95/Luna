# SwiftPOS Integration Guide for Luna Group
## Complete Setup & Deployment Instructions

---

## What You Need From Your SwiftPOS Reseller

Contact your SwiftPOS reseller and request the following:

### 1. Cloud Client ID
- **What**: Your unique SwiftPOS cloud tenant identifier
- **Where to get**: SwiftPOS reseller provisions this when setting up your account
- **Looks like**: A GUID or alphanumeric string (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 2. Clerk ID & Password
- **What**: API access credentials for a "clerk" (service account) that can read sales data
- **Where to configure**: SwiftPOS Back Office > Security > Security Groups > Web Api
- **Ask your reseller**: "Create a Web API clerk with read access to Sales, Members, and Products"
- **Looks like**: Clerk ID is a number (e.g., `999`), Password is a string

### 3. Location IDs
- **What**: Each venue/register location has a numeric ID in SwiftPOS
- **Where to find**: SwiftPOS Back Office > Locations
- **You need**: The Location ID for each Luna venue:
  - Eclipse = Location ID `___`
  - After Dark = Location ID `___`
  - Su Casa BNE = Location ID `___`
  - Su Casa GC = Location ID `___`
  - Pump = Location ID `___`
  - Mamacita = Location ID `___`
  - Juju = Location ID `___`
  - Night Market = Location ID `___`
  - Ember & Ash = Location ID `___`

### 4. Web API Permissions
- **Ask your reseller**: "Enable Web API access for our clerk, including: Sales read, Members read, Products read"
- **Where**: SwiftPOS Back Office > Security > Security Groups > select your API clerk group > check "Web Api" checkbox

### 5. POS API Access (Optional — for real-time mode)
- **What**: Direct-to-terminal access on port 33300
- **Where to enable**: SwiftPOS Touch > Tools > Basic Tools > Terminal Settings > Interface List > Add New > Web Server (POS API)
- **Set port to**: `33300`
- **Ask your reseller**: "Enable POS API on our terminals for third-party loyalty integration"

### 6. Order Webhooks (Optional — for push mode)
- **What**: SwiftPOS pushes sale events to a URL you provide
- **Where to configure**: SwiftPOS Back Office > Loyalty System > Order Webhooks
- **You provide**: The URL of your middleware webhook server (e.g., `https://your-server.com:8099/`)

---

## How It Works

```
CUSTOMER PAYS AT BAR (SwiftPOS POS Terminal)
        │
        ├── Option A: Middleware polls SwiftPOS Orders API every 30s
        ├── Option B: POS API pushes sale event in real-time
        └── Option C: SwiftPOS Order Webhook pushes to middleware
                │
        ┌───────▼────────────┐
        │  SWIFTPOS MIDDLEWARE │
        │  (swiftpos_middleware.py)
        │  - Converts sale data
        │  - Extracts member key/email
        │  - Maps venue location
        └───────┬────────────┘
                │ POST /api/perks/swiftpos/sale
        ┌───────▼────────────┐
        │  LUNA APP BACKEND   │
        │  - Matches member (key → email)
        │  - Calculates pts × tier multiplier
        │  - Credits points instantly
        │  - Logs audit trail
        └────────────────────┘
                │
        CUSTOMER SEES POINTS IN LUNA APP
```

---

## Deployment Steps

### Step 1: Set Environment Variables

On the machine running the middleware, set these:

```bash
# SwiftPOS Credentials (from your reseller)
export SWIFTPOS_CLOUD_CLIENT_ID="your-cloud-client-id"
export SWIFTPOS_CLERK_ID="999"
export SWIFTPOS_CLERK_PASSWORD="your-password"
export SWIFTPOS_LOCATION_ID="1"

# SwiftPOS API URLs
export SWIFTPOS_ORDERS_API_URL="https://pos-api.swiftpos.com.au"
export SWIFTPOS_POS_API_HOST="localhost"
export SWIFTPOS_POS_API_PORT="33300"

# Luna API
export LUNA_API_URL="https://your-luna-app-url.com"
export SWIFTPOS_WEBHOOK_KEY="luna_swiftpos_prod_2026"

# Mode: "poll" | "webhook" | "test"
export SWIFTPOS_MODE="poll"
export SWIFTPOS_POLL_INTERVAL="30"
```

### Step 2: Configure Venue Mapping

Edit `swiftpos_middleware.py` and fill in the venue_map:

```python
"venue_map": {
    "1": "eclipse",
    "2": "after_dark",
    "3": "su_casa_brisbane",
    "4": "su_casa_gold_coast",
    "5": "pump",
    "6": "mamacita",
    "7": "juju",
    "8": "night_market",
    "9": "ember_and_ash",
},
```

Replace the numbers with your actual SwiftPOS Location IDs.

### Step 3: Test

```bash
# Run the test simulator first (sends fake sales to your Luna API)
python swiftpos_middleware.py test
```

You should see:
- Test 1: Points awarded (matched by email)
- Test 2: Unmatched (no member with that key)
- Test 3: Unmatched (no member with that email)

### Step 4: Go Live

```bash
# Option A: Poll mode (recommended to start)
python swiftpos_middleware.py poll

# Option B: Webhook mode (if SwiftPOS Order Webhooks are configured)
python swiftpos_middleware.py webhook

# Run as a background service:
nohup python swiftpos_middleware.py poll > /var/log/swiftpos_middleware.log 2>&1 &
```

---

## Member Matching

The system tries to match SwiftPOS sales to Luna members in this order:

1. **SwiftPOS Member Key** → Looks up `cherryhub_member_key` or `swiftpos_member_key` on the user
2. **Email** → Falls back to matching by email address
3. **Unmatched** → If neither matches, the sale is logged for manual reconciliation

### For best results:
- When customers join Luna, ask for their SwiftPOS member number (if they have one)
- OR ensure the same email is used in both SwiftPOS and Luna
- Unmatched sales can be manually matched in the Luna Staff Portal

---

## Unmatched Sales Dashboard

Sales that couldn't be matched appear in:

```
GET /api/perks/swiftpos/unmatched
```

Staff can manually match them:

```
POST /api/perks/swiftpos/match/{receipt_number}?user_id={luna_user_id}
```

---

## Security

- The middleware authenticates with Luna using the `X-SwiftPOS-Key` header
- This key is set in both the middleware config AND the Luna backend `.env` file
- The key is: `SWIFTPOS_WEBHOOK_KEY=luna_swiftpos_prod_2026` (change this in production)
- The Luna backend validates this key on every request

---

## FAQ

**Q: Does the customer need to do anything at the register?**
A: Ideally, the bartender scans the customer's Luna member QR code at the POS terminal, which attaches the member key to the sale. If not, the middleware falls back to email matching.

**Q: What if the customer isn't a Luna member?**
A: The sale is logged as "unmatched". No points are awarded. Staff can later match it if the customer signs up.

**Q: Can I run this on the same machine as the POS?**
A: Yes, the middleware is lightweight Python. It can run on the same machine or a separate server on the same network.

**Q: How fast do points appear?**
A: Poll mode: within 30 seconds of sale completion. Webhook/POS API mode: near-instant (1-2 seconds).

**Q: What about refunds?**
A: Currently, refunds in SwiftPOS don't automatically deduct points. Staff should manually adjust via the Staff Portal.
