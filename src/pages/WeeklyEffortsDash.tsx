import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, parseISO, isBefore, startOfDay, differenceInCalendarWeeks, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import SuperRanking from "@/components/dashboard/SuperRanking";
import ClusterRankingTablesTv from "@/components/dashboard/ClusterRankingTablesTv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Maximize2, Minimize2, CalendarCheck, Clock, ThumbsUp, Target, Users, ArrowUpDown, ArrowUp, ArrowDown, Play, X, Download, BarChart3, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from "recharts";

type PeriodType = "currentWeek" | "prevWeek" | "currentMonth";

function ProgressStrip({
  value,
  color,
  trackClassName = "bg-white/10",
}: {
  value: number;
  color: string;
  trackClassName?: string;
}) {
  const pct = Math.max(0, Math.min(value, 100));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full", trackClassName)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function FlipInsightCard({
  cardId,
  flippedCard,
  onToggle,
  className,
  front,
  back,
}: {
  cardId: string;
  flippedCard: string | null;
  onToggle: (cardId: string) => void;
  className?: string;
  front: React.ReactNode;
  back: React.ReactNode;
}) {
  const isFlipped = flippedCard === cardId;

  return (
    <button
      type="button"
      onClick={() => onToggle(cardId)}
      className={cn("relative block w-full h-full text-left", className)}
      style={{ perspective: "1800px" }}
      aria-pressed={isFlipped}
    >
      <div
        className="relative h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {back}
        </div>
      </div>
    </button>
  );
}

export default function WeeklyEffortsDash() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicTV = location.pathname === "/tv/esforco-semanal";

  const [isMaximized, setIsMaximized] = useState(false);
  const [showPresentation, setShowPresentation] = useState(isPublicTV);
  const [activeView, setActiveView] = useState<"overview" | "monthlyCompare">("overview");
  const [period, setPeriod] = useState<PeriodType>("currentWeek");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedAssessor, setSelectedAssessor] = useState<string>("all");
  const [rankingYear, setRankingYear] = useState<string>(() => {
    const current = new Date().getFullYear();
    return current < 2026 ? "2026" : current.toString();
  });
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'realizadas',
    direction: 'desc'
  });
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const [selectedMonthlyTableMonthKey, setSelectedMonthlyTableMonthKey] = useState<string | null>(null);
  const [selectedMonthlyChartMonthKey, setSelectedMonthlyChartMonthKey] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const monthlyHistoryStart = useMemo(() => format(startOfMonth(addMonths(today, -11)), "yyyy-MM-dd"), [today]);
  const monthlyHistoryEnd = useMemo(() => format(endOfMonth(today), "yyyy-MM-dd"), [today]);

  const periodDates = useMemo(() => {
    const now = new Date();
    // Use weekStartsOn: 1 for Monday
    if (period === "currentWeek") {
      return {
        start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        label: "Semana Atual"
      };
    } else if (period === "prevWeek") {
      const prevWeek = subWeeks(now, 1);
      return {
        start: format(startOfWeek(prevWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(prevWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        label: "Semana Anterior"
      };
    } else {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: "Mês Atual"
      };
    }
  }, [period]);

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
      console.error(err);
      setIsMaximized(!isMaximized);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Fetch active assessors and teams
  const { data: metadata, isLoading: isMetaLoading } = useQuery({
    queryKey: ["weekly-efforts-metadata"],
    queryFn: async () => {
      // Get latest date from mv_resumo_assessor
      const { data: latestEntry } = await (supabase.from("mv_resumo_assessor" as any) as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      
      const latestDate = latestEntry?.data_posicao;
      
      const { data: mvRows } = await (supabase.from("mv_resumo_assessor" as any) as any)
        .select("cod_assessor, nome_assessor, time, foto_url")
        .eq("data_posicao", latestDate || format(today, "yyyy-MM-dd"));

      const validRows = (mvRows as any[] || []).filter(r => {
        const t = r.time?.toUpperCase();
        const cod = r.cod_assessor?.toUpperCase();
        return t !== "OPERACIONAIS" && t !== "ADVISORS" && t !== "ANYWHERE" && cod !== "A26969" && cod !== "A1607";
      });

      const teams = Array.from(new Set(validRows.map(r => r.time).filter(Boolean))).sort();
      const assessors = validRows.map(r => ({
        cod: r.cod_assessor,
        name: r.nome_assessor || r.cod_assessor,
        team: r.time,
        photo: r.foto_url
      })).sort((a, b) => a.name.localeCompare(b.name));

      const activeAssessorIds = new Set(assessors.map(a => a.cod).filter(Boolean));
      return { teams, assessors, activeAssessorIds };
    }
  });

  // Fetch metrics data
  const { data: dashboardData, isLoading: isDataLoading } = useQuery({
    queryKey: ["weekly-efforts-data", periodDates.start, periodDates.end],
    refetchInterval: 5 * 60 * 1000, // 5 min auto-refresh
    queryFn: async () => {
      // For comparative data, we always fetch current week and previous week, regardless of selected period
      // But we also fetch the selected period data
      
      const now = new Date();
      const currWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const currWeekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      
      const prevWeekDate = subWeeks(now, 1);
      const prevWeekStart = format(startOfWeek(prevWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const prevWeekEnd = format(endOfWeek(prevWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      
      const currMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const currMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      // We need min and max dates to fetch all at once
      const allDates = [periodDates.start, periodDates.end, currWeekStart, currWeekEnd, prevWeekStart, prevWeekEnd, currMonthStart, currMonthEnd].sort();
      const minDate = allDates[0];
      const maxDate = allDates[allDates.length - 1];

      const { data: reunioes, error } = await supabase
        .from("vw_reunioes_pipe" as any)
        .select("id_atividade, deal_id, data_vencimento, data_adicionado, canal, assessor, concluido")
        .gte("data_vencimento", minDate)
        .lte("data_vencimento", maxDate);

      if (error) throw error;
      return reunioes as any[];
    }
  });

  const { data: monthlyHistoryData, isLoading: isMonthlyHistoryLoading } = useQuery({
    queryKey: ["weekly-efforts-monthly-history", monthlyHistoryStart, monthlyHistoryEnd],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_reunioes_pipe" as any)
        .select("id_atividade, deal_id, data_vencimento, data_adicionado, canal, assessor, concluido")
        .gte("data_vencimento", monthlyHistoryStart)
        .lte("data_vencimento", monthlyHistoryEnd);

      if (error) throw error;
      return data as any[];
    }
  });

  const { data: superRankingData, isLoading: isSuperRankingLoading } = useQuery({
    queryKey: ["weekly-efforts-superranking", rankingYear],
    enabled: !!metadata?.activeAssessorIds,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const startDate = `${rankingYear}-01-01`;
      const endDate = `${rankingYear}-12-31`;

      const { data, error } = await (supabase.from("mv_resumo_assessor" as any) as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate)
        .order("data_posicao", { ascending: true });

      if (error) throw error;

      const activeIds: Set<string> | undefined = (metadata as any)?.activeAssessorIds;
      if (activeIds && activeIds.size > 0) {
        return (data as any[]).filter(r => r.cod_assessor && activeIds.has(r.cod_assessor));
      }

      return (data as any[]) || [];
    }
  });

  const processedData = useMemo(() => {
    if (!dashboardData || !metadata) return null;

    const reunioes = dashboardData;
    const { assessors } = metadata;
    const assessorMap = new Map(assessors.map(a => [a.cod, a]));

    // Helper to process a specific date range
    const processRange = (start: string, end: string) => {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      const effectiveEnd = isBefore(endDate, today) ? endDate : today;
      let weeks = differenceInCalendarWeeks(effectiveEnd, startDate, { weekStartsOn: 1 }) + 1;
      if (weeks < 1) weeks = 1;

      const topPerformerTarget = 2 * weeks;
      const metaTarget = 1 * weeks;

      const filtered = reunioes.filter(r => {
        if (!r.data_vencimento) return false;
        const d = r.data_vencimento.substring(0, 10);
        return d >= start && d <= end;
      });

      let realizadas = 0;
      let agendadas = 0;
      let indicacao = 0;

      const assessorStats = new Map<string, { realizadas: number, agendadas: number }>();
      
      // Initialize all active assessors (filtered by team/assessor if applicable)
      assessors.forEach(a => {
        if (selectedTeam !== "all" && a.team !== selectedTeam) return;
        if (selectedAssessor !== "all" && a.cod !== selectedAssessor) return;
        assessorStats.set(a.cod, { realizadas: 0, agendadas: 0 });
      });

      filtered.forEach(r => {
        const cod = r.assessor;
        if (!cod) return;
        if (!assessorMap.has(cod)) return; // Exclui reuniões de assessores removidos (ex: OPERACIONAIS)
        
        const assessorMeta = assessorMap.get(cod);
        if (selectedTeam !== "all" && assessorMeta?.team !== selectedTeam) return;
        if (selectedAssessor !== "all" && cod !== selectedAssessor) return;

        const isRealizada = String(r.concluido).toLowerCase() === "true";
        
        if (isRealizada) realizadas++;
        else agendadas++;

        if (r.canal?.toLowerCase() === "indicação") {
          indicacao++;
        }

        if (assessorStats.has(cod)) {
          const stats = assessorStats.get(cod)!;
          if (isRealizada) stats.realizadas++;
          else stats.agendadas++;
        }
      });

      let bateramMeta = 0;
      const ranking: any[] = [];
      const zerados: any[] = [];

      assessorStats.forEach((stats, cod) => {
        if (stats.realizadas >= metaTarget) bateramMeta++;
        
        const aMeta = assessorMap.get(cod);
        const entry = {
          cod,
          nome: aMeta?.name || cod,
          time: aMeta?.team || "Sem Time",
          foto: aMeta?.photo,
          realizadas: stats.realizadas,
          agendadas: stats.agendadas,
          total: stats.realizadas + stats.agendadas,
          statusColor: stats.realizadas >= topPerformerTarget ? "bg-euro-gold/20 text-euro-gold border-euro-gold/30" : 
                       stats.realizadas >= metaTarget ? "bg-green-500/20 text-green-400 border-green-500/30" : 
                       stats.realizadas > 0 ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                       "bg-red-500/20 text-red-400 border-red-500/30",
          statusText: stats.realizadas >= topPerformerTarget ? "Top Performer ⭐" : 
                      stats.realizadas >= metaTarget ? "Meta ✓" : 
                      stats.realizadas > 0 ? "Abaixo da Meta" :
                      "Zerado"
        };
        
        ranking.push(entry);
        if (stats.realizadas === 0) zerados.push(entry);
      });

      const totalAssessores = assessorStats.size;
      const pctMeta = totalAssessores > 0 ? (bateramMeta / totalAssessores) * 100 : 0;

      return {
        realizadas,
        agendadas,
        indicacao,
        pctMeta,
        bateramMeta,
        ranking,
        zerados,
        totalAssessores,
        weeks,
        metaTarget,
        topPerformerTarget,
        totalMeta: totalAssessores * metaTarget
      };
    };

    // Selected Period Data
    const current = processRange(periodDates.start, periodDates.end);
    
    // Always calculate Current Week vs Prev Week for the comparative card
    const now = new Date();
    const currWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const currWeekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const prevWeekDate = subWeeks(now, 1);
    const prevWeekStart = format(startOfWeek(prevWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const prevWeekEnd = format(endOfWeek(prevWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const currMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const currMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const comparative = {
      currentWeek: processRange(currWeekStart, currWeekEnd),
      prevWeek: processRange(prevWeekStart, prevWeekEnd),
      currentMonth: processRange(currMonthStart, currMonthEnd)
    };

    return { current, comparative };
  }, [dashboardData, metadata, periodDates, selectedTeam, selectedAssessor, today]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleToggleCard = (cardId: string) => {
    setFlippedCard((prev) => (prev === cardId ? null : cardId));
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" /> 
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const sortedRanking = useMemo(() => {
    if (!processedData?.current.ranking) return [];
    
    return [...processedData.current.ranking].sort((a, b) => {
      const { key, direction } = sortConfig;
      const aVal = a[key];
      const bVal = b[key];
      
      if (typeof aVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [processedData, sortConfig]);

  const dashboardStory = useMemo(() => {
    if (!processedData) return null;

    const current = processedData.current;
    const month = processedData.comparative.currentMonth;
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const totalMonthDays = monthEnd.getDate();
    const elapsedMonthDays = Math.min(today.getDate(), totalMonthDays);
    const monthProgressRatio = totalMonthDays > 0 ? elapsedMonthDays / totalMonthDays : 0;
    const fullMonthWeeks = differenceInCalendarWeeks(monthEnd, monthStart, { weekStartsOn: 1 }) + 1;
    const monthlyMetaTotal = month.totalAssessores * fullMonthWeeks;
    const monthlyPaceTarget = monthlyMetaTotal * monthProgressRatio;
    const monthlyAchievementPct = monthlyMetaTotal > 0 ? (month.realizadas / monthlyMetaTotal) * 100 : 0;
    const paceAchievementPct = monthlyPaceTarget > 0 ? (month.realizadas / monthlyPaceTarget) * 100 : 0;
    const currentAchievementPct = current.totalMeta > 0 ? (current.realizadas / current.totalMeta) * 100 : 0;
    const paceGap = month.realizadas - monthlyPaceTarget;
    const monthlyGap = Math.max(monthlyMetaTotal - month.realizadas, 0);
    const currentGap = Math.max(current.totalMeta - current.realizadas, 0);
    const indicationShare = current.realizadas > 0 ? (current.indicacao / current.realizadas) * 100 : 0;

    return {
      current,
      month,
      fullMonthWeeks,
      totalMonthDays,
      elapsedMonthDays,
      monthlyMetaTotal,
      monthlyPaceTarget,
      monthlyAchievementPct,
      paceAchievementPct,
      currentAchievementPct,
      paceGap,
      monthlyGap,
      currentGap,
      indicationShare,
    };
  }, [processedData, today]);

  const monthlyComparisonData = useMemo(() => {
    if (!monthlyHistoryData || !metadata) return [];

    const assessorMap = new Map((metadata.assessors as any[]).map((a) => [a.cod, a]));
    const activeAssessors = (metadata.assessors as any[]).filter((a) => {
      if (selectedTeam !== "all" && a.team !== selectedTeam) return false;
      if (selectedAssessor !== "all" && a.cod !== selectedAssessor) return false;
      return true;
    });

    const rows = monthlyHistoryData as any[];
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = addMonths(today, -(11 - index));
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");
      const effectiveEnd = isBefore(monthEnd, today) ? monthEnd : today;
      let weeks = differenceInCalendarWeeks(effectiveEnd, monthStart, { weekStartsOn: 1 }) + 1;
      if (weeks < 1) weeks = 1;

      const assessorStats = new Map<string, { realizadas: number; agendadas: number; indicacao: number }>();
      activeAssessors.forEach((a) => assessorStats.set(a.cod, { realizadas: 0, agendadas: 0, indicacao: 0 }));

      let realizadas = 0;
      let agendadas = 0;
      let indicacao = 0;

      rows.forEach((r) => {
        if (!r.data_vencimento) return;
        const dueDate = r.data_vencimento.substring(0, 10);
        if (dueDate < startStr || dueDate > endStr) return;

        const cod = r.assessor;
        if (!cod || !assessorMap.has(cod)) return;

        const assessorMeta = assessorMap.get(cod);
        if (selectedTeam !== "all" && assessorMeta?.team !== selectedTeam) return;
        if (selectedAssessor !== "all" && cod !== selectedAssessor) return;

        const isRealizada = String(r.concluido).toLowerCase() === "true";
        if (isRealizada) realizadas++;
        else agendadas++;
        const isIndicacao = r.canal?.toLowerCase() === "indicação";
        if (isIndicacao) indicacao++;

        const current = assessorStats.get(cod);
        if (current) {
          if (isRealizada) current.realizadas++;
          else current.agendadas++;
          if (isIndicacao) current.indicacao++;
        }
      });

      const totalAssessores = assessorStats.size;
      const metaIndividual = weeks;
      const totalMeta = totalAssessores * metaIndividual;
      const assessorRows = activeAssessors.map((assessor) => {
        const stats = assessorStats.get(assessor.cod) || { realizadas: 0, agendadas: 0, indicacao: 0 };
        const bateuMeta = stats.realizadas >= metaIndividual;
        return {
          cod: assessor.cod,
          nome: assessor.name,
          time: assessor.team || "Sem time",
          realizadas: stats.realizadas,
          agendadas: stats.agendadas,
          indicacao: stats.indicacao,
          bateuMeta,
          pctMetaIndividual: metaIndividual > 0 ? (stats.realizadas / metaIndividual) * 100 : 0,
        };
      }).sort((a, b) => {
        if (b.realizadas !== a.realizadas) return b.realizadas - a.realizadas;
        if (b.agendadas !== a.agendadas) return b.agendadas - a.agendadas;
        return a.nome.localeCompare(b.nome);
      });

      const assessoresMeta = assessorRows.filter((stats) => stats.bateuMeta).length;
      const pctMetaAssessores = totalAssessores > 0 ? (assessoresMeta / totalAssessores) * 100 : 0;
      const pctMetaTime = totalMeta > 0 ? (realizadas / totalMeta) * 100 : 0;
      const teamRanking = Array.from(
        assessorRows.reduce((acc, assessor) => {
          const current = acc.get(assessor.time) || {
            team: assessor.time,
            realizadas: 0,
            agendadas: 0,
            indicacao: 0,
            assessores: 0,
            bateramMeta: 0,
          };
          current.realizadas += assessor.realizadas;
          current.agendadas += assessor.agendadas;
          current.indicacao += assessor.indicacao;
          current.assessores += 1;
          if (assessor.bateuMeta) current.bateramMeta += 1;
          acc.set(assessor.time, current);
          return acc;
        }, new Map<string, { team: string; realizadas: number; agendadas: number; indicacao: number; assessores: number; bateramMeta: number }>())
      ).map(([, value]) => ({
        ...value,
        pctMetaAssessores: value.assessores > 0 ? (value.bateramMeta / value.assessores) * 100 : 0,
      })).sort((a, b) => {
        if (b.realizadas !== a.realizadas) return b.realizadas - a.realizadas;
        return a.team.localeCompare(b.team);
      });
      const topAssessors = assessorRows.slice(0, 3);

      return {
        monthKey: format(monthStart, "yyyy-MM"),
        monthLabel: format(monthStart, "MMM/yy", { locale: ptBR }).replace(".", "").toUpperCase(),
        monthFullLabel: format(monthStart, "MMMM 'de' yyyy", { locale: ptBR }),
        realizadas,
        agendadas,
        indicacao,
        weeks,
        totalAssessores,
        metaIndividual,
        totalMeta,
        assessoresMeta,
        pctMetaAssessores,
        pctMetaTime,
        assessorRows,
        teamRanking,
        topAssessors,
      };
    });

    return months.map((month, index) => {
      const previous = index > 0 ? months[index - 1] : null;
      const deltaAbs = previous ? month.realizadas - previous.realizadas : 0;
      const deltaPct = previous
        ? previous.realizadas > 0
          ? ((month.realizadas - previous.realizadas) / previous.realizadas) * 100
          : month.realizadas > 0
            ? 100
            : 0
        : 0;

      return {
        ...month,
        deltaAbs,
        deltaPct,
      };
    });
  }, [monthlyHistoryData, metadata, selectedTeam, selectedAssessor, today]);

  const monthlyCompareSummary = useMemo(() => {
    if (!monthlyComparisonData.length) return null;
    const latest = monthlyComparisonData[monthlyComparisonData.length - 1];
    const previous = monthlyComparisonData.length > 1 ? monthlyComparisonData[monthlyComparisonData.length - 2] : null;
    const best = monthlyComparisonData.reduce((acc, curr) => curr.realizadas > acc.realizadas ? curr : acc, monthlyComparisonData[0]);
    const averageRealizadas = monthlyComparisonData.reduce((acc, curr) => acc + curr.realizadas, 0) / monthlyComparisonData.length;

    return {
      latest,
      previous,
      best,
      averageRealizadas,
    };
  }, [monthlyComparisonData]);

  const selectedAssessorMeta = useMemo(() => {
    if (!metadata || selectedAssessor === "all") return null;
    return (metadata.assessors as any[]).find((a) => a.cod === selectedAssessor) || null;
  }, [metadata, selectedAssessor]);

  const selectedMonthlyTableDetail = useMemo(
    () => monthlyComparisonData.find((month) => month.monthKey === selectedMonthlyTableMonthKey) || null,
    [monthlyComparisonData, selectedMonthlyTableMonthKey]
  );

  const selectedMonthlyChartDetail = useMemo(
    () => monthlyComparisonData.find((month) => month.monthKey === selectedMonthlyChartMonthKey) || null,
    [monthlyComparisonData, selectedMonthlyChartMonthKey]
  );

  const handleDownloadExcel = () => {
    if (!sortedRanking || sortedRanking.length === 0) return;

    const dataToExport = sortedRanking.map((assessor, index) => ({
      'Posição': index + 1,
      'Assessor': assessor.nome,
      'Time': assessor.time,
      'R1 Realizadas': assessor.realizadas,
      'R1 Agendadas': assessor.agendadas,
      'Status': assessor.statusText
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ranking");

    XLSX.writeFile(wb, `ranking_esforco_r1_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const isLoading = isMetaLoading || isDataLoading || isMonthlyHistoryLoading;

  if (showPresentation && processedData) {
    return (
      <TVPresentationMode 
        data={processedData} 
        superRankingData={(superRankingData as any[]) || []}
        superRankingYear={rankingYear}
        onSuperRankingYearChange={setRankingYear}
        isSuperRankingLoading={isSuperRankingLoading}
        onClose={isPublicTV ? undefined : () => {
          setShowPresentation(false);
          if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(console.error);
          }
        }} 
      />
    );
  }

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isLoading} message="Carregando Reuniões..." />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8 relative z-10">
        
        {/* Header */}
        <div className="relative flex items-center justify-center w-full mb-4 sm:mb-8 min-h-[40px]">
          <div className="absolute left-0 top-0 z-[100]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dash")}
              className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#06B6D4]/50 text-[#A0A090] hover:text-[#06B6D4] h-8 w-8 sm:w-auto p-0 sm:px-4 rounded-full sm:rounded-xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center group"
            >
              <ArrowLeft className="w-4 h-4 sm:mr-2 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline font-data">Voltar</span>
            </Button>
          </div>

          <h1 className="text-lg sm:text-xl md:text-2xl font-data text-[#06B6D4] tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-90 text-center flex items-center gap-3">
            <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            Esforço Semanal R1
          </h1>
          
          <div className="absolute right-0 top-0 hidden sm:flex z-10 gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setShowPresentation(true);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(console.error);
                }
              }}
              className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy h-8 px-4 transition-all duration-300 group"
            >
              <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Apresentação TV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-[#06B6D4]/50 hover:bg-[#06B6D4]/10 text-[#A0A090] hover:text-[#06B6D4] h-8 px-4 transition-all duration-300 group"
              title={isMaximized ? "Sair da Tela Cheia (Esc)" : "Tela Cheia"}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Sair</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Tela Cheia</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "overview" | "monthlyCompare")} className="space-y-6 sm:space-y-8">
          <div className="flex flex-col items-center gap-4">
            <TabsList className="bg-[#0F1218]/90 backdrop-blur-xl border border-white/10 rounded-full p-1.5 h-auto flex-wrap justify-center">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 py-2 text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
              >
                Visão Atual
              </TabsTrigger>
              <TabsTrigger
                value="monthlyCompare"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 py-2 text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
              >
                Mês x Mês
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-center gap-3 bg-euro-card/60 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl mx-auto w-fit max-w-full">
              {activeView === "overview" && (
                <Select value={period} onValueChange={(v: PeriodType) => setPeriod(v)}>
                  <SelectTrigger className="w-[160px] h-9 bg-black/20 border-white/10 text-white text-xs font-data uppercase">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent className="bg-euro-card border-white/10 text-white font-data uppercase text-xs">
                    <SelectItem value="currentWeek">Semana Atual</SelectItem>
                    <SelectItem value="prevWeek">Semana Anterior</SelectItem>
                    <SelectItem value="currentMonth">Mês Atual</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {metadata && metadata.teams.length > 0 && (
                <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); setSelectedAssessor("all"); }}>
                  <SelectTrigger className="w-[160px] h-9 bg-black/20 border-white/10 text-white text-xs font-data uppercase">
                    <SelectValue placeholder="Todos os Times" />
                  </SelectTrigger>
                  <SelectContent className="bg-euro-card border-white/10 text-white font-data uppercase text-xs">
                    <SelectItem value="all">Todos os Times</SelectItem>
                    {metadata.teams.map((t: string) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {metadata && metadata.assessors.length > 0 && (
                <Select value={selectedAssessor} onValueChange={setSelectedAssessor}>
                  <SelectTrigger className="w-[220px] h-9 bg-black/20 border-white/10 text-white text-xs font-data uppercase">
                    <SelectValue placeholder="Todos os Assessores" />
                  </SelectTrigger>
                  <SelectContent className="bg-euro-card border-white/10 text-white font-data uppercase text-xs">
                    <SelectItem value="all">Todos os Assessores</SelectItem>
                    {metadata.assessors
                      .filter((a: any) => selectedTeam === "all" || a.team === selectedTeam)
                      .map((a: any) => (
                      <SelectItem key={a.cod} value={a.cod}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value="overview" className="mt-0 border-none p-0 outline-none">
            {processedData && dashboardStory && (
              <>
            {/* KPI STORY */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
              <FlipInsightCard
                cardId="pulse"
                flippedCard={flippedCard}
                onToggle={handleToggleCard}
                className="xl:col-span-7 min-h-[380px]"
                front={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-euro-card/70 backdrop-blur-xl border border-cyan-400/20 rounded-[28px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#06B6D4]" />
                    <CardContent className="p-6 sm:p-7 lg:p-8 space-y-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                            <CalendarCheck className="w-3.5 h-3.5 text-[#06B6D4]" />
                            <span className="text-[10px] font-data uppercase tracking-[0.25em] text-[#7DD3FC]">
                              Pulso de {periodDates.label}
                            </span>
                          </div>
                          <div>
                            <p className="text-white/55 text-xs font-data uppercase tracking-[0.25em] mb-2">
                              Produção do período selecionado
                            </p>
                            <div className="flex items-end gap-3">
                              <span className="font-display text-white leading-none text-6xl sm:text-7xl">
                                {dashboardStory.current.realizadas}
                              </span>
                              <span className="text-white/55 text-sm sm:text-base uppercase tracking-[0.2em] pb-2">
                                R1 realizadas
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-data uppercase tracking-[0.2em] text-white/45">
                              Meta do período
                            </span>
                            <span className="text-sm font-data text-white">
                              {dashboardStory.current.realizadas} / {dashboardStory.current.totalMeta}
                            </span>
                          </div>
                          <ProgressStrip value={dashboardStory.currentAchievementPct} color="#06B6D4" />
                          <p className="text-xs text-white/55 leading-relaxed">
                            Cada assessor precisa de {dashboardStory.current.metaTarget} R1 no período. Hoje faltam {dashboardStory.currentGap} para a régua consolidada.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-data uppercase tracking-[0.2em] text-white/45">Agendadas</span>
                            <Clock className="w-4 h-4 text-[#A855F7]" />
                          </div>
                          <div className="text-3xl font-display text-white leading-none">{dashboardStory.current.agendadas}</div>
                          <p className="mt-2 text-xs text-white/50">Reuniões futuras abertas no mesmo recorte.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-data uppercase tracking-[0.2em] text-white/45">Indicação</span>
                            <ThumbsUp className="w-4 h-4 text-[#EAB308]" />
                          </div>
                          <div className="text-3xl font-display text-white leading-none">{dashboardStory.current.indicacao}</div>
                          <p className="mt-2 text-xs text-white/50">
                            {dashboardStory.indicationShare.toFixed(0)}% das realizadas vieram de indicação.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-data uppercase tracking-[0.2em] text-white/45">Base monitorada</span>
                            <Users className="w-4 h-4 text-euro-gold" />
                          </div>
                          <div className="text-3xl font-display text-white leading-none">{dashboardStory.current.totalAssessores}</div>
                          <p className="mt-2 text-xs text-white/50">
                            Assessores ativos dentro dos filtros aplicados.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
                back={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_38%),linear-gradient(180deg,rgba(8,16,28,0.98),rgba(12,22,36,0.96))] backdrop-blur-xl border border-cyan-400/20 rounded-[28px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#06B6D4]" />
                    <CardContent className="p-6 sm:p-7 lg:p-8 h-full flex flex-col overflow-y-auto">
                      <div className="mb-5">
                        <p className="text-[10px] font-data uppercase tracking-[0.24em] text-cyan-300/80 mb-2">Como ler este card</p>
                        <h3 className="text-2xl font-data text-white uppercase tracking-[0.16em]">Pulso de produção</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">O que mostra</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            O volume realizado no recorte atual, junto com o estoque agendado, o peso de indicação e a base total que está sendo cobrada.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Como calcula</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Realizadas = reuniões com `concluido = true`. Agendadas = `concluido = false`. Indicação = canal `indicação`. Base monitorada = assessores ativos após os filtros.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Como interpretar</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Esse é o card de temperatura da operação. Ele responde se o time está entregando agora, qual o colchão de agenda para frente e quanto dessa produção veio de relacionamento por indicação.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />

              <FlipInsightCard
                cardId="monthly-meta"
                flippedCard={flippedCard}
                onToggle={handleToggleCard}
                className="xl:col-span-5 min-h-[380px]"
                front={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.18),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-euro-card/70 backdrop-blur-xl border border-euro-gold/20 rounded-[28px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-euro-gold" />
                    <CardContent className="p-6 sm:p-7 lg:p-8 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                          <p className="text-[10px] font-data uppercase tracking-[0.25em] text-euro-gold/80 mb-2">
                            Meta mensal geral
                          </p>
                          <h3 className="text-xl sm:text-2xl font-data text-white uppercase tracking-[0.18em]">
                            Meta de reuniões do mês
                          </h3>
                        </div>
                        <Target className="w-5 h-5 text-euro-gold shrink-0 mt-1" />
                      </div>

                      <div className="flex items-end gap-3 mb-4">
                        <span className="font-display text-euro-gold leading-none text-5xl sm:text-6xl">
                          {dashboardStory.monthlyAchievementPct.toFixed(0)}%
                        </span>
                        <span className="text-white/55 text-sm sm:text-base uppercase tracking-[0.18em] pb-2">
                          da meta mensal
                        </span>
                      </div>

                      <div className="space-y-3 mb-5">
                        <ProgressStrip value={dashboardStory.monthlyAchievementPct} color="#D4AF37" />
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-white/75 text-sm sm:text-base font-data uppercase tracking-[0.16em]">
                            {dashboardStory.month.realizadas} de {dashboardStory.monthlyMetaTotal}
                          </span>
                          <span className="text-xs text-white/55">Faltam {dashboardStory.monthlyGap} R1</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <span className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40">Assessores</span>
                          <div className="text-2xl font-display text-white mt-2">{dashboardStory.month.totalAssessores}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <span className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40">Semanas</span>
                          <div className="text-2xl font-display text-white mt-2">{dashboardStory.fullMonthWeeks}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <span className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40">Fórmula</span>
                          <div className="text-base font-data text-white mt-2">{dashboardStory.month.totalAssessores} x {dashboardStory.fullMonthWeeks}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
                back={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.12),_transparent_42%),linear-gradient(180deg,rgba(20,15,6,0.98),rgba(24,19,10,0.96))] backdrop-blur-xl border border-euro-gold/20 rounded-[28px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-euro-gold" />
                    <CardContent className="p-6 sm:p-7 lg:p-8 h-full flex flex-col overflow-y-auto">
                      <div className="mb-5">
                        <p className="text-[10px] font-data uppercase tracking-[0.24em] text-euro-gold/80 mb-2">Como calcula</p>
                        <h3 className="text-2xl font-data text-white uppercase tracking-[0.16em]">Meta mensal geral</h3>
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Fórmula</p>
                          <p className="text-lg font-data text-white">
                            {dashboardStory.month.totalAssessores} assessores x {dashboardStory.fullMonthWeeks} semanas = {dashboardStory.monthlyMetaTotal} R1
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">O que entra na conta</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            A base usa os assessores ativos dentro dos filtros atuais. O mês usa o total de semanas corridas do calendário do mês, não a média histórica.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Como ler</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Esse card mede o quanto o time entregou contra a meta consolidada do mês. Se hoje temos {dashboardStory.month.realizadas}, ainda faltam {dashboardStory.monthlyGap} R1 para a meta cheia.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />

              <FlipInsightCard
                cardId="pace"
                flippedCard={flippedCard}
                onToggle={handleToggleCard}
                className="xl:col-span-4 min-h-[340px]"
                front={
                  <Card className="h-full bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/65 backdrop-blur-xl border border-white/15 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#A855F7]" />
                    <CardContent className="p-6 space-y-5 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-data uppercase tracking-[0.22em] text-[#D8B4FE] mb-2">Pace do mês</p>
                          <h3 className="text-lg font-data text-white uppercase tracking-[0.15em]">Ritmo proporcional</h3>
                        </div>
                        <Clock className="w-5 h-5 text-[#A855F7] shrink-0 mt-1" />
                      </div>

                      <div className="flex items-end gap-3">
                        <span className="font-display text-[#D8B4FE] text-5xl sm:text-6xl leading-none">
                          {dashboardStory.paceAchievementPct.toFixed(0)}%
                        </span>
                        <span className="text-white/50 text-sm uppercase tracking-[0.16em] pb-2">
                          do pace
                        </span>
                      </div>

                      <div className="space-y-3">
                        <ProgressStrip value={dashboardStory.paceAchievementPct} color="#A855F7" />
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-white/75 text-sm sm:text-base font-data uppercase tracking-[0.16em]">
                            {dashboardStory.month.realizadas} vs {Math.round(dashboardStory.monthlyPaceTarget)}
                          </span>
                          <span className="text-xs text-white/55">
                            {dashboardStory.paceGap >= 0 ? `+${Math.round(dashboardStory.paceGap)} acima` : `${Math.abs(Math.round(dashboardStory.paceGap))} abaixo`}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-white/60 leading-relaxed">
                        Pace = meta mensal proporcional ao avanço do mês. Hoje consideramos {dashboardStory.elapsedMonthDays} de {dashboardStory.totalMonthDays} dias corridos.
                      </p>
                    </CardContent>
                  </Card>
                }
                back={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.12),_transparent_42%),linear-gradient(180deg,rgba(15,9,26,0.98),rgba(19,11,32,0.96))] backdrop-blur-xl border border-[#A855F7]/25 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#A855F7]" />
                    <CardContent className="p-6 h-full flex flex-col overflow-y-auto">
                      <div className="mb-5">
                        <p className="text-[10px] font-data uppercase tracking-[0.24em] text-[#D8B4FE] mb-2">Como calcula</p>
                        <h3 className="text-xl font-data text-white uppercase tracking-[0.16em]">Pace do mês</h3>
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Fórmula</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Pace = meta mensal geral x avanço do mês. Hoje o alvo proporcional está em {Math.round(dashboardStory.monthlyPaceTarget)} R1.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Como ler</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Serve para dizer se o time está no ritmo esperado para a data de hoje. Não mede o fechamento final do mês, mede se a este ponto do mês estamos adiantados ou atrasados.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />

              <FlipInsightCard
                cardId="assessors-hit-rate"
                flippedCard={flippedCard}
                onToggle={handleToggleCard}
                className="xl:col-span-4 min-h-[340px]"
                front={
                  <Card className="h-full bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/65 backdrop-blur-xl border border-white/15 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-green-500" />
                    <CardContent className="p-6 space-y-5 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-data uppercase tracking-[0.22em] text-green-300 mb-2">Atingimento dos assessores</p>
                          <h3 className="text-lg font-data text-white uppercase tracking-[0.15em]">Quem bateu a meta</h3>
                        </div>
                        <Target className="w-5 h-5 text-green-400 shrink-0 mt-1" />
                      </div>

                      <div className="flex items-end gap-3">
                        <span className="font-display text-green-400 text-6xl sm:text-7xl leading-none">
                          {dashboardStory.current.pctMeta.toFixed(0)}%
                        </span>
                        <span className="text-white/50 text-sm uppercase tracking-[0.16em] pb-2">
                          {dashboardStory.current.bateramMeta} de {dashboardStory.current.totalAssessores}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <ProgressStrip value={dashboardStory.current.pctMeta} color="#22C55E" />
                        <p className="text-sm text-white/60 leading-relaxed">
                          Esse card mostra o percentual de assessores que bateram a meta individual no recorte atual, e não o percentual da meta total de reuniões do time.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                }
                back={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_42%),linear-gradient(180deg,rgba(7,20,12,0.98),rgba(10,24,16,0.96))] backdrop-blur-xl border border-green-500/20 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-green-500" />
                    <CardContent className="p-6 h-full flex flex-col overflow-y-auto">
                      <div className="mb-5">
                        <p className="text-[10px] font-data uppercase tracking-[0.24em] text-green-300 mb-2">Como calcula</p>
                        <h3 className="text-xl font-data text-white uppercase tracking-[0.16em]">Atingimento dos assessores</h3>
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Fórmula</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Assessores que fizeram pelo menos {dashboardStory.current.metaTarget} R1 no período / total de assessores monitorados. Hoje isso é {dashboardStory.current.bateramMeta} / {dashboardStory.current.totalAssessores}.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Como ler</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            Esse indicador responde dispersão de performance. Ele mostra quantas pessoas bateram a régua mínima, não o quanto o time entregou da meta total consolidada.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />

              <FlipInsightCard
                cardId="individual-bar"
                flippedCard={flippedCard}
                onToggle={handleToggleCard}
                className="xl:col-span-4 min-h-[340px]"
                front={
                  <Card className="h-full bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/65 backdrop-blur-xl border border-white/15 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#06B6D4]" />
                    <CardContent className="p-6 space-y-5 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-data uppercase tracking-[0.22em] text-cyan-300 mb-2">Régua individual</p>
                          <h3 className="text-lg font-data text-white uppercase tracking-[0.15em]">Meta e destaque</h3>
                        </div>
                        <Users className="w-5 h-5 text-[#06B6D4] shrink-0 mt-1" />
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">
                            Meta individual
                          </div>
                          <div className="text-3xl font-display text-white leading-none">
                            {dashboardStory.current.metaTarget}
                          </div>
                          <p className="mt-2 text-xs text-white/55">
                            R1 por assessor em {periodDates.label.toLowerCase()}.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">
                            Top performer
                          </div>
                          <div className="text-3xl font-display text-white leading-none">
                            {dashboardStory.current.topPerformerTarget}
                          </div>
                          <p className="mt-2 text-xs text-white/55">
                            R1 por assessor para entrar na faixa destaque.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
                back={
                  <Card className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_42%),linear-gradient(180deg,rgba(8,16,28,0.98),rgba(11,21,33,0.96))] backdrop-blur-xl border border-cyan-400/20 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#06B6D4]" />
                    <CardContent className="p-6 h-full flex flex-col overflow-y-auto">
                      <div className="mb-5">
                        <p className="text-[10px] font-data uppercase tracking-[0.24em] text-cyan-300 mb-2">Como calcula</p>
                        <h3 className="text-xl font-data text-white uppercase tracking-[0.16em]">Régua individual</h3>
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Meta individual</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            A meta individual é {dashboardStory.current.metaTarget} R1 por assessor no recorte atual. Ela cresce conforme o número de semanas consideradas no período.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.18em] text-white/40 mb-2">Top performer</p>
                          <p className="text-sm text-white/70 leading-relaxed">
                            A faixa de destaque usa 2x a meta semanal do período. Hoje isso pede {dashboardStory.current.topPerformerTarget} R1 por assessor.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />
            </div>

            {/* Tabela de Ranking (Full Width) */}
            <div className="bg-euro-card/80 border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass relative group/table flex flex-col h-full max-h-[700px] mt-6">
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
                <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex items-center gap-2">
                  🏆 Ranking de Assessores
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExcel}
                  className="bg-euro-gold/10 hover:bg-euro-gold/20 text-euro-gold border-euro-gold/30 h-8 flex items-center gap-2 transition-all duration-300"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-data uppercase tracking-wider hidden sm:inline">Baixar Excel</span>
                </Button>
              </div>
              
              <div className="overflow-auto custom-scrollbar relative flex-1">
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 z-30">
                    <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                      <th onClick={() => handleSort('nome')} className="py-4 px-6 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center gap-2"># Assessor <SortIcon column="nome" /></div>
                      </th>
                      <th onClick={() => handleSort('time')} className="py-4 px-6 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell">
                        <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                      </th>
                      <th onClick={() => handleSort('realizadas')} className="py-4 px-6 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-center gap-2">Realizadas <SortIcon column="realizadas" /></div>
                      </th>
                      <th onClick={() => handleSort('agendadas')} className="py-4 px-6 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-2">Agendadas <SortIcon column="agendadas" /></div>
                      </th>
                      <th className="py-4 px-6 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {sortedRanking.map((assessor, idx) => (
                      <tr 
                        key={assessor.cod} 
                        className={cn(
                          "group transition-all text-xs sm:text-sm font-data",
                          idx < 3 && sortConfig.key === 'realizadas' && sortConfig.direction === 'desc' 
                            ? "bg-euro-gold/[0.08] hover:bg-euro-gold/15" 
                            : "even:bg-white/[0.02] hover:bg-white/[0.05]"
                        )}
                      >
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "font-display text-lg w-8 text-center tabular-nums",
                                idx < 3 && sortConfig.key === 'realizadas' && sortConfig.direction === 'desc'
                                  ? "text-euro-gold"
                                  : "text-white/45"
                              )}
                            >
                              {idx + 1}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-bold text-white uppercase tracking-tight truncate max-w-[200px] sm:max-w-md">
                                {assessor.nome}
                              </span>
                              <span className="text-[9px] text-white/40 uppercase sm:hidden">{assessor.time}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-white/70 font-medium hidden sm:table-cell">
                          {assessor.time}
                        </td>
                        <td className="py-3 px-6 text-center text-white font-display text-xl sm:text-2xl">
                          {assessor.realizadas}
                        </td>
                        <td className="py-3 px-6 text-center text-white/70 tabular-nums hidden sm:table-cell text-lg">
                          {assessor.agendadas}
                        </td>
                        <td className="py-3 px-6 text-center">
                          <Badge 
                            className={cn(
                              "px-3 sm:px-4 py-1.5 text-[9px] sm:text-xs uppercase border", 
                              assessor.statusColor
                            )}
                          >
                            {assessor.statusText}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {sortedRanking.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-white/30 font-data">
                          Nenhum dado encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="monthlyCompare" className="mt-0 border-none p-0 outline-none">
            {monthlyCompareSummary && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-euro-card/70 backdrop-blur-xl border border-cyan-400/20 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#06B6D4]" />
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-data uppercase tracking-[0.22em] text-cyan-300 mb-2">Recorte atual</p>
                          <h3 className="text-lg font-data text-white uppercase tracking-[0.14em]">
                            {selectedAssessorMeta ? selectedAssessorMeta.name : "Visão geral"}
                          </h3>
                        </div>
                        <BarChart3 className="w-5 h-5 text-[#06B6D4] mt-1 shrink-0" />
                      </div>
                      <div className="flex items-end gap-3">
                        <span className="font-display text-white text-5xl leading-none">{monthlyCompareSummary.latest.realizadas}</span>
                        <span className="text-white/55 text-sm uppercase tracking-[0.18em] pb-2">
                          em {monthlyCompareSummary.latest.monthLabel}
                        </span>
                      </div>
                      <div className="text-sm text-white/60 leading-relaxed">
                        {monthlyCompareSummary.previous
                          ? `Variação vs ${monthlyCompareSummary.previous.monthLabel}: ${monthlyCompareSummary.latest.deltaAbs >= 0 ? "+" : ""}${monthlyCompareSummary.latest.deltaAbs} R1 (${monthlyCompareSummary.latest.deltaPct.toFixed(0)}%).`
                          : "Primeiro mês disponível no histórico selecionado."}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.18),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-euro-card/70 backdrop-blur-xl border border-euro-gold/20 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-euro-gold" />
                    <CardContent className="p-6 space-y-4">
                      <p className="text-[10px] font-data uppercase tracking-[0.22em] text-euro-gold mb-2">Melhor mês da janela</p>
                      <div className="flex items-end gap-3">
                        <span className="font-display text-euro-gold text-5xl leading-none">{monthlyCompareSummary.best.realizadas}</span>
                        <span className="text-white/55 text-sm uppercase tracking-[0.18em] pb-2">
                          em {monthlyCompareSummary.best.monthLabel}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Meta do mês: {monthlyCompareSummary.best.totalMeta} R1. Atingimento do time: {monthlyCompareSummary.best.pctMetaTime.toFixed(0)}%.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-euro-card/70 backdrop-blur-xl border border-[#A855F7]/25 rounded-[26px] shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#A855F7]" />
                    <CardContent className="p-6 space-y-4">
                      <p className="text-[10px] font-data uppercase tracking-[0.22em] text-[#D8B4FE] mb-2">Média dos 12 meses</p>
                      <div className="flex items-end gap-3">
                        <span className="font-display text-[#E9D5FF] text-5xl leading-none">
                          {monthlyCompareSummary.averageRealizadas.toFixed(1)}
                        </span>
                        <span className="text-white/55 text-sm uppercase tracking-[0.18em] pb-2">R1 / mês</span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">
                        No mês atual, {monthlyCompareSummary.latest.assessoresMeta} de {monthlyCompareSummary.latest.totalAssessores} assessores bateram a meta.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-euro-card/75 backdrop-blur-xl border border-white/15 rounded-[26px] shadow-2xl overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-data text-euro-gold tracking-[0.18em] uppercase">
                      Evolução Mensal de R1
                    </CardTitle>
                    <p className="text-sm text-white/45">
                      Comparativo mês contra mês de realizadas, agendadas e percentual da meta do time.
                    </p>
                    <p className="text-[11px] text-white/30 uppercase tracking-[0.18em]">
                      Clique em um mês do gráfico para abrir o detalhamento narrativo.
                    </p>
                  </CardHeader>
                  <CardContent className="h-[420px] px-4 pb-5">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={monthlyComparisonData}
                        margin={{ top: 20, right: 24, left: 0, bottom: 4 }}
                        onClick={(state: any) => {
                          const monthKey = state?.activePayload?.[0]?.payload?.monthKey;
                          if (monthKey) setSelectedMonthlyChartMonthKey(monthKey);
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "var(--font-data, monospace)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15,18,24,0.96)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "14px",
                            color: "#fff",
                          }}
                          labelFormatter={(label) => label}
                          formatter={(value: number, name: string) => {
                            if (name === "% Meta Time") return [`${value.toFixed(0)}%`, name];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontFamily: "var(--font-data, monospace)", fontSize: "11px" }} />
                        <Bar yAxisId="left" dataKey="realizadas" name="Realizadas" fill="#FAC017" radius={[6, 6, 0, 0]} maxBarSize={34} />
                        <Bar yAxisId="left" dataKey="agendadas" name="Agendadas" fill="#A855F7" radius={[6, 6, 0, 0]} maxBarSize={34} />
                        <Line yAxisId="right" type="monotone" dataKey="pctMetaTime" name="% Meta Time" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: "#22C55E" }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="bg-euro-card/80 border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass relative flex flex-col">
                  <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                      <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
                        Tabela de Comparação Mensal
                      </h3>
                      <p className="text-xs text-white/40 mt-1">
                        Últimos 12 meses considerando os filtros atuais de time e assessor.
                      </p>
                      <p className="text-[11px] text-white/28 mt-2 uppercase tracking-[0.18em]">
                        Clique em uma linha para abrir o detalhe por assessor daquele mês.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse relative">
                      <thead className="sticky top-0 z-30">
                        <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                          <th className="py-4 px-5 font-bold">Mês</th>
                          <th className="py-4 px-5 font-bold text-center">Realizadas</th>
                          <th className="py-4 px-5 font-bold text-center hidden md:table-cell">Agendadas</th>
                          <th className="py-4 px-5 font-bold text-center hidden lg:table-cell">Indicação</th>
                          <th className="py-4 px-5 font-bold text-center">Meta</th>
                          <th className="py-4 px-5 font-bold text-center">% Meta</th>
                          <th className="py-4 px-5 font-bold text-center hidden md:table-cell">Assessores</th>
                          <th className="py-4 px-5 font-bold text-center hidden xl:table-cell">Bateram Meta</th>
                          <th className="py-4 px-5 font-bold text-center">Vs Mês Ant.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {[...monthlyComparisonData].reverse().map((month, idx) => (
                          <tr
                            key={month.monthKey}
                            onClick={() => setSelectedMonthlyTableMonthKey(month.monthKey)}
                            className={cn(
                              "text-xs sm:text-sm font-data even:bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer",
                              idx === 0 && "bg-cyan-500/[0.06]"
                            )}
                          >
                            <td className="py-3 px-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-white uppercase tracking-tight">{month.monthLabel}</span>
                                <span className="text-[10px] text-white/35 capitalize">{month.monthFullLabel}</span>
                              </div>
                            </td>
                            <td className="py-3 px-5 text-center text-white font-display text-xl">{month.realizadas}</td>
                            <td className="py-3 px-5 text-center text-white/70 hidden md:table-cell">{month.agendadas}</td>
                            <td className="py-3 px-5 text-center text-white/70 hidden lg:table-cell">{month.indicacao}</td>
                            <td className="py-3 px-5 text-center text-white/90">{month.totalMeta}</td>
                            <td className="py-3 px-5 text-center">
                              <span className={cn(
                                "font-display text-lg",
                                month.pctMetaTime >= 100 ? "text-green-400" : month.pctMetaTime >= 70 ? "text-euro-gold" : "text-white"
                              )}>
                                {month.pctMetaTime.toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-3 px-5 text-center text-white/70 hidden md:table-cell">{month.totalAssessores}</td>
                            <td className="py-3 px-5 text-center text-white/70 hidden xl:table-cell">
                              {month.assessoresMeta} / {month.totalAssessores}
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase border",
                                month.deltaAbs > 0
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : month.deltaAbs < 0
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-white/5 text-white/55 border-white/10"
                              )}>
                                {month.deltaAbs > 0 ? "+" : ""}{month.deltaAbs} ({month.deltaPct > 0 ? "+" : ""}{month.deltaPct.toFixed(0)}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedMonthlyTableDetail} onOpenChange={(open) => !open && setSelectedMonthlyTableMonthKey(null)}>
          <DialogContent className="bg-[#0A0E14] border-white/10 text-white sm:max-w-[1120px] max-h-[88vh] overflow-y-auto custom-scrollbar">
            {selectedMonthlyTableDetail && (
              <>
                <DialogHeader className="border-b border-white/10 pb-4">
                  <DialogTitle className="flex flex-col gap-2">
                    <span className="text-[11px] font-data uppercase tracking-[0.24em] text-cyan-300">Detalhe por assessor</span>
                    <span className="text-2xl font-display text-white tracking-wide capitalize">
                      {selectedMonthlyTableDetail.monthFullLabel}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-white/[0.03] border-white/10">
                      <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-data uppercase tracking-[0.22em] text-white/45">R1 Realizadas</p>
                        <p className="font-display text-4xl text-white">{selectedMonthlyTableDetail.realizadas}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/[0.03] border-white/10">
                      <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-data uppercase tracking-[0.22em] text-white/45">Meta do mês</p>
                        <p className="font-display text-4xl text-euro-gold">{selectedMonthlyTableDetail.totalMeta}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/[0.03] border-white/10">
                      <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-data uppercase tracking-[0.22em] text-white/45">% Meta do time</p>
                        <p className="font-display text-4xl text-green-400">{selectedMonthlyTableDetail.pctMetaTime.toFixed(0)}%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/[0.03] border-white/10">
                      <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-data uppercase tracking-[0.22em] text-white/45">Assessores na meta</p>
                        <p className="font-display text-4xl text-cyan-300">
                          {selectedMonthlyTableDetail.assessoresMeta}/{selectedMonthlyTableDetail.totalAssessores}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-data uppercase tracking-[0.16em] text-euro-gold">Assessores do mês</h3>
                        <p className="text-sm text-white/45">
                          Ranking completo com produção, agendamento, indicação e aderência à meta individual.
                        </p>
                      </div>
                      <Badge className="bg-white/5 text-white/70 border border-white/10">
                        Meta individual: {selectedMonthlyTableDetail.metaIndividual} R1
                      </Badge>
                    </div>

                    <div className="overflow-auto custom-scrollbar">
                      <table className="w-full min-w-[760px] border-collapse">
                        <thead>
                          <tr className="text-[10px] font-data uppercase tracking-widest text-white/45 border-b border-white/10">
                            <th className="py-3 px-3 text-left">#</th>
                            <th className="py-3 px-3 text-left">Assessor</th>
                            <th className="py-3 px-3 text-center">Time</th>
                            <th className="py-3 px-3 text-center">Realizadas</th>
                            <th className="py-3 px-3 text-center">Agendadas</th>
                            <th className="py-3 px-3 text-center">Indicação</th>
                            <th className="py-3 px-3 text-center">% Meta</th>
                            <th className="py-3 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {selectedMonthlyTableDetail.assessorRows.map((assessor, index) => (
                            <tr key={`${selectedMonthlyTableDetail.monthKey}-${assessor.cod}`} className="hover:bg-white/[0.03]">
                              <td className="py-3 px-3 text-white/45 font-display">{index + 1}</td>
                              <td className="py-3 px-3">
                                <div className="flex flex-col">
                                  <span className="text-white font-semibold">{assessor.nome}</span>
                                  <span className="text-[11px] text-white/35">{assessor.cod}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center text-white/70">{assessor.time}</td>
                              <td className="py-3 px-3 text-center font-display text-white text-lg">{assessor.realizadas}</td>
                              <td className="py-3 px-3 text-center text-white/70">{assessor.agendadas}</td>
                              <td className="py-3 px-3 text-center text-white/70">{assessor.indicacao}</td>
                              <td className="py-3 px-3 text-center">
                                <span className={cn(
                                  "font-display text-lg",
                                  assessor.pctMetaIndividual >= 100 ? "text-green-400" : assessor.pctMetaIndividual >= 70 ? "text-euro-gold" : "text-white"
                                )}>
                                  {assessor.pctMetaIndividual.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge className={cn(
                                  "border",
                                  assessor.bateuMeta
                                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                                    : "bg-white/5 text-white/60 border-white/10"
                                )}>
                                  {assessor.bateuMeta ? "Meta batida" : "Em construção"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedMonthlyChartDetail} onOpenChange={(open) => !open && setSelectedMonthlyChartMonthKey(null)}>
          <DialogContent className="bg-[#0A0E14] border-white/10 text-white sm:max-w-[1080px] max-h-[88vh] overflow-y-auto custom-scrollbar">
            {selectedMonthlyChartDetail && (
              <>
                <DialogHeader className="border-b border-white/10 pb-4">
                  <DialogTitle className="flex flex-col gap-2">
                    <span className="text-[11px] font-data uppercase tracking-[0.24em] text-euro-gold">Leitura do mês</span>
                    <span className="text-2xl font-display text-white tracking-wide capitalize">
                      {selectedMonthlyChartDetail.monthFullLabel}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                  <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(250,192,23,0.16),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] border-white/10 overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-data uppercase tracking-[0.24em] text-euro-gold">Storytelling executivo</p>
                          <h3 className="text-2xl font-display text-white">
                            {selectedMonthlyChartDetail.realizadas} R1 em {selectedMonthlyChartDetail.monthLabel}
                          </h3>
                        </div>
                        <Trophy className="w-6 h-6 text-euro-gold shrink-0" />
                      </div>
                      <p className="text-base text-white/75 leading-relaxed">
                        {selectedMonthlyChartDetail.pctMetaTime >= 100
                          ? `O mês fechou acima da meta do time, com ${selectedMonthlyChartDetail.pctMetaTime.toFixed(0)}% de atingimento e ${selectedMonthlyChartDetail.assessoresMeta} assessores entregando a régua mínima.`
                          : `O mês fechou com ${selectedMonthlyChartDetail.pctMetaTime.toFixed(0)}% da meta geral. ${selectedMonthlyChartDetail.assessoresMeta} assessores bateram a régua individual e o foco agora é destravar o miolo do time.`}
                      </p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.2em] text-white/40">Meta geral</p>
                          <p className="font-display text-3xl text-euro-gold">{selectedMonthlyChartDetail.totalMeta}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.2em] text-white/40">Agendadas</p>
                          <p className="font-display text-3xl text-[#D8B4FE]">{selectedMonthlyChartDetail.agendadas}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.2em] text-white/40">Indicação</p>
                          <p className="font-display text-3xl text-cyan-300">{selectedMonthlyChartDetail.indicacao}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[10px] font-data uppercase tracking-[0.2em] text-white/40">Meta individual</p>
                          <p className="font-display text-3xl text-white">{selectedMonthlyChartDetail.metaIndividual}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                      <div className="mb-4">
                        <h3 className="text-lg font-data uppercase tracking-[0.16em] text-euro-gold">Ranking por time</h3>
                        <p className="text-sm text-white/45">Quem puxou o mês e como cada time converteu a própria base.</p>
                      </div>
                      <div className="space-y-3">
                        {selectedMonthlyChartDetail.teamRanking.map((team, index) => (
                          <div key={`${selectedMonthlyChartDetail.monthKey}-${team.team}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "w-8 h-8 rounded-full border flex items-center justify-center font-display text-sm",
                                  index === 0 ? "border-euro-gold text-euro-gold" : "border-white/10 text-white/55"
                                )}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-white font-semibold uppercase tracking-wide">{team.team}</p>
                                  <p className="text-[11px] text-white/35">{team.bateramMeta} de {team.assessores} assessores na meta</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-display text-2xl text-white">{team.realizadas}</p>
                                <p className="text-[11px] text-white/35">{team.pctMetaAssessores.toFixed(0)}% do time na meta</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                      <div className="mb-4">
                        <h3 className="text-lg font-data uppercase tracking-[0.16em] text-euro-gold">Top 3 assessores</h3>
                        <p className="text-sm text-white/45">A turma que empurrou o mês para cima no recorte selecionado.</p>
                      </div>
                      <div className="space-y-3">
                        {selectedMonthlyChartDetail.topAssessors.map((assessor, index) => (
                          <div key={`${selectedMonthlyChartDetail.monthKey}-${assessor.cod}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "w-9 h-9 rounded-full border flex items-center justify-center font-display text-base",
                                  index === 0 ? "border-euro-gold text-euro-gold" : "border-white/10 text-white/60"
                                )}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-white font-semibold">{assessor.nome}</p>
                                  <p className="text-[11px] text-white/35 uppercase tracking-wide">{assessor.time}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-display text-2xl text-white">{assessor.realizadas}</p>
                                <p className="text-[11px] text-white/35">{assessor.pctMetaIndividual.toFixed(0)}% da meta individual</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

// ----------------------------------------------------------------------------
// Componente de Apresentação TV (Tela Cheia, Slides Automáticos)
// ----------------------------------------------------------------------------
function TVPresentationMode({ 
  data, 
  superRankingData, 
  superRankingYear, 
  onSuperRankingYearChange, 
  isSuperRankingLoading,
  onClose 
}: { 
  data: any; 
  superRankingData: any[]; 
  superRankingYear: string; 
  onSuperRankingYearChange: (year: string) => void; 
  isSuperRankingLoading: boolean;
  onClose?: () => void; 
}) {
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(() => [
    { kind: "effort" as const, title: "Semana Atual", data: data.comparative.currentWeek, accent: "#06B6D4" },
    { kind: "effort" as const, title: "Semana Anterior", data: data.comparative.prevWeek, accent: "#A855F7" },
    { kind: "effort" as const, title: "Acumulado do Mês", data: data.comparative.currentMonth, accent: "#EAB308" },
    { kind: "superRanking" as const, title: "Semestral", accent: "#FAC017", tvMode: "semester" as const },
    { kind: "superRanking" as const, title: "Anual", accent: "#FAC017", tvMode: "year" as const },
    { kind: "clusterTables" as const, title: "Clusters A/B", accent: "#FAC017", clusters: ["A", "B"] as const },
    { kind: "clusterTables" as const, title: "Clusters C/D", accent: "#FAC017", clusters: ["C", "D"] as const },
  ], [data]);

  const currentSlide = slides[slideIndex];
  const slideDurationMs = currentSlide.kind === "clusterTables" ? 30000 : 15000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, slideDurationMs);
    return () => clearTimeout(timer);
  }, [slideIndex, slideDurationMs, slides.length]);
  
  const top5 = useMemo(() => {
    if (currentSlide.kind !== "effort") return [];
    return [...currentSlide.data.ranking].sort((a, b) => b.realizadas - a.realizadas).slice(0, 5);
  }, [currentSlide]);

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0A0A0A] flex flex-col p-8 lg:p-12 overflow-hidden animate-in fade-in duration-1000">
      <ImpactfulBackground opacity={0.6} />
      
      {/* ProgressBar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
        <div 
          className="h-full bg-euro-gold ease-linear"
          key={slideIndex}
          style={{ width: "100%", animation: `progress ${slideDurationMs}ms linear` }}
        />
        <style>{`
          @keyframes progress {
            0% { width: 0%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>

      {currentSlide.kind === "effort" ? (
        <div className="relative z-10 flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <CalendarCheck className="w-10 h-10 text-euro-gold" />
            <h1 className="text-4xl font-data text-white tracking-[0.2em] uppercase">
              Esforço R1 <span className="text-euro-gold font-light">· {currentSlide.title}</span>
            </h1>
          </div>
          {onClose && (
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="text-white/50 hover:text-white hover:bg-white/10"
            >
              <X className="w-8 h-8" />
            </Button>
          )}
        </div>
      ) : (
        <>
          {onClose && (
            <div className="absolute top-6 right-6 z-20">
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-8 h-8" />
              </Button>
            </div>
          )}
        </>
      )}

      <div className="relative z-10 flex-1 flex flex-col justify-between">
        {currentSlide.kind === "effort" ? (
          <>
            <div className="grid grid-cols-4 gap-8">
              <Card className="bg-euro-card/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 flex flex-col items-center text-center">
                  <span className="text-sm font-data text-white/50 uppercase tracking-widest mb-4">R1 Realizadas</span>
                  <span className="font-display text-white tracking-tighter" style={{ fontSize: "6rem", lineHeight: "1" }}>{currentSlide.data.realizadas}</span>
                </div>
              </Card>
              <Card className="bg-euro-card/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 flex flex-col items-center text-center">
                  <span className="text-sm font-data text-white/50 uppercase tracking-widest mb-4">Reuniões em Aberto</span>
                  <span className="font-display text-white tracking-tighter" style={{ fontSize: "6rem", lineHeight: "1" }}>{currentSlide.data.agendadas}</span>
                </div>
              </Card>
              <Card className="bg-euro-card/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 flex flex-col items-center text-center">
                  <span className="text-sm font-data text-white/50 uppercase tracking-widest mb-4">Indicação</span>
                  <span className="font-display text-white tracking-tighter" style={{ fontSize: "6rem", lineHeight: "1" }}>{currentSlide.data.indicacao}</span>
                </div>
              </Card>
              <Card className="bg-euro-card/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 flex flex-col items-center text-center">
                  <span className="text-sm font-data text-white/50 uppercase tracking-widest mb-4">Atingimento</span>
                  <span className="font-display text-green-400 tracking-tighter" style={{ fontSize: "6rem", lineHeight: "1" }}>{currentSlide.data.pctMeta.toFixed(0)}%</span>
                </div>
              </Card>
            </div>

            <div className="flex-1 flex flex-col justify-center mt-12">
              <h2 className="text-2xl font-data text-white/70 uppercase tracking-widest text-center mb-12">
                🏆 Top 5 Assessores
              </h2>
              <div className="flex items-end justify-center gap-6">
                {top5.map((assessor, idx) => {
                  const orderVal = [3, 2, 4, 1, 5][idx] || 99;
                  const widthVal = ["300px", "260px", "260px", "220px", "220px"][idx] || "200px";
                  const heightVal = ["420px", "340px", "280px", "220px", "200px"][idx] || "180px";

                  const colorClass = [
                    "border-euro-gold text-euro-gold shadow-[0_0_50px_rgba(212,175,55,0.25)]",
                    "border-[#C0C0C0] text-[#C0C0C0] shadow-[0_0_40px_rgba(192,192,192,0.15)]",
                    "border-[#CD7F32] text-[#CD7F32] shadow-[0_0_30px_rgba(205,127,50,0.15)]",
                    "border-white/20 text-white/50",
                    "border-white/10 text-white/30"
                  ][idx];
                  const ringColor = [
                    "border-euro-gold", "border-[#C0C0C0]", "border-[#CD7F32]", "border-white/20", "border-white/10"
                  ][idx];

                  return (
                    <div 
                      key={assessor.cod} 
                      className="flex flex-col items-center justify-end transition-all duration-1000 animate-in slide-in-from-bottom-10 fade-in group"
                      style={{ 
                        animationDelay: `${idx * 150}ms`,
                        order: orderVal,
                        width: widthVal,
                        minWidth: widthVal
                      }}
                    >
                      <div className="text-center mb-4 w-full">
                        <span className={cn(
                          "text-xl font-data uppercase tracking-widest font-bold block truncate px-2 mb-1",
                          idx === 0 ? "text-euro-gold" : idx === 1 ? "text-[#C0C0C0]" : idx === 2 ? "text-[#CD7F32]" : "text-white/70"
                        )}>
                          {assessor.nome}
                        </span>
                        <span className="text-xs text-white/50 uppercase tracking-wider block truncate px-2">
                          {assessor.time}
                        </span>
                      </div>

                      <div className={cn(
                        "relative w-28 h-28 rounded-full bg-euro-inset border-4 overflow-hidden z-20 mb-[-28px] shadow-2xl",
                        ringColor
                      )}>
                        {assessor.foto ? (
                          <img src={assessor.foto} alt={assessor.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center text-4xl font-display text-white/50">
                            {assessor.nome.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div 
                        className="w-full rounded-t-3xl bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border-x border-t border-white/20 flex flex-col items-center pt-10 pb-6 px-4 shadow-2xl relative"
                        style={{ height: heightVal }}
                      >
                        <div className="w-full grid grid-cols-2 gap-2 bg-black/30 rounded-xl p-3 border border-white/5 mt-2">
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-4xl sm:text-5xl font-display text-white leading-none mb-1">{assessor.realizadas}</span>
                            <span className="text-[9px] text-euro-gold uppercase tracking-widest font-bold">Realizadas</span>
                          </div>
                          <div className="flex flex-col items-center justify-center text-center border-l border-white/10">
                            <span className="text-4xl sm:text-5xl font-display text-white/50 leading-none mb-1">{assessor.agendadas}</span>
                            <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold leading-[1.2]">Reuniões<br/>em Aberto</span>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <div className={cn(
                            "w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-display shadow-lg bg-black/40",
                            colorClass
                          )}>
                            {idx + 1}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {top5.length === 0 && (
                  <div className="text-white/30 font-data text-2xl uppercase tracking-widest">
                    Nenhum assessor com R1 realizada
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden pt-0">
            <div className="max-w-[1900px] mx-auto h-full overflow-hidden">
              {isSuperRankingLoading && superRankingData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 font-data text-3xl uppercase tracking-widest">
                  Carregando Super Ranking...
                </div>
              ) : (
                <>
                  {currentSlide.kind === "superRanking" ? (
                    <SuperRanking
                      data={superRankingData as any}
                      selectedYear={superRankingYear}
                      onYearChange={onSuperRankingYearChange}
                      variant="tv"
                      tvMode={(currentSlide as any).tvMode}
                    />
                  ) : (
                    <ClusterRankingTablesTv
                      data={superRankingData as any}
                      selectedYear={superRankingYear}
                      clusters={(currentSlide as any).clusters}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
