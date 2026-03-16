import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  CalendarClock,
  CalendarX2,
  UserX,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  User,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
  Legend,
  LabelList,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  subWeeks,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  addWeeks,
  addDays,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ==========================================================================
// Types
// ==========================================================================

interface DadosRvExecutada {
  codigo_cliente: string | null;
  nome_cliente: string | null;
  operacao: string | null;
  data_inclusao: string | null;
  ativo: string | null;
  quantidade: string | null;
  estrutura: string | null;
  fixing: string | null;
  preco_de_compra_da_acao: string | null;
  comissao: string | null;
  assessor_do_cliente: string | null;
  canal_origem: string | null;
  envio_ordem: string | null;
}

interface RendaVariavelDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string;
  selectedAssessorId: string;
  teamPhotos?: Map<string, string>;
}

// ==========================================================================
// Helpers
// ==========================================================================

const formatCurrency = (value: number, decimals: number = 0) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const formatNumber = (value: number) =>
  value.toLocaleString("pt-BR");

const formatPercent = (value: number) =>
  `${value.toFixed(1)}%`;

// ==========================================================================
// Sub-components
// ==========================================================================

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
  delay?: number;
  ring?: { percent: number; color: string };
  action?: { label: string; onClick: () => void };
  tooltipInfo?: string;
  infoMessage?: string;
}

function KpiCard({ title, value, subtitle, icon: Icon, color, trend, delay = 0, ring, action, tooltipInfo, infoMessage }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card className={cn(
        "bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full",
        infoMessage ? "flex flex-col" : ""
      )}>
        <div className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" style={{ background: color }} />
        <CardContent className="p-5 flex flex-col flex-1 pl-6">
          {/* Header */}
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
                <span className="text-[10px] font-data text-white mt-1 block">{subtitle}</span>
              )}
            </div>
            <div className="relative flex-shrink-0">
              {ring ? (
                <div className="w-12 h-12 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <motion.circle
                      cx="24" cy="24" r="20"
                      fill="none"
                      stroke={ring.color}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 20}
                      initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - Math.min(ring.percent, 100) / 100) }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: delay + 0.3 }}
                      strokeLinecap="round"
                    />
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

          {/* Trend & Action */}
          {(trend || action) && !infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
              {trend ? (
                <div className="flex items-center gap-1.5">
                  {trend.value > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
                  ) : trend.value < 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-white/30" />
                  )}
                  <span className={cn(
                    "text-[10px] font-data font-bold",
                    trend.value > 0 ? "text-green-400" : trend.value < 0 ? "text-red-400" : "text-white"
                  )}>
                    {trend.value > 0 ? "+" : ""}{formatNumber(trend.value)}
                  </span>
                  <span className="text-[10px] font-data text-white">
                    {trend.label}
                  </span>
                </div>
              ) : <div />}
              
              {action && (
                <button 
                  onClick={action.onClick}
                  className="group/btn flex items-center gap-1 h-6 px-3 rounded-md bg-white/5 hover:bg-euro-gold/20 text-[10px] font-data text-white hover:text-euro-gold transition-colors ml-auto border border-white/10 hover:border-euro-gold/30"
                >
                  {action.label}
                </button>
              )}
            </div>
          )}

          {/* Info Message (Alternative Bottom space) */}
          {infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 text-white mt-[1px]" />
              <span className="text-[10px] font-data text-white block">
                {infoMessage}
              </span>
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

export default function RendaVariavelDash({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
  teamPhotos,
}: RendaVariavelDashProps) {
  const isMobile = useIsMobile();

  // ── Table state ──
  const [rvSortConfig, setRvSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'data_inclusao', direction: 'desc' });
  const [rvPage, setRvPage] = useState(1);
  const rvItemsPerPage = 10;

  const handleRvSort = (key: string) => {
    setRvSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    setRvPage(1);
  };

  const [selectedBucket, setSelectedBucket] = useState<{
    name: string;
    range: { start: Date; end: Date };
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEngagedModalOpen, setIsEngagedModalOpen] = useState(false);
  
  const [modalSortConfig, setModalSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'fixing',
    direction: 'desc'
  });

  const handleModalSort = (key: string) => {
    setModalSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const RvSortIcon = ({ column }: { column: string }) => {
    if (rvSortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return rvSortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };
  const SortIconModal = ({ column }: { column: string }) => {
    if (modalSortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-1 inline-block" />;
    return modalSortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-1 inline-block" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-1 inline-block" />;
  };

  // ────────────────────────────────────────────────────────────────────────
  // Query 1 — dados_rv_executadas (nova tabela)
  // ────────────────────────────────────────────────────────────────────────
  const { data: rvData, isLoading: isRvLoading } = useQuery({
    queryKey: ["rv-executadas", selectedYear],
    queryFn: async () => {
      const prevYear = parseInt(selectedYear) - 1;
      const startDate = `${prevYear}-12-01`;
      const endDate = `${selectedYear}-12-31`;

      let query = supabase
        .from("dados_rv_executadas" as any)
        .select("*")
        .gte("data_inclusao", startDate)
        .lte("data_inclusao", endDate);

      if (selectedAssessorId !== "all") {
        query = query.eq("assessor_do_cliente", selectedAssessorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as DadosRvExecutada[]);
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query 2 — mv_resumo_assessor (receitas estruturadas + yearly)
  // ────────────────────────────────────────────────────────────────────────
  const { data: mvData, isLoading: isMvLoading } = useQuery({
    queryKey: ["rv-mv-data", selectedYear, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      const prevYear = parseInt(selectedYear) - 1;
      const startDate = `${prevYear}-12-01`;
      const endDate = `${selectedYear}-12-31`;

      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, cod_assessor, nome_assessor, time, receitas_estruturadas, custodia_net, foto_url, lider")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);

      if (selectedTeam !== "all") {
        query = query.eq("time", selectedTeam);
      } else {
        query = query.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        query = query.eq("cod_assessor", selectedAssessorId);
      }

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query 3 — vw_resumo_clientes_posicao (oportunidades PosicaoBlack)
  // ────────────────────────────────────────────────────────────────────────
    const { data: oppsData, isLoading: isOppsLoading } = useQuery({
    queryKey: ["rv-oportunidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_resumo_clientes_posicao" as any)
        .select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  // Active assessors for filtering oportunidades
  const { data: activeAssessors } = useQuery({
    queryKey: ["rv-active-assessors"],
    queryFn: async () => {
      const { data: latestDateData } = await (supabase
        .from("mv_resumo_assessor" as any) as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate = (latestDateData as any)?.data_posicao;
      if (!latestDate) return new Set<string>();

      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, time")
        .eq("data_posicao", latestDate);

      const { data } = await query;
      const codes = new Set<string>();
      data?.forEach((a: any) => {
        if (a.cod_assessor && activeTeamNames.has(a.time)) codes.add(a.cod_assessor);
      });
      return codes;
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query 4 — dados_rv_executadas by fixing date (for vencimento card)
  // ────────────────────────────────────────────────────────────────────────
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const previousWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const previousWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  const { data: rvFixingData } = useQuery({
    queryKey: ["rv-fixing-data", format(subWeeks(today, 4), "yyyy-MM-dd"), format(addWeeks(today, 4), "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dados_rv_executadas" as any)
        .select("*")
        .gte("fixing", format(subWeeks(today, 4), "yyyy-MM-dd"))
        .lte("fixing", format(addWeeks(today, 4), "yyyy-MM-dd"));
      if (error) throw error;
      return (data as unknown as DadosRvExecutada[]);
    },
  });

  const selectedMonthKey = selectedMonth ? selectedMonth.substring(0, 7) : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const kpis = useMemo(() => {
    // 1) Receitas Estruturadas (from mv)
    const currentMonthMv = (mvData || []).filter(
      (d) => d.data_posicao && d.data_posicao.substring(0, 7) === selectedMonthKey
    );
    const receitaEstruturas = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receitas_estruturadas || 0), 0
    );
    const custodiaTotal = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.custodia_net || 0), 0
    );
    const receitaTarget = (custodiaTotal * 0.0035) / 12; // ROA alvo de estruturadas = 0.35%
    const receitaAchievement = receitaTarget > 0 ? (receitaEstruturas / receitaTarget) * 100 : 0;
    const roaAtual = custodiaTotal > 0 ? ((receitaEstruturas * 12) / custodiaTotal) * 100 : 0;

    // Previous month receita for trend
    const prevMonthKey = selectedMonthKey
      ? (() => {
          const [y, m] = selectedMonthKey.split("-").map(Number);
          const prevDate = new Date(y, m - 2, 1);
          return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
        })()
      : "";
    const prevMonthMv = (mvData || []).filter(
      (d) => d.data_posicao && d.data_posicao.substring(0, 7) === prevMonthKey
    );
    const receitaPrevMonth = prevMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receitas_estruturadas || 0), 0
    );

    // 2) Assessores engajados
    const uniqueAssessorsCurrent = new Map<string, { cod_assessor: string; nome: string; time: string; url: string | null; engaged: boolean; receitas: number }>();
    currentMonthMv.forEach((d) => {
      if (d.cod_assessor) {
        const existing = uniqueAssessorsCurrent.get(d.cod_assessor);
        const hasReceita = (d.receitas_estruturadas || 0) > 0;
        if (existing) {
           existing.engaged = existing.engaged || hasReceita;
           existing.receitas += (d.receitas_estruturadas || 0);
           uniqueAssessorsCurrent.set(d.cod_assessor, existing);
        } else {
           uniqueAssessorsCurrent.set(d.cod_assessor, {
             cod_assessor: d.cod_assessor,
             nome: d.nome_assessor || d.cod_assessor,
             time: d.time || "Desconhecido",
             url: d.foto_url || null,
             engaged: hasReceita,
             receitas: d.receitas_estruturadas || 0
           });
        }
      }
    });
    
    const assessorEngagementList = Array.from(uniqueAssessorsCurrent.values());
    const totalAssessors = assessorEngagementList.length;
    const engagedAssessors = assessorEngagementList.filter(a => a.engaged).length;
    const engagementPercent = totalAssessors > 0 ? (engagedAssessors / totalAssessors) * 100 : 0;

    // 3) Total de Boletas no mês (from dados_rv_executadas)
    const rvFiltered = (rvData || []).filter((d) => {
      if (!d.data_inclusao) return false;
      const monthKey = d.data_inclusao.substring(0, 7);
      const matchMonth = monthKey === selectedMonthKey;
      if (!matchMonth) return false;
      // Filter by team — we need to check the assessor's team
      if (selectedTeam !== "all") {
        const assessorMv = currentMonthMv.find((m) => m.cod_assessor === d.assessor_do_cliente);
        if (!assessorMv || assessorMv.time !== selectedTeam) return false;
      }
      return true;
    });
    const totalBoletas = rvFiltered.length;

    // Previous month boletas for trend
    const rvPrevFiltered = (rvData || []).filter((d) => {
      if (!d.data_inclusao) return false;
      return d.data_inclusao.substring(0, 7) === prevMonthKey;
    });
    const totalBoletasPrev = rvPrevFiltered.length;

    // 4) Clientes sem engajamento (from oportunidades PosicaoBlack)
    let clientesSemEngajamento = 0;
    if (oppsData && activeAssessors) {
      const filteredOpps = oppsData.filter((op: any) => {
        if (!activeAssessors.has(op.cod_assessor)) return false;
        if (selectedTeam !== "all") {
          const assessorMv = currentMonthMv.find((m) => m.cod_assessor === op.cod_assessor);
          if (!assessorMv || assessorMv.time !== selectedTeam) return false;
        }
        if (selectedAssessorId !== "all" && op.cod_assessor !== selectedAssessorId) return false;
        return op.validado === "SIM";
      });
      clientesSemEngajamento = filteredOpps.length;
    }

    // 5) Boletas à vencer (semana atual) — fixing in current week
    const boletasVencerSemana = (rvFixingData || []).filter((d) => {
      if (!d.fixing) return false;
      try {
        const fixingDate = parseISO(d.fixing);
        const inWeek = isWithinInterval(fixingDate, { start: currentWeekStart, end: currentWeekEnd });
        if (!inWeek) return false;
        if (selectedAssessorId !== "all" && d.assessor_do_cliente !== selectedAssessorId) return false;
        if (selectedTeam !== "all") {
          const assessorMv = (mvData || []).find((m: any) => m.cod_assessor === d.assessor_do_cliente);
          if (!assessorMv || assessorMv.time !== selectedTeam) return false;
        }
        return true;
      } catch { return false; }
    });

    // 6) Boletas vencidas (semana anterior)
    const boletasVencidasSemana = (rvFixingData || []).filter((d) => {
      if (!d.fixing) return false;
      try {
        const fixingDate = parseISO(d.fixing);
        const inWeek = isWithinInterval(fixingDate, { start: previousWeekStart, end: previousWeekEnd });
        if (!inWeek) return false;
        if (selectedAssessorId !== "all" && d.assessor_do_cliente !== selectedAssessorId) return false;
        if (selectedTeam !== "all") {
          const assessorMv = (mvData || []).find((m: any) => m.cod_assessor === d.assessor_do_cliente);
          if (!assessorMv || assessorMv.time !== selectedTeam) return false;
        }
        return true;
      } catch { return false; }
    });

    return {
      receitaEstruturas,
      receitaTarget,
      receitaAchievement,
      roaAtual,
      receitaTrend: receitaEstruturas - receitaPrevMonth,
      engagedAssessors,
      totalAssessors,
      engagementPercent,
      totalBoletas,
      boletasTrend: totalBoletas - totalBoletasPrev,
      clientesSemEngajamento,
      boletasVencerSemana,
      boletasVencidasSemana,
      assessorEngagementList, // new detailed list exported here
    };
  }, [rvData, rvFixingData, mvData, oppsData, activeAssessors, selectedMonthKey, selectedTeam, selectedAssessorId]);

  // ────────────────────────────────────────────────────────────────────────
  // Chart data — Receitas Estruturadas ao longo do tempo
  // ────────────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!mvData || mvData.length === 0) return [];

    const grouped = mvData.reduce((acc: Record<string, { realized: number; custody: number }>, curr: any) => {
      const monthKey = curr.data_posicao?.substring(0, 7);
      if (!monthKey) return acc;
      // Only include months from the selected year in the chart
      if (!monthKey.startsWith(selectedYear)) return acc;
      if (!acc[monthKey]) acc[monthKey] = { realized: 0, custody: 0 };
      acc[monthKey].realized += curr.receitas_estruturadas || 0;
      acc[monthKey].custody += curr.custodia_net || 0;
      return acc;
    }, {});

    const ROA_TARGET = 0.0035; // ROA alvo de estruturadas = 0.35%

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, vals]) => {
        const d = vals as { realized: number; custody: number };
        return {
          monthKey,
          monthName: format(parseISO(`${monthKey}-01`), "MMM", { locale: ptBR }),
          realized: d.realized,
          target: (d.custody * ROA_TARGET) / 12,
        };
      });
  }, [mvData, selectedYear]);

  // ────────────────────────────────────────────────────────────────────────
  // Donut chart data - Clientes s/ Engajamento por Status
  // ────────────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    if (!oppsData || !activeAssessors) return [];

    const stats = { nunca: 0, inativo: 0 };
    
    // Using current month assessors for the team filter
    const currentMonthMv = (mvData || []).filter(
      (d) => d.data_posicao && d.data_posicao.substring(0, 7) === selectedMonthKey
    );

    oppsData.forEach((op: any) => {
      if (!activeAssessors.has(op.cod_assessor)) return;
      if (selectedTeam !== "all") {
        const assessorMv = currentMonthMv.find((m) => m.cod_assessor === op.cod_assessor);
        if (!assessorMv || assessorMv.time !== selectedTeam) return;
      }
      if (selectedAssessorId !== "all" && op.cod_assessor !== selectedAssessorId) return;
      if (op.validado !== "SIM") return;

      if (!op.data_ultima_operacao) {
        stats.nunca++;
      } else {
        stats.inativo++;
      }
    });

    const total = stats.nunca + stats.inativo;

    return [
      { name: "Nunca boletou", value: stats.nunca, percent: total > 0 ? (stats.nunca / total * 100).toFixed(1) : "0", color: "#94a3b8" },
      { name: "Inativo há +1 ano", value: stats.inativo, percent: total > 0 ? (stats.inativo / total * 100).toFixed(1) : "0", color: "#FAC017" },
    ];
  }, [oppsData, activeAssessors, mvData, selectedMonthKey, selectedTeam, selectedAssessorId]);

  // ────────────────────────────────────────────────────────────────────────
  // Weekly bar chart data - Boletas por Semana
  // ────────────────────────────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    if (!rvFixingData) return [];

    const baseMonth = selectedMonthKey ? parseISO(`${selectedMonthKey}-01`) : startOfMonth(today);
    
    const week1Start = startOfMonth(baseMonth);
    const week1End = addDays(week1Start, 6);
    
    const t = new Date();
    const currWStart = startOfWeek(t, { weekStartsOn: 1 });
    const currWEnd = endOfWeek(t, { weekStartsOn: 1 });
    const prevWStart = subWeeks(currWStart, 1);
    const prevWEnd = endOfWeek(prevWStart, { weekStartsOn: 1 });
    const nextWStart = addWeeks(currWStart, 1);
    const nextWEnd = endOfWeek(nextWStart, { weekStartsOn: 1 });
    
    // Approximate 5th week of the selected month
    const week5Start = addWeeks(week1Start, 4);
    const week5End = endOfMonth(baseMonth);

    const buckets = [
      { name: "1ª semana", range: { start: week1Start, end: week1End }, count: 0 },
      { name: "Semana anterior", range: { start: prevWStart, end: prevWEnd }, count: 0 },
      { name: "Semana atual", range: { start: currWStart, end: currWEnd }, count: 0 },
      { name: "Próxima semana", range: { start: nextWStart, end: nextWEnd }, count: 0 },
      { name: "5ª semana", range: { start: week5Start, end: week5End }, count: 0 },
    ];

    rvFixingData.forEach((d) => {
      if (!d.fixing) return;
      if (selectedAssessorId !== "all" && d.assessor_do_cliente !== selectedAssessorId) return;
      if (selectedTeam !== "all") {
        const assessorMv = (mvData || []).find((m) => m.cod_assessor === d.assessor_do_cliente);
        if (!assessorMv || assessorMv.time !== selectedTeam) return;
      }

      const fDate = parseISO(d.fixing);
      buckets.forEach(b => {
        if (isWithinInterval(fDate, b.range)) {
          b.count++;
        }
      });
    });

    return buckets.map(b => ({ name: b.name, total: b.count, range: b.range }));
  }, [rvFixingData, selectedMonthKey, selectedTeam, selectedAssessorId, mvData]);

  const selectedBucketBoletas = useMemo(() => {
    if (!selectedBucket || !rvFixingData) return [];
    
    const filtered = rvFixingData.filter((d: any) => {
      if (!d.fixing) return false;
      const fDate = parseISO(d.fixing);
      return isWithinInterval(fDate, selectedBucket.range);
    });

    return [...filtered].sort((a: any, b: any) => {
      const { key, direction } = modalSortConfig;
      let valA = a[key] || '';
      let valB = b[key] || '';

      if (key === 'comissao') {
        valA = parseFloat(valA.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        valB = parseFloat(valB.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [selectedBucket, rvFixingData, modalSortConfig]);

  const rvTableRows = useMemo(() => {
    const filtered = (rvData || []).filter((d) => {
      if (!d.data_inclusao) return false;
      if (d.data_inclusao.substring(0, 7) !== selectedMonthKey) return false;
      if (selectedAssessorId !== "all" && d.assessor_do_cliente !== selectedAssessorId) return false;
      if (selectedTeam !== "all") {
        const assessorMv = (mvData || []).find((m: any) => m.cod_assessor === d.assessor_do_cliente);
        if (!assessorMv || assessorMv.time !== selectedTeam) return false;
      }
      return true;
    });

    const enriched = filtered.map((b) => {
      const assessorMv = (mvData || []).find((m: any) => m.cod_assessor === b.assessor_do_cliente);
      const comissaoNum = parseFloat(String(b.comissao || "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      return {
        ...b,
        nome_assessor: assessorMv?.nome_assessor || b.assessor_do_cliente || "—",
        time: assessorMv?.time || "—",
        foto_url: assessorMv?.foto_url || null,
        comissao_num: comissaoNum,
      };
    });

    // Sort
    enriched.sort((a: any, b: any) => {
      const key = rvSortConfig.key;
      // Use comissao_num for numeric sorting of comissao
      const sortKey = key === 'comissao' ? 'comissao_num' : key;
      const valA = a[sortKey] ?? "";
      const valB = b[sortKey] ?? "";
      const cmp = typeof valA === 'number' && typeof valB === 'number'
        ? valA - valB
        : String(valA).localeCompare(String(valB));
      return rvSortConfig.direction === 'asc' ? cmp : -cmp;
    });

    return enriched;
  }, [rvData, mvData, selectedMonthKey, selectedTeam, selectedAssessorId, rvSortConfig]);

  const rvTotalPages = Math.max(1, Math.ceil(rvTableRows.length / rvItemsPerPage));
  const rvPaginated = rvTableRows.slice((rvPage - 1) * rvItemsPerPage, rvPage * rvItemsPerPage);

  // ────────────────────────────────────────────────────────────────────────
  // Chart tooltip
  // ────────────────────────────────────────────────────────────────────────

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
              <span className="text-white/60">Meta (ROA):</span>
              <span className="text-white font-medium">{formatCurrency(data.target)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data pt-1 border-t border-white/5">
              <span className="text-white/60">Gap:</span>
              <span className={cn("font-medium", data.realized >= data.target ? "text-green-400" : "text-red-400")}>
                {data.realized >= data.target ? "+" : "-"}{formatCurrency(Math.abs(data.realized - data.target))}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // ────────────────────────────────────────────────────────────────────────
  // Loading state
  // ────────────────────────────────────────────────────────────────────────

  const isLoading = isRvLoading || isMvLoading || isOppsLoading;

  if (isLoading) {
    return <LoadingOverlay isLoading={true} />;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" style={{ gridAutoRows: '1fr' }}>
        {/* 1. Receitas Estruturadas com Meta */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#3B82F6] opacity-50 hidden md:block" />
          <CardHeader className="pb-1 pt-4 pl-6 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-[10px] font-data text-white/50 uppercase tracking-widest">
                Receitas Estruturadas
              </CardTitle>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#3B82F6]15 flex items-center justify-center -mt-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
            </div>
          </CardHeader>
          <CardContent className="pb-4 pt-0 pl-6">
            <div className="flex flex-col items-center justify-center py-2 border-b border-[#3B82F6]/20 mb-3">
              <span className="text-2xl font-display text-white text-center leading-tight truncate px-1">
                {formatCurrency(kpis.receitaEstruturas)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-data text-white/50 uppercase font-bold tracking-widest">
                  META: R$ {kpis.receitaTarget >= 1000000 ? (kpis.receitaTarget / 1000000).toFixed(2).replace('.', ',') + 'M' : (kpis.receitaTarget / 1000).toFixed(2).replace('.', ',') + 'K'}
                </span>
                <span className={cn(
                  "text-[10px] font-data font-bold tracking-widest",
                  kpis.receitaAchievement >= 100 ? "text-green-500" : kpis.receitaAchievement >= 70 ? "text-euro-gold" : "text-red-500"
                )}>
                  {kpis.receitaAchievement.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    kpis.receitaAchievement >= 100 ? "bg-green-500" : kpis.receitaAchievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(kpis.receitaAchievement, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Total de Boletas */}
        <KpiCard
          title="Total de Boletas"
          value={formatNumber(kpis.totalBoletas)}
          subtitle="Boletas incluídas no período"
          icon={FileText}
          color="#FAC017"
          trend={{ value: kpis.boletasTrend, label: "vs mês anterior" }}
          delay={0.05}
        />

        {/* 3. Clientes s/ Engajamento */}
        <KpiCard
          title="Clientes s/ Engajamento"
          value={formatNumber(kpis.clientesSemEngajamento)}
          subtitle="Oportunidades em RV (Posição Black)"
          icon={UserX}
          color="#F97316"
          delay={0.1}
          infoMessage="Veja esses clientes na aba 'Posição Black'."
        />

        {/* 4. Boletas — Card combinado (à vencer + vencidas) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="h-full"
        >
          <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#8B5CF6] to-[#EC4899] opacity-50 hidden md:block" />
            <CardContent className="p-4 pl-6 flex flex-col h-full justify-between">
              <span className="text-[10px] font-data uppercase tracking-widest text-white block mb-2">
                Boletas — Vencimento
              </span>
              <div className="grid grid-cols-2 gap-2 flex-1">
                {/* À Vencer */}
                <div className="flex flex-col items-center justify-center bg-white/[0.04] rounded-xl p-2 border border-white/5">
                  <CalendarClock className="w-4 h-4 text-[#8B5CF6] mb-1" />
                  <span className="text-xl font-display text-white leading-none">{formatNumber(kpis.boletasVencerSemana.length)}</span>
                  <span className="text-[9px] font-data text-white mt-1 uppercase tracking-wider">À Vencer</span>
                  <span className="text-[9px] font-data text-white mt-0.5">Semana atual</span>
                </div>
                {/* Vencidas */}
                <div className="flex flex-col items-center justify-center bg-white/[0.04] rounded-xl p-2 border border-white/5">
                  <CalendarX2 className="w-4 h-4 text-red-500 mb-1" />
                  <span className="text-xl font-display text-white leading-none">{formatNumber(kpis.boletasVencidasSemana.length)}</span>
                  <span className="text-[9px] font-data text-red-500 mt-1 uppercase tracking-wider">Vencidas</span>
                  <span className="text-[9px] font-data text-white mt-0.5">Semana anterior</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 5. Assessores Engajados */}
        <KpiCard
          title="Assessores Engajados"
          value={`${kpis.engagedAssessors} / ${kpis.totalAssessors}`}
          subtitle={`${formatPercent(kpis.engagementPercent)} com receita de estruturadas`}
          icon={Users}
          color="#22C55E"
          ring={{ percent: kpis.engagementPercent, color: kpis.engagementPercent >= 50 ? "#22C55E" : "#EF4444" }}
          delay={0.2}
          action={{ label: "Detalhes", onClick: () => setIsEngagedModalOpen(true) }}
        />
      </div>

      {/* ── Chart: Receitas Estruturadas ao Longo do Tempo ── */}
      <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 hidden sm:block">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-euro-gold" />
              Receitas Estruturadas — Evolução {selectedYear}
            </h3>
            <p className="text-[11px] text-white/70 font-data mt-1 uppercase tracking-widest">
              Acompanhamento mensal vs Meta (ROA 0.35%)
            </p>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="rvBarPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="rvBarSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="rvBarNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="monthName"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CustomTooltip />} />
              <Bar dataKey="realized" name="Realizado" radius={[4, 4, 0, 0]} barSize={30}>
                {chartData.map((entry, index) => {
                  let fill = "url(#rvBarPositive)";
                  if (entry.realized >= entry.target) fill = "url(#rvBarSuccess)";
                  else if (entry.realized < 0) fill = "url(#rvBarNegative)";
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="target"
                name="Meta (ROA)"
                stroke="#FFFFFF"
                strokeOpacity={0.5}
                strokeWidth={2}
                dot={{ r: 4, fill: "#1A2030", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#FAC017", stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Novos Gráficos: Status Oportunidades e Distribuição Semanal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Rosca: Status de Oportunidades */}
        <Card className="bg-euro-card/60 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden p-6 hover:border-euro-gold/30 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-euro-gold/10 flex items-center justify-center border border-euro-gold/20">
              <UserX className="w-4 h-4 text-euro-gold" />
            </div>
            <div>
              <h3 className="text-[13px] font-data text-white uppercase tracking-widest font-bold">Status Oportunidades</h3>
              <p className="text-[11px] text-white/70 font-medium uppercase tracking-tighter">Clientes s/ Engajamento</p>
            </div>
          </div>
          
          <div className="h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart className="focus:outline-none">
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  activeShape={false}
                  isAnimationActive={true}
                  style={{ outline: 'none' }}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" className="focus:outline-none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white leading-none">
                {formatNumber(donutData.reduce((acc, curr) => acc + curr.value, 0))}
              </span>
              <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Total</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {donutData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-data">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-white/60">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{formatNumber(item.value)}</span>
                  <span className="text-[10px] text-white">({item.percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Gráfico de Barras: Distribuição Semanal de Boletas */}
        <Card className="lg:col-span-2 bg-euro-card/60 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden p-6 hover:border-euro-gold/30 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <CalendarClock className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-data text-white uppercase tracking-widest font-bold">Distribuição Semanal</h3>
              <p className="text-[11px] text-white/70 font-medium uppercase tracking-tighter">Boletas à vencer por janela de tempo</p>
            </div>
          </div>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={weeklyData} 
                margin={{ top: 60, right: 10, left: 10, bottom: 0 }}
                onClick={(data) => {
                  if (!isMobile && data && data.activePayload && data.activePayload[0]) {
                    const bucket = data.activePayload[0].payload;
                    setSelectedBucket(bucket);
                    setIsModalOpen(true);
                  }
                }}
                style={{ cursor: isMobile ? 'default' : 'pointer' }}
              >
                <defs>
                  <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "white", fontSize: 13, fontWeight: 400 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "white", fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{ backgroundColor: "#1A2030", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "#fff" }}
                  formatter={(value: number) => [formatNumber(value), "Boletas"]}
                />
                <Bar 
                  dataKey="total" 
                  radius={[6, 6, 0, 0]} 
                  fill="url(#weeklyBarGradient)"
                  barSize={40}
                >
                  <LabelList 
                    dataKey="total" 
                    position="top" 
                    fill="white" 
                    fontSize={12} 
                    fontWeight={700}
                    offset={10} 
                    formatter={formatNumber}
                  />
                  {weeklyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === "Semana atual" ? "#FAC017" : "url(#weeklyBarGradient)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Receitas Estruturadas — Atualizações Recentes ── */}
      <div className="hidden lg:block space-y-4 pt-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
            <FileText className="w-5 h-5 text-euro-gold" />
          </div>
          <div>
            <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
              Receitas Estruturadas - Atualizações Recentes
            </h3>
            <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
              {selectedMonthKey ? format(parseISO(`${selectedMonthKey}-01`), "MMMM yyyy", { locale: ptBR }) : ""} • {rvTableRows.length} registros
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

          <div className="overflow-auto custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10.5px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th
                    onClick={() => handleRvSort('nome_assessor')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[180px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor <RvSortIcon column="nome_assessor" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('codigo_cliente')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Cliente <RvSortIcon column="codigo_cliente" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('data_inclusao')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[130px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Data Inclusão <RvSortIcon column="data_inclusao" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('fixing')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[130px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Vencimento <RvSortIcon column="fixing" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('ativo')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Ativo <RvSortIcon column="ativo" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('operacao')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Operação <RvSortIcon column="operacao" /></div>
                  </th>
                  <th
                    onClick={() => handleRvSort('comissao')}
                    className="py-4 px-4 font-bold text-right w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 justify-end">Comissão <RvSortIcon column="comissao" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rvPaginated.map((row, i) => (
                  <tr
                    key={i}
                    className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-[12.6px] font-data"
                  >
                    <td className="py-3 px-4 border-r border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden flex-shrink-0">
                          {row.foto_url ? (
                            <img src={row.foto_url} alt={row.nome_assessor} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 opacity-20" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                            {row.nome_assessor}
                          </span>
                          <span className="text-[12.6px] text-white/60 font-mono">{row.assessor_do_cliente}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-white/10 text-white">{row.codigo_cliente || "—"}</td>
                    <td className="py-3 px-4 border-r border-white/10 text-white">
                      {row.data_inclusao ? format(parseISO(row.data_inclusao), "dd/MM/yy") : "—"}
                    </td>
                    <td className="py-3 px-4 border-r border-white/10 text-white">
                      {row.fixing ? format(parseISO(row.fixing), "dd/MM/yy") : "—"}
                    </td>
                    <td className="py-3 px-4 border-r border-white/10 text-white">{row.ativo || "—"}</td>
                    <td className="py-3 px-4 border-r border-white/10 text-white">{row.operacao || "—"}</td>
                    <td className="py-3 px-4 text-right text-white font-bold">{row.comissao_num ? formatCurrency(row.comissao_num) : "—"}</td>
                  </tr>
                ))}
                {rvPaginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center opacity-20">
                      <div className="flex flex-col items-center gap-4">
                        <Activity className="w-10 h-10" />
                        <p className="text-sm font-data uppercase tracking-widest">Nenhuma boleta no período</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {rvTotalPages > 1 && (
            <div className="p-4 border-t border-white/10 bg-black/40 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 px-8">
              <p className="text-[10px] text-white/30 font-data uppercase tracking-widest text-center sm:text-left">
                Mostrando <span className="text-white/60">{(rvPage - 1) * rvItemsPerPage + 1}</span> a <span className="text-white/60">{Math.min(rvPage * rvItemsPerPage, rvTableRows.length)}</span> de <span className="text-white/60">{rvTableRows.length}</span> registros
              </p>
              <div className="flex items-center gap-2 justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRvPage(p => Math.max(1, p - 1))}
                  disabled={rvPage === 1}
                  className="w-8 h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-euro-gold font-bold px-2">{rvPage}</span>
                  <span className="text-xs font-mono text-white/20">/</span>
                  <span className="text-xs font-mono text-white/40 px-2">{rvTotalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRvPage(p => Math.min(rvTotalPages, p + 1))}
                  disabled={rvPage === rvTotalPages}
                  className="w-8 h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="hidden sm:block" />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Detalhes das Boletas por Semana ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl h-[700px] bg-[#0D121F] border-euro-gold/30 text-white p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,192,23,0.1),transparent_70%)] pointer-events-none" />
          
          <DialogHeader className="p-8 border-b border-white/10 bg-gradient-to-r from-euro-gold/10 via-transparent to-transparent relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shadow-[0_0_20px_rgba(250,192,23,0.1)]">
                  <Briefcase className="w-7 h-7 text-euro-gold" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-display text-euro-gold tracking-tight">
                    Boletas — {selectedBucket?.name}
                  </DialogTitle>
                  <p className="text-sm text-white/50 font-data uppercase tracking-[0.2em] mt-1">
                    {selectedBucket?.range.start && format(selectedBucket.range.start, "dd/MM")} até {selectedBucket?.range.end && format(selectedBucket.range.end, "dd/MM")} • Detalhamento Semanal
                  </p>
                </div>
              </div>
              
              <div className="flex gap-10 pr-4">
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-1 font-bold">Total Boletas</p>
                  <p className="text-2xl font-display text-white">{formatNumber(selectedBucketBoletas.length)}</p>
                </div>
                <div className="text-right border-l border-white/10 pl-10">
                  <p className="text-[10px] text-euro-gold/50 uppercase tracking-[0.2em] mb-1 font-bold">Comissão Total</p>
                  <p className="text-2xl font-display text-euro-gold drop-shadow-[0_0_10px_rgba(250,192,23,0.3)]">
                    {formatCurrency(selectedBucketBoletas.reduce((acc, b) => {
                      const val = parseFloat(b.comissao?.replace(/[^\d.,]/g, "").replace(",", ".") || "0");
                      return acc + val;
                    }, 0), 2)}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 flex-1 min-h-0 flex flex-col">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                    <tr className="sticky top-0 z-20">
                      <th 
                        onClick={() => handleModalSort('assessor_do_cliente')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-6 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">Assessor <SortIconModal column="assessor_do_cliente" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('nome_cliente')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">Cliente <SortIconModal column="nome_cliente" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('data_inclusao')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold text-center border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 justify-center">Inclusão <SortIconModal column="data_inclusao" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('fixing')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold text-center border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 justify-center">Vencimento <SortIconModal column="fixing" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('ativo')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">Ativo <SortIconModal column="ativo" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('operacao')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">Operação <SortIconModal column="operacao" /></div>
                      </th>
                      <th 
                        onClick={() => handleModalSort('comissao')}
                        className="sticky top-0 z-20 bg-euro-gold py-3 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 justify-end">Comissão <SortIconModal column="comissao" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {selectedBucketBoletas.map((boleta, idx) => (
                      <tr key={idx} className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-[11px] font-data">
                        <td className="pl-6 py-3 border-r border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-euro-navy flex-shrink-0">
                              {(() => {
                                const assessorMv = mvData?.find(m => m.cod_assessor === boleta.assessor_do_cliente);
                                const photoUrl = assessorMv?.foto_url;
                                return photoUrl ? (
                                  <img src={photoUrl} alt="Assessor" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-white/20" />
                                  </div>
                                );
                              })()}
                            </div>
                            <span className="text-white/70 whitespace-nowrap">
                              {mvData?.find(m => m.cod_assessor === boleta.assessor_do_cliente)?.nome_assessor || boleta.assessor_do_cliente}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-white/5">
                          <div className="flex flex-col">
                            <span className="font-bold text-white/70 block truncate max-w-[180px]">
                              {boleta.nome_cliente || boleta.codigo_cliente}
                            </span>
                            {boleta.nome_cliente && boleta.codigo_cliente && (
                              <span className="text-[9px] text-white/30 uppercase leading-none block mt-1">
                                {boleta.codigo_cliente}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 border-r border-white/5">
                          <span className="font-mono text-white/70">
                            {boleta.data_inclusao ? format(parseISO(boleta.data_inclusao), "dd/MM/yy") : "-"}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 border-r border-white/5">
                          <span className="font-mono text-white/70 font-bold">
                            {boleta.fixing ? format(parseISO(boleta.fixing), "dd/MM/yy") : "-"}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 border-r border-white/5">
                          <Badge variant="outline" className="bg-white/5 border-white/10 text-white/70 text-[10px] font-data uppercase tracking-tighter">
                            {boleta.ativo || "-"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 border-r border-white/5">
                          <span className="text-white/70 line-clamp-1 max-w-[200px]">
                            {boleta.operacao || "-"}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="font-mono font-bold text-euro-gold whitespace-nowrap">
                            {boleta.comissao ? formatCurrency(parseFloat(boleta.comissao.replace(/[^\d.,]/g, "").replace(",", ".")), 2) : "R$ 0,00"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {selectedBucketBoletas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="h-40 text-center">
                          <p className="text-sm font-data text-white/20 uppercase tracking-widest">Nenhuma boleta encontrada nesta semana</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-white/10 bg-black/60 flex justify-center items-center px-8">
            <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
              Visualização Detalhada • Distribuição Semanal de Boletas
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Detalhes de Engajamento ── */}
      <Dialog open={isEngagedModalOpen} onOpenChange={setIsEngagedModalOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-[#0D121F] border-euro-gold/30 text-white p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.1),transparent_70%)] pointer-events-none" />
          
          <DialogHeader className="p-8 border-b border-white/10 relative shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-900/40 border border-green-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <Users className="w-8 h-8 text-green-400" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-display text-white mb-2">Engajamento de Assessores</DialogTitle>
                <div className="flex items-center gap-4 text-xs font-data uppercase tracking-wider text-white/50">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"/> Engajados ({kpis.engagedAssessors})</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"/> Sem Receita ({kpis.totalAssessors - kpis.engagedAssessors})</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 flex-1 min-h-0 flex flex-col relative z-10">
            <ScrollArea className="flex-1 pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                {kpis.assessorEngagementList
                  .sort((a, b) => {
                    // Sem receita primeiro (magical highlight)
                    if (a.engaged === b.engaged) return a.nome.localeCompare(b.nome);
                    return a.engaged ? 1 : -1;
                  })
                  .map((assessor, idx) => (
                  <div key={idx} className={cn(
                    "relative p-5 rounded-xl border transition-all duration-300 group flex items-start gap-4",
                    assessor.engaged 
                      ? "bg-euro-card/60 backdrop-blur border-white/5 hover:border-green-500/30 hover:bg-white/[0.04]" 
                      : "bg-red-500/[0.03] backdrop-blur border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] hover:bg-red-500/[0.08] hover:border-red-500/40 relative overflow-hidden"
                  )}>
                    {/* Magic Glow Effect for unengaged */}
                    {!assessor.engaged && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}

                    <div className="w-12 h-12 rounded-full overflow-hidden bg-euro-navy border border-white/10 shrink-0 relative z-10">
                      {assessor.url ? (
                        <img src={assessor.url} alt={assessor.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white/20" />
                        </div>
                      )}
                      {assessor.engaged ? (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#0D121F]" />
                      ) : (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-[#0D121F] animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                       <p className={cn("font-bold text-sm truncate", assessor.engaged ? "text-white/90" : "text-white drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]")}>{assessor.nome}</p>
                       <p className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5 mb-2 truncate">{assessor.time}</p>
                       {assessor.engaged ? (
                         <div className="flex items-center gap-1.5 text-green-400/80 font-data text-xs mt-auto">
                           <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                           <span className="truncate">{formatCurrency(assessor.receitas)} em originação</span>
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 text-red-400 font-data text-xs mt-auto font-medium">
                           <UserX className="w-3.5 h-3.5 shrink-0" />
                           <span className="truncate">Zero emissões no mês</span>
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="p-5 border-t border-white/10 bg-black/60 flex justify-center items-center px-8 shrink-0">
             <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
                Gestão de Equipes • Posicionamento Mensal Ativo
             </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
