import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { parseISO, addMonths, format } from "date-fns";
import { motion } from "framer-motion";
import { 
  ArrowLeft,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Maximize2,
  Minimize2,
  TrendingUp,
  Award,
  Target,
  Users,
  Briefcase,
  Info,
  DollarSign,
  Heart,
  MessageSquare,
  Thermometer,
  Flame,
  Search,
  Wallet,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dashboard Components
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { ActivationDetailsDialog } from "@/components/dashboard/ActivationDetailsDialog";
import AdvisorRevenueTable from "@/components/dashboard/AdvisorRevenueTable";
import { RelacionamentoDetailsDialog, RelacionamentoRow } from "@/components/dashboard/RelacionamentoDetailsDialog";
import { VolumeConsultivoDialog, VolumeConsultivoRow } from "@/components/dashboard/VolumeConsultivoDialog";
import { NpsDetailsDialog, NpsRow } from "@/components/dashboard/NpsDetailsDialog";

// ==========================================================================
// Local Components
// ==========================================================================

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
  tooltipInfo?: string;
  footer?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, icon: Icon, color, delay = 0, tooltipInfo, footer }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full">
        <div className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" style={{ background: color }} />
        <CardContent className="p-5 flex flex-col h-full pl-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-[10px] font-data uppercase tracking-widest text-white/60 mb-1 flex items-center gap-1.5 flex-wrap">
                {title}
                {tooltipInfo && (
                  <TooltipProvider delayDuration={100}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-white/20 hover:text-white/70 transition-colors cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1A2030] border-euro-gold/20 text-white/90 font-data text-xs max-w-[220px]">
                        {tooltipInfo}
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-display text-white truncate">{value}</span>
              </div>
              {subtitle && (
                <span className="text-[10px] font-data text-white/40 mt-1 block uppercase tracking-tighter">{subtitle}</span>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
          {footer && (
            <div className="mt-auto">
              {footer}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// KpiProgressCard — visual card com ATUAL vs META + barra de progresso
// ==========================================================================

interface KpiProgressCardProps {
  title: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
  tooltipInfo?: string;
  // Valores
  valuePrimary: string | null;   // valor atual exibido (ex: "87", "62%", "24")
  valueUnit?: string;            // unidade pequena ao lado (ex: "pts", "reuniões")
  metaValue: string;             // valor da meta (ex: "90", "75%", "30")
  metaUnit?: string;             // unidade da meta
  // Progresso
  progressPct: number | null;    // 0-100 (pode ser calculado externamente)
  // Status
  atingido: boolean | null;      // null = sem dados suficientes
  statusText: string;            // ex: "Faltam 3 pontos", "Meta atingida"
  detailText?: string;           // linha secundária abaixo do status
  warningText?: string;          // aviso em âmbar (ex: "Amostra insuficiente")
}

function KpiProgressCard({
  title, icon: Icon, color, delay = 0, tooltipInfo,
  valuePrimary, valueUnit, metaValue, metaUnit,
  progressPct,
  atingido, statusText, detailText, warningText,
}: KpiProgressCardProps) {
  const pct = Math.min(progressPct ?? 0, 100);
  const accentColor = warningText
    ? "#F59E0B"
    : atingido === null
      ? color
      : atingido
        ? "#10B981"
        : "#F43F5E";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card
        className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full"
        style={{ borderColor: valuePrimary ? `${accentColor}30` : undefined }}
      >
        {/* Faixa lateral colorida */}
        <div className="absolute top-0 left-0 w-1 h-full hidden md:block" style={{ background: accentColor }} />

        <CardContent className="p-5 pl-6 flex flex-col gap-4 h-full">

          {/* Header: ícone + título + tooltip */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[9px] font-data uppercase tracking-widest text-white/50 leading-tight">{title}</span>
            </div>
            {tooltipInfo && (
              <TooltipProvider delayDuration={100}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-white/20 hover:text-white/70 transition-colors cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#1A2030] border-euro-gold/20 text-white/90 font-data text-xs max-w-[220px]">
                    {tooltipInfo}
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>

          {/* ATUAL vs META — destaque principal */}
          <div className="flex items-stretch gap-3">
            {/* Atual */}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-data uppercase tracking-widest text-white/30 mb-1">Atual</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display leading-none" style={{ color: valuePrimary ? accentColor : "rgba(255,255,255,0.2)" }}>
                  {valuePrimary ?? "--"}
                </span>
                {valueUnit && valuePrimary && (
                  <span className="text-[10px] font-data text-white/40">{valueUnit}</span>
                )}
              </div>
            </div>

            {/* Divisor */}
            <div className="w-px bg-white/10 self-stretch" />

            {/* Meta */}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-data uppercase tracking-widest text-white/30 mb-1">Meta</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-display text-white/25 leading-none">{metaValue}</span>
                {metaUnit && (
                  <span className="text-[10px] font-data text-white/20">{metaUnit}</span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-data uppercase tracking-wider text-white/25">Progresso</span>
              <span className="text-[10px] font-mono" style={{ color: valuePrimary ? `${accentColor}CC` : "rgba(255,255,255,0.2)" }}>
                {progressPct !== null ? `${Math.round(progressPct)}%` : "--"}
              </span>
            </div>
            <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.04]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: progressPct !== null
                    ? `linear-gradient(90deg, ${accentColor}50, ${accentColor})`
                    : "transparent",
                  boxShadow: progressPct !== null && pct > 0 ? `0 0 8px ${accentColor}60` : "none",
                }}
              />
            </div>
          </div>

          {/* Status pill */}
          <div className="mt-auto space-y-1">
            {warningText ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-data font-bold uppercase tracking-widest text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {warningText}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-data font-bold uppercase tracking-widest"
                style={{ color: atingido === null ? "rgba(255,255,255,0.3)" : atingido ? "#10B981" : "#F43F5E" }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: atingido === null ? "rgba(255,255,255,0.15)" : atingido ? "#10B981" : "#F43F5E" }}
                />
                {statusText}
              </span>
            )}
            {detailText && (
              <p className="text-[9px] font-data text-white/25 pl-3.5 leading-relaxed">{detailText}</p>
            )}
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}

type IndicacaoEsforcoRow = {
  id_lead: string | number | null;
  valor_lead: number | null;
  cod_assessor: string | null;
  ganho_em: string | null;
  stage?: string | null;
  tipo_pipe?: string | null;
  telefone?: string | null;
};

function IndicacoesConvertidasDialog({
  children,
  data,
  selectedMonth,
  meta,
  bonusValor,
}: {
  children: React.ReactNode;
  data: IndicacaoEsforcoRow[];
  selectedMonth: string;
  meta: number;
  bonusValor: string;
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "qualifica" | "abaixo">("todos");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const VALOR_MINIMO = 300000;

  const allDeals = useMemo(() => {
    const map = new Map<string, {
      id_lead: string;
      valor: number;
      ganho_em: string | null;
      cod_assessor: string | null;
      stage: string | null;
      tipo_pipe: string | null;
      telefone: string | null;
    }>();

    for (const row of data) {
      if (row.id_lead === null || row.id_lead === undefined) continue;
      const key = String(row.id_lead);
      const valor = Number(row.valor_lead ?? 0);

      const current = map.get(key);
      if (!current) {
        map.set(key, {
          id_lead: key,
          valor,
          ganho_em: row.ganho_em ?? null,
          cod_assessor: row.cod_assessor ?? null,
          stage: row.stage ?? null,
          tipo_pipe: row.tipo_pipe ?? null,
          telefone: row.telefone ?? null,
        });
        continue;
      }

      const nextValor = Math.max(current.valor, valor);
      const nextGanho = (() => {
        const a = current.ganho_em ?? "";
        const b = row.ganho_em ?? "";
        if (!a) return b || null;
        if (!b) return current.ganho_em;
        return a < b ? current.ganho_em : row.ganho_em;
      })();

      map.set(key, {
        ...current,
        valor: nextValor,
        ganho_em: nextGanho,
        stage: current.stage ?? row.stage ?? null,
        tipo_pipe: current.tipo_pipe ?? row.tipo_pipe ?? null,
        telefone: current.telefone ?? row.telefone ?? null,
        cod_assessor: current.cod_assessor ?? row.cod_assessor ?? null,
      });
    }

    const list = Array.from(map.values()).map(d => ({
      ...d,
      qualifica: d.valor >= VALOR_MINIMO,
    }));

    return list
      .sort((a, b) => {
        if (a.qualifica !== b.qualifica) return a.qualifica ? -1 : 1;
        return (b.ganho_em ?? "").localeCompare(a.ganho_em ?? "");
      });
  }, [data]);

  const filteredDeals = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allDeals.filter(d => {
      if (activeFilter === "qualifica" && !d.qualifica) return false;
      if (activeFilter === "abaixo" && d.qualifica) return false;
      if (!s) return true;
      return (
        d.id_lead.toLowerCase().includes(s) ||
        (d.cod_assessor ?? "").toLowerCase().includes(s) ||
        (d.stage ?? "").toLowerCase().includes(s) ||
        (d.tipo_pipe ?? "").toLowerCase().includes(s) ||
        (d.telefone ?? "").toLowerCase().includes(s)
      );
    });
  }, [activeFilter, allDeals, search]);

  const qualificados = useMemo(() => allDeals.filter(d => d.qualifica), [allDeals]);

  const totalQualificados = useMemo(() => {
    return new Set(qualificados.map(d => d.id_lead)).size;
  }, [qualificados]);

  const totalValorQualificado = useMemo(() => {
    return qualificados.reduce((sum, d) => sum + (d.valor ?? 0), 0);
  }, [qualificados]);

  const atingido = totalQualificados >= meta;

  const contabilizados = useMemo(() => {
    const sorted = [...qualificados].sort((a, b) => (a.ganho_em ?? "").localeCompare(b.ganho_em ?? ""));
    return new Set(sorted.slice(0, meta).map(d => d.id_lead));
  }, [meta, qualificados]);

  const qualificadosCount = allDeals.filter(d => d.qualifica).length;
  const abaixoCount = allDeals.filter(d => !d.qualifica).length;

  const mesLabel = (() => {
    try { return format(parseISO(selectedMonth), "MMMM 'de' yyyy"); }
    catch { return selectedMonth; }
  })();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Bônus 01 · Indicações Convertidas
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  Negócios ganhos · {mesLabel} · Meta: {meta} conversões ≥ {formatCurrency(VALOR_MINIMO)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl border text-center min-w-[120px]",
                  atingido ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                )}
              >
                <p className={cn("text-2xl font-display font-bold", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {totalQualificados}
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  de {meta} conversões
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-data text-white/60">
                  Valor qualificado: <span className="text-white/90 font-bold">{formatCurrency(totalValorQualificado)}</span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-data", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {atingido
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Ganhou {bonusValor}</span></>
                    : <><XCircle className="w-3.5 h-3.5" /><span>Faltam {meta - totalQualificados} conversão(ões)</span></>
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 flex-wrap">
              {[
                { key: "todos", label: `Todos (${allDeals.length})` },
                { key: "qualifica", label: `Qualificadas (${qualificadosCount})` },
                { key: "abaixo", label: `Abaixo (${abaixoCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key as "todos" | "qualifica" | "abaixo")}
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

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por id_lead, assessor, stage, tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[45vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold">ID Lead</th>
                      <th className="py-3 px-4 font-bold">Ganho em</th>
                      <th className="py-3 px-4 font-bold">Assessor</th>
                      <th className="py-3 px-4 font-bold">Stage</th>
                      <th className="py-3 px-4 font-bold">Tipo</th>
                      <th className="py-3 px-4 font-bold text-right">Valor</th>
                      <th className="py-3 px-4 font-bold">Conta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredDeals.length > 0 ? (
                      filteredDeals.map((d) => {
                        const isContabilizado = contabilizados.has(d.id_lead);
                        const highlight = isContabilizado ? "bg-emerald-500/[0.06]" : d.qualifica ? "bg-indigo-500/[0.04]" : "";
                        return (
                          <tr
                            key={d.id_lead}
                            className={cn(
                              "group hover:bg-white/[0.04] transition-all text-[12px] font-data",
                              highlight
                            )}
                          >
                            <td className="py-3 px-4 font-mono text-white/80">{d.id_lead}</td>
                            <td className="py-3 px-4 text-white/70">{formatDate(d.ganho_em)}</td>
                            <td className="py-3 px-4">
                              <span className="text-white/90 font-bold">{d.cod_assessor ?? "—"}</span>
                            </td>
                            <td className="py-3 px-4 text-white/60">{d.stage ?? "—"}</td>
                            <td className="py-3 px-4 text-white/60">{d.tipo_pipe ?? "—"}</td>
                            <td className={cn("py-3 px-4 text-right font-mono", d.qualifica ? "text-emerald-300" : "text-white/60")}>
                              {formatCurrency(d.valor)}
                            </td>
                            <td className="py-3 px-4">
                              {d.qualifica ? (
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 text-[10px] font-data font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                  isContabilizado
                                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                                    : "text-indigo-200 border-indigo-500/30 bg-indigo-500/10"
                                )}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", isContabilizado ? "bg-emerald-400" : "bg-indigo-300")} />
                                  {isContabilizado ? "Contabiliza" : "Qualifica"}
                                </span>
                              ) : (
                                <span className="text-[10px] font-data text-white/30 uppercase tracking-widest">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-white/25 text-[11px] font-data uppercase tracking-widest">
                          Sem dados para o período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 text-[10px] font-data text-white/35 uppercase tracking-widest">
            Regra: conta apenas negócios ganhos com valor ≥ {formatCurrency(VALOR_MINIMO)} no mês (por ganho_em).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CaptacaoRow = {
  cod_assessor: string | null;
  aux: string | null;
  valor_captacao: number | null;
  data_captacao: string | null;
  tipo_captacao?: string | null;
};

type CrossSellItem = {
  id: string;
  origem: "CONSÓRCIO" | "SEGURO";
  data: string | null;
  cod_assessor: string | null;
  cliente: string | null;
  descricao: string | null;
  referencia: string | null;
  valor: number | null;
};

function CaptacaoLiquidaDialog({
  children,
  data,
  selectedMonth,
  meta,
  bonusValor,
}: {
  children: React.ReactNode;
  data: CaptacaoRow[];
  selectedMonth: string;
  meta: number;
  bonusValor: string;
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "creditos" | "debitos">("todos");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const total = useMemo(() => {
    return data.reduce((sum, r) => sum + (r.valor_captacao ?? 0), 0);
  }, [data]);

  const totalCreditos = useMemo(() => {
    return data.filter(r => r.aux === "C").reduce((sum, r) => sum + (r.valor_captacao ?? 0), 0);
  }, [data]);

  const totalDebitos = useMemo(() => {
    return data.filter(r => r.aux === "D").reduce((sum, r) => sum + (r.valor_captacao ?? 0), 0);
  }, [data]);

  const creditosCount = useMemo(() => data.filter(r => r.aux === "C").length, [data]);
  const debitosCount = useMemo(() => data.filter(r => r.aux === "D").length, [data]);

  const atingido = total >= meta;
  const faltam = Math.max(0, meta - total);

  const mesLabel = (() => {
    try { return format(parseISO(selectedMonth), "MMMM 'de' yyyy"); }
    catch { return selectedMonth; }
  })();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data
      .filter(r => {
        if (activeFilter === "creditos" && r.aux !== "C") return false;
        if (activeFilter === "debitos" && r.aux !== "D") return false;
        if (!s) return true;
        return (
          (r.cod_assessor ?? "").toLowerCase().includes(s) ||
          (r.tipo_captacao ?? "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (b.data_captacao ?? "").localeCompare(a.data_captacao ?? ""));
  }, [activeFilter, data, search]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Bônus 02 · Captação Líquida PF
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  PF · {mesLabel} · Meta: {formatCurrency(meta)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl border text-center min-w-[160px]",
                  atingido
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : total < 0
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                )}
              >
                <p
                  className={cn(
                    "text-2xl font-display font-bold",
                    atingido ? "text-emerald-400" : total < 0 ? "text-rose-400" : "text-amber-400"
                  )}
                >
                  {formatCurrency(total)}
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  de {formatCurrency(meta)}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-data text-white/60">
                  Créditos: <span className="text-emerald-300 font-bold">{formatCurrency(totalCreditos)}</span> · Débitos:{" "}
                  <span className="text-rose-300 font-bold">{formatCurrency(totalDebitos)}</span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-data", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {atingido
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Ganhou {bonusValor}</span></>
                    : <><XCircle className="w-3.5 h-3.5" /><span>Faltam {formatCurrency(faltam)}</span></>
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 flex-wrap">
              {[
                { key: "todos", label: `Todos (${data.length})` },
                { key: "creditos", label: `Créditos (${creditosCount})` },
                { key: "debitos", label: `Débitos (${debitosCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key as "todos" | "creditos" | "debitos")}
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

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por assessor ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[45vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold">Data</th>
                      <th className="py-3 px-4 font-bold">Assessor</th>
                      <th className="py-3 px-4 font-bold">Tipo</th>
                      <th className="py-3 px-4 font-bold">Aux</th>
                      <th className="py-3 px-4 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length > 0 ? (
                      filtered.map((r, idx) => {
                        const isCredito = r.aux === "C";
                        const isDebito = r.aux === "D";
                        return (
                          <tr
                            key={`${r.cod_assessor}-${r.data_captacao}-${idx}`}
                            className={cn(
                              "group hover:bg-white/[0.04] transition-all text-[12px] font-data",
                              isCredito ? "bg-emerald-500/[0.04]" : isDebito ? "bg-rose-500/[0.04]" : ""
                            )}
                          >
                            <td className="py-3 px-4 text-white/70">{formatDate(r.data_captacao)}</td>
                            <td className="py-3 px-4 text-white/90 font-bold">{r.cod_assessor ?? "—"}</td>
                            <td className="py-3 px-4 text-white/60">{r.tipo_captacao ?? "—"}</td>
                            <td className="py-3 px-4">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 text-[10px] font-data font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                isCredito
                                  ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                                  : isDebito
                                    ? "text-rose-300 border-rose-500/30 bg-rose-500/10"
                                    : "text-white/40 border-white/10 bg-white/5"
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isCredito ? "bg-emerald-400" : isDebito ? "bg-rose-400" : "bg-white/20")} />
                                {r.aux ?? "—"}
                              </span>
                            </td>
                            <td className={cn("py-3 px-4 text-right font-mono", isCredito ? "text-emerald-300" : isDebito ? "text-rose-300" : "text-white/70")}>
                              {formatCurrency(r.valor_captacao)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-white/25 text-[11px] font-data uppercase tracking-widest">
                          Sem dados para o período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FechamentosCrossSellDialog({
  children,
  data,
  selectedMonth,
  meta,
  bonusValor,
}: {
  children: React.ReactNode;
  data: CrossSellItem[];
  selectedMonth: string;
  meta: number;
  bonusValor: string;
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "consorcio" | "seguro">("todos");

  const mesLabel = (() => {
    try { return format(parseISO(selectedMonth), "MMMM 'de' yyyy"); }
    catch { return selectedMonth; }
  })();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const total = data.length;
  const consorciosCount = useMemo(() => data.filter(d => d.origem === "CONSÓRCIO").length, [data]);
  const segurosCount = useMemo(() => data.filter(d => d.origem === "SEGURO").length, [data]);

  const atingido = total >= meta;
  const faltam = Math.max(0, meta - total);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data
      .filter(r => {
        if (activeFilter === "consorcio" && r.origem !== "CONSÓRCIO") return false;
        if (activeFilter === "seguro" && r.origem !== "SEGURO") return false;
        if (!s) return true;
        return (
          (r.cod_assessor ?? "").toLowerCase().includes(s) ||
          (r.cliente ?? "").toLowerCase().includes(s) ||
          (r.descricao ?? "").toLowerCase().includes(s) ||
          (r.referencia ?? "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }, [activeFilter, data, search]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <Briefcase className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Bônus 03 · Fechamentos Cross-Sell
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  Base Consórcios & Seguros · {mesLabel} · Meta: {meta} novos negócios
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl border text-center min-w-[120px]",
                  atingido ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                )}
              >
                <p className={cn("text-2xl font-display font-bold", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {total}
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  de {meta} fechamentos
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-data text-white/60">
                  Consórcios: <span className="text-amber-300 font-bold">{consorciosCount}</span> · Seguros:{" "}
                  <span className="text-indigo-200 font-bold">{segurosCount}</span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-data", atingido ? "text-emerald-400" : "text-rose-400")}>
                  {atingido
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Ganhou {bonusValor}</span></>
                    : <><XCircle className="w-3.5 h-3.5" /><span>Faltam {faltam} fechamento(s)</span></>
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 flex-wrap">
              {[
                { key: "todos", label: `Todos (${total})` },
                { key: "consorcio", label: `Consórcios (${consorciosCount})` },
                { key: "seguro", label: `Seguros (${segurosCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key as "todos" | "consorcio" | "seguro")}
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

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por assessor, cliente, produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-6">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-y-auto max-h-[55vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold">Data</th>
                      <th className="py-3 px-4 font-bold">Origem</th>
                      <th className="py-3 px-4 font-bold">Assessor</th>
                      <th className="py-3 px-4 font-bold">Cliente</th>
                      <th className="py-3 px-4 font-bold">Produto/Seguradora</th>
                      <th className="py-3 px-4 font-bold">Contrato/Proposta</th>
                      <th className="py-3 px-4 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length > 0 ? (
                      filtered.map((r) => (
                        <tr
                          key={r.id}
                          className={cn(
                            "group hover:bg-white/[0.04] transition-all text-[12px] font-data",
                            r.origem === "CONSÓRCIO" ? "bg-amber-500/[0.04]" : "bg-indigo-500/[0.04]"
                          )}
                        >
                          <td className="py-3 px-4 text-white/70">{formatDate(r.data)}</td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 text-[10px] font-data font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              r.origem === "CONSÓRCIO"
                                ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                                : "text-indigo-200 border-indigo-500/30 bg-indigo-500/10"
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", r.origem === "CONSÓRCIO" ? "bg-amber-400" : "bg-indigo-300")} />
                              {r.origem}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white/90 font-bold">{r.cod_assessor ?? "—"}</td>
                          <td className="py-3 px-4 text-white/70">{r.cliente ?? "—"}</td>
                          <td className="py-3 px-4 text-white/60">{r.descricao ?? "—"}</td>
                          <td className="py-3 px-4 text-white/60">{r.referencia ?? "—"}</td>
                          <td className="py-3 px-4 text-right font-mono text-white/80">
                            {formatCurrency(r.valor)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-white/25 text-[11px] font-data uppercase tracking-widest">
                          Sem dados para o período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================================================
// Main Component
// ==========================================================================

export default function AdvisorsDash() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string[]>(["ADVISORS"]);
  const [selectedAssessorId, setSelectedAssessorId] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const toggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsMaximized(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsMaximized(false);
        }
      }
    } catch (err) {
      console.error(`Error attempting to toggle full-screen mode: ${err}`);
      setIsMaximized(!isMaximized);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-filters-advisors"],
    queryFn: async () => {
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      const { data, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, time, cod_assessor, nome_assessor")
        .order("data_posicao", { ascending: false });
      
      if (error) throw error;
      
      const allMonths = Array.from(new Set(data.map((d: any) => d.data_posicao)));
      const years = Array.from(new Set(allMonths.map(m => parseISO(m).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));
      const teams = Array.from(new Set(data.map((d: any) => d.time)))
        .filter(teamName => teamName && activeTeamNames.has(teamName));
      
      const assessorMap = new Map<string, { name: string, teams: Set<string> }>();
      const latestDate = data?.[0]?.data_posicao;
      const latestRows = latestDate ? data.filter((d: any) => d.data_posicao === latestDate) : [];
      latestRows.forEach((d: any) => {
        if (d.cod_assessor && d.nome_assessor) {
          if (!assessorMap.has(d.cod_assessor)) {
            assessorMap.set(d.cod_assessor, { name: d.nome_assessor, teams: new Set() });
          }
          if (d.time && activeTeamNames.has(d.time)) {
            assessorMap.get(d.cod_assessor)?.teams.add(d.time);
          }
        }
      });
      const assessors = Array.from(assessorMap.entries())
        .map(([id, info]) => ({ id, name: info.name, teams: Array.from(info.teams) }))
        .filter(a => a.teams.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return { allMonths, years, teams, assessors };
    }
  });

  const filteredMonths = useMemo(() => {
    if (!filtersData?.allMonths) return [];
    return filtersData.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [filtersData, selectedYear]);

  React.useEffect(() => {
    if (filteredMonths.length > 0 && !filteredMonths.includes(selectedMonth)) {
      setSelectedMonth(filteredMonths[0]);
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  const { data: dashData, isLoading: isDashLoading } = useQuery({
    queryKey: ["dash-advisors-data", selectedMonth, selectedTeam, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (selectedTeam.length > 0) query = query.in("time", selectedTeam);
      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query.order("pontos_totais_acumulado", { ascending: false });
      if (error) throw error;

      const { data: teamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url");

      const teamPhotoMap = new Map<string, string>();
      (teamsData as Array<{ time: string | null; foto_url: string | null }> | null)?.forEach((t) => {
        if (t.time && t.foto_url) {
          teamPhotoMap.set(t.time.toUpperCase(), t.foto_url);
        }
      });

      const prevMonth = format(addMonths(parseISO(selectedMonth), -1), "yyyy-MM-01");
      let prevQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", prevMonth);

      if (selectedTeam.length > 0) prevQuery = prevQuery.in("time", selectedTeam);
      if (selectedAssessorId.length > 0) prevQuery = prevQuery.in("cod_assessor", selectedAssessorId);

      const { data: prevData, error: prevError } = await prevQuery;
      if (prevError) throw prevError;

      return {
        current: (data ?? []) as AssessorResumo[],
        previous: (prevData ?? []) as AssessorResumo[],
        teamPhotos: teamPhotoMap,
      };
    }
  });

  // Query para buscar dados de relacionamento da vw_esforcos_consolidado
  const { data: relacionamentoData, isLoading: isRelacionamentoLoading } = useQuery({
    queryKey: ["dash-advisors-relacionamento", selectedMonth, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("vw_esforcos_consolidado" as any)
        .select("cliente, tipo_pessoa, net_em_m, data_posicao, nome_assessor, cod_assessor, id_atividade, tipo, pipe, data_esforco, tipo_esforco, data_ultimo_contato, status_relacionamento")
        .eq("data_posicao", selectedMonth);

      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as RelacionamentoRow[];
    }
  });


  // Cálculo do Índice de Relacionamento
  const indiceRelacionamento = useMemo(() => {
    if (!relacionamentoData || relacionamentoData.length === 0) return null;

    // Clientes distintos com OK
    const clientesOk = new Set(
      relacionamentoData
        .filter(r => r.status_relacionamento === "OK")
        .map(r => r.cliente)
    ).size;

    // Total de clientes distintos
    const totalClientes = new Set(relacionamentoData.map(r => r.cliente)).size;

    if (totalClientes === 0) return null;

    const percentual = clientesOk / totalClientes;
    const atingido = percentual >= 0.75;

    return { percentual, clientesOk, totalClientes, atingido };
  }, [relacionamentoData]);

  // Query para buscar dados de volume consultivo (KPI 3)
  const { data: volumeConsultivoData, isLoading: isVolumeLoading } = useQuery({
    queryKey: ["dash-advisors-volume-consultivo", selectedMonth, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      // Calcula o range do mês selecionado para filtrar data_esforco
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      let query = supabase
        .from("vw_esforcos_consolidado" as any)
        .select("cliente, tipo_pessoa, net_em_m, data_posicao, nome_assessor, cod_assessor, id_atividade, pipe, data_esforco")
        .in("pipe", ["Revis\u00e3o de Carteira", "Reuni\u00e3o de Apresenta\u00e7\u00e3o FP"])
        .gte("data_esforco", startStr)
        .lt("data_esforco", endStr);

      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as VolumeConsultivoRow[];
    }
  });

  // Cálculo do KPI 3: Volume Consultivo Mensal
  const META_VOLUME_CONSULTIVO = 30;
  const volumeConsultivo = useMemo(() => {
    if (!volumeConsultivoData) return null;
    const totalReunioes = volumeConsultivoData.length;
    const atingido = totalReunioes >= META_VOLUME_CONSULTIVO;
    return { totalReunioes, atingido };
  }, [volumeConsultivoData]);

  // ─── KPI 1: Qualidade (NPS) ───────────────────────────────────────────────
  const META_NPS = 90;
  const MIN_AMOSTRAS_NPS = 3;

  const { data: npsData, isLoading: isNpsLoading } = useQuery({
    queryKey: ["dash-advisors-nps", selectedMonth, selectedAssessorId, selectedTeam],
    enabled: !!selectedMonth && !!filtersData,
    queryFn: async () => {
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Determina quais assessores filtrar (formato A26969)
      const assessorCodes = selectedAssessorId.length > 0
        ? selectedAssessorId
        : (filtersData?.assessors ?? [])
            .filter(a => a.teams.some((t: string) => selectedTeam.includes(t)))
            .map(a => a.id)
            .filter(Boolean);

      if (assessorCodes.length === 0) return [];

      // Busca TODOS os registros do mês (não só Finished) para o modal de detalhe.
      // O npsKpi useMemo filtra internamente só os respondidos para o cálculo do score.
      let query = (supabase as any)
        .from("vw_nps_tratado")
        .select("assessor, conta, jornada, tipo_convite, status, data_envio, data_resposta, data_real, abriu_email, continha_pergunta, nota_score, classificacao_nps")
        .gte("data_real", startStr)
        .lt("data_real", endStr)
        .in("assessor", assessorCodes);

      const { data, error } = await query;
      if (error) throw error;
      return data as NpsRow[];
    }
  });

  const npsKpi = useMemo(() => {
    if (!npsData || npsData.length === 0) return null;
    // Apenas os que efetivamente responderam (Finished com nota)
    const respondidos = npsData.filter(r => r.status === "Finished" && r.nota_score !== null);
    if (respondidos.length === 0) return null;
    const promotores = respondidos.filter(r => r.classificacao_nps === "Promotor").length;
    const passivos   = respondidos.filter(r => r.classificacao_nps === "Passivo").length;
    const detratores = respondidos.filter(r => r.classificacao_nps === "Detrator").length;
    const totalRespostas = respondidos.length;
    const score = Math.round(((promotores - detratores) / totalRespostas) * 100);
    const amostrageSuficiente = totalRespostas >= MIN_AMOSTRAS_NPS;
    const atingido = amostrageSuficiente && score >= META_NPS;
    return { score, promotores, passivos, detratores, totalRespostas, amostrageSuficiente, atingido };
  }, [npsData]);

  // Cálculo do Repasse Atingido (depende dos 3 KPIs)
  // Regra: 24% base + 2% por cada KPI atingido. Máximo 30%.
  const repasseStats = useMemo(() => {
    if (!dashData) return { repasseEsperado: 0, repasseAtingido: 0, percentualRepasse: 0.24, kpisAtingidos: 0 };

    const totalRepasse = dashData.current.reduce((acc, curr) => acc + (curr.repasse_total || 0), 0);
    const repasseEsperado = totalRepasse * 0.30;

    const kpisAtingidos = [
      npsKpi?.atingido ?? false,                   // KPI 1: Qualidade (NPS)
      indiceRelacionamento?.atingido ?? false,     // KPI 2: Índice de Relacionamento
      volumeConsultivo?.atingido ?? false,          // KPI 3: Volume Consultivo
    ].filter(Boolean).length;

    const percentualRepasse = 0.24 + kpisAtingidos * 0.02; // máx 0.30
    const repasseAtingido = totalRepasse * percentualRepasse;

    return { repasseEsperado, repasseAtingido, percentualRepasse, kpisAtingidos };
  }, [dashData, npsKpi, indiceRelacionamento, volumeConsultivo]);

  const repasseEsperadoPorAssessor = useMemo(() => {
    if (!dashData?.current?.length) return [];

    return dashData.current
      .map((row) => {
        const repasseTotal = row.repasse_total || 0;
        return {
          id: row.cod_assessor,
          name: row.nome_assessor || row.cod_assessor,
          value: repasseTotal * 0.30,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [dashData]);

  // Query para buscar dados de captação líquida PF (Bônus 02)
  const { data: captacaoData, isLoading: isCaptacaoLoading } = useQuery({
    queryKey: ["dash-advisors-captacao", selectedMonth, selectedAssessorId, selectedTeam],
    enabled: !!selectedMonth && !!filtersData,
    queryFn: async () => {
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);

      // Determina os códigos de assessor a filtrar (sem prefixo 'A')
      // Se há seleção específica usa ela; senão usa todos do time ADVISORS via filtersData
      const normalize = (id: string) => id.startsWith("A") ? id.slice(1) : id;
      const assessorCodes = selectedAssessorId.length > 0
        ? selectedAssessorId.map(normalize)
        : (filtersData?.assessors ?? [])
            .filter(a => a.teams.some((t: string) => selectedTeam.includes(t)))
            .map(a => normalize(a.id))
            .filter(Boolean);

      if (assessorCodes.length === 0) return [];

      const { data, error } = await supabase
        .from("dados_captacoes" as any)
        .select("cod_assessor, aux, valor_captacao, data_captacao, tipo_captacao")
        .eq("tipo_pessoa", "PESSOA FÍSICA")
        .neq("tipo_captacao", "WEALTH")          // NOT IN via dois neq
        .neq("tipo_captacao", "TRANSF")
        .in("aux", ["C", "D"])
        .in("cod_assessor", assessorCodes)        // sempre filtrado pelo time
        .gte("data_captacao", format(startDate, "yyyy-MM-dd"))
        .lt("data_captacao", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;
      return data as CaptacaoRow[];
    }
  });

  const META_CAPTACAO_LIQUIDA = 3_000_000;
  const captacaoLiquida = useMemo(() => {
    if (!captacaoData) return null;
    const total = captacaoData.reduce((sum, r) => sum + (r.valor_captacao ?? 0), 0);
    const atingido = total >= META_CAPTACAO_LIQUIDA;
    const isNegativo = total < 0;
    return { total, atingido, isNegativo };
  }, [captacaoData]);

  const { data: indicacoesData, isLoading: isIndicacoesLoading } = useQuery({
    queryKey: ["dash-advisors-indicacoes", selectedMonth, selectedAssessorId, selectedTeam],
    enabled: !!selectedMonth && !!filtersData,
    queryFn: async () => {
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const assessorCodes = selectedAssessorId.length > 0
        ? selectedAssessorId
        : (filtersData?.assessors ?? [])
            .filter(a => a.teams.some((t: string) => selectedTeam.includes(t)))
            .map(a => a.id)
            .filter(Boolean);

      if (assessorCodes.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from("vw_esforcos")
        .select("id_lead, valor_lead, cod_assessor, ganho_em, stage, tipo_pipe, telefone")
        .eq("status_lead", "won")
        .gte("ganho_em", startStr)
        .lt("ganho_em", endStr)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as IndicacaoEsforcoRow[];
    }
  });

  const META_INDICACOES_CONVERTIDAS = 3;
  const indicacoesConvertidas = useMemo(() => {
    if (!indicacoesData) return null;

    const VALOR_MINIMO = 300000;
    const uniqueDeals = new Map<string, number>();
    for (const row of indicacoesData) {
      if (row.id_lead === null || row.id_lead === undefined) continue;
      const key = String(row.id_lead);
      const valor = Number(row.valor_lead ?? 0);
      const current = uniqueDeals.get(key) ?? 0;
      if (valor > current) uniqueDeals.set(key, valor);
    }

    const qualificados = Array.from(uniqueDeals.values()).filter(v => v >= VALOR_MINIMO);
    const totalConversoesQualificadas = qualificados.length;
    const totalValorQualificado = qualificados.reduce((sum, v) => sum + v, 0);
    const atingido = totalConversoesQualificadas >= META_INDICACOES_CONVERTIDAS;

    return { totalConversoesQualificadas, totalValorQualificado, atingido };
  }, [indicacoesData]);

  const { data: crossSellData, isLoading: isCrossSellLoading } = useQuery({
    queryKey: ["dash-advisors-crosssell", selectedMonth, selectedAssessorId, selectedTeam],
    enabled: !!selectedMonth && !!filtersData,
    queryFn: async () => {
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const assessorCodes = selectedAssessorId.length > 0
        ? selectedAssessorId
        : (filtersData?.assessors ?? [])
            .filter(a => a.teams.some((t: string) => selectedTeam.includes(t)))
            .map(a => a.id)
            .filter(Boolean);

      if (assessorCodes.length === 0) return [] as CrossSellItem[];

      const parseValorMensal = (raw: unknown): number | null => {
        if (raw == null) return null;
        const s = String(raw).trim();
        if (!s) return null;
        const cleaned = s.replace(/[^\d,.-]/g, "");
        const normalized = cleaned.includes(",")
          ? cleaned.replace(/\./g, "").replace(",", ".")
          : cleaned;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
      };

      const [{ data: consorcios, error: consError }, { data: seguros, error: segError }] = await Promise.all([
        (supabase as any)
          .from("dados_consorcio")
          .select("id, data_venda, cod_assessor, cliente, produto, valor_carta, administradora, contrato, grupo, cota, data_cancelamento")
          .in("cod_assessor", assessorCodes)
          .gte("data_venda", startStr)
          .lt("data_venda", endStr),
        (supabase as any)
          .from("dados_seguros")
          .select("id, proposta, data, assessor, valor_mensal, status, seguradora, cliente")
          .in("assessor", assessorCodes)
          .gte("data", startStr)
          .lt("data", endStr),
      ]);

      if (consError) throw consError;
      if (segError) throw segError;

      const consItems: CrossSellItem[] = (consorcios ?? [])
        .filter((r: any) => !r.data_cancelamento)
        .map((r: any) => {
          const id = r.id ? `C-${String(r.id)}` : `C-${String(r.cod_assessor ?? "")}-${String(r.data_venda ?? "")}-${String(r.contrato ?? "")}-${String(r.grupo ?? "")}-${String(r.cota ?? "")}`;
          const referencia = r.contrato
            ? String(r.contrato)
            : r.grupo
              ? `${String(r.grupo)} / ${String(r.cota ?? "-")}`
              : null;
          return {
            id,
            origem: "CONSÓRCIO",
            data: r.data_venda ?? null,
            cod_assessor: r.cod_assessor ?? null,
            cliente: r.cliente ?? null,
            descricao: r.produto ?? r.administradora ?? null,
            referencia,
            valor: r.valor_carta != null ? Number(r.valor_carta) : null,
          };
        });

      const segItems: CrossSellItem[] = (seguros ?? []).map((r: any) => {
        const propostaKey = r.proposta != null ? String(r.proposta) : "";
        const id = r.id != null ? `S-${String(r.id)}` : (propostaKey ? `S-${propostaKey}` : `S-${String(r.assessor ?? "")}-${String(r.data ?? "")}-${String(r.cliente ?? "")}`);
        return {
          id,
          origem: "SEGURO",
          data: r.data ?? null,
          cod_assessor: r.assessor ?? null,
          cliente: r.cliente ?? null,
          descricao: r.seguradora ?? null,
          referencia: propostaKey || null,
          valor: parseValorMensal(r.valor_mensal),
        };
      });

      return [...consItems, ...segItems].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
    }
  });

  const META_FECHAMENTOS_CROSSSELL = 3;
  const crossSellResumo = useMemo(() => {
    if (!crossSellData) return null;
    const total = crossSellData.length;
    const consorcios = crossSellData.filter(r => r.origem === "CONSÓRCIO").length;
    const seguros = crossSellData.filter(r => r.origem === "SEGURO").length;
    const atingido = total >= META_FECHAMENTOS_CROSSSELL;
    return { total, consorcios, seguros, atingido };
  }, [crossSellData]);

  const bonusResumo = useMemo(() => {
    const BONUS_FIXO = 1000;
    const atingidos = [
      indicacoesConvertidas?.atingido ?? false,
      captacaoLiquida?.atingido ?? false,
      crossSellResumo?.atingido ?? false,
    ].filter(Boolean).length;
    const total = atingidos * BONUS_FIXO;
    return { atingidos, total };
  }, [captacaoLiquida?.atingido, crossSellResumo?.atingido, indicacoesConvertidas?.atingido]);

  const isLoading = isFiltersLoading || isDashLoading || isRelacionamentoLoading || isVolumeLoading || isCaptacaoLoading || isNpsLoading || isIndicacoesLoading || isCrossSellLoading;

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  const formatCurrencyValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mi";
    }
    return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
  };

  const formatMetaValue = (val: number, decimals: number = 2) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " Mi";
    }
    return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " K";
  };

  const comercialStats = useMemo(() => {
    if (!dashData?.current.length) return null;

    const current = dashData.current;
    const prev = dashData.previous;

    const totalRevenue = current.reduce((acc, curr) => acc + (curr.receita_total || 0), 0);
    const prevRevenue = prev.reduce((acc, curr) => acc + (curr.receita_total || 0), 0);
    const revenueMeta = current.reduce((acc, curr) => acc + (curr.meta_receita || 0), 0);
    const revenueAchievement = (totalRevenue / (revenueMeta || 1)) * 100;

    const totalFunding = current.reduce((acc, curr) => acc + (curr.captacao_liquida_total || 0), 0);
    const totalEntries = current.reduce((acc, curr) => acc + (curr.captacao_entradas || 0), 0);
    const totalExits = current.reduce((acc, curr) => acc + (curr.captacao_saidas || 0), 0);
    const totalTransfersIn = current.reduce((acc, curr) => acc + (curr.captacao_entrada_transf || 0), 0);
    const totalTransfersOut = current.reduce((acc, curr) => acc + (curr.captacao_saida_transf || 0), 0);
    const fundingMeta = current.reduce((acc, curr) => acc + (curr.meta_captacao || 0), 0);
    const fundingAchievement = (totalFunding / (fundingMeta || 1)) * 100;

    const totalCustody = current.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);
    const totalClients = current.reduce((acc, curr) => acc + (curr.total_clientes || 0), 0);
    const avgTicket = totalClients > 0 ? totalCustody / totalClients : 0;

    const totalFP300k = current.reduce((acc, curr) => acc + (curr.total_fp_300k || 0), 0);
    const metaFP300k = current.reduce((acc, curr) => acc + (curr.meta_fp300k || 0), 0);
    const fp300kAchievement = (totalFP300k / (metaFP300k || 1)) * 100;

    const totalActivations300k = current.reduce((acc, curr) => acc + (curr.ativacao_300k || 0) + (curr.ativacao_1kk || 0), 0);
    const metaActivations300k = current.reduce((acc, curr) => acc + (curr.meta_ativacao_300k || 0), 0);
    const activationsAchievement = (totalActivations300k / (metaActivations300k || 1)) * 100;

    const calculatedROA = totalCustody > 0 ? (totalRevenue / totalCustody) * 12 : 0;
    const metaROA = 0.0108;
    const roaAchievement = (calculatedROA / metaROA) * 100;

    return {
      clients: {
        total: totalClients,
        ticket: avgTicket,
      },
      revenue: {
        total: totalRevenue,
        meta: revenueMeta,
        achievement: revenueAchievement,
        delta: totalRevenue - prevRevenue,
        roa: calculatedROA * 100,
        roaMeta: metaROA * 100,
        roaAchievement,
      },
      custody: {
        total: totalCustody,
        fp300k: totalFP300k,
        metaFP: metaFP300k,
        fpAchievement: fp300kAchievement,
      },
      funding: {
        total: totalFunding,
        meta: fundingMeta,
        achievement: fundingAchievement,
        entries: totalEntries,
        exits: totalExits,
        transfersIn: totalTransfersIn,
        transfersOut: totalTransfersOut,
      },
      activations: {
        total: totalActivations300k,
        meta: metaActivations300k,
        achievement: activationsAchievement,
      },
    };
  }, [dashData]);

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-12 relative z-10">
        <div className="relative flex items-center justify-center w-full mb-4 sm:mb-8 px-2 min-h-[32px]">
          {/* Back Action */}
          <div className="absolute left-2 sm:left-0 top-1 sm:top-0 z-50 sm:z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dash")}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group hidden sm:flex items-center gap-2 h-8"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-data uppercase tracking-wider">Voltar</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dash")}
              className="sm:hidden glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold rounded-full w-8 h-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
          
          <h1 className="text-base sm:text-xl font-data text-euro-gold tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-80 text-center leading-tight sm:leading-normal">
            Performance Advisors
          </h1>
          
          <div className="absolute right-2 sm:right-0 top-0 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group h-8 hidden sm:flex"
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Sair</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Maximizar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-6 sm:space-y-12">
          <div className="sticky top-4 z-50 mx-auto w-full sm:max-w-fit px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2 p-2 sm:p-1.5 rounded-2xl sm:rounded-full bg-[#0F1218]/90 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300">
              <div className="w-full sm:w-auto flex justify-center">
                <DashboardFilters 
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                  selectedAssessorId={selectedAssessorId}
                  setSelectedAssessorId={setSelectedAssessorId}
                  filtersData={filtersData}
                  filteredMonths={filteredMonths}
                  userRole={userRole}
                  isMultiSelect={true}
                  disableTeamSelection={true}
                />
              </div>
            </div>
          </div>

          <div className="mt-0 border-none p-0 outline-none space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KpiCard
                title="Repasse Esperado"
                value={formatCurrency(repasseStats.repasseEsperado)}
                subtitle="Soma Repasse * 30%"
                icon={DollarSign}
                color="#FAC017"
                tooltipInfo="Cálculo baseado em 30% do repasse total do time Advisors no período selecionado."
                footer={(
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-data uppercase tracking-widest text-white/35">
                        Por assessor
                      </span>
                      <span className="text-[9px] font-data uppercase tracking-widest text-white/35">
                        30%
                      </span>
                    </div>

                    <div className="max-h-[92px] overflow-auto pr-1 custom-scrollbar space-y-1">
                      {repasseEsperadoPorAssessor.length === 0 ? (
                        <div className="text-[11px] font-data text-white/40">
                          Sem dados no período.
                        </div>
                      ) : (
                        repasseEsperadoPorAssessor.slice(0, 6).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-data text-white/80 truncate" title={a.name}>
                              {a.name}
                            </span>
                            <span className="text-[11px] font-mono text-white/85 tabular-nums">
                              {formatCurrency(a.value)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {repasseEsperadoPorAssessor.length > 6 && (
                      <div className="text-[10px] font-data text-white/35">
                        + {repasseEsperadoPorAssessor.length - 6} outros
                      </div>
                    )}
                  </div>
                )}
              />
              <KpiCard
                title="Repasse Atingido"
                value={formatCurrency(repasseStats.repasseAtingido)}
                subtitle={`Base 24% + ${repasseStats.kpisAtingidos * 2}% KPIs • ${(repasseStats.percentualRepasse * 100).toFixed(0)}% aplicado`}
                icon={Award}
                color="#FAC017"
                tooltipInfo={`24% base + 2% por KPI atingido. KPIs atingidos: ${repasseStats.kpisAtingidos}/3 — NPS: ${npsKpi ? (npsKpi.atingido ? '✓' : '✗') : '?'}; Relacionamento: ${indiceRelacionamento?.atingido ? '✓' : '✗'}; Volume Consultivo: ${volumeConsultivo?.atingido ? '✓' : '✗'}.`}
                footer={(
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-data uppercase tracking-widest text-white/40">
                        Bônus atingido ({bonusResumo.atingidos}/3)
                      </span>
                      <span className="text-[12px] font-data text-white/85 font-bold">
                        {formatCurrency(bonusResumo.total)}{" "}
                        <span className="text-white/30 font-normal">
                          / {formatCurrency(3000)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-data uppercase tracking-widest text-white/40">
                        Total a receber
                      </span>
                      <span className="text-lg font-display text-emerald-300 leading-none">
                        {formatCurrency(repasseStats.repasseAtingido + bonusResumo.total)}
                      </span>
                    </div>
                  </div>
                )}
              />
              <NpsDetailsDialog
                data={npsData ?? []}
                selectedMonth={selectedMonth}
                score={npsKpi?.score ?? null}
                promotores={npsKpi?.promotores ?? 0}
                passivos={npsKpi?.passivos ?? 0}
                detratores={npsKpi?.detratores ?? 0}
                totalRespostas={npsKpi?.totalRespostas ?? 0}
                atingido={npsKpi?.atingido ?? null}
                metaNps={META_NPS}
                minAmostras={MIN_AMOSTRAS_NPS}
              >
                <div className="h-full cursor-pointer">
                  <KpiProgressCard
                    title="Qualidade (NPS)"
                    icon={Heart}
                    color="#F43F5E"
                    delay={0.1}
                    valuePrimary={npsKpi ? `${npsKpi.promotores}` : null}
                    valueUnit="promotores"
                    metaValue={`${MIN_AMOSTRAS_NPS}`}
                    metaUnit="respostas mín."
                    progressPct={npsKpi ? Math.min((npsKpi.promotores / MIN_AMOSTRAS_NPS) * 100, 100) : null}
                    atingido={npsKpi ? (npsKpi.amostrageSuficiente ? npsKpi.atingido : null) : null}
                    warningText={
                      npsKpi && !npsKpi.amostrageSuficiente
                        ? `${npsKpi.totalRespostas} de ${MIN_AMOSTRAS_NPS} respostas (mín.)`
                        : undefined
                    }
                    statusText={
                      !npsKpi
                        ? "Sem dados no período"
                        : !npsKpi.amostrageSuficiente
                          ? "Amostra insuficiente"
                          : npsKpi.atingido
                            ? "Meta atingida ✓"
                            : `Faltam ${META_NPS - npsKpi.score} pts · NPS ${npsKpi.score}`
                    }
                    detailText={
                      npsKpi
                        ? `NPS ${npsKpi.score} pts · ${npsKpi.passivos} passivos · ${npsKpi.detratores} detratores · ${npsKpi.totalRespostas} total`
                        : "Clique para ver detalhes · Mín. 3 respostas"
                    }
                    tooltipInfo={
                      npsKpi
                        ? `NPS = ((${npsKpi.promotores}P − ${npsKpi.detratores}D) / ${npsKpi.totalRespostas}) × 100 = ${npsKpi.score}. Meta: ≥ ${META_NPS} com mín. ${MIN_AMOSTRAS_NPS} respostas.`
                        : `Fórmula: ((Promotores − Detratores) / Total) × 100. Meta ≥ ${META_NPS} com mín. ${MIN_AMOSTRAS_NPS} respostas/mês.`
                    }
                  />
                </div>
              </NpsDetailsDialog>
              <RelacionamentoDetailsDialog
                data={relacionamentoData ?? []}
                selectedMonth={selectedMonth}
                percentual={indiceRelacionamento?.percentual ?? 0}
                clientesOk={indiceRelacionamento?.clientesOk ?? 0}
                totalClientes={indiceRelacionamento?.totalClientes ?? 0}
                atingido={indiceRelacionamento?.atingido ?? false}
              >
                <div className="h-full cursor-pointer">
                  <KpiProgressCard
                    title="Índice de Relacionamento"
                    icon={MessageSquare}
                    color="#8B5CF6"
                    delay={0.15}
                    valuePrimary={indiceRelacionamento ? `${(indiceRelacionamento.percentual * 100).toFixed(0)}%` : null}
                    metaValue="≥ 75%"
                    progressPct={indiceRelacionamento ? Math.min((indiceRelacionamento.percentual / 0.75) * 100, 100) : null}
                    atingido={indiceRelacionamento?.atingido ?? null}
                    statusText={
                      !indiceRelacionamento
                        ? "Sem dados no período"
                        : indiceRelacionamento.atingido
                          ? "Meta atingida ✓"
                          : `Faltam ${Math.max(0, Math.ceil(0.75 * indiceRelacionamento.totalClientes - indiceRelacionamento.clientesOk))} clientes`
                    }
                    detailText={
                      indiceRelacionamento
                        ? `${indiceRelacionamento.clientesOk} de ${indiceRelacionamento.totalClientes} clientes cobertos`
                        : "Clique para detalhar · Cobertura 60 dias"
                    }
                    tooltipInfo="Clique para ver o detalhamento. Cobertura nos últimos 60 dias para clientes 300k+ PF. Meta: ≥ 75%."
                  />
                </div>
              </RelacionamentoDetailsDialog>
              <VolumeConsultivoDialog
                data={volumeConsultivoData ?? []}
                totalReunioes={volumeConsultivo?.totalReunioes ?? 0}
                atingido={volumeConsultivo?.atingido ?? false}
                meta={META_VOLUME_CONSULTIVO}
              >
                <div className="h-full cursor-pointer">
                  <KpiProgressCard
                    title="Volume Consultivo Mensal"
                    icon={TrendingUp}
                    color="#10B981"
                    delay={0.2}
                    valuePrimary={volumeConsultivo ? `${volumeConsultivo.totalReunioes}` : null}
                    valueUnit="reun."
                    metaValue={`${META_VOLUME_CONSULTIVO}`}
                    metaUnit="reuniões"
                    progressPct={volumeConsultivo ? Math.min((volumeConsultivo.totalReunioes / META_VOLUME_CONSULTIVO) * 100, 100) : null}
                    atingido={volumeConsultivo?.atingido ?? null}
                    statusText={
                      !volumeConsultivo
                        ? "Sem dados no período"
                        : volumeConsultivo.atingido
                          ? "Meta atingida ✓"
                          : `Faltam ${META_VOLUME_CONSULTIVO - volumeConsultivo.totalReunioes} reuniões`
                    }
                    detailText={
                      volumeConsultivo
                        ? `de ${META_VOLUME_CONSULTIVO} reuniões necessárias · Clique para detalhar`
                        : "Revisão de Carteira ou Apres. FP"
                    }
                    tooltipInfo="Clique para ver o detalhamento. Mínimo de 30 reuniões de Revisão de Carteira ou Apresentação FP no mês."
                  />
                </div>
              </VolumeConsultivoDialog>
            </div>

            {/* Termômetro de Bônus */}
            <Card className="bg-gradient-to-br from-white/[0.06] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
              <CardContent className="p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/20">
                      <Thermometer className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-data text-white/90 uppercase tracking-widest">Termômetro de Bônus</h3>
                      <p className="text-[10px] font-data text-white/30 uppercase tracking-wider mt-0.5">Bonificadores mensais fixos • Aguardando integração</p>
                    </div>
                  </div>
                  {/* Total placeholder */}
                  <div className="text-right px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[9px] font-data text-amber-200/70 uppercase tracking-widest">Bônus total potencial</p>
                    <p className="text-2xl font-display text-amber-200 leading-none">R$ 3.000 + OPIN</p>
                  </div>
                </div>

                {/* 4 Bônus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      num: "01",
                      title: "Indicações Convertidas",
                      fonte: "Pipedrive — Negócios Ganhos",
                      meta: "3 conversões ≥ 300k/mês",
                      valor: "R$ 1.000",
                      progresso: indicacoesConvertidas
                        ? { atual: indicacoesConvertidas.totalConversoesQualificadas, total: META_INDICACOES_CONVERTIDAS }
                        : null,
                      color: "#6366F1",
                      icon: Users,
                    },
                    {
                      num: "02",
                      title: "Captação Líquida PF",
                      fonte: "dados_captacoes (PF, ex-WEALTH/TRANSF)",
                      meta: "≥ R$ 3 milhões/mês",
                      valor: "R$ 1.000",
                      progresso: captacaoLiquida
                        ? { atual: Math.max(0, captacaoLiquida.total), total: META_CAPTACAO_LIQUIDA }
                        : null,
                      labelAtual: captacaoLiquida
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(captacaoLiquida.total)
                        : null,
                      labelTotal: "R$ 3 mi",
                      isNegativo: captacaoLiquida?.isNegativo ?? false,
                      color: "#10B981",
                      icon: TrendingUp,
                    },
                    {
                      num: "03",
                      title: "Fechamentos Cross-Sell",
                      fonte: "Base Consórcios & Seguros",
                      meta: "3 novos negócios/mês",
                      valor: "R$ 1.000",
                      progresso: crossSellResumo
                        ? { atual: crossSellResumo.total, total: META_FECHAMENTOS_CROSSSELL }
                        : null,
                      labelAtual: crossSellResumo ? String(crossSellResumo.total) : null,
                      labelTotal: String(META_FECHAMENTOS_CROSSSELL),
                      color: "#F59E0B",
                      icon: Briefcase,
                    },
                    {
                      num: "04",
                      title: "Open Investments (OPIN)",
                      fonte: "Relatório de Autorizações",
                      meta: "Por autorização liberada",
                      valor: "R$ 50 / OPIN",
                      progresso: null,
                      color: "#8B5CF6",
                      icon: Award,
                    },
                  ].map((bonus) => {
                    const BonusIcon = bonus.icon;
                    const pct = bonus.progresso
                      ? Math.min((bonus.progresso.atual / bonus.progresso.total) * 100, 100)
                      : 0;
                    const atingido = bonus.progresso ? bonus.progresso.atual >= bonus.progresso.total : false;
                    // Label customizado para moeda vs. contagem
                    const labelAtual = (bonus as any).labelAtual ?? (bonus.progresso ? String(bonus.progresso.atual) : null);
                    const labelTotal = (bonus as any).labelTotal ?? (bonus.progresso ? String(bonus.progresso.total) : null);
                    const isNegativo = (bonus as any).isNegativo ?? false;

                    const card = (
                      <div
                        className={cn(
                          "relative rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex flex-col gap-3 overflow-hidden",
                          ["01", "02", "03"].includes(bonus.num) ? "cursor-pointer hover:border-white/[0.14]" : ""
                        )}
                      >
                        {/* Linha colorida lateral */}
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: bonus.color }} />

                        {/* Topo */}
                        <div className="flex items-start justify-between pl-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${bonus.color}20` }}>
                              <BonusIcon className="w-4 h-4" style={{ color: bonus.color }} />
                            </div>
                            <div>
                              <span className="text-[10px] font-data text-white/40 font-mono uppercase tracking-widest">BÔNUS {bonus.num}</span>
                              <p className="text-sm font-data text-white font-semibold leading-tight">{bonus.title}</p>
                            </div>
                          </div>
                          {/* Badge bônus fixo */}
                          <span
                            className="text-[11px] font-data font-bold px-2.5 py-1 rounded-full border flex-shrink-0"
                            style={{ color: bonus.color, borderColor: `${bonus.color}50`, background: `${bonus.color}15` }}
                          >
                            {bonus.valor}
                          </span>
                        </div>

                        {/* Valor atual em destaque (quando disponível) */}
                        {labelAtual && (
                          <div className="pl-2">
                            <p className={`text-2xl font-display font-bold leading-none ${isNegativo ? "text-rose-400" : "text-white"}`}>
                              {labelAtual}
                            </p>
                            <p className="text-[10px] font-data text-white/40 mt-0.5">
                              meta: {labelTotal}
                            </p>
                          </div>
                        )}



                        {/* Barra de progresso */}
                        <div className="pl-2">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-data text-white/40 uppercase tracking-wider">Progresso</span>
                            <span className="text-[10px] font-mono text-white/50">
                              {labelAtual && labelTotal ? `${labelAtual} / ${labelTotal}` : "--/--"}
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: bonus.progresso ? (atingido ? bonus.color : `${bonus.color}80`) : "transparent",
                              }}
                            />
                          </div>
                        </div>

                        {/* Status pill */}
                        <div className="pl-2">
                          {bonus.progresso ? (
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-data font-semibold uppercase tracking-widest ${atingido ? "text-emerald-400" : "text-rose-400"}`}>
                              <span className={`w-2 h-2 rounded-full ${atingido ? "bg-emerald-400" : "bg-rose-400"}`} />
                              {atingido ? "Meta atingida ✓" : "Abaixo da meta"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-data text-white/25 uppercase tracking-widest">
                              <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                              Aguardando dados
                            </span>
                          )}
                        </div>
                      </div>
                    );
                    
                    if (bonus.num === "01") {
                      return (
                        <IndicacoesConvertidasDialog
                          key={bonus.num}
                          data={indicacoesData ?? []}
                          selectedMonth={selectedMonth}
                          meta={META_INDICACOES_CONVERTIDAS}
                          bonusValor={bonus.valor}
                        >
                          {card}
                        </IndicacoesConvertidasDialog>
                      );
                    }

                    if (bonus.num === "02") {
                      return (
                        <CaptacaoLiquidaDialog
                          key={bonus.num}
                          data={captacaoData ?? []}
                          selectedMonth={selectedMonth}
                          meta={META_CAPTACAO_LIQUIDA}
                          bonusValor={bonus.valor}
                        >
                          {card}
                        </CaptacaoLiquidaDialog>
                      );
                    }

                    if (bonus.num === "03") {
                      return (
                        <FechamentosCrossSellDialog
                          key={bonus.num}
                          data={crossSellData ?? []}
                          selectedMonth={selectedMonth}
                          meta={META_FECHAMENTOS_CROSSSELL}
                          bonusValor={bonus.valor}
                        >
                          {card}
                        </FechamentosCrossSellDialog>
                      );
                    }

                    return (
                      <div key={bonus.num}>
                        {card}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            {comercialStats && dashData && (
              <div className="space-y-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                        Clientes ativos
                      </CardTitle>
                      <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-euro-gold" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                        <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center">
                          {comercialStats.clients.total.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-data text-[#E8E8E0]">
                          R$ {formatCurrencyValue(comercialStats.clients.ticket)}
                        </span>
                        <span className="text-xs font-ui text-white uppercase tracking-tight mt-1">Ticket Médio</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                          Receita Total
                        </CardTitle>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-white hover:text-euro-gold transition-colors">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-display text-white flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-euro-gold" />
                                Detalhamento de Receita & ROA
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 mt-6">
                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-4">
                                <div className="flex justify-between items-end">
                                  <div>
                                    <span className="text-xs font-data text-white/90 uppercase tracking-wider">Receita Realizada</span>
                                    <p className="text-lg font-display text-[#F5F5F0]">R$ {formatCurrencyValue(comercialStats.revenue.total)}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-data text-white/90 uppercase tracking-wider">Meta Receita</span>
                                    <p className="text-sm font-data text-euro-gold">R$ {formatMetaValue(comercialStats.revenue.meta)}</p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-data">
                                    <span className="text-white/80">ATINGIMENTO RECEITA</span>
                                    <span className={cn(
                                      comercialStats.revenue.achievement >= 100 ? "text-green-500" : comercialStats.revenue.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                                    )}>{comercialStats.revenue.achievement.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        comercialStats.revenue.achievement >= 100 ? "bg-green-500" : comercialStats.revenue.achievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                                      )}
                                      style={{ width: `${Math.min(comercialStats.revenue.achievement, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-4">
                                <div className="flex justify-between items-end">
                                  <div>
                                    <span className="text-xs font-data text-white/90 uppercase tracking-wider">ROA Atual (Anualizado)</span>
                                    <p className="text-lg font-display text-[#F5F5F0]">{comercialStats.revenue.roa.toFixed(2)}%</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-data text-white/90 uppercase tracking-wider">Meta ROA</span>
                                    <p className="text-sm font-data text-euro-gold">{comercialStats.revenue.roaMeta.toFixed(2)}%</p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-data">
                                    <span className="text-white/80">ATINGIMENTO ROA</span>
                                    <span className={cn(
                                      comercialStats.revenue.roaAchievement >= 100 ? "text-green-500" : comercialStats.revenue.roaAchievement >= 70 ? "text-euro-gold" : "text-red-500"
                                    )}>{comercialStats.revenue.roaAchievement.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        comercialStats.revenue.roaAchievement >= 100 ? "bg-green-500" : comercialStats.revenue.roaAchievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                                      )}
                                      style={{ width: `${Math.min(comercialStats.revenue.roaAchievement, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/5">
                              <p className="text-xs font-ui text-white/70 leading-relaxed italic">
                                * O cálculo do ROA é baseado na receita total anualizada dividida pela custódia líquida atual.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                        <Banknote className="w-3.5 h-3.5 text-euro-gold" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                        <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                          R$ {formatCurrencyValue(comercialStats.revenue.total)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-sm font-data text-[#E8E8E0]">ROA: {comercialStats.revenue.roa.toFixed(2)}%</span>
                          <span className={cn(
                            "text-sm font-data",
                            comercialStats.revenue.achievement >= 100 ? "text-green-500" : comercialStats.revenue.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                          )}>
                            {comercialStats.revenue.achievement.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              comercialStats.revenue.achievement >= 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : comercialStats.revenue.achievement >= 70 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                            )}
                            style={{ width: `${Math.min(comercialStats.revenue.achievement, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                        Custódia
                      </CardTitle>
                      <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                        <Wallet className="w-3.5 h-3.5 text-euro-gold" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                        <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                          R$ {(comercialStats.custody.total / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-sm font-data text-[#E8E8E0]">FP300k+: {comercialStats.custody.fpAchievement.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              comercialStats.custody.fpAchievement >= 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : comercialStats.custody.fpAchievement >= 50 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                            )}
                            style={{ width: `${Math.min(comercialStats.custody.fpAchievement, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                          Captação Líquida
                        </CardTitle>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-white hover:text-euro-gold transition-colors">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-display text-euro-gold flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Detalhamento da Captação
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-green-400">
                                  <ArrowUpRight className="w-4 h-4" />
                                  <span className="text-xs font-data uppercase tracking-wider">Entradas</span>
                                </div>
                                <p className="text-base font-display">R$ {formatCurrencyValue(comercialStats.funding.entries)}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-red-400">
                                  <ArrowDownRight className="w-4 h-4" />
                                  <span className="text-xs font-data uppercase tracking-wider">Saídas</span>
                                </div>
                                <p className="text-base font-display">R$ {formatCurrencyValue(comercialStats.funding.exits)}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-blue-400">
                                  <ArrowRightLeft className="w-4 h-4" />
                                  <span className="text-xs font-data uppercase tracking-wider">Transf. Ent.</span>
                                </div>
                                <p className="text-base font-display">R$ {formatCurrencyValue(comercialStats.funding.transfersIn)}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-orange-400">
                                  <ArrowRightLeft className="w-4 h-4" />
                                  <span className="text-xs font-data uppercase tracking-wider">Transf. Saí.</span>
                                </div>
                                <p className="text-base font-display">R$ {formatCurrencyValue(comercialStats.funding.transfersOut)}</p>
                              </div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-end">
                              <div>
                                <span className="text-xs font-data text-[#5C5C50] uppercase">Resultado Líquido</span>
                                <p className="text-2xl font-display text-[#F5F5F0]">R$ {formatCurrencyValue(comercialStats.funding.total)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-data text-[#5C5C50] uppercase">Meta</span>
                                <p className="text-base font-data text-euro-gold">R$ {formatMetaValue(comercialStats.funding.meta)}</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-euro-gold" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                        <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                          R$ {formatCurrencyValue(comercialStats.funding.total)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-sm font-data text-[#E8E8E0] truncate max-w-[70%]">Meta (R$ {formatMetaValue(comercialStats.funding.meta, 1)}):</span>
                          <span className={cn(
                            "text-sm font-data",
                            comercialStats.funding.achievement >= 100 ? "text-green-500" : comercialStats.funding.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                          )}>
                            {comercialStats.funding.achievement.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              comercialStats.funding.achievement >= 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : comercialStats.funding.achievement >= 70 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                            )}
                            style={{ width: `${Math.min(comercialStats.funding.achievement, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                          Ativações 300k+
                        </CardTitle>
                        <ActivationDetailsDialog
                          selectedMonth={selectedMonth}
                          assessorId={selectedAssessorId}
                          team={selectedTeam}
                        >
                          <button className="text-white hover:text-euro-gold transition-colors">
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </ActivationDetailsDialog>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5 text-euro-gold" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                        <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                          {comercialStats.activations.total.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-sm font-data text-[#E8E8E0] truncate max-w-[70%]">Meta ({comercialStats.activations.meta} ativ.):</span>
                          <span className={cn(
                            "text-sm font-data",
                            comercialStats.activations.achievement >= 80 ? "text-green-500" : comercialStats.activations.achievement >= 50 ? "text-euro-gold" : "text-red-500"
                          )}>
                            {comercialStats.activations.achievement.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              comercialStats.activations.achievement >= 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : comercialStats.activations.achievement >= 50 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                            )}
                            style={{ width: `${Math.min(comercialStats.activations.achievement, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <AdvisorRevenueTable
                  data={dashData.current}
                  teamPhotos={dashData.teamPhotos}
                  selectedMonth={selectedMonth}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
