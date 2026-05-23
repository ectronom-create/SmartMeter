import { useApp } from "../context/AppContext";
import { 
  Users, AlertTriangle, CheckCircle, Clock, 
  ArrowRight, Layers, ExternalLink, Info, BookOpen, ClipboardList
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const stageNames = {
  "STG-01": "Assembly", "STG-02": "Insulation",
  "STG-03": "Radio Frequency", "STG-04": "Calibration", "STG-05": "Multi Test", "STG-06": "Perso"
};

export default function SupervisorPage() {
  const navigate = useNavigate();
  const { 
    schedules, production_stages, getScheduleWithDetails, 
    defectiveMeters, updateMeterStatus, getTodayString, currentShift,
    language, t
  } = useApp();

  const isRtl = language === "ar";
  const today = getTodayString();

  // Filter current shift schedules
  const activeAssignments = schedules.filter(s => 
    s.schedule_date === today && s.shift_id === currentShift?.shift_id
  ).map(s => getScheduleWithDetails(s));

  // Defects summary
  const pendingDefects = defectiveMeters.filter(m => m.status === "reported");
  const verifiedDefects = defectiveMeters.filter(m => m.status === "verified");

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Header */}
        <div className="supervisor-header">
          <div className="supervisor-title-section">
            <h1 className="supervisor-title">{isRtl ? "لوحة إشراف الإنتاج" : "Production Supervision Panel"}</h1>
            <div className="supervisor-meta-pill">
              <span>{isRtl ? "شفت" : "Shift"} {currentShift?.name}</span>
              <span className="supervisor-meta-divider">·</span>
              <span>{today}</span>
              <span className="supervisor-meta-divider">·</span>
              <span>{isRtl ? "إشراف مباشر على خط الإنتاج" : "Direct line supervision"}</span>
            </div>
          </div>
          <div className="supervisor-actions-grid">
            <button className="btn btn-primary" onClick={() => navigate("/start-production")} style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", border: "none" }}>
              <ClipboardList size={16} /> {isRtl ? "تحقق بداية الإنتاج (SOP)" : "Start of Production (SOP)"}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/defects")}>
              <ExternalLink size={16} /> {isRtl ? "إدارة العدادات المعطوبة" : "Defect Management"}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/knowledge")}>
              <BookOpen size={16} /> {t("faultGuide")}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
              <ArrowRight size={16} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للرئيسية" : "Back to Home"}
            </button>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="grid-4 stagger">
          <div className="stat-card animate-fade">
            <div className="stat-icon" style={{ background: "rgba(99,102,241,0.1)" }}><Users size={20} color="var(--accent)" /></div>
            <div>
              <div className="stat-value">{activeAssignments.length}</div>
              <div className="stat-label">{isRtl ? "موظف في الخط الآن" : "Operators On Line Now"}</div>
            </div>
          </div>
          <div className="stat-card animate-fade">
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.1)" }}><AlertTriangle size={20} color="var(--red)" /></div>
            <div>
              <div className="stat-value">{verifiedDefects.length}</div>
              <div className="stat-label">{isRtl ? "عدادات معطوبة مؤكدة" : "Confirmed Defective Meters"}</div>
            </div>
          </div>
          <div className="stat-card animate-fade">
            <div className="stat-icon" style={{ background: "rgba(245,158,11,0.1)" }}><Clock size={20} color="var(--amber)" /></div>
            <div>
              <div className="stat-value">{pendingDefects.length}</div>
              <div className="stat-label">{isRtl ? "بلاغات قيد الانتظار" : "Pending Floor Reports"}</div>
            </div>
          </div>
          <div className="stat-card animate-fade">
            <div className="stat-icon" style={{ background: "rgba(16,185,129,0.1)" }}><CheckCircle size={20} color="var(--green)" /></div>
            <div>
              <div className="stat-value">{defectiveMeters.filter(m => m.status === "resolved").length}</div>
              <div className="stat-label">{isRtl ? "عادت لخط الإنتاج" : "Returned to Line"}</div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          
          {/* Active Line Monitoring */}
          <div className="card animate-fade">
            <div className="card-header">
              <Layers size={18} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "توزيع الموظفين الحالي (Live)" : "Current Operator Distribution (Live)"}</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {production_stages.map(stage => {
                const workers = activeAssignments.filter(a => a.stage_id === stage.stage_id);
                return (
                  <div key={stage.stage_id} className="stage-assignment-row">
                    <div className="stage-assignment-icon">{stage.icon}</div>
                    <div className="stage-assignment-info">
                      <div className="stage-assignment-name">{stage.stage_name}</div>
                      <div className="stage-assignment-workers">
                        {workers.map(w => (
                          <span key={w.employee_id} className={`badge ${w.is_team_leader ? "badge-amber" : "badge-gray"}`} style={{ fontSize: "0.7rem" }}>
                            {w.is_team_leader && "⭐ "}{w.employee?.full_name.split(" ")[0]}
                          </span>
                        ))}
                        {workers.length === 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isRtl ? "لا يوجد موظفين" : "No operators assigned"}</span>}
                      </div>
                    </div>
                    <span className="badge badge-blue">{workers.length}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Defects — First Stage */}
          <div className="card animate-fade">
            <div className="card-header">
              <AlertTriangle size={18} style={{ color: "var(--amber)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "البلاغات الواردة من الخط" : "Incoming Floor Reports"}</h3>
              {pendingDefects.length > 0 && (
                <span className="badge badge-amber" style={isRtl ? { marginRight: "auto" } : { marginLeft: "auto" }}>
                  {pendingDefects.length} {isRtl ? "بلاغ" : "Reports"}
                </span>
              )}
            </div>

            {/* Process explanation */}
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <Info size={15} />
              <span style={{ fontSize: "0.82rem" }}>
                {isRtl 
                  ? "هذه البلاغات أُرسلت من الموظفين. دورك كمشرف هو الاطلاع عليها وإحالتها لصفحة العدادات المعطوبة حيث تتم المراجعة النهائية."
                  : "These reports were submitted by operators. Your role as supervisor is to review them and refer them to the Defective Meters page for final review."}
              </span>
            </div>

            {pendingDefects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <CheckCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p>{isRtl ? "لا توجد بلاغات معلقة حالياً" : "No pending reports at this time"}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingDefects.map(m => (
                  <div key={m.id} style={{ 
                    padding: 14, background: "var(--bg-elevated)", borderRadius: 12, 
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <code style={{ color: "var(--blue)", fontWeight: 700, fontSize: "0.9rem" }}>{m.serial_number}</code>
                      <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>{stageNames[m.stage_found] || m.stage_found}</span>
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                      <span style={{ fontWeight: 600 }}>{isRtl ? "كود العطل:" : "Fault Code:"}</span> {m.error_code || (isRtl ? "غير محدد" : "Not specified")}
                      <span style={{ margin: "0 8px", color: "var(--text-muted)" }}>
                        · {new Date(m.created_at).toLocaleTimeString(isRtl ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Primary: refer to pending (stays on page) */}
                      <button 
                        className="btn btn-primary btn-sm" 
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => updateMeterStatus(m.id, "pending")}
                      >
                        <CheckCircle size={14} /> {isRtl ? "إحالة للمراجعة النهائية" : "Refer to Final Review"}
                      </button>
                      {/* Bypass: resolve immediately if not a real defect */}
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ fontSize: "0.73rem", border: "1px dashed var(--border)", color: "var(--accent)", whiteSpace: "normal", textAlign: "center", lineHeight: "1.3", padding: "6px 8px" }}
                        onClick={() => updateMeterStatus(m.id, "resolved")}
                      >
                        ✓ {isRtl ? "إعادته للإنتاج فوراً (البلاغ غير صحيح)" : "Return to production line immediately (Incorrect report)"}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Shortcut to defects page */}
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                  onClick={() => navigate("/defects", { state: { openReview: true } })}
                >
                  <ExternalLink size={14} /> {isRtl ? "فتح صفحة إدارة العدادات المعطوبة" : "Open Defective Meters Management"}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

