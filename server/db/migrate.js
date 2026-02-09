const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "..", "..", "data", "app.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gst_no TEXT,
    fssai_no TEXT,
    address TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_clients_updated_at
  AFTER UPDATE ON clients
  FOR EACH ROW
  BEGIN
    UPDATE clients SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
`);

console.log("✅ Migration complete. DB at:", dbPath);
db.close();
