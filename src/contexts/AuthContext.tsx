import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  isActive: boolean | null;
  userCode: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const requestIdRef = useRef(0);

  const clearUserDetails = () => {
    setUserRole(null);
    setIsActive(null);
    setUserCode(null);
  };

  const fetchUserAuthDetails = async (userId: string, requestId: number) => {
    setDetailsLoading(true);
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.from("projects_user_roles").select("role").eq("user_id", userId).single(),
        supabase.from("projects_profiles").select("is_active, codigo").eq("id", userId).single(),
      ]);

      if (requestIdRef.current !== requestId) return;

      if (roleRes.error) {
        console.error("Erro ao buscar role do usuário:", roleRes.error);
        setUserRole(null);
      } else {
        setUserRole(roleRes.data?.role ?? null);
      }

      if (profileRes.error) {
        console.error("Erro ao buscar status de atividade do usuário:", profileRes.error);
        setIsActive(null);
        setUserCode(null);
      } else {
        const active = profileRes.data?.is_active ?? null;
        const code = profileRes.data?.codigo ?? null;
        setIsActive(active);
        setUserCode(code);
        if (active === false) {
          toast.error("Sua conta está inativa. Por favor, entre em contato com o administrador.");
          await signOut();
        }
      }
    } finally {
      if (requestIdRef.current === requestId) setDetailsLoading(false);
    }
  };

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    const requestId = ++requestIdRef.current;

    if (!nextSession?.user) {
      clearUserDetails();
      setDetailsLoading(false);
      return;
    }

    await fetchUserAuthDetails(nextSession.user.id, requestId);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
      setInitialized(true);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
      setInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    try {
      // Tenta sair globalmente (notifica o servidor)
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        // Se houver erro (ex: sessão já inválida ou expirada), força logout local
        console.warn("Erro ao sair (tentando logout local):", error);
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (err) {
      console.error("Erro inesperado ao sair:", err);
      // Fallback para logout local em caso de exceção
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.error("Falha ao limpar sessão local:", e);
      }
    } finally {
      requestIdRef.current += 1;
      setDetailsLoading(false);
      // Garante que limpamos a sessão local no estado do React
      setUser(null);
      setSession(null);
      clearUserDetails();
      
      // Limpa explicitamente o localStorage caso o Supabase não tenha feito
      // Isso ajuda a evitar que o Auth.tsx redirecione de volta se detectar algo
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase.auth.token')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      navigate("/auth", { replace: true });
      toast.success("Sessão encerrada com sucesso");
    }
  };

  const loading = !initialized || detailsLoading;

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isActive, userCode, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
