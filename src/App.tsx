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
import { ADVISORS_VIEWER_CODE } from "@/lib/access";
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

const ADVISORS_ONLY_BLOCK = [ADVISORS_VIEWER_CODE];

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
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Welcome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/atualizacao"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Atualizacao />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bi-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Navigate to="/atualizacao" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consorcios"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "consorcio"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Consorcios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seguros"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "seguros"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Seguros />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]} allowedUserCodes={[ADVISORS_VIEWER_CODE]}>
                    <DashboardHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/comercial"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <PerformanceDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/produtos"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "produtos", "seguros"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <ProductsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/esforco-semanal"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio", "marketing", "produtos", "seguros"]} allowedUserCodes={[ADVISORS_VIEWER_CODE]}>
                    <WeeklyEffortsDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/gerencial"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <ManagementDash />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/meu-cockpit"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "produtos"]} blockedUserCodes={ADVISORS_ONLY_BLOCK}>
                    <AssessorCockpitV2 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dash/advisors"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]} allowedUserCodes={[ADVISORS_VIEWER_CODE]}>
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
