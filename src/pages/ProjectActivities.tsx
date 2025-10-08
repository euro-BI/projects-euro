import { useEffect, useState, useRef } from "react";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CompleteActivityModal } from "@/components/CompleteActivityModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  PlusCircle,
  Calendar,
  User,
  CheckCircle2,
  ListTodo,
  Loader2,
  Edit,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout } from "@/components/PageLayout";

interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: "Pendente" | "Em andamento" | "Concluído";
  responsible: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Subactivity {
  id: string;
  activity_id: string;
  title: string;
  status: "Pendente" | "Concluído";
  comment: string | null;
}

export default function ProjectActivities() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subactivities, setSubactivities] = useState<Record<string, Subactivity[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [completeModalData, setCompleteModalData] = useState<{
    open: boolean;
    activityId: string;
    activityTitle: string;
  }>({ open: false, activityId: "", activityTitle: "" });
  
  const [subactivityDialog, setSubactivityDialog] = useState<{
    open: boolean;
    activityId: string;
  }>({ open: false, activityId: "" });
  
  const [newSubactivity, setNewSubactivity] = useState({
    title: "",
  });
  
  const [newActivity, setNewActivity] = useState({
    title: "",
    description: "",
    status: "Pendente" as const,
    responsible: "",
    start_date: "",
    end_date: "",
  });

  // Delete confirmation states
  const [deleteActivityDialog, setDeleteActivityDialog] = useState<{
    open: boolean;
    activityId: string;
    activityTitle: string;
  }>({ open: false, activityId: "", activityTitle: "" });

  const [deleteSubactivityDialog, setDeleteSubactivityDialog] = useState<{
    open: boolean;
    subactivityId: string;
    subactivityTitle: string;
  }>({ open: false, subactivityId: "", subactivityTitle: "" });

  // Edit states
  const [editActivityDialog, setEditActivityDialog] = useState<{
    open: boolean;
    activityId: string;
    data: {
      title: string;
      description: string;
      status: "Pendente" | "Em andamento" | "Concluído";
      responsible: string;
      start_date: string;
    };
  }>({ 
    open: false, 
    activityId: "", 
    data: {
      title: "",
      description: "",
      status: "Pendente",
      responsible: "",
      start_date: "",
    }
  });

  const [editSubactivityDialog, setEditSubactivityDialog] = useState<{
    open: boolean;
    subactivityId: string;
    data: {
      title: string;
    };
  }>({ 
    open: false, 
    subactivityId: "", 
    data: {
      title: "",
    }
  });

  // Mobile pull-to-refresh state
  const isMobile = useIsMobile();
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const maxPull = 120;
  const threshold = 80;

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      const [projectResult, activitiesResult] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase
          .from("activities")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      setProject(projectResult.data);
      setActivities((activitiesResult.data as Activity[]) || []);

      // Load subactivities for all activities
      if (activitiesResult.data && activitiesResult.data.length > 0) {
        const activityIds = activitiesResult.data.map((a) => a.id);
        const { data: subs } = await supabase
          .from("subactivities")
          .select("*")
          .in("activity_id", activityIds);

        if (subs) {
          const grouped = (subs as Subactivity[]).reduce((acc, sub) => {
            if (!acc[sub.activity_id]) acc[sub.activity_id] = [];
            acc[sub.activity_id].push(sub);
            return acc;
          }, {} as Record<string, Subactivity[]>);
          setSubactivities(grouped);
        }
      }
    } catch (error) {
      console.error("Error loading project data:", error);
      toast.error("Erro ao carregar dados do projeto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!projectId || !newActivity.title.trim()) {
      toast.error("Título da atividade é obrigatório");
      return;
    }

    try {
      const { error } = await supabase.from("activities").insert({
        project_id: projectId,
        title: newActivity.title,
        description: newActivity.description || null,
        status: newActivity.status,
        responsible: newActivity.responsible || null,
        start_date: newActivity.start_date || null,
        end_date: newActivity.end_date || null,
      });

      if (error) throw error;

      toast.success("Atividade criada com sucesso!");
      setIsActivityDialogOpen(false);
      setNewActivity({
        title: "",
        description: "",
        status: "Pendente",
        responsible: "",
        start_date: "",
        end_date: "",
      });
      loadProjectData();
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Erro ao criar atividade");
    }
  };

  const confettiRef = useRef<ConfettiRef>(null);

  // Confetti em tela cheia ao concluir atividade (menos confetes, 5s)
  const triggerConfetti = () => {
    // Usa os canhões laterais (igual ao comportamento anterior)
    confettiRef.current?.sideCannons(5000);
  };

  // Pull-to-refresh (mobile)
  const handleTouchStart = (e: any) => {
    if (!isMobile || isRefreshing) return;
    if (window.scrollY > 0) return;
    setPullStartY(e.touches?.[0]?.clientY ?? null);
    setPullDistance(0);
  };

  const handleTouchMove = (e: any) => {
    if (!isMobile || isRefreshing) return;
    if (pullStartY === null) return;
    const currentY = e.touches?.[0]?.clientY ?? 0;
    const delta = currentY - pullStartY;
    if (delta > 0 && window.scrollY === 0) {
      try { e.preventDefault(); } catch {}
      setPullDistance(Math.min(delta * 0.5, maxPull));
    }
  };

  const handleTouchEnd = async () => {
    if (!isMobile) {
      setPullStartY(null);
      setPullDistance(0);
      return;
    }
    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await loadProjectData();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullStartY(null);
    setPullDistance(0);
  };
  const handleCompleteActivity = async (activityId: string, comment: string) => {
    try {
      // Update activity status
      const { error: activityError } = await supabase
        .from("activities")
        .update({ status: "Concluído" })
        .eq("id", activityId);

      if (activityError) throw activityError;

      // Add comment
      const { error: commentError } = await supabase.from("comments").insert({
        activity_id: activityId,
        author: "Usuário",
        comment,
      });

      if (commentError) throw commentError;

      toast.success("Atividade concluída!");
      triggerConfetti();
      loadProjectData();
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const handleToggleSubactivity = async (subId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Pendente" ? "Concluído" : "Pendente";
    
    try {
      // Primeiro, obter informações da subatividade para saber qual atividade ela pertence
      const { data: subactivity, error: subError } = await supabase
        .from("subactivities")
        .select("activity_id")
        .eq("id", subId)
        .single();

      if (subError) throw subError;

      // Atualizar o status da subatividade
      const { error } = await supabase
        .from("subactivities")
        .update({ status: newStatus })
        .eq("id", subId);

      if (error) throw error;

      // Se a subatividade foi marcada como concluída, verificar se a atividade está pendente
      if (newStatus === "Concluído") {
        // Obter a atividade atual
        const { data: activity, error: activityError } = await supabase
          .from("activities")
          .select("status")
          .eq("id", subactivity.activity_id)
          .single();

        if (activityError) throw activityError;

        // Se a atividade está pendente, mudar para "Em andamento"
        if (activity.status === "Pendente") {
          const { error: updateError } = await supabase
            .from("activities")
            .update({ status: "Em andamento" })
            .eq("id", subactivity.activity_id);

          if (updateError) throw updateError;
          
          toast.success("Checklist marcado como concluído! Atividade movida para 'Em andamento'.");
        }
      }
      
      loadProjectData();
    } catch (error) {
      console.error("Error updating subactivity:", error);
      toast.error("Erro ao atualizar subatividade");
    }
  };

  const handleCreateSubactivity = async () => {
    if (!newSubactivity.title.trim() || !subactivityDialog.activityId) {
      toast.error("Título do checklist é obrigatório");
      return;
    }

    try {
      // Verificar se a atividade está concluída
      const { data: activity } = await supabase
        .from("activities")
        .select("status")
        .eq("id", subactivityDialog.activityId)
        .single();

      // Se a atividade está concluída, voltar para "Em andamento"
      if (activity?.status === "Concluído") {
        const { error: updateError } = await supabase
          .from("activities")
          .update({ status: "Em andamento" })
          .eq("id", subactivityDialog.activityId);

        if (updateError) throw updateError;
      }

      // Criar o checklist
      const { error } = await supabase.from("subactivities").insert({
        activity_id: subactivityDialog.activityId,
        title: newSubactivity.title,
        status: "Pendente",
      });

      if (error) throw error;

      toast.success("Checklist adicionado com sucesso!");
      if (activity?.status === "Concluído") {
        toast.info("Atividade voltou para 'Em andamento' devido ao novo checklist");
      }
      
      setSubactivityDialog({ open: false, activityId: "" });
      setNewSubactivity({ title: "" });
      loadProjectData();
    } catch (error) {
      console.error("Error creating subactivity:", error);
      toast.error("Erro ao criar checklist");
    }
  };

  // Delete functions
  const handleDeleteActivity = async () => {
    try {
      // First delete all subactivities
      const { error: subError } = await supabase
        .from("subactivities")
        .delete()
        .eq("activity_id", deleteActivityDialog.activityId);

      if (subError) throw subError;

      // Then delete the activity
      const { error: activityError } = await supabase
        .from("activities")
        .delete()
        .eq("id", deleteActivityDialog.activityId);

      if (activityError) throw activityError;

      toast.success("Atividade deletada com sucesso!");
      setDeleteActivityDialog({ open: false, activityId: "", activityTitle: "" });
      loadProjectData();
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast.error("Erro ao deletar atividade");
    }
  };

  const handleDeleteSubactivity = async () => {
    try {
      const { error } = await supabase
        .from("subactivities")
        .delete()
        .eq("id", deleteSubactivityDialog.subactivityId);

      if (error) throw error;

      toast.success("Checklist deletado com sucesso!");
      setDeleteSubactivityDialog({ open: false, subactivityId: "", subactivityTitle: "" });
      loadProjectData();
    } catch (error) {
      console.error("Error deleting subactivity:", error);
      toast.error("Erro ao deletar checklist");
    }
  };

  // Edit functions
  const handleEditActivity = async (activityId: string, data: any) => {
    if (!data.title.trim()) {
      toast.error("Título da atividade é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("activities")
        .update({
          title: data.title,
          description: data.description || null,
          status: data.status,
          responsible: data.responsible || null,
          start_date: data.start_date || null,
        })
        .eq("id", activityId);

      if (error) throw error;

      toast.success("Atividade atualizada com sucesso!");
      setEditActivityDialog({ 
        open: false, 
        activityId: "", 
        data: {
          title: "",
          description: "",
          status: "Pendente",
          responsible: "",
          start_date: "",
        }
      });
      loadProjectData();
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Erro ao atualizar atividade");
    }
  };

  const handleEditSubactivity = async (subactivityId: string, data: any) => {
    if (!data.title.trim()) {
      toast.error("Título do checklist é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("subactivities")
        .update({
          title: data.title,
        })
        .eq("id", subactivityId);

      if (error) throw error;

      toast.success("Checklist atualizado com sucesso!");
      setEditSubactivityDialog({ 
        open: false, 
        subactivityId: "", 
        data: {
          title: "",
        }
      });
      loadProjectData();
    } catch (error) {
      console.error("Error updating subactivity:", error);
      toast.error("Erro ao atualizar checklist");
    }
  };

  // Helper functions to open edit dialogs
  const openEditActivityDialog = (activity: Activity) => {
    setEditActivityDialog({ 
      open: true, 
      activityId: activity.id,
      data: {
        title: activity.title,
        description: activity.description || "",
        status: activity.status,
        responsible: activity.responsible || "",
        start_date: activity.start_date || "",
      }
    });
  };

  const openEditSubactivityDialog = (subactivity: Subactivity) => {
    setEditSubactivityDialog({ 
      open: true, 
      subactivityId: subactivity.id,
      data: {
        title: subactivity.title,
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <Confetti ref={confettiRef} />
      <PageLayout>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
      {isMobile && (
        <div
          className={`fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none ${
            isRefreshing || pullDistance > 30 ? "opacity-100" : "opacity-0"
          } transition-opacity`}
        >
          <div className="rounded-full bg-secondary/70 px-3 py-1 text-xs flex items-center gap-2 shadow">
            <Loader2 className="w-3 h-3 animate-spin" />
            Atualizando...
          </div>
        </div>
      )}
      <div
        className="container mx-auto px-4 py-8 max-w-7xl relative"
        style={
          isMobile
            ? {
                transform: `translateY(${pullDistance}px)`,
                transition: isRefreshing ? "transform 0.2s ease" : "none",
              }
            : undefined
        }
      >
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => navigate("/projects")}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Projetos
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">
                {project?.name}
              </h1>
              {project?.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </div>

            <Button
              onClick={() => setIsActivityDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Nova Atividade
            </Button>
          </div>
        </div>

        {/* Activities List */}
        {activities.length === 0 ? (
          <Card className="glass-card p-12 text-center animate-fade-in">
            <ListTodo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Nenhuma atividade criada ainda</p>
            <Button
              onClick={() => setIsActivityDialogOpen(true)}
              variant="outline"
              className="glass border-primary/30"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Criar Primeira Atividade
            </Button>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4 animate-fade-in">
            {activities.map((activity) => (
              <AccordionItem
                key={activity.id}
                value={activity.id}
                className="glass-card border-border overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <StatusBadge status={activity.status} />
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {activity.title}
                      </h3>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {activity.responsible && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {activity.responsible}
                          </div>
                        )}
                        {activity.start_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(activity.start_date), "dd/MM/yyyy")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {activity.status !== "Concluído" && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompleteModalData({
                              open: true,
                              activityId: activity.id,
                              activityTitle: activity.title,
                            });
                          }}
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Concluir
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0 hover:bg-secondary/50"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card border-primary/30">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditActivityDialog(activity);
                            }}
                            className="hover:bg-secondary/50"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteActivityDialog({
                                open: true,
                                activityId: activity.id,
                                activityTitle: activity.title,
                              });
                            }}
                            className="hover:bg-red-500/10 text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-6 pb-4">
                  {activity.description && (
                    <p className="text-muted-foreground mb-4">{activity.description}</p>
                  )}

                  {/* Subactivities */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Checklists
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSubactivityDialog({
                            open: true,
                            activityId: activity.id,
                          })
                        }
                        className="glass border-primary/30 hover:border-primary/50 hover:bg-primary/5 h-7 text-xs"
                      >
                        <PlusCircle className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    
                    {subactivities[activity.id]?.length > 0 ? (
                      subactivities[activity.id].map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 p-3 rounded-lg glass hover:bg-secondary/50 transition-colors group"
                        >
                          <Checkbox
                            checked={sub.status === "Concluído"}
                            onCheckedChange={() =>
                              handleToggleSubactivity(sub.id, sub.status)
                            }
                          />
                          <span
                            className={`flex-1 ${
                              sub.status === "Concluído"
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {sub.title}
                          </span>
                          
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-secondary/50"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="glass-card border-primary/30">
                                <DropdownMenuItem
                                  onClick={() => openEditSubactivityDialog(sub)}
                                  className="hover:bg-secondary/50"
                                >
                                  <Edit className="w-3 h-3 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeleteSubactivityDialog({
                                      open: true,
                                      subactivityId: sub.id,
                                      subactivityTitle: sub.title,
                                    });
                                  }}
                                  className="hover:bg-red-500/10 text-red-400"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Deletar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic p-3">
                        Nenhum checklist adicionado
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Create Activity Dialog */}
        <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
          <DialogContent className="glass-card border-primary/30 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Nova Atividade</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Título *</label>
                <Input
                  placeholder="Título da atividade"
                  value={newActivity.title}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, title: e.target.value })
                  }
                  className="glass"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Descrição</label>
                <Textarea
                  placeholder="Descreva a atividade..."
                  value={newActivity.description}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, description: e.target.value })
                  }
                  className="glass min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select
                    value={newActivity.status}
                    onValueChange={(value: any) =>
                      setNewActivity({ ...newActivity, status: value })
                    }
                  >
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-primary/20">
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Responsável</label>
                  <Input
                    placeholder="Nome do responsável"
                    value={newActivity.responsible}
                    onChange={(e) =>
                      setNewActivity({ ...newActivity, responsible: e.target.value })
                    }
                    className="glass"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Data Início</label>
                  <Input
                    type="date"
                    value={newActivity.start_date}
                    onChange={(e) =>
                      setNewActivity({ ...newActivity, start_date: e.target.value })
                    }
                    className="glass"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Data Fim</label>
                  <Input
                    type="date"
                    value={newActivity.end_date}
                    onChange={(e) =>
                      setNewActivity({ ...newActivity, end_date: e.target.value })
                    }
                    className="glass"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsActivityDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateActivity}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm"
              >
                Criar Atividade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Activity Modal */}
        <CompleteActivityModal
          open={completeModalData.open}
          onOpenChange={(open) =>
            setCompleteModalData({ ...completeModalData, open })
          }
          onComplete={(comment) =>
            handleCompleteActivity(completeModalData.activityId, comment)
          }
          activityTitle={completeModalData.activityTitle}
          pendingChecklists={
            (subactivities[completeModalData.activityId] || [])
              .filter(sub => sub.status === "Pendente")
          }
        />

        {/* Add Subactivity Dialog */}
        <Dialog
          open={subactivityDialog.open}
          onOpenChange={(open) =>
            setSubactivityDialog({ ...subactivityDialog, open })
          }
        >
          <DialogContent className="glass-card border-primary/30 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Adicionar Checklist</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Título do Checklist *
              </label>
              <Input
                placeholder="Ex: Revisar documentação, Validar com cliente..."
                value={newSubactivity.title}
                onChange={(e) =>
                  setNewSubactivity({ title: e.target.value })
                }
                className="glass"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubactivity.title.trim()) {
                    handleCreateSubactivity();
                  }
                }}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setSubactivityDialog({ open: false, activityId: "" })
                }
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateSubactivity}
                disabled={!newSubactivity.title.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm"
              >
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Activity Modal */}
        <Dialog
          open={editActivityDialog.open}
          onOpenChange={(open) =>
            setEditActivityDialog({ ...editActivityDialog, open })
          }
        >
          <DialogContent className="glass-card border-primary/30 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Editar Atividade</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Título da Atividade *
                </label>
                <Input
                  placeholder="Ex: Desenvolver funcionalidade X"
                  value={editActivityDialog.data.title}
                  onChange={(e) =>
                    setEditActivityDialog({
                      ...editActivityDialog,
                      data: { ...editActivityDialog.data, title: e.target.value }
                    })
                  }
                  className="glass"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Descrição
                </label>
                <Textarea
                  placeholder="Descreva os detalhes da atividade..."
                  value={editActivityDialog.data.description || ""}
                  onChange={(e) =>
                    setEditActivityDialog({
                      ...editActivityDialog,
                      data: { ...editActivityDialog.data, description: e.target.value }
                    })
                  }
                  className="glass min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Responsável
                  </label>
                  <Input
                    placeholder="Nome do responsável"
                    value={editActivityDialog.data.responsible || ""}
                    onChange={(e) =>
                      setEditActivityDialog({
                        ...editActivityDialog,
                        data: { ...editActivityDialog.data, responsible: e.target.value }
                      })
                    }
                    className="glass"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Status
                  </label>
                  <Select
                    value={editActivityDialog.data.status}
                    onValueChange={(value: "Pendente" | "Em andamento" | "Concluído") =>
                      setEditActivityDialog({
                        ...editActivityDialog,
                        data: { ...editActivityDialog.data, status: value }
                      })
                    }
                  >
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-primary/30">
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Data de Início
                </label>
                <Input
                  type="date"
                  value={editActivityDialog.data.start_date || ""}
                  onChange={(e) =>
                    setEditActivityDialog({
                      ...editActivityDialog,
                      data: { ...editActivityDialog.data, start_date: e.target.value }
                    })
                  }
                  className="glass"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setEditActivityDialog({ open: false, activityId: "", data: {} as any })
                }
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleEditActivity(editActivityDialog.activityId, editActivityDialog.data)}
                disabled={!editActivityDialog.data.title?.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm"
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Activity Confirmation Modal */}
        <AlertDialog
          open={deleteActivityDialog.open}
          onOpenChange={(open) =>
            setDeleteActivityDialog({ ...deleteActivityDialog, open })
          }
        >
          <AlertDialogContent className="glass-card border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Tem certeza que deseja deletar a atividade "{deleteActivityDialog.activityTitle}"?
                <br />
                <span className="text-red-400 font-medium">
                  Esta ação também deletará todos os checklists associados e não pode ser desfeita.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="glass hover:bg-secondary/50">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteActivity(deleteActivityDialog.activityId)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Subactivity Modal */}
        <Dialog
          open={editSubactivityDialog.open}
          onOpenChange={(open) =>
            setEditSubactivityDialog({ ...editSubactivityDialog, open })
          }
        >
          <DialogContent className="glass-card border-primary/30 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Editar Checklist</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Título do Checklist *
              </label>
              <Input
                placeholder="Ex: Revisar documentação, Validar com cliente..."
                value={editSubactivityDialog.data.title}
                onChange={(e) =>
                  setEditSubactivityDialog({
                    ...editSubactivityDialog,
                    data: { ...editSubactivityDialog.data, title: e.target.value }
                  })
                }
                className="glass"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editSubactivityDialog.data.title?.trim()) {
                    handleEditSubactivity(editSubactivityDialog.subactivityId, editSubactivityDialog.data);
                  }
                }}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setEditSubactivityDialog({ open: false, subactivityId: "", data: {} as any })
                }
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleEditSubactivity(editSubactivityDialog.subactivityId, editSubactivityDialog.data)}
                disabled={!editSubactivityDialog.data.title?.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm"
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Subactivity Confirmation Modal */}
        <AlertDialog
          open={deleteSubactivityDialog.open}
          onOpenChange={(open) =>
            setDeleteSubactivityDialog({ ...deleteSubactivityDialog, open })
          }
        >
          <AlertDialogContent className="glass-card border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Tem certeza que deseja deletar o checklist "{deleteSubactivityDialog.subactivityTitle}"?
                <br />
                <span className="text-red-400 font-medium">
                  Esta ação não pode ser desfeita.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="glass hover:bg-secondary/50">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteSubactivity(deleteSubactivityDialog.subactivityId)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
        </div>
      </PageLayout>
    </>
  );
}
