import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { translations } from "../utils/translations";
import { supabase } from "../supabaseClient";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [language, setLanguage]             = useState(() => localStorage.getItem("SmartMeter_Language") || "ar");
  const [currentUser, setCurrentUser]       = useState(() => {
    const saved = localStorage.getItem("SmartMeter_UserSession");
    if (saved) {
      try {
        const { user, expiresAt } = JSON.parse(saved);
        if (Date.now() < expiresAt) {
          return user;
        } else {
          localStorage.removeItem("SmartMeter_UserSession");
        }
      } catch (e) {
        console.error("Error reading session:", e);
      }
    }
    return null;
  });
  
  // All state is now initialized to empty arrays, strictly relying on Supabase
  const [users, setUsers]                   = useState([]);
  const [shiftTypes, setShiftTypes]         = useState([]);
  const [schedules, setSchedules]           = useState([]);
  const [productionStages, setProductionStages] = useState([]);
  const [errorCodes, setErrorCodes]           = useState([]);
  const [defectiveMeters, setDefectiveMeters] = useState([]);
  const [equipmentStock, setEquipmentStock] = useState([]);
  const [equipmentHandouts, setEquipmentHandouts] = useState([]);
  const [defectLogs, setDefectLogs]         = useState([]);
  const [boxes, setBoxes]                   = useState([]);
  
  const [loginError, setLoginError]         = useState("");
  const [isLoading, setIsLoading]           = useState(true);

  // Sync language with HTML document attributes (dir and lang)
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  // Load ALL data exclusively from Supabase
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        
        const fetchLogsPromise = supabase.from("defect_logs").select("*").order("created_at", { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.warn("defect_logs table might not exist yet:", error.message);
              return { data: null };
            }
            return { data };
          })
          .catch(() => ({ data: null }));

        // Fetch all data in parallel for speed
        const [
          { data: uData },
          { data: stgData },
          { data: errData },
          { data: schData },
          { data: defData },
          { data: eqData },
          { data: hoData },
          { data: shiftData },
          { data: logsData },
          { data: bxData }
        ] = await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("production_stages").select("*"),
          supabase.from("error_codes").select("*"),
          supabase.from("schedules").select("*"),
          supabase.from("defective_meters").select("*"),
          supabase.from("equipment_stock").select("*"),
          supabase.from("equipment_handouts").select("*"),
          supabase.from("shift_types").select("*"),
          fetchLogsPromise,
          supabase.from("boxes").select("*").then(({ data, error }) => {
            if (error) {
              console.warn("boxes table might not exist yet:", error.message);
              return { data: [] };
            }
            return { data };
          }).catch(() => ({ data: [] }))
        ]);

        if (uData) setUsers(uData);
        if (stgData) setProductionStages(stgData);
        if (errData) setErrorCodes(errData);
        if (schData) setSchedules(schData);
        if (defData) {
          const now = Date.now();
          const FIVE_MINUTES = 5 * 60 * 1000;
          const expiredIds = [];
          const validMeters = defData.filter(m => {
            if (m.status === "resolved" && m.resolved_at) {
              const age = now - new Date(m.resolved_at).getTime();
              if (age >= FIVE_MINUTES) {
                expiredIds.push(m.id);
                return false;
              }
            }
            return true;
          });
          setDefectiveMeters(validMeters);
          
          if (expiredIds.length > 0) {
            supabase.from("defective_meters").delete().in("id", expiredIds).then(({ error }) => {
              if (error) console.error("Error cleaning up expired meters on load:", error);
            });
          }
        }
        if (eqData) setEquipmentStock(eqData);
        if (hoData) setEquipmentHandouts(hoData);
        if (shiftData) setShiftTypes(shiftData);
        if (bxData) setBoxes(bxData);
        
        if (logsData) {
          setDefectLogs(logsData);
        } else {
          try {
            const cached = localStorage.getItem("SmartMeter_DefectLogs");
            if (cached) setDefectLogs(JSON.parse(cached));
          } catch (e) {}
        }

      } catch (err) {
        console.error("Error loading data from Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Supabase Realtime Subscriptions
  useEffect(() => {
    // 1. Subscribe to defective_meters changes
    const defectiveMetersChannel = supabase
      .channel("realtime-defective-meters")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "defective_meters" },
        (payload) => {
          console.log("Realtime change received for defective_meters:", payload);
          if (payload.eventType === "INSERT") {
            setDefectiveMeters(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setDefectiveMeters(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          } else if (payload.eventType === "DELETE") {
            setDefectiveMeters(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 2. Subscribe to boxes changes
    const boxesChannel = supabase
      .channel("realtime-boxes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boxes" },
        (payload) => {
          console.log("Realtime change received for boxes:", payload);
          if (payload.eventType === "INSERT") {
            setBoxes(prev => {
              if (prev.some(b => b.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "UPDATE") {
            setBoxes(prev => prev.map(b => b.id === payload.new.id ? payload.new : b));
          } else if (payload.eventType === "DELETE") {
            setBoxes(prev => prev.filter(b => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 3. Subscribe to defect_logs changes
    const defectLogsChannel = supabase
      .channel("realtime-defect-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "defect_logs" },
        (payload) => {
          console.log("Realtime change received for defect_logs:", payload);
          if (payload.eventType === "INSERT") {
            setDefectLogs(prev => {
              if (prev.some(l => l.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setDefectLogs(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
          } else if (payload.eventType === "DELETE") {
            setDefectLogs(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(defectiveMetersChannel);
      supabase.removeChannel(boxesChannel);
      supabase.removeChannel(defectLogsChannel);
    };
  }, []);

  // Sync cached session with latest Supabase user details
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const dbUser = users.find(u => u.employee_id === currentUser.employee_id);
      if (dbUser) {
        if (dbUser.role !== currentUser.role || dbUser.full_name !== currentUser.full_name || dbUser.password_hash !== currentUser.password_hash) {
          setCurrentUser(dbUser);
          const saved = localStorage.getItem("SmartMeter_UserSession");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              parsed.user = dbUser;
              localStorage.setItem("SmartMeter_UserSession", JSON.stringify(parsed));
            } catch (e) {}
          }
        }
      }
    }
  }, [users, currentUser]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next = prev === "ar" ? "en" : "ar";
      localStorage.setItem("SmartMeter_Language", next);
      return next;
    });
  }, []);

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations["ar"]?.[key] || key;
  }, [language]);

  // ── Date and Time Helpers ─────────────────────────────
  const getTodayString = useCallback(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const getCurrentShift = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 6 && hours < 14) return "SHIFT-M";
    if (hours >= 14 && hours < 22) return "SHIFT-E";
    return "SHIFT-N";
  }, []);

  // ── Auth ─────────────────────────────────────────────
  const login = useCallback(async (employee_id, password) => {
    const user = users.find(
      u => u.employee_id === employee_id && u.password_hash === password
    );
    if (user) { 
      setCurrentUser(user); 
      setLoginError(""); 
      const expiryTime = Date.now() + 4 * 60 * 60 * 1000; // 4 hours session expiration
      localStorage.setItem("SmartMeter_UserSession", JSON.stringify({ user, expiresAt: expiryTime }));
      return true; 
    }
    setLoginError(language === "ar" ? "بيانات الدخول غير صحيحة. تحقق من الرقم الوظيفي وكلمة المرور." : "Invalid login credentials.");
    return false;
  }, [users, language]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("SmartMeter_UserSession");
  }, []);

  const changePassword = useCallback(async (employee_id, newPassword) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ password_hash: newPassword, must_change_password: false })
        .eq("employee_id", employee_id);
      if (error) throw error;
      
      // Update local state 'users'
      setUsers(prev => prev.map(u => u.employee_id === employee_id ? { ...u, password_hash: newPassword, must_change_password: false } : u));
      
      // Update local state 'currentUser'
      setCurrentUser(prev => {
        if (prev?.employee_id === employee_id) {
          const updated = { ...prev, password_hash: newPassword, must_change_password: false };
          const saved = localStorage.getItem("SmartMeter_UserSession");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              parsed.user = updated;
              localStorage.setItem("SmartMeter_UserSession", JSON.stringify(parsed));
            } catch (e) {}
          }
          return updated;
        }
        return prev;
      });
      return { success: true };
    } catch (err) {
      console.error("Supabase change password error:", err);
      return { success: false, message: err.message || "Error changing password." };
    }
  }, []);

  // ── Users management ──────────────────────────────────
  const addUser = useCallback(async (userData) => {
    const newUser = {
      employee_id: userData.employee_id.trim().toUpperCase(),
      full_name:   userData.full_name.trim(),
      role:        userData.role,
      password_hash: userData.password,
      must_change_password: true,
      phone:       userData.phone?.trim() || null,
      email:       userData.email?.trim() || null,
    };

    try {
      const { error } = await supabase.from("users").insert([newUser]);
      if (error) throw error;
      setUsers(prev => [...prev, newUser]);
      return newUser;
    } catch (err) {
      console.error("Supabase insert user error:", err);
      return null;
    }
  }, []);

  const updateUserRole = useCallback(async (employee_id, newRole) => {
    try {
      const { error } = await supabase.from("users").update({ role: newRole }).eq("employee_id", employee_id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.employee_id === employee_id ? { ...u, role: newRole } : u));
      if (currentUser?.employee_id === employee_id) {
        setCurrentUser(prev => {
          const updated = { ...prev, role: newRole };
          const saved = localStorage.getItem("SmartMeter_UserSession");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              parsed.user = updated;
              localStorage.setItem("SmartMeter_UserSession", JSON.stringify(parsed));
            } catch (e) {}
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Supabase update role error:", err);
    }
  }, [currentUser]);

  const deleteUser = useCallback(async (employee_id) => {
    try {
      const { error } = await supabase.from("users").delete().eq("employee_id", employee_id);
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.employee_id !== employee_id));
      setSchedules(prev => prev.filter(s => s.employee_id !== employee_id));
    } catch (err) {
      console.error("Supabase delete user error:", err);
    }
  }, []);

  const updateUser = useCallback(async (employee_id, updatedFields) => {
    try {
      const { error } = await supabase.from("users").update(updatedFields).eq("employee_id", employee_id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.employee_id === employee_id ? { ...u, ...updatedFields } : u));
      if (currentUser?.employee_id === employee_id) {
        setCurrentUser(prev => {
          const updated = { ...prev, ...updatedFields };
          const saved = localStorage.getItem("SmartMeter_UserSession");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              parsed.user = updated;
              localStorage.setItem("SmartMeter_UserSession", JSON.stringify(parsed));
            } catch (err) {
              console.error("Session sync failed:", err);
            }
          }
          return updated;
        });
      }
      return { success: true };
    } catch (err) {
      console.error("Supabase update user error:", err);
      return { success: false, error: err.message || "Error updating user." };
    }
  }, [currentUser]);

  // ── Schedule management ───────────────────────────────
  const todaySchedule = currentUser
    ? schedules.find(s => {
        const today = getTodayString();
        const csId = getCurrentShift();
        return s.employee_id === currentUser.employee_id &&
               s.schedule_date === today &&
               s.shift_id === csId;
      }) || schedules.find(s =>
        s.employee_id === currentUser.employee_id && s.schedule_date === getTodayString()
      )
    : null;

  const upcomingSchedule = currentUser
    ? (() => {
        const result = [];
        for (let i = 0; i < 5; i++) {
          const d = new Date(); d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split("T")[0];
          result.push(...schedules.filter(s => s.employee_id === currentUser.employee_id && s.schedule_date === dateStr));
        }
        return result;
      })()
    : [];

  const currentStage = todaySchedule
    ? productionStages.find(s => s.stage_id === todaySchedule.stage_id)
    : null;

  const currentShift = currentUser
    ? (todaySchedule
        ? shiftTypes.find(s => s.shift_id === todaySchedule.shift_id)
        : shiftTypes.find(s => s.shift_id === getCurrentShift()))
    : null;

  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === "supervisor") {
      if (todaySchedule && todaySchedule.stage_id !== "SUPERVISION") {
        return { ...currentUser, role: "operator" };
      }
    }
    return currentUser;
  }, [currentUser, todaySchedule]);

  // ── Rotation schedule generator ───────────────────────
  const generateRotationSchedule = useCallback(({
    shift_id, startDate, numDays, initialAssignments, rotationOffset, teamLeaders, shiftSupervisor
  }) => {
    const slots = [];
    productionStages.forEach((stage) => {
      const assigned = initialAssignments[stage.stage_id] || [];
      assigned.forEach((empId) => {
        slots.push({ stage_id: stage.stage_id, employee_id: empId });
      });
    });

    if (slots.length === 0) return [];

    const employeeIds = slots.map(s => s.employee_id);
    const entries = [];
    let counter = Date.now(); 

    for (let day = 0; day < numDays; day++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + day);
      const dateStr = d.toISOString().split("T")[0];

      slots.forEach((slot, slotIdx) => {
        const personIdx = (slotIdx - day * rotationOffset) % employeeIds.length;
        const normalizedPersonIdx = personIdx < 0 ? personIdx + employeeIds.length : personIdx;
        
        const employee_id = employeeIds[normalizedPersonIdx];
        const is_team_leader = teamLeaders[slot.stage_id] === employee_id;

        entries.push({
          id: `SCH-GEN-${counter++}`,
          schedule_date: dateStr,
          shift_id,
          employee_id,
          stage_id: slot.stage_id,
          is_team_leader,
          is_supervisor: false,
        });
      });

      if (shiftSupervisor) {
        entries.push({
          id: `SCH-GEN-SUP-${counter++}`,
          schedule_date: dateStr,
          shift_id,
          employee_id: shiftSupervisor,
          stage_id: "SUPERVISION",
          is_team_leader: false,
          is_supervisor: true
        });
      }
    }
    return entries;
  }, [productionStages]);

  const saveGeneratedSchedule = useCallback(async (entries) => {
    if (entries.length === 0) return { success: true };
    
    const newKeys = new Set(entries.map(e => `${e.schedule_date}__${e.shift_id}`));
    const dates = [...new Set(entries.map(e => e.schedule_date))];
    const shiftIds = [...new Set(entries.map(e => e.shift_id))];
    
    try {
      // 1. Delete all existing schedule entries for these dates and shifts in batch
      const { error: deleteError } = await supabase.from("schedules")
        .delete()
        .in("schedule_date", dates)
        .in("shift_id", shiftIds);
        
      if (deleteError) throw deleteError;

      // 2. Insert all new entries in a single batch insert query
      const { error: insertError } = await supabase.from("schedules")
        .insert(entries);
        
      if (insertError) throw insertError;
      
      setSchedules(prev => {
        const filtered = prev.filter(s => !newKeys.has(`${s.schedule_date}__${s.shift_id}`));
        return [...filtered, ...entries];
      });
      return { success: true };
    } catch (err) {
      console.error("Supabase schedules insert error:", err);
      return { success: false, error: err };
    }
  }, []);

  const saveEditedSchedule = useCallback(async (date, shiftId, entries) => {
    try {
      // 1. Fetch the original created_at timestamp for these entries
      const { data: oldEntries, error: fetchError } = await supabase
        .from("schedules")
        .select("created_at")
        .eq("schedule_date", date)
        .eq("shift_id", shiftId)
        .limit(1);

      if (fetchError) throw fetchError;

      const originalCreatedAt = oldEntries && oldEntries.length > 0
        ? oldEntries[0].created_at
        : new Date().toISOString();

      const now = new Date().toISOString();

      // Prepare entries with correct created_at and updated_at
      const entriesToInsert = entries.map(e => ({
        ...e,
        created_at: originalCreatedAt,
        updated_at: now
      }));

      // 2. Delete all existing schedule entries for this date and shift
      const { error: deleteError } = await supabase
        .from("schedules")
        .delete()
        .eq("schedule_date", date)
        .eq("shift_id", shiftId);

      if (deleteError) throw deleteError;

      // 3. Insert the new entries
      if (entriesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("schedules")
          .insert(entriesToInsert);

        if (insertError) throw insertError;
      }

      // 4. Update the local state
      setSchedules(prev => {
        const filtered = prev.filter(s => !(s.schedule_date === date && s.shift_id === shiftId));
        return [...filtered, ...entriesToInsert];
      });

      return { success: true };
    } catch (err) {
      console.error("Supabase edit schedule error:", err);
      return { success: false, error: err };
    }
  }, []);

  const deleteScheduleEntry = useCallback(async (id) => {
    try {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Supabase schedule delete error:", err);
    }
  }, []);

  const clearScheduleByDate = useCallback(async (date) => {
    try {
      const { error } = await supabase.from("schedules").delete().eq("schedule_date", date);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.schedule_date !== date));
    } catch (err) {
      console.error("Supabase schedule clear error:", err);
    }
  }, []);

  // ── Production Stages management ─────────────────────
  const addStage = useCallback(async (stageData) => {
    const newStage = {
      stage_id: stageData.stage_id.trim().toUpperCase(),
      stage_name: stageData.stage_name.trim(),
      short_name: stageData.short_name.trim(),
      icon: stageData.icon || "⚙️",
      color: stageData.color || "#6366f1",
      instructions: stageData.instructions || [],
      troubleshooting: stageData.troubleshooting || [],
      overview: stageData.overview || "",
      importance: stageData.importance || "",
      functions: stageData.functions || [],
    };

    try {
      const { error } = await supabase.from("production_stages").insert([newStage]);
      if (error) throw error;
      setProductionStages(prev => [...prev, newStage]);
    } catch (err) {
      console.error("Supabase stage add error:", err);
    }
  }, []);

  const updateStage = useCallback(async (stage_id, updatedData) => {
    try {
      const { error } = await supabase.from("production_stages").update(updatedData).eq("stage_id", stage_id);
      if (error) throw error;
      setProductionStages(prev => prev.map(s => s.stage_id === stage_id ? { ...s, ...updatedData } : s));
    } catch (err) {
      console.error("Supabase stage update error:", err);
    }
  }, []);

  const deleteStage = useCallback(async (stage_id) => {
    try {
      const { error } = await supabase.from("production_stages").delete().eq("stage_id", stage_id);
      if (error) throw error;
      setProductionStages(prev => prev.filter(s => s.stage_id !== stage_id));
      setSchedules(prev => prev.filter(s => s.stage_id !== stage_id));
    } catch (err) {
      console.error("Supabase stage delete error:", err);
    }
  }, []);

  const addDefectLog = useCallback(async (log) => {
    const payload = {
      defect_id: log.defect_id,
      serial_number: log.serial_number,
      action_type: log.action_type,
      old_status: log.old_status || null,
      new_status: log.new_status || null,
      performed_by: log.performed_by || currentUser?.employee_id || "System",
      performed_by_name: log.performed_by_name || currentUser?.full_name || "System"
    };

    try {
      const { data, error } = await supabase.from("defect_logs").insert([payload]).select().single();
      if (error) throw error;
      setDefectLogs(prev => [data, ...prev]);
    } catch (err) {
      console.warn("Supabase defect log insert failed, saving locally:", err.message);
      const localLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        ...payload,
        created_at: new Date().toISOString()
      };
      setDefectLogs(prev => {
        const next = [localLog, ...prev];
        try {
          localStorage.setItem("SmartMeter_DefectLogs", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [currentUser]);

  const addDefectiveMeter = useCallback(async (entry) => {
    // 1. Client-side state check (fast response)
    const existing = defectiveMeters.find(m => 
      m.serial_number === entry.serial_number && m.status !== "resolved"
    );

    if (existing) {
      const statusLabel = existing.status === 'pending' ? 'قيد الانتظار' : 
                          existing.status === 'verified' ? 'تم التحقق (معطوب)' : 'بلاغ جديد مسجل';
      return { 
        success: false, 
        message: `هذا العداد مسجل مسبقاً بعطل (${existing.error_code}) وحالته حالياً: ${statusLabel}.` 
      };
    }

    // 2. Direct database query to prevent race conditions
    try {
      const { data: dbExisting, error: checkErr } = await supabase
         .from("defective_meters")
         .select("serial_number, error_code, status")
         .eq("serial_number", entry.serial_number)
         .neq("status", "resolved");

      if (checkErr) throw checkErr;

      if (dbExisting && dbExisting.length > 0) {
        const activeDef = dbExisting[0];
        const statusLabel = activeDef.status === 'pending' ? 'قيد الانتظار' : 
                            activeDef.status === 'verified' ? 'تم التحقق (معطوب)' : 'بلاغ جديد مسجل';
        return { 
          success: false, 
          message: `هذا العداد مسجل مسبقاً بعطل (${activeDef.error_code}) وحالته حالياً: ${statusLabel}.` 
        };
      }
    } catch (checkErr) {
      console.warn("Direct DB duplicate check failed, relying on state:", checkErr.message);
    }

    // 3. Box capacity check if assigning to a box at registration
    if (entry.box_id) {
      const targetBox = boxes.find(b => b.id === entry.box_id);
      if (targetBox) {
        const currentCount = defectiveMeters.filter(m => m.box_id === entry.box_id && m.status !== "resolved").length;
        if (currentCount >= targetBox.size) {
          return { 
            success: false, 
            message: language === "ar" 
              ? `عذراً، الصندوق "${targetBox.name}" ممتلئ بالفعل (السعة: ${targetBox.size})`
              : `Sorry, Box "${targetBox.name}" is already full (Capacity: ${targetBox.size})`
          };
        }
      }
    }

    let finalStage = entry.stage_found;
    const errCodeObj = errorCodes.find(e => e.code === entry.error_code);
    if (errCodeObj) {
      finalStage = errCodeObj.stage_id;
    }

    const payload = {
      id: `DEF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      serial_number: entry.serial_number,
      ne_serial_number: entry.ne_serial_number || null,
      error_code: entry.error_code,
      stage_found: finalStage,
      custom_description: entry.custom_description || "",
      reported_by: entry.reported_by,
      status: "pending",
      box_id: entry.box_id || null
    };

    try {
      const { data, error } = await supabase
        .from("defective_meters")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      setDefectiveMeters(prev => [data, ...prev]);

      // Log action
      addDefectLog({
        defect_id: data.id,
        serial_number: data.serial_number,
        action_type: "reported",
        old_status: null,
        new_status: "pending",
        performed_by: entry.reported_by,
        performed_by_name: currentUser?.full_name || "Operator"
      });

      return { success: true, entry: data };
    } catch (err) {
      console.error("Supabase defect add error:", err.message, err.details, err.hint);
      return { success: false, message: `خطأ في الحفظ: ${err.message || 'Error saving to cloud.'}` };
    }
  }, [defectiveMeters, errorCodes, addDefectLog, currentUser, boxes, language]);

  const addDefectiveMetersBulk = useCallback(async (entriesArray) => {
    try {
      // 1. Fetch active defects from DB for these serials
      const serials = [...new Set(entriesArray.map(e => e.serial_number))];
      let dbActiveSerials = new Set();
      
      try {
        const { data: dbExisting, error: dbErr } = await supabase
          .from("defective_meters")
          .select("serial_number")
          .in("serial_number", serials)
          .neq("status", "resolved");
        
        if (dbErr) throw dbErr;
        if (dbExisting) {
          dbActiveSerials = new Set(dbExisting.map(m => m.serial_number));
        }
      } catch (dbErr) {
        console.warn("Bulk DB duplicate check failed, relying on state:", dbErr.message);
        // fallback to client state
        dbActiveSerials = new Set(
          defectiveMeters
            .filter(m => m.status !== "resolved")
            .map(m => m.serial_number)
        );
      }

      // 2. Filter out duplicates from both DB/state and within the import itself
      const uniqueNew = [];
      const seenInImport = new Set();

      for (const entry of entriesArray) {
        const sn = entry.serial_number;
        if (!dbActiveSerials.has(sn) && !seenInImport.has(sn)) {
          uniqueNew.push(entry);
          seenInImport.add(sn);
        }
      }
      
      if (uniqueNew.length === 0) {
        return { success: false, message: "جميع العدادات المرفقة مسجلة مسبقاً كمعطوبة حالياً أو تحتوي على تكرار." };
      }

      const payloads = uniqueNew.map(({ id, ...rest }) => {
        let finalStage = rest.stage_found;
        const errCodeObj = errorCodes.find(e => e.code === rest.error_code);
        if (errCodeObj) {
          finalStage = errCodeObj.stage_id;
        }
        return {
          serial_number: rest.serial_number,
          ne_serial_number: rest.ne_serial_number || null,
          error_code: rest.error_code,
          stage_found: finalStage,
          custom_description: rest.custom_description || "",
          reported_by: rest.reported_by,
          status: rest.status || "pending",
        };
      });

      const { data, error } = await supabase
        .from("defective_meters")
        .insert(payloads)
        .select();
      if (error) throw error;

      setDefectiveMeters(prev => [...(data || payloads), ...prev]);

      // Log bulk upload
      if (data && data.length > 0) {
        data.forEach(m => {
          addDefectLog({
            defect_id: m.id,
            serial_number: m.serial_number,
            action_type: "reported",
            old_status: null,
            new_status: m.status,
            performed_by: currentUser?.employee_id || "System",
            performed_by_name: currentUser?.full_name || "System"
          });
        });
      }

      return { success: true, count: uniqueNew.length };
    } catch (err) {
      console.error("Supabase defective meters bulk add error:", err);
      return { success: false, error: err };
    }
  }, [defectiveMeters, errorCodes, addDefectLog, currentUser]);

  const updateMeterStatus = useCallback(async (id, status) => {
    const resolved_at = new Date().toISOString();
    const resolved_by = currentUser?.employee_id || null;
    const oldMeter = defectiveMeters.find(m => m.id === id);
    const oldStatus = oldMeter ? oldMeter.status : null;
    const serialNumber = oldMeter ? oldMeter.serial_number : "UNKNOWN";

    try {
      const { error } = await supabase.from("defective_meters").update({ status, resolved_at, resolved_by }).eq("id", id);
      if (error) throw error;
      setDefectiveMeters(prev => prev.map(m => m.id === id ? { ...m, status, resolved_at, resolved_by } : m));

      // Log status change
      addDefectLog({
        defect_id: id,
        serial_number: serialNumber,
        action_type: "status_change",
        old_status: oldStatus,
        new_status: status,
        performed_by: currentUser?.employee_id,
        performed_by_name: currentUser?.full_name || "User"
      });
    } catch (err) {
      console.error("Supabase defect update error:", err);
    }
  }, [defectiveMeters, currentUser, addDefectLog]);

  const updateDefectiveMeter = useCallback(async (id, updatedFields) => {
    const oldMeter = defectiveMeters.find(m => m.id === id);
    if (!oldMeter) return { success: false, message: "Meter not found" };

    try {
      const { error } = await supabase
        .from("defective_meters")
        .update(updatedFields)
        .eq("id", id);

      if (error) throw error;

      setDefectiveMeters(prev => prev.map(m => m.id === id ? { ...m, ...updatedFields } : m));

      // Log change in history
      if (updatedFields.status && updatedFields.status !== oldMeter.status) {
        addDefectLog({
          defect_id: id,
          serial_number: oldMeter.serial_number,
          action_type: "status_change",
          old_status: oldMeter.status,
          new_status: updatedFields.status,
          performed_by: currentUser?.employee_id,
          performed_by_name: currentUser?.full_name || "User"
        });
      } else {
        addDefectLog({
          defect_id: id,
          serial_number: oldMeter.serial_number,
          action_type: "edit",
          old_status: oldMeter.status,
          new_status: oldMeter.status,
          performed_by: currentUser?.employee_id,
          performed_by_name: currentUser?.full_name || "User"
        });
      }

      return { success: true };
    } catch (err) {
      console.error("Supabase defect update error:", err);
      return { success: false, message: err.message };
    }
  }, [defectiveMeters, currentUser, addDefectLog]);

  // ── Box Tracking System ──────────────────────────────
  const addBox = useCallback(async (box) => {
    const newBox = {
      id: `BOX-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: box.name.trim(),
      size: parseInt(box.size) || 24,
      category: box.category.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from("boxes").insert([newBox]).select().single();
      if (error) throw error;
      setBoxes(prev => [...prev, data || newBox]);
      return { success: true, box: data || newBox };
    } catch (err) {
      console.error("Supabase box add error:", err);
      // Local fallback
      setBoxes(prev => [...prev, newBox]);
      return { success: true, box: newBox };
    }
  }, []);

  const updateBox = useCallback(async (id, updatedFields) => {
    try {
      const { error } = await supabase.from("boxes").update(updatedFields).eq("id", id);
      if (error) throw error;
      setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updatedFields } : b));
      return { success: true };
    } catch (err) {
      console.error("Supabase box update error:", err);
      setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updatedFields } : b));
      return { success: true };
    }
  }, []);

  const deleteBox = useCallback(async (id) => {
    try {
      const { error } = await supabase.from("boxes").delete().eq("id", id);
      if (error) throw error;
      setBoxes(prev => prev.filter(b => b.id !== id));
      // Unassign all defective meters that were in this box
      setDefectiveMeters(prev => prev.map(m => m.box_id === id ? { ...m, box_id: null } : m));
      return { success: true };
    } catch (err) {
      console.error("Supabase box delete error:", err);
      setBoxes(prev => prev.filter(b => b.id !== id));
      setDefectiveMeters(prev => prev.map(m => m.box_id === id ? { ...m, box_id: null } : m));
      return { success: true };
    }
  }, []);

  const assignMeterToBox = useCallback(async (meterId, boxId) => {
    if (boxId) {
      // Check capacity
      const targetBox = boxes.find(b => b.id === boxId);
      if (targetBox) {
        const currentCount = defectiveMeters.filter(m => m.box_id === boxId && m.status !== "resolved").length;
        if (currentCount >= targetBox.size) {
          return { 
            success: false, 
            message: language === "ar" 
              ? `عذراً، الصندوق "${targetBox.name}" ممتلئ بالفعل (السعة: ${targetBox.size})`
              : `Sorry, Box "${targetBox.name}" is already full (Capacity: ${targetBox.size})`
          };
        }
      }
    }

    try {
      const { error } = await supabase.from("defective_meters").update({ box_id: boxId }).eq("id", meterId);
      if (error) throw error;
      setDefectiveMeters(prev => prev.map(m => m.id === meterId ? { ...m, box_id: boxId } : m));
      return { success: true };
    } catch (err) {
      console.error("Supabase assign meter to box error:", err);
      setDefectiveMeters(prev => prev.map(m => m.id === meterId ? { ...m, box_id: boxId } : m));
      return { success: true };
    }
  }, [boxes, defectiveMeters, language]);

  // ── Error code management ────────────────────────────
  const addErrorCode = useCallback(async (errorData) => {
    try {
      const { error } = await supabase.from("error_codes").upsert([errorData]);
      if (error) throw error;
      setErrorCodes(prev => {
        const filtered = prev.filter(e => !(e.code === errorData.code && e.stage_id === errorData.stage_id));
        return [...filtered, errorData];
      });
    } catch (err) {
      console.error("Supabase error code add error:", err);
    }
  }, []);

  const addErrorCodesBulk = useCallback(async (errorDataArray) => {
    try {
      const { error } = await supabase.from("error_codes").upsert(errorDataArray);
      if (error) throw error;
      setErrorCodes(prev => {
        const incomingMap = new Map(errorDataArray.map(e => [`${e.code}_${e.stage_id}`, e]));
        const filtered = prev.filter(e => !incomingMap.has(`${e.code}_${e.stage_id}`));
        return [...filtered, ...errorDataArray];
      });
      return { success: true };
    } catch (err) {
      console.error("Supabase error code bulk add error:", err);
      return { success: false, error: err };
    }
  }, []);

  const updateErrorCode = useCallback(async (oldCode, stageId, updatedData) => {
    try {
      const { error } = await supabase.from("error_codes").update(updatedData).eq("code", oldCode).eq("stage_id", stageId);
      if (error) throw error;
      setErrorCodes(prev => prev.map(e => (e.code === oldCode && e.stage_id === stageId) ? { ...e, ...updatedData } : e));
    } catch (err) {
      console.error("Supabase error code update error:", err);
    }
  }, []);

  const deleteErrorCode = useCallback(async (code, stageId) => {
    try {
      const { error } = await supabase.from("error_codes").delete().eq("code", code).eq("stage_id", stageId);
      if (error) throw error;
      setErrorCodes(prev => prev.filter(e => !(e.code === code && e.stage_id === stageId)));
    } catch (err) {
      console.error("Supabase error code delete error:", err);
    }
  }, []);

  const searchErrorCodes = useCallback((query, stageId = null) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return errorCodes.filter(e => {
      const matchStage = stageId ? (e.stage_id === stageId || e.stage_id === "GLOBAL") : true;
      return matchStage && (
        e.code.toLowerCase().includes(q) || 
        (e.title_ar && e.title_ar.toLowerCase().includes(q)) || 
        (e.title_en && e.title_en.toLowerCase().includes(q)) || 
        (e.description && e.description.toLowerCase().includes(q))
      );
    });
  }, [errorCodes]);

  const getErrorByCode = useCallback((code) => errorCodes.find(e => e.code === code) || null, [errorCodes]);

  // ── Equipment stock management ────────────────────────────
  const addEquipmentStock = useCallback(async (item) => {
    const newItem = {
      id: `EQ-${Date.now()}`,
      name: item.name.trim(),
      category: item.category.trim(),
      unit: item.unit.trim(),
      current_stock: parseInt(item.current_stock) || 0,
      min_stock: parseInt(item.min_stock) || 0,
    };

    try {
      const { error } = await supabase.from("equipment_stock").insert([newItem]);
      if (error) throw error;
      setEquipmentStock(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      console.error("Supabase equipment stock add error:", err);
      return null;
    }
  }, []);

  const updateEquipmentStock = useCallback(async (id, data) => {
    try {
      const { error } = await supabase.from("equipment_stock").update(data).eq("id", id);
      if (error) throw error;
      setEquipmentStock(prev => prev.map(item => 
        item.id === id ? { ...item, ...data } : item
      ));
    } catch (err) {
      console.error("Supabase equipment stock update error:", err);
    }
  }, []);

  const deleteEquipmentItem = useCallback(async (id) => {
    try {
      const { error } = await supabase.from("equipment_stock").delete().eq("id", id);
      if (error) throw error;
      setEquipmentStock(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Supabase equipment item delete error:", err);
    }
  }, []);

  const restockEquipment = useCallback(async (id, quantity) => {
    const currentItem = equipmentStock.find(item => item.id === id);
    const newStock = currentItem ? currentItem.current_stock + quantity : quantity;

    try {
      const { error } = await supabase.from("equipment_stock").update({ current_stock: newStock }).eq("id", id);
      if (error) throw error;
      setEquipmentStock(prev => prev.map(item =>
        item.id === id ? { ...item, current_stock: newStock } : item
      ));
    } catch (err) {
      console.error("Supabase equipment restock error:", err);
    }
  }, [equipmentStock]);

  // ── Equipment handout management ───────────────────────────
  const handoutEquipment = useCallback(async (handout) => {
    const equipment = equipmentStock.find(e => e.id === handout.equipment_id);
    if (!equipment || equipment.current_stock < handout.quantity) {
      return { success: false, message: "الكمية المطلوبة غير متوفرة في المخزون" };
    }

    const newHandout = {
      id: `HANDOUT-${Date.now()}`,
      equipment_id: handout.equipment_id,
      equipment_name: equipment.name,
      employee_id: handout.employee_id,
      employee_name: handout.employee_name,
      quantity: parseInt(handout.quantity),
      unit: equipment.unit,
      handout_date: new Date().toISOString().split("T")[0],
      handed_by: currentUser?.employee_id || "ADMIN",
      notes: handout.notes || "",
    };

    try {
      const { error: hError } = await supabase.from("equipment_handouts").insert([newHandout]);
      if (hError) throw hError;
      
      const { error: sError } = await supabase.from("equipment_stock").update({ current_stock: equipment.current_stock - parseInt(handout.quantity) }).eq("id", handout.equipment_id);
      if (sError) throw sError;

      setEquipmentHandouts(prev => [newHandout, ...prev]);
      setEquipmentStock(prev => prev.map(item =>
        item.id === handout.equipment_id
          ? { ...item, current_stock: item.current_stock - parseInt(handout.quantity) }
          : item
      ));

      return { success: true, handout: newHandout };
    } catch (err) {
      console.error("Supabase equipment handout error:", err);
      return { success: false, message: "Cloud error occurred." };
    }
  }, [equipmentStock, currentUser]);

  const returnEquipment = useCallback(async (handoutId, quantity) => {
    const handout = equipmentHandouts.find(h => h.id === handoutId);
    if (!handout) return { success: false, message: "السجل غير موجود" };

    const equipment = equipmentStock.find(e => e.id === handout.equipment_id);
    const newReturned = (handout.returned_quantity || 0) + quantity;
    const newStock = equipment ? equipment.current_stock + quantity : quantity;

    try {
      const { error: hError } = await supabase.from("equipment_handouts").update({ returned_quantity: newReturned }).eq("id", handoutId);
      if (hError) throw hError;

      const { error: sError } = await supabase.from("equipment_stock").update({ current_stock: newStock }).eq("id", handout.equipment_id);
      if (sError) throw sError;

      setEquipmentHandouts(prev => prev.map(h =>
        h.id === handoutId ? { ...h, returned_quantity: newReturned } : h
      ));

      setEquipmentStock(prev => prev.map(item =>
        item.id === handout.equipment_id
          ? { ...item, current_stock: newStock }
          : item
      ));

      return { success: true };
    } catch (err) {
      console.error("Supabase equipment return error:", err);
      return { success: false, message: "Cloud error occurred." };
    }
  }, [equipmentHandouts, equipmentStock]);

  const getMyHandouts = useCallback((employeeId) => {
    return equipmentHandouts.filter(h => h.employee_id === employeeId);
  }, [equipmentHandouts]);

  const getLowStockItems = useCallback(() => {
    return equipmentStock.filter(item => item.current_stock <= item.min_stock);
  }, [equipmentStock]);

  // ── Lookup helpers ────────────────────────────────────
  const getStageById    = useCallback((id) => productionStages.find(s => s.stage_id === id), [productionStages]);
  const getShiftById    = useCallback((id) => shiftTypes.find(s => s.shift_id === id), [shiftTypes]);
  const getUserById     = useCallback((id) => users.find(u => u.employee_id === id), [users]);

  const getScheduleWithDetails = useCallback((sch) => ({
    ...sch,
    stage:    getStageById(sch.stage_id),
    shift:    getShiftById(sch.shift_id),
    employee: getUserById(sch.employee_id),
  }), [getStageById, getShiftById, getUserById]);

  // Polling interval to automatically delete resolved meters after 5 minutes
  useEffect(() => {
    const checkAndCleanup = async () => {
      const now = Date.now();
      const FIVE_MINUTES = 5 * 60 * 1000;
      const expiredIds = [];

      defectiveMeters.forEach(m => {
        if (m.status === "resolved" && m.resolved_at) {
          const age = now - new Date(m.resolved_at).getTime();
          if (age >= FIVE_MINUTES) {
            expiredIds.push(m.id);
          }
        }
      });

      if (expiredIds.length > 0) {
        // Optimistically update local state first
        setDefectiveMeters(prev => prev.filter(m => !expiredIds.includes(m.id)));
        try {
          const { error } = await supabase.from("defective_meters").delete().in("id", expiredIds);
          if (error) throw error;
        } catch (err) {
          console.error("Supabase timer defect cleanup error:", err);
        }
      }
    };

    const interval = setInterval(checkAndCleanup, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [defectiveMeters]);

  // Global loading overlay to prevent interacting with empty tables
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 20, backgroundColor: 'var(--bg)' }}>
        <div className="spinner" style={{ width: 45, height: 45, border: '4px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-muted)' }}>{language === "ar" ? "جاري الاتصال بالسحابة... (Supabase Sync)" : "Connecting to Cloud... (Supabase Sync)"}</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const value = {
    currentUser: effectiveUser, login, logout, loginError, changePassword,
    users, addUser, updateUserRole, deleteUser, updateUser,
    schedules, todaySchedule, upcomingSchedule, currentStage, currentShift,
    generateRotationSchedule, saveGeneratedSchedule, saveEditedSchedule,
    deleteScheduleEntry, clearScheduleByDate,
    productionStages, addStage, updateStage, deleteStage,
    errorCodes, addErrorCode, updateErrorCode, deleteErrorCode, addErrorCodesBulk,
    getStageById, getShiftById, getUserById, getScheduleWithDetails,
    defectiveMeters, addDefectiveMeter, addDefectiveMetersBulk, updateMeterStatus, updateDefectiveMeter,
    defectLogs, addDefectLog,
    searchErrorCodes, getErrorByCode,
    equipmentStock, addEquipmentStock, updateEquipmentStock, deleteEquipmentItem, restockEquipment,
    equipmentHandouts, handoutEquipment, returnEquipment, getMyHandouts, getLowStockItems,
    production_stages: productionStages, shift_types: shiftTypes, error_codes: errorCodes, getTodayString,
    language, toggleLanguage, t, isLoading,
    boxes, addBox, updateBox, deleteBox, assignMeterToBox
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export default AppContext;

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
