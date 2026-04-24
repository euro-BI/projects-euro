import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrendingUp, Search, Users, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ===========================================================================
// Tipos
// ===========================================================================

export interface VolumeConsultivoRow {
  cliente: string;
  tipo_pessoa: string | null;
  net_em_m: number | null;
  data_posicao: string;
  nome_assessor: string | null;
  cod_assessor: string | null;
  id_atividade: string | null;
  pipe: string | null;
  data_esforco: string | null;
}

interface VolumeConsultivoDialogProps {
  children: React.ReactNode;
  data: VolumeConsultivoRow[];
  totalReunioes: number;
  atingido: boolean;
  meta: number;
}

// ===========================================================================
// Helpers
// ===========================================================================

const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const PIPE_COLORS: Record<string, string> = {
  "Revisão de Carteira": "#FAC017",
  "Reunião de Apresentação FP": "#818CF8",
};

// ===========================================================================
// Componente
// ===========================================================================

export function VolumeConsultivoDialog({
  children,
  data,
  totalReunioes,
  atingido,
  meta,
}: VolumeConsultivoDialogProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "revisao" | "apresentacao">("todos");

  const revisaoCount = data.filter(r => r.pipe === "Revisão de Carteira").length;
  const apresentacaoCount = data.filter(r => r.pipe === "Reunião de Apresentação FP").length;

  const filtered = React.useMemo(() => {
    return data
      .filter(r => {
        if (activeFilter === "revisao" && r.pipe !== "Revisão de Carteira") return false;
        if (activeFilter === "apresentacao" && r.pipe !== "Reunião de Apresentação FP") return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            r.cliente?.toLowerCase().includes(s) ||
            r.nome_assessor?.toLowerCase().includes(s) ||
            r.pipe?.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => (b.data_esforco ?? "").localeCompare(a.data_esforco ?? ""));
  }, [data, activeFilter, search]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Volume Consultivo Mensal
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  Revisão de Carteira · Apresentação FP · Meta: {meta} reuniões
                </p>
              </div>
            </div>

            {/* Resumo do KPI */}
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl border text-center min-w-[100px]",
                  atingido
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-rose-500/10 border-rose-500/30"
                )}
              >
                <p
                  className={cn(
                    "text-2xl font-display font-bold",
                    atingido ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {totalReunioes}
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  de {meta} reuniões
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[11px] font-data" style={{ color: PIPE_COLORS["Revisão de Carteira"] }}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{revisaoCount} Revisão de Carteira</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-data" style={{ color: PIPE_COLORS["Reunião de Apresentação FP"] }}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{apresentacaoCount} Apresentação FP</span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-data mt-0.5", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {atingido
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Meta atingida</span></>
                    : <><XCircle className="w-3.5 h-3.5" /><span>Faltam {meta - totalReunioes} reunião(ões)</span></>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Filtros e busca */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {/* Tabs de filtro */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0">
              {[
                { key: "todos", label: `Todos (${data.length})` },
                { key: "revisao", label: `Revisão (${revisaoCount})` },
                { key: "apresentacao", label: `Apresentação FP (${apresentacaoCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key as "todos" | "revisao" | "apresentacao")}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-data uppercase tracking-widest transition-all whitespace-nowrap",
                    activeFilter === f.key
                      ? "bg-white/10 text-white border border-white/20"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por cliente, assessor ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Tabela */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[45vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold">Assessor</th>
                      <th className="py-3 px-4 font-bold">Cod. Cliente</th>
                      <th className="py-3 px-4 font-bold text-right">Net</th>
                      <th className="py-3 px-4 font-bold">Tipo de Reunião</th>
                      <th className="py-3 px-4 font-bold">ID Atividade</th>
                      <th className="py-3 px-4 font-bold">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length > 0 ? (
                      filtered.map((item, idx) => {
                        const pipeColor = PIPE_COLORS[item.pipe ?? ""] ?? "#A0A090";
                        return (
                          <tr
                            key={`${item.cliente}-${item.id_atividade}-${idx}`}
                            className="group hover:bg-white/[0.04] transition-all text-[12px] font-data"
                          >
                            {/* Assessor */}
                            <td className="py-3 px-4">
                              <div className="text-white/90 truncate max-w-[130px]" title={item.nome_assessor ?? ""}>
                                {item.nome_assessor ?? "—"}
                              </div>
                              <div className="text-white/30 text-[10px]">{item.cod_assessor ?? ""}</div>
                            </td>

                            {/* Cliente */}
                            <td className="py-3 px-4">
                              <span className="font-bold text-white tracking-tight">
                                {item.cliente ?? "—"}
                              </span>
                            </td>

                            {/* Net */}
                            <td className="py-3 px-4 text-right font-mono text-white/70">
                              {formatCurrency(item.net_em_m)}
                            </td>

                            {/* Pipe */}
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center gap-1.5 text-[11px] font-data px-2 py-0.5 rounded-full border"
                                style={{
                                  color: pipeColor,
                                  borderColor: `${pipeColor}40`,
                                  backgroundColor: `${pipeColor}10`,
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                                {item.pipe ?? "—"}
                              </span>
                            </td>

                            {/* ID Atividade */}
                            <td className="py-3 px-4 text-white/50 font-mono text-[11px]">
                              {item.id_atividade ?? <span className="text-white/20">—</span>}
                            </td>

                            {/* Data */}
                            <td className="py-3 px-4 text-white/50 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(item.data_esforco)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-20 text-center opacity-30">
                          <div className="flex flex-col items-center gap-4">
                            <Users className="w-10 h-10" />
                            <p className="text-sm font-data uppercase tracking-widest">
                              Nenhuma reunião encontrada
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mx-6 mb-4 mt-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">Progresso da meta</span>
              <span className="text-[10px] font-data text-white/60 font-mono">{totalReunioes}/{meta}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  atingido ? "bg-emerald-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min((totalReunioes / meta) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
