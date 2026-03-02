const express = require("express");
const db = require("../db");
const PDFDocument = require("pdfkit");

const router = express.Router();

function toNumber(v) {
  const n = Number((v ?? "").toString().replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

router.post("/day-wise-pdf", (req, res) => {
  const { fromDate, toDate, clientName, itemName } = req.body || {};

  const rows = db.prepare(`
    SELECT * FROM transactions
    WHERE is_active = 1
  `).all();

  // 🔹 Filter in JS (same logic as UI)
  const filtered = rows.filter((r) => {
    const seller = (r.seller || "").toLowerCase();
    const buyer = (r.buyer || "").toLowerCase();
    const product = (r.product || "").toLowerCase();

    const clientOk = clientName
      ? seller.includes(clientName.toLowerCase()) ||
        buyer.includes(clientName.toLowerCase())
      : true;

    const itemOk = itemName
      ? product.includes(itemName.toLowerCase())
      : true;

    return clientOk && itemOk;
  });

  const doc = new PDFDocument({ margin: 30, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=day-wise-report.pdf`
  );

  doc.pipe(res);

  doc.fontSize(16).text("DAY WISE REPORT", { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`From: ${fromDate}   To: ${toDate}`);
  doc.moveDown();

  let y = doc.y;

  filtered.forEach((r, index) => {
    doc.text(
      `${index + 1}. ${r.confirm_date} | ${r.seller} | ${r.buyer} | ${r.product} | ${r.quantity} | ${r.rate}`
    );
  });

  const sellerTotal = filtered.reduce(
    (sum, r) => sum + toNumber(r.seller_brokerage),
    0
  );
  const buyerTotal = filtered.reduce(
    (sum, r) => sum + toNumber(r.buyer_brokerage),
    0
  );

  doc.moveDown();
  doc.text(`Seller Brokerage Total: ${sellerTotal.toFixed(2)}`);
  doc.text(`Buyer Brokerage Total: ${buyerTotal.toFixed(2)}`);

  doc.end();
});

module.exports = router;