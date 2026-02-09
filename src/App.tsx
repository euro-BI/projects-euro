import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { MigrationTest } from "@/components/MigrationTest";
import { ProjectsDebugTest } from "@/components/ProjectsDebugTest";
import { InsertTestData } from "@/components/InsertTestData";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectActivities from "./pages/ProjectActivities";
import Users from "./pages/Users";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import BIDashboard from "./pages/BIDashboard";
import InvestmentOffers from "./pages/InvestmentOffers";
import Consorcios from "./pages/Consorcios";
import Chat from "./pages/Chat";
import PowerBIEmbedPage from "./pages/Powerbiembed";
import DashboardManagement from "./pages/DashboardManagement";

const queryClient = new QueryClient();

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
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
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
              path="/investment-offers"
              element={
                <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                  <InvestmentOffers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/consorcios"
              element={
                <ProtectedRoute allowedRoles={["admin_master", "admin"]}>
                  <Consorcios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute allowedRoles={["admin_master", "admin", "user"]}>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/powerbi"
              element={
                <ProtectedRoute allowedRoles={["admin_master", "admin", "user"]}>
                  <PowerBIEmbedPage />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
