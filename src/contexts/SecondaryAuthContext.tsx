import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabaseSecondary } from "@/integrations/supabase/clients";
import { toast } from "sonner";

interface SecondaryAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
}

const SecondaryAuthContext = createContext<SecondaryAuthContextType | undefined>(undefined);

export const SecondaryAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener for secondary instance
    const {
      data: { subscription },
    } = supabaseSecondary.auth.onAuthStateChange((event, session) => {
      console.log('Secondary auth state change:', event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session in secondary instance
    supabaseSecondary.auth.getSession().then(({ data: { session } }) => {
      console.log('Secondary existing session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabaseSecondary.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        toast.success("Login realizado com sucesso na instância secundária!");
      }
      
      return { error };
    } catch (error) {
      console.error("Erro no login da instância secundária:", error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { error } = await supabaseSecondary.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      
      if (!error) {
        toast.success("Cadastro realizado com sucesso na instância secundária!");
      }
      
      return { error };
    } catch (error) {
      console.error("Erro no cadastro da instância secundária:", error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Tenta sair globalmente da instância secundária
      const { error } = await supabaseSecondary.auth.signOut();
      
      if (error) {
        console.warn("Erro ao sair da instância secundária (tentando logout local):", error);
        await supabaseSecondary.auth.signOut({ scope: 'local' });
      } else {
        toast.success("Logout realizado com sucesso da instância secundária!");
      }
    } catch (err) {
      console.error("Erro inesperado ao sair da instância secundária:", err);
      try {
        await supabaseSecondary.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.error("Falha ao limpar sessão secundária local:", e);
      }
    } finally {
      // Garante que limpamos a sessão local no estado do React
      setUser(null);
      setSession(null);
    }
  };

  return (
    <SecondaryAuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signIn, 
      signOut, 
      signUp 
    }}>
      {children}
    </SecondaryAuthContext.Provider>
  );
};

export const useSecondaryAuth = () => {
  const context = useContext(SecondaryAuthContext);
  if (context === undefined) {
    throw new Error("useSecondaryAuth must be used within a SecondaryAuthProvider");
  }
  return context;
};

// Hook para verificar se o usuário está autenticado em ambas as instâncias
export const useDualAuth = () => {
  const primaryAuth = useContext(require("@/contexts/AuthContext").AuthContext);
  const secondaryAuth = useContext(SecondaryAuthContext);
  
  return {
    primary: primaryAuth,
    secondary: secondaryAuth,
    bothAuthenticated: !!primaryAuth?.user && !!secondaryAuth?.user,
    anyAuthenticated: !!primaryAuth?.user || !!secondaryAuth?.user,
  };
};