import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "Pendente" | "Em andamento" | "Concluído";
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const variants = {
    Pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "Em andamento": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Concluído: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
        variants[status],
        className
      )}
    >
      {status}
    </span>
  );
};
