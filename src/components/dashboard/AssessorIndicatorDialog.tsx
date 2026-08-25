import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssessorResumo } from "@/types/dashboard";
import { Target, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export type AssessorProductRow = {
  key: string;
  label: string;
  realized: number;
  target: number;
  percent: number;
  gap: number;
};

export interface AssessorIndicatorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assessor: AssessorResumo | null;
  metricLabel: string;
  monthLabel: string;
  rows: AssessorProductRow[];
  shareMode?: boolean;
  targetKind?: "breakeven" | "roa";
}

function statusColor(percent: number) {
  if (percent >= 100) return "text-green-500";
  if (percent >= 70) return "text-euro-gold";
  return "text-red-400";
}

function barColor(percent: number) {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 70) return "bg-euro-gold";
  return "bg-red-500";
}

export function AssessorIndicatorDialog({
  isOpen,
  onClose,
  assessor,
  metricLabel,
  monthLabel,
  rows,
  shareMode = false,
  targetKind = "roa",
}: AssessorIndicatorDialogProps) {
  if (!assessor) return null;

  const totalRealized = rows.reduce((acc, row) => acc + row.realized, 0);
  const totalTarget = rows.reduce((acc, row) => acc + row.target, 0);
  const totalPercent = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;
  const totalGap = totalTarget - totalRealized;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#0A0A0B] border-euro-gold/20 text-white sm:max-w-[820px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />

        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/5 flex-shrink-0">
          <DialogTitle className="text-euro-gold font-display text-xl tracking-wide flex items-center gap-3">
            <Target className="w-5 h-5 text-euro-gold" />
            {metricLabel} — {assessor.nome_assessor}
          </DialogTitle>
          <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
            {shareMode
              ? "Participação no total da casa"
              : targetKind === "breakeven"
                ? "Receita vs meta breakeven rateada pela meta de receita"
                : "Receita vs meta ROA da custódia"}{" "}
            • {monthLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-5 flex-shrink-0">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
            <div
              className={cn(
                "w-12 h-12 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden flex-shrink-0",
                assessor.lider && "border-euro-gold shadow-[0_0_8px_rgba(250,192,23,0.3)]"
              )}
            >
              {assessor.foto_url ? (
                <img src={assessor.foto_url} alt={assessor.nome_assessor} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 opacity-20" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-data text-sm uppercase tracking-tight truncate">{assessor.nome_assessor}</p>
                {assessor.lider && <Shield className="w-3.5 h-3.5 text-euro-gold shrink-0" />}
              </div>
              <p className="text-[11px] text-white/45 font-mono">
                {assessor.cod_assessor} • {assessor.time}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className={cn("text-2xl font-display", shareMode ? "text-euro-gold" : statusColor(totalPercent))}>
                {shareMode
                  ? `${totalPercent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                  : `${Math.round(totalPercent)}%`}
              </p>
              <p className="text-[10px] font-data uppercase tracking-widest text-white/35">
                {shareMode ? "% do total" : "Atingimento"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Realizado", value: formatCurrency(totalRealized), color: "text-white" },
              { label: shareMode ? "Total da casa" : "Meta", value: formatCurrency(totalTarget), color: "text-euro-gold" },
              {
                label: shareMode ? "Resto" : "Gap",
                value: `${totalGap > 0 ? "-" : "+"}${formatCurrency(Math.abs(totalGap))}`,
                color: shareMode ? "text-white/70" : totalGap > 0 ? "text-red-400" : "text-green-400",
              },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-data uppercase tracking-widest text-white/40 mb-1">{card.label}</p>
                <p className={cn("text-lg font-display", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6 min-h-0">
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#0A0A0B] text-[10px] font-data uppercase tracking-widest text-euro-gold border-b border-white/10">
                  <th className="py-3 px-4 font-bold">Produto</th>
                  <th className="py-3 px-4 font-bold text-right">Realizado</th>
                  <th className="py-3 px-4 font-bold text-right">{shareMode ? "Total" : "Meta"}</th>
                  <th className="py-3 px-4 font-bold text-right">{shareMode ? "% do total" : "Ating."}</th>
                  <th className="py-3 px-4 font-bold text-right">{shareMode ? "Resto" : "Gap"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((row) => (
                  <tr key={row.key} className="text-xs font-data even:bg-white/[0.02]">
                    <td className="py-3 px-4 text-white/90">{row.label}</td>
                    <td className="py-3 px-4 text-right text-white">{formatCurrency(row.realized)}</td>
                    <td className="py-3 px-4 text-right text-white/60">{formatCurrency(row.target)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("font-medium", shareMode ? "text-euro-gold" : statusColor(row.percent))}>
                          {row.target > 0
                            ? shareMode
                              ? `${row.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                              : `${Math.round(row.percent)}%`
                            : "—"}
                        </span>
                        <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", shareMode ? "bg-euro-gold" : barColor(row.percent))}
                            style={{ width: `${row.target > 0 ? Math.min(Math.max(row.percent, 0), 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className={cn("py-3 px-4 text-right", shareMode ? "text-white/60" : row.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {row.gap > 0 ? "-" : "+"}
                      {formatCurrency(Math.abs(row.gap))}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-white/40 font-data">
                      Nenhum produto neste indicador.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
