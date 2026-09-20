import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { 
  Package, Search, AlertTriangle, CheckCircle, 
  X, RotateCcw, FileSpreadsheet, Loader2, 
  Check, ChevronLeft, ChevronRight
} from "lucide-react";

const METERS_PER_PALLET = 160;

function formatDateToYYYYMMDD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateStr() {
  return formatDateToYYYYMMDD(new Date());
}

function getYesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateToYYYYMMDD(d);
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  if (typeof dateVal === "string" && dateVal.length === 10) {
    return dateVal;
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toISOString().split("T")[0];
  } catch {
    return String(dateVal);
  }
}

export default function SerialRegistrationPanel() {
  const { currentUser, language } = useApp();
  const isRtl = language === "ar";

  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState(getTodayDateStr());
  const [customEndDate, setCustomEndDate] = useState(getTodayDateStr());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // 'connecting', 'online', 'offline'
  const [alert, setAlert] = useState(null);

  // Form inputs
  const [serialInput, setSerialInput] = useState("");
  const [operatorInput, setOperatorInput] = useState(() => {
    return localStorage.getItem("serial_reg_operator") || currentUser?.full_name || "";
  });

  const serialInputRef = useRef(null);

  // Fetch initial records
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setConnectionStatus("connecting");
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("registered_serials")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setConnectionStatus("online");
      setAllRecords(data || []);
    } catch (err) {
      console.error("Supabase error fetching registered_serials:", err);
      setConnectionStatus("offline");
      showAlert("error", isRtl 
        ? `خطأ في الاتصال بقاعدة البيانات: ${err.message || err}` 
        : `Error connecting to database: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    if (type === "success") {
      setTimeout(() => {
        setAlert(prev => (prev?.message === message ? null : prev));
      }, 5000);
    }
  };

  const handleOperatorChange = (val) => {
    setOperatorInput(val);
    localStorage.setItem("serial_reg_operator", val.trim());
  };

  // Date filter logic
  const isRecordMatchingDate = (record) => {
    if (activeDateFilter === "all") return true;

    const raw = record.registration_date || record.created_at;
    if (!raw) return false;
    const dateStr = String(raw).substring(0, 10);
    const todayStr = getTodayDateStr();

    if (activeDateFilter === "today") {
      return dateStr === todayStr;
    }
    if (activeDateFilter === "yesterday") {
      return dateStr === getYesterdayDateStr();
    }
    if (activeDateFilter === "this-month") {
      const currentYearMonth = todayStr.substring(0, 7);
      return dateStr.startsWith(currentYearMonth);
    }
    if (activeDateFilter === "last-month") {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const lastYearMonth = formatDateToYYYYMMDD(d).substring(0, 7);
      return dateStr.startsWith(lastYearMonth);
    }
    if (activeDateFilter === "custom") {
      if (customStartDate && dateStr < customStartDate) return false;
      if (customEndDate && dateStr > customEndDate) return false;
      return true;
    }
    return true;
  };

  const getActiveFilterLabel = () => {
    switch (activeDateFilter) {
      case "today": return isRtl ? "اليوم (Today)" : "Today";
      case "yesterday": return isRtl ? "أمس (Yesterday)" : "Yesterday";
      case "this-month": return isRtl ? "هذا الشهر (This Month)" : "This Month";
      case "last-month": return isRtl ? "الشهر السابق (Last Month)" : "Last Month";
      case "custom":
        return isRtl 
          ? `فترة: ${customStartDate || "البداية"} إلى ${customEndDate || "اليوم"}` 
          : `Range: ${customStartDate || "Start"} to ${customEndDate || "Today"}`;
      default: return isRtl ? "الكل (All Time)" : "All Time";
    }
  };

  // Filtered dataset
  const dateFilteredRecords = useMemo(() => {
    return allRecords.filter(isRecordMatchingDate);
  }, [allRecords, activeDateFilter, customStartDate, customEndDate]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return dateFilteredRecords;
    return dateFilteredRecords.filter(r => {
      const serial = (r.serial_number || "").toUpperCase();
      const recordedBy = (r.recorded_by_name || r.recorded_by || "").toUpperCase();
      return serial.includes(q) || recordedBy.includes(q);
    });
  }, [dateFilteredRecords, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const periodPallets = dateFilteredRecords.length;
    const periodMeters = periodPallets * METERS_PER_PALLET;
    const allPallets = allRecords.length;
    const allMeters = allPallets * METERS_PER_PALLET;
    return {
      periodPallets,
      periodMeters,
      allPallets,
      allMeters
    };
  }, [dateFilteredRecords, allRecords]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Registration handler
  const handleRegister = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const rawSerial = serialInput.trim();
    if (!rawSerial) {
      serialInputRef.current?.focus();
      return;
    }

    const serialNumber = rawSerial.toUpperCase();
    const operator = operatorInput.trim() || currentUser?.full_name || currentUser?.employee_id || null;

    setIsSubmitting(true);
    setAlert(null);

    try {
      // 1. Frontend duplicate check (instant local cache check)
      const localDuplicate = allRecords.find(
        (r) => r.serial_number && r.serial_number.trim().toUpperCase() === serialNumber
      );

      if (localDuplicate) {
        showAlert("warning", isRtl 
          ? `رقم السيريال مسجل مسبقاً (${serialNumber})` 
          : `This serial number is already registered (${serialNumber}).`);
        serialInputRef.current?.select();
        setIsSubmitting(false);
        return;
      }

      // 2. Database duplicate check (server check)
      const { data: existingRows, error: checkError } = await supabase
        .from("registered_serials")
        .select("id, serial_number")
        .ilike("serial_number", serialNumber)
        .limit(1);

      if (checkError) {
        console.warn("Could not perform pre-check duplicate query, falling back to DB constraint:", checkError);
      }

      if (existingRows && existingRows.length > 0) {
        showAlert("warning", isRtl 
          ? `رقم السيريال مسجل مسبقاً في قاعدة البيانات (${serialNumber})` 
          : `This serial number is already registered (${serialNumber}).`);
        serialInputRef.current?.select();
        setIsSubmitting(false);
        return;
      }

      // 3. Insert into Supabase
      const todayStr = getTodayDateStr();
      const newRecord = {
        id: crypto.randomUUID(),
        serial_number: serialNumber,
        registration_date: todayStr,
        recorded_by: currentUser?.employee_id || operator,
        recorded_by_name: operator,
        notes: "160 meters",
        created_at: new Date().toISOString()
      };

      const { data: insertedData, error: insertError } = await supabase
        .from("registered_serials")
        .insert([newRecord])
        .select();

      if (insertError) {
        if (
          insertError.code === "23505" ||
          (insertError.message && insertError.message.toLowerCase().includes("duplicate")) ||
          (insertError.message && insertError.message.toLowerCase().includes("unique"))
        ) {
          showAlert("warning", isRtl 
            ? `رقم السيريال مسجل مسبقاً (${serialNumber})` 
            : `This serial number is already registered (${serialNumber}).`);
          serialInputRef.current?.select();
          setIsSubmitting(false);
          return;
        }
        throw insertError;
      }

      // 4. Success message stating 160 meters added
      showAlert("success", isRtl
        ? `تم تسجيل سيريال البليت بنجاح: ${serialNumber} — تمت إضافة 160 عداد كهرباء`
        : `Pallet serial registered successfully: ${serialNumber} — 160 electricity meters added!`);

      // 5. Clear & Refocus
      setSerialInput("");
      serialInputRef.current?.focus();

      // 6. Update local state
      const recordToAdd = insertedData && insertedData[0] ? insertedData[0] : newRecord;
      setAllRecords(prev => [recordToAdd, ...prev]);

    } catch (err) {
      console.error("Error registering serial:", err);
      showAlert("error", isRtl 
        ? `فشل تسجيل رقم السيريال: ${err.message || err}` 
        : `Failed to register serial number: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      showAlert("warning", isRtl 
        ? "لا توجد سجلات متاحة للتصدير في هذه الفترة." 
        : "No serial records available to export for this period.");
      return;
    }

    try {
      const excelRows = filteredRecords.map((row) => ({
        "Pallet Serial Number": row.serial_number || "",
        "Meters Quantity": METERS_PER_PALLET,
        "Registration Date": formatDate(row.registration_date || row.created_at),
        "Registered By": row.recorded_by_name || row.recorded_by || "System"
      }));

      const ws = XLSX.utils.json_to_sheet(excelRows);
      ws["!cols"] = [
        { wch: 25 },
        { wch: 18 },
        { wch: 18 },
        { wch: 25 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registered Pallets");

      const todayStr = getTodayDateStr();
      const filterSuffix = activeDateFilter !== "all" ? `_${activeDateFilter}` : "";
      const fileName = `Registered_Serials_${todayStr}${filterSuffix}.xlsx`;

      XLSX.writeFile(wb, fileName);
      showAlert("success", isRtl 
        ? `تم تصدير ${excelRows.length.toLocaleString()} سجل إلى ${fileName}` 
        : `Exported ${excelRows.length.toLocaleString()} records to ${fileName}`);

    } catch (err) {
      console.error("Excel export failed:", err);
      showAlert("error", isRtl 
        ? `فشل تصدير ملف الإكسل: ${err.message || err}` 
        : `Failed to export Excel file: ${err.message || err}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      
      {/* Header Banner */}
      <div className="card" style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--radius-md)", 
            background: "var(--accent-glow)", color: "var(--accent)", 
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Package size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
              {isRtl ? "تسجيل سيريال البليت" : "Serial Registration"}
            </h2>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {isRtl 
                ? "Smart Meter Production MES • تسجيل سيريال البليت (160 عداد / بليت)" 
                : "Smart Meter Production MES • Pallet Serial Entry (160 meters / pallet)"}
            </div>
          </div>
        </div>

        {/* Connection Status Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${connectionStatus === "online" ? "badge-green" : connectionStatus === "offline" ? "badge-red" : "badge-gray"}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
            <span style={{ 
              width: 8, height: 8, borderRadius: "50%", 
              backgroundColor: connectionStatus === "online" ? "var(--green)" : connectionStatus === "offline" ? "var(--red)" : "var(--text-muted)" 
            }}></span>
            {connectionStatus === "online" ? (isRtl ? "قاعدة البيانات متصلة" : "Database Connected") :
             connectionStatus === "offline" ? (isRtl ? "خطأ في الاتصال" : "Connection Error") :
             (isRtl ? "جاري الاتصال..." : "Connecting...")}
          </span>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={fetchRecords} 
            title={isRtl ? "إعادة تحميل البيانات" : "Reload data"}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div className={`alert ${alert.type === "success" ? "alert-success" : alert.type === "warning" ? "alert-warning" : "alert-danger"}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {alert.type === "success" && <CheckCircle size={18} />}
            {alert.type === "warning" && <AlertTriangle size={18} />}
            {alert.type === "error" && <X size={18} />}
            <span style={{ fontWeight: 600 }}>{alert.message}</span>
          </div>
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setAlert(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* 1. Serial Number Entry Section */}
      <section className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            {isRtl ? "تسجيل سيريال البليت / Pallet Serial Entry" : "Pallet Serial Entry"}
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {isRtl ? "اضغط [Enter] للتسجيل الفوري" : "Press [Enter] to register instantly"}
          </span>
        </div>

        <form onSubmit={handleRegister} autoComplete="off">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <label className="input-label" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                {isRtl ? "رقم سيريال البليت (Pallet Serial Number)" : "Pallet Serial Number"}
              </label>
              <input
                ref={serialInputRef}
                type="text"
                className="input"
                style={{ 
                  height: 52, fontSize: "1.15rem", fontFamily: "var(--font-mono, monospace)", 
                  fontWeight: 700, letterSpacing: "0.04em", textAlign: isRtl ? "right" : "left" 
                }}
                placeholder={isRtl ? "أدخل أو امسح باركود سيريال البليت..." : "Enter or scan pallet serial number..."}
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ width: 220 }}>
              <label className="input-label" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                {isRtl ? "المسجل (Registered By)" : "Registered By (Optional)"}
              </label>
              <input
                type="text"
                className="input"
                style={{ height: 52, fontSize: "0.95rem", textAlign: isRtl ? "right" : "left" }}
                placeholder={isRtl ? "اسم أو رقم المشغل" : "Operator ID / Name"}
                value={operatorInput}
                onChange={(e) => handleOperatorChange(e.target.value)}
              />
            </div>

            <div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ height: 52, padding: "0 28px", fontSize: "1rem", fontWeight: 700, minWidth: 160 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>{isRtl ? "جاري الفحص والحفظ..." : "Checking & Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>{isRtl ? "تسجيل البليت (160 عداد)" : "Add / Register"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 2. Date Filtering & Search Section */}
      <section className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 14 }}>
          {isRtl ? "فلترة الفترات والبحث / Filter & Search" : "Filter by Period & Search"}
        </div>

        {/* Quick Date Chips */}
        <div style={{ background: "var(--bg-elevated, #f8fafc)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700 }}>
            <span>📅 {isRtl ? "فلترة التواريخ والفترات:" : "Date & Period Filter:"}</span>
            <span style={{ color: "var(--accent)", fontWeight: 800 }}>{getActiveFilterLabel()}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {[
              { id: "all", ar: "الكل (All)", en: "All" },
              { id: "today", ar: "اليوم (Today)", en: "Today" },
              { id: "yesterday", ar: "أمس (Yesterday)", en: "Yesterday" },
              { id: "this-month", ar: "هذا الشهر (This Month)", en: "This Month" },
              { id: "last-month", ar: "الشهر السابق (Last Month)", en: "Last Month" },
              { id: "custom", ar: "فترة محددة (Custom Range)", en: "Custom Range" },
            ].map(chip => (
              <button
                key={chip.id}
                type="button"
                className={`btn btn-sm ${activeDateFilter === chip.id ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: 20, padding: "6px 16px", fontWeight: 600 }}
                onClick={() => {
                  setActiveDateFilter(chip.id);
                  setCurrentPage(1);
                }}
              >
                {isRtl ? chip.ar : chip.en}
              </button>
            ))}
          </div>

          {/* Custom Date Range Row */}
          {activeDateFilter === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", paddingTop: 12, borderTop: "1px dashed var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <label style={{ fontWeight: 600 }}>{isRtl ? "من تاريخ (From):" : "From:"}</label>
                <input 
                  type="date" 
                  className="input" 
                  style={{ height: 36, padding: "0 10px" }}
                  value={customStartDate} 
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }} 
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <label style={{ fontWeight: 600 }}>{isRtl ? "إلى تاريخ (To):" : "To:"}</label>
                <input 
                  type="date" 
                  className="input" 
                  style={{ height: 36, padding: "0 10px" }}
                  value={customEndDate} 
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }} 
                />
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                style={{ height: 36 }}
                onClick={() => {
                  const today = getTodayDateStr();
                  setCustomStartDate(today);
                  setCustomEndDate(today);
                  setActiveDateFilter("all");
                  setCurrentPage(1);
                }}
              >
                {isRtl ? "إعادة تعيين (Reset)" : "Reset"}
              </button>
            </div>
          )}
        </div>

        {/* Search Bar & Export Row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: isRtl ? 14 : 36, paddingRight: isRtl ? 36 : 14, height: 40 }}
                placeholder={isRtl ? "بحث برقم السيريال أو المسجل..." : "Search Serial Number or Registered By..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <Search 
                size={16} 
                style={{ 
                  position: "absolute", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  [isRtl ? "right" : "left"]: 12, 
                  color: "var(--text-muted)" 
                }} 
              />
            </div>
            {searchQuery && (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                style={{ height: 40 }}
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
              >
                {isRtl ? "مسح البحث" : "Clear"}
              </button>
            )}
          </div>

          <button 
            type="button" 
            className="btn btn-sm" 
            style={{ 
              backgroundColor: "#107c41", color: "#ffffff", height: 40, 
              padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 
            }}
            onClick={exportToExcel}
          >
            <FileSpreadsheet size={16} />
            <span>{isRtl ? "تصدير إلى إكسل (Excel)" : "Export to Excel"}</span>
          </button>
        </div>
      </section>

      {/* 3. Statistics Cards */}
      <section className="grid-3" style={{ gap: 16 }}>
        <div className="card" style={{ padding: 18, borderLeft: !isRtl ? "4px solid var(--accent)" : "none", borderRight: isRtl ? "4px solid var(--accent)" : "none" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {isRtl ? "عدد البليتات المسجلة" : "Pallets Registered"}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", marginTop: 4 }}>
            {stats.periodPallets.toLocaleString()} <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)" }}>{isRtl ? "بليت" : "pallets"}</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
            {isRtl ? `في الفترة: ${getActiveFilterLabel()}` : `For: ${getActiveFilterLabel()}`}
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: !isRtl ? "4px solid var(--green)" : "none", borderRight: isRtl ? "4px solid var(--green)" : "none" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {isRtl ? "عدد العدادات الكهربائية (× 160)" : "Electricity Meters (× 160)"}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--green)", marginTop: 4 }}>
            {stats.periodMeters.toLocaleString()} <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--green)" }}>{isRtl ? "عداد" : "meters"}</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
            {isRtl ? "160 عداد لكل بليت مسجل" : "160 meters per registered pallet"}
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: !isRtl ? "4px solid var(--primary, #6366f1)" : "none", borderRight: isRtl ? "4px solid var(--primary, #6366f1)" : "none" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {isRtl ? "الإجمالي الكلي (All-Time)" : "Total All-Time"}
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", marginTop: 4 }}>
            {stats.allPallets.toLocaleString()} {isRtl ? "بليت إجمالي" : "total pallets"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 700, marginTop: 4 }}>
            ⚡ {stats.allMeters.toLocaleString()} {isRtl ? "عداد إجمالي كلي" : "total meters"}
          </div>
        </div>
      </section>

      {/* 4. Table Section */}
      <section className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
            {isRtl ? "السجلات المسجلة" : "Registered Records"}
            {searchQuery && (
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.85rem", marginInlineStart: 8 }}>
                ({isRtl ? `مطابق للبحث: ${filteredRecords.length.toLocaleString()}` : `Showing ${filteredRecords.length.toLocaleString()} matching`})
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {isRtl ? "الأحدث أولاً • Latest records first" : "Latest records first"}
          </div>
        </div>

        <div className="table-responsive" style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: isRtl ? "right" : "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated, #f8fafc)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "12px 14px", width: 60, color: "var(--text-muted)", fontSize: "0.78rem" }}>#</th>
                <th style={{ padding: "12px 14px", fontSize: "0.78rem" }}>{isRtl ? "رقم سيريال البليت" : "Pallet Serial Number"}</th>
                <th style={{ padding: "12px 14px", fontSize: "0.78rem" }}>{isRtl ? "كمية العدادات" : "Meters Quantity"}</th>
                <th style={{ padding: "12px 14px", fontSize: "0.78rem" }}>{isRtl ? "تاريخ التسجيل" : "Registration Date"}</th>
                <th style={{ padding: "12px 14px", fontSize: "0.78rem" }}>{isRtl ? "المسجل بواسطة" : "Registered By"}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                    <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                    <div>{isRtl ? "جاري تحميل السجلات من قاعدة البيانات..." : "Loading records from database..."}</div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
                    <div style={{ fontWeight: 600 }}>
                      {allRecords.length === 0 
                        ? (isRtl ? "لا توجد بليتات مسجلة بعد. استخدم النموذج أعلاه للتسجيل." : "No registered serial numbers found yet. Add one above to begin.")
                        : (isRtl ? `لا توجد بليتات مسجلة في هذه الفترة (${getActiveFilterLabel()}).` : `No pallets registered for this period (${getActiveFilterLabel()}).`)}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const serial = row.serial_number || "—";
                  const date = formatDate(row.registration_date || row.created_at);
                  const operator = row.recorded_by_name || row.recorded_by || "System";

                  return (
                    <tr key={row.id || idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)", fontSize: "0.85rem" }}>
                        {rowNumber}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ 
                          display: "inline-block", padding: "4px 10px", borderRadius: "var(--radius-sm)", 
                          background: "var(--bg-elevated, #f1f5f9)", border: "1px solid var(--border-subtle)", 
                          fontFamily: "var(--font-mono, monospace)", fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" 
                        }}>
                          {serial}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", fontWeight: 700 }}>
                          ⚡ 160 {isRtl ? "عداد" : "meters"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {date}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                        {operator}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRecords.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{isRtl ? "الصفوف بالصفحة:" : "Rows per page:"}</span>
              <select 
                className="input" 
                style={{ height: 32, padding: "0 8px", width: "auto" }}
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                {isRtl 
                  ? `عرض ${Math.min((currentPage - 1) * pageSize + 1, filteredRecords.length)} إلى ${Math.min(currentPage * pageSize, filteredRecords.length)} من إجمالي ${filteredRecords.length.toLocaleString()}`
                  : `Showing ${Math.min((currentPage - 1) * pageSize + 1, filteredRecords.length)} to ${Math.min(currentPage * pageSize, filteredRecords.length)} of ${filteredRecords.length.toLocaleString()}`}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span>{isRtl ? "السابق" : "Prev"}</span>
              </button>

              <span style={{ padding: "0 8px", fontWeight: 700 }}>
                {currentPage} / {totalPages}
              </span>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <span>{isRtl ? "التالي" : "Next"}</span>
                {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
