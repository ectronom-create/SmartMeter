import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { 
  Users, AlertTriangle, CheckCircle, Clock, 
  ArrowRight, Layers, ExternalLink, Info, BookOpen, ClipboardList, Search, BarChart2, Wrench
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const getStageNameTranslated = (stageId) => {
  const names = {
    "STG-01": "Assembly", 
    "STG-02": "Insulation",
    "STG-03": "Radio Frequency", 
    "STG-04": "Calibration", 
    "STG-05": "Multi Test", 
    "STG-06": "Perso",
    "GLOBAL": "General"
  };
  return names[stageId] || stageId;
};

const downtimeReasons = {
  "BENCH_BREAKDOWN": { ar: "عطل البنش / صيانة", en: "Bench Breakdown / Maintenance" },
  "SFC_OFFLINE": { ar: "عطل شبكة / اتصال", en: "Network / IT Offline" },
  "MATERIAL_SHORTAGE": { ar: "نقص المواد (عدادات / شرائح)", en: "Material Shortage (Meters/SIM)" },
  "OPERATOR_ABSENCE": { ar: "غياب المشغل", en: "Operator Absence" },
  "OTHER": { ar: "أخرى (مكتوبة في الملاحظات)", en: "Other (written in notes)" }
};

export default function SupervisorPage() {
  const navigate = useNavigate();
  const { 
    schedules, production_stages, getScheduleWithDetails, 
    defectiveMeters, updateMeterStatus, getTodayString, currentShift,
    language, t,
    stoppages, reportStoppage, resumeProduction,
    materialConsumption, consumeMaterial, equipmentStock
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEduStage, setSelectedEduStage] = useState("STG-01");
  const [showEduModal, setShowEduModal] = useState(false);
  const isRtl = language === "ar";
  const today = getTodayString();

  // Downtime states
  const [stopStageId, setStopStageId] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [showStopModal, setShowStopModal] = useState(false);

  // Material states
  const [matId, setMatId] = useState("");
  const [matType, setMatType] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matNotes, setMatNotes] = useState("");
  const [matSuccessMsg, setMatSuccessMsg] = useState("");

  const handleReportStoppage = async (e) => {
    e.preventDefault();
    if (!stopStageId || !stopReason) return;
    const res = await reportStoppage(stopStageId, stopReason, stopNotes);
    if (res.success) {
      setShowStopModal(false);
      setStopStageId("");
      setStopReason("");
      setStopNotes("");
    } else {
      alert(res.message);
    }
  };

  const handleConsumeMaterial = async (e) => {
    e.preventDefault();
    if (!matId || !matType || !matQty) return;
    const res = await consumeMaterial(matId, matType, "STG-01", parseInt(matQty), matNotes);
    if (res.success) {
      setMatSuccessMsg(isRtl ? "تم سحب المواد وتحديث المستودع بنجاح!" : "Materials withdrawn and stock updated!");
      setMatId("");
      setMatType("");
      setMatQty("");
      setMatNotes("");
      setTimeout(() => setMatSuccessMsg(""), 3000);
    } else {
      alert(res.message);
    }
  };

  const getElapsedMinutes = (stoppedAt) => {
    const diff = Date.now() - new Date(stoppedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return isRtl ? "الآن" : "Just now";
    if (minutes < 60) return isRtl ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return isRtl 
      ? `منذ ${hours} س و ${remainingMins} د` 
      : `${hours}h ${remainingMins}m ago`;
  };

  // Filter current shift schedules
  const activeAssignments = schedules.filter(s => 
    s.schedule_date === today && s.shift_id === currentShift?.shift_id
  ).map(s => getScheduleWithDetails(s));

  // Defects summary
  const pendingDefects = defectiveMeters.filter(m => m.status === "pending");
  const verifiedDefects = defectiveMeters.filter(m => m.status === "verified");

  const filteredPendingDefects = useMemo(() => {
    if (!searchQuery.trim()) return pendingDefects;
    const q = searchQuery.toLowerCase().trim();
    return pendingDefects.filter(m => 
      m.serial_number.toLowerCase().includes(q) ||
      (m.error_code && m.error_code.toLowerCase().includes(q))
    );
  }, [pendingDefects, searchQuery]);

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Header */}
        <div className="supervisor-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16, flexWrap: "wrap", gap: 16 }}>
          <div className="supervisor-title-section">
            <h1 className="supervisor-title" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{isRtl ? "لوحة إشراف الإنتاج" : "Production Supervision Panel"}</h1>
            <div className="supervisor-meta-pill" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", color: "var(--text-secondary)", flexWrap: "wrap" }}>
              <span className="badge badge-amber">{isRtl ? "شفت" : "Shift"} {currentShift?.name}</span>
              <span className="supervisor-meta-divider">·</span>
              <span>{today}</span>
              <span className="supervisor-meta-divider">·</span>
              <span>{isRtl ? "إشراف مباشر على خط الإنتاج" : "Direct line supervision"}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <ArrowRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للرئيسية" : "Back to Home"}
          </button>
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

        {/* Supervisor Quick Navigation Panel */}
        <div className="animate-fade">
          <h3 style={{ marginBottom: 12, fontWeight: 800 }}>
            {isRtl ? "بوابات التحكم والمتابعة والتثقيف" : "Supervisor Control & Navigation Board"}
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: 16 
          }}>
            {/* 1. SOP */}
            <div className="card interactive" onClick={() => navigate("/start-production")} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(2,132,199,0.12)", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClipboardList size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.95rem" }}>
                  {isRtl ? "بداية الإنتاج (SOP)" : "Start of Production (SOP)"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "تحضير ومطابقة محطات العمل والخطوات" : "Verify workstation setup and sign reports."}
                </p>
              </div>
            </div>

            {/* 2. Defect Management */}
            <div className="card interactive" onClick={() => navigate("/defects")} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.12)", color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.95rem" }}>
                  {isRtl ? "إدارة المعطوبات" : "Defective Meters Manager"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "إحالة ومراجعة تقارير الأعطال والتأكيد" : "Review floor defects and verify repairs."}
                </p>
              </div>
            </div>

            {/* 3. FPY Dashboard */}
            <div className="card interactive" onClick={() => navigate("/fpy-overview")} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(130,80,223,0.12)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BarChart2 size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.95rem" }}>
                  {isRtl ? "لوحة مؤشرات FPY" : "Yield & Metrics Dashboard"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "متابعة كفاءة وجودة خط الإنتاج" : "Monitor First Pass Yield and line quality."}
                </p>
              </div>
            </div>

            {/* 4. Maintenance */}
            <div className="card interactive" onClick={() => navigate("/maintenance")} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(16,185,129,0.12)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wrench size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.95rem" }}>
                  {isRtl ? "مهام الصيانة" : "Maintenance Planner"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "إدارة وتتبع الصيانة الدورية للأجهزة" : "Track weekly schedules and device maintenance."}
                </p>
              </div>
            </div>

            {/* 5. Fault Guide */}
            <div className="card interactive" onClick={() => navigate("/knowledge")} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(245,158,11,0.12)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.95rem" }}>
                  {isRtl ? "دليل الأعطال الفنية" : "Fault Troubleshooting Guide"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "فهرس أكواد الخطأ وحلولها المعتمدة" : "Look up floor codes and quick solutions."}
                </p>
              </div>
            </div>

            {/* 6. Stations Educational Info */}
            <div className="card interactive" onClick={() => setShowEduModal(true)} style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center", border: "1px solid var(--accent)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Info size={22} />
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <h4 style={{ margin: "0 0 4px 0", fontWeight: 800, fontSize: "0.95rem", color: "var(--accent)" }}>
                  {isRtl ? "معلومات وتثقيف المحطات" : "Workstations Info & Training"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {isRtl ? "شرح خطوات العمل وأهميتها للتثقيف" : "General info, importance, and station duties."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          
          {/* Downtime Manager Card */}
          <div className="card animate-fade">
            <div className="card-header">
              <Clock size={18} style={{ color: "var(--red)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "إدارة توقفات الإنتاج (Downtime)" : "Production Downtime Manager"}</h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {production_stages.filter(s => s.stage_id !== "GLOBAL" && s.stage_id !== "SUPERVISION").map(stage => {
                // Find if this stage has an active stoppage (resumed_at is null)
                const activeStop = (stoppages || []).find(s => s.stage_id === stage.stage_id && !s.resumed_at);
                
                return (
                  <div key={stage.stage_id} style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    padding: 12, 
                    borderRadius: 12, 
                    border: `1px solid ${activeStop ? "var(--red)" : "var(--border-subtle)"}`, 
                    background: activeStop ? "rgba(239, 68, 68, 0.05)" : "var(--bg-elevated)",
                    flexDirection: isRtl ? "row" : "row-reverse"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                      <span style={{ fontSize: "1.4rem" }}>{stage.icon}</span>
                      <div style={{ textAlign: isRtl ? "right" : "left" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 6, flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <span>{isRtl ? stage.short_name : stage.stage_name.split("(")[0]}</span>
                          <span style={{ 
                            width: 8, height: 8, borderRadius: "50%", 
                            background: activeStop ? "var(--red)" : "var(--green)", 
                            display: "inline-block",
                            animation: activeStop ? "pulse 1.2s infinite" : "none"
                          }} />
                        </div>
                        {activeStop ? (
                          <div style={{ fontSize: "0.78rem", color: "var(--red)", fontWeight: 600, marginTop: 2 }}>
                            🔴 {downtimeReasons[activeStop.reason_code]?.[language] || activeStop.reason_code} ({getElapsedMinutes(activeStop.stopped_at)})
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            🟢 {isRtl ? "يعمل بشكل طبيعي" : "Running normally"}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {activeStop ? (
                        <button 
                          className="btn btn-sm" 
                          style={{ background: "var(--green)", color: "white", fontSize: "0.8rem", padding: "6px 12px" }}
                          onClick={() => resumeProduction(activeStop.id)}
                        >
                          {isRtl ? "استئناف العمل ✅" : "Resume Work ✅"}
                        </button>
                      ) : (
                        <button 
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                          onClick={() => {
                            setStopStageId(stage.stage_id);
                            setShowStopModal(true);
                          }}
                        >
                          ⚠️ {isRtl ? "تسجيل توقف" : "Stop Stage"}
                        </button>
                      )}
                    </div>
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
                {/* Search bar */}
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Search size={16} style={{
                    position: "absolute",
                    right: isRtl ? 12 : "auto",
                    left: !isRtl ? 12 : "auto",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)"
                  }} />
                  <input
                    type="text"
                    className="input"
                    style={{
                      paddingRight: isRtl ? 36 : 12,
                      paddingLeft: !isRtl ? 36 : 12,
                      fontSize: "0.85rem",
                      height: 36,
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                    placeholder={isRtl ? "ابحث برقم العداد أو كود العطل..." : "Search by serial number or fault code..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {filteredPendingDefects.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)" }}>
                    <Search size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
                    <p style={{ fontSize: "0.85rem" }}>{isRtl ? "لا توجد بلاغات مطابقة لبحثك" : "No matching reports found"}</p>
                  </div>
                ) : (
                  filteredPendingDefects.map(m => (
                    <div key={m.id} style={{ 
                      padding: 14, background: "var(--bg-elevated)", borderRadius: 12, 
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <code style={{ color: "var(--blue)", fontWeight: 700, fontSize: "0.9rem" }}>{m.serial_number}</code>
                        <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>{getStageNameTranslated(m.stage_found, isRtl)}</span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                        <span style={{ fontWeight: 600 }}>{isRtl ? "كود العطل:" : "Fault Code:"}</span> {m.error_code || (isRtl ? "غير محدد" : "Not specified")}
                        <span style={{ margin: "0 8px", color: "var(--text-muted)" }}>
                          · {new Date(m.created_at).toLocaleTimeString(isRtl ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {/* Primary: Verify Defect */}
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ width: "100%", justifyContent: "center" }}
                          onClick={() => updateMeterStatus(m.id, "verified")}
                        >
                          <CheckCircle size={14} /> {isRtl ? "تأكيد العطل (معطوب)" : "Confirm Defect (Verified)"}
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
                  ))
                )}

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

        {/* ======================= NEW ROW: MONITORING & MATERIAL CONSUMPTION ======================= */}
        <div className="grid-2" style={{ alignItems: "start" }}>
          
          {/* Active Line Monitoring */}
          <div className="card animate-fade">
            <div className="card-header">
              <Layers size={18} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "توزيع الموظفين الحالي (Live)" : "Current Operator Distribution (Live)"}</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {production_stages.filter(s => s.stage_id !== "GLOBAL").map(stage => {
                const workers = activeAssignments.filter(a => a.stage_id === stage.stage_id);
                return (
                  <div key={stage.stage_id} className="stage-assignment-row">
                    <div className="stage-assignment-icon">{stage.icon}</div>
                    <div className="stage-assignment-info">
                       <div className="stage-assignment-name">{stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name}</div>
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

          {/* Cut Meter Withdrawal Card */}
          <div className="card animate-fade">
            <div className="card-header">
              <Layers size={18} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "سحب المواد للإنتاج (عدادات وشرائح)" : "Material Consumption (Meters & SIMs)"}</h3>
            </div>
            
            {matSuccessMsg && (
              <div className="alert alert-success" style={{ marginBottom: 12 }}>
                ✓ {matSuccessMsg}
              </div>
            )}
            
            <form onSubmit={handleConsumeMaterial} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "اختر المادة" : "Select Material"}</label>
                <select 
                  className="input" 
                  value={matId} 
                  onChange={e => {
                    setMatId(e.target.value);
                    setMatType(""); // Reset type when material changes
                  }} 
                  required
                >
                  <option value="">-- {isRtl ? "اختر مادة من المستودع" : "Select from stock"} --</option>
                  {(equipmentStock || []).filter(e => e.category === "عدادات" || e.category === "شرائح").map(item => (
                    <option key={item.id} value={item.id} disabled={item.current_stock <= 0}>
                      {item.name} ({item.current_stock} {isRtl ? "متوفر" : "available"})
                    </option>
                  ))}
                  {(equipmentStock || []).filter(e => e.category === "عدادات" || e.category === "شرائح").length === 0 && (
                    <option disabled>{isRtl ? "لا توجد عدادات أو شرائح في المستودع. قم بتهيئتها من صفحة الأصول" : "No meters/SIMs. Configure in Assets page"}</option>
                  )}
                </select>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "النوع" : "Type"}</label>
                  {matId === 'METER-01' ? (
                    <select className="input" value={matType} onChange={e => setMatType(e.target.value)} required>
                      <option value="">-- {isRtl ? "اختر نوع العداد" : "Select Meter Type"} --</option>
                      <option value="Single Phase">{isRtl ? "أحادي الطور (Single Phase)" : "Single Phase"}</option>
                      <option value="Three Phase">{isRtl ? "ثلاثي الطور (Three Phase)" : "Three Phase"}</option>
                    </select>
                  ) : matId === 'SIM-01' ? (
                    <select className="input" value={matType} onChange={e => setMatType(e.target.value)} required>
                      <option value="">-- {isRtl ? "اختر شركة الاتصال" : "Select Carrier"} --</option>
                      <option value="Omantel">{isRtl ? "عمانتل (Omantel)" : "Omantel"}</option>
                      <option value="Ooredoo">{isRtl ? "أوريدو (Ooredoo)" : "Ooredoo"}</option>
                    </select>
                  ) : (
                    <input className="input" placeholder={isRtl ? "حدد المادة أولاً" : "Select material first"} disabled value="" />
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الكمية (بالقطعة)" : "Quantity (pieces)"}</label>
                  <input 
                    type="number" 
                    className="input" 
                    min="1" 
                    value={matQty} 
                    onChange={e => setMatQty(e.target.value)} 
                    placeholder="50" 
                    required 
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="alert alert-info" style={{ margin: "4px 0 0 0", padding: "10px 12px" }}>
                  <span style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                    📌 {isRtl ? "الوجهة المستلمة تلقائياً: محطة التجميع (Assembly)" : "Automatically assigned to: Assembly Workstation"}
                  </span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "ملاحظات السحب" : "Withdrawal Notes"}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={matNotes} 
                  onChange={e => setMatNotes(e.target.value)} 
                  placeholder={isRtl ? "مثال: شحنة عدادات أحادية الطور لمحطة التجميع" : "e.g., Single phase meters batch for assembly stage"} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 6, justifyContent: "center" }}>
                {isRtl ? "سحب المواد من المستودع ⚡" : "Withdraw Materials ⚡"}
              </button>
            </form>
          </div>
        </div>

        {/* Modal: Report Stoppage */}
        {showStopModal && (
          <div className="modal-overlay">
            <div className="modal-content animate-scale" style={{ maxWidth: 450 }}>
              <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
                <h3 style={{ margin: 0 }}>⚠️ {isRtl ? "تسجيل توقف خط إنتاج" : "Record Production Stoppage"}</h3>
                <button className="btn-close" onClick={() => setShowStopModal(false)}>✕</button>
              </div>
              <form onSubmit={handleReportStoppage} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المحطة المتوقفة" : "Stopped Station"}</label>
                  <input 
                    className="input" 
                    value={production_stages.find(s => s.stage_id === stopStageId)?.stage_name || stopStageId} 
                    disabled 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "سبب التوقف" : "Reason for Stoppage"}</label>
                  <select 
                    className="input" 
                    value={stopReason} 
                    onChange={e => setStopReason(e.target.value)} 
                    required
                  >
                    <option value="">-- {isRtl ? "اختر سبب التوقف" : "Select reason"} --</option>
                    {Object.entries(downtimeReasons).map(([code, t]) => (
                      <option key={code} value={code}>
                        {isRtl ? t.ar : t.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تفاصيل إضافية / ملاحظات" : "Additional details / Notes"}</label>
                  <textarea 
                    className="input" 
                    value={stopNotes} 
                    onChange={e => setStopNotes(e.target.value)} 
                    placeholder={isRtl ? "اكتب تفاصيل إضافية لتسهيل الصيانة..." : "Write additional details for technicians..."}
                    rows="3"
                  />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, background: "var(--red)" }}>
                    {isRtl ? "تأكيد تسجيل التوقف" : "Confirm Stoppage"}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowStopModal(false)}>
                    {isRtl ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* General Information & Training Modal for Supervisor */}
      {showEduModal && (
        <div className="modal-overlay animate-fade" onClick={() => setShowEduModal(false)}>
          <div 
            className="modal-content animate-scale" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: 700, 
              borderTop: `5px solid var(--accent)`, 
              boxShadow: "var(--shadow-lg)", 
              borderRadius: "var(--radius-xl)" 
            }}
          >
            <div className="modal-header" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.6rem" }}>📖</span>
                <div style={{ textAlign: isRtl ? "right" : "left" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    {isRtl ? "دليل محطات العمل وتثقيف الموظفين" : "Workstations Guide & Training Manual"}
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    {isRtl ? "عرض تفاصيل وشرح كل خطوة في خط الإنتاج" : "View general information and duties for all production stages"}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowEduModal(false)}
                style={{ fontSize: "1.6rem", margin: isRtl ? "0 auto 0 0" : "0 0 0 auto" }}
              >
                &times;
              </button>
            </div>

            {/* Stage Selector Tabs */}
            <div style={{ 
              display: "flex", 
              gap: 6, 
              padding: "12px 20px", 
              background: "var(--bg-elevated)", 
              borderBottom: "1px solid var(--border-subtle)",
              overflowX: "auto",
              whiteSpace: "nowrap",
              flexDirection: isRtl ? "row" : "row-reverse"
            }}>
              {production_stages.filter(s => s.stage_id !== "GLOBAL" && s.stage_id !== "SUPERVISION").map(stage => {
                const isSelected = selectedEduStage === stage.stage_id;
                const stageColors = {
                  "STG-01": "#f97316", "STG-02": "#4f46e5",
                  "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
                };
                const color = stageColors[stage.stage_id] || "var(--accent)";
                return (
                  <button
                    key={stage.stage_id}
                    onClick={() => setSelectedEduStage(stage.stage_id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "30px",
                      border: "1px solid",
                      borderColor: isSelected ? color : "var(--border)",
                      background: isSelected ? `${color}11` : "var(--bg-surface)",
                      color: isSelected ? color : "var(--text-secondary)",
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "Cairo, sans-serif",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>{stage.icon}</span>
                    <span>{isRtl ? stage.short_name : stage.stage_id}</span>
                  </button>
                );
              })}
            </div>

            {/* Stage Description Content */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20, maxHeight: "50vh", overflowY: "auto", textAlign: isRtl ? "right" : "left" }}>
              {(() => {
                const edu = t("stageEducations")?.[selectedEduStage];
                const stageColors = {
                  "STG-01": "#f97316", "STG-02": "#4f46e5",
                  "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
                };
                const color = stageColors[selectedEduStage] || "var(--accent)";

                if (!edu) return <p style={{ textAlign: "center", color: "var(--text-muted)" }}>{isRtl ? "لا تتوفر تفاصيل لهذه المرحلة" : "No details available"}</p>;

                return (
                  <>
                    <div>
                      <h4 style={{ color: color, marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                        <Info size={15} /> <span>{t("stageOverviewTitle")}</span>
                      </h4>
                      <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                        {edu.overview}
                      </p>
                    </div>

                    <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ color: "var(--blue)", marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                        <span>💡</span> <span>{t("stageImportanceTitle")}</span>
                      </h4>
                      <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                        {edu.importance}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ color: "var(--accent)", marginBottom: 10, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                        <span>⚙️</span> <span>{t("stageFunctionsTitle")}</span>
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {edu.functions.map((func, idx) => (
                          <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--bg-elevated)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span style={{ 
                              background: color + "22", 
                              color: color, 
                              width: 22, height: 22, borderRadius: "50%", 
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.75rem", fontWeight: 800, flexShrink: 0
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", flex: 1 }}>{func}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ padding: "16px 24px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: isRtl ? "flex-start" : "flex-end" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEduModal(false)}>
                {isRtl ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

