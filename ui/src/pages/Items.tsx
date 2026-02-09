import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api/items";

type Row = { id: number; name: string | null };

export default function Items() {
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
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function onAddNew() {
    setForm(emptyForm);
  }

  // Row click selects item (like old UI)
  function onRowSelect(r: Row) {
    setForm({ id: r.id, name: r.name || "" });
  }

  async function onSave() {
    if (!form.name.trim()) {
      alert("Item name is required");
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

  // In this design, Modify just means "you must select a row first"
  function onModify() {
    if (!form.id) {
      alert("Select an item row to modify");
      return;
    }
    // focus input
    const el = document.getElementById("itemNameInput") as HTMLInputElement | null;
    el?.focus();
  }

  async function onDelete() {
    if (!form.id) {
      alert("Select an item row to delete");
      return;
    }
    if (!confirm("Delete this item?")) return;

    const res = await fetch(`${API_BASE}/${form.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Delete failed");
      return;
    }

    setForm(emptyForm);
    await load(q.trim());
  }

  async function onFind() {
    await load(q.trim());
  }

  return (
    <div style={page}>
      {/* Top area like screenshot */}
      <div style={topLineWrap}>
        <div style={leftLabel}>Item Name</div>

        <div style={rightArea}>
          <input
            id="itemNameInput"
            style={bigInput}
            placeholder="Enter Item Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />

          <div style={divider} />

          <div style={btnRow}>
            <button style={btnOldPrimary} onClick={onAddNew}>Add New</button>
            <button style={btnOld} onClick={onSave}>Save</button>
            <button style={btnOld} onClick={onModify} disabled={!form.id} title={!form.id ? "Select a row to modify" : ""}>
              Modify
            </button>
            <button style={btnOld} onClick={onDelete} disabled={!form.id} title={!form.id ? "Select a row to delete" : ""}>
              Delete
            </button>
            <button style={btnOldPrimary} onClick={onFind}>Find</button>

            <input
              style={findInput}
              placeholder="type to search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? onFind() : null)}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div style={card}>
        <div style={cardHead}>
          <div style={cardTitle}>Items</div>
          <div style={smallText}>{loading ? "Loading…" : `${rows.length} record(s)`}</div>
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
                  <td style={emptyTd}>No items found.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onRowSelect(r)}
                    style={rowStyle(form.id === r.id)}
                  >
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

/* ----- styles ----- */
const page: React.CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  padding: 16,
  background: "#f6f7fb",
  fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  color: "#0f172a",
};

const topLineWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 18,
  alignItems: "start",
  padding: "18px 10px",
  background: "white",
  borderRadius: 16,
  border: "1px solid #e6e8f0",
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
};

const leftLabel: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#1d4ed8",
  paddingTop: 8,
};

const rightArea: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const bigInput: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #d7e0ef",
  outline: "none",
  background: "white",
  fontSize: 18,
};

const divider: React.CSSProperties = {
  height: 2,
  width: "100%",
  maxWidth: 1100,
  background: "#e6edf8",
  borderRadius: 999,
};

const btnRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
};

const btnOld: React.CSSProperties = {
  padding: "14px 26px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 22,
  color: "#334155",
};

const btnOldPrimary: React.CSSProperties = {
  ...btnOld,
  background: "#e0e7ff",
  border: "1px solid #93c5fd",
  color: "#0f172a",
};

const findInput: React.CSSProperties = {
  marginLeft: 10,
  width: 260,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  outline: "none",
};

const card: React.CSSProperties = {
  marginTop: 14,
  background: "white",
  border: "1px solid #e6e8f0",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 900 };
const smallText: React.CSSProperties = { fontSize: 13, color: "#64748b" };

const tableWrap: React.CSSProperties = {
  overflow: "auto",
  borderRadius: 12,
  border: "1px solid #eef2f7",
};

const table: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#64748b",
  borderBottom: "1px solid #eef2f7",
  background: "#fafbff",
  position: "sticky",
  top: 0,
};

const tdStrong: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontWeight: 900,
  fontSize: 16,
};

function rowStyle(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    background: active ? "#eef2ff" : "white",
  };
}

const emptyTd: React.CSSProperties = { padding: 20, color: "#64748b", textAlign: "center" };

const footerNote: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "#94a3b8" };
