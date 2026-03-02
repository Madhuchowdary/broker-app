const express = require("express");
const db = require("../db");
const router = express.Router();

// Get GST
router.get("/gst", (req, res) => {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'GST'`).get();
  res.json({ gst: row?.value ?? "" });
});

// Save GST
router.post("/gst", (req, res) => {
  const gst = (req.body?.gst ?? "").toString().trim();

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('GST', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `).run(gst);

  res.json({ ok: true, gst });
});

module.exports = router;