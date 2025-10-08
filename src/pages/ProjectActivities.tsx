import { useEffect, useState } from "react";
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
  ArrowLeft,
  PlusCircle,
  Calendar,
  User,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      loadProjectData();
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const handleToggleSubactivity = async (subId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Pendente" ? "Concluído" : "Pendente";
    
    try {
      const { error } = await supabase
        .from("subactivities")
        .update({ status: newStatus })
        .eq("id", subId);

      if (error) throw error;
      
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
      const { error } = await supabase.from("subactivities").insert({
        activity_id: subactivityDialog.activityId,
        title: newSubactivity.title,
        status: "Pendente",
      });

      if (error) throw error;

      toast.success("Checklist adicionado com sucesso!");
      setSubactivityDialog({ open: false, activityId: "" });
      setNewSubactivity({ title: "" });
      loadProjectData();
    } catch (error) {
      console.error("Error creating subactivity:", error);
      toast.error("Erro ao criar checklist");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
                          className="flex items-center gap-3 p-3 rounded-lg glass hover:bg-secondary/50 transition-colors"
                        >
                          <Checkbox
                            checked={sub.status === "Concluído"}
                            onCheckedChange={() =>
                              handleToggleSubactivity(sub.id, sub.status)
                            }
                          />
                          <span
                            className={
                              sub.status === "Concluído"
                                ? "line-through text-muted-foreground"
                                : ""
                            }
                          >
                            {sub.title}
                          </span>
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
      </div>
    </div>
  );
}
