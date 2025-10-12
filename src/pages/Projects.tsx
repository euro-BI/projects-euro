import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectCard } from "@/components/ProjectCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusCircle, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  activities_count?: number;
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects_projects")
        .select(`
          *,
          activities_count:projects_activities(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to include activities count
      const projectsWithCount = (data || []).map(project => ({
        ...project,
        activities_count: project.activities_count?.[0]?.count || 0
      }));
      
      setProjects(projectsWithCount);
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Erro ao carregar projetos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error("Nome do projeto é obrigatório");
      return;
    }

    try {
      const { error } = await supabase.from("projects_projects").insert({
        name: newProject.name,
        description: newProject.description || null,
      });

      if (error) throw error;

      toast.success("Projeto criado com sucesso!");
      setIsDialogOpen(false);
      setNewProject({ name: "", description: "" });
      loadProjects();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Erro ao criar projeto");
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">Projetos</h1>
            <p className="text-muted-foreground">Gerencie seus projetos de consultoria</p>
          </div>

          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-8 animate-slide-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar projetos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass pl-10"
          />
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            Carregando projetos...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Nenhum projeto encontrado" : "Nenhum projeto criado ainda"}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
                className="glass border-primary/30"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Criar Primeiro Projeto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                description={project.description || undefined}
                createdAt={project.created_at}
                activitiesCount={project.activities_count}
              />
            ))}
          </div>
        )}

        {/* Create Project Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="glass-card border-primary/30">
            <DialogHeader>
              <DialogTitle className="text-2xl">Novo Projeto</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nome *</label>
                <Input
                  placeholder="Nome do projeto"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  className="glass"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Descrição</label>
                <Textarea
                  placeholder="Descreva o projeto..."
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  className="glass min-h-[100px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateProject}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm"
              >
                Criar Projeto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
