import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Lock, User, AlertCircle, ChevronLeft } from "lucide-react";

export default function LoginPage() {
  const { login, loginError, language, toggleLanguage, t } = useApp();
  const [employeeId, setEmployeeId]   = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 600)); // simulate async
    login(employeeId.trim().toUpperCase(), password);
    setLoading(false);
  };

  const isRtl = language === "ar";

  return (
    <div className="login-page">
      {/* Top language switch on login page */}
      <div style={{ position: "absolute", top: 20, right: 20, left: 20, display: "flex", justifyContent: isRtl ? "flex-end" : "flex-start" }}>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={toggleLanguage} 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 6, 
            fontSize: "0.85rem", 
            fontWeight: 800, 
            color: "var(--accent)",
            background: "rgba(255, 255, 255, 0.9)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer"
          }}
        >
          🌐 {isRtl ? "English" : "العربية"}
        </button>
      </div>

      <div className="login-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="ECTRON Logo" style={{ height: "64px", objectFit: "contain" }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: 6 }}>{t("brandName")}</h1>
          <p style={{ fontSize: "0.9rem" }}>{t("subBrandName")}</p>
        </div>

        {/* Error */}
        {loginError && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t("loginError")}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="input-group">
            <label className="input-label">{t("employeeId")}</label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{
                position: "absolute", 
                right: isRtl ? 14 : "auto", 
                left: !isRtl ? 14 : "auto", 
                top: "50%", 
                transform: "translateY(-50%)",
                color: "var(--text-muted)", 
                pointerEvents: "none"
              }} />
              <input
                className="input input-lg"
                style={{ 
                  paddingRight: isRtl ? 40 : 12, 
                  paddingLeft: !isRtl ? 40 : 12 
                }}
                placeholder="EMP-001"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">{t("password")}</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{
                position: "absolute", 
                right: isRtl ? 14 : "auto", 
                left: !isRtl ? 14 : "auto", 
                top: "50%", 
                transform: "translateY(-50%)",
                color: "var(--text-muted)", 
                pointerEvents: "none"
              }} />
              <input
                className="input input-lg"
                style={{ 
                  paddingRight: isRtl ? 40 : 12, 
                  paddingLeft: !isRtl ? 40 : 12 
                }}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: "absolute", 
                  left: isRtl ? 12 : "auto", 
                  right: !isRtl ? 12 : "auto", 
                  top: "50%", 
                  transform: "translateY(-50%)",
                  background: "none", 
                  border: "none", 
                  cursor: "pointer",
                  color: "var(--text-muted)", 
                  fontSize: "0.75rem"
                }}
              >
                {showPassword ? (isRtl ? "إخفاء" : "Hide") : (isRtl ? "إظهار" : "Show")}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : null}
            {loading ? (isRtl ? "جارٍ الدخول..." : "Logging in...") : t("loginBtn")}
            {!loading && <ChevronLeft size={18} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />}
          </button>
        </form>
      </div>
    </div>
  );
}
