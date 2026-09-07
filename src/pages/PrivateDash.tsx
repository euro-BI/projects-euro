import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Coins,
  Crown,
  DollarSign,
  Eye,
  Info,
  PieChart as PieChartIcon,
  TrendingUp,
  Trophy,
  User,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import {
  BLOCKED_ASSESSORS,
  BLOCKED_TEAMS,
  productRoaTarget,
  REVENUE_PRODUCTS,
  type ProductMetric,
} from "@/utils/cockpit-v2-mappers";
import { cn, readSessionJson, writeSessionJson } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isAdvisorsOnlyUser } from "@/lib/access";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PRIVATE_TEAM = "PRIVATE";
const RESPONSAVEL = "Gustavo Madeira";

// Repasse: base exclusiva do código do Paulo, conforme especificação Private.
const REPASSE_CODE = "A50655";
const REPASSE_RATE = 0.2;
const REPASSE_FLOOR = 7000;

// Bônus de captação: R$ 1.000 por milhão de captação líquida PF.
const BONUS_PER_MILLION = 1000;
const MODELO_SERVIR_MIN = 70;

// Metas de ROA derivadas dos produtos do gerencial: Eurostock = investimentos, Affare = cross-sell.
const ROA_META_INVEST = productRoaTarget(REVENUE_PRODUCTS.eurostock);
const ROA_META_CROSSSELL = productRoaTarget(REVENUE_PRODUCTS.affare);

const GOLD = "#FAC017";
const GREEN = "#22C55E";
const RED = "#F43F5E";

type ViewMode = "private" | "escritorio";
type ChartRange = "6m" | "12m" | "ytd" | "custom";

type RevenueField = keyof AssessorResumo;

const INVEST_CATEGORIES = REVENUE_PRODUCTS.eurostock;
const CROSSSELL_CATEGORIES = REVENUE_PRODUCTS.affare;

const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  ytd: "Ano atual",
  custom: "Personalizado",
};

// A view `mv_resumo_assessor` não existe nos tipos gerados do Supabase.
const mvResumoAssessor = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("mv_resumo_assessor" as any) as any;

const dadosModeloServir = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("dados_modelo_servir" as any) as any;

function sumField(rows: AssessorResumo[], field: RevenueField) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function sumCategory(rows: AssessorResumo[], product: ProductMetric) {
  return product.fields.reduce((acc, field) => acc + sumField(rows, field as RevenueField), 0);
}

function formatCompactBRL(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mi`;
  }
  // Abaixo de R$ 10 mil o valor cheio lê melhor que a abreviação (ex.: piso de R$ 7.000).
  if (abs >= 10_000) {
    const scaled = abs / 1_000;
    const decimals = Number.isInteger(scaled) ? 0 : 1;
    return `${sign}R$ ${scaled.toLocaleString("pt-BR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} mil`;
  }
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatPercent(value: number, decimals = 1) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

function formatMonthLabel(month: string) {
  const label = format(parseISO(month), "MMM/yy", { locale: ptBR }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonthFull(month: string) {
  const label = format(parseISO(month), "MMMM/yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function deltaPct(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ==========================================================================
// Blocos visuais
// ==========================================================================

function DeltaBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="font-data text-[10px] text-white/30">sem base de comparação</span>;
  }

  const positive = value >= 0;
  return (
    <span
      className="font-data text-[10px] tracking-tight"
      style={{ color: positive ? GREEN : RED }}
    >
      {positive ? "↑" : "↓"} {positive ? "+" : "-"}
      {Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      {suffix} vs. mês anterior
    </span>
  );
}

function PanelCard({
  title,
  icon: Icon,
  className,
  headerRight,
  tooltipInfo,
  children,
}: {
  title?: string;
  icon?: React.ElementType;
  className?: string;
  headerRight?: React.ReactNode;
  tooltipInfo?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "bg-euro-card/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden",
        className,
      )}
    >
      <CardContent className="p-5 h-full flex flex-col">
        {title && (
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4 text-euro-gold" />}
              <span className="font-ui text-sm text-white/85">{title}</span>
              {tooltipInfo && (
                <TooltipProvider delayDuration={100}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-white/20 hover:text-white/60 transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-euro-elevated border-euro-gold/20 text-white/90 font-data text-xs max-w-[260px]">
                      {tooltipInfo}
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
            {headerRight}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color = "#FFFFFF",
  className,
}: {
  label: string;
  value: string;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-3 py-2.5 text-center", className)}>
      <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1">{label}</p>
      <p className="font-display text-sm leading-none" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function RoaDonut({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(pct, 100));
  const data = [
    { name: "atingido", value: clamped },
    { name: "restante", value: 100 - clamped },
  ];

  return (
    <div className="relative w-[86px] h-[86px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={31}
            outerRadius={41}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={GOLD} />
            <Cell fill="rgba(255,255,255,0.08)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-display text-base leading-none text-white">{Math.round(pct)}%</span>
        <span className="font-data text-[8px] uppercase tracking-wider text-white/40 mt-0.5">da meta</span>
      </div>
    </div>
  );
}

function RevenueSegmentCard({
  title,
  icon,
  tooltipInfo,
  total,
  roa,
  roaMeta,
  categories,
}: {
  title: string;
  icon: React.ElementType;
  tooltipInfo?: string;
  total: number;
  roa: number;
  roaMeta: number;
  categories: Array<{ label: string; value: number }>;
}) {
  const achievement = roaMeta > 0 ? (roa / roaMeta) * 100 : 0;
  const gap = Math.max(roaMeta - roa, 0) * 100;

  return (
    <PanelCard title={title} icon={icon} tooltipInfo={tooltipInfo}>
      <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-white/5">
        <div className="grid grid-cols-3 gap-4 flex-1 min-w-[250px]">
          <div>
            <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Receita total</p>
            <p className="font-display text-base sm:text-lg leading-none text-white whitespace-nowrap">
              {formatCompactBRL(total)}
            </p>
          </div>
          <div>
            <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">ROA atual</p>
            <p className="font-display text-base sm:text-lg leading-none" style={{ color: GREEN }}>
              {formatPercent(roa * 100, 2)}
            </p>
          </div>
          <div>
            <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Meta de ROA</p>
            <p className="font-display text-base sm:text-lg leading-none text-white/70">
              {formatPercent(roaMeta * 100, 2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <RoaDonut pct={achievement} />
          <div className="w-[86px]">
            <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">
              {gap > 0 ? "Faltam" : "Meta"}
            </p>
            <p
              className="font-display text-sm leading-none"
              style={{ color: gap > 0 ? "rgba(255,255,255,0.8)" : GREEN }}
            >
              {gap > 0
                ? `${gap.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`
                : "superada"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 pb-2 font-data text-[9px] uppercase tracking-widest text-white/30">
          <span>Categoria</span>
          <span className="text-right">Receita gerada (R$)</span>
          <span className="text-right w-16">% do total</span>
        </div>
        <div className="divide-y divide-dashed divide-white/[0.07]">
          {categories.map((category) => (
            <div
              key={category.label}
              className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center py-2"
            >
              <span className="flex items-center gap-2 font-ui text-xs text-white/75">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                {category.label}
              </span>
              <span className="font-data text-xs text-white/85 text-right">
                {formatCompactBRL(category.value)}
              </span>
              <span className="font-data text-xs text-white/50 text-right w-16">
                {total > 0 ? formatPercent((category.value / total) * 100) : "0,0%"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

// ==========================================================================
// Página
// ==========================================================================

export default function PrivateDash() {
  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();
  const persistKey = "filters:PrivateDash";
  const persisted = readSessionJson<{ selectedMonth?: string; view?: ViewMode; chartRange?: ChartRange } | null>(
    persistKey,
    null,
  );

  const canSeeEscritorio = userRole === "admin" || userRole === "admin_master";
  const isPrivateOnlyViewer = isAdvisorsOnlyUser(userCode);

  const [selectedMonth, setSelectedMonth] = useState<string>(persisted?.selectedMonth ?? "");
  const [view, setView] = useState<ViewMode>(
    canSeeEscritorio && !isPrivateOnlyViewer ? persisted?.view ?? "private" : "private",
  );
  const [chartRange, setChartRange] = useState<ChartRange>(persisted?.chartRange ?? "12m");
  const [customStartMonth, setCustomStartMonth] = useState<string>("");

  React.useEffect(() => {
    writeSessionJson(persistKey, { selectedMonth, view, chartRange });
  }, [persistKey, selectedMonth, view, chartRange]);

  const { data: months, isLoading: isMonthsLoading } = useQuery({
    queryKey: ["private-dash-months"],
    queryFn: async () => {
      const { data, error } = await mvResumoAssessor()
        .select("data_posicao")
        .order("data_posicao", { ascending: false });

      if (error) throw error;
      const list = (data ?? []) as Array<{ data_posicao: string }>;
      return Array.from(new Set(list.map((row) => row.data_posicao)));
    },
  });

  React.useEffect(() => {
    if (months?.length && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0]);
    }
  }, [months, selectedMonth]);

  // Janela ampla: alimenta KPIs do mês, comparação com o mês anterior e as séries dos gráficos.
  const windowStart = useMemo(
    () => (selectedMonth ? format(addMonths(parseISO(selectedMonth), -23), "yyyy-MM-dd") : ""),
    [selectedMonth],
  );

  const { data: rows, isLoading: isRowsLoading } = useQuery({
    queryKey: ["private-dash-rows", selectedMonth, windowStart, view],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = mvResumoAssessor()
        .select("*")
        .gte("data_posicao", windowStart)
        .lte("data_posicao", selectedMonth);

      if (view === "private") {
        query = query.eq("time", PRIVATE_TEAM);
      }

      const { data, error } = await query;
      if (error) throw error;

      const all = (data ?? []) as AssessorResumo[];
      if (view === "private") return all;

      return all.filter((row) => {
        const team = String(row.time ?? "").toUpperCase();
        const code = String(row.cod_assessor ?? "").toUpperCase();
        return !BLOCKED_TEAMS.includes(team) && !BLOCKED_ASSESSORS.includes(code);
      });
    },
  });

  // O repasse é sempre calculado sobre o código do Paulo, que fica fora do recorte
  // comercial do Hub e pode não estar no time Private — por isso consulta separada.
  const { data: repasseRows } = useQuery({
    queryKey: ["private-dash-repasse", selectedMonth],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const { data, error } = await mvResumoAssessor()
        .select("cod_assessor, data_posicao, receita_total")
        .eq("cod_assessor", REPASSE_CODE)
        .eq("data_posicao", selectedMonth);

      if (error) throw error;
      return (data ?? []) as Array<Pick<AssessorResumo, "cod_assessor" | "data_posicao" | "receita_total">>;
    },
  });

  // Carga manual em euro_dash.dados_modelo_servir. Enquanto um mês não tiver lançamento,
  // o card cai no estado "sem pontuação" em vez de quebrar.
  const { data: modeloServirRows } = useQuery({
    queryKey: ["private-dash-modelo-servir", selectedMonth],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const { data, error } = await dadosModeloServir()
        .select("cod_assessor, indice_modelo_servir")
        .eq("periodo", selectedMonth);

      if (error) {
        console.warn("Modelo de Servir indisponível:", error.message);
        return [] as Array<{ cod_assessor: string; indice_modelo_servir: number }>;
      }
      return (data ?? []) as Array<{ cod_assessor: string; indice_modelo_servir: number }>;
    },
  });

  const modeloServirMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of modeloServirRows ?? []) {
      const code = String(row.cod_assessor ?? "").trim().toUpperCase();
      const score = Number(row.indice_modelo_servir);
      if (code && Number.isFinite(score)) map.set(code, score);
    }
    return map;
  }, [modeloServirRows]);

  const rowsByMonth = useMemo(() => {
    const map = new Map<string, AssessorResumo[]>();
    for (const row of rows ?? []) {
      const key = row.data_posicao;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [rows]);

  const currentRows = useMemo(() => rowsByMonth.get(selectedMonth) ?? [], [rowsByMonth, selectedMonth]);
  const previousMonth = useMemo(
    () => (selectedMonth ? format(addMonths(parseISO(selectedMonth), -1), "yyyy-MM-01") : ""),
    [selectedMonth],
  );
  const previousRows = useMemo(() => rowsByMonth.get(previousMonth) ?? [], [rowsByMonth, previousMonth]);

  const chartMonths = useMemo(() => {
    if (!selectedMonth || !months?.length) return [] as string[];

    const available = [...months].sort();
    const upTo = available.filter((month) => month <= selectedMonth);

    if (chartRange === "6m") return upTo.slice(-6);
    if (chartRange === "12m") return upTo.slice(-12);
    if (chartRange === "ytd") {
      const year = selectedMonth.slice(0, 4);
      return upTo.filter((month) => month.startsWith(year));
    }
    if (!customStartMonth) return upTo.slice(-12);
    return upTo.filter((month) => month >= customStartMonth);
  }, [chartRange, customStartMonth, months, selectedMonth]);

  const clientsStats = useMemo(() => {
    const build = (data: AssessorResumo[]) => {
      const clients = sumField(data, "total_clientes");
      const custody = sumField(data, "custodia_net");
      const fp = sumField(data, "total_fp_300k");
      return {
        clients,
        custody,
        ticket: clients > 0 ? custody / clients : 0,
        fpCoverage: clients > 0 ? (fp / clients) * 100 : 0,
      };
    };

    const current = build(currentRows);
    const previous = build(previousRows);

    return {
      current,
      deltas: {
        clients: deltaPct(current.clients, previous.clients),
        custody: deltaPct(current.custody, previous.custody),
        ticket: deltaPct(current.ticket, previous.ticket),
        fpCoverage: previous.fpCoverage ? current.fpCoverage - previous.fpCoverage : null,
      },
    };
  }, [currentRows, previousRows]);

  const fundingStats = useMemo(() => {
    const cambio = (data: AssessorResumo[]) => sumField(data, "captacao_liquida_total");
    return {
      liquida: cambio(currentRows),
      bruta: sumField(currentRows, "captacao_entradas"),
      netNewMoney: sumField(currentRows, "captacao_liquida"),
      saidas: sumField(currentRows, "captacao_saidas"),
      transferencias: sumField(currentRows, "captacao_transf_liquida"),
      pf: sumField(currentRows, "captacao_liquida_total_pf"),
      pj: sumField(currentRows, "captacao_liquida_total_pj"),
      ativacoes300k: sumField(currentRows, "ativacao_300k"),
      ativacoes1kk: sumField(currentRows, "ativacao_1kk"),
    };
  }, [currentRows]);

  const fundingSeries = useMemo(
    () =>
      chartMonths.map((month) => {
        const monthRows = rowsByMonth.get(month) ?? [];
        return {
          month,
          label: formatMonthLabel(month),
          value: sumField(monthRows, "captacao_liquida_total") / 1_000_000,
          meta: sumField(monthRows, "meta_captacao") / 1_000_000,
        };
      }),
    [chartMonths, rowsByMonth],
  );

  const fundingMeta = useMemo(() => {
    const withMeta = fundingSeries.filter((point) => point.meta > 0);
    if (withMeta.length === 0) return null;
    return withMeta.reduce((acc, point) => acc + point.meta, 0) / withMeta.length;
  }, [fundingSeries]);

  // O Modelo de Servir é por assessor, então o bônus é apurado individualmente e somado:
  // quem está abaixo do corte não gera bônus mesmo tendo captado.
  const bonusStats = useMemo(() => {
    let eligibleMillions = 0;
    let bonus = 0;
    let scoreSum = 0;
    let scoredCount = 0;
    let eligibleCount = 0;

    for (const row of currentRows) {
      const code = String(row.cod_assessor ?? "").trim().toUpperCase();
      const score = modeloServirMap.get(code);
      if (score === undefined) continue;

      scoredCount += 1;
      scoreSum += score;
      if (score <= MODELO_SERVIR_MIN) continue;

      eligibleCount += 1;
      const millions = Math.max(Math.floor((Number(row.captacao_liquida_total_pf) || 0) / 1_000_000), 0);
      eligibleMillions += millions;
      bonus += millions * BONUS_PER_MILLION;
    }

    return {
      eligibleMillions,
      bonus,
      eligibleCount,
      scoredCount,
      totalAssessors: currentRows.length,
      avgScore: scoredCount > 0 ? scoreSum / scoredCount : null,
    };
  }, [currentRows, modeloServirMap]);

  const repasseStats = useMemo(() => {
    const receita = (repasseRows ?? []).reduce((acc, row) => acc + (Number(row.receita_total) || 0), 0);
    const bruto = receita * REPASSE_RATE;
    return {
      receita,
      bruto,
      floor: REPASSE_FLOOR,
      final: Math.max(bruto, REPASSE_FLOOR),
      usouPiso: REPASSE_FLOOR > bruto,
    };
  }, [repasseRows]);

  const revenueStats = useMemo(() => {
    const total = sumField(currentRows, "receita_total");
    const previousTotal = sumField(previousRows, "receita_total");
    const custody = sumField(currentRows, "custodia_net");

    const investCategories = INVEST_CATEGORIES.map((config) => ({
      label: config.label,
      value: sumCategory(currentRows, config),
    }));
    const crossCategories = CROSSSELL_CATEGORIES.map((config) => ({
      label: config.label,
      value: sumCategory(currentRows, config),
    }));

    const investTotal = investCategories.reduce((acc, item) => acc + item.value, 0);
    const crossTotal = crossCategories.reduce((acc, item) => acc + item.value, 0);

    return {
      total,
      delta: deltaPct(total, previousTotal),
      invest: {
        total: investTotal,
        roa: custody > 0 ? (investTotal / custody) * 12 : 0,
        categories: investCategories,
      },
      cross: {
        total: crossTotal,
        roa: custody > 0 ? (crossTotal / custody) * 12 : 0,
        categories: crossCategories,
      },
    };
  }, [currentRows, previousRows]);

  const revenueSeries = useMemo(
    () =>
      chartMonths.map((month) => {
        const monthRows = rowsByMonth.get(month) ?? [];
        return {
          month,
          label: formatMonthLabel(month),
          value: sumField(monthRows, "receita_total") / 1_000,
        };
      }),
    [chartMonths, rowsByMonth],
  );

  const isLoading = isMonthsLoading || isRowsLoading;
  const hasData = currentRows.length > 0;

  const rangeSelect = (
    <div className="flex items-center gap-2">
      <Select value={chartRange} onValueChange={(value) => setChartRange(value as ChartRange)}>
        <SelectTrigger className="h-8 w-[170px] bg-black/30 border-white/10 text-white font-data text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-euro-elevated border-white/10 text-white font-data text-xs">
          {(Object.keys(CHART_RANGE_LABELS) as ChartRange[]).map((key) => (
            <SelectItem key={key} value={key}>
              {CHART_RANGE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chartRange === "custom" && (
        <Select value={customStartMonth} onValueChange={setCustomStartMonth}>
          <SelectTrigger className="h-8 w-[140px] bg-black/30 border-white/10 text-white font-data text-[11px]">
            <SelectValue placeholder="Início" />
          </SelectTrigger>
          <SelectContent className="bg-euro-elevated border-white/10 text-white font-data text-xs max-h-[300px]">
            {(months ?? [])
              .filter((month) => month <= selectedMonth)
              .map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthFull(month)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <PageLayout className="bg-transparent text-[#E8E8E0] font-ui px-3 sm:px-4 pb-10 custom-scrollbar relative min-h-screen">
      <ImpactfulBackground opacity={0.18} />
      <LoadingOverlay isLoading={isLoading} />

      <div className="relative z-10 w-full pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dash")}
            className="h-8 w-8 p-0 bg-black/30 border-white/10 text-white/60 hover:text-euro-gold hover:border-euro-gold/40"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-data text-sm sm:text-base uppercase tracking-[0.3em] text-euro-gold/85">
            Dashboard Private
          </h1>
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-euro-card/70 px-3 h-10">
              <CalendarDays className="w-4 h-4 text-white/45" />
              <span className="font-ui text-xs text-white/45">Período:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent px-0 font-ui text-xs text-white focus:ring-0">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-euro-elevated border-white/10 text-white font-data text-xs max-h-[320px]">
                  {(months ?? []).map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthFull(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-euro-card/70 px-3 h-10">
              <User className="w-4 h-4 text-white/45" />
              <span className="font-ui text-xs text-white/45">Time:</span>
              <span className="font-ui text-xs text-white">Private</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-euro-card/70 px-3 h-10">
              <User className="w-4 h-4 text-white/45" />
              <span className="font-ui text-xs text-white/45">Responsável:</span>
              <span className="font-ui text-xs text-white">{RESPONSAVEL}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("private")}
              className={cn(
                "h-10 gap-2 font-ui text-xs",
                view === "private"
                  ? "bg-euro-gold/10 border-euro-gold/50 text-euro-gold hover:bg-euro-gold/15 hover:text-euro-gold"
                  : "bg-euro-card/70 border-white/10 text-white/45 hover:text-white",
              )}
            >
              <Eye className="w-4 h-4" />
              Visão Private
            </Button>
            {canSeeEscritorio && !isPrivateOnlyViewer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("escritorio")}
                className={cn(
                  "h-10 gap-2 font-ui text-xs",
                  view === "escritorio"
                    ? "bg-euro-gold/10 border-euro-gold/50 text-euro-gold hover:bg-euro-gold/15 hover:text-euro-gold"
                    : "bg-euro-card/70 border-white/10 text-white/45 hover:text-white",
                )}
              >
                <Building2 className="w-4 h-4" />
                Visão Escritório
              </Button>
            )}
          </div>
        </div>

        {!isLoading && !hasData && (
          <PanelCard>
            <p className="font-ui text-sm text-white/60">
              Nenhum assessor no time Private em {selectedMonth ? formatMonthFull(selectedMonth) : "—"}. Os cards ficam
              zerados até o time ser populado na base.
            </p>
          </PanelCard>
        )}

        {/* ── Bloco operacional ───────────────────────────────────────── */}

        <PanelCard title="Clientes Ativos" icon={Users}>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-dashed divide-white/10">
            {[
              {
                label: "Clientes ativos",
                value: clientsStats.current.clients.toLocaleString("pt-BR"),
                delta: clientsStats.deltas.clients,
                suffix: "%",
              },
              {
                label: "Volume financeiro",
                value: formatCompactBRL(clientsStats.current.custody),
                delta: clientsStats.deltas.custody,
                suffix: "%",
              },
              {
                label: "Ticket médio",
                value: formatCompactBRL(clientsStats.current.ticket),
                delta: clientsStats.deltas.ticket,
                suffix: "%",
              },
              {
                label: "Cobertura Financial Planning",
                value: formatPercent(clientsStats.current.fpCoverage, 0),
                delta: clientsStats.deltas.fpCoverage,
                suffix: " p.p.",
              },
            ].map((kpi) => (
              <div key={kpi.label} className="px-4 first:pl-0 text-center">
                <p className="font-data text-[10px] uppercase tracking-widest text-white/35 mb-2">{kpi.label}</p>
                <p className="font-display text-3xl leading-none text-white mb-2">{kpi.value}</p>
                <DeltaBadge value={kpi.delta} suffix={kpi.suffix} />
              </div>
            ))}
          </div>
        </PanelCard>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PanelCard title="Captação" icon={DollarSign}>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center flex-1">
              <div className="flex-1 min-w-0">
                <p className="font-data text-[10px] uppercase tracking-widest text-white/35 mb-2">
                  Captação líquida do mês
                </p>
                <p
                  className="font-display text-4xl leading-none"
                  style={{ color: fundingStats.liquida >= 0 ? GREEN : RED }}
                >
                  {formatCompactBRL(fundingStats.liquida)}
                </p>
              </div>

              <div className="sm:w-[190px] shrink-0">
                <p className="font-data text-[10px] uppercase tracking-widest text-white/35 mb-2 text-center">
                  Ativações de contas
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "300K+", value: fundingStats.ativacoes300k },
                    { label: "1M+", value: fundingStats.ativacoes1kk },
                  ].map((tile) => (
                    <div
                      key={tile.label}
                      className="rounded-xl border border-white/10 bg-black/25 py-3 text-center"
                    >
                      <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1">
                        {tile.label}
                      </p>
                      <p className="font-display text-xl leading-none text-white">{tile.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-white/10">
                  <MiniStat label="Bruta" value={formatCompactBRL(fundingStats.bruta)} color={GREEN} />
                  <MiniStat
                    label="Net New Money"
                    value={formatCompactBRL(fundingStats.netNewMoney)}
                    color={fundingStats.netNewMoney >= 0 ? GREEN : RED}
                  />
                  <MiniStat
                    label="Saídas"
                    value={formatCompactBRL(-Math.abs(fundingStats.saidas))}
                    color={RED}
                  />
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
                  <MiniStat
                    label="Transferências"
                    value={formatCompactBRL(fundingStats.transferencias)}
                    color={fundingStats.transferencias >= 0 ? GREEN : RED}
                  />
                  <MiniStat
                    label="PF"
                    value={formatCompactBRL(fundingStats.pf)}
                    color={fundingStats.pf >= 0 ? GREEN : RED}
                  />
                  <MiniStat
                    label="PJ"
                    value={formatCompactBRL(fundingStats.pj)}
                    color={fundingStats.pj >= 0 ? GREEN : RED}
                  />
                </div>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Evolução da Captação Líquida" icon={TrendingUp} headerRight={rangeSelect}>
            <div className="flex items-center gap-4 mb-2 font-data text-[10px] text-white/45">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: GREEN }} />
                Captação líquida (R$ mi)
              </span>
              {fundingMeta !== null && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t border-dashed border-white/70" />
                  Meta (R$ mi)
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundingSeries} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />
                  {fundingMeta !== null && (
                    <ReferenceLine y={fundingMeta} stroke="rgba(255,255,255,0.7)" strokeDasharray="5 4" />
                  )}
                  <Bar dataKey="value" fill={GREEN} radius={[3, 3, 0, 0]} maxBarSize={34}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="#FFFFFF"
                      fontSize={10}
                      formatter={(value: number) =>
                        value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PanelCard
            title="Bônus de Captação"
            icon={Trophy}
            tooltipInfo="R$ 1.000 por cada R$ 1 milhão de captação líquida PF, apurado por assessor e condicionado a Modelo de Servir acima de 70 pontos. Pontuação vem de euro_dash.dados_modelo_servir (carga manual)."
          >
            <div className="grid grid-cols-3 divide-x divide-dashed divide-white/10 flex-1 items-center">
              <div className="pr-3">
                <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">
                  Captação líquida PF
                </p>
                <p className="font-display text-xl leading-none" style={{ color: GREEN }}>
                  {formatCompactBRL(fundingStats.pf)}
                </p>
              </div>
              <div className="px-3">
                <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">
                  Modelo de Servir
                </p>
                <p
                  className="font-display text-xl leading-none"
                  style={{ color: bonusStats.eligibleCount > 0 ? GREEN : "rgba(255,255,255,0.3)" }}
                >
                  {bonusStats.avgScore === null
                    ? "--"
                    : bonusStats.avgScore.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  {bonusStats.avgScore !== null && <span className="text-[11px] text-white/40"> pts</span>}
                </p>
                <p className="mt-1.5 flex items-center gap-1 font-data text-[9px] text-white/40">
                  {bonusStats.scoredCount === 0 ? (
                    <>Sem pontuação lançada neste mês (&gt;70)</>
                  ) : (
                    <>
                      {bonusStats.eligibleCount > 0 && (
                        <CheckCircle2 className="w-3 h-3" style={{ color: GREEN }} />
                      )}
                      {bonusStats.eligibleCount} de {bonusStats.scoredCount} elegíveis (&gt;70)
                    </>
                  )}
                </p>
              </div>
              <div className="pl-3">
                <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5">
                  Milhões elegíveis
                </p>
                <p className="font-display text-xl leading-none text-white">{bonusStats.eligibleMillions}</p>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <div className="rounded-xl border border-euro-gold/25 bg-euro-gold/[0.06] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-data text-[9px] uppercase tracking-widest text-white/40 mb-1.5">
                    Bônus acumulado
                  </p>
                  <p className="font-display text-3xl leading-none" style={{ color: GOLD }}>
                    {formatBRL(bonusStats.bonus)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/15 px-3 py-2 text-right">
                  <p className="font-display text-sm leading-none text-white">R$ 1.000</p>
                  <p className="font-data text-[9px] text-white/40 mt-1">por R$ 1 mi PF</p>
                </div>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Repasse Atingido"
            icon={DollarSign}
            tooltipInfo={`Repasse bruto de 20% sobre a Receita Total Euro no código ${REPASSE_CODE}, com piso mensal garantido de ${formatBRL(REPASSE_FLOOR)}.`}
          >
            <div className="grid grid-cols-3 gap-2 items-center">
              {[
                { label: "Receita Euro no código do Paulo", value: formatCompactBRL(repasseStats.receita) },
                { label: "Repasse bruto (20%)", value: formatCompactBRL(repasseStats.bruto) },
                { label: "Piso garantido", value: formatBRL(repasseStats.floor) },
              ].map((step, index) => (
                <div key={step.label} className="relative text-center px-2">
                  <p className="font-data text-[9px] uppercase tracking-widest text-white/35 mb-1.5 min-h-[24px]">
                    {step.label}
                  </p>
                  <p className="font-display text-base leading-none text-white">{step.value}</p>
                  {index < 2 && (
                    <span className="absolute -right-1 top-8 text-white/25 font-data text-xs">›</span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-4 mb-2 text-center font-data text-[9px] uppercase tracking-widest text-white/35">
              Maior entre repasse e piso
            </p>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div
                  className={cn(
                    "rounded-xl border p-3 text-center",
                    repasseStats.usouPiso ? "border-white/10 bg-black/20" : "border-green-500/30 bg-green-500/[0.07]",
                  )}
                >
                  <p className="font-data text-[9px] uppercase tracking-widest text-white/40 mb-1.5">Repasse bruto</p>
                  <p
                    className="font-display text-base leading-none"
                    style={{ color: repasseStats.usouPiso ? "rgba(255,255,255,0.55)" : GREEN }}
                  >
                    {formatCompactBRL(repasseStats.bruto)}
                  </p>
                </div>

                <div className="w-9 h-9 rounded-full border border-white/15 bg-black/30 flex items-center justify-center font-data text-[10px] text-white/50">
                  VS
                </div>

                <div
                  className={cn(
                    "rounded-xl border p-3 text-center",
                    repasseStats.usouPiso ? "border-red-500/30 bg-red-500/[0.07]" : "border-white/10 bg-black/20",
                  )}
                >
                  <p className="font-data text-[9px] uppercase tracking-widest text-white/40 mb-1.5">Piso garantido</p>
                  <p
                    className="font-display text-base leading-none"
                    style={{ color: repasseStats.usouPiso ? RED : "rgba(255,255,255,0.55)" }}
                  >
                    {formatBRL(repasseStats.floor)}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-[200px] shrink-0 rounded-xl border border-euro-gold/30 bg-euro-gold/[0.07] px-4 py-3 text-center relative">
                <Crown className="w-3.5 h-3.5 absolute top-2.5 right-2.5" style={{ color: GOLD }} />
                <p className="font-data text-[9px] uppercase tracking-widest text-white/45 mb-1.5 pr-4">
                  Repasse líquido a receber
                </p>
                <p className="font-display text-xl leading-none whitespace-nowrap" style={{ color: GOLD }}>
                  {formatCompactBRL(repasseStats.final)}
                </p>
                <p className="font-data text-[9px] text-white/35 mt-1.5">(Maior valor)</p>
              </div>
            </div>
          </PanelCard>
        </div>

        {/* ── Bloco de receita ────────────────────────────────────────── */}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] gap-4">
          <PanelCard title="Receita Total" icon={Coins}>
            <div className="flex-1 flex flex-col justify-center">
              <p className="font-data text-[10px] uppercase tracking-widest text-white/35 mb-3">
                Receita total do mês
              </p>
              <p className="font-display text-4xl leading-none text-white mb-3">
                {formatCompactBRL(revenueStats.total)}
              </p>
              {revenueStats.delta === null ? (
                <span className="font-data text-[10px] text-white/30">sem base de comparação</span>
              ) : (
                <span
                  className="font-data text-[11px]"
                  style={{ color: revenueStats.delta >= 0 ? GREEN : RED }}
                >
                  {revenueStats.delta >= 0 ? "↑ +" : "↓ -"}
                  {Math.abs(revenueStats.delta).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  % vs. {previousMonth ? formatMonthLabel(previousMonth).toLowerCase() : "—"}
                </span>
              )}
            </div>
          </PanelCard>

          <PanelCard title="Evolução da Receita Total" icon={TrendingUp} headerRight={rangeSelect}>
            <p className="font-data text-[10px] text-white/35 mb-1">(R$ mil)</p>
            <div className="flex-1 min-h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Bar dataKey="value" fill={GOLD} radius={[3, 3, 0, 0]} maxBarSize={40}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="#FFFFFF"
                      fontSize={10}
                      formatter={(value: number) =>
                        value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <RevenueSegmentCard
            title="Receita Investimentos"
            icon={PieChartIcon}
            tooltipInfo={`Vertente Eurostock do gerencial. Meta de ROA = soma das metas dos produtos (${formatPercent(
              ROA_META_INVEST * 100,
              2,
            )} a.a.).`}
            total={revenueStats.invest.total}
            roa={revenueStats.invest.roa}
            roaMeta={ROA_META_INVEST}
            categories={revenueStats.invest.categories}
          />
          <RevenueSegmentCard
            title="Receita Cross-sell"
            icon={Users}
            tooltipInfo={`Vertente Affare do gerencial. Meta de ROA = soma das metas dos produtos (${formatPercent(
              ROA_META_CROSSSELL * 100,
              2,
            )} a.a.).`}
            total={revenueStats.cross.total}
            roa={revenueStats.cross.roa}
            roaMeta={ROA_META_CROSSSELL}
            categories={revenueStats.cross.categories}
          />
        </div>
      </div>
    </PageLayout>
  );
}
