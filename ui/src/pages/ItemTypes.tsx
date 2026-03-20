import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000/api/item-types";

type Row = {
  id: number;
  name: string | null;
};

export default function ItemTypes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const emptyForm = useMemo(() => ({ id: null as number | null, name: "" }), []);
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!form.id;

  async function load(search = "") {
    setLoading(true);
    try {
      const url = search ? `${API_BASE}?q=${encodeURIComponent(search)}` : API_BASE;
      const res = await fetch(url);
      const data = await res.json();
      const list: Row[] = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
      setRows(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function onChangeName(v: string) {
    setForm((p) => ({ ...p, name: v }));
  }

  function onRowClick(r: Row) {
    setForm({ id: r.id, name: r.name || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSave() {
    if (!form.name.trim()) {
      alert("Item Type is required");
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
    setForm(emptyForm);
    await load("");
  }

  return (
    <div style={page}>
      <div style={headerRow}>
        <div>
          <div style={title}>Item Types</div>
        </div>

        <div style={searchRow}>
          <input
            style={searchInput}
            placeholder="Find item type…"
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
            <div style={smallText}>Click a row to edit • Save updates</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div>
            <label style={label}>Item Type *</label>
            <input
              style={inputFull}
              value={form.name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Enter item type"
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnPrimary} onClick={onSave}>
              {isEdit ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", width: "98%" }}>
        <div style={cardHead}>
          <div style={{ width: "100%" }}>
            <div style={cardTitle}>Item Types</div>
            <div style={{ ...smallText, textAlign: "right", paddingBottom: 6, width: "100%" }}>
              {loading ? "Loading…" : `${rows.length} record(s)`}
            </div>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={emptyTd}>No item types found.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => onRowClick(r)} style={rowStyle(form.id === r.id)}>
                    <td style={tdStrong}>{r.name || "-"}</td>
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

const page: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "#f6f7fb", color: "#0f172a", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" };
const headerRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const title: React.CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: -0.4 };
const searchRow: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const searchInput: React.CSSProperties = { width: 360, maxWidth: "60vw", padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", background: "white" };
const card: React.CSSProperties = { background: "white", border: "1px solid #e6e8f0", borderRadius: 16, padding: 14, boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)" };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 };
const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const smallText: React.CSSProperties = { fontSize: 13, color: "#64748b" };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 };
const inputFull: React.CSSProperties = { width: "98%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", background: "white" };
const btn: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: 700 };
const btnGhost: React.CSSProperties = { ...btn, background: "#f8fafc" };
const btnPrimary: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #1d4ed8", background: "#2563eb", color: "white", cursor: "pointer", fontWeight: 800 };
const tableWrap: React.CSSProperties = { flex: 1, overflow: "auto", maxHeight: 400, borderRadius: 12, border: "1px solid #eef2f7" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "white" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 12, color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #eef2f7", background: "#fafbff", position: "sticky", top: 0, zIndex: 1 };
const td: React.CSSProperties = { padding: "12px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#0f172a" };
const tdStrong: React.CSSProperties = { ...td, fontWeight: 800 };
function rowStyle(active: boolean): React.CSSProperties { return { cursor: "pointer", background: active ? "#eef2ff" : "white" }; }
const emptyTd: React.CSSProperties = { padding: 20, color: "#64748b", textAlign: "center" };
const footerNote: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "#94a3b8" };
