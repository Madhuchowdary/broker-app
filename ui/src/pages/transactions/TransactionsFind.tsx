import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const TX_API = "/api/transactions";

type Tx = {
  id: number;
  transaction_id?: string;

  seller?: string;
  sellerBrokerage?: string;
  buyer?: string;
  buyerBrokerage?: string;

  product?: string;
  rate?: string;
  unitRate?: string;
  tax?: string;
  quantity?: string;
  unitQty?: string;

  confirmDate?: string;
  deliveryTime?: string;
  deliveryPlace?: string;
  payment?: string;
  flag?: string;

  status?: "UNDELIVERED" | "DELIVERED";

  deliveryDate?: string;
  tankerNo?: string;
  billNo?: string;
  deliveryQty?: string;
  deliveryUnitQty?: string;
  amountRs?: string;
};

function safe(v: any) {
  return (v ?? "").toString();
}

export default function TransactionsFind() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Tx[]>([]);      // ✅ empty by default
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) : undefined),
    [rows, selectedId]
  );

  const [form, setForm] = useState<Tx>({ id: 0 });

  function set<K extends keyof Tx>(k: K, v: Tx[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function find() {
    const term = q.trim();
    if (!term) {
      alert("Enter search text");
      return;
    }

    const res = await fetch(`${TX_API}?q=${encodeURIComponent(term)}`, { method: "GET" });
    if (!res.ok) {
      alert("Find failed");
      return;
    }

    const data = await res.json();
    setLoadedOnce(true);
    setRows(Array.isArray(data) ? data : []);
    setSelectedId(null);
    setForm({ id: 0 });
  }

  function clear() {
    setQ("");
    setRows([]);
    setLoadedOnce(false);
    setSelectedId(null);
    setForm({ id: 0 });
  }

  function onRowClick(r: Tx) {
    setSelectedId(r.id);
    setForm({ ...r }); // load editable copy
  }

  async function update() {
    if (!selectedId) return;
    const res = await fetch(`${TX_API}/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Update failed");
      return;
    }

    const updated = await res.json();
    setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setForm(updated);
    alert("Updated");
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm("Delete this transaction?")) return;

    const res = await fetch(`${TX_API}/${selectedId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    setRows((prev) => prev.filter((x) => x.id !== selectedId));
    setSelectedId(null);
    setForm({ id: 0 });
  }

  return (
    <div style={wrap}>
      {/* Top header like master screens */}
      <div style={topBar}>
        <div>
          <div style={title}>Transactions</div>
          <div style={subTitle}>Find / Update / Delete transactions</div>
        </div>

        <div style={searchBar}>
          <input
            style={searchInput}
            value={q}
            placeholder="Find (seller/buyer/product/place/payment/flag/tanker/bill)..."
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") find();
            }}
          />
          <button style={btn} onClick={find}>Find</button>
          <button style={btn} onClick={clear}>Clear</button>
          <button style={btn} onClick={() => nav("/transactions/entry")}>Back</button>
        </div>
      </div>

      {/* Body */}
      <div style={body}>
        {/* Left: table */}
        <div style={card}>
          <div style={cardTitleRow}>
            <div style={cardTitle}>Transactions List</div>
            <div style={muted}>
              {loadedOnce ? `${rows.length} record(s)` : "No data loaded"}
            </div>
          </div>

          {!loadedOnce ? (
            <div style={emptyState}>
              Enter search text and click <b>Find</b>.
            </div>
          ) : rows.length === 0 ? (
            <div style={emptyState}>No records found.</div>
          ) : (
            <div style={{ overflow: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>ID</th>
                    <th style={th}>Tx ID</th>
                    <th style={th}>Seller</th>
                    <th style={th}>Buyer</th>
                    <th style={th}>Product</th>
                    <th style={th}>Confirm Date</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const active = r.id === selectedId;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => onRowClick(r)}
                        style={active ? trActive : tr}
                      >
                        <td style={td}>{r.id}</td>
                        <td style={td}>{safe(r.transaction_id)}</td>
                        <td style={td}>{safe(r.seller)}</td>
                        <td style={td}>{safe(r.buyer)}</td>
                        <td style={td}>{safe(r.product)}</td>
                        <td style={td}>{safe(r.confirmDate)}</td>
                        <td style={td}>{safe(r.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: edit panel */}
        <div style={card}>
          <div style={cardTitleRow}>
            <div style={cardTitle}>Details</div>
            <div style={muted}>{selectedId ? `Editing ID: ${selectedId}` : "Select a row"}</div>
          </div>

          <div style={formGrid}>
            <Field label="Seller" value={form.seller} onChange={(v) => set("seller", v)} />
            <Field label="Buyer" value={form.buyer} onChange={(v) => set("buyer", v)} />
            <Field label="Product" value={form.product} onChange={(v) => set("product", v)} />
            <Field label="Rate" value={form.rate} onChange={(v) => set("rate", v)} />
            <Field label="Quantity" value={form.quantity} onChange={(v) => set("quantity", v)} />
            <Field label="Confirm Date" value={form.confirmDate} onChange={(v) => set("confirmDate", v)} />
            <Field label="Delivery Place" value={form.deliveryPlace} onChange={(v) => set("deliveryPlace", v)} />
            <Field label="Payment" value={form.payment} onChange={(v) => set("payment", v)} />
            <Field label="Flag" value={form.flag} onChange={(v) => set("flag", v)} />
          </div>

          <div style={actions}>
            <button style={{ ...btn, opacity: selectedId ? 1 : 0.5 }} disabled={!selectedId} onClick={update}>
              Update
            </button>
            <button style={{ ...btnDanger, opacity: selectedId ? 1 : 0.5 }} disabled={!selectedId} onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#475569" }}>{label}</div>
      <input
        style={fieldInput}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* styles */
const wrap: React.CSSProperties = { padding: 18 };
const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};
const title: React.CSSProperties = { fontSize: 40, fontWeight: 900, color: "#0f172a" };
const subTitle: React.CSSProperties = { marginTop: 6, fontSize: 18, color: "#475569" };
const searchBar: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center" };

const searchInput: React.CSSProperties = {
  width: 520,
  height: 44,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  padding: "0 16px",
  fontSize: 16,
  outline: "none",
};

const btn: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 700,
};

const btnDanger: React.CSSProperties = {
  ...btn,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
};

const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const cardTitleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: 10,
};

const cardTitle: React.CSSProperties = { fontSize: 24, fontWeight: 900, color: "#0f172a" };
const muted: React.CSSProperties = { color: "#64748b", fontSize: 14 };

const emptyState: React.CSSProperties = {
  padding: 18,
  color: "#475569",
  background: "#f8fafc",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
};

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 14,
  color: "#64748b",
  padding: "12px 10px",
  borderBottom: "1px solid #e2e8f0",
};
const td: React.CSSProperties = { padding: "12px 10px", borderBottom: "1px solid #f1f5f9" };

const tr: React.CSSProperties = { cursor: "pointer" };
const trActive: React.CSSProperties = { cursor: "pointer", background: "#f1f5f9" };

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const fieldInput: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  padding: "0 12px",
  outline: "none",
  fontSize: 14,
};

const actions: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};
