import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Briefcase,
  Target,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  User,
  FileStack,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  PieChart,
  Pie,
} from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

// ==========================================================================
// Types & Props
// ==========================================================================

interface SegurosDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string;
  selectedAssessorId: string;
  teamPhotos?: Map<string, string>;
}

type ChartMetric = "vs_meta" | "receita_mensal" | "apolices_ativas" | "previsao_receita";

const CHART_METRICS: Record<ChartMetric, { label: string; icon: React.ReactNode; tooltip: string }> = {
  vs_meta: { label: "Receita vs Meta", icon: <TrendingUp className="w-3.5 h-3.5" />, tooltip: "Acompanhamento mensal vs Meta (ROA 0.07%)" },
  receita_mensal: { label: "Receita Mensal", icon: <DollarSign className="w-3.5 h-3.5" />, tooltip: "Soma da receita de seguros por mês" },
  apolices_ativas: { label: "Apólices Ativas", icon: <Target className="w-3.5 h-3.5" />, tooltip: "Quantidade de apólices ativas gerando receita" },
  previsao_receita: { label: "Previsão de Receita", icon: <Calendar className="w-3.5 h-3.5" />, tooltip: "Projeção total de recebíveis por mês (passado + futuro)" },
};

// ROA target for seguros
const ROA_SEGUROS = 0.0007; // 0.07% ao ano

// ==========================================================================
// Helpers
// ==========================================================================

/** Parse valor_mensal that comes as TEXT from Supabase (e.g. "1168,04" or "1168.04") */
const parseValor = (raw: any): number => {
  if (raw === null || raw === undefined || raw === "") return 0;
  const str = String(raw).replace(/\s/g, "");
  // Brazilian format: "1.168,04" -> replace thousands dot, then comma -> decimal
  const normalized = str.replace(/\.(\d{3})/g, "$1").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

const formatCurrency = (value: number, decimals = 0) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

const formatMetaLabel = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return "R$ " + (value / 1_000_000).toFixed(2).replace(".", ",") + "M";
  return "R$ " + (value / 1_000).toFixed(2).replace(".", ",") + "K";
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#11141D]/90 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
      <p className="text-white font-data text-xs uppercase tracking-widest mb-3 pb-2 border-b border-white/10">{label}</p>
      <div className="space-y-2">
        {payload.map((entry: any, index: number) => {
          let displayName = entry.name;
          if (entry.dataKey === "previsao" && entry.payload) {
            displayName = entry.payload.isFuture ? "Previsão (R$)" : "Realizado (R$)";
          }
          const isCount = entry.dataKey === "apolices";
          return (
            <div key={index} className="flex justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
                <span className="text-white/70 font-data text-[10px] uppercase">{displayName}</span>
              </div>
              <span className="text-white font-display text-sm">
                {isCount ? formatNumber(entry.value ?? 0) : formatCurrency(entry.value ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================================================
// KpiCard Component
// ==========================================================================

interface KpiCardProps {
  title: string;
  value: string | number;
  rawValue?: number;
  metaValue?: number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string; prefix?: string };
  delay?: number;
  ring?: { percent: number; color: string };
  tooltipInfo?: string;
  infoMessage?: string;
}

function KpiCard({ title, value, rawValue, metaValue, subtitle, icon: Icon, color, trend, delay = 0, ring, tooltipInfo, infoMessage }: KpiCardProps) {
  const isMeta = metaValue !== undefined && rawValue !== undefined;
  const achievement = isMeta && metaValue > 0 ? (rawValue / metaValue) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className="h-full">
      <Card className={cn("bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full", infoMessage ? "flex flex-col" : "")}>
        <div className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" style={{ background: color }} />
        <CardContent className="p-5 flex flex-col flex-1 pl-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-[10px] font-data uppercase tracking-widest text-white mb-1 flex items-center gap-1.5 flex-wrap">
                {title}
                {tooltipInfo && (
                  <TooltipProvider delayDuration={100}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-white/30 hover:text-white/70 transition-colors cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1A2030] border-euro-gold/20 text-white/90 font-data text-xs max-w-[220px]">{tooltipInfo}</TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-display text-white truncate">{value}</span>
              </div>
              {subtitle && <span className="text-[10px] font-data text-white/50 mt-1 block">{subtitle}</span>}
            </div>
            <div className="relative flex-shrink-0">
              {ring ? (
                <div className="w-12 h-12 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <motion.circle cx="24" cy="24" r="20" fill="none" stroke={ring.color} strokeWidth="4" strokeDasharray={2 * Math.PI * 20} initial={{ strokeDashoffset: 2 * Math.PI * 20 }} animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - Math.min(ring.percent, 100) / 100) }} transition={{ duration: 1.2, ease: "easeOut", delay: delay + 0.3 }} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              )}
            </div>
          </div>

          {isMeta && !infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-data text-white uppercase font-bold tracking-widest">META: {formatMetaLabel(metaValue)}</span>
                <span className={cn("text-[10px] font-data font-bold tracking-widest", achievement >= 100 ? "text-green-500" : achievement >= 70 ? "text-euro-gold" : "text-red-500")}>
                  {achievement.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(achievement, 100)}%` }} transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }} className={cn("h-full rounded-full", achievement >= 100 ? "bg-green-500" : achievement >= 70 ? "bg-euro-gold" : "bg-red-500")} />
              </div>
            </div>
          )}

          {!isMeta && trend && !infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-1.5">
              {trend.value > 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-green-400" /> : trend.value < 0 ? <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-white/30" />}
              <span className={cn("text-[10px] font-data font-bold", trend.value > 0 ? "text-green-400" : trend.value < 0 ? "text-red-400" : "text-white")}>
                {trend.value > 0 ? "+" : ""}{trend.prefix || ""}{formatNumber(Math.abs(trend.value))}
              </span>
              <span className="text-[10px] font-data text-white/50">{trend.label}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 text-white/50 mt-[1px]" />
              <span className="text-[10px] font-data text-white/50 block">{infoMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// Main Component
// ==========================================================================

export default function SegurosDash({ selectedMonth, selectedYear, selectedTeam, selectedAssessorId, teamPhotos }: SegurosDashProps) {
  const [chartMetric, setChartMetric] = React.useState<ChartMetric>("vs_meta");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" }>({ key: "receita_num", direction: "desc" });

  const selectedMonthKey = selectedMonth
    ? selectedMonth.substring(0, 7)
    : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // ──────────────────────────────────────────────────────────────────────────
  // Query 1 — Active assessors + custody (for meta calculation & filtering)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: activeAssessorsData } = useQuery({
    queryKey: ["active-assessors-info-seguros"],
    queryFn: async () => {
      const { data: latestDateData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate = (latestDateData as any)?.data_posicao;
      if (!latestDate) return new Map();

      const { data } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, custodia_net, foto_url")
        .eq("data_posicao", latestDate);

      const infoMap = new Map();
      data?.forEach((a: any) => {
        if (a.cod_assessor) infoMap.set(a.cod_assessor.toUpperCase(), a);
      });
      return infoMap;
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Query 2 — mv_resumo_assessor full year (for custody-based meta per month)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: mvDataAno } = useQuery({
    queryKey: ["mv-resumo-assessor-ano-seguros", selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, cod_assessor, time, custodia_net")
        .gte("data_posicao", `${selectedYear}-01-01`)
        .lte("data_posicao", `${selectedYear}-12-31`);
      return (data as any[]) || [];
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Query 3 — vw_seguros_extrato for selected month
  // ──────────────────────────────────────────────────────────────────────────
  const { data: segurosDataMes, isLoading: isLoadingMes } = useQuery({
    queryKey: ["seguros-extrato-mes", selectedMonthKey],
    queryFn: async () => {
      if (!selectedMonthKey) return [];
      const [year, month] = selectedMonthKey.split("-").map(Number);
      const startDate = `${selectedMonthKey}-01`;
      const endDt = new Date(year, month, 0);
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDt.getDate()).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("vw_seguros_extrato" as any)
        .select("proposta, assessor, valor_mensal, seguradora, cliente, data_vencimento")
        .gte("data_vencimento", startDate)
        .lte("data_vencimento", endDate);

      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Query 4 — vw_seguros_extrato for the full year (chart)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: segurosDataAno, isLoading: isLoadingAno } = useQuery({
    queryKey: ["seguros-extrato-ano", selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("vw_seguros_extrato" as any)
        .select("proposta, assessor, valor_mensal, seguradora, cliente, data_vencimento")
        .gte("data_vencimento", `${selectedYear}-01-01`)
        .lte("data_vencimento", `${selectedYear}-12-31`);
      return (data as any[]) || [];
    },
  });

  const isLoading = isLoadingMes || isLoadingAno;

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: normalize assessor code
  // ──────────────────────────────────────────────────────────────────────────
  const normalizeAssessor = (raw: string) => {
    const s = (raw || "").trim().toUpperCase();
    return s.startsWith("A") ? s : `A${s}`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Filter helpers: apply team + assessor filters
  // ──────────────────────────────────────────────────────────────────────────
  const filterRow = (row: any) => {
    const cod = normalizeAssessor(row.assessor || "");
    // If assessor map not loaded yet, allow all rows through (avoid blank state)
    if (activeAssessorsData && activeAssessorsData.size > 0) {
      const info = activeAssessorsData.get(cod);
      if (!info) return false;
      if (selectedTeam !== "all" && info.time !== selectedTeam) return false;
    }
    if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return false;
    return true;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Metrics
  // ──────────────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!segurosDataMes || !activeAssessorsData) {
      return { receitaMes: 0, metaMes: 0, apolicesMes: 0, receitaAno: 0, apolicesAno: 0, clientesAno: 0, ticketMedio: 0 };
    }

    // Total custody for meta
    let totalCustody = 0;
    activeAssessorsData.forEach((info: any, cod: string) => {
      if (selectedTeam !== "all" && info.time !== selectedTeam) return;
      if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return;
      if (info?.custodia_net) totalCustody += Number(info.custodia_net);
    });

    const filteredMes = (segurosDataMes || []).filter(filterRow);
    const receitaMes = filteredMes.reduce((acc: number, r: any) => acc + parseValor(r.valor_mensal), 0);
    const apolicesMes = filteredMes.length;
    const metaMes = (totalCustody * ROA_SEGUROS) / 12;

    const filteredAno = (segurosDataAno || []).filter(filterRow);
    const receitaAno = filteredAno.reduce((acc: number, r: any) => acc + parseValor(r.valor_mensal), 0);

    const uniqueClients = new Set(filteredAno.map((r: any) => r.cliente || r.proposta));
    const clientesAno = uniqueClients.size;
    const apolicesAno = filteredAno.length;
    const ticketMedio = apolicesAno > 0 ? receitaAno / apolicesAno : 0;

    return { receitaMes, metaMes, apolicesMes, receitaAno, apolicesAno, clientesAno, ticketMedio };
  }, [segurosDataMes, segurosDataAno, activeAssessorsData, selectedTeam, selectedAssessorId, selectedMonthKey]);

  // ──────────────────────────────────────────────────────────────────────────
  // Chart data
  // ──────────────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!segurosDataAno || !mvDataAno) return [];

    const buckets: Record<string, { realized: number; custody: number; apolices: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
      buckets[key] = { realized: 0, custody: 0, apolices: 0 };
    }

    // Custody per month
    const custodyMap: Record<string, number> = {};
    mvDataAno.forEach((mv: any) => {
      const cod = (mv.cod_assessor || "").trim().toUpperCase();
      if (selectedTeam !== "all" && mv.time !== selectedTeam) return;
      if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return;
      const mk = mv.data_posicao?.substring(0, 7);
      if (mk && mk.startsWith(selectedYear)) {
        if (!custodyMap[mk]) custodyMap[mk] = 0;
        custodyMap[mk] += Number(mv.custodia_net) || 0;
      }
    });
    for (const mk of Object.keys(buckets)) {
      buckets[mk].custody = custodyMap[mk] || 0;
    }

    // Seguros realized
    segurosDataAno.forEach((r: any) => {
      if (!filterRow(r)) return;
      const mk = r.data_vencimento?.substring(0, 7);
      if (mk && buckets[mk]) {
        buckets[mk].realized += parseValor(r.valor_mensal);
        buckets[mk].apolices += 1;
      }
    });

    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, vals]) => {
        const [y, m] = mk.split("-").map(Number);
        const isFuture = y > currYear || (y === currYear && m > currMonth);
        const target = (vals.custody * ROA_SEGUROS) / 12;
        const hasData = target > 0 && !isFuture;
        return {
          monthKey: mk,
          monthName: format(parseISO(`${mk}-01`), "MMM", { locale: ptBR }),
          realized: isFuture ? null : vals.realized,
          target: hasData ? target : null,
          // Previsão always shows realized sum (past AND future months)
          previsao: vals.realized,
          apolices: isFuture ? null : vals.apolices,
          isFuture,
        };
      });
  }, [segurosDataAno, mvDataAno, selectedYear, selectedTeam, selectedAssessorId]);

  // Derived filtered data — hide future months unless viewing previsão
  const displayChartData = useMemo(() => {
    return chartData.filter(d => {
      if (d.isFuture && chartMetric !== "previsao_receita") return false;
      return true;
    });
  }, [chartData, chartMetric]);

  // ──────────────────────────────────────────────────────────────────────────
  // Donut data — by seguradora
  // ──────────────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    if (!segurosDataMes) return [];
    const grouped: Record<string, number> = {};
    segurosDataMes.filter(filterRow).forEach((r: any) => {
      const seg = r.seguradora || "NÃO INFORMADA";
      if (!grouped[seg]) grouped[seg] = 0;
      grouped[seg] += parseValor(r.valor_mensal);
    });
    const colors = ["#FAC017", "#0066FF", "#8B5CF6", "#10B981", "#F43F5E", "#F97316", "#A855F7", "#3B82F6", "#22C55E"];
    const total = Object.values(grouped).reduce((a, b) => a + b, 0);
    return Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({
        name,
        value,
        percent: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
        color: colors[i % colors.length],
      }));
  }, [segurosDataMes, activeAssessorsData, selectedTeam, selectedAssessorId]);

  // ──────────────────────────────────────────────────────────────────────────
  // Advisor performance table
  // ──────────────────────────────────────────────────────────────────────────
  const tableData = useMemo(() => {
    if (!activeAssessorsData || !segurosDataMes) return [];
    const rows: any[] = [];
    activeAssessorsData.forEach((info: any, cod: string) => {
      if (selectedTeam !== "all" && info.time !== selectedTeam) return;
      if (selectedAssessorId !== "all" && cod !== selectedAssessorId.toUpperCase()) return;
      const myRows = segurosDataMes.filter((r: any) => normalizeAssessor(r.assessor) === cod);
      const receita = myRows.reduce((acc: number, r: any) => acc + parseValor(r.valor_mensal), 0);
      const meta = ((Number(info.custodia_net) || 0) * ROA_SEGUROS) / 12;
      if (receita > 0 || meta > 0) {
        rows.push({ cod_assessor: cod, nome: info.nome_assessor, foto_url: info.foto_url, meta, receita, atingimento: meta > 0 ? (receita / meta) * 100 : 0 });
      }
    });
    return rows.sort((a, b) => b.receita - a.receita);
  }, [activeAssessorsData, segurosDataMes, selectedTeam, selectedAssessorId]);

  // ──────────────────────────────────────────────────────────────────────────
  // Detail table
  // ──────────────────────────────────────────────────────────────────────────
  const handleSort = (key: string) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc" });
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-euro-gold ml-auto" /> : <ArrowDown className="w-3 h-3 text-euro-gold ml-auto" />;
  };

  const detailTableData = useMemo(() => {
    if (!segurosDataMes || !activeAssessorsData) return [];
    return segurosDataMes
      .filter(filterRow)
      .map((r: any) => {
        const cod = normalizeAssessor(r.assessor);
        const info = activeAssessorsData.get(cod) || {};
        return {
          ...r,
          cod_assessor: cod,
          nome_assessor: info.nome_assessor || cod,
          time: info.time || "",
          foto_url: info.foto_url || null,
          receita_num: parseValor(r.valor_mensal),
        };
      })
      .filter((r: any) => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(t) ||
          (r.assessor || "").toLowerCase().includes(t) ||
          (r.seguradora || "").toLowerCase().includes(t) ||
          (r.cliente || "").toLowerCase().includes(t) ||
          (r.proposta || "").toLowerCase().includes(t)
        );
      })
      .sort((a: any, b: any) => {
        const { key, direction } = sortConfig;
        let aV = a[key] ?? "";
        let bV = b[key] ?? "";
        if (typeof aV === "string") return direction === "asc" ? aV.localeCompare(bV) : bV.localeCompare(aV);
        return direction === "asc" ? (aV > bV ? 1 : -1) : bV > aV ? 1 : -1;
      });
  }, [segurosDataMes, activeAssessorsData, selectedTeam, selectedAssessorId, searchTerm, sortConfig]);

  const totalReceita = detailTableData.reduce((acc: number, r: any) => acc + r.receita_num, 0);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display text-white tracking-wide flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
              <Shield className="w-6 h-6 text-euro-gold" />
            </span>
            Seguros
          </h2>
          <p className="text-white/40 font-data tracking-widest uppercase text-xs mt-2 ml-15">Receita e Apólices Consolidadas</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-white/30 font-data uppercase tracking-widest text-xs">
          Carregando dados de seguros...
        </div>
      ) : (
        <>
          {/* VISÃO DO MÊS */}
          <div className="space-y-4">
            <h3 className="text-sm font-data text-euro-gold uppercase tracking-[0.2em] opacity-80 pl-2">
              Visão Mensal ({format(parseISO(`${selectedMonthKey}-01`), "MMM/yyyy", { locale: ptBR })})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                title="Receita do Mês"
                value={formatCurrency(metrics.receitaMes)}
                rawValue={metrics.receitaMes}
                metaValue={metrics.metaMes}
                subtitle="Soma de valor_mensal no mês"
                icon={TrendingUp}
                color="#0066FF"
                delay={0}
              />
              <KpiCard
                title="Apólices Ativas"
                value={formatNumber(metrics.apolicesMes)}
                subtitle="Registros com vencimento no mês"
                icon={FileText}
                color="#FAC017"
                delay={0.1}
              />
              <KpiCard
                title="Seguradoras"
                value={formatNumber(donutData.length)}
                subtitle="Seguradoras com receita no mês"
                icon={Shield}
                color="#10B981"
                delay={0.2}
              />
            </div>
          </div>

          <div className="w-full h-px bg-white/5 my-8" />

          {/* VISÃO DO ANO */}
          <div className="space-y-4">
            <h3 className="text-sm font-data text-euro-gold uppercase tracking-[0.2em] opacity-80 pl-2">
              Visão Anual ({selectedYear})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Receita Total (Ano)" value={formatCurrency(metrics.receitaAno)} subtitle="Soma anual de seguros" icon={DollarSign} color="#FAC017" delay={0.3} />
              <KpiCard title="Total Apólices Ativas" value={formatNumber(metrics.apolicesAno)} subtitle="Registros no ano" icon={Target} color="#8B5CF6" delay={0.4} />
              <KpiCard title="Clientes Únicos" value={formatNumber(metrics.clientesAno)} subtitle="CPFs/CNPJs distintos" icon={Users} color="#A0A090" delay={0.5} />
              <KpiCard title="Ticket Médio / Apólice" value={formatCurrency(metrics.ticketMedio, 2)} subtitle="Receita média por apólice/mês" icon={Briefcase} color="#14B8A6" delay={0.6} />
            </div>
          </div>

          {/* CHART */}
          <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 hidden sm:block">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                <h3 className="text-lg font-display text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-euro-gold" />
                  Seguros — Evolução {selectedYear}
                </h3>
                <p className="text-[11px] text-white/70 font-data mt-1 uppercase tracking-widest">{CHART_METRICS[chartMetric].tooltip}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-euro-elevated border-white/10 text-[#E8E8E0] font-data text-xs h-10 gap-3 min-w-[220px] justify-between hover:bg-white/10 hover:text-white hover:border-white/20">
                    <div className="flex items-center gap-2">
                      <span className="text-euro-gold">{CHART_METRICS[chartMetric].icon}</span>
                      {CHART_METRICS[chartMetric].label}
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0] w-[260px]">
                  {(Object.keys(CHART_METRICS) as ChartMetric[]).map((key) => (
                    <DropdownMenuItem key={key} onClick={() => setChartMetric(key)} className={cn("gap-2 cursor-pointer text-xs hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white", chartMetric === key && "bg-white/10 text-euro-gold")}>
                      <span className="text-euro-gold/80">{CHART_METRICS[key].icon}</span>
                      {CHART_METRICS[key].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={displayChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="segBarBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0066FF" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#0066FF" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="segBarGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="segBarPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    tickFormatter={(v) => chartMetric === "apolices_ativas" ? String(v) : (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}k`)}
                  />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CustomTooltip />} />

                  {chartMetric === "vs_meta" && (
                    <>
                      <Bar dataKey="realized" name="Realizado" radius={[4, 4, 0, 0]} barSize={40}>
                        {displayChartData.map((entry, index) => {
                          const pct = entry.target && entry.realized ? (entry.realized / entry.target) * 100 : 0;
                          const fill = pct >= 100 ? "url(#segBarGreen)" : "url(#segBarBlue)";
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                      <Line type="monotone" dataKey="target" name="Meta (ROA)" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2} dot={{ r: 4, fill: "#1A2030", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#FAC017", stroke: "#fff" }} />
                    </>
                  )}

                  {chartMetric === "receita_mensal" && (
                    <Bar dataKey="realized" name="Receita Mensal" radius={[4, 4, 0, 0]} barSize={40} fill="url(#segBarBlue)" />
                  )}

                  {chartMetric === "apolices_ativas" && (
                    <Bar dataKey="apolices" name="Qtd. Apólices" radius={[4, 4, 0, 0]} barSize={40} fill="url(#segBarPurple)" />
                  )}

                  {chartMetric === "previsao_receita" && (
                    <Bar dataKey="previsao" name="Previsão (R$)" radius={[4, 4, 0, 0]} barSize={40}>
                      {displayChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isFuture ? "rgba(255,255,255,0.15)" : "url(#segBarBlue)"}
                        />
                      ))}
                    </Bar>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {/* DONUT + ADVISOR TABLE */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mt-6">
          {/* Donut: por seguradora */}
          <Card className="lg:col-span-3 bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 flex flex-col hover:border-euro-gold/30 transition-all h-[420px]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-euro-gold/10 flex items-center justify-center border border-euro-gold/20">
                <Shield className="w-4 h-4 text-euro-gold" />
              </div>
              <div>
                <h3 className="text-[13px] font-data text-white uppercase tracking-widest font-bold">Seguradoras</h3>
                <p className="text-[11px] text-white/70 font-medium uppercase tracking-tighter">Receita por Seguradora</p>
              </div>
            </div>
            <div className="h-[220px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none" isAnimationActive style={{ outline: "none" }}>
                    {donutData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" style={{ outline: "none" }} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-white leading-none">{donutData.length}</span>
                <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Seguradoras</span>
              </div>
            </div>
            <div className="mt-4 flex-1 space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {donutData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-data">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-white/60 truncate max-w-[100px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-white font-bold">{formatCurrency(item.value)}</span>
                    <span className="text-[10px] text-white/50">({item.percent}%)</span>
                  </div>
                </div>
              ))}
              {donutData.length === 0 && (
                <div className="text-center text-xs font-data uppercase tracking-widest text-white/30 py-4">Sem dados para exibição</div>
              )}
            </div>
          </Card>

          {/* Advisor performance table */}
          <Card className="lg:col-span-7 bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 flex flex-col hover:border-euro-gold/30 transition-all h-[420px]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-[13px] font-data text-white uppercase tracking-widest font-bold">Performance de Assessores</h3>
                <p className="text-[11px] text-white/70 font-medium uppercase tracking-tighter">Ranking do Mês Selecionado</p>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-0 whitespace-nowrap min-w-[500px]">
                <thead className="bg-[#1A2030]/60 text-euro-gold text-[10px] font-data uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="py-4 px-4 font-bold border-r border-b border-white/10">Assessor</th>
                    <th className="py-4 px-4 font-bold border-r border-b border-white/10 text-right w-[140px]">Meta do Mês</th>
                    <th className="py-4 px-4 font-bold border-r border-b border-white/10 text-right w-[140px]">Receita</th>
                    <th className="py-4 px-4 font-bold text-center border-b border-white/10 w-[120px]">% da Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {tableData.map((row, i) => (
                    <tr key={i} className="group even:bg-white/[0.02] hover:bg-white/5 transition-all text-[12.6px] font-data">
                      <td className="py-3 px-4 border-r border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-euro-inset flex-shrink-0 flex items-center justify-center text-xs font-bold text-euro-gold/40">
                            {row.foto_url ? <img src={row.foto_url} alt={row.nome} className="w-full h-full object-cover" /> : <User className="w-4 h-4 opacity-20" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">{row.nome}</span>
                            <span className="text-[12.6px] text-white/60 font-mono">{row.cod_assessor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 border-r border-white/10 text-right text-white/70">{formatCurrency(row.meta)}</td>
                      <td className="py-3 px-4 border-r border-white/10 text-right text-white font-bold">{formatCurrency(row.receita)}</td>
                      <td className="py-3 px-4 text-right flex justify-end">
                        <div className={cn("px-2 py-1 rounded-md text-xs font-bold text-center w-20", row.atingimento >= 100 ? "bg-[#22C55E]/10 text-[#22C55E]" : row.atingimento >= 70 ? "bg-[#FAC017]/10 text-[#FAC017]" : "bg-[#EF4444]/10 text-[#EF4444]")}>
                          {row.atingimento.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tableData.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center opacity-30 text-xs font-data uppercase tracking-widest text-white">Nenhum desempenho registrado no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* DETAIL TABLE */}
      {!isLoading && (
        <div className="space-y-6 mt-10">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
            <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
              <FileStack className="w-5 h-5" />
              Detalhamento de Seguros ({format(parseISO(`${selectedMonthKey}-01`), "MMMM yyyy", { locale: ptBR })})
            </h3>
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
              <Input type="text" placeholder="Buscar por assessor, seguradora, cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10" />
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />
            <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                    <th onClick={() => handleSort("time")} className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                    </th>
                    <th onClick={() => handleSort("nome_assessor")} className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[200px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                    </th>
                    <th onClick={() => handleSort("seguradora")} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Seguradora <SortIcon column="seguradora" /></div>
                    </th>
                    <th onClick={() => handleSort("cliente")} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Cliente <SortIcon column="cliente" /></div>
                    </th>
                    <th onClick={() => handleSort("proposta")} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Proposta <SortIcon column="proposta" /></div>
                    </th>
                    <th onClick={() => handleSort("data_vencimento")} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Vencimento <SortIcon column="data_vencimento" /></div>
                    </th>
                    <th onClick={() => handleSort("receita_num")} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2 justify-end">Receita Mensal <SortIcon column="receita_num" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {detailTableData.map((item: any, i: number) => (
                    <tr key={i} className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data">
                      {/* Time */}
                      <td className="py-3 px-4 border-r border-white/5 sticky left-0 z-20 bg-[#171B26] group-hover:bg-[#1E2331] w-[80px] min-w-[80px] max-w-[80px]">
                        <div className="flex items-center justify-center">
                          {teamPhotos && teamPhotos.has(item.time?.toUpperCase?.()) ? (
                            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                              <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                              {(item.time || "-").substring(0, 3).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Assessor */}
                      <td className="py-3 px-4 border-r border-white/5 sticky left-[80px] z-20 bg-[#171B26] group-hover:bg-[#1E2331]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-euro-inset flex items-center justify-center border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors">
                            {item.foto_url ? <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" /> : <User className="w-5 h-5 opacity-20" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">{item.nome_assessor}</span>
                            <span className="text-[10.5px] text-white/60 font-mono tracking-widest">{item.cod_assessor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-white border-r border-white/5 uppercase">{item.seguradora || "—"}</td>
                      <td className="py-3 px-4 text-white border-r border-white/5 uppercase max-w-[200px] truncate">{item.cliente || "—"}</td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5 font-mono">{item.proposta || "—"}</td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5">
                        {item.data_vencimento ? format(parseISO(item.data_vencimento), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-euro-gold font-bold">{formatCurrency(item.receita_num)}</td>
                    </tr>
                  ))}
                  {detailTableData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-20 text-center opacity-20">
                        <div className="flex flex-col items-center gap-4">
                          <Search className="w-10 h-10" />
                          <p className="text-sm font-data uppercase tracking-widest">Nenhum seguro encontrado no período</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-30">
                  <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                    <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                    <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10" />
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5" />
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5" />
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                      <span className="text-white/50">{detailTableData.length} registros</span>
                    </td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5" />
                    <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrency(totalReceita)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
