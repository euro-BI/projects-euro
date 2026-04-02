import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, Users, Menu, Home, Lock, FolderKanban, BarChart3, ChevronDown, FileSpreadsheet, MessageSquare, Shield, RefreshCw, LayoutDashboard, Tv, Settings, BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
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
  const { user, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  // Helper booleans for role checks
  const isAdminMaster = userRole === "admin_master";
  const isAdmin = userRole === "admin";
  const isConsorcio = userRole === "consorcio";
  const isRegularUser = userRole === "user";
  const isMarketing = userRole === "marketing";

  // Combine roles for easier checks
  const canAccessAdminFeatures = isAdminMaster || isAdmin;
  const canAccessPowerBIAndIA = isAdminMaster || isAdmin || isRegularUser || isConsorcio;

  // Função para obter o nome da página atual
  const getCurrentPageName = () => {
    if (location.pathname === '/') return 'Início';
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname.startsWith('/projects')) return 'Projetos';
    if (location.pathname === '/bi-dashboard') return 'Atualizações BD';
    if (location.pathname === '/consorcios') return 'Consórcios';
    if (location.pathname === '/chat') return 'IA Chat';
    if (location.pathname === '/users') return 'Usuários';
    if (location.pathname === '/tv-presentations') return 'Gestão TV';
    if (location.pathname === '/tv-published') return 'TV Dashboards';
    return 'Início';
  };

  // Função para obter o ícone da página atual
  const getCurrentPageIcon = () => {
    if (location.pathname === '/') return Home;
    if (location.pathname === '/dashboard') return LayoutDashboard;
    if (location.pathname.startsWith('/projects')) return FolderKanban;
    if (location.pathname === '/bi-dashboard') return RefreshCw;
    if (location.pathname === '/consorcios') return FileSpreadsheet;
    if (location.pathname === '/chat') return MessageSquare;
    if (location.pathname === '/users') return Users;
    if (location.pathname === '/tv-presentations' || location.pathname === '/tv-published') return Tv;
    return Home;
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("projects_profiles")
        .select("first_name, last_name, profile_image_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };



  const getDisplayName = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      return `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
    }
    return user?.email || "Usuário";
  };

  const getRoleBadge = () => {
    if (userRole === "admin_master") {
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] py-0 h-4">
          <Shield className="w-2 h-2 mr-1" />
          Admin Master
        </Badge>
      );
    }
    if (userRole === "admin") {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] py-0 h-4">
          <Shield className="w-2 h-2 mr-1" />
          Admin
        </Badge>
      );
    }
    if (userRole === "consorcio") {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] py-0 h-4">
          <FileSpreadsheet className="w-2 h-2 mr-1" />
          Consórcio
        </Badge>
      );
    }
    if (userRole === "marketing") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0 h-4">
          <BarChart3 className="w-2 h-2 mr-1" />
          Marketing
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] py-0 h-4">
        <User className="w-2 h-2 mr-1" />
        Usuário
      </Badge>
    );
  };

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setIsHeaderHidden(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    if (location.pathname.startsWith("/dash") && isMaximized) return;

    const lastYRef = { current: window.scrollY };
    const hiddenRef = { current: false };
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastYRef.current;

      const nextHidden =
        y < 100 ? false :
        delta > 10 ? true :
        hiddenRef.current;

      if (nextHidden !== hiddenRef.current) {
        hiddenRef.current = nextHidden;
        setIsHeaderHidden(nextHidden);
      }

      lastYRef.current = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [user, location.pathname, isMaximized]);

  if (!user) return null;
  if (location.pathname.startsWith("/dash") && isMaximized) return null;

  return (
    <>
      <header
        className={[
          "fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-out",
          isHeaderHidden ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        ].join(" ")}
      >
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-3 text-lg md:text-xl font-bold text-gradient-cyan hover:opacity-80 transition-opacity"
          >
            <img
              src="https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/logo_.png"
              alt="Hub - Eurostock Logo"
              className="w-10 h-10 object-cover object-center"
            />
            <span className="truncate">
              Hub - Eurostock
            </span>
          </button>
          
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* Dropdown de Navegação */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="glass border-primary/30 hover:border-primary/50 hover:bg-primary/5 hover:text-white"
                >
                  {(() => {
                    const IconComponent = getCurrentPageIcon();
                    return <IconComponent className="w-4 h-4 mr-2" />;
                  })()}
                  {getCurrentPageName()}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Navegar para</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/')}>
                  <Home className="w-4 h-4 mr-2" />
                  Início
                </DropdownMenuItem>
                {(isAdminMaster || isAdmin || isMarketing || isRegularUser) && (
                  <DropdownMenuItem onClick={() => navigate('/dash')}>
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    Euro Intelligence
                  </DropdownMenuItem>
                )}
                {(isAdminMaster || isAdmin) && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                )}
                {(isAdminMaster || isAdmin) && (
                  <DropdownMenuItem onClick={() => navigate('/projects')}>
                    <FolderKanban className="w-4 h-4 mr-2" />
                    Projetos
                  </DropdownMenuItem>
                )}
                {isAdminMaster && (
                  <DropdownMenuItem onClick={() => navigate('/bi-dashboard')}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizações BD
                  </DropdownMenuItem>
                )}
                {(isAdminMaster || isConsorcio) && (
                  <DropdownMenuItem onClick={() => navigate('/consorcios')}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Consórcios
                  </DropdownMenuItem>
                )}
                {canAccessPowerBIAndIA && (
                  <DropdownMenuItem onClick={() => navigate('/powerbi')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Power BI
                  </DropdownMenuItem>
                )}
                {canAccessPowerBIAndIA && (
                  <DropdownMenuItem onClick={() => navigate('/chat')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    IA Chat
                  </DropdownMenuItem>
                )}
                {(isAdminMaster || isAdmin) && (
                  <DropdownMenuItem onClick={() => navigate('/tv-published')}>
                    <Tv className="w-4 h-4 mr-2" />
                    TV Dashboards
                  </DropdownMenuItem>
                )}
                {isAdminMaster && (
                  <DropdownMenuItem onClick={() => navigate('/tv-presentations')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Gestão TV
                  </DropdownMenuItem>
                )}

              </DropdownMenuContent>
            </DropdownMenu>
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
                  <div className="space-y-1 flex flex-col items-center">
                    <p className="text-sm font-medium">👋 Bem-vindo!</p>
                    <p className="text-sm font-semibold text-primary">{getDisplayName()}</p>
                    {getRoleBadge()}
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                
                <div className="p-1">
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2">
                    Ações
                  </DropdownMenuLabel>

                  {isAdminMaster && (
                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard-management")}
                      className="cursor-pointer hover:bg-primary/10"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Gerenciar Dashboards
                    </DropdownMenuItem>
                  )}
                  {isAdminMaster && (
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
                  <SheetTitle>Perfil do Usuário</SheetTitle>
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
                  <div className="text-sm flex flex-col items-center">
                    <div className="text-lg mb-1">👋 Bem-vindo!</div>
                    <div className="font-medium text-foreground">{getDisplayName()}</div>
                    <div className="mt-1">{getRoleBadge()}</div>
                    <div className="text-xs text-muted-foreground mt-1">{user?.email}</div>
                  </div>
                </div>
                
                <div className="border-t border-white/5 pt-4 grid gap-2">
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 mb-2">
                    Ações de Conta
                  </DropdownMenuLabel>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setIsChangePasswordModalOpen(true)}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start text-destructive hover:text-destructive"
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
