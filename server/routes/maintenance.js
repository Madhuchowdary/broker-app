const express = require("express");
const archiver = require("archiver");
const unzipper = require("unzipper");
const multer = require("multer");
const db = require("../db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDDMMYY(d) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${pad2(d.getFullYear() % 100)}`;
}

function fromDDMMYY(s) {
  const t = (s || "").trim().replaceAll("/", "-");
  const m = t.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const raw = Number(m[3]);
  const yyyy = raw < 100 ? 2000 + raw : raw;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getFinancialYearStart(today = new Date()) {
  const y = today.getFullYear();
  const april1 = new Date(y, 3, 1);
  return today >= april1 ? april1 : new Date(y - 1, 3, 1);
}

function formatDateReadable(d) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function appendJson(archive, name, data) {
  archive.append(JSON.stringify(data, null, 2), { name });
}

router.get("/backup", async (req, res) => {
  try {
    const today = new Date();
    const fyStart = getFinancialYearStart(today);

    const allTransactions = db
    .prepare(`SELECT * FROM transactions ORDER BY id ASC`)
    .all();

    const transactions = allTransactions.filter((r) => {
    const d = fromDDMMYY(r.confirm_date || "");
    return d && d >= fyStart && d <= today;
    });
    
    const clients = db.prepare(`SELECT * FROM clients WHERE is_active = 1 ORDER BY id ASC`).all();
    const itemTypes = db.prepare(`SELECT * FROM item_types WHERE is_active = 1 ORDER BY id ASC`).all();
    const qtyTypes = db.prepare(`SELECT * FROM qty_types WHERE is_active = 1 ORDER BY id ASC`).all();
    const ratePerUnit = db.prepare(`SELECT * FROM rate_per_unit WHERE is_active = 1 ORDER BY id ASC`).all();
    const deliveryPlaces = db.prepare(`SELECT * FROM delivery_places WHERE is_active = 1 ORDER BY id ASC`).all();
    const paymentTypes = db.prepare(`SELECT * FROM payment_types WHERE is_active = 1 ORDER BY id ASC`).all();
    const flags = db.prepare(`SELECT * FROM flags WHERE is_active = 1 ORDER BY id ASC`).all();
    const companyDetails = db.prepare(`SELECT * FROM company_details WHERE is_active = 1 ORDER BY id ASC`).all();
    const appSettings = db.prepare(`SELECT * FROM app_settings ORDER BY key ASC`).all();

    const meta = {
      created_at: new Date().toISOString(),
      from_date: formatDateReadable(fyStart),
      to_date: formatDateReadable(today),
      tables: {
        transactions: transactions.length,
        clients: clients.length,
        item_types: itemTypes.length,
        qty_types: qtyTypes.length,
        rate_per_unit: ratePerUnit.length,
        delivery_places: deliveryPlaces.length,
        payment_types: paymentTypes.length,
        flags: flags.length,
        company_details: companyDetails.length,
        app_settings: appSettings.length,
      },
    };

    const fileName = `backup-${formatDateReadable(fyStart)}-to-${formatDateReadable(today)}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    appendJson(archive, "meta.json", meta);
    appendJson(archive, "transactions.json", transactions);
    appendJson(archive, "clients.json", clients);
    appendJson(archive, "item_types.json", itemTypes);
    appendJson(archive, "qty_types.json", qtyTypes);
    appendJson(archive, "rate_per_unit.json", ratePerUnit);
    appendJson(archive, "delivery_places.json", deliveryPlaces);
    appendJson(archive, "payment_types.json", paymentTypes);
    appendJson(archive, "flags.json", flags);
    appendJson(archive, "company_details.json", companyDetails);
    appendJson(archive, "app_settings.json", appSettings);

    await archive.finalize();
  } catch (e) {
    console.error("Backup failed:", e);
    res.status(500).json({ message: "Backup failed" });
  }
});

router.post("/clear-database", (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM transactions").run();
      db.prepare("DELETE FROM clients").run();
      db.prepare("DELETE FROM item_types").run();
      db.prepare("DELETE FROM qty_types").run();
      db.prepare("DELETE FROM rate_per_unit").run();
      db.prepare("DELETE FROM delivery_places").run();
      db.prepare("DELETE FROM payment_types").run();
      db.prepare("DELETE FROM flags").run();
      db.prepare("DELETE FROM company_details").run();
      db.prepare("DELETE FROM app_settings").run();

      db.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='clients'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='item_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='qty_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='rate_per_unit'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='delivery_places'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='payment_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='flags'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='company_details'").run();

      // recreate required default app settings
      db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value)
        VALUES ('GST', '')
      `).run();
    });

    tx();
    res.json({ ok: true, message: "Database cleared successfully." });
  } catch (e) {
    console.error("Clear database failed:", e);
    res.status(500).json({ ok: false, message: "Clear database failed." });
  }
});

router.post("/restore", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No backup ZIP uploaded." });
    }

    const zip = await unzipper.Open.buffer(req.file.buffer);
    const dataMap = {};

    for (const entry of zip.files) {
      if (entry.type !== "File") continue;
      const buf = await entry.buffer();
      dataMap[entry.path] = JSON.parse(buf.toString("utf8"));
    }

    const clients = dataMap["clients.json"] || [];
    const itemTypes = dataMap["item_types.json"] || [];
    const qtyTypes = dataMap["qty_types.json"] || [];
    const ratePerUnit = dataMap["rate_per_unit.json"] || [];
    const deliveryPlaces = dataMap["delivery_places.json"] || [];
    const paymentTypes = dataMap["payment_types.json"] || [];
    const flags = dataMap["flags.json"] || [];
    const companyDetails = dataMap["company_details.json"] || [];
    const transactions = dataMap["transactions.json"] || [];
    const appSettings = dataMap["app_settings.json"] || [];

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM transactions").run();
      db.prepare("DELETE FROM clients").run();
      db.prepare("DELETE FROM item_types").run();
      db.prepare("DELETE FROM qty_types").run();
      db.prepare("DELETE FROM rate_per_unit").run();
      db.prepare("DELETE FROM delivery_places").run();
      db.prepare("DELETE FROM payment_types").run();
      db.prepare("DELETE FROM flags").run();
      db.prepare("DELETE FROM company_details").run();
      db.prepare("DELETE FROM app_settings").run();

      db.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='clients'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='item_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='qty_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='rate_per_unit'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='delivery_places'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='payment_types'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='flags'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='company_details'").run();

      const insertClient = db.prepare(`
        INSERT INTO clients
        (name, gst_no, fssai_no, address, phone, mobile, email, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      clients.forEach((r) => {
        insertClient.run(
          r.name ?? null,
          r.gst_no ?? null,
          r.fssai_no ?? null,
          r.address ?? null,
          r.phone ?? null,
          r.mobile ?? null,
          r.email ?? null,
          r.is_active ?? 1,
          r.created_at ?? null,
          r.updated_at ?? null
        );
      });

      const insertItem = db.prepare(`
        INSERT INTO item_types (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      itemTypes.forEach((r) => {
        insertItem.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertQty = db.prepare(`
        INSERT INTO qty_types (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      qtyTypes.forEach((r) => {
        insertQty.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertRate = db.prepare(`
        INSERT INTO rate_per_unit (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      ratePerUnit.forEach((r) => {
        insertRate.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertPlace = db.prepare(`
        INSERT INTO delivery_places (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      deliveryPlaces.forEach((r) => {
        insertPlace.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertPayment = db.prepare(`
        INSERT INTO payment_types (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      paymentTypes.forEach((r) => {
        insertPayment.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertFlag = db.prepare(`
        INSERT INTO flags (name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      flags.forEach((r) => {
        insertFlag.run(r.name ?? null, r.is_active ?? 1, r.created_at ?? null, r.updated_at ?? null);
      });

      const insertCompany = db.prepare(`
        INSERT INTO company_details
        (name, title, address, near, city_state, contact_nos, email, pan_no, bank, ifsc_code, account_no, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      companyDetails.forEach((r) => {
        insertCompany.run(
          r.name ?? null,
          r.title ?? null,
          r.address ?? null,
          r.near ?? null,
          r.city_state ?? null,
          r.contact_nos ?? null,
          r.email ?? null,
          r.pan_no ?? null,
          r.bank ?? null,
          r.ifsc_code ?? null,
          r.account_no ?? null,
          r.is_active ?? 1,
          r.created_at ?? null,
          r.updated_at ?? null
        );
      });

      const insertSetting = db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, COALESCE(?, datetime('now')))
      `);
      appSettings.forEach((r) => {
        insertSetting.run(
          r.key ?? null,
          r.value ?? null,
          r.updated_at ?? null
        );
      });

      const insertTxn = db.prepare(`
        INSERT INTO transactions
        (
          transaction_id, seller, seller_brokerage, buyer, buyer_brokerage,
          product, rate, unit_rate, tax, quantity, unit_qty,
          confirm_date, delivery_time, delivery_place, payment, flag,
          status, delivery_date, tanker_no, bill_no, delivery_qty,
          delivery_unit_qty, amount_rs, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      transactions.forEach((r) => {
        insertTxn.run(
          r.transaction_id ?? null,
          r.seller ?? null,
          r.seller_brokerage ?? null,
          r.buyer ?? null,
          r.buyer_brokerage ?? null,
          r.product ?? null,
          r.rate ?? null,
          r.unit_rate ?? null,
          r.tax ?? null,
          r.quantity ?? null,
          r.unit_qty ?? null,
          r.confirm_date ?? null,
          r.delivery_time ?? null,
          r.delivery_place ?? null,
          r.payment ?? null,
          r.flag ?? null,
          r.status ?? "UNDELIVERED",
          r.delivery_date ?? null,
          r.tanker_no ?? null,
          r.bill_no ?? null,
          r.delivery_qty ?? null,
          r.delivery_unit_qty ?? null,
          r.amount_rs ?? null,
          r.is_active ?? 1,
          r.created_at ?? null,
          r.updated_at ?? null
        );
      });

      // keep GST setting if backup didn't contain it
      db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value)
        VALUES ('GST', '')
      `).run();
    });

    tx();
    res.json({ ok: true, message: "Restore completed successfully." });
  } catch (e) {
    console.error("Restore failed:", e);
    res.status(500).json({ ok: false, message: "Restore failed." });
  }
});


router.get("/fix-dates", (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE transactions
      SET
        confirm_date = CASE
          WHEN confirm_date IS NOT NULL
               AND length(confirm_date) = 8
          THEN substr(confirm_date, 1, 6) || '20' || substr(confirm_date, 7, 2)
          ELSE confirm_date
        END,
        delivery_date = CASE
          WHEN delivery_date IS NOT NULL
               AND length(delivery_date) = 8
          THEN substr(delivery_date, 1, 6) || '20' || substr(delivery_date, 7, 2)
          ELSE delivery_date
        END
    `).run();

    res.json({
      message: "Date migration completed",
      changes: result.changes,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Migration failed" });
  }
});
module.exports = router;