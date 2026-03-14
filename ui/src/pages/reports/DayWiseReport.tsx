
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TxRow = any;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDDMMYY(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = pad2(d.getFullYear() % 100);
  return `${dd}-${mm}-${yy}`;
}

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

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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

function safe(v: any) {
  return (v ?? "").toString().trim();
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

function toDMonYY(ddmmyy: string) {
  const d = fromDDMMYY(ddmmyy);
  if (!d) return ddmmyy || "-";
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  const day = d.getDate();
  const yy = pad2(d.getFullYear() % 100);
  return `${day}-${mon}-${yy}`;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchClientByName(name: string) {
  const q = (name || "").trim();
  if (!q) return null;

  const data = await fetchJson(`/api/clients?q=${encodeURIComponent(q)}`);
  if (!Array.isArray(data) || data.length === 0) return null;

  const exact = data.find((x: any) => norm(x?.name) === norm(q));
  return exact || data[0];
}

export default function DayWiseReport() {
  const today = React.useMemo(() => new Date(), []);

  const [fromDate, setFromDate] = React.useState(toDDMMYY(today));
  const [toDate, setToDate] = React.useState(toDDMMYY(today));
  const [clientName, setClientName] = React.useState("");
  const [itemName, setItemName] = React.useState("");

  const [companies, setCompanies] = React.useState<any[]>([]);
  const [companyName, setCompanyName] = React.useState("");
  const [billDate, setBillDate] = React.useState(toDDMMYY(today));
  const [billNo, setBillNo] = React.useState("");

  const [rows, setRows] = React.useState<TxRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [selectedClient, setSelectedClient] = React.useState<any | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchJson("/api/company-details");
        if (!alive) return;
        setCompanies(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load companies", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedCompany = React.useMemo(() => {
    const q = norm(companyName);
    if (!q) return null;
    return companies.find((c) => norm(c?.name) === q) || null;
  }, [companies, companyName]);

  const reportMode: "client" | "item" | "day" = clientName.trim()
    ? "client"
    : itemName.trim()
      ? "item"
      : "day";

  function validate() {
    if (!fromDDMMYY(fromDate) || !fromDDMMYY(toDate)) {
      setError("Valid From and To dates are required.");
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
      const [all, clientRec] = await Promise.all([
        fetchJson("/api/transactions"),
        clientName.trim() ? fetchClientByName(clientName.trim()) : Promise.resolve(null),
      ]);

      const list: TxRow[] = Array.isArray(all) ? all : [];
      setSelectedClient(clientRec);

      const cn = norm(clientName);
      const it = norm(itemName);

      const filtered = list.filter((r) => {
        const conf = safe(r.confirm_date ?? r.confirmDate);
        if (!inRangeDDMMYY(conf, fromDate, toDate)) return false;

        if (cn) {
          const seller = norm(r.seller);
          const buyer = norm(r.buyer);
          if (!seller.includes(cn) && !buyer.includes(cn)) return false;
        }

        if (it) {
          const product = norm(r.product);
          if (!product.includes(it)) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
      const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
      const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;

      // oldest first
      if (da !== db) return da - db;

      // if same date, smaller id first
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

    setRows(filtered);
    } catch (e) {
      console.error(e);
      setError("Failed to load transactions. Check API / server logs.");
    } finally {
      setLoading(false);
    }
  }

  const sellerTotal = React.useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.seller_brokerage ?? r.sellerBrokerage), 0),
    [rows]
  );

  const buyerTotal = React.useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.buyer_brokerage ?? r.buyerBrokerage), 0),
    [rows]
  );

  const grandTotal = React.useMemo(() => {
    if (reportMode !== "client") return sellerTotal + buyerTotal;

    const cn = norm(clientName);
    return rows.reduce((sum, r) => {
      const isSeller = norm(r.seller).includes(cn);
      const isBuyer = norm(r.buyer).includes(cn);
      if (isSeller) return sum + toNumber(r.seller_brokerage ?? r.sellerBrokerage);
      if (isBuyer) return sum + toNumber(r.buyer_brokerage ?? r.buyerBrokerage);
      return sum;
    }, 0);
  }, [rows, sellerTotal, buyerTotal, reportMode, clientName]);

  const reportTitle =
    reportMode === "client"
      ? "CLIENT WISE REPORT"
      : reportMode === "item"
        ? "ITEM WISE REPORT"
        : "DAY WISE REPORT";

  const headerLine = React.useMemo(() => {
    if (reportMode === "client") {
      return `Client : ${clientName.trim() || "ALL"}  Report  From ${toDMonYY(fromDate)} To ${toDMonYY(toDate)}`;
    }
    const item = itemName.trim() ? itemName.trim().toUpperCase() : "ALL";
    return `Item : ${item}  Report  From ${toDMonYY(fromDate)} To ${toDMonYY(toDate)}`;
  }, [reportMode, itemName, clientName, fromDate, toDate]);

  function buildClientWisePdf(sortedRows) {
    const doc = new jsPDF("p", "pt", "a4");
    const pageW = doc.internal.pageSize.getWidth();

    const broker = {
      name: safe(selectedCompany?.name) || "",
      line1: safe(selectedCompany?.title) || "",
      addr1: safe(selectedCompany?.address) || "",
      addr2: safe(selectedCompany?.near) || "",
      city: safe(selectedCompany?.city_state) || "",
      pan: safe(selectedCompany?.pan_no) || "",
      bank: safe(selectedCompany?.bank) || "U",
      ifsc: safe(selectedCompany?.ifsc_code) || "",
      acNo: safe(selectedCompany?.account_no) || "",
      contact: safe(selectedCompany?.contact_nos),
      email: safe(selectedCompany?.email),
    };

    const clientLabel = clientName.trim() || "CLIENT";
    const firstRow = rows[0] || {};
    const itemLabel = safe(firstRow?.product).toUpperCase() || "ITEM";

    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.text(broker.name, 45, 55);

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    let YVal = 76;
    const maxWidth = 240; // width allowed for address block

    const lines = [
      broker.line1,
      broker.addr1,
      broker.addr2,
      broker.city
    ];

    lines.forEach((text) => {
      if (!text) return;

      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, 45, YVal);
      YVal += wrapped.length * 16; // move down depending on wrapped lines
    });

    doc.text(`PAN No : ${broker.pan}`, pageW - 210, 55);
    doc.text(broker.bank, pageW - 210, 74);
    doc.text(`IFSC Code   ${broker.ifsc}`, pageW - 210, 92);
    doc.text(`A/c No   ${broker.acNo}`, pageW - 210, 110);

    doc.roundedRect(40, 150, pageW - 80, 90, 8, 8);
    doc.setFont("times", "bold");
    doc.text((safe(selectedClient?.name) || clientLabel).toUpperCase(), 50, 175);

    doc.setFont("times", "normal");

    const clientAddress = safe(selectedClient?.address);
    const clientCity = safe(selectedClient?.city_state ?? selectedClient?.cityState);
    const clientPin = safe(selectedClient?.pin_no ?? selectedClient?.pinNo);
    const clientMobile = safe(selectedClient?.mobile);

    let y = 195;
    if (clientAddress) {
      doc.text(clientAddress, 50, y);
      y += 19;
    }
    if (clientCity) {
      doc.text(clientCity, 50, y);
      y += 19;
    }
    if (clientPin) {
      doc.text(`PIN  ${clientPin}`, 50, y);
      y += 19;
    }
    if (clientMobile) {
      doc.text(`Mobile  ${clientMobile}`, 50, y);
    }

    doc.roundedRect(pageW - 255, 170, 200, 55, 10, 10);
    doc.setFont("times", "bold");
    doc.text(`Bill No : ${billNo || "-"}`, pageW - 215, 192);
    doc.text(`Date : ${billDate || "-"}`, pageW - 215, 212);

    const head = [[
      "Confirm\nDate",
      "Seller / Buyer",
      "Price\nRs.",
      "Qty",
      "Qty\nUnit",
      "Delivery\nDate",
      "Tanker No",
      "Bill No",
      "Brokerage\nRs."
    ]];

    const cn = norm(clientName);
    const body = sortedRows.map((r) => {
      const isSeller = norm(r.seller).includes(cn);
      const brokerage = isSeller
        ? toNumber(r.seller_brokerage ?? r.sellerBrokerage)
        : toNumber(r.buyer_brokerage ?? r.buyerBrokerage);

      const oppositeParty = isSeller ? safe(r.buyer || "-") : safe(r.seller || "-");

      return [
        safe(r.confirm_date ?? r.confirmDate ?? "-"),
        oppositeParty,
        safe(r.rate || "-"),
        safe(r.quantity || "-"),
        safe(r.unit_qty ?? r.unitQty ?? "-"),
        safe(r.delivery_date ?? r.deliveryDate ?? "-"),
        safe(r.tanker_no ?? r.tankerNo ?? "-"),
        safe(r.bill_no ?? r.billNo ?? "-"),
        money(brokerage),
      ];
    });

    autoTable(doc, {
      startY: 255,
      margin: { left: 40, right: 40 },
      tableWidth: pageW - 80,
      head,
      body: body.length
        ? [
            [
              {
                content: itemLabel,
                colSpan: 2,
                styles: { fontStyle: "bold", halign: "left" },
              },
              {
                content: `Brokerage Bill From ${fromDate} To ${toDate}`,
                colSpan: 7,
                styles: { halign: "center" },
              },
            ],
            ...body,
            [
              {
                content: `${itemLabel}   Total Amount`,
                colSpan: 8,
                styles: { halign: "right", fontStyle: "italic" },
              },
              {
                content: money(grandTotal),
                styles: { halign: "right", fontStyle: "bold" },
              },
            ],
            [
              {
                content: "Grand Total",
                colSpan: 8,
                styles: { halign: "right", fontStyle: "bold" },
              },
              {
                content: money(grandTotal),
                styles: { halign: "right", fontStyle: "bold" },
              },
            ],
          ]
        : [],
      theme: "grid",
      styles: {
        font: "times",
        fontSize: 8,
        cellPadding: 3,
        lineColor: [80, 80, 80],
        lineWidth: 0.8,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 100 },
        2: { cellWidth: 50, halign: "right" },
        3: { cellWidth: 40, halign: "right" },
        4: { cellWidth: 48, halign: "center" },
        5: { cellWidth: 62, halign: "center" },
        6: { cellWidth: 68 },
        7: { cellWidth: 58 },
        8: { cellWidth: 60, halign: "right" },
      },
    });

    const lastY = (doc as any).lastAutoTable?.finalY ?? 520;
    doc.setFont("times", "bolditalic");
    doc.setFontSize(18);
    doc.text(`For ${broker.name}`, pageW - 210, lastY + 45);

    doc.save("client-wise-report.pdf");
  }

  function buildDayOrItemPdf(sortedRows) {
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    const titleW = doc.getTextWidth(reportTitle) + 24;
    const x = (doc.internal.pageSize.getWidth() - titleW) / 2;
    doc.rect(x, 36, titleW, 22);
    doc.text(reportTitle, x + 12, 52);

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(headerLine, 40, 82);

    const body = sortedRows.map((r) => {
      const conf = safe(r.confirm_date ?? r.confirmDate ?? "-");
      const seller = safe(r.seller ?? "-");
      const sb = money(toNumber(r.seller_brokerage ?? r.sellerBrokerage));
      const buyer = safe(r.buyer ?? "-");
      const bb = money(toNumber(r.buyer_brokerage ?? r.buyerBrokerage));
      const item = safe(r.product ?? "-");
      const qty = safe(r.quantity ?? "-");
      const price = safe(r.rate ?? "-");
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

    doc.setFont("times", "bold");
    doc.setFontSize(11);

    doc.text(`Seller Brok Total : Rs  ${money(sellerTotal)}`, 120, lastY + 34);
    doc.text(`Buyer Brok Total : Rs  ${money(buyerTotal)}`, 330, lastY + 34);

    const gt = `Grand Total   Rs   ${money(grandTotal)}`;
    const gtW = doc.getTextWidth(gt) + 80;
    const gx = (doc.internal.pageSize.getWidth() - gtW) / 2;
    const gy = lastY + 54;
    doc.roundedRect(gx, gy, gtW, 28, 8, 8);
    doc.text(gt, gx + 15, gy + 18);

    doc.save(`${reportTitle.replaceAll(" ", "-").toLowerCase()}.pdf`);
  }

  function buildPdf() {
    const sortedRows = [...rows].sort((a, b) => {
    const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
    const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;

      if (da !== db) return da - db;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });
    if (reportMode === "client") {
      buildClientWisePdf(sortedRows);
      return;
    }
    buildDayOrItemPdf(sortedRows);
  }

  const datePickerHidden: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: 0,
    width: 28,
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

          <div style={reportDetailsBox}>
            <div style={reportDetailsTitle}>Report Details</div>

            <div style={reportDetailsGrid}>
              <div style={reportLbl}>Company</div>
              <input
                style={reportInput}
                list="companyList"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Type to search company..."
              />

              <div style={reportLbl}>Bill Date</div>
              <div style={dateBoxSmall}>
                <input
                  style={dateInputSmall}
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  placeholder="dd-mm-yy"
                />
                <div style={calBtn}>📅</div>
                <input
                  type="date"
                  style={datePickerHiddenSmall}
                  value={toISODate(fromDDMMYY(billDate) || new Date())}
                  onChange={(e) => setBillDate(toDDMMYY(fromISODate(e.target.value)))}
                />
              </div>

              <div style={reportLbl}>Bill No</div>
              <input
                style={reportInputSmall}
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                placeholder="Bill No"
              />
            </div>
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

        <datalist id="companyList">
          {companies.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      {/* Report preview */}
      <div style={reportWrap}>
        <div style={paper}>
          <div style={boxTitleRow}>
            <div style={boxedTitle}>{reportTitle}</div>
          </div>

          <div style={subLine}>{headerLine}</div>

          {reportMode === "client" ? (
            <>
              <div style={tableWrap}>
                <table style={tbl}>
                  <thead>
                    <tr>
                      <th style={th}>Confirm Date</th>
                      <th style={th}>Seller / Buyer</th>
                      <th style={{ ...th, textAlign: "right" }}>Price Rs.</th>
                      <th style={{ ...th, textAlign: "right" }}>Qty</th>
                      <th style={th}>Qty Unit</th>
                      <th style={th}>Delivery Date</th>
                      <th style={th}>Tanker No</th>
                      <th style={th}>Bill No</th>
                      <th style={{ ...th, textAlign: "right" }}>Brokerage Rs.</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={9}>
                          No records
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td style={{ ...td, fontWeight: 700 }} colSpan={2}>
                            {safe(rows[0]?.product).toUpperCase() || "ITEM"}
                          </td>
                          <td style={{ ...td, textAlign: "center" }} colSpan={7}>
                            Brokerage Bill From {fromDate} To {toDate}
                          </td>
                        </tr>

                        {rows.map((r, idx) => {
                          const cn = norm(clientName);
                          const isSeller = norm(r.seller).includes(cn);
                          const brokerage = isSeller
                            ? toNumber(r.seller_brokerage ?? r.sellerBrokerage)
                            : toNumber(r.buyer_brokerage ?? r.buyerBrokerage);

                          const oppositeParty = isSeller
                            ? safe(r.buyer || "-")
                            : safe(r.seller || "-");

                          return (
                            <tr key={r.id ?? idx}>
                              <td style={td}>{safe(r.confirm_date ?? r.confirmDate ?? "-")}</td>
                              <td style={td}>{oppositeParty}</td>
                              <td style={{ ...td, textAlign: "right" }}>{safe(r.rate || "-")}</td>
                              <td style={{ ...td, textAlign: "right" }}>{safe(r.quantity || "-")}</td>
                              <td style={td}>{safe(r.unit_qty ?? r.unitQty ?? "-")}</td>
                              <td style={td}>{safe(r.delivery_date ?? r.deliveryDate ?? "-")}</td>
                              <td style={td}>{safe(r.tanker_no ?? r.tankerNo ?? "-")}</td>
                              <td style={td}>{safe(r.bill_no ?? r.billNo ?? "-")}</td>
                              <td style={{ ...td, textAlign: "right" }}>{money(brokerage)}</td>
                            </tr>
                          );
                        })}

                        <tr>
                          <td style={{ ...td, textAlign: "right", fontStyle: "italic" }} colSpan={8}>
                            {(safe(rows[0]?.product).toUpperCase() || "ITEM")} Total Amount
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                            {money(grandTotal)}
                          </td>
                        </tr>

                        <tr>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700 }} colSpan={8}>
                            Grand Total
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                            {money(grandTotal)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
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
                            <td style={{ ...td, textAlign: "right" }}>
                              {money(toNumber(r.seller_brokerage ?? r.sellerBrokerage))}
                            </td>
                            <td style={td}>{r.buyer ?? "-"}</td>
                            <td style={{ ...td, textAlign: "right" }}>
                              {money(toNumber(r.buyer_brokerage ?? r.buyerBrokerage))}
                            </td>
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
            </>
          )}
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
  minWidth: 420,
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

const reportDetailsBox: React.CSSProperties = {
  marginTop: 10,
  background: "#eef6fb",
  border: "1px solid #d9e6ef",
  borderRadius: 4,
  padding: "10px 14px 14px",
  width: 520,
  marginLeft: "auto",
  marginRight: "auto",
  gridColumn: "1 / -1",
};

const reportDetailsTitle: React.CSSProperties = {
  color: "#7c8aa0",
  fontSize: 13,
  marginBottom: 10,
};

const reportDetailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 1fr",
  gap: 10,
  alignItems: "center",
};

const reportLbl: React.CSSProperties = {
  color: "#5b677a",
  fontSize: 14,
};

const reportInput: React.CSSProperties = {
  height: 28,
  border: "1px solid #d5dce5",
  background: "#fff",
  padding: "0 8px",
  fontSize: 14,
};

const reportInputSmall: React.CSSProperties = {
  ...reportInput,
  width: 160,
};

const dateBoxSmall: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: 170,
};

const dateInputSmall: React.CSSProperties = {
  width: "100%",
  height: 28,
  border: "1px solid #d5dce5",
  background: "#fff",
  padding: "0 8px",
  fontSize: 14,
};

const datePickerHiddenSmall: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: 0,
  width: 28,
  height: 28,
  opacity: 0,
  cursor: "pointer",
};
