import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Play, Calendar, Star, Clock, ChevronLeft,
  AlertTriangle, CheckCircle, Layers, BookOpen
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
    t
  } = useApp();

  const isRtl = language === "ar";

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
    "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
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
        <div className="animate-fade" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="avatar">{initials}</div>
          <div>
            <h1 style={{ fontSize: "1.4rem" }}>{t("welcomeUser")}{currentUser.full_name.split(" ")[0]} 👋</h1>
            <p style={{ fontSize: "0.85rem", marginTop: 2 }}>
              {currentUser.role === "supervisor" ? t("lineSupervisor") : t("lineOperator")}
              &nbsp;·&nbsp;{currentUser.employee_id}
            </p>
          </div>
          {currentUser.role === "supervisor" && (
            <div style={isRtl ? { marginRight: "auto" } : { marginLeft: "auto" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate("/supervisor")}>
                <Layers size={15} /> {t("supervisorPanel")}
              </button>
            </div>
          )}
        </div>

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
                  <h2>{currentStage.stage_name}</h2>
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
                        <div style={{ fontWeight: 700, color: "#c53030", marginBottom: 2 }}>{item.problem}</div>
                        <div style={{ color: "#2f855a", fontWeight: 600 }}>💡 {t("solutionPrefix")}{item.solution}</div>
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
                        {d.stage?.icon} {d.stage?.stage_name}
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
    </div>
  );
}
