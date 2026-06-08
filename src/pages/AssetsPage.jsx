import { useState } from "react";
import { useApp } from "../context/AppContext";
import { 
  Package, 
  User, 
  History, 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  ArrowDown, 
  ArrowUp, 
  ClipboardList,
  Trash2
} from "lucide-react";

// Translations for asset properties
export const getTranslatedAssetName = (name, isRtl) => {
  if (isRtl) return name;
  const translations = {
    "قفاز أمان": "Safety Gloves",
    "لثام جوتينغ": "Grouting Mask",
    "نظارات واقية": "Safety Glasses",
    "قميص عمل": "Work Uniform Shirt",
    "سماعات حماية": "Hearing Protection",
    "قفازات حرارية": "Thermal Gloves"
  };
  return translations[name] || name;
};

export const getTranslatedCategory = (cat, isRtl) => {
  if (isRtl) return cat;
  const translations = {
    "حماية": "Protection",
    "ملابس": "Uniforms",
    "أدوات": "Tools",
    "قرطاسية": "Stationery"
  };
  return translations[cat] || cat;
};

export const getTranslatedUnit = (unit, isRtl) => {
  if (isRtl) return unit;
  const translations = {
    "زوج": "pairs",
    "قطعة": "pieces",
    "كرتون": "boxes",
    "حزمة": "packs"
  };
  return translations[unit] || unit;
};

export function AssetsPanel() {
  const { 
    equipmentStock, 
    equipmentHandouts, 
    handoutEquipment, 
    restockEquipment, 
    addEquipmentStock,
    deleteEquipmentItem,
    users,
    currentUser,
    language
  } = useApp();

  const isRtl = language === "ar";

  const [activeTab, setActiveTab] = useState("stock"); // stock | history
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHandoutModal, setShowHandoutModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(null); // stores item object

  // Form states
  const [handoutForm, setHandoutForm] = useState({ 
    equipment_id: "", 
    employee_id: "", 
    quantity: 1, 
    notes: "" 
  });
  
  const [newAssetForm, setNewAssetForm] = useState({
    name: "",
    category: "حماية",
    unit: "زوج",
    current_stock: 0,
    min_stock: 5
  });

  const [restockQty, setRestockQty] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [handoutSearch, setHandoutSearch] = useState("");

  const handleHandout = (e) => {
    e.preventDefault();
    const selectedUser = users.find(u => u.employee_id === handoutForm.employee_id);
    const result = handoutEquipment({
      ...handoutForm,
      employee_name: selectedUser?.full_name || handoutForm.employee_id
    });

    if (result.success) {
      setShowHandoutModal(false);
      setHandoutForm({ equipment_id: "", employee_id: "", quantity: 1, notes: "" });
      alert(isRtl ? "تم تسليم العهدة بنجاح" : "PPE Handout registered successfully!");
    } else {
      alert(result.message);
    }
  };

  const handleAddAsset = (e) => {
    e.preventDefault();
    addEquipmentStock(newAssetForm);
    setShowAddModal(false);
    setNewAssetForm({ name: "", category: "حماية", unit: "زوج", current_stock: 0, min_stock: 5 });
  };

  const handleRestock = (e) => {
    e.preventDefault();
    restockEquipment(showRestockModal.id, parseInt(restockQty));
    setShowRestockModal(null);
    setRestockQty(1);
  };

  const handleDeleteAsset = (id) => {
    const confirmMsg = isRtl 
      ? "هل أنت متأكد من رغبتك في حذف هذا الأصل؟" 
      : "Are you sure you want to delete this asset?";
    if (window.confirm(confirmMsg)) {
      deleteEquipmentItem(id);
    }
  };

  const filteredStock = equipmentStock.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHandouts = equipmentHandouts.filter(h => 
    h.employee_name.toLowerCase().includes(handoutSearch.toLowerCase()) ||
    h.equipment_name.toLowerCase().includes(handoutSearch.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: isRtl ? "row" : "row-reverse" }}>
        <div style={{ textAlign: isRtl ? "right" : "left" }}>
          <h1 style={{ marginBottom: 4 }}>{isRtl ? "إدارة الأصول والعهدة" : "Assets & Equipment Handouts"}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {isRtl ? "إدارة مستلزمات الموظفين، القفازات، الملابس، وتتبع المخزون" : "Manage operator safety gear, PPE, uniforms, and track stock"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={`btn ${activeTab === "stock" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("stock")}>
            <Package size={18} /> {isRtl ? "المخزون الحالي" : "Current Stock"}
          </button>
          <button className={`btn ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("history")}>
            <History size={18} /> {isRtl ? "سجل التسليمات" : "Handout Log"}
          </button>
        </div>
      </div>

      {activeTab === "stock" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Stock Actions & Search */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexDirection: isRtl ? "row" : "row-reverse" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={18} style={{
                  position: "absolute",
                  right: isRtl ? 12 : "auto",
                  left: !isRtl ? 12 : "auto",
                  top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
                }} />
                <input 
                  className="input" 
                  placeholder={isRtl ? "البحث في الأصول..." : "Search assets..."} 
                  style={{
                    paddingRight: isRtl ? 40 : 12,
                    paddingLeft: !isRtl ? 40 : 12,
                    textAlign: isRtl ? "right" : "left"
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={() => setShowHandoutModal(true)}>
                <ClipboardList size={18} /> {isRtl ? "تسليم عهدة (جديد)" : "New Handout"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
                <PlusCircle size={18} /> {isRtl ? "إضافة أصل جديد" : "Add New Asset"}
              </button>
            </div>
          </div>

          {/* Stock Grid */}
          <div className="grid-3 stagger">
            {filteredStock.map(item => {
              const isLow = item.current_stock <= item.min_stock;
              return (
                <div key={item.id} className={`card ${isLow ? 'animate-pulse' : ''}`} style={{ 
                  borderColor: isLow ? 'var(--red)' : 'var(--border)',
                  textAlign: isRtl ? "right" : "left"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <div className={`badge ${isLow ? 'badge-red' : 'badge-blue'}`}>
                      {getTranslatedCategory(item.category, isRtl)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{item.id}</span>
                      <button 
                        onClick={() => handleDeleteAsset(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0 }}
                        title={isRtl ? "حذف الأصل" : "Delete Asset"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 style={{ marginBottom: 4 }}>{getTranslatedAssetName(item.name, isRtl)}</h3>
                  
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16, flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <span style={{ fontSize: "2rem", fontWeight: 800, color: isLow ? 'var(--red)' : 'var(--accent)' }}>
                      {item.current_stock}
                    </span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                      {getTranslatedUnit(item.unit, isRtl)} {isRtl ? "متوفر" : "available"}
                    </span>
                  </div>

                  <div className="progress-bar" style={{ marginBottom: 12, height: 8 }}>
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.min(100, (item.current_stock / (item.min_stock * 3)) * 100)}%`,
                        background: isLow ? 'var(--red)' : 'var(--accent)'
                      }} 
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16, flexDirection: isRtl ? "row" : "row-reverse" }}>
                    <span>{isRtl ? "الحد الأدنى:" : "Min Limit:"} {item.min_stock}</span>
                    {isLow && <span style={{ color: "var(--red)", fontWeight: 700 }}>⚠️ {isRtl ? "مخزون منخفض" : "Low Stock"}</span>}
                  </div>

                  <button className="btn btn-secondary btn-full btn-sm" onClick={() => setShowRestockModal(item)}>
                    <ArrowUp size={14} /> {isRtl ? "إضافة للمخزون" : "Restock"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* History Search */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={18} style={{
                position: "absolute",
                right: isRtl ? 12 : "auto",
                left: !isRtl ? 12 : "auto",
                top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"
              }} />
              <input 
                className="input" 
                placeholder={isRtl ? "البحث باسم الموظف أو الأصل..." : "Search by operator name or item..."} 
                style={{
                  paddingRight: isRtl ? 40 : 12,
                  paddingLeft: !isRtl ? 40 : 12,
                  textAlign: isRtl ? "right" : "left"
                }}
                value={handoutSearch}
                onChange={(e) => setHandoutSearch(e.target.value)}
              />
            </div>
          </div>

          {/* History Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrapper" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "التاريخ" : "Date"}</th>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الموظف" : "Operator"}</th>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الأصل" : "Asset"}</th>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الكمية" : "Qty"}</th>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "سلمت بواسطة" : "Handed By"}</th>
                    <th style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHandouts.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                        {isRtl ? "لا توجد سجلات تسليم حالياً" : "No handout logs found"}
                      </td>
                    </tr>
                  ) : (
                    filteredHandouts.map(h => (
                      <tr key={h.id}>
                        <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>{h.handout_date}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>
                              {h.employee_name[0]}
                            </div>
                            {h.employee_name}
                          </div>
                        </td>
                        <td><span className="badge badge-gray">{getTranslatedAssetName(h.equipment_name, isRtl)}</span></td>
                        <td style={{ fontWeight: 700 }}>{h.quantity} {getTranslatedUnit(h.unit, isRtl)}</td>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{h.handed_by}</td>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{h.notes || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Handout */}
      {showHandoutModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{ margin: 0 }}>{isRtl ? "تسليم عهدة جديدة" : "Handout Safety Gear / PPE"}</h3>
              <button className="btn-close" onClick={() => setShowHandoutModal(false)}>✕</button>
            </div>
            <form onSubmit={handleHandout} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "اختر الموظف" : "Select Operator"}</label>
                <select 
                  className="input" 
                  value={handoutForm.employee_id} 
                  onChange={e => setHandoutForm({...handoutForm, employee_id: e.target.value})}
                  required
                >
                  <option value="">-- {isRtl ? "اختر موظف" : "Select Operator"} --</option>
                  {users.map(u => (
                    <option key={u.employee_id} value={u.employee_id}>{u.full_name} ({u.employee_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الأصل / المستلزم" : "Asset / Safety Item"}</label>
                  <select 
                    className="input" 
                    value={handoutForm.equipment_id} 
                    onChange={e => setHandoutForm({...handoutForm, equipment_id: e.target.value})}
                    required
                  >
                    <option value="">-- {isRtl ? "اختر" : "Select Item"} --</option>
                    {equipmentStock.map(item => (
                      <option key={item.id} value={item.id} disabled={item.current_stock <= 0}>
                        {getTranslatedAssetName(item.name, isRtl)} ({item.current_stock} {isRtl ? "متوفر" : "available"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الكمية" : "Quantity"}</label>
                  <input 
                    type="number" 
                    className="input" 
                    min="1" 
                    value={handoutForm.quantity}
                    onChange={e => setHandoutForm({...handoutForm, quantity: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "ملاحظات (اختياري)" : "Notes (Optional)"}</label>
                <textarea 
                  className="input" 
                  rows="2" 
                  value={handoutForm.notes}
                  onChange={e => setHandoutForm({...handoutForm, notes: e.target.value})}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{isRtl ? "تأكيد التسليم" : "Confirm Handout"}</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowHandoutModal(false)}>{isRtl ? "إلغاء" : "Cancel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Asset */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{ margin: 0 }}>{isRtl ? "إضافة أصل جديد للمخزن" : "Add New Asset to Stock"}</h3>
              <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddAsset} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "اسم الأصل (مثلاً: قفازات حرارية)" : "Asset Name (e.g., Thermal Gloves)"}</label>
                <input 
                  className="input" 
                  value={newAssetForm.name}
                  onChange={e => setNewAssetForm({...newAssetForm, name: e.target.value})}
                  required 
                />
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الفئة" : "Category"}</label>
                  <select 
                    className="input" 
                    value={newAssetForm.category}
                    onChange={e => setNewAssetForm({...newAssetForm, category: e.target.value})}
                  >
                    <option value="حماية">{isRtl ? "حماية (PPE)" : "Protection (PPE)"}</option>
                    <option value="ملابس">{isRtl ? "ملابس عمل" : "Uniforms"}</option>
                    <option value="أدوات">{isRtl ? "أدوات ومعدات" : "Tools & Gear"}</option>
                    <option value="قرطاسية">{isRtl ? "قرطاسية" : "Stationery"}</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الوحدة" : "Unit"}</label>
                  <select 
                    className="input" 
                    value={newAssetForm.unit}
                    onChange={e => setNewAssetForm({...newAssetForm, unit: e.target.value})}
                  >
                    <option value="زوج">{isRtl ? "زوج" : "Pair"}</option>
                    <option value="قطعة">{isRtl ? "قطعة" : "Piece"}</option>
                    <option value="كرتون">{isRtl ? "كرتون" : "Box"}</option>
                    <option value="حزمة">{isRtl ? "حزمة" : "Pack"}</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "الكمية الابتدائية" : "Initial Quantity"}</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={newAssetForm.current_stock}
                    onChange={e => setNewAssetForm({...newAssetForm, current_stock: e.target.value})}
                    required 
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>{isRtl ? "حد إعادة الطلب" : "Reorder Point"}</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={newAssetForm.min_stock}
                    onChange={e => setNewAssetForm({...newAssetForm, min_stock: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{isRtl ? "إضافة للمخزن" : "Add to Stock"}</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>{isRtl ? "إلغاء" : "Cancel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Restock */}
      {showRestockModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ flexDirection: isRtl ? "row" : "row-reverse" }}>
              <h3 style={{ margin: 0 }}>{isRtl ? "تزويد المخزون" : "Restock Asset"}</h3>
              <button className="btn-close" onClick={() => setShowRestockModal(null)}>✕</button>
            </div>
            <form onSubmit={handleRestock} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{getTranslatedAssetName(showRestockModal.name, isRtl)}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {isRtl ? "المخزون الحالي:" : "Current Stock:"} {showRestockModal.current_stock} {getTranslatedUnit(showRestockModal.unit, isRtl)}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ textAlign: isRtl ? "right" : "left" }}>
                  {isRtl ? "الكمية المضافة" : "Quantity Added"} ({getTranslatedUnit(showRestockModal.unit, isRtl)})
                </label>
                <input 
                  type="number" 
                  className="input input-lg" 
                  style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 800 }}
                  min="1" 
                  value={restockQty}
                  onChange={e => setRestockQty(e.target.value)}
                  autoFocus
                  required 
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8, flexDirection: isRtl ? "row" : "row-reverse" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{isRtl ? "تأكيد الزيادة" : "Confirm Restock"}</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRestockModal(null)}>{isRtl ? "إلغاء" : "Cancel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AssetsPage() {
  const { language } = useApp();
  const isRtl = language === "ar";
  return (
    <div className="page-container animate-fade" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <AssetsPanel />
    </div>
  );
}
