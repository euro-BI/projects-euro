import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, Users, Menu, Home, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      checkAdminStatus();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, profile_image_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const getDisplayName = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      return `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
    }
    return user?.email || "Usuário";
  };

  if (!user) return null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-3 text-lg md:text-xl font-bold text-gradient-cyan hover:opacity-80 transition-opacity"
          >
            <img
              src="https://kseespnvbkzxxgdjklbi.supabase.co/storage/v1/object/public/profile-images/projects2.png"
              alt="EuroProjects Logo"
              className="w-10 h-10 object-cover object-center"
            />
            <span className="truncate">
              {isMobile ? "EuroProjects" : "Sistema de Gestão de Projetos"}
            </span>
          </button>
          
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="glass border-primary/30 hover:border-primary/50 hover:bg-primary/5 hover:text-white text-white"
                >
                  {userProfile?.profile_image_url ? (
                    <img
                      src={userProfile.profile_image_url}
                      alt="Foto de perfil"
                      className="w-6 h-6 rounded-full object-cover object-top mr-2"
                    />
                  ) : (
                    <User className="w-4 h-4 mr-2" />
                  )}
                  {getDisplayName()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="glass-card border-primary/30 min-w-[250px]" align="end">
                {/* User welcome section */}
                <div className="p-4 text-center border-b border-border">
                  <div className="flex justify-center mb-3">
                    {userProfile?.profile_image_url ? (
                      <img
                        src={userProfile.profile_image_url}
                        alt="Foto de perfil"
                        className="w-12 h-12 rounded-full object-cover object-top border-2 border-primary"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">👋 Bem-vindo!</p>
                    <p className="text-sm font-semibold text-primary">{getDisplayName()}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                
                <div className="p-1">
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2">
                    Ações
                  </DropdownMenuLabel>
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate("/users")}
                      className="cursor-pointer hover:bg-primary/10"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Gerenciar Usuários
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    className="cursor-pointer hover:bg-primary/10"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={signOut}
                    className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="glass">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-card">
                <SheetHeader>
                  <SheetTitle>Navegação</SheetTitle>
                </SheetHeader>
                
                {/* User welcome section */}
                <div className="mt-6 mb-6 text-center">
                  <div className="flex justify-center mb-3">
                    {userProfile?.profile_image_url ? (
                      <img
                        src={userProfile.profile_image_url}
                        alt="Foto de perfil"
                        className="w-16 h-16 rounded-full object-cover object-top border-2 border-primary/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
                        <User className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="text-lg mb-1">👋 Bem-vindo!</div>
                    <div className="font-medium text-foreground">{getDisplayName()}</div>
                    <div className="text-xs text-muted-foreground mt-1">{user?.email}</div>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate("/")}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate("/users")}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Usuários
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setIsChangePasswordModalOpen(true)}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </Button>
                  <Button
                    variant="destructive"
                    className="justify-start"
                    onClick={signOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <ChangePasswordModal
        open={isChangePasswordModalOpen}
        onOpenChange={setIsChangePasswordModalOpen}
      />
    </>
  );
};
