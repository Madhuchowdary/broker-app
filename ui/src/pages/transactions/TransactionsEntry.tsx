import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxContext } from "./TransactionsShell";
import type { Transaction } from "./TransactionsShell";

type FormState = Omit<Transaction, "status"> & {
  status: "DELIVERED" | "UNDELIVERED";
};

const TX_API = "/api/transactions";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Date -> "dd-mm-yy"
function toDDMMYY(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = pad2(d.getFullYear() % 100);
  return `${dd}-${mm}-${yy}`;
}

// "dd-mm-yy" or "dd/mm/yy" -> Date | null
function fromDDMMYY(s: string) {
  const t = (s || "").trim().replaceAll("/", "-");
  const m = t.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  const yyyy = 2000 + yy; // adjust if you need 19xx later
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  // validate round-trip
  if (d.getDate() !== dd || d.getMonth() !== mm - 1 || d.getFullYear() !== yyyy) return null;
  return d;
}

// Date -> "yyyy-mm-dd" (for <input type="date">)
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "yyyy-mm-dd" -> Date
function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export default function TransactionsEntry() {
  const nav = useNavigate();
  const store = useContext(TxContext);
  const [deliveryDateTouched, setDeliveryDateTouched] = useState(false);

  if (!store) return null;

  const { rows, setRows, selectedId, setSelectedId, showDeliveryPanel, setShowDeliveryPanel } = store;

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) : undefined),
    [rows, selectedId]
  );

  const [searchQ, setSearchQ] = useState("");
  const [gridRows, setGridRows] = useState<any[]>([]); // results list
  const [gridLoaded, setGridLoaded] = useState(false); // to keep empty until search
  const [gridLoading, setGridLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleSelect(id: number, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) return setSelectedIds([]);
    setSelectedIds(gridRows.map((r) => Number(r.id)).filter((n) => n > 0));
  }

  const [form, setForm] = useState<FormState>(() => ({
    id: selected?.id ?? 0,
    transaction_id: "",
    seller: "",
    sellerBrokerage: "",
    buyer: "",
    buyerBrokerage: "",
    product: "",
    rate: "",
    unitRate: "",
    tax: "Plus VAT",
    quantity: "",
    unitQty: "",

    deliveryTime: "",
    confirmDate: toDDMMYY(new Date()),
    deliveryDate: toDDMMYY(addDays(new Date(), 7)),

    deliveryPlace: "",
    payment: "",
    flag: "",
    status: "UNDELIVERED",

    tankerNo: "",
    billNo: "",
    deliveryQty: "0",
    deliveryUnitQty: "",
    amountRs: "0.00",
  }));

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function addNew() {
    setSelectedId(null);
    setShowDeliveryPanel(false);
    setDeliveryDateTouched(false);

    setForm(() => ({
      id: 0,
      transaction_id: "",
      seller: "",
      sellerBrokerage: "",
      buyer: "",
      buyerBrokerage: "",
      product: "",
      rate: "",
      unitRate: "",
      tax: "Plus VAT",
      quantity: "",
      unitQty: "",

      deliveryTime: "",
      confirmDate: toDDMMYY(new Date()),
      deliveryDate: toDDMMYY(addDays(new Date(), 7)),

      deliveryPlace: "",
      payment: "",
      flag: "",
      status: "UNDELIVERED",

      tankerNo: "",
      billNo: "",
      deliveryQty: "0",
      deliveryUnitQty: "",
      amountRs: "0.00",
    }));
  }

  async function save() {
    const isNew = !selectedId || form.id === 0;
    const url = isNew ? TX_API : `${TX_API}/${selectedId}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Save failed");
      return;
    }

    const saved = await res.json();

    setRows((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });

    setSelectedId(saved.id);

    // keep tx id visible even if FormState type doesn't include it
    setForm((p) => ({ ...p, ...(saved || {}) }));
  }

  async function update() {
    if (!selectedId) return;
    await save();
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm("Remove this transaction?")) return;

    const res = await fetch(`${TX_API}/${selectedId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Remove failed");
      return;
    }

    setRows((prev) => prev.filter((x) => x.id !== selectedId));
    setSelectedId(null);
    setShowDeliveryPanel(false);
  }

  async function searchGrid(opts?: { status?: "UNDELIVERED" | "DELIVERED" | "" }) {
    const q = (searchQ || "").trim();
    const status = (opts?.status ?? "").trim();

    if (!q && !status) {
      setGridRows([]);
      setGridLoaded(true);
      return;
    }

    setGridLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);

      const res = await fetch(`${TX_API}?${params.toString()}`);
      const data = await res.json();
      setGridRows(Array.isArray(data) ? data : []);
      setGridLoaded(true);
      setSelectedIds([]);
    } finally {
      setGridLoading(false);
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} transaction(s)?`)) return;

    // If you don't have bulk-delete endpoint, delete one by one safely
    for (const id of selectedIds) {
      await fetch(`${TX_API}/${id}`, { method: "DELETE" });
    }

    setGridRows((prev) => prev.filter((r) => !selectedIds.includes(Number(r.id))));
    setSelectedIds([]);
  }

  type Opt = { id: number; name: string };

  const [unitRateOpts, setUnitRateOpts] = useState<Opt[]>([]);
  const [unitQtyOpts, setUnitQtyOpts] = useState<Opt[]>([]);
  const [deliveryPlaceOpts, setDeliveryPlaceOpts] = useState<Opt[]>([]);
  const [paymentOpts, setPaymentOpts] = useState<Opt[]>([]);
  const [flagOpts, setFlagOpts] = useState<Opt[]>([]);

  type ClientOpt = { id: number; name: string; mobile?: string };
  const [clientOpts, setClientOpts] = useState<ClientOpt[]>([]);
  const [productOpts, setProductOpts] = useState<Opt[]>([]);

  async function fetchOpts(url: string): Promise<Opt[]> {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((x: any) => ({
        id: Number(x.id),
        name: (x.name ?? x.label ?? "").toString(),
      }))
      .filter((x) => x.id > 0 && x.name.trim().length > 0);
  }

  async function fetchClients(): Promise<ClientOpt[]> {
    const res = await fetch("/api/clients");
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((x: any) => ({
        id: Number(x.id),
        name: (x.name ?? "").toString(),
        mobile: (x.mobile ?? "").toString(),
      }))
      .filter((x) => x.id > 0 && x.name.trim().length > 0);
  }

  async function fetchProducts(): Promise<Opt[]> {
    // Prefer real items API if present, else fallback to item-types
    const tryUrls = ["/api/items", "/api/item-types"];
    for (const u of tryUrls) {
      try {
        const res = await fetch(u);
        if (!res.ok) continue;
        const data = await res.json();
        if (!Array.isArray(data)) continue;

        const out = data
          .map((x: any) => ({
            id: Number(x.id),
            name: (x.name ?? x.item_name ?? x.label ?? "").toString(),
          }))
          .filter((x: any) => x.id > 0 && x.name.trim().length > 0);

        if (out.length) return out;
      } catch {
        // ignore and try next url
      }
    }
    return [];
  }

  // Load dropdown data once
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [ur, uq, dp, pay, flg, clients, products] = await Promise.all([
          fetchOpts("/api/rate-per-unit"),
          fetchOpts("/api/qty-types"),
          fetchOpts("/api/delivery-places"),
          fetchOpts("/api/payment-types"),
          fetchOpts("/api/flags"),
          fetchClients(),
          fetchProducts(),
        ]);

        if (!alive) return;
        setUnitRateOpts(ur);
        setUnitQtyOpts(uq);
        setDeliveryPlaceOpts(dp);
        setPaymentOpts(pay);
        setFlagOpts(flg);
        setClientOpts(clients);
        setProductOpts(products);
      } catch (e) {
        console.error(e);
        alert("Failed to load master dropdowns. Check server is running.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // if user selects something from Find, we load that record into form
  React.useEffect(() => {
    if (!selected) return;
    setForm((p) => ({ ...p, ...selected } as any));
    setDeliveryDateTouched(true); // loaded record has its own deliveryDate
  }, [selected]);

  return (
    <div style={wrap}>
      {/* Searchable dropdown sources */}
      <datalist id="clientsList">
        {clientOpts.map((c) => (
          <option key={c.id} value={c.name}>
            {c.mobile ? `(${c.mobile})` : ""}
          </option>
        ))}
      </datalist>

      <datalist id="productsList">
        {productOpts.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <datalist id="unitRateList">
        {unitRateOpts.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <datalist id="unitQtyList">
        {unitQtyOpts.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <datalist id="deliveryPlaceList">
        {deliveryPlaceOpts.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <datalist id="paymentList">
        {paymentOpts.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <datalist id="flagList">
        {flagOpts.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <div style={mainArea}>
        {/* Left + Middle content */}
        <div style={contentArea}>
          {/* Top two columns: Seller / Buyer */}
          <div style={twoCol}>
            <Section title="Seller" titleColor="#ffd400" sectionStyle={section} titleBarStyle={titleBar}>
              <Row label="Seller" rowStyle={row} lblStyle={lbl}>
                <input
                  style={input}
                  list="clientsList"
                  value={form.seller}
                  onChange={(e) => set("seller", e.target.value)}
                  placeholder="Type to search..."
                />
              </Row>
              <Row label="Brokerage" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.sellerBrokerage} onChange={(e) => set("sellerBrokerage", e.target.value)} />
              </Row>
            </Section>

            <Section title="Buyer" titleColor="#1ee6ff" sectionStyle={section} titleBarStyle={titleBar}>
              <Row label="Buyer" rowStyle={row} lblStyle={lbl}>
                <input
                  style={input}
                  list="clientsList"
                  value={form.buyer}
                  onChange={(e) => set("buyer", e.target.value)}
                  placeholder="Type to search..."
                />
              </Row>
              <Row label="Brokerage" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.buyerBrokerage} onChange={(e) => set("buyerBrokerage", e.target.value)} />
              </Row>
            </Section>
          </div>

          {/* Mid two columns: Product Details / Transaction Details */}
          <div style={twoCol}>
            <Section title="Product Details" titleColor="#ffffff" sectionStyle={section} titleBarStyle={titleBar}>
              <Row label="Product" rowStyle={row} lblStyle={lbl}>
                <input
                  style={input}
                  list="productsList"
                  value={form.product}
                  onChange={(e) => set("product", e.target.value)}
                  placeholder="Type to search..."
                />
              </Row>

              <Row label="Rate" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.rate} onChange={(e) => set("rate", e.target.value)} />
              </Row>

              <Row label="Unit (Rate)" rowStyle={row} lblStyle={lbl}>
                <input
                  style={selectSearch}
                  list="unitRateList"
                  value={form.unitRate}
                  onChange={(e) => set("unitRate", e.target.value)}
                  placeholder="Type to search unit (rate)..."
                />
              </Row>

              <Row label="Tax" rowStyle={row} lblStyle={lbl}>
                <select style={select} value={form.tax} onChange={(e) => set("tax", e.target.value)}>
                  <option>Plus VAT</option>
                  <option>Plus GST</option>
                  <option>VAT Exempt</option>
                </select>
              </Row>

              <Row label="Quantity" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
              </Row>

              <Row label="Unit (Qty)" rowStyle={row} lblStyle={lbl}>
                <input
                  style={selectSearch}
                  list="unitQtyList"
                  value={form.unitQty}
                  onChange={(e) => set("unitQty", e.target.value)}
                  placeholder="Type to search unit (qty)..."
                />
              </Row>

              <div style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
                  S NO: {(form as any).id || "-"}
              </div>  

              <div style={{ fontSize: 12, textAlign: "center", marginTop: 10 }}>
                Tx ID: {(form as any).transaction_id || "-"}
              </div>
            </Section>

            <Section title="Transaction Details" titleColor="#ff7a18" sectionStyle={section} titleBarStyle={titleBar}>
              <Row label="Confirm Date" rowStyle={row} lblStyle={lbl}>
                <div style={dateBox}>
                  <input style={dateInput} value={form.confirmDate} readOnly />

                  <input
                    type="date"
                    style={datePickerHidden}
                    value={toISODate(fromDDMMYY(form.confirmDate) || new Date())}
                    onChange={(e) => {
                      const d = fromISODate(e.target.value);
                      set("confirmDate", toDDMMYY(d));

                      if (!deliveryDateTouched) {
                        set("deliveryDate", toDDMMYY(addDays(d, 7)));
                      }
                    }}
                  />

                  <div style={calBtn}>📅</div>
                </div>
              </Row>

              <Row label="Delivery Date" rowStyle={row} lblStyle={lbl}>
                <div style={dateBox}>
                  <input style={dateInput} value={form.deliveryDate ?? ""} readOnly />

                  <input
                    type="date"
                    style={datePickerHidden}
                    value={toISODate(
                      fromDDMMYY(form.deliveryDate || "") || addDays(fromDDMMYY(form.confirmDate) || new Date(), 7)
                    )}
                    onChange={(e) => {
                      const d = fromISODate(e.target.value);
                      setDeliveryDateTouched(true);
                      set("deliveryDate", toDDMMYY(d));
                    }}
                  />

                  <div style={calBtn}>📅</div>
                </div>
              </Row>

              <Row label="Delivery Time" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.deliveryTime} onChange={(e) => set("deliveryTime", e.target.value)} />
              </Row>

              <Row label="Delivery Place" rowStyle={row} lblStyle={lbl}>
                <input
                  style={selectSearch}
                  list="deliveryPlaceList"
                  value={form.deliveryPlace}
                  onChange={(e) => set("deliveryPlace", e.target.value)}
                  placeholder="Type to search delivery place..."
                />
              </Row>

              <Row label="Payment" rowStyle={row} lblStyle={lbl}>
                <input
                  style={selectSearch}
                  list="paymentList"
                  value={form.payment}
                  onChange={(e) => set("payment", e.target.value)}
                  placeholder="Type to search payment..."
                />
              </Row>

              <Row label="Flag" rowStyle={row} lblStyle={lbl}>
                <input
                  style={selectSearch}
                  list="flagList"
                  value={form.flag}
                  onChange={(e) => set("flag", e.target.value)}
                  placeholder="Type to search flag..."
                />
              </Row>

              {/* Delivery Details only when needed */}
              {showDeliveryPanel && (
                <div style={{ marginTop: 18 }}>
                  <div style={subTitleBar}>
                    <div style={{ color: "#ffd400", fontWeight: 800 }}>Delivery Details</div>
                  </div>

                  <div style={{ padding: 12 }}>
                    <Row label="Tanker No" rowStyle={row} lblStyle={lbl}>
                      <input style={input} value={form.tankerNo ?? ""} onChange={(e) => set("tankerNo", e.target.value)} />
                    </Row>
                    <Row label="Bill No" rowStyle={row} lblStyle={lbl}>
                      <input style={input} value={form.billNo ?? ""} onChange={(e) => set("billNo", e.target.value)} />
                    </Row>
                    <Row label="Delivery Qty" rowStyle={row} lblStyle={lbl}>
                      <input style={input} value={form.deliveryQty ?? ""} onChange={(e) => set("deliveryQty", e.target.value)} />
                    </Row>
                    <Row label="Unit (Qty)" rowStyle={row} lblStyle={lbl}>
                      <input
                        style={input}
                        value={form.deliveryUnitQty ?? ""}
                        onChange={(e) => set("deliveryUnitQty", e.target.value)}
                      />
                    </Row>
                    <Row label="Amount Rs." rowStyle={row} lblStyle={lbl}>
                      <input style={input} value={form.amountRs ?? ""} onChange={(e) => set("amountRs", e.target.value)} />
                    </Row>
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* SEARCH GRID (same screen) */}
          <div style={{ padding: 10, borderTop: "1px solid #8c95a3", background: "#f7f7f7" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, color: "#1f2a3a" }}>Find Transactions</div>

              <input
                style={{ ...searchInput, width: 360 }}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search seller / buyer / product / tanker / bill etc..."
                onKeyDown={(e) => (e.key === "Enter" ? searchGrid() : null)}
              />

              <button style={btnTop} onClick={() => searchGrid()}>
                Search
              </button>

              <button style={btnTop} onClick={() => searchGrid({ status: "UNDELIVERED" })}>
                Show Undelivered
              </button>

              <button
                style={{
                  ...btnTopDanger,
                  opacity: selectedIds.length ? 1 : 0.5,
                  cursor: selectedIds.length ? "pointer" : "not-allowed",
                }}
                disabled={!selectedIds.length}
                onClick={bulkDeleteSelected}
              >
                Bulk Delete ({selectedIds.length})
              </button>

              <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>
                {gridLoading ? "Loading..." : gridLoaded ? `${gridRows.length} record(s)` : "Enter search and click Search"}
              </div>
            </div>

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>
                      <input
                        type="checkbox"
                        checked={gridRows.length > 0 && selectedIds.length === gridRows.length}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th style={th}>ID</th>
                    <th style={th}>Tx ID</th>
                    <th style={th}>Seller</th>
                    <th style={th}>Buyer</th>
                    <th style={th}>Product</th>
                    <th style={th}>Rate</th>
                    <th style={th}>UnitRate</th>
                    <th style={th}>Qty</th>
                    <th style={th}>UnitQty</th>
                    <th style={th}>Confirm</th>
                    <th style={th}>Delivery</th>
                    <th style={th}>Place</th>
                    <th style={th}>Payment</th>
                    <th style={th}>Flag</th>
                    <th style={th}>Status</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {!gridLoaded ? (
                    <tr>
                      <td style={emptyTd} colSpan={17}>
                        Type search and click Search.
                      </td>
                    </tr>
                  ) : gridRows.length === 0 ? (
                    <tr>
                      <td style={emptyTd} colSpan={17}>
                        No results.
                      </td>
                    </tr>
                  ) : (
                    gridRows.map((r) => (
                      <tr key={r.id} style={{ background: selectedId === r.id ? "#eef2ff" : "white" }}>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(Number(r.id))}
                            onChange={(e) => toggleSelect(Number(r.id), e.target.checked)}
                          />
                        </td>
                        <td style={td}>{r.id}</td>
                        <td style={td}>{r.transaction_id || "-"}</td>
                        <td style={td}>{r.seller || ""}</td>
                        <td style={td}>{r.buyer || ""}</td>
                        <td style={td}>{r.product || ""}</td>
                        <td style={td}>{r.rate || ""}</td>
                        <td style={td}>{r.unit_rate || r.unitRate || ""}</td>
                        <td style={td}>{r.quantity || ""}</td>
                        <td style={td}>{r.unit_qty || r.unitQty || ""}</td>
                        <td style={td}>{r.confirm_date || r.confirmDate || ""}</td>
                        <td style={td}>{r.delivery_date || r.deliveryDate || ""}</td>
                        <td style={td}>{r.delivery_place || r.deliveryPlace || ""}</td>
                        <td style={td}>{r.payment || ""}</td>
                        <td style={td}>{r.flag || ""}</td>
                        <td style={td}>{r.status || ""}</td>
                        <td style={td}>
                          <button
                            style={miniBtn}
                            onClick={() => {
                              setSelectedId(Number(r.id));
                              setShowDeliveryPanel((r.status || "") === "UNDELIVERED");
                              setForm((p) => ({ ...p, ...(r as any) }));
                            }}
                          >
                            Modify
                          </button>
                          <button
                            style={miniBtnDanger}
                            onClick={async () => {
                              if (!confirm("Delete this transaction?")) return;
                              await fetch(`${TX_API}/${r.id}`, { method: "DELETE" });
                              setGridRows((prev) => prev.filter((x) => Number(x.id) !== Number(r.id)));
                              setSelectedIds((prev) => prev.filter((x) => x !== Number(r.id)));
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right button column */}
        <div style={rightPanel}>
          <ActionBtn label="Add New" onClick={addNew} btnStyle={btn} />
          <ActionBtn label="Save" onClick={save} btnStyle={btn} />
          <ActionBtn label="Update" onClick={update} btnStyle={btn} />
         <ActionBtn
            label="View Report"
            onClick={() => {
                const tid = selectedId || form.id;
                if (!tid) return alert("Please save/select a transaction first");
                nav(`/transactions/report/${tid}`);
            }}
            btnStyle={btn}
         />


        </div>
      </div>
    </div>
  );
}

/* --- styles tuned to match screenshot structure --- */
const wrap: React.CSSProperties = {
  height: "100%",
};

const mainArea: React.CSSProperties = {
  display: "flex",
  border: "1px solid #8c95a3",
  background: "#e6e9ef",
  minHeight: 640,
};

const contentArea: React.CSSProperties = {
  flex: 1,
  padding: 0,
  width: '79%'
};

const rightPanel: React.CSSProperties = {
  width: '20%',
  background: "#bfe7ef",
  borderLeft: "1px solid #8c95a3",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const btn: React.CSSProperties = {
  height: 32,
  border: "1px solid #a9a9a9",
  background: "#e9e2d3",
  fontSize: 12,
  textAlign: "left",
  paddingLeft: 10,
  cursor: "pointer",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 0,
};

const section: React.CSSProperties = {
  borderRight: "1px solid #8c95a3",
  borderBottom: "1px solid #8c95a3",
  background: "#f7f7f7",
  minHeight: 180,
};

const titleBar: React.CSSProperties = {
  height: 28,
  background: "#1f2a3a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
};

const subTitleBar: React.CSSProperties = {
  height: 28,
  background: "#2b4d87",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #243b63",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const lbl: React.CSSProperties = {
  width: 110,
  color: "#4b5563",
  fontSize: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 22,
  border: "0",
  borderBottom: "1px solid #c1c7d0",
  background: "transparent",
  outline: "none",
  fontSize: 12,
};

const select: React.CSSProperties = {
  width: "100%",
  height: 24,
  border: "1px solid #c1c7d0",
  background: "#efefef",
  fontSize: 12,
};

const selectSearch: React.CSSProperties = {
  ...select,
  paddingLeft: 6,
};

const datePickerHidden: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 210,
  height: 22,
  opacity: 0,
  cursor: "pointer",
};

const dateBox: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: 210,
  borderBottom: "1px solid #c1c7d0",
};

const dateInput: React.CSSProperties = {
  ...input,
  borderBottom: "0",
};

const calBtn: React.CSSProperties = {
  width: 22,
  height: 18,
  border: "1px solid #c1c7d0",
  background: "#efefef",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  marginLeft: 6,
};

const searchInput: React.CSSProperties = {
  height: 28,
  border: "1px solid #c1c7d0",
  background: "#ffffff",
  outline: "none",
  borderRadius: 6,
  padding: "0 10px",
  fontSize: 12,
};

const btnTop: React.CSSProperties = {
  height: 28,
  borderRadius: 6,
  border: "1px solid #a9a9a9",
  background: "#e9e2d3",
  fontSize: 12,
  padding: "0 10px",
  cursor: "pointer",
  fontWeight: 700,
};

const btnTopDanger: React.CSSProperties = {
  ...btnTop,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
};

const tableWrap: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  borderRadius: 8,
  border: "1px solid #eef2f7",
  background: "white",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "white",
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  padding: "8px 10px",
  borderBottom: "1px solid #eef2f7",
  background: "#fafbff",
  position: "sticky",
  top: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 12,
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const emptyTd: React.CSSProperties = {
  padding: 16,
  color: "#64748b",
  textAlign: "center",
};

const miniBtn: React.CSSProperties = {
  height: 24,
  borderRadius: 6,
  border: "1px solid #a9a9a9",
  background: "#e9e2d3",
  fontSize: 12,
  padding: "0 8px",
  cursor: "pointer",
  marginRight: 6,
};

const miniBtnDanger: React.CSSProperties = {
  ...miniBtn,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
};

function ActionBtn({
  label,
  onClick,
  btnStyle,
}: {
  label: string;
  onClick: () => void;
  btnStyle: React.CSSProperties;
}) {
  return (
    <button style={btnStyle} onClick={onClick}>
      {label}
    </button>
  );
}

function Section({
  title,
  titleColor,
  children,
  sectionStyle,
  titleBarStyle,
}: {
  title: string;
  titleColor: string;
  children: React.ReactNode;
  sectionStyle: React.CSSProperties;
  titleBarStyle: React.CSSProperties;
}) {
  return (
    <div style={sectionStyle}>
      <div style={titleBarStyle}>
        <div style={{ color: titleColor, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
  rowStyle,
  lblStyle,
}: {
  label: string;
  children: React.ReactNode;
  rowStyle: React.CSSProperties;
  lblStyle: React.CSSProperties;
}) {
  return (
    <div style={rowStyle}>
      <div style={lblStyle}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
