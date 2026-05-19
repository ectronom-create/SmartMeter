import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LogOut, Shield, LayoutDashboard, BookOpen, Package } from "lucide-react";



export default function Topbar() {
  const { currentUser, logout, currentShift, language, toggleLanguage, t } = useApp();
  const navigate  = useNavigate();
  const location  = useLocation();

  const shiftStyles = {
    "SHIFT-M": { background: "#fff8c5", color: "#9a6700", border: "1px solid #d4a72c66" },
    "SHIFT-E": { background: "#f3e5f5", color: "#8250df", border: "1px solid #d2a8ff66" },
    "SHIFT-N": { background: "#ddf4ff", color: "#0550ae", border: "1px solid #54aeff66" },
  };

  const isAdmin = currentUser?.role === "admin";
  const isSupervisor = currentUser?.role === "supervisor";

  const getDashboardPath = () => {
    if (isAdmin) return "/admin";
    if (isSupervisor) return "/supervisor";
    return "/dashboard";
  };

  return (
    <nav className="topbar">
      {/* Brand */}
      <div className="topbar-logo" style={{ cursor: "pointer" }} onClick={() => navigate(getDashboardPath())}>
        <div className="topbar-logo-icon">⚡</div>
        <div>
          <div className="topbar-brand">{t("brandName")}</div>
          <div className="topbar-sub">{t("subBrandName")}</div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {/* Shift pill (non-admin) */}
        {currentUser && !isAdmin && currentShift && (
          <div className="shift-pill" style={shiftStyles[currentShift.shift_id] || {}}>
            {language === "ar" ? "شفت" : "Shift"} {currentShift.name} · {currentShift.start_time}–{currentShift.end_time}
          </div>
        )}

        {/* Roles badges */}
        {isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: "100px", background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc8066", fontSize: "0.8rem", fontWeight: 700 }}>
            <Shield size={13} /> {t("adminPanel")}
          </div>
        )}
        {isSupervisor && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: "100px", background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a766", fontSize: "0.8rem", fontWeight: 700 }}>
            <Shield size={13} /> {t("lineSupervisor")}
          </div>
        )}

        {/* Nav toggle buttons */}
        {isAdmin && location.pathname !== "/admin" && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/admin")}>
            <LayoutDashboard size={14} /> {t("adminPanel")}
          </button>
        )}
        {isSupervisor && location.pathname !== "/supervisor" && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/supervisor")}>
            <LayoutDashboard size={14} /> {t("supervisorPanel")}
          </button>
        )}

        {/* Assets / Inventory Shortcut (Admin Only) */}
        {isAdmin && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/assets")} title={t("equipmentManagement")}>
            <Package size={15} /> <span style={{ fontSize: "0.8rem" }}>{t("equipmentManagement")}</span>
          </button>
        )}

        {/* Knowledge Base Shortcut */}
        {!isSupervisor && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/knowledge")} title={t("faultGuide")}>
            <BookOpen size={15} /> <span style={{ fontSize: "0.8rem" }}>{t("faultGuide")}</span>
          </button>
        )}

        {/* Language Selection Toggle */}
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={toggleLanguage} 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 6, 
            fontSize: "0.85rem", 
            fontWeight: 800, 
            color: "var(--accent)",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "8px",
            padding: "5px 12px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          🌐 {language === "ar" ? "English" : "العربية"}
        </button>

        {/* User name */}
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: isAdmin ? "linear-gradient(135deg,#e65100,#ff8f00)" : "linear-gradient(135deg,#1a7f37,#0550ae)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: "0.72rem"
            }}>
              {currentUser.full_name.split(" ").slice(0,2).map(w=>w[0]).join("")}
            </div>
            {currentUser.full_name.split(" ")[0]}
          </div>
        )}

        {/* Logout */}
        {currentUser && (
          <button className="btn btn-ghost btn-sm btn-icon" onClick={logout} title={t("logOut")}>
            <LogOut size={15} />
          </button>
        )}
      </div>
    </nav>
  );
}
