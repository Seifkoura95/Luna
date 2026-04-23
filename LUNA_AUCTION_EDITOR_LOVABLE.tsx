/**
 * LUNA AUCTION EDITOR — Lovable Admin Portal Component
 * ====================================================
 * Drop-in TSX for the Lovable admin portal that lets ops create / edit
 * auctions with full image support (paste URL OR upload from their laptop).
 *
 * Drop this into your Lovable project (e.g. `src/pages/AuctionEditor.tsx`
 * or as a modal component inside your auctions list page).
 *
 * Setup (same pattern as the other Luna Lovable components):
 *   1. env: VITE_LUNA_API_URL=https://luna-production-889c.up.railway.app
 *   2. After admin login, store JWT: localStorage.setItem('luna_admin_token', token)
 *
 * Endpoints used (all behind Bearer admin auth):
 *   POST   /api/venue-admin/auctions                 — create
 *   GET    /api/venue-admin/auctions/:id             — read (for edit)
 *   PUT    /api/venue-admin/auctions/:id             — update (supports image_url)
 *   POST   /api/venue-admin/auctions/upload-image    — upload file, returns {image_url}
 *   POST   /api/venue-admin/auctions/:id/publish     — go live
 *   POST   /api/venue-admin/auctions/:id/unpublish   — back to draft
 *   DELETE /api/venue-admin/auctions/:id             — remove
 *
 * Usage:
 *   <LunaAuctionEditor auctionId={'abc-123' | null} onSaved={() => refreshList()} />
 *   - Pass `auctionId={null}` to create a new auction.
 *   - Pass an existing auction's id to edit it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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

const AUCTION_CATEGORIES = [
  "vip_package", "drinks_package", "dining", "experience", "event_ticket", "merch", "other",
];

type Auction = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  starting_bid: number;
  current_bid: number;
  min_increment: number;
  max_bid_limit: number | null;
  venue_id: string;
  venue_name?: string;
  category: string;
  terms: string | null;
  status: "draft" | "active" | "paused" | "ended";
  duration_hours: number;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
};

const getToken = () =>
  (typeof window !== "undefined" && localStorage.getItem("luna_admin_token")) || null;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

const resolveImageUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
};

// ============================================================================

type Props = {
  auctionId: string | null; // null = create new
  onSaved?: (auction: Auction) => void;
  onCancel?: () => void;
};

export default function LunaAuctionEditor({ auctionId, onSaved, onCancel }: Props) {
  const isEdit = !!auctionId;
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startingBid, setStartingBid] = useState(1000);
  const [minIncrement, setMinIncrement] = useState(100);
  const [maxBidLimit, setMaxBidLimit] = useState<number | "">("");
  const [venueId, setVenueId] = useState(LUNA_VENUES[0].id);
  const [category, setCategory] = useState("vip_package");
  const [terms, setTerms] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [status, setStatus] = useState<Auction["status"]>("draft");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load existing auction
  const loadAuction = useCallback(async () => {
    if (!auctionId) return;
    setLoading(true);
    try {
      const a = await api<Auction>(`/api/venue-admin/auctions/${auctionId}`);
      setTitle(a.title || "");
      setDescription(a.description || "");
      setImageUrl(a.image_url || "");
      setStartingBid(a.starting_bid || 0);
      setMinIncrement(a.min_increment || 100);
      setMaxBidLimit(a.max_bid_limit ?? "");
      setVenueId(a.venue_id || LUNA_VENUES[0].id);
      setCategory(a.category || "vip_package");
      setTerms(a.terms || "");
      setDurationHours(a.duration_hours || 24);
      setStatus(a.status);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    loadAuction();
  }, [loadAuction]);

  // Upload file → image_url
  const handleFilePicked = async (file: File) => {
    setErr(null);
    if (file.size > 8 * 1024 * 1024) {
      setErr("Image too large — keep it under 8 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Unsupported type — use JPG, PNG, or WebP.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<{ image_url: string; relative_url: string }>(
        `/api/venue-admin/auctions/upload-image`,
        { method: "POST", body: fd },
      );
      setImageUrl(r.image_url);
    } catch (e: any) {
      setErr(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save
  const save = async (publishAfter = false) => {
    setErr(null);
    if (!title.trim()) {
      setErr("Title is required");
      return;
    }
    if (startingBid <= 0) {
      setErr("Starting bid must be > 0");
      return;
    }
    setBusy(publishAfter ? "publish" : "save");
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        starting_bid: startingBid,
        min_increment: minIncrement,
        max_bid_limit: maxBidLimit === "" ? null : Number(maxBidLimit),
        venue_id: venueId,
        category,
        terms: terms.trim() || null,
        duration_hours: durationHours,
        status,
      };
      let saved: Auction;
      if (isEdit && auctionId) {
        const r = await api<{ auction: Auction }>(`/api/venue-admin/auctions/${auctionId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        saved = r.auction;
        if (publishAfter && saved.status !== "active") {
          await api(`/api/venue-admin/auctions/${auctionId}/publish`, { method: "POST" });
          saved = { ...saved, status: "active" };
        }
      } else {
        const r = await api<{ auction: Auction }>(`/api/venue-admin/auctions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        saved = r.auction;
        if (publishAfter) {
          await api(`/api/venue-admin/auctions/${saved.id}/publish`, { method: "POST" });
          saved = { ...saved, status: "active" };
        }
      }
      onSaved?.(saved);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (!auctionId) return;
    if (!confirm("Delete this auction? This cannot be undone.")) return;
    setBusy("delete");
    try {
      await api(`/api/venue-admin/auctions/${auctionId}`, { method: "DELETE" });
      onSaved?.({ id: auctionId } as Auction);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div style={styles.empty}>Loading…</div>;

  const previewSrc = resolveImageUrl(imageUrl);

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>LUNA · AUCTIONS</div>
          <h1 style={styles.title}>{isEdit ? "Edit auction" : "New auction"}</h1>
          {isEdit && (
            <div style={styles.sub}>
              Status: <span style={statusChip(status)}>{status.toUpperCase()}</span>
            </div>
          )}
        </div>
        {onCancel && (
          <button onClick={onCancel} style={styles.btnGhost}>
            Close
          </button>
        )}
      </header>

      {err && <div style={styles.error}>⚠️ {err}</div>}

      <div style={styles.grid}>
        {/* LEFT: Image + primary */}
        <div style={styles.col}>
          <label style={styles.k}>IMAGE</label>
          <div style={styles.imageBox}>
            {previewSrc ? (
              <img src={previewSrc} alt="auction" style={styles.imagePreview} />
            ) : (
              <div style={styles.imageEmpty}>No image yet — upload below or paste a URL</div>
            )}
          </div>
          <div style={styles.imageActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleFilePicked(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={styles.btnPrimary}
            >
              {uploading ? "Uploading…" : "📤 Upload image"}
            </button>
            {imageUrl && (
              <button type="button" onClick={() => setImageUrl("")} style={styles.btnDangerSmall}>
                Remove
              </button>
            )}
          </div>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="…or paste an image URL (https://…)"
            style={styles.input}
          />
          <div style={styles.dim}>JPG / PNG / WebP · max 8 MB · pasted URLs must be publicly reachable.</div>
        </div>

        {/* RIGHT: Fields */}
        <div style={styles.col}>
          <label style={styles.k}>TITLE <span style={styles.dim}>({title.length}/120)</span></label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="e.g. VIP Booth at Eclipse — Saturday"
            style={styles.input}
          />

          <label style={styles.k}>DESCRIPTION</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's included, who it's for, the vibe."
            style={{ ...styles.input, resize: "vertical" }}
          />

          <div style={styles.twoCol}>
            <div>
              <label style={styles.k}>VENUE</label>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={styles.input}>
                {LUNA_VENUES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.k}>CATEGORY</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
                {AUCTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.threeCol}>
            <div>
              <label style={styles.k}>STARTING BID (¢)</label>
              <input
                type="number"
                value={startingBid}
                onChange={(e) => setStartingBid(Number(e.target.value))}
                style={styles.input}
                min={1}
              />
            </div>
            <div>
              <label style={styles.k}>MIN INCREMENT</label>
              <input
                type="number"
                value={minIncrement}
                onChange={(e) => setMinIncrement(Number(e.target.value))}
                style={styles.input}
                min={1}
              />
            </div>
            <div>
              <label style={styles.k}>MAX BID (optional)</label>
              <input
                type="number"
                value={maxBidLimit}
                onChange={(e) => setMaxBidLimit(e.target.value === "" ? "" : Number(e.target.value))}
                style={styles.input}
                min={0}
              />
            </div>
          </div>

          <div style={styles.twoCol}>
            <div>
              <label style={styles.k}>DURATION (HOURS)</label>
              <input
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                style={styles.input}
                min={1}
              />
            </div>
            <div>
              <label style={styles.k}>STATUS</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Auction["status"])}
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>

          <label style={styles.k}>TERMS & CONDITIONS</label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            placeholder="Fine print for the winner (dress code, blackout dates, etc.)"
            style={{ ...styles.input, resize: "vertical" }}
          />
        </div>
      </div>

      <div style={styles.actionRow}>
        {isEdit && (
          <button onClick={del} disabled={!!busy} style={styles.btnDanger}>
            {busy === "delete" ? "…" : "Delete"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => save(false)} disabled={!!busy} style={styles.btnGhost}>
          {busy === "save" ? "…" : "Save"}
        </button>
        <button onClick={() => save(true)} disabled={!!busy} style={styles.btnPrimary}>
          {busy === "publish" ? "…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================

const statusChip = (s: string): any => {
  const base = {
    fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
    padding: "3px 9px", borderRadius: 999, border: "1px solid",
    display: "inline-block",
  };
  if (s === "active") return { ...base, background: "#123524", color: "#7dd4a0", borderColor: "#2a7a4b" };
  if (s === "paused") return { ...base, background: "#2b1e4a", color: "#c4b5fd", borderColor: "#8B5CF6" };
  if (s === "ended") return { ...base, background: "#2a1010", color: "#ffb0b0", borderColor: "#6a1a1a" };
  return { ...base, background: "#14141c", color: "#9a9aa8", borderColor: "#33333e" };
};

const styles: Record<string, any> = {
  wrap: {
    background: "#08080E", color: "#F4F4F6", minHeight: "100vh",
    padding: "28px 32px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    gap: 24, flexWrap: "wrap", marginBottom: 24,
  },
  eyebrow: { fontSize: 11, letterSpacing: 3, color: "#FFD700", fontWeight: 800, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 },
  sub: { margin: "6px 0 0 0", color: "#9A9AA8", fontSize: 13 },
  error: { background: "#3a1010", color: "#ffb0b0", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 },
  empty: { textAlign: "center", padding: "80px 20px", color: "#6a6a7a" },
  grid: { display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 1.3fr", gap: 24 },
  col: { display: "flex", flexDirection: "column", gap: 8 },
  k: { fontSize: 10, letterSpacing: 2, color: "#9a9aa8", fontWeight: 800, marginTop: 8 },
  dim: { color: "#6a6a7a", fontSize: 12 },
  input: {
    background: "#0a0a12", border: "1px solid #22222c", color: "#F4F4F6",
    padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", width: "100%",
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  threeCol: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  imageBox: {
    background: "#0a0a12", border: "1px dashed #2a223a", borderRadius: 12,
    aspectRatio: "4/3", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
  },
  imagePreview: { width: "100%", height: "100%", objectFit: "cover" },
  imageEmpty: { color: "#6a6a7a", fontSize: 13, padding: 20, textAlign: "center" },
  imageActions: { display: "flex", gap: 8, marginTop: 8 },
  btnPrimary: {
    background: "#FFD700", color: "#000", border: "none",
    padding: "10px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
  },
  btnGhost: {
    background: "#14141c", color: "#F4F4F6", border: "1px solid #22222c",
    padding: "10px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13,
  },
  btnDanger: {
    background: "#2a1010", color: "#ff6b6b", border: "1px solid #4a1010",
    padding: "10px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13,
  },
  btnDangerSmall: {
    background: "#1a0a0a", color: "#ff6b6b", border: "1px solid #4a1010",
    padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  actionRow: {
    display: "flex", alignItems: "center", gap: 8, marginTop: 24,
    paddingTop: 16, borderTop: "1px solid #1a1a24",
  },
};
