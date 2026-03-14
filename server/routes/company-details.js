const express = require("express");
const db = require("../db");

const router = express.Router();

function cleanStr(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

router.get("/", (req, res) => {
  const q = (req.query.q || "").toString().trim();

  if (q) {
    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT * FROM company_details
      WHERE is_active = 1
        AND (
          name LIKE ? OR title LIKE ? OR city_state LIKE ? OR
          pan_no LIKE ? OR bank LIKE ? OR email LIKE ?
        )
      ORDER BY id DESC
    `).all(like, like, like, like, like, like);

    return res.json(rows);
  }

  const rows = db.prepare(`
    SELECT * FROM company_details
    WHERE is_active = 1
    ORDER BY id DESC
  `).all();

  res.json(rows);
});

router.post("/", (req, res) => {
  const b = req.body || {};

  if (!cleanStr(b.name)) {
    return res.status(400).json({ message: "Name is required" });
  }

  const info = db.prepare(`
    INSERT INTO company_details (
      name, title, address, near, city_state,
      contact_nos, email, pan_no, bank, ifsc_code, account_no
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanStr(b.name),
    cleanStr(b.title),
    cleanStr(b.address),
    cleanStr(b.near),
    cleanStr(b.city_state),
    cleanStr(b.contact_nos),
    cleanStr(b.email),
    cleanStr(b.pan_no),
    cleanStr(b.bank),
    cleanStr(b.ifsc_code),
    cleanStr(b.account_no)
  );

  const saved = db.prepare(`SELECT * FROM company_details WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(saved);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};

  const existing = db.prepare(`
    SELECT * FROM company_details
    WHERE id = ? AND is_active = 1
  `).get(id);

  if (!existing) {
    return res.status(404).json({ message: "Record not found" });
  }

  if (!cleanStr(b.name)) {
    return res.status(400).json({ message: "Name is required" });
  }

  db.prepare(`
    UPDATE company_details SET
      name=?, title=?, address=?, near=?, city_state=?,
      contact_nos=?, email=?, pan_no=?, bank=?, ifsc_code=?, account_no=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    cleanStr(b.name),
    cleanStr(b.title),
    cleanStr(b.address),
    cleanStr(b.near),
    cleanStr(b.city_state),
    cleanStr(b.contact_nos),
    cleanStr(b.email),
    cleanStr(b.pan_no),
    cleanStr(b.bank),
    cleanStr(b.ifsc_code),
    cleanStr(b.account_no),
    id
  );

  const updated = db.prepare(`SELECT * FROM company_details WHERE id = ?`).get(id);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`
    UPDATE company_details
    SET is_active = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  res.json({ ok: true });
});

router.post("/bulk-delete", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];

  if (!ids.length) {
    return res.status(400).json({ message: "No ids provided" });
  }

  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`
    UPDATE company_details
    SET is_active = 0, updated_at = datetime('now')
    WHERE id IN (${placeholders})
  `).run(...ids);

  res.json({ ok: true, count: ids.length });
});

module.exports = router;