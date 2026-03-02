import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TxRow = any;

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
  const yyyy = 2000 + yy;

  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
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

function toNumber(v: any) {
  const n = Number((v ?? "").toString().replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  return n.toFixed(2);
}

function norm(s: any) {
  return (s ?? "").toString().trim().toLowerCase();
}

function inRangeDDMMYY(value: string, from: string, to: string) {
  const dv = fromDDMMYY(value);
  const df = fromDDMMYY(from);
  const dt = fromDDMMYY(to);
  if (!dv || !df || !dt) return false;

  const a = new Date(df.getFullYear(), df.getMonth(), df.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const x = new Date(dv.getFullYear(), dv.getMonth(), dv.getDate()).getTime();

  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return x >= min && x <= max;
}

// "dd-mm-yy" -> "1-Dec-24" (matches screenshot style)
function toDMonYY(ddmmyy: string) {
  const d = fromDDMMYY(ddmmyy);
  if (!d) return ddmmyy || "-";
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  const day = d.getDate(); // no leading zero
  const yy = pad2(d.getFullYear() % 100);
  return `${day}-${mon}-${yy}`;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function DayWiseReport() {
  const today = React.useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = React.useState(toDDMMYY(today));
  const [toDate, setToDate] = React.useState(toDDMMYY(today));

  const [clientName, setClientName] = React.useState("");
  const [itemName, setItemName] = React.useState("");

  const [rows, setRows] = React.useState<TxRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  // ✅ only From + To mandatory
  function validate(): boolean {
    const f = fromDate.trim();
    const t = toDate.trim();

    if (!f || !t) {
      setError("From and To dates are mandatory.");
      return false;
    }
    if (!fromDDMMYY(f) || !fromDDMMYY(t)) {
      setError("Invalid date format. Use dd-mm-yy (example: 03-02-26).");
      return false;
    }
    setError("");
    return true;
  }

  async function showReport() {
    if (!validate()) return;

    setLoading(true);
    setRows([]);

    try {
      const all = await fetchJson(`/api/transactions`);
      const list: TxRow[] = Array.isArray(all) ? all : [];

      const f = fromDate.trim();
      const t = toDate.trim();
      const cn = norm(clientName);
      const it = norm(itemName);

      const filtered = list.filter((r) => {
        const conf = (r.confirm_date ?? r.confirmDate ?? "").toString().trim();
        if (!inRangeDDMMYY(conf, f, t)) return false;

        // if clientName provided => match seller OR buyer
        if (cn) {
          const seller = norm(r.seller);
          const buyer = norm(r.buyer);
          const clientOk = seller.includes(cn) || buyer.includes(cn);
          if (!clientOk) return false;
        }

        // if itemName provided => match product
        if (it) {
          const product = norm(r.product);
          if (!product.includes(it)) return false;
        }

        return true;
      });

      setRows(filtered);
    } catch (e) {
      console.error(e);
      setError("Failed to load transactions. Check API / server logs.");
    } finally {
      setLoading(false);
    }
  }

  const sellerTotal = React.useMemo(() => {
    return rows.reduce((sum, r) => sum + toNumber(r.seller_brokerage ?? r.sellerBrokerage), 0);
  }, [rows]);

  const buyerTotal = React.useMemo(() => {
    return rows.reduce((sum, r) => sum + toNumber(r.buyer_brokerage ?? r.buyerBrokerage), 0);
  }, [rows]);

  const grandTotal = React.useMemo(() => sellerTotal + buyerTotal, [sellerTotal, buyerTotal]);

  // ✅ Pattern label + title
  const reportTitle = itemName.trim() ? "ITEM WISE REPORT" : "DAY WISE REPORT";

  // header line like screenshot
  const headerLine = React.useMemo(() => {
    const item = itemName.trim() ? itemName.trim().toUpperCase() : "ALL";
    return `Item : ${item}  Report  From ${toDMonYY(fromDate)} To ${toDMonYY(toDate)}`;
  }, [itemName, fromDate, toDate]);

  function buildPdf() {
    const doc = new jsPDF("p", "pt", "a4");

    // Title box
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    const titleW = doc.getTextWidth(reportTitle) + 24;
    const x = (doc.internal.pageSize.getWidth() - titleW) / 2;
    doc.rect(x, 36, titleW, 22);
    doc.text(reportTitle, x + 12, 52);

    // Header line
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(headerLine, 40, 82);

    // Table data
    const body = rows.map((r) => {
      const conf = (r.confirm_date ?? r.confirmDate ?? "-").toString();
      const seller = (r.seller ?? "-").toString();
      const sb = money(toNumber(r.seller_brokerage ?? r.sellerBrokerage));
      const buyer = (r.buyer ?? "-").toString();
      const bb = money(toNumber(r.buyer_brokerage ?? r.buyerBrokerage));
      const item = (r.product ?? "-").toString();
      const qty = (r.quantity ?? "-").toString();
      const price = (r.rate ?? "-").toString();
      return [toDMonYY(conf), seller, sb, buyer, bb, item, qty, price];
    });

    autoTable(doc, {
      startY: 96,
      head: [[
        "Conf.Date",
        "Seller Name",
        "S.brok",
        "Buyer Name",
        "B.brok",
        "Item Name",
        "Qty",
        "Price",
      ]],
      body,
      theme: "grid",
      styles: { font: "times", fontSize: 10, cellPadding: 4 },
      headStyles: { fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 70 },
        2: { halign: "right", cellWidth: 55 },
        4: { halign: "right", cellWidth: 55 },
        6: { cellWidth: 50 },
        7: { cellWidth: 55 },
      },
    });

    const lastY = (doc as any).lastAutoTable?.finalY ?? 96;

    // Totals area like screenshot
    doc.setFont("times", "bold");
    doc.setFontSize(11);

    doc.text(`Seller Brok Total : Rs  ${money(sellerTotal)}`, 120, lastY + 34);
    doc.text(`  Buyer Brok Total : Rs  ${money(buyerTotal)}`, 330, lastY + 34);

    // Grand total rounded rectangle centered
    const gt = `Grand Total   Rs   ${money(grandTotal)}`;
    const gtW = doc.getTextWidth(gt) + 80;
    const gx = (doc.internal.pageSize.getWidth() - gtW) / 2;
    const gy = lastY + 54;
    doc.roundedRect(gx, gy, gtW, 28, 8, 8);
    doc.text(gt, gx + 15, gy + 18);

    doc.save(`${reportTitle.replaceAll(" ", "-").toLowerCase()}.pdf`);
  }

  // typing + picker both work (important: hidden picker should not block typing)
  const datePickerHidden: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: 0,
    width: 28, // ✅ only on calendar icon side
    height: 24,
    opacity: 0,
    cursor: "pointer",
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={title}>Query Form</div>

        <div style={formGrid}>
          <div>
            <div style={lbl}>From</div>
            <div style={dateBox}>
              <input
                style={dateInput}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="dd-mm-yy"
              />
              <div style={calBtn}>📅</div>
              <input
                type="date"
                style={datePickerHidden}
                value={toISODate(fromDDMMYY(fromDate) || new Date())}
                onChange={(e) => setFromDate(toDDMMYY(fromISODate(e.target.value)))}
              />
            </div>
          </div>

          <div>
            <div style={lbl}>To</div>
            <div style={dateBox}>
              <input
                style={dateInput}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="dd-mm-yy"
              />
              <div style={calBtn}>📅</div>
              <input
                type="date"
                style={datePickerHidden}
                value={toISODate(fromDDMMYY(toDate) || new Date())}
                onChange={(e) => setToDate(toDDMMYY(fromISODate(e.target.value)))}
              />
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={lbl}>Client Name</div>
            <input
              style={textInput}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="(optional) type client name to filter seller/buyer"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={lbl}>Item Name</div>
            <input
              style={textInput}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="(optional) type item name to filter product"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <button style={btnPrimary} onClick={showReport} disabled={loading}>
              {loading ? "Loading..." : "Show Report"}
            </button>
            <button style={btn} onClick={buildPdf} disabled={rows.length === 0}>
              Download PDF
            </button>
          </div>

          {error ? (
            <div style={{ gridColumn: "1 / -1", color: "#b91c1c", marginTop: 6, textAlign: "center" }}>{error}</div>
          ) : null}
        </div>
      </div>

      {/* Report preview (pattern like screenshot) */}
      <div style={reportWrap}>
        <div style={paper}>
          <div style={boxTitleRow}>
            <div style={boxedTitle}>{reportTitle}</div>
          </div>

          <div style={subLine}>{headerLine}</div>

          <div style={tableWrap}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Conf.Date</th>
                  <th style={th}>Seller Name</th>
                  <th style={{ ...th, textAlign: "right" }}>S.brok</th>
                  <th style={th}>Buyer Name</th>
                  <th style={{ ...th, textAlign: "right" }}>B.brok</th>
                  <th style={th}>Item Name</th>
                  <th style={th}>Qty</th>
                  <th style={th}>Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={8}>
                      No records
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const conf = (r.confirm_date ?? r.confirmDate ?? "-").toString();
                    return (
                      <tr key={r.id ?? idx}>
                        <td style={td}>{toDMonYY(conf)}</td>
                        <td style={td}>{r.seller ?? "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{money(toNumber(r.seller_brokerage ?? r.sellerBrokerage))}</td>
                        <td style={td}>{r.buyer ?? "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{money(toNumber(r.buyer_brokerage ?? r.buyerBrokerage))}</td>
                        <td style={td}>{r.product ?? "-"}</td>
                        <td style={td}>{r.quantity ?? "-"}</td>
                        <td style={td}>{r.rate ?? "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={totalsGrid}>
            <div style={totalLine}>
              <span>Seller Brok Total</span>
              <span style={brMoney}>Rs. {sellerTotal.toFixed(2)}</span>
            </div>

            <div style={totalLine}>
              <span>Buyer Brok Total</span>
              <span style={brMoney}>Rs. {buyerTotal.toFixed(2)}</span>
            </div>

            <div style={grandRow}>
              <div style={grandPill}>
                <span style={{ fontWeight: 900 }}>Grand Total</span>
                <span style={brMoney}>Rs. {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */
const wrap: React.CSSProperties = { padding: 18, background: "#eef2f7", minHeight: "100vh" };

const card: React.CSSProperties = {
  background: "#1f2a3a",
  color: "#fff",
  borderRadius: 10,
  padding: 18,
  maxWidth: 760,
  margin: "0 auto",
};

const title: React.CSSProperties = { textAlign: "center", fontSize: 22, fontWeight: 900, color: "#ff5a4d" };

const formGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const lbl: React.CSSProperties = { color: "#ffd400", fontWeight: 800, marginBottom: 6 };

const textInput: React.CSSProperties = {
  width: "100%",
  height: 34,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  padding: "0 10px",
  fontSize: 13,
};

const dateBox: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const dateInput: React.CSSProperties = {
  width: "100%",
  height: 34,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  padding: "0 10px",
  fontSize: 13,
};

const calBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#efefef",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#111827",
  userSelect: "none",
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  minWidth: 160,
  borderRadius: 6,
  border: "1px solid #b0b8c4",
  background: "#f0a3a3",
  cursor: "pointer",
  fontWeight: 900,
};

const btn: React.CSSProperties = {
  ...btnPrimary,
  background: "#e9e2d3",
};

const reportWrap: React.CSSProperties = { marginTop: 18, display: "flex", justifyContent: "center" };

const paper: React.CSSProperties = {
  width: "min(980px, 100%)",
  background: "#fff",
  border: "1px solid #c8ced8",
  padding: 18,
};

const boxTitleRow: React.CSSProperties = { display: "flex", justifyContent: "center" };

const boxedTitle: React.CSSProperties = {
  border: "2px solid #333",
  padding: "6px 14px",
  fontWeight: 900,
  letterSpacing: 0.4,
};

const subLine: React.CSSProperties = {
  marginTop: 10,
  fontStyle: "italic",
  fontSize: 14,
};

const tableWrap: React.CSSProperties = { marginTop: 10, overflowX: "auto" };

const tbl: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  border: "1px solid #333",
  padding: "8px 6px",
  textAlign: "left",
  background: "#f3f4f6",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  border: "1px solid #333",
  padding: "8px 6px",
  verticalAlign: "top",
};


const totalsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  padding: 18,
  borderTop: "1px solid #c8ced8",
  alignItems: "center",
};

const totalLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontWeight: 900,
  letterSpacing: 2,
  fontSize: 18,
  padding: "10px 14px",
};

const grandRow: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "center",
  marginTop: 6,
};

const grandPill: React.CSSProperties = {
  minWidth: 400,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "16px 22px",
  border: "2px solid #9aa3af",
  borderRadius: 16,
  fontWeight: 900,
  letterSpacing: 3,
  fontSize: 20,
};

const brMoney: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};



const amt: React.CSSProperties = { display: "inline-block", minWidth: 90, textAlign: "right" }; 