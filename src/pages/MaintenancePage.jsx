import { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../supabaseClient";
import { 
  Wrench, Calendar, User, Clock, CheckCircle, Plus, AlertCircle, 
  Send, RefreshCw, ChevronLeft, Trash2, Mail, Users, ArrowRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { currentUser, users, language, t } = useApp();
  const isRtl = language === "ar";
  const isAdmin = currentUser?.role === "admin";

  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Admin Scheduling Form states
  const [startDate, setStartDate] = useState(() => {
    // Default to next Sunday
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    return d.toISOString().slice(0, 10);
  });
  const [weeksCount, setWeeksCount] = useState(4);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [manualWeekDate, setManualWeekDate] = useState("");
  const [manualUserId, setManualUserId] = useState("");

  // Simulated Email Logs State
  const [emailLogs, setEmailLogs] = useState(() => {
    const saved = localStorage.getItem("Ectron_Maintenance_EmailLogs");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("Ectron_Maintenance_EmailLogs", JSON.stringify(emailLogs));
  }, [emailLogs]);

  // EmailJS Settings State
  const [emailSettings, setEmailSettings] = useState(() => {
    const saved = localStorage.getItem("Ectron_Maintenance_EmailSettings");
    return saved ? JSON.parse(saved) : { serviceId: "", templateId: "", publicKey: "" };
  });

  const handleUpdateEmailSettings = (key, value) => {
    const updated = { ...emailSettings, [key]: value };
    setEmailSettings(updated);
    localStorage.setItem("Ectron_Maintenance_EmailSettings", JSON.stringify(updated));
  };

  const sendRealEmail = async (recipientName, recipientEmail, subject, message) => {
    if (!emailSettings.serviceId || !emailSettings.templateId || !emailSettings.publicKey) {
      console.log("EmailJS credentials not configured. Falling back to simulation.");
      return { success: false, mode: "simulated" };
    }

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          service_id: emailSettings.serviceId,
          template_id: emailSettings.templateId,
          user_id: emailSettings.publicKey,
          template_params: {
            to_name: recipientName,
            to_email: recipientEmail,
            subject: subject,
            message: message
          }
        })
      });

      if (response.ok) {
        return { success: true, mode: "real" };
      } else {
        const errText = await response.text();
        console.error("EmailJS sending failed:", errText);
        return { success: false, mode: "error", error: errText };
      }
    } catch (err) {
      console.error("EmailJS network error:", err);
      return { success: false, mode: "error", error: err.message };
    }
  };

  // Load schedule
  const loadSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("maintenance_schedule")
        .select("*")
        .order("week_start_date", { ascending: true });

      if (error) {
        // Table probably doesn't exist, use fallback
        console.warn("Supabase maintenance table not found, falling back to local storage:", error.message);
        setIsUsingFallback(true);
        const local = localStorage.getItem("Ectron_Maintenance_Schedule");
        setSchedule(local ? JSON.parse(local) : []);
      } else {
        setSchedule(data || []);
        setIsUsingFallback(false);
      }
    } catch (err) {
      console.error("Failed to fetch maintenance schedule:", err);
      setIsUsingFallback(true);
      const local = localStorage.getItem("Ectron_Maintenance_Schedule");
      setSchedule(local ? JSON.parse(local) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  // Automated background check for weeks that started and have not sent email yet
  useEffect(() => {
    if (loading || !schedule || schedule.length === 0 || !users || users.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    // Find pending slots that have started (week_start_date <= todayStr) and email_sent is not true
    const slotsToRemind = schedule.filter(s => {
      return s.week_start_date <= todayStr && !s.email_sent && s.status === "pending";
    });

    if (slotsToRemind.length === 0) return;

    const runAutoReminders = async () => {
      const newLogs = [];
      let updatedSchedule = [...schedule];
      let hasChanges = false;

      for (const slot of slotsToRemind) {
        const employee = users.find(u => u.employee_id === slot.employee_id);
        if (!employee) continue;

        const email = employee.email || `${employee.employee_id.toLowerCase()}@ectron.com`;
        const fullName = employee.full_name;

        const subject = isRtl 
          ? "تنبيه تلقائي: مهمة الصيانة الأسبوعية الدورية (تبديل مياه الفلتر)" 
          : "Automatic Alert: Weekly Maintenance Task (Filter Water Replacement)";
        const message = isRtl 
          ? `أهلاً ${fullName}، نود تنبيهك بأنك الموظف الموكل للقيام بالمهمة الدورية هذا الأسبوع: (تبديل مياه الفلتر). يرجى القيام بها وتأكيد الإنجاز في لوحة التحكم في نهاية الأسبوع. شكراً لك.`
          : `Hello ${fullName}, this is an automatic reminder that you are scheduled for the periodic maintenance task this week: (Filter Water Replacement). Please perform it and confirm on the dashboard. Thank you.`;

        const emailResult = await sendRealEmail(fullName, email, subject, message);

        const newLog = {
          id: Date.now() + Math.random(),
          sent_at: new Date().toISOString(),
          recipient_name: fullName,
          recipient_email: email,
          subject: subject,
          message: message,
          status: emailResult.success ? "delivered" : emailResult.mode === "simulated" ? "simulated" : "failed",
          error_msg: emailResult.error || null
        };

        newLogs.push(newLog);
        
        updatedSchedule = updatedSchedule.map(s => 
          (s.id === slot.id || s.week_start_date === slot.week_start_date) ? { ...s, email_sent: true } : s
        );
        hasChanges = true;

        if (!isUsingFallback) {
          try {
            const query = supabase.from("maintenance_schedule").update({ email_sent: true });
            if (slot.id) {
              await query.eq("id", slot.id);
            } else {
              await query.eq("week_start_date", slot.week_start_date);
            }
          } catch (err) {
            console.error("Failed to update email_sent on Supabase:", err);
          }
        }
      }

      if (hasChanges) {
        setEmailLogs(prev => [...newLogs, ...prev]);
        if (isUsingFallback) {
          saveScheduleState(updatedSchedule);
        } else {
          setSchedule(updatedSchedule);
        }
      }
    };

    runAutoReminders();
  }, [loading, schedule, users, isUsingFallback, isRtl, emailSettings]);

  // Sync local changes to localstorage if in fallback mode
  const saveScheduleState = async (newSchedule) => {
    setSchedule(newSchedule);
    if (isUsingFallback) {
      localStorage.setItem("Ectron_Maintenance_Schedule", JSON.stringify(newSchedule));
    }
  };

  // Add individual slot
  const handleAddManualSlot = async (e) => {
    e.preventDefault();
    if (!manualWeekDate || !manualUserId) return;

    const selectedEmployee = users.find(u => u.employee_id === manualUserId);
    if (!selectedEmployee) return;

    const newSlot = {
      week_start_date: manualWeekDate,
      employee_id: manualUserId,
      task_name: "تبديل مياه الفلتر",
      status: "pending",
      completed_at: null,
      email_sent: false
    };

    if (isUsingFallback) {
      // Check for duplicate week_start_date in local state
      if (schedule.some(s => s.week_start_date === manualWeekDate)) {
        setErrorMsg(isRtl ? "تمت جدولة هذا الأسبوع بالفعل!" : "This week is already scheduled!");
        return;
      }
      const updated = [...schedule, { ...newSlot, id: Date.now() }].sort(
        (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
      );
      saveScheduleState(updated);
      setSuccessMsg(isRtl ? "تمت إضافة أسبوع الصيانة بنجاح!" : "Maintenance week added successfully!");
      setManualWeekDate("");
      setManualUserId("");
    } else {
      try {
        const { error } = await supabase.from("maintenance_schedule").insert([newSlot]);
        if (error) throw error;
        setSuccessMsg(isRtl ? "تمت إضافة أسبوع الصيانة بنجاح!" : "Maintenance week added successfully!");
        setManualWeekDate("");
        setManualUserId("");
        loadSchedule();
      } catch (err) {
        console.error("Supabase insert error:", err);
        setErrorMsg(err.message || (isRtl ? "حدث خطأ أثناء الحفظ بالسحابة." : "Error saving to cloud."));
      }
    }
  };

  // Auto generate rotation schedule
  const handleGenerateRotation = async () => {
    if (selectedUserIds.length === 0) {
      setErrorMsg(isRtl ? "يرجى تحديد موظف واحد على الأقل للمناوبة!" : "Please select at least one operator for rotation!");
      return;
    }

    setErrorMsg("");
    const generatedSlots = [];
    const baseDate = new Date(startDate);

    for (let i = 0; i < weeksCount; i++) {
      // Calculate start date for this week slot (adding i * 7 days)
      const slotDate = new Date(baseDate);
      slotDate.setDate(baseDate.getDate() + i * 7);
      const slotDateStr = slotDate.toISOString().slice(0, 10);

      // Pick user by rotating through selectedUserIds array index
      const userId = selectedUserIds[i % selectedUserIds.length];

      generatedSlots.push({
        week_start_date: slotDateStr,
        employee_id: userId,
        task_name: "تبديل مياه الفلتر",
        status: "pending",
        completed_at: null,
        email_sent: false
      });
    }

    if (isUsingFallback) {
      // Filter out weeks that already exist locally, then append
      const existingDates = new Set(schedule.map(s => s.week_start_date));
      const filteredNew = generatedSlots.map((s, idx) => ({ ...s, id: Date.now() + idx })).filter(
        s => !existingDates.has(s.week_start_date)
      );
      
      const updated = [...schedule, ...filteredNew].sort(
        (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
      );
      saveScheduleState(updated);
      setSuccessMsg(isRtl ? `تم توليد جدول المناوبات بنجاح لـ ${filteredNew.length} أسابيع!` : `Generated rotation schedule successfully for ${filteredNew.length} weeks!`);
      setSelectedUserIds([]);
    } else {
      try {
        const { error } = await supabase.from("maintenance_schedule").insert(generatedSlots);
        if (error) throw error;
        setSuccessMsg(isRtl ? "تم توليد وتنزيل جدول المناوبات سحابياً!" : "Rotation schedule generated and saved to cloud!");
        setSelectedUserIds([]);
        loadSchedule();
      } catch (err) {
        console.error("Supabase batch insert error:", err);
        setErrorMsg(err.message || (isRtl ? "حدث خطأ أثناء الحفظ بالسحابة." : "Error saving to cloud."));
      }
    }
  };

  // Complete task
  const handleCompleteTask = async (id, week_start_date) => {
    const now = new Date().toISOString();
    
    if (isUsingFallback) {
      const updated = schedule.map(s => 
        s.id === id ? { ...s, status: "completed", completed_at: now } : s
      );
      saveScheduleState(updated);
      setSuccessMsg(isRtl ? "تم تسجيل إكمال المهمة بنجاح!" : "Task marked as completed successfully!");
    } else {
      try {
        const { error } = await supabase
          .from("maintenance_schedule")
          .update({ status: "completed", completed_at: now })
          .eq("id", id);
        
        if (error) throw error;
        setSuccessMsg(isRtl ? "تم تسجيل إكمال المهمة بنجاح!" : "Task marked as completed successfully!");
        loadSchedule();
      } catch (err) {
        console.error("Supabase update error:", err);
        setErrorMsg(err.message || (isRtl ? "حدث خطأ أثناء التحديث." : "Error updating task status."));
      }
    }
  };

  // Delete slot
  const handleDeleteSlot = async (id) => {
    if (!window.confirm(isRtl ? "هل أنت متأكد من حذف هذا الأسبوع؟" : "Are you sure you want to delete this week?")) return;

    if (isUsingFallback) {
      const updated = schedule.filter(s => s.id !== id);
      saveScheduleState(updated);
      setSuccessMsg(isRtl ? "تم الحذف بنجاح!" : "Deleted successfully!");
    } else {
      try {
        const { error } = await supabase.from("maintenance_schedule").delete().eq("id", id);
        if (error) throw error;
        setSuccessMsg(isRtl ? "تم الحذف بنجاح!" : "Deleted successfully!");
        loadSchedule();
      } catch (err) {
        console.error("Supabase delete error:", err);
        setErrorMsg(err.message);
      }
    }
  };

  // Send Email Reminder
  const handleSendReminder = async (slot) => {
    const employee = users.find(u => u.employee_id === slot.employee_id);
    if (!employee) return;

    const email = employee.email || `${employee.employee_id.toLowerCase()}@ectron.com`;
    const fullName = employee.full_name;

    const subject = isRtl 
      ? "تذكير: مهمة الصيانة الأسبوعية الدورية (تبديل مياه الفلتر)" 
      : "Reminder: Weekly Maintenance Task (Filter Water Replacement)";
    const message = isRtl 
      ? `أهلاً ${fullName}، نود تذكيرك بأنك الموظف الموكل للقيام بالمهمة الدورية هذا الأسبوع: (تبديل مياه الفلتر). يرجى القيام بها وتأكيد الإنجاز في لوحة التحكم في نهاية الأسبوع. شكراً لك.`
      : `Hello ${fullName}, this is a reminder that you are scheduled for the periodic maintenance task this week: (Filter Water Replacement). Please perform it and confirm on the dashboard before the week ends. Thank you.`;

    const emailResult = await sendRealEmail(fullName, email, subject, message);

    const newLog = {
      id: Date.now(),
      sent_at: new Date().toISOString(),
      recipient_name: fullName,
      recipient_email: email,
      subject: subject,
      message: message,
      status: emailResult.success ? "delivered" : emailResult.mode === "simulated" ? "simulated" : "failed",
      error_msg: emailResult.error || null
    };

    setEmailLogs(prev => [newLog, ...prev]);

    if (emailResult.success) {
      setSuccessMsg(isRtl ? `تم إرسال إيميل حقيقي بنجاح إلى ${fullName}!` : `Real email sent successfully to ${fullName}!`);
    } else if (emailResult.mode === "simulated") {
      setSuccessMsg(isRtl ? `تمت محاكاة إرسال الإيميل بنجاح إلى ${fullName} (اضبط إعدادات EmailJS للإرسال الحقيقي)!` : `Email sending simulated for ${fullName} (Configure EmailJS settings for real delivery)!`);
    } else {
      setErrorMsg(isRtl ? `فشل إرسال الإيميل: ${emailResult.error}` : `Failed to send email: ${emailResult.error}`);
    }

    // Update email_sent status locally/globally
    const updatedSchedule = schedule.map(s => 
      (s.id === slot.id || s.week_start_date === slot.week_start_date) ? { ...s, email_sent: true } : s
    );

    if (isUsingFallback) {
      saveScheduleState(updatedSchedule);
    } else {
      try {
        const query = supabase.from("maintenance_schedule").update({ email_sent: true });
        if (slot.id) {
          await query.eq("id", slot.id);
        } else {
          await query.eq("week_start_date", slot.week_start_date);
        }
        setSchedule(updatedSchedule);
      } catch (err) {
        console.error("Supabase update error:", err);
      }
    }

    // Standard mailto fallback trigger to show it "opens" or simulates
    console.log("SIMULATED EMAIL SENDING:", newLog);
  };

  // Clear success/error banners after 4 seconds
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(""), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(""), 4000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  const toggleUserSelection = (id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper formatting dates
  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const end = new Date(d);
    end.setDate(d.getDate() + 6);

    const options = { month: "short", day: "numeric" };
    if (isRtl) {
      return `${d.toLocaleDateString("ar-SA", options)} – ${end.toLocaleDateString("ar-SA", options)}`;
    } else {
      return `${d.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}`;
    }
  };

  // Get active week slot (the week slot corresponding to current date)
  const activeWeekSlot = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return schedule.find(s => {
      const start = new Date(s.week_start_date + "T00:00:00");
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return today >= start && today < end;
    });
  }, [schedule]);

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
              <ArrowRight size={15} style={{ transform: isRtl ? "none" : "rotate(180deg)" }} /> {isRtl ? "العودة للرئيسية" : "Back to Home"}
            </button>
            <div>
              <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wrench size={24} style={{ color: "var(--accent)" }} />
                {isRtl ? "جدول الصيانة الدورية" : "Periodic Maintenance Schedule"}
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>
                {isRtl ? "إدارة المهام الدورية الدائرية وتكليف الموظفين وتنبيهات الإيميل" : "Manage repeating maintenance rhotas, employee assignments, and email alerts"}
              </p>
            </div>
          </div>
        </div>

        {/* Info banners */}
        {isUsingFallback && isAdmin && (
          <div className="alert alert-info" style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>{isRtl ? "💡 وضع الحفظ المحلي نشط" : "💡 Local Storage Mode Active"}</strong>
              <p style={{ fontSize: "0.8rem", color: "#166534", marginTop: 4 }}>
                {isRtl 
                  ? "قاعدة البيانات السحابية (Supabase) لا تحتوي على جدول الصيانة بعد. يتم الحفظ حالياً محلياً في المتصفح. لتمكين الحفظ السحابي، يرجى تشغيل كود إنشاء الجدول في محرّر SQL المرفق بملخص التغييرات."
                  : "The Supabase database does not have the maintenance table yet. Data is currently stored locally in your browser. To store it in the cloud, please run the SQL creation commands in your Supabase console."}
              </p>
            </div>
          </div>
        )}

        {successMsg && <div className="alert alert-success animate-fade">{successMsg}</div>}
        {errorMsg && <div className="alert alert-danger animate-fade">{errorMsg}</div>}

        {/* Active Week Banner */}
        {activeWeekSlot && (
          <div className="card animate-fade" style={{ 
            background: "linear-gradient(135deg, #0f172a, #1e293b)", 
            color: "white", 
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "24px 30px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18 }}>
              <div>
                <span className="badge badge-green" style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", marginBottom: 8 }}>
                  🔔 {isRtl ? "مكلف هذا الأسبوع" : "Active Rota This Week"}
                </span>
                <h2 style={{ color: "white", fontSize: "1.4rem" }}>{activeWeekSlot.task_name}</h2>
                <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: "0.85rem", color: "#94a3b8", flexWrap: "wrap" }}>
                  <span>📅 {formatDateLabel(activeWeekSlot.week_start_date)}</span>
                  <span>•</span>
                  <span>👤 {users.find(u => u.employee_id === activeWeekSlot.employee_id)?.full_name || activeWeekSlot.employee_id}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {activeWeekSlot.employee_id === currentUser?.employee_id && activeWeekSlot.status === "pending" && (
                  <button className="btn btn-primary" onClick={() => handleCompleteTask(activeWeekSlot.id, activeWeekSlot.week_start_date)} style={{ background: "#22c55e", borderColor: "#22c55e", color: "white", fontWeight: 800 }}>
                    <CheckCircle size={16} /> {isRtl ? "تأكيد إكمال المهمة" : "Confirm Task Done"}
                  </button>
                )}
                {activeWeekSlot.status === "completed" && (
                  <span className="badge badge-green" style={{ fontSize: "0.9rem", padding: "8px 16px" }}>
                    ✓ {isRtl ? "تم الإنجاز" : "Completed"}
                  </span>
                )}
                {isAdmin && (
                  <button className="btn btn-secondary" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }} onClick={() => handleSendReminder(activeWeekSlot)}>
                    <Mail size={16} /> {isRtl ? "أرسل إيميل تذكيري" : "Send Mail Reminder"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid-3" style={{ gridTemplateColumns: isAdmin ? "2fr 1fr" : "1fr", alignItems: "start" }}>
          
          {/* Rota List Container */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: 0 }}>📅 {isRtl ? "جدول التناوب والمناوبات الأسبوعية" : "Weekly Rotation Schedule"}</h3>
            
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><span className="spinner"></span></div>
            ) : schedule.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                <Calendar size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p>{isRtl ? "لا توجد مناوبات مجدولة بعد." : "No maintenance shifts scheduled yet."}</p>
                {isAdmin && <p style={{ fontSize: "0.8rem", marginTop: 4 }}>{isRtl ? "استخدم لوحة الملحقات الجانبية لتوليد جدول المناوبات!" : "Use the sidebar scheduler to generate the rotation!"}</p>}
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الأسبوع" : "Week Range"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الموظف المسؤول" : "Responsible Employee"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "المهمة الدورية" : "Periodic Task"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الحالة" : "Status"}</th>
                      <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map(slot => {
                      const emp = users.find(u => u.employee_id === slot.employee_id);
                      const isAssignedToMe = slot.employee_id === currentUser?.employee_id;
                      const dateObj = new Date(slot.week_start_date + "T00:00:00");
                      const now = new Date();
                      now.setHours(0,0,0,0);
                      const isPast = now > new Date(dateObj.getTime() + 7 * 86400000);

                      return (
                        <tr key={slot.id || slot.week_start_date} style={activeWeekSlot?.id === slot.id ? { background: "rgba(26,127,55,0.05)", fontWeight: 700 } : {}}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span>{formatDateLabel(slot.week_start_date)}</span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{slot.week_start_date}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ 
                                width: 26, height: 26, borderRadius: "50%", 
                                background: "linear-gradient(135deg, #10b981, #0550ae)", 
                                color: "white", display: "flex", alignItems: "center", justifyContent: "center", 
                                fontSize: "0.65rem", fontWeight: 800 
                              }}>
                                {emp?.full_name ? emp.full_name.split(" ").slice(0,2).map(w=>w[0]).join("") : "??"}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "0.85rem" }}>{emp?.full_name || slot.employee_id}</span>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{slot.employee_id}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>{slot.task_name}</span>
                          </td>
                          <td>
                            {slot.status === "completed" ? (
                              <span className="badge badge-green">✓ {isRtl ? "تم الإنجاز" : "Completed"}</span>
                            ) : isPast ? (
                              <span className="badge badge-red">{isRtl ? "فائتة" : "Missed"}</span>
                            ) : (
                              <span className="badge badge-amber">{isRtl ? "قيد الانتظار" : "Pending"}</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {isAssignedToMe && slot.status === "pending" && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleCompleteTask(slot.id, slot.week_start_date)} style={{ background: "#22c55e", borderColor: "#22c55e" }}>
                                  {isRtl ? "إنجاز" : "Done"}
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleSendReminder(slot)} title={isRtl ? "إرسال إيميل تذكيري" : "Send Reminder Email"}>
                                    <Send size={13} style={{ color: "var(--blue)" }} />
                                  </button>
                                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteSlot(slot.id)} style={{ color: "var(--red)" }} title={isRtl ? "حذف" : "Delete"}>
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Admin Scheduler Sidebar (Admins Only) */}
          {isAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Auto Generator */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: "1.1rem" }}>
                  <Users size={18} style={{ color: "var(--accent)" }} />
                  {isRtl ? "توليد تناوب موظفين تلقائي" : "Auto Rotation Generator"}
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {isRtl ? "حدد قائمة الموظفين وتاريخ البداية لتوليد جدول مناوبات تلقائي بالترتيب." : "Select employees and a start date to generate a rotating weekly assignment schedule automatically."}
                </p>

                <div className="input-group">
                  <label className="input-label">{isRtl ? "تاريخ البداية (الأحد)" : "Start Date (Sunday)"}</label>
                  <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>

                <div className="input-group">
                  <label className="input-label">{isRtl ? "عدد الأسابيع لتوليدها" : "Weeks to Generate"}</label>
                  <select className="input" value={weeksCount} onChange={e => setWeeksCount(parseInt(e.target.value))}>
                    <option value={4}>{isRtl ? "4 أسابيع (شهر)" : "4 Weeks"}</option>
                    <option value={8}>{isRtl ? "8 أسابيع (شهرين)" : "8 Weeks"}</option>
                    <option value={12}>{isRtl ? "12 أسبوع (3 أشهر)" : "12 Weeks"}</option>
                    <option value={24}>{isRtl ? "24 أسبوع (6 أشهر)" : "24 Weeks"}</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">{isRtl ? "اختر الموظفين المدرجين في التدوير *" : "Select Operators for Rotation *"}</label>
                  <div style={{ 
                    maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", 
                    borderRadius: "var(--radius-md)", padding: "8px 12px", background: "var(--bg-elevated)",
                    display: "flex", flexDirection: "column", gap: 8
                  }}>
                    {users.filter(u => u.role !== "admin").map(u => (
                      <label key={u.employee_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedUserIds.includes(u.employee_id)} 
                          onChange={() => toggleUserSelection(u.employee_id)}
                        />
                        <span>{u.full_name} ({u.employee_id})</span>
                      </label>
                    ))}
                    {users.filter(u => u.role !== "admin").length === 0 && (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>{isRtl ? "لا يوجد مشغلين مسجلين" : "No operators registered"}</span>
                    )}
                  </div>
                </div>

                <button className="btn btn-primary" onClick={handleGenerateRotation} style={{ width: "100%", marginTop: 4 }}>
                  <RefreshCw size={15} /> {isRtl ? "توليد وتوزيع المناوبات" : "Distribute & Generate Rota"}
                </button>
              </div>

              {/* Manual Week Adder */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: "1.1rem" }}>
                  <Plus size={18} style={{ color: "var(--blue)" }} />
                  {isRtl ? "إضافة أسبوع فردي يدوي" : "Add Single Week Slot"}
                </h3>
                <form onSubmit={handleAddManualSlot} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="input-group">
                    <label className="input-label">{isRtl ? "تاريخ بداية الأسبوع (الأحد) *" : "Week Start Date (Sunday) *"}</label>
                    <input type="date" className="input" value={manualWeekDate} onChange={e => setManualWeekDate(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{isRtl ? "الموظف المكلف *" : "Assign Employee *"}</label>
                    <select className="input" value={manualUserId} onChange={e => setManualUserId(e.target.value)} required>
                      <option value="">{isRtl ? "-- اختر موظفاً --" : "-- Select Employee --"}</option>
                      {users.map(u => (
                        <option key={u.employee_id} value={u.employee_id}>{u.full_name} ({u.employee_id})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: "100%" }}>
                    <Plus size={14} /> {isRtl ? "إضافة الأسبوع" : "Add Week Slot"}
                  </button>
                </form>
              </div>

              {/* Simulated Email Reminder Logs */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: "1.1rem" }}>
                    <Mail size={18} style={{ color: "var(--purple)" }} />
                    {isRtl ? "سجل إيميلات التنبيه" : "Email Reminder Logs"}
                  </h3>
                  {emailLogs.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEmailLogs([])} style={{ padding: 4, color: "var(--red)" }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ 
                  maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8,
                  border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 8,
                  background: "var(--bg-elevated)"
                }}>
                  {emailLogs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      {isRtl ? "لا توجد تنبيهات مرسلة بعد" : "No reminders sent yet"}
                    </div>
                  ) : (
                    emailLogs.map(log => (
                      <div key={log.id} style={{ 
                        background: "var(--bg-surface)", padding: 10, borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 4,
                        fontSize: "0.75rem"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontWeight: 700 }}>
                          <span>To: {log.recipient_name}</span>
                          <span className="badge badge-green" style={{ fontSize: "0.6rem", padding: "1px 6px" }}>Sent</span>
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{log.recipient_email}</div>
                        <div style={{ fontWeight: 600, color: "var(--accent)", marginTop: 2 }}>{log.subject}</div>
                        <div style={{ color: "var(--text-secondary)", marginTop: 2, borderTop: "1px dashed var(--border-subtle)", paddingTop: 4, fontStyle: "italic" }}>
                          "{log.message.slice(0, 75)}..."
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", alignSelf: "flex-end", marginTop: 2 }}>
                          {new Date(log.sent_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
