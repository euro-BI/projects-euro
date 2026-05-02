import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssessorResumo } from "@/types/dashboard";
import { ArrowUpDown, ArrowUp, ArrowDown, User, Shield, Wallet, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmtCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export interface FundingMonthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string | null;      // "2026-04" format
  yearlyData: AssessorResumo[]; // full year data - we filter by monthKey
}

export function FundingMonthDialog({ isOpen, onClose, monthKey, yearlyData }: FundingMonthDialogProps) {
  const [sortKey, setSortKey] = useState("captacao_liquida_total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggle = (k: string) => {
    if (sortKey === k) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-1 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-euro-gold ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-euro-gold ml-1 inline" />;
  };

  // Filter rows for the selected month
  const monthData = useMemo(() => {
    if (!monthKey) return [];
    return yearlyData.filter(r => format(parseISO(r.data_posicao), "yyyy-MM") === monthKey);
  }, [yearlyData, monthKey]);

  // Summary KPIs
  const summary = useMemo(() => {
    const s = {
      pf: 0, pj: 0, transf: 0, total: 0, meta: 0,
      ativacao_300k: 0, ativacao_1kk: 0,
    };
    monthData.forEach(r => {
      s.pf += r.captacao_liquida_total_pf || 0;
      s.pj += r.captacao_liquida_total_pj || 0;
      s.transf += r.captacao_transf_liquida || 0;
      s.total += r.captacao_liquida_total || 0;
      s.meta += r.meta_captacao || 0;
      s.ativacao_300k += r.ativacao_300k || 0;
      s.ativacao_1kk += r.ativacao_1kk || 0;
    });
    return s;
  }, [monthData]);

  // Sort table
  const sortedData = useMemo(() => {
    return [...monthData].sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [monthData, sortKey, sortDir]);

  const monthLabel = monthKey
    ? (() => { try { return format(parseISO(`${monthKey}-01`), "MMMM yyyy", { locale: ptBR }); } catch { return monthKey; } })()
    : "";

  if (!monthKey) return null;

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0A0A0B] border-euro-gold/20 text-white sm:max-w-[1200px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />

        {/* HEADER */}
        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/5 flex-shrink-0">
          <DialogTitle className="text-euro-gold font-display text-xl tracking-wide flex items-center gap-3">
            <Wallet className="w-5 h-5 text-euro-gold" />
            Captação Líquida — {monthLabel}
          </DialogTitle>
          <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
            Breakdown por tipo de pessoa, transferências e ativações
          </DialogDescription>
        </DialogHeader>

        {/* KPI CARDS */}
        <div className="px-6 pt-5 flex-shrink-0">
          {/* Row 1 — Captação breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total", value: summary.total, color: "#FAC017", sub: `Meta: ${fmtCurrency(summary.meta)}` },
              { label: "PF", value: summary.pf, color: "#3B82F6" },
              { label: "PJ", value: summary.pj, color: "#8B5CF6" },
              { label: "Transferências", value: summary.transf, color: "#EC4899" },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ background: c.color }} />
                <p className="text-[10px] font-data uppercase tracking-widest text-white/40 mb-1">{c.label}</p>
                <p className="text-lg font-display" style={{ color: c.value >= 0 ? c.color : "#EF4444" }}>
                  {fmtCurrency(c.value)}
                </p>
                {c.sub && <p className="text-[10px] font-data text-white/30 mt-1">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Row 2 — Ativações */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Ativações 300k+", value: summary.ativacao_300k, icon: Zap, color: "#22C55E" },
              { label: "Ativações 1M+", value: summary.ativacao_1kk, icon: Users, color: "#F59E0B" },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${c.color}15` }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
                <div>
                  <p className="text-[10px] font-data uppercase tracking-widest text-white/40">{c.label}</p>
                  <p className="text-2xl font-display" style={{ color: c.color }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6 min-h-0">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="bg-[#0A0A0B] text-[10px] font-data uppercase tracking-widest text-euro-gold border-b border-white/10">
                  <Th col="nome_assessor" label="Assessor" toggle={toggle} SortIcon={SortIcon} />
                  <Th col="captacao_liquida_total" label="Total" toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="captacao_liquida_total_pf" label="PF" toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="captacao_liquida_total_pj" label="PJ" toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="captacao_transf_liquida" label="Transf." toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="meta_captacao" label="Meta" toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="ativacao_300k" label="300k+" toggle={toggle} SortIcon={SortIcon} right />
                  <Th col="ativacao_1kk" label="1M+" toggle={toggle} SortIcon={SortIcon} right />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {sortedData.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-white/40 font-data">Sem dados</td></tr>
                ) : sortedData.map(r => (
                  <tr key={r.cod_assessor} className="group even:bg-white/[0.02] hover:bg-white/[0.05] transition-all text-xs font-data">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full bg-euro-inset flex items-center justify-center text-[10px] font-bold text-euro-gold/40 border border-white/10 overflow-hidden flex-shrink-0",
                          r.lider && "border-euro-gold shadow-[0_0_8px_rgba(250,192,23,0.3)]"
                        )}>
                          {r.foto_url
                            ? <img src={r.foto_url} alt={r.nome_assessor} className="w-full h-full object-cover" />
                            : <User className="w-4 h-4 opacity-20" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-bold truncate block uppercase tracking-tight text-[11px]">{r.nome_assessor}</span>
                          <span className="text-[10px] text-white/40 font-mono">{r.cod_assessor}</span>
                        </div>
                      </div>
                    </td>
                    <CurrencyCell value={r.captacao_liquida_total} bold />
                    <CurrencyCell value={r.captacao_liquida_total_pf} />
                    <CurrencyCell value={r.captacao_liquida_total_pj} />
                    <CurrencyCell value={r.captacao_transf_liquida} />
                    <CurrencyCell value={r.meta_captacao} color="#FAC017" />
                    <td className="py-3 px-4 text-right text-white/80">{r.ativacao_300k || 0}</td>
                    <td className="py-3 px-4 text-right text-white/80">{r.ativacao_1kk || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- tiny helpers ---- */
function Th({ col, label, toggle, SortIcon, right }: {
  col: string; label: string; toggle: (k: string) => void;
  SortIcon: React.FC<{ col: string }>; right?: boolean;
}) {
  return (
    <th
      onClick={() => toggle(col)}
      className={cn(
        "py-4 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap",
        right && "text-right"
      )}
    >
      <div className={cn("flex items-center gap-1", right && "justify-end")}>
        {label} <SortIcon col={col} />
      </div>
    </th>
  );
}

function CurrencyCell({ value, bold, color }: { value: number; bold?: boolean; color?: string }) {
  const v = value || 0;
  const isNeg = v < 0;
  const style = color && !isNeg ? { color } : undefined;
  return (
    <td className={cn("py-3 px-4 text-right whitespace-nowrap", bold && "font-bold", isNeg ? "text-red-400" : color ? "" : "text-white")} style={style}>
      {fmtCurrency(v)}
    </td>
  );
}
