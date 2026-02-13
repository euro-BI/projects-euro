import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { LogIn, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BackgroundVideo } from "@/components/BackgroundVideo";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export default function Auth() {
  const { signIn, user, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get the intended destination from location state
  const from = location.state?.from || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (user && userRole) {
      // Agora todos vão para o destino pretendido (que por padrão é "/")
      navigate(from, { replace: true });
    }
  }, [user, userRole, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Email não confirmado. Verifique sua caixa de entrada.");
        } else {
          toast.error("Erro ao fazer login. Tente novamente.");
        }
      } else {
        toast.success("Login realizado com sucesso!");
      }
    } catch (error) {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background/20 flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundVideo />
      <Card className="glass-card w-full max-w-md p-8 animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <img
              src="https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/logo_.png"
              alt="Hub - Eurostock Logo"
              className="w-20 h-20 object-cover object-center border-2 border-primary rounded-lg shadow-lg shadow-primary/50"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-gradient-cyan">
            Hub - Eurostock
          </h1>
          <p className="text-muted-foreground">
            Sistema de dados e IA Eurostock
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white z-10" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white z-10" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin"></div>
                Entrando...
              </div>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 rounded-lg bg-muted/20 border border-border">
          <p className="text-xs text-muted-foreground text-center">
            Acesso restrito. Contate o administrador para obter credenciais.
          </p>
        </div>
      </Card>
    </div>
  );
}
