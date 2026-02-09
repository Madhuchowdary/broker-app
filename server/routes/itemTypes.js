const express = require("express");
const db = require("../db");
const router = express.Router();

/* LIST / SEARCH */
router.get("/", (req, res) => {
  const q = (req.query.q || "").trim();

  const rows = q
    ? db.prepare(`
        SELECT * FROM item_types
        WHERE is_active = 1 AND name LIKE ?
        ORDER BY name
      `).all(`%${q}%`)
    : db.prepare(`
        SELECT * FROM item_types
        WHERE is_active = 1
        ORDER BY name
      `).all();

  res.json(rows);
});

/* CREATE */
router.post("/", (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ message: "Item type is required" });
  }

  try {
    const info = db
      .prepare(`INSERT INTO item_types (name) VALUES (?)`)
      .run(name.trim());

    const created = db
      .prepare(`SELECT * FROM item_types WHERE id = ?`)
      .get(info.lastInsertRowid);

    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ message: "Item type already exists" });
  }
});

/* UPDATE */
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ message: "Item type is required" });
  }

  const existing = db.prepare(
    `SELECT * FROM item_types WHERE id = ?`
  ).get(id);

  if (!existing) {
    return res.status(404).json({ message: "Item type not found" });
  }

  db.prepare(`
    UPDATE item_types SET name = ? WHERE id = ?
  `).run(name.trim(), id);

  const updated = db
    .prepare(`SELECT * FROM item_types WHERE id = ?`)
    .get(id);

  res.json(updated);
});

/* SOFT DELETE */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  db.prepare(`
    UPDATE item_types SET is_active = 0 WHERE id = ?
  `).run(id);

  res.json({ ok: true });
});

/* BULK DELETE */
router.post("/bulk-delete", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const clean = ids.map(Number).filter(Boolean);

  if (!clean.length) {
    return res.status(400).json({ message: "No ids provided" });
  }

  const q = clean.map(() => "?").join(",");
  db.prepare(`
    UPDATE item_types SET is_active = 0 WHERE id IN (${q})
  `).run(...clean);

  res.json({ ok: true, deleted: clean.length });
});

module.exports = router;
