// ════════════════════════════════════════════════════════════════════
// CHERRYHUB ADMIN PANEL — for Lovable (www.lunagroupapp.com.au)
// ════════════════════════════════════════════════════════════════════
//
// HOW TO USE:
//   1. Copy this entire file into your Lovable project as `CherryHubAdmin.tsx`
//      (usually: src/components/CherryHubAdmin.tsx)
//   2. Set the `BACKEND_URL` constant below to your Railway backend URL.
//      Example: https://luna-backend-production.up.railway.app
//      (It's the same URL your Luna mobile app uses — you can find it in
//       the Railway dashboard under your backend service → "Settings" → "Domains")
//   3. Import and use it on any admin page:
//         import CherryHubAdmin from './components/CherryHubAdmin';
//         ...
//         <CherryHubAdmin />
//
// LOGIN:
//   The component looks for an admin JWT in localStorage under the key
//   `luna_admin_token`. If your Lovable site already logs admins in with
//   your backend, just make sure it stores the JWT under that key after login.
//   If you use a different key, change `TOKEN_KEY` below.
//
// WHAT IT DOES:
//   • Shows live stats: last sync, linked users, imports in 24h, net points
//   • "Force Sync Now" button → runs the CherryHub → Luna poller immediately
//   • "Send Test Award" button → writes a live +N points to CherryHub
//     (you'll see it appear in CherryHub → Reports → Points Transactions)
//   • Auto-refreshes every 30s
//   • Works without Tailwind (pure inline styles) — no other dependencies
//
// ════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';

// ⚠️ CHANGE THIS to your Railway backend URL (no trailing slash)
const BACKEND_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';
const TOKEN_KEY = 'luna_admin_token';

interface SyncStats {
  mock_mode: boolean;
  last_sync_at: string | null;
  linked_users: number;
  synced_last_24h: number;
  imported_24h: number;
  imported_7d: number;
  redemptions_24h: number;
  awards_24h: number;
  points_net_24h: number;
  recent_5: Array<{
    external_id: string;
    type: string;
    amount: number;
    member_key: string;
    synced_at: string;
    created_at: string;
  }>;
  as_of: string;
}

function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function callApi<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
  return body;
}

export default function CherryHubAdmin() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPoints, setTestPoints] = useState(10);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        callApi<SyncStats>('/api/cherryhub/admin/sync-stats'),
        callApi<any>('/api/health/deep').catch(() => null),
      ]);
      setStats(s); setHealth(h);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const doSync = async () => {
    setBusy('sync'); setMsg(null);
    try {
      const data: any = await callApi('/api/cherryhub/admin/sync-now', 'POST');
      setMsg({
        ok: true,
        text: data.mock
          ? `Mock mode — poller didn't fetch. Flip CHERRYHUB_MOCK_MODE=false on Railway.`
          : `Synced ${data.users} users · ${data.imported} imported · ${data.skipped} skipped · ${data.errors} errors`,
      });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: `Sync failed: ${e.message}` });
    } finally { setBusy(null); }
  };

  const doTestAward = async () => {
    if (testPoints < 1 || testPoints > 1000) {
      setMsg({ ok: false, text: 'Points must be 1–1000' });
      return;
    }
    setBusy('award'); setMsg(null);
    try {
      const data: any = await callApi(`/api/cherryhub/admin/test-award?points=${testPoints}`, 'POST');
      setMsg({
        ok: true,
        text: `+${data.points_awarded} pts written to CherryHub for ${data.member_key}. Check CherryHub → Reports → Points Transactions.`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: `Test award failed: ${e.message}` });
    } finally { setBusy(null); }
  };

  if (loading) return <div style={{ padding: 24, color: '#9CA3AF' }}>Loading CherryHub status…</div>;

  const mockMode = stats?.mock_mode;
  const cherryOk = health?.checks?.cherryhub?.ok;
  const mongoOk = health?.checks?.mongo?.ok;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🍒 CherryHub Sync</h2>
          <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Updated {relTime(stats?.as_of || null)} · auto-refreshes every 30s</div>
        </div>
        <button onClick={load} style={btn('secondary')}>↻ Refresh</button>
      </div>

      {mockMode && (
        <Banner color="#F5C518" bg="#F5C51815" border="#F5C51840">
          ⚠ <b>Sandbox mode is ON.</b> The poller is a no-op. Flip <code>CHERRYHUB_MOCK_MODE=false</code> on Railway.
        </Banner>
      )}
      {msg && (
        <Banner color={msg.ok ? '#4ADE80' : '#F87171'} bg={msg.ok ? '#4ADE8015' : '#F8717115'} border={msg.ok ? '#4ADE8040' : '#F8717140'}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </Banner>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Tile label="Last sync" value={relTime(stats?.last_sync_at || null)} />
        <Tile label="Linked users" value={String(stats?.linked_users ?? 0)} />
        <Tile label="Imported 24h" value={String(stats?.imported_24h ?? 0)} />
        <Tile label="Net 24h" value={`${(stats?.points_net_24h ?? 0) >= 0 ? '+' : ''}${stats?.points_net_24h ?? 0}`}
              color={(stats?.points_net_24h ?? 0) >= 0 ? '#4ADE80' : '#F87171'} />
        <Tile label="Redemptions 24h" value={String(stats?.redemptions_24h ?? 0)} />
        <Tile label="Awards 24h" value={String(stats?.awards_24h ?? 0)} />
        <Tile label="Imported 7d" value={String(stats?.imported_7d ?? 0)} />
        <Tile label="Synced 24h" value={String(stats?.synced_last_24h ?? 0)} />
      </div>

      {/* Health */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <HealthPill label="MongoDB" ok={mongoOk} />
        <HealthPill label="CherryHub OAuth" ok={cherryOk} note={health?.checks?.cherryhub?.mode} />
      </div>

      {/* Actions */}
      <div style={{ padding: 16, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, background: 'rgba(255,255,255,0.02)', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#9CA3AF' }}>Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={doSync} disabled={busy !== null} style={btn('primary')}>
            {busy === 'sync' ? '↻ Syncing…' : '↻ Force Sync Now'}
          </button>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>·</span>
          <input
            type="number" min={1} max={1000} value={testPoints}
            onChange={(e) => setTestPoints(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
            style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', width: 70, color: '#fff', textAlign: 'center' }}
          />
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>pts</span>
          <button onClick={doTestAward} disabled={busy !== null || mockMode} style={btn('award', mockMode)}>
            {busy === 'award' ? '⚡ Writing…' : '⚡ Send Test Award'}
          </button>
        </div>
        <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          Test Award writes a LIVE transaction to CherryHub against your admin's linked member_key. Watch CherryHub → Reports → Points Transactions — it appears in seconds.
        </div>
      </div>

      {/* Recent */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 8 }}>Most Recent Synced</div>
      {(stats?.recent_5 ?? []).length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
          No CherryHub transactions imported yet.
        </div>
      ) : (
        (stats?.recent_5 ?? []).map((t) => (
          <div key={t.external_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{t.member_key} · {relTime(t.synced_at)}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.amount >= 0 ? '#4ADE80' : '#F87171' }}>
              {t.amount >= 0 ? '+' : ''}{t.amount}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: 1, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function HealthPill({ label, ok, note }: { label: string; ok?: boolean; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', flex: 1, minWidth: 180 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#4ADE80' : '#F87171' }} />
      <span style={{ fontSize: 12, flex: 1 }}>{label}</span>
      {note && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{note}</span>}
    </div>
  );
}

function Banner({ children, color, bg, border }: { children: any; color: string; bg: string; border: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function btn(kind: 'primary' | 'secondary' | 'award', disabled = false): React.CSSProperties {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    transition: 'all 0.15s',
  };
  if (kind === 'primary') return { ...base, background: '#D4163D', color: '#fff' };
  if (kind === 'secondary') return { ...base, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };
  return { ...base, background: 'rgba(245,197,24,0.15)', color: '#F5C518', border: '1px solid rgba(245,197,24,0.4)' };
}
