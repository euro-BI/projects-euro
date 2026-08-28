import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowedUserCodes?: string[];
  blockedUserCodes?: string[];
}

function matchesCode(userCode: string | null, codes?: string[]) {
  if (!userCode || !codes?.length) return false;
  const normalized = userCode.trim().toUpperCase();
  return codes.some((code) => code.trim().toUpperCase() === normalized);
}

export const ProtectedRoute = ({ children, allowedRoles, allowedUserCodes, blockedUserCodes }: ProtectedRouteProps) => {
  const { user, loading, userRole, userCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isBlocked = matchesCode(userCode, blockedUserCodes);
  const hasRoleAccess = !allowedRoles || (userRole ? allowedRoles.includes(userRole) : false);
  const hasCodeAccess = matchesCode(userCode, allowedUserCodes);
  const hasAccess = !isBlocked && (hasRoleAccess || hasCodeAccess);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/auth", {
        replace: true,
        state: { from: location.pathname + location.search },
      });
      return;
    }

    if ((allowedRoles || allowedUserCodes || blockedUserCodes) && !hasAccess) {
      navigate(isBlocked ? "/dash" : "/", { replace: true });
    }
  }, [user, loading, hasAccess, isBlocked, allowedRoles, allowedUserCodes, blockedUserCodes, navigate, location]);

  if (loading) {
    return <LoadingOverlay isLoading={true} />;
  }

  if (!user || ((allowedRoles || allowedUserCodes || blockedUserCodes) && !hasAccess)) {
    return null;
  }

  return <>{children}</>;
};
