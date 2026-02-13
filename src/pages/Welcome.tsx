import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/PageLayout";
import { 
  FolderKanban, 
  BarChart3, 
  FileSpreadsheet, 
  MessageSquare, 
  Users, 
  RefreshCw,
  LayoutDashboard,
  ShieldCheck,
  Tv
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundVideo } from "@/components/BackgroundVideo";

export default function Welcome() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const isAdminMaster = userRole === "admin_master";
  const isAdmin = userRole === "admin";
  const isUser = userRole === "user";

  const menuItems = [
    {
      title: "Dashboard de Projetos",
      description: "Visualize o status e progresso de todos os projetos ativos.",
      icon: LayoutDashboard,
      path: "/dashboard",
      roles: ["admin_master", "admin"],
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      borderColor: "border-blue-400/20"
    },
    {
      title: "Gestão de Projetos",
      description: "Gerencie tarefas, atividades e cronogramas detalhados.",
      icon: FolderKanban,
      path: "/projects",
      roles: ["admin_master", "admin"],
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      borderColor: "border-cyan-400/20"
    },
    {
      title: "Power BI",
      description: "Acesse relatórios e dashboards analíticos do Power BI.",
      icon: BarChart3,
      path: "/powerbi",
      roles: ["admin_master", "admin", "user", "consorcio"],
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20"
    },
    {
      title: "IA Chat",
      description: "Interaja com nossa inteligência artificial para insights.",
      icon: MessageSquare,
      path: "/chat",
      roles: ["admin_master", "admin", "user", "consorcio"],
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      borderColor: "border-purple-400/20"
    },
    {
      title: "Consórcios",
      description: "Acompanhe e gerencie os dados de consórcios.",
      icon: FileSpreadsheet,
      path: "/consorcios",
      roles: ["admin_master", "consorcio"],
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20"
    },
    {
      title: "Atualizações BD",
      description: "Gerencie e acompanhe atualizações do banco de dados BI.",
      icon: RefreshCw,
      path: "/bi-dashboard",
      roles: ["admin_master"],
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
      borderColor: "border-pink-400/20"
    },
    {
      title: "Gestão de Usuários",
      description: "Controle acessos, perfis e permissões do sistema.",
      icon: Users,
      path: "/users",
      roles: ["admin_master"],
      color: "text-indigo-400",
      bgColor: "bg-indigo-400/10",
      borderColor: "border-indigo-400/20"
    },
    {
      title: "TV Dashboards",
      description: "Acesse apresentações de dashboards prontas para exibição.",
      icon: Tv,
      path: "/tv-published",
      roles: ["admin_master", "admin"],
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      borderColor: "border-emerald-400/20"
    }
  ];

  const filteredItems = menuItems.filter(item => 
    item.roles?.includes(userRole || "")
  );

  return (
    <PageLayout className="relative overflow-hidden bg-transparent">
      <BackgroundVideo />
      <div className="container mx-auto px-4 py-12 max-w-6xl relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient-cyan">
            Bem-vindo ao Hub - Eurostock
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Selecione uma das seções abaixo para começar a navegar no sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <Card 
              key={item.path}
              className={cn(
                "glass-card p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group animate-slide-up",
                item.borderColor
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => navigate(item.path)}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl transition-colors duration-300 group-hover:scale-110",
                  item.bgColor,
                  item.color
                )}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {isAdminMaster && (
          <div className="mt-12 p-6 glass-card border-primary/20 rounded-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Painel do Administrador Master</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-6">
              Você tem acesso total a todas as configurações do sistema, incluindo gestão de usuários e atualizações críticas.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate("/dashboard-management")}
                className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-sm font-medium"
              >
                Configurações de Dashboards
              </button>
              <button 
                onClick={() => navigate("/users")}
                className="px-4 py-2 rounded-lg bg-indigo-400/10 border border-indigo-400/20 text-indigo-400 hover:bg-indigo-400/20 transition-all text-sm font-medium"
              >
                Gerenciar Usuários
              </button>
              <button 
                onClick={() => navigate("/tv-presentations")}
                className="px-4 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-all text-sm font-medium"
              >
                Configurar TV Dashboards
              </button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
