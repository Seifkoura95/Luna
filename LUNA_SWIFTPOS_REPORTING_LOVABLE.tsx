/**
 * LUNA SWIFTPOS REPORTING — Lovable Admin Portal Component
 * ========================================================
 * Drop into Lovable at `src/pages/SwiftPOS.tsx`. Read-only operational view
 * of the Luna ↔ SwiftPOS points pipeline plus a one-click retry for pending
 * / failed dispatches.
 *
 * Setup (identical to LunaSafetyAlerts + PushBroadcasts):
 *   1. env: VITE_LUNA_API_URL=https://luna-production-889c.up.railway.app
 *   2. After admin login, store JWT: localStorage.setItem('luna_admin_token', token)
 *      (OR the portal can send X-Luna-Hub-Key server-to-server.)
 *
 * Endpoints used:
 *   GET  /api/admin/swiftpos/summary?range=24h|7d|30d|all
 *   GET  /api/admin/swiftpos/transactions?status=&event_type=&user_id=&range=&limit=&skip=
 *   GET  /api/admin/swiftpos/users?link_status=&q=&limit=&skip=
 *   GET  /api/admin/swiftpos/config
 *   POST /api/admin/swiftpos/retry/:tx_id
 *   POST /api/admin/swiftpos/retry-pending?limit=25
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  (import.meta as any)?.env?.VITE_LUNA_API_URL ||
  "https://luna-production-889c.up.railway.app";

// ───────── types ─────────
type Summary = {
  range: string;
  since: string;
  swiftpos_mock_mode: boolean;
  credentials_configured: boolean;
  users: {
    total: number;
    linked_to_cherryhub: number;
    swiftpos_ready: number;
    link_pending: number;
    unlinked: number;
  };
  transactions: {
    total: number;
    dispatched: number;
    pending: number;
    failed: number;
    pending_all_time: number;
  };
  points: {
    total_awarded: number;
    dispatched_to_swiftpos: number;
    dollar_value_per_point: number;
  };
};

type Transaction = {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_cherryhub_member_key?: string;
  type?: string;
  source?: string;
  event_key?: string;
  total_points?: number;
  multiplier?: number;
  plu?: string;
  reason?: string;
  venue_id?: string;
  dispatched_to_swiftpos?: boolean;
  pending_swiftpos_dispatch?: boolean;
  dispatch_error?: string | null;
  swiftpos_transaction_id?: string;
  retried_at?: string;
  created_at: string;
};

type SwiftUser = {
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  cherryhub_member_key?: string | null;
  swiftpos_customer_id?: string | null;
  swiftpos_link_pending?: boolean;
  points_balance?: number;
  points_balance_refreshed_at?: string | null;
  created_at?: string;
  linked: boolean;
};

type PLU = { event_key: string; plu: string; unit_price: number; name: string; points_per_unit: number };
type Config = {
  mock_mode: boolean;
  base_url: string;
  auth_path: string;
  orders_path: string;
  integrator_name: string;
  credentials: {
    integrator_key: string;
    customer_ref: string;
    client_id: string;
    clerk_id: string;
    clerk_password: string;
  };
  plu_catalog: {
    point_dollar_value: number;
    missions: PLU[];
    rewards: PLU[];
  };
};

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

// ───────── UI primitives ─────────
const card: React.CSSProperties = {
  background: "#111",
  borderRadius: 14,
  padding: 18,
  border: "1px solid #2a2a2a",
  color: "#fafafa",
};
const kpiNum: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: "#fff" };
const kpiLabel: React.CSSProperties = { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1.2 };
const btn: React.CSSProperties = {
  background: "#fff",
  color: "#000",
  border: 0,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: "#fafafa",
  border: "1px solid #333",
};
const select: React.CSSProperties = {
  background: "#0b0b0b",
  color: "#fafafa",
  border: "1px solid #2a2a2a",
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 13,
};
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", color: "#888", fontWeight: 500, padding: "10px 8px", borderBottom: "1px solid #2a2a2a", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 };
const td: React.CSSProperties = { padding: "12px 8px", borderBottom: "1px solid #1a1a1a", color: "#dcdcdc", verticalAlign: "top" };

function Pill({ ok, warn, bad, children }: { ok?: boolean; warn?: boolean; bad?: boolean; children: React.ReactNode }) {
  const bg = bad ? "#3a1010" : warn ? "#3a2a10" : ok ? "#10301a" : "#1a1a1a";
  const color = bad ? "#ff6b6b" : warn ? "#ffb347" : ok ? "#5fe29f" : "#aaa";
  return (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
      {children}
    </span>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ───────── Summary Tab ─────────
function SummaryPanel() {
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Summary>(`/api/admin/swiftpos/summary?range=${range}`);
      setSummary(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleRetryAll = async () => {
    if (!window.confirm("Retry up to 25 oldest pending SwiftPOS dispatches?")) return;
    setRetrying(true);
    setRetryResult(null);
    try {
      const res = await api<{ attempted: number; succeeded: number; failed: number; skipped: number }>(
        `/api/admin/swiftpos/retry-pending?limit=25`,
        { method: "POST" },
      );
      setRetryResult(`Attempted ${res.attempted} · Success ${res.succeeded} · Failed ${res.failed} · Skipped ${res.skipped}`);
      load();
    } catch (e: any) {
      setRetryResult(`Error: ${e.message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (loading && !summary) return <div style={{ color: "#888", padding: 20 }}>Loading SwiftPOS summary…</div>;
  if (error) return <div style={{ color: "#ff6b6b", padding: 20 }}>{error}</div>;
  if (!summary) return null;

  const dollarValue = (summary.points.dispatched_to_swiftpos * summary.points.dollar_value_per_point).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} data-testid="swiftpos-summary-panel">
      {/* top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Pill ok={!summary.swiftpos_mock_mode} warn={summary.swiftpos_mock_mode}>
            {summary.swiftpos_mock_mode ? "MOCK MODE" : "LIVE"}
          </Pill>
          <Pill ok={summary.credentials_configured} bad={!summary.credentials_configured}>
            {summary.credentials_configured ? "CREDS OK" : "CREDS MISSING"}
          </Pill>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select style={select} value={range} onChange={(e) => setRange(e.target.value as any)} data-testid="swiftpos-range-select">
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="all">All time</option>
          </select>
          <button style={btnSecondary} onClick={load} data-testid="swiftpos-refresh-btn">Refresh</button>
        </div>
      </div>

      {/* KPI row: users */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div style={card} data-testid="kpi-users-total">
          <div style={kpiLabel}>Total users</div>
          <div style={kpiNum}>{summary.users.total.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-users-linked">
          <div style={kpiLabel}>Linked to CherryHub</div>
          <div style={kpiNum}>{summary.users.linked_to_cherryhub.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            {summary.users.total ? Math.round((summary.users.linked_to_cherryhub / summary.users.total) * 100) : 0}% coverage
          </div>
        </div>
        <div style={card} data-testid="kpi-users-ready">
          <div style={kpiLabel}>SwiftPOS ready</div>
          <div style={kpiNum}>{summary.users.swiftpos_ready.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-users-pending">
          <div style={kpiLabel}>Link pending</div>
          <div style={kpiNum}>{summary.users.link_pending.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-users-unlinked">
          <div style={kpiLabel}>Unlinked</div>
          <div style={kpiNum}>{summary.users.unlinked.toLocaleString()}</div>
        </div>
      </div>

      {/* KPI row: transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div style={card} data-testid="kpi-tx-total">
          <div style={kpiLabel}>Transactions ({summary.range})</div>
          <div style={kpiNum}>{summary.transactions.total.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-tx-dispatched">
          <div style={kpiLabel}>Dispatched → SwiftPOS</div>
          <div style={{ ...kpiNum, color: "#5fe29f" }}>{summary.transactions.dispatched.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-tx-pending">
          <div style={kpiLabel}>Pending</div>
          <div style={{ ...kpiNum, color: summary.transactions.pending ? "#ffb347" : "#fff" }}>{summary.transactions.pending.toLocaleString()}</div>
          {summary.transactions.pending_all_time > 0 && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              {summary.transactions.pending_all_time} pending all-time
            </div>
          )}
        </div>
        <div style={card} data-testid="kpi-tx-failed">
          <div style={kpiLabel}>Dispatch errors</div>
          <div style={{ ...kpiNum, color: summary.transactions.failed ? "#ff6b6b" : "#fff" }}>{summary.transactions.failed.toLocaleString()}</div>
        </div>
      </div>

      {/* points */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div style={card} data-testid="kpi-points-awarded">
          <div style={kpiLabel}>Points awarded ({summary.range})</div>
          <div style={kpiNum}>{summary.points.total_awarded.toLocaleString()}</div>
        </div>
        <div style={card} data-testid="kpi-points-dispatched">
          <div style={kpiLabel}>Points pushed to SwiftPOS</div>
          <div style={{ ...kpiNum, color: "#5fe29f" }}>{summary.points.dispatched_to_swiftpos.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            ≈ ${dollarValue} ledger cost @ ${summary.points.dollar_value_per_point}/point
          </div>
        </div>
      </div>

      {/* retry all */}
      {summary.transactions.pending_all_time > 0 && (
        <div style={{ ...card, background: "#2a1d0a", borderColor: "#5a3a10" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, color: "#ffb347" }}>
                {summary.transactions.pending_all_time} pending dispatch{summary.transactions.pending_all_time === 1 ? "" : "es"}
              </div>
              <div style={{ fontSize: 12, color: "#c9a76d", marginTop: 4 }}>
                Users that weren't linked at the time, or SwiftPOS was down. Safe to retry.
              </div>
              {retryResult && (
                <div style={{ fontSize: 12, color: "#ffb347", marginTop: 6 }}>{retryResult}</div>
              )}
            </div>
            <button style={btn} onClick={handleRetryAll} disabled={retrying} data-testid="swiftpos-retry-all-btn">
              {retrying ? "Retrying…" : "Retry oldest 25"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Transactions Tab ─────────
function TransactionsPanel() {
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [status, setStatus] = useState<string>("");
  const [eventType, setEventType] = useState<string>("");
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("range", range);
      qs.set("limit", String(limit));
      qs.set("skip", String(skip));
      if (status) qs.set("status", status);
      if (eventType) qs.set("event_type", eventType);
      const data = await api<{ total: number; items: Transaction[] }>(`/api/admin/swiftpos/transactions?${qs}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range, status, eventType, skip]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSkip(0); }, [range, status, eventType]);

  const retryOne = async (id: string) => {
    setRetryingId(id);
    try {
      await api(`/api/admin/swiftpos/retry/${id}`, { method: "POST" });
      await load();
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="swiftpos-transactions-panel">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select style={select} value={range} onChange={(e) => setRange(e.target.value as any)} data-testid="tx-range-select">
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
          <option value="all">All time</option>
        </select>
        <select style={select} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="tx-status-select">
          <option value="">All statuses</option>
          <option value="dispatched">Dispatched</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select style={select} value={eventType} onChange={(e) => setEventType(e.target.value)} data-testid="tx-event-select">
          <option value="">All events</option>
          <option value="mission">Mission</option>
          <option value="reward">Reward</option>
          <option value="referral">Referral</option>
          <option value="birthday">Birthday</option>
          <option value="nightly_crown">Nightly Crown</option>
          <option value="manual">Manual</option>
        </select>
        <span style={{ color: "#888", fontSize: 12, marginLeft: "auto" }}>
          {total.toLocaleString()} result{total === 1 ? "" : "s"}
        </span>
      </div>

      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>User</th>
              <th style={th}>Event</th>
              <th style={th}>Points</th>
              <th style={th}>PLU</th>
              <th style={th}>SwiftPOS</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={td} colSpan={7}>Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td style={td} colSpan={7}>No transactions match these filters.</td></tr>
            )}
            {items.map((tx) => {
              const failed = !!tx.dispatch_error;
              const pending = !!tx.pending_swiftpos_dispatch;
              const dispatched = !!tx.dispatched_to_swiftpos;
              return (
                <tr key={tx.id} data-testid={`tx-row-${tx.id}`}>
                  <td style={td}>{formatDate(tx.created_at)}</td>
                  <td style={td}>
                    <div style={{ color: "#fff", fontWeight: 500 }}>{tx.user_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{tx.user_email}</div>
                  </td>
                  <td style={td}>
                    <div>{tx.source || tx.type || "—"}</div>
                    {tx.event_key && <div style={{ fontSize: 11, color: "#888" }}>{tx.event_key}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ color: (tx.total_points || 0) >= 0 ? "#5fe29f" : "#ff6b6b", fontWeight: 600 }}>
                      {typeof tx.total_points === "number" ? (tx.total_points >= 0 ? "+" : "") + tx.total_points : "—"}
                    </span>
                    {tx.multiplier && tx.multiplier !== 1 && (
                      <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>×{tx.multiplier}</span>
                    )}
                  </td>
                  <td style={td}>{tx.plu || "—"}</td>
                  <td style={td}>
                    {dispatched && <Pill ok>Dispatched</Pill>}
                    {pending && !failed && <Pill warn>Pending</Pill>}
                    {failed && <Pill bad>Failed</Pill>}
                    {!dispatched && !pending && !failed && <span style={{ color: "#666", fontSize: 11 }}>local-only</span>}
                    {tx.swiftpos_transaction_id && (
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{tx.swiftpos_transaction_id}</div>
                    )}
                    {tx.dispatch_error && (
                      <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 4, maxWidth: 260 }}>{tx.dispatch_error}</div>
                    )}
                  </td>
                  <td style={td}>
                    {(pending || failed) && (
                      <button
                        style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12 }}
                        disabled={retryingId === tx.id}
                        onClick={() => retryOne(tx.id)}
                        data-testid={`tx-retry-${tx.id}`}
                      >
                        {retryingId === tx.id ? "…" : "Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          style={btnSecondary}
          disabled={skip === 0}
          onClick={() => setSkip(Math.max(0, skip - limit))}
          data-testid="tx-prev-btn"
        >← Prev</button>
        <span style={{ color: "#666", fontSize: 12 }}>
          {skip + 1}–{Math.min(total, skip + limit)} of {total}
        </span>
        <button
          style={btnSecondary}
          disabled={skip + limit >= total}
          onClick={() => setSkip(skip + limit)}
          data-testid="tx-next-btn"
        >Next →</button>
      </div>
    </div>
  );
}

// ───────── Users Tab ─────────
function UsersPanel() {
  const [linkStatus, setLinkStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [queryInput, setQueryInput] = useState<string>("");
  const [items, setItems] = useState<SwiftUser[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      qs.set("skip", String(skip));
      if (linkStatus) qs.set("link_status", linkStatus);
      if (q) qs.set("q", q);
      const data = await api<{ total: number; items: SwiftUser[] }>(`/api/admin/swiftpos/users?${qs}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [linkStatus, q, skip]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSkip(0); }, [linkStatus, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="swiftpos-users-panel">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select style={select} value={linkStatus} onChange={(e) => setLinkStatus(e.target.value)} data-testid="users-link-select">
          <option value="">All users</option>
          <option value="linked">Linked</option>
          <option value="unlinked">Unlinked</option>
          <option value="pending">Pending link</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setQ(queryInput.trim()); }} style={{ display: "flex", gap: 6 }}>
          <input
            style={{ ...select, minWidth: 220 }}
            placeholder="Search name or email"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            data-testid="users-search-input"
          />
          <button style={btnSecondary} type="submit" data-testid="users-search-btn">Search</button>
          {q && (
            <button type="button" style={btnSecondary} onClick={() => { setQ(""); setQueryInput(""); }}>
              Clear
            </button>
          )}
        </form>
        <span style={{ color: "#888", fontSize: 12, marginLeft: "auto" }}>
          {total.toLocaleString()} user{total === 1 ? "" : "s"}
        </span>
      </div>

      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Status</th>
              <th style={th}>Member key</th>
              <th style={th}>SwiftPOS ID</th>
              <th style={th}>Balance</th>
              <th style={th}>Last refresh</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={td} colSpan={6}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td style={td} colSpan={6}>No users match.</td></tr>}
            {items.map((u) => (
              <tr key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                <td style={td}>
                  <div style={{ color: "#fff", fontWeight: 500 }}>{u.name || "—"}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{u.email}</div>
                </td>
                <td style={td}>
                  {u.linked ? (
                    <Pill ok>Linked</Pill>
                  ) : u.swiftpos_link_pending ? (
                    <Pill warn>Pending</Pill>
                  ) : (
                    <Pill bad>Unlinked</Pill>
                  )}
                </td>
                <td style={td}>{u.cherryhub_member_key || "—"}</td>
                <td style={td}>{u.swiftpos_customer_id || "—"}</td>
                <td style={td}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    {(u.points_balance ?? 0).toLocaleString()}
                  </span>
                </td>
                <td style={td}>{formatDate(u.points_balance_refreshed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={btnSecondary} disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))} data-testid="users-prev-btn">← Prev</button>
        <span style={{ color: "#666", fontSize: 12 }}>
          {total === 0 ? "0 of 0" : `${skip + 1}–${Math.min(total, skip + limit)} of ${total}`}
        </span>
        <button style={btnSecondary} disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)} data-testid="users-next-btn">Next →</button>
      </div>
    </div>
  );
}

// ───────── Config / PLU Tab ─────────
function ConfigPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setConfig(await api<Config>(`/api/admin/swiftpos/config`)); }
      catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ color: "#888", padding: 20 }}>Loading config…</div>;
  if (error) return <div style={{ color: "#ff6b6b", padding: 20 }}>{error}</div>;
  if (!config) return null;

  const credRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      <span style={{ color: value && value !== "missing" ? "#fff" : "#ff6b6b", fontFamily: "monospace", fontSize: 12 }}>
        {value || <em>missing</em>}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} data-testid="swiftpos-config-panel">
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>SwiftPOS endpoint</h3>
          <Pill ok={!config.mock_mode} warn={config.mock_mode}>{config.mock_mode ? "MOCK" : "LIVE"}</Pill>
        </div>
        {credRow("Base URL", config.base_url)}
        {credRow("Auth path", config.auth_path)}
        {credRow("Orders path", config.orders_path)}
        {credRow("Integrator name", config.integrator_name)}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Credentials (redacted)</h3>
        {credRow("Integrator key", config.credentials.integrator_key)}
        {credRow("Customer reference", config.credentials.customer_ref)}
        {credRow("Client ID", config.credentials.client_id)}
        {credRow("Clerk ID", config.credentials.clerk_id)}
        {credRow("Clerk password", config.credentials.clerk_password)}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>PLU catalog — app event → SwiftPOS</h3>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
          Points value: <strong style={{ color: "#fff" }}>${config.plu_catalog.point_dollar_value.toFixed(3)}/point</strong>
        </div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>Missions</div>
        <PLUTable plus={config.plu_catalog.missions} />
        <div style={{ fontSize: 12, color: "#aaa", margin: "20px 0 8px", fontWeight: 600 }}>Rewards</div>
        <PLUTable plus={config.plu_catalog.rewards} />
      </div>
    </div>
  );
}

function PLUTable({ plus }: { plus: PLU[] }) {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Event key</th>
          <th style={th}>PLU</th>
          <th style={th}>Name</th>
          <th style={th}>Unit price</th>
          <th style={th}>Points/unit</th>
        </tr>
      </thead>
      <tbody>
        {plus.map((p) => (
          <tr key={p.plu} data-testid={`plu-row-${p.plu}`}>
            <td style={td}>{p.event_key}</td>
            <td style={td}><code style={{ color: "#5fe29f" }}>{p.plu}</code></td>
            <td style={td}>{p.name}</td>
            <td style={td}>${p.unit_price.toFixed(2)}</td>
            <td style={td}>{p.points_per_unit.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────── Root page ─────────
export default function LunaSwiftPOSReporting() {
  const [tab, setTab] = useState<"summary" | "transactions" | "users" | "config">("summary");

  const tabs = useMemo(() => ([
    { id: "summary", label: "Summary" },
    { id: "transactions", label: "Transactions" },
    { id: "users", label: "Users" },
    { id: "config", label: "Config / PLU" },
  ] as const), []);

  return (
    <div style={{ padding: "24px 28px", background: "#0a0a0a", minHeight: "100vh", color: "#fafafa" }} data-testid="swiftpos-reporting-page">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>SwiftPOS Reporting</h1>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          Source-of-truth view of the Luna ↔ SwiftPOS points pipeline.
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #222", marginBottom: 22 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "transparent",
              color: tab === t.id ? "#fff" : "#888",
              border: 0,
              borderBottom: tab === t.id ? "2px solid #fff" : "2px solid transparent",
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            data-testid={`swiftpos-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && <SummaryPanel />}
      {tab === "transactions" && <TransactionsPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "config" && <ConfigPanel />}
    </div>
  );
}
