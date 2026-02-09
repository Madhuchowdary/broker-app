import { NavLink, Outlet, useLocation } from "react-router-dom";
import MaintenanceRightMenu from "../components/MaintenanceRightMenu";


type TopKey = "master" | "transactions" | "reports" | "maintenance";

const topMenu: { key: TopKey; label: string; base: string }[] = [
  { key: "master", label: "Master", base: "/master" },
  { key: "transactions", label: "Transactions", base: "/transactions" },
  { key: "reports", label: "Reports", base: "/reports" },
  { key: "maintenance", label: "Maintenance", base: "/maintenance" },
];

const subTabs: Record<TopKey, { label: string; path: string }[]> = {
  master: [
    { label: "Client Details", path: "/master/clients" },
    { label: "Item Details", path: "/master/items" },
    { label: "Quantity Types", path: "/master/qty-types" },
    { label: "Rate Per Unit", path: "/master/rate-per-unit" },
    { label: "Delivery Places", path: "/master/delivery-places" },
    { label: "Payment Types", path: "/master/payment-types" },
    { label: "Flag", path: "/master/flags" },
  ],
  transactions: [

  ],
  // NOTE: not used for rendering now because Reports uses right-side menu (like your screenshot)
  reports: [],
  maintenance: [
   
  ],
};

const reportsMenu: { label: string; path: string }[] = [
  { label: "1 : Day Wise Report", path: "/reports/day-wise" },
  { label: "2 : Item Wise Report", path: "/reports/item-wise" },
  { label: "3 : Client Wise Report", path: "/reports/client-wise-report" },
  { label: "4 : Client Wise Abstract", path: "/reports/client-wise-abstract" },
];

function getActiveTop(pathname: string): TopKey {
  if (pathname.startsWith("/transactions")) return "transactions";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/maintenance")) return "maintenance";
  return "master";
}

export default function MainLayout() {
  const loc = useLocation();
  const activeTop = getActiveTop(loc.pathname);
  const isReports = activeTop === "reports";
  const isMaintenance = activeTop === "maintenance";


  return (
    <div style={shell}>
      {/* Top Main Menu */}
      <div style={topBar}>
        <div style={appTitle}>AMRIT</div>

        <div style={topMenuRow}>
          {topMenu.map((m) => (
            <NavLink
              key={m.key}
              to={m.base}
              style={({ isActive }) => ({
                ...topItem,
                ...(isActive || activeTop === m.key ? topItemActive : null),
              })}
            >
              {m.label}
            </NavLink>
          ))}
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button
            style={exitBtn}
            onClick={() => window.close()} // browser may block; still ok
            title="Exit"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Second-level tabs (hide for Reports; Reports uses right-side menu like the legacy UI) */}
      {!isReports  && !isMaintenance && activeTop !== "transactions" && (
        <div style={tabsBar}>
          {subTabs[activeTop].map((t) => (
            <NavLink
              key={t.path}
              to={t.path}
              style={({ isActive }) => ({
                ...tab,
                ...(isActive ? tabActive : null),
              })}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}


      {/* Content */}
      {isReports ? (
        <div style={reportsShell}>
          {/* Left big blank area */}
          <div style={reportsLeft}>
            <Outlet />
          </div>

          {/* Right legacy button column */}
          <div style={reportsRight}>
            <div style={reportsBtnCol}>
              {reportsMenu.map((r) => (
                <NavLink
                  key={r.path}
                  to={r.path}
                  style={({ isActive }) => ({
                    ...reportsBtn,
                    ...(isActive ? reportsBtnActive : null),
                  })}
                >
                  {r.label}
                </NavLink>
              ))}

              <button
                style={{ ...reportsBtn, marginTop: 10 }}
                onClick={() => window.close()}
                title="Exit"
              >
                Exit
              </button>

              <div style={{ height: 10 }} />
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={reportsEmptySlot} />
              ))}
            </div>
          </div>
        </div>
      ) : isMaintenance ? (
        <div style={maintenanceShell}>
          <div style={maintenanceLeft}>
            <Outlet />
          </div>

          <div style={maintenanceRight}>
            <MaintenanceRightMenu />
          </div>
        </div>
      ) : (
        <div style={content}>
          <Outlet />
        </div>
      )}


    </div>
  );
}

/* styles */
const shell: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#eef2f7",
};

const topBar: React.CSSProperties = {
  height: 52,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "0 14px",
  background: "#e9edf5",
  borderBottom: "1px solid #cfd8e3",
};

const appTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f2a44",
};

const topMenuRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
};

const topItem: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "#1f2a44",
  fontWeight: 700,
};

const topItemActive: React.CSSProperties = {
  background: "#d9e3ff",
  border: "1px solid #b8c7ff",
};

const exitBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cfd8e3",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const tabsBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "10px 14px",
  background: "#f7f9fc",
  borderBottom: "1px solid #cfd8e3",
  overflowX: "auto",
};

const tab: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#334155",
  fontWeight: 700,
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const tabActive: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cfd8e3",
  boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
};

const content: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 14,
};

/* Reports layout (legacy look) */
const reportsShell: React.CSSProperties = {
  flex: 1,
  display: "flex",
  minHeight: 0,
  background: "#eef2f7",
};

const reportsLeft: React.CSSProperties = {
  flex: 1,
  padding: 12,
  minWidth: 0,
};

const reportsRight: React.CSSProperties = {
  width: 260,
  padding: 12,
  borderLeft: "1px solid #cfd8e3",
  background: "#eef2f7",
};

const reportsBtnCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const reportsBtn: React.CSSProperties = {
  display: "block",
  padding: "10px 10px",
  borderRadius: 2,
  border: "1px solid #b7c3d3",
  background: "#f2f2f2",
  color: "#1f2a44",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
};

const reportsBtnActive: React.CSSProperties = {
  background: "#e3ebff",
  border: "1px solid #8ea7e8",
};

const reportsEmptySlot: React.CSSProperties = {
  height: 28,
  borderRadius: 2,
  border: "1px solid #cfd8e3",
  background: "#f7f9fc",
};

/* Maintenance layout (legacy look) */
const maintenanceShell: React.CSSProperties = {
  flex: 1,
  display: "flex",
  minHeight: 0,
  background: "#eef2f7",
};

const maintenanceLeft: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "#6f7f98", // bluish blank area like screenshot
  padding: 12,
};

const maintenanceRight: React.CSSProperties = {
  width: 260,
  padding: 12,
  borderLeft: "1px solid #cfd8e3",
  background: "#eef2f7",
};

