import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProjectCardProps {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  activitiesCount?: number;
  progress?: number;
}

export const ProjectCard = ({
  id,
  name,
  description,
  createdAt,
  activitiesCount = 0,
  progress = 0,
}: ProjectCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/projects/${id}`)}
      className="glass-card p-6 cursor-pointer hover-lift hover:border-primary/40 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 glow-cyan-sm group-hover:glow-cyan transition-all">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
            {name}
          </h3>
          
          {description && (
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {description}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(createdAt), "dd MMM yyyy", { locale: ptBR })}
            </div>
            
            <div className="flex items-center gap-1">
              <span className="font-medium text-primary">{activitiesCount}</span>
              <span>atividades</span>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>
    </Card>
  );
};
