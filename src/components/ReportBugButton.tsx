import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

export const ReportBugButton = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadUserProfile();
    }
  }, [user, isOpen]);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("projects_profiles")
        .select("first_name, last_name")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error("Erro ao carregar perfil do usuário para reporte:", error);
    }
  };

  // Define as rotas onde o botão deve aparecer
  // No mobile, apenas na home (/). No desktop, em /, /chat e /powerbi.
  const visibleRoutes = isMobile ? ["/"] : ["/", "/chat", "/powerbi"];
  const isVisible = visibleRoutes.includes(location.pathname);

  if (!isVisible) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("image/")) {
        setPhoto(file);
      } else {
        toast.error("Por favor, selecione apenas imagens.");
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!type || !description) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      let photoBase64 = "";
      if (photo) {
        photoBase64 = await fileToBase64(photo);
      }

      const fullName = userProfile 
        ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim()
        : "Anônimo";

      const payload = {
        type,
        description,
        photo: photoBase64,
        userName: fullName,
        userEmail: user?.email || "N/A",
        path: location.pathname,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch("https://n8n-n8n.j6kpgx.easypanel.host/webhook/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Relatório enviado com sucesso! Obrigado pelo feedback.");
        setIsOpen(false);
        setType("");
        setDescription("");
        setPhoto(null);
      } else {
        throw new Error("Falha ao enviar relatório.");
      }
    } catch (error) {
      console.error("Erro ao enviar relatório:", error);
      toast.error("Ocorreu um erro ao enviar seu relatório. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl z-[100] bg-primary hover:bg-primary/90 text-primary-foreground group animate-in fade-in zoom-in duration-300"
        size="icon"
      >
        <MessageSquarePlus className="w-6 h-6 transition-transform group-hover:scale-110" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] glass-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">Reportar Problema / Sugestão</DialogTitle>
            <DialogDescription>
              Ajude-nos a melhorar o Hub - Eurostock. Descreva o bug ou sua sugestão abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo de Reporte</Label>
              <Select onValueChange={setType} value={type}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug / Erro no Sistema</SelectItem>
                  <SelectItem value="data">Inconsistência de Dados</SelectItem>
                  <SelectItem value="suggestion">Sugestão de Melhoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Detalhes</Label>
              <Textarea
                id="description"
                placeholder="Descreva detalhadamente o que aconteceu ou sua ideia..."
                className="min-h-[100px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="photo">Anexo (Foto)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center gap-2 border-dashed"
                  onClick={() => document.getElementById("photo")?.click()}
                >
                  <Camera className="w-4 h-4" />
                  {photo ? photo.name : "Anexar Foto"}
                </Button>
              </div>
              {photo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Foto selecionada: {photo.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Reporte"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
