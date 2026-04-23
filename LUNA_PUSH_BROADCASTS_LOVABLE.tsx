/**
 * LUNA PUSH BROADCASTS — Lovable Admin Portal Component
 * =====================================================
 * Drop into Lovable (e.g. `src/pages/Broadcasts.tsx`). Gives ops full CRUD
 * over Expo push broadcasts: compose, preview audience, save draft, schedule,
 * send now, send test, delete, track opens/clicks.
 *
 * Setup (same as LunaSafetyAlerts + CherryHub components):
 *   1. env: VITE_LUNA_API_URL=https://luna-production-889c.up.railway.app
 *   2. After admin login, store JWT: localStorage.setItem('luna_admin_token', token)
 *
 * Endpoints used:
 *   GET    /api/admin/push-broadcasts?status=...
 *   POST   /api/admin/push-broadcasts
 *   GET    /api/admin/push-broadcasts/:id
 *   PUT    /api/admin/push-broadcasts/:id
 *   DELETE /api/admin/push-broadcasts/:id
 *   POST   /api/admin/push-broadcasts/:id/send
 *   POST   /api/admin/push-broadcasts/:id/test
 *   GET    /api/admin/push-broadcasts/audience-preview?audience=...
 *   GET    /api/admin/push-broadcasts/users-search?q=...
 *
 * Audience syntax:
 *   - "all"                      → everyone with a push token
 *   - "subscribers"              → silver/gold tiers
 *   - "tier:<name>"              → lunar | eclipse | aurora (or bronze/silver/gold)
 *   - "venue:<venue_id>"         → favourited OR visited that venue
 *   - "user:<email or user_id>"  → single user
 *   - "users:<id1,id2,id3>"      → comma-separated user_ids (max 50)
 *
 * ⚠️  Real push delivery requires users to have installed a TestFlight or
 * App-Store build. Expo Go produces sandbox tokens. The "Reachable" column
 * shows how many users in the audience actually have a token stored.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  (import.meta as any)?.env?.VITE_LUNA_API_URL ||
  "https://luna-production-889c.up.railway.app";

const LUNA_VENUES = [
  { id: "eclipse", label: "Eclipse" },
  { id: "after_dark", label: "After Dark" },
  { id: "lola_lo", label: "Lola Lo" },
  { id: "mr_percivals", label: "Mr Percival's" },
  { id: "lucky_fox", label: "Lucky Fox" },
];

type Broadcast = {
  id: string;
  title: string;
  body: string;
  audience: string;
  audience_label?: string;
  audience_size: number;
  deep_link?: string;
  image_url?: string | null;
  status: "draft" | "scheduled" | "dispatching" | "sent";
  scheduled_for?: string | null;
  sent_at?: string | null;
  opened: number;
  clicked: number;
  created_at: string;
  updated_at: string;
};

type UserSearchResult = {
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  tier?: string;
  picture?: string | null;
};

const getToken = () =>
  (typeof window !== "undefined" && localStorage.getItem("luna_admin_token")) || null;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", hour12: false }) : "—";

// ---------- Audience Picker ----------

type AudienceMode = "all" | "subscribers" | "tier" | "venue" | "user" | "users";

const AudiencePicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  // Decode the string audience back into (mode, extra)
  const decoded: { mode: AudienceMode; extra: string } = useMemo(() => {
    if (value === "all") return { mode: "all", extra: "" };
    if (value === "subscribers") return { mode: "subscribers", extra: "" };
    if (value.startsWith("tier:")) return { mode: "tier", extra: value.slice(5) };
    if (value.startsWith("venue:")) return { mode: "venue", extra: value.slice(6) };
    if (value.startsWith("user:")) return { mode: "user", extra: value.slice(5) };
    if (value.startsWith("users:")) return { mode: "users", extra: value.slice(6) };
    return { mode: "all", extra: "" };
  }, [value]);

  const [mode, setMode] = useState<AudienceMode>(decoded.mode);
  const [extra, setExtra] = useState(decoded.extra);

  // User search state (for mode=user and mode=users)
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [pickedUsers, setPickedUsers] = useState<UserSearchResult[]>([]);
  const debounceRef = useRef<number | undefined>();

  useEffect(() => {
    setMode(decoded.mode);
    setExtra(decoded.extra);
  }, [decoded.mode, decoded.extra]);

  useEffect(() => {
    // Update parent audience string when mode/extra changes
    let nextAudience = "all";
    if (mode === "all") nextAudience = "all";
    else if (mode === "subscribers") nextAudience = "subscribers";
    else if (mode === "tier" && extra) nextAudience = `tier:${extra}`;
    else if (mode === "venue" && extra) nextAudience = `venue:${extra}`;
    else if (mode === "user" && extra) nextAudience = `user:${extra}`;
    else if (mode === "users" && pickedUsers.length)
      nextAudience = `users:${pickedUsers.map((u) => u.user_id).join(",")}`;
    onChange(nextAudience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, extra, pickedUsers]);

  // Typeahead search
  useEffect(() => {
    if (mode !== "user" && mode !== "users") return;
    if (searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r: { users: UserSearchResult[] } = await api(
          `/api/admin/push-broadcasts/users-search?q=${encodeURIComponent(searchQ)}`,
        );
        setSearchResults(r.users);
      } catch (_) {
        setSearchResults([]);
      }
    }, 220);
  }, [searchQ, mode]);

  return (
    <div style={styles.audienceBox}>
      <div style={styles.segmentRow}>
        {(["all", "subscribers", "tier", "venue", "user", "users"] as AudienceMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{ ...styles.segment, ...(mode === m ? styles.segmentActive : {}) }}
          >
            {m === "user" ? "1 user" : m === "users" ? "multi" : m}
          </button>
        ))}
      </div>

      {mode === "tier" && (
        <select value={extra} onChange={(e) => setExtra(e.target.value)} style={styles.input}>
          <option value="">Select tier…</option>
          <option value="lunar">Lunar (free)</option>
          <option value="eclipse">Eclipse (silver)</option>
          <option value="aurora">Aurora (gold)</option>
        </select>
      )}
      {mode === "venue" && (
        <select value={extra} onChange={(e) => setExtra(e.target.value)} style={styles.input}>
          <option value="">Select venue…</option>
          {LUNA_VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      )}
      {mode === "user" && (
        <>
          <input
            placeholder="Type name, email or phone (min 2 chars)…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={styles.input}
          />
          {searchResults.length > 0 && (
            <div style={styles.searchDrop}>
              {searchResults.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => {
                    setExtra(u.email || u.user_id);
                    setSearchQ(`${u.name} · ${u.email || u.user_id}`);
                    setSearchResults([]);
                  }}
                  style={styles.searchItem}
                >
                  <strong>{u.name}</strong>
                  <span style={styles.dim}> · {u.email || u.phone || u.user_id}</span>
                  {u.tier && <span style={styles.tierChip}>{u.tier}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {mode === "users" && (
        <>
          <input
            placeholder="Search and click to add (max 50)…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={styles.input}
          />
          {searchResults.length > 0 && (
            <div style={styles.searchDrop}>
              {searchResults.map((u) => {
                const already = pickedUsers.some((p) => p.user_id === u.user_id);
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    disabled={already || pickedUsers.length >= 50}
                    onClick={() => {
                      if (already) return;
                      setPickedUsers([...pickedUsers, u]);
                      setSearchQ("");
                      setSearchResults([]);
                    }}
                    style={{ ...styles.searchItem, opacity: already ? 0.4 : 1 }}
                  >
                    <strong>{u.name}</strong>
                    <span style={styles.dim}> · {u.email || u.phone || u.user_id}</span>
                    {already && <span style={styles.dim}> (added)</span>}
                  </button>
                );
              })}
            </div>
          )}
          {pickedUsers.length > 0 && (
            <div style={styles.chipRow}>
              {pickedUsers.map((u) => (
                <span key={u.user_id} style={styles.chip}>
                  {u.name || u.email}
                  <button
                    type="button"
                    onClick={() => setPickedUsers(pickedUsers.filter((p) => p.user_id !== u.user_id))}
                    style={styles.chipX}
                  >
                    ×
                  </button>
                </span>
              ))}
              <span style={styles.dim}>{pickedUsers.length}/50</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------- Composer ----------

type ComposerProps = {
  initial?: Partial<Broadcast>;
  onDone: () => void;
  onCancel: () => void;
};

const Composer = ({ initial, onDone, onCancel }: ComposerProps) => {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [audience, setAudience] = useState(initial?.audience || "all");
  const [deepLink, setDeepLink] = useState(initial?.deep_link || "home");
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [scheduledFor, setScheduledFor] = useState(
    initial?.scheduled_for
      ? new Date(initial.scheduled_for).toISOString().slice(0, 16) // datetime-local format
      : "",
  );
  const [preview, setPreview] = useState<{ user_count: number; with_push_token_count: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Audience preview debounce
  useEffect(() => {
    if (!audience) return;
    const t = window.setTimeout(async () => {
      try {
        const p = await api<any>(
          `/api/admin/push-broadcasts/audience-preview?audience=${encodeURIComponent(audience)}`,
        );
        setPreview(p);
      } catch (_) {
        setPreview(null);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [audience]);

  const save = async (status: "draft" | "scheduled" | "sent") => {
    setErr(null);
    if (!title.trim() || !body.trim()) {
      setErr("Title and body are required");
      return;
    }
    if (audience.startsWith("users:") && audience.split(":")[1].split(",").length > 50) {
      setErr("Multi-user audience capped at 50 users");
      return;
    }
    if (status === "scheduled" && !scheduledFor) {
      setErr("Pick a schedule time first");
      return;
    }
    setBusy(status);
    try {
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        audience,
        deep_link: deepLink.trim() || "home",
        image_url: imageUrl.trim() || null,
        status,
      };
      if (status === "scheduled") {
        // Convert local datetime string to ISO with timezone
        payload.scheduled_for = new Date(scheduledFor).toISOString();
      }

      if (initial?.id) {
        await api(`/api/admin/push-broadcasts/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (status === "sent" && initial.status !== "sent") {
          await api(`/api/admin/push-broadcasts/${initial.id}/send`, { method: "POST" });
        }
      } else {
        await api(`/api/admin/push-broadcasts`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setErr(null);
    if (!initial?.id) {
      setErr("Save as draft first, then you can send a test.");
      return;
    }
    setBusy("test");
    try {
      const r: any = await api(`/api/admin/push-broadcasts/${initial.id}/test`, { method: "POST" });
      alert(`Test sent to ${r.tokens_used} device(s) on your admin account.`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={styles.composerWrap}>
      <div style={styles.composerHeader}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
          {initial?.id ? "Edit broadcast" : "New broadcast"}
        </h2>
        <button onClick={onCancel} style={styles.btnGhost}>
          Close
        </button>
      </div>

      <label style={styles.k}>TITLE <span style={styles.dim}>({title.length}/65)</span></label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 65))}
        placeholder="e.g. Tonight at Eclipse — 2-for-1 until 11pm"
        style={styles.input}
      />

      <label style={styles.k}>BODY <span style={styles.dim}>({body.length}/178)</span></label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 178))}
        placeholder="Short, punchy. Tap to open the app."
        rows={3}
        style={{ ...styles.input, resize: "vertical" }}
      />

      <label style={styles.k}>AUDIENCE</label>
      <AudiencePicker value={audience} onChange={setAudience} />
      {preview && (
        <div style={styles.previewChip}>
          🎯 Reaches <strong>{preview.with_push_token_count}</strong> of{" "}
          <strong>{preview.user_count}</strong> users with an active push token
          {preview.with_push_token_count === 0 && (
            <span style={{ color: "#ff8a5b", marginLeft: 8 }}>
              ⚠️ 0 recipients — ensure users are on a TestFlight or App-Store build
            </span>
          )}
        </div>
      )}

      <div style={styles.twoCol}>
        <div>
          <label style={styles.k}>DEEP LINK (screen name)</label>
          <input
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            placeholder="home"
            style={styles.input}
          />
        </div>
        <div>
          <label style={styles.k}>IMAGE URL (optional)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            style={styles.input}
          />
        </div>
      </div>

      <label style={styles.k}>
        SCHEDULE FOR <span style={styles.dim}>(Brisbane local time, leave blank to send now)</span>
      </label>
      <input
        type="datetime-local"
        value={scheduledFor}
        onChange={(e) => setScheduledFor(e.target.value)}
        style={styles.input}
      />

      {err && <div style={styles.error}>⚠️ {err}</div>}

      <div style={styles.actionRow}>
        <button disabled={!!busy} onClick={() => save("draft")} style={styles.btnGhost}>
          {busy === "draft" ? "…" : "Save draft"}
        </button>
        <button
          disabled={!!busy || !initial?.id}
          onClick={sendTest}
          style={styles.btnGhost}
          title={initial?.id ? "" : "Save as draft first"}
        >
          {busy === "test" ? "…" : "Send test to me"}
        </button>
        <button disabled={!!busy} onClick={() => save("scheduled")} style={styles.btnSecondary}>
          {busy === "scheduled" ? "…" : "Schedule"}
        </button>
        <button disabled={!!busy} onClick={() => save("sent")} style={styles.btnPrimary}>
          {busy === "sent" ? "…" : "Send now"}
        </button>
      </div>
    </div>
  );
};

// ---------- Main list + shell ----------

type StatusTab = "all" | "draft" | "scheduled" | "sent";

export default function LunaPushBroadcasts() {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Broadcast> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusTab === "all" ? "" : `?status=${statusTab}`;
      const r: { broadcasts: Broadcast[] } = await api(`/api/admin/push-broadcasts${q}`);
      setRows(r.broadcasts || []);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this broadcast? This can't be undone.")) return;
    try {
      await api(`/api/admin/push-broadcasts/${id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>LUNA · PUSH</div>
          <h1 style={styles.title}>Push Broadcasts</h1>
          <p style={styles.sub}>
            Send to everyone, a tier, a venue, or a specific user. Schedule for later in Brisbane time.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={styles.tabs}>
            {(["all", "draft", "scheduled", "sent"] as StatusTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setStatusTab(t)}
                style={{ ...styles.tab, ...(statusTab === t ? styles.tabActive : {}) }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing({})} style={styles.btnPrimary}>
            + New broadcast
          </button>
        </div>
      </header>

      {err && <div style={styles.error}>⚠️ {err}</div>}

      {editing && (
        <Composer
          initial={editing}
          onDone={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div style={styles.empty}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={styles.empty}>No broadcasts yet. Click “+ New broadcast” to create one.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Audience</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Scheduled / Sent</th>
              <th style={styles.th}>Reach</th>
              <th style={styles.th}>Opens / Clicks</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div style={styles.dim}>{r.body.slice(0, 80)}{r.body.length > 80 ? "…" : ""}</div>
                </td>
                <td style={styles.td}>
                  <code style={styles.codeChip}>{r.audience_label || r.audience}</code>
                </td>
                <td style={styles.td}>
                  <span style={statusStyle(r.status)}>{r.status.toUpperCase()}</span>
                </td>
                <td style={styles.td}>
                  {r.status === "scheduled" && fmt(r.scheduled_for)}
                  {r.status === "sent" && fmt(r.sent_at)}
                  {(r.status === "draft" || r.status === "dispatching") && "—"}
                </td>
                <td style={styles.td}>{r.audience_size}</td>
                <td style={styles.td}>
                  {r.opened}/{r.clicked}
                  {r.audience_size > 0 && r.status === "sent" && (
                    <div style={styles.dim}>
                      {Math.round((100 * r.opened) / Math.max(r.audience_size, 1))}% /{" "}
                      {Math.round((100 * r.clicked) / Math.max(r.audience_size, 1))}%
                    </div>
                  )}
                </td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setEditing(r)}
                      disabled={r.status === "sent"}
                      style={styles.btnGhostSmall}
                    >
                      {r.status === "sent" ? "View" : "Edit"}
                    </button>
                    <button onClick={() => handleDelete(r.id)} style={styles.btnDangerSmall}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Styles ----------

const statusStyle = (s: string): any => {
  const base = {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    padding: "3px 9px",
    borderRadius: 999,
    border: "1px solid",
  };
  if (s === "sent") return { ...base, background: "#123524", color: "#7dd4a0", borderColor: "#2a7a4b" };
  if (s === "scheduled") return { ...base, background: "#2b1e4a", color: "#c4b5fd", borderColor: "#8B5CF6" };
  if (s === "draft") return { ...base, background: "#14141c", color: "#9a9aa8", borderColor: "#33333e" };
  return { ...base, background: "#3a2a05", color: "#FFD700", borderColor: "#FFD70055" };
};

const styles: Record<string, any> = {
  wrap: {
    background: "#08080E",
    color: "#F4F4F6",
    minHeight: "100vh",
    padding: "28px 32px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 24,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  eyebrow: { fontSize: 11, letterSpacing: 3, color: "#8B5CF6", fontWeight: 800, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 },
  sub: { margin: "6px 0 0 0", color: "#9A9AA8", fontSize: 13 },
  tabs: { display: "flex", gap: 6, background: "#14141C", padding: 4, borderRadius: 999 },
  tab: {
    background: "transparent", color: "#9A9AA8", border: "none",
    padding: "8px 14px", borderRadius: 999, cursor: "pointer",
    fontWeight: 700, fontSize: 11, letterSpacing: 1.5,
  },
  tabActive: { background: "#8B5CF6", color: "white" },
  error: { background: "#3a1010", color: "#ffb0b0", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 },
  empty: { textAlign: "center", padding: "80px 20px", color: "#6a6a7a", border: "1px dashed #22222c", borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", background: "#0b0b12", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "#6a6a7a", letterSpacing: 1.5, borderBottom: "1px solid #1a1a24" },
  tr: { borderBottom: "1px solid #14141c" },
  td: { padding: "14px", fontSize: 13, verticalAlign: "top" },
  codeChip: {
    fontFamily: "ui-monospace, monospace",
    background: "#14141c", color: "#c4b5fd",
    padding: "3px 8px", borderRadius: 6, border: "1px solid #22222c",
    fontSize: 12,
  },
  dim: { color: "#6a6a7a", fontSize: 12 },
  btnPrimary: {
    background: "#8B5CF6", color: "white", border: "none",
    padding: "10px 18px", borderRadius: 10, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
  },
  btnSecondary: {
    background: "transparent", color: "#c4b5fd", border: "1px solid #8B5CF6",
    padding: "10px 18px", borderRadius: 10, fontWeight: 800, cursor: "pointer",
  },
  btnGhost: {
    background: "#14141c", color: "#F4F4F6", border: "1px solid #22222c",
    padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13,
  },
  btnGhostSmall: {
    background: "#14141c", color: "#F4F4F6", border: "1px solid #22222c",
    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  btnDangerSmall: {
    background: "#1a0a0a", color: "#ff6b6b", border: "1px solid #4a1010",
    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  composerWrap: {
    background: "linear-gradient(180deg, #121218 0%, #0B0B12 100%)",
    border: "1px solid #2a223a", borderRadius: 16, padding: 20, marginBottom: 20,
    display: "flex", flexDirection: "column", gap: 10,
  },
  composerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  k: { fontSize: 10, letterSpacing: 2, color: "#9a9aa8", fontWeight: 800, marginTop: 6 },
  input: {
    background: "#0a0a12", border: "1px solid #22222c", color: "#F4F4F6",
    padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", width: "100%",
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  audienceBox: {
    background: "#0a0a12", border: "1px solid #22222c", borderRadius: 10,
    padding: 10, display: "flex", flexDirection: "column", gap: 8,
  },
  segmentRow: { display: "flex", gap: 4, background: "#14141c", padding: 3, borderRadius: 8 },
  segment: {
    flex: 1, padding: "6px 8px", background: "transparent", color: "#9a9aa8",
    border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
    letterSpacing: 1, textTransform: "uppercase",
  },
  segmentActive: { background: "#8B5CF6", color: "white" },
  searchDrop: {
    background: "#050509", border: "1px solid #22222c", borderRadius: 8,
    maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column",
  },
  searchItem: {
    textAlign: "left", background: "transparent", color: "#F4F4F6", border: "none",
    padding: "8px 10px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #14141c",
  },
  tierChip: {
    fontSize: 9, letterSpacing: 1.5, padding: "2px 6px", borderRadius: 4,
    background: "#FFD70018", color: "#FFD700", border: "1px solid #FFD70040", marginLeft: 6,
  },
  chipRow: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  chip: {
    background: "#2b1e4a", color: "#c4b5fd", padding: "4px 10px",
    borderRadius: 999, fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center",
  },
  chipX: { background: "transparent", border: "none", color: "#c4b5fd", cursor: "pointer", fontWeight: 900 },
  previewChip: {
    background: "#14141c", border: "1px solid #2a223a", borderRadius: 8,
    padding: "8px 12px", fontSize: 12, color: "#c4b5fd",
  },
  actionRow: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" },
};
