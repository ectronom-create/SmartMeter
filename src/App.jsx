import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Topbar from "./components/Topbar";
import LoginPage from "./pages/LoginPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import WorkspacePage from "./pages/WorkspacePage";
import DefectsPage from "./pages/DefectsPage";
import AdminPage from "./pages/AdminPage";
import SupervisorPage from "./pages/SupervisorPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import AssetsPage from "./pages/AssetsPage";
import StartOfProductionPage from "./pages/StartOfProductionPage";
import ForceChangePassword from "./pages/ForceChangePassword";
import FPYPage from "./pages/FPYPage";
import MaintenancePage from "./pages/MaintenancePage";


function isPanelAllowed(currentUser, panelId) {
  if (!currentUser) return false;
  if (currentUser.role !== "admin") return true;
  if (currentUser.employee_id === "ADMIN-001") return true;
  if (!currentUser.allowed_panels) return true;
  try {
    const parsed = typeof currentUser.allowed_panels === 'string'
      ? JSON.parse(currentUser.allowed_panels)
      : currentUser.allowed_panels;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.includes(panelId);
    }
  } catch (e) {
    if (typeof currentUser.allowed_panels === 'string') {
      return currentUser.allowed_panels.split(',').includes(panelId);
    }
  }
  return true;
}

function ProtectedRoute({ children, adminOnly = false, supervisorOnly = false, defectsPage = false, panelId = null }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (adminOnly && currentUser.role !== "admin") return <Navigate to="/dashboard" replace />;
  if (supervisorOnly && !["admin", "supervisor"].includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
  if (defectsPage && !["admin", "supervisor", "quality_management"].includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
  
  if (currentUser.role === "admin" && panelId && !isPanelAllowed(currentUser, panelId)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function AppRoutes() {
  const { currentUser } = useApp();

  const defaultRoute = () => {
    if (!currentUser) return "/login";
    if (currentUser.role === "admin") return "/admin";
    if (currentUser.role === "supervisor") return "/dashboard";
    if (currentUser.role === "quality_management") return "/defects";
    return "/dashboard";
  };

  if (currentUser && currentUser.must_change_password) {
    return (
      <main style={{ flex: 1 }}>
        <ForceChangePassword />
      </main>
    );
  }

  return (
    <>
      {currentUser && <Topbar />}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/login" element={
            currentUser ? <Navigate to={defaultRoute()} replace /> : <LoginPage />
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
          } />
          <Route path="/supervisor" element={
            <ProtectedRoute supervisorOnly><SupervisorPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><EmployeeDashboard /></ProtectedRoute>
          } />
          <Route path="/workspace" element={
            <ProtectedRoute><WorkspacePage /></ProtectedRoute>
          } />
          <Route path="/defects" element={
            <ProtectedRoute defectsPage panelId="defects"><DefectsPage /></ProtectedRoute>
          } />
          <Route path="/knowledge" element={
            <ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>
          } />
          <Route path="/assets" element={
            <ProtectedRoute adminOnly panelId="assets"><AssetsPage /></ProtectedRoute>
          } />
          <Route path="/start-production" element={
            <ProtectedRoute supervisorOnly><StartOfProductionPage /></ProtectedRoute>
          } />
          <Route path="/fpy-overview" element={
            <ProtectedRoute panelId="overview"><FPYPage /></ProtectedRoute>
          } />
          <Route path="/maintenance" element={
            <ProtectedRoute panelId="maintenance"><MaintenancePage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to={defaultRoute()} replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
