import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Lock, AlertCircle, CheckCircle, Key, ChevronLeft } from "lucide-react";

export default function ForceChangePassword() {
  const { currentUser, changePassword, logout, language, toggleLanguage, t } = useApp();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isRtl = language === "ar";

  // Password rules validation
  const isLengthValid = newPassword.length >= 4;
  const isDigitsOnly = /^\d+$/.test(newPassword);
  const doPasswordsMatch = newPassword === confirmPassword && confirmPassword !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Final checks
    if (!isLengthValid) {
      setError(t("passwordLengthError"));
      return;
    }
    if (!isDigitsOnly) {
      setError(t("passwordDigitsOnlyError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordMatchError"));
      return;
    }

    setLoading(true);
    // Add small visual delay for smooth premium experience
    await new Promise((r) => setTimeout(r, 800));

    const res = await changePassword(currentUser.employee_id, newPassword);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.message || "Failed to update password. Please try again.");
    }
  };

  return (
    <div className="login-page">
      {/* Top action buttons: Language Switch and Logout */}
      <div 
        style={{ 
          position: "absolute", 
          top: 20, 
          right: 20, 
          left: 20, 
          display: "flex", 
          justifyContent: "space-between",
          flexDirection: isRtl ? "row-reverse" : "row"
        }}
      >
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={logout}
          style={{ 
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          {isRtl ? "تسجيل الخروج" : "Logout"}
        </button>

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

      <div className="login-card" style={{ maxWidth: 460 }}>
        {/* Logo / Icon */}
        <div className="login-logo" style={{ background: "linear-gradient(135deg, var(--red), var(--purple))", boxShadow: "0 8px 24px rgba(207,34,46,0.25)" }}>
          <Key size={30} style={{ color: "#fff" }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 8, color: "var(--text-primary)" }}>
            {t("forcePasswordChangeTitle")}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {t("forcePasswordChangeDesc")}
          </p>
        </div>

        {/* User Context Info Card */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: "var(--radius-md)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          marginBottom: 20,
          flexDirection: isRtl ? "row" : "row-reverse",
          textAlign: isRtl ? "right" : "left"
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#0550ae,#1a7f37)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: "0.85rem"
          }}>
            {currentUser?.full_name?.split(" ").slice(0,2).map(w=>w[0]).join("")}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{currentUser?.full_name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{currentUser?.employee_id}</div>
          </div>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="alert alert-success animate-fade" style={{ marginBottom: 20 }}>
            <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t("passwordChangedSuccess")}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error animate-fade" style={{ marginBottom: 20 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* New Password */}
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                {t("newPasswordLabel")}
              </label>
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
                  type="password"
                  style={{ 
                    paddingRight: isRtl ? 40 : 12, 
                    paddingLeft: !isRtl ? 40 : 12,
                    textAlign: isRtl ? "right" : "left"
                  }}
                  placeholder="••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value.replace(/\D/g, ""))} // Only allow typing digits
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                {t("confirmPasswordLabel")}
              </label>
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
                  type="password"
                  style={{ 
                    paddingRight: isRtl ? 40 : 12, 
                    paddingLeft: !isRtl ? 40 : 12,
                    textAlign: isRtl ? "right" : "left"
                  }}
                  placeholder="••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, ""))}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Micro-validation feedback list */}
            <div style={{
              background: "var(--bg-elevated)",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: "0.8rem",
              textAlign: isRtl ? "right" : "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse", color: isLengthValid ? "var(--accent)" : "var(--text-muted)" }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>{isLengthValid ? "✓" : "○"}</span>
                <span>{isRtl ? "4 أرقام على الأقل" : "At least 4 digits"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse", color: (newPassword.length > 0 && isDigitsOnly) ? "var(--accent)" : "var(--text-muted)" }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>{(newPassword.length > 0 && isDigitsOnly) ? "✓" : "○"}</span>
                <span>{isRtl ? "أرقام فقط (بدون حروف أو رموز)" : "Numbers only (no letters or symbols)"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse", color: doPasswordsMatch ? "var(--accent)" : "var(--text-muted)" }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>{doPasswordsMatch ? "✓" : "○"}</span>
                <span>{isRtl ? "تطابق كلمتي المرور" : "Passwords match"}</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || !isLengthValid || !isDigitsOnly || !doPasswordsMatch}
              style={{ marginTop: 8 }}
            >
              {loading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : null}
              {loading ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : t("saveNewPasswordBtn")}
              {!loading && <ChevronLeft size={18} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
