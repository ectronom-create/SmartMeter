import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Check, X, ShieldAlert, Award, FileText, ArrowRight, Save, Trash2, Edit3, ClipboardList } from "lucide-react";
import { supabase } from "../supabaseClient";

const STAGES = [
  { id: "assembly", name: "Assembly" },
  { id: "insulation", name: "Insulation Test" },
  { id: "rf", name: "RF Test" },
  { id: "calibration", name: "Calibration Stage" },
  { id: "multitest", name: "Multi Test Stage" },
  { id: "packaging", name: "Packaging" }
];

const COLUMNS = [
  { id: "o1", label: "Skills Grid", desc: "The operator appears in the skills grid (المشغل مسجل في شبكة المهارات)", category: "A- OPERATORS" },
  { id: "o2", label: "ESD protective", desc: "The operator wears his ESD protective equipment (المشغل يرتدي معدات الحماية من الشحنات ESD)", category: "A- OPERATORS" },
  { id: "d1", label: "Instructions present", desc: "Instruction work instruction present, readable, with last version and signed by all levels (تعليمات العمل موجودة، مقروءة، بالإصدار الأخير وموقعة)", category: "B- DOCUMENTATION" },
  { id: "d2", label: "1st lvl maintenance", desc: "1st level maintenance applied and completed (تطبيق وإكمال الصيانة الوقائية من المستوى الأول)", category: "B- DOCUMENTATION" },
  { id: "p1", label: "Necessary tools", desc: "Presence of the necessary means and tools according to the instruction work instruction (وجود الأدوات والوسائل اللازمة حسب تعليمات العمل)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "p2", label: "Traceability verification", desc: "Traceability verification and traceability locks activated (التحقق من التتبع وتفعيل أقفال التتبع)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "p3", label: "Outstanding IDs", desc: "Verification of outstanding identifications between work station (التحقق من الهويات المعلقة بين محطات العمل)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "p4", label: "Test program", desc: "Choice of test program is matched with the product (برنامج الفحص المختار مطابق للمنتج)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "p5", label: "Golden Unit", desc: "Passage of the Golden Not Good/Bench (تمرير عينة الفحص الذهبية Golden Unit)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "p6", label: "Packaging means", desc: "Check the presence of the means of packaging and the conformity of: BOX, cardboard plan and pallet, Certificate, LOGO... (التحقق من وجود وسائل التعبئة والتغليف ومطابقتها)", category: "C- PRODUCTION AND TEST MEANS" },
  { id: "c1", label: "Components FI", desc: "Items identified and compliant with the FI (المكونات معرفة ومطابقة لـ FI)", category: "D- COMPONENTS" },
  { id: "s1", label: "Scrap red zones", desc: "Presence of empty red zones on each workstations (وجود مناطق حمراء فارغة للمنتجات التالفة في كل محطة)", category: "E- SCRAP & Scrap" }
];

export default function StartOfProductionPage() {
  const navigate = useNavigate();
  const { currentUser, currentShift, getTodayString, language, t } = useApp();

  const isRtl = language === "ar";

  const [date, setDate] = useState(getTodayString());
  const [line, setLine] = useState("Three Phase");
  const [gridData, setGridData] = useState({}); // { stage_id: { col_id: 'OK' | 'NOK' | 'NA' } }
  
  // Bottom fields
  const [noConformity, setNoConformity] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [validationTL, setValidationTL] = useState("");
  const [validationQL, setValidationQL] = useState("");
  const [comment, setComment] = useState("");

  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load past reports from Supabase
  const loadReports = async () => {
    try {
      const { data, error } = await supabase.from("sop_reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error("Error loading SOP reports:", err);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Prepopulate validator name with supervisor name
  useEffect(() => {
    if (currentUser && currentUser.role === "supervisor" && !validationTL) {
      setValidationTL(currentUser.full_name);
    }
  }, [currentUser, validationTL]);

  const handleCellChange = (stageId, colId, status) => {
    setGridData(prev => {
      const currentVal = prev[stageId]?.[colId] || "";
      const nextVal = currentVal === status ? "" : status; // Click again to toggle off
      return {
        ...prev,
        [stageId]: {
          ...(prev[stageId] || {}),
          [colId]: nextVal
        }
      };
    });
  };

  const handleSave = async () => {
    const reportPayload = {
      id: activeReportId || `SOP-${Date.now()}`,
      date,
      line,
      grid_data: gridData,
      no_conformity: noConformity,
      analysis,
      validation_tl: validationTL,
      validation_ql: validationQL,
      comment,
      supervisor_name: currentUser?.full_name || "Unknown"
    };

    try {
      const existing = reports.find(r => r.id === activeReportId);
      if (existing) {
        await supabase.from("sop_reports").update(reportPayload).eq("id", activeReportId);
      } else {
        await supabase.from("sop_reports").insert([reportPayload]);
        setActiveReportId(reportPayload.id);
      }
      
      await loadReports();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Cloud Error saving SOP report:", err);
      alert(isRtl ? "حدث خطأ أثناء الحفظ في السحابة." : "Error saving to cloud.");
    }
  };

  const startNewReport = () => {
    setActiveReportId(null);
    setGridData({});
    setNoConformity("");
    setAnalysis("");
    setValidationTL(currentUser?.full_name || "");
    setValidationQL("");
    setComment("");
    setDate(getTodayString());
    setLine("Three Phase");
  };

  const loadReport = (r) => {
    setActiveReportId(r.id);
    setDate(r.date);
    setLine(r.line);
    setGridData(r.grid_data || {});
    setNoConformity(r.no_conformity || "");
    setAnalysis(r.analysis || "");
    setValidationTL(r.validation_tl || "");
    setValidationQL(r.validation_ql || "");
    setComment(r.comment || "");
  };

  const deleteReport = async (id) => {
    const confirmMsg = isRtl 
      ? "هل أنت متأكد من مسح هذا التقرير نهائياً من السحابة؟" 
      : "Are you sure you want to delete this report from the cloud?";
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await supabase.from("sop_reports").delete().eq("id", id);
      await loadReports();
      if (activeReportId === id) {
        startNewReport();
      }
    } catch (err) {
      console.error("Cloud Error deleting SOP report:", err);
    }
  };
  const categories = ["A- OPERATORS", "B- DOCUMENTATION", "C- PRODUCTION AND TEST MEANS", "D- COMPONENTS", "E- SCRAP & Scrap"];

  const getStageTranslatedName = (stage) => {
    if (stage.id === "assembly") return "Assembly";
    if (stage.id === "insulation") return "Insulation Test";
    if (stage.id === "rf") return "RF Test";
    if (stage.id === "calibration") return "Calibration Stage";
    if (stage.id === "multitest") return "Multi-Test Stage";
    if (stage.id === "packaging") return "Packaging";
    return stage.name;
  };

  const getColumnDescription = (col) => {
    if (isRtl) {
      const startIdx = col.desc.indexOf("(");
      const endIdx = col.desc.lastIndexOf(")");
      if (startIdx !== -1 && endIdx !== -1) {
        return col.desc.substring(startIdx + 1, endIdx);
      }
      return col.desc;
    } else {
      return col.desc.split("(")[0].trim();
    }
  };

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr", padding: "20px", fontFamily: isRtl ? "Cairo, sans-serif" : "Inter, system-ui, sans-serif" }}>
       {/* Top Controls */}
       <div style={{ display: "flex", justifyContent: isRtl ? "flex-start" : "flex-end", marginBottom: 20, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexDirection: isRtl ? "row" : "row-reverse" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/supervisor")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.95rem", padding: "8px 16px" }}>
              <ArrowRight size={16} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للوحة المشرف" : "Back to Supervisor Panel"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={startNewReport} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.95rem", padding: "8px 16px" }}>
              <ClipboardList size={16} /> {isRtl ? "تقرير جديد" : "New Report"}
            </button>
          </div>
       </div>

       <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Matrix & Form */}
          <div className="card" style={{ padding: "28px", background: "#fff", border: "2px solid #e2e8f0", borderRadius: "12px" }}>
           
           {/* Header Banner */}
           <div style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#fff", padding: "24px", borderRadius: "12px", textAlign: "center", marginBottom: 24, boxShadow: "0 4px 12px rgba(2, 132, 199, 0.2)" }}>
             <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.8rem" }}>START OF PRODUCTION _ ECTRON</h2>
             <p style={{ margin: "8px 0 0 0", fontSize: "1rem", opacity: 0.95 }}>{isRtl ? "تحقق متطلبات إعداد وبدء خط الإنتاج وتأكيد جاهزية المحطات" : "Line setup verification and workstation readiness check"}</p>
           </div>

           {/* Date & Line Inputs */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تاريخ الفحص (DATE)" : "Inspection Date (DATE)"}</label>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize: "0.95rem" }} />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "خط الإنتاج (Line)" : "Production Line (Line)"}</label>
                <select className="input" value={line} onChange={e => setLine(e.target.value)} style={{ fontSize: "0.95rem" }}>
                  <option value="Three Phase">{isRtl ? "خط ثلاثي الطور (Three Phase)" : "Three Phase Line"}</option>
                </select>
              </div>
            </div>

           {/* Matrix Form */}
           <h3 style={{ marginBottom: 16, color: "#0369a1", fontSize: "1.1rem", textAlign: isRtl ? "right" : "left" }}>{isRtl ? "جدول بنود التحقق للمحطات" : "Workstations Verification Checklist Matrix"}</h3>
           <div style={{ overflowX: "auto", border: "2px solid #0284c7", borderRadius: "10px", marginBottom: 24, background: "#fff" }}>
             <table style={{ minWidth: "1550px", borderCollapse: "collapse", fontSize: "0.9rem" }}>
               <thead>
                 <tr style={{ background: "#e0f2fe" }}>
                   <th rowSpan={2} style={{ padding: "14px", border: "1px solid #bae6fd", width: "160px", textAlign: isRtl ? "right" : "left", color: "#0369a1", fontWeight: 800 }}>{isRtl ? "محطة العمل (Workstation)" : "Workstation (Workstation)"}</th>
                   {categories.map(cat => {
                     const colCount = COLUMNS.filter(c => c.category === cat).length;
                     return (
                       <th key={cat} colSpan={colCount} style={{ padding: "10px", border: "1px solid #bae6fd", textAlign: "center", fontWeight: 800, color: "#0369a1", fontSize: "0.85rem" }}>
                         {cat}
                       </th>
                     );
                   })}
                 </tr>
                 <tr style={{ background: "#f8fafc" }}>
                   {COLUMNS.map(col => (
                     <th key={col.id} title={col.desc} style={{ padding: "10px 8px", border: "1px solid #cbd5e1", textAlign: "center", fontSize: "0.8rem", width: "88px", fontWeight: 700, color: "#0284c7" }}>
                       <div style={{ fontWeight: 800, marginBottom: 4, color: "#1e3a8a" }}>{col.label}</div>
                       <div style={{ fontSize: "0.7rem", color: "#0284c7", lineHeight: 1.2 }}>{getColumnDescription(col)}</div>
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {STAGES.map(stage => (
                   <tr key={stage.id} style={{ borderBottom: "1px solid #e2e8f0", background: stage.id % 2 === 0 ? "#f8fafc" : "#fff" }}>
                     <td style={{ padding: "14px", border: "1px solid #e2e8f0", fontWeight: 700, color: "#0369a1", background: "#f1f5f9", textAlign: isRtl ? "right" : "left" }}>
                       {getStageTranslatedName(stage)}
                     </td>
                     {COLUMNS.map(col => {
                       const cellVal = gridData[stage.id]?.[col.id] || "";
                       return (
                         <td key={col.id} style={{ border: "1px solid #e2e8f0", textAlign: "center", padding: "8px" }}>
                           <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                             <button 
                               onClick={() => handleCellChange(stage.id, col.id, "OK")}
                               title={isRtl ? "مطابق (OK)" : "Compliant (OK)"}
                               style={{ 
                                 border: "2px solid #22c55e", width: 36, height: 36, borderRadius: 6, cursor: "pointer",
                                 background: cellVal === "OK" ? "#22c55e" : "#fff",
                                 color: cellVal === "OK" ? "#fff" : "#22c55e",
                                 display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem", transition: "all 0.2s"
                               }}
                             >
                               ✓
                             </button>
                             <button 
                               onClick={() => handleCellChange(stage.id, col.id, "NOK")}
                               title={isRtl ? "غير مطابق (Not OK)" : "Non-Compliant (Not OK)"}
                               style={{ 
                                 border: "2px solid #ef4444", width: 36, height: 36, borderRadius: 6, cursor: "pointer",
                                 background: cellVal === "NOK" ? "#ef4444" : "#fff",
                                 color: cellVal === "NOK" ? "#fff" : "#ef4444",
                                 display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem", transition: "all 0.2s"
                               }}
                             >
                               ✕
                             </button>
                           </div>
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>

           {/* Non-conformity Analysis */}
           <div className="grid-2" style={{ marginBottom: 24 }}>
             <div className="input-group">
               <label className="input-label" style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تفاصيل عدم المطابقة (Detail of no-conformity)" : "Details of Non-Conformity"}</label>
               <textarea className="input" rows={3} value={noConformity} onChange={e => setNoConformity(e.target.value)} placeholder={isRtl ? "اذكر أي ملاحظات أو مشاكل تم رصدها..." : "Describe any noted issues or deviations..."} style={{ resize: "none", fontSize: "0.95rem" }} />
             </div>
             <div className="input-group">
               <label className="input-label" style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التحليل والإجراء (Analysis)" : "Analysis & Corrective Action (Analysis)"}</label>
               <textarea className="input" rows={3} value={analysis} onChange={e => setAnalysis(e.target.value)} placeholder={isRtl ? "كيف تم التعامل مع عدم المطابقة؟..." : "How was the non-conformity handled?..."} style={{ resize: "none", fontSize: "0.95rem" }} />
             </div>
           </div>

           {/* Validation & Comment Section */}
           <div className="grid-3" style={{ marginBottom: 24, borderTop: "2px solid #0284c7", paddingTop: 20 }}>
             <div className="input-group">
               <label className="input-label" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#0369a1", marginBottom: 6, justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                 <Award size={15} style={{ color: "#eab308" }} /> {isRtl ? "توقيع قائد الفريق (Validation Team Leader)" : "Team Leader Signature (Validation TL)"}
               </label>
               <input className="input" type="text" value={validationTL} onChange={e => setValidationTL(e.target.value)} placeholder={isRtl ? "اسم قائد الفريق المعتمد..." : "Authorized Team Leader name..."} style={{ fontSize: "0.95rem" }} />
             </div>
             <div className="input-group">
               <label className="input-label" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#0369a1", marginBottom: 6, justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                 <Award size={15} style={{ color: "#22c55e" }} /> {isRtl ? "توقيع قائد الجودة (Validation Quality leader)" : "Quality Leader Signature (Validation QL)"}
               </label>
               <input className="input" type="text" value={validationQL} onChange={e => setValidationQL(e.target.value)} placeholder={isRtl ? "توقيع مسؤول الجودة..." : "Quality Inspector name..."} style={{ fontSize: "0.95rem" }} />
             </div>
             <div className="input-group">
               <label className="input-label" style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>{isRtl ? "ملاحظات عامة (Comment)" : "General Comments (Comment)"}</label>
               <textarea className="input" rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder={isRtl ? "أي تعليق إضافي..." : "Any additional comments..."} style={{ resize: "none", fontSize: "0.95rem" }} />
             </div>
           </div>

           {/* Save Buttons & Notifications */}
           <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 15, flexDirection: isRtl ? "row" : "row-reverse" }}>
             {savedSuccess && (
               <div style={{ color: "#22c55e", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontSize: "1rem", background: "#f0fdf4", padding: "8px 16px", borderRadius: "8px" }}>
                 <Check size={20} /> {isRtl ? "تم حفظ وتوقيع التقرير بنجاح!" : "Report saved and signed successfully!"}
               </div>
             )}
             <button onClick={handleSave} className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
               <Save size={18} /> {isRtl ? "حفظ وتوقيع التقرير (Save & Sign)" : "Save & Sign Report"}
             </button>
           </div>

          </div>
       </div>
    </div>
  );
}
