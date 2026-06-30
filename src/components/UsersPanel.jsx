import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { UserPlus, Edit2, Trash2, Shield, X, Check, Search } from "lucide-react";

const getRoles = (isRtl) => [
  { value: "operator",   label: isRtl ? "مشغّل" : "Operator",   badge: "badge-blue" },
  { value: "supervisor", label: isRtl ? "مشرف" : "Supervisor",    badge: "badge-amber" },
  { value: "admin",      label: isRtl ? "أدمن" : "Admin",    badge: "badge-admin" },
  { value: "quality_management", label: isRtl ? "إدارة الجودة" : "Quality Management", badge: "badge-cyan" }
];

const PANELS_LIST = [
  { id: "overview", labelAr: "نظرة عامة FPY", labelEn: "FPY Overview" },
  { id: "users", labelAr: "إدارة المستخدمين", labelEn: "User Management" },
  { id: "stages", labelAr: "مراحل الإنتاج", labelEn: "Production Stages" },
  { id: "assets", labelAr: "إدارة المعدات", labelEn: "Equipment Management" },
  { id: "schedule", labelAr: "جدول الورديات", labelEn: "Shift Schedules" },
  { id: "defects", labelAr: "العدادات المعطوبة", labelEn: "Defective Meters" },
  { id: "defects_summary", labelAr: "تقرير الأعطال المجمع", labelEn: "Defects Summary" },
  { id: "errorcodes", labelAr: "دليل الأعطال", labelEn: "Fault Codes Guide" },
  { id: "sop_reports", labelAr: "بداية الإنتاج (SOP)", labelEn: "Start of Production (SOP)" },
  { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance" }
];

function AddUserModal({ onClose }) {
  const { addUser, language, users } = useApp();
  const isRtl = language === "ar";
  const ROLES = getRoles(isRtl);

  const [form, setForm] = useState({ 
    employee_id: "", 
    full_name: "", 
    role: "operator", 
    password: "pass1234", 
    phone: "", 
    email: "",
    allowed_panels: []
  });
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const id = form.employee_id.trim().toUpperCase();
    
    // Check for duplicate employee_id
    const duplicate = users.find(u => u.employee_id === id);
    if (duplicate) {
      setErrorMsg(isRtl ? "الرقم الوظيفي مسجل بالفعل لموظف آخر!" : "Employee ID is already registered for another operator!");
      return;
    }

    setErrorMsg("");
    const result = await addUser(form);
    if (result) {
      setDone(true);
      setTimeout(onClose, 1200);
    } else {
      setErrorMsg(isRtl ? "حدث خطأ أثناء حفظ البيانات بالسحابة." : "An error occurred while saving user details.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card animate-fade" style={{ width: "100%", maxWidth: 440, padding: 28, textAlign: isRtl ? "right" : "left", direction: isRtl ? "rtl" : "ltr" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <UserPlus size={20} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0 }}>{isRtl ? "إضافة موظف جديد" : "Add New Operator"}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }}><X size={15} /></button>
        </div>

        {done ? (
          <div className="alert alert-success"><Check size={15} /> {isRtl ? "تمت إضافة الموظف بنجاح!" : "Operator registered successfully!"}</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {errorMsg && (
              <div className="alert alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الرقم الوظيفي *" : "Employee ID *"}</label>
              <input className="input" name="employee_id" placeholder="EMP-010" value={form.employee_id} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الاسم الكامل *" : "Full Name *"}</label>
              <input className="input" name="full_name" placeholder="John Doe" value={form.full_name} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الصلاحية" : "Role"}</label>
              <select className="input" name="role" value={form.role} onChange={handle}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {form.role === "admin" && (
              <div className="input-group" style={{ marginTop: 4 }}>
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left", fontWeight: 700 }}>
                  {isRtl ? "الصفحات المسموح بعرضها للأدمن *" : "Allowed Admin Pages *"}
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 12px",
                  background: "var(--bg-elevated)",
                  padding: 12,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  maxHeight: "180px",
                  overflowY: "auto"
                }}>
                  {PANELS_LIST.map(p => {
                    const isChecked = form.allowed_panels.includes(p.id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(prev => ({ ...prev, allowed_panels: [...prev.allowed_panels, p.id] }));
                            } else {
                              setForm(prev => ({ ...prev, allowed_panels: prev.allowed_panels.filter(id => id !== p.id) }));
                            }
                          }}
                          style={{ width: "auto", margin: 0 }}
                        />
                        <span>{isRtl ? p.labelAr : p.labelEn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
              <input className="input" name="phone" placeholder="+966500000000" value={form.phone} onChange={handle} style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "البريد الإلكتروني" : "Email"}</label>
              <input type="email" className="input" name="email" placeholder="example@example.com" value={form.email} onChange={handle} style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "كلمة المرور" : "Password"}</label>
              <input className="input" name="password" value={form.password} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <button type="submit" className="btn btn-primary btn-full"><UserPlus size={15} /> {isRtl ? "إضافة الموظف" : "Add Operator"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose }) {
  const { updateUser, language } = useApp();
  const isRtl = language === "ar";
  const ROLES = getRoles(isRtl);

  const roleLabel = { 
    admin: isRtl ? "أدمن" : "Admin", 
    supervisor: isRtl ? "مشرف" : "Supervisor", 
    operator: isRtl ? "مشغّل" : "Operator" 
  };

  const [form, setForm] = useState({
    full_name: user.full_name || "",
    role: user.role || "operator",
    password: user.password_hash || "",
    phone: user.phone || "",
    email: user.email || "",
    must_change_password: user.must_change_password || false,
    allowed_panels: Array.isArray(user.allowed_panels) 
      ? user.allowed_panels 
      : (() => {
          if (!user.allowed_panels) return [];
          try {
            const parsed = typeof user.allowed_panels === 'string' 
              ? JSON.parse(user.allowed_panels) 
              : user.allowed_panels;
            return Array.isArray(parsed) ? parsed : [];
          } catch(e) {
            return typeof user.allowed_panels === 'string' ? user.allowed_panels.split(',') : [];
          }
        })()
  });
  const [done, setDone] = useState(false);

  const handle = (e) => {
    const name = e.target.name;
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const result = await updateUser(user.employee_id, {
      full_name: form.full_name.trim(),
      role: form.role,
      password_hash: form.password,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      must_change_password: form.must_change_password,
      allowed_panels: form.role === "admin" ? form.allowed_panels : []
    });
    if (result && result.success) {
      setDone(true);
      setTimeout(onClose, 1200);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card animate-fade" style={{ width: "100%", maxWidth: 440, padding: 28, textAlign: isRtl ? "right" : "left", direction: isRtl ? "rtl" : "ltr" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <Edit2 size={20} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0 }}>{isRtl ? "تعديل بيانات الموظف" : "Edit Operator Details"}</h3>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }}><X size={15} /></button>
        </div>

        {done ? (
          <div className="alert alert-success"><Check size={15} /> {isRtl ? "تم تحديث البيانات بنجاح!" : "Operator updated successfully!"}</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الرقم الوظيفي" : "Employee ID"}</label>
              <input className="input" value={user.employee_id} disabled style={{ textAlign: isRtl ? "right" : "left", background: "var(--bg-elevated)", cursor: "not-allowed" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الاسم الكامل *" : "Full Name *"}</label>
              <input className="input" name="full_name" placeholder="John Doe" value={form.full_name} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الصلاحية" : "Role"}</label>
              {user.employee_id === "ADMIN-001" ? (
                <input className="input" value={roleLabel[form.role] || form.role} disabled style={{ textAlign: isRtl ? "right" : "left", background: "var(--bg-elevated)", cursor: "not-allowed" }} />
              ) : (
                <select className="input" name="role" value={form.role} onChange={handle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </div>
            {form.role === "admin" && user.employee_id !== "ADMIN-001" && (
              <div className="input-group" style={{ marginTop: 4 }}>
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left", fontWeight: 700 }}>
                  {isRtl ? "الصفحات المسموح بعرضها للأدمن *" : "Allowed Admin Pages *"}
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 12px",
                  background: "var(--bg-elevated)",
                  padding: 12,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  maxHeight: "180px",
                  overflowY: "auto"
                }}>
                  {PANELS_LIST.map(p => {
                    const isChecked = form.allowed_panels.includes(p.id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(prev => ({ ...prev, allowed_panels: [...prev.allowed_panels, p.id] }));
                            } else {
                              setForm(prev => ({ ...prev, allowed_panels: prev.allowed_panels.filter(id => id !== p.id) }));
                            }
                          }}
                          style={{ width: "auto", margin: 0 }}
                        />
                        <span>{isRtl ? p.labelAr : p.labelEn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
              <input className="input" name="phone" placeholder="+966500000000" value={form.phone} onChange={handle} style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "البريد الإلكتروني" : "Email"}</label>
              <input type="email" className="input" name="email" placeholder="example@example.com" value={form.email} onChange={handle} style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "كلمة المرور" : "Password"}</label>
              <input className="input" name="password" value={form.password} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="must_change_password" name="must_change_password" checked={form.must_change_password} onChange={handle} style={{ width: "auto", cursor: "pointer" }} />
              <label htmlFor="must_change_password" style={{ fontSize: "0.85rem", cursor: "pointer", userSelect: "none" }}>
                {isRtl ? "فرض تغيير كلمة المرور عند تسجيل الدخول التالي" : "Force password change on next login"}
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-full"><Edit2 size={15} /> {isRtl ? "حفظ التغييرات" : "Save Changes"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UsersPanel() {
  const { users, updateUserRole, deleteUser, currentUser, language } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isRtl = language === "ar";
  const ROLES = getRoles(isRtl);

  const roleBadge = { 
    admin: "badge-admin", 
    supervisor: "badge-amber", 
    operator: "badge-blue",
    quality_management: "badge-cyan"
  };
  const roleLabel = useMemo(() => ({ 
    admin: isRtl ? "أدمن" : "Admin", 
    supervisor: isRtl ? "مشرف" : "Supervisor", 
    operator: isRtl ? "مشغّل" : "Operator",
    quality_management: isRtl ? "إدارة الجودة" : "Quality Management"
  }), [isRtl]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.employee_id.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (roleLabel[u.role] && roleLabel[u.role].toLowerCase().includes(q))
    );
  }, [searchQuery, users, roleLabel]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
      {selectedUserForEdit && <EditUserModal user={selectedUserForEdit} onClose={() => setSelectedUserForEdit(null)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{isRtl ? "إدارة المستخدمين" : "User Management"}</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {users.length} {isRtl ? "مستخدم — يمكنك تغيير الصلاحيات وإضافة موظفين جدد" : "registered users — manage access levels"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexDirection: isRtl ? "row" : "row-reverse" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "260px" }}>
            <input
              className="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "البحث بالاسم، الرقم الوظيفي..." : "Search name, employee ID..."}
              style={{ paddingRight: isRtl ? 35 : 12, paddingLeft: !isRtl ? 35 : 12, textAlign: isRtl ? "right" : "left", height: "36px", fontSize: "0.85rem", background: "white" }}
            />
            <Search size={16} style={{
              position: "absolute",
              right: isRtl ? 10 : "auto",
              left: !isRtl ? 10 : "auto",
              top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
            }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)} style={{ height: "36px" }}>
            <UserPlus size={14} /> {isRtl ? "إضافة موظف" : "Add New User"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: "none" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الرقم الوظيفي" : "Employee ID"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الاسم" : "Full Name"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الصلاحية" : "Role"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "رقم الهاتف" : "Phone"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "البريد الإلكتروني" : "Email"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تغيير الصلاحية" : "Assign Role"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تعديل" : "Edit"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "حذف" : "Remove"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.employee_id}>
                  <td><code style={{ fontFamily: "monospace", fontSize: "0.83rem", background: "var(--bg-elevated)", padding: "2px 7px", borderRadius: 4 }}>{u.employee_id}</code></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: u.role === "admin" ? "linear-gradient(135deg,#e65100,#ff8f00)" : u.role === "supervisor" ? "linear-gradient(135deg,#9a6700,#d4a72c)" : u.role === "quality_management" ? "linear-gradient(135deg,#009688,#00796b)" : "linear-gradient(135deg,#0550ae,#1a7f37)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.72rem", flexShrink: 0 }}>
                        {u.full_name.split(" ").slice(0,2).map(w=>w[0]).join("")}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${roleBadge[u.role] || "badge-gray"}`}>{u.role === "admin" && <Shield size={10} />} {roleLabel[u.role] || u.role}</span></td>
                  <td><span style={{ fontSize: "0.85rem" }}>{u.phone || "—"}</span></td>
                  <td><span style={{ fontSize: "0.85rem", fontFamily: "monospace" }}>{u.email || "—"}</span></td>
                  <td>
                    {u.employee_id !== "ADMIN-001" ? (
                      <select className="input" style={{ padding: "4px 8px", fontSize: "0.82rem", width: "auto" }} value={u.role} onChange={e => updateUserRole(u.employee_id, e.target.value)}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{isRtl ? "محمي" : "Protected"}</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedUserForEdit(u)} title={isRtl ? "تعديل" : "Edit"}><Edit2 size={14} /></button>
                  </td>
                  <td>
                    {u.employee_id !== currentUser?.employee_id && u.role !== "admin" ? (
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--red)" }} onClick={() => {
                        const confirmMsg = isRtl ? `هل أنت متأكد من حذف ${u.full_name}؟` : `Are you sure you want to delete ${u.full_name}?`;
                        if (window.confirm(confirmMsg)) deleteUser(u.employee_id);
                      }} title={isRtl ? "حذف" : "Remove"}><Trash2 size={14} /></button>
                    ) : <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
