import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import AssessorCockpitV2 from "./pages/AssessorCockpitV2";
const Auth = lazy(() => import("./pages/Auth"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Users = lazy(() => import("./pages/Users"));
const Atualizacao = lazy(() => import("./pages/Atualizacao"));
const Consorcios = lazy(() => import("./pages/Consorcios"));
const Chat = lazy(() => import("./pages/Chat"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const PerformanceDash = lazy(() => import("./pages/PerformanceDash"));
const ProductsDashboard = lazy(() => import("./pages/ProductsDashboard"));
const WeeklyEffortsDash = lazy(() => import("./pages/WeeklyEffortsDash"));
const ManagementDash = lazy(() => import("./pages/ManagementDash"));
const AdvisorsDash = lazy(() => import("./pages/AdvisorsDash"));
const Seguros = lazy(() => import("./pages/Seguros"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const HeaderWrapper = () => {
  const location = useLocation();
  const isChatPage = location.pathname === "/chat";
  return !isChatPage ? <Header /> : null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <HeaderWrapper />
          <Suspense
            fallback={<LoadingOverlay isLoading={true} />}
          >
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]}>
                    <Welcome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/atualizacao"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <Atualizacao />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bi-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <Navigate to="/atualizacao" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consorcios"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "consorcio"]}>
                    <Consorcios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seguros"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "seguros"]}>
                    <Seguros />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider"]}>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]}>
                    <DashboardHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/comercial"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider"]}>
                    <PerformanceDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/produtos"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "produtos", "seguros"]}>
                    <ProductsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/esforco-semanal"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]}>
                    <WeeklyEffortsDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/gerencial"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                    <ManagementDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/meu-cockpit"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "produtos"]}>
                    <AssessorCockpitV2 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/advisors"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]} allowedUserCodes={["A39869"]}>
                    <AdvisorsDash />
                  </ProtectedRoute>
                }
              />
              <Route path="/tv/esforco-semanal" element={<WeeklyEffortsDash />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
