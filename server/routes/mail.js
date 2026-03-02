const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

function must(v, name) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const transporter = nodemailer.createTransport({
  host: must(process.env.SMTP_HOST, "SMTP_HOST"),
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // STARTTLS on 587
  auth: {
    user: must(process.env.SMTP_USER, "SMTP_USER"),
    pass: must(process.env.SMTP_PASS, "SMTP_PASS"),
  },
});

router.post("/transaction-note", async (req, res) => {
  try {
    const { to, subject, body, cc } = req.body || {};
    if (!to) return res.status(400).json({ message: "to is required" });
    if (!subject) return res.status(400).json({ message: "subject is required" });
    if (!body) return res.status(400).json({ message: "body is required" });

    const broker = process.env.BROKER_EMAIL || "";
    const ccList = [cc, broker].filter(Boolean).join(",");

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      cc: ccList || undefined,
      subject,
      text: body, // plain text (best for your confirmation note)
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: e?.message || "Email failed" });
  }
});

module.exports = router;