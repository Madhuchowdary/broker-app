import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api/payment-types";

type Row = { id: number; name: string | null };

export default function PaymentTypes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const emptyForm = useMemo(() => ({ id: null as number | null, name: "" }), []);
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!form.id;

  async function load(search = "") {
    setLoading(true);
    try {
      const url = search ? `${API_BASE}?q=${encodeURIComponent(search)}` : API_BASE;
      const res = await fetch(url);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function toggleOne(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    if (selectedIds.length === rows.length) setSelectedIds([]);
    else setSelectedIds(rows.map((r) => r.id));
  }

  async function onDeleteSelected() {
    if (!selectedIds.length) return;
    const ok = confirm(`Delete ${selectedIds.length} payment type(s)?`);
    if (!ok) return;

    const res = await fetch(`${API_BASE}/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Bulk delete failed");
      return;
    }

    setSelectedIds([]);
    setForm(emptyForm);
    await load(q.trim());
  }

  function onModify(r: Row) {
    setForm({ id: r.id, name: r.name || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDeleteOne(id: number) {
    const ok = confirm("Delete this payment type?");
    if (!ok) return;

    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Delete failed");
      return;
    }

    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (form.id === id) setForm(emptyForm);
    await load(q.trim());
  }

  async function onSave() {
    if (!form.name.trim()) {
      alert("Payment type is required");
      return;
    }

    const payload = { name: form.name.trim() };
    const res = await fetch(isEdit ? `${API_BASE}/${form.id}` : API_BASE, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Save failed");
      return;
    }

    setForm(emptyForm);
    await load(q.trim());
  }

  async function onFind() {
    await load(q.trim());
  }

  async function onRefresh() {
    setQ("");
    setSelectedIds([]);
    setForm(emptyForm);
    await load("");
  }

  return (
    <div style={page}>
      <div style={headerRow}>
        <div>
          <div style={title}>Payment Types</div>
          <div style={subtitle}>Add / Edit / Find payment types</div>
        </div>

        <div style={searchRow}>
          <input
            style={searchInput}
            placeholder="Find (payment type)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? onFind() : null)}
          />
          <button style={btn} onClick={onFind}>Find</button>
          <button style={btnGhost} onClick={onRefresh}>Refresh</button>
        </div>
      </div>

      <div style={card}>
        <div style={cardHead}>
          <div>
            <div style={cardTitle}>Details</div>
            <div style={smallText}>Use Modify in table to edit • Save updates</div>
          </div>
        </div>

        <div style={formGridOne}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Payment Type *</label>
            <input
              style={inputFull}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Enter payment type"
            />
          </div>

          <div style={actionsRow}>
            <button style={btnPrimary} onClick={onSave}>
              {isEdit ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", width: "98%" }}>
        <div style={cardHead}>
          <div style={{ width: "100%" }}>
            <div style={cardTitle}>Payment Types List</div>
            <div style={smallText}>Use checkbox to bulk delete.</div>

            <div style={{ ...smallText, textAlign: "right", paddingBottom: 6, width: "100%" }}>
              <button
                style={{
                  ...btnDanger,
                  opacity: selectedIds.length ? 1 : 0.4,
                  cursor: selectedIds.length ? "pointer" : "not-allowed",
                  margin: "0 15px",
                }}
                disabled={!selectedIds.length}
                onClick={onDeleteSelected}
              >
                Delete Selected ({selectedIds.length})
              </button>
              {loading ? "Loading…" : `${rows.length} record(s)`}
            </div>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={toggleAll}
                  />
                </th>
                <th style={th}>Name</th>
                <th style={{ ...th, textAlign: "right" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={emptyTd} colSpan={3}>No payment types found.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={rowStyle(form.id === r.id)}>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleOne(r.id);
                        }}
                      />
                    </td>
                    <td style={tdStrong}>{r.name || "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button style={btnSmall} onClick={() => onModify(r)}>Modify</button>
                      <button style={btnDangerSmall} onClick={() => onDeleteOne(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={footerNote}>
          Server: <span style={{ fontFamily: "monospace" }}>{API_BASE}</span>
        </div>
      </div>
    </div>
  );
}

/* same styles copied from DeliveryPlaces (keep identical) */
const page: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "#f6f7fb", color: "#0f172a", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" };
const headerRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const title: React.CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: -0.4 };
const subtitle: React.CSSProperties = { marginTop: 2, color: "#475569" };
const searchRow: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const searchInput: React.CSSProperties = { width: 360, maxWidth: "60vw", padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", background: "white" };
const card: React.CSSProperties = { background: "white", border: "1px solid #e6e8f0", borderRadius: 16, padding: 14, boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)" };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 };
const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const smallText: React.CSSProperties = { fontSize: 13, color: "#64748b" };
const formGridOne: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 10 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 };
const inputFull: React.CSSProperties = { width: "98%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", background: "white" };
const actionsRow: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", marginTop: 2 };
const btn: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: 700 };
const btnGhost: React.CSSProperties = { ...btn, background: "#f8fafc" };
const btnPrimary: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #1d4ed8", background: "#2563eb", color: "white", cursor: "pointer", fontWeight: 800 };
const btnDanger: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", cursor: "pointer", fontWeight: 800 };
const tableWrap: React.CSSProperties = { flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid #eef2f7" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "white" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 12, color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #eef2f7", background: "#fafbff", position: "sticky", top: 0, zIndex: 1 };
const td: React.CSSProperties = { padding: "12px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#0f172a" };
const tdStrong: React.CSSProperties = { ...td, fontWeight: 800 };
function rowStyle(active: boolean) { return { background: active ? "#eef2ff" : "white" } as React.CSSProperties; }
const btnSmall: React.CSSProperties = { padding: "8px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: 800, marginRight: 10 };
const btnDangerSmall: React.CSSProperties = { padding: "8px 12px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", cursor: "pointer", fontWeight: 800 };
const emptyTd: React.CSSProperties = { padding: 20, color: "#64748b", textAlign: "center" };
const footerNote: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "#94a3b8" };
