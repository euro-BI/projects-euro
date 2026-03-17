
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, HelpCircle, Calculator, Target } from "lucide-react";

interface MetricHelpProps {
  title: string;
  definition: string;
  formula: string;
  importance: string;
  children: React.ReactNode;
}

export function MetricHelpDialog({ title, definition, formula, importance, children }: MetricHelpProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-md backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-euro-gold" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-[10px] font-data text-euro-gold uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3 h-3" />
              O que é?
            </h4>
            <p className="text-sm text-white/80 leading-relaxed font-ui">
              {definition}
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-[10px] font-data text-euro-gold uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-3 h-3" />
              Como é calculado?
            </h4>
            <p className="text-sm font-mono text-white/90 bg-black/20 p-2 rounded border border-white/5">
              {formula}
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-[10px] font-data text-euro-gold uppercase tracking-widest flex items-center gap-2">
              <Target className="w-3 h-3" />
              Importância
            </h4>
            <p className="text-sm text-white/80 leading-relaxed font-ui italic">
              {importance}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 opacity-40">
          <p className="text-[9px] font-ui text-center uppercase tracking-tighter">
            Euro Marketing Intelligence • Metragem de Precisão
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
