import { cn } from "@/lib/utils";
import { Clock, Play, CheckCircle } from "lucide-react";

interface StatusBadgeProps {
  status: "Pendente" | "Em andamento" | "Concluído";
  className?: string;
  iconOnly?: boolean;
}

export const StatusBadge = ({ status, className, iconOnly = false }: StatusBadgeProps) => {
  const variants = {
    Pendente: "bg-primary/20 text-primary border-primary/30",
    "Em andamento": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Concluído: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const icons = {
    Pendente: Clock,
    "Em andamento": Play,
    Concluído: CheckCircle,
  };

  const Icon = icons[status];

  if (iconOnly) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-full border backdrop-blur-sm",
          variants[status],
          className
        )}
        title={status}
      >
        <Icon className="w-4 h-4" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
        variants[status],
        className
      )}
    >
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  );
};
