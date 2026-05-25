import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import {
  Search, BookOpen, ArrowRight, AlertCircle,
  ChevronDown, ChevronUp, X
} from "lucide-react";
import * as XLSX from "xlsx";

const STAGE_COLORS = {
  "STG-01": "#f97316", "STG-02": "#4f46e5",
  "STG-03": "#06b6d4", "STG-04": "#10b981",
  "STG-05": "#8b5cf6", "STG-06": "#ec4899",
  "GLOBAL": "#0550ae"
};

// Perfect Bilingual Error Translator helper
export const translateError = (err, isRtl) => {
  if (!err) return err;
  const dbTitle = isRtl
    ? (err.title_ar || err.title_en || err.title)
    : (err.title_en || err.title_ar || err.title);
  const baseErr = { ...err, title: dbTitle };
  if (isRtl) return baseErr;
  const translations = {
    "-101": {
      title: "SFC Error - Data Retrieval Failed",
      description: "Failed to retrieve manufacturing data from SFC system.",
      troubleshooting_steps: [
        "Check network connection to the server.",
        "Scan the barcode again.",
        "Ensure the serial number is registered in SAP.",
        "If error persists, notify the IT supervisor."
      ]
    },
    "-576": {
      title: "Connection Error - Failed to Communicate",
      description: "Physical communication with the meter failed via port.",
      troubleshooting_steps: [
        "Check the cable connecting the device and the meter.",
        "Ensure COM port is correctly configured.",
        "Restart the test application.",
        "Try another cable if the issue persists."
      ]
    },
    "ASM-01": {
      title: "Housing Assembly Error",
      description: "Irregularities in the outer housing installation.",
      troubleshooting_steps: [
        "Verify main board alignment.",
        "Ensure all screws are tightened to the specified torque.",
        "Inspect for cracks or deformities in the housing."
      ]
    },
    "E201": {
      title: "Electrical Current Leakage",
      description: "Leakage current value exceeded allowed limits.",
      troubleshooting_steps: [
        "Ensure meter is completely dry before testing.",
        "Check plastic insulators for cracks or deformities.",
        "Clean contact points from moisture or dirt.",
        "If test fails twice, classify the meter as defective."
      ]
    },
    "E202": {
      title: "Hi-Pot Test Failed",
      description: "Meter cannot withstand high test voltage.",
      troubleshooting_steps: [
        "Verify all insulation points are intact.",
        "Ensure no moisture is inside the meter.",
        "Apply drying procedure then retest.",
        "Review approved test voltage specifications."
      ]
    },
    "RF-01": {
      title: "Wireless Communication Failure",
      description: "Meter failed to connect to wireless network.",
      troubleshooting_steps: [
        "Check antenna soldering on board.",
        "Measure RSSI level using approved test tool.",
        "Ensure correct network frequency is programmed.",
        "Replace wireless module if other solutions fail."
      ]
    },
    "RF-02": {
      title: "Low Signal Strength (Low RSSI)",
      description: "Wireless signal strength is below the minimum limit.",
      troubleshooting_steps: [
        "Check antenna position and angle.",
        "Inspect soldering on antenna header.",
        "Try moving the meter to a stronger signal area.",
        "Review broadcast channel configuration."
      ]
    },
    "CAL-01": {
      title: "Active Energy Calibration Error",
      description: "Active energy reading deviates from reference value.",
      troubleshooting_steps: [
        "Clean electrical contact points.",
        "Ensure stable reference voltage source.",
        "Adjust transfer factor in calibration program.",
        "Restart calibration process from scratch."
      ]
    },
    "CAL-02": {
      title: "Reactive Energy Calibration Error",
      description: "Reactive energy (KVAR) reading deviates.",
      troubleshooting_steps: [
        "Verify wiring connections of the measurement circuit.",
        "Check phase angle factor.",
        "Compare with approved reference measurement equipment."
      ]
    },
    "MT-01": {
      title: "Memory Test Failure",
      description: "Failed Flash or RAM memory test.",
      troubleshooting_steps: [
        "Restart test once.",
        "Check technical error log file.",
        "Verify correct firmware version is loaded.",
        "If failure persists, replace main board."
      ]
    },
    "MT-02": {
      title: "Display Test Failure",
      description: "Parts of the screen do not work or show incorrect digits.",
      troubleshooting_steps: [
        "Check display ribbon cable.",
        "Ensure display is securely mounted in the housing.",
        "Test screen with different program values.",
        "Replace display if fault is confirmed."
      ]
    },
    "MT-03": {
      title: "Anti-Tamper Test Failure",
      description: "Meter does not respond to anti-tamper sensor.",
      troubleshooting_steps: [
        "Check magnet sensor position.",
        "Verify sensor wiring is intact.",
        "Review anti-tamper software configuration."
      ]
    },
    "PS-01": {
      title: "Personalization Data Write Error",
      description: "Failed to write customer data to meter memory.",
      troubleshooting_steps: [
        "Ensure correct personalization file (Perso file) is used.",
        "Check memory is not full.",
        "Retry writing after clearing memory.",
        "Verify file access permissions."
      ]
    },
    "PS-02": {
      title: "Label Printing Error",
      description: "Final label did not print or has incorrect data.",
      troubleshooting_steps: [
        "Verify printer connection.",
        "Ensure correct data is sent to the printer.",
        "Restart printing service.",
        "Use new label paper and verify compatibility."
      ]
    }
  };
  return translations[err.code] ? { ...baseErr, ...translations[err.code] } : baseErr;
};

function ErrorCard({ err, stage, isOpen, onToggle, isRtl }) {
  const color = STAGE_COLORS[err.stage_id] || "var(--accent)";
  const translated = translateError(err, isRtl);
  
  return (
    <div
      className="card"
      style={{
        padding: 0, overflow: "hidden",
        border: isOpen ? `1.5px solid ${color}66` : "1px solid var(--border-subtle)",
        transition: "border 0.2s"
      }}
    >
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "14px 18px", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 12, 
          textAlign: isRtl ? "right" : "left",
          flexDirection: isRtl ? "row" : "row-reverse"
        }}
      >
        <span style={{
          fontFamily: "monospace", fontWeight: 800, fontSize: "0.9rem",
          background: color + "18", color, border: `1px solid ${color}44`,
          padding: "3px 10px", borderRadius: 6, flexShrink: 0
        }}>
          {translated.code}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: "0.95rem" }}>{translated.title}</span>
        <span className="badge badge-gray" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
          {isRtl ? (stage?.short_name || err.stage_id) : ((stage?.stage_name.match(/\(([^)]+)\)/)?.[1] || stage?.stage_name) || err.stage_id)}
        </span>
        {isOpen
          ? <ChevronUp size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      {/* Expanded steps */}
      {isOpen && (
        <div style={{
          padding: "0 18px 18px 18px",
          borderTop: `1px solid ${color}33`,
          background: color + "08",
          textAlign: isRtl ? "right" : "left"
        }}>
          {translated.description && (
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "12px 0 14px" }}>
              <TranslateText text={translated.description} targetLang={isRtl ? "ar" : "en"} />
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
            <AlertCircle size={14} style={{ color }} />
            <span style={{ fontWeight: 800, fontSize: "0.78rem", color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isRtl ? "خطوات التعامل" : "Troubleshooting Steps"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TranslateSteps
              steps={translated.troubleshooting_steps || []}
              targetLang={isRtl ? "ar" : "en"}
              renderStep={(step, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: color + "22", color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.78rem", fontWeight: 800, flexShrink: 0,
                    border: `1px solid ${color}44`
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, paddingTop: 2, flex: 1 }}>{step}</p>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { errorCodes, productionStages, getStageById, language, currentUser, addErrorCodesBulk } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [openCode, setOpenCode] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

  const isRtl = language === "ar";

  // When searching: flat filtered list. When not: show all grouped by stage.
  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return errorCodes.filter(e =>
      e.code.toLowerCase().includes(q) ||
      (e.title_ar && e.title_ar.toLowerCase().includes(q)) ||
      (e.title_en && e.title_en.toLowerCase().includes(q)) ||
      (e.description || "").toLowerCase().includes(q)
    );
  }, [searchQuery, errorCodes, isSearching]);

  // Group all codes by stage
  const groupedByStage = useMemo(() => {
    return productionStages.map(stage => ({
      stage,
      codes: errorCodes.filter(e => e.stage_id === stage.stage_id),
    })).filter(g => g.codes.length > 0);
  }, [productionStages, errorCodes]);

  const toggle = (code) => setOpenCode(prev => prev === code ? null : code);

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportStatus({ type: "info", text: isRtl ? "جاري قراءة الملف وتحديث البيانات..." : "Reading file and updating database..." });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rows.length < 2) {
          setImportStatus({ type: "danger", text: isRtl ? "ملف الاكسل فارغ أو لا يحتوي على صفوف بيانات!" : "Excel file is empty or has no data rows!" });
          return;
        }

        const headers = rows[0].map(h => (h || "").toString().toLowerCase().trim());
        
        const codeIdx = headers.findIndex(h => h.includes("code") || h.includes("كود") || h.includes("رمز"));
        const stageIdx = headers.findIndex(h => h.includes("stage") || h.includes("المرحلة") || h.includes("مرحلة"));
        const titleIdx = headers.findIndex(h => h.includes("title") || h.includes("العنوان") || h.includes("عطل") || h.includes("اسم"));
        const descIdx = headers.findIndex(h => h.includes("desc") || h.includes("وصف") || h.includes("تفاصيل"));
        const stepsIdx = headers.findIndex(h => h.includes("step") || h.includes("حل") || h.includes("اجراء") || h.includes("خطوات"));

        if (codeIdx === -1 || stageIdx === -1 || titleIdx === -1) {
          setImportStatus({ 
            type: "danger", 
            text: isRtl 
              ? "تنسيق الأعمدة غير صحيح. يجب أن يحتوي الملف على أعمدة (الكود / Code، رمز المرحلة / Stage ID، العنوان / Title)" 
              : "Columns format invalid. File must contain (Code, Stage ID, Title) columns."
          });
          return;
        }

        const newCodes = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawCode = row[codeIdx];
          const rawStage = row[stageIdx];
          const rawTitle = row[titleIdx];

          if (!rawCode || !rawStage || !rawTitle) continue;

          const codeStr = rawCode.toString().trim().toUpperCase();
          const stageStr = rawStage.toString().trim().toUpperCase();
          const titleStr = rawTitle.toString().trim();
          
          let stageId = stageStr;
          if (!stageId.startsWith("STG-")) {
            const num = parseInt(stageId);
            if (!isNaN(num) && num >= 1 && num <= 6) {
              stageId = `STG-0${num}`;
            }
          }

          let steps = [];
          if (stepsIdx !== -1 && row[stepsIdx]) {
            const rawSteps = row[stepsIdx].toString();
            steps = rawSteps
              .split(/[\n;|\r]+/)
              .map(s => s.trim())
              .filter(s => s.length > 0);
          }

          newCodes.push({
            code: codeStr,
            stage_id: stageId,
            title: titleStr,
            description: descIdx !== -1 && row[descIdx] ? row[descIdx].toString().trim() : "",
            troubleshooting_steps: steps,
          });
        }

        if (newCodes.length === 0) {
          setImportStatus({ type: "danger", text: isRtl ? "لم يتم العثور على أي أكواد صالحة للرفع!" : "No valid error codes found to upload!" });
          return;
        }

        const result = await addErrorCodesBulk(newCodes);
        if (result.success) {
          setImportStatus({ 
            type: "success", 
            text: isRtl 
              ? `تم رفع وتحديث ${newCodes.length} كود عطل بنجاح في السحابة!` 
              : `Successfully uploaded/updated ${newCodes.length} error codes on the cloud!`
          });
          setTimeout(() => setImportStatus(null), 5000);
        } else {
          setImportStatus({ type: "danger", text: isRtl ? "حدث خطأ أثناء الحفظ بالسحابة." : "An error occurred while saving to the cloud." });
        }
      } catch (err) {
        console.error("Excel import error:", err);
        setImportStatus({ type: "danger", text: isRtl ? "فشل قراءة ملف الاكسل. تأكد من سلامة التنسيق." : "Failed to read Excel file. Please check format." });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: isRtl ? "row" : "row-reverse", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowRight size={18} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />
          </button>
          <div style={{ flex: 1, textAlign: isRtl ? "right" : "left", minWidth: 200 }}>
            <h1 style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", gap: 10, marginBottom: 2, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
              <BookOpen size={22} color="var(--accent)" />
              {isRtl ? "دليل أعطال الإنتاج الشامل" : "Comprehensive Fault Guide Reference"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {errorCodes.length} {isRtl ? "كود عطل موثّق — يشمل جميع مراحل الإنتاج الست" : "documented fault codes — covers all 6 production stages"}
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
            {/* Excel Import button */}
            {currentUser?.role === "admin" && (
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
            <div className="badge badge-gray" style={{ fontSize: "0.8rem" }}>
              {productionStages.length} {isRtl ? "مراحل" : "Stages"}
            </div>
          </div>
        </div>

        {/* Import Status Alert banner */}
        {importStatus && (
          <div className={`alert alert-${importStatus.type}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{importStatus.text}</span>
          </div>
        )}

        {/* Search bar */}
        <div className="card animate-fade" style={{ padding: "16px 20px" }}>
          <div style={{ position: "relative" }}>
            <Search size={18} style={{
              position: "absolute",
              right: isRtl ? 14 : "auto",
              left: !isRtl ? 14 : "auto",
              top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)"
            }} />
            <input
              className="input input-lg"
              placeholder={isRtl ? "ابحث بكود العطل أو اسم المشكلة في جميع المراحل..." : "Search by fault code or technical issue name..."}
              style={{
                paddingRight: isRtl ? 44 : 14,
                paddingLeft: !isRtl ? 44 : 14,
                fontSize: "1rem",
                textAlign: isRtl ? "right" : "left"
              }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  left: isRtl ? 12 : "auto",
                  right: !isRtl ? 12 : "auto",
                  top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)"
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {isSearching && (
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 8, marginBottom: 0, textAlign: isRtl ? "right" : "left" }}>
              {searchResults.length > 0
                ? `${searchResults.length} ${isRtl ? "نتيجة في جميع المراحل" : "results across all stages"}`
                : `${isRtl ? "لا توجد نتائج تطابق" : "No results matching"} "${searchQuery}"`}
            </p>
          )}
        </div>

        {/* ── SEARCH RESULTS (flat, all stages) ── */}
        {isSearching && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text-muted)" }}>
                <Search size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p>{isRtl ? "لا توجد نتائج مطابقة. جرّب كلمة أخرى." : "No matching results found. Try another search term."}</p>
              </div>
            ) : searchResults.map(err => (
              <ErrorCard
                key={err.code}
                err={err}
                stage={getStageById(err.stage_id)}
                isOpen={openCode === err.code}
                onToggle={() => toggle(err.code)}
                isRtl={isRtl}
              />
            ))}
          </div>
        )}

        {/* ── ALL CODES GROUPED BY STAGE ── */}
        {!isSearching && groupedByStage.map(({ stage, codes }) => {
          const color = STAGE_COLORS[stage.stage_id] || "var(--accent)";
          return (
            <div key={stage.stage_id} className="animate-fade">
              {/* Stage header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: `2px solid ${color}33`,
                flexDirection: isRtl ? "row" : "row-reverse"
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: color + "18", border: `1px solid ${color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem", flexShrink: 0
                }}>
                  {stage.icon}
                </div>
                <div style={{ textAlign: isRtl ? "right" : "left" }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", color }}>
                    {isRtl ? stage.stage_name : (stage.stage_name.match(/\(([^)]+)\)/)?.[1] || stage.stage_name)}
                  </h2>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {codes.length} {isRtl ? "أكواد أعطال" : "fault codes"}
                  </span>
                </div>
                <span className="badge" style={{
                  marginRight: isRtl ? "auto" : "none",
                  marginLeft: !isRtl ? "auto" : "none",
                  background: color + "18", color, border: `1px solid ${color}44`
                }}>
                  {stage.stage_id}
                </span>
              </div>

              {/* Error cards for this stage */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {codes.map(err => (
                  <ErrorCard
                    key={err.code}
                    err={err}
                    stage={stage}
                    isOpen={openCode === err.code}
                    onToggle={() => toggle(err.code)}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}

export function TranslateText({ text, targetLang, fallback = "" }) {
  const [translated, setTranslated] = useState(text || fallback);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!text) {
      setTranslated(fallback);
      return;
    }

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const textLang = isArabic ? "ar" : "en";

    if (textLang === targetLang) {
      setTranslated(text);
      return;
    }

    let active = true;
    const translate = async () => {
      setLoading(true);
      try {
        const langpair = `${textLang}|${targetLang}`;
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`);
        const data = await res.json();
        if (active && data?.responseData?.translatedText) {
          setTranslated(data.responseData.translatedText);
        }
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    translate();
    return () => { active = false; };
  }, [text, targetLang, fallback]);

  return <span>{translated}</span>;
}

export function TranslateSteps({ steps, targetLang, renderStep }) {
  const [translatedSteps, setTranslatedSteps] = useState(steps || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!steps || steps.length === 0) {
      setTranslatedSteps([]);
      return;
    }

    const needsTranslation = steps.some(step => {
      const isArabic = /[\u0600-\u06FF]/.test(step);
      const stepLang = isArabic ? "ar" : "en";
      return stepLang !== targetLang;
    });

    if (!needsTranslation) {
      setTranslatedSteps(steps);
      return;
    }

    let active = true;
    const translateAll = async () => {
      setLoading(true);
      try {
        const promises = steps.map(async (step) => {
          const isArabic = /[\u0600-\u06FF]/.test(step);
          const stepLang = isArabic ? "ar" : "en";
          if (stepLang === targetLang) return step;

          const langpair = `${stepLang}|${targetLang}`;
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(step)}&langpair=${langpair}`);
          const data = await res.json();
          return data?.responseData?.translatedText || step;
        });

        const results = await Promise.all(promises);
        if (active) {
          setTranslatedSteps(results);
        }
      } catch (err) {
        console.error("Steps translation error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    translateAll();
    return () => { active = false; };
  }, [steps, targetLang]);

  return (
    <>
      {translatedSteps.map((step, idx) => renderStep(step, idx, loading))}
    </>
  );
}
