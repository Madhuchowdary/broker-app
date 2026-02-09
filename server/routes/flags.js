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
        SELECT * FROM flags
        WHERE is_active = 1
          AND name LIKE ?
        ORDER BY name
        `
      )
      .all(`%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM flags WHERE is_active = 1 ORDER BY name`).all();
  }

  res.json(rows);
});

// Create
router.post("/", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Flag is required" });
  }

  try {
    const info = db.prepare(`INSERT INTO flags (name) VALUES (?)`).run(name.trim());
    const created = db.prepare(`SELECT * FROM flags WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ message: "Flag already exists" });
    }
    return res.status(500).json({ message: "Failed to create flag" });
  }
});

// Update
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM flags WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Flag not found" });

  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Flag is required" });
  }

  try {
    db.prepare(`UPDATE flags SET name = ? WHERE id = ?`).run(name.trim(), id);
    const updated = db.prepare(`SELECT * FROM flags WHERE id = ?`).get(id);
    res.json(updated);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ message: "Flag already exists" });
    }
    return res.status(500).json({ message: "Failed to update flag" });
  }
});

// Soft delete
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM flags WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ message: "Flag not found" });

  db.prepare(`UPDATE flags SET is_active = 0 WHERE id = ?`).run(id);
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
  db.prepare(`UPDATE flags SET is_active = 0 WHERE id IN (${placeholders})`).run(...clean);

  res.json({ ok: true, deleted: clean.length });
});

module.exports = router;
