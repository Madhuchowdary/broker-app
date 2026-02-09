const express = require("express");
const db = require("../db");
const router = express.Router();
// List / search
router.get("/", (req, res) => {
  const q = (req.query.q || "").toString().trim();

  let rows;
  if (q) {
    rows = db
      .prepare(
        `
        SELECT * FROM clients
        WHERE is_active = 1
          AND (name LIKE ? OR mobile LIKE ? OR email LIKE ? OR gst_no LIKE ? OR fssai_no LIKE ?)
        ORDER BY name
        `
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    rows = db
      .prepare(`SELECT * FROM clients WHERE is_active = 1 ORDER BY name`)
      .all();
  }

  res.json(rows);
});

// Create
router.post("/", (req, res) => {
  const {
    name,
    gst_no = null,
    fssai_no = null,
    address = null,
    phone = null,
    mobile = null,
    email = null,
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Client name is required" });
  }

  const stmt = db.prepare(`
    INSERT INTO clients (name, gst_no, fssai_no, address, phone, mobile, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    name.trim(),
    gst_no,
    fssai_no,
    address,
    phone,
    mobile,
    email
  );

  const created = db
    .prepare(`SELECT * FROM clients WHERE id = ?`)
    .get(info.lastInsertRowid);

  res.status(201).json(created);
});

// Update
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Client not found" });

  const patch = { ...existing, ...(req.body || {}) };
  if (!patch.name || !patch.name.trim()) {
    return res.status(400).json({ message: "Client name is required" });
  }

  db.prepare(`
    UPDATE clients
    SET name = ?, gst_no = ?, fssai_no = ?, address = ?, phone = ?, mobile = ?, email = ?
    WHERE id = ?
  `).run(
    patch.name.trim(),
    patch.gst_no || null,
    patch.fssai_no || null,
    patch.address || null,
    patch.phone || null,
    patch.mobile || null,
    patch.email || null,
    id
  );

  const updated = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  res.json(updated);
});

// Soft delete
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Client not found" });

  db.prepare(`UPDATE clients SET is_active = 0 WHERE id = ?`).run(id);
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
  db.prepare(`UPDATE clients SET is_active = 0 WHERE id IN (${placeholders})`).run(...clean);

  res.json({ ok: true, deleted: clean.length });
});


module.exports = router;
