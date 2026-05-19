import { createContext, useContext, useState, useCallback, useEffect } from "react";
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
        
        // Fetch all data in parallel for speed
        const [
          { data: uData },
          { data: stgData },
          { data: errData },
          { data: schData },
          { data: defData },
          { data: eqData },
          { data: hoData },
          { data: shiftData }
        ] = await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("production_stages").select("*"),
          supabase.from("error_codes").select("*"),
          supabase.from("schedules").select("*"),
          supabase.from("defective_meters").select("*"),
          supabase.from("equipment_stock").select("*"),
          supabase.from("equipment_handouts").select("*"),
          supabase.from("shift_types").select("*")
        ]);

        if (uData) setUsers(uData);
        if (stgData) setProductionStages(stgData);
        if (errData) setErrorCodes(errData);
        if (schData) setSchedules(schData);
        if (defData) setDefectiveMeters(defData);
        if (eqData) setEquipmentStock(eqData);
        if (hoData) setEquipmentHandouts(hoData);
        if (shiftData) setShiftTypes(shiftData);

      } catch (err) {
        console.error("Error loading data from Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
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

  // ── Users management ──────────────────────────────────
  const addUser = useCallback(async (userData) => {
    const newUser = {
      employee_id: userData.employee_id.trim().toUpperCase(),
      full_name:   userData.full_name.trim(),
      role:        userData.role,
      password_hash: userData.password,
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
    if (entries.length === 0) return;
    
    const newKeys = new Set(entries.map(e => `${e.schedule_date}__${e.shift_id}`));
    
    try {
      for (const entry of entries) {
        await supabase.from("schedules")
          .delete()
          .eq("schedule_date", entry.schedule_date)
          .eq("shift_id", entry.shift_id)
          .eq("employee_id", entry.employee_id);
          
        await supabase.from("schedules").insert([entry]);
      }
      
      setSchedules(prev => {
        const filtered = prev.filter(s => !newKeys.has(`${s.schedule_date}__${s.shift_id}`));
        return [...filtered, ...entries];
      });
    } catch (err) {
      console.error("Supabase schedules insert error:", err);
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

  const addDefectiveMeter = useCallback(async (entry) => {
    const existing = defectiveMeters.find(m => 
      m.serial_number === entry.serial_number && m.status !== "resolved"
    );

    if (existing) {
      const statusLabel = existing.status === 'pending' ? 'قيد الانتظار' : 
                          existing.status === 'verified' ? 'تم التحقق (معطوب)' : 'يعود لخط الانتاج';
      return { 
        success: false, 
        message: `هذا العداد مسجل مسبقاً بعطل (${existing.error_code}) وحالته حالياً: ${statusLabel}.` 
      };
    }

    const newEntry = {
      ...entry,
      id: `DEF-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "reported",
    };

    try {
      const { error } = await supabase.from("defective_meters").insert([newEntry]);
      if (error) throw error;
      setDefectiveMeters(prev => [newEntry, ...prev]);
      return { success: true, entry: newEntry };
    } catch (err) {
      console.error("Supabase defect add error:", err);
      return { success: false, message: "Error saving to cloud." };
    }
  }, [defectiveMeters]);

  const addDefectiveMetersBulk = useCallback(async (entriesArray) => {
    try {
      // Filter out duplicate serials that are already open (not resolved)
      const existingSerials = new Set(
        defectiveMeters
          .filter(m => m.status !== "resolved")
          .map(m => m.serial_number)
      );

      const uniqueNew = entriesArray.filter(e => !existingSerials.has(e.serial_number));
      
      if (uniqueNew.length === 0) {
        return { success: false, message: "جميع العدادات مضافة مسبقاً ولديهم بلاغات نشطة." };
      }

      const { error } = await supabase.from("defective_meters").insert(uniqueNew);
      if (error) throw error;

      setDefectiveMeters(prev => [...uniqueNew, ...prev]);
      return { success: true, count: uniqueNew.length };
    } catch (err) {
      console.error("Supabase defective meters bulk add error:", err);
      return { success: false, error: err };
    }
  }, [defectiveMeters]);

  const updateMeterStatus = useCallback(async (id, status) => {
    try {
      const { error } = await supabase.from("defective_meters").update({ status }).eq("id", id);
      if (error) throw error;
      setDefectiveMeters(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    } catch (err) {
      console.error("Supabase defect update error:", err);
    }
  }, []);

  // ── Error code management ────────────────────────────
  const addErrorCode = useCallback(async (errorData) => {
    try {
      const { error } = await supabase.from("error_codes").insert([errorData]);
      if (error) throw error;
      setErrorCodes(prev => [...prev, errorData]);
    } catch (err) {
      console.error("Supabase error code add error:", err);
    }
  }, []);

  const addErrorCodesBulk = useCallback(async (errorDataArray) => {
    try {
      const { error } = await supabase.from("error_codes").insert(errorDataArray);
      if (error) throw error;
      setErrorCodes(prev => {
        const existingKeys = new Set(prev.map(e => `${e.code}_${e.stage_id}`));
        const newUnique = errorDataArray.filter(e => !existingKeys.has(`${e.code}_${e.stage_id}`));
        return [...prev, ...newUnique];
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
      const matchStage = stageId ? e.stage_id === stageId : true;
      return matchStage && (
        e.code.toLowerCase().includes(q) || 
        e.title.toLowerCase().includes(q) || 
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
    currentUser, login, logout, loginError,
    users, addUser, updateUserRole, deleteUser,
    schedules, todaySchedule, upcomingSchedule, currentStage, currentShift,
    generateRotationSchedule, saveGeneratedSchedule,
    deleteScheduleEntry, clearScheduleByDate,
    productionStages, addStage, updateStage, deleteStage,
    errorCodes, addErrorCode, updateErrorCode, deleteErrorCode, addErrorCodesBulk,
    getStageById, getShiftById, getUserById, getScheduleWithDetails,
    defectiveMeters, addDefectiveMeter, addDefectiveMetersBulk, updateMeterStatus,
    searchErrorCodes, getErrorByCode,
    equipmentStock, addEquipmentStock, updateEquipmentStock, deleteEquipmentItem, restockEquipment,
    equipmentHandouts, handoutEquipment, returnEquipment, getMyHandouts, getLowStockItems,
    production_stages: productionStages, shift_types: shiftTypes, error_codes: errorCodes, getTodayString,
    language, toggleLanguage, t, isLoading
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export default AppContext;

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
