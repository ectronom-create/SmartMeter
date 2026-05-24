import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Calendar, Plus, Trash2, Star, ChevronLeft, Clock, Filter } from "lucide-react";
import ScheduleBuilderPanel from "./ScheduleBuilderPanel";

const STAGE_COLORS = { 
  "STG-01": "#f97316", "STG-02": "#4f46e5", 
  "STG-03": "#06b6d4", "STG-04": "#10b981", 
  "STG-05": "#8b5cf6", "STG-06": "#ec4899" 
};

export default function ShiftSchedulesPanel() {
  const { schedules, users, productionStages, shift_types, getScheduleWithDetails, deleteScheduleEntry, clearScheduleByDate, getTodayString, language } = useApp();
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState("current"); // "current" or "history"
  const [filterDate, setFilterDate] = useState(getTodayString());

  const isRtl = language === "ar";

  // Group schedules by date, then by shift
  const groupedSchedules = useMemo(() => {
    const data = {};
    schedules.forEach(s => {
      if (!data[s.schedule_date]) data[s.schedule_date] = {};
      if (!data[s.schedule_date][s.shift_id]) data[s.schedule_date][s.shift_id] = [];
      data[s.schedule_date][s.shift_id].push(getScheduleWithDetails(s));
    });
    return data;
  }, [schedules, getScheduleWithDetails]);

  const sortedDates = Object.keys(groupedSchedules).sort((a, b) => new Date(b) - new Date(a));

  // History logic: stats per employee
  const employeeHistory = useMemo(() => {
    const stats = {};
    const uniqueWorkdays = {};

    schedules.forEach(s => {
      const empId = s.employee_id;
      if (!stats[empId]) {
        stats[empId] = { total: 0, shifts: {}, stages: {} };
        uniqueWorkdays[empId] = new Set();
      }

      // Count only unique shift assignments per day
      const key = `${s.schedule_date}__${s.shift_id}`;
      if (!uniqueWorkdays[empId].has(key)) {
        uniqueWorkdays[empId].add(key);
        stats[empId].total++;
        stats[empId].shifts[s.shift_id] = (stats[empId].shifts[s.shift_id] || 0) + 1;
      }

      // Track stage stats
      if (s.stage_id !== "SUPERVISION") {
        stats[empId].stages[s.stage_id] = (stats[empId].stages[s.stage_id] || 0) + 1;
      }
    });
    return stats;
  }, [schedules]);

  const getTranslatedStageName = (s, isRtl) => {
    if (!s) return "";
    if (isRtl) return s.short_name;
    const match = s.stage_name.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : s.stage_name;
  };

  const getTranslatedShiftName = (shiftId, isRtl) => {
    const shift = shift_types.find(st => st.shift_id === shiftId);
    if (!shift) return shiftId;
    if (isRtl) return shift.name;
    const translations = {
      "الصباحية (M)": "Morning Shift (M)",
      "المسائية (E)": "Evening Shift (E)",
      "الليلية (N)": "Night Shift (N)"
    };
    return translations[shift.name] || shift.name;
  };

  if (showBuilder) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBuilder(false)}>
            <ChevronLeft size={16} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للجداول" : "Back to Schedules"}
          </button>
          <h2 style={{ margin: 0 }}>{isRtl ? "بناء جدول جديد" : "Build Daily Roster"}</h2>
        </div>
        <ScheduleBuilderPanel />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{isRtl ? "إدارة الورديات" : "Shift Management"}</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {isRtl ? "تخطيط ومراجعة سجلات توزيع الموظفين" : "Plan and review operator daily allocations"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowBuilder(true)}>
          <Plus size={16} /> {isRtl ? "إنشاء جدول جديد" : "Create New Schedule"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 0, flexDirection: isRtl ? "row" : "row-reverse" }}>
        <button 
          onClick={() => setActiveTab("current")}
          style={{ 
            padding: "10px 20px", background: "none", border: "none", borderBottom: activeTab === "current" ? "3px solid var(--accent)" : "3px solid transparent",
            color: activeTab === "current" ? "var(--accent)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem"
          }}
        >
          {isRtl ? "📅 الجداول الحالية" : "📅 Current Schedules"}
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          style={{ 
            padding: "10px 20px", background: "none", border: "none", borderBottom: activeTab === "history" ? "3px solid var(--accent)" : "3px solid transparent",
            color: activeTab === "history" ? "var(--accent)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem"
          }}
        >
          {isRtl ? "🕒 سجل الموظفين (History)" : "🕒 Operator Roster History"}
        </button>
      </div>

      {activeTab === "current" ? (
        <>
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, background: "#f8fafc", flexDirection: isRtl ? "row" : "row-reverse" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontWeight: 600, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <Filter size={16} /> {isRtl ? "تصفية حسب التاريخ:" : "Filter by Date:"}
            </div>
            <input 
              type="date" 
              className="input" 
              style={{ width: "auto" }} 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)} 
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>{isRtl ? "عرض الكل" : "Show All"}</button>
          </div>

          {sortedDates.filter(d => !filterDate || d === filterDate).map(date => (
            <div key={date} style={{ display: "flex", flexDirection: "column", gap: 12 }} className="animate-fade">
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px", flexDirection: isRtl ? "row" : "row-reverse" }}>
                <Calendar size={18} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0 }}>
                  {new Date(date).toLocaleDateString(isRtl ? "ar-SA" : "en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)", marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }} onClick={() => {
                  const confirmMsg = isRtl ? `هل أنت متأكد من حذف جميع جداول يوم ${date}؟` : `Are you sure you want to delete all schedules for ${date}?`;
                  if(window.confirm(confirmMsg)) clearScheduleByDate(date);
                }}>{isRtl ? "حذف جداول اليوم" : "Delete Roster"}</button>
              </div>

              <div className="grid-2" style={{ alignItems: "start" }}>
                {Object.entries(groupedSchedules[date]).map(([shiftId, list]) => {
                  return (
                    <div key={shiftId} className="card animate-fade" style={{ padding: 0, overflow: "hidden" }}>
                      <div style={{ 
                        padding: "12px 16px", 
                        background: shiftId === "SHIFT-M" ? "#fff8c5" : shiftId === "SHIFT-E" ? "#f3e5f5" : "#ddf4ff",
                        borderBottom: "1px solid var(--border-subtle)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flexDirection: isRtl ? "row" : "row-reverse"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <Clock size={16} style={{ color: "var(--text-secondary)" }} />
                          <span style={{ fontWeight: 800 }}>{isRtl ? "شفت" : "Shift"} {getTranslatedShiftName(shiftId, isRtl)}</span>
                        </div>
                        <span className="badge badge-gray">{list.length} {isRtl ? "موظفين" : "Operators"}</span>
                      </div>
                      
                      {/* Shift Supervisor Display */}
                      {list.some(a => a.stage_id === "SUPERVISION") && (
                        <div style={{ 
                          padding: "10px 16px", 
                          background: "#f0fdf4", 
                          borderBottom: "1px solid #bbf7d0",
                          display: "flex", 
                          alignItems: "center", 
                          gap: 10,
                          flexDirection: isRtl ? "row" : "row-reverse"
                        }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: "50%", 
                            background: "#166534", color: "#fff", 
                            display: "flex", alignItems: "center", justifyContent: "center" 
                          }}>
                            👑
                          </div>
                          <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                            <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 700 }}>{isRtl ? "مشرف المناوبة" : "Shift Supervisor"}</div>
                            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#166534" }}>
                              {list.find(a => a.stage_id === "SUPERVISION")?.employee?.full_name}
                            </div>
                          </div>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm" 
                            style={{ color: "#166534", marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }}
                            onClick={() => deleteScheduleEntry(list.find(a => a.stage_id === "SUPERVISION").id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div className="table-wrapper" style={{ border: "none" }}>
                        <table style={{ fontSize: "0.85rem" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المرحلة" : "Stage"}</th>
                              <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الموظف" : "Operator"}</th>
                              <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "إجراء" : "Action"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productionStages.filter(s => s.stage_id !== "SUPERVISION" && s.stage_id !== "GLOBAL").map(stage => {
                              const stageAssignments = list.filter(a => a.stage_id === stage.stage_id);
                              return stageAssignments.map((assign, idx) => (
                                <tr key={assign.id}>
                                  {idx === 0 && (
                                    <td rowSpan={stageAssignments.length} style={{ width: "35%", verticalAlign: "top" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: STAGE_COLORS[stage.stage_id], flexDirection: isRtl ? "row" : "row-reverse" }}>
                                        <span>{stage.icon}</span><span>{getTranslatedStageName(stage, isRtl)}</span>
                                      </div>
                                    </td>
                                  )}
                                  <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                                      {assign.is_team_leader && <Star size={12} fill="#9a6700" color="#9a6700" />}
                                      <span>{assign.employee?.full_name}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--red)" }} onClick={() => deleteScheduleEntry(assign.id)}><Trash2 size={14} /></button>
                                  </td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      ) : (
        /* HISTORY VIEW */
        <div className="card animate-fade" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الموظف" : "Operator"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "إجمالي الأيام" : "Total Workdays"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "توزيع الشفتات" : "Shift Distribution"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "أكثر مرحلة عملاً" : "Primary Workstation"}</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role !== "admin").map(u => {
                  const stat = employeeHistory[u.employee_id] || { total: 0, shifts: {}, stages: {} };
                  const topStageId = Object.entries(stat.stages).sort((a,b) => b[1] - a[1])[0]?.[0];
                  const topStage = productionStages.find(s => s.stage_id === topStageId);
                  
                  return (
                    <tr key={u.employee_id}>
                      <td style={{ fontWeight: 700 }}>{u.full_name}</td>
                      <td><span className="badge badge-blue">{stat.total} {isRtl ? "يوم" : "Days"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                          {Object.entries(stat.shifts).map(([sid, count]) => (
                            <span key={sid} style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {getTranslatedShiftName(sid, isRtl)}: <strong>{count}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {topStage ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span>{topStage.icon}</span>
                            <span>{getTranslatedStageName(topStage, isRtl)} ({stat.stages[topStageId]})</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sortedDates.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px", border: "2px dashed var(--border)" }}>
          <Calendar size={48} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <h3>{isRtl ? "لا توجد جداول مسجلة" : "No schedules registered"}</h3>
        </div>
      )}
    </div>
  );
}
