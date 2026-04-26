# 🌙 Luna Group — Lovable Admin Portal · Missions, Milestones & Push (April 2026 update)

**What this document does:** Drop-in Lovable build prompt for the four new admin surfaces shipped on **2026-04-26**:

1. **Missions Editor** — full CRUD with the new server-verified trigger system (event_type + event_filter)
2. **Mission Test-Fire & Activity Timeline** — verify any mission's trigger before going live + diagnostic feed
3. **Milestones Editor** — full CRUD against the new `milestones_custom` collection (the 6 default tiers are pre-seeded)
4. **Push-Token Coverage Panel** — diagnostic for the recent push-token registration fix

This file is **additive** — it does not replace `LUNA_LOVABLE_MASTER_PROMPT.md`; it slots in alongside it under new admin routes.

---

## 📋 FOR LOVABLE: Read this section first

You are extending the **Luna Group admin portal**. The base setup (env var, auth, routing, fetch helper) is already defined in `LUNA_LOVABLE_MASTER_PROMPT.md`. This addendum re-uses **all** of that:

- `VITE_LUNA_API_URL` → backend base URL
- `localStorage.luna_admin_token` → JWT for every authed call
- Header on every fetch: `Authorization: Bearer ${token}`
- Toast/Alert: re-use whatever you used in the base file
- Style language: the base file's components are unstyled React + inline styles; match that

Add these new routes to your router:

| Path | Component | Purpose |
|---|---|---|
| `/missions` | `LunaMissionsEditor` | List + create + edit + delete missions, with trigger picker |
| `/missions/activity` | `LunaMissionActivity` | Timeline of every progression event (filterable) |
| `/milestones` | `LunaMilestonesEditor` | List + create + edit + delete milestones with rewards |
| `/push-coverage` | `LunaPushCoverage` | Diagnostic — who has registered a push token, who hasn't |

**Admin demo account** (same as before): `admin@lunagroup.com.au` / `Trent69!`

---

# 1. MISSIONS EDITOR — `LunaMissionsEditor.tsx`

## 1.1 Concept

Missions are time/activity-bound goals that grant points when completed. Until 2026-04-26 they had **no real trigger** — Lovable could only set a target number, and progress was driven by the (now-locked-down) client. From this release missions have an **`event_type`** (whitelist) and an optional **`event_filter`** (dict) that the backend uses to auto-progress them when verified actions happen (purchase, RSVP, share, bid, etc.).

The form below MUST always pull the trigger options from the live API so your dropdown is never out-of-sync with backend support.

## 1.2 Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/admin/missions` | List all missions |
| POST   | `/api/admin/missions` | Create |
| PUT    | `/api/admin/missions/{mission_id}` | Update |
| DELETE | `/api/admin/missions/{mission_id}` | Delete |
| GET    | `/api/admin/mission-event-types` | **NEW** — populates the trigger dropdown (with filter schema) |
| POST   | `/api/admin/missions/test-fire` | **NEW** — fires a synthetic event to test a mission's trigger |

## 1.3 Mission JSON shape (what create/update accept and return)

```json
{
  "id": "mission_a1b2c3d4",                    // server-generated
  "title": "Weekend Warrior",                  // required
  "description": "Visit 3 venues this weekend",
  "points_reward": 600,                        // points granted on completion
  "requirement_value": 3,                      // numeric target
  "type": "weekly",                            // cosmetic — "daily" | "weekly" | "special"
  "venue_id": null,                            // optional scoping (top-level)
  "icon": "trophy",
  "color": "#D4AF5A",
  "is_active": true,

  "event_type": "venue_visit",                 // ← NEW — must be from /mission-event-types
  "event_filter": { "venue_id": "eclipse" }    // ← NEW — keys depend on event_type
}
```

If `event_type` is set to a value NOT in the whitelist, the API returns:
```json
{ "detail": "Unsupported event_type 'xxx'. Allowed: [...]" }
```
Your UI must surface this as an inline form error.

## 1.4 `/api/admin/mission-event-types` response (the dropdown source)

```json
{
  "event_types": [
    { "value": "venue_visit",      "label": "Venue Visit",         "filters": ["venue_id"], "increment_unit": "visits" },
    { "value": "purchase_amount",  "label": "Total $ Spent",       "filters": ["venue_id", "category"], "increment_unit": "dollars" },
    { "value": "purchase_count",   "label": "Number of Purchases", "filters": ["venue_id", "category"], "increment_unit": "purchases" },
    { "value": "social_share",     "label": "Story Share",         "filters": ["platform"], "increment_unit": "shares" },
    { "value": "referral_signup",  "label": "Referral Signup",     "filters": [], "increment_unit": "referrals" },
    { "value": "event_rsvp",       "label": "Event RSVP",          "filters": ["venue_id"], "increment_unit": "rsvps" },
    { "value": "auction_bid",      "label": "Auction Bid",         "filters": ["venue_id"], "increment_unit": "bids" },
    { "value": "consecutive_days", "label": "Consecutive Days",    "filters": [], "increment_unit": "days" }
  ]
}
```

**How to render the form (recommended UX):**

- A `<select>` for `event_type` populated from this endpoint.
- Below it, render an input for **each filter key** the selected option declares — e.g. selecting `purchase_amount` reveals two inputs: `venue_id` and `category`.
- Below the filter inputs, render a numeric `requirement_value` field with the unit suffix (`{increment_unit}`) — e.g. *"Target: [____] dollars"*, *"Target: [____] visits"*.
- The 9 venue IDs (for the `venue_id` filter) are: `eclipse`, `after_dark`, `pump`, `mamacita`, `juju`, `night_market`, `ember_and_ash`, `su_casa_brisbane`, `su_casa_gold_coast`.

Empty filters → omit the key from `event_filter` rather than sending `null`.

## 1.5 Test-Fire button (verification UX)

Each mission row in the list MUST have a small **"Test trigger"** button. Tapping it opens a modal that calls:

```
POST /api/admin/missions/test-fire
{
  "user_id": "<optional, defaults to calling admin>",
  "event_type": "<must match mission's event_type>",
  "increment": 1,
  "venue_id": "...",   // optional — must match mission's filter to actually progress it
  "category": "...",
  "platform": "..."
}
```

Response:
```json
{
  "success": true,
  "fired_event": { "event_type": "purchase_amount", "increment": 50, "user_id": "...", "payload": {...} },
  "newly_completed": ["mission_a1b2c3d4"],   // missions that crossed the finish line on THIS event
  "progress": [
    { "mission_id": "...", "title": "Weekend Warrior",
      "event_filter": { "venue_id": "eclipse" },
      "target": 3, "progress": 1, "completed": false, "claimed": false }
  ]
}
```

Show a result card with: status badge (Progressed / Completed / Filter Mismatch), the new progress bar (`progress / target`), and a link to the Activity timeline filtered to this mission.

## 1.6 Skeleton component

```tsx
// LunaMissionsEditor.tsx
import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_LUNA_API_URL;
const TOKEN = () => localStorage.getItem("luna_admin_token") || "";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` });

const VENUES = [
  "eclipse", "after_dark", "pump", "mamacita", "juju",
  "night_market", "ember_and_ash", "su_casa_brisbane", "su_casa_gold_coast",
];
const CATEGORIES = ["drinks", "food", "entry", "booth", "bottles", "other"];
const PLATFORMS  = ["instagram", "facebook", "x", "tiktok", "whatsapp", "sms"];

type EventType = {
  value: string; label: string; filters: string[]; increment_unit: string;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  points_reward: number;
  requirement_value: number;
  type: string;
  venue_id?: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  event_type?: string | null;
  event_filter?: Record<string, string> | null;
};

const empty: Partial<Mission> = {
  title: "", description: "", points_reward: 100, requirement_value: 1,
  type: "weekly", icon: "trophy", color: "#D4AF5A", is_active: true,
  event_type: "", event_filter: {},
};

export default function LunaMissionsEditor() {
  const [missions, setMissions]   = useState<Mission[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [draft, setDraft]         = useState<Partial<Mission>>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError]         = useState<string>("");
  const [busy, setBusy]           = useState(false);

  async function load() {
    const [m, ev] = await Promise.all([
      fetch(`${API}/api/admin/missions`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/admin/mission-event-types`, { headers: headers() }).then(r => r.json()),
    ]);
    setMissions(m.missions ?? m ?? []);
    setEventTypes(ev.event_types ?? []);
  }
  useEffect(() => { load(); }, []);

  const selectedEvent = useMemo(
    () => eventTypes.find(e => e.value === draft.event_type) || null,
    [eventTypes, draft.event_type],
  );

  async function save() {
    setBusy(true); setError("");
    try {
      // strip empty filter keys
      const filter: Record<string, string> = {};
      Object.entries(draft.event_filter || {}).forEach(([k, v]) => {
        if (v && String(v).trim()) filter[k] = String(v).trim();
      });
      const body = { ...draft, event_filter: filter };
      const url = editingId
        ? `${API}/api/admin/missions/${editingId}`
        : `${API}/api/admin/missions`;
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `Save failed (${r.status})`);
      }
      await load();
      setDraft(empty); setEditingId(null);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this mission?")) return;
    await fetch(`${API}/api/admin/missions/${id}`, { method: "DELETE", headers: headers() });
    await load();
  }

  async function testFire(m: Mission) {
    if (!m.event_type) { alert("This mission has no trigger — set an event_type first."); return; }
    const inc = Number(prompt("Increment to fire:", "1") || 0);
    if (!inc) return;
    const filter = m.event_filter || {};
    const r = await fetch(`${API}/api/admin/missions/test-fire`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ event_type: m.event_type, increment: inc, ...filter }),
    });
    const j = await r.json();
    const row = (j.progress || []).find((p: any) => p.mission_id === m.id);
    alert(
      `Fired ${m.event_type} +${inc}\n` +
      (row ? `Progress: ${row.progress}/${row.target}${row.completed ? " ✓ completed" : ""}` : "No progress row")
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Missions Editor</h1>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div style={{ background: "#fafafa", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <h3>{editingId ? "Edit mission" : "Create mission"}</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <input placeholder="Title"
            value={draft.title ?? ""} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <input placeholder="Type (daily/weekly/special)"
            value={draft.type ?? "weekly"} onChange={e => setDraft({ ...draft, type: e.target.value })} />
          <textarea placeholder="Description" style={{ gridColumn: "1/3" }}
            value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} />

          <label>Points reward
            <input type="number"
              value={draft.points_reward ?? 0}
              onChange={e => setDraft({ ...draft, points_reward: Number(e.target.value) })} />
          </label>

          <label>Trigger (event_type)
            <select
              value={draft.event_type ?? ""}
              onChange={e => setDraft({ ...draft, event_type: e.target.value, event_filter: {} })}>
              <option value="">— None (manual) —</option>
              {eventTypes.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
            </select>
          </label>

          {/* Dynamic filter inputs */}
          {selectedEvent?.filters.map(f => {
            const opts = f === "venue_id" ? VENUES
                       : f === "category" ? CATEGORIES
                       : f === "platform" ? PLATFORMS : null;
            return (
              <label key={f}>{f}
                {opts
                  ? <select value={(draft.event_filter as any)?.[f] ?? ""}
                            onChange={e => setDraft({ ...draft, event_filter: { ...draft.event_filter, [f]: e.target.value } })}>
                      <option value="">— any —</option>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  : <input value={(draft.event_filter as any)?.[f] ?? ""}
                           onChange={e => setDraft({ ...draft, event_filter: { ...draft.event_filter, [f]: e.target.value } })} />}
              </label>
            );
          })}

          <label>Target {selectedEvent ? `(${selectedEvent.increment_unit})` : ""}
            <input type="number" min={1}
              value={draft.requirement_value ?? 1}
              onChange={e => setDraft({ ...draft, requirement_value: Number(e.target.value) })} />
          </label>

          <label>Active <input type="checkbox" checked={!!draft.is_active}
              onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /></label>
        </div>

        {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

        <div style={{ marginTop: 12 }}>
          <button onClick={save} disabled={busy}>{editingId ? "Update" : "Create"}</button>
          {editingId && <button onClick={() => { setDraft(empty); setEditingId(null); }} style={{ marginLeft: 8 }}>Cancel</button>}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><th align="left">Title</th><th>Type</th><th>Trigger</th><th>Filter</th><th>Target</th><th>Reward</th><th>Active</th><th></th></tr>
        </thead>
        <tbody>
          {missions.map(m => (
            <tr key={m.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{m.title || (m as any).name}</td>
              <td>{m.type}</td>
              <td><code>{m.event_type ?? "—"}</code></td>
              <td><code>{JSON.stringify(m.event_filter ?? {})}</code></td>
              <td align="right">{m.requirement_value}</td>
              <td align="right">{m.points_reward}</td>
              <td align="center">{m.is_active ? "✓" : "—"}</td>
              <td>
                <button onClick={() => { setDraft(m as any); setEditingId(m.id); }}>Edit</button>
                <button onClick={() => testFire(m)} style={{ marginLeft: 4 }}>Test trigger</button>
                <button onClick={() => remove(m.id)} style={{ marginLeft: 4, color: "crimson" }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

# 2. MISSION ACTIVITY TIMELINE — `LunaMissionActivity.tsx`

## 2.1 Endpoint

```
GET /api/admin/missions/activity
  ?user_id=<optional>
  &mission_id=<optional>
  &event_type=<optional>
  &only_completed=<bool>
  &limit=<int, default 100, max 500>
```

## 2.2 Response

```json
{
  "activity": [
    {
      "user_id": "bc80f727-…",
      "user_email": "admin@lunagroup.com.au",
      "user_name": "Luna Admin",
      "mission_id": "mission_c94a7917",
      "mission_title": "QA: Eclipse spender",
      "event_type": "purchase_amount",
      "event_payload": { "venue_id": "eclipse" },
      "progress": 110,
      "target": 100,
      "completed": true,
      "claimed": false,
      "completed_at": "2026-04-26T07:11:32.418Z",
      "updated_at": "2026-04-26T07:11:32.418Z",
      "admin_override": false
    }
  ],
  "total": 1,
  "limit": 100
}
```

## 2.3 UI requirements

Top filter bar with 4 inputs (all optional):
- Search by **email** (resolves to user_id via `/api/admin/users/search?q=` if you have it; else free-text match user_id)
- **Mission** dropdown (populated from `/api/admin/missions`)
- **Event type** dropdown (from `/api/admin/mission-event-types`)
- **Only completed** checkbox

Below: a feed (most-recent first). Each row:
- Avatar circle with first letter of user_name
- `{user_email}` · `{mission_title}`
- Progress bar `{progress}/{target}` with completion check
- Right side: `{event_type}` chip + relative timestamp + payload tooltip (hover shows full `event_payload` JSON)
- If `admin_override === true` → red dot tooltip "Admin manual override"

Empty state: *"No mission activity yet. Trigger something via the Test-fire button on a mission, or wait for a real event."*

---

# 3. MILESTONES EDITOR — `LunaMilestonesEditor.tsx`

## 3.1 Concept

Milestones are **lifetime** loyalty tiers. The 6 defaults (Newbie / Rising Star / VIP Status / Luna Elite / Supernova / Legend) are seeded into `db.milestones_custom`. Lovable can now edit them — the mobile app reads `milestones_custom` first, with the legacy hardcoded list as fallback only if a milestone is missing from the DB.

When a member's `points_balance` crosses a milestone's `points_required`, they can claim it. Claiming generates one HMAC-signed QR per reward (single-use, server-verified).

## 3.2 Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/admin/milestones` | List |
| POST   | `/api/admin/milestones` | Create |
| PUT    | `/api/admin/milestones/{milestone_id}` | Update (whole) |
| DELETE | `/api/admin/milestones/{milestone_id}` | Delete |
| POST   | `/api/admin/milestones/{milestone_id}/rewards` | **NEW** Add a single reward |
| DELETE | `/api/admin/milestones/{milestone_id}/rewards/{reward_id}` | **NEW** Remove a single reward |

## 3.3 Milestone JSON shape

```json
{
  "id": "rising_star",            // slug — auto-generated from title if omitted on POST
  "title": "Rising Star",
  "points_required": 500,
  "icon": "star",
  "color": "#D4A832",
  "description": "Welcome to Luna",
  "rewards": [
    {
      "id": "rising_star_r1",
      "type": "free_drink",        // see allowed types below
      "label": "Free House Drink",
      "description": "Any standard house pour"
    }
  ]
}
```

**Allowed `reward.type` values** (use a `<select>` in the form):

| Value | Meaning |
|---|---|
| `free_drink` | One free drink |
| `free_entry` | One free door entry |
| `express_entry` | Express line-skip pass |
| `free_vip_booth` | Comp VIP booth |
| `dj_shoutout` | On-mic shoutout |
| `gold_upgrade` | Tier upgrade (period-based) |
| `booth_with_bottle` | Booth + comp bottle |
| `giftable_entry` | Free entry the member can gift |

## 3.4 UX requirements

Two-pane layout:

**Left pane (list):** the 6 (+ any custom) milestones, sorted by `points_required` ascending. Each card shows title, threshold, reward count, color swatch.

**Right pane (editor):** when a milestone is selected, show:
1. Inline edit form (title, threshold, icon, color, description) → "Save changes" calls **PUT** `/admin/milestones/{id}` with the four mutated fields **only** (don't send `rewards` here — that's edited via the rewards sub-API).
2. **Rewards section** below — list of reward chips with a delete (×) button each, plus an **"+ Add reward"** form (type dropdown + label + description) that calls **POST** `/admin/milestones/{id}/rewards`.

This separation keeps the rewards array server-managed and avoids race conditions when multiple admins edit a milestone simultaneously.

## 3.5 Skeleton

```tsx
// LunaMilestonesEditor.tsx
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_LUNA_API_URL;
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("luna_admin_token") || ""}`,
});

const REWARD_TYPES = [
  "free_drink","free_entry","express_entry","free_vip_booth",
  "dj_shoutout","gold_upgrade","booth_with_bottle","giftable_entry",
];

type Reward = { id: string; type: string; label: string; description?: string };
type Milestone = {
  id: string; title: string; points_required: number;
  icon: string; color: string; description: string;
  rewards: Reward[];
};

export default function LunaMilestonesEditor() {
  const [items, setItems]       = useState<Milestone[]>([]);
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [newReward, setNewReward] = useState({ type: "free_drink", label: "", description: "" });

  async function load() {
    const r = await fetch(`${API}/api/admin/milestones`, { headers: headers() });
    const j = await r.json();
    setItems(j.milestones || []);
    if (selected) setSelected((j.milestones || []).find((m: any) => m.id === selected.id) || null);
  }
  useEffect(() => { load(); }, []);

  async function saveMeta(patch: Partial<Milestone>) {
    if (!selected) return;
    await fetch(`${API}/api/admin/milestones/${selected.id}`, {
      method: "PUT", headers: headers(), body: JSON.stringify(patch),
    });
    await load();
  }

  async function addReward() {
    if (!selected || !newReward.label) return;
    await fetch(`${API}/api/admin/milestones/${selected.id}/rewards`, {
      method: "POST", headers: headers(), body: JSON.stringify(newReward),
    });
    setNewReward({ type: "free_drink", label: "", description: "" });
    await load();
  }

  async function removeReward(rid: string) {
    if (!selected) return;
    await fetch(`${API}/api/admin/milestones/${selected.id}/rewards/${rid}`, {
      method: "DELETE", headers: headers(),
    });
    await load();
  }

  async function createMilestone() {
    const title = prompt("New milestone title:");
    if (!title) return;
    const points = Number(prompt("Points required:") || 0);
    await fetch(`${API}/api/admin/milestones`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ title, points_required: points, rewards: [] }),
    });
    await load();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, padding: 24 }}>
      <aside>
        <button onClick={createMilestone}>+ New milestone</button>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {items.map(m => (
            <li key={m.id}
                onClick={() => setSelected(m)}
                style={{ padding: 12, borderRadius: 8, cursor: "pointer",
                         background: selected?.id === m.id ? "#fef9e7" : "transparent",
                         border: `1px solid ${m.color}30`, marginBottom: 6 }}>
              <strong>{m.title}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.points_required.toLocaleString()} pts · {m.rewards?.length ?? 0} rewards
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main>
        {!selected && <em>Select a milestone on the left</em>}
        {selected && (
          <>
            <h2>{selected.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input defaultValue={selected.title}
                onBlur={e => saveMeta({ title: e.target.value })} placeholder="Title" />
              <input type="number" defaultValue={selected.points_required}
                onBlur={e => saveMeta({ points_required: Number(e.target.value) })} placeholder="Points required" />
              <input defaultValue={selected.icon}
                onBlur={e => saveMeta({ icon: e.target.value })} placeholder="Icon" />
              <input defaultValue={selected.color} type="color"
                onBlur={e => saveMeta({ color: e.target.value })} />
              <textarea defaultValue={selected.description} style={{ gridColumn: "1/3" }}
                onBlur={e => saveMeta({ description: e.target.value })} placeholder="Description" />
            </div>

            <h3 style={{ marginTop: 24 }}>Rewards ({selected.rewards?.length ?? 0})</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {(selected.rewards || []).map(r => (
                <li key={r.id} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6, marginBottom: 4,
                                        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span><code>{r.type}</code> · {r.label}{r.description && ` — ${r.description}`}</span>
                  <button onClick={() => removeReward(r.id)} style={{ color: "crimson" }}>×</button>
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <select value={newReward.type}
                onChange={e => setNewReward({ ...newReward, type: e.target.value })}>
                {REWARD_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="Label" value={newReward.label}
                onChange={e => setNewReward({ ...newReward, label: e.target.value })} />
              <input placeholder="Description (optional)" value={newReward.description}
                onChange={e => setNewReward({ ...newReward, description: e.target.value })} />
              <button onClick={addReward}>+ Add reward</button>
            </div>

            <hr style={{ margin: "24px 0" }} />
            <button style={{ color: "crimson" }}
              onClick={async () => {
                if (!confirm(`Delete milestone "${selected.title}"?`)) return;
                await fetch(`${API}/api/admin/milestones/${selected.id}`, { method: "DELETE", headers: headers() });
                setSelected(null);
                await load();
              }}>
              Delete milestone
            </button>
          </>
        )}
      </main>
    </div>
  );
}
```

---

# 4. PUSH-TOKEN COVERAGE PANEL — `LunaPushCoverage.tsx`

## 4.1 Why this exists

We just (2026-04-26) fixed a bug where the Expo app was registering push tokens **before** auth resolved → backend silently rejected with 401 → no user ever ended up with a `push_token` in their user document → Lovable broadcasts saw `audience_size: 0`.

This panel surfaces, in real time, **how many users have a registered token** so you can verify the EAS-rebuild rollout is landing. Once you see numbers climbing it means real users are getting the new app version.

## 4.2 Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notifications/push-status` | Single-user status (calls itself with admin's JWT — useful for self-test) |
| GET | `/api/admin/users/push-coverage` | **NEEDS BACKEND ENDPOINT — see §4.4** |

## 4.3 UX requirements

A single page with three tiles + a table:

**Tile 1** — *Total users:* count of all users.
**Tile 2** — *Registered:* count where `push_token` exists.
**Tile 3** — *Coverage %:* `registered / total` × 100, color-coded:
- < 30% → red (rebuild not rolled out)
- 30–70% → amber
- 70%+ → green

Below the tiles, a 25-row table of the most-recent registrations (`user_email · device_type · last_updated · token prefix`) with a search box.

A "**Re-check my own token**" button at the bottom that calls `/api/notifications/push-status` and prints the JSON in a panel — useful for the admin to verify their own device.

## 4.4 Backend endpoint (✅ shipped 2026-04-26)

Already live at `GET /api/admin/users/push-coverage` — no extra backend work needed. Reference signature:

```
GET /api/admin/users/push-coverage?limit=25
Authorization: Bearer <admin JWT>

→ {
  "total_users": 103,
  "registered_users": 1,
  "coverage_pct": 1.0,
  "recent_registrations": [
    {
      "user_id": "...",
      "email": "...",
      "name": "...",
      "push_device_type": "ios",
      "push_token_updated_at": "2026-04-26T07:11:35.931Z",
      "push_token_prefix": "ExponentPushToken[QA-FAKE…"
    }
  ]
}
```

`limit` clamps between 1 and 200 (default 25).

## 4.5 Skeleton

```tsx
// LunaPushCoverage.tsx
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_LUNA_API_URL;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("luna_admin_token") || ""}` });

type Coverage = {
  total_users: number;
  registered_users: number;
  coverage_pct: number;
  recent_registrations: Array<{
    user_id: string; email?: string; name?: string;
    push_device_type?: string; push_token_updated_at?: string;
    push_token_prefix?: string;
  }>;
};

export default function LunaPushCoverage() {
  const [c, setC] = useState<Coverage | null>(null);
  const [my, setMy] = useState<any>(null);
  const [search, setSearch] = useState("");

  async function load() {
    const r = await fetch(`${API}/api/admin/users/push-coverage`, { headers: headers() });
    if (r.ok) setC(await r.json());
  }
  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, []);

  async function checkMe() {
    const r = await fetch(`${API}/api/notifications/push-status`, { headers: headers() });
    setMy(await r.json());
  }

  if (!c) return <div style={{ padding: 24 }}>Loading…</div>;

  const colour =
    c.coverage_pct >= 70 ? "#198038"
    : c.coverage_pct >= 30 ? "#cd7f32"
    : "#c0392b";

  const rows = (c.recent_registrations || []).filter(r =>
    !search || (r.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Push Token Coverage</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "16px 0" }}>
        <Tile label="Total users" value={c.total_users.toLocaleString()} />
        <Tile label="Registered" value={c.registered_users.toLocaleString()} />
        <Tile label="Coverage" value={`${c.coverage_pct}%`} color={colour} />
      </div>

      <input placeholder="Search email…" value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: 300, padding: 6, marginBottom: 8 }} />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><th align="left">Email</th><th>Name</th><th>Device</th><th>Updated</th><th>Token prefix</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.user_id} style={{ borderTop: "1px solid #eee" }}>
              <td>{r.email}</td><td>{r.name}</td>
              <td>{r.push_device_type ?? "—"}</td>
              <td>{r.push_token_updated_at ? new Date(r.push_token_updated_at).toLocaleString() : "—"}</td>
              <td><code>{r.push_token_prefix}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: "24px 0" }} />
      <button onClick={checkMe}>Re-check my own token</button>
      {my && <pre style={{ background: "#fafafa", padding: 12, marginTop: 12 }}>{JSON.stringify(my, null, 2)}</pre>}
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "#fafafa", padding: 16, borderRadius: 8, textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "#666", letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || "#111" }}>{value}</div>
    </div>
  );
}
```

---

# 5. INTEGRATION FLOW DIAGRAMS (so Lovable understands the data flow)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MISSION TRIGGER FLOW                             │
└──────────────────────────────────────────────────────────────────────┘

  STAFF Quick-Award (Eclipse, $50, drinks)
      │
      ▼
  POST /api/perks/quick-award
      │
      ├─► points_service · award points → SwiftPOS sync
      │
      └─► services.mission_events.emit_mission_event(
              user_id, "purchase_amount", increment=50,
              venue_id="eclipse", category="drinks"
          )
                │
                ▼
         For each ACTIVE mission with event_type == "purchase_amount"
              and event_filter ⊆ payload:
                progress += 50
                if progress >= target: mark completed (one-shot)


┌──────────────────────────────────────────────────────────────────────┐
│                      LOVABLE TEST-FIRE FLOW                           │
└──────────────────────────────────────────────────────────────────────┘

  Admin clicks "Test trigger" on a mission row
      │
      ▼
  POST /api/admin/missions/test-fire
      │  body: { event_type, increment, ...filter_keys }
      │
      ▼
  Same emit_mission_event(...)
      │
      ▼
  Returns { newly_completed[], progress[] for ALL missions matching event_type }


┌──────────────────────────────────────────────────────────────────────┐
│                      MILESTONE CLAIM FLOW                             │
└──────────────────────────────────────────────────────────────────────┘

  Member taps "Claim" on a milestone (mobile app)
      │
      ▼
  POST /api/milestones/claim/{milestone_id}
      │
      ├─► Loads from db.milestones_custom FIRST (Lovable-edited).
      │   Falls back to hardcoded MILESTONES only if missing.
      │
      ├─► Server re-checks user.points_balance >= points_required
      │
      └─► For each reward, generates HMAC-SHA256-signed QR
              (LUNA-TKT-<id8>-<sig10>) and persists into milestone_tickets.
              QRs are atomic single-use — DELETE on validation.
```

---

# 6. ENVIRONMENT NOTES

- **Same JWT** as the existing Lovable admin portal — no new auth wiring.
- **CORS**: backend allows `*` on `/api/admin/*`. No change needed.
- **Rate limiting**: `/api/admin/missions/test-fire` has no specific limit; treat it as gentle. If you build a "fire 100 times" stress test, throttle client-side (1 call/sec).
- **Real-time sync**: none of the new endpoints push WebSocket updates. The activity timeline and push-coverage panel poll. Default poll = 30 s; user-tunable.
- **Nine canonical venue IDs** (use this exact list everywhere there's a `venue_id` filter):
  ```
  eclipse, after_dark, pump, mamacita, juju,
  night_market, ember_and_ash, su_casa_brisbane, su_casa_gold_coast
  ```
- **Six pre-seeded milestones** (you can rename / re-tier / re-reward them, but do NOT delete `newbie` — it's the default tier badge for every new signup):
  ```
  newbie         · 0      pts · 0 rewards
  rising_star    · 500    pts · 5 rewards
  vip_status     · 1,000  pts · 14 rewards
  luna_elite     · 5,000  pts · 26 rewards
  supernova      · 10,000 pts · 42 rewards
  legend         · 25,000 pts · 62 rewards
  ```

---

# 7. CHECKLIST FOR THE LOVABLE BUILDER

- [ ] Add `LunaMissionsEditor.tsx` and route `/missions`
- [ ] Add `LunaMissionActivity.tsx` and route `/missions/activity`
- [ ] Add `LunaMilestonesEditor.tsx` and route `/milestones`
- [ ] Add `LunaPushCoverage.tsx` and route `/push-coverage`
- [ ] Add navigation links to the 4 new pages from the dashboard home
- [ ] Confirm `Authorization: Bearer ${luna_admin_token}` header is on every fetch
- [ ] Confirm error toasts display the API's `detail` field on 4xx
- [ ] Verify the Test-fire button on a mission row works against the backend
- [x] **Backend ready:** `/api/admin/users/push-coverage` is shipped (2026-04-26) — Push Coverage page works day-1

---

*This document was generated 2026-04-26 alongside the matching backend changes (CHANGELOG.md). Keep it co-located with `LUNA_LOVABLE_MASTER_PROMPT.md`. When the backend ships further admin endpoints, append a new dated section.*
