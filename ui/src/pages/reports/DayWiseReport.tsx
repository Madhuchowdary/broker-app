
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

function groupClientRowsByProduct(list: any[], clientName: string) {
  const cn = norm(clientName);

  const sorted = [...list].sort((a, b) => {
    const pa = safe(a.product).toLowerCase();
    const pb = safe(b.product).toLowerCase();
    if (pa !== pb) return pa.localeCompare(pb);

    const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
    const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;
    if (da !== db) return da - db;

    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });

  const groups: { product: string; rows: any[]; total: number }[] = [];

  sorted.forEach((r) => {
    const product = safe(r.product || "ITEM").toUpperCase();
    const isSeller = norm(r.seller).includes(cn);
    const brokerage = isSeller
      ? toNumber(r.seller_brokerage ?? r.sellerBrokerage)
      : toNumber(r.buyer_brokerage ?? r.buyerBrokerage);

    let grp = groups.find((g) => g.product === product);
    if (!grp) {
      grp = { product, rows: [], total: 0 };
      groups.push(grp);
    }

    grp.rows.push(r);
    grp.total += brokerage;
  });

  return groups;
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
  const [clients, setClients] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);

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

   React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [clientData, itemData] = await Promise.all([
          fetchJson("/api/clients"),
          fetchJson("/api/item-types"),
        ]);

        if (!alive) return;

        setClients(Array.isArray(clientData) ? clientData : []);
        setItems(Array.isArray(itemData) ? itemData : []);
      } catch (e) {
        console.error("Failed to load clients/items", e);
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
    console.log(1)
    if (!validate()) return;
    console.log(2)
    setLoading(true);
    setRows([]);
    setError("");

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

        const seller = norm(r.seller);
        const buyer = norm(r.buyer);
        const product = norm(r.product);
        const status = norm(r.status);

        // client filter
        if (cn) {
          const clientOk = seller.includes(cn) || buyer.includes(cn);
          if (!clientOk) return false;
        }

        // item filter
        if (it) {
          if (!product.includes(it)) return false;
        }

        // client-wise report should exclude undelivered rows
        if (reportMode === "client" && status === "undelivered") {
          return false;
        }

        return true;
      });

      // old first, latest last
      filtered.sort((a, b) => {
        const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
        const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;

        if (da !== db) return da - db;
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

  const sortedPreviewRows = React.useMemo(() => {
  return [...rows].sort((a, b) => {
    const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
    const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;
    if (da !== db) return da - db; // old first
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}, [rows]);

const clientPreviewGroups = React.useMemo(() => {
  return reportMode === "client"
    ? groupClientRowsByProduct(sortedPreviewRows, clientName)
    : [];
}, [reportMode, sortedPreviewRows, clientName]);

const previewCompany = React.useMemo(() => {
  return {
    name: safe(selectedCompany?.name) || "ANIL A SHAH",
    line1: safe(selectedCompany?.title) || "",
    addr1: safe(selectedCompany?.address) || "",
    addr2: safe(selectedCompany?.near) || "",
    city: safe(selectedCompany?.city_state) || "",
    pan: safe(selectedCompany?.pan_no) || "",
    bank: safe(selectedCompany?.bank) || "",
    ifsc: safe(selectedCompany?.ifsc_code) || "",
    acNo: safe(selectedCompany?.account_no) || "",
  };
}, [selectedCompany]);

  function buildClientWisePdf() {
    const doc = new jsPDF("p", "pt", "a4");
    const pageW = doc.internal.pageSize.getWidth();

    const sortedRows = [...rows].sort((a, b) => {
      const da = fromDDMMYY((a.confirm_date ?? a.confirmDate ?? "").toString())?.getTime() ?? 0;
      const db = fromDDMMYY((b.confirm_date ?? b.confirmDate ?? "").toString())?.getTime() ?? 0;
      if (da !== db) return da - db; // old first
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

    const broker = {
      name: safe(selectedCompany?.name) || "ANIL A SHAH",
      line1: safe(selectedCompany?.title) || "",
      addr1: safe(selectedCompany?.address) || "",
      addr2: safe(selectedCompany?.near) || "",
      city: safe(selectedCompany?.city_state) || "",
      pan: safe(selectedCompany?.pan_no) || "",
      bank: safe(selectedCompany?.bank) || "",
      ifsc: safe(selectedCompany?.ifsc_code) || "",
      acNo: safe(selectedCompany?.account_no) || "",
    };

    const clientLabel = clientName.trim() || "CLIENT";
    const groupedProducts = groupClientRowsByProduct(sortedRows, clientName);

    function drawWrapped(text: string, x: number, y: number, maxWidth: number, lineGap = 15) {
      if (!text) return y;
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, x, y);
      return y + wrapped.length * lineGap;
    }

    // ---------- company block ----------
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.text(broker.name, 45, 50);

    doc.setFont("times", "normal");
    doc.setFontSize(11);

    let companyY = 64;
    const companyMaxWidth = 250;

    companyY = drawWrapped(broker.line1, 45, companyY, companyMaxWidth);
    companyY = drawWrapped(broker.addr1, 45, companyY, companyMaxWidth);
    companyY = drawWrapped(broker.addr2, 45, companyY, companyMaxWidth);
    companyY = drawWrapped(broker.city, 45, companyY, companyMaxWidth);

    doc.text(`PAN No : ${broker.pan || "-"}`, pageW - 210, 55);
    doc.text(broker.bank || "-", pageW - 210, 74);
    doc.text(`IFSC Code   ${broker.ifsc || "-"}`, pageW - 210, 92);
    doc.text(`A/c No   ${broker.acNo || "-"}`, pageW - 210, 110);

    // ---------- client block ----------
    

    const clientBoxX = 40;
      const clientBoxY = 150;
      const clientBoxW = pageW - 80;

      doc.setFont("times", "bold");
      doc.setFontSize(14);

      const clientNameText = (safe(selectedClient?.name) || clientLabel).toUpperCase();
      const clientAddress = safe(selectedClient?.address);
      const clientCity = safe(selectedClient?.city_state ?? selectedClient?.cityState);
      const clientPin = safe(selectedClient?.pin_no ?? selectedClient?.pinNo);
      const clientMobile = safe(selectedClient?.mobile);
      const clientEmail = safe(selectedClient?.email);

      const clientMaxWidth = 230;
      const lineGap = 15;

      // first calculate dynamic height
      let measureY = 175 + 20;

      function measureWrapped(text: string, maxWidth: number, gap = lineGap) {
        if (!text) return 0;
        const wrapped = doc.splitTextToSize(text, maxWidth);
        return wrapped.length * gap;
      }

      measureY += measureWrapped(clientAddress, clientMaxWidth);
      measureY += measureWrapped(clientCity, clientMaxWidth);
      if (clientPin) measureY += measureWrapped(`PIN  ${clientPin}`, clientMaxWidth);
      if (clientMobile) measureY += measureWrapped(`Mobile  ${clientMobile}`, clientMaxWidth);
      if (clientEmail) measureY += measureWrapped(`e-Mail  ${clientEmail}`, clientMaxWidth);

      // keep enough minimum height for bill box too
      const clientBoxH = Math.max(118, measureY - clientBoxY + 18);

      doc.roundedRect(clientBoxX, clientBoxY, clientBoxW, clientBoxH, 8, 8);

      // actual print
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text(clientNameText, 50, 175);

      doc.setFont("times", "normal");
      doc.setFontSize(11);

      let clientY = 188;
      clientY = drawWrapped(clientAddress, 50, clientY, clientMaxWidth);
      clientY = drawWrapped(clientCity, 50, clientY, clientMaxWidth);

      if (clientPin) {
        clientY = drawWrapped(`PIN  ${clientPin}`, 50, clientY, clientMaxWidth);
      }

      if (clientMobile) {
        clientY = drawWrapped(`Mobile  ${clientMobile}`, 50, clientY, clientMaxWidth);
      }

      if (clientEmail) {
        clientY = drawWrapped(`e-Mail  ${clientEmail}`, 50, clientY, clientMaxWidth);
      }

      // bill box aligned inside client shell
      const billBoxW = 200;
      const billBoxH = 55;
      const billBoxX = pageW - 255;
      const billBoxY = clientBoxY + 22;

      doc.roundedRect(billBoxX, billBoxY, billBoxW, billBoxH, 10, 10);
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.text(`Bill No : ${billNo || "-"}`, billBoxX + 25, billBoxY + 22);
      doc.text(`Date : ${billDate || "-"}`, billBoxX + 25, billBoxY + 42);



    // ---------- grouped body ----------
    const cn = norm(clientName);
    const body: any[] = [];

    groupedProducts.forEach((group) => {
      body.push([
        {
          content: group.product,
          colSpan: 2,
          styles: { fontStyle: "bold", halign: "left" },
        },
        {
          content: `Brokerage Bill From ${fromDate} To ${toDate}`,
          colSpan: 7,
          styles: { halign: "center" },
        },
      ]);

      group.rows.forEach((r) => {
        const isSeller = norm(r.seller).includes(cn);
        const brokerage = isSeller
          ? toNumber(r.seller_brokerage ?? r.sellerBrokerage)
          : toNumber(r.buyer_brokerage ?? r.buyerBrokerage);

        const oppositeParty = isSeller ? safe(r.buyer || "-") : safe(r.seller || "-");

        body.push([
          safe(r.confirm_date ?? r.confirmDate ?? "-"),
          oppositeParty,
          safe(r.rate || "-"),
          safe(r.quantity || "-"),
          safe(r.unit_qty ?? r.unitQty ?? "-"),
          safe(r.delivery_date ?? r.deliveryDate ?? "-"),
          safe(r.tanker_no ?? r.tankerNo ?? "-"),
          safe(r.bill_no ?? r.billNo ?? "-"),
          money(brokerage),
        ]);
      });

      body.push([
        {
          content: `${group.product}   Total Amount`,
          colSpan: 8,
          styles: { halign: "right", fontStyle: "italic" },
        },
        {
          content: money(group.total),
          styles: { halign: "right", fontStyle: "bold" },
        },
      ]);
    });

    body.push([
      {
        content: "Grand Total",
        colSpan: 8,
        styles: { halign: "right", fontStyle: "bold" },
      },
      {
        content: money(grandTotal),
        styles: { halign: "right", fontStyle: "bold" },
      },
    ]);

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

    // table starts after client block
    const tableStartY = clientBoxY + clientBoxH + 12;

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: 40, right: 40 },
      tableWidth: pageW - 80,
      head,
      body,
      theme: "grid",
      styles: {
        font: "times",
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [80, 80, 80],
        lineWidth: 0.8,
        overflow: "linebreak",
        valign: "middle",
        textColor: [0, 0, 0],
      },
      headStyles: {
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 52, halign: "center" },
        1: { cellWidth: 104 },
        2: { cellWidth: 50, halign: "right" },
        3: { cellWidth: 40, halign: "right" },
        4: { cellWidth: 48, halign: "center" },
        5: { cellWidth: 64, halign: "center" },
        6: { cellWidth: 70 },
        7: { cellWidth: 58 },
        8: { cellWidth: 62, halign: "right" },
      },
    });

    const lastY = (doc as any).lastAutoTable?.finalY ?? 520;

    doc.setFont("times", "bolditalic");
    doc.setFontSize(11);
    doc.text(`For ${broker.name}`, pageW - 220, lastY + 42);

    doc.save("client-wise-report.pdf");
  }

  function buildDayOrItemPdf(sortedRows) {
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("times", "bold");
    doc.setFontSize(11);
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
      buildClientWisePdf();
      return;
    }
    buildDayOrItemPdf(sortedRows);
  }
  
  function printReport() {
    const content = document.getElementById("report-preview");
    if (!content) return;

    const printWindow = window.open("", "", "width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Report</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 8mm;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            html, body {
              background: #fff;
              font-family: "Times New Roman", serif;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
            }

            #report-preview {
              width: 100%;
              padding: 0;
            }

            div[style*="display: flex"] {
              display: flex !important;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              page-break-inside: auto;
              font-size: 9px;
            }

            thead {
              display: table-header-group;
            }

            tr {
              page-break-inside: avoid;
            }

            th, td {
              border: 1px solid #333;
              padding: 1px 2px;
              font-size: 9px;
              line-height: 1.2;
              vertical-align: middle;
              overflow: hidden;
              white-space: nowrap;
            }

            th {
              font-weight: 700;
              background: #f3f4f6;
              text-align: left;
              white-space: nowrap;
            }

            /* Allow client/seller/buyer names to wrap if truly needed */
            td.wrap-cell {
              white-space: normal;
              word-break: break-word;
            }

            /* Boxed title for day/item reports */
            div[style*="border: 2px solid"] {
              border: 2px solid #333 !important;
              padding: 4px 10px !important;
              font-weight: 900 !important;
              display: inline-block !important;
              font-size: 12px !important;
            }

            /* Client-wise rounded boxes */
            div[style*="border-radius: 14px"],
            div[style*="border-radius: 16px"] {
              border: 1px solid #6b7280 !important;
              page-break-inside: avoid;
            }

            /* Totals section */
            div[style*="grid-template-columns: 1fr 1fr"][style*="border-top"] {
              border-top: 1px solid #c8ced8 !important;
              padding: 8px !important;
            }

            /* Grand total pill */
            div[style*="border-radius: 16"][style*="border: 2px solid"] {
              border: 2px solid #9aa3af !important;
              border-radius: 16px !important;
              padding: 8px 14px !important;
            }

            /* Signature line */
            div[style*="font-style: italic"][style*="text-align: right"] {
              margin-top: 16px !important;
              font-size: 14px !important;
            }

            /* Company name in print */
            div[style*="font-size: 22px"][style*="font-weight: 800"] {
              font-size: 18px !important;
            }

            /* Preview text lines - compact */
            div[style*="font-size: 14px"][style*="line-height: 1.5"] {
              font-size: 11px !important;
              line-height: 1.2 !important;
            }

            /* Totals styling compact */
            div[style*="letter-spacing: 2"][style*="font-size: 18px"] {
              font-size: 14px !important;
              letter-spacing: 1px !important;
              padding: 6px 10px !important;
            }

            div[style*="letter-spacing: 3"][style*="font-size: 20px"] {
              font-size: 16px !important;
              letter-spacing: 1px !important;
              padding: 10px 16px !important;
            }
          </style>
        </head>
        <body>
          <div id="report-preview">${content.innerHTML}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
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
              list="clientList"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Type to search client..."
            />
          </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>Item Name</div>
              <input
                style={textInput}
                list="itemList"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Type to search item..."
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
            <button style={btn} onClick={printReport} disabled={rows.length === 0}>
              Print
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

        <datalist id="clientList">
          {clients.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>

        <datalist id="itemList">
          {items.map((it) => (
            <option key={it.id} value={it.name} />
          ))}
        </datalist>
              </div>

      {/* Report preview */}
      {/* Report preview */}
      <div style={reportWrap}>
        <div style={paper} id="report-preview">
          {reportMode === "client" ? (
            <>
              <div style={previewTopRow}>
                <div style={previewLeftBlock}>
                  <div style={previewCompanyName}>{previewCompany.name}</div>
                  {previewCompany.line1 ? <div style={previewText}>{previewCompany.line1}</div> : null}
                  {previewCompany.addr1 ? <div style={previewText}>{previewCompany.addr1}</div> : null}
                  {previewCompany.addr2 ? <div style={previewText}>{previewCompany.addr2}</div> : null}
                  {previewCompany.city ? <div style={previewText}>{previewCompany.city}</div> : null}
                </div>

                <div style={previewRightBlock}>
                  <div style={previewText}>PAN No : {previewCompany.pan || "-"}</div>
                  <div style={previewText}>{previewCompany.bank || "-"}</div>
                  <div style={previewText}>IFSC Code {previewCompany.ifsc || "-"}</div>
                  <div style={previewText}>A/c No {previewCompany.acNo || "-"}</div>
                </div>
              </div>

              <div style={previewClientShell}>
                <div style={previewClientBox}>
                  <div style={previewClientName}>
                    {(safe(selectedClient?.name) || clientName || "CLIENT").toUpperCase()}
                  </div>
                  {safe(selectedClient?.address) ? <div style={previewText}>{safe(selectedClient?.address)}</div> : null}
                  {safe(selectedClient?.city_state ?? selectedClient?.cityState) ? (
                    <div style={previewText}>{safe(selectedClient?.city_state ?? selectedClient?.cityState)}</div>
                  ) : null}
                  {safe(selectedClient?.pin_no ?? selectedClient?.pinNo) ? (
                    <div style={previewText}>PIN {safe(selectedClient?.pin_no ?? selectedClient?.pinNo)}</div>
                  ) : null}
                  {safe(selectedClient?.mobile) ? (
                    <div style={previewText}>Mobile {safe(selectedClient?.mobile)}</div>
                  ) : null}
                  {safe(selectedClient?.email) ? (
                    <div style={previewText}>e-Mail {safe(selectedClient?.email)}</div>
                  ) : null}
                </div>

                <div style={previewBillBox}>
                  <div style={previewBillLine}>Bill No : {billNo || "-"}</div>
                  <div style={previewBillLine}>Date : {billDate || "-"}</div>
                </div>
              </div>

              <div style={tableWrap}>
                <table style={tbl}>
                  <colgroup>
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thCompact}>Conf Date</th>
                      <th style={thCompact}>Seller / Buyer</th>
                      <th style={{ ...thCompact, textAlign: "right" }}>Price</th>
                      <th style={{ ...thCompact, textAlign: "right" }}>Qty</th>
                      <th style={thCompact}>Unit</th>
                      <th style={thCompact}>Del.Date</th>
                      <th style={thCompact}>Tanker No</th>
                      <th style={thCompact}>Bill No</th>
                      <th style={{ ...thCompact, textAlign: "right" }}>Brokerage</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedPreviewRows.length === 0 ? (
                      <tr>
                        <td style={tdCompact} colSpan={9}>No records</td>
                      </tr>
                    ) : (
                      <>
                        {clientPreviewGroups.map((group, gi) => (
                          <React.Fragment key={`${group.product}-${gi}`}>
                            <tr>
                              <td style={{ ...tdCompact, fontWeight: 700 }} colSpan={2}>
                                {group.product}
                              </td>
                              <td style={{ ...tdCompact, textAlign: "center" }} colSpan={7}>
                                Brokerage Bill From {fromDate} To {toDate}
                              </td>
                            </tr>

                            {group.rows.map((r, idx) => {
                              const cn = norm(clientName);
                              const isSeller = norm(r.seller).includes(cn);
                              const brokerage = isSeller
                                ? toNumber(r.seller_brokerage ?? r.sellerBrokerage)
                                : toNumber(r.buyer_brokerage ?? r.buyerBrokerage);

                              const oppositeParty = isSeller
                                ? safe(r.buyer || "-")
                                : safe(r.seller || "-");

                              return (
                                <tr key={`${group.product}-${r.id ?? idx}`}>
                                  <td style={tdCompact}>{safe(r.confirm_date ?? r.confirmDate ?? "-")}</td>
                                  <td style={tdCompact}>{oppositeParty}</td>
                                  <td style={{ ...tdCompact, textAlign: "right" }}>{safe(r.rate || "-")}</td>
                                  <td style={{ ...tdCompact, textAlign: "right" }}>{safe(r.quantity || "-")}</td>
                                  <td style={tdCompact}>{safe(r.unit_qty ?? r.unitQty ?? "-")}</td>
                                  <td style={tdCompact}>{safe(r.delivery_date ?? r.deliveryDate ?? "-")}</td>
                                  <td style={tdCompact}>{safe(r.tanker_no ?? r.tankerNo ?? "-")}</td>
                                  <td style={tdCompact}>{safe(r.bill_no ?? r.billNo ?? "-")}</td>
                                  <td style={{ ...tdCompact, textAlign: "right" }}>{money(brokerage)}</td>
                                </tr>
                              );
                            })}

                            <tr>
                              <td style={{ ...tdCompact, textAlign: "right", fontStyle: "italic" }} colSpan={8}>
                                {group.product} Total Amount
                              </td>
                              <td style={{ ...tdCompact, textAlign: "right", fontWeight: 700 }}>
                                {money(group.total)}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}

                        <tr>
                          <td style={{ ...tdCompact, textAlign: "right", fontWeight: 700 }} colSpan={8}>
                            Grand Total
                          </td>
                          <td style={{ ...tdCompact, textAlign: "right", fontWeight: 700 }}>
                            {money(grandTotal)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={previewSign}>For {previewCompany.name}</div>
            </>
          ) : (
            <>
              <div style={boxTitleRow}>
                <div style={boxedTitle}>{reportTitle}</div>
              </div>

              <div style={subLine}>{headerLine}</div>

              <div style={tableWrap}>
                <table style={tbl}>
                  <colgroup>
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thCompact}>Conf.Date</th>
                      <th style={thCompact}>Seller Name</th>
                      <th style={{ ...thCompact, textAlign: "right" }}>S.brok</th>
                      <th style={thCompact}>Buyer Name</th>
                      <th style={{ ...thCompact, textAlign: "right" }}>B.brok</th>
                      <th style={thCompact}>Item Name</th>
                      <th style={thCompact}>Qty</th>
                      <th style={thCompact}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPreviewRows.length === 0 ? (
                      <tr>
                        <td style={tdCompact} colSpan={8}>No records</td>
                      </tr>
                    ) : (
                      sortedPreviewRows.map((r, idx) => {
                        const conf = (r.confirm_date ?? r.confirmDate ?? "-").toString();
                        return (
                          <tr key={r.id ?? idx}>
                            <td style={tdCompact}>{toDMonYY(conf)}</td>
                            <td style={tdCompact}>{r.seller ?? "-"}</td>
                            <td style={{ ...tdCompact, textAlign: "right" }}>
                              {money(toNumber(r.seller_brokerage ?? r.sellerBrokerage))}
                            </td>
                            <td style={tdCompact}>{r.buyer ?? "-"}</td>
                            <td style={{ ...tdCompact, textAlign: "right" }}>
                              {money(toNumber(r.buyer_brokerage ?? r.buyerBrokerage))}
                            </td>
                            <td style={tdCompact}>{r.product ?? "-"}</td>
                            <td style={tdCompact}>{r.quantity ?? "-"}</td>
                            <td style={tdCompact}>{r.rate ?? "-"}</td>
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
  width: "min(780px, 100%)",
  background: "#fff",
  border: "1px solid #c8ced8",
  padding: 14,
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
  tableLayout: "fixed",
  fontSize: 11,
};

const th: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 4px",
  textAlign: "left",
  background: "#f3f4f6",
  whiteSpace: "nowrap",
  fontSize: 11,
};

const thCompact: React.CSSProperties = {
  ...th,
  padding: "3px 2px",
  fontSize: 10,
};

const td: React.CSSProperties = {
  border: "1px solid #333",
  padding: "4px 4px",
  verticalAlign: "middle",
  fontSize: 12,
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const tdCompact: React.CSSProperties = {
  ...td,
  padding: "2px 2px",
  fontSize: 10,
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

const previewTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 18,
};

const previewLeftBlock: React.CSSProperties = {
  width: "50%",
};

const previewRightBlock: React.CSSProperties = {
  width: "32%",
  textAlign: "left",
};

const previewCompanyName: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 2,
};

const previewText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
};

const previewClientShell: React.CSSProperties = {
  position: "relative",
  border: "1px solid #6b7280",
  borderRadius: 14,
  padding: "18px 18px 18px 18px",
  marginBottom: 14,
  minHeight: 118,
};

const previewClientBox: React.CSSProperties = {
  width: "55%",
};

const previewClientName: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  marginBottom: 2,
};

const previewBillBox: React.CSSProperties = {
  position: "absolute",
  right: 24,
  top: 22,
  width: 220,
  border: "1px solid #6b7280",
  borderRadius: 16,
  padding: "18px 22px",
};

const previewBillLine: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.8,
};

const previewSign: React.CSSProperties = {
  marginTop: 28,
  textAlign: "right",
  fontSize: 20,
  fontWeight: 800,
  fontStyle: "italic",
};
