import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { translateError } from "../pages/KnowledgeBasePage";
import { 
  BarChart2, 
  Layers, 
  ClipboardList, 
  Filter, 
  Download, 
  Search, 
  Activity, 
  Hash, 
  Radio, 
  FileText, 
  AlertTriangle,
  Clock,
  CheckCircle
} from "lucide-react";
import * as XLSX from "xlsx";

export default function DefectsSummaryPanel() {
  const { defectiveMeters, errorCodes, language, getErrorByCode } = useApp();
  const isRtl = language === "ar";

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [selectedCode, setSelectedCode] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Stage translator helper
  const getStageLabel = (stageId) => {
    const stagesAr = {
      "STG-01": "التجميع (Assembly)", 
      "STG-02": "العزل (Insulation)",
      "STG-03": "التردد اللاسلكي (Radio Frequency)", 
      "STG-04": "المعايرة (Calibration)", 
      "STG-05": "الاختبار المتعدد (Multi Test)", 
      "STG-06": "التخصيص (Perso)",
      "GLOBAL": "عام (General)",
      "—": "غير محدد"
    };
    const stagesEn = {
      "STG-01": "Assembly", 
      "STG-02": "Insulation",
      "STG-03": "Radio Frequency", 
      "STG-04": "Calibration", 
      "STG-05": "Multi Test", 
      "STG-06": "Perso",
      "GLOBAL": "General",
      "—": "Unspecified"
    };
    return isRtl ? (stagesAr[stageId] || stageId) : (stagesEn[stageId] || stageId);
  };

  // 1. Filter Individual Meters First
  const filteredMeters = useMemo(() => {
    return defectiveMeters.filter(m => {
      // Date filter
      if (startDate && m.created_at) {
        const mDate = m.created_at.substring(0, 10);
        if (mDate < startDate) return false;
      }
      if (endDate && m.created_at) {
        const mDate = m.created_at.substring(0, 10);
        if (mDate > endDate) return false;
      }

      // Stage filter
      if (selectedStage !== "ALL") {
        if (m.stage_found !== selectedStage) return false;
      }

      // Error code filter
      if (selectedCode !== "ALL" && m.error_code !== selectedCode) return false;

      return true;
    });
  }, [defectiveMeters, startDate, endDate, selectedStage, selectedCode]);

  // 2. Compute Top Level Aggregates (Stats Widgets) based on filtered list
  const stats = useMemo(() => {
    const total = filteredMeters.length;
    const verified = filteredMeters.filter(m => m.status === "verified").length;
    const pending = filteredMeters.filter(m => m.status === "pending").length;
    const resolved = filteredMeters.filter(m => m.status === "resolved").length;

    return { total, verified, pending, resolved };
  }, [filteredMeters]);

  // 3. Group the Filtered Meters by Date, Code, and Stage
  const groupedList = useMemo(() => {
    const groups = {};
    filteredMeters.forEach(m => {
      const dateVal = m.created_at ? m.created_at.substring(0, 10) : "—";
      const code = m.error_code || "—";
      const stageId = m.stage_found || "—";

      const groupKey = `${dateVal}__${code}__${stageId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          date: dateVal,
          code,
          stageId,
          count: 0
        };
      }
      groups[groupKey].count += 1;
    });

    // Sort by Date descending, then count descending
    return Object.values(groups).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.count - a.count;
    });
  }, [filteredMeters]);

  // 4. Apply search query on the grouped list
  const filteredGroupedList = useMemo(() => {
    if (!searchTerm.trim()) return groupedList;
    const q = searchTerm.toLowerCase().trim();
    return groupedList.filter(g => {
      const errObj = getErrorByCode(g.code);
      const trans = errObj ? translateError(errObj, isRtl) : null;
      const title = trans ? trans.title.toLowerCase() : "";
      const stageLabel = getStageLabel(g.stageId).toLowerCase();

      return (
        g.code.toLowerCase().includes(q) ||
        title.includes(q) ||
        g.date.includes(q) ||
        stageLabel.includes(q)
      );
    });
  }, [groupedList, searchTerm, isRtl, getErrorByCode]);

  // Get distinct values for filter dropdowns (based on all defective meters)
  const uniqueStages = useMemo(() => {
    const stages = defectiveMeters.map(m => m.stage_found || "—").filter(Boolean);
    return [...new Set(stages)].sort();
  }, [defectiveMeters]);

  const uniqueCodes = useMemo(() => {
    const codes = defectiveMeters.map(m => m.error_code).filter(Boolean);
    return [...new Set(codes)].sort();
  }, [defectiveMeters]);

  // Date formatting for table display
  const formatDateOnly = (dateStr) => {
    if (!dateStr || dateStr === "—") return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  // Export grouped list to Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredGroupedList.map(g => {
        const errObj = getErrorByCode(g.code);
        const trans = errObj ? translateError(errObj, isRtl) : null;
        const codeTitle = trans ? trans.title : "—";
        const stageLabel = getStageLabel(g.stageId);

        if (isRtl) {
          return {
            "التاريخ": g.date,
            "رمز العطل": g.code,
            "وصف العطل": codeTitle,
            "المرحلة": stageLabel,
            "العدد (الكمية)": g.count
          };
        } else {
          return {
            "Date": g.date,
            "Error Code": g.code,
            "Error Description": codeTitle,
            "Stage": stageLabel,
            "Count (Qty)": g.count
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isRtl ? "تقرير الأعطال المجمع" : "Defects Summary");
      XLSX.writeFile(workbook, isRtl ? "تقرير_الأعطال_المجمع.xlsx" : "defects_summary_report.xlsx");
    } catch (error) {
      console.error("Excel export error:", error);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedStage("ALL");
    setSelectedCode("ALL");
    setSearchTerm("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
            {isRtl ? "تقرير الأعطال المجمع للعدادات" : "Meters Defects Summary Report"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            {isRtl ? "عرض وإحصاء العدادات المعطوبة مجمعة بالتاريخ، الكود، والمرحلة" : "View and count defective meters grouped by date, error code, and stage"}
          </p>
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={handleExportExcel}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(9, 105, 218, 0.08)", border: "1px solid rgba(9, 105, 218, 0.2)", color: "var(--blue)", fontWeight: 700 }}
        >
          <Download size={14} /> {isRtl ? "تصدير التقرير (Excel)" : "Export Report (Excel)"}
        </button>
      </div>

      {/* Stats Cards Widgets */}
      <div className="grid-4">
        <div className="stat-card animate-fade" style={{ borderLeft: "4px solid var(--accent)", background: "var(--card-bg)" }}>
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.1)" }}>
            <Activity size={18} color="var(--accent)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>{stats.total}</div>
            <div className="stat-label">{isRtl ? "إجمالي المعطوبات المصفاة" : "Total Filtered Defects"}</div>
          </div>
        </div>

        <div className="stat-card animate-fade" style={{ borderLeft: "4px solid var(--amber)", background: "var(--card-bg)" }}>
          <div className="stat-icon" style={{ background: "var(--amber-glow)" }}>
            <Clock size={18} color="var(--amber)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--amber)" }}>{stats.pending}</div>
            <div className="stat-label">{isRtl ? "قيد الانتظار (Pending)" : "Pending Review"}</div>
          </div>
        </div>

        <div className="stat-card animate-fade" style={{ borderLeft: "4px solid var(--accent)", background: "var(--card-bg)" }}>
          <div className="stat-icon" style={{ background: "rgba(26, 127, 55, 0.1)" }}>
            <CheckCircle size={18} color="var(--accent)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>{stats.resolved}</div>
            <div className="stat-label">{isRtl ? "يعود لخط الإنتاج (Resolved)" : "Returned to Line"}</div>
          </div>
        </div>

        <div className="stat-card animate-fade" style={{ borderLeft: "4px solid var(--red)", background: "var(--card-bg)" }}>
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
            <AlertTriangle size={18} color="var(--red)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--red)" }}>{stats.verified}</div>
            <div className="stat-label">{isRtl ? "مؤكدة كمعطوبة (Verified)" : "Verified Defective"}</div>
          </div>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Filter size={16} color="var(--text-secondary)" />
          <strong style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {isRtl ? "فلاتر التصفية التفاعلية" : "Interactive Filters"}
          </strong>
          {(startDate || endDate || selectedStage !== "ALL" || selectedCode !== "ALL" || searchTerm) && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleClearFilters}
              style={{ marginLeft: isRtl ? 0 : "auto", marginRight: isRtl ? "auto" : 0, padding: "2px 8px", fontSize: "0.75rem", color: "var(--red)" }}
            >
              {isRtl ? "إعادة تعيين الفلاتر" : "Reset Filters"}
            </button>
          )}
        </div>

        <div className="grid-3" style={{ gap: 12 }}>
          {/* Start Date */}
          <div className="input-group">
            <label className="input-label" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              {isRtl ? "تاريخ البدء" : "Start Date"}
            </label>
            <input 
              type="date" 
              className="input" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              style={{ background: "white", padding: "6px 10px", fontSize: "0.85rem" }} 
            />
          </div>

          {/* End Date */}
          <div className="input-group">
            <label className="input-label" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              {isRtl ? "تاريخ الانتهاء" : "End Date"}
            </label>
            <input 
              type="date" 
              className="input" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              style={{ background: "white", padding: "6px 10px", fontSize: "0.85rem" }} 
            />
          </div>

          {/* Stage Filter */}
          <div className="input-group">
            <label className="input-label" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              {isRtl ? "المرحلة" : "Stage"}
            </label>
            <select 
              className="input" 
              value={selectedStage} 
              onChange={e => setSelectedStage(e.target.value)}
              style={{ background: "white", padding: "6px 10px", fontSize: "0.85rem" }}
            >
              <option value="ALL">{isRtl ? "كل المراحل" : "All Stages"}</option>
              {uniqueStages.map(st => (
                <option key={st} value={st}>{getStageLabel(st)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
          {/* Code Filter */}
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              {isRtl ? "كود العطل" : "Error Code"}
            </label>
            <select 
              className="input" 
              value={selectedCode} 
              onChange={e => setSelectedCode(e.target.value)}
              style={{ background: "white", padding: "6px 10px", fontSize: "0.85rem" }}
            >
              <option value="ALL">{isRtl ? "كل الأكواد" : "All Error Codes"}</option>
              {uniqueCodes.map(c => {
                const errObj = getErrorByCode(c);
                const trans = errObj ? translateError(errObj, isRtl) : null;
                const titleText = trans ? ` - ${trans.title}` : "";
                return (
                  <option key={c} value={c}>{c}{titleText}</option>
                );
              })}
            </select>
          </div>

          {/* Live Search inside Grouped List */}
          <div className="input-group" style={{ flex: 1.2, position: "relative" }}>
            <label className="input-label" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              {isRtl ? "بحث سريع بالجدول" : "Quick Search Table"}
            </label>
            <div style={{ position: "relative" }}>
              <input 
                type="text" 
                className="input" 
                placeholder={isRtl ? "ابحث بالكود، الوصف، التاريخ أو المرحلة..." : "Search code, description, date..."} 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                style={{ background: "white", padding: "6px 10px 6px 30px", fontSize: "0.85rem" }}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Aggregated Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? "right" : "left", whiteSpace: "nowrap" }}>{isRtl ? "التاريخ" : "Date"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left", whiteSpace: "nowrap" }}>{isRtl ? "كود العطل" : "Error Code"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left", whiteSpace: "nowrap" }}>{isRtl ? "وصف العطل" : "Error Description"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left", whiteSpace: "nowrap" }}>{isRtl ? "مرحلة الاكتشاف" : "Stage Found"}</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap", width: 100 }}>{isRtl ? "العدد (الكمية)" : "Count (Qty)"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroupedList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <AlertTriangle size={24} style={{ color: "var(--text-muted)" }} />
                      <span>{isRtl ? "لا توجد سجلات مطابقة للفلاتر الحالية" : "No matching records found for current filters"}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGroupedList.map(g => {
                  const errObj = getErrorByCode(g.code);
                  const trans = errObj ? translateError(errObj, isRtl) : null;
                  const codeTitle = trans ? trans.title : "—";
                  
                  // Style badge based on count
                  let countBadgeClass = "badge-blue";
                  if (g.count >= 10) countBadgeClass = "badge-red";
                  else if (g.count >= 5) countBadgeClass = "badge-amber";

                  return (
                    <tr key={g.id} className="hover-bg">
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatDateOnly(g.date)}
                      </td>
                      <td>
                        <code style={{ fontFamily: "monospace", fontSize: "0.85rem", padding: "2px 6px", background: "rgba(0,0,0,0.05)", borderRadius: 4, fontWeight: 700 }}>
                          {g.code}
                        </code>
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 300 }}>
                        {codeTitle}
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ whiteSpace: "nowrap" }}>
                          {getStageLabel(g.stageId)}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${countBadgeClass}`} style={{ minWidth: 28, textAlign: "center", display: "inline-block", fontWeight: 800, fontSize: "0.85rem", padding: "4px 8px" }}>
                          {g.count}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
