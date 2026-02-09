const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// DB file location → brokerage/data/app.db
const dbPath = path.join(__dirname, "..", "..", "data", "app.db");

// Ensure data folder exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Open DB
const db = new Database(dbPath);

// Enable FK
db.exec("PRAGMA foreign_keys = ON;");

// Create CLIENTS table
db.exec(`
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

db.exec(`
  CREATE TABLE IF NOT EXISTS qty_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_qty_types_updated_at
  AFTER UPDATE ON qty_types
  BEGIN
    UPDATE qty_types SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS rate_per_unit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_rate_per_unit_updated_at
  AFTER UPDATE ON rate_per_unit
  BEGIN
    UPDATE rate_per_unit SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);


db.exec(`
  CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_item_types_updated_at
  AFTER UPDATE ON item_types
  BEGIN
    UPDATE item_types SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);


db.exec(`
  CREATE TABLE IF NOT EXISTS delivery_places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_delivery_places_updated_at
  AFTER UPDATE ON delivery_places
  BEGIN
    UPDATE delivery_places SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_payment_types_updated_at
  AFTER UPDATE ON payment_types
  BEGIN
    UPDATE payment_types SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);


db.exec(`
  CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_flags_updated_at
  AFTER UPDATE ON flags
  BEGIN
    UPDATE flags SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);


db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- ✅ business transaction number like SELLER_12
    transaction_id TEXT UNIQUE,

    seller TEXT,
    seller_brokerage TEXT,
    buyer TEXT,
    buyer_brokerage TEXT,

    product TEXT,
    rate TEXT,
    unit_rate TEXT,
    tax TEXT,
    quantity TEXT,
    unit_qty TEXT,

    confirm_date TEXT,
    delivery_time TEXT,
    delivery_place TEXT,
    payment TEXT,
    flag TEXT,

    status TEXT NOT NULL DEFAULT 'UNDELIVERED',

    -- delivery details
    delivery_date TEXT,
    tanker_no TEXT,
    bill_no TEXT,
    delivery_qty TEXT,
    delivery_unit_qty TEXT,
    amount_rs TEXT,

    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS trg_transactions_updated_at
  AFTER UPDATE ON transactions
  BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);



module.exports = db;
