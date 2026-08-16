import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

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
    if (loading) return;

    if (!user) {
      navigate("/auth", {
        replace: true,
        state: { from: location.pathname + location.search },
      });
      return;
    }

    if ((allowedRoles || allowedUserCodes) && !hasAccess) {
      navigate("/", { replace: true });
    }
  }, [user, loading, hasAccess, allowedRoles, allowedUserCodes, navigate, location]);

  if (loading) {
    return <LoadingOverlay isLoading={true} />;
  }

  if (!user || ((allowedRoles || allowedUserCodes) && !hasAccess)) {
    return null;
  }

  return <>{children}</>;
};
