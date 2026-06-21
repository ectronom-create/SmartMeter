import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle, Clock, AlertTriangle, X, Plus, AlertCircle, Search } from "lucide-react";
import { translateError, TranslateText } from "./KnowledgeBasePage";
import * as XLSX from "xlsx";
import CountdownTimer from "../components/CountdownTimer";

const getStatusConfig = (isRtl) => ({
  reported: { label: isRtl ? "بلاغ جديد" : "New Report",           class: "badge-blue",   icon: <Plus size={11} /> },
  pending:  { label: isRtl ? "قيد الانتظار" : "Pending Review",     class: "badge-amber",  icon: <Clock size={11} /> },
  verified: { label: isRtl ? "تم التحقق (معطوب)" : "Verified Defect",  class: "badge-red",    icon: <AlertTriangle size={11} /> },
  resolved: { label: isRtl ? "يعود لخط الانتاج" : "Returned to Line",  class: "badge-green",  icon: <CheckCircle size={11} /> },
});

const getStageNames = () => ({
  "STG-01": "Assembly", 
  "STG-02": "Insulation",
  "STG-03": "Radio Frequency", 
  "STG-04": "Calibration", 
  "STG-05": "Multi Test", 
  "STG-06": "Perso",
  "GLOBAL": "General"
});

export default function DefectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    defectiveMeters, currentUser, updateMeterStatus, 
    getErrorByCode, addDefectiveMeter, addDefectiveMetersBulk, currentStage, errorCodes, language,
    defectLogs, getUserById,
    boxes, addBox, updateBox, deleteBox, assignMeterToBox
  } = useApp();

  const isRtl = language === "ar";
  const STATUS_CONFIG = getStatusConfig(isRtl);
  const stageNames = getStageNames(isRtl);
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [defectsSearch, setDefectsSearch] = useState("");
  const [submitMsg, setSubmitMsg] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Box management state
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxSize, setNewBoxSize] = useState("24");
  const [customSize, setCustomSize] = useState("");
  const [newBoxCategory, setNewBoxCategory] = useState("Assembly");
  const [customCategory, setCustomCategory] = useState("");
  const [boxSubmitMsg, setBoxSubmitMsg] = useState(null);
  const [expandedBoxId, setExpandedBoxId] = useState(null);


  // Searchable Code logic
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedErrorCode, setSelectedErrorCode] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Review Modal state
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  // Barcode scanner enforcement state
  const [serialNumber, setSerialNumber] = useState("");
  const [showScanWarning, setShowScanWarning] = useState(false);
  const lastKeyTimeRef = useRef(0);
  const isManualRef = useRef(false);

  const handleSerialKeyDown = (e) => {
    if (["Enter", "Tab", "Shift", "Control", "Alt", "Meta", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Backspace"].includes(e.key)) {
      return;
    }
    const now = Date.now();
    if (lastKeyTimeRef.current !== 0) {
      const diff = now - lastKeyTimeRef.current;
      if (diff > 60) {
        isManualRef.current = true;
        setShowScanWarning(true);
      }
    }
    lastKeyTimeRef.current = now;
  };

  const handleSerialChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      isManualRef.current = false;
      lastKeyTimeRef.current = 0;
      setShowScanWarning(false);
      setSerialNumber("");
      return;
    }

    if (isManualRef.current) {
      setSerialNumber("");
      setTimeout(() => {
        setShowScanWarning(false);
        isManualRef.current = false;
        lastKeyTimeRef.current = 0;
      }, 3000);
    } else {
      setSerialNumber(val);
    }
  };

  const handleSerialPaste = (e) => {
    e.preventDefault();
    isManualRef.current = true;
    setShowScanWarning(true);
    setSerialNumber("");
    setTimeout(() => {
      setShowScanWarning(false);
      isManualRef.current = false;
      lastKeyTimeRef.current = 0;
    }, 3000);
  };

  const handleExcelUpload = async (e) => {
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
        
        const serialIdx = headers.findIndex(h => h.includes("serial") || h.includes("نمبر") || h.includes("سيريال") || h.includes("الرمز التسلسلي") || h.includes("تسلسلي") || h.includes("sn"));
        const codeIdx = headers.findIndex(h => h.includes("code") || h.includes("كود") || h.includes("رمز العطل") || h.includes("عطل") || h.includes("error"));
        const stageIdx = headers.findIndex(h => h.includes("stage") || h.includes("المرحلة") || h.includes("مرحلة") || h.includes("stg"));
        const descIdx = headers.findIndex(h => h.includes("desc") || h.includes("وصف") || h.includes("تفاصيل") || h.includes("ملاحظات") || h.includes("comment"));

        if (serialIdx === -1 || codeIdx === -1) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl 
              ? "تنسيق الأعمدة غير صحيح. يجب أن يحتوي الملف على عمود السيريال نمبر وعمود رمز العطل على الأقل." 
              : "Columns format invalid. File must contain Serial Number and Error Code columns."
          });
          return;
        }

        const newMeters = [];
        const timestamp = Date.now();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawSerial = (row[serialIdx] || "").toString().trim().toUpperCase();
          const rawCode = (row[codeIdx] || "").toString().trim().toUpperCase();
          
          if (!rawSerial || !rawCode) continue;

          // Normalize stage_id if provided, otherwise default to "STG-01"
          let stageId = "STG-01";
          if (stageIdx !== -1 && row[stageIdx]) {
            const rawStage = row[stageIdx].toString().trim().toUpperCase();
            if (rawStage.startsWith("STG-")) {
              stageId = rawStage;
            } else {
              // Convert simple number like "2" or "02" to "STG-02"
              const num = parseInt(rawStage.replace(/\D/g, ""), 10);
              if (!isNaN(num) && num >= 1 && num <= 6) {
                stageId = `STG-0${num}`;
              }
            }
          }

          const desc = descIdx !== -1 && row[descIdx] ? row[descIdx].toString().trim() : "";

          newMeters.push({
            id: `DEF-${timestamp}-${i}-${Math.random().toString(36).substr(2, 5)}`,
            serial_number: rawSerial,
            error_code: rawCode,
            stage_found: stageId,
            custom_description: desc,
            reported_by: currentUser.employee_id,
            status: "reported",
            created_at: new Date().toISOString()
          });
        }

        if (newMeters.length === 0) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl ? "لم يتم العثور على أسطر بيانات صالحة في الملف!" : "No valid data rows found in the file!" 
          });
          return;
        }

        const res = await addDefectiveMetersBulk(newMeters);
        if (res.success) {
          setImportStatus({ 
            type: "success", 
            text: isRtl 
              ? `تم استيراد وتحديث ${res.count} عداد معطوب بنجاح!` 
              : `Successfully imported ${res.count} defective meters!`
          });
          setTimeout(() => setImportStatus(null), 5000);
        } else {
          setImportStatus({ 
            type: "danger", 
            text: res.message || (isRtl ? "حدث خطأ أثناء الحفظ بالسحابة." : "An error occurred while saving to the cloud.") 
          });
        }
      } catch (err) {
        console.error("Excel import error for defects:", err);
        setImportStatus({ 
          type: "danger", 
          text: isRtl ? "فشل قراءة ملف الاكسل. تأكد من سلامة التنسيق." : "Failed to read Excel file. Please check format." 
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = defectiveMeters.map(m => {
        const err = m.error_code ? getErrorByCode(m.error_code) : null;
        const trans = err ? translateError(err, isRtl) : null;
        const statusText = STATUS_CONFIG[m.status]?.label || m.status;
        const stageText = stageNames[m.stage_found] || m.stage_found;
        const reporterName = getUserById(m.reported_by)?.full_name || m.reported_by || "—";
        const resolverName = getUserById(m.resolved_by)?.full_name || m.resolved_by || "—";
        
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

  useEffect(() => {
    if (location.state?.openReview) {
      setReviewModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const pendingMeters = useMemo(() => {
    const list = defectiveMeters.filter(m => m.status === "pending");
    if (!reviewSearch.trim()) return list;
    return list.filter(m => m.serial_number.includes(reviewSearch.trim().toUpperCase()));
  }, [defectiveMeters, reviewSearch]);

  const handleStatusChange = (id, status, fromModal = false) => {
    updateMeterStatus(id, status);
    if (fromModal) {
      setConfirmingId(null);
      setNewStatus("");
    }
  };

  const filteredCodes = useMemo(() => {
    // If operator, only allow searching/selecting error codes for their current stage or global/general codes
    const baseCodes = currentUser?.role === "operator" && currentStage
      ? errorCodes.filter(e => e.stage_id === currentStage.stage_id || e.stage_id === "GLOBAL")
      : errorCodes;

    if (!searchQuery.trim()) return baseCodes;
    const q = searchQuery.toLowerCase();
    return baseCodes.filter(e => 
      e.code.toLowerCase().includes(q) || 
      (e.title_ar && e.title_ar.toLowerCase().includes(q)) ||
      (e.title_en && e.title_en.toLowerCase().includes(q)) ||
      (stageNames[e.stage_id] || "").toLowerCase().includes(q)
    );
  }, [searchQuery, errorCodes, stageNames, currentUser?.role, currentStage]);

  const filtered = defectiveMeters.filter(m => {
    const matchesStatus = filterStatus === "all" ? true : m.status === filterStatus;
    if (!matchesStatus) return false;
    if (!defectsSearch.trim()) return true;
    const q = defectsSearch.toLowerCase();
    const err = m.error_code ? getErrorByCode(m.error_code) : null;
    const trans = err ? translateError(err, isRtl) : null;
    const rep = getUserById(m.reported_by);
    const repName = rep ? rep.full_name : "";
    const mod = m.resolved_by ? getUserById(m.resolved_by) : null;
    const modName = mod ? mod.full_name : "";
    const box = boxes.find(b => b.id === m.box_id);
    const boxName = box ? box.name : "";
    const boxCategory = box ? box.category : "";
    
    return (
      m.serial_number.toLowerCase().includes(q) ||
      (m.error_code && m.error_code.toLowerCase().includes(q)) ||
      (m.custom_description && m.custom_description.toLowerCase().includes(q)) ||
      (trans && trans.title && trans.title.toLowerCase().includes(q)) ||
      repName.toLowerCase().includes(q) ||
      modName.toLowerCase().includes(q) ||
      boxName.toLowerCase().includes(q) ||
      boxCategory.toLowerCase().includes(q)
    );
  });

  const allMeters = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (isRtl) {
      return `${d.toLocaleDateString("ar-SA")} · ${d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return `${d.toLocaleDateString("en-US")} · ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    }
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const fd = new FormData(e.target);
    const sn = serialNumber.trim().toUpperCase();
    
    if (!sn || !selectedErrorCode) return;

    // Validate that the operator has an assigned stage
    if (currentUser.role === "operator" && !currentStage) {
      setSubmitMsg({
        type: "error",
        text: isRtl
          ? "لم يتم تعيين وردية أو مرحلة عمل لك حالياً. لا يمكنك تسجيل أعطال."
          : "You do not have an assigned shift or stage. You cannot register defects."
      });
      setTimeout(() => setSubmitMsg(null), 5000);
      return;
    }

    // Validate that the error code belongs to the operator's current stage or is global (if operator)
    if (currentUser.role === "operator" && currentStage) {
      if (selectedErrorCode.stage_id !== currentStage.stage_id && selectedErrorCode.stage_id !== "GLOBAL") {
        setSubmitMsg({
          type: "error",
          text: isRtl 
            ? "غير مسموح بتسجيل عطل لمرحلة مختلفة عن مرحلتك الحالية!" 
            : "Not allowed to register a defect for a stage different from your current stage!"
        });
        setTimeout(() => setSubmitMsg(null), 5000);
        return;
      }
    }

    setIsSubmitting(true);
    const result = await addDefectiveMeter({
      serial_number: sn,
      error_code: selectedErrorCode.code,
      stage_found: selectedErrorCode.stage_id,
      custom_description: fd.get("desc").trim(),
      reported_by: currentUser.employee_id,
      box_id: fd.get("boxId") || null
    });
    setIsSubmitting(false);

    if (!result.success) {
      setSubmitMsg({ type: "error", text: result.message });
      setTimeout(() => setSubmitMsg(null), 5000);
      return;
    }

    setSubmitMsg({ type: "success", text: isRtl ? "تم تسجيل البلاغ بنجاح!" : "Defect reported successfully!" });
    e.target.reset();
    setSerialNumber("");
    setSearchQuery("");
    setSelectedErrorCode(null);
    setTimeout(() => setSubmitMsg(null), 3000);
  };

  const getNextBoxName = () => {
    if (!boxes || boxes.length === 0) return "00001";
    let maxNum = 0;
    boxes.forEach(b => {
      const num = parseInt(b.name, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return String(maxNum + 1).padStart(5, "0");
  };

  const handleCreateBox = async (e) => {
    e.preventDefault();
    const autoName = getNextBoxName();
    
    let size = newBoxSize === "custom" ? parseInt(customSize) : parseInt(newBoxSize);
    if (!size || size <= 0) {
      setBoxSubmitMsg({
        type: "error",
        text: isRtl ? "يرجى إدخال سعة صحيحة للبوكس" : "Please enter a valid capacity"
      });
      return;
    }

    let category = newBoxCategory === "custom" ? customCategory.trim() : newBoxCategory;
    if (!category) {
      setBoxSubmitMsg({
        type: "error",
        text: isRtl ? "يرجى تحديد أو كتابة تصنيف للبوكس" : "Please specify a category"
      });
      return;
    }

    const res = await addBox({
      name: autoName,
      size: size,
      category: category
    });

    if (res && res.success) {
      setBoxSubmitMsg({
        type: "success",
        text: isRtl ? "تم إنشاء الصندوق بنجاح!" : "Box created successfully!"
      });
      setNewBoxName("");
      setNewBoxSize("24");
      setCustomSize("");
      setNewBoxCategory("Assembly");
      setCustomCategory("");
      setTimeout(() => setBoxSubmitMsg(null), 3000);
    } else {
      setBoxSubmitMsg({
        type: "error",
        text: isRtl ? "فشل إنشاء الصندوق" : "Failed to create box"
      });
    }
  };

  const [activeTab, setActiveTab] = useState("defects");
  const [historySearch, setHistorySearch] = useState("");

  const filteredLogs = (defectLogs || []).filter(log => 
    (log.serial_number || "").includes(historySearch.trim().toUpperCase())
  );

  const getActionLabel = (type, oldSt, newSt) => {
    if (type === "reported") {
      return isRtl ? "تسجيل بلاغ عطل جديد" : "New defect reported";
    }
    if (type === "status_change") {
      const STATUS_LABELS = {
        reported: isRtl ? "بلاغ جديد" : "New Report",
        pending: isRtl ? "قيد الانتظار" : "Pending Review",
        verified: isRtl ? "تم التحقق (معطوب)" : "Verified Defective",
        resolved: isRtl ? "يعود لخط الانتاج" : "Returned to Line"
      };
      const oldLbl = STATUS_LABELS[oldSt] || oldSt || "—";
      const newLbl = STATUS_LABELS[newSt] || newSt || "—";
      return isRtl 
        ? `تعديل الحالة من [${oldLbl}] إلى [${newLbl}]`
        : `Changed status from [${oldLbl}] to [${newLbl}]`;
    }
    return type;
  };

  if (!currentUser) return null;

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Topbar Navigation & Actions */}
        <div className="defects-header">
          <div className="defects-title-section">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
              <ArrowRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للرئيسية" : "Back to Home"}
            </button>
            <div>
              <h1>{isRtl ? "إدارة بلاغات الأعطال" : "Defect Management Panel"}</h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {isRtl ? "تتبع وحل المشاكل التقنية في خط الإنتاج" : "Track and resolve technical issues on the production floor"}
              </p>
            </div>
          </div>
          <div className="defects-actions">
            {currentUser?.role === "admin" && (
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleExportExcel}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(9, 105, 218, 0.08)", border: "1px solid rgba(9, 105, 218, 0.2)", color: "var(--blue)" }}
              >
                📤 {isRtl ? "تنزيل إكسل" : "Export Excel"}
              </button>
            )}
            {currentUser.role === "admin" && (
              <label 
                className="btn btn-secondary btn-sm" 
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(26, 127, 55, 0.08)", border: "1px solid rgba(26, 127, 55, 0.2)", color: "var(--accent)" }}
              >
                📥 {isRtl ? "استيراد إكسل" : "Import Excel"}
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleExcelUpload} 
                  style={{ display: "none" }} 
                />
              </label>
            )}
            {(currentUser.role === "supervisor" || currentUser.role === "admin" || currentUser.role === "quality_management") && (
              <button className="btn btn-primary btn-sm" onClick={() => setReviewModal(true)} style={{ gap: 8 }}>
                <Clock size={15} /> {isRtl ? "معاينة العدادات قيد الانتظار" : "Review Pending Quality Gate"}
                {defectiveMeters.filter(m => m.status === "pending").length > 0 && (
                  <span style={{ background: "white", color: "var(--accent)", padding: "0 6px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800 }}>
                    {defectiveMeters.filter(m => m.status === "pending").length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Import Status Alert banner */}
        {importStatus && (
          <div className={`alert alert-${importStatus.type}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{importStatus.text}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
          <button 
            className={`btn ${activeTab === "defects" ? "btn-primary" : "btn-secondary"}`} 
            onClick={() => setActiveTab("defects")}
            style={{ fontSize: "0.85rem", padding: "6px 16px" }}
          >
            📋 {isRtl ? "قائمة الأعطال" : "Defect List"}
          </button>
          
          <button 
            className={`btn ${activeTab === "boxes" ? "btn-primary" : "btn-secondary"}`} 
            onClick={() => setActiveTab("boxes")}
            style={{ fontSize: "0.85rem", padding: "6px 16px" }}
          >
            📦 {isRtl ? "نظام تتبع الصناديق" : "Box Tracking"}
          </button>

          {["admin", "supervisor", "quality_management"].includes(currentUser.role) && (
            <button 
              className={`btn ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`} 
              onClick={() => setActiveTab("history")}
              style={{ fontSize: "0.85rem", padding: "6px 16px" }}
            >
              📜 {isRtl ? "سجل حركات الجودة" : "Quality Audit Logs"}
            </button>
          )}
        </div>

        {activeTab === "defects" && (
          <>
            {/* Quick Report Form */}
            {currentUser.role !== "admin" && (
          <div className="card animate-fade" style={{ background: "#fff5f5", border: "1px solid #feb2b2", overflow: "visible" }}>
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <AlertTriangle size={18} style={{ color: "var(--red)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "تسجيل بلاغ عطل جديد" : "Report a New Defect"}</h3>
            </div>
            {submitMsg && <div className={`alert alert-${submitMsg.type === "error" ? "danger" : "success"}`} style={{ marginBottom: 12 }}>{submitMsg.text}</div>}
            <form onSubmit={handleQuickSubmit} className="defect-form-grid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr 1fr auto" }}>
              <div className="input-group">
                <label className="input-label">{isRtl ? "السيريال نمبر *" : "Serial Number *"}</label>
                <input 
                  className="input" 
                  name="sn" 
                  placeholder={isRtl ? "امسح الباركود فقط..." : "Scan barcode only..."} 
                  required 
                  value={serialNumber}
                  onChange={handleSerialChange}
                  onKeyDown={handleSerialKeyDown}
                  onPaste={handleSerialPaste}
                  style={{ 
                    background: showScanWarning ? "#fff5f5" : "white",
                    borderColor: showScanWarning ? "var(--red)" : "var(--border)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: "0.05em"
                  }} 
                />
                {showScanWarning && (
                  <span style={{ color: "var(--red)", fontSize: "0.75rem", fontWeight: 700, marginTop: 4, display: "block" }}>
                    ⚠️ {isRtl ? "يجب استخدام قارئ الباركود فقط! الكتابة اليدوية معطلة لتفادي الأخطاء." : "Must use barcode reader only! Manual typing is disabled to avoid errors."}
                  </span>
                )}
              </div>
              
              <div className="input-group" style={{ position: "relative", zIndex: 99 }}>
                <label className="input-label">{isRtl ? "بحث واختيار الكود *" : "Search & Select Code *"}</label>
                <div style={{ position: "relative" }}>
                  <input 
                    className="input" 
                    placeholder={isRtl ? "ابحث بالكود أو اسم العطل..." : "Search by code or description..."} 
                    value={selectedErrorCode ? `${selectedErrorCode.code} - ${translateError(selectedErrorCode, isRtl).title}` : searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedErrorCode) {
                        const oldVal = `${selectedErrorCode.code} - ${translateError(selectedErrorCode, isRtl).title}`;
                        if (val.length < oldVal.length) {
                          setSearchQuery("");
                        } else if (val.startsWith(oldVal)) {
                          setSearchQuery(val.slice(oldVal.length));
                        } else {
                          setSearchQuery(val);
                        }
                      } else {
                        setSearchQuery(val);
                      }
                      setSelectedErrorCode(null);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    required
                    autoComplete="off"
                    style={{
                      borderColor: selectedErrorCode ? "var(--green)" : "var(--border)",
                      background: selectedErrorCode ? "#f0fff4" : "white",
                      fontWeight: selectedErrorCode ? 700 : "normal",
                      paddingRight: isRtl ? 14 : 32,
                      paddingLeft: !isRtl ? 14 : 32
                    }}
                  />
                  {selectedErrorCode && (
                    <button type="button" onClick={() => setSelectedErrorCode(null)} style={{
                      position: "absolute",
                      left: isRtl ? 8 : "auto",
                      right: !isRtl ? 8 : "auto",
                      top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--red)", cursor: "pointer"
                    }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {showResults && !selectedErrorCode && (
                  <div className="animate-scale" style={{ 
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: "white", borderRadius: 8, border: "1px solid var(--border)",
                    boxShadow: "0 10px 15px rgba(0,0,0,0.1)", maxHeight: 250, overflowY: "auto", marginTop: 4
                  }}>
                    {filteredCodes.length === 0 ? (
                      <div style={{ padding: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {isRtl ? "لا توجد نتائج مطابقة" : "No matching error codes found"}
                      </div>
                    ) : (
                      filteredCodes.map(err => {
                        const trans = translateError(err, isRtl);
                        return (
                          <div 
                            key={`${err.code}__${err.stage_id}`} 
                            onClick={() => {
                              setSelectedErrorCode(err);
                              setShowResults(false);
                            }}
                            style={{ 
                              padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)",
                              fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}
                            className="hover-bg"
                          >
                            <div>
                              <strong style={{ color: "var(--accent)" }}>{trans.code}</strong> - {trans.title}
                            </div>
                            <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>
                              {isRtl ? (stageNames[err.stage_id] || err.stage_id) : (err.stage_id)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">{isRtl ? "تعيين إلى صندوق (اختياري)" : "Assign to Box (Optional)"}</label>
                <select className="input" name="boxId" style={{ background: "white" }}>
                  <option value="">{isRtl ? "-- اختر الصندوق --" : "-- Select Box --"}</option>
                  {boxes.map(box => {
                    const count = defectiveMeters.filter(m => m.box_id === box.id && m.status !== "resolved").length;
                    const isFull = count >= box.size;
                    return (
                      <option key={box.id} value={box.id} disabled={isFull}>
                        {box.name} ({box.category}) - {count}/{box.size} {isFull ? (isRtl ? "[ممتلئ]" : "[FULL]") : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">{isRtl ? "ملاحظات إضافية" : "Optional Comments"}</label>
                <input className="input" name="desc" placeholder={isRtl ? "ملاحظات اختيارية..." : "Add details..."} style={{ background: "white" }} />
              </div>
              <button type="submit" className="btn btn-danger" style={{ height: 42 }} disabled={isSubmitting}>
                <Plus size={16} /> {isSubmitting ? (isRtl ? "جاري التسجيل..." : "Registering...") : (isRtl ? "تسجيل العطل" : "Register Defect")}
              </button>
              {showResults && !selectedErrorCode && (
                <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setShowResults(false)} />
              )}
            </form>
          </div>
        )}

        {/* Filter & Summary */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
            <div className="defects-filters-track">
              {["all","reported","pending","verified","resolved"].map(s => (
                <button
                  key={s}
                  className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === "all" ? (isRtl ? "الكل" : "All") : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            
            <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
              <input
                className="input"
                style={{ 
                  paddingRight: isRtl ? 35 : 12, 
                  paddingLeft: !isRtl ? 35 : 12, 
                  textAlign: isRtl ? "right" : "left",
                  height: "36px",
                  fontSize: "0.85rem",
                  background: "white"
                }}
                value={defectsSearch}
                onChange={e => setDefectsSearch(e.target.value)}
                placeholder={isRtl ? "البحث بالسيريال نمبر، كود العطل، الصندوق..." : "Search serial, code, box..."}
              />
              <Search size={16} style={{
                position: "absolute",
                right: isRtl ? 10 : "auto",
                left: !isRtl ? 10 : "auto",
                top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
              }} />
            </div>
          </div>
          <div className="badge badge-gray" style={{ flexShrink: 0 }}>{isRtl ? "إجمالي السجلات:" : "Total Logs:"} {allMeters.length}</div>
        </div>

        {/* Defects List */}
        <div className="card desktop-only" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "السيريال نمبر" : "Serial Number"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "كود العطل" : "Fault Code"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المرحلة" : "Stage"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "عنوان العطل" : "Defect Title"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المُبلِّغ" : "Reported By"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الوقت" : "Time"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الحالة" : "Status"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الصندوق" : "Box"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المُعدِّل / المعالج" : "Modified By"}</th>
                  {["supervisor", "quality_management", "admin"].includes(currentUser.role) && <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تغيير الحالة" : "Change Status"}</th>}
                </tr>
              </thead>
              <tbody>
                {allMeters.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      {isRtl ? "لا توجد سجلات مطابقة" : "No matching records found"}
                    </td>
                  </tr>
                ) : allMeters.map(m => {
                  const err = m.error_code ? getErrorByCode(m.error_code) : null;
                  const trans = err ? translateError(err, isRtl) : null;
                  const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={m.id}>
                      <td>
                        <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem", color: "var(--cyan)" }}>
                          {m.serial_number}
                        </code>
                      </td>
                      <td>
                        {m.error_code ? (
                           <span className="badge badge-amber" style={{ fontFamily: "monospace" }}>{m.error_code}</span>
                        ) : <span className="badge badge-gray">—</span>}
                      </td>
                      <td>
                        <span className="badge badge-gray">{stageNames[m.stage_found] || m.stage_found}</span>
                      </td>
                      <td style={{ maxWidth: 250 }}>
                        <span style={{ fontWeight: 600 }}>{trans?.title || m.error_code || "—"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem" }}>
                          {getUserById(m.reported_by)?.full_name || m.reported_by || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formatDate(m.created_at)}
                      </td>
                      <td>
                        <span className={`badge ${sc.class}`}>{sc.icon} {sc.label}</span>
                        {m.status === "resolved" && (
                          <CountdownTimer resolvedAt={m.resolved_at} isRtl={isRtl} />
                        )}
                      </td>
                      <td>
                        {m.status === "resolved" ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>—</span>
                        ) : (
                          <select
                            className="input"
                            style={{ padding: "4px 8px", fontSize: "0.8rem", minWidth: "120px", background: "white" }}
                            value={m.box_id || ""}
                            onChange={async (e) => {
                              const selectedBoxId = e.target.value || null;
                              const res = await assignMeterToBox(m.id, selectedBoxId);
                              if (res && !res.success) {
                                alert(res.message);
                              }
                            }}
                          >
                            <option value="">{isRtl ? "-- بلا صندوق --" : "-- No Box --"}</option>
                            {boxes.map(box => {
                              const count = defectiveMeters.filter(x => x.box_id === box.id && x.status !== "resolved").length;
                              const isFull = count >= box.size && m.box_id !== box.id;
                              return (
                                <option key={box.id} value={box.id} disabled={isFull}>
                                  {box.name} ({box.category}) {isFull ? (isRtl ? "[ممتلئ]" : "[FULL]") : ""}
                                </option>
                              );
                            })}
                          </select>
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
                      {["supervisor", "quality_management", "admin"].includes(currentUser.role) && (
                        <td>
                          <select
                            className="input"
                            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                            value={m.status}
                            onChange={e => handleStatusChange(m.id, e.target.value)}
                          >
                            <option value="reported">{isRtl ? "بلاغ جديد" : "New Report"}</option>
                            <option value="pending">{isRtl ? "قيد الانتظار" : "Pending Review"}</option>
                            <option value="verified">{isRtl ? "تم التحقق (معطوب)" : "Verified Defective"}</option>
                            <option value="resolved">{isRtl ? "يعود لخط الانتاج" : "Returned to Line"}</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Defects Mobile Card List */}
        <div className="defects-mobile-list mobile-only">
          {allMeters.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              {isRtl ? "لا توجد سجلات مطابقة" : "No matching records found"}
            </div>
          ) : allMeters.map(m => {
            const err = m.error_code ? getErrorByCode(m.error_code) : null;
            const trans = err ? translateError(err, isRtl) : null;
            const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
            
            return (
              <div key={m.id} className="defect-mobile-card animate-fade">
                <div className="defect-card-header">
                  <span className="defect-card-serial">{m.serial_number}</span>
                  <span className={`badge ${sc.class}`}>{sc.icon} {sc.label}</span>
                </div>
                
                <div className="defect-card-body">
                  <div className="defect-card-field">
                    <span>{isRtl ? "رمز العطل:" : "Fault Code:"}</span>
                    {m.error_code ? (
                      <span className="badge badge-amber" style={{ fontFamily: "monospace" }}>{m.error_code}</span>
                    ) : <span className="badge badge-gray">—</span>}
                  </div>
                  
                  <div className="defect-card-field">
                    <span>{isRtl ? "المرحلة:" : "Stage:"}</span>
                    <span className="badge badge-gray">{stageNames[m.stage_found] || m.stage_found}</span>
                  </div>
                  
                  <div className="defect-card-field">
                    <span>{isRtl ? "المُبلِّغ:" : "Reported By:"}</span>
                    <span style={{ fontWeight: 600 }}>{getUserById(m.reported_by)?.full_name || m.reported_by || "—"}</span>
                  </div>
                  
                  <div className="defect-card-field" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    <span>{isRtl ? "الوقت:" : "Time:"}</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  
                  <div className="defect-card-field">
                    <span>{isRtl ? "الصندوق:" : "Box:"}</span>
                    {m.status === "resolved" ? (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    ) : (
                      <select
                        className="input"
                        style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto", display: "inline-block", background: "white" }}
                        value={m.box_id || ""}
                        onChange={async (e) => {
                          const selectedBoxId = e.target.value || null;
                          const res = await assignMeterToBox(m.id, selectedBoxId);
                          if (res && !res.success) {
                            alert(res.message);
                          }
                        }}
                      >
                        <option value="">{isRtl ? "-- بلا صندوق --" : "-- No Box --"}</option>
                        {boxes.map(box => {
                          const count = defectiveMeters.filter(x => x.box_id === box.id && x.status !== "resolved").length;
                          const isFull = count >= box.size && m.box_id !== box.id;
                          return (
                            <option key={box.id} value={box.id} disabled={isFull}>
                              {box.name} ({box.category}) {isFull ? (isRtl ? "[ممتلئ]" : "[FULL]") : ""}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  <div className="defect-card-desc">
                    {trans?.title ? trans.title : (m.custom_description ? <TranslateText text={m.custom_description} targetLang={isRtl ? "ar" : "en"} /> : "—")}
                  </div>
                  
                  {m.status === "resolved" && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="defect-card-desc" style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: 8, borderRadius: 6, margin: 0 }}>
                        <strong>{isRtl ? "المعالج:" : "Resolved By:"}</strong> {getUserById(m.resolved_by)?.full_name || m.resolved_by || "System"}
                      </div>
                      <CountdownTimer resolvedAt={m.resolved_at} isRtl={isRtl} />
                    </div>
                  )}
                </div>
                
                {["supervisor", "quality_management", "admin"].includes(currentUser.role) && (
                  <div className="defect-card-actions">
                    <label>{isRtl ? "تعديل حالة العداد" : "Change Status"}</label>
                    <select
                      className="input"
                      value={m.status}
                      onChange={e => handleStatusChange(m.id, e.target.value)}
                      style={{ padding: "8px 10px", fontSize: "0.85rem" }}
                    >
                      <option value="reported">{isRtl ? "بلاغ جديد" : "New Report"}</option>
                      <option value="pending">{isRtl ? "قيد الانتظار" : "Pending Review"}</option>
                      <option value="verified">{isRtl ? "تم التحقق (معطوب)" : "Verified Defective"}</option>
                      <option value="resolved">{isRtl ? "يعود لخط الانتاج" : "Returned to Line"}</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}

        {activeTab === "boxes" && (
          <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Box Stats Summary */}
            <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                <div className="stat-icon" style={{ fontSize: "1.5rem", width: 52, height: 52, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9, 105, 218, 0.08)", color: "var(--blue)" }}>📦</div>
                <div>
                  <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 800 }}>{boxes.length}</div>
                  <div className="stat-label" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{isRtl ? "إجمالي الصناديق" : "Total Boxes"}</div>
                </div>
              </div>
              <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                <div className="stat-icon" style={{ fontSize: "1.5rem", width: 52, height: 52, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(207, 34, 46, 0.08)", color: "var(--red)" }}>🚨</div>
                <div>
                  <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                    {boxes.filter(b => defectiveMeters.filter(m => m.box_id === b.id && m.status !== "resolved").length >= b.size).length}
                  </div>
                  <div className="stat-label" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{isRtl ? "الصناديق الممتلئة" : "Full Boxes"}</div>
                </div>
              </div>
              <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                <div className="stat-icon" style={{ fontSize: "1.5rem", width: 52, height: 52, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26, 127, 55, 0.08)", color: "var(--accent)" }}>🧪</div>
                <div>
                  <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                    {defectiveMeters.filter(m => m.box_id && m.status !== "resolved").length}
                  </div>
                  <div className="stat-label" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{isRtl ? "عدادات بالصناديق" : "Meters in Boxes"}</div>
                </div>
              </div>
              <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                <div className="stat-icon" style={{ fontSize: "1.5rem", width: 52, height: 52, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}>⚠️</div>
                <div>
                  <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                    {defectiveMeters.filter(m => !m.box_id && m.status !== "resolved").length}
                  </div>
                  <div className="stat-label" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{isRtl ? "معطوبات بلا صندوق" : "Unassigned Defects"}</div>
                </div>
              </div>
            </div>

            {/* Create Box Form */}
            <div className="card" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", padding: 20, borderRadius: "var(--radius-xl)" }}>
              <div className="card-header" style={{ paddingBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  📦 {isRtl ? "إنشاء صندوق تتبع جديد" : "Create New Tracking Box"}
                </h3>
              </div>
              
              {boxSubmitMsg && (
                <div className={`alert alert-${boxSubmitMsg.type === "error" ? "danger" : "success"}`} style={{ marginBottom: 16 }}>
                  {boxSubmitMsg.text}
                </div>
              )}

              <form onSubmit={handleCreateBox} className="defect-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16, alignItems: "end" }}>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>{isRtl ? "رقم الصندوق (تلقائي) *" : "Box Number (Auto) *"}</label>
                  <input
                    className="input"
                    value={getNextBoxName()}
                    readOnly
                    style={{ background: "#f5f5f5", fontWeight: "bold", fontFamily: "monospace", color: "var(--cyan)" }}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>{isRtl ? "السعة (السعة القصوى) *" : "Capacity (Max Size) *"}</label>
                  <select
                    className="input"
                    value={newBoxSize}
                    onChange={e => setNewBoxSize(e.target.value)}
                    style={{ background: "white" }}
                  >
                    <option value="24">{isRtl ? "كبير (24 عداد)" : "Large (24 Meters)"}</option>
                    <option value="8">{isRtl ? "صغير (8 عدادات)" : "Small (8 Meters)"}</option>
                    <option value="custom">{isRtl ? "سعة مخصصة..." : "Custom Capacity..."}</option>
                  </select>
                  {newBoxSize === "custom" && (
                    <input
                      type="number"
                      className="input"
                      value={customSize}
                      onChange={e => setCustomSize(e.target.value)}
                      placeholder={isRtl ? "أدخل العدد..." : "Enter quantity..."}
                      required
                      min="1"
                      style={{ marginTop: 6, background: "white" }}
                    />
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>{isRtl ? "التصنيف (الكاتجري) *" : "Box Category *"}</label>
                  <select
                    className="input"
                    value={newBoxCategory}
                    onChange={e => setNewBoxCategory(e.target.value)}
                    style={{ background: "white" }}
                  >
                    <option value="Assembly">{isRtl ? "Assembly (التجميع)" : "Assembly"}</option>
                    <option value="Insulation Test">{isRtl ? "Insulation (اختبار العزل)" : "Insulation Test"}</option>
                    <option value="Radio Frequency">{isRtl ? "Radio Frequency (التردد اللاسلكي)" : "Radio Frequency"}</option>
                    <option value="Calibration">{isRtl ? "Calibration (المعايرة)" : "Calibration"}</option>
                    <option value="Multi Test">{isRtl ? "Multi Test (الاختبار المتعدد)" : "Multi Test"}</option>
                    <option value="Perso">{isRtl ? "Perso (التخصيص)" : "Perso"}</option>
                    <option value="Scrap">{isRtl ? "Scrap (سكراب)" : "Scrap"}</option>
                    <option value="custom">{isRtl ? "تصنيف مخصص (أكتب بنفسك)..." : "Custom Category..."}</option>
                  </select>
                  {newBoxCategory === "custom" && (
                    <input
                      className="input"
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      placeholder={isRtl ? "اكتب التصنيف هنا..." : "Type custom category..."}
                      required
                      style={{ marginTop: 6, background: "white" }}
                    />
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ height: 42, background: "var(--accent)", color: "white" }}>
                  {isRtl ? "إنشاء الصندوق" : "Create Box"}
                </button>
              </form>
            </div>

            {/* Boxes Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
              {boxes.length === 0 ? (
                <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                  📦 {isRtl ? "لا توجد صناديق مضافة حالياً. استخدم النموذج أعلاه لإنشاء أول صندوق." : "No boxes added yet. Use the form above to create one."}
                </div>
              ) : (
                boxes.map(box => {
                  const metersInBox = defectiveMeters.filter(m => m.box_id === box.id && m.status !== "resolved");
                  const count = metersInBox.length;
                  const isFull = count >= box.size;
                  const percent = Math.min(100, Math.round((count / box.size) * 100));
                  const isExpanded = expandedBoxId === box.id;
                  
                  // Category badge styling
                  let badgeClass = "badge-gray";
                  if (box.category.toLowerCase().includes("scrap") || box.category.includes("سكراب")) badgeClass = "badge-red";
                  else if (box.category.toLowerCase().includes("calibration") || box.category.includes("معايرة")) badgeClass = "badge-blue";
                  else if (box.category.toLowerCase().includes("multi") || box.category.includes("متعدد")) badgeClass = "badge-purple";
                  else if (box.category.toLowerCase().includes("rework") || box.category.includes("تشغيل")) badgeClass = "badge-amber";

                  return (
                    <div key={box.id} className="card animate-fade" style={{ display: "flex", flexDirection: "column", gap: 16, border: isFull ? "1px solid #feb2b2" : "1px solid var(--border)", background: isFull ? "#fff5f5" : "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
                      {/* Box Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{box.name}</h4>
                          <span className={`badge ${badgeClass}`} style={{ marginTop: 6, display: "inline-block" }}>
                            {box.category}
                          </span>
                        </div>
                        <div style={{ textAlign: isRtl ? "left" : "right" }}>
                          <span style={{ fontSize: "1.2rem", fontWeight: 800, color: isFull ? "var(--red)" : "var(--text-primary)" }}>
                            {count} / {box.size}
                          </span>
                          {isFull && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--red)", fontWeight: 700, marginTop: 2 }}>
                              ⚠️ {isRtl ? "ممتلئ" : "FULL"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fill Progress Bar */}
                      <div>
                        <div className="progress-bar" style={{ height: 8, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${percent}%`,
                              height: "100%",
                              borderRadius: 99,
                              transition: "width 0.4s ease",
                              background: isFull ? "var(--red)" : percent > 75 ? "#f59e0b" : "var(--green)"
                            }}
                          />
                        </div>
                      </div>

                      {/* Meters inside box toggle */}
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: "100%", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                          onClick={() => setExpandedBoxId(isExpanded ? null : box.id)}
                        >
                          <span style={{ fontWeight: 600 }}>📋 {isRtl ? "العدادات المشمولة" : "Included Meters"} ({count})</span>
                          <span style={{ fontSize: "0.75rem" }}>{isExpanded ? "▲" : "▼"}</span>
                        </button>

                        {isExpanded && (
                          <div className="animate-fade" style={{ background: "white", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10, marginTop: 8, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                            {count === 0 ? (
                              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                                {isRtl ? "لا توجد عدادات في هذا الصندوق" : "No meters in this box"}
                              </span>
                            ) : (
                              metersInBox.map(m => (
                                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", borderRadius: 4 }}>
                                  <code style={{ fontFamily: "monospace", color: "var(--cyan)", fontWeight: 600 }}>{m.serial_number}</code>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className="badge badge-gray" style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>{m.error_code}</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(isRtl ? `هل أنت متأكد من إزالة العداد ${m.serial_number} من الصندوق؟` : `Remove meter ${m.serial_number} from box?`)) {
                                          await assignMeterToBox(m.id, null);
                                        }
                                      }}
                                      style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "0.95rem", padding: "0 4px", fontWeight: "bold" }}
                                      title={isRtl ? "إزالة من الصندوق" : "Remove from box"}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Inline Add Meter to Box Selector */}
                            {!isFull && (
                              <div style={{ marginTop: 8, borderTop: "1px dashed var(--border-subtle)", paddingTop: 10 }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                                  {isRtl ? "إضافة عداد معطوب لهذا الصندوق:" : "Add defective meter to this box:"}
                                </label>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <select
                                    id={`add-meter-select-${box.id}`}
                                    className="input"
                                    style={{ padding: "4px 8px", fontSize: "0.8rem", flex: 1, background: "white" }}
                                    defaultValue=""
                                  >
                                    <option value="">{isRtl ? "-- اختر العداد --" : "-- Select Meter --"}</option>
                                    {defectiveMeters
                                      .filter(m => !m.box_id && m.status !== "resolved")
                                      .map(m => (
                                        <option key={m.id} value={m.id}>
                                          {m.serial_number} ({m.error_code})
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ padding: "4px 12px", background: "var(--accent)", color: "white", fontSize: "0.78rem" }}
                                    onClick={async () => {
                                      const selectEl = document.getElementById(`add-meter-select-${box.id}`);
                                      const meterId = selectEl.value;
                                      if (!meterId) return;
                                      const res = await assignMeterToBox(meterId, box.id);
                                      if (res && !res.success) {
                                        alert(res.message);
                                      } else {
                                        selectEl.value = "";
                                      }
                                    }}
                                  >
                                    {isRtl ? "إضافة" : "Add"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="divider" style={{ margin: "4px 0 12px 0" }} />

                      {/* Card Actions */}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, padding: "8px", fontSize: "0.82rem", fontWeight: 600 }}
                          disabled={count === 0}
                          onClick={async () => {
                            if (confirm(isRtl ? `هل أنت متأكد من إفراغ الصندوق "${box.name}" بالكامل؟` : `Are you sure you want to empty "${box.name}"?`)) {
                              // Unassign all
                              for (const m of metersInBox) {
                                await assignMeterToBox(m.id, null);
                              }
                            }
                          }}
                        >
                          🧹 {isRtl ? "إفراغ الصندوق" : "Empty Box"}
                        </button>
                        
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ border: "1px solid rgba(207, 34, 46, 0.2)", color: "var(--red)", background: "rgba(207, 34, 46, 0.04)", padding: "8px", fontSize: "0.82rem", fontWeight: 600 }}
                          onClick={async () => {
                            if (confirm(isRtl ? `هل أنت متأكد من حذف الصندوق "${box.name}"؟ سيتم إخراج جميع العدادات منه.` : `Are you sure you want to delete box "${box.name}"? All meters will be unassigned.`)) {
                              await deleteBox(box.id);
                            }
                          }}
                        >
                          🗑️ {isRtl ? "حذف" : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Filters */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div className="input-group" style={{ maxWidth: 300, flex: 1 }}>
                <input 
                  className="input" 
                  value={historySearch} 
                  onChange={e => setHistorySearch(e.target.value)} 
                  placeholder={isRtl ? "البحث بالسيريال نمبر..." : "Search by Serial Number..."} 
                />
              </div>
              <div className="badge badge-gray" style={{ flexShrink: 0 }}>
                {isRtl ? "إجمالي الحركات:" : "Total Actions:"} {filteredLogs.length}
              </div>
            </div>

            {/* Desktop History Table */}
            <div className="card desktop-only" style={{ padding: 0 }}>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "السيريال نمبر" : "Serial Number"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "نوع الحركة" : "Action Type"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تفاصيل الحركة" : "Action Details"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "بواسطة" : "Performed By"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التاريخ والوقت" : "Date & Time"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                          {isRtl ? "لا توجد سجلات مطابقة" : "No history records found"}
                        </td>
                      </tr>
                    ) : filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <code style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--cyan)" }}>
                            {log.serial_number}
                          </code>
                        </td>
                        <td>
                          <span className={`badge ${
                            log.action_type === 'reported' ? 'badge-blue' : 'badge-amber'
                          }`}>
                            {log.action_type === 'reported' 
                              ? (isRtl ? "تسجيل بلاغ" : "Reported") 
                              : (isRtl ? "تغيير حالة" : "Status Change")}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.83rem" }}>
                          {getActionLabel(log.action_type, log.old_status, log.new_status)}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{log.performed_by_name}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{log.performed_by}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile History Cards */}
            <div className="mobile-only" style={{ display: "grid", gap: 12 }}>
              {filteredLogs.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  {isRtl ? "لا توجد سجلات مطابقة" : "No history records found"}
                </div>
              ) : filteredLogs.map((log) => (
                <div key={log.id} className="card animate-fade" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <code style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--cyan)" }}>{log.serial_number}</code>
                    <span className={`badge ${
                      log.action_type === 'reported' ? 'badge-blue' : 'badge-amber'
                    }`}>
                      {log.action_type === 'reported' ? (isRtl ? "بلاغ" : "Reported") : (isRtl ? "تعديل" : "Edit")}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.82rem", marginBottom: 8 }}>
                    <strong>{isRtl ? "الحركة:" : "Action:"}</strong> {getActionLabel(log.action_type, log.old_status, log.new_status)}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                    <span>👤 {log.performed_by_name} ({log.performed_by})</span>
                    <span>🕒 {formatDate(log.created_at).split(" · ")[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={20} style={{ color: "var(--amber)" }} />
                <h3 style={{ margin: 0 }}>{isRtl ? "مراجعة العدادات قيد الانتظار" : "Review Pending Quality Gate Meters"}</h3>
              </div>
              <button className="btn-close" onClick={() => { setReviewModal(false); setReviewSearch(""); setConfirmingId(null); }}>✕</button>
            </div>
            
            <div style={{ padding: 20, background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="input-group">
                <label className="input-label">{isRtl ? "بحث سريع بالسيريال نمبر" : "Quick Search by Serial Number"}</label>
                <input 
                  className="input" 
                  value={reviewSearch} 
                  onChange={e => setReviewSearch(e.target.value)} 
                  placeholder={isRtl ? "اكتب السيريال للبحث..." : "Enter serial code..."}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {pendingMeters.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                  <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <p>{isRtl ? "لا توجد عدادات قيد الانتظار" : "No pending quality gate items"} {reviewSearch ? (isRtl ? "تطابق البحث" : "matching search") : ""}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {pendingMeters.map(m => {
                    const err = m.error_code ? getErrorByCode(m.error_code) : null;
                    const trans = err ? translateError(err, isRtl) : null;
                    const isConfirming = confirmingId === m.id;

                    return (
                      <div key={m.id} className="card" style={{ 
                        padding: 16, 
                        border: isConfirming ? "2px solid var(--blue)" : "1px solid var(--border)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                              <code style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue)" }}>{m.serial_number}</code>
                              <span className="badge badge-gray">{stageNames[m.stage_found] || m.stage_found}</span>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              <span style={{ fontWeight: 700 }}>{isRtl ? "العطل:" : "Fault:"}</span> {m.error_code} — {trans?.title || "No Title"}
                            </div>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {formatDate(m.created_at)}
                          </div>
                        </div>

                        <div className="divider" style={{ margin: "12px 0" }} />

                        {isConfirming ? (
                          <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-elevated)", padding: 12, borderRadius: 8, width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                                {isRtl ? "تغيير الحالة إلى:" : "Change state to:"} <span className={`badge ${STATUS_CONFIG[newStatus].class}`}>{STATUS_CONFIG[newStatus].label}</span>?
                              </span>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={async () => {
                                    if (newStatus === "verified") {
                                      const selectEl = document.getElementById(`review-box-select-${m.id}`);
                                      const selectedBoxId = selectEl?.value || null;
                                      if (selectedBoxId) {
                                        const res = await assignMeterToBox(m.id, selectedBoxId);
                                        if (res && !res.success) {
                                          alert(res.message);
                                          return;
                                        }
                                      }
                                    }
                                    handleStatusChange(m.id, newStatus, true);
                                  }}
                                >
                                  {isRtl ? "تأكيد وحفظ" : "Confirm & Save"}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(null)}>{isRtl ? "إلغاء" : "Cancel"}</button>
                              </div>
                            </div>

                            {newStatus === "verified" && (
                              <div style={{ borderTop: "1px dashed var(--border-subtle)", paddingTop: 8, marginTop: 4 }}>
                                <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>
                                  {isRtl ? "تحديد الصندوق لحفظ العداد فيه (اختياري):" : "Select box to store this defective meter (Optional):"}
                                </label>
                                <select
                                  id={`review-box-select-${m.id}`}
                                  className="input"
                                  style={{ padding: "4px 8px", fontSize: "0.8rem", width: "100%", background: "white" }}
                                  defaultValue={m.box_id || ""}
                                >
                                  <option value="">{isRtl ? "-- بلا صندوق --" : "-- No Box --"}</option>
                                  {boxes.map(box => {
                                    const count = defectiveMeters.filter(x => x.box_id === box.id && x.status !== "resolved").length;
                                    const isFull = count >= box.size && m.box_id !== box.id;
                                    return (
                                      <option key={box.id} value={box.id} disabled={isFull}>
                                        {box.name} ({box.category}) {isFull ? (isRtl ? "[ممتلئ]" : "[FULL]") : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button 
                              className="btn btn-danger btn-sm" 
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => { setConfirmingId(m.id); setNewStatus("verified"); }}
                            >
                              <AlertTriangle size={14} /> {isRtl ? "تأكيد العطل" : "Confirm Defect"}
                            </button>
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ flex: 1, minWidth: 120, background: "var(--accent)" }}
                              onClick={() => { setConfirmingId(m.id); setNewStatus("resolved"); }}
                            >
                              <CheckCircle size={14} /> {isRtl ? "يعود للإنتاج" : "Return to Line"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="modal-header" style={{ background: "var(--bg-elevated)", padding: "12px 20px", flexDirection: isRtl ? "row" : "row-reverse" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{isRtl ? "إجمالي الانتظار:" : "Total Pending:"} {pendingMeters.length}</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setReviewModal(false)}>{isRtl ? "إغلاق" : "Close"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
