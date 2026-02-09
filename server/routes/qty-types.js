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
        SELECT * FROM qty_types
        WHERE is_active = 1
          AND name LIKE ?
        ORDER BY name
        `
      )
      .all(`%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM qty_types WHERE is_active = 1 ORDER BY name`).all();
  }

  res.json(rows);
});

// Create
router.post("/", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Quantity type is required" });
  }

  try {
    const info = db.prepare(`INSERT INTO qty_types (name) VALUES (?)`).run(name.trim());
    const created = db.prepare(`SELECT * FROM qty_types WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ message: "Quantity type already exists" });
    }
    return res.status(500).json({ message: "Failed to create quantity type" });
  }
});

// Update
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM qty_types WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Quantity type not found" });

  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Quantity type is required" });
  }

  try {
    db.prepare(`UPDATE qty_types SET name = ? WHERE id = ?`).run(name.trim(), id);
    const updated = db.prepare(`SELECT * FROM qty_types WHERE id = ?`).get(id);
    res.json(updated);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ message: "Quantity type already exists" });
    }
    return res.status(500).json({ message: "Failed to update quantity type" });
  }
});

// Soft delete
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM qty_types WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Quantity type not found" });

  db.prepare(`UPDATE qty_types SET is_active = 0 WHERE id = ?`).run(id);
  res.json({ ok: true });
});

// Bulk soft delete
router.post("/bulk-delete", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const clean = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);

  if (clean.length === 0) {
    return res.status(400).json({ message: "No valid ids provided" });
  }

  const placeholders = clean.map(() => "?").join(",");
  db.prepare(`UPDATE qty_types SET is_active = 0 WHERE id IN (${placeholders})`).run(...clean);

  res.json({ ok: true, deleted: clean.length });
});

module.exports = router;
