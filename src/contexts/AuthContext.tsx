import { createContext, useContext, useEffect, useState } from "react";
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
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const fetchUserAuthDetails = async (userId: string) => {
    // Fetch user role
    const { data: roleData, error: roleError } = await supabase
      .from("projects_user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError) {
      console.error("Erro ao buscar role do usuário:", roleError);
      setUserRole(null);
    } else if (roleData) {
      setUserRole(roleData.role);
    } else {
      setUserRole(null);
    }

    // Fetch user active status from projects_profiles
    const { data: profileData, error: profileError } = await supabase
      .from("projects_profiles")
      .select("is_active")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Erro ao buscar status de atividade do usuário:", profileError);
      setIsActive(null);
    } else if (profileData) {
      setIsActive(profileData.is_active);
      if (!profileData.is_active) {
        toast.error("Sua conta está inativa. Por favor, entre em contato com o administrador.");
        await signOut(); // Força o logout se o usuário estiver inativo
      }
    } else {
      setIsActive(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchUserAuthDetails(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchUserAuthDetails(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        fetchUserAuthDetails(user.id);
      }
    }
    
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
      // Garante que limpamos a sessão local no estado do React
      setUser(null);
      setSession(null);
      setUserRole(null); // Limpa a role do usuário
      
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

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isActive, signIn, signOut }}>
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
