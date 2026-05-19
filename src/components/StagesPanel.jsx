import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Plus, Edit2, Trash2, X, Check, Layers, Type, Hash, Palette, Info, AlertCircle, HelpCircle } from "lucide-react";

function StageModal({ stage, onClose }) {
  const { addStage, updateStage, productionStages, language } = useApp();
  const isRtl = language === "ar";
  const isEdit = !!stage;
  
  const [form, setForm] = useState(stage || {
    stage_id: `STG-${String(productionStages.length + 1).padStart(2, "0")}`,
    stage_name: "",
    short_name: "",
    icon: "⚙️",
    color: "#6366f1",
    instructions: [],
    troubleshooting: []
  });

  const [newInst, setNewInst] = useState("");
  const [newProb, setNewProb] = useState({ problem: "", solution: "" });
  const [done, setDone] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const addInstruction = () => {
    if (!newInst.trim()) return;
    setForm(p => ({ ...p, instructions: [...p.instructions, newInst] }));
    setNewInst("");
  };

  const addProblem = () => {
    if (!newProb.problem.trim() || !newProb.solution.trim()) return;
    setForm(p => ({ ...p, troubleshooting: [...(p.troubleshooting || []), newProb] }));
    setNewProb({ problem: "", solution: "" });
  };

  const submit = (e) => {
    e.preventDefault();
    if (isEdit) {
      updateStage(stage.stage_id, form);
    } else {
      addStage(form);
    }
    setDone(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card animate-scale" style={{ width: "100%", maxWidth: 650, padding: 28, maxHeight: "90vh", overflowY: "auto", direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexDirection: isRtl ? "row" : "row-reverse" }}>
          <Layers size={20} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0 }}>{isEdit ? (isRtl ? "تعديل مرحلة الإنتاج" : "Edit Workstation Stage") : (isRtl ? "إضافة مرحلة جديدة" : "Add New Workstation Stage")}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} style={{ marginRight: isRtl ? "auto" : "none", marginLeft: !isRtl ? "auto" : "none" }}><X size={15} /></button>
        </div>

        {done ? (
          <div className="alert alert-success"><Check size={15} /> {isRtl ? "تم الحفظ بنجاح!" : "Changes saved successfully!"}</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2">
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "معرف المرحلة (ID)" : "Stage ID"}</label>
                <input className="input" name="stage_id" value={form.stage_id} onChange={handle} required disabled={isEdit} style={{ textAlign: isRtl ? "right" : "left" }} />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الاسم المختصر" : "Short Code"}</label>
                <input className="input" name="short_name" value={form.short_name} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "اسم المرحلة الكامل" : "Full Stage Name"}</label>
              <input className="input" name="stage_name" value={form.stage_name} onChange={handle} required style={{ textAlign: isRtl ? "right" : "left" }} />
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الأيقونة واللون" : "Icon & Theme Color"}</label>
                <div style={{ display: "flex", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <input className="input" name="icon" value={form.icon} onChange={handle} style={{ width: 60, textAlign: "center" }} />
                  <input className="input" type="color" name="color" value={form.color} onChange={handle} style={{ flex: 1, padding: 2 }} />
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* Instructions */}
            <div>
              <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "تعليمات التشغيل" : "Standard Operating Procedures (SOP)"}</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <input className="input" placeholder={isRtl ? "أضف خطوة عمل..." : "Enter workspace SOP step..."} value={newInst} onChange={e => setNewInst(e.target.value)} style={{ textAlign: isRtl ? "right" : "left" }} />
                <button type="button" className="btn btn-secondary" onClick={addInstruction}>{isRtl ? "إضافة" : "Add"}</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {form.instructions.map((inst, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-elevated)", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem", flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <span style={{ fontWeight: 800, color: "var(--accent)" }}>{i + 1}</span>
                    <span style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>{inst}</span>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm(p => ({ ...p, instructions: p.instructions.filter((_, idx) => idx !== i) }))}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="divider" />

            {/* Troubleshooting */}
            <div>
              <label className="input-label" style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 6, justifyContent: isRtl ? "flex-start" : "flex-end", flexDirection: isRtl ? "row" : "row-reverse" }}>
                <AlertCircle size={14} /> {isRtl ? "المشاكل المتوقعة وحلولها" : "Technical Troubleshooting & Critical Fixes"}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#fff5f5", padding: 12, borderRadius: 12, border: "1px solid #feb2b2", marginBottom: 10 }}>
                <input className="input" placeholder={isRtl ? "المشكلة المتوقعة..." : "Describe potential technical failure..."} value={newProb.problem} onChange={e => setNewProb({ ...newProb, problem: e.target.value })} style={{ textAlign: isRtl ? "right" : "left" }} />
                <div style={{ display: "flex", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <input className="input" placeholder={isRtl ? "الحل المقترح..." : "Proposed technician resolution..."} value={newProb.solution} onChange={e => setNewProb({ ...newProb, solution: e.target.value })} style={{ textAlign: isRtl ? "right" : "left" }} />
                  <button type="button" className="btn btn-secondary" onClick={addProblem}>{isRtl ? "إضافة" : "Add"}</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(form.troubleshooting || []).map((item, i) => (
                  <div key={i} style={{ background: "white", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)", fontSize: "0.85rem", textAlign: isRtl ? "right" : "left" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexDirection: isRtl ? "row" : "row-reverse" }}>
                      <strong style={{ color: "var(--red)" }}>❌ {isRtl ? "المشكلة:" : "Problem:"} {item.problem}</strong>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm(p => ({ ...p, troubleshooting: p.troubleshooting.filter((_, idx) => idx !== i) }))}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ color: "var(--green)", fontWeight: 600 }}>✅ {isRtl ? "الحل:" : "Fix:"} {item.solution}</div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 10 }}>
              {isEdit ? (isRtl ? "تحديث المرحلة" : "Update Stage") : (isRtl ? "إضافة المرحلة" : "Create Stage")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function StagesPanel() {
  const { productionStages, deleteStage, language } = useApp();
  const [modal, setModal] = useState({ show: false, stage: null });

  const isRtl = language === "ar";

  const getTranslatedStageName = (s, isRtl) => {
    if (isRtl) return s.stage_name;
    const parts = s.stage_name.split("(");
    return parts[0].trim();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}>
      {modal.show && <StageModal stage={modal.stage} onClose={() => setModal({ show: false, stage: null })} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{isRtl ? "إدارة مراحل الإنتاج" : "Production Station Manager"}</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {isRtl ? "تخصيص خطوات العمل، التنبيهات والمشاكل المتوقعة" : "Configure SOP guidelines, technical alerts, and quality standards"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ show: true, stage: null })}>
          <Plus size={16} /> {isRtl ? "إضافة مرحلة" : "Add Stage"}
        </button>
      </div>

      <div className="grid-2 stagger">
        {productionStages.map((s) => (
          <div key={s.stage_id} className="card animate-fade" style={{ 
            borderRight: isRtl ? `4px solid ${s.color}` : "none", 
            borderLeft: !isRtl ? `4px solid ${s.color}` : "none", 
            padding: 20 
          }}>
            <div style={{ display: "flex", gap: 14, flexDirection: isRtl ? "row" : "row-reverse" }}>
              <div style={{ fontSize: "2rem", background: `${s.color}15`, width: 56, height: 56, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <h3 style={{ margin: 0 }}>{getTranslatedStageName(s, isRtl)}</h3>
                  <span className="badge badge-gray">{s.stage_id}</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>
                  {s.instructions.length} {isRtl ? "خطوات" : "steps"} • {s.troubleshooting?.length || 0} {isRtl ? "تنبيهات فنية" : "technician alerts"}
                </div>
                <div style={{ display: "flex", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal({ show: true, stage: s })}><Edit2 size={13} /> {isRtl ? "تعديل" : "Edit"}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => { 
                    const confirmMsg = isRtl ? "حذف هذه المرحلة؟" : "Are you sure you want to delete this stage?";
                    if(window.confirm(confirmMsg)) deleteStage(s.stage_id); 
                  }}><Trash2 size={13} /> {isRtl ? "حذف" : "Delete"}</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
