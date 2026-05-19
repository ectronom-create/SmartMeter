import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  ArrowRight, Search, X, AlertTriangle, CheckCircle,
  Plus, Book, ChevronDown, ChevronUp, Zap, AlertCircle
} from "lucide-react";

function InstructionStep({ num, text, stageColor }) {
  return (
    <div className="instruction-item">
      <div
        className="instruction-num"
        style={{ background: `${stageColor}22`, color: stageColor }}
      >
        {num}
      </div>
      <p style={{ color: "var(--text-primary)", fontSize: "0.92rem", margin: 0 }}>{text}</p>
    </div>
  );
}

function ErrorResultCard({ result, stepsOpen, onToggle }) {
  const stageColors = {
    "STG-01": "#f97316", "STG-02": "#4f46e5",
    "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
  };
  const c = stageColors[result.stage_id] || "var(--amber)";

  return (
    <div className="error-result-card" style={{ borderColor: c + "66" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: stepsOpen ? 12 : 0 }}>
        <span className="badge" style={{ background: c + "22", color: c, border: `1px solid ${c}44`, fontFamily: "monospace" }}>
          {result.code}
        </span>
        <span style={{ fontWeight: 700, flex: 1 }}>{result.title}</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggle}>
          {stepsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {stepsOpen && (
        <div style={{ paddingTop: 4 }}>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            خطوات التعامل
          </p>
          {result.troubleshooting_steps.map((step, i) => (
            <div key={i} className="troubleshoot-step">
              <span style={{ color: "var(--amber)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
              <span style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { 
    currentUser, 
    currentStage, 
    currentShift, 
    todaySchedule, 
    searchErrorCodes, 
    addDefectiveMeter,
    language,
    t
  } = useApp();

  const isRtl = language === "ar";

  // Error search
  const [errorQuery, setErrorQuery]     = useState("");
  const [errorResults, setErrorResults] = useState([]);
  const [openCardId, setOpenCardId]     = useState(null);
  const errorInputRef = useRef(null);

  // Defect form
  const [serialNumber, setSerialNumber] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [customDesc, setCustomDesc]     = useState("");
  const [submitMsg, setSubmitMsg]       = useState(null);
  const serialRef = useRef(null);

  const stageColors = {
    "STG-01": "#f97316", "STG-02": "#4f46e5",
    "STG-03": "#06b6d4", "STG-04": "#10b981", "STG-05": "#8b5cf6", "STG-06": "#ec4899"
  };

  const stageColor = currentStage ? (stageColors[currentStage.stage_id] || "var(--accent)") : "var(--accent)";

  useEffect(() => {
    if (errorQuery.trim().length >= 1) {
      const results = searchErrorCodes(errorQuery);
      setErrorResults(results);
    } else {
      setErrorResults([]);
    }
  }, [errorQuery, currentStage, searchErrorCodes]);

  const handleSelectError = (code) => {
    setSelectedCode(code);
    setErrorQuery("");
    setErrorResults([]);
    // Focus serial number field for barcode scanner flow
    serialRef.current?.focus();
  };

  const handleSubmitDefect = async (e) => {
    e.preventDefault();
    if (!serialNumber.trim() || !selectedCode) return;
    
    const result = await addDefectiveMeter({
      serial_number: serialNumber.trim().toUpperCase(),
      error_code: selectedCode,
      stage_found: currentStage?.stage_id,
      custom_description: customDesc,
      reported_by: currentUser.employee_id,
    });

    if (!result.success) {
      setSubmitMsg({ type: "danger", text: result.message });
      setTimeout(() => setSubmitMsg(null), 6000);
      return;
    }

    const successText = isRtl 
      ? `تم تسجيل العداد ${serialNumber.trim().toUpperCase()} بنجاح!`
      : `Meter ${serialNumber.trim().toUpperCase()} was registered successfully!`;

    setSubmitMsg({ type: "success", text: successText });
    setSerialNumber("");
    setSelectedCode("");
    setCustomDesc("");
    setTimeout(() => setSubmitMsg(null), 4000);
    serialRef.current?.focus(); 
  };

  if (!currentStage) {
    return (
      <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🚫</div>
          <h3>{isRtl ? "لا توجد مرحلة إنتاج مخصصة لك" : "No Production Stage Assigned to You"}</h3>
          <p style={{ marginBottom: 20 }}>{isRtl ? "يرجى التواصل مع المشرف لتعيين مرحلتك." : "Please contact the supervisor to assign your stage."}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
            <ArrowRight size={16} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {t("backToProfile")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Back + workspace header ── */}
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")} style={{ marginBottom: 12 }}>
            <ArrowRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {t("backToProfile")}
          </button>

          <div className="workspace-header animate-fade" style={{ borderColor: stageColor + "44" }}>
            {/* Glow line */}
            <div style={{ position: "absolute", bottom: 0, right: 0, left: 0, height: 3, background: `linear-gradient(90deg, ${stageColor}, transparent)`, borderRadius: "0 0 var(--radius-xl) var(--radius-xl)" }} />

            <div className="workspace-header-icon" style={{
              width: 72, height: 72, flexShrink: 0, borderRadius: "var(--radius-lg)",
              background: stageColor + "22", border: `2px solid ${stageColor}55`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem"
            }}>
              {currentStage.icon}
            </div>

            <div className="flex-grow-mobile" style={{ flex: 1 }}>
              <div className="mobile-center-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ margin: 0 }}>{currentStage.stage_name}</h2>
                <span className="badge badge-gray">{currentStage.stage_id}</span>
                {todaySchedule?.is_team_leader && <span className="badge badge-amber">⭐ {t("teamLeaderBadge")}</span>}
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                {isRtl ? "شفت" : "Shift"} {currentShift?.name} · {currentShift?.start_time} – {currentShift?.end_time}
                &nbsp;·&nbsp; {currentUser.full_name}
              </p>
            </div>

            <div style={{ flexShrink: 0, textAlign: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 8px #3fb950", margin: "0 auto 4px", animation: "pulse-glow 2s infinite" }} />
              <span style={{ fontSize: "0.75rem", color: "#3fb950", fontWeight: 700 }}>{t("activeState")}</span>
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid-2" style={{ alignItems: "start" }}>

          {/* ── Left: SOPs ── */}
          <div className="card animate-fade">
            <div className="card-header">
              <Book size={18} style={{ color: stageColor }} />
              <h3 style={{ margin: 0 }}>{t("workInstructionsSop")}</h3>
              <span className="badge badge-gray" style={isRtl ? { marginRight: "auto" } : { marginLeft: "auto" }}>
                {currentStage.instructions.length} {t("stepsCount")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentStage.instructions.map((instr, i) => (
                <InstructionStep key={i} num={i + 1} text={instr} stageColor={stageColor} />
              ))}
            </div>

            {/* Troubleshooting Hints */}
            {currentStage.troubleshooting && currentStage.troubleshooting.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="card-header" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--border-subtle)", marginBottom: 12 }}>
                  <AlertCircle size={17} style={{ color: "var(--red)" }} />
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--red)" }}>{t("technicalAlertsTitle")}</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {currentStage.troubleshooting.map((item, i) => (
                    <div key={i} style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <X size={14} style={{ color: "var(--red)", marginTop: 3 }} />
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#c53030" }}>{item.problem}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingRight: isRtl ? 22 : 0, paddingLeft: !isRtl ? 22 : 0 }}>
                        <CheckCircle size={14} style={{ color: "var(--green)", marginTop: 3 }} />
                        <span style={{ fontSize: "0.85rem", color: "#2f855a", fontWeight: 600 }}>{language === "ar" ? "الحل" : "Solution"}: {item.solution}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Error Search + Defect Form ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Error Code Search */}
            <div className="card animate-fade">
              <div className="card-header">
                <Search size={18} style={{ color: "var(--amber)" }} />
                <h3 style={{ margin: 0 }}>{t("faultCodeSearch")}</h3>
              </div>

              <div style={{ position: "relative" }}>
                <Search size={15} style={{
                  position: "absolute", 
                  right: isRtl ? 12 : "auto", 
                  left: !isRtl ? 12 : "auto", 
                  top: "50%", 
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)", 
                  pointerEvents: "none"
                }} />
                <input
                  ref={errorInputRef}
                  className="input"
                  style={{ 
                    paddingRight: isRtl ? 38 : 12, 
                    paddingLeft: !isRtl ? 38 : 12 
                  }}
                  placeholder={t("enterFaultCodePlaceholder")}
                  value={errorQuery}
                  onChange={e => setErrorQuery(e.target.value)}
                />
                {errorQuery && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ 
                      position: "absolute", 
                      left: isRtl ? 6 : "auto", 
                      right: !isRtl ? 6 : "auto", 
                      top: "50%", 
                      transform: "translateY(-50%)" 
                    }}
                    onClick={() => { setErrorQuery(""); setErrorResults([]); }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {errorResults.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {errorResults.map(r => (
                    <div key={r.code}>
                      <ErrorResultCard
                        result={r}
                        stepsOpen={openCardId === r.code}
                        onToggle={() => setOpenCardId(openCardId === r.code ? null : r.code)}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 6, width: "100%" }}
                        onClick={() => handleSelectError(r.code)}
                      >
                        <Plus size={13} /> {t("useThisCodeBtn")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errorQuery && errorResults.length === 0 && (
                <div className="alert alert-warning" style={{ marginTop: 12 }}>
                  <AlertTriangle size={15} />
                  <span>{t("noResultsMatching")} «{errorQuery}».</span>
                </div>
              )}
            </div>

            {/* Defect Entry Form */}
            <div className="card animate-fade">
              <div className="card-header">
                <AlertTriangle size={18} style={{ color: "var(--red)" }} />
                <h3 style={{ margin: 0 }}>{t("registerDefectiveMeter")}</h3>
              </div>

              {submitMsg && (
                <div className={`alert alert-${submitMsg.type}`} style={{ marginBottom: 12 }}>
                  <CheckCircle size={15} />
                  <span>{submitMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitDefect} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">{t("serialNumber")}</label>
                  <input
                    ref={serialRef}
                    className="input input-lg"
                    placeholder={isRtl ? "امسح الباركود أو أدخل يدوياً..." : "Scan barcode or enter manually..."}
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    required
                    autoFocus
                    style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">{t("faultCodeSelectSearch")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      placeholder={isRtl ? "استخدم خانة البحث أعلاه لاختيار الكود..." : "Use search bar above to select code..."}
                      value={selectedCode}
                      readOnly
                      style={{ fontFamily: "'IBM Plex Mono', monospace", background: "var(--bg-elevated)", cursor: "not-allowed" }}
                      required
                    />
                    {selectedCode && (
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSelectedCode("")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {!selectedCode && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {t("faultCodeWarning")}
                    </span>
                  )}
                  {selectedCode && (
                    <span style={{ fontSize: "0.78rem", color: "var(--green)", fontWeight: 700 }}>
                      {t("codeSelected")}{selectedCode}
                    </span>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">{t("additionalNotes")}</label>
                  <textarea
                    className="input"
                    placeholder={isRtl ? "وصف إضافي للمشكلة..." : "Additional description of the problem..."}
                    value={customDesc}
                    onChange={e => setCustomDesc(e.target.value)}
                    rows={2}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-danger btn-full"
                  disabled={!serialNumber.trim()}
                >
                  <AlertTriangle size={16} /> {t("registerDefectiveMeterBtn")}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
