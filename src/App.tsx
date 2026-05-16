import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { ReportBugButton } from "@/components/ReportBugButton";
const Auth = lazy(() => import("./pages/Auth"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectActivities = lazy(() => import("./pages/ProjectActivities"));
const DashboardManagement = lazy(() => import("./pages/DashboardManagement"));
const Users = lazy(() => import("./pages/Users"));
const BIDashboard = lazy(() => import("./pages/BIDashboard"));
const Consorcios = lazy(() => import("./pages/Consorcios"));
const Chat = lazy(() => import("./pages/Chat"));
const PowerBIEmbedPage = lazy(() => import("./pages/Powerbiembed"));
const TVPresentations = lazy(() => import("./pages/TVPresentations"));
const TVPublished = lazy(() => import("./pages/TVPublished"));
const TVPresentationViewer = lazy(() => import("./pages/TVPresentationViewer"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const PerformanceDash = lazy(() => import("./pages/PerformanceDash"));
const ProductsDashboard = lazy(() => import("./pages/ProductsDashboard"));
const MarketingDash = lazy(() => import("./pages/MarketingDash"));
const ManagementDash = lazy(() => import("./pages/ManagementDash"));
const AssessorCockpit = lazy(() => import("./pages/AssessorCockpit"));
const AdvisorsDash = lazy(() => import("./pages/AdvisorsDash"));
const Seguros = lazy(() => import("./pages/Seguros"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MigrationTest = lazy(() => import("./components/MigrationTest").then(m => ({ default: m.MigrationTest })));
const ProjectsDebugTest = lazy(() => import("./components/ProjectsDebugTest").then(m => ({ default: m.ProjectsDebugTest })));
const InsertTestData = lazy(() => import("./components/InsertTestData").then(m => ({ default: m.InsertTestData })));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const HeaderWrapper = () => {
  const location = useLocation();
  const isChatPage = location.pathname === "/chat";
  const isTVViewerPage = location.pathname.startsWith("/tv-viewer");
  return !isChatPage && !isTVViewerPage ? <Header /> : null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <HeaderWrapper />
          <ReportBugButton />
          <Suspense
            fallback={
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              </div>
            }
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
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                    <Projects />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                    <ProjectActivities />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-management"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <DashboardManagement />
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
                path="/bi-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <BIDashboard />
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
                path="/powerbi"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <PowerBIEmbedPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tv-presentations"
                element={
                  <ProtectedRoute allowedRoles={["admin_master"]}>
                    <TVPresentations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tv-published"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                    <TVPublished />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tv-viewer/:id"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "user", "lider", "consorcio"]}>
                    <TVPresentationViewer />
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
                path="/dash/marketing"
                element={
                  <ProtectedRoute allowedRoles={["admin_master", "admin", "marketing"]}>
                    <MarketingDash />
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
                    <AssessorCockpit />
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
              <Route
                path="/migration-test"
                element={
                  <div className="container mx-auto p-6">
                    <MigrationTest />
                    <ProjectsDebugTest />
                    <InsertTestData />
                  </div>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
