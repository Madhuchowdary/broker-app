import React from "react";

export default function Backup() {
  const [file, setFile] = React.useState<File | null>(null);
  const [loadingAction, setLoadingAction] = React.useState<"" | "backup" | "restore" | "clear">("");
  const [message, setMessage] = React.useState("");

  async function backupData() {
    try {
      const res = await fetch("/api/maintenance/backup");
      if (!res.ok) {
        alert("Backup failed");
        return;
      }

      const blob = await res.blob();

      // 👇 open save dialog
      const handle = await window.showSaveFilePicker({
        suggestedName: "backup.zip",
        types: [
          {
            description: "ZIP file",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      alert("Backup saved successfully");
    } catch (e) {
      console.error(e);
      alert("Backup failed");
    }
  }

  async function restoreData() {
    if (!file) {
      setMessage("Please choose a backup ZIP file first.");
      return;
    }

    const ok = window.confirm(
      "This will clear current data and restore from the selected backup file. Continue?"
    );
    if (!ok) return;

    try {
      setLoadingAction("restore");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/maintenance/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.message || "Restore failed.");
        return;
      }

      setMessage(data?.message || "Restore completed successfully.");
      setFile(null);
    } catch (e) {
      console.error(e);
      setMessage("Restore failed.");
    } finally {
      setLoadingAction("");
    }
  }

  async function clearDatabase() {
    const ok = window.confirm(
      "This will erase all data and reset serial numbers to start from 1. Continue?"
    );
    if (!ok) return;

    try {
      setLoadingAction("clear");
      setMessage("");

      const res = await fetch("/api/maintenance/clear-database", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.message || "Clear database failed.");
        return;
      }

      setMessage(data?.message || "Database cleared successfully.");
    } catch (e) {
      console.error(e);
      setMessage("Clear database failed.");
    } finally {
      setLoadingAction("");
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>Backup / Restore</h1>
        <p style={subtitle}>
          Backup takes data from financial year start (April 1) to current date and downloads a restore-ready ZIP file.
        </p>

        <div style={section}>
          <div style={sectionTitle}>1. Backup Data</div>
          <div style={sectionText}>
            Download a ZIP backup from April 1 of the current financial year up to today.
          </div>
          <button
            style={{ ...primaryBtn, opacity: loadingAction ? 0.7 : 1 }}
            onClick={backupData}
            disabled={!!loadingAction}
          >
            {loadingAction === "backup" ? "Preparing Backup..." : "Download Backup"}
          </button>
        </div>

        <div style={divider} />

        <div style={section}>
          <div style={sectionTitle}>2. Restore Data</div>
          <div style={sectionText}>
            Upload a previously downloaded ZIP backup file to restore data into the application.
          </div>

          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={fileInput}
          />

          {file ? <div style={fileName}>Selected: {file.name}</div> : null}

          <button
            style={{
              ...primaryBtn,
              opacity: loadingAction || !file ? 0.7 : 1,
              cursor: loadingAction || !file ? "not-allowed" : "pointer",
            }}
            onClick={restoreData}
            disabled={!!loadingAction || !file}
          >
            {loadingAction === "restore" ? "Restoring..." : "Restore Backup"}
          </button>
        </div>

        <div style={divider} />

        <div style={section}>
          <div style={sectionTitle}>3. Clear Database</div>
          <div style={warningText}>
            This removes only data, not table structure. After clearing, serial numbers start again from 1.
          </div>

          <button
            style={{
              ...dangerBtn,
              opacity: loadingAction ? 0.7 : 1,
            }}
            onClick={clearDatabase}
            disabled={!!loadingAction}
          >
            {loadingAction === "clear" ? "Clearing..." : "Clear Database"}
          </button>
        </div>

        {message ? <div style={messageBox}>{message}</div> : null}
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
  maxWidth: 860,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color: "#24364b",
};

const subtitle: React.CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.6,
};

const section: React.CSSProperties = {
  marginTop: 22,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 18,
  color: "#24364b",
  marginBottom: 8,
};

const sectionText: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 14,
};

const warningText: React.CSSProperties = {
  color: "#b91c1c",
  marginBottom: 14,
};

const fileInput: React.CSSProperties = {
  marginBottom: 10,
};

const fileName: React.CSSProperties = {
  marginBottom: 12,
  color: "#334155",
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  height: 42,
  padding: "0 18px",
  borderRadius: 12,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  height: 42,
  padding: "0 18px",
  borderRadius: 12,
  border: "1px solid #ef4444",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const divider: React.CSSProperties = {
  marginTop: 24,
  borderTop: "1px solid #e2e8f0",
};

const messageBox: React.CSSProperties = {
  marginTop: 22,
  padding: "12px 14px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #dbe4ee",
  color: "#334155",
  fontWeight: 600,
};