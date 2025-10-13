import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Subactivity {
  id: string;
  title: string;
  status: "Pendente" | "Concluído";
  peso: number;
}

interface CompleteActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (comment: string) => Promise<void>;
  activityTitle: string;
  pendingChecklists?: Subactivity[];
}

export const CompleteActivityModal = ({
  open,
  onOpenChange,
  onComplete,
  activityTitle,
  pendingChecklists = [],
}: CompleteActivityModalProps) => {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChecklistWarning, setShowChecklistWarning] = useState(false);

  const hasPendingChecklists = pendingChecklists.length > 0;

  const handleComplete = async () => {
    if (!comment.trim()) return;
    
    // Se há checklists pendentes, mostrar aviso e não permitir conclusão
    if (hasPendingChecklists) {
      setShowChecklistWarning(true);
      return;
    }
    
    // Se não há checklists pendentes, concluir diretamente
    await completeActivity();
  };

  const completeActivity = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(comment);
      setComment("");
      onOpenChange(false);
      setShowChecklistWarning(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-primary/30 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <DialogTitle className="text-xl">Concluir Atividade</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            <span className="font-medium text-foreground">{activityTitle}</span>
            <br />
            Adicione um comentário sobre a conclusão desta atividade.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            placeholder="Descreva o que foi realizado, observações importantes..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="glass min-h-[120px] resize-none"
            autoFocus
          />
          {comment.trim().length === 0 && (
            <p className="text-xs text-destructive mt-2">* Comentário obrigatório</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!comment.trim() || isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan-sm hover:glow-cyan transition-all"
          >
            {isSubmitting ? "Concluindo..." : "Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Aviso sobre Checklists Pendentes */}
      <AlertDialog open={showChecklistWarning} onOpenChange={setShowChecklistWarning}>
        <AlertDialogContent className="glass-card border-red-500/30">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl">Não é possível concluir</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground">
              Esta atividade possui <span className="font-medium text-foreground">{pendingChecklists.length}</span> checklist(s) pendente(s) que devem ser concluídos primeiro:
              <div className="mt-3 space-y-2">
                {pendingChecklists.map((checklist) => (
                  <div key={checklist.id} className="flex items-center gap-2 p-2 rounded bg-secondary/30">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-sm">{checklist.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm font-medium text-red-400">
                ⚠️ Conclua todos os checklists antes de finalizar a atividade.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowChecklistWarning(false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
