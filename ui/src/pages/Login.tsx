import React from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [userId, setUserId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== "SUCCESS") {
        setError(data.message || "Invalid credentials");
        return;
      }

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("loggedInUser", JSON.stringify(data.user || {}));

      navigate("/master/clients", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Unable to login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <form style={card} onSubmit={handleLogin}>
        <div style={title}>Broker App Login</div>

        <div style={fieldWrap}>
          <label style={label}>User ID</label>
          <input
            style={input}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user id"
            autoComplete="username"
          />
        </div>

        <div style={fieldWrap}>
          <label style={label}>Password</label>
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <button style={button} type="submit" disabled={loading}>
          {loading ? "Signing In..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eef2f7",
  padding: 24,
  boxSizing: "border-box",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  background: "#1f2a3a",
  borderRadius: 20,
  padding: "36px 32px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  boxSizing: "border-box",
};

const title: React.CSSProperties = {
  color: "#fff",
  fontSize: 34,
  fontWeight: 700,
  marginBottom: 36,
  textAlign: "center",
};

const fieldWrap: React.CSSProperties = {
  marginBottom: 24,
};

const label: React.CSSProperties = {
  display: "block",
  color: "#ffd400",
  marginBottom: 10,
  fontWeight: 700,
  fontSize: 18,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 14,
  border: "2px solid #d9dee7",
  padding: "0 18px",
  fontSize: 16,
  boxSizing: "border-box",
  outline: "none",
};

const button: React.CSSProperties = {
  width: "100%",
  height: 54,
  borderRadius: 14,
  border: "1px solid #b0b8c4",
  background: "#e6a1a1",
  fontWeight: 700,
  fontSize: 18,
  cursor: "pointer",
  marginTop: 8,
};

const errorStyle: React.CSSProperties = {
  color: "#fecaca",
  marginBottom: 12,
  fontSize: 13,
  textAlign: "center",
};