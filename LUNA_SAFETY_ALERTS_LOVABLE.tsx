/**
 * LUNA SAFETY ALERTS — Lovable / Admin Portal Component
 * ======================================================
 * Drop this into your Lovable project (e.g. `src/pages/SafetyAlerts.tsx`
 * or as a section inside your existing admin dashboard).
 *
 * It polls the Luna Railway backend every 10 seconds for active Silent SOS
 * alerts, shows each one with the user, GPS coords, Google Maps link, and
 * action buttons to Acknowledge and Resolve. Works for both:
 *   - Luna ops admins (sees all venues)
 *   - Venue managers/staff (sees only their venue; the backend scopes this)
 *
 * REQUIRED SETUP (in your Lovable project):
 * -----------------------------------------
 * 1. Set this env var: `VITE_LUNA_API_URL=https://luna-production-889c.up.railway.app`
 *    (or paste the URL directly where `API_BASE` is defined below)
 *
 * 2. Store the admin's JWT token after they log in, using whatever pattern
 *    your Lovable app already uses. This component expects to find it at:
 *        localStorage.getItem('luna_admin_token')
 *    If you store it differently, adjust the `getToken()` helper below.
 *
 * 3. Log in via `POST {API_BASE}/api/auth/login` with
 *    `{email, password}` — response contains `{token, user}`. Persist the token.
 *
 * ENDPOINTS USED (all behind Bearer auth):
 * ----------------------------------------
 *   GET  /api/admin/safety/alerts?status=active|resolved|all&hours=48
 *   GET  /api/admin/safety/alerts/:id
 *   POST /api/admin/safety/alerts/:id/acknowledge   body: {note?: string}
 *   POST /api/admin/safety/alerts/:id/resolve       body: {note?: string}
 *   GET  /api/admin/safety/summary?hours=24
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  (import.meta as any)?.env?.VITE_LUNA_API_URL ||
  "https://luna-production-889c.up.railway.app";

const POLL_INTERVAL_MS = 10_000;

type Alert = {
  id: string;
  user_id: string;
  user_name?: string;
  activation_method?: string;
  status?: string;
  resolved?: boolean;
  message?: string | null;
  location: { latitude: number; longitude: number; link: string } | null;
  venue_id?: string | null;
  venue_name?: string | null;
  nearest_distance_km?: number | null;
  emergency_contacts_count?: number;
  crew_members_count?: number;
  venue_staff_count?: number;
  admin_count?: number;
  acknowledged_by?: { user_id: string; name?: string; role?: string; note?: string | null; at?: string }[];
  resolved_at?: string;
  resolved_by?: { user_id: string; name?: string; role?: string; note?: string | null };
  created_at: string;
  user?: { user_id: string; name?: string; email?: string; phone?: string; picture?: string | null; tier?: string };
};

type ListResponse = {
  alerts: Alert[];
  counts: { active: number; total_in_window: number; returned: number };
  viewer: { user_id: string; role: string; scope_venue_id: string | null };
};

const getToken = (): string | null =>
  (typeof window !== "undefined" && localStorage.getItem("luna_admin_token")) || null;

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(errBody.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const formatAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
};

const methodLabel = (m?: string) =>
  m === "shake" ? "Shake" : m === "voice" ? "Voice" : m === "widget" ? "Widget" : "Panic button";

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------

export default function LunaSafetyAlerts() {
  const [statusTab, setStatusTab] = useState<"active" | "resolved" | "all">("active");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<ListResponse>(
        `/api/admin/safety/alerts?status=${statusTab}&hours=48&limit=100`,
      );
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
  }, [statusTab]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Force "x ago" labels to refresh every second
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeCount = data?.counts?.active ?? 0;
  const sorted = useMemo(
    () =>
      [...(data?.alerts ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [data, tick],
  );

  const handleAck = async (alertId: string) => {
    setActingId(alertId);
    try {
      await apiFetch(`/api/admin/safety/alerts/${alertId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ note: noteDraft[alertId] || null }),
      });
      await load();
    } catch (e: any) {
      alert(`Ack failed: ${e.message}`);
    } finally {
      setActingId(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!confirm("Mark this safety alert as resolved? The user will be notified.")) return;
    setActingId(alertId);
    try {
      await apiFetch(`/api/admin/safety/alerts/${alertId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ note: noteDraft[alertId] || null }),
      });
      await load();
    } catch (e: any) {
      alert(`Resolve failed: ${e.message}`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>LUNA · SAFETY</div>
          <h1 style={styles.title}>Silent SOS — Live Alerts</h1>
          <p style={styles.sub}>
            Polled every {POLL_INTERVAL_MS / 1000}s · {activeCount} active
            {data?.viewer?.scope_venue_id && (
              <>
                {" · scoped to venue "}
                <strong>{data.viewer.scope_venue_id}</strong>
              </>
            )}
          </p>
        </div>
        <div style={styles.tabs}>
          {(["active", "resolved", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStatusTab(t)}
              style={{
                ...styles.tab,
                ...(statusTab === t ? styles.tabActive : {}),
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {error && <div style={styles.error}>⚠️ {error}</div>}

      {sorted.length === 0 && (
        <div style={styles.empty}>
          <div style={{ fontSize: 28 }}>🟢</div>
          <div style={{ marginTop: 8 }}>
            {statusTab === "active"
              ? "No active safety alerts. All quiet."
              : "No alerts in the last 48 hours."}
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {sorted.map((a) => {
          const isResolved = !!a.resolved;
          const acked = (a.acknowledged_by || []).length > 0;
          const dangerTone = !isResolved && !acked;

          return (
            <article
              key={a.id}
              style={{
                ...styles.card,
                borderColor: isResolved
                  ? "#2a7a4b"
                  : dangerTone
                  ? "#E31837"
                  : "#8B5CF6",
                boxShadow: dangerTone
                  ? "0 0 0 1px #E31837, 0 10px 30px rgba(227,24,55,0.25)"
                  : "0 8px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div style={styles.cardTop}>
                <div style={styles.statusPill(isResolved, acked)}>
                  {isResolved ? "RESOLVED" : acked ? "ACKNOWLEDGED" : "ACTIVE"}
                </div>
                <div style={styles.timestamp}>
                  {formatAgo(a.created_at)} · {new Date(a.created_at).toLocaleTimeString()}
                </div>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.userRow}>
                  {a.user?.picture ? (
                    <img src={a.user.picture} alt="" style={styles.avatar} />
                  ) : (
                    <div style={{ ...styles.avatar, ...styles.avatarFallback }}>
                      {(a.user?.name || a.user_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.userName}>
                      {a.user?.name || a.user_name || "Unknown user"}
                      {a.user?.tier && <span style={styles.tierChip}>{a.user.tier}</span>}
                    </div>
                    <div style={styles.userMeta}>
                      {a.user?.phone ? (
                        <a href={`tel:${a.user.phone}`} style={styles.phoneLink}>
                          📞 {a.user.phone}
                        </a>
                      ) : (
                        <span style={{ opacity: 0.5 }}>no phone</span>
                      )}
                      {a.user?.email && <span style={styles.dim}>· {a.user.email}</span>}
                    </div>
                  </div>
                </div>

                <div style={styles.detailGrid}>
                  <div>
                    <div style={styles.k}>VENUE</div>
                    <div style={styles.v}>
                      {a.venue_name || "— (outside Luna venues)"}
                      {a.nearest_distance_km != null && (
                        <span style={styles.dim}> · {a.nearest_distance_km.toFixed(2)} km</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={styles.k}>METHOD</div>
                    <div style={styles.v}>{methodLabel(a.activation_method)}</div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={styles.k}>LOCATION</div>
                    {a.location ? (
                      <div style={styles.v}>
                        <a
                          href={a.location.link}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.mapLink}
                        >
                          📍 {a.location.latitude.toFixed(6)}, {a.location.longitude.toFixed(6)}
                        </a>
                        <span style={styles.dim}> — opens in Google Maps</span>
                      </div>
                    ) : (
                      <div style={styles.v}>
                        <span style={{ opacity: 0.5 }}>No GPS supplied</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={styles.k}>NOTIFIED</div>
                    <div style={styles.v}>
                      👥 {a.crew_members_count ?? 0} crew · 🏢 {a.venue_staff_count ?? 0} venue ·
                      🛡️ {a.admin_count ?? 0} admin
                    </div>
                  </div>
                  <div>
                    <div style={styles.k}>EMERGENCY CONTACTS</div>
                    <div style={styles.v}>{a.emergency_contacts_count ?? 0} on file</div>
                  </div>
                </div>

                {a.acknowledged_by && a.acknowledged_by.length > 0 && (
                  <div style={styles.ackBox}>
                    <div style={styles.k}>ACKNOWLEDGED BY</div>
                    {a.acknowledged_by.map((ack, i) => (
                      <div key={i} style={styles.ackItem}>
                        <strong>{ack.name || ack.user_id}</strong>{" "}
                        <span style={styles.dim}>({ack.role})</span>
                        {ack.at && <span style={styles.dim}> · {formatAgo(ack.at)}</span>}
                        {ack.note && <div style={styles.ackNote}>“{ack.note}”</div>}
                      </div>
                    ))}
                  </div>
                )}

                {a.resolved && a.resolved_by && (
                  <div style={{ ...styles.ackBox, borderColor: "#2a7a4b" }}>
                    <div style={styles.k}>RESOLVED BY</div>
                    <div style={styles.ackItem}>
                      <strong>{a.resolved_by.name || a.resolved_by.user_id}</strong>{" "}
                      <span style={styles.dim}>({a.resolved_by.role})</span>
                      {a.resolved_at && <span style={styles.dim}> · {formatAgo(a.resolved_at)}</span>}
                      {a.resolved_by.note && <div style={styles.ackNote}>“{a.resolved_by.note}”</div>}
                    </div>
                  </div>
                )}
              </div>

              {!isResolved && (
                <div style={styles.cardFooter}>
                  <input
                    placeholder="Note (optional) — shown in the ops log"
                    value={noteDraft[a.id] || ""}
                    onChange={(e) => setNoteDraft((s) => ({ ...s, [a.id]: e.target.value }))}
                    style={styles.input}
                  />
                  <div style={styles.actionRow}>
                    {!acked && (
                      <button
                        onClick={() => handleAck(a.id)}
                        disabled={actingId === a.id}
                        style={{ ...styles.btn, ...styles.btnAck }}
                      >
                        {actingId === a.id ? "…" : "Acknowledge"}
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(a.id)}
                      disabled={actingId === a.id}
                      style={{ ...styles.btn, ...styles.btnResolve }}
                    >
                      {actingId === a.id ? "…" : "Mark Resolved"}
                    </button>
                    {a.user?.phone && (
                      <a href={`tel:${a.user.phone}`} style={{ ...styles.btn, ...styles.btnCall }}>
                        Call user
                      </a>
                    )}
                    {a.location && (
                      <a
                        href={a.location.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...styles.btn, ...styles.btnMap }}
                      >
                        Open map
                      </a>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Inline styles (keeps this component drop-in-anywhere)
// ------------------------------------------------------------

const styles: Record<string, any> = {
  wrap: {
    background: "#08080E",
    color: "#F4F4F6",
    minHeight: "100vh",
    padding: "28px 32px",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 24,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#E31837",
    fontWeight: 800,
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 },
  sub: { margin: "6px 0 0 0", color: "#9A9AA8", fontSize: 13 },
  tabs: { display: "flex", gap: 6, background: "#14141C", padding: 4, borderRadius: 999 },
  tab: {
    background: "transparent",
    color: "#9A9AA8",
    border: "none",
    padding: "8px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  tabActive: { background: "#E31837", color: "white" },
  error: {
    background: "#3a1010",
    color: "#ffb0b0",
    padding: "10px 14px",
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    padding: "80px 20px",
    color: "#6a6a7a",
    border: "1px dashed #22222c",
    borderRadius: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
    gap: 16,
  },
  card: {
    background: "linear-gradient(180deg, #121218 0%, #0B0B12 100%)",
    border: "1px solid #22222c",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  statusPill: (isResolved: boolean, acked: boolean) => ({
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 2,
    padding: "5px 10px",
    borderRadius: 999,
    background: isResolved ? "#123524" : acked ? "#2b1e4a" : "#4a0e18",
    color: isResolved ? "#7dd4a0" : acked ? "#c4b5fd" : "#ffb3c0",
    border: `1px solid ${isResolved ? "#2a7a4b" : acked ? "#8B5CF6" : "#E31837"}`,
  }),
  timestamp: { fontSize: 12, color: "#7a7a8a", fontVariantNumeric: "tabular-nums" },
  cardBody: { display: "flex", flexDirection: "column", gap: 14 },
  userRow: { display: "flex", gap: 12, alignItems: "center" },
  avatar: {
    width: 44, height: 44, borderRadius: "50%", objectFit: "cover",
    border: "2px solid #2a2a38", flexShrink: 0,
  },
  avatarFallback: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#1e1e2a", color: "#F4F4F6", fontWeight: 800,
  },
  userName: { fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 8 },
  tierChip: {
    fontSize: 9, letterSpacing: 1.5, padding: "3px 7px", borderRadius: 4,
    background: "#FFD70018", color: "#FFD700", fontWeight: 700,
    border: "1px solid #FFD70040",
  },
  userMeta: { fontSize: 12, color: "#9a9aa8", display: "flex", gap: 6, flexWrap: "wrap" },
  phoneLink: { color: "#60a5fa", textDecoration: "none" },
  dim: { color: "#6a6a7a" },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    background: "#0a0a12",
    border: "1px solid #1a1a24",
    borderRadius: 10,
    padding: 12,
  },
  k: {
    fontSize: 9, letterSpacing: 2, color: "#6a6a7a", fontWeight: 800, marginBottom: 3,
  },
  v: { fontSize: 13, color: "#F4F4F6", wordBreak: "break-word" },
  mapLink: { color: "#60a5fa", textDecoration: "none", fontFamily: "ui-monospace, monospace" },
  ackBox: {
    background: "#0a0a12",
    border: "1px solid #2a223a",
    borderRadius: 10,
    padding: 12,
  },
  ackItem: { fontSize: 13, marginTop: 4 },
  ackNote: { marginTop: 4, color: "#c4b5fd", fontStyle: "italic", fontSize: 12 },
  cardFooter: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 8,
    borderTop: "1px solid #1a1a24",
  },
  input: {
    background: "#14141c",
    border: "1px solid #22222c",
    color: "#F4F4F6",
    padding: "9px 11px",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
  },
  actionRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  btn: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1px solid #22222c",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    letterSpacing: 0.3,
  },
  btnAck: { background: "#8B5CF6", color: "white", borderColor: "#8B5CF6" },
  btnResolve: { background: "#0f2e1f", color: "#7dd4a0", borderColor: "#2a7a4b" },
  btnCall: { background: "#14141c", color: "#60a5fa", borderColor: "#22222c" },
  btnMap: { background: "#14141c", color: "#F4F4F6", borderColor: "#22222c" },
};
