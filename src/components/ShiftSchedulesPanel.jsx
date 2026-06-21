import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Calendar, Plus, Trash2, Star, ChevronLeft, Clock, Filter, Search, Download, User, Layers, Edit2, X, Check } from "lucide-react";
import ScheduleBuilderPanel from "./ScheduleBuilderPanel";
import * as XLSX from "xlsx";

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
  const [editingShift, setEditingShift] = useState(null);

  const formatChangeTime = (isoString, isRtl) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString(isRtl ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [historySubTab, setHistorySubTab] = useState("workstations"); // "workstations" or "operators"
  const [filterStage, setFilterStage] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [operatorsSearch, setOperatorsSearch] = useState("");

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

  const workstationHistory = useMemo(() => {
    const records = [];
    const groups = {};
    
    schedules.forEach(s => {
      if (s.stage_id === "SUPERVISION" || s.stage_id === "GLOBAL") return;
      const key = `${s.schedule_date}__${s.shift_id}__${s.stage_id}`;
      if (!groups[key]) {
        groups[key] = {
          date: s.schedule_date,
          shiftId: s.shift_id,
          stageId: s.stage_id,
          operators: [],
        };
      }
      const details = getScheduleWithDetails(s);
      groups[key].operators.push({
        employee_id: s.employee_id,
        full_name: details.employee?.full_name || s.employee_id,
        is_team_leader: s.is_team_leader
      });
    });

    Object.values(groups).forEach(group => {
      const supervisorEntry = schedules.find(s => 
        s.schedule_date === group.date && 
        s.shift_id === group.shiftId && 
        s.stage_id === "SUPERVISION"
      );
      if (supervisorEntry) {
        const details = getScheduleWithDetails(supervisorEntry);
        group.supervisorName = details.employee?.full_name || supervisorEntry.employee_id;
      } else {
        group.supervisorName = "";
      }
      records.push(group);
    });

    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [schedules, getScheduleWithDetails]);

  const filteredWorkstationHistory = useMemo(() => {
    return workstationHistory.filter(r => {
      if (filterStage && r.stageId !== filterStage) return false;
      if (filterShift && r.shiftId !== filterShift) return false;
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesOperator = r.operators.some(op => op.full_name.toLowerCase().includes(q));
        const matchesSupervisor = r.supervisorName && r.supervisorName.toLowerCase().includes(q);
        if (!matchesOperator && !matchesSupervisor) return false;
      }
      return true;
    });
  }, [workstationHistory, filterStage, filterShift, startDate, endDate, searchQuery]);

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredWorkstationHistory.map(row => {
        const stage = productionStages.find(s => s.stage_id === row.stageId);
        
        return {
          [isRtl ? "التاريخ" : "Date"]: row.date,
          [isRtl ? "الشفت" : "Shift"]: getTranslatedShiftName(row.shiftId, isRtl),
          [isRtl ? "خطوة الإنتاج (المحطة)" : "Workstation (Step)"]: getTranslatedStageName(stage, isRtl),
          [isRtl ? "المشغلين المعينين" : "Assigned Operators"]: row.operators.map(op => `${op.full_name}${op.is_team_leader ? ` (${isRtl ? "قائد فريق" : "Team Leader"})` : ""}`).join(", "),
          [isRtl ? "مشرف الشفت" : "Shift Supervisor"]: row.supervisorName || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isRtl ? "سجل الخطوات والورديات" : "Workstations History");

      // Auto-fit columns
      const maxLen = {};
      dataToExport.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key] || "");
          maxLen[key] = Math.max(maxLen[key] || 10, val.length + 5);
        });
      });
      worksheet["!cols"] = Object.keys(maxLen).map(key => ({ wch: maxLen[key] }));

      XLSX.writeFile(workbook, `Workstations_Shift_History_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Export Excel Error:", err);
      alert(isRtl ? "فشل تصدير ملف الإكسل" : "Failed to export Excel file.");
    }
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <button 
                            className="btn btn-ghost btn-sm"
                            style={{ 
                              padding: "2px 8px", 
                              color: "var(--accent)", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 4, 
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              height: "28px"
                            }}
                            onClick={() => setEditingShift({ date, shiftId, list })}
                          >
                            <Edit2 size={13} />
                            {isRtl ? "تعديل" : "Edit"}
                          </button>
                          <span className="badge badge-gray">{list.length} {isRtl ? "موظفين" : "Operators"}</span>
                        </div>
                      </div>

                      {(() => {
                        const changeTime = list.find(a => a.updated_at)?.updated_at;
                        if (!changeTime) return null;
                        return (
                          <div style={{ 
                            fontSize: "0.72rem", 
                            color: "var(--text-muted)", 
                            textAlign: isRtl ? "left" : "right",
                            padding: "4px 16px",
                            background: "rgba(0, 0, 0, 0.02)",
                            borderBottom: "1px solid var(--border-subtle)",
                            fontWeight: 600
                          }}>
                            {isRtl ? `آخر تعديل: ${formatChangeTime(changeTime, true)}` : `Last updated: ${formatChangeTime(changeTime, false)}`}
                          </div>
                        );
                      })()}
                      
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
            <button
              onClick={() => setHistorySubTab("workstations")}
              className={`btn ${historySubTab === "workstations" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
            >
              <Layers size={14} style={{ marginRight: isRtl ? 0 : 6, marginLeft: isRtl ? 6 : 0 }} />
              {isRtl ? "سجل محطات العمل والخطوات" : "Workstations & Steps History"}
            </button>
            <button
              onClick={() => setHistorySubTab("operators")}
              className={`btn ${historySubTab === "operators" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
            >
              <User size={14} style={{ marginRight: isRtl ? 0 : 6, marginLeft: isRtl ? 6 : 0 }} />
              {isRtl ? "إحصائيات وسجل الموظفين" : "Operators Statistics & Logs"}
            </button>
          </div>

          {historySubTab === "workstations" ? (
            <>
              {/* Filter controls */}
              <div className="card animate-fade" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontWeight: 700, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <Filter size={16} />
                  <span>{isRtl ? "فلترة سجل الخطوات والمحطات:" : "Filter Workstations History:"}</span>
                </div>
                
                {/* Responsive Grid for Filters */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
                  gap: 12,
                  alignItems: "end"
                }}>
                  {/* Select Stage */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: isRtl ? "right" : "left" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      {isRtl ? "خطوة الإنتاج / المحطة" : "Workstation (Step)"}
                    </label>
                    <select
                      className="input"
                      value={filterStage}
                      onChange={e => setFilterStage(e.target.value)}
                      style={{ padding: "8px", height: "38px" }}
                    >
                      <option value="">{isRtl ? "كل خطوات الإنتاج" : "All Workstations"}</option>
                      {productionStages.filter(s => s.stage_id !== "SUPERVISION" && s.stage_id !== "GLOBAL").map(s => (
                        <option key={s.stage_id} value={s.stage_id}>
                          {s.icon} {getTranslatedStageName(s, isRtl)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Shift */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: isRtl ? "right" : "left" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      {isRtl ? "الوردية (الشفت)" : "Shift"}
                    </label>
                    <select
                      className="input"
                      value={filterShift}
                      onChange={e => setFilterShift(e.target.value)}
                      style={{ padding: "8px", height: "38px" }}
                    >
                      <option value="">{isRtl ? "كل الورديات" : "All Shifts"}</option>
                      {shift_types.map(st => (
                        <option key={st.shift_id} value={st.shift_id}>
                          {getTranslatedShiftName(st.shift_id, isRtl)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Date */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: isRtl ? "right" : "left" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      {isRtl ? "من تاريخ" : "From Date"}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={{ height: "38px" }}
                    />
                  </div>

                  {/* End Date */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: isRtl ? "right" : "left" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      {isRtl ? "إلى تاريخ" : "To Date"}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      style={{ height: "38px" }}
                    />
                  </div>
                </div>

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  flexWrap: "wrap", 
                  gap: 12,
                  marginTop: 4,
                  flexDirection: isRtl ? "row" : "row-reverse"
                }}>
                  {/* Search Operator */}
                  <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
                    <input
                      className="input"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={isRtl ? "البحث باسم المشغل أو المشرف..." : "Search operator or supervisor..."}
                      style={{ 
                        paddingRight: isRtl ? 35 : 12, 
                        paddingLeft: !isRtl ? 35 : 12, 
                        textAlign: isRtl ? "right" : "left",
                        height: "38px"
                      }}
                    />
                    <Search size={16} style={{
                      position: "absolute",
                      right: isRtl ? 12 : "auto",
                      left: !isRtl ? 12 : "auto",
                      top: "50%", 
                      transform: "translateY(-50%)", 
                      color: "var(--text-muted)"
                    }} />
                  </div>

                  {/* Quick Filters & Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        setStartDate(today);
                        setEndDate(today);
                      }}
                    >
                      {isRtl ? "اليوم" : "Today"}
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(end.getDate() - 7);
                        setStartDate(start.toISOString().split("T")[0]);
                        setEndDate(end.toISOString().split("T")[0]);
                      }}
                    >
                      {isRtl ? "آخر 7 أيام" : "Last 7 Days"}
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setFilterStage("");
                        setFilterShift("");
                        setSearchQuery("");
                      }}
                    >
                      {isRtl ? "إعادة تعيين الكل" : "Reset All"}
                    </button>
                    
                    {/* Excel Export Button */}
                    <button 
                      className="btn btn-primary"
                      onClick={handleExportExcel}
                      style={{ 
                        background: "#16a34a", 
                        borderColor: "#16a34a",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.85rem",
                        padding: "8px 16px"
                      }}
                    >
                      <Download size={14} />
                      {isRtl ? "تصدير إلى إكسل" : "Export to Excel"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="card animate-fade" style={{ padding: 0, overflow: "hidden" }}>
                <div className="table-wrapper" style={{ border: "none", overflowX: "auto" }}>
                  <table style={{ minWidth: "800px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: isRtl ? "right" : "left", width: "15%" }}>{isRtl ? "التاريخ" : "Date"}</th>
                        <th style={{ textAlign: isRtl ? "right" : "left", width: "15%" }}>{isRtl ? "الشفت" : "Shift"}</th>
                        <th style={{ textAlign: isRtl ? "right" : "left", width: "20%" }}>{isRtl ? "خطوة الإنتاج / المحطة" : "Workstation (Step)"}</th>
                        <th style={{ textAlign: isRtl ? "right" : "left", width: "30%" }}>{isRtl ? "المشغلين المعينين" : "Assigned Operators"}</th>
                        <th style={{ textAlign: isRtl ? "right" : "left", width: "20%" }}>{isRtl ? "مشرف الشفت" : "Shift Supervisor"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkstationHistory.map((row, idx) => {
                        const stage = productionStages.find(s => s.stage_id === row.stageId);
                        
                        // Parse date for beautiful rendering
                        const formattedDate = new Date(row.date).toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
                          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                        });

                        return (
                          <tr key={`${row.date}_${row.shiftId}_${row.stageId}_${idx}`} className="animate-fade">
                            <td style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                              📅 {formattedDate}
                            </td>
                            <td>
                              <span 
                                className="badge" 
                                style={{ 
                                  background: row.shiftId === "SHIFT-M" ? "#fff8c5" : row.shiftId === "SHIFT-E" ? "#f3e5f5" : "#ddf4ff",
                                  color: row.shiftId === "SHIFT-M" ? "#855d00" : row.shiftId === "SHIFT-E" ? "#6b21a8" : "#0369a1",
                                  fontWeight: 800,
                                  border: `1px solid ${row.shiftId === "SHIFT-M" ? "#fef08a" : row.shiftId === "SHIFT-E" ? "#e9d5ff" : "#bae6fd"}`
                                }}
                              >
                                🕒 {getTranslatedShiftName(row.shiftId, isRtl)}
                              </span>
                            </td>
                            <td>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 6, 
                                fontWeight: 700, 
                                color: STAGE_COLORS[row.stageId] || "var(--text)",
                                flexDirection: isRtl ? "row" : "row-reverse"
                              }}>
                                <span>{stage?.icon || "⚙️"}</span>
                                <span>{getTranslatedStageName(stage, isRtl)}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                                {row.operators.map(op => (
                                  <span 
                                    key={op.employee_id} 
                                    className="badge"
                                    style={{ 
                                      display: "inline-flex", 
                                      alignItems: "center", 
                                      gap: 4,
                                      background: op.is_team_leader ? "#fef3c7" : "#f1f5f9",
                                      color: op.is_team_leader ? "#b45309" : "var(--text)",
                                      border: op.is_team_leader ? "1px solid #fde68a" : "1px solid var(--border-subtle)",
                                      padding: "2px 8px",
                                      fontSize: "0.8rem",
                                      borderRadius: "6px"
                                    }}
                                  >
                                    {op.is_team_leader && <Star size={10} fill="#b45309" color="#b45309" />}
                                    <span style={{ fontWeight: op.is_team_leader ? 800 : 500 }}>{op.full_name}</span>
                                  </span>
                                ))}
                                {row.operators.length === 0 && <span style={{ color: "var(--text-muted)" }}>—</span>}
                              </div>
                            </td>
                            <td style={{ fontSize: "0.85rem" }}>
                              {row.supervisorName ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#166534", fontWeight: 700 }}>
                                  <span>👑</span>
                                  <span>{row.supervisorName}</span>
                                </div>
                              ) : (
                                <span style={{ color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredWorkstationHistory.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            {isRtl ? "لا توجد سجلات مطابقة لمعايير البحث والفلترة" : "No shift history records match the search filters"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Existing Operator Statistics Tab */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
                <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
                  <input
                    className="input"
                    value={operatorsSearch}
                    onChange={e => setOperatorsSearch(e.target.value)}
                    placeholder={isRtl ? "البحث باسم الموظف أو الرقم الوظيفي..." : "Search operator name or employee ID..."}
                    style={{ paddingRight: isRtl ? 35 : 12, paddingLeft: !isRtl ? 35 : 12, textAlign: isRtl ? "right" : "left", height: "38px", background: "white" }}
                  />
                  <Search size={16} style={{
                    position: "absolute",
                    right: isRtl ? 10 : "auto",
                    left: !isRtl ? 10 : "auto",
                    top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
                  }} />
                </div>
              </div>

              <div className="card animate-fade" style={{ padding: 0 }}>
                <div className="table-wrapper" style={{ border: "none", overflowX: "auto" }}>
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
                      {(() => {
                        const filteredList = users.filter(u => u.role !== "admin" && (
                          !operatorsSearch.trim() ||
                          u.full_name.toLowerCase().includes(operatorsSearch.toLowerCase()) ||
                          u.employee_id.toLowerCase().includes(operatorsSearch.toLowerCase())
                        ));
                        if (filteredList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                                {isRtl ? "لا توجد سجلات مطابقة" : "No matching records found"}
                              </td>
                            </tr>
                          );
                        }
                        return filteredList.map(u => {
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
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {sortedDates.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px", border: "2px dashed var(--border)" }}>
          <Calendar size={48} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <h3>{isRtl ? "لا توجد جداول مسجلة" : "No schedules registered"}</h3>
        </div>
      )}

      {editingShift && (
        <EditScheduleModal 
          date={editingShift.date}
          shiftId={editingShift.shiftId}
          list={editingShift.list}
          onClose={() => setEditingShift(null)}
        />
      )}
    </div>
  );
}

function EditScheduleModal({ date, shiftId, list, onClose }) {
  const { 
    users, 
    productionStages, 
    shift_types, 
    saveEditedSchedule, 
    language 
  } = useApp();
  const isRtl = language === "ar";

  // Filter out admin users
  const operators = users.filter(u => u.role !== "admin");
  const supervisors = users.filter(u => u.role === "supervisor");

  // Find existing supervisor for this shift
  const initialSupervisor = list.find(a => a.stage_id === "SUPERVISION")?.employee_id || "";

  // Find which stage supervisor is assigned to (other than SUPERVISION)
  const initialSupervisorStage = list.find(a => a.employee_id === initialSupervisor && a.stage_id !== "SUPERVISION")?.stage_id || "";

  // Build initial assignments: stageId -> array of employeeIds (excluding SUPERVISION)
  const initialAssignments = {};
  productionStages.forEach(stage => {
    if (stage.stage_id !== "SUPERVISION" && stage.stage_id !== "GLOBAL") {
      initialAssignments[stage.stage_id] = list
        .filter(a => a.stage_id === stage.stage_id)
        .map(a => a.employee_id);
    }
  });

  // Build initial team leaders: stageId -> employeeId of team leader
  const initialTeamLeaders = {};
  productionStages.forEach(stage => {
    if (stage.stage_id !== "SUPERVISION" && stage.stage_id !== "GLOBAL") {
      const tl = list.find(a => a.stage_id === stage.stage_id && a.is_team_leader);
      initialTeamLeaders[stage.stage_id] = tl ? tl.employee_id : "";
    }
  });

  const [supervisor, setSupervisor] = useState(initialSupervisor);
  const [supervisorStage, setSupervisorStage] = useState(initialSupervisorStage);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [teamLeaders, setTeamLeaders] = useState(initialTeamLeaders);

  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const assignedIds = Object.values(assignments).flat();

  // Find all operators not assigned to this shift and not busy on other shifts
  const unassigned = useMemo(() => {
    return operators.filter(u => {
      // If already assigned to a stage on this shift
      if (assignedIds.includes(u.employee_id)) return false;
      // If they are the active shift supervisor on this shift
      if (u.employee_id === supervisor) return false;
      
      // Check if busy on a DIFFERENT shift on the SAME date
      const isBusy = list.some(s => 
        s.employee_id === u.employee_id && 
        s.schedule_date === date && 
        s.shift_id !== shiftId
      );
      return !isBusy;
    });
  }, [operators, assignedIds, supervisor, list, date, shiftId]);

  const toggleEmployee = (stageId, empId) => {
    setAssignments(prev => {
      const current = prev[stageId] || [];
      const exists = current.includes(empId);
      // Remove employee from all other stages first to prevent duplicate assignment
      const cleaned = Object.fromEntries(
        Object.entries(prev).map(([sid, arr]) => [sid, arr.filter(id => id !== empId)])
      );
      return { 
        ...cleaned, 
        [stageId]: exists ? current.filter(id => id !== empId) : [...(cleaned[stageId] || []), empId] 
      };
    });
    setTeamLeaders(prev => {
      if (prev[stageId] === empId) return { ...prev, [stageId]: "" };
      return prev;
    });
  };

  const setLeader = (stageId, empId) => {
    setTeamLeaders(prev => ({ 
      ...prev, 
      [stageId]: prev[stageId] === empId ? "" : empId 
    }));
  };

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

  const submit = async (e) => {
    e.preventDefault();
    if (supervisor && !supervisorStage) {
      setErrorMsg(isRtl ? "يرجى اختيار محطة عمل المشرف أولاً." : "Please select active workstation stage for supervisor first.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    const entries = [];
    let counter = Date.now();

    // 1. Add Shift Supervisor entry if selected
    if (supervisor) {
      entries.push({
        id: `SCH-ED-SUP-${counter++}`,
        schedule_date: date,
        shift_id: shiftId,
        employee_id: supervisor,
        stage_id: "SUPERVISION",
        is_team_leader: false,
        is_supervisor: true
      });
    }

    // 2. Add stage assignments
    // If supervisor has an active stage, make sure they are in the assignments for that stage
    let finalAssignments = { ...assignments };
    if (supervisor && supervisorStage) {
      const currentArr = finalAssignments[supervisorStage] || [];
      if (!currentArr.includes(supervisor)) {
        // Remove supervisor from any other stage first
        const cleaned = Object.fromEntries(
          Object.entries(finalAssignments).map(([sid, arr]) => [sid, arr.filter(id => id !== supervisor)])
        );
        finalAssignments = {
          ...cleaned,
          [supervisorStage]: [supervisor, ...(cleaned[supervisorStage] || [])]
        };
      }
    }

    Object.entries(finalAssignments).forEach(([stageId, empIds]) => {
      empIds.forEach(empId => {
        const isTeamLeader = teamLeaders[stageId] === empId;
        entries.push({
          id: `SCH-ED-${counter++}`,
          schedule_date: date,
          shift_id: shiftId,
          employee_id: empId,
          stage_id: stageId,
          is_team_leader: isTeamLeader,
          is_supervisor: false
        });
      });
    });

    const res = await saveEditedSchedule(date, shiftId, entries);
    setIsSaving(false);
    if (res && res.success) {
      setDone(true);
      setTimeout(onClose, 1200);
    } else {
      setErrorMsg(isRtl ? "فشل حفظ التعديلات في قاعدة البيانات." : "Failed to save edits to the database.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card animate-fade" style={{ width: "100%", maxWidth: 650, padding: 24, maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 16, textAlign: isRtl ? "right" : "left", direction: isRtl ? "rtl" : "ltr" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <Edit2 size={20} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            <h3 style={{ margin: 0 }}>{isRtl ? "تعديل جدول الوردية" : "Edit Shift Schedule"}</h3>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
              📅 {date} | 🕒 {isRtl ? "شفت" : "Shift"} {getTranslatedShiftName(shiftId, isRtl)}
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }}><X size={15} /></button>
        </div>

        {done ? (
          <div className="alert alert-success" style={{ margin: "20px 0" }}><Check size={15} /> {isRtl ? "تم تعديل الجدول وحفظه بنجاح!" : "Shift schedule updated successfully!"}</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", paddingRight: 4, paddingLeft: 4 }}>
            {errorMsg && (
              <div className="alert alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Supervisor settings */}
            <div className="grid-2" style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                  👑 {isRtl ? "مشرف المناوبة" : "Shift Supervisor"}
                </label>
                <select className="input" value={supervisor} onChange={e => {
                  setSupervisor(e.target.value);
                  if (!e.target.value) setSupervisorStage("");
                }}>
                  <option value="">-- {isRtl ? "اختر مشرفاً" : "Select Supervisor"} --</option>
                  {supervisors.map(s => (
                    <option key={s.employee_id} value={s.employee_id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              {supervisor && (
                <div className="input-group animate-fade">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                    📍 {isRtl ? "محطة عمل المشرف" : "Supervisor Active Station"}
                  </label>
                  <select className="input" value={supervisorStage} onChange={e => {
                    const nextStage = e.target.value;
                    setSupervisorStage(nextStage);
                    // Add supervisor to the stage assignments list automatically
                    if (nextStage) {
                      setAssignments(prev => {
                        const cleaned = Object.fromEntries(
                          Object.entries(prev).map(([sid, arr]) => [sid, arr.filter(id => id !== supervisor)])
                        );
                        return {
                          ...cleaned,
                          [nextStage]: [supervisor, ...(cleaned[nextStage] || [])]
                        };
                      });
                      setTeamLeaders(prev => ({ ...prev, [nextStage]: supervisor }));
                    }
                  }}>
                    <option value="">-- {isRtl ? "اختر محطة عمل" : "Select Active Station"} --</option>
                    {productionStages.filter(stg => stg.stage_id !== "GLOBAL" && stg.stage_id !== "SUPERVISION").map(stg => (
                      <option key={stg.stage_id} value={stg.stage_id}>{getTranslatedStageName(stg, isRtl)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Stages assignments list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h4 style={{ margin: "4px 0" }}>{isRtl ? "توزيع الموظفين على المراحل" : "Station Assignments"}</h4>
              
              {productionStages.filter(stage => stage.stage_id !== "GLOBAL" && stage.stage_id !== "SUPERVISION").map(stage => {
                const color = STAGE_COLORS[stage.stage_id] || "var(--accent)";
                const stageEmps = (assignments[stage.stage_id] || []);
                return (
                  <div key={stage.stage_id} style={{ border: `1px solid ${color}33`, borderRadius: "var(--radius)", overflow: "hidden" }}>
                    <div style={{ 
                      background: `${color}08`, 
                      padding: "8px 12px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 8, 
                      borderBottom: `1px solid ${color}22`,
                      flexDirection: isRtl ? "row" : "row-reverse"
                    }}>
                      <span style={{ fontSize: "1.1rem" }}>{stage.icon}</span>
                      <span style={{ fontWeight: 700, color, fontSize: "0.85rem" }}>{getTranslatedStageName(stage, isRtl)}</span>
                      <span style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {stageEmps.length} {isRtl ? "موظفين" : "Operators"}
                      </span>
                    </div>

                    <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6, flexDirection: isRtl ? "row" : "row-reverse", alignItems: "center" }}>
                      {stageEmps.map(empId => {
                        const emp = users.find(u => u.employee_id === empId);
                        const isLeader = teamLeaders[stage.stage_id] === empId;
                        const canBeLeader = emp?.role === "supervisor";
                        
                        return (
                          <div key={empId} style={{ 
                            display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 4px", 
                            borderRadius: "100px", 
                            background: isLeader ? "#fff8c5" : "#dafbe1", 
                            border: `1px solid ${isLeader ? "#d4a72c44" : "#aceebb"}`, 
                            fontSize: "0.78rem", fontWeight: 600,
                            flexDirection: isRtl ? "row" : "row-reverse"
                          }}>
                            <button 
                              type="button"
                              title={canBeLeader ? (isRtl ? "تعيين كقائد فريق" : "Set as Team Leader") : (isRtl ? "قائد الفريق يجب أن يكون برتبة مشرف" : "Team Leader must have Supervisor rank")}
                              onClick={() => {
                                if (canBeLeader) {
                                  setLeader(stage.stage_id, empId);
                                } else {
                                  alert(isRtl ? "عذراً، يجب أن يكون قائد الفريق برتبة مشرف (Supervisor)." : "Team Leader must have a Supervisor rank.");
                                }
                              }} 
                              style={{ 
                                background: "none", border: "none", 
                                cursor: canBeLeader ? "pointer" : "not-allowed", 
                                padding: 0, 
                                color: isLeader ? "#9a6700" : (canBeLeader ? "var(--text-muted)" : "#ccc"), 
                                display: "flex", alignItems: "center" 
                              }}
                            >
                              <Star size={11} fill={isLeader ? "currentColor" : "none"} />
                            </button>
                            <span style={{ color: isLeader ? "#9a6700" : "var(--accent)" }}>
                              {emp?.full_name?.split(" ")[0]} {emp?.full_name?.split(" ")[1] || ""}
                            </span>
                            <button 
                              type="button"
                              onClick={() => toggleEmployee(stage.stage_id, empId)} 
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "center", fontSize: "0.78rem", marginLeft: isRtl ? 0 : 2, marginRight: isRtl ? 2 : 0 }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      {/* Dropdown to add unassigned operators to this stage */}
                      {unassigned.length > 0 ? (
                        <select 
                          className="input" 
                          value=""
                          onChange={e => {
                            if (e.target.value) {
                              toggleEmployee(stage.stage_id, e.target.value);
                            }
                          }}
                          style={{
                            padding: "2px 8px",
                            fontSize: "0.75rem",
                            width: "auto",
                            height: "26px",
                            borderRadius: "100px",
                            border: "1px dashed var(--border)",
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontWeight: 600
                          }}
                        >
                          <option value="">+ {isRtl ? "إضافة موظف" : "Add Operator"}</option>
                          {unassigned.map(u => (
                            <option key={u.employee_id} value={u.employee_id}>
                              {u.full_name}
                            </option>
                          ))}
                        </select>
                      ) : stageEmps.length === 0 ? (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {isRtl ? "لا يوجد موظفون متاحون" : "No available operators"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions footer */}
            <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--border-subtle)", paddingTop: 16, justifyContent: "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ التغييرات" : "Save Changes")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
