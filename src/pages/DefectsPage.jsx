import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle, Clock, AlertTriangle, Filter, X, Plus, Search } from "lucide-react";
import { translateError } from "./KnowledgeBasePage";

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
  "STG-06": isRtl ? "التخصيص" : "Perso"
});

export default function DefectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    defectiveMeters, currentUser, updateMeterStatus, 
    getErrorByCode, addDefectiveMeter, currentStage, errorCodes, language
  } = useApp();

  const isRtl = language === "ar";
  const STATUS_CONFIG = getStatusConfig(isRtl);
  const stageNames = getStageNames(isRtl);
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [submitMsg, setSubmitMsg] = useState(null);
  
  // Searchable Code logic
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedErrorCode, setSelectedErrorCode] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Review Modal state
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  if (!currentUser) return null;

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
    if (!searchQuery.trim()) return errorCodes;
    const q = searchQuery.toLowerCase();
    return errorCodes.filter(e => 
      e.code.toLowerCase().includes(q) || 
      e.title.toLowerCase().includes(q) ||
      (stageNames[e.stage_id] || "").toLowerCase().includes(q)
    );
  }, [searchQuery, errorCodes, stageNames]);

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
    const sn = fd.get("sn").trim().toUpperCase();
    
    if (!sn || !selectedErrorCode) return;

    const result = await addDefectiveMeter({
      serial_number: sn,
      error_code: selectedErrorCode.code,
      stage_found: currentStage?.stage_id || "OFFLINE",
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
    setSearchQuery("");
    setSelectedErrorCode(null);
    setTimeout(() => setSubmitMsg(null), 3000);
  };

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Topbar Navigation & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
              <ArrowRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للرئيسية" : "Back to Home"}
            </button>
            <div style={{ textAlign: isRtl ? "right" : "left" }}>
              <h1 style={{ fontSize: "1.4rem" }}>{isRtl ? "إدارة بلاغات الأعطال" : "Defect Management Panel"}</h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {isRtl ? "تتبع وحل المشاكل التقنية في خط الإنتاج" : "Track and resolve technical issues on the production floor"}
              </p>
            </div>
          </div>
          {(currentUser.role === "supervisor" || currentUser.role === "admin") && (
            <button className="btn btn-primary" onClick={() => setReviewModal(true)} style={{ gap: 8 }}>
              <Clock size={16} /> {isRtl ? "معاينة العدادات قيد الانتظار" : "Review Pending Quality Gate"}
              {defectiveMeters.filter(m => m.status === "pending").length > 0 && (
                <span style={{ background: "white", color: "var(--accent)", padding: "0 6px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800 }}>
                  {defectiveMeters.filter(m => m.status === "pending").length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Quick Report Form */}
        {currentUser.role !== "admin" && (
          <div className="card animate-fade" style={{ background: "#fff5f5", border: "1px solid #feb2b2", overflow: "visible" }}>
            <div className="card-header" style={{ paddingBottom: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <AlertTriangle size={18} style={{ color: "var(--red)" }} />
              <h3 style={{ margin: 0 }}>{isRtl ? "تسجيل بلاغ ععل جديد" : "Report a New Defect"}</h3>
            </div>
            {submitMsg && <div className={`alert alert-${submitMsg.type === "error" ? "danger" : "success"}`} style={{ marginBottom: 12 }}>{submitMsg.text}</div>}
            <form onSubmit={handleQuickSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr auto", gap: 12, alignItems: "end", position: "relative" }}>
              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "السيريال نمبر *" : "Serial Number *"}</label>
                <input className="input" name="sn" placeholder={isRtl ? "امسح الباركود..." : "Scan barcode..."} required style={{ background: "white", textAlign: isRtl ? "right" : "left" }} />
              </div>
              
              <div className="input-group" style={{ position: "relative", textAlign: isRtl ? "right" : "left" }}>
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
                      paddingLeft: !isRtl ? 14 : 32,
                      textAlign: isRtl ? "right" : "left"
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
                    boxShadow: "0 10px 15px rgba(0,0,0,0.1)", maxHeight: 250, overflowY: "auto", marginTop: 4,
                    textAlign: isRtl ? "right" : "left"
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
                              fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center",
                              flexDirection: isRtl ? "row" : "row-reverse"
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

              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "ملاحظات إضافية" : "Optional Comments"}</label>
                <input className="input" name="desc" placeholder={isRtl ? "ملاحظات اختيارية..." : "Add details..."} style={{ background: "white", textAlign: isRtl ? "right" : "left" }} />
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <div style={{ display: "flex", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
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
          <div className="badge badge-gray">{isRtl ? "إجمالي السجلات:" : "Total Logs:"} {allMeters.length}</div>
        </div>

        {/* Defects List */}
        <div className="card" style={{ padding: 0 }}>
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

      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", direction: isRtl ? "rtl" : "ltr" }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <Clock size={20} style={{ color: "var(--amber)" }} />
                <h3 style={{ margin: 0 }}>{isRtl ? "مراجعة العدادات قيد الانتظار" : "Review Pending Quality Gate Meters"}</h3>
              </div>
              <button className="btn-close" onClick={() => { setReviewModal(false); setReviewSearch(""); setConfirmingId(null); }}>✕</button>
            </div>
            
            <div style={{ padding: 20, background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="input-group" style={{ textAlign: isRtl ? "right" : "left" }}>
                <label className="input-label">{isRtl ? "بحث سريع بالسيريال نمبر" : "Quick Search by Serial Number"}</label>
                <input 
                  className="input" 
                  value={reviewSearch} 
                  onChange={e => setReviewSearch(e.target.value)} 
                  placeholder={isRtl ? "اكتب السيريال للبحث..." : "Enter serial code..."}
                  style={{ textAlign: isRtl ? "right" : "left" }}
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
                        border: isConfirming ? "2px solid var(--blue)" : "1px solid var(--border)",
                        textAlign: isRtl ? "right" : "left"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexDirection: isRtl ? "row" : "row-reverse" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexDirection: isRtl ? "row" : "row-reverse" }}>
                              <code style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue)" }}>{m.serial_number}</code>
                              <span className="badge badge-gray">{stageNames[m.stage_found] || m.stage_found}</span>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              <span style={{ fontWeight: 700 }}>{isRtl ? "العطل:" : "Fault:"}</span> {m.error_code} — {trans?.title || "No Title"}
                            </div>
                          </div>
                          <div style={{ textAlign: isRtl ? "left" : "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {formatDate(m.created_at)}
                          </div>
                        </div>

                        <div className="divider" style={{ margin: "12px 0" }} />

                        {isConfirming ? (
                          <div className="animate-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)", padding: 10, borderRadius: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                              {isRtl ? "تغيير الحالة إلى:" : "Change state to:"} <span className={`badge ${STATUS_CONFIG[newStatus].class}`}>{STATUS_CONFIG[newStatus].label}</span>?
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus(m.id, newStatus)}>{isRtl ? "تأكيد وحفظ" : "Confirm & Save"}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(null)}>{isRtl ? "إلغاء" : "Cancel"}</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <button 
                              className="btn btn-danger btn-sm" 
                              style={{ flex: 1 }}
                              onClick={() => { setConfirmingId(m.id); setNewStatus("verified"); }}
                            >
                              <AlertTriangle size={14} /> {isRtl ? "تأكيد العطل" : "Confirm Defect"}
                            </button>
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ flex: 1, background: "var(--accent)" }}
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
