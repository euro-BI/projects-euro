import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowedUserCodes?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles, allowedUserCodes }: ProtectedRouteProps) => {
  const { user, loading, userRole, userCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hasRoleAccess = !allowedRoles || (userRole ? allowedRoles.includes(userRole) : false);
  const hasCodeAccess = !!allowedUserCodes?.includes(userCode ?? "");
  const hasAccess = hasRoleAccess || hasCodeAccess;

  useEffect(() => {
    if (!loading && !user) {
      // Save the current location to redirect back after login
      navigate("/auth", { 
        state: { from: location.pathname + location.search } 
      });
    } else if (!loading && user && (allowedRoles || allowedUserCodes) && !hasAccess) {
      toast.error("Você não tem permissão para acessar esta página.");
      navigate("/"); // Agora todos redirecionam para a home (Welcome)
    }
  }, [user, loading, hasAccess, allowedRoles, allowedUserCodes, navigate, location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || ((allowedRoles || allowedUserCodes) && !hasAccess)) {
    return null;
  }

  return <>{children}</>;
};
