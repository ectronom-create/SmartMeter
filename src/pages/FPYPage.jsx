import FPYDashboard from "../components/FPYDashboard";
import { useApp } from "../context/AppContext";

export default function FPYPage() {
  const { language } = useApp();
  const isRtl = language === "ar";

  return (
    <div className="page-container" style={{ direction: isRtl ? "rtl" : "ltr" }}>
      <FPYDashboard />
    </div>
  );
}
