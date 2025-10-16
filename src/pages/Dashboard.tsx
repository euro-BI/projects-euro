import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlusCircle, FolderKanban, Activity, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";

interface DashboardStats {
  totalProjects: number;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  pendingActivities: number;
  totalWeight: number;
  completedWeight: number;
  totalSubactivities: number;
  completedSubactivities: number;
  inProgressSubactivities: number;
  pendingSubactivities: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalActivities: 0,
    completedActivities: 0,
    inProgressActivities: 0,
    pendingActivities: 0,
    totalWeight: 0,
    completedWeight: 0,
    totalSubactivities: 0,
    completedSubactivities: 0,
    inProgressSubactivities: 0,
    pendingSubactivities: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [projectsResult, activitiesResult, subactivitiesResult] = await Promise.all([
        supabase.from("projects_projects").select("id", { count: "exact" }),
        supabase.from("projects_activities").select("status", { count: "exact" }),
        supabase.from("projects_subactivities").select("peso, status")
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (subactivitiesResult.error) throw subactivitiesResult.error;

      const activities = activitiesResult.data || [];
      const subactivities = subactivitiesResult.data || [];
      
      // Calcular pesos totais e concluídos
      const totalWeight = subactivities.reduce((sum, sub) => sum + (sub.peso || 0), 0);
      const completedWeight = subactivities
        .filter(sub => sub.status === "Concluído")
        .reduce((sum, sub) => sum + (sub.peso || 0), 0);
      
      // Calcular contagem de subatividades por status
      const totalSubactivities = subactivities.length;
      const completedSubactivities = subactivities.filter(sub => sub.status === "Concluído").length;
      const inProgressSubactivities = subactivities.filter(sub => sub.status === "Em andamento").length;
      const pendingSubactivities = subactivities.filter(sub => sub.status === "Pendente").length;
      
      setStats({
        totalProjects: projectsResult.count || 0,
        totalActivities: activities.length,
        completedActivities: activities.filter((a) => a.status === "Concluído").length,
        inProgressActivities: activities.filter((a) => a.status === "Em andamento").length,
        pendingActivities: activities.filter((a) => a.status === "Pendente").length,
        totalWeight,
        completedWeight,
        totalSubactivities,
        completedSubactivities,
        inProgressSubactivities,
        pendingSubactivities,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular progresso ponderado baseado nos pesos das subatividades
  const completionRate = stats.totalWeight > 0
    ? Math.round((stats.completedWeight / stats.totalWeight) * 100)
    : 0;

  const StatCard = ({ icon: Icon, label, value, color, subValue, subLabel }: any) => (
    <Card className="glass-card p-6 hover-lift">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color} border`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subValue !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {subLabel}: {subValue}
            </p>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Visão geral dos seus projetos e atividades
            </p>
          </div>
          
          <Button
            onClick={() => navigate("/projects")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
          <StatCard
            icon={FolderKanban}
            label="Projetos"
            value={stats.totalProjects}
            color="bg-primary/10 border-primary/20 text-primary"
          />
          <StatCard
            icon={Activity}
            label="Total de Atividades"
            value={stats.totalActivities}
            color="bg-blue-500/10 border-blue-500/20 text-blue-400"
            subValue={stats.totalSubactivities}
            subLabel="subatividades"
          />
          <StatCard
            icon={Clock}
            label="Em Andamento"
            value={stats.inProgressActivities}
            color="bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
            subValue={stats.inProgressSubactivities}
            subLabel="subatividades"
          />
          <StatCard
            icon={CheckCircle2}
            label="Concluídas"
            value={stats.completedActivities}
            color="bg-green-500/10 border-green-500/20 text-green-400"
            subValue={stats.completedSubactivities}
            subLabel="subatividades"
          />
        </div>

        {/* Progress Card */}
        <Card className="glass-card p-8 mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold">Progresso Geral</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Baseado nos pesos das subatividades ({stats.completedWeight}/{stats.totalWeight} pontos)
              </p>
            </div>
            <span className="text-4xl font-bold text-primary">{completionRate}%</span>
          </div>
          
          <Progress 
            value={completionRate} 
            useGradient={true}
            className="w-full h-4"
          />
          
          <div className="grid grid-cols-3 gap-4 mt-6 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-semibold text-yellow-400">{stats.pendingActivities}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
              <p className="text-2xl font-semibold text-blue-400">{stats.inProgressActivities}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Concluídas</p>
              <p className="text-2xl font-semibold text-green-400">{stats.completedActivities}</p>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-4 animate-fade-in">
          <Button
            variant="outline"
            onClick={() => navigate("/projects")}
            className="glass border-primary/30 hover:border-primary/50 hover:bg-primary/5 hover:text-white"
          >
            <FolderKanban className="w-4 h-4 mr-2" />
            Ver Projetos
          </Button>
          {/* Removido: Alterar Área de Trabalho (agora no cabeçalho) */}
        </div>
      </div>
    </PageLayout>
  );
}
