import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Don't navigate here - let the Auth component handle navigation
    // based on the intended destination
    
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
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
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
