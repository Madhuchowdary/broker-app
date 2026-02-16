import React from "react";

/**
 * Day Wise Report
 * - Does NOT auto-load data
 * - Loads only when "Show Report" clicked
 * - Client-side filters by:
 *    - confirm_date (dd-mm-yy) range
 *    - client name (matches seller OR buyer)
 *    - item name (matches product)
 * - Totals:
 *    Seller Brok Total = sum(seller_brokerage)
 *    Buyer Brok Total  = sum(buyer_brokerage)
 *    Grand Total       = Seller + Buyer
 * - Download CSV button
 */

type Tx = any;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Date -> "dd-mmm-yy" (like screenshot: 03-Feb-26)
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toDDMMMYY(d: Date) {
  const dd = pad2(d.getDate());
  const mmm = MONTHS[d.getMonth()];
  const yy = pad2(d.getFullYear() % 100);
  return `${dd}-${mmm}-${yy}`;
}

// Parse dd-mm-yy OR dd-mmm-yy OR dd/mm/yy into Date (local)
function parseAnyDDYY(s: string): Date | null {
  const t = (s || "").trim().replaceAll("/", "-");
  if (!t) return null;

  // dd-mm-yy
  let m = t.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const yyyy = 2000 + yy;
    const d = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getDate() !== dd || d.getMonth() !== mm - 1 || d.getFullYear() !== yyyy) return null;
    return d;
  }

  // dd-mmm-yy
  m = t.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (m) {
    const dd = Number(m[1]);
    const mon = m[2].toLowerCase();
    const yy = Number(m[3]);
    const mm = MONTHS.map(x => x.toLowerCase()).indexOf(mon);
    if (mm < 0) return null;
    const yyyy = 2000 + yy;
    const d = new Date(yyyy, mm, dd);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getDate() !== dd || d.getMonth() !== mm || d.getFullYear() !== yyyy) return null;
    return d;
  }

  return null;
}

function toNumber(v: any) {
  const n = Number.parseFloat((v ?? "").toString().replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function DayWiseReport() {
  const [from, setFrom] = React.useState(() => toDDMMMYY(new Date()));
  const [to, setTo] = React.useState(() => toDDMMMYY(new Date()));
  const [clientName, setClientName] = React.useState("");
  const [itemName, setItemName] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Tx[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const sellerTotal = React.useMemo(() => rows.reduce((a, r) => a + toNumber(r.seller_brokerage ?? r.sellerBrokerage), 0), [rows]);
  const buyerTotal = React.useMemo(() => rows.reduce((a, r) => a + toNumber(r.buyer_brokerage ?? r.buyerBrokerage), 0), [rows]);
  const grandTotal = sellerTotal + buyerTotal;

  async function showReport() {
    setError(null);

    const dFrom = parseAnyDDYY(from);
    const dTo = parseAnyDDYY(to);
    if (!dFrom || !dTo) {
      setError("Invalid From/To date. Use dd-mmm-yy like 03-Feb-26.");
      return;
    }

    setLoading(true);
    try {
      // Do NOT load on page open — only here
      const data = await fetchJson(`/api/transactions`);
      const all: Tx[] = Array.isArray(data) ? data : [];

      const c = clientName.trim().toLowerCase();
      const it = itemName.trim().toLowerCase();

      // inclusive date range
      const start = new Date(dFrom.getFullYear(), dFrom.getMonth(), dFrom.getDate()).getTime();
      const end = new Date(dTo.getFullYear(), dTo.getMonth(), dTo.getDate()).getTime();

      const filtered = all.filter((r) => {
        const cd = (r.confirm_date ?? r.confirmDate ?? "").toString();
        const d = parseAnyDDYY(cd);
        if (!d) return false;
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (t < start || t > end) return false;

        if (c) {
          const s = (r.seller ?? "").toString().toLowerCase();
          const b = (r.buyer ?? "").toString().toLowerCase();
          if (!s.includes(c) && !b.includes(c)) return false;
        }

        if (it) {
          const p = (r.product ?? "").toString().toLowerCase();
          if (!p.includes(it)) return false;
        }

        return true;
      });

      // sort by confirm date then id
      filtered.sort((a, b) => {
        const da = parseAnyDDYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
        const db = parseAnyDDYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;
        if (da !== db) return da - db;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });

      setRows(filtered);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load report. Check server is running and /api/transactions works.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!rows.length) return;

    const header = [
      "S.No",
      "Conf.Date",
      "Seller Name",
      "S.Brok",
      "Buyer Name",
      "B.Brok",
      "Item Name",
      "Qty",
      "Price",
    ];

    const lines = [header.join(",")];

    rows.forEach((r, idx) => {
      const line = [
        idx + 1,
        r.confirm_date ?? r.confirmDate ?? "",
        r.seller ?? "",
        (r.seller_brokerage ?? r.sellerBrokerage ?? "").toString(),
        r.buyer ?? "",
        (r.buyer_brokerage ?? r.buyerBrokerage ?? "").toString(),
        r.product ?? "",
        (r.quantity ?? "").toString(),
        (r.rate ?? "").toString(),
      ].map(csvEscape);

      lines.push(line.join(","));
    });

    lines.push("");
    lines.push(csvEscape("Seller Brok Total") + ",,,," + csvEscape(sellerTotal.toFixed(2)));
    lines.push(csvEscape("Buyer Brok Total") + ",,,," + csvEscape(buyerTotal.toFixed(2)));
    lines.push(csvEscape("Grand Total") + ",,,," + csvEscape(grandTotal.toFixed(2)));

    const name = `day-wise-report_${from.replaceAll("/", "-")}_to_${to.replaceAll("/", "-")}.csv`;
    downloadText(name, lines.join("\n"));
  }

  return (
    <div style={page}>
      {/* Query Form */}
      <div style={queryCard}>
        <div style={queryTitle}>Query Form</div>

        <div style={queryGrid}>
          <div style={lbl}>From</div>
          <div>
            <input style={dateInput} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div style={lbl}>To</div>
          <div>
            <input style={dateInput} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div style={lbl}>Client Name</div>
          <div style={{ gridColumn: "2 / -1" }}>
            <input style={textInput} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>

          <div style={lbl}>Item Name</div>
          <div style={{ gridColumn: "2 / -1" }}>
            <input style={textInput} value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
        </div>

        <div style={queryActions}>
          <button style={btnPrimary} onClick={showReport} disabled={loading}>
            {loading ? "Loading..." : "Show Report"}
          </button>

          <button style={btn} onClick={downloadCsv} disabled={!rows.length}>
            Download
          </button>
        </div>

        {error && <div style={errBox}>{error}</div>}
      </div>

      {/* Report */}
      <div style={reportCard}>
        <div style={reportHead}>
          <div style={reportHeadBox}>Day Wise Report</div>
          <div style={reportSub}>
            Report &nbsp; From <b>{from}</b> To <b>{to}</b>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                {["Conf.Date","Seller Name","S.brok","Buyer Name","B.brok","Item Name","Qty","Price"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td style={tdEmpty} colSpan={8}>
                    {loading ? "Loading..." : "No records"}
                  </td>
                </tr>
              )}

              {rows.map((r, idx) => (
                <tr key={r.id ?? idx}>
                  <td style={td}>{r.confirm_date ?? r.confirmDate ?? "-"}</td>
                  <td style={td}>{r.seller ?? "-"}</td>
                  <td style={tdNum}>{toNumber(r.seller_brokerage ?? r.sellerBrokerage).toFixed(2)}</td>
                  <td style={td}>{r.buyer ?? "-"}</td>
                  <td style={tdNum}>{toNumber(r.buyer_brokerage ?? r.buyerBrokerage).toFixed(2)}</td>
                  <td style={td}>{r.product ?? "-"}</td>
                  <td style={td}>{r.quantity ?? "-"}</td>
                  <td style={tdNum}>{toNumber(r.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={totalsRow}>
          <div style={totalsBox}>
            <span>Seller Brok Total</span>
            <span style={money}>₹ {sellerTotal.toFixed(2)}</span>
          </div>

          <div style={totalsBox}>
            <span>Buyer Brok Total</span>
            <span style={money}>₹ {buyerTotal.toFixed(2)}</span>
          </div>

          <div style={grandBox}>
            <span>Grand Total</span>
            <span style={money}>₹ {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- styles (kept simple + close to screenshot) ---- */
const page: React.CSSProperties = { padding: 18, background: "#eef2f7", minHeight: "100vh" };

const queryCard: React.CSSProperties = {
  background: "#0f2236",
  borderRadius: 10,
  padding: 18,
  color: "#fff",
  marginBottom: 16,
};

const queryTitle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 22,
  fontWeight: 900,
  color: "#ff5b5b",
  marginBottom: 14,
};

const queryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 120px 1fr",
  gap: 12,
  alignItems: "center",
};

const lbl: React.CSSProperties = { color: "#ffd34a", fontWeight: 800, fontSize: 13 };

const dateInput: React.CSSProperties = {
  width: "100%",
  height: 30,
  borderRadius: 4,
  border: "1px solid #6b7b8f",
  padding: "0 10px",
};

const textInput: React.CSSProperties = {
  width: "100%",
  height: 30,
  borderRadius: 4,
  border: "1px solid #6b7b8f",
  padding: "0 10px",
};

const queryActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  marginTop: 18,
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  padding: "0 18px",
  borderRadius: 6,
  border: "1px solid #b7b7b7",
  background: "#ff6aa2",
  cursor: "pointer",
  fontWeight: 900,
};

const btn: React.CSSProperties = {
  height: 40,
  padding: "0 18px",
  borderRadius: 6,
  border: "1px solid #b7b7b7",
  background: "#f2f2f2",
  cursor: "pointer",
  fontWeight: 800,
};

const errBox: React.CSSProperties = {
  marginTop: 12,
  background: "#3b1c1c",
  border: "1px solid #ff6b6b",
  color: "#ffdede",
  padding: 10,
  borderRadius: 6,
  fontSize: 13,
};

const reportCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c8ced8",
  borderRadius: 10,
  overflow: "hidden",
};

const reportHead: React.CSSProperties = { padding: 14, textAlign: "center" };
const reportHeadBox: React.CSSProperties = { display: "inline-block", border: "1px solid #777", padding: "6px 14px", fontWeight: 900 };
const reportSub: React.CSSProperties = { marginTop: 8, fontSize: 13, color: "#374151" };

const tableWrap: React.CSSProperties = { padding: 12, overflowX: "auto" };

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 900 };
const th: React.CSSProperties = { border: "1px solid #9099a7", background: "#f3f4f6", padding: 8, fontSize: 12, textAlign: "left" };
const td: React.CSSProperties = { border: "1px solid #c8ced8", padding: 8, fontSize: 12 };
const tdNum: React.CSSProperties = { ...td, textAlign: "right" };
const tdEmpty: React.CSSProperties = { ...td, textAlign: "center", color: "#6b7280", padding: 18 };

const totalsRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 18,
  padding: 14,
  borderTop: "1px solid #c8ced8",
  flexWrap: "wrap",
};

const totalsBox: React.CSSProperties = {
  border: "1px solid #c8ced8",
  borderRadius: 10,
  padding: "10px 14px",
  minWidth: 220,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  background: "#fff",
};

const grandBox: React.CSSProperties = { ...totalsBox, minWidth: 260, background: "#f7fbff", borderColor: "#8aa8e8" };

const money: React.CSSProperties = { fontWeight: 900 };
