import { NavLink } from "react-router-dom";

const items = [
  { label: "1 : Backup", to: "/maintenance/backup" },
  { label: "2 : Change Password", to: "/maintenance/change-password" },
  { label: "3 : Company Details", to: "/maintenance/company-details" },
  { label: "4 : SMS / e-Mail Settings", to: "/maintenance/sms-email-settings" },
  { label: "5 : Clear Database", to: "/maintenance/clear-database" },
];

export default function MaintenanceRightMenu() {
  // screenshot shows many empty slots — we keep the panel tall with blanks
  const blankCount = 18;

  return (
    <div style={panel}>
      <div style={stack}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            style={({ isActive }) => ({
              ...btn,
              ...(isActive ? btnActive : null),
            })}
          >
            {it.label}
          </NavLink>
        ))}

        <button
          style={btn}
          onClick={() => window.close()} // browser may block, but matches legacy "Exit"
        >
          Exit
        </button>

        {Array.from({ length: blankCount }).map((_, i) => (
          <div key={i} style={blank} />
        ))}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  width: 240,
  background: "#e6dfcf", // beige panel like old Win apps
  borderLeft: "1px solid #7f7a70",
  padding: 6,
};

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const btn: React.CSSProperties = {
  height: 28,
  display: "flex",
  alignItems: "center",
  padding: "0 8px",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
  color: "#1b1b1b",
  background: "#e8e1d2",
  borderTop: "1px solid #ffffff",      // bevel (top/left light)
  borderLeft: "1px solid #ffffff",
  borderRight: "1px solid #6e6a61",    // bevel (bottom/right dark)
  borderBottom: "1px solid #6e6a61",
  cursor: "pointer",
};

const btnActive: React.CSSProperties = {
  background: "#dcd3bf",
  borderTop: "1px solid #6e6a61",      // pressed bevel
  borderLeft: "1px solid #6e6a61",
  borderRight: "1px solid #ffffff",
  borderBottom: "1px solid #ffffff",
};

const blank: React.CSSProperties = {
  height: 24,
  background: "#e8e1d2",
  borderTop: "1px solid #ffffff",
  borderLeft: "1px solid #ffffff",
  borderRight: "1px solid #6e6a61",
  borderBottom: "1px solid #6e6a61",
};
