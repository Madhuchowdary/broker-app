import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxContext } from "./TransactionsShell";
import type { Transaction } from "./TransactionsShell";


type FormState = Omit<Transaction, "status"> & { status: "DELIVERED" | "UNDELIVERED" };
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
    setShowDeliveryPanel(false); // ✅ daily entry mode
    setDeliveryDateTouched(false);

    setForm((p) => ({
      ...p,
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
      deliveryPlace: "",
      payment: "",
      flag: "",
      status: "UNDELIVERED",
      confirmDate: toDDMMYY(new Date()),
      deliveryDate: toDDMMYY(addDays(new Date(), 7)),

      tankerNo: "",
      billNo: "",
      deliveryQty: "0",
      deliveryUnitQty: "",
      amountRs: "0.00",
    }));
  }

    async function save() {
    // create if id=0 else update
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

    // keep your context store in sync
    setRows((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });

    setSelectedId(saved.id);
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


    async function fetchTransactions(params: { q?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);

  setGridLoading(true);
  try {
    const res = await fetch(`/api/transactions?${qs.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setGridRows(Array.isArray(data) ? data : []);
    setGridLoaded(true);
    setSelectedIds([]);
  } finally {
    setGridLoading(false);
  }
}

    async function onFindClick() {
    const q = searchQ.trim();
    if (!q) {
        // per your requirement: don't load grid unless search
        setGridRows([]);
        setGridLoaded(false);
        return;
    }
    await fetchTransactions({ q });
    }

    async function onShowUndelivered() {
    await fetchTransactions({ status: "UNDELIVERED", q: searchQ.trim() || undefined });
    }


    function loadRowToForm(r: any) {
  setSelectedId(Number(r.id));
  setShowDeliveryPanel(r.status === "UNDELIVERED"); // you can adjust
  setForm((p) => ({ ...p, ...r }));
}

    async function deleteOne(id: number) {
    if (!confirm("Delete this transaction?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) return alert("Delete failed");

    setGridRows((prev) => prev.filter((x) => Number(x.id) !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (selectedId === id) {
        setSelectedId(null);
        setShowDeliveryPanel(false);
    }
    }

    async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete selected (${selectedIds.length})?`)) return;

    const res = await fetch(`/api/transactions/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
    });

    if (!res.ok) return alert("Bulk delete failed");

    setGridRows((prev) => prev.filter((r) => !selectedIds.includes(Number(r.id))));
    setSelectedIds([]);
    }

    // function openFind() {
    //     nav("/transactions/find");
    // }

    type Opt = { id: number; name: string };

    const [unitRateOpts, setUnitRateOpts] = useState<Opt[]>([]);
    const [unitQtyOpts, setUnitQtyOpts] = useState<Opt[]>([]);
    const [deliveryPlaceOpts, setDeliveryPlaceOpts] = useState<Opt[]>([]);
    const [paymentOpts, setPaymentOpts] = useState<Opt[]>([]);
    const [flagOpts, setFlagOpts] = useState<Opt[]>([]);

    async function fetchOpts(url: string): Promise<Opt[]> {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // normalize: some APIs might return {name} or {label}
    return data
        .map((x: any) => ({
        id: Number(x.id),
        name: (x.name ?? x.label ?? "").toString(),
        }))
        .filter((x) => x.id > 0 && x.name.trim().length > 0);
    }

// Load dropdown data once
    React.useEffect(() => {
    let alive = true;

    (async () => {
        try {
        const [ur, uq, dp, pay, flg] = await Promise.all([
            fetchOpts("http://localhost:4000/api/rate-per-unit"),
            fetchOpts("http://localhost:4000/api/qty-types"),
            fetchOpts("http://localhost:4000/api/delivery-places"),
            fetchOpts("http://localhost:4000/api/payment-types"),
            fetchOpts("http://localhost:4000/api/flags"),
        ]);

        if (!alive) return;
        setUnitRateOpts(ur);
        setUnitQtyOpts(uq);
        setDeliveryPlaceOpts(dp);
        setPaymentOpts(pay);
        setFlagOpts(flg);
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
        setForm((p) => ({ ...p, ...selected }));
        setDeliveryDateTouched(true); // loaded record has its own deliveryDate
    }, [selected]);


  return (
    <div style={wrap}>
      <div style={mainArea}>
        {/* Left + Middle content (white-ish) */}
        <div style={contentArea}>
          {/* Top two columns: Seller / Buyer */}
          <div style={twoCol}>
            <Section
                title="Seller"
                titleColor="#ffd400"
                sectionStyle={section}
                titleBarStyle={titleBar}
                >

             <Row label="Seller" rowStyle={row} lblStyle={lbl}>

                <input style={input} value={form.seller} onChange={(e) => set("seller", e.target.value)} />
              </Row>
              <Row label="Brokerage" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.sellerBrokerage} onChange={(e) => set("sellerBrokerage", e.target.value)} />
              </Row>
            </Section>

            <Section title="Buyer" titleColor="#1ee6ff" sectionStyle={section}  titleBarStyle={titleBar}>
              <Row label="Buyer" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.buyer} onChange={(e) => set("buyer", e.target.value)} />
              </Row>
              <Row label="Brokerage" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.buyerBrokerage} onChange={(e) => set("buyerBrokerage", e.target.value)} />
              </Row>
            </Section>
          </div>




          {/* Mid two columns: Product Details / Transaction Details */}
          <div style={twoCol}>
            <Section title="Product Details" titleColor="#ffffff"  sectionStyle={section}  titleBarStyle={titleBar}>
              <Row label="Product" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.product} onChange={(e) => set("product", e.target.value)} />
              </Row>
              <Row label="Rate" rowStyle={row} lblStyle={lbl}>
                <input style={input} value={form.rate} onChange={(e) => set("rate", e.target.value)} />
              </Row>
              <Row label="Unit (Rate)" rowStyle={row} lblStyle={lbl}>
                <select
                    style={select}
                    value={form.unitRate}
                    onChange={(e) => set("unitRate", e.target.value)}
                >
                    <option value="">Select unit (rate)</option>
                    {unitRateOpts.map((o) => (
                    <option key={o.id} value={o.name}>
                        {o.name}
                    </option>
                    ))}
                </select>
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
                <select
                    style={select}
                    value={form.unitQty}
                    onChange={(e) => set("unitQty", e.target.value)}
                >
                    <option value="">Select unit (qty)</option>
                    {unitQtyOpts.map((o) => (
                    <option key={o.id} value={o.name}>
                        {o.name}
                    </option>
                    ))}
                </select>
                </Row>


            <div style={bottomNo}> NO : {form.id ? form.id : ""}</div>
                <div style={{ fontSize: 12, textAlign: "center", marginTop: 6 }}>
                Tx ID: {(form as any).transaction_id || "-"}
            </div>

            </Section>

            <Section title="Transaction Details" titleColor="#ff7a18"  sectionStyle={section}  titleBarStyle={titleBar}>
              <Row label="Confirm Date" rowStyle={row} lblStyle={lbl}>
                <div style={dateBox}>
                    {/* display dd-mm-yy */}
                    <input style={dateInput} value={form.confirmDate} readOnly />

                    {/* real picker */}
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
                        fromDDMMYY(form.deliveryDate || "") ||
                        addDays(fromDDMMYY(form.confirmDate) || new Date(), 7)
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

             <Row label="Delivery Place" rowStyle={row} lblStyle={lbl}>
                <select
                    style={select}
                    value={form.deliveryPlace}
                    onChange={(e) => set("deliveryPlace", e.target.value)}
                >
                    <option value="">Select delivery place</option>
                    {deliveryPlaceOpts.map((o) => (
                    <option key={o.id} value={o.name}>
                        {o.name}
                    </option>
                    ))}
                </select>
            </Row>

            <Row label="Payment" rowStyle={row} lblStyle={lbl}>
                <select
                    style={select}
                    value={form.payment}
                    onChange={(e) => set("payment", e.target.value)}
                >
                    <option value="">Select payment</option>
                    {paymentOpts.map((o) => (
                    <option key={o.id} value={o.name}>
                        {o.name}
                    </option>
                    ))}
                </select>
            </Row>

             <Row label="Flag" rowStyle={row} lblStyle={lbl}>
                <select
                    style={select}
                    value={form.flag}
                    onChange={(e) => set("flag", e.target.value)}
                >
                    <option value="">Select flag</option>
                    {flagOpts.map((o) => (
                    <option key={o.id} value={o.name}>
                        {o.name}
                    </option>
                    ))}
                </select>
            </Row>


              {/* ✅ Delivery Details appears only when loaded from Find and undelivered */}
              {showDeliveryPanel && (
                <div style={{ marginTop: 18 }}>
                  <div style={subTitleBar}>
                    <div style={{ color: "#ffd400", fontWeight: 800 }}>Delivery Details</div>
                  </div>

                  <div style={{ padding: 12 }}>
                    <Row label="Delivery Date" rowStyle={row} lblStyle={lbl}>
                        <div style={dateBox}>
                            <input style={dateInput} value={form.deliveryDate ?? ""} readOnly />

                            <input
                            type="date"
                            style={datePickerHidden}
                            value={toISODate(fromDDMMYY(form.deliveryDate || "") || addDays(fromDDMMYY(form.confirmDate) || new Date(), 7))}
                            onChange={(e) => {
                                const d = fromISODate(e.target.value);
                                setDeliveryDateTouched(true);
                                set("deliveryDate", toDDMMYY(d));
                            }}
                            />

                            <div style={calBtn}>📅</div>
                        </div>
                    </Row>

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
                      <input style={input} value={form.deliveryUnitQty ?? ""} onChange={(e) => set("deliveryUnitQty", e.target.value)} />
                    </Row>
                    <Row label="Amount Rs." rowStyle={row} lblStyle={lbl}>
                      <input style={input} value={form.amountRs ?? ""} onChange={(e) => set("amountRs", e.target.value)} />
                    </Row>
                  </div>
                </div>
              )}
            </Section>
          </div>



                    {/* ---- Search + Grid (loads only after Find / Show Undelivered) ---- */}
            <div style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                style={{
                    flex: 1,
                    height: 34,
                    border: "1px solid #d0d7e2",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontSize: 13,
                }}
                placeholder="Find (seller/buyer/product/payment/flag/bill/tanker)..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") onFindClick();
                }}
                />

                <button style={pillBtn} onClick={onFindClick}>Find</button>
                <button style={pillBtn} onClick={onShowUndelivered}>Show Undelivered</button>

                <button
                style={{
                    ...pillBtn,
                    background: selectedIds.length ? "#ffecec" : "#f5f7fb",
                    borderColor: selectedIds.length ? "#ffb4b4" : "#d0d7e2",
                    color: selectedIds.length ? "#b42318" : "#111827",
                }}
                onClick={bulkDelete}
                disabled={selectedIds.length === 0}
                >
                Delete Selected ({selectedIds.length})
                </button>

                {gridLoading && <div style={{ fontSize: 12, color: "#6b7280" }}>Loading...</div>}
            </div>

            {gridLoaded && (
                <div style={{ marginTop: 12, background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ padding: 12, fontWeight: 800 }}>Transactions</div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                    <tr style={{ background: "#f7fafc", borderTop: "1px solid #eef2f7", borderBottom: "1px solid #eef2f7" }}>
                        <th style={th}><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === gridRows.length} onChange={(e)=>toggleSelectAll(e.target.checked)} /></th>
                        <th style={th}>ID</th>
                        <th style={th}>Tx ID</th>
                        <th style={th}>Seller</th>
                        <th style={th}>Buyer</th>
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
                    {gridRows.map((r) => {
                        const id = Number(r.id);
                        const checked = selectedIds.includes(id);

                        return (
                        <tr key={id} style={{ borderBottom: "1px solid #eef2f7" }}>
                            <td style={td}>
                            <input type="checkbox" checked={checked} onChange={(e) => toggleSelect(id, e.target.checked)} />
                            </td>

                            <td style={td}>{id}</td>
                            <td style={td}>{r.transaction_id || "-"}</td>

                            {/* per your note: seller/buyer not editable in grid -> just display */}
                            <td style={td}>{r.seller || "-"}</td>
                            <td style={td}>{r.buyer || "-"}</td>

                            {/* confirmDate not editable in grid -> just display */}
                            <td style={td}>{r.confirmDate || r.confirm_date || "-"}</td>

                            <td style={td}>{r.deliveryDate || r.delivery_date || "-"}</td>
                            <td style={td}>{r.deliveryPlace || r.delivery_place || "-"}</td>
                            <td style={td}>{r.payment || "-"}</td>
                            <td style={td}>{r.flag || "-"}</td>
                            <td style={td}>{r.status || "-"}</td>

                            <td style={td}>
                            <button style={miniBtn} onClick={() => loadRowToForm(r)}>Modify</button>
                            <button style={{ ...miniBtn, marginLeft: 8, background: "#ffecec", borderColor: "#ffb4b4", color: "#b42318" }} onClick={() => deleteOne(id)}>
                                Delete
                            </button>
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            )}
            </div>
        </div>

        {/* Right button column (light cyan panel) */}
        <div style={rightPanel}>
          <ActionBtn label="Add New" onClick={addNew} btnStyle={btn} />

          <ActionBtn label="Save" onClick={save} btnStyle={btn} />
         
          {/* <ActionBtn
           btnStyle={btn} 
            label="Find"
            onClick={() => {
              // ✅ user will search undelivered here
              openFind();
            }}
          /> */}
          <ActionBtn label="View Report" onClick={() => alert("Report - next")} btnStyle={btn} />
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
};

const rightPanel: React.CSSProperties = {
  width: 190,
  background: "#bfe7ef", // ✅ light cyan like screenshot
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
  background: "#1f2a3a", // dark header
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
};

const subTitleBar: React.CSSProperties = {
  height: 28,
  background: "#2b4d87", // blue bar like Delivery Details
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
  position: "relative",   // IMPORTANT for hidden date picker
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

const bottomNo: React.CSSProperties = {
  marginTop: 24,
  color: "#c02626",
  fontWeight: 800,
  textAlign: "center",
};

const pillBtn: React.CSSProperties = {
  height: 34,
  padding: "0 14px",
  border: "1px solid #d0d7e2",
  borderRadius: 14,
  background: "#f5f7fb",
  fontWeight: 700,
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  fontSize: 12,
  color: "#6b7280",
};

const td: React.CSSProperties = {
  padding: "10px 10px",
  fontSize: 12,
  color: "#111827",
  verticalAlign: "top",
};

const miniBtn: React.CSSProperties = {
  height: 28,
  padding: "0 10px",
  border: "1px solid #d0d7e2",
  borderRadius: 10,
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
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
