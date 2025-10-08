import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, Users, Menu, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto h-full flex items-center justify-between px-4">
        <button 
          onClick={() => navigate("/")}
          className="text-lg md:text-xl font-bold text-gradient-cyan hover:opacity-80 transition-opacity truncate"
        >
          {isMobile ? "ConsultArc" : "Sistema de Gestão"}
        </button>
        
        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/users")}
            className="glass border-border/40 hover:border-primary/50 hover:bg-primary/5"
          >
            <Users className="w-4 h-4 mr-2" />
            Usuários
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="glass border-primary/30 hover:border-primary/50 hover:bg-primary/5"
              >
                <User className="w-4 h-4 mr-2" />
                {user.email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-card border-primary/30 min-w-[200px]" align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Conta
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
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
              <div className="mt-4 grid gap-2">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => navigate("/")}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => navigate("/users")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Usuários
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
  );
};
