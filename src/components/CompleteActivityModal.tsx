import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

interface CompleteActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (comment: string) => Promise<void>;
  activityTitle: string;
}

export const CompleteActivityModal = ({
  open,
  onOpenChange,
  onComplete,
  activityTitle,
}: CompleteActivityModalProps) => {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!comment.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onComplete(comment);
      setComment("");
      onOpenChange(false);
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
    </Dialog>
  );
};
