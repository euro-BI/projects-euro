import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AssessorResumo } from "@/types/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
  Cell
} from "recharts";
import { format, parseISO, isSameMonth, isWeekend, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Briefcase,
  Landmark,
  Umbrella,
  Wallet,
  ArrowUpRight,
  Shield,
  Coins,
  LayoutDashboard,
  Pencil,
  Trash2,
  RefreshCw,
  Table2,
  Users,
  User,
  Trophy,
  TrendingDown,
  Crown,
  Filter,
  Repeat
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { ProductDetailsDialog } from "./ProductDetailsDialog";
import { FundingMonthDialog } from "./FundingMonthDialog";
import { AssessorIndicatorDialog } from "./AssessorIndicatorDialog";
import { CockpitGlobalPulse } from "./CockpitGlobalPulse";
import { useIsMobile } from "@/hooks/use-mobile";
import { cockpitUniverse, metaReceitaShare } from "@/utils/cockpit-v2-mappers";

interface CockpitDashProps {
  currentData: AssessorResumo[];
  yearlyData: AssessorResumo[];
  selectedYear: string;
}

type MetricType = 'funding' | 'allocation' | 'variable' | 'banking' | 'insurance';
type TargetKind = "breakeven" | "roa";
type FundingFilter = 'all' | 'pf' | 'pj';
type ViewMode = 'monthly' | 'accumulated' | 'detailed';

const FUNDING_FIELDS: Record<FundingFilter, string[]> = {
  all: ["captacao_liquida_total"],
  pf: ["captacao_liquida_total_pf"],
  pj: ["captacao_liquida_total_pj"],
};

const FUNDING_LABELS: Record<FundingFilter, string> = {
  all: "Todos",
  pf: "PF",
  pj: "PJ",
};

interface MetricConfigEntry {
  label: string;
  icon: any;
  color: string;
  fields: string[];
  targetField?: string;
  isRoaBased: boolean;
  roaTarget?: number;
}

const METRIC_CONFIG: Record<MetricType, MetricConfigEntry> = {
  funding: {
    label: "Captação Líquida",
    icon: Wallet,
    color: "#22C55E", // Green
    fields: ["captacao_liquida_total"],
    targetField: "meta_captacao",
    isRoaBased: false
  },
  allocation: {
    label: "Alocação",
    icon: Briefcase,
    color: "#FAC017", // Euro Gold
    fields: [
      "receita_renda_fixa", 
      "asset_m_1", 
      "receita_previdencia", 
      "receita_cetipados", 
      "receitas_ofertas_fundos", 
      "receitas_ofertas_rf", 
      "receitas_offshore",
      "receita_cambio_pf"
    ],
    isRoaBased: true,
    roaTarget: 0.0015 + 0.0002 + 0.0001 + 0.0005 + 0.0010 + 0.0002 + 0.0001
  },
  variable: {
    label: "Renda Variável",
    icon: TrendingUp,
    color: "#3B82F6", // Blue
    fields: ["receitas_estruturadas", "receita_b3"],
    isRoaBased: true,
    roaTarget: 0.0035 + 0.0020 // 0.55%
  },
  banking: {
    label: "Banking",
    icon: Landmark,
    color: "#8B5CF6", // Purple
    fields: ["receita_consorcios", "receita_compromissadas", "receita_cambio_pj"],
    isRoaBased: true,
    roaTarget: 0.0009 + 0.0001 + 0.0001 // 0.11%
  },
  insurance: {
    label: "Seguros",
    icon: Shield,
    color: "#EC4899", // Pink
    fields: ["receita_seguros"],
    isRoaBased: true,
    roaTarget: 0.0007 // 0.07%
  }
};

const REVENUE_METRICS: MetricType[] = ["allocation", "variable", "banking", "insurance"];
const COCKPIT_METRICS = Object.keys(METRIC_CONFIG) as MetricType[];
const METRIC_SHORT: Record<MetricType, string> = {
  funding: "Cap",
  allocation: "Aloc",
  variable: "RV",
  banking: "Bank",
  insurance: "Seg",
};

type AdvisorMetricValue = {
  realized: number;
  target: number;
  percent: number;
  gap: number;
};

type AdvisorAnalysisRow = {
  assessor: AssessorResumo;
  metrics: Record<MetricType, AdvisorMetricValue>;
  revenue: AdvisorMetricValue;
  metaShare: number;
};

type AdvisorDisplayMode = "meta" | "pace" | "absolute";
type AdvisorMetricTotals = Record<MetricType, number>;

function groupedRevenue(row: AdvisorAnalysisRow) {
  return REVENUE_METRICS.reduce((acc, key) => acc + row.metrics[key].realized, 0);
}

function groupedRevenueTarget(row: AdvisorAnalysisRow) {
  return REVENUE_METRICS.reduce((acc, key) => acc + row.metrics[key].target, 0);
}

function shareOf(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function formatShare(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return "—";
  return `${percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const PRODUCT_METRICS = {
  eurostock: [
    { key: "rf", label: "RF", fields: ["receita_renda_fixa"], roa: 0.0015 },
    { key: "asset", label: "Asset", fields: ["asset_m_1"], roa: 0.0002 },
    { key: "previdencia", label: "Previdência", fields: ["receita_previdencia"], roa: 0.0001 },
    { key: "cetipados", label: "Cetipados", fields: ["receita_cetipados"], roa: 0.0005 },
    { key: "ofertas", label: "Ofertas", fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"], roa: 0.0010 },
    { key: "offshore", label: "Offshore", fields: ["receitas_offshore"], roa: 0.0002 },
    { key: "cambio_pf", label: "Câmbio PF", fields: ["receita_cambio_pf"], roa: 0.0001 },
    { key: "estruturadas", label: "Estruturadas", fields: ["receitas_estruturadas"], roa: 0.0035 },
    { key: "b3", label: "B3", fields: ["receita_b3"], roa: 0.0020 },
  ],
  affare: [
    { key: "consorcios", label: "Consórcios", fields: ["receita_consorcios"], roa: 0.0009 },
    { key: "compromissadas_pj", label: "Compromissadas PJ", fields: ["receita_compromissadas"], roa: 0.0001 },
    { key: "cambio", label: "Câmbio PJ", fields: ["receita_cambio_pj"], roa: 0.0001 },
    { key: "seguros", label: "Seguros", fields: ["receita_seguros"], roa: 0.0007 },
  ]
};

const ALL_PRODUCTS = [...PRODUCT_METRICS.eurostock, ...PRODUCT_METRICS.affare];

const BREAK_EVEN_PRODUCT_OPTIONS = [
  { key: "estruturadas", label: "Estruturadas" },
  { key: "b3", label: "B3" },
  { key: "rf", label: "RF" },
  { key: "ofertas", label: "Ofertas" },
  { key: "cetipados", label: "Cetipados" },
  { key: "asset", label: "Asset" },
  { key: "offshore", label: "Offshore" },
  { key: "previdencia", label: "Previdência" },
  { key: "cambio_pf", label: "Câmbio PF" },
  { key: "consorcios", label: "Consórcios" },
  { key: "seguros", label: "Seguros" },
  { key: "compromissadas_pj", label: "Compromissadas PJ" },
  { key: "cambio", label: "Câmbio PJ" },
] as const;

const BREAK_EVEN_KEYS_BY_METRIC: Record<Exclude<MetricType, "funding">, string[]> = {
  allocation: ["rf", "asset", "previdencia", "cetipados", "ofertas", "offshore", "cambio_pf"],
  variable: ["estruturadas", "b3"],
  banking: ["consorcios", "compromissadas_pj", "cambio"],
  insurance: ["seguros"],
};

type BreakEvenTargetRow = {
  id: string;
  competencia: string;
  product_key: string;
  value: number;
};

// Helper to format currency
const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Helper to calculate status color
const getStatusColor = (percent: number) => {
  if (percent >= 100) return "text-green-500";
  if (percent >= 70) return "text-euro-gold";
  return "text-red-500";
};

const getProgressBarColor = (percent: number) => {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 70) return "bg-euro-gold";
  return "bg-red-500";
};

const formatCompactCurrency = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (abs >= 1_000) {
    const digits = abs >= 10_000 ? 0 : 1;
    return `${sign}R$ ${(abs / 1_000).toFixed(digits).replace(".", ",")}k`;
  }
  return formatCurrency(value);
};

function getBusinessDayPaceFactor(referenceDate: Date) {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  const totalDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
  const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter((d) => !isWeekend(d)).length;
  const passedDays = Math.max(1, rawPassedDays - 2);
  if (passedDays > 0 && totalDays > 0) return totalDays / passedDays;
  return 1;
}

type MonthMetric = {
  realized: number;
  target: number;
  percent: number;
  pace: number | null;
  pacePercent: number | null;
  isCurrent: boolean;
};

function MonthMetricCell({ metric }: { metric: MonthMetric }) {
  const hasTarget = metric.target > 0;
  const tone = hasTarget ? getStatusColor(metric.percent) : "text-white/45";
  const bar = hasTarget ? getProgressBarColor(metric.percent) : "bg-white/20";
  const paceTone = metric.pacePercent != null ? getStatusColor(metric.pacePercent) : "";

  return (
    <div
      className={cn(
        "flex min-w-[118px] flex-col items-end gap-1.5 py-0.5",
        metric.isCurrent && "rounded-lg bg-euro-gold/[0.08] px-2 py-1.5"
      )}
      title={[
        `Realizado: ${formatCurrency(metric.realized)}`,
        hasTarget ? `Meta: ${formatCurrency(metric.target)}` : "Meta não cadastrada",
        metric.pace != null ? `Pace: ${formatCurrency(metric.pace)}` : null,
      ].filter(Boolean).join("\n")}
    >
      <span className="text-white/90 font-data text-xs leading-none">
        {formatCurrency(metric.realized)}
      </span>
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${hasTarget ? Math.min(Math.max(metric.percent, 0), 100) : 0}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-data leading-none">
        {hasTarget ? (
          <>
            <span className={cn("font-medium", tone)}>{Math.round(metric.percent)}%</span>
            <span className="text-white/25">·</span>
            <span className="text-white/40">{formatCompactCurrency(metric.target)}</span>
          </>
        ) : (
          <span className="text-white/30">sem meta</span>
        )}
      </div>
      {metric.isCurrent && metric.pace != null && (
        <div className="flex items-center gap-1.5 text-[10px] font-data leading-none">
          <span className="uppercase tracking-[0.16em] text-white/35">Pace</span>
          <span className="text-white/80">{formatCompactCurrency(metric.pace)}</span>
          {hasTarget && metric.pacePercent != null && (
            <span className={cn("font-medium", paceTone)}>{Math.round(metric.pacePercent)}%</span>
          )}
        </div>
      )}
    </div>
  );
}

function ProducerCard({
  row,
  rank,
  tone,
  onMetricClick,
  displayMode,
  groupedTotal,
  metricTotals,
}: {
  row: AdvisorAnalysisRow;
  rank: number;
  tone: "top" | "bottom";
  onMetricClick: (assessor: AssessorResumo, metric: MetricType) => void;
  displayMode: AdvisorDisplayMode;
  groupedTotal: number;
  metricTotals: AdvisorMetricTotals;
}) {
  const revenue = groupedRevenue(row);
  const target = groupedRevenueTarget(row);
  const isAbsolute = displayMode === "absolute";
  const vsMeta = target > 0 ? (revenue / target) * 100 : 0;
  const share = shareOf(revenue, groupedTotal);
  const percent = isAbsolute ? share : vsMeta;
  const barWidth = isAbsolute ? share : target > 0 ? Math.min(Math.max(vsMeta, 0), 100) : 0;
  const isTop = tone === "top";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition-colors",
        isTop
          ? "border-euro-gold/20 bg-gradient-to-br from-euro-gold/[0.08] to-transparent"
          : "border-red-500/20 bg-gradient-to-br from-red-500/[0.07] to-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "w-14 h-14 rounded-full overflow-hidden border-2 bg-euro-inset flex items-center justify-center",
              isTop ? "border-euro-gold/70 shadow-[0_0_16px_rgba(250,192,23,0.25)]" : "border-red-400/40"
            )}
          >
            {row.assessor.foto_url ? (
              <img src={row.assessor.foto_url} alt={row.assessor.nome_assessor} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-white/25" />
            )}
          </div>
          <div
            className={cn(
              "absolute -bottom-1 -right-1 h-6 min-w-6 px-1 rounded-full flex items-center justify-center text-[10px] font-display border",
              rank === 1 && isTop
                ? "bg-euro-gold text-black border-euro-gold"
                : isTop
                  ? "bg-[#1A2030] text-euro-gold border-euro-gold/30"
                  : "bg-[#1A2030] text-red-300 border-red-500/30"
            )}
          >
            {rank === 1 && isTop ? <Crown className="w-3 h-3" /> : `#${rank}`}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-white font-data text-sm uppercase tracking-tight truncate">
            {row.assessor.nome_assessor}
          </div>
          <div className="text-white/40 font-data text-[10px] uppercase tracking-widest truncate">
            {row.assessor.cod_assessor} • {row.assessor.time}
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-data uppercase tracking-widest text-white/35">Receita agrupada</div>
              <div className="text-white font-display text-xl leading-none mt-1">{formatCurrency(revenue)}</div>
            </div>
            <div className="text-right">
              <div className={cn("text-lg font-display leading-none", isAbsolute ? "text-euro-gold" : getStatusColor(percent))}>
                {isAbsolute ? formatShare(share) : target > 0 ? `${Math.round(percent)}%` : "—"}
              </div>
              <div className="text-[10px] font-data uppercase tracking-widest text-white/35 mt-1">
                {isAbsolute ? "do total" : target > 0 ? `meta ${formatCompactCurrency(target)}` : "sem meta"}
              </div>
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn("h-full rounded-full", isAbsolute ? "bg-euro-gold" : getProgressBarColor(percent))}
              style={{ width: `${Math.min(Math.max(barWidth, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {COCKPIT_METRICS.map((metric) => {
          const value = row.metrics[metric];
          const metricShare = shareOf(value.realized, metricTotals[metric]);
          return (
            <button
              key={metric}
              type="button"
              onClick={() => onMetricClick(row.assessor, metric)}
              className="rounded-lg border border-white/8 bg-black/20 px-1.5 py-2 text-center hover:border-white/20 hover:bg-white/[0.04] transition-colors"
              title={METRIC_CONFIG[metric].label}
            >
              <div className="text-[8px] font-data uppercase tracking-widest text-white/35 truncate">
                {METRIC_SHORT[metric]}
              </div>
              <div className="mt-1 text-[10px] font-data text-white/85 leading-none">
                {formatCompactCurrency(value.realized)}
              </div>
              <div className={cn("mt-1 text-[10px] font-data", isAbsolute ? "text-euro-gold" : getStatusColor(value.percent))}>
                {isAbsolute
                  ? formatShare(metricShare)
                  : value.target > 0
                    ? `${Math.round(value.percent)}%`
                    : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CockpitDash({ currentData, yearlyData, selectedYear }: CockpitDashProps) {
  const { userRole } = useAuth();
  const isMobile = useIsMobile();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('funding'); // Changed from 'cap_liquida' to 'funding' to match METRIC_CONFIG keys
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [displayMode, setDisplayMode] = useState<'meta' | 'proportional' | 'pace'>('meta');
  const [targetKind, setTargetKind] = useState<TargetKind>("breakeven");
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [breakEvenTargets, setBreakEvenTargets] = useState<BreakEvenTargetRow[]>([]);
  const [isBreakEvenDialogOpen, setIsBreakEvenDialogOpen] = useState(false);
  const [isBreakEvenSaving, setIsBreakEvenSaving] = useState(false);
  const [breakEvenForm, setBreakEvenForm] = useState<{
    id: string | null;
    monthKey: string;
    productKey: string;
    value: string;
  }>({
    id: null,
    monthKey: `${selectedYear}-01`,
    productKey: BREAK_EVEN_PRODUCT_OPTIONS[0].key,
    value: "",
  });
  const [breakEvenListMonth, setBreakEvenListMonth] = useState("all");
  const [breakEvenListProduct, setBreakEvenListProduct] = useState("all");
  const [breakEvenReplicate, setBreakEvenReplicate] = useState(false);
  const [breakEvenReplicateMonths, setBreakEvenReplicateMonths] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState<{ key: string; label: string; fields: string[]; roa: number } | null>(null);
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>('all');
  const [fundingDialog, setFundingDialog] = useState<{
    monthKey: string;
    assessorCode?: string;
    assessorName?: string;
  } | null>(null);
  const [advisorMetricModal, setAdvisorMetricModal] = useState<{
    assessor: AssessorResumo;
    metric: Exclude<MetricType, "funding"> | "revenue";
  } | null>(null);
  const [advisorSort, setAdvisorSort] = useState<{ key: "name" | "revenue" | MetricType; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [advisorDisplayMode, setAdvisorDisplayMode] = useState<AdvisorDisplayMode>("meta");

  const canManageTargets = userRole === "admin" || userRole === "admin_master";

  const monthOptions = useMemo(() => {
    const year = Number(selectedYear);
    if (!Number.isFinite(year)) return [];
    return Array.from({ length: 12 }, (_, idx) => {
      const d = new Date(year, idx, 1);
      return {
        value: format(d, "yyyy-MM"),
        label: format(d, "MMM/yyyy", { locale: ptBR }),
      };
    });
  }, [selectedYear]);

  const currentMonthKey = useMemo(() => {
    if (!currentData || currentData.length === 0) return `${selectedYear}-01`;
    return format(parseISO(currentData[0].data_posicao), "yyyy-MM");
  }, [currentData, selectedYear]);

  useEffect(() => {
    if (selectedMetric === "funding" && viewMode === "detailed") {
      setViewMode("monthly");
    }
  }, [selectedMetric, viewMode]);

  useEffect(() => {
    if (monthOptions.length > 0) {
      setBreakEvenForm((prev) => ({ ...prev, monthKey: monthOptions[0].value }));
    }
    setBreakEvenListMonth("all");
    setBreakEvenListProduct("all");
  }, [monthOptions]);

  const loadBreakEvenTargets = async () => {
    const start = `${selectedYear}-01-01`;
    const end = `${selectedYear}-12-31`;
    const { data, error } = await (supabase
      .from("dashboard_breakeven_targets" as any) as any)
      .select("id, competencia, product_key, value")
      .gte("competencia", start)
      .lte("competencia", end)
      .order("competencia", { ascending: true })
      .order("product_key", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar metas breakeven");
      return;
    }

    setBreakEvenTargets((data || []) as BreakEvenTargetRow[]);
  };

  useEffect(() => {
    loadBreakEvenTargets();
  }, [selectedYear]);

  const breakEvenMap = useMemo(() => {
    const m = new Map<string, number>();
    breakEvenTargets.forEach((t) => {
      const mk = format(parseISO(t.competencia), "yyyy-MM");
      m.set(`${mk}|${t.product_key}`, Number(t.value) || 0);
    });
    return m;
  }, [breakEvenTargets]);

  const filteredBreakEvenTargets = useMemo(() => {
    return breakEvenTargets.filter((row) => {
      const monthKey = format(parseISO(row.competencia), "yyyy-MM");
      if (breakEvenListMonth !== "all" && monthKey !== breakEvenListMonth) return false;
      if (breakEvenListProduct !== "all" && row.product_key !== breakEvenListProduct) return false;
      return true;
    });
  }, [breakEvenTargets, breakEvenListMonth, breakEvenListProduct]);

  const hasBreakEvenListFilter = breakEvenListMonth !== "all" || breakEvenListProduct !== "all";

  const breakEvenReplicatePreview = useMemo(() => {
    const count = Math.min(24, Math.max(1, breakEvenReplicateMonths));
    const [year, month] = breakEvenForm.monthKey.split("-").map(Number);
    if (!year || !month) return null;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month - 1 + count - 1, 1);
    return {
      count,
      startLabel: format(start, "MMM/yyyy", { locale: ptBR }),
      endLabel: format(end, "MMM/yyyy", { locale: ptBR }),
    };
  }, [breakEvenForm.monthKey, breakEvenReplicateMonths]);

  const getBreakEvenProductTarget = (monthKey: string, productKey: string) => {
    return breakEvenMap.get(`${monthKey}|${productKey}`) ?? 0;
  };

  const getBreakEvenMetricTarget = (monthKey: string, metric: MetricType) => {
    if (metric === "funding") return 0;
    const keys = BREAK_EVEN_KEYS_BY_METRIC[metric];
    return keys.reduce((acc, k) => acc + getBreakEvenProductTarget(monthKey, k), 0);
  };

  const resetBreakEvenForm = () => {
    setBreakEvenForm({
      id: null,
      monthKey: monthOptions[0]?.value || `${selectedYear}-01`,
      productKey: BREAK_EVEN_PRODUCT_OPTIONS[0].key,
      value: "",
    });
    setBreakEvenReplicate(false);
    setBreakEvenReplicateMonths(12);
  };

  const onSubmitBreakEven = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTargets) return;

    const parsed = Number(String(breakEvenForm.value).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setIsBreakEvenSaving(true);
    const monthsToSave =
      !breakEvenForm.id && breakEvenReplicate
        ? Math.min(24, Math.max(1, breakEvenReplicateMonths))
        : 1;
    const [year, month] = breakEvenForm.monthKey.split("-").map(Number);
    const payloads = Array.from({ length: monthsToSave }, (_, idx) => {
      const d = new Date(year, month - 1 + idx, 1);
      return {
        competencia: `${format(d, "yyyy-MM")}-01`,
        product_key: breakEvenForm.productKey,
        value: parsed,
      };
    });

    const base = (supabase.from("dashboard_breakeven_targets" as any) as any);
    const { error } = breakEvenForm.id
      ? await base.update(payloads[0]).eq("id", breakEvenForm.id)
      : await base.upsert(payloads, { onConflict: "competencia,product_key" });

    setIsBreakEvenSaving(false);

    if (error) {
      console.error("Erro ao salvar meta breakeven", error);
      toast.error(error.message || "Erro ao salvar meta breakeven");
      return;
    }

    toast.success(
      monthsToSave > 1 && breakEvenReplicatePreview
        ? `Metas salvas de ${breakEvenReplicatePreview.startLabel} até ${breakEvenReplicatePreview.endLabel}`
        : "Meta breakeven salva"
    );
    resetBreakEvenForm();
    await loadBreakEvenTargets();
  };

  const onEditBreakEven = (row: BreakEvenTargetRow) => {
    setBreakEvenForm({
      id: row.id,
      monthKey: format(parseISO(row.competencia), "yyyy-MM"),
      productKey: row.product_key,
      value: String(row.value ?? ""),
    });
    setBreakEvenReplicate(false);
    setIsBreakEvenDialogOpen(true);
  };

  const onDeleteBreakEven = async (row: BreakEvenTargetRow) => {
    if (!canManageTargets) return;
    const { error } = await (supabase
      .from("dashboard_breakeven_targets" as any) as any)
      .delete()
      .eq("id", row.id);

    if (error) {
      toast.error("Erro ao apagar meta breakeven");
      return;
    }

    toast.success("Meta breakeven apagada");
    if (breakEvenForm.id === row.id) resetBreakEvenForm();
    await loadBreakEvenTargets();
  };

  useEffect(() => {
    const fetchReferenceDate = async () => {
      try {
        const { data, error } = await (supabase
          .from('vw_tabelas_atualizacao' as any) as any)
          .select('ultima_atualizacao')
          .order('ultima_atualizacao', { ascending: false })
          .limit(1);

        if (data && data[0]?.ultima_atualizacao) {
          setReferenceDate(parseISO(data[0].ultima_atualizacao));
        }
      } catch (error) {
        console.error("Error fetching reference date:", error);
      }
    };

    fetchReferenceDate();
  }, []);

  // Helper to calculate Pace (Projeção)
  const getPaceValue = (value: number) => {
    if (displayMode !== 'pace') return value;
    if (!currentData || currentData.length === 0) return value;
    
    const dataDate = parseISO(currentData[0].data_posicao);
    
    // Só aplica Pace se os dados forem do mesmo mês e ano da data de referência
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) {
      return value;
    }

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    
    // Dias úteis totais no mês da referência
    const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
    
    // Dias úteis passados até a data de referência (inclusive)
    // Aplicamos D-2 para compensar o delay de atualização do relatório
    const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
    const passedDays = Math.max(1, rawPassedDays - 2);
    
    // Se ainda estamos no começo do mês (ex: dia 1), evitamos divisão por zero ou projeção exagerada
    const effectivePassedDays = passedDays;

    if (effectivePassedDays > 0 && totalDays > 0) {
      return (value / effectivePassedDays) * totalDays;
    }
    
    return value;
  };

  // Helper to calculate Proportional Target (Meta Proporcional)
  const getProportionalTarget = (target: number) => {
    if (displayMode !== 'proportional') return target;
    if (!currentData || currentData.length === 0) return target;

    const dataDate = parseISO(currentData[0].data_posicao);
    
    // Só aplica Proporcional se os dados forem do mesmo mês e ano da data de referência
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) {
      return target;
    }

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    
    const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
    const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
    const passedDays = Math.max(1, rawPassedDays - 2);
    
    if (totalDays > 0) {
      return (target / totalDays) * passedDays;
    }

    return target;
  };

  // 1. Calculate Current KPIs
  const kpis = useMemo(() => {
    const custodyTotal = currentData.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);
    
    const calculateMetric = (type: MetricType) => {
      const config = { ...METRIC_CONFIG[type] };
      // Override funding fields based on filter
      if (type === 'funding') {
        config.fields = FUNDING_FIELDS[fundingFilter];
      }
      let realized = 0;
      let target = 0;

      // Calculate Realized
      let rawRealized = currentData.reduce((acc, curr) => {
        let sum = 0;
        config.fields.forEach(field => {
          sum += (curr as any)[field] || 0;
        });
        return acc + sum;
      }, 0);

      realized = getPaceValue(rawRealized);

      // Calculate Target
      if (config.isRoaBased) {
        if (targetKind === "roa") {
          target = (custodyTotal * (config.roaTarget || 0)) / 12;
        } else {
          target = getBreakEvenMetricTarget(currentMonthKey, type);
        }
      } else {
        // Direct Target Field (e.g. Meta Captação)
        target = currentData.reduce((acc, curr) => acc + ((curr as any)[config.targetField!] || 0), 0);
      }

      target = getProportionalTarget(target);

      const percent = target > 0 ? (realized / target) * 100 : 0;
      const gap = target - realized;

      return { realized, target, percent, gap };
    };

    const calculateProductMetrics = (products: typeof PRODUCT_METRICS.eurostock) => {
      return products.map(product => {
        const rawRealized = currentData.reduce((acc, curr) => {
          let sum = 0;
          product.fields.forEach(field => {
            sum += (curr as any)[field] || 0;
          });
          return acc + sum;
        }, 0);

        const realized = getPaceValue(rawRealized);

        let target = targetKind === "roa"
          ? (custodyTotal * product.roa) / 12
          : getBreakEvenProductTarget(currentMonthKey, (product as any).key);
        target = getProportionalTarget(target);

        const percent = target > 0 ? (realized / target) * 100 : 0;
        const gap = target - realized;

        return { ...product, realized, target, percent, gap };
      });
    };

    const metrics = {
      funding: calculateMetric('funding'),
      allocation: calculateMetric('allocation'),
      variable: calculateMetric('variable'),
      banking: calculateMetric('banking'),
      insurance: calculateMetric('insurance')
    };

    const eurostockProducts = calculateProductMetrics(PRODUCT_METRICS.eurostock);
    const affareProducts = calculateProductMetrics(PRODUCT_METRICS.affare);

    // Groups Calculation (Revenue Only)
    const invest = {
      realized: metrics.allocation.realized + metrics.variable.realized,
      target: metrics.allocation.target + metrics.variable.target,
    };
    const cs = {
      realized: metrics.banking.realized + metrics.insurance.realized,
      target: metrics.banking.target + metrics.insurance.target,
    };
    const global = {
      realized: invest.realized + cs.realized,
      target: invest.target + cs.target,
    };

    return {
      ...metrics,
      groups: {
        invest: {
          ...invest,
          percent: invest.target > 0 ? (invest.realized / invest.target) * 100 : 0,
          gap: invest.target - invest.realized,
          products: eurostockProducts
        },
        cs: {
          ...cs,
          percent: cs.target > 0 ? (cs.realized / cs.target) * 100 : 0,
          gap: cs.target - cs.realized,
          products: affareProducts
        },
        global: {
          ...global,
          percent: global.target > 0 ? (global.realized / global.target) * 100 : 0,
          gap: global.target - global.realized
        }
      }
    };
  }, [currentData, displayMode, targetKind, currentMonthKey, breakEvenMap, fundingFilter]);

  // 2. Prepare Chart Data
  const chartData = useMemo(() => {
    const config = { ...METRIC_CONFIG[selectedMetric] };
    // Override funding fields based on filter
    if (selectedMetric === 'funding') {
      config.fields = FUNDING_FIELDS[fundingFilter];
    }
    
    // Group by Month
    const grouped = yearlyData.reduce((acc: Record<string, any>, curr) => {
      const monthKey = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthName: format(parseISO(curr.data_posicao), "MMM", { locale: ptBR }),
          realized: 0,
          target: 0,
          custody: 0
        };
      }
      
      // Realized
      let sum = 0;
      config.fields.forEach(field => {
        sum += (curr as any)[field] || 0;
      });
      acc[monthKey].realized += sum;

      // Target (Accumulate Custody or Target Field)
      if (config.isRoaBased) {
        if (targetKind === "roa") {
          acc[monthKey].custody += curr.custodia_net || 0;
        }
      } else {
        acc[monthKey].target += (curr as any)[config.targetField!] || 0;
      }
      
      return acc;
    }, {});

    // Post-process to calculate targets based on ROA and handle Accumulation
    let result = Object.values(grouped).sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey));

    if (config.isRoaBased) {
      result = result.map((d: any) => {
        const target = targetKind === "roa"
          ? (d.custody * (config.roaTarget || 0)) / 12
          : getBreakEvenMetricTarget(d.monthKey, selectedMetric);

        return {
          ...d,
          target,
        };
      });
    }

    if (viewMode === 'accumulated') {
      let accRealized = 0;
      let accTarget = 0;
      result = result.map((d: any) => {
        accRealized += d.realized;
        accTarget += d.target;
        return {
          ...d,
          realized: accRealized,
          target: accTarget
        };
      });
    }

    // Add gap calculation
    return result.map((d: any) => ({
      ...d,
      gap: d.target - d.realized
    }));
  }, [yearlyData, selectedMetric, viewMode, targetKind, breakEvenMap, fundingFilter]);

  const productMonthTable = useMemo(() => {
    if (selectedMetric === "funding") return null;

    const products = BREAK_EVEN_KEYS_BY_METRIC[selectedMetric]
      .map((key) => ALL_PRODUCTS.find((p) => p.key === key))
      .filter((p): p is (typeof ALL_PRODUCTS)[number] => Boolean(p));

    if (products.length === 0) return null;

    const liveMonthKey = format(referenceDate, "yyyy-MM");
    const paceFactor = getBusinessDayPaceFactor(referenceDate);

    const grouped: Record<string, { label: string; custody: number; values: Record<string, number> }> = {};

    yearlyData.forEach((curr) => {
      const monthKey = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: format(parseISO(curr.data_posicao), "MMM", { locale: ptBR }),
          custody: 0,
          values: {},
        };
      }
      grouped[monthKey].custody += curr.custodia_net || 0;
      products.forEach((product) => {
        const sum = product.fields.reduce((acc, field) => acc + ((curr as any)[field] || 0), 0);
        grouped[monthKey].values[product.key] = (grouped[monthKey].values[product.key] || 0) + sum;
      });
    });

    const months = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const monthMeta = months.map((key) => ({
      key,
      label: grouped[key].label,
      isCurrent: key === liveMonthKey,
    }));

    const toMetric = (realized: number, target: number, isCurrent: boolean): MonthMetric => {
      const percent = target > 0 ? (realized / target) * 100 : 0;
      const pace = isCurrent ? realized * paceFactor : null;
      const pacePercent = isCurrent && pace != null && target > 0 ? (pace / target) * 100 : null;
      return { realized, target, percent, pace, pacePercent, isCurrent };
    };

    const rows = products.map((product) => {
      const cells = months.map((key) => {
        const realized = grouped[key].values[product.key] || 0;
        const target = targetKind === "roa"
          ? (grouped[key].custody * product.roa) / 12
          : getBreakEvenProductTarget(key, product.key);
        return toMetric(realized, target, key === liveMonthKey);
      });

      const totalRealized = cells.reduce((acc, cell) => acc + cell.realized, 0);
      const totalTarget = cells.reduce((acc, cell) => acc + cell.target, 0);
      return {
        key: product.key,
        label: product.label,
        cells,
        total: toMetric(totalRealized, totalTarget, false),
      };
    });

    const totals = months.map((_, index) => {
      const realized = rows.reduce((acc, row) => acc + row.cells[index].realized, 0);
      const target = rows.reduce((acc, row) => acc + row.cells[index].target, 0);
      return toMetric(realized, target, monthMeta[index].isCurrent);
    });

    const grandRealized = rows.reduce((acc, row) => acc + row.total.realized, 0);
    const grandTarget = rows.reduce((acc, row) => acc + row.total.target, 0);

    return {
      monthMeta,
      rows,
      totals,
      grandTotal: toMetric(grandRealized, grandTarget, false),
    };
  }, [yearlyData, selectedMetric, targetKind, breakEvenMap, referenceDate]);

  const advisorMonthLabel = useMemo(() => {
    if (!currentData?.[0]?.data_posicao) return selectedYear;
    try {
      return format(parseISO(currentData[0].data_posicao), "MMMM yyyy", { locale: ptBR });
    } catch {
      return selectedYear;
    }
  }, [currentData, selectedYear]);

  const advisorRows = useMemo(() => {
    const base = cockpitUniverse(currentData);

    const applyAdvisorValue = (raw: number) => {
      if (advisorDisplayMode !== "pace") return raw;
      if (!currentData?.[0]?.data_posicao) return raw;
      const dataDate = parseISO(currentData[0].data_posicao);
      if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) {
        return raw;
      }
      return raw * getBusinessDayPaceFactor(referenceDate);
    };

    const calcMetric = (assessor: AssessorResumo, type: MetricType, share: number) => {
      const config = METRIC_CONFIG[type];
      const raw = config.fields.reduce((acc, field) => acc + ((assessor as any)[field] || 0), 0);
      const realized = applyAdvisorValue(raw);
      let target = 0;
      if (config.isRoaBased) {
        if (targetKind === "roa") {
          target = ((assessor.custodia_net || 0) * (config.roaTarget || 0)) / 12;
        } else {
          target = getBreakEvenMetricTarget(currentMonthKey, type) * share;
        }
      } else {
        target = assessor.meta_captacao || 0;
      }
      const percent = target > 0 ? (realized / target) * 100 : 0;
      return { realized, target, percent, gap: target - realized };
    };

    return base.map((assessor) => {
      const share = metaReceitaShare(assessor, base);
      const metrics = {
        funding: calcMetric(assessor, "funding", share),
        allocation: calcMetric(assessor, "allocation", share),
        variable: calcMetric(assessor, "variable", share),
        banking: calcMetric(assessor, "banking", share),
        insurance: calcMetric(assessor, "insurance", share),
      };
      const realized = REVENUE_METRICS.reduce((acc, key) => acc + metrics[key].realized, 0);
      const target = REVENUE_METRICS.reduce((acc, key) => acc + metrics[key].target, 0);
      return {
        assessor,
        metrics,
        metaShare: share,
        revenue: {
          realized,
          target,
          percent: target > 0 ? (realized / target) * 100 : 0,
          gap: target - realized,
        },
      };
    });
  }, [currentData, targetKind, advisorDisplayMode, currentMonthKey, breakEvenMap, referenceDate]);

  const sortedAdvisorRows = useMemo(() => {
    const rows = [...advisorRows];
    rows.sort((a, b) => {
      if (advisorSort.key === "name") {
        const cmp = a.assessor.nome_assessor.localeCompare(b.assessor.nome_assessor, "pt-BR");
        return advisorSort.dir === "asc" ? cmp : -cmp;
      }
      const metricKey = advisorSort.key === "revenue" ? null : advisorSort.key;
      const av =
        advisorDisplayMode === "absolute"
          ? metricKey
            ? a.metrics[metricKey].realized
            : a.revenue.realized
          : metricKey
            ? a.metrics[metricKey].percent
            : a.revenue.percent;
      const bv =
        advisorDisplayMode === "absolute"
          ? metricKey
            ? b.metrics[metricKey].realized
            : b.revenue.realized
          : metricKey
            ? b.metrics[metricKey].percent
            : b.revenue.percent;
      return advisorSort.dir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [advisorRows, advisorSort, advisorDisplayMode]);

  const advisorTotals = useMemo(() => {
    const metrics = COCKPIT_METRICS.reduce((acc, metric) => {
      acc[metric] = advisorRows.reduce((sum, row) => sum + row.metrics[metric].realized, 0);
      return acc;
    }, {} as AdvisorMetricTotals);
    const grouped = advisorRows.reduce((acc, row) => acc + groupedRevenue(row), 0);
    return { metrics, grouped };
  }, [advisorRows]);

  const producerHighlights = useMemo(() => {
    const ranked = [...advisorRows]
      .sort((a, b) => groupedRevenue(b) - groupedRevenue(a))
      .map((row, index) => ({ row, rank: index + 1 }));
    const take = Math.min(5, ranked.length);
    const top = ranked.slice(0, take);
    const topCodes = new Set(top.map((item) => item.row.assessor.cod_assessor));
    const bottom = [...ranked]
      .reverse()
      .filter((item) => !topCodes.has(item.row.assessor.cod_assessor))
      .slice(0, Math.min(5, ranked.length));
    return { top, bottom };
  }, [advisorRows]);

  const advisorProductRows = useMemo(() => {
    if (!advisorMetricModal) return [];
    const products = advisorMetricModal.metric === "revenue"
      ? ALL_PRODUCTS
      : BREAK_EVEN_KEYS_BY_METRIC[advisorMetricModal.metric]
          .map((key) => ALL_PRODUCTS.find((product) => product.key === key))
          .filter((product): product is (typeof ALL_PRODUCTS)[number] => Boolean(product));
    const { assessor } = advisorMetricModal;
    const universe = cockpitUniverse(currentData);
    const share = metaReceitaShare(assessor, universe);

    return products.map((product) => {
      const raw = product.fields.reduce((acc, field) => acc + ((assessor as any)[field] || 0), 0);
      const realized = advisorDisplayMode === "pace" && currentData?.[0]?.data_posicao
        && isSameMonth(parseISO(currentData[0].data_posicao), referenceDate)
        && parseISO(currentData[0].data_posicao).getFullYear() === referenceDate.getFullYear()
          ? raw * getBusinessDayPaceFactor(referenceDate)
          : raw;
      const houseTotal = universe.reduce(
        (acc, d) => acc + product.fields.reduce((sum, field) => sum + ((d as any)[field] || 0), 0),
        0
      );
      let target = targetKind === "roa"
        ? ((assessor.custodia_net || 0) * product.roa) / 12
        : getBreakEvenProductTarget(currentMonthKey, product.key) * share;
      if (advisorDisplayMode === "absolute") {
        target = houseTotal;
      }
      const percent = target > 0 ? (realized / target) * 100 : 0;
      return {
        key: product.key,
        label: product.label,
        realized,
        target,
        percent,
        gap: target - realized,
      };
    });
  }, [advisorMetricModal, currentData, targetKind, advisorDisplayMode, currentMonthKey, breakEvenMap, referenceDate]);

  const fundingDialogData = useMemo(() => {
    if (!fundingDialog?.assessorCode) return yearlyData;
    return yearlyData.filter((row) => String(row.cod_assessor) === String(fundingDialog.assessorCode));
  }, [yearlyData, fundingDialog]);

  const toggleAdvisorSort = (key: "name" | "revenue" | MetricType) => {
    setAdvisorSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  };

  const openAdvisorMetric = (assessor: AssessorResumo, metric: MetricType) => {
    if (metric === "funding") {
      setFundingDialog({
        monthKey: currentMonthKey,
        assessorCode: String(assessor.cod_assessor),
        assessorName: assessor.nome_assessor,
      });
      return;
    }
    setAdvisorMetricModal({ assessor, metric });
  };

  const openAdvisorRevenue = (assessor: AssessorResumo) => {
    setAdvisorMetricModal({ assessor, metric: "revenue" });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1A2030] border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-euro-gold font-data text-xs mb-2 uppercase tracking-wider">{label}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-6 text-xs font-data">
              <span className="text-white/60">Realizado:</span>
              <span className="text-white font-medium">{formatCurrency(data.realized)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data">
              <span className="text-white/60">Meta:</span>
              <span className="text-white font-medium">{formatCurrency(data.target)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data pt-1 border-t border-white/5">
              <span className="text-white/60">Gap:</span>
              <span className={cn("font-medium", data.gap > 0 ? "text-red-400" : "text-green-400")}>
                {data.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(data.gap))}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/10 pb-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full">
          <div>
            <p className="text-[10px] sm:text-sm text-white mt-1 font-data uppercase tracking-widest">Visão Estratégica • {selectedYear}</p>
          </div>

          <div className="flex items-center justify-center gap-3 w-full md:w-auto">
            <div className="flex bg-[#1A2030] p-1 rounded-lg border border-euro-gold/20 shadow-[0_0_15px_rgba(0,0,0,0.3)] w-full sm:w-auto">
              <button
                onClick={() => setTargetKind("breakeven")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex-1 sm:flex-initial",
                  targetKind === "breakeven"
                    ? "bg-euro-gold text-black shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Breakeven
              </button>
              <button
                onClick={() => setTargetKind("roa")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex-1 sm:flex-initial",
                  targetKind === "roa"
                    ? "bg-euro-gold text-black shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                ROA
              </button>
            </div>

            <div className="flex bg-[#1A2030] p-1 rounded-lg border border-euro-gold/20 shadow-[0_0_15px_rgba(0,0,0,0.3)] w-full sm:w-auto">
              <button
                onClick={() => setDisplayMode('meta')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex-1 sm:flex-initial",
                  displayMode === 'meta' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Meta
              </button>
              <button
                onClick={() => setDisplayMode('proportional')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex items-center justify-center gap-1 flex-1 sm:flex-initial",
                  displayMode === 'proportional' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Pace
              </button>
              <button
                onClick={() => setDisplayMode('pace')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex-1 sm:flex-initial",
                  displayMode === 'pace' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Projeção
              </button>
            </div>

            {canManageTargets && (
              <Dialog open={isBreakEvenDialogOpen} onOpenChange={setIsBreakEvenDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-[10px] md:text-xs font-data uppercase tracking-wider border-euro-gold/30 text-euro-gold hover:bg-euro-gold hover:text-black"
                  >
                    Metas breakeven
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[920px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.55)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />

                  <DialogHeader className="p-5 border-b border-white/10 bg-white/[0.03]">
                    <DialogTitle className="text-euro-gold font-display text-lg tracking-wide flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Metas Breakeven
                    </DialogTitle>
                    <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
                      Cadastro por mês e produto • {selectedYear}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h4 className="text-white font-display text-sm tracking-wide">
                            {breakEvenForm.id ? "Editando meta" : "Nova meta"}
                          </h4>
                          <p className="text-white/50 font-data text-[10px] uppercase tracking-wider">
                            Valores em R$
                          </p>
                        </div>
                        {breakEvenForm.id && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/5"
                            onClick={resetBreakEvenForm}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>

                      <form onSubmit={onSubmitBreakEven} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-white/60 text-[10px] font-data uppercase tracking-wider">Mês/Ano</Label>
                            <Select
                              value={breakEvenForm.monthKey}
                              onValueChange={(v) => setBreakEvenForm((p) => ({ ...p, monthKey: v }))}
                            >
                              <SelectTrigger className="bg-[#0F1420] border-white/10 text-white h-10 rounded-xl">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0A0A0B] border-white/10 text-white">
                                {monthOptions.map((m) => (
                                  <SelectItem key={m.value} value={m.value} className="text-white">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/60 text-[10px] font-data uppercase tracking-wider">Produto</Label>
                            <Select
                              value={breakEvenForm.productKey}
                              onValueChange={(v) => setBreakEvenForm((p) => ({ ...p, productKey: v }))}
                            >
                              <SelectTrigger className="bg-[#0F1420] border-white/10 text-white h-10 rounded-xl">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0A0A0B] border-white/10 text-white">
                                {BREAK_EVEN_PRODUCT_OPTIONS.map((p) => (
                                  <SelectItem key={p.key} value={p.key} className="text-white">
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/60 text-[10px] font-data uppercase tracking-wider">Valor</Label>
                            <div className="relative">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs font-data select-none">
                                R$
                              </div>
                              <Input
                                value={breakEvenForm.value}
                                onChange={(e) => setBreakEvenForm((p) => ({ ...p, value: e.target.value }))}
                                inputMode="decimal"
                                className="bg-[#0F1420] border-white/10 text-white h-10 rounded-xl pl-10"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {!breakEvenForm.id && (
                          <div className="rounded-xl border border-white/10 bg-[#0F1420] px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <Label className="text-white text-sm font-display tracking-wide flex items-center gap-2">
                                  <Repeat className="w-4 h-4 text-euro-gold" />
                                  Replicar por meses
                                </Label>
                                <p className="text-white/45 font-data text-[10px] uppercase tracking-wider mt-0.5">
                                  Mesmo produto e valor a partir do mês escolhido
                                </p>
                              </div>
                              <Switch
                                checked={breakEvenReplicate}
                                onCheckedChange={setBreakEvenReplicate}
                                className="data-[state=checked]:bg-euro-gold"
                              />
                            </div>

                            {breakEvenReplicate && (
                              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 items-end">
                                <div className="space-y-2">
                                  <Label className="text-white/60 text-[10px] font-data uppercase tracking-wider">
                                    Quantidade
                                  </Label>
                                  <Select
                                    value={String(breakEvenReplicateMonths)}
                                    onValueChange={(v) => setBreakEvenReplicateMonths(Number(v))}
                                  >
                                    <SelectTrigger className="bg-[#0A0A0B] border-white/10 text-white h-10 rounded-xl">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0A0A0B] border-white/10 text-white">
                                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
                                        <SelectItem key={`replicate-${n}`} value={String(n)} className="text-white">
                                          {n} {n === 1 ? "mês" : "meses"}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {breakEvenReplicatePreview && (
                                  <p className="text-xs font-data text-white/60 pb-2">
                                    Vai gravar <span className="text-white">{breakEvenReplicatePreview.count}</span> metas:{" "}
                                    <span className="text-euro-gold">
                                      {breakEvenReplicatePreview.startLabel} → {breakEvenReplicatePreview.endLabel}
                                    </span>
                                    . Metas já existentes nesse produto serão substituídas.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="submit"
                            disabled={isBreakEvenSaving}
                            className="h-10 px-4 rounded-xl bg-euro-gold text-black hover:bg-euro-gold/90"
                          >
                            {breakEvenForm.id
                              ? "Salvar alterações"
                              : breakEvenReplicate && breakEvenReplicatePreview
                                ? `Salvar ${breakEvenReplicatePreview.count} meses`
                                : "Salvar"}
                          </Button>
                        </div>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-white font-display text-sm tracking-wide">Metas cadastradas</h4>
                            <p className="text-[10px] font-data uppercase tracking-widest text-white/40 mt-0.5">
                              {filteredBreakEvenTargets.length} de {breakEvenTargets.length}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-2 text-white/70 hover:text-white hover:bg-white/5"
                            onClick={loadBreakEvenTargets}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                          <Select value={breakEvenListMonth} onValueChange={setBreakEvenListMonth}>
                            <SelectTrigger className="bg-[#0F1420] border-white/10 text-white h-9 rounded-xl text-xs">
                              <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0A0A0B] border-white/10 text-white">
                              <SelectItem value="all" className="text-white">Todos os meses</SelectItem>
                              {monthOptions.map((m) => (
                                <SelectItem key={`filter-month-${m.value}`} value={m.value} className="text-white">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={breakEvenListProduct} onValueChange={setBreakEvenListProduct}>
                            <SelectTrigger className="bg-[#0F1420] border-white/10 text-white h-9 rounded-xl text-xs">
                              <SelectValue placeholder="Produto" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0A0A0B] border-white/10 text-white">
                              <SelectItem value="all" className="text-white">Todos os produtos</SelectItem>
                              {BREAK_EVEN_PRODUCT_OPTIONS.map((p) => (
                                <SelectItem key={`filter-product-${p.key}`} value={p.key} className="text-white">
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="ghost"
                            disabled={!hasBreakEvenListFilter}
                            className="h-9 px-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-30"
                            onClick={() => {
                              setBreakEvenListMonth("all");
                              setBreakEvenListProduct("all");
                            }}
                          >
                            <Filter className="w-3.5 h-3.5 mr-1.5" />
                            Limpar
                          </Button>
                        </div>
                      </div>

                      <div className="h-[340px] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                              <th className="py-3 px-4 font-bold">Mês</th>
                              <th className="py-3 px-4 font-bold">Produto</th>
                              <th className="py-3 px-4 font-bold text-right">Valor</th>
                              <th className="py-3 px-4 font-bold text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {filteredBreakEvenTargets.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  {breakEvenTargets.length === 0
                                    ? `Nenhuma meta cadastrada para ${selectedYear}.`
                                    : "Nenhuma meta para o filtro selecionado."}
                                </td>
                              </tr>
                            ) : (
                              filteredBreakEvenTargets.map((row, idx) => {
                                const monthLabel = format(parseISO(row.competencia), "MMM/yyyy", { locale: ptBR });
                                const productLabel =
                                  BREAK_EVEN_PRODUCT_OPTIONS.find((p) => p.key === row.product_key)?.label ||
                                  row.product_key;

                                return (
                                  <tr
                                    key={row.id}
                                    className={cn(
                                      "text-sm font-data",
                                      idx % 2 === 1 ? "bg-[#141824]" : "bg-[#11141D]",
                                      "hover:bg-white/[0.04] transition-colors"
                                    )}
                                  >
                                    <td className="py-3 px-4 text-white/70">{monthLabel}</td>
                                    <td className="py-3 px-4 text-white">{productLabel}</td>
                                    <td className="py-3 px-4 text-right text-white/80 tabular-nums">
                                      {formatCurrency(Number(row.value) || 0)}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-9 w-9 p-0 rounded-xl text-white/65 hover:text-white hover:bg-white/5"
                                          onClick={() => onEditBreakEven(row)}
                                          title="Editar"
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-9 w-9 p-0 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                          onClick={() => onDeleteBreakEven(row)}
                                          title="Apagar"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-euro-gold hover:bg-white/5 rounded-full transition-all duration-300 hidden sm:flex">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0A0A0B] border-euro-gold/20 text-white sm:max-w-[600px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />
                
                <DialogHeader className="p-6 pb-2 border-b border-white/5 bg-white/5">
                  <DialogTitle className="text-euro-gold font-display text-xl tracking-wide flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-euro-gold" />
                    Entenda os Modos de Visualização
                  </DialogTitle>
                  <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
                    Guia rápido de interpretação de métricas
                  </DialogDescription>
                </DialogHeader>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-euro-gold/10 rounded-lg text-euro-gold group-hover:bg-euro-gold group-hover:text-black transition-colors">
                         <Users className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Meta Breakeven por assessor</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           A meta da casa é a que você cadastra no modal, por <strong>mês e produto</strong>. No assessor, ela é rateada pela fatia da <strong>meta de receita</strong> dele no universo do Cockpit.
                         </p>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Fatia = meta de receita do assessor ÷ soma das metas de receita dos assessores da tela. Essa % vale para todos os produtos.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                            <span className="text-euro-gold font-bold uppercase tracking-wider text-[10px] bg-euro-gold/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                              Exemplo
                            </span>
                            <p className="text-xs text-white/80 font-data leading-relaxed">
                              Pedro tem meta de receita de <span className="text-white font-bold">R$ 80k</span>. O grupo soma <span className="text-white font-bold">R$ 650k</span>. Ele representa <span className="text-white font-bold">12,3%</span>. Se a casa tem R$ 100k de breakeven em RF, a meta dele nesse produto é <span className="text-white font-bold">R$ 12,3k</span>.
                            </p>
                          </div>
                          <p className="text-[11px] text-white/45 font-data leading-relaxed">
                            A meta de receita da MV é 1% a.a. da custódia ativa, dividido por 12. No seletor ROA, a meta do assessor volta a ser custódia × ROA do produto ÷ 12.
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>

                  {/* Meta */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-euro-gold/10 rounded-lg text-euro-gold group-hover:bg-euro-gold group-hover:text-black transition-colors">
                         <Target className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Meta (Original)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Representa o <strong>objetivo total</strong> definido para o mês. É o valor fixo que você precisa alcançar até o último dia útil, independente de quanto tempo já passou.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-euro-gold font-bold uppercase tracking-wider text-[10px] bg-euro-gold/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Sua meta mensal é <span className="text-white font-bold">R$ 100k</span>. O gráfico sempre mostrará 100k como alvo.
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>

                  {/* Pace */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                         <TrendingUp className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Pace (Ritmo Ideal)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Ajusta a meta proporcionalmente aos <strong>dias úteis decorridos</strong>. Indica quanto você <em>deveria ter feito</em> até hoje para estar "em dia" com a meta.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-blue-400 font-bold uppercase tracking-wider text-[10px] bg-blue-500/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Dia 15 (50% do mês). Pace ideal: <span className="text-white font-bold">R$ 50k</span>. Se fez 40k, está atrasado.
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>

                  {/* Projeção */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                         <ArrowUpRight className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Projeção (Forecast)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Estima seu <strong>fechamento mensal</strong> assumindo que você manterá o mesmo ritmo de produção diária até o fim do mês.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] bg-purple-500/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Fez R$ 40k em 50% do mês? Sua projeção é <span className="text-white font-bold">R$ 80k</span> (não bate a meta de 100k).
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* PHENOMENAL INDICATOR SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GLOBAL PHENOMENAL INDICATOR - NOW FIRST ON MOBILE */}
        <Card className="lg:col-span-4 lg:order-2 bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] relative overflow-hidden flex flex-col justify-center items-center py-8 order-1">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-euro-gold/5 via-transparent to-transparent" />
           
           <div className="relative z-10 text-center mb-6">
             <h3 className="text-lg font-display text-euro-gold uppercase tracking-[0.2em] flex items-center justify-center gap-2 mb-1">
               <Target className="w-5 h-5" />
               Performance Global
             </h3>
             <p className="text-xs text-white/40 font-data">Consolidado de Receita (Eurostock + Affare)</p>
           </div>

           <div className="relative w-48 h-48 flex items-center justify-center mb-6">
             {/* Circular Progress Background */}
             <svg className="w-full h-full transform -rotate-90">
               <circle
                 cx="96"
                 cy="96"
                 r="88"
                 fill="none"
                 stroke="rgba(255,255,255,0.05)"
                 strokeWidth="12"
               />
               <motion.circle
                 cx="96"
                 cy="96"
                 r="88"
                 fill="none"
                 stroke={kpis.groups.global.percent >= 100 ? "#22C55E" : kpis.groups.global.percent >= 70 ? "#FAC017" : "#EF4444"}
                 strokeWidth="12"
                 strokeDasharray={2 * Math.PI * 88}
                 initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                 animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - Math.min(kpis.groups.global.percent, 100) / 100) }}
                 transition={{ duration: 1.5, ease: "easeOut" }}
                 strokeLinecap="round"
               />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className={cn("text-5xl font-display font-bold", getStatusColor(kpis.groups.global.percent))}>
                 {kpis.groups.global.percent.toFixed(0)}%
               </span>
               <span className="text-xs text-white/40 font-data uppercase tracking-wider mt-1">Atingimento</span>
             </div>
           </div>

           <div className="grid grid-cols-3 w-full px-2 gap-2 border-t border-white/5 pt-6">
             <div className="text-center overflow-hidden">
                <p className="text-[9px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Meta Global</p>
                <p className="text-[11px] lg:text-xs xl:text-base font-display text-euro-gold whitespace-nowrap text-ellipsis overflow-hidden" title={formatCurrency(kpis.groups.global.target)}>{formatCurrency(kpis.groups.global.target)}</p>
             </div>
             <div className="text-center border-l border-white/5 pl-2 overflow-hidden">
                <p className="text-[9px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Total Realizado</p>
                <p className="text-[11px] lg:text-xs xl:text-base font-display text-white whitespace-nowrap text-ellipsis overflow-hidden" title={formatCurrency(kpis.groups.global.realized)}>{formatCurrency(kpis.groups.global.realized)}</p>
             </div>
             <div className="text-center border-l border-white/5 pl-2 overflow-hidden">
                <p className="text-[9px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Gap Global</p>
                <p className={cn("text-[11px] lg:text-xs xl:text-base font-display whitespace-nowrap text-ellipsis overflow-hidden", kpis.groups.global.gap > 0 ? "text-red-400" : "text-green-400")} title={(kpis.groups.global.gap > 0 ? "-" : "+") + formatCurrency(Math.abs(kpis.groups.global.gap))}>
                  {kpis.groups.global.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.global.gap))}
                </p>
             </div>
           </div>
        </Card>

        {/* INVEST & CS BREAKDOWN */}
        <div className="lg:col-span-8 lg:order-1 grid grid-cols-1 md:grid-cols-2 gap-6 order-2">
          {/* INVEST CARD */}
          <Card className="bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-24 h-24 text-blue-400" />
             </div>
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-data text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      EUROSTOCK
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Alocação + Renda Variável</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-3xl font-display", getStatusColor(kpis.groups.invest.percent))}>
                      {kpis.groups.invest.percent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-white/5 h-2 rounded-full mb-6 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(kpis.groups.invest.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(kpis.groups.invest.percent))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Meta</span>
                    <p className="text-[11px] lg:text-xs xl:text-base font-display text-euro-gold">{formatCurrency(kpis.groups.invest.target)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Realizado</span>
                    <p className="text-[11px] lg:text-xs xl:text-base font-display text-white">{formatCurrency(kpis.groups.invest.realized)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Gap</span>
                    <p className={cn("text-[11px] lg:text-xs xl:text-base font-display", kpis.groups.invest.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {kpis.groups.invest.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.invest.gap))}
                    </p>
                  </div>
                </div>

                {/* PRODUCT TABLE */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-white/40 font-data uppercase tracking-wider mb-2">
                    <div className="col-span-1">Produto</div>
                    <div className="text-right">Meta</div>
                    <div className="text-right">Real.</div>
                    <div className="text-right">Gap</div>
                  </div>
                  {kpis.groups.invest.products
                    .slice()
                    .sort((a: any, b: any) => b.target - a.target)
                    .map((p: any, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedProduct(p)}
                      className="grid grid-cols-4 gap-2 text-[10px] lg:text-[10px] xl:text-[11px] font-data border-b border-white/5 pb-1 last:border-0 hover:bg-white/10 transition-colors rounded-sm px-1 cursor-pointer"
                    >
                      <div className="text-white truncate col-span-1 flex items-center" title={p.label}>{p.label}</div>
                      <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                      <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                      <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                         {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>

          {/* CS CARD */}
          <Card className="bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Briefcase className="w-24 h-24 text-purple-400" />
             </div>
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-data text-purple-400 uppercase tracking-widest flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      AFFARE
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Banking + Seguros</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-3xl font-display", getStatusColor(kpis.groups.cs.percent))}>
                      {kpis.groups.cs.percent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-white/5 h-2 rounded-full mb-6 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(kpis.groups.cs.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(kpis.groups.cs.percent))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Meta</span>
                    <p className="text-[11px] lg:text-xs xl:text-base font-display text-euro-gold">{formatCurrency(kpis.groups.cs.target)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Realizado</span>
                    <p className="text-[11px] lg:text-xs xl:text-base font-display text-white">{formatCurrency(kpis.groups.cs.realized)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-white/40 font-data uppercase">Gap</span>
                    <p className={cn("text-[11px] lg:text-xs xl:text-base font-display", kpis.groups.cs.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {kpis.groups.cs.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.cs.gap))}
                    </p>
                  </div>
                </div>

                {/* PRODUCT TABLE */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-white/40 font-data uppercase tracking-wider mb-2">
                    <div className="col-span-1">Produto</div>
                    <div className="text-right">Meta</div>
                    <div className="text-right">Real.</div>
                    <div className="text-right">Gap</div>
                  </div>
                  {kpis.groups.cs.products
                    .slice()
                    .sort((a: any, b: any) => b.target - a.target)
                    .map((p: any, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedProduct(p)}
                      className="grid grid-cols-4 gap-2 text-[10px] lg:text-[10px] xl:text-[11px] font-data border-b border-white/5 pb-1 last:border-0 hover:bg-white/10 transition-colors rounded-sm px-1 cursor-pointer"
                    >
                      <div className="text-white truncate col-span-1 flex items-center" title={p.label}>{p.label}</div>
                      <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                      <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                      <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                         {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* KPI CARDS - 5 MAIN INDICATORS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        {(Object.keys(METRIC_CONFIG) as MetricType[]).map((metric) => {
          const data = kpis[metric];
          const config = METRIC_CONFIG[metric];
          const Icon = config.icon;
          const isSelected = selectedMetric === metric;
          
          return (
            <Card 
              key={metric}
              onClick={() => !isMobile && setSelectedMetric(metric)}
              className={cn(
                "relative overflow-hidden transition-all duration-300 border rounded-2xl shadow-2xl group",
                !isMobile && "cursor-pointer",
                "bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl",
                !isMobile && isSelected 
                  ? "border-euro-gold shadow-[0_0_20px_rgba(250,192,23,0.1)]" 
                  : "border-white/20 sm:hover:border-euro-gold/50"
              )}
            >
              {!isMobile && isSelected && <div className="absolute top-0 left-0 w-full h-0.5 bg-euro-gold shadow-[0_0_10px_#FAC017]" />}
              
              <CardContent className="p-5 flex flex-col h-full justify-between">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={cn(
                      "text-[10px] font-data uppercase tracking-widest block mb-1",
                      !isMobile && isSelected ? "text-euro-gold" : "text-white/50"
                    )}>
                      {config.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-2xl font-display", getStatusColor(data.percent))}>
                        {data.percent.toFixed(0)}%
                      </span>
                      {data.percent >= 100 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : data.percent < 70 ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    !isMobile && isSelected ? "bg-euro-gold text-black" : "bg-white/5 text-white/40"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/5 h-1.5 rounded-full mb-4 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(data.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(data.percent))}
                  />
                </div>

                {/* Details */}
                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-[10px] text-white/40 font-data">META</span>
                    <span className="text-sm font-data text-euro-gold">{formatCurrency(data.target)}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-[10px] text-white/40 font-data">REALIZADO</span>
                    <span className="text-sm font-data text-white">{formatCurrency(data.realized)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] text-white/40 font-data">PENDENTE</span>
                    <span className={cn("text-xs font-data", data.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {data.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(data.gap))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CHART SECTION */}
      <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 hidden sm:block">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              {viewMode === "detailed" ? (
                <Table2 className="w-5 h-5 text-euro-gold" />
              ) : (
                <TrendingUp className="w-5 h-5 text-euro-gold" />
              )}
              {viewMode === "detailed" ? "Detalhado" : "Evolução"} - {METRIC_CONFIG[selectedMetric].label}
              {selectedMetric === 'funding' && fundingFilter !== 'all' && (
                <span className="text-sm font-data text-euro-gold/70 uppercase">({FUNDING_LABELS[fundingFilter]})</span>
              )}
            </h3>
            <p className="text-xs text-white/40 font-data mt-1">
              {viewMode === "detailed"
                ? "Realizado vs meta por produto e mês. No mês atual, entra também o pace."
                : "Acompanhamento mensal vs Meta"}
            </p>
          </div>

          {selectedMetric === 'funding' && (
            <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
              {(['all', 'pf', 'pj'] as FundingFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFundingFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-data transition-all uppercase tracking-wider",
                    fundingFilter === f
                      ? "bg-euro-gold text-black font-bold shadow-lg"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {FUNDING_LABELS[f]}
                </button>
              ))}
            </div>
          )}

          <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-data transition-all",
                viewMode === 'monthly' 
                  ? "bg-euro-gold text-black font-bold shadow-lg" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setViewMode('accumulated')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-data transition-all",
                viewMode === 'accumulated' 
                  ? "bg-euro-gold text-black font-bold shadow-lg" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              Acumulado
            </button>
            {selectedMetric !== "funding" && (
              <button
                onClick={() => setViewMode('detailed')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-data transition-all",
                  viewMode === 'detailed'
                    ? "bg-euro-gold text-black font-bold shadow-lg"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                Detalhado
              </button>
            )}
          </div>
        </div>

        {viewMode === "detailed" ? (
          productMonthTable ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-data uppercase tracking-widest text-white/45">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  No alvo
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-euro-gold" />
                  Atenção
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Abaixo
                </span>
                <span className="text-white/20">·</span>
                <span>Cada mês: realizado, % e meta</span>
                <span className="text-white/20">·</span>
                <span className="text-euro-gold/80">Mês atual inclui pace</span>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[980px] text-left border-collapse">
                    <thead>
                      <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                        <th className="sticky top-0 left-0 z-40 bg-euro-gold py-4 px-4 font-bold min-w-[168px] shadow-[8px_0_12px_rgba(0,0,0,0.12)]">
                          Produto
                        </th>
                        {productMonthTable.monthMeta.map((month) => (
                          <th
                            key={month.key}
                            className={cn(
                              "sticky top-0 z-20 py-3 px-3 font-bold text-right whitespace-nowrap",
                              month.isCurrent ? "bg-[#E5B014]" : "bg-euro-gold"
                            )}
                          >
                            <div className="flex flex-col items-end gap-0.5">
                              <span>{month.label}</span>
                              {month.isCurrent && (
                                <span className="text-[8px] tracking-[0.18em] opacity-80">Atual</span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="sticky top-0 right-0 z-40 bg-euro-gold py-4 px-4 font-bold text-right whitespace-nowrap border-l border-euro-navy/20 shadow-[-8px_0_12px_rgba(0,0,0,0.12)]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {productMonthTable.rows.map((row, rowIndex) => {
                        const rowBg = rowIndex % 2 === 1 ? "bg-[#141824]" : "bg-[#11141D]";
                        return (
                        <tr
                          key={row.key}
                          className="text-sm hover:bg-white/[0.03] transition-colors"
                        >
                          <td className={cn("sticky left-0 z-10 py-3 px-4 align-top shadow-[8px_0_12px_rgba(0,0,0,0.18)]", rowBg)}>
                            <div className="flex items-center gap-3">
                              <span className="h-8 w-[3px] rounded-full bg-euro-gold/80 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-white/90 font-data text-xs">{row.label}</div>
                                <div className="text-white/35 font-data text-[10px] uppercase tracking-widest">
                                  {String(rowIndex + 1).padStart(2, "0")}
                                </div>
                              </div>
                            </div>
                          </td>
                          {row.cells.map((cell, index) => (
                            <td
                              key={`${row.key}-${productMonthTable.monthMeta[index].key}`}
                              className={cn("py-3 px-3 align-top", rowBg)}
                            >
                              <MonthMetricCell metric={cell} />
                            </td>
                          ))}
                          <td className={cn("sticky right-0 z-10 py-3 px-4 align-top border-l border-white/10 shadow-[-8px_0_12px_rgba(0,0,0,0.28)]", rowBg)}>
                            <MonthMetricCell metric={row.total} />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="text-sm">
                        <td className="sticky bottom-0 left-0 z-30 bg-[#0A0A0B] py-3 px-4 align-top border-t border-white/10 shadow-[8px_0_12px_rgba(0,0,0,0.18)]">
                          <div className="text-euro-gold font-data text-[10px] uppercase tracking-widest">
                            Total
                          </div>
                        </td>
                        {productMonthTable.totals.map((metric, index) => (
                          <td
                            key={`total-${productMonthTable.monthMeta[index].key}`}
                            className="sticky bottom-0 z-20 bg-[#0A0A0B] py-3 px-3 align-top border-t border-white/10"
                          >
                            <MonthMetricCell metric={metric} />
                          </td>
                        ))}
                        <td className="sticky bottom-0 right-0 z-30 bg-[#0A0A0B] py-3 px-4 align-top border-t border-l border-white/10 shadow-[-8px_0_12px_rgba(0,0,0,0.28)]">
                          <MonthMetricCell metric={productMonthTable.grandTotal} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center rounded-xl border border-white/10 text-white/45 font-data text-sm">
              Nenhum produto encontrado para este indicador.
            </div>
          )
        ) : (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAC017" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#FAC017" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="barGradientSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="monthName" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                tickFormatter={(value) => 
                  Math.abs(value) >= 1000000 
                    ? `${(value / 1000000).toFixed(1)}M` 
                    : `${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={<CustomTooltip />}
              />
              <Bar 
                dataKey="realized" 
                name="Realizado" 
                radius={[4, 4, 0, 0]} 
                barSize={30}
                cursor={selectedMetric === 'funding' ? 'pointer' : undefined}
                onClick={(data: any) => {
                  if (selectedMetric === 'funding' && data?.monthKey) {
                    setFundingDialog({ monthKey: data.monthKey });
                  }
                }}
              >
                {chartData.map((entry: any, index: number) => {
                  let fillUrl = "url(#barGradientPositive)";
                  if (entry.realized >= entry.target) {
                    fillUrl = "url(#barGradientSuccess)";
                  } else if (entry.realized < 0) {
                    fillUrl = "url(#barGradientNegative)";
                  }
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fillUrl}
                    />
                  );
                })}
              </Bar>
              <Line 
                type="monotone" 
                dataKey="target" 
                name="Meta" 
                stroke="#FFFFFF" 
                strokeOpacity={0.5} 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#1A2030', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#FAC017', stroke: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </Card>

      <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-euro-gold" />
              Todos os assessores
            </h3>
            <p className="text-xs text-white/40 font-data mt-1">
              {advisorDisplayMode === "absolute"
                ? "Participação no total faturado"
                : advisorDisplayMode === "pace"
                  ? `Pace projetado vs meta ${targetKind === "breakeven" ? "breakeven" : "ROA"}`
                  : `Realizado vs meta ${targetKind === "breakeven" ? "breakeven" : "ROA"}`}{" "}
              • {advisorMonthLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
              {([
                { key: "meta", label: "Meta" },
                { key: "pace", label: "Pace" },
                { key: "absolute", label: "Absoluto" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAdvisorDisplayMode(option.key)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-data transition-all uppercase tracking-wider",
                    advisorDisplayMode === option.key
                      ? "bg-euro-gold text-black font-bold shadow-lg"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[10px] font-data uppercase tracking-widest text-white/35 mb-4">
          Clique no indicador para detalhar
        </p>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[920px] text-left border-collapse">
              <thead>
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                  <th className="sticky top-0 left-0 z-30 bg-euro-gold py-4 px-4 font-bold min-w-[240px]">
                    <button type="button" onClick={() => toggleAdvisorSort("name")} className="hover:opacity-80">
                      Assessor
                    </button>
                  </th>
                  <th className="sticky top-0 z-20 bg-euro-gold py-4 px-3 font-bold text-right">
                    <button type="button" onClick={() => toggleAdvisorSort("revenue")} className="hover:opacity-80">
                      Receita
                    </button>
                  </th>
                  {(Object.keys(METRIC_CONFIG) as MetricType[]).map((metric) => (
                    <th key={metric} className="sticky top-0 z-20 bg-euro-gold py-4 px-3 font-bold text-right">
                      <button type="button" onClick={() => toggleAdvisorSort(metric)} className="hover:opacity-80">
                        {METRIC_CONFIG[metric].label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedAdvisorRows.map((row, rowIndex) => {
                  const rowBg = rowIndex % 2 === 1 ? "bg-[#141824]" : "bg-[#11141D]";
                  return (
                    <tr key={row.assessor.cod_assessor} className="text-sm">
                      <td className={cn("sticky left-0 z-10 py-3 px-4 align-middle shadow-[8px_0_12px_rgba(0,0,0,0.18)]", rowBg)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0",
                              row.assessor.lider && "border-euro-gold shadow-[0_0_8px_rgba(250,192,23,0.3)]"
                            )}
                          >
                            {row.assessor.foto_url ? (
                              <img src={row.assessor.foto_url} alt={row.assessor.nome_assessor} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-euro-gold/30" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white/90 font-data text-xs uppercase tracking-tight truncate">
                              {row.assessor.nome_assessor}
                            </div>
                            <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                              {row.assessor.cod_assessor} • {row.assessor.time}
                              {targetKind === "breakeven" && row.metaShare > 0 && (
                                <span className="text-euro-gold/70"> • {formatShare(row.metaShare * 100)} da meta</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {(() => {
                        const metricValue = row.revenue;
                        const share = shareOf(metricValue.realized, advisorTotals.grouped);
                        const barWidth =
                          advisorDisplayMode === "absolute"
                            ? share
                            : metricValue.target > 0
                              ? Math.min(Math.max(metricValue.percent, 0), 100)
                              : 0;
                        return (
                          <td className={cn("py-2 px-3 align-middle", rowBg)}>
                            <button
                              type="button"
                              onClick={() => openAdvisorRevenue(row.assessor)}
                              className="w-full rounded-lg border border-transparent px-2 py-1.5 text-right hover:border-white/10 hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="text-white/90 font-data text-xs leading-none">
                                {formatCurrency(metricValue.realized)}
                              </div>
                              <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    advisorDisplayMode === "absolute"
                                      ? "bg-euro-gold"
                                      : getProgressBarColor(metricValue.percent)
                                  )}
                                  style={{ width: `${Math.min(Math.max(barWidth, 0), 100)}%` }}
                                />
                              </div>
                              <div
                                className={cn(
                                  "mt-1 text-[10px] font-data",
                                  advisorDisplayMode === "absolute"
                                    ? "text-euro-gold"
                                    : getStatusColor(metricValue.percent)
                                )}
                              >
                                {advisorDisplayMode === "absolute"
                                  ? formatShare(share)
                                  : metricValue.target > 0
                                    ? `${Math.round(metricValue.percent)}%`
                                    : "sem meta"}
                              </div>
                            </button>
                          </td>
                        );
                      })()}
                      {(Object.keys(METRIC_CONFIG) as MetricType[]).map((metric) => {
                        const metricValue = row.metrics[metric];
                        const share = shareOf(metricValue.realized, advisorTotals.metrics[metric]);
                        const barWidth =
                          advisorDisplayMode === "absolute"
                            ? share
                            : metricValue.target > 0
                              ? Math.min(Math.max(metricValue.percent, 0), 100)
                              : 0;
                        return (
                          <td key={`${row.assessor.cod_assessor}-${metric}`} className={cn("py-2 px-3 align-middle", rowBg)}>
                            <button
                              type="button"
                              onClick={() => openAdvisorMetric(row.assessor, metric)}
                              className="w-full rounded-lg border border-transparent px-2 py-1.5 text-right hover:border-white/10 hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="text-white/90 font-data text-xs leading-none">
                                {formatCurrency(metricValue.realized)}
                              </div>
                              <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    advisorDisplayMode === "absolute"
                                      ? "bg-euro-gold"
                                      : getProgressBarColor(metricValue.percent)
                                  )}
                                  style={{ width: `${Math.min(Math.max(barWidth, 0), 100)}%` }}
                                />
                              </div>
                              <div
                                className={cn(
                                  "mt-1 text-[10px] font-data",
                                  advisorDisplayMode === "absolute"
                                    ? "text-euro-gold"
                                    : getStatusColor(metricValue.percent)
                                )}
                              >
                                {advisorDisplayMode === "absolute"
                                  ? formatShare(share)
                                  : metricValue.target > 0
                                    ? `${Math.round(metricValue.percent)}%`
                                    : "sem meta"}
                              </div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {sortedAdvisorRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                      Nenhum assessor encontrado para o mês selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {producerHighlights.top.length > 0 && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="mb-6">
              <h3 className="text-lg font-display text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-euro-gold" />
                Análise por Assessor
              </h3>
              <p className="text-xs text-white/40 font-data mt-1">
                {advisorDisplayMode === "absolute"
                  ? "Quem mais e menos representa no total faturado"
                  : `Mais e menos produtores vs meta ${targetKind === "breakeven" ? "breakeven" : "ROA"}`}{" "}
                • {advisorMonthLabel}
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-euro-gold" />
                  <h4 className="text-sm font-display text-white">
                    {advisorDisplayMode === "absolute" ? "Mais representam" : "Mais produtores"}
                  </h4>
                  <span className="text-[10px] font-data uppercase tracking-widest text-white/35">
                    {advisorDisplayMode === "absolute"
                      ? "% do total"
                      : `Receita agrupada ${advisorDisplayMode === "pace" ? "• pace" : "• realizado"}`}
                  </span>
                </div>
                <div className="space-y-3">
                  {producerHighlights.top.map((item) => (
                    <ProducerCard
                      key={`top-${item.row.assessor.cod_assessor}`}
                      row={item.row}
                      rank={item.rank}
                      tone="top"
                      onMetricClick={openAdvisorMetric}
                      displayMode={advisorDisplayMode}
                      groupedTotal={advisorTotals.grouped}
                      metricTotals={advisorTotals.metrics}
                    />
                  ))}
                </div>
              </div>
              {producerHighlights.bottom.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <h4 className="text-sm font-display text-white">
                      {advisorDisplayMode === "absolute" ? "Menos representam" : "Menos produtores"}
                    </h4>
                    <span className="text-[10px] font-data uppercase tracking-widest text-white/35">
                      {advisorDisplayMode === "absolute" ? "% do total" : "Foco de decisão"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {producerHighlights.bottom.map((item) => (
                      <ProducerCard
                        key={`bottom-${item.row.assessor.cod_assessor}`}
                        row={item.row}
                        rank={item.rank}
                        tone="bottom"
                        onMetricClick={openAdvisorMetric}
                        displayMode={advisorDisplayMode}
                        groupedTotal={advisorTotals.grouped}
                        metricTotals={advisorTotals.metrics}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <CockpitGlobalPulse
        yearlyData={yearlyData}
        currentData={currentData}
        selectedYear={selectedYear}
        targetKind={targetKind}
        breakEvenTargets={breakEvenTargets}
        referenceDate={referenceDate}
      />

      <ProductDetailsDialog
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        data={currentData}
        getPaceValue={getPaceValue}
        getProportionalTarget={getProportionalTarget}
        targetKind={targetKind}
        houseBreakEvenTarget={
          selectedProduct ? getBreakEvenProductTarget(currentMonthKey, (selectedProduct as any).key) : 0
        }
      />

      <FundingMonthDialog
        isOpen={!!fundingDialog}
        onClose={() => setFundingDialog(null)}
        monthKey={fundingDialog?.monthKey || null}
        yearlyData={fundingDialogData}
        assessorName={fundingDialog?.assessorName}
      />

      <AssessorIndicatorDialog
        isOpen={!!advisorMetricModal}
        onClose={() => setAdvisorMetricModal(null)}
        assessor={advisorMetricModal?.assessor || null}
        metricLabel={
          advisorMetricModal
            ? advisorMetricModal.metric === "revenue"
              ? "Receita"
              : METRIC_CONFIG[advisorMetricModal.metric].label
            : ""
        }
        monthLabel={advisorMonthLabel}
        rows={advisorProductRows}
        shareMode={advisorDisplayMode === "absolute"}
        targetKind={targetKind}
      />
    </div>
  );
}
