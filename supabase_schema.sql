-- =========================================================================
--  Smart Meter Production MES — Supabase PostgreSQL Database Schema
--  Run this in your Supabase SQL Editor to set up all tables & seed data.
-- =========================================================================

-- 1. CLEAN CLEANUP (Drop tables if they exist)
DROP TABLE IF EXISTS sop_report_items CASCADE;
DROP TABLE IF EXISTS sop_reports CASCADE;
DROP TABLE IF EXISTS equipment_handouts CASCADE;
DROP TABLE IF EXISTS equipment_stock CASCADE;
DROP TABLE IF EXISTS defective_meters CASCADE;
DROP TABLE IF EXISTS error_codes CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS production_stages CASCADE;
DROP TABLE IF EXISTS shift_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. CREATE SYSTEM TABLES

-- Users
CREATE TABLE users (
    employee_id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'admin', 'supervisor', 'operator'
    password_hash VARCHAR(150) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone VARCHAR(50),
    email VARCHAR(100)
);

-- Shift Types
CREATE TABLE shift_types (
    shift_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1'
);

-- Production Stages
CREATE TABLE production_stages (
    stage_id VARCHAR(50) PRIMARY KEY,
    stage_name VARCHAR(150) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NOT NULL DEFAULT '⚙️',
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    instructions TEXT[] NOT NULL DEFAULT '{}',
    troubleshooting JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules
CREATE TABLE schedules (
    id VARCHAR(100) PRIMARY KEY,
    schedule_date DATE NOT NULL,
    shift_id VARCHAR(50) REFERENCES shift_types(shift_id) ON DELETE CASCADE,
    employee_id VARCHAR(50) REFERENCES users(employee_id) ON DELETE CASCADE,
    stage_id VARCHAR(50) REFERENCES production_stages(stage_id) ON DELETE CASCADE,
    is_team_leader BOOLEAN NOT NULL DEFAULT FALSE,
    is_supervisor BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Error Codes
CREATE TABLE error_codes (
    code VARCHAR(50) NOT NULL,
    stage_id VARCHAR(50) REFERENCES production_stages(stage_id) ON DELETE CASCADE,
    title_ar VARCHAR(150) NOT NULL,
    title_en VARCHAR(150) NOT NULL,
    description TEXT,
    troubleshooting_steps TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (code, stage_id)
);

-- Defective Meters
CREATE TABLE defective_meters (
    id VARCHAR(100) PRIMARY KEY,
    serial_number VARCHAR(100) NOT NULL,
    error_code VARCHAR(50) NOT NULL,
    stage_found VARCHAR(50) REFERENCES production_stages(stage_id) ON DELETE CASCADE,
    reported_by VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'reported', -- 'reported', 'pending', 'verified', 'resolved'
    custom_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    action_taken TEXT
);

-- Equipment Stock
CREATE TABLE equipment_stock (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Equipment Handouts
CREATE TABLE equipment_handouts (
    id VARCHAR(100) PRIMARY KEY,
    equipment_id VARCHAR(50) REFERENCES equipment_stock(id) ON DELETE CASCADE,
    equipment_name VARCHAR(150) NOT NULL,
    employee_id VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    employee_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,
    handout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    handed_by VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    notes TEXT,
    returned_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOP Reports
CREATE TABLE sop_reports (
    id VARCHAR(100) PRIMARY KEY,
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    line VARCHAR(50) NOT NULL,
    comment TEXT,
    team_leader_signature VARCHAR(150),
    quality_leader_signature VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOP Report Items
CREATE TABLE sop_report_items (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) REFERENCES sop_reports(id) ON DELETE CASCADE,
    stage_id VARCHAR(50) REFERENCES production_stages(stage_id) ON DELETE CASCADE,
    compliant BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = OK, FALSE = NOK
    no_conformity_detail TEXT,
    analysis_action TEXT,
    responsible VARCHAR(150),
    signed_by_team_leader BOOLEAN NOT NULL DEFAULT FALSE,
    signed_by_quality_leader BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS) FOR FULL COMPLIANCE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE defective_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_handouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_report_items ENABLE ROW LEVEL SECURITY;

-- 4. CONFIGURE SYSTEM-WIDE PERMISSIVE POLICIES (Standard for initial integration)
CREATE POLICY "Enable all read access for users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable all write access for users" ON users FOR ALL USING (true);

CREATE POLICY "Enable all read access for shift_types" ON shift_types FOR SELECT USING (true);
CREATE POLICY "Enable all write access for shift_types" ON shift_types FOR ALL USING (true);

CREATE POLICY "Enable all read access for production_stages" ON production_stages FOR SELECT USING (true);
CREATE POLICY "Enable all write access for production_stages" ON production_stages FOR ALL USING (true);

CREATE POLICY "Enable all read access for schedules" ON schedules FOR SELECT USING (true);
CREATE POLICY "Enable all write access for schedules" ON schedules FOR ALL USING (true);

CREATE POLICY "Enable all read access for error_codes" ON error_codes FOR SELECT USING (true);
CREATE POLICY "Enable all write access for error_codes" ON error_codes FOR ALL USING (true);

CREATE POLICY "Enable all read access for defective_meters" ON defective_meters FOR SELECT USING (true);
CREATE POLICY "Enable all write access for defective_meters" ON defective_meters FOR ALL USING (true);

CREATE POLICY "Enable all read access for equipment_stock" ON equipment_stock FOR SELECT USING (true);
CREATE POLICY "Enable all write access for equipment_stock" ON equipment_stock FOR ALL USING (true);

CREATE POLICY "Enable all read access for equipment_handouts" ON equipment_handouts FOR SELECT USING (true);
CREATE POLICY "Enable all write access for equipment_handouts" ON equipment_handouts FOR ALL USING (true);

CREATE POLICY "Enable all read access for sop_reports" ON sop_reports FOR SELECT USING (true);
CREATE POLICY "Enable all write access for sop_reports" ON sop_reports FOR ALL USING (true);

CREATE POLICY "Enable all read access for sop_report_items" ON sop_report_items FOR SELECT USING (true);
CREATE POLICY "Enable all write access for sop_report_items" ON sop_report_items FOR ALL USING (true);

-- 5. SEED INITIAL MOCK DATABASE
-- Seed Users
INSERT INTO users (employee_id, full_name, role, password_hash, phone, email) VALUES
('ADMIN-001', 'مدير النظام الرئيسي', 'admin', 'admin123', '+966500000001', 'admin@example.com'),
('EMP-001', 'أحمد محمد الزهراني', 'supervisor', 'supervisor123', '+966500000002', 'a.zahrani@example.com'),
('EMP-002', 'فاطمة علي الشمري', 'operator', 'pass1234', '+966500000003', 'f.shammari@example.com'),
('EMP-003', 'خالد عبدالله الحربي', 'operator', 'pass1234', '+966500000004', 'k.harbi@example.com'),
('EMP-004', 'منى سعد القحطاني', 'operator', 'pass1234', '+966500000005', 'm.qahtani@example.com'),
('EMP-005', 'يوسف إبراهيم العتيبي', 'operator', 'pass1234', '+966500000006', 'y.otaibi@example.com'),
('EMP-006', 'نورة محمد الدوسري', 'operator', 'pass1234', '+966500000007', 'n.dosari@example.com'),
('EMP-007', 'عمر سلطان الغامدي', 'operator', 'pass1234', '+966500000008', 'o.ghamdi@example.com'),
('EMP-008', 'ريم عبدالعزيز البلوي', 'operator', 'pass1234', '+966500000009', 'r.balawi@example.com'),
('EMP-009', 'ناصر حمد المطيري', 'operator', 'pass1234', '+966500000010', 'n.mutairi@example.com');

-- Seed Shift Types
INSERT INTO shift_types (shift_id, name, start_time, end_time, color) VALUES
('SHIFT-M', 'الصباحية (M)', '06:00:00', '14:00:00', '#f59e0b'),
('SHIFT-E', 'المسائية (E)', '14:00:00', '22:00:00', '#6366f1'),
('SHIFT-N', 'الليلية (N)', '22:00:00', '06:00:00', '#0ea5e9');

-- Seed Production Stages
INSERT INTO production_stages (stage_id, stage_name, short_name, icon, color, instructions, troubleshooting) VALUES
('STG-01', 'التجميع (Assembly)', 'تجميع', '⚙️', '#f97316', 
 ARRAY['التحقق من سلامة الهيكل الخارجي للعداد.', 'تركيب حامل البطاريات واللوحة الرئيسية.', 'تثبيت المسامير بعزم الدوران المحدد.'],
 '[{"problem": "تداخل في الهيكل", "solution": "تأكد من مسار الأسلاك الداخلية."}]'::jsonb),
('STG-02', 'العزل (Insulation)', 'عزل', '🛡️', '#4f46e5', 
 ARRAY['وضع العداد في حجرة اختبار العزل.', 'تطبيق جهد الاختبار (Hi-Pot) ومراقبة التسريب.'],
 '[{"problem": "فشل اختبار العزل", "solution": "تأكد من جفاف العداد وعدم وجود رطوبة."}]'::jsonb),
('STG-03', 'التردد اللاسلكي (Radio Frequency)', 'تردد', '📡', '#06b6d4', 
 ARRAY['توصيل هوائي الاختبار.', 'قياس قوة الإشارة (RSSI) وجودة الاتصال.'],
 '[{"problem": "ضعف الإشارة", "solution": "تأكد من لحام الهوائي ومصدر الطاقة."}]'::jsonb),
('STG-04', 'المعايرة (Calibration)', 'معايرة', '⚖️', '#10b981', 
 ARRAY['ضبط معاملات القياس (Meter Factors).', 'المقارنة مع المرجع المعتمد بدقة عالية.'],
 '[{"problem": "خطأ في المعايرة", "solution": "نظف نقاط التلامس وأعد ضبط المرجع."}]'::jsonb),
('STG-05', 'الاختبار المتعدد (Multi Test)', 'اختبار', '🧪', '#8b5cf6', 
 ARRAY['تشغيل سلسلة الاختبارات الآلية الشاملة.', 'التحقق من كافة وظائف العداد البرمجية.'],
 '[{"problem": "فشل الاختبار الوظيفي", "solution": "راجع سجل الأخطاء التقني (Log file)."}]'::jsonb),
('STG-06', 'التخصيص (Perso)', 'تخصيص', '🏷️', '#ec4899', 
 ARRAY['كتابة بيانات العميل والتعريفات الخاصة.', 'طباعة الملصق النهائي وتثبيته.'],
 '[{"problem": "خطأ في البيانات المكتوبة", "solution": "تأكد من ملف التخصيص (Perso file) الصحيح."}]'::jsonb),
('GLOBAL', 'عام (General)', 'عام', '🌐', '#6366f1', 
 ARRAY[]::TEXT[], 
 '[]'::jsonb),
('SUPERVISION', 'الإشراف (Supervision)', 'الإشراف', '👑', '#166534', 
 ARRAY[]::TEXT[], 
 '[]'::jsonb);

-- Seed Error Codes
INSERT INTO error_codes (code, stage_id, title_ar, title_en, description, troubleshooting_steps) VALUES
('-101', 'STG-01', 'خطأ SFC - فشل استرداد البيانات', 'SFC Error - Data Retrieval Failed', 'فشل استرداد بيانات التصنيع من نظام SFC.', ARRAY['تحقق من اتصال الشبكة بالسيرفر.', 'أعد مسح الباركود مرة أخرى.', 'تأكد أن السيريال نمبر مسجّل في نظام SAP.', 'إذا استمر الخطأ، أبلغ مشرف تقنية المعلومات.']),
('-576', 'STG-01', 'خطأ - فشل اتصال RS485', 'Error - RS485 Connection Failed', 'فشل التواصل المادي مع العداد عبر المنفذ.', ARRAY['افحص الكابل الرابط بين الجهاز والعداد.', 'تأكد من أن المنفذ COM مضبوط بشكل صحيح.', 'أعد تشغيل برنامج الاختبار.', 'جرّب كابلاً آخر إذا لم يُجدِ الحل.']),
('ASM-01', 'STG-01', 'خطأ في تركيب الهيكل', 'Housing Assembly Error', 'عدم انتظام في تثبيت الهيكل الخارجي.', ARRAY['تحقق من محاذاة اللوحة الرئيسية.', 'تأكد من إحكام جميع البراغي بعزم الدوران المحدد.', 'افحص وجود تشوه أو كسر في الهيكل.']),
('E201', 'STG-02', 'تسريب تيار كهربائي', 'Electrical Current Leakage', 'تجاوز قيمة تيار التسريب للحد المسموح به.', ARRAY['تأكد من جفاف العداد الكامل قبل الاختبار.', 'افحص العوازل البلاستيكية بحثاً عن شقوق أو تشويه.', 'نظّف نقاط التلامس من الرطوبة أو الأوساخ.', 'إذا فشل الاختبار مرتين متتاليتين، صنّف العداد كمعطوب.']),
('E202', 'STG-02', 'فشل اختبار Hi-Pot', 'Hi-Pot Test Failed', 'العداد لا يتحمل جهد الاختبار العالي.', ARRAY['تحقق من سلامة كافة نقاط العزل.', 'تأكد من عدم وجود رطوبة داخل العداد.', 'اعتمد إجراء التجفيف ثم أعد الاختبار.', 'راجع مواصفات جهد الاختبار المعتمدة.']),
('RF-01', 'STG-03', 'فشل الاتصال اللاسلكي', 'Wireless Communication Failure', 'العداد لا يتمكن من الاتصال بالشبكة اللاسلكية.', ARRAY['افحص لحام الهوائي على اللوحة.', 'قِس مستوى RSSI باستخدام أداة الاختبار المعتمدة.', 'تأكد من برمجة تردد الشبكة الصحيح.', 'استبدل وحدة الاتصال اللاسلكي إذا فشلت الحلول السابقة.']),
('RF-02', 'STG-03', 'ضعف شدة الإشارة (RSSI منخفض)', 'Low Signal Strength (Low RSSI)', 'قوة الإشارة اللاسلكية أقل من الحد الندنى.', ARRAY['تحقق من موضع الهوائي وزاويته.', 'افحص نقاط اللحام على مجمّع الهوائي.', 'جرّب نقل العداد لمنطقة أقوى إشارةً للاختبار.', 'راجع إعدادات قناة الإرسال.']),
('CAL-01', 'STG-04', 'خطأ معايرة الطاقة الفعّالة', 'Active Energy Calibration Error', 'انحراف في قراءة الطاقة الفعّالة عن القيمة المرجعية.', ARRAY['نظّف نقاط التلامس الكهربائية.', 'تأكد من ثبات مصدر الجهد المرجعي.', 'اضبط معامل التحويل في برنامج المعايرة.', 'أعد تشغيل عملية المعايرة من الصفر.']),
('CAL-02', 'STG-04', 'خطأ معايرة الطاقة التفاعلية', 'Reactive Energy Calibration Error', 'انحراف في قراءة الطاقة التفاعلية (KVAR).', ARRAY['تأكد من صحة اتصال دائرة القياس.', 'راجع معامل زاوية الطور (Phase Angle).', 'قارن مع معدات القياس المرجعية المعتمدة.']),
('MT-01', 'STG-05', 'فشل اختبار الذاكرة (Memory Test)', 'Memory Test Failure', 'فشل في اختبار ذاكرة Flash أو RAM.', ARRAY['أعد تشغيل الاختبار مرة واحدة.', 'افحص سجل الأخطاء التقني (Log file).', 'تحقق من صحة برنامج العداد (Firmware version).', 'إذا تكرر الفشل، استبدل اللوحة الرئيسية.']),
('MT-02', 'STG-05', 'فشل اختبار الشاشة (Display Test)', 'Display Test Failure', 'أجزاء من الشاشة لا تعمل أو تعرض أرقاماً خاطئة.', ARRAY['افحص كابل توصيل الشاشة.', 'تأكد من ثبات الشاشة داخل الهيكل.', 'اختبر الشاشة بقيم مختلفة من البرنامج.', 'استبدل الشاشة إذا تأكد العطل.']),
('MT-03', 'STG-05', 'فشل اختبار منع التلاعب (Anti-Tamper)', 'Anti-Tamper Test Failure', 'لا يستجيب العداد لمستشعر التلاعب بشكل صحيح.', ARRAY['افحص موضع مستشعر المغناطيس.', 'تأكد من صحة أسلاك المستشعر.', 'راجع الإعدادات البرمجية لمنع التلاعب.']),
('PS-01', 'STG-06', 'خطأ في كتابة بيانات التخصيص', 'Personalization Data Write Error', 'فشل كتابة بيانات العميل على ذاكرة العداد.', ARRAY['تأكد من صحة ملف التخصيص (Perso file).', 'تحقق من أن الذاكرة غير ممتلئة.', 'أعد محاولة الكتابة بعد تنظيف الذاكرة.', 'تحقق من حقوق الوصول للملف.']),
('PS-02', 'STG-06', 'خطأ في طباعة الملصق', 'Label Printing Error', 'الملصق النهائي لم يُطبع أو فيه بيانات غير صحيحة.', ARRAY['تحقق من اتصال الطابعة.', 'تأكد من صحة البيانات المرسلة للطابعة.', 'أعد تشغيل خدمة الطباعة.', 'استخدم ورق ملصقات جديد وتحقق من التوافق.']);

-- Seed Schedules
INSERT INTO schedules (id, schedule_date, shift_id, employee_id, stage_id, is_team_leader) VALUES
('SCH-001', CURRENT_DATE, 'SHIFT-M', 'EMP-002', 'STG-01', TRUE),
('SCH-002', CURRENT_DATE, 'SHIFT-M', 'EMP-003', 'STG-02', FALSE),
('SCH-003', CURRENT_DATE, 'SHIFT-M', 'EMP-004', 'STG-03', FALSE),
('SCH-004', CURRENT_DATE, 'SHIFT-M', 'EMP-005', 'STG-04', FALSE),
('SCH-005', CURRENT_DATE, 'SHIFT-M', 'EMP-006', 'STG-05', FALSE),
('SCH-006', CURRENT_DATE, 'SHIFT-M', 'EMP-007', 'STG-06', FALSE);

-- Seed Equipment Stock
INSERT INTO equipment_stock (id, name, category, unit, current_stock, min_stock) VALUES
('EQ-001', 'قفاز أمان', 'حماية', 'زوج', 50, 20),
('EQ-002', 'لثام جوتينغ', 'حماية', 'قطعة', 30, 15),
('EQ-003', 'نظارات واقية', 'حماية', 'قطعة', 40, 20),
('EQ-004', 'قميص عمل', 'ملابس', 'قطعة', 100, 40),
('EQ-005', 'سماعات حماية', 'حماية', 'زوج', 25, 10);

-- Seed Equipment Handouts
INSERT INTO equipment_handouts (id, equipment_id, equipment_name, employee_id, employee_name, quantity, unit, handout_date, handed_by, notes) VALUES
('HANDOUT-0001', 'EQ-001', 'قفاز أمان', 'EMP-001', 'أحمد محمد الزهراني', 2, 'زوج', CURRENT_DATE, 'ADMIN-001', 'تسليم دوري'),
('HANDOUT-0002', 'EQ-004', 'قميص عمل', 'EMP-002', 'فاطمة علي الشمري', 1, 'قطعة', CURRENT_DATE, 'ADMIN-001', 'موظف جديد');

-- Defect Logs / Movement History Log
CREATE TABLE defect_logs (
    id SERIAL PRIMARY KEY,
    defect_id VARCHAR(100) REFERENCES defective_meters(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'reported', 'status_change', 'deleted'
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    performed_by VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    performed_by_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE defect_logs ENABLE ROW LEVEL SECURITY;

-- Configure Policies
CREATE POLICY "Enable all read access for defect_logs" ON defect_logs FOR SELECT USING (true);
CREATE POLICY "Enable all write access for defect_logs" ON defect_logs FOR ALL USING (true);

