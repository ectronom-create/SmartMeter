import { useState } from "react";
import { useApp } from "../context/AppContext";
import { UserPlus, Edit2, Trash2, Shield, X, Check } from "lucide-react";

const getRoles = (isRtl) => [
  { value: "operator",   label: isRtl ? "مشغّل" : "Operator",   badge: "badge-blue" },
  { value: "supervisor", label: isRtl ? "مشرف" : "Supervisor",    badge: "badge-amber" },
  { value: "admin",      label: isRtl ? "أدمن" : "Admin",    badge: "badge-admin" },
];

function AddUserModal({ onClose }) {
  const { addUser, language } = useApp();
  const isRtl = language === "ar";
  const ROLES = getRoles(isRtl);

  const [form, setForm] = useState({ employee_id: "", full_name: "", role: "operator", password: "pass1234" });
  const [done, setDone] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    addUser(form);
    setDone(true);
    setTimeout(onClose, 1200);
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

export default function UsersPanel() {
  const { users, updateUserRole, deleteUser, currentUser, language } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  const isRtl = language === "ar";
  const ROLES = getRoles(isRtl);

  const roleBadge = { admin: "badge-admin", supervisor: "badge-amber", operator: "badge-blue" };
  const roleLabel = { 
    admin: isRtl ? "أدمن" : "Admin", 
    supervisor: isRtl ? "مشرف" : "Supervisor", 
    operator: isRtl ? "مشغّل" : "Operator" 
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{isRtl ? "إدارة المستخدمين" : "User Management"}</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {users.length} {isRtl ? "مستخدم — يمكنك تغيير الصلاحيات وإضافة موظفين جدد" : "registered users — manage access levels"}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} /> {isRtl ? "إضافة موظف" : "Add New User"}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: "none" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الرقم الوظيفي" : "Employee ID"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الاسم" : "Full Name"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الصلاحية" : "Role"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تغيير الصلاحية" : "Assign Role"}</th>
                <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "حذف" : "Remove"}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.employee_id}>
                  <td><code style={{ fontFamily: "monospace", fontSize: "0.83rem", background: "var(--bg-elevated)", padding: "2px 7px", borderRadius: 4 }}>{u.employee_id}</code></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: u.role === "admin" ? "linear-gradient(135deg,#e65100,#ff8f00)" : u.role === "supervisor" ? "linear-gradient(135deg,#9a6700,#d4a72c)" : "linear-gradient(135deg,#0550ae,#1a7f37)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.72rem", flexShrink: 0 }}>
                        {u.full_name.split(" ").slice(0,2).map(w=>w[0]).join("")}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${roleBadge[u.role] || "badge-gray"}`}>{u.role === "admin" && <Shield size={10} />} {roleLabel[u.role] || u.role}</span></td>
                  <td>
                    {u.employee_id !== "ADMIN-001" ? (
                      <select className="input" style={{ padding: "4px 8px", fontSize: "0.82rem", width: "auto" }} value={u.role} onChange={e => updateUserRole(u.employee_id, e.target.value)}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{isRtl ? "محمي" : "Protected"}</span>}
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
