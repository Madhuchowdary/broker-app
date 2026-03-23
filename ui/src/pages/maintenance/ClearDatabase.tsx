import React from "react";

export default function ClearDatabase() {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");

  async function clearDatabase() {
    if (confirmText.trim().toUpperCase() !== "CLEAR") {
      setMessage('Type "CLEAR" to confirm.');
      return;
    }

    const ok = window.confirm(
      "This will remove all transaction and master data. Are you sure?"
    );
    if (!ok) return;

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/maintenance/clear-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data?.message || "Failed to clear database.");
        return;
      }

      setMessage("Database cleared successfully.");
      setConfirmText("");
    } catch (e) {
      console.error(e);
      setMessage("Failed to clear database.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>Clear Database</h1>
        <p style={subtitle}>
          This action will permanently remove all saved records from the system.
        </p>

        <div style={warningBox}>
          <div style={warningTitle}>Warning</div>
          <div style={warningText}>
            This action cannot be undone. Before clearing data, make sure you
            already downloaded a backup/restore file if needed.
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={label}>
            Type <b>CLEAR</b> to confirm
          </label>
          <input
            style={input}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "CLEAR"'
          />
        </div>

        <div style={actions}>
          <button
            style={{
              ...dangerBtn,
              opacity:
                loading || confirmText.trim().toUpperCase() !== "CLEAR" ? 0.6 : 1,
              cursor:
                loading || confirmText.trim().toUpperCase() !== "CLEAR"
                  ? "not-allowed"
                  : "pointer",
            }}
            disabled={loading || confirmText.trim().toUpperCase() !== "CLEAR"}
            onClick={clearDatabase}
          >
            {loading ? "Clearing..." : "Clear Database"}
          </button>
        </div>

        {message ? (
          <div
            style={{
              ...msg,
              color: message.toLowerCase().includes("success") ? "#166534" : "#b91c1c",
            }}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: 20,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dee8",
  borderRadius: 18,
  padding: 24,
  maxWidth: 760,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#24364b",
};

const subtitle: React.CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  fontSize: 16,
};

const warningBox: React.CSSProperties = {
  marginTop: 20,
  border: "1px solid #fecaca",
  background: "#fff5f5",
  borderRadius: 14,
  padding: 16,
};

const warningTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#b91c1c",
  marginBottom: 8,
};

const warningText: React.CSSProperties = {
  color: "#7f1d1d",
  lineHeight: 1.5,
};

const fieldWrap: React.CSSProperties = {
  marginTop: 22,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontWeight: 700,
  color: "#334155",
};

const input: React.CSSProperties = {
  width: "100%",
  maxWidth: 320,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  fontSize: 15,
};

const actions: React.CSSProperties = {
  marginTop: 20,
};

const dangerBtn: React.CSSProperties = {
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  border: "1px solid #ef4444",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 700,
};

const msg: React.CSSProperties = {
  marginTop: 18,
  fontWeight: 700,
};