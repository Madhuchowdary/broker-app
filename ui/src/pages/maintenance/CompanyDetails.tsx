import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api/company-details";

type CompanyRow = {
  id: number;
  name?: string;
  title?: string;
  address?: string;
  near?: string;
  city_state?: string;
  contact_nos?: string;
  email?: string;
  pan_no?: string;
  bank?: string;
  ifsc_code?: string;
  account_no?: string;
};

export default function CompanyDetails() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const emptyForm = useMemo(
    () => ({
      id: null as number | null,
      name: "",
      title: "",
      address: "",
      near: "",
      city_state: "",
      contact_nos: "",
      email: "",
      pan_no: "",
      bank: "",
      ifsc_code: "",
      account_no: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const isEdit = !!form.id;

  console.log("form.id =", form.id, "isEdit =", isEdit);

  async function loadRows(search = "") {
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
    loadRows("");
  }, []);

  function onChange(field: keyof typeof emptyForm, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function onRowClick(r: CompanyRow) {
    console.log(12334)
    setForm({
      id: r.id,
      name: r.name || "",
      title: r.title || "",
      address: r.address || "",
      near: r.near || "",
      city_state: r.city_state || "",
      contact_nos: r.contact_nos || "",
      email: r.email || "",
      pan_no: r.pan_no || "",
      bank: r.bank || "",
      ifsc_code: r.ifsc_code || "",
      account_no: r.account_no || "",
    });
    setSelectedIds([Number(r.id)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function onNew() {
    setForm(emptyForm);
    clearSelection();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSave() {
    if (!form.name.trim()) {
      alert("Company name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      title: form.title.trim() || null,
      address: form.address.trim() || null,
      near: form.near.trim() || null,
      city_state: form.city_state.trim() || null,
      contact_nos: form.contact_nos.trim() || null,
      email: form.email.trim() || null,
      pan_no: form.pan_no.trim() || null,
      bank: form.bank.trim() || null,
      ifsc_code: form.ifsc_code.trim() || null,
      account_no: form.account_no.trim() || null,
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

    await loadRows(q);
    setForm(emptyForm);
    clearSelection();
  }

  async function onDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this company record?")) return;

    const res = await fetch(`${API_BASE}/${form.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    await loadRows(q);
    setForm(emptyForm);
    clearSelection();
  }

  async function onDeleteSelected() {
    if (selectedIds.length === 0) return;

    const ok = confirm(`Delete ${selectedIds.length} company record(s)?`);
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

    await loadRows(q.trim());
    clearSelection();
    setForm(emptyForm);
  }

  async function onFind() {
    await loadRows(q);
  }

  async function onRefresh() {
    setQ("");
    await loadRows("");
    setForm(emptyForm);
    clearSelection();
  }

  return (
    <div style={page}>
      <div style={headerRow}>
        <div>
          <div style={title}>Company Details</div>
          <div style={subtitle}>Add / Edit / Find company records</div>
        </div>

        <div style={searchRow}>
          <input
            style={searchInput}
            placeholder="Find (name/title/city/pan/bank/email)…"
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

      <div style={card}>
        <div style={cardHead}>
          <div>
            <div style={cardTitle}>Company Details</div>
            <div style={smallText}>Click row to edit • Use checkbox to delete</div>
          </div>
        </div>

        <div style={formGrid}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={label}>Name *</label>
              <input
                style={input}
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label style={label}>Title</label>
              <input
                style={input}
                value={form.title}
                onChange={(e) => onChange("title", e.target.value)}
                placeholder="Title"
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
            <label style={label}>Near</label>
            <input
              style={input}
              value={form.near}
              onChange={(e) => onChange("near", e.target.value)}
              placeholder="Near"
            />
          </div>

          <div>
            <label style={label}>City and State</label>
            <input
              style={input}
              value={form.city_state}
              onChange={(e) => onChange("city_state", e.target.value)}
              placeholder="City and State"
            />
          </div>

          <div>
            <label style={label}>Contact Nos</label>
            <input
              style={input}
              value={form.contact_nos}
              onChange={(e) => onChange("contact_nos", e.target.value)}
              placeholder="Contact numbers"
            />
          </div>

          <div>
            <label style={label}>e-Mail ID</label>
            <input
              style={input}
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="Email"
            />
          </div>

          <div>
            <label style={label}>PAN No</label>
            <input
              style={input}
              value={form.pan_no}
              onChange={(e) => onChange("pan_no", e.target.value)}
              placeholder="PAN No"
            />
          </div>

          <div>
            <label style={label}>Bank</label>
            <input
              style={input}
              value={form.bank}
              onChange={(e) => onChange("bank", e.target.value)}
              placeholder="Bank"
            />
          </div>

          <div>
            <label style={label}>IFSC Code</label>
            <input
              style={input}
              value={form.ifsc_code}
              onChange={(e) => onChange("ifsc_code", e.target.value)}
              placeholder="IFSC Code"
            />
          </div>

          <div>
            <label style={label}>A/c No</label>
            <input
              style={input}
              value={form.account_no}
              onChange={(e) => onChange("account_no", e.target.value)}
              placeholder="Account number"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-start", paddingTop: 6 }}>
            <button style={saveBtn} onClick={onSave}>
              {isEdit ? "Modify" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={cardHead}>
          <div style={{ width: "100%" }}>
            <div style={cardTitle}>Company Details</div>
            <div style={smallText}>Click a row to edit.</div>
            <div style={{ ...smallText, textAlign: "right", paddingBottom: 6 }}>
              <button
                style={{
                  ...btnDanger,
                  opacity: selectedIds.length ? 1 : 0.4,
                  cursor: selectedIds.length ? "pointer" : "not-allowed",
                  marginRight: 14,
                }}
                disabled={!selectedIds.length}
                onClick={onDeleteSelected}
              >
                Delete Selected ({selectedIds.length})
              </button>
              <span>{rows.length} record(s)</span>
            </div>
          </div>
        </div>

        <div style={{ overflow: "auto", borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <table style={table}>
              <thead>
                <tr>
                  <th style={thNarrow}>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={thNarrow}>Name</th>
                  <th style={thNarrow}>Title</th>
                  <th style={thNarrow}>Address</th>
                  <th style={thNarrow}>Near</th>
                  <th style={thNarrow}>City / State</th>
                  <th style={thNarrow}>Contact Nos</th>
                  <th style={thNarrow}>Email</th>
                  <th style={thNarrow}>PAN</th>
                  <th style={thNarrow}>Bank</th>
                  <th style={thNarrow}>IFSC</th>
                  <th style={thNarrow}>A/c No</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={td} colSpan={12}>Loading…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={12}>No records</td>
                  </tr>
                ) : (
                  
                  rows.map((r) => (
                    <tr key={r.id} style={tr}>
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      </td>

                      <td style={td} onClick={() => onRowClick(r)}>{r.name || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.title || "-"}</td>
                      <td style={tdWrap} onClick={() => onRowClick(r)}>{r.address || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.near || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.city_state || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.contact_nos || "-"}</td>
                      <td style={tdWrap} onClick={() => onRowClick(r)}>{r.email || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.pan_no || "-"}</td>
                      <td style={tdWrap} onClick={() => onRowClick(r)}>{r.bank || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.ifsc_code || "-"}</td>
                      <td style={td} onClick={() => onRowClick(r)}>{r.account_no || "-"}</td>
                    </tr>
                  ))

                )}
              </tbody>
          </table>
        </div>

        <div style={serverText}>Server: /api/company-details</div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: 20,
  background: "#f6f8fc",
  minHeight: "100%",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
};

const title: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.1,
};

const subtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#475569",
  fontSize: 18,
};

const searchRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const searchInput: React.CSSProperties = {
  width: 450,
  height: 44,
  borderRadius: 18,
  border: "1px solid #d6deea",
  padding: "0 18px",
  fontSize: 16,
  background: "#f8fafc",
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 18,
  marginBottom: 16,
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 14,
};

const cardTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 20,
  color: "#0f172a",
};

const smallText: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  marginTop: 4,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 15,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 8,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 18,
  border: "1px solid #d6deea",
  padding: "0 16px",
  fontSize: 15,
  background: "#fff",
  boxSizing: "border-box",
};

const saveBtn: React.CSSProperties = {
  height: 52,
  minWidth: 108,
  padding: "0 22px",
  borderRadius: 18,
  border: "1px solid #1d4ed8",
  background: "#2563eb",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};

const btn: React.CSSProperties = {
  height: 44,
  padding: "0 22px",
  borderRadius: 18,
  border: "1px solid #d6deea",
  background: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  ...btn,
  background: "#f8fafc",
};

const btnDanger: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff5f5",
  color: "#ef4444",
  fontSize: 14,
  fontWeight: 700,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th: React.CSSProperties = {
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 700,
  fontSize: 14,
  textAlign: "left",
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  fontSize: 15,
  color: "#0f172a",
};

const tr: React.CSSProperties = {
  cursor: "pointer",
};

const serverText: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
  marginTop: 14,
};
const tdWrap: React.CSSProperties = {
  ...td,
  maxWidth: 220,
  whiteSpace: "normal",
  wordBreak: "break-word",
  lineHeight: 1.35,
};

const thNarrow: React.CSSProperties = {
  ...th,
  whiteSpace: "nowrap",
};