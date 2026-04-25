#!/usr/bin/env python3
"""Generate master API reference from FastAPI openapi.json."""
import json, urllib.request, re
from collections import defaultdict
from datetime import datetime

OPENAPI = json.loads(urllib.request.urlopen("http://localhost:8001/openapi.json").read())
PROD = "https://luna-production-889c.up.railway.app"

paths = OPENAPI.get("paths", {})
schemas = OPENAPI.get("components", {}).get("schemas", {})

# Group endpoints by tag, preserving insertion order per-path
by_tag = defaultdict(list)
for p, methods in paths.items():
    for m, info in methods.items():
        ml = m.lower()
        if ml not in ("get", "post", "put", "delete", "patch"):
            continue
        tag = (info.get("tags") or ["Misc"])[0]
        by_tag[tag].append({
            "method": m.upper(),
            "path": p,
            "summary": info.get("summary") or info.get("operationId") or "",
            "description": (info.get("description") or "").strip(),
            "params": info.get("parameters", []),
            "body": info.get("requestBody"),
            "responses": info.get("responses", {}),
            "deprecated": info.get("deprecated", False),
        })

# Tag ordering — put foundational/auth first, then the big product surfaces, then admin
PREFERRED_ORDER = [
    "Health", "public-config", "Authentication", "users",
    # Core consumer app
    "Venues", "venue-menus", "Events", "Missions", "Rewards", "Points",
    "Bookings", "Subscriptions", "Referrals", "Tickets", "Entry Tickets",
    "birthday", "Boosts", "Milestones", "Stories", "Social", "crews", "Friends",
    "Auctions", "leaderboard", "Campaigns", "promo", "vouchers",
    "Photos", "Notifications", "Notifications WebSocket", "WebSocket", "Notification Tracking",
    "Push Broadcasts",
    "location", "geofences", "safety",
    "Luna Loyalty", "CherryHub", "Perks", "Payments",
    "AI", "Churn Prediction",
    "Scheduled Jobs", "Webhooks",
    # Venue manager
    "Venue Admin — Auctions", "Venue Admin — Users", "Venue Dashboard",
    # Admin
    "admin", "admin-safety", "admin-swiftpos",
    "untagged", "Misc",
]
ordered_tags = [t for t in PREFERRED_ORDER if t in by_tag] + [t for t in sorted(by_tag) if t not in PREFERRED_ORDER]

# Friendly descriptions per tag
TAG_BLURBS = {
    "Health": "Service liveness + deep dependency probes (Mongo / CherryHub / Resend).",
    "public-config": "Public config endpoints — no auth, safe to call from signup.",
    "Authentication": "Login, registration, JWT refresh, password reset. JWT is required on every other authed endpoint.",
    "users": "Current user mgmt (me, stats, settings).",
    "Venues": "The 9 Luna venues (Eclipse, After Dark, Su Casa BNE/GC, JuJu, Night Market, Ember & Ash, Pump, Mamacita).",
    "venue-menus": "Per-venue food & drink menus.",
    "Events": "Nightlife events feed — mix of Luna-curated + Eventfinda imports.",
    "Missions": "Gamification — complete a mission, earn points via SwiftPOS.",
    "Rewards": "Catalog of redeemable rewards + redemption flow.",
    "Points": "Real-time balance pull + link status. Source of truth = SwiftPOS via CherryHub.",
    "Bookings": "Booth / table / bottle reservations.",
    "Subscriptions": "Stripe-backed tiered subscriptions (bronze → aurora).",
    "Referrals": "Refer-a-friend with auto-award on both sides.",
    "Tickets": "Per-event tickets.",
    "Entry Tickets": "QR-scan door entry tickets.",
    "birthday": "Birthday voucher + branded email.",
    "Boosts": "Paid temporary multipliers / perks.",
    "Milestones": "Lifetime achievement tracking.",
    "Stories": "24h user-generated content feed.",
    "Social": "Social feed (posts, likes, comments) — the Instagram replacement.",
    "crews": "Friend-group scheduling + social nights.",
    "Friends": "Friend graph.",
    "Auctions": "Live auctions with bidding + activity heat.",
    "leaderboard": "Points / visits / spend leaderboards + Nightly Crown daily prize.",
    "Campaigns": "Marketing campaigns (venue-led).",
    "promo": "Promo codes.",
    "vouchers": "One-off vouchers.",
    "Photos": "Venue photo galleries.",
    "Notifications": "In-app notifications feed.",
    "Notifications WebSocket": "Live WS push into the mobile app.",
    "WebSocket": "Generic WebSocket endpoint.",
    "Notification Tracking": "Public open/click pixels for email & push analytics.",
    "Push Broadcasts": "Admin CRUD for Expo push notifications with scheduling + targeting.",
    "location": "User location updates + venue proximity.",
    "geofences": "Venue geofence definitions + enter/exit events.",
    "safety": "Silent SOS alerts + emergency contacts.",
    "Luna Loyalty": "Apple Wallet / Google Wallet pass generation.",
    "CherryHub": "CherryHub OAuth + member key + wallet pass + live points read.",
    "Perks": "Legacy SwiftPOS webhook + perks ledger.",
    "Payments": "Stripe checkout initialisation.",
    "AI": "GPT-powered personalisation (event picks, chat, etc.).",
    "Churn Prediction": "Churn-risk scoring + win-back dispatch.",
    "Scheduled Jobs": "Admin triggers for scheduler-run tasks.",
    "Webhooks": "Inbound webhooks (Stripe).",
    "Venue Admin — Auctions": "Venue manager CRUD for auctions + image upload.",
    "Venue Admin — Users": "Venue manager user lookups.",
    "Venue Dashboard": "Venue manager operational dashboard.",
    "admin": "Global admin — stats, users, venues, config, milestones, bottles, entry tickets, announcements.",
    "admin-safety": "Admin triage of silent SOS alerts.",
    "admin-swiftpos": "SwiftPOS pipeline monitoring + retry (mirrors LunaSwiftPOSReporting Lovable component).",
}

def auth_note_for_tag(tag: str) -> str:
    if tag.startswith("admin") or tag.startswith("Venue Admin") or tag == "Venue Dashboard":
        return "**Auth:** Bearer JWT with role ∈ {admin, staff, manager} OR `X-Luna-Hub-Key` header (admin routes only)."
    if tag in ("Health", "public-config", "Webhooks", "Notification Tracking"):
        return "**Auth:** Not required."
    return "**Auth:** Bearer JWT."

def format_param(p):
    name = p.get("name", "")
    loc = p.get("in", "")
    req = "required" if p.get("required") else "optional"
    schema = p.get("schema", {})
    t = schema.get("type") or ("/".join(x.get("type","") for x in schema.get("anyOf", []) if x.get("type")) or "any")
    default = schema.get("default")
    desc = (p.get("description") or "").strip()
    out = f"- `{name}` ({loc}, {t}, {req})"
    if default is not None:
        out += f" — default `{default}`"
    if desc:
        out += f" — {desc}"
    return out

def schema_ref_name(ref: str) -> str:
    return ref.rsplit("/", 1)[-1] if ref else ""

def short_schema_hint(schema_obj):
    if not schema_obj:
        return ""
    ref = schema_obj.get("$ref")
    if ref:
        return f"`{schema_ref_name(ref)}`"
    t = schema_obj.get("type")
    if t == "array":
        items = schema_obj.get("items", {})
        return f"`{short_schema_hint(items)}[]`" if items else "`array`"
    return f"`{t or 'object'}`"

def format_body(body):
    if not body:
        return ""
    content = body.get("content", {})
    # Prefer JSON, fall back to first content type
    ct = "application/json" if "application/json" in content else (next(iter(content), "") if content else "")
    if not ct:
        return "- (empty body)"
    schema = content[ct].get("schema", {})
    hint = short_schema_hint(schema)
    req = " (required)" if body.get("required") else " (optional)"
    return f"- Body{req}: `{ct}` → {hint}"

def format_responses(responses):
    lines = []
    for code, info in sorted(responses.items()):
        if not code.isdigit():
            continue
        desc = info.get("description", "").strip().replace("\n", " ")
        content = info.get("content", {})
        hint = ""
        if content:
            ct = "application/json" if "application/json" in content else next(iter(content), "")
            if ct:
                hint = f" → {short_schema_hint(content[ct].get('schema', {}))}"
        lines.append(f"  - `{code}`{hint} — {desc or 'OK'}")
    return "\n".join(lines)

# Build Markdown
out = []
out.append("# Luna Group VIP API — Master Reference")
out.append("")
out.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d')} · **Endpoints:** {sum(len(v) for v in by_tag.values())} · **Tags:** {len(by_tag)} · **Schemas:** {len(schemas)}")
out.append("")
out.append(f"**Production base URL:** `{PROD}/api`  ")
out.append("**Local dev base URL:** `http://localhost:8001/api`  ")
out.append("**Swagger UI:** `<base>/docs`  ·  **OpenAPI JSON:** `<base>/openapi.json` (no `/api` prefix)")
out.append("")
out.append("---")
out.append("")

# Intro
out.append("## 📖 Read me first")
out.append("")
out.append("### Auth")
out.append("- Most endpoints require a JWT **Bearer** token in `Authorization` header.")
out.append("- Obtain via `POST /api/auth/login` → `{ token, user }`.")
out.append("- Token expires in 7 days. Refresh via `POST /api/auth/refresh`.")
out.append("- Admin/staff/manager endpoints additionally accept the `X-Luna-Hub-Key` header for server-to-server calls from Lovable.")
out.append("")
out.append("### Role model")
out.append("| Role | Can access |")
out.append("|---|---|")
out.append("| `user` | All consumer endpoints (own data only) |")
out.append("| `staff` | Consumer + venue dashboard (own venue) + limited admin |")
out.append("| `manager` | Staff + full venue admin for assigned venue |")
out.append("| `venue_manager` | Same as manager |")
out.append("| `venue_staff` | Same as staff |")
out.append("| `admin` | Everything, all venues |")
out.append("| `super_admin` | Same as admin |")
out.append("")
out.append("### Response conventions")
out.append("- All responses are JSON (except `.pkpass` downloads + static files).")
out.append("- Timestamps are **ISO-8601 UTC** (`2026-04-24T22:15:00Z` or `...+00:00`).")
out.append("- Monetary amounts are AUD decimal.")
out.append("- Points are integers; `$0.025/point` conversion rate.")
out.append("- MongoDB `_id` is **always stripped** from responses. Every resource has a human-friendly `id` string.")
out.append("")
out.append("### Error shape")
out.append("```json")
out.append('{"detail": "Human-readable reason"}')
out.append("```")
out.append("Standard HTTP codes: `400` validation, `401` no/bad auth, `403` wrong role, `404` not found, `409` conflict, `422` pydantic validation, `500` server error, `503` integration offline.")
out.append("")
out.append("### Feature flags in production (.env)")
out.append("| Key | Current | Meaning |")
out.append("|---|---|---|")
out.append("| `SWIFTPOS_MOCK_MODE` | `true` | SwiftPOS calls are simulated (no live points dispatch). |")
out.append("| `CHERRYHUB_MOCK_MODE` | `false` (prod) / `true` (local) | CherryHub OAuth + member reads live on Railway. |")
out.append("| `POINTS_LEGACY_DIRECT_MONGO` | `true` | While SwiftPOS creds missing, points increment in Mongo instead of being pushed to SwiftPOS. Flip to `false` once creds arrive. |")
out.append("")
out.append("---")
out.append("")

# Table of contents
out.append("## 📑 Table of contents")
out.append("")
for tag in ordered_tags:
    anchor = re.sub(r"[^a-z0-9]+", "-", tag.lower()).strip("-")
    out.append(f"- [{tag}](#{anchor}) — {len(by_tag[tag])} endpoint{'s' if len(by_tag[tag])!=1 else ''}")
out.append("- [Data models (schemas)](#data-models-schemas)")
out.append("")
out.append("---")
out.append("")

# Each tag section
for tag in ordered_tags:
    out.append(f"## {tag}")
    blurb = TAG_BLURBS.get(tag)
    if blurb:
        out.append(f"_{blurb}_")
    out.append("")
    out.append(auth_note_for_tag(tag))
    out.append("")
    # Sort endpoints within tag: GET before mutations, then alphabetically by path
    rank = {"GET": 0, "POST": 1, "PUT": 2, "PATCH": 3, "DELETE": 4}
    eps = sorted(by_tag[tag], key=lambda e: (rank.get(e["method"], 9), e["path"]))
    for ep in eps:
        title = ep["summary"] or ep["path"]
        if ep["deprecated"]:
            title = f"~~{title}~~ (deprecated)"
        out.append(f"### `{ep['method']} {ep['path']}` — {title}")
        if ep["description"]:
            # Collapse multi-line descriptions, max 400 chars
            desc = ep["description"]
            if len(desc) > 600:
                desc = desc[:580] + "…"
            out.append(desc)
        if ep["params"]:
            out.append("")
            out.append("**Parameters:**")
            for p in ep["params"]:
                out.append(format_param(p))
        body = format_body(ep["body"])
        if body:
            out.append("")
            out.append("**Request body:**")
            out.append(body)
        if ep["responses"]:
            rtxt = format_responses(ep["responses"])
            if rtxt:
                out.append("")
                out.append("**Responses:**")
                out.append(rtxt)
        out.append("")
    out.append("---")
    out.append("")

# Schemas
out.append("## Data models (schemas)")
out.append("")
out.append(f"_{len(schemas)} Pydantic models, auto-generated by FastAPI. Only the most-used are expanded — use `/openapi.json` for the full surface._")
out.append("")

# Pick the most useful schemas to expand
IMPORTANT_SCHEMAS = [
    "User", "UserCreate", "RegisterRequest", "LoginRequest", "UserUpdate",
    "Venue", "Event", "Mission", "Reward", "Booking", "BookingRequest",
    "Subscription", "Auction", "AuctionCreate", "AuctionUpdate",
    "SafetyAlert", "SafetySilentAlertRequest",
    "PushBroadcast", "PushBroadcastCreate", "PushBroadcastUpdate",
    "CherryHubLoginRequest", "CherryHubLinkRequest", "CherryHubRegisterRequest", "WalletPassRequest",
    "RecordSpendingRequest", "PointsTransaction", "Spending",
    "Milestone", "Story", "Post", "Comment",
    "Notification",
    "Ticket", "EntryTicket",
    "Crew", "CrewInvite", "SocialNight",
    "Voucher", "PromoCode",
    "AdminUserUpdate", "AdminAnnouncement",
    "LocationPing", "Geofence",
]

def render_schema(name):
    s = schemas.get(name)
    if not s:
        return None
    lines = [f"### `{name}`"]
    props = s.get("properties", {})
    required = set(s.get("required", []))
    if not props:
        lines.append("_(no properties defined)_")
        return "\n".join(lines)
    lines.append("")
    lines.append("| Field | Type | Required | Notes |")
    lines.append("|---|---|---|---|")
    for fname, fschema in props.items():
        ftype = fschema.get("type")
        if not ftype:
            if "$ref" in fschema:
                ftype = schema_ref_name(fschema["$ref"])
            elif "anyOf" in fschema:
                ftype = " / ".join(
                    x.get("type") or (schema_ref_name(x.get("$ref","")) if x.get("$ref") else "null")
                    for x in fschema["anyOf"]
                )
            else:
                ftype = "any"
        if ftype == "array":
            items = fschema.get("items", {})
            inner = items.get("type") or schema_ref_name(items.get("$ref","")) or "any"
            ftype = f"{inner}[]"
        req = "✓" if fname in required else ""
        notes = fschema.get("description") or ""
        if "default" in fschema:
            notes = (notes + (" · " if notes else "") + f"default `{fschema['default']}`").strip()
        if fschema.get("enum"):
            notes = (notes + (" · " if notes else "") + f"enum: {fschema['enum']}").strip()
        lines.append(f"| `{fname}` | `{ftype}` | {req} | {notes[:120]} |")
    return "\n".join(lines)

for name in IMPORTANT_SCHEMAS:
    block = render_schema(name)
    if block:
        out.append(block)
        out.append("")

out.append("")
out.append("_(Other schemas — see `<base>/openapi.json` for the full list.)_")
out.append("")
out.append("---")
out.append("")
out.append("## 🔚 End of master API reference")
out.append("")
out.append(f"_Regenerate this doc any time by running `/app/tools/generate_api_master.py`. Source of truth is always the live FastAPI `openapi.json`._")

final = "\n".join(out)
with open("/app/LUNA_API_MASTER_REFERENCE.md", "w") as f:
    f.write(final)

print("Bytes:", len(final), "Lines:", final.count("\n")+1)
