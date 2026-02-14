// server/routes/transactions.routes.js
const express = require("express");
const db = require("../db");
const router = express.Router();

/** ---------- helpers ---------- */
function cleanStr(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}
function cleanCode(s = "") {
  const t = (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
  return t.length ? t : "NA";
}
function padId(id) {
  return String(id).padStart(4, "0");
}
function makeTransactionId(seller, buyer, id) {
  const s = cleanCode(seller);
  const b = cleanCode(buyer);
  return `${s}-${b}-${padId(id)}`;
}

/**
 * Ensure transaction_id column exists.
 * This avoids manual sqlite cmd and avoids breaking inserts.
 */
function ensureTransactionIdColumn() {
  try {
    const cols = db.prepare(`PRAGMA table_info(transactions)`).all();
    const has = cols.some((c) => c.name === "transaction_id");
    if (!has) {
      db.exec(`ALTER TABLE transactions ADD COLUMN transaction_id TEXT;`);
    }
  } catch (e) {
    // if ALTER fails for any reason, we don't crash the server
    console.warn("ensureTransactionIdColumn:", e?.message || e);
  }
}
ensureTransactionIdColumn();

/** ---------- LIST / FIND ----------
 *  GET /api/transactions?status=UNDELIVERED&q=abc
 */
router.get("/", (req, res) => {
  const status = (req.query.status || "").toString().trim(); // optional
  const q = (req.query.q || "").toString().trim();

  const where = [`is_active = 1`];
  const args = [];

  if (status) {
    where.push(`status = ?`);
    args.push(status);
  }

  if (q) {
    where.push(`
      (
        seller LIKE ? OR buyer LIKE ? OR product LIKE ? OR
        delivery_place LIKE ? OR payment LIKE ? OR flag LIKE ? OR
        tanker_no LIKE ? OR bill_no LIKE ? OR
        transaction_id LIKE ?
      )
    `);
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like, like, like, like);
  }

  const sql = `
    SELECT * FROM transactions
    WHERE ${where.join(" AND ")}
    ORDER BY id DESC
  `;

  const rows = db.prepare(sql).all(...args);
  res.json(rows);
});

/** GET ONE */
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND is_active = 1`)
    .get(id);

  if (!row) return res.status(404).json({ message: "Transaction not found" });
  res.json(row);
});

/** CREATE */
router.post("/", (req, res) => {
  const b = req.body || {};

  // minimal validation
  if (!cleanStr(b.seller) && !cleanStr(b.buyer) && !cleanStr(b.product)) {
    return res
      .status(400)
      .json({ message: "Enter at least Seller/Buyer/Product" });
  }

  // 1) insert row (WITHOUT forcing any id from UI)
  const info = db
    .prepare(
      `
    INSERT INTO transactions (
      seller, seller_brokerage, buyer, buyer_brokerage,
      product, rate, unit_rate, tax, quantity, unit_qty,
      confirm_date, delivery_time, delivery_place, payment, flag,
      status,
      delivery_date, tanker_no, bill_no, delivery_qty, delivery_unit_qty, amount_rs
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      cleanStr(b.seller),
      cleanStr(b.sellerBrokerage),
      cleanStr(b.buyer),
      cleanStr(b.buyerBrokerage),

      cleanStr(b.product),
      cleanStr(b.rate),
      cleanStr(b.unitRate),
      cleanStr(b.tax) || "Plus VAT",
      cleanStr(b.quantity),
      cleanStr(b.unitQty),

      cleanStr(b.confirmDate),
      cleanStr(b.deliveryTime),
      cleanStr(b.deliveryPlace),
      cleanStr(b.payment),
      cleanStr(b.flag),

      cleanStr(b.status) || "UNDELIVERED",

      cleanStr(b.deliveryDate),
      cleanStr(b.tankerNo),
      cleanStr(b.billNo),
      cleanStr(b.deliveryQty) || "0",
      cleanStr(b.deliveryUnitQty),
      cleanStr(b.amountRs) || "0.00"
    );

  const id = Number(info.lastInsertRowid);

  // 2) generate transaction_id (seller-buyer-0001)
  const txId = makeTransactionId(b.seller, b.buyer, id);

  // 3) update transaction_id
  try {
    db.prepare(`UPDATE transactions SET transaction_id = ? WHERE id = ?`).run(
      txId,
      id
    );
  } catch (e) {
    // if column missing for some reason, don't crash
    console.warn("transaction_id update failed:", e?.message || e);
  }

  // 4) return full row
  const saved = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
  res.status(201).json(saved);
});

/** UPDATE (full edit) */
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND is_active = 1`)
    .get(id);
  if (!existing) return res.status(404).json({ message: "Transaction not found" });

  const b = req.body || {};

  db.prepare(`
    UPDATE transactions SET
      seller=?, seller_brokerage=?, buyer=?, buyer_brokerage=?,
      product=?, rate=?, unit_rate=?, tax=?, quantity=?, unit_qty=?,
      confirm_date=?, delivery_time=?, delivery_place=?, payment=?, flag=?,
      status=?,
      delivery_date=?, tanker_no=?, bill_no=?, delivery_qty=?, delivery_unit_qty=?, amount_rs=?
    WHERE id=?
  `).run(
    cleanStr(b.seller),
    cleanStr(b.sellerBrokerage),
    cleanStr(b.buyer),
    cleanStr(b.buyerBrokerage),

    cleanStr(b.product),
    cleanStr(b.rate),
    cleanStr(b.unitRate),
    cleanStr(b.tax) || "Plus VAT",
    cleanStr(b.quantity),
    cleanStr(b.unitQty),

    cleanStr(b.confirmDate),
    cleanStr(b.deliveryTime),
    cleanStr(b.deliveryPlace),
    cleanStr(b.payment),
    cleanStr(b.flag),

    cleanStr(b.status) || existing.status || "UNDELIVERED",

    cleanStr(b.deliveryDate),
    cleanStr(b.tankerNo),
    cleanStr(b.billNo),
    cleanStr(b.deliveryQty) || "0",
    cleanStr(b.deliveryUnitQty),
    cleanStr(b.amountRs) || "0.00",
    id
  );

  // keep tx id consistent if seller/buyer changed
  const updatedNow = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
  try {
    const txId = makeTransactionId(updatedNow.seller, updatedNow.buyer, id);
    db.prepare(`UPDATE transactions SET transaction_id=? WHERE id=?`).run(txId, id);
  } catch {}

  const updated = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
  res.json(updated);
});

/** DELIVER (only delivery fields + mark DELIVERED) */
router.put("/:id/deliver", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND is_active = 1`)
    .get(id);
  if (!existing) return res.status(404).json({ message: "Transaction not found" });

  const b = req.body || {};

  db.prepare(`
    UPDATE transactions SET
      status='DELIVERED',
      delivery_date=?,
      tanker_no=?,
      bill_no=?,
      delivery_qty=?,
      delivery_unit_qty=?,
      amount_rs=?
    WHERE id=?
  `).run(
    cleanStr(b.deliveryDate),
    cleanStr(b.tankerNo),
    cleanStr(b.billNo),
    cleanStr(b.deliveryQty) || "0",
    cleanStr(b.deliveryUnitQty),
    cleanStr(b.amountRs) || "0.00",
    id
  );

  const updated = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
  res.json(updated);
});

/** SOFT DELETE */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`UPDATE transactions SET is_active = 0 WHERE id = ?`).run(id);
  res.json({ ok: true });
});

// BULK soft delete
router.post("/bulk-delete", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const clean = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);

  if (clean.length === 0) {
    return res.status(400).json({ message: "No valid ids provided" });
  }

  const placeholders = clean.map(() => "?").join(",");
  db.prepare(`UPDATE transactions SET is_active = 0 WHERE id IN (${placeholders})`).run(...clean);

  res.json({ ok: true, deleted: clean.length });
});


/* REPORT (transaction + seller/buyer client details) */
router.get("/:id/report", (req, res) => {
  const id = Number(req.params.id);

  const tx = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND is_active = 1`)
    .get(id);

  if (!tx) return res.status(404).json({ message: "Transaction not found" });

  // NOTE: transactions.seller and buyer are TEXT names.
  // We fetch matching clients by name (same as dropdown value).
  const sellerClient = db
    .prepare(`SELECT * FROM clients WHERE is_active = 1 AND name = ? LIMIT 1`)
    .get(tx.seller);

  const buyerClient = db
    .prepare(`SELECT * FROM clients WHERE is_active = 1 AND name = ? LIMIT 1`)
    .get(tx.buyer);

  res.json({
    transaction: tx,
    seller: sellerClient || null,
    buyer: buyerClient || null,
  });
});


module.exports = router;
