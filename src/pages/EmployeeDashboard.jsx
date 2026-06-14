import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../supabaseClient";
import { TranslateText, TranslateSteps } from "./KnowledgeBasePage";
import {
  Play, Calendar, Star, Clock, ChevronLeft,
  AlertTriangle, CheckCircle, BookOpen, BarChart2, Wrench, Info
} from "lucide-react";


const DAY_NAMES = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MONTH_AR  = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  const dayName = DAY_NAMES[d.getDay()];
  const label = diff === 0 ? "اليوم" : diff === 1 ? "غداً" : diff === 2 ? "بعد غد" : dayName;
  return { label, full: `${d.getDate()} ${MONTH_AR[d.getMonth()]}` };
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    todaySchedule,
    upcomingSchedule,
    currentStage,
    currentShift,
    getScheduleWithDetails,
    defectiveMeters,
    language,
    productionStages,
    t
  } = useApp();

  const isRtl = language === "ar";
  const [myMaintenanceShift, setMyMaintenanceShift] = useState(null);
  const [showEduModal, setShowEduModal] = useState(false);
  const [selectedEduStage, setSelectedEduStage] = useState("STG-01");

  useEffect(() => {
    if (!currentUser) return;

    const fetchMyShift = async () => {
      try {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const { data, error } = await supabase
          .from("maintenance_schedule")
          .select("*")
          .eq("employee_id", currentUser.employee_id)
          .eq("status", "pending");

        if (error) throw error;

        const active = data?.find(s => {
          const start = new Date(s.week_start_date + "T00:00:00");
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return today >= start && today < end;
        });

        if (active) {
          setMyMaintenanceShift(active);
        }
      } catch (err) {
        try {
          const local = localStorage.getItem("Ectron_Maintenance_Schedule");
          if (local) {
            const parsed = JSON.parse(local);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const active = parsed.find(s => {
              const start = new Date(s.week_start_date + "T00:00:00");
              const end = new Date(start);
              end.setDate(start.getDate() + 7);
              return s.employee_id === currentUser.employee_id && 
                     s.status === "pending" && 
                     today >= start && today < end;
            });
            if (active) {
              setMyMaintenanceShift(active);
            }
          }
        } catch (e) {
          console.error("Local storage fallback error:", e);
        }
      }
    };

    fetchMyShift();
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  // My reported defects today
  const todayStr = new Date().toISOString().split("T")[0];
  const myDefectsToday = defectiveMeters.filter(
    d => d.reported_by === currentUser.employee_id &&
         d.created_at.startsWith(todayStr)
  );

  const stageColorMap = {
    "STG-01": "#f97316", "STG-02": "#4f46e5",
    "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899",
    "GLOBAL": "#0550ae"
  };

  const shiftBg = {
    "SHIFT-M": "rgba(245,158,11,0.12)",
    "SHIFT-E": "rgba(99,102,241,0.12)",
    "SHIFT-N": "rgba(14,165,233,0.12)",
  };

  const initials = currentUser.full_name
    ? currentUser.full_name.split(" ").slice(0, 2).map(w => w[0]).join("")
    : "";

  const formatDemoDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    const dayName = DAY_NAMES[d.getDay()];
    
    let label = dayName;
    if (diff === 0) label = isRtl ? "اليوم" : "Today";
    else if (diff === 1) label = isRtl ? "غداً" : "Tomorrow";
    else if (diff === 2) label = isRtl ? "بعد غد" : "In 2 days";
    
    return { label, full: `${d.getDate()} ${MONTH_AR[d.getMonth()]}` };
  };

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Welcome header ── */}
        <div className="animate-fade" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="avatar">{initials}</div>
          <div>
            <h1 style={{ fontSize: "1.4rem" }}>{t("welcomeUser")}{currentUser.full_name.split(" ")[0]} 👋</h1>
            <p style={{ fontSize: "0.85rem", marginTop: 2 }}>
              {currentUser.role === "supervisor" ? t("lineSupervisor") : t("lineOperator")}
              &nbsp;·&nbsp;{currentUser.employee_id}
            </p>
          </div>

        </div>

        {/* Maintenance Alert Notification Banner */}
        {myMaintenanceShift && (
          <div className="alert alert-warning animate-fade animate-slide-up" style={{ 
            background: "linear-gradient(135deg, #78350f, #451a03)", 
            color: "#fef3c7", 
            border: "1px solid #f59e0b",
            padding: "16px 20px",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
            marginTop: 4
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Wrench size={22} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem", fontWeight: 700 }}>
                  {isRtl ? "⚠️ تنبيه مهمة صيانة مطلوبة!" : "⚠️ Pending Maintenance Task Alert!"}
                </strong>
                <span style={{ fontSize: "0.8rem", color: "#fcd34d" }}>
                  {isRtl 
                    ? `أنت مكلف بمهمة الصيانة الدورية هذا الأسبوع: (${myMaintenanceShift.task_name}). يرجى القيام بالصيانة وتأكيد إنجازها.`
                    : `You are scheduled for the periodic maintenance task this week: (${myMaintenanceShift.task_name}). Please perform the task and confirm completion.`}
                </span>
              </div>
            </div>
            <button 
              className="btn btn-sm" 
              onClick={() => navigate("/maintenance")}
              style={{ 
                background: "#f59e0b", 
                borderColor: "#f59e0b", 
                color: "#451a03", 
                fontWeight: 800,
                fontSize: "0.78rem",
                padding: "6px 12px",
                cursor: "pointer"
              }}
            >
              {isRtl ? "عرض تفاصيل الصيانة" : "View Maintenance Details"}
            </button>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid-3 animate-fade stagger">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(35,134,54,0.15)" }}>✅</div>
            <div>
              <div className="stat-value" style={{ color: "#3fb950" }}>0</div>
              <div className="stat-label">{t("metersCompletedToday")}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(218,54,51,0.15)" }}>⚠️</div>
            <div>
              <div className="stat-value" style={{ color: "#f85149" }}>{myDefectsToday.length}</div>
              <div className="stat-label">{t("defectsIReported")}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(14,165,233,0.15)" }}>🕐</div>
            <div>
              <div className="stat-value" style={{ color: "#38bdf8" }}>
                {currentShift ? `${currentShift.start_time}–${currentShift.end_time}` : "--"}
              </div>
              <div className="stat-label">{t("currentShiftHours")}</div>
            </div>
          </div>
        </div>

        {/* ── Today's assignment card ── */}
        {todaySchedule && currentStage ? (
          <div className="employee-card animate-fade">
            {/* Colored accent line at top */}
            <div style={{
              position: "absolute", top: 0, right: 0, left: 0, height: 3,
              background: `linear-gradient(90deg, ${stageColorMap[currentStage.stage_id]}, transparent)`,
              borderRadius: "var(--radius-xl) var(--radius-xl) 0 0"
            }} />

            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
              {/* Stage icon */}
              <div
                className="stage-icon-large"
                style={{ background: `${stageColorMap[currentStage.stage_id]}22`, border: `2px solid ${stageColorMap[currentStage.stage_id]}55` }}
              >
                {currentStage.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <h2>{currentStage.stage_name.match(/\(([^)]+)\)/)?.[1] || currentStage.stage_name}</h2>
                  {todaySchedule.is_team_leader && (
                    <span className="badge badge-amber">
                      <Star size={11} fill="currentColor" /> {t("teamLeaderBadge")}
                    </span>
                  )}
                  <span className="badge badge-gray">{currentStage.stage_id}</span>
                </div>

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <Clock size={14} />
                    {isRtl ? "شفت" : "Shift"} {currentShift?.name} · {currentShift?.start_time} – {currentShift?.end_time}
                  </div>
                  {todaySchedule.is_team_leader && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#d29922" }}>
                      <Star size={14} />
                      {isRtl ? "أنت قائد الفريق لهذا الشفت" : "You are the Team Leader for this shift"}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate("/workspace")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Play size={16} /> {t("startWork")}
                    <ChevronLeft size={16} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate("/knowledge")}
                    style={{ background: "rgba(99,102,241,0.08)", color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <BookOpen size={14} /> {t("faultGuide")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate("/fpy-overview")}
                    style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <BarChart2 size={14} /> {t("fpyOverview")}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Guide Section */}
            <div className="quick-guide-grid" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Instructions summary */}
              <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--accent)" }}>
                  <Play size={14} />
                  <span style={{ fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase" }}>{t("quickOperatingInstructions")}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentStage.instructions.slice(0, 3).map((instr, i) => (
                    <div key={i} style={{ fontSize: "0.82rem", display: "flex", gap: 8, color: "var(--text-secondary)" }}>
                      <span style={{ fontWeight: 800, color: "var(--accent)" }}>{i + 1}.</span>
                      <span>{instr}</span>
                    </div>
                  ))}
                  {currentStage.instructions.length > 3 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>
                      +{currentStage.instructions.length - 3} {isRtl ? "تعليمات أخرى..." : "more instructions..."}
                    </div>
                  )}
                </div>
              </div>

              {/* Hints summary */}
              {currentStage.troubleshooting && currentStage.troubleshooting.length > 0 && (
                <div style={{ background: "#fff5f5", padding: 16, borderRadius: 12, border: "1px solid #feb2b2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--red)" }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase" }}>{t("alertsCommonIssues")}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {currentStage.troubleshooting.slice(0, 2).map((item, i) => (
                      <div key={i} style={{ fontSize: "0.82rem" }}>
                        <div style={{ fontWeight: 700, color: "#c53030", marginBottom: 2 }}>
                          <TranslateText text={item.problem} targetLang={isRtl ? "ar" : "en"} />
                        </div>
                        <div style={{ color: "#2f855a", fontWeight: 600 }}>
                          💡 {t("solutionPrefix")}<TranslateText text={item.solution} targetLang={isRtl ? "ar" : "en"} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card animate-fade">
            <div className="no-shift-banner">
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>😴</div>
              <h3 style={{ marginBottom: 8 }}>{t("noShiftScheduledTitle")}</h3>
              <p>{t("noShiftScheduledDesc")}</p>
            </div>
          </div>
        )}

        {/* ── Workstations Guide & Training Manual Card ── */}
        <div 
          className="card interactive animate-fade" 
          onClick={() => setShowEduModal(true)} 
          style={{ display: "flex", gap: 16, cursor: "pointer", alignItems: "center", border: "1px solid var(--accent)", padding: "20px 24px" }}
        >
          <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(99,102,241,0.12)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={24} />
          </div>
          <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            <h3 style={{ margin: "0 0 6px 0", fontWeight: 800, fontSize: "1.1rem", color: "var(--accent)" }}>
              {isRtl ? "دليل محطات العمل وتثقيف الموظفين" : "Workstations Guide & Training"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {isRtl ? "عرض تفاصيل وشرح كل خطوة في خط الإنتاج" : "View general information and duties for all production stages"}
            </p>
          </div>
        </div>

        {/* ── Upcoming schedule ── */}
        <div className="card animate-fade">
          <div className="card-header">
            <Calendar size={18} style={{ color: "var(--blue)" }} />
            <h3 style={{ margin: 0 }}>{t("yourUpcomingSchedule")}</h3>
          </div>

          {upcomingSchedule.length === 0 ? (
            <p style={{ textAlign: "center", padding: "20px 0" }}>{t("noUpcomingSchedule")}</p>
          ) : (
            <div>
              {upcomingSchedule.map((sch) => {
                const d = getScheduleWithDetails(sch);
                const { label, full } = formatDemoDate(sch.schedule_date);
                const stageColor = stageColorMap[sch.stage_id] || "var(--accent)";
                const isToday = sch.schedule_date === todayStr;
                return (
                  <div key={sch.id} className="schedule-row" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <div
                      className="schedule-date-pill"
                      style={isToday ? { background: "rgba(35,134,54,0.2)", color: "#3fb950", border: "1px solid rgba(35,134,54,0.3)" } : {}}
                    >
                      <div style={{ fontSize: "0.7rem", marginBottom: 1 }}>{label}</div>
                      <div>{full}</div>
                    </div>

                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: stageColor, flexShrink: 0
                    }} />

                    <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                        {d.stage?.icon} {d.stage?.stage_name ? (d.stage.stage_name.match(/\(([^)]+)\)/)?.[1] || d.stage.stage_name) : ""}
                        {sch.is_team_leader && (
                          <Star size={12} style={{ color: "#d29922" }} fill="#d29922" />
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {isRtl ? "شفت" : "Shift"} {d.shift?.name} · {d.shift?.start_time}–{d.shift?.end_time}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {sch.is_team_leader && (
                        <span className="badge badge-amber">
                          <Star size={10} fill="currentColor" /> TL
                        </span>
                      )}
                      <span className="badge badge-gray">{sch.stage_id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

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
              {productionStages.filter(s => s.stage_id !== "GLOBAL" && s.stage_id !== "SUPERVISION").map(stage => {
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
                const activeStageData = productionStages.find(s => s.stage_id === selectedEduStage);
                const eduStatic = t("stageEducations")?.[selectedEduStage];
                const stageColors = {
                  "STG-01": "#f97316", "STG-02": "#4f46e5",
                  "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
                };
                const color = stageColors[selectedEduStage] || "var(--accent)";

                if (!activeStageData) return <p style={{ textAlign: "center", color: "var(--text-muted)" }}>{isRtl ? "لا تتوفر تفاصيل لهذه المرحلة" : "No details available"}</p>;

                const hasDbContent = activeStageData.overview || activeStageData.importance || (activeStageData.functions && activeStageData.functions.length > 0);

                if (hasDbContent) {
                  return (
                    <>
                      {activeStageData.overview && (
                        <div>
                          <h4 style={{ color: color, marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <Info size={15} /> <span>{t("stageOverviewTitle")}</span>
                          </h4>
                          <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                            <TranslateText text={activeStageData.overview} targetLang={isRtl ? "ar" : "en"} />
                          </p>
                        </div>
                      )}

                      {activeStageData.importance && (
                        <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 12, padding: 16 }}>
                          <h4 style={{ color: "var(--blue)", marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span>💡</span> <span>{t("stageImportanceTitle")}</span>
                          </h4>
                          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                            <TranslateText text={activeStageData.importance} targetLang={isRtl ? "ar" : "en"} />
                          </p>
                        </div>
                      )}

                      {activeStageData.functions && activeStageData.functions.length > 0 && (
                        <div>
                          <h4 style={{ color: "var(--accent)", marginBottom: 10, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span>⚙️</span> <span>{t("stageFunctionsTitle")}</span>
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <TranslateSteps
                              steps={activeStageData.functions}
                              targetLang={isRtl ? "ar" : "en"}
                              renderStep={(func, idx) => (
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
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  );
                } else if (eduStatic) {
                  return (
                    <>
                      <div>
                        <h4 style={{ color: color, marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <Info size={15} /> <span>{t("stageOverviewTitle")}</span>
                        </h4>
                        <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                          {eduStatic.overview}
                        </p>
                      </div>

                      <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 12, padding: 16 }}>
                        <h4 style={{ color: "var(--blue)", marginBottom: 6, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <span>💡</span> <span>{t("stageImportanceTitle")}</span>
                        </h4>
                        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                          {eduStatic.importance}
                        </p>
                      </div>

                      <div>
                        <h4 style={{ color: "var(--accent)", marginBottom: 10, fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <span>⚙️</span> <span>{t("stageFunctionsTitle")}</span>
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {eduStatic.functions.map((func, idx) => (
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
                } else {
                  return <p style={{ textAlign: "center", color: "var(--text-muted)" }}>{isRtl ? "لا تتوفر تفاصيل لهذه المرحلة" : "No details available"}</p>;
                }
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
