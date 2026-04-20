import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { BackgroundVideo } from "@/components/BackgroundVideo";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Lida com fluxo PKCE (onde recebemos um ?code= na URL)
    const handleCode = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setSessionError("Link de recuperação inválido ou expirado.");
        } else {
          // Remove o código da URL para ficar limpa
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };

    handleCode();

    // Lida com Implicit flow (onde recebemos #access_token= na URL)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Password recovery event detectado.");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error("Erro ao atualizar a senha: " + error.message);
      } else {
        toast.success("Senha atualizada com sucesso!");
        navigate("/");
      }
    } catch (error) {
      toast.error("Erro inesperado ao atualizar a senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background/20 flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundVideo />
      <Card className="glass-card w-full max-w-md p-8 animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2 text-gradient-cyan">
            Redefinir Senha
          </h1>
          <p className="text-muted-foreground">
            {sessionError ? (
              <span className="text-red-400">{sessionError}</span>
            ) : (
              "Digite sua nova senha abaixo"
            )}
          </p>
        </div>

        {sessionError ? (
          <div className="space-y-6">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
              onClick={() => navigate("/auth")}
            >
              Voltar ao Login e Tentar Novamente
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Nova Senha</label>
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

          <div>
            <label className="text-sm font-medium mb-2 block">Confirmar Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white z-10" />
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isLoading ? "Atualizando..." : "Atualizar Senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
