import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Chart, registerables } from "chart.js";
import { Upload, BarChart2, History, TrendingUp, Trash2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useApp } from "../context/AppContext";

Chart.register(...registerables);

// ===================== PARSER =====================
function parseFPYExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('product')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (Array.isArray(rows[i])) {
      const isHeader = rows[i].some(c => {
        if (!c) return false;
        const str = String(c).toLowerCase();
        return str.includes('board') || str.includes('pass') || str.includes('test bench');
      });
      if (isHeader) {
        headerIdx = i;
        break;
      }
    }
  }
  
  if (headerIdx === -1) {
    throw new Error('لم يتم العثور على عناوين الأعمدة المتوقعة في الملف.');
  }

  let product = 'Unknown';
  try {
    for (let i = 0; i < headerIdx; i++) {
      if (!Array.isArray(rows[i])) continue;
      const cell = rows[i].find(c => c && String(c).toLowerCase().includes('produit'));
      if (cell) {
        const match = String(cell).match(/Produit\s*:\s*([^>]+)/i);
        if (match && match[1]) product = match[1].trim();
        break;
      }
    }
  } catch (e) {
    console.warn("Product info parsing failed", e);
  }

  const headers = rows[headerIdx] || [];
  const getCol = (name) => {
    if (!Array.isArray(headers)) return -1;
    return headers.findIndex(h => h && String(h).toLowerCase().includes(name.toLowerCase()));
  };
  
  const col = {
    benchName: getCol('test bench') !== -1 ? getCol('test bench') : getCol('product name'),
    nbBoards: getCol('nb board') !== -1 ? getCol('nb board') : getCol('board'),
    nbFirstPass: getCol('1st pass'),
    nbOkFirstPass: getCol('ok 1st pass'),
    nbBoardsOK: getCol('boards ok') !== -1 ? getCol('boards ok') : getCol('board ok'),
    fpy: getCol('fpy'),
    top1: getCol('top 1'),
    qty1: getCol('qty 1'),
    nbTestRun: getCol('test run') !== -1 ? getCol('test run') : getCol('runs')
  };

  const nameIdx = col.benchName !== -1 ? col.benchName : 0;

  const parsePct = v => {
    if (!v) return null;
    let n = parseFloat(String(v).replace('%', '').trim());
    return isNaN(n) ? null : n;
  };
  const parseNum = v => { 
    if (!v) return 0;
    const n = parseInt(v, 10); 
    return isNaN(n) ? 0 : n; 
  };
  const parseDefect = v => v ? String(v).replace('>', '').trim() : null;

  const stations = [];
  const defectsMap = {};

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0 || !row[nameIdx]) continue;
    
    const nameCell = String(row[nameIdx]).trim();
    if (!nameCell || nameCell.toUpperCase().includes('TOTAL')) continue;

    const parts = nameCell.split('|');
    const bench = parts[0] ? parts[0].trim() : 'Unknown';
    const stationName = parts.length > 1 ? parts[1].trim() : bench;

    const nbBoards = col.nbBoards >= 0 ? parseNum(row[col.nbBoards]) : 0;
    const nbFirstPass = col.nbFirstPass >= 0 ? parseNum(row[col.nbFirstPass]) : 0;
    const nbOkFirstPass = col.nbOkFirstPass >= 0 ? parseNum(row[col.nbOkFirstPass]) : 0;
    const nbBoardsOK = col.nbBoardsOK >= 0 ? parseNum(row[col.nbBoardsOK]) : 0;
    const nbTestRun = col.nbTestRun >= 0 ? parseNum(row[col.nbTestRun]) : 0;

    let fpy = col.fpy >= 0 ? parsePct(row[col.fpy]) : null;
    if (fpy === null || fpy > 100 || fpy <= 0) {
      fpy = nbFirstPass > 0 ? (nbOkFirstPass / nbFirstPass) * 100 : (nbBoards > 0 ? (nbBoardsOK / nbBoards) * 100 : 0);
    }

    const top1 = col.top1 >= 0 ? parseDefect(row[col.top1]) : null;
    const qty1 = col.qty1 >= 0 ? parseNum(row[col.qty1]) : 0;

    if (top1 && qty1 > 0) {
      defectsMap[top1] = (defectsMap[top1] || 0) + qty1;
    }

    stations.push({
      bench, stationName,
      nbBoards, nbFirstPass, nbOkFirstPass, nbBoardsOK, nbTestRun,
      fpy, top1, qty1
    });
  }

  let totalBoards = 0;
  let achieved = 0;
  let overallFPY = null;

  const assemblyRow = stations.find(s => s.stationName && s.stationName.toLowerCase().includes('assembly'));
  if (assemblyRow) {
    totalBoards = assemblyRow.nbBoards;
  } else if (stations.length > 0) {
    totalBoards = stations[0].nbBoards;
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (Array.isArray(row) && row[nameIdx] && String(row[nameIdx]).toUpperCase().includes('TOTAL')) {
      if (totalBoards === 0) {
        totalBoards = col.nbBoards >= 0 ? parseNum(row[col.nbBoards]) : 0;
      }
      overallFPY = col.fpy >= 0 ? parsePct(row[col.fpy]) : null;
      break;
    }
  }

  if (totalBoards === 0) {
    totalBoards = stations.reduce((max, r) => r.nbBoards > max ? r.nbBoards : max, 0);
  }

  const multiTestRow = stations.find(s => s.stationName && (s.stationName.toLowerCase().includes('multi-test') || s.stationName.toLowerCase().includes('multitest')));
  if (multiTestRow) {
    achieved = multiTestRow.nbBoardsOK;
  } else {
    const assemblyRow = stations.find(s => s.stationName && s.stationName.toLowerCase().includes('assembly'));
    achieved = assemblyRow ? assemblyRow.nbBoardsOK : 0;
  }

  if (overallFPY === null || overallFPY > 100 || overallFPY <= 0) {
    if (totalBoards > 0) {
      overallFPY = (achieved / totalBoards) * 100;
    }
  }

  const defectsArr = Object.entries(defectsMap)
    .map(([code, qty]) => ({ code, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return { product, stations, defects: defectsArr, achieved, totalBoards, overallFPY };
}

// ===================== STYLES =====================

export default function FPYDashboard() {
  const { language } = useApp();
  const isRtl = language === "ar";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [target, setTarget] = useState(320);

  // Perso Production Filter States
  const [productionFilter, setProductionFilter] = useState("week"); // "today", "week", "month", "custom"
  const [prodStartDate, setProdStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [prodEndDate, setProdEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Handle production filter date changes
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    if (productionFilter === "today") {
      setProdStartDate(todayStr);
      setProdEndDate(todayStr);
    } else if (productionFilter === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setProdStartDate(d.toISOString().slice(0, 10));
      setProdEndDate(todayStr);
    } else if (productionFilter === "month") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setProdStartDate(d.toISOString().slice(0, 10));
      setProdEndDate(todayStr);
    } else if (productionFilter === "all") {
      if (reports && reports.length > 0) {
        const dates = reports.map(r => r.date).filter(Boolean);
        if (dates.length > 0) {
          const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
          const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0]);
          setProdStartDate(minDate);
          setProdEndDate(maxDate);
        }
      }
    }
  }, [productionFilter, reports]);

  // Compute Perso Totals
  const persoTotals = useMemo(() => {
    let ok = 0;
    let total = 0;
    let reportsCount = 0;
    
    reports.forEach(r => {
      const matchDate = productionFilter === "all" || (r.date >= prodStartDate && r.date <= prodEndDate);
      if (matchDate) {
        const persoStation = (r.stations || []).find(s => 
          s.stationName && s.stationName.toLowerCase().includes("perso")
        );
        if (persoStation) {
          ok += parseInt(persoStation.nbBoardsOK) || 0;
          total += parseInt(persoStation.nbBoards) || 0;
          reportsCount++;
        }
      }
    });
    
    return { ok, total, reportsCount };
  }, [reports, prodStartDate, prodEndDate, productionFilter]);
  
  // Upload states
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadTarget, setUploadTarget] = useState(320);
  
  // Refs for Charts
  const fpyBarChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const trendBoardsChartRef = useRef(null);
  const fpyBarChartInst = useRef(null);
  const trendChartInst = useRef(null);
  const trendBoardsChartInst = useRef(null);

  useEffect(() => {
    loadAllReports();
  }, []);

  const loadAllReports = async () => {
    try {
      const { data, error } = await supabase.from("fpy_reports").select("*").order('date', { ascending: false });
      if (error) throw error;
      
      setReports(data || []);
      if (data && data.length > 0 && !currentReport) {
        setCurrentReport(data[0]);
      }
    } catch (err) {
      console.error("Error loading FPY reports from Supabase:", err);
    }
  };

  // Update target when currentReport changes
  useEffect(() => {
    if (currentReport && currentReport.target) {
      setTarget(currentReport.target);
    }
  }, [currentReport]);

  // Re-render Dashboard Charts when currentReport changes
  useEffect(() => {
    if (activeTab === "dashboard" && currentReport && fpyBarChartRef.current) {
      const stFpy = currentReport.stations.filter(s => s.fpy !== null);
      
      if (fpyBarChartInst.current) fpyBarChartInst.current.destroy();
      
      fpyBarChartInst.current = new Chart(fpyBarChartRef.current, {
        type: 'bar',
        data: {
          labels: stFpy.map(s => s.stationName.length > 14 ? s.stationName.slice(0,14)+'…' : s.stationName),
          datasets: [{
            data: stFpy.map(s => s.fpy),
            backgroundColor: stFpy.map(s => s.fpy >= 90 ? '#22c98a' : s.fpy >= 75 ? '#f5a623' : '#f04b4b'),
            borderRadius: 5, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `FPY: ${c.parsed.y.toFixed(2)}%` } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8b90a0', font: { size: 11 }, maxRotation: 35 } },
            y: { min: 0, max: 105, ticks: { callback: v => v + '%', color: '#8b90a0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }
  }, [activeTab, currentReport]);

  // Re-render Trend Charts
  useEffect(() => {
    if (activeTab === "trend" && reports.length >= 2) {
      const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
      const labels = sorted.map(r => r.date);
      const fpyData = sorted.map(r => r.overall_fpy);
      const boardsData = sorted.map(r => r.total_boards);

      if (trendChartInst.current) trendChartInst.current.destroy();
      trendChartInst.current = new Chart(trendChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'FPY %', data: fpyData,
            borderColor: '#22c98a', backgroundColor: 'rgba(34,201,138,0.08)',
            tension: 0.35, fill: true, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#22c98a'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `FPY: ${c.parsed.y?.toFixed(2)}%` } } },
          scales: {
            x: { ticks: { color: '#8b90a0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { callback: v => v + '%', color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });

      if (trendBoardsChartInst.current) trendBoardsChartInst.current.destroy();
      trendBoardsChartInst.current = new Chart(trendBoardsChartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Boards', data: boardsData,
            backgroundColor: 'rgba(75,142,240,0.7)', borderRadius: 5, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#8b90a0', font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }
  }, [activeTab, reports]);

  const handleFileUpload = (file) => {
    if (!file) return;
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = parseFPYExcel(e.target.result);
        setParsedData(data);
      } catch (err) {
        alert("خطأ في قراءة الملف: " + err.message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const saveReport = async () => {
    if (!parsedData) return;
    const existing = reports.find(r => r.date === reportDate);
    
    const reportPayload = {
      date: reportDate,
      product: parsedData.product,
      target: uploadTarget,
      overall_fpy: parsedData.overallFPY,
      total_boards: parsedData.totalBoards,
      achieved: parsedData.achieved,
      stations: parsedData.stations,
      defects: parsedData.defects
    };

    try {
      if (existing) {
        if (!window.confirm(`يوجد تقرير لتاريخ ${reportDate} بالفعل. هل تريد استبداله؟`)) return;
        await supabase.from("fpy_reports").update(reportPayload).eq("id", existing.id);
      } else {
        await supabase.from("fpy_reports").insert([reportPayload]);
      }
      setParsedData(null);
      await loadAllReports();
      setActiveTab("dashboard");
    } catch (err) {
      console.error("Cloud Error saving FPY:", err);
      alert("حدث خطأ أثناء الحفظ في السحابة.");
    }
  };

  const deleteReport = async (id, date) => {
    if (!window.confirm(`هل تريد حذف تقرير ${date} سحابياً؟`)) return;
    try {
      await supabase.from("fpy_reports").delete().eq("id", id);
      await loadAllReports();
      if (currentReport?.id === id) setCurrentReport(null);
    } catch (err) {
      console.error("Cloud Error deleting FPY:", err);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("سيتم حذف كل البيانات المحفوظة نهائياً من السحابة. هل أنت متأكد؟")) return;
    try {
      await supabase.from("fpy_reports").delete().neq("id", 0); // Delete all
      setReports([]);
      setCurrentReport(null);
    } catch (err) {
      console.error("Cloud Error clearing FPY:", err);
    }
  };

  const fpyClass = (fpy) => {
    if (fpy === null) return '';
    if (fpy >= 90) return 'badge-green';
    if (fpy >= 75) return 'badge-amber';
    return 'badge-red';
  };

  const bottleneck = useMemo(() => {
    if (!currentReport || !currentReport.stations) return null;
    return [...currentReport.stations].filter(s => s.fpy !== null).sort((a, b) => a.fpy - b.fpy)[0];
  }, [currentReport]);

  const totalDefects = useMemo(() => {
    if (!currentReport || !currentReport.stations) return 0;
    return currentReport.stations.reduce((sum, s) => sum + (s.nbBoards - s.nbBoardsOK), 0);
  }, [currentReport]);

  const displayTotalBoards = useMemo(() => {
    if (!currentReport || !currentReport.stations || currentReport.stations.length === 0) return 0;
    const assemblyStation = currentReport.stations.find(s => s.stationName && s.stationName.toLowerCase().includes('assembly'));
    if (assemblyStation) {
      return assemblyStation.nbBoards;
    }
    return currentReport.stations[0].nbBoards;
  }, [currentReport]);

  const displayOverallFPY = useMemo(() => {
    if (!currentReport) return null;
    if (currentReport.overall_fpy !== null && currentReport.overall_fpy > 0) {
      return currentReport.overall_fpy;
    }
    if (displayTotalBoards > 0) {
      return (currentReport.achieved / displayTotalBoards) * 100;
    }
    return 0;
  }, [currentReport, displayTotalBoards]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>لوحة تحكم FPY الجودة</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>تحليل أداء خطوط الإنتاج من ملفات Excel وحفظها سحابياً</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${activeTab === "dashboard" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("dashboard")}><BarChart2 size={16} /> لوحة التحكم</button>
          <button className={`btn ${activeTab === "upload" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("upload")}><Upload size={16} /> رفع تقرير</button>
          <button className={`btn ${activeTab === "history" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("history")}><History size={16} /> السجل السحابي</button>
          <button className={`btn ${activeTab === "trend" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("trend")}><TrendingUp size={16} /> الاتجاهات</button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="animate-fade">
          {!currentReport ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>☁️</div>
              <h3>لا توجد تقارير سحابية بعد</h3>
              <p style={{ color: "var(--text-muted)" }}>ارفع أول تقرير من صفحة "رفع تقرير" ليتم حفظه في Supabase وبدء العرض.</p>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setActiveTab("upload")}>📤 رفع تقرير</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Perso Total Production Widget */}
              <div className="card animate-fade" style={{ 
                background: "linear-gradient(135deg, #1e293b, #0f172a)", 
                color: "#f8fafc", 
                border: "1px solid rgba(255,255,255,0.05)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                padding: "20px 24px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(236,72,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "1.2rem" }}>🌐</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
                        {isRtl ? "إجمالي إنتاج مرحلة التخصيص (Perso)" : "Total Perso Stage Production"}
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                        {isRtl ? "احتساب العدادات التي مرت بنجاح من محطة البيرسو للتاريخ المحدد" : "Smart meters successfully customized for the selected range"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Filter controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div className="btn-group" style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: 3, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                      <button 
                        type="button"
                        style={{
                          background: productionFilter === "today" ? "rgba(255,255,255,0.15)" : "none",
                          border: "none", color: "#f8fafc", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600
                        }}
                        onClick={() => setProductionFilter("today")}
                      >
                        {isRtl ? "اليوم" : "Today"}
                      </button>
                      <button 
                        type="button"
                        style={{
                          background: productionFilter === "week" ? "rgba(255,255,255,0.15)" : "none",
                          border: "none", color: "#f8fafc", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600
                        }}
                        onClick={() => setProductionFilter("week")}
                      >
                        {isRtl ? "آخر 7 أيام" : "Last 7 Days"}
                      </button>
                      <button 
                        type="button"
                        style={{
                          background: productionFilter === "month" ? "rgba(255,255,255,0.15)" : "none",
                          border: "none", color: "#f8fafc", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600
                        }}
                        onClick={() => setProductionFilter("month")}
                      >
                        {isRtl ? "آخر 30 يوم" : "Last 30 Days"}
                      </button>
                      <button 
                        type="button"
                        style={{
                          background: productionFilter === "all" ? "rgba(255,255,255,0.15)" : "none",
                          border: "none", color: "#f8fafc", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600
                        }}
                        onClick={() => setProductionFilter("all")}
                      >
                        {isRtl ? "الكل" : "All"}
                      </button>
                      <button 
                        type="button"
                        style={{
                          background: productionFilter === "custom" ? "rgba(255,255,255,0.15)" : "none",
                          border: "none", color: "#f8fafc", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600
                        }}
                        onClick={() => setProductionFilter("custom")}
                      >
                        {isRtl ? "تاريخ مخصص" : "Custom Range"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Date Picker Inputs */}
                {productionFilter === "custom" && (
                  <div className="animate-fade" style={{ display: "flex", gap: 12, marginBottom: 18, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap", flexDirection: isRtl ? "row-reverse" : "row" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row-reverse" : "row" }}>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{isRtl ? "من:" : "From:"}</span>
                      <input 
                        type="date" 
                        className="input" 
                        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", color: "#f8fafc", padding: "4px 8px", fontSize: "0.8rem", borderRadius: 6 }} 
                        value={prodStartDate} 
                        onChange={e => setProdStartDate(e.target.value)} 
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row-reverse" : "row" }}>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{isRtl ? "إلى:" : "To:"}</span>
                      <input 
                        type="date" 
                        className="input" 
                        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", color: "#f8fafc", padding: "4px 8px", fontSize: "0.8rem", borderRadius: 6 }} 
                        value={prodEndDate} 
                        onChange={e => setProdEndDate(e.target.value)} 
                      />
                    </div>
                  </div>
                )}

                {/* Production Count Display */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap", gap: 16, flexDirection: isRtl ? "row-reverse" : "row" }}>
                  <div style={{ textAlign: isRtl ? "right" : "left" }}>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 4 }}>
                      {isRtl ? "الإنتاج الفعلي الناجح (Final OK)" : "Successful Production (Final OK)"}
                    </div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#10b981", lineHeight: 1 }}>
                      {persoTotals.ok.toLocaleString()} <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "#94a3b8" }}>{isRtl ? "عداد ذكي" : "smart meters"}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: isRtl ? "row-reverse" : "row" }}>
                    <div style={{ textAlign: isRtl ? "right" : "left" }}>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 2 }}>{isRtl ? "أيام التقارير المدرجة" : "Days of Reports"}</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f59e0b" }}>{persoTotals.reportsCount} {isRtl ? "أيام" : "days"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Header with Selector */}
              <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", flexDirection: isRtl ? "row" : "row-reverse" }}>
                <div style={{ fontWeight: 700 }}>تقرير {currentReport.date} — {currentReport.product}</div>
                <select className="input" style={{ width: "auto" }} value={currentReport.id} onChange={e => setCurrentReport(reports.find(r => r.id === parseInt(e.target.value)))}>
                  {reports.map(r => (
                    <option key={r.id} value={r.id}>{r.date} — {r.product.slice(0,25)}</option>
                  ))}
                </select>
              </div>

              {/* Progress Bar / Target */}
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ whiteSpace: "nowrap" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>الهدف اليومي (لوحات)</label>
                  <input type="number" className="input" style={{ width: 80, padding: "5px 10px" }} value={target} onChange={async e => {
                    const newTarget = parseInt(e.target.value) || 1;
                    setTarget(newTarget);
                    if (currentReport) {
                      const updated = { ...currentReport, target: newTarget };
                      setCurrentReport(updated);
                      await supabase.from("fpy_reports").update({ target: newTarget }).eq("id", currentReport.id);
                      const all = [...reports];
                      const idx = all.findIndex(r => r.id === currentReport.id);
                      if (idx >= 0) all[idx].target = newTarget;
                      setReports(all);
                    }
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.85rem" }}>
                    <span>التقدم نحو الهدف</span>
                    <span style={{ fontWeight: 700 }}>{((currentReport.achieved / target) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ 
                      height: "100%", 
                      width: `${Math.min((currentReport.achieved / target) * 100, 100)}%`,
                      background: (currentReport.achieved / target) >= 0.95 ? "var(--green)" : (currentReport.achieved / target) >= 0.75 ? "var(--amber)" : "var(--red)",
                      transition: "width 0.4s"
                    }} />
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid-3 stagger">
                <div className="stat-card" style={{ borderRight: "4px solid var(--green)" }}>
                  <div><div className="stat-value" style={{ color: "var(--green)" }}>{displayOverallFPY !== null ? displayOverallFPY.toFixed(2) + '%' : 'N/A'}</div><div className="stat-label">OVERALL FPY</div></div>
                </div>
                <div className="stat-card">
                  <div><div className="stat-value">{displayTotalBoards}</div><div className="stat-label">إجمالي اللوحات</div></div>
                </div>
                <div className="stat-card">
                  <div>
                    <div className="stat-value" style={{ color: "var(--blue)" }}>{currentReport.achieved}</div>
                    <div className="stat-label">الإنتاج النهائي (Multi-TEST)</div>
                  </div>
                </div>
                <div className="stat-card" style={{ borderRight: `4px solid ${bottleneck && bottleneck.fpy < 75 ? "var(--red)" : "var(--amber)"}` }}>
                  <div><div className="stat-value" style={{ color: bottleneck && bottleneck.fpy < 75 ? "var(--red)" : "var(--amber)" }}>{bottleneck ? bottleneck.fpy.toFixed(1) + '%' : 'N/A'}</div><div className="stat-label">عنق الزجاجة ({bottleneck?.stationName})</div></div>
                </div>
                <div className="stat-card">
                  <div><div className="stat-value">{currentReport.stations?.length || 0}</div><div className="stat-label">محطة اختبار</div></div>
                </div>
                <div className="stat-card" style={{ borderRight: "4px solid var(--red)" }}>
                  <div><div className="stat-value" style={{ color: "var(--red)" }}>{totalDefects}</div><div className="stat-label">إجمالي الأعطال</div></div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid-2">
                <div className="card" style={{ height: 350 }}>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: "0.9rem", color: "var(--text-muted)" }}>FPY لكل محطة — تحديد عنق الزجاجة</div>
                  <div style={{ position: "relative", height: 280 }}><canvas ref={fpyBarChartRef}></canvas></div>
                </div>
                <div className="card" style={{ height: 350 }}>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: "0.9rem", color: "var(--text-muted)" }}>توزيع أبرز الأعطال (Top Defects)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", height: 280 }}>
                    {!currentReport.defects || currentReport.defects.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>لا توجد أعطال مسجلة</div>
                    ) : (
                      currentReport.defects.map((d, i) => {
                        const maxQ = Math.max(...currentReport.defects.map(def => def.qty));
                        const pct = (d.qty / maxQ) * 100;
                        const colors = ['#f04b4b','#f5a623','#4b8ef0','#22c98a','#9b6af7','#e8759a','#5dd3c4','#f0c94b'];
                        const color = colors[i % colors.length];
                        return (
                          <div key={d.code} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.85rem" }}>
                              <span style={{ fontWeight: 700, fontFamily: "monospace" }}>كود العطل: {d.code}</span>
                              <span style={{ fontWeight: 700, color }}>{d.qty} حالة</span>
                            </div>
                            <div style={{ width: "100%", height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, float: "right" }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700 }}>تفاصيل المحطات (التدفق والانتاجية)</span>
                  <span className="badge badge-blue">{currentReport.stations?.length || 0} محطات</span>
                </div>
                <div className="table-wrapper" style={{ border: "none" }}>
                  <table style={{ fontSize: "0.85rem", textAlign: "center" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "right" }}>المحطة</th>
                        <th style={{ textAlign: "center" }}>مرات الفحص</th>
                        <th style={{ textAlign: "center" }}>اللي دخل</th>
                        <th style={{ textAlign: "center" }}>كم طلع ناجح</th>
                        <th style={{ textAlign: "center" }}>كم رسب</th>
                        <th style={{ textAlign: "center" }}>نسبة النجاح من أول مرة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.stations && currentReport.stations.map(s => {
                        const failed = s.nbBoards - s.nbBoardsOK;
                        return (
                          <tr key={s.bench}>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700 }}>{s.stationName}</div>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{s.bench}</div>
                            </td>
                            <td style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-secondary)" }}>{s.nbTestRun || "-"}</td>
                            <td style={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.nbBoards}</td>
                            <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.95rem" }}>{s.nbBoardsOK}</td>
                            <td style={{ color: failed > 0 ? "var(--red)" : "inherit", fontWeight: failed > 0 ? 700 : 500, fontSize: "0.95rem" }}>
                              {failed}
                            </td>
                            <td>
                              <span className={`badge ${fpyClass(s.fpy)}`} style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                                {s.fpy !== null ? s.fpy.toFixed(2) + '%' : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPLOAD TAB */}
      {activeTab === "upload" && (
        <div className="animate-fade" style={{ textAlign: "center", padding: "40px 0" }}>
          <h2>رفع ملف Excel الإنتاج</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>ارفع ملف تقرير FPY اليومي ليتم تحليله وحفظه في السحابة</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
            <div className="input-group" style={{ width: "auto" }}>
              <label className="input-label">تاريخ التقرير</label>
              <input type="date" className="input" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            </div>
            <div className="input-group" style={{ width: "auto" }}>
              <label className="input-label">الهدف (Target)</label>
              <input type="number" className="input" value={uploadTarget} onChange={e => setUploadTarget(parseInt(e.target.value) || 1)} style={{ width: 120 }} />
            </div>
          </div>

          <div 
            style={{ 
              border: "2px dashed var(--border)", borderRadius: 16, padding: 60, cursor: "pointer", 
              background: "var(--bg-elevated)", maxWidth: 600, margin: "0 auto", transition: "all 0.2s" 
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('fpy-file').click()}
          >
            <input type="file" id="fpy-file" style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files[0])} accept=".xls,.xlsx" />
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 700 }}>اسحب الملف هنا أو اضغط للاختيار</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 8 }}>يدعم: .xls, .xlsx</div>
          </div>

          {isParsing && <div style={{ marginTop: 20 }}><div className="spinner" style={{ margin: "0 auto 10px" }}></div>جاري التحليل...</div>}

          {parsedData && (
            <div className="card" style={{ maxWidth: 700, margin: "24px auto", textAlign: "right" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3>معاينة البيانات: {parsedData.product}</h3>
                <span className="badge badge-green">✓ جاهز للحفظ السحابي</span>
              </div>
              <div className="grid-3" style={{ marginBottom: 16 }}>
                <div style={{ padding: 12, background: "var(--bg-elevated)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>FPY</div>
                  <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--green)" }}>{parsedData.overallFPY?.toFixed(2)}%</div>
                </div>
                <div style={{ padding: 12, background: "var(--bg-elevated)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>إجمالي اللوحات</div>
                  <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{parsedData.totalBoards}</div>
                </div>
                <div style={{ padding: 12, background: "var(--bg-elevated)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>الإنتاج النهائي (Multi-TEST)</div>
                  <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--blue)" }}>{parsedData.achieved}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={saveReport}>☁️ حفظ في السحابة</button>
                <button className="btn btn-secondary" onClick={() => setParsedData(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="animate-fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>سجل التقارير السحابية</h3>
            <button className="btn btn-danger btn-sm" onClick={clearAll}><Trash2 size={14} /> مسح السحابة</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {reports.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>لا توجد سجلات في السحابة</div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>📅 {r.date}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{r.product}</div>
                  </div>
                  <div style={{ display: "flex", gap: 30 }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, color: "var(--green)" }}>{r.overall_fpy?.toFixed(1)}%</div><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>FPY</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700 }}>{r.total_boards}</div><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Boards</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, color: "var(--blue)" }}>{r.achieved}</div><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Final OK</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentReport(r); setActiveTab("dashboard"); }}>👁 عرض</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => deleteReport(r.id, r.date)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TREND TAB */}
      {activeTab === "trend" && (
        <div className="animate-fade">
          {reports.length < 2 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>📈</div>
              <h3>بيانات سحابية غير كافية</h3>
              <p>يجب حفظ تقريرين على الأقل في السحابة لعرض الاتجاهات الزمنية.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 20, fontSize: "0.95rem" }}>تطور معدل FPY الإجمالي</div>
                <div style={{ height: 350 }}><canvas ref={trendChartRef}></canvas></div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 20, fontSize: "0.95rem" }}>إجمالي اللوحات المنتجة يومياً</div>
                <div style={{ height: 300 }}><canvas ref={trendBoardsChartRef}></canvas></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
