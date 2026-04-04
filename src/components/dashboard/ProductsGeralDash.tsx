import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  TrendingUp,
  Landmark,
  Briefcase,
  DollarSign,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Zap,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

// ==========================================================================
// Types
// ==========================================================================

interface ProductsGeralDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string;
  selectedAssessorId: string;
  teamPhotos?: Map<string, string>;
}

// ==========================================================================
// Constants — ROA targets matching each sub-dashboard
// ==========================================================================

// Renda Fixa ROA targets (custódia anualizada ÷ 12)
const ROA_RF = 0.0015 + 0.001 + 0.0005 + 0.0002; // renda_fixa + ofertas + cetipados + offshore
// Renda Variável / Estruturadas
const ROA_RV = 0.0035;
// Consórcios
const ROA_CONS = 0.0009;
// Seguros
const ROA_SEG = 0.0007;

/** Parse valor_mensal TEXT (e.g. "1168,04") → number */
const parseValor = (raw: any): number => {
  if (raw === null || raw === undefined || raw === "") return 0;
  const str = String(raw).replace(/\s/g, "");
  const normalized = str.replace(/\.(\d{3})/g, "$1").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

// ==========================================================================
// Helpers
// ==========================================================================

const fmtCurrency = (v: number, decimals = 0) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const fmtCompact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  return `R$ ${(v / 1_000).toFixed(2).replace(".", ",")} K`;
};

const fmtPercent = (v: number) => `${v.toFixed(1)}%`;

const achievementColor = (pct: number) =>
  pct >= 100 ? "#22c55e" : pct >= 70 ? "#FAC017" : "#ef4444";

const achievementClass = (pct: number) =>
  pct >= 100 ? "text-green-400" : pct >= 70 ? "text-euro-gold" : "text-red-400";

const achievementBg = (pct: number) =>
  pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-euro-gold" : "bg-red-500";

// ==========================================================================
// RadialProgress mini component
// ==========================================================================

function RadialProgress({
  percent,
  color,
  icon: Icon,
  size = 56,
  delay = 0,
}: {
  percent: number;
  color: string;
  icon: React.ElementType;
  size?: number;
  delay?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - Math.min(percent, 100) / 100);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.2, ease: "easeOut", delay: delay + 0.3 }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
  );
}

// ==========================================================================
// GlobalPerformanceCard
// ==========================================================================

interface GlobalPerf {
  totalRealized: number;
  totalTarget: number;
  rfRealized: number;
  rvRealized: number;
  consRealized: number;
  segRealized: number;
  pct: number;
}

function GlobalPerformanceCard({ perf, delay = 0 }: { perf: GlobalPerf; delay?: number }) {
  const pct = perf.pct;
  const gap = perf.totalRealized - perf.totalTarget;
  const color = achievementColor(pct);

  // breakdown percentages
  const total = perf.rfRealized + perf.rvRealized + perf.consRealized + perf.segRealized || 1;
  const rfPct = (perf.rfRealized / total) * 100;
  const rvPct = (perf.rvRealized / total) * 100;
  const consPct = (perf.consRealized / total) * 100;
  const segPct = (perf.segRealized / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="col-span-full"
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-white/[0.07] via-transparent to-euro-gold/[0.03] backdrop-blur-xl border border-euro-gold/25 rounded-3xl shadow-2xl hover:border-euro-gold/40 transition-all duration-300">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-euro-gold/5 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-euro-gold/60 to-euro-gold/10 rounded-l-3xl" />

        <CardContent className="p-6 pl-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left: title + main values */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-euro-gold/15 border border-euro-gold/25">
                  <Zap className="w-3.5 h-3.5 text-euro-gold" />
                </span>
                <span className="text-[10px] font-data uppercase tracking-[0.25em] text-euro-gold/70">
                  Performance Global · Produtos
                </span>
              </div>

              <div className="flex items-end gap-4 flex-wrap mt-3">
                <div>
                  <span className="text-4xl font-display text-euro-gold leading-none">
                    {fmtCompact(perf.totalRealized)}
                  </span>
                  <div className="text-[10px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                    Receita Total Produtos
                  </div>
                </div>
                <div className="pb-1">
                  <span className={cn("text-xl font-display", achievementClass(pct))}>
                    {fmtPercent(pct)}
                  </span>
                  <div className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    da meta
                  </div>
                </div>
                <div className="pb-1">
                  <span className={cn("text-base font-display flex items-center gap-1", gap >= 0 ? "text-green-400" : "text-red-400")}>
                    {gap >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {fmtCompact(Math.abs(gap))}
                  </span>
                  <div className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    {gap >= 0 ? "acima" : "abaixo"} da meta
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-[10px] font-data text-white uppercase tracking-widest">
                    Meta · {fmtCompact(perf.totalTarget)}
                  </span>
                  <span className="text-sm font-data font-bold" style={{ color }}>
                    {fmtPercent(pct)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: delay + 0.4 }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </div>
            </div>

            {/* Right: breakdown mini-bars */}
            <div className="flex-shrink-0 w-full lg:w-64 space-y-3">
              <div className="text-[9px] font-data uppercase tracking-[0.2em] text-white/30 mb-2">
                Composição da Receita
              </div>

              {[
                { label: "Renda Fixa", value: perf.rfRealized, pct: rfPct, color: "#3B82F6" },
                { label: "Renda Variável", value: perf.rvRealized, pct: rvPct, color: "#8B5CF6" },
                { label: "Consórcios", value: perf.consRealized, pct: consPct, color: "#FAC017" },
                { label: "Seguros", value: perf.segRealized, pct: segPct, color: "#10B981" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-data text-white/60">{item.label}</span>
                    <span className="text-[10px] font-data text-white font-medium">{fmtCompact(item.value)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(item.pct, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: delay + 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// RevenueCard — individual product area card
// ==========================================================================

interface RevenueCardProps {
  title: string;
  subtitle: string;
  realized: number;
  target: number;
  prevRealized?: number;
  icon: React.ElementType;
  color: string;
  delay?: number;
  onClick?: () => void;
}

function RevenueCard({
  title,
  subtitle,
  realized,
  target,
  prevRealized,
  icon: Icon,
  color,
  delay = 0,
  onClick,
}: RevenueCardProps) {
  const pct = target > 0 ? (realized / target) * 100 : 0;
  const delta = prevRealized !== undefined ? realized - prevRealized : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay }}
      className="h-full"
    >
      <Card
        onClick={onClick}
        className={cn(
          "relative overflow-hidden h-full bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl hover:border-euro-gold/35 transition-all duration-300 group",
          onClick ? "cursor-pointer hover:shadow-euro-gold/20" : ""
        )}
      >
        {/* color accent */}
        <div
          className="absolute top-0 left-0 w-1 h-full opacity-60 hidden md:block rounded-l-2xl"
          style={{ background: color }}
        />
        {/* glow */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `${color}15` }}
        />

        <CardContent className="p-5 pl-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-data uppercase tracking-[0.22em] text-white/40 mb-0.5">
                {subtitle}
              </p>
              <p className="text-[11px] font-data uppercase tracking-widest font-semibold" style={{ color }}>
                {title}
              </p>
            </div>
            <RadialProgress
              percent={pct}
              color={color}
              icon={Icon}
              size={52}
              delay={delay}
            />
          </div>

          {/* Main value */}
          <div className="mb-4">
            <span className="text-3xl font-display text-white leading-none">
              {fmtCompact(realized)}
            </span>
          </div>

          {/* Meta + progress */}
          <div className="mt-auto space-y-2">
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[10px] font-data text-white uppercase tracking-widest">
                Meta {fmtCompact(target)}
              </span>
              <span
                className="text-[10px] font-data font-bold tracking-widest"
                style={{ color: achievementColor(pct) }}
              >
                {fmtPercent(pct)}
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 1.1, ease: "easeOut", delay: delay + 0.35 }}
                className="h-full rounded-full"
                style={{ background: achievementColor(pct) }}
              />
            </div>
          </div>

          {/* Delta vs previous month */}
          {delta !== undefined && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
              {delta > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
              ) : delta < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-white/30" />
              )}
              <span
                className={cn(
                  "text-[10px] font-data font-semibold",
                  delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/40"
                )}
              >
                {delta > 0 ? "+" : ""}
                {fmtCompact(delta)}
              </span>
              <span className="text-[10px] font-data text-white/30">vs mês anterior</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// Chart tooltip
// ==========================================================================

const EvolutionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F1218]/95 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[200px]">
      <p className="text-euro-gold font-data text-[10px] uppercase tracking-[0.2em] mb-3 pb-2 border-b border-white/10">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color || entry.fill || entry.stroke }} />
              <span className="text-[10px] font-data text-white/60 uppercase">{entry.name}</span>
            </div>
            <span className="text-[11px] font-display text-white">{fmtCompact(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================================================
// Main Component
// ==========================================================================

export default function ProductsGeralDash({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
}: ProductsGeralDashProps) {
  const [isRfModalOpen, setIsRfModalOpen] = useState(false);

  const selectedMonthKey = selectedMonth
    ? selectedMonth.substring(0, 7)
    : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const prevMonthKey = (() => {
    const [y, m] = selectedMonthKey.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // Query 1 — mv_resumo_assessor (Renda Fixa + Renda Variável yearly)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: mvData, isLoading: isMvLoading } = useQuery({
    queryKey: ["prod-geral-mv", selectedYear, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase.from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      let q = supabase
        .from("mv_resumo_assessor" as any)
        .select(
          "data_posicao, cod_assessor, time, custodia_net," +
          "receita_renda_fixa, receitas_ofertas_fundos, receitas_ofertas_rf, receita_cetipados, receitas_offshore," +
          "receitas_estruturadas"
        )
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);

      if (selectedTeam !== "all") {
        q = q.eq("time", selectedTeam);
      } else {
        q = q.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        q = q.eq("cod_assessor", selectedAssessorId);
      }

      const { data, error } = await q.order("data_posicao", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Query 2 — consórcios comissões (Fact — monthly)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: consYearData, isLoading: isConsLoading } = useQuery({
    queryKey: ["prod-geral-cons", selectedYear, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      // Active assessors for team filtering
      const { data: latestDateData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate = (latestDateData as any)?.data_posicao;

      let q2 = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, time, custodia_net")
        .eq("data_posicao", latestDate);

      if (selectedTeam !== "all") q2 = q2.eq("time", selectedTeam);
      if (selectedAssessorId !== "all") q2 = q2.eq("cod_assessor", selectedAssessorId);

      const { data: assessorRows } = await q2;
      const assessorMap = new Map<string, { time: string; custody: number }>();
      (assessorRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor) {
          assessorMap.set(r.cod_assessor.toUpperCase(), {
            time: r.time || "",
            custody: Number(r.custodia_net) || 0,
          });
        }
      });

      // Consórcios commissions for the year
      const { data: comData } = await supabase
        .from("vw_dados_consorcio_comissoes" as any)
        .select("id, cod_assessor, data_vencimento, valor_comissao_mensal")
        .gte("data_vencimento", `${selectedYear}-01-01`)
        .lte("data_vencimento", `${selectedYear}-12-31`);

      const rows = (comData as any[] || []).filter((r: any) => {
        const cod = (r.cod_assessor || "").trim().toUpperCase();
        const info = assessorMap.get(cod);
        if (!info) return false;
        if (selectedTeam !== "all" && info.time !== selectedTeam) return false;
        if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return false;
        return true;
      });

      return { rows, assessorMap };
    },
  });


  // ──────────────────────────────────────────────────────────────────────────
  // Query 3 — vw_seguros_extrato (monthly revenue)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: segurosData, isLoading: isSegLoading } = useQuery({
    queryKey: ["prod-geral-seguros", selectedYear, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      // Get assessor map for team/assessor filtering
      const { data: latestDateData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate = (latestDateData as any)?.data_posicao;

      let q3 = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, time")
        .eq("data_posicao", latestDate);
      if (selectedTeam !== "all") q3 = q3.eq("time", selectedTeam);
      if (selectedAssessorId !== "all") q3 = q3.eq("cod_assessor", selectedAssessorId);
      const { data: aRows } = await q3;

      const aMap = new Map<string, string>();
      (aRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor) aMap.set(r.cod_assessor.toUpperCase(), r.time || "");
      });

      const normalizeA = (raw: string) => {
        const s = (raw || "").trim().toUpperCase();
        return s.startsWith("A") ? s : `A${s}`;
      };

      const { data: segRows } = await supabase
        .from("vw_seguros_extrato" as any)
        .select("assessor, valor_mensal, data_vencimento")
        .gte("data_vencimento", `${selectedYear}-01-01`)
        .lte("data_vencimento", `${selectedYear}-12-31`);

      return ((segRows as any[]) || []).filter((r: any) => {
        const cod = normalizeA(r.assessor || "");
        const time = aMap.get(cod);
        if (aMap.size > 0 && time === undefined) return false;
        if (selectedTeam !== "all" && time !== selectedTeam) return false;
        if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return false;
        return true;
      });
    },
  });

  const isLoading = isMvLoading || isConsLoading || isSegLoading;

  // ──────────────────────────────────────────────────────────────────────────
  // KPI calculations — current + previous month
  // ──────────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const filterMv = (key: string) =>
      (mvData || []).filter((d) => d.data_posicao?.substring(0, 7) === key);

    const sumMvFields = (rows: any[], fields: string[]) =>
      rows.reduce((acc, d) => {
        fields.forEach((f) => { acc += d[f] || 0; });
        return acc;
      }, 0);

    const curMv = filterMv(selectedMonthKey);
    const prevMv = filterMv(prevMonthKey);

    const custodiaTotal = sumMvFields(curMv, ["custodia_net"]);

    // Renda Fixa (includes ofertas, cetipados, offshore)
    const rfFields = ["receita_renda_fixa", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receita_cetipados", "receitas_offshore"];
    const rfRealized = sumMvFields(curMv, rfFields);
    const rfPrev = sumMvFields(prevMv, rfFields);
    const rfTarget = (custodiaTotal * ROA_RF) / 12;

    // Renda Variável (Estruturadas)
    const rvRealized = sumMvFields(curMv, ["receitas_estruturadas"]);
    const rvPrev = sumMvFields(prevMv, ["receitas_estruturadas"]);
    const rvTarget = (custodiaTotal * ROA_RV) / 12;

    // Consórcios — filter month from year data
    const consRows = (consYearData?.rows || []).filter(
      (r: any) => r.data_vencimento?.substring(0, 7) === selectedMonthKey
    );
    const consPrevRows = (consYearData?.rows || []).filter(
      (r: any) => r.data_vencimento?.substring(0, 7) === prevMonthKey
    );
    const consRealized = consRows.reduce((acc: number, r: any) => acc + Number(r.valor_comissao_mensal || 0), 0);
    const consPrev = consPrevRows.reduce((acc: number, r: any) => acc + Number(r.valor_comissao_mensal || 0), 0);
    const consTarget = (custodiaTotal * ROA_CONS) / 12;

    // Seguros — filter month from year data
    const segRows = (segurosData || []).filter(
      (r: any) => r.data_vencimento?.substring(0, 7) === selectedMonthKey
    );
    const segPrevRows = (segurosData || []).filter(
      (r: any) => r.data_vencimento?.substring(0, 7) === prevMonthKey
    );
    const segRealized = segRows.reduce((acc: number, r: any) => acc + parseValor(r.valor_mensal), 0);
    const segPrev = segPrevRows.reduce((acc: number, r: any) => acc + parseValor(r.valor_mensal), 0);
    const segTarget = (custodiaTotal * ROA_SEG) / 12;

    const rfDetails = [
      {
        label: "Renda Fixa",
        realized: sumMvFields(curMv, ["receita_renda_fixa"]),
        target: (custodiaTotal * 0.0015) / 12,
        color: "#3B82F6",
      },
      {
        label: "Ofertas (Fundos + RF)",
        realized: sumMvFields(curMv, ["receitas_ofertas_fundos", "receitas_ofertas_rf"]),
        target: (custodiaTotal * 0.001) / 12,
        color: "#8B5CF6",
      },
      {
        label: "Cetipados",
        realized: sumMvFields(curMv, ["receita_cetipados"]),
        target: (custodiaTotal * 0.0005) / 12,
        color: "#F97316",
      },
      {
        label: "Offshore",
        realized: sumMvFields(curMv, ["receitas_offshore"]),
        target: (custodiaTotal * 0.0002) / 12,
        color: "#10B981",
      },
    ];

    const totalRealized = rfRealized + rvRealized + consRealized + segRealized;
    const totalTarget = rfTarget + rvTarget + consTarget + segTarget;
    const totalPct = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;

    return {
      rf: { realized: rfRealized, target: rfTarget, prev: rfPrev, details: rfDetails },
      rv: { realized: rvRealized, target: rvTarget, prev: rvPrev },
      cons: { realized: consRealized, target: consTarget, prev: consPrev },
      seg: { realized: segRealized, target: segTarget, prev: segPrev },
      total: { realized: totalRealized, target: totalTarget, pct: totalPct },
    };
  }, [mvData, consYearData, segurosData, selectedMonthKey, prevMonthKey]);

  // ──────────────────────────────────────────────────────────────────────────
  // Chart data — monthly evolution (year)
  // ──────────────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!mvData || !consYearData) return [];

    // Build month buckets for the selected year
    const buckets: Record<
      string,
      { rfRealized: number; rvRealized: number; consRealized: number; segRealized: number; custody: number }
    > = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
      buckets[key] = { rfRealized: 0, rvRealized: 0, consRealized: 0, segRealized: 0, custody: 0 };
    }

    const rfFields = [
      "receita_renda_fixa", "receitas_ofertas_fundos", "receitas_ofertas_rf",
      "receita_cetipados", "receitas_offshore",
    ];

    mvData.forEach((d) => {
      const mk = d.data_posicao?.substring(0, 7);
      if (!mk || !buckets[mk]) return;
      rfFields.forEach((f) => { buckets[mk].rfRealized += d[f] || 0; });
      buckets[mk].rvRealized += d.receitas_estruturadas || 0;
      buckets[mk].custody += d.custodia_net || 0;
    });

    consYearData.rows.forEach((r: any) => {
      const mk = r.data_vencimento?.substring(0, 7);
      if (!mk || !buckets[mk]) return;
      buckets[mk].consRealized += Number(r.valor_comissao_mensal || 0);
    });

    // Seguros
    (segurosData || []).forEach((r: any) => {
      const mk = r.data_vencimento?.substring(0, 7);
      if (!mk || !buckets[mk]) return;
      buckets[mk].segRealized += parseValor(r.valor_mensal);
    });

    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, vals]) => {
        const [y, month] = mk.split("-").map(Number);
        const isFuture =
          y > currentYearNum ||
          (y === currentYearNum && month > currentMonthNum);

        const totalRealized = vals.rfRealized + vals.rvRealized + vals.consRealized + vals.segRealized;
        const totalTarget =
          ((vals.custody * ROA_RF) / 12) +
          ((vals.custody * ROA_RV) / 12) +
          ((vals.custody * ROA_CONS) / 12) +
          ((vals.custody * ROA_SEG) / 12);

        return {
          monthKey: mk,
          monthName: format(parseISO(`${mk}-01`), "MMM", { locale: ptBR }),
          rfRealized: isFuture ? null : vals.rfRealized,
          rvRealized: isFuture ? null : vals.rvRealized,
          consRealized: isFuture ? null : vals.consRealized,
          segRealized: isFuture ? null : vals.segRealized,
          totalRealized: isFuture ? null : totalRealized,
          totalTarget: isFuture ? null : totalTarget,
          isFuture,
        };
      });
  }, [mvData, consYearData, segurosData, selectedYear]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {isLoading && <LoadingOverlay isLoading />}

      {/* ── SECTION HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display text-white tracking-wide flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-euro-gold/15 flex items-center justify-center border border-euro-gold/25">
              <BarChart3 className="w-6 h-6 text-euro-gold" />
            </span>
            Visão Geral · Produtos
          </h2>
          <p className="text-white/35 font-data tracking-[ widest] uppercase text-xs mt-2 ml-[60px]">
            Performance Consolidada · {format(parseISO(`${selectedMonthKey}-01`), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* ── GLOBAL PERFORMANCE CARD ── */}
      <GlobalPerformanceCard
        perf={{
          totalRealized: kpis.total.realized,
          totalTarget: kpis.total.target,
          rfRealized: kpis.rf.realized,
          rvRealized: kpis.rv.realized,
          consRealized: kpis.cons.realized,
          segRealized: kpis.seg.realized,
          pct: kpis.total.pct,
        }}
        delay={0}
      />

      {/* ── INDIVIDUAL REVENUE CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" style={{ gridAutoRows: "1fr" }}>
        <RevenueCard
          title="Renda Fixa"
          subtitle="RF + Ofertas + Cetipados + Offshore"
          realized={kpis.rf.realized}
          target={kpis.rf.target}
          prevRealized={kpis.rf.prev}
          icon={Landmark}
          color="#3B82F6"
          delay={0.1}
          onClick={() => setIsRfModalOpen(true)}
        />
        <RevenueCard
          title="Renda Variável"
          subtitle="Receitas Estruturadas"
          realized={kpis.rv.realized}
          target={kpis.rv.target}
          prevRealized={kpis.rv.prev}
          icon={TrendingUp}
          color="#8B5CF6"
          delay={0.16}
        />
        <RevenueCard
          title="Consórcios"
          subtitle="Comissões mensais"
          realized={kpis.cons.realized}
          target={kpis.cons.target}
          prevRealized={kpis.cons.prev}
          icon={Briefcase}
          color="#FAC017"
          delay={0.22}
        />
        <RevenueCard
          title="Seguros"
          subtitle="Comissões Mensais"
          realized={kpis.seg.realized}
          target={kpis.seg.target}
          prevRealized={kpis.seg.prev}
          icon={Shield}
          color="#10B981"
          delay={0.28}
        />
      </div>

      {/* ── EVOLUTION CHART ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      >
        <Card className="bg-gradient-to-b from-white/[0.06] to-transparent backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden hover:border-white/20 transition-all duration-300">
          <CardHeader className="pb-2 pt-5 px-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-[11px] font-data uppercase tracking-[0.2em] text-white/50">
                  Evolução da Performance · {selectedYear}
                </CardTitle>
                <p className="text-[10px] font-data text-white/30 mt-0.5 uppercase tracking-widest">
                  Receita realizada vs meta (RF + RV + Consórcios)
                </p>
              </div>
              {/* Legend */}
              <div className="flex items-center flex-wrap gap-4">
                {[
                  { label: "Renda Fixa", color: "#3B82F6" },
                  { label: "Renda Variável", color: "#8B5CF6" },
                  { label: "Consórcios", color: "#FAC017" },
                  { label: "Seguros", color: "#10B981" },
                  { label: "Meta Total", color: "#ffffff", dashed: true },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 rounded-full flex-shrink-0"
                      style={{
                        width: l.dashed ? 18 : 12,
                        background: l.dashed ? "transparent" : l.color,
                        border: l.dashed ? `2px dashed ${l.color}60` : "none",
                        opacity: l.dashed ? 0.7 : 1,
                      }}
                    />
                    <span className="text-[9px] font-data text-white/40 uppercase tracking-widest">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-2 pb-4 pt-2">
            <div className="w-full h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="monthName"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => {
                      const abs = Math.abs(v);
                      if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                      return String(v);
                    }}
                    tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "var(--font-data, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip content={<EvolutionTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

                  {/* Stacked bars */}
                  <Bar dataKey="rfRealized" name="Renda Fixa" stackId="a" fill="#3B82F6" fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="rvRealized" name="Renda Variável" stackId="a" fill="#8B5CF6" fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="consRealized" name="Consórcios" stackId="a" fill="#FAC017" fillOpacity={0.9} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="segRealized" name="Seguros" stackId="a" fill="#10B981" fillOpacity={0.9} radius={[4, 4, 0, 0]} />

                  {/* Meta total line */}
                  <Line
                    type="monotone"
                    dataKey="totalTarget"
                    name="Meta Total"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: "#fff", strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── MODAL RENDA FIXA DETALHADA ── */}
      <Dialog open={isRfModalOpen} onOpenChange={setIsRfModalOpen}>
        <DialogContent className="bg-[#0A0D14] border border-white/10 text-white max-w-2xl">
          <DialogHeader className="mb-4 text-left">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-500/30">
                <Landmark className="w-5 h-5 text-blue-400" />
              </span>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-wide">
                  Detalhamento de Renda Fixa
                </DialogTitle>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest mt-1">
                  Composição da performance vs meta do mês selecionado
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {kpis.rf.details.map((item, idx) => {
              const pct = item.target > 0 ? (item.realized / item.target) * 100 : 0;
              return (
                <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs font-data uppercase tracking-widest text-white/70" style={{ color: item.color }}>
                      {item.label}
                    </span>
                    <span className="text-sm font-display text-white">
                      {fmtCompact(item.realized)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-0.5">
                      <span className="text-[10px] font-data text-white uppercase tracking-widest">
                        Meta · {fmtCompact(item.target)}
                      </span>
                      <span className="text-xs font-data font-bold transition-colors" style={{ color: achievementColor(pct) }}>
                        {fmtPercent(pct)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: achievementColor(pct) }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
