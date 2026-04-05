import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Login from "./pages/Login";

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
import TransactionsReport from "./pages/transactions/TransactionsReport";
import DayWiseReport from "./pages/reports/DayWiseReport";
import CompanyDetails from "./pages/maintenance/CompanyDetails";
import Backup from "./pages/maintenance/Backup";




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

function isAuthenticated() {
  return localStorage.getItem("isAuthenticated") === "true";
}

function RequireAuth() {
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  return isAuthenticated() ? <Navigate to="/master/clients" replace /> : <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/master/clients" replace />} />

            <Route path="/master" element={<Navigate to="/master/clients" replace />} />
            <Route path="/transactions" element={<Navigate to="/transactions/entry" replace />} />
            <Route path="/reports" element={<Navigate to="/reports/day-wise" replace />} />
            <Route path="/maintenance" element={<Navigate to="/maintenance/backup" replace />} />

            <Route path="/master/clients" element={<Clients />} />
            <Route path="/master/items" element={<Items />} />
            <Route path="/master/qty-types" element={<QtyTypes />} />
            <Route path="/master/rate-per-unit" element={<RatePerUnit />} />
            <Route path="/master/delivery-places" element={<DeliveryPlaces />} />
            <Route path="/master/payment-types" element={<PaymentTypes />} />
            <Route path="/master/flags" element={<Flags />} />

            <Route path="/transactions" element={<Navigate to="/transactions/entry" />} />
            <Route path="/transactions/*" element={<TransactionsShell />}>
              <Route path="entry" element={<TransactionsEntry />} />
              <Route path="find" element={<TransactionsFind />} />
              <Route path="report/:id" element={<TransactionsReport />} />
            </Route>

            <Route path="/reports/day-wise" element={<DayWiseReport />} />
            <Route path="/reports/bill" element={<P title="Bill (Main Report)" />} />

            <Route path="/maintenance/backup" element={<Backup />} />
            <Route path="/maintenance/change-password" element={<P title="Change Password" />} />
            <Route path="/maintenance/company-details" element={<CompanyDetails />} />
            <Route path="/maintenance/sms-email-settings" element={<P title="SMS / e-Mail Settings" />} />
            <Route path="/maintenance/clear-database" element={<P title="Clear Database" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
            
    </BrowserRouter>
  );
}
