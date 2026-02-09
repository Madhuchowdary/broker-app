import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api/clients";

export default function App() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);


  const emptyForm = useMemo(
    () => ({
      id: null,
      name: "",
      gst_no: "",
      fssai_no: "",
      address: "",
      phone: "",
      mobile: "",
      email: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const isEdit = !!form.id;

  async function loadClients(search = "") {
    setLoading(true);
    try {
      const url = search ? `${API_BASE}?q=${encodeURIComponent(search)}` : API_BASE;
      const res = await fetch(url);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

    useEffect(() => {
        loadClients("");
    }, []);

    function onChange(field, value) {
        setForm((p) => ({ ...p, [field]: value }));
    }

    function toggleOne(id: number) {
    setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    }

    function toggleAll() {
    if (selectedIds.length === clients.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(clients.map((c) => c.id));
    }
    }

    function clearSelection() {
    setSelectedIds([]);
    }


    function onRowClick(c) {
        setForm({
        id: c.id,
        name: c.name || "",
        gst_no: c.gst_no || "",
        fssai_no: c.fssai_no || "",
        address: c.address || "",
        phone: c.phone || "",
        mobile: c.mobile || "",
        email: c.email || "",
        });
        // scroll to top form for quick edits
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function onDeleteSelected() {
        if (selectedIds.length === 0) return;

        const ok = confirm(`Delete ${selectedIds.length} client(s)?`);
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

        await loadClients(q.trim());
        clearSelection();
        setForm(emptyForm); // optional: clear edit panel
        }


  function onNew() {
    setForm(emptyForm);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSave() {
    if (!form.name || !form.name.trim()) {
      alert("Client name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      gst_no: form.gst_no?.trim() || null,
      fssai_no: form.fssai_no?.trim() || null,
      address: form.address?.trim() || null,
      phone: form.phone?.trim() || null,
      mobile: form.mobile?.trim() || null,
      email: form.email?.trim() || null,
    };

    const opts = {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };

    const url = isEdit ? `${API_BASE}/${form.id}` : API_BASE;
    const res = await fetch(url, opts);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Save failed");
      return;
    }

    await loadClients(q);
    setForm(emptyForm);
  }

  async function onDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this client?")) return;

    const res = await fetch(`${API_BASE}/${form.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }
    await loadClients(q);
    setForm(emptyForm);
  }

  async function onFind() {
    await loadClients(q);
  }

  async function onRefresh() {
    setQ("");
    await loadClients("");
  }

  return (
    <div style={page}>
      {/* Header */}
      <div style={headerRow}>
        <div>
          <div style={title}>Client Details</div>
          <div style={subtitle}>Add / Edit / Find clients (GST + FSSAI)</div>
        </div>

        <div style={searchRow}>
          <input
            style={searchInput}
            placeholder="Find (name/mobile/email/GST/FSSAI)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? onFind() : null)}
          />
          <button style={btn} onClick={onFind}>
            Find
          </button>
          <button style={btnGhost} onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {/* Form Card (Top) */}
      <div style={card}>
        <div style={cardHead}>
            {/* LEFT SIDE */}
            <div>
                <div style={cardTitle}>Clients</div>
                <div style={smallText}>Click row to edit • Use checkbox to delete</div>
            </div>
        </div>


        <div style={formGrid}>
        {/* Identity row */}
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <div>
                <label style={label}>Client Name *</label>
                <input
                style={clientNameInput}
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="Enter client name"
                />
            </div>

            <div>
                <label style={label}>GST No</label>
                <input
                style={gstNoInput}
                value={form.gst_no}
                onChange={(e) => onChange("gst_no", e.target.value)}
                placeholder="GSTIN"
                />
            </div>

            <div>
                <label style={label}>FSSAI No</label>
                <input
                style={fssaiNoInput}
                value={form.fssai_no}
                onChange={(e) => onChange("fssai_no", e.target.value)}
                placeholder="FSSAI number"
                />
            </div>
            </div>


          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Address</label>
            <textarea
              style={{ ...input, minHeight: 70, resize: "vertical" }}
              value={form.address}
              onChange={(e) => onChange("address", e.target.value)}
              placeholder="Address"
            />
          </div>

          <div>
            <label style={label}>Phone</label>
            <input
              style={input}
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="Phone"
            />
          </div>

          <div>
            <label style={label}>Mobile</label>
            <input
              style={input}
              value={form.mobile}
              onChange={(e) => onChange("mobile", e.target.value)}
              placeholder="Mobile"
            />
          </div>

        {/* Email + Save + Record count (4-column row) */}
        <div
        style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            alignItems: "end",
        }}
        >
        {/* Email (takes 2 columns) */}
        <div style={{ gridColumn: "span 2" }}>
            <label style={label}>Email</label>
            <input
            style={{ ...input, width: "90%" }}
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="Email"
            />
        </div>

        {/* Save (1 column) */}
        <div style={{ display: "flex" }}>
            <button style={btnPrimary} onClick={onSave}>
            {isEdit ? "Update" : "Save"}
            </button>
        </div>
        </div>

 
        </div>

      </div>

      {/* Table Card (Bottom fills screen) */}
      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column" , width:"98%"}}>
        <div style={cardHead}>
          <div  style={{ width:"100%"}}>
            <div style={cardTitle}>Clients</div>
            <div style={smallText}>Click a row to edit. </div>
             {/* Record count (1 column) */}
            <div style={{ ...smallText, textAlign: "right", paddingBottom: 6 ,width:"100%"}}>
                 <button
                    style={{
                        ...btnDanger,
                        opacity: selectedIds.length ? 1 : 0.4,
                        cursor: selectedIds.length ? "pointer" : "not-allowed",
                        margin: "0 15px"
                    }}
                    disabled={!selectedIds.length}
                    onClick={onDeleteSelected}
                    >
            Delete Selected ({selectedIds.length})
            </button>
                {loading ? "Loading…" : `${clients.length} record(s)`}
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
                        checked={clients.length > 0 && selectedIds.length === clients.length}
                        onChange={toggleAll}
                    />
                </th>
                <th style={th}>Name</th>
                <th style={th}>Mobile</th>
                <th style={th}>GST</th>
                <th style={th}>FSSAI</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td style={emptyTd} colSpan={4}>
                    No clients found.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onRowClick(c)}
                    style={rowStyle(form.id === c.id)}
                  >
                    <td style={td}>
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={(e) => {
                            e.stopPropagation();
                            toggleOne(c.id);
                            }}
                        />
                   </td>

                    <td style={tdStrong}>{c.name}</td>
                    <td style={td}>{c.mobile || "-"}</td>
                    <td style={td}>{c.gst_no || "-"}</td>
                    <td style={td}>{c.fssai_no || "-"}</td>
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

/* ---------- Styles (compact + modern) ---------- */

const page = {
  width: "100%",
  boxSizing: "border-box",

  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  background: "#f6f7fb",
  color: "#0f172a",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = { fontSize: 32, fontWeight: 800, letterSpacing: -0.4 };
const subtitle = { marginTop: 2, color: "#475569" };

const searchRow = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const searchInput = {
  width: 360,
  maxWidth: "60vw",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

const card = {
  background: "white",
  border: "1px solid #e6e8f0",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
};

const cardHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const cardTitle = { fontSize: 16, fontWeight: 800 };
const smallText = { fontSize: 13, color: "#64748b" };

const formGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  marginBottom: 6,
};
const input = {
  width: "90%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

const clientNameInput = {
  width: "90%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

const gstNoInput = {
  width: "90%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

const fssaiNoInput = {
  width: "90%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  outline: "none",
  background: "white",
};

const actionsRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginTop: 12,
};

const btn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const btnGhost = {
  ...btn,
  background: "#f8fafc",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #1d4ed8",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const btnDanger = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: 800,
};

const tableWrap = {
  flex: 1,
  overflow: "auto",
  borderRadius: 12,
  border: "1px solid #eef2f7",
};

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "white",
};

const th = {
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
  background: "#fafbff",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const td = {
  padding: "12px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  color: "#0f172a",
};

const tdStrong = { ...td, fontWeight: 800 };

function rowStyle(active) {
  return {
    cursor: "pointer",
    background: active ? "#eef2ff" : "white",
  };
}

const emptyTd = {
  padding: 20,
  color: "#64748b",
  textAlign: "center",
};

const footerNote = {
  marginTop: 10,
  fontSize: 12,
  color: "#94a3b8",
};
