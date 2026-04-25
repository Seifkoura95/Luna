/**
 * LUNA PAYMENTS DIAGNOSTICS — Lovable Admin Portal Component
 * ==========================================================
 * Drop into Lovable at `src/components/LunaPaymentsDiagnostics.tsx`. Wires up
 * the four /api/admin/payments/* endpoints plus a one-click synthetic webhook
 * fire so ops can verify Stripe wiring without curl.
 *
 * Setup (identical pattern to the other Luna admin components):
 *   1. env: VITE_LUNA_API_URL=https://luna-production-889c.up.railway.app
 *   2. After admin login: localStorage.setItem('luna_admin_token', token)
 *
 * Endpoints used:
 *   GET  /api/admin/payments/health
 *   GET  /api/admin/payments/webhook-failures?limit=50&skip=0
 *   POST /api/admin/payments/simulate-webhook?event_type=...
 *   POST /api/admin/payments/cleanup-simulations
 */

import { useCallback, useEffect, useState } from "react";

const API_BASE =
  (import.meta as any)?.env?.VITE_LUNA_API_URL ||
  "https://luna-production-889c.up.railway.app";

// ───────── types ─────────
type Health = {
  stripe_mode: "live" | "test" | "unknown";
  config: {
    stripe_api_key: string;
    stripe_webhook_secret: string;
    api_key_configured: boolean;
    webhook_secret_configured: boolean;
  };
  transactions: {
    last_24h_total: number;
    last_24h_paid: number;
    last_24h_pending: number;
    last_7d_total: number;
  };
  webhooks: {
    events_received_24h: number;
    failures_24h: number;
    failures_7d: number;
    last_success: { session_id?: string; webhook_event_type?: string; updated_at?: string; payment_status?: string } | null;
    last_failure: { at?: string; reason?: string; signature_prefix?: string; body_excerpt?: string } | null;
  };
  endpoint_url: string;
  as_of: string;
};

type FailureRow = {
  at: string;
  reason: string;
  signature_prefix?: string;
  body_excerpt?: string;
};

type SimResult = {
  ok: boolean;
  session_id: string;
  event_type: string;
  payment_status: string;
  status: string;
  synthetic_transaction_created: boolean;
  note: string;
  next_step: string;
};

const EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
];

// ───────── API helpers ─────────
const getToken = () =>
  (typeof window !== "undefined" && localStorage.getItem("luna_admin_token")) || null;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ───────── inline styles ─────────
const card: React.CSSProperties = { background: "#111", borderRadius: 14, padding: 18, border: "1px solid #2a2a2a", color: "#fafafa" };
const kpiNum: React.CSSProperties = { fontSize: 26, fontWeight: 700, color: "#fff" };
const kpiLabel: React.CSSProperties = { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1.2 };
const btn: React.CSSProperties = { background: "#fff", color: "#000", border: 0, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { ...btn, background: "transparent", color: "#fafafa", border: "1px solid #333" };
const select: React.CSSProperties = { background: "#0b0b0b", color: "#fafafa", border: "1px solid #2a2a2a", padding: "8px 10px", borderRadius: 8, fontSize: 13 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", color: "#888", fontWeight: 500, padding: "10px 8px", borderBottom: "1px solid #2a2a2a", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #1a1a1a", color: "#dcdcdc", verticalAlign: "top" };

function Pill({ ok, warn, bad, children }: { ok?: boolean; warn?: boolean; bad?: boolean; children: React.ReactNode }) {
  const bg = bad ? "#3a1010" : warn ? "#3a2a10" : ok ? "#10301a" : "#1a1a1a";
  const color = bad ? "#ff6b6b" : warn ? "#ffb347" : ok ? "#5fe29f" : "#aaa";
  return (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
      {children}
    </span>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

// ───────── Component ─────────
export default function LunaPaymentsDiagnostics() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [failuresTotal, setFailuresTotal] = useState(0);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingFailures, setLoadingFailures] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [simEvent, setSimEvent] = useState<string>(EVENT_TYPES[0]);
  const [simSessionId, setSimSessionId] = useState<string>("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      setHealth(await api<Health>(`/api/admin/payments/health`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const loadFailures = useCallback(async () => {
    setLoadingFailures(true);
    try {
      const data = await api<{ total: number; items: FailureRow[] }>(`/api/admin/payments/webhook-failures?limit=20`);
      setFailures(data.items);
      setFailuresTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingFailures(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadFailures();
  }, [loadHealth, loadFailures]);

  const fireSimulation = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const qs = new URLSearchParams({ event_type: simEvent });
      if (simSessionId.trim()) qs.set("session_id", simSessionId.trim());
      const res = await api<SimResult>(`/api/admin/payments/simulate-webhook?${qs}`, { method: "POST" });
      setSimResult(res);
      loadHealth();
    } catch (e: any) {
      setSimResult({ ok: false, session_id: "", event_type: simEvent, payment_status: "", status: "", synthetic_transaction_created: false, note: `Error: ${e.message}`, next_step: "" });
    } finally {
      setSimulating(false);
    }
  };

  const cleanupSimulations = async () => {
    if (!window.confirm("Delete all simulated/test payment_transactions rows?")) return;
    setCleaningUp(true);
    try {
      const res = await api<{ deleted: number }>(`/api/admin/payments/cleanup-simulations`, { method: "POST" });
      setCleanupResult(`Deleted ${res.deleted} simulated row${res.deleted === 1 ? "" : "s"}.`);
      loadHealth();
    } catch (e: any) {
      setCleanupResult(`Error: ${e.message}`);
    } finally {
      setCleaningUp(false);
    }
  };

  if (error && !health) return <div style={{ color: "#ff6b6b", padding: 20 }}>{error}</div>;

  return (
    <div style={{ padding: "24px 28px", background: "#0a0a0a", minHeight: "100vh", color: "#fafafa" }} data-testid="payments-diagnostics-page">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>Payments &amp; Webhook Diagnostics</h1>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          Stripe pipeline health + synthetic webhook tester. Source data: <code>/api/admin/payments/*</code>.
        </div>
      </div>

      {/* TOP STATUS BAR */}
      {health && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Pill ok={health.stripe_mode === "live"} warn={health.stripe_mode === "test"} bad={health.stripe_mode === "unknown"}>
              {health.stripe_mode.toUpperCase()} MODE
            </Pill>
            <Pill ok={health.config.api_key_configured} bad={!health.config.api_key_configured}>
              {health.config.api_key_configured ? "API KEY ✓" : "API KEY MISSING"}
            </Pill>
            <Pill ok={health.config.webhook_secret_configured} bad={!health.config.webhook_secret_configured}>
              {health.config.webhook_secret_configured ? "WEBHOOK SECRET ✓" : "WEBHOOK SECRET MISSING"}
            </Pill>
            {health.webhooks.failures_24h > 0 && <Pill bad>{health.webhooks.failures_24h} FAILURES 24H</Pill>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnSecondary} onClick={() => { loadHealth(); loadFailures(); }} data-testid="payments-refresh-btn">Refresh</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {health && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div style={card} data-testid="kpi-tx-24h">
              <div style={kpiLabel}>Transactions 24h</div>
              <div style={kpiNum}>{health.transactions.last_24h_total.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#5fe29f", marginTop: 4 }}>
                {health.transactions.last_24h_paid} paid · <span style={{ color: "#ffb347" }}>{health.transactions.last_24h_pending} pending</span>
              </div>
            </div>
            <div style={card} data-testid="kpi-tx-7d">
              <div style={kpiLabel}>Transactions 7d</div>
              <div style={kpiNum}>{health.transactions.last_7d_total.toLocaleString()}</div>
            </div>
            <div style={card} data-testid="kpi-webhooks-received">
              <div style={kpiLabel}>Webhook events 24h</div>
              <div style={{ ...kpiNum, color: "#5fe29f" }}>{health.webhooks.events_received_24h.toLocaleString()}</div>
            </div>
            <div style={card} data-testid="kpi-webhook-failures-24h">
              <div style={kpiLabel}>Failures 24h</div>
              <div style={{ ...kpiNum, color: health.webhooks.failures_24h ? "#ff6b6b" : "#fff" }}>{health.webhooks.failures_24h.toLocaleString()}</div>
              {health.webhooks.failures_7d > 0 && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{health.webhooks.failures_7d} failures last 7d</div>
              )}
            </div>
          </div>

          {/* Endpoint URL + last events */}
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={kpiLabel}>Webhook endpoint</div>
                <code style={{ fontSize: 12, color: "#5fe29f", wordBreak: "break-all" }}>{health.endpoint_url}</code>
                <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                  STRIPE_API_KEY: <code>{health.config.stripe_api_key || "—"}</code> · STRIPE_WEBHOOK_SECRET: <code>{health.config.stripe_webhook_secret || "—"}</code>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <div>
                  <span style={{ color: "#888" }}>Last success: </span>
                  {health.webhooks.last_success ? (
                    <>
                      <span style={{ color: "#5fe29f" }}>{health.webhooks.last_success.webhook_event_type}</span>
                      <span style={{ color: "#666", marginLeft: 6 }}>{fmt(health.webhooks.last_success.updated_at)}</span>
                    </>
                  ) : (<span style={{ color: "#666", fontStyle: "italic" }}>none yet</span>)}
                </div>
                <div>
                  <span style={{ color: "#888" }}>Last failure: </span>
                  {health.webhooks.last_failure ? (
                    <>
                      <span style={{ color: "#ff6b6b" }}>{health.webhooks.last_failure.reason?.slice(0, 60)}</span>
                      <span style={{ color: "#666", marginLeft: 6 }}>{fmt(health.webhooks.last_failure.at)}</span>
                    </>
                  ) : (<span style={{ color: "#5fe29f", fontStyle: "italic" }}>none ✓</span>)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SIMULATOR */}
      <div style={{ ...card, marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Simulate webhook</h3>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
          Fire a synthetic event into your handler. Bypasses Stripe entirely — useful for verifying routing + DB updates.
          For real signature verification, also use Stripe Dashboard → Developers → Webhooks → "Send test webhook".
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ ...kpiLabel, marginBottom: 4 }}>Event type</div>
            <select style={select} value={simEvent} onChange={(e) => setSimEvent(e.target.value)} data-testid="sim-event-select">
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ ...kpiLabel, marginBottom: 4 }}>Existing session_id (optional)</div>
            <input
              style={{ ...select, width: "100%" }}
              placeholder="cs_live_… (leave blank to auto-create test row)"
              value={simSessionId}
              onChange={(e) => setSimSessionId(e.target.value)}
              data-testid="sim-session-input"
            />
          </div>
          <button style={btn} onClick={fireSimulation} disabled={simulating} data-testid="sim-fire-btn">
            {simulating ? "Firing…" : "Fire webhook"}
          </button>
          <button style={btnSecondary} onClick={cleanupSimulations} disabled={cleaningUp} data-testid="sim-cleanup-btn">
            {cleaningUp ? "Cleaning…" : "Clean up simulations"}
          </button>
        </div>
        {simResult && (
          <div style={{ marginTop: 14, padding: 12, background: simResult.ok ? "rgba(95,226,159,0.07)" : "rgba(255,107,107,0.07)", borderRadius: 10, border: `1px solid ${simResult.ok ? "#10301a" : "#3a1010"}`, fontSize: 12 }}>
            <div style={{ color: simResult.ok ? "#5fe29f" : "#ff6b6b", fontWeight: 600, marginBottom: 6 }}>
              {simResult.ok ? `✓ ${simResult.event_type} → ${simResult.status}` : "✗ Simulation failed"}
            </div>
            {simResult.session_id && <div style={{ color: "#aaa" }}>session_id: <code>{simResult.session_id}</code></div>}
            {simResult.synthetic_transaction_created && <div style={{ color: "#888", marginTop: 4 }}>Synthetic transaction created (will be deleted by Clean-up).</div>}
            <div style={{ color: "#888", marginTop: 4 }}>{simResult.note}</div>
            {simResult.next_step && <div style={{ color: "#888", marginTop: 4, fontStyle: "italic" }}>{simResult.next_step}</div>}
          </div>
        )}
        {cleanupResult && (
          <div style={{ marginTop: 10, fontSize: 12, color: cleanupResult.startsWith("Error") ? "#ff6b6b" : "#5fe29f" }}>{cleanupResult}</div>
        )}
      </div>

      {/* FAILURES TABLE */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Recent webhook failures</h3>
          <span style={{ fontSize: 12, color: "#888" }}>{failuresTotal} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Reason</th>
                <th style={th}>Sig</th>
                <th style={th}>Body excerpt</th>
              </tr>
            </thead>
            <tbody>
              {loadingFailures && <tr><td style={td} colSpan={4}>Loading…</td></tr>}
              {!loadingFailures && failures.length === 0 && (
                <tr><td style={td} colSpan={4} data-testid="failures-empty">
                  <span style={{ color: "#5fe29f" }}>✓ No failures recorded.</span>
                </td></tr>
              )}
              {failures.map((f, i) => (
                <tr key={i}>
                  <td style={td}>{fmt(f.at)}</td>
                  <td style={{ ...td, color: "#ff6b6b" }}>{f.reason}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#888" }}>{f.signature_prefix || "—"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#666", maxWidth: 320, wordBreak: "break-all" }}>
                    {(f.body_excerpt || "").slice(0, 120)}{(f.body_excerpt || "").length > 120 ? "…" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
