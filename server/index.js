require("dotenv").config(); // ✅ first

process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

const express = require("express");
const cors = require("cors");

const clientsRouter = require("./routes/clients");
const deliveryPlacesRouter = require("./routes/delivery-places");
const paymentTypesRouter = require("./routes/payment-types");
const flagsRouter = require("./routes/flags");
const qtyTypesRouter = require("./routes/qty-types");
const ratePerUnitRouter = require("./routes/rate-per-unit");
const itemTypesRouter = require("./routes/itemTypes");
const transactionsRouter = require("./routes/transactions");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Broker app server running" });
});

app.use("/api/clients", clientsRouter);
//app.use("/api/transactions", transactionsRoutes);
app.use("/api/delivery-places", deliveryPlacesRouter);
app.use("/api/payment-types", paymentTypesRouter);
app.use("/api/flags", flagsRouter);
app.use("/api/qty-types", qtyTypesRouter);
app.use("/api/rate-per-unit", ratePerUnitRouter);
app.use("/api/item-types", itemTypesRouter);
app.use("/api/transactions", transactionsRouter);


const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
