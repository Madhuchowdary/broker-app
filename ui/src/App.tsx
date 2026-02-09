import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

// Your real page
import Clients from "./pages/Clients";
import Items from "./pages/ItemTypes";
import QtyTypes from "./pages/QtyTypes";
import RatePerUnit from "./pages/RatePerUnit";
import DeliveryPlaces from "./pages/DeliveryPlaces";

import TransactionsShell from "./pages/transactions/TransactionsShell";
import TransactionsEntry from "./pages/transactions/TransactionsEntry";
import TransactionsFind from "./pages/transactions/TransactionsFind";
import PaymentTypes from "./pages/PaymentTypes";
import Flags from "./pages/Flags";




// Temporary placeholders
const P = ({ title }: { title: string }) => (
  <div
    style={{
      padding: 16,
      background: "white",
      borderRadius: 12,
      border: "1px solid #dbe4f0",
      minHeight: 300,
    }}
  >
    <h2 style={{ margin: 0 }}>{title}</h2>
    <div style={{ marginTop: 8, color: "#64748b" }}>Coming next…</div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* default */}
          <Route path="/" element={<Navigate to="/master/clients" />} />

          {/* top menu bases */}
          <Route path="/master" element={<Navigate to="/master/clients" />} />
          <Route path="/transactions" element={<Navigate to="/transactions/entry" />} />
          <Route path="/reports" element={<Navigate to="/reports/day-wise" />} />
          <Route path="/maintenance" element={<Navigate to="/maintenance/backup" replace />} />

          {/* MASTER tabs */}
          <Route path="/master/clients" element={<Clients />} />
          <Route path="/master/items" element={<Items />} />
          <Route path="/master/qty-types" element={<QtyTypes />} />

          <Route path="/master/rate-per-unit" element={<RatePerUnit />} />
  
         <Route path="/master/delivery-places" element={<DeliveryPlaces />} />


          <Route path="/master/payment-types" element={<PaymentTypes />} />
          <Route path="/master/flags" element={<Flags />} />

          {/* TRANSACTIONS tabs */}
          <Route path="/transactions" element={<Navigate to="/transactions/entry" />} />
          <Route path="/transactions/*" element={<TransactionsShell />}>
            <Route path="entry" element={<TransactionsEntry />} />
            <Route path="find" element={<TransactionsFind />} />
          </Route>


          {/* REPORTS (right-side legacy menu) */}
          <Route path="/reports/day-wise" element={<P title="Day Wise Report" />} />
          <Route path="/reports/item-wise" element={<P title="Item Wise Report" />} />
          <Route path="/reports/client-wise-report" element={<P title="Client Wise Report" />} />
          <Route path="/reports/client-wise-abstract" element={<P title="Client Wise Abstract" />} />

          {/* If you still want Bill later keep it, else remove */}
          <Route path="/reports/bill" element={<P title="Bill (Main Report)" />} />

          {/* MAINTENANCE tabs */}
          // MAINTENANCE pages (right menu)
          <Route path="/maintenance/backup" element={<P title="Backup" />} />
          <Route path="/maintenance/change-password" element={<P title="Change Password" />} />
          <Route path="/maintenance/company-details" element={<P title="Company Details" />} />
          <Route path="/maintenance/sms-email-settings" element={<P title="SMS / e-Mail Settings" />} />
          <Route path="/maintenance/clear-database" element={<P title="Clear Database" />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}
