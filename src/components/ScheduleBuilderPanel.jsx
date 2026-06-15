import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Play, Save, RefreshCw, Star, Trash2, ChevronRight, Check, Info } from "lucide-react";

const getSteps = (isRtl) => [
  isRtl ? "إعداد الشفت" : "Shift Settings", 
  isRtl ? "تعيين الموظفين" : "Assign Operators", 
  isRtl ? "معاينة وحفظ" : "Preview & Save"
];

const getDayLabel = (d, isRtl) => {
  const DAY_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return isRtl ? DAY_AR[d.getDay()] : DAY_EN[d.getDay()];
};

const STAGE_COLORS = { "STG-01":"#f97316","STG-02":"#8250df","STG-03":"#0550ae","STG-04":"#1a7f37","STG-05":"#e91e63" };

function StepIndicator({ current, isRtl }) {
  const STEPS = getSteps(isRtl);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24, flexDirection: isRtl ? "row" : "row-reverse" }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none", flexDirection: isRtl ? "row" : "row-reverse" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.85rem",
              background: i < current ? "var(--accent)" : i === current ? "#dafbe1" : "var(--bg-elevated)",
              color: i < current ? "#fff" : i === current ? "var(--accent)" : "var(--text-muted)",
              border: i === current ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.3s"
            }}>
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: i === current ? "var(--accent)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? "var(--accent)" : "var(--border)", margin: "0 6px", marginBottom: 18, transition: "background 0.3s" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ScheduleBuilderPanel() {
  const { users, production_stages, shift_types, generateRotationSchedule, saveGeneratedSchedule, schedules, language } = useApp();

  const isRtl = language === "ar";

  const [step, setStep] = useState(0);

  // Step 0 state
  const [shiftId, setShiftId]           = useState("SHIFT-M");
  const [startDate, setStartDate]       = useState(new Date().toISOString().split("T")[0]);
  const [numDays, setNumDays]           = useState(7);
  const [rotationOffset, setRotation]   = useState(1);
  const [shiftSupervisor, setSupervisor] = useState("");
  const [supervisorStage, setSupervisorStage] = useState("");

  // Step 1 state
  const [assignments, setAssignments]   = useState({});
  const [teamLeaders, setTeamLeaders]   = useState({});

  // Step 2 state
  const [preview, setPreview]           = useState([]);
  const [saved, setSaved]               = useState(false);
  const [isSaving, setIsSaving]         = useState(false);

  const operators = users.filter(u => u.role !== "admin");
  const supervisors = users.filter(u => u.role === "supervisor");
  const assignedIds = Object.values(assignments).flat();
  
  const unassigned = useMemo(() => {
    return operators.filter(u => {
      if (assignedIds.includes(u.employee_id)) return false;
      const isBusy = schedules.some(s => 
        s.employee_id === u.employee_id && 
        s.schedule_date === startDate && 
        s.shift_id !== shiftId
      );
      return !isBusy;
    });
  }, [operators, assignedIds, schedules, startDate, shiftId]);

  const toggleEmployee = (stageId, empId) => {
    setAssignments(prev => {
      const current = prev[stageId] || [];
      const exists  = current.includes(empId);
      const cleaned = Object.fromEntries(
        Object.entries(prev).map(([sid, arr]) => [sid, arr.filter(id => id !== empId)])
      );
      return { ...cleaned, [stageId]: exists ? current.filter(id => id !== empId) : [...(cleaned[stageId] || []), empId] };
    });
    setTeamLeaders(prev => {
      if (prev[stageId] === empId) return { ...prev, [stageId]: null };
      return prev;
    });
  };

  const setLeader = (stageId, empId) => {
    setTeamLeaders(prev => ({ ...prev, [stageId]: prev[stageId] === empId ? null : empId }));
  };

  const handleGenerate = () => {
    const entries = generateRotationSchedule({ 
      shift_id: shiftId, 
      startDate, 
      numDays, 
      initialAssignments: assignments, 
      rotationOffset, 
      teamLeaders,
      shiftSupervisor
    });
    setPreview(entries);
    setStep(2);
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveGeneratedSchedule(preview);
    setIsSaving(false);
    if (res && res.success) {
      setSaved(true);
    } else {
      alert(isRtl ? "فشل حفظ الجدول في قاعدة البيانات. يرجى التحقق من الاتصال." : "Failed to save the roster plan to the database. Please check your connection.");
    }
  };

  const grouped = useMemo(() => {
    return preview.reduce((acc, e) => {
      if (!acc[e.schedule_date]) acc[e.schedule_date] = [];
      acc[e.schedule_date].push(e);
      return acc;
    }, {});
  }, [preview]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      <div>
        <h2 style={{ marginBottom: 2 }}>{isRtl ? "بناء جدول المناوبات" : "Shift Roster Planner"}</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          {isRtl ? "حدّد الموظفين لكل مرحلة ثم وِّلِّد الروتيشن التلقائي" : "Allocate operators for each workstation, then auto-generate shift schedules"}
        </p>
      </div>

      <div className="card">
        <StepIndicator current={step} isRtl={isRtl} />

        {/* STEP 0 */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2">
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "نوع الشفت" : "Shift Type"}</label>
                <select className="input" value={shiftId} onChange={e => setShiftId(e.target.value)}>
                  {shift_types.map(s => (
                    <option key={s.shift_id} value={s.shift_id}>
                      {isRtl ? "شفت" : "Shift"} {getTranslatedShiftName(s.shift_id, isRtl)} ({s.start_time}–{s.end_time})
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تاريخ البداية" : "Start Date"}</label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "عدد الأيام" : "Duration (Days)"}</label>
                <input className="input" type="number" min={1} max={30} value={numDays} onChange={e => setNumDays(+e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "إزاحة الروتيشن (مراحل/يوم)" : "Rotation Offset (stages/day)"}</label>
                <select className="input" value={rotationOffset} onChange={e => setRotation(+e.target.value)}>
                  <option value={0}>{isRtl ? "إزاحة 0 — ثبات الموظف في نفس المرحلة يومياً" : "Offset 0 — Constant assignment (no rotation)"}</option>
                  <option value={1}>{isRtl ? "إزاحة 1 — ينتقل مرحلة واحدة كل يوم" : "Offset 1 — Shifts one workstation right each day"}</option>
                  <option value={2}>{isRtl ? "إزاحة 2 — ينتقل مرحلتين كل يوم" : "Offset 2 — Shifts two workstations right each day"}</option>
                  <option value={3}>{isRtl ? "إزاحة 3 — ينتقل ثلاث مراحل كل يوم" : "Offset 3 — Shifts three workstations right each day"}</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "مشرف المناوبة (Shift Supervisor)" : "Shift Supervisor"}</label>
                <select className="input" value={shiftSupervisor} onChange={e => {
                  setSupervisor(e.target.value);
                  if (!e.target.value) setSupervisorStage("");
                }}>
                  <option value="">-- {isRtl ? "اختر مشرفاً لهذه المناوبة" : "Select Shift Supervisor"} --</option>
                  {supervisors.map(s => (
                    <option key={s.employee_id} value={s.employee_id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              {shiftSupervisor && (
                <div className="input-group animate-fade">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "محطة عمل المشرف على الخط" : "Supervisor Active Station"}</label>
                  <select className="input" value={supervisorStage} onChange={e => setSupervisorStage(e.target.value)}>
                    <option value="">-- {isRtl ? "اختر محطة لتعيين المشرف فيها" : "Select station for supervisor"} --</option>
                    {production_stages.filter(stg => stg.stage_id !== "GLOBAL").map(stg => (
                      <option key={stg.stage_id} value={stg.stage_id}>{getTranslatedStageName(stg, isRtl)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="alert alert-info" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <Info size={15} />
              <span>
                {isRtl ? (
                  <>سيتم توليد <strong>{numDays}</strong> يوم بدءاً من <strong>{startDate}</strong> لشفت <strong>{getTranslatedShiftName(shiftId, isRtl)}</strong> مع إزاحة <strong>{rotationOffset}</strong> مرحلة/يوم.</>
                ) : (
                  <>Will generate <strong>{numDays}</strong> days starting from <strong>{startDate}</strong> for <strong>{getTranslatedShiftName(shiftId, isRtl)}</strong> with a <strong>{rotationOffset}</strong>-stage rotation.</>
                )}
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => {
              if (shiftSupervisor && !supervisorStage) {
                alert(isRtl ? "يرجى اختيار محطة عمل المشرف أولاً." : "Please select active workstation stage for supervisor first.");
                return;
              }
              if (shiftSupervisor && supervisorStage) {
                setAssignments(prev => {
                  const cleaned = Object.fromEntries(
                    Object.entries(prev).map(([sid, arr]) => [sid, arr.filter(id => id !== shiftSupervisor)])
                  );
                  return {
                    ...cleaned,
                    [supervisorStage]: [shiftSupervisor, ...(cleaned[supervisorStage] || [])]
                  };
                });
              }
              setStep(1);
            }} style={{ flexDirection: isRtl ? "row" : "row-reverse", justifyContent: "center", gap: 10 }}>
              <span>{isRtl ? "التالي: تعيين الموظفين" : "Next: Assign Operators"}</span>
              <ChevronRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />
            </button>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {unassigned.length > 0 && (
              <div className="alert alert-warning" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
                <Info size={15} />
                <span>
                  {isRtl ? "موظفون غير مُعيَّنون" : "Unassigned Operators"} ({unassigned.length}): {unassigned.map(u => u.full_name.split(" ")[0]).join("، ")}
                </span>
              </div>
            )}

            {production_stages.filter(stage => stage.stage_id !== "GLOBAL").map(stage => {
              const color = STAGE_COLORS[stage.stage_id] || "var(--accent)";
              const stageEmps = (assignments[stage.stage_id] || []);
              return (
                <div key={stage.stage_id} style={{ border: `1px solid ${color}44`, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ 
                    background: `${color}11`, 
                    padding: "10px 16px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 10, 
                    borderBottom: `1px solid ${color}33`,
                    flexDirection: isRtl ? "row" : "row-reverse"
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>{stage.icon}</span>
                    <span style={{ fontWeight: 700, color }}>{getTranslatedStageName(stage, isRtl)}</span>
                    <span className="badge badge-gray">{stage.stage_id}</span>
                    <span style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {stageEmps.length} {isRtl ? "موظفين" : "Operators"}
                    </span>
                  </div>

                  <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                    {stageEmps.map(empId => {
                      const emp = users.find(u => u.employee_id === empId);
                      const isLeader = teamLeaders[stage.stage_id] === empId;
                      const canBeLeader = emp?.role === "supervisor";
                      
                      return (
                        <div key={empId} style={{ 
                          display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", 
                          borderRadius: "100px", 
                          background: isLeader ? "#fff8c5" : "#dafbe1", 
                          border: `1px solid ${isLeader ? "#d4a72c66" : "#aceebb"}`, 
                          fontSize: "0.85rem", fontWeight: 600,
                          flexDirection: isRtl ? "row" : "row-reverse"
                        }}>
                          <button 
                            title={canBeLeader ? (isRtl ? "تعيين كقائد فريق" : "Set as Team Leader") : (isRtl ? "لا يمكن تعيين هذا الموظف كقائد (يجب أن يكون مشرفاً)" : "Team Leader must have Supervisor rank")}
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
                            <Star size={13} fill={isLeader ? "currentColor" : "none"} />
                          </button>
                          <span style={{ color: isLeader ? "#9a6700" : "var(--accent)" }}>
                            {emp?.full_name?.split(" ")[0]} {emp?.full_name?.split(" ")[1] || ""}
                            {canBeLeader && <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginLeft: 4 }}>({isRtl ? "مشرف" : "Supervisor"})</span>}
                          </span>
                          <button onClick={() => toggleEmployee(stage.stage_id, empId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "center" }}>✕</button>
                        </div>
                      );
                    })}

                    {unassigned.map(emp => (
                      <button key={emp.employee_id} onClick={() => toggleEmployee(stage.stage_id, emp.employee_id)}
                        style={{ padding: "5px 12px", borderRadius: "100px", background: "var(--bg-elevated)", border: "1px dashed var(--border)", cursor: "pointer", fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, fontFamily: "Cairo, sans-serif" }}>
                        + {emp.full_name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)}>{isRtl ? "← رجوع" : "← Back"}</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={Object.values(assignments).flat().length === 0}>
                <Play size={14} /> {isRtl ? "توليد الجدول التلقائي" : "Auto-Generate Daily Roster"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="alert alert-info" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <Info size={15} />
              <span>
                {isRtl ? (
                  <>تم توليد <strong>{preview.length}</strong> سجل لـ <strong>{numDays}</strong> يوم. راجع الجدول ثم احفظه.</>
                ) : (
                  <>Generated <strong>{preview.length}</strong> shift entries for <strong>{numDays}</strong> days. Review and save below.</>
                )}
              </span>
            </div>

            {saved && <div className="alert alert-success"><Check size={15} /> {isRtl ? "تم حفظ الجدول بنجاح!" : "Shift schedules saved successfully!"}</div>}

            <div className="table-wrapper" style={{ maxHeight: 450, overflowY: "auto" }}>
              <table style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ width: 140, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التاريخ" : "Date"}</th>
                    {production_stages.filter(s => s.stage_id !== "GLOBAL").map(s => (
                      <th key={s.stage_id} style={{ textAlign: "center", minWidth: 120 }}>
                        <div style={{ fontSize: "1.1rem" }}>{s.icon}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{getTranslatedStageName(s, isRtl)}</div>
                      </th>
                    ))}
                    <th style={{ textAlign: "center", minWidth: 120, background: "#f0fdf4" }}>
                      <div style={{ fontSize: "1.1rem" }}>👑</div>
                      <div style={{ fontSize: "0.7rem", color: "#166534" }}>{isRtl ? "المشرف" : "Supervisor"}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).sort().map(([date, entries]) => {
                    const d = new Date(date + "T00:00:00");
                    return (
                      <tr key={date}>
                        <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                          <div style={{ color: "var(--accent)" }}>{getDayLabel(d, isRtl)}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{date}</div>
                        </td>
                        {production_stages.filter(stage => stage.stage_id !== "GLOBAL").map(stage => {
                          const stageAssignments = entries.filter(e => e.stage_id === stage.stage_id);
                          return (
                            <td key={stage.stage_id} style={{ verticalAlign: "top", padding: "8px 4px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                                {stageAssignments.map(e => {
                                  const emp = users.find(u => u.employee_id === e.employee_id);
                                  return (
                                    <div key={e.id} style={{ 
                                      padding: "3px 8px", 
                                      borderRadius: 4, 
                                      background: e.is_team_leader ? "#fff8c5" : "var(--bg-elevated)",
                                      border: `1px solid ${e.is_team_leader ? "#d4a72c44" : "var(--border-subtle)"}`,
                                      fontSize: "0.78rem",
                                      width: "100%",
                                      textAlign: "center"
                                    }}>
                                      {emp?.full_name.split(" ")[0]}
                                      {e.is_team_leader && <Star size={10} fill="#9a6700" color="#9a6700" style={{ marginRight: 4 }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                        {/* Supervisor Column */}
                        <td style={{ verticalAlign: "top", padding: "8px 4px" }}>
                          {entries.filter(e => e.stage_id === "SUPERVISION").map(e => {
                            const emp = users.find(u => u.employee_id === e.employee_id);
                            return (
                              <div key={e.id} style={{ 
                                padding: "4px 8px", 
                                borderRadius: 4, 
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                color: "#166534",
                                textAlign: "center"
                              }}>
                                👑 {emp?.full_name.split(" ")[0]}
                              </div>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)} disabled={isSaving}>{isRtl ? "← تعديل" : "← Edit"}</button>
              <button className="btn btn-ghost" onClick={() => { setStep(0); setAssignments({}); setPreview([]); setSaved(false); }} disabled={isSaving}>
                <RefreshCw size={14} /> {isRtl ? "بدء من جديد" : "Reset & Start Over"}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saved || isSaving}>
                <Save size={14} /> {isSaving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (saved ? (isRtl ? "تم الحفظ" : "Saved") : (isRtl ? "حفظ الجدول" : "Save Roster Plan"))}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
