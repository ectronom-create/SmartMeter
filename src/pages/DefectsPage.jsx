import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle, Clock, AlertTriangle, X, Plus, AlertCircle } from "lucide-react";
import { translateError } from "./KnowledgeBasePage";
import * as XLSX from "xlsx";
import CountdownTimer from "../components/CountdownTimer";

const getStatusConfig = (isRtl) => ({
  reported: { label: isRtl ? "بلاغ جديد" : "New Report",           class: "badge-blue",   icon: <Plus size={11} /> },
  pending:  { label: isRtl ? "قيد الانتظار" : "Pending Review",     class: "badge-amber",  icon: <Clock size={11} /> },
  verified: { label: isRtl ? "تم التحقق (معطوب)" : "Verified Defect",  class: "badge-red",    icon: <AlertTriangle size={11} /> },
  resolved: { label: isRtl ? "يعود لخط الانتاج" : "Returned to Line",  class: "badge-green",  icon: <CheckCircle size={11} /> },
});

const getStageNames = (isRtl) => ({
  "STG-01": isRtl ? "التجميع" : "Assembly", 
  "STG-02": isRtl ? "العزل" : "Insulation",
  "STG-03": isRtl ? "التردد اللاسلكي" : "Radio Frequency", 
  "STG-04": isRtl ? "المعايرة" : "Calibration", 
  "STG-05": isRtl ? "الاختبار المتعدد" : "Multi Test", 
  "STG-06": isRtl ? "التخصيص" : "Perso",
  "GLOBAL": isRtl ? "عام" : "General"
});

export default function DefectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    defectiveMeters, currentUser, updateMeterStatus, 
    getErrorByCode, addDefectiveMeter, addDefectiveMetersBulk, currentStage, errorCodes, language
  } = useApp();

  const isRtl = language === "ar";
  const STATUS_CONFIG = getStatusConfig(isRtl);
  const stageNames = getStageNames(isRtl);
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [submitMsg, setSubmitMsg] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  
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
        
        if (isRtl) {
          return {
            "الرقم التسلسلي (سيريال)": m.serial_number,
            "رمز العطل": m.error_code || "—",
            "وصف العطل": trans?.title || m.custom_description || "—",
            "المرحلة": stageText || "—",
            "المُبلِّغ": m.reported_by || "—",
            "الحالة": statusText || "—",
            "تاريخ البلاغ": formatDate(m.created_at)
          };
        } else {
          return {
            "Serial Number": m.serial_number,
            "Error Code": m.error_code || "—",
            "Error Title": trans?.title || m.custom_description || "—",
            "Stage Found": stageText || "—",
            "Reported By": m.reported_by || "—",
            "Status": statusText || "—",
            "Date Reported": formatDate(m.created_at)
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

  const handleUpdateStatus = (id, status) => {
    updateMeterStatus(id, status);
    setConfirmingId(null);
    setNewStatus("");
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

  const filtered = defectiveMeters.filter(m =>
    filterStatus === "all" ? true : m.status === filterStatus
  );

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

    const result = await addDefectiveMeter({
      serial_number: sn,
      error_code: selectedErrorCode.code,
      stage_found: selectedErrorCode.stage_id,
      custom_description: fd.get("desc").trim(),
      reported_by: currentUser.employee_id
    });

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
            {(currentUser.role === "supervisor" || currentUser.role === "admin") && (
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

        {/* Quick Report Form */}
        {currentUser.role !== "admin" && (
          <div className="card animate-fade" style={{ background: "#fff5f5", border: "1px solid #feb2b2", overflow: "visible" }}>
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <AlertTriangle size={18} style={{ color: "var(--red)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "تسجيل بلاغ عطل جديد" : "Report a New Defect"}</h3>
            </div>
            {submitMsg && <div className={`alert alert-${submitMsg.type === "error" ? "danger" : "success"}`} style={{ marginBottom: 12 }}>{submitMsg.text}</div>}
            <form onSubmit={handleQuickSubmit} className="defect-form-grid">
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
              
              <div className="input-group" style={{ position: "relative" }}>
                <label className="input-label">{isRtl ? "بحث واختيار الكود *" : "Search & Select Code *"}</label>
                <div style={{ position: "relative" }}>
                  <input 
                    className="input" 
                    placeholder={isRtl ? "ابحث بالكود أو اسم العطل..." : "Search by code or description..."} 
                    value={selectedErrorCode ? `${selectedErrorCode.code} - ${translateError(selectedErrorCode, isRtl).title}` : searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
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
                            key={err.code} 
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
                <label className="input-label">{isRtl ? "ملاحظات إضافية" : "Optional Comments"}</label>
                <input className="input" name="desc" placeholder={isRtl ? "ملاحظات اختيارية..." : "Add details..."} style={{ background: "white" }} />
              </div>
              <button type="submit" className="btn btn-danger" style={{ height: 42 }}>
                <Plus size={16} /> {isRtl ? "تسجيل العطل" : "Register Defect"}
              </button>
              {showResults && !selectedErrorCode && (
                <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setShowResults(false)} />
              )}
            </form>
          </div>
        )}

        {/* Filter & Summary */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الوصف" : "Description"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الوقت" : "Time"}</th>
                  <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الحالة" : "Status"}</th>
                  {currentUser.role === "supervisor" && <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تغيير الحالة" : "Change Status"}</th>}
                </tr>
              </thead>
              <tbody>
                {allMeters.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
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
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {trans?.title || m.custom_description || "—"}
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
                      {currentUser.role === "supervisor" && (
                        <td>
                          <select
                            className="input"
                            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                            value={m.status}
                            onChange={e => updateMeterStatus(m.id, e.target.value)}
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
                  
                  <div className="defect-card-field" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    <span>{isRtl ? "الوقت:" : "Time:"}</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>

                  <div className="defect-card-desc">
                    {trans?.title || m.custom_description || "—"}
                  </div>
                  
                  {m.status === "resolved" && (
                    <div style={{ marginTop: 4 }}>
                      <CountdownTimer resolvedAt={m.resolved_at} isRtl={isRtl} />
                    </div>
                  )}
                </div>
                
                {currentUser.role === "supervisor" && (
                  <div className="defect-card-actions">
                    <label>{isRtl ? "تعديل حالة العداد" : "Change Status"}</label>
                    <select
                      className="input"
                      value={m.status}
                      onChange={e => updateMeterStatus(m.id, e.target.value)}
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
                          <div className="animate-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)", padding: 10, borderRadius: 8, flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                              {isRtl ? "تغيير الحالة إلى:" : "Change state to:"} <span className={`badge ${STATUS_CONFIG[newStatus].class}`}>{STATUS_CONFIG[newStatus].label}</span>?
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus(m.id, newStatus)}>{isRtl ? "تأكيد وحفظ" : "Confirm & Save"}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(null)}>{isRtl ? "إلغاء" : "Cancel"}</button>
                            </div>
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
