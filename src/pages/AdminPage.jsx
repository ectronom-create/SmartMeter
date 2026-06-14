import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Users, Calendar, AlertTriangle, BarChart2, Shield, BookOpen, ChevronRight, CheckCircle, Clock, Layers, X, Search, ClipboardList, Wrench, Package, Plus } from "lucide-react";
import MaintenancePage from "./MaintenancePage";
import { AssetsPanel } from "./AssetsPage";
import UsersPanel from "../components/UsersPanel";
import ShiftSchedulesPanel from "../components/ShiftSchedulesPanel";
import StagesPanel from "../components/StagesPanel";
import FPYDashboard from "../components/FPYDashboard";
import { translateError, TranslateText, TranslateSteps } from "./KnowledgeBasePage";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import CountdownTimer from "../components/CountdownTimer";


const STAGE_COLORS = { 
  "STG-01": "#f97316", "STG-02": "#4f46e5", 
  "STG-03": "#06b6d4", "STG-04": "#10b981", 
  "STG-05": "#8b5cf6", "STG-06": "#ec4899",
  "GLOBAL": "#0550ae"
};

function OverviewPanel() {
  return <FPYDashboard />;
}

function DefectsPanel() {
  const { defectiveMeters, getErrorByCode, getUserById, getStageById, updateMeterStatus, language } = useApp();
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [newStatus, setNewStatus] = useState("");

const isRtl = language === "ar";

  const handleExportExcel = () => {
    try {
      const stageNames = {
        "STG-01": "Assembly", 
        "STG-02": "Insulation",
        "STG-03": "Radio Frequency", 
        "STG-04": "Calibration", 
        "STG-05": "Multi Test", 
        "STG-06": "Perso"
      };

      const STATUS_LABELS = {
        pending:  isRtl ? "قيد الانتظار" : "Pending Review",
        verified: isRtl ? "تم التحقق (معطوب)" : "Verified Defective",
        resolved: isRtl ? "يعود لخط الانتاج" : "Returned to Line",
        reported: isRtl ? "بلاغ جديد" : "New Report"
      };

      const formatDate = (iso) => {
        const d = new Date(iso);
        if (isRtl) {
          return `${d.toLocaleDateString("ar-SA")} · ${d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`;
        } else {
          return `${d.toLocaleDateString("en-US")} · ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
        }
      };

      const dataToExport = defectiveMeters.map(m => {
        const err = m.error_code ? getErrorByCode(m.error_code) : null;
        const trans = err ? translateError(err, isRtl) : null;
        const statusText = STATUS_LABELS[m.status] || m.status;
        const stageText = stageNames[m.stage_found] || m.stage_found;
        const rep = getUserById(m.reported_by);
        const reporterName = rep?.full_name || m.reported_by || "—";
        const res = getUserById(m.resolved_by);
        const resolverName = res?.full_name || m.resolved_by || "—";
        
        if (isRtl) {
          return {
            "الرقم التسلسلي (سيريال)": m.serial_number,
            "رمز العطل": m.error_code || "—",
            "وصف العطل": trans?.title || m.custom_description || "—",
            "المرحلة": stageText || "—",
            "المُبلِّغ": reporterName,
            "الحالة": statusText || "—",
            "تاريخ البلاغ": formatDate(m.created_at),
            "المُعدِّل / المعالج": resolverName,
            "تاريخ آخر تعديل": m.resolved_at ? formatDate(m.resolved_at) : "—"
          };
        } else {
          return {
            "Serial Number": m.serial_number,
            "Error Code": m.error_code || "—",
            "Error Title": trans?.title || m.custom_description || "—",
            "Stage Found": stageText || "—",
            "Reported By": reporterName,
            "Status": statusText || "—",
            "Date Reported": formatDate(m.created_at),
            "Modified By": resolverName,
            "Date Modified": m.resolved_at ? formatDate(m.resolved_at) : "—"
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isRtl ? "العدادات المعطوبة" : "Defective Meters");
      XLSX.writeFile(workbook, isRtl ? "سجل_العدادات_المعطوبة.xlsx" : "defective_meters_report.xlsx");
    } catch (error) {
      console.error("Excel export error for defects:", error);
    }
  };

  const STATUS = {
    reported: { label: isRtl ? "بلاغ جديد" : "New Report",           cls: "badge-blue",  icon: <Plus size={12} /> },
    pending:  { label: isRtl ? "قيد الانتظار" : "Pending Review",           cls: "badge-amber", icon: <Clock size={12} /> },
    verified: { label: isRtl ? "تم التحقق (معطوب)" : "Verified Defective",     cls: "badge-red",   icon: <AlertTriangle size={12} /> },
    resolved: { label: isRtl ? "يعود لخط الانتاج" : "Returned to Line",       cls: "badge-green", icon: <CheckCircle size={12} /> },
  };

  const pendingMeters = defectiveMeters.filter(m => m.status === "pending");
  const filteredPending = pendingMeters.filter(m => 
    m.serial_number.includes(reviewSearch.trim().toUpperCase())
  );

  const handleStatusChange = (id, status, fromModal = false) => {
    updateMeterStatus(id, status);
    if (fromModal) {
      setConfirmingId(null);
      setNewStatus("");
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16, textAlign: isRtl ? "right" : "left"}}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{marginBottom:2}}>{isRtl ? "إدارة العدادات المعطوبة" : "Defective Meters Management"}</h2>
          <p style={{fontSize:"0.85rem"}}>{defectiveMeters.length} {isRtl ? "سجل — التحكم الكامل في الحالات" : "records — Full quality lifecycle control"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexDirection: isRtl ? "row" : "row-reverse" }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportExcel}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(9, 105, 218, 0.08)", border: "1px solid rgba(9, 105, 218, 0.2)", color: "var(--blue)" }}
          >
            📤 {isRtl ? "تنزيل إكسل" : "Export Excel"}
          </button>
          <button className="btn btn-primary" onClick={() => setReviewModal(true)} style={{ gap: 8 }}>
            <Search size={16} /> {isRtl ? "معاينة العدادات قيد الانتظار" : "Review Pending Quality Gate"}
            {pendingMeters.length > 0 && (
              <span style={{ background: "white", color: "var(--accent)", padding: "0 6px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800 }}>
                {pendingMeters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:12,flexWrap:"wrap", flexDirection: isRtl ? "row" : "row-reverse"}}>
        {Object.entries(STATUS).map(([k,v])=>{
          const count=defectiveMeters.filter(m=>m.status===k).length;
          return <div key={k} className="stat-card" style={{padding:"12px 18px",gap:10, flexDirection: isRtl ? "row" : "row-reverse"}}><span className={`badge ${v.cls}`}>{count}</span><span style={{fontSize:"0.85rem",fontWeight:600}}>{v.label}</span></div>;
        })}
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrapper" style={{border:"none"}}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "السيريال نمبر" : "Serial Number"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الكود" : "Code"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المرحلة" : "Stage"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الوصف" : "Description"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المُبلِّغ" : "Reported By"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التاريخ" : "Date"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الحالة" : "Status"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المُعدِّل / المعالج" : "Modified By"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تغيير الحالة" : "Change Status"}</th>
              </tr>
            </thead>
            <tbody>
              {defectiveMeters.map(m=>{
                const err=m.error_code?getErrorByCode(m.error_code):null;
                const trans = err ? translateError(err, isRtl) : null;
                const rep=getUserById(m.reported_by);
                const sc=STATUS[m.status]||STATUS.pending;
                const stage=getStageById(m.stage_found);
                const stageDisplay = stage ? (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name) : m.stage_found;
                return (
                  <tr key={m.id}>
                    <td><code style={{fontFamily:"monospace",fontSize:"0.83rem",color:"var(--blue)"}}>{m.serial_number}</code></td>
                    <td>{m.error_code?<span className="badge badge-amber" style={{fontFamily:"monospace"}}>{m.error_code}</span>:<span className="badge badge-gray">—</span>}</td>
                    <td>
                      <span className="badge badge-gray" style={{ gap: 4, display: "inline-flex", alignItems: "center" }}>
                        {stage?.icon} {stageDisplay}
                      </span>
                    </td>
                    <td style={{ maxWidth: 250 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: isRtl ? "right" : "left" }}>
                        <span style={{ fontWeight: 600 }}>{trans?.title || m.error_code || "—"}</span>
                        {m.custom_description && (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "normal", wordBreak: "break-word" }}>
                            💬 <TranslateText text={m.custom_description} targetLang={isRtl ? "ar" : "en"} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{fontSize:"0.85rem"}}>{rep?.full_name||m.reported_by}</td>
                    <td style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>
                      {isRtl ? new Date(m.created_at).toLocaleDateString("ar-SA") : new Date(m.created_at).toLocaleDateString("en-US")}
                    </td>
                    <td>
                      <span className={`badge ${sc.cls}`}>{sc.label}</span>
                      {m.status === "resolved" && (
                        <CountdownTimer resolvedAt={m.resolved_at} isRtl={isRtl} />
                      )}
                    </td>
                    <td>
                      {m.resolved_by ? (
                        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                          👤 {getUserById(m.resolved_by)?.full_name || m.resolved_by}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>—</span>
                      )}
                    </td>
                    <td>
                      <select className="input" style={{padding:"4px 8px",fontSize:"0.8rem",width:"auto"}} value={m.status} onChange={e=>handleStatusChange(m.id,e.target.value)}>
                        <option value="reported">{isRtl ? "بلاغ جديد" : "New Report"}</option>
                        <option value="pending">{isRtl ? "قيد الانتظار" : "Pending Review"}</option>
                        <option value="verified">{isRtl ? "تم التحقق (معطوب)" : "Verified Defective"}</option>
                        <option value="resolved">{isRtl ? "يعود لخط الانتاج" : "Returned to Line"}</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 650, maxHeight: "85vh", display: "flex", flexDirection: "column", direction: isRtl ? "rtl" : "ltr" }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <Clock size={20} style={{ color: "var(--amber)" }} />
                <h3 style={{ margin: 0 }}>{isRtl ? "مراجعة سريعة (قيد الانتظار)" : "Pending Review List"}</h3>
              </div>
              <button className="btn-close" onClick={() => { setReviewModal(false); setReviewSearch(""); setConfirmingId(null); }}>✕</button>
            </div>
            
            <div style={{ padding: 16, background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "البحث عن سيريال معين" : "Quick Search by Serial Number"}</label>
                <div style={{ position: "relative" }}>
                  <input 
                    className="input" 
                    value={reviewSearch} 
                    onChange={e => setReviewSearch(e.target.value)} 
                    placeholder={isRtl ? "اكتب السيريال..." : "Type serial number..."}
                    style={{ paddingRight: isRtl ? 35 : 12, paddingLeft: !isRtl ? 35 : 12, textAlign: isRtl ? "right" : "left" }}
                    autoFocus
                  />
                  <Search size={16} style={{
                    position: "absolute",
                    right: isRtl ? 10 : "auto",
                    left: !isRtl ? 10 : "auto",
                    top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
                  }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {filteredPending.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  <CheckCircle size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>{isRtl ? "لا توجد بلاغات معلقة" : "No pending reports found"} {reviewSearch ? (isRtl ? "تطابق البحث" : "matching search") : ""}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredPending.map(m => {
                    const isConfirming = confirmingId === m.id;
                    const stage = getStageById(m.stage_found);
                    const stageDisplay = stage ? (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name) : m.stage_found;
                    return (
                      <div key={m.id} className="card" style={{ 
                        padding: 12, 
                        background: isConfirming ? "#f0f7ff" : "white", 
                        border: isConfirming ? "1px solid var(--blue)" : "1px solid var(--border-subtle)",
                        textAlign: isRtl ? "right" : "left"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <code style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--blue)" }}>{m.serial_number}</code>
                          <span className="badge badge-gray" style={{ gap: 4, display: "inline-flex", alignItems: "center" }}>
                            {stage?.icon} {stageDisplay}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
                          <span style={{ fontWeight: 700 }}>{isRtl ? "العطل:" : "Fault Code:"}</span> {m.error_code}
                        </div>

                        <div className="divider" style={{ margin: "10px 0" }} />

                        {isConfirming ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                              {isRtl ? "تأكيد النقل إلى:" : "Confirm state to:"} <span className={`badge ${STATUS[newStatus].cls}`}>{STATUS[newStatus].label}</span>?
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(m.id, newStatus, true)}>{isRtl ? "حفظ" : "Save"}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(null)}>{isRtl ? "إلغاء" : "Cancel"}</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: "0.75rem" }} onClick={() => { setConfirmingId(m.id); setNewStatus("verified"); }}>
                              {isRtl ? "تأكيد العطل" : "Confirm Defect"}
                            </button>
                            <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: "0.75rem", background: "var(--accent)" }} onClick={() => { setConfirmingId(m.id); setNewStatus("resolved"); }}>
                              {isRtl ? "يعود للإنتاج" : "Return to Line"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="modal-header" style={{ background: "var(--bg-elevated)", padding: "10px 20px", flexDirection: isRtl ? "row" : "row-reverse" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setReviewModal(false)}>{isRtl ? "إغلاق" : "Close"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorCodesPanel() {
  const { errorCodes, production_stages, getStageById, addErrorCode, updateErrorCode, deleteErrorCode, addErrorCodesBulk, language } = useApp();
  const [modal, setModal] = useState({ show: false, editMode: false, data: null });
  const [formData, setFormData] = useState({
    code: "",
    stage_id: "STG-01",
    title: "",
    description: "",
    troubleshooting: ""
  });
  const [importStatus, setImportStatus] = useState(null);
  const [previewRows, setPreviewRows] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isRtl = language === "ar";

  const filteredErrorCodes = errorCodes.filter(e => {
    const stage = getStageById(e.stage_id);
    const stageName = stage ? (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name) : "";
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (e.code || "").toLowerCase().includes(query) ||
      (e.title_ar || "").toLowerCase().includes(query) ||
      (e.title_en || "").toLowerCase().includes(query) ||
      (e.description || "").toLowerCase().includes(query) ||
      stageName.toLowerCase().includes(query)
    );
  });

  const mapStageNameOrId = (val, stages) => {
    if (!val) return "STG-01";
    const str = val.toString().trim().toUpperCase();
    if (str.startsWith("STG-")) return str;
    
    const digitsOnly = str.replace(/\D/g, "");
    if (digitsOnly) {
      const num = parseInt(digitsOnly, 10);
      if (num >= 1 && num <= 6) return `STG-0${num}`;
    }

    const normalized = str.toLowerCase();
    const matched = stages.find(s => 
      s.stage_id.toLowerCase() === normalized ||
      s.stage_name.toLowerCase().includes(normalized) ||
      (s.short_name && s.short_name.toLowerCase().includes(normalized))
    );
    return matched ? matched.stage_id : "STG-01";
  };

  const downloadTemplate = () => {
    const headers = [["Code", "Stage", "Title Arabic", "Title English", "Description", "Troubleshooting Steps"]];
    const sampleData = [
      ["-101", "STG-01", "خطأ SFC - فشل استرداد البيانات", "SFC Error - Data Retrieval Failed", "فشل استرداد بيانات التصنيع من نظام SFC.", "Check network connection to the server.\nScan the barcode again."],
      ["-576", "Assembly", "خطأ اتصال - تعذّر التواصل مع العداد", "Connection Error - Failed to Communicate", "فشل التواصل المادي مع العداد عبر المنفذ.", "Verify interface cable\nPower cycle system"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "error_codes_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportStatus({ 
      type: "info", 
      text: isRtl ? "جاري قراءة وتحليل ملف الاكسل..." : "Reading and parsing Excel file..." 
    });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl ? "ملف الاكسل فارغ أو لا يحتوي على صفوف بيانات!" : "Excel file is empty or has no data rows!" 
          });
          return;
        }

        const headers = rows[0].map(h => (h || "").toString().toLowerCase().trim());
        
        const codeIdx = headers.findIndex(h => h.includes("code") || h.includes("الكود") || h.includes("كود") || h.includes("رمز"));
        const stageIdx = headers.findIndex(h => h.includes("stage") || h.includes("المرحلة") || h.includes("مرحلة"));
        const titleArIdx = headers.findIndex(h => h.includes("arabic") || h.includes("ar") || h.includes("العربية") || h.includes("العربي") || h === "title");
        const titleEnIdx = headers.findIndex(h => h.includes("english") || h.includes("en") || h.includes("الإنجليزية") || h.includes("الانجليزية") || h.includes("الانجليزي"));
        const descIdx = headers.findIndex(h => h.includes("description") || h.includes("الوصف"));
        const stepsIdx = headers.findIndex(h => h.includes("steps") || h.includes("troubleshooting") || h.includes("خطوات") || h.includes("الإصلاح") || h.includes("الاصلاح"));

        // Support fallback if only one title column is provided
        let finalTitleArIdx = titleArIdx;
        let finalTitleEnIdx = titleEnIdx;
        if (finalTitleArIdx === -1 && finalTitleEnIdx !== -1) {
          finalTitleArIdx = finalTitleEnIdx;
        } else if (finalTitleArIdx !== -1 && finalTitleEnIdx === -1) {
          finalTitleEnIdx = finalTitleArIdx;
        }

        if (codeIdx === -1 || finalTitleArIdx === -1) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl 
              ? "تنسيق الأعمدة غير صحيح. يجب أن يحتوي الملف على عمود الكود وعمود العنوان (بالعربية أو الإنجليزية) على الأقل." 
              : "Columns format invalid. File must contain Code and Title (Arabic or English) columns at least."
          });
          return;
        }

        const newCodes = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawCode = (row[codeIdx] !== undefined && row[codeIdx] !== null) ? row[codeIdx].toString().trim() : "";
          if (!rawCode) continue;

          const rawStageVal = stageIdx !== -1 ? row[stageIdx] : "STG-01";
          const stageId = mapStageNameOrId(rawStageVal, production_stages);

          const titleAr = row[finalTitleArIdx] ? row[finalTitleArIdx].toString().trim() : rawCode;
          const titleEn = row[finalTitleEnIdx] ? row[finalTitleEnIdx].toString().trim() : titleAr;
          const description = descIdx !== -1 && row[descIdx] ? row[descIdx].toString().trim() : null;

          const rawSteps = stepsIdx !== -1 && row[stepsIdx] ? row[stepsIdx].toString() : "";
          const troubleshooting_steps = rawSteps.split(/[\n|;]+/).map(s => s.trim()).filter(Boolean);

          newCodes.push({
            code: rawCode,
            stage_id: stageId,
            title_ar: titleAr,
            title_en: titleEn,
            description,
            troubleshooting_steps
          });
        }

        if (newCodes.length === 0) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl ? "لم يتم العثور على أسطر صالحة في الملف!" : "No valid data rows found in the file!" 
          });
          return;
        }

        setPreviewRows(newCodes);
        setImportStatus(null);
      } catch (err) {
        console.error("Excel import error for error codes:", err);
        setImportStatus({ 
          type: "danger", 
          text: isRtl ? "فشل قراءة ملف الاكسل. تأكد من سلامة التنسيق." : "Failed to read Excel file. Please check format." 
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!previewRows || previewRows.length === 0) return;
    
    setImportStatus({ 
      type: "info", 
      text: isRtl ? "جاري حفظ البيانات بالسحابة..." : "Saving data to the cloud..." 
    });

    const toImport = previewRows;
    setPreviewRows(null);

    const res = await addErrorCodesBulk(toImport);
    if (res.success) {
      setImportStatus({ 
        type: "success", 
        text: isRtl 
          ? `تم استيراد وتحديث ${toImport.length} أكواد أعطال بنجاح!` 
          : `Successfully imported and synchronized ${toImport.length} error codes!`
      });
      setTimeout(() => setImportStatus(null), 5000);
    } else {
      setImportStatus({ 
        type: "danger", 
        text: res.error?.message || (isRtl ? "حدث خطأ أثناء الحفظ بالسحابة." : "An error occurred while saving to the cloud.") 
      });
    }
  };

  const openAdd = () => {
    setFormData({
      code: "",
      stage_id: "STG-01",
      title_ar: "",
      title_en: "",
      description: "",
      troubleshooting: ""
    });
    setModal({ show: true, editMode: false, data: null });
  };

  const openEdit = (e) => {
    setFormData({ 
      code: e.code, 
      stage_id: e.stage_id, 
      title_ar: e.title_ar || "", 
      title_en: e.title_en || "", 
      description: e.description || "", 
      troubleshooting: (e.troubleshooting_steps || []).join("\n") 
    });
    setModal({ show: true, editMode: true, data: e });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      code: formData.code,
      stage_id: formData.stage_id,
      title_ar: formData.title_ar,
      title_en: formData.title_en,
      description: formData.description || null,
      troubleshooting_steps: formData.troubleshooting.split("\n").map(l => l.trim()).filter(Boolean)
    };

    if (modal.editMode) {
      updateErrorCode(modal.data.code, modal.data.stage_id, data);
    } else {
      addErrorCode(data);
    }
    setModal({ show: false, editMode: false, data: null });
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16, textAlign: isRtl ? "right" : "left"}}>
      <div style={{display:"flex",justifyContent: "space-between", alignItems:"center", flexDirection: isRtl ? "row" : "row-reverse", flexWrap: "wrap", gap: 10}}>
        <div>
          <h2 style={{marginBottom:2}}>{isRtl ? "دليل أكواد الأعطال الرئيسي" : "Fault Code Primary Reference Library"}</h2>
          <p style={{fontSize:"0.85rem"}}>{errorCodes.length} {isRtl ? "كود مسجل في النظام" : "documented technical fault codes"}</p>
        </div>
        <div style={{display:"flex", gap: 10}}>
          <button className="btn btn-secondary" onClick={downloadTemplate} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            📄 {isRtl ? "تحميل النموذج" : "Download Template"}
          </button>
          <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            📥 {isRtl ? "استيراد إكسل" : "Import Excel"}
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} style={{ display: "none" }} />
          </label>
          <button className="btn btn-primary" onClick={openAdd}>{isRtl ? "+ إضافة كود جديد" : "+ Add New Fault Code"}</button>
        </div>
      </div>

      {importStatus && (
        <div className={`alert alert-${importStatus.type}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} />
          <span>{importStatus.text}</span>
          {importStatus.type !== "info" && (
            <button className="btn btn-ghost btn-sm" onClick={() => setImportStatus(null)} style={{ marginLeft: isRtl ? "auto" : 0, marginRight: !isRtl ? "auto" : 0, padding: "2px 6px" }}>✕</button>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: isRtl ? "flex-start" : "flex-end", marginBottom: 4 }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 350 }}>
          <input 
            className="input" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder={isRtl ? "البحث برمز الخطأ، العنوان، أو الوصف..." : "Search by code, title, description..."} 
            style={{ paddingRight: isRtl ? 35 : 12, paddingLeft: !isRtl ? 35 : 12, textAlign: isRtl ? "right" : "left" }}
          />
          <Search size={16} style={{
            position: "absolute",
            right: isRtl ? 10 : "auto",
            left: !isRtl ? 10 : "auto",
            top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
          }} />
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrapper" style={{border:"none", overflowX: "auto"}}>
          <table style={{ minWidth: "900px" }}>
            <thead>
              <tr>
                <th style={{width: 140, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "المرحلة" : "Stage"}</th>
                <th style={{width: 100, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "الكود" : "Code"}</th>
                <th style={{width: 200, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "العنوان" : "Title"}</th>
                <th style={{width: 300, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "الوصف" : "Description"}</th>
                <th style={{width: 300, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "خطوات الإصلاح" : "Troubleshooting Steps"}</th>
                <th style={{width: 120, textAlign: isRtl ? "right" : "left"}}>{isRtl ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredErrorCodes.map((e, idx) => {
                const stage = getStageById(e.stage_id);
                const color = STAGE_COLORS[e.stage_id] || "var(--accent)";
                return (
                  <tr key={`${e.stage_id}-${e.code}-${idx}`} className="animate-fade">
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,color, flexDirection: isRtl ? "row" : "row-reverse"}}>
                        <span>{stage?.icon}</span>
                        <span style={{fontSize:"0.85rem"}}>{stage?.stage_name ? (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name) : ""}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-gray" style={{fontFamily:"monospace",fontWeight:800}}>{e.code}</span></td>
                    <td style={{fontSize:"0.88rem", fontWeight: 700}}>{isRtl ? (e.title_ar || "—") : (e.title_en || "—")}</td>
                    <td>
                      <div style={{fontSize:"0.76rem",color:"var(--text-muted)",lineHeight:1.4, maxWidth:280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}} title={e.description}>
                        <TranslateText text={e.description} targetLang={isRtl ? "ar" : "en"} fallback="—" />
                      </div>
                    </td>
                    <td>
                      <div style={{fontSize:"0.75rem",color:"var(--text-secondary)", maxWidth:280, maxHeight: "90px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 3}}>
                        <TranslateSteps
                          steps={e.troubleshooting_steps || []}
                          targetLang={isRtl ? "ar" : "en"}
                          renderStep={(step, sIdx) => (
                            <div key={sIdx} style={{lineHeight: 1.2}}>• {step}</div>
                          )}
                        />
                        {(!e.troubleshooting_steps || e.troubleshooting_steps.length === 0) && "—"}
                      </div>
                    </td>
                    <td>
                      <div style={{display:"flex",gap:6, flexDirection: isRtl ? "row" : "row-reverse"}}>
                        <button className="btn btn-ghost" style={{padding:6}} onClick={() => openEdit(e)}>{isRtl ? "تعديل" : "Edit"}</button>
                        <button className="btn btn-ghost" style={{padding:6,color:"var(--red)"}} onClick={() => { 
                          const confirmMsg = isRtl ? "حذف هذا الكود؟" : "Delete this code?";
                          if(window.confirm(confirmMsg)) deleteErrorCode(e.code, e.stage_id); 
                        }}>{isRtl ? "حذف" : "Delete"}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{maxWidth:600, direction: isRtl ? "rtl" : "ltr"}}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{margin:0}}>{modal.editMode ? (isRtl ? "تعديل كود الخطأ" : "Edit Fault Code") : (isRtl ? "إضافة كود خطأ جديد" : "Add New Fault Code")}</h3>
              <button className="btn-close" onClick={() => setModal({show:false})}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:14,padding:20}}>
              <div className="grid-2">
                <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                  <label className="input-label">{isRtl ? "كود الخطأ (مثلاً -101)" : "Fault Code (e.g. -101)"}</label>
                  <input className="input" value={formData.code} onChange={e=>setFormData({...formData, code:e.target.value})} required style={{ textAlign: isRtl ? "right" : "left" }} />
                </div>
                <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                  <label className="input-label">{isRtl ? "المرحلة المرتبطة" : "Associated Stage"}</label>
                  <select className="input" value={formData.stage_id} onChange={e=>setFormData({...formData, stage_id:e.target.value})}>
                    {production_stages.map(s => <option key={s.stage_id} value={s.stage_id}>{s.icon} {(s.stage_name.match(/\(([^)]+)\)/)?.[1] || s.stage_name)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                  <label className="input-label">{isRtl ? "العنوان بالعربية *" : "Title (Arabic) *"}</label>
                  <input className="input" value={formData.title_ar} onChange={e=>setFormData({...formData, title_ar:e.target.value})} required style={{ textAlign: "right" }} dir="rtl" />
                </div>
                <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                  <label className="input-label">{isRtl ? "العنوان بالإنجليزية *" : "Title (English) *"}</label>
                  <input className="input" value={formData.title_en} onChange={e=>setFormData({...formData, title_en:e.target.value})} required style={{ textAlign: "left" }} dir="ltr" />
                </div>
              </div>

              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "الوصف" : "Description"}</label>
                <textarea className="input" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} rows={2} style={{ textAlign: isRtl ? "right" : "left" }} />
              </div>

              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "خطوات الإصلاح (خطوة في كل سطر)" : "Troubleshooting Steps (One per line)"}</label>
                <textarea className="input" value={formData.troubleshooting} onChange={e=>setFormData({...formData, troubleshooting:e.target.value})} rows={4} placeholder={isRtl ? "تحقق من كابل الاتصال\nأعد تشغيل الجهاز" : "Verify interface cable\nPower cycle system"} style={{ textAlign: isRtl ? "right" : "left" }} />
              </div>

              <div style={{display:"flex",gap:10,marginTop:10, flexDirection: isRtl ? "row" : "row-reverse"}}>
                <button type="submit" className="btn btn-primary" style={{flex:1}}>{modal.editMode ? (isRtl ? "حفظ التغييرات" : "Save Changes") : (isRtl ? "إضافة الكود" : "Add Code")}</button>
                <button type="button" className="btn btn-secondary" onClick={()=>setModal({show:false})}>{isRtl ? "إلغاء" : "Cancel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewRows && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: 850, direction: isRtl ? "rtl" : "ltr" }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{ margin: 0 }}>
                {isRtl ? "معاينة بيانات الاستيراد" : "Import Data Preview"}
              </h3>
              <button className="btn-close" onClick={() => setPreviewRows(null)}>✕</button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="alert alert-info" style={{ margin: 0 }}>
                {isRtl 
                  ? `تم العثور على ${previewRows.length} كود عطل في الملف. يرجى مراجعة البيانات أدناه قبل إتمام الاستيراد.`
                  : `Found ${previewRows.length} error codes in the file. Please review the data below before confirming.`}
              </div>

              <div style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "المرحلة" : "Stage"}</th>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "الكود" : "Code"}</th>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "العنوان بالعربية" : "Title (Arabic)"}</th>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "العنوان بالإنجليزية" : "Title (English)"}</th>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "الوصف" : "Description"}</th>
                      <th style={{ padding: "8px 12px", textAlign: isRtl ? "right" : "left", fontSize: "0.8rem" }}>{isRtl ? "خطوات الإصلاح" : "Troubleshooting"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => {
                      const stage = getStageById(r.stage_id);
                      const color = STAGE_COLORS[r.stage_id] || "var(--accent)";
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontSize: "0.78rem" }}>
                            <span style={{ color, fontWeight: 700 }}>{stage?.icon} {stage?.stage_name ? (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name) : ""}</span>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.78rem" }}>
                            <span className="badge badge-gray" style={{ fontFamily: "monospace" }}>{r.code}</span>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.78rem", fontWeight: 600 }}>{r.title_ar}</td>
                          <td style={{ padding: "8px 12px", fontSize: "0.78rem", fontWeight: 600 }}>{r.title_en}</td>
                          <td style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
                            {r.description || "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={(r.troubleshooting_steps || []).join(" | ")}>
                            {(r.troubleshooting_steps || []).join(" | ") || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmImport}>
                  ✅ {isRtl ? "تأكيد واستيراد البيانات" : "Confirm and Import Data"}
                </button>
                <button className="btn btn-secondary" onClick={() => setPreviewRows(null)}>
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SOPReportsPanel() {
  const { production_stages, language, currentUser } = useApp();

  const isRtl = language === "ar";

  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState("");

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

  const STAGES_MAP = [
    { id: "assembly", name: "Assembly" },
    { id: "insulation", name: "Insulation Test" },
    { id: "rf", name: "RF Test" },
    { id: "calibration", name: "Calibration" },
    { id: "multitest", name: "Multi Test" },
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

  const categories = ["A- OPERATORS", "B- DOCUMENTATION", "C- PRODUCTION AND TEST MEANS", "D- COMPONENTS", "E- SCRAP & Scrap"];

  const filtered = reports.filter(r => 
    r.date.includes(search) || 
    r.line.toLowerCase().includes(search.toLowerCase()) || 
    (r.validation_tl || r.supervisor_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const getReportSummary = (report) => {
    let okCount = 0;
    let nokCount = 0;
    Object.values(report.grid_data || {}).forEach(row => {
      Object.values(row).forEach(status => {
        if (status === "OK") okCount++;
        if (status === "NOK") nokCount++;
      });
    });
    return { okCount, nokCount };
  };

  const getColumnDescription = (col) => {
    if (isRtl) {
      const startIdx = col.desc.indexOf("(");
      const endIdx = col.desc.lastIndexOf(")");
      return (startIdx !== -1 && endIdx !== -1) ? col.desc.substring(startIdx + 1, endIdx) : col.desc;
    } else {
      return col.desc.split("(")[0].trim();
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById("print-sop-area").innerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>START OF PRODUCTION _ ECTRON</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              size: landscape;
              margin: 4mm 6mm;
            }
            body { 
              direction: ${isRtl ? 'rtl' : 'ltr'}; 
              font-family: 'Cairo', sans-serif; 
              padding: 0; 
              margin: 0; 
              background: #fff;
              color: #000;
              font-size: 0.7rem;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container {
              display: flex;
              flex-direction: column;
              height: 98vh;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .print-container > div {
              min-width: 0 !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
            }
            table { 
              width: 100% !important; 
              min-width: 100% !important; 
              border-collapse: collapse; 
              margin-top: 6px; 
              table-layout: fixed;
            }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 4px 2px !important; 
              text-align: center; 
              font-size: 0.6rem !important; 
              word-wrap: break-word;
            }
            th { 
              background-color: #f1f5f9 !important; 
            }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
            .badge-blue { background-color: #e0f2fe !important; color: #0369a1 !important; }
            .badge-green { background-color: #dcfce7 !important; color: #15803d !important; }
            .badge-red { background-color: #fee2e2 !important; color: #b91c1c !important; }
            .badge-amber { background-color: #fef3c7 !important; color: #b45309 !important; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
            .box { border: 1px solid #cbd5e1; padding: 6px 10px; borderRadius: 6px; margin-bottom: 0px; }
            .title { font-weight: bold; color: #0369a1; margin-bottom: 3px; font-size: 0.7rem; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="print-container">
            \${printContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDeleteReport = async (id) => {
    const confirmMsg = isRtl ? "هل أنت متأكد من حذف هذا التقرير نهائياً من السحابة؟" : "Are you sure you want to permanently delete this report from the cloud?";
    if (!window.confirm(confirmMsg)) return;
    try {
      const { error } = await supabase.from("sop_reports").delete().eq("id", id);
      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (err) {
      console.error("Error deleting SOP report:", err);
    }
  };

  const handleSignReport = async (reportId) => {
    const qlName = currentUser?.full_name || "Admin/Quality Leader";
    try {
      const { error } = await supabase
        .from("sop_reports")
        .update({ validation_ql: qlName })
        .eq("id", reportId);
      if (error) throw error;
      
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, validation_ql: qlName } : r));
      setSelectedReport(prev => prev ? { ...prev, validation_ql: qlName } : null);
    } catch (err) {
      console.error("Error signing SOP report:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: isRtl ? "right" : "left" }} className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{isRtl ? "تقارير بداية الإنتاج (SOP)" : "Start of Production Reports (SOP)"}</h2>
          <p style={{ fontSize: "0.85rem" }}>{reports.length} {isRtl ? "تقرير مسجل من المشرفين في محطات الإنتاج" : "records logged by workstations supervisors"}</p>
        </div>
        <div style={{ position: "relative", width: 300 }}>
          <input 
            className="input" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder={isRtl ? "بحث بالتاريخ، الخط، أو المشرف..." : "Search by date, line, supervisor..."} 
            style={{ paddingRight: isRtl ? 35 : 12, paddingLeft: !isRtl ? 35 : 12, textAlign: isRtl ? "right" : "left" }}
          />
          <Search size={16} style={{
            position: "absolute",
            right: isRtl ? 10 : "auto",
            left: !isRtl ? 10 : "auto",
            top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
          }} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: "none" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التاريخ" : "Date"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "خط الإنتاج" : "Production Line"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المشرف (قائد الفريق)" : "Supervisor (Team Leader)"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "مسؤول الجودة" : "Quality Engineer"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "حالة البنود" : "Checklist Status"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "عدم المطابقة" : "Non-Conformity"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const { okCount, nokCount } = getReportSummary(r);
                return (
                  <tr key={r.id} className="animate-fade">
                    <td style={{ fontWeight: 700 }}>📅 {r.date}</td>
                    <td><span className="badge badge-blue">{r.line}</span></td>
                    <td style={{ fontSize: "0.85rem", fontWeight: 600 }}>{r.validation_tl || r.supervisor_name}</td>
                    <td style={{ fontSize: "0.85rem" }}>{r.validation_ql || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className="badge badge-green">✓ {okCount}</span>
                        {nokCount > 0 && <span className="badge badge-red">✕ {nokCount}</span>}
                      </div>
                    </td>
                    <td>
                      {r.no_conformity ? (
                        <span className="badge badge-amber" title={r.no_conformity} style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" }}>
                          {r.no_conformity}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{isRtl ? "لا يوجد" : "None"}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexDirection: isRtl ? "row" : "row-reverse" }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedReport(r)}>{isRtl ? "معاينة التفاصيل" : "View Details"}</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => handleDeleteReport(r.id)}>{isRtl ? "حذف" : "Delete"}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    {isRtl ? "لا توجد تقارير بداية إنتاج مطابقة للبحث" : "No SOP checklists match search query"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Preview Modal */}
      {selectedReport && (
        <div className="modal-overlay" style={{ padding: "12px" }}>
          <div className="modal-content animate-scale" style={{ maxWidth: "98%", width: "1550px", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="modal-header" style={{ flexShrink: 0, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                {isRtl ? "تقرير بداية الإنتاج الكامل" : "SOP Checklist Inspection Detail"} - {selectedReport.date} ({selectedReport.line})
              </h3>
              <button className="btn-close" onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            
            <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "20px 24px", maxWidth: "100%", minHeight: 0, direction: isRtl ? "rtl" : "ltr" }} id="print-sop-area">
              <div style={{ border: "1px solid #cbd5e1", padding: "20px", borderRadius: "12px", background: "#fff", maxWidth: "100%" }}>
                
                {/* Print Banner */}
                <div style={{ background: "#0284c7", color: "#fff", padding: "14px", borderRadius: "8px", textAlign: "center", marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>START OF PRODUCTION _ ECTRON</h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", opacity: 0.95 }}>
                    {isRtl ? "تقرير الجاهزية وإعداد خط الإنتاج" : "Production Line Readiness & Initialization Audit Log"}
                  </p>
                </div>

                <div className="grid-2" style={{ fontSize: "0.9rem", marginBottom: 16 }}>
                  <div><strong>{isRtl ? "التاريخ (DATE):" : "Date (DATE):"}</strong> {selectedReport.date}</div>
                  <div><strong>{isRtl ? "خط الإنتاج (Line):" : "Line (Line):"}</strong> {selectedReport.line}</div>
                </div>

                {/* Grid Table */}
                <div style={{ overflowX: "auto", maxWidth: "100%", marginBottom: 20, border: "1px solid #cbd5e1", borderRadius: "8px", boxShadow: "var(--shadow-sm)" }}>
                  <table style={{ minWidth: "1150px", borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th rowSpan={2} style={{ padding: "10px", border: "1px solid #cbd5e1", width: "140px", textAlign: isRtl ? "right" : "left" }}>
                          {isRtl ? "محطة العمل" : "Workstation"}
                        </th>
                        {categories.map(cat => {
                          const colCount = COLUMNS.filter(c => c.category === cat).length;
                          return (
                            <th key={cat} colSpan={colCount} style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: 700, color: "#0369a1", fontSize: "0.75rem" }}>
                              {cat}
                            </th>
                          );
                        })}
                      </tr>
                      <tr style={{ background: "#f1f5f9" }}>
                        {COLUMNS.map(col => (
                          <th key={col.id} title={col.desc} style={{ padding: "8px 6px", border: "1px solid #cbd5e1", textAlign: "center", fontSize: "0.75rem", width: "88px", minWidth: "88px", fontWeight: 600 }}>
                            <div style={{ fontWeight: 800, color: "#1e293b", marginBottom: 2 }}>{col.label}</div>
                            <div style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 400, lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "88px" }}>
                              {getColumnDescription(col)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAGES_MAP.map(stage => (
                        <tr key={stage.id}>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, fontWeight: 700, textAlign: isRtl ? "right" : "left" }}>{stage.name}</td>
                          {COLUMNS.map(col => {
                            const status = selectedReport.grid_data?.[stage.id]?.[col.id];
                            return (
                              <td key={col.id} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>
                                {status === "OK" && <span style={{ color: "#22c55e", fontWeight: 900, fontSize: "1.1rem" }}>✓</span>}
                                {status === "NOK" && <span style={{ color: "#ef4444", fontWeight: 900, fontSize: "1.1rem" }}>✕</span>}
                                {!status && <span style={{ color: "#cbd5e1" }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Text fields details */}
                <div className="grid-2" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
                  <div className="box" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <div className="title">{isRtl ? "تفاصيل عدم المطابقة (Detail of no-conformity)" : "Detail of non-conformity"}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{selectedReport.no_conformity || (isRtl ? "لا يوجد ملاحظات عدم مطابقة" : "No non-conformities reported")}</div>
                  </div>
                  <div className="box" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <div className="title">{isRtl ? "التحليل والإجراء (Analysis)" : "Analysis & Corrective Action"}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{selectedReport.analysis || "—"}</div>
                  </div>
                </div>

                <div className="grid-2" style={{ fontSize: "0.85rem" }}>
                  <div className="box" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <div className="title">{isRtl ? "توقيع قائد الفريق (Validation Team Leader)" : "Team Leader Verification"}</div>
                    <div style={{ fontWeight: 700, color: "#eab308" }}>✍️ {selectedReport.validation_tl || selectedReport.supervisor_name}</div>
                  </div>
                  <div className="box" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <div className="title">{isRtl ? "توقيع قائد الجودة (Validation Quality leader)" : "Quality leader Validation"}</div>
                    <div style={{ fontWeight: 700, color: "#22c55e" }}>✍️ {selectedReport.validation_ql || "—"}</div>
                  </div>
                </div>

                {selectedReport.comment && (
                  <div className="box" style={{ marginTop: 16, fontSize: "0.85rem", textAlign: isRtl ? "right" : "left" }}>
                    <div className="title">{isRtl ? "ملاحظات عامة (Comment)" : "General Comment"}</div>
                    <div>{selectedReport.comment}</div>
                  </div>
                )}

              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 12, background: "var(--bg-elevated)", flexShrink: 0, flexDirection: isRtl ? "row" : "row-reverse" }}>
              {currentUser?.role === "admin" && !selectedReport.validation_ql && (
                <button className="btn btn-primary" style={{ background: "#22c55e", borderColor: "#22c55e", color: "#fff" }} onClick={() => handleSignReport(selectedReport.id)}>
                  ✍️ {isRtl ? "توقيع قائد الجودة (Sign as Quality Leader)" : "Sign as Quality Leader"}
                </button>
              )}
              <button className="btn btn-primary" onClick={handlePrint}>🖨️ {isRtl ? "طباعة التقرير (Print)" : "Print Inspection Report"}</button>
              <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>{isRtl ? "إغلاق" : "Close"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar config ───────────────────────────────────
const getSidebarPanels = (isRtl, t) => [
  { id:"overview",   label: t("fpyOverview"),        icon:BarChart2,    section: isRtl ? "رئيسي" : "Main" },
  { id:"users",      label: isRtl ? "المستخدمون" : "Operators Log",       icon:Users,        section: isRtl ? "رئيسي" : "Main" },
  { id:"stages",     label: isRtl ? "مراحل الإنتاج" : "Production Stages",   icon:Layers,       section: isRtl ? "الإدارة" : "Management" },
  { id:"assets",     label: t("equipmentManagement"), icon:Package,      section: isRtl ? "الإدارة" : "Management" },
  { id:"schedule",   label: isRtl ? "جدول الورديات" : "Shift Schedules",     icon:Calendar,     section: isRtl ? "الإنتاج" : "Production" },
  { id:"defects",    label: isRtl ? "العدادات المعطوبة" : "Defective Meters", icon:AlertTriangle,section: isRtl ? "الإنتاج" : "Production" },
  { id:"errorcodes", label: isRtl ? "دليل الأعطال" : "Fault Codes Guide",      icon:BookOpen,     section: isRtl ? "الإنتاج" : "Production" },
  { id:"sop_reports", label: isRtl ? "بداية الإنتاج (SOP)" : "Start of Production (SOP)", icon:ClipboardList, section: isRtl ? "الإنتاج" : "Production" },
  { id:"maintenance", label: t("maintenance"),       icon:Wrench,       section: isRtl ? "الإنتاج" : "Production" },
];

export default function AdminPage() {
  const { currentUser, language, t } = useApp();
  const [active, setActive] = useState("overview");

  const isRtl = language === "ar";
  const PANELS = getSidebarPanels(isRtl, t);

  const sections = [...new Set(PANELS.map(p=>p.section))];

  const renderPanel = () => {
    switch(active) {
      case "overview":   return <OverviewPanel />;
      case "users":      return <UsersPanel />;
      case "stages":     return <StagesPanel />;
      case "assets":     return <AssetsPanel />;
      case "schedule":   return <ShiftSchedulesPanel />;
      case "defects":    return <DefectsPanel />;
      case "errorcodes": return <ErrorCodesPanel />;
      case "sop_reports": return <SOPReportsPanel />;
      case "maintenance": return <MaintenancePage />;
      default:           return <OverviewPanel />;
    }
  };

  return (
    <div className="admin-layout" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <aside className="admin-sidebar" style={{ textAlign: isRtl ? "right" : "left" }}>
        <div style={{
          display:"flex",
          alignItems:"center",
          gap:8,
          padding:"10px 12px",
          marginBottom:8,
          background:"#fff3e0",
          borderRadius:"var(--radius-md)",
          border:"1px solid #ffcc8066",
          flexDirection: isRtl ? "row" : "row-reverse",
          textAlign: isRtl ? "right" : "left"
        }}>
          <Shield size={15} style={{color:"#e65100",flexShrink:0}} />
          <div style={{ flex: 1 }}>
            <div style={{fontSize:"0.76rem",fontWeight:800,color:"#e65100"}}>{isRtl ? "لوحة الإدارة" : "Admin Panel"}</div>
            <div style={{fontSize:"0.67rem",color:"var(--text-muted)"}}>{currentUser?.full_name}</div>
          </div>
        </div>
        {sections.map(sec=>(
          <div key={sec}>
            <div className="sidebar-section-label">{sec}</div>
            {PANELS.filter(p=>p.section===sec).map(p=>{
              const Icon=p.icon;
              return (
                <button key={p.id} className={`sidebar-item ${active===p.id?"active":""}`} onClick={()=>setActive(p.id)} style={{ flexDirection: isRtl ? "row" : "row-reverse", justifyContent: "flex-start", gap: 10 }}>
                  <Icon size={15}/> 
                  <span style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>{p.label}</span>
                  {active===p.id&&<ChevronRight size={13} style={{ transform: isRtl ? "none" : "rotate(180deg)", flexShrink: 0 }}/>}
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <main className="admin-content" style={{ direction: isRtl ? "rtl" : "ltr" }}>{renderPanel()}</main>
    </div>
  );
}
