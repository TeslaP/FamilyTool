import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { MonthProvider } from "./hooks/useMonthParam";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Import } from "./pages/Import";
import { Review } from "./pages/Review";
import { Forecast } from "./pages/Forecast";
import { DashboardDrilldown } from "./pages/DashboardDrilldown";
import { Session } from "./pages/Session";
import { SessionHistory } from "./pages/SessionHistory";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/session" element={<ProtectedRoute><Session /></ProtectedRoute>} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<Import />} />
        <Route path="/review" element={<Review />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/reflections" element={<SessionHistory />} />
        <Route path="/drilldown" element={<DashboardDrilldown />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MonthProvider>
          <AppRoutes />
        </MonthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
