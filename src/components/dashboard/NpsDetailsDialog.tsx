import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Heart, Search, Users, CheckCircle2, XCircle, AlertTriangle, Star, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ===========================================================================
// Tipos
// ===========================================================================

export interface NpsRow {
  assessor: string;
  conta: string;
  jornada: string;
  tipo_convite: string;
  status: string;
  data_envio: string | null;
  data_resposta: string | null;
  data_real: string | null;
  abriu_email: boolean;
  continha_pergunta: boolean;
  nota_score: number | null;
  classificacao_nps: string | null;
}

interface NpsDetailsDialogProps {
  children: React.ReactNode;
  data: NpsRow[];
  selectedMonth: string;
  score: number | null;
  promotores: number;
  passivos: number;
  detratores: number;
  totalRespostas: number;
  atingido: boolean | null;
  metaNps: number;
  minAmostras: number;
}

// ===========================================================================
// Helpers
// ===========================================================================

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const CLASSIF_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  Promotor:  { color: "#10B981", label: "Promotor",  icon: CheckCircle2 },
  Passivo:   { color: "#F59E0B", label: "Passivo",   icon: AlertTriangle },
  Detrator:  { color: "#F43F5E", label: "Detrator",  icon: XCircle },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Finished: { color: "#10B981", label: "Respondeu" },
  Opened:   { color: "#F59E0B", label: "Abriu email" },
  Started:  { color: "#818CF8", label: "Iniciou" },
  Sent:     { color: "#64748B", label: "Enviado" },
};

// ===========================================================================
// Componente
// ===========================================================================

export function NpsDetailsDialog({
  children,
  data,
  selectedMonth,
  score,
  promotores,
  passivos,
  detratores,
  totalRespostas,
  atingido,
  metaNps,
  minAmostras,
}: NpsDetailsDialogProps) {
  type FilterKey = "todos" | "promotor" | "passivo" | "detrator" | "sem_nota";
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todos");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Todos os registros (incluindo não-respondidos) ordenados
  const sorted = React.useMemo(() => {
    return [...data].sort((a, b) => {
      // Respondidos primeiro (Finished com nota)
      const aFinished = a.status === "Finished" && a.nota_score !== null ? 0 : 1;
      const bFinished = b.status === "Finished" && b.nota_score !== null ? 0 : 1;
      if (aFinished !== bFinished) return aFinished - bFinished;
      // Dentro dos respondidos: Detratores primeiro
      const classifOrder: Record<string, number> = { Detrator: 0, Passivo: 1, Promotor: 2 };
      const aOrder = classifOrder[a.classificacao_nps ?? ""] ?? 3;
      const bOrder = classifOrder[b.classificacao_nps ?? ""] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.data_real ?? "").localeCompare(a.data_real ?? "");
    });
  }, [data]);

  const filtered = React.useMemo(() => {
    let result = sorted.filter((r) => {
      if (activeFilter === "promotor"  && r.classificacao_nps !== "Promotor")  return false;
      if (activeFilter === "passivo"   && r.classificacao_nps !== "Passivo")   return false;
      if (activeFilter === "detrator"  && r.classificacao_nps !== "Detrator")  return false;
      if (activeFilter === "sem_nota"  && r.nota_score !== null)               return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.conta?.toLowerCase().includes(s) ||
          r.assessor?.toLowerCase().includes(s) ||
          r.jornada?.toLowerCase().includes(s)
        );
      }
      return true;
    });

    if (sortConfig !== null) {
      result.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'nota_score') {
          aValue = aValue ?? -1;
          bValue = bValue ?? -1;
        } else {
          aValue = aValue ?? "";
          bValue = bValue ?? "";
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [sorted, activeFilter, search, sortConfig]);

  const semRespostaCount = data.filter(r => r.nota_score === null).length;

  const mesLabel = (() => {
    try { return format(parseISO(selectedMonth), "MMMM 'de' yyyy", { locale: ptBR }); }
    catch { return selectedMonth; }
  })();

  const amostrageSuficiente = totalRespostas >= minAmostras;

  const selectedMonthKey = React.useMemo(() => {
    try {
      return format(parseISO(selectedMonth), "yyyy-MM");
    } catch {
      return String(selectedMonth);
    }
  }, [selectedMonth]);

  const downloadXLSX = () => {
    const exportRows = filtered.map((r) => ({
      classificacao_nps: r.classificacao_nps ?? null,
      nota_score: r.nota_score ?? null,
      conta: r.conta ?? null,
      assessor: r.assessor ?? null,
      jornada: r.jornada ?? null,
      tipo_convite: r.tipo_convite ?? null,
      status: r.status ?? null,
      data_envio: r.data_envio ?? null,
      data_resposta: r.data_resposta ?? null,
      data_real: r.data_real ?? null,
      abriu_email: r.abriu_email ?? null,
      continha_pergunta: r.continha_pergunta ?? null,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NPS");
    XLSX.writeFile(workbook, `nps_${selectedMonthKey}.xlsx`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">

        {/* ── Header ── */}
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Título */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                <Heart className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Qualidade (NPS)
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  Pesquisas NPS · {mesLabel} · Meta ≥ {metaNps} pts
                </p>
              </div>
            </div>

            {/* Score + breakdown */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Score principal */}
              <div className={cn(
                "px-4 py-2 rounded-xl border text-center min-w-[90px]",
                !amostrageSuficiente
                  ? "bg-amber-500/10 border-amber-500/30"
                  : atingido
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-rose-500/10 border-rose-500/30"
              )}>
                <p className={cn("text-2xl font-display font-bold",
                  !amostrageSuficiente ? "text-amber-400" : atingido ? "text-emerald-400" : "text-rose-400"
                )}>
                  {score !== null ? score : "—"}
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  {totalRespostas} resp. · meta {metaNps}
                </p>
              </div>

              {/* Breakdown P/Pa/D */}
              <div className="flex flex-col gap-1">
                {[
                  { label: "Promotores", count: promotores, color: "#10B981" },
                  { label: "Passivos",   count: passivos,   color: "#F59E0B" },
                  { label: "Detratores", count: detratores, color: "#F43F5E" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[11px] font-data" style={{ color }}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{count} {label}</span>
                  </div>
                ))}
              </div>

              {/* Status da meta */}
              <div className={cn(
                "flex items-center gap-1.5 text-[11px] font-data self-end",
                !amostrageSuficiente ? "text-amber-400" : atingido ? "text-emerald-400" : "text-rose-400"
              )}>
                {!amostrageSuficiente ? (
                  <><AlertTriangle className="w-3.5 h-3.5" /><span>Amostra insuficiente ({totalRespostas}/{minAmostras})</span></>
                ) : atingido ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /><span>Meta atingida</span></>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /><span>Faltam {metaNps - (score ?? 0)} pontos</span></>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-white/70 hover:text-white hover:bg-white/5"
                onClick={downloadXLSX}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                XLSX
              </Button>
            </div>
          </div>

          {/* Filtros + busca */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 flex-wrap">
              {([
                { key: "todos",    label: `Todos (${data.length})` },
                { key: "promotor", label: `★ Promotores (${promotores})`,  activeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
                { key: "passivo",  label: `~ Passivos (${passivos})`,      activeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
                { key: "detrator", label: `✗ Detratores (${detratores})`, activeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/30" },
                { key: "sem_nota", label: `— Sem nota (${semRespostaCount})`, activeClass: "bg-white/10 text-white/60 border border-white/20" },
              ] as { key: FilterKey; label: string; activeClass?: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-data uppercase tracking-widest transition-all whitespace-nowrap",
                    activeFilter === f.key
                      ? (f.activeClass ?? "bg-white/10 text-white border border-white/20")
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por conta ou assessor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        {/* ── Tabela ── */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[42vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('classificacao_nps')}><div className="flex items-center gap-1">Classificação <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('conta')}><div className="flex items-center gap-1">Conta <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('assessor')}><div className="flex items-center gap-1">Assessor <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('jornada')}><div className="flex items-center gap-1">Jornada <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('tipo_convite')}><div className="flex items-center gap-1">Tipo Convite <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('nota_score')}><div className="flex items-center justify-center gap-1">Nota <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('status')}><div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('data_envio')}><div className="flex items-center gap-1">Data Envio <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('data_resposta')}><div className="flex items-center gap-1">Data Resposta <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length > 0 ? (
                      filtered.map((item, idx) => {
                        const classif = item.classificacao_nps
                          ? CLASSIF_CONFIG[item.classificacao_nps]
                          : null;
                        const statusCfg = STATUS_CONFIG[item.status] ?? { color: "#64748B", label: item.status };
                        const ClassifIcon = classif?.icon ?? Star;

                        return (
                          <tr
                            key={`${item.conta}-${idx}`}
                            className={cn(
                              "group transition-all text-[12px] font-data border-l-2",
                              item.classificacao_nps === "Detrator"
                                ? "bg-rose-500/[0.05] hover:bg-rose-500/[0.10] border-l-rose-500/60"
                                : item.classificacao_nps === "Promotor"
                                  ? "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08] border-l-emerald-500/40"
                                  : item.classificacao_nps === "Passivo"
                                    ? "hover:bg-white/[0.03] border-l-amber-500/30"
                                    : "hover:bg-white/[0.03] border-l-transparent"
                            )}
                          >
                            {/* Classificação */}
                            <td className="py-3 px-4">
                              {classif ? (
                                <span className="flex items-center gap-1.5" style={{ color: classif.color }}>
                                  <ClassifIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="text-[10px] uppercase tracking-wider font-bold">{classif.label}</span>
                                </span>
                              ) : (
                                <span className="text-white/25 text-[10px] uppercase tracking-wider">—</span>
                              )}
                            </td>

                            {/* Conta */}
                            <td className="py-3 px-4">
                              <span className={cn(
                                "font-bold tracking-tight",
                                item.classificacao_nps === "Detrator" ? "text-rose-200" : "text-white"
                              )}>
                                {item.conta ?? "—"}
                              </span>
                            </td>

                            {/* Assessor */}
                            <td className="py-3 px-4 text-white/60 text-[11px]">
                              {item.assessor ?? "—"}
                            </td>

                            {/* Jornada */}
                            <td className="py-3 px-4">
                              <span className="text-[11px] text-white/50 truncate block max-w-[140px]" title={item.jornada}>
                                {item.jornada ?? "—"}
                              </span>
                            </td>

                            {/* Nota */}
                            <td className="py-3 px-4 text-center">
                              {item.nota_score !== null ? (
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-display font-bold border"
                                  style={{
                                    color: classif?.color ?? "#ffffff",
                                    borderColor: `${classif?.color ?? "#ffffff"}40`,
                                    background: `${classif?.color ?? "#ffffff"}10`,
                                  }}
                                >
                                  {item.nota_score}
                                </span>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* Status do envio */}
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-data px-2 py-0.5 rounded-full border"
                                style={{
                                  color: statusCfg.color,
                                  borderColor: `${statusCfg.color}40`,
                                  background: `${statusCfg.color}10`,
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                                {statusCfg.label}
                              </span>
                            </td>

                            {/* Tipo Convite */}
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-data px-2 py-0.5 rounded-full border whitespace-nowrap"
                                style={{
                                  color: item.tipo_convite === "Lembrete" ? "#818CF8" : "#94A3B8",
                                  borderColor: item.tipo_convite === "Lembrete" ? "#818CF840" : "#94A3B840",
                                  background: item.tipo_convite === "Lembrete" ? "#818CF810" : "#94A3B810",
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                                {item.tipo_convite ?? "—"}
                              </span>
                            </td>

                            {/* Data Envio */}
                            <td className="py-3 px-4 text-white/40 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(item.data_envio)}
                            </td>

                            {/* Data Resposta */}
                            <td className="py-3 px-4 text-white/40 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(item.data_resposta)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-20 text-center opacity-30">
                          <div className="flex flex-col items-center gap-4">
                            <Users className="w-10 h-10" />
                            <p className="text-sm font-data uppercase tracking-widest">
                              Nenhum registro encontrado
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

          {/* ── Banner de meta ── */}
          {totalRespostas > 0 && (() => {
            const isOk = amostrageSuficiente && atingido;
            const isWarn = !amostrageSuficiente;
            const bgClass = isWarn
              ? "bg-amber-500/10 border-amber-500/20"
              : isOk
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/20";
            const icon = isWarn
              ? <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              : isOk
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />;

            return (
              <div className={`mx-6 mb-4 flex items-start gap-3 p-4 rounded-xl border ${bgClass}`}>
                {icon}
                <div className="text-[12px] font-data space-y-1">
                  {isWarn ? (
                    <>
                      <p className="text-amber-300/90">
                        <span className="font-bold text-amber-300">Amostra insuficiente.</span>{" "}
                        São necessárias pelo menos {minAmostras} respostas para validar o NPS. Atual: {totalRespostas}.
                      </p>
                      <p className="text-white/40">
                        Score calculado: {score} — mas o KPI não será contabilizado sem a amostragem mínima.
                      </p>
                    </>
                  ) : isOk ? (
                    <p className="text-emerald-300/90">
                      <span className="font-bold text-emerald-300">Meta atingida!</span>{" "}
                      NPS {score} ≥ {metaNps} com {totalRespostas} respostas válidas.
                      ({promotores}P · {passivos}Pa · {detratores}D)
                    </p>
                  ) : (
                    <>
                      <p className="text-rose-300/90">
                        <span className="font-bold text-rose-300">Faltam {metaNps - (score ?? 0)} pontos</span>{" "}
                        para atingir a meta de NPS ≥ {metaNps}.
                      </p>
                      <p className="text-white/40">
                        Score atual: {score} · {promotores} Promotores · {detratores} Detratores · {passivos} Passivos
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
