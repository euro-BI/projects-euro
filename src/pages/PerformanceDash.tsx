
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Check,
  ChevronsUpDown,
  Search,
  Star,
  ChevronRight,
  LayoutDashboard,
  BarChart3,
  PieChart,
  ArrowUpCircle,
  User,
  Users,
  Banknote,
  Coins,
  Wallet,
  TrendingUp,
  Target,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Calendar,
  Maximize2,
  Minimize2,
  Percent,
  Briefcase,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { MultiSelect } from "@/components/MultiSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandList as UICommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// Correct import for Select
import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectItem as UISelectItem,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue,
} from "@/components/ui/select";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Dashboard Components

import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import RankingRace from "@/components/dashboard/RankingRace";
import EvolutionTrend, { MetricConfig } from "@/components/dashboard/EvolutionTrend";
import AssessorSheet from "@/components/dashboard/AssessorSheet";
import AdvisorRevenueTable from "@/components/dashboard/AdvisorRevenueTable";
import SuperRanking from "@/components/dashboard/SuperRanking";
import FinancialPlanningDash from "@/components/dashboard/FinancialPlanningDash";
import CockpitDash from "@/components/dashboard/CockpitDash";
import RevenueEvolution from "@/components/dashboard/RevenueEvolution";
import FundingEvolution from "@/components/dashboard/FundingEvolution";
import RankingEvolution from "@/components/dashboard/RankingEvolution";
import RankingTable from "@/components/dashboard/RankingTable";
import ForecastAnalysis from "@/components/dashboard/ForecastAnalysis";
import ComparisonView from "@/components/dashboard/ComparisonView";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { ActivationDetailsDialog } from "@/components/dashboard/ActivationDetailsDialog";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

const REVENUE_METRICS: Record<string, MetricConfig> = {
  total: { label: "Receita Total", roa: 0.0108, field: "receita_total", icon: <Coins className="w-3.5 h-3.5" /> },
  invest: { 
    label: "Receita Investimento", 
    roa: 0.0087,
    fields: ["asset_m_1", "receita_b3", "receitas_estruturadas", "receita_cetipados", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receita_renda_fixa"],
    icon: <Briefcase className="w-3.5 h-3.5" />
  },
  cross: { 
    label: "Receita Cross-Sell", 
    roa: 0.0021,
    fields: ["receita_seguros", "receita_previdencia", "receita_compromissadas", "receita_cambio", "receitas_offshore", "receita_consorcios"],
    icon: <ArrowRightLeft className="w-3.5 h-3.5" />
  },
  asset: { label: "Asset", roa: 0.0002, field: "asset_m_1" },
  b3: { label: "B3", roa: 0.0020, field: "receita_b3" },
  estruturadas: { label: "Estruturados", roa: 0.0035, field: "receitas_estruturadas" },
  cetipados: { label: "Cetipados", roa: 0.0005, field: "receita_cetipados" },
  ofertas: { label: "Ofertas (Fundos e RF)", roa: 0.0100, fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"] },
  renda_fixa: { label: "Renda Fixa", roa: 0.0015, field: "receita_renda_fixa" },
  seguros: { label: "Seguros", roa: 0.0007, field: "receita_seguros" },
  previdencia: { label: "Previdência", roa: 0.0001, field: "receita_previdencia" },
  compromissadas: { label: "Compromissadas", roa: 0.0001, field: "receita_compromissadas" },
  cambio: { label: "Câmbio PJ", roa: 0.0001, field: "receita_cambio" },
  offshore: { label: "Offshore", roa: 0.0002, field: "receitas_offshore" },
  consorcios: { label: "Consórcios", roa: 0.0009, field: "receita_consorcios" },
};

const KPI_METRICS: Record<string, MetricConfig> = {
  roa: { label: "ROA", mode: "percent", icon: <Percent className="w-3.5 h-3.5" /> },
  custodia: { label: "Custódia Líquida", field: "custodia_net", mode: "currency", icon: <Wallet className="w-3.5 h-3.5" /> },
  clientes: { label: "Total de Clientes", field: "total_clientes", mode: "number", icon: <Users className="w-3.5 h-3.5" /> },
};

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

export default function PerformanceDash() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedAssessorId, setSelectedAssessorId] = useState<string>("all");
  const [isAssessorPopoverOpen, setIsAssessorPopoverOpen] = useState(false);
  const [selectedAssessor, setSelectedAssessor] = useState<AssessorResumo | null>(null);
  const [selectedAssessorRank, setSelectedAssessorRank] = useState<number | undefined>(undefined);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("geral");
  
  // RANKING TAB STATE (Independent of global filters)
  const [rankingYear, setRankingYear] = useState<string>(() => {
    const current = new Date().getFullYear();
    return current < 2026 ? "2026" : current.toString();
  });

  const formatCurrencyValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mi";
    } else {
      return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
    }
  };

  const formatMetaValue = (val: number, decimals: number = 2) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " Mi";
    } else {
      return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " K";
    }
  };

  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();

  // Determine effective assessor ID based on role and active tab
  const effectiveAssessorId = useMemo(() => {
    if (userRole === "user" && userCode) {
      // In Ranking tab, user can see all
      if (activeTab === "ranking") {
        return selectedAssessorId;
      }
      // In other tabs, FORCE user code
      return userCode;
    }
    return selectedAssessorId;
  }, [userRole, userCode, activeTab, selectedAssessorId]);

  // Determine effective team based on role and active tab
  const effectiveTeam = useMemo(() => {
     return selectedTeam;
  }, [selectedTeam]);

  // Apply user filter if role is user
  React.useEffect(() => {
    if (userRole === "user" && userCode) {
      // For Ranking tab, we don't want to filter by assessor ID
      if (activeTab !== "ranking") {
        setSelectedAssessorId(userCode);
      } else {
        // When entering Ranking, default to showing ALL
        if (selectedAssessorId === userCode) {
             setSelectedAssessorId("all");
        }
        if (selectedTeam !== "all") {
             setSelectedTeam("all");
        }
      }
    }
  }, [userRole, userCode, activeTab]);

  // Toggle maximization and handle ESC key
  const toggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsMaximized(true);
        (window as any).isDashMaximized = true;
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsMaximized(false);
          (window as any).isDashMaximized = false;
        }
      }
    } catch (err) {
      console.error(`Error attempting to toggle full-screen mode: ${err}`);
      // Fallback for cases where full-screen is not supported/allowed
      const nextState = !isMaximized;
      setIsMaximized(nextState);
      (window as any).isDashMaximized = nextState;
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsMaximized(isFull);
      (window as any).isDashMaximized = isFull;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 is handled by browser, but we can detect the change via fullscreenchange
      if (e.key === "Escape" && isMaximized) {
        // Fullscreen exit via ESC is native, but we ensure our state is synced
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  // Fetch unique months, teams, and assessors for filters
  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-filters"],
    queryFn: async () => {
      // 1. Fetch active teams
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      // 2. Get latest date to fetch current assessors/teams (HEAVY OPTIMIZATION)
      const { data: latestEntry } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      
      const latestDate = latestEntry?.data_posicao;

      // 3. Fetch ONLY labels for filters from the latest month (much faster than fetching all history)
      const { data: latestData, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("time, cod_assessor, nome_assessor")
        .eq("data_posicao", latestDate);
      
      if (error) throw error;

      // 4. Fetch unique months/years (very light query)
      const { data: monthData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false });
      
      const allMonths = Array.from(new Set(monthData?.map((d: any) => d.data_posicao) || []));
      const years = Array.from(new Set(allMonths.map(m => parseISO(m).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));
      
      // Filter teams to only include active ones
      const teams = Array.from(new Set(latestData.map((d: any) => d.time)))
        .filter(teamName => teamName && activeTeamNames.has(teamName));
      
      // Map of unique assessors from latest month who belong to active teams
      const assessorMap = new Map<string, { name: string, teams: Set<string> }>();
      latestData.forEach((d: any) => {
        if (d.cod_assessor && d.nome_assessor && d.time && activeTeamNames.has(d.time)) {
          if (!assessorMap.has(d.cod_assessor)) {
            assessorMap.set(d.cod_assessor, { name: d.nome_assessor, teams: new Set() });
          }
          assessorMap.get(d.cod_assessor)?.teams.add(d.time);
        }
      });
      
      const assessors = Array.from(assessorMap.entries())
        .map(([id, info]) => ({ id, name: info.name, teams: Array.from(info.teams) }));
      const activeAssessorIds = new Set(assessors.map(a => a.id));
      
      return { allMonths, years, teams, assessors, activeAssessorIds };
    }
  });

  // Filter months based on selected year
  const filteredMonths = useMemo(() => {
    if (!filtersData?.allMonths) return [];
    return filtersData.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [filtersData, selectedYear]);

  // Set initial month when year or filteredMonths change
  React.useEffect(() => {
    if (filteredMonths.length > 0) {
      // If current selected month is not in the new year, pick the latest month of that year
      const isStillValid = filteredMonths.includes(selectedMonth);
      if (!isStillValid) {
        setSelectedMonth(filteredMonths[0]);
      }
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  // Fetch dashboard data (Single Month)
  const { data: dashData, isLoading: isDashLoading } = useQuery({
    queryKey: ["dash-data", selectedMonth, effectiveTeam, effectiveAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (effectiveTeam !== "all") {
        query = query.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      }

      const { data, error } = await query.order("pontos_totais_acumulado", { ascending: false });
      if (error) throw error;

      // Fetch teams data for photos
      const { data: teamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url");

      // Fetch previous month for deltas
      const prevMonth = format(subMonths(parseISO(selectedMonth), 1), "yyyy-MM-01");
      let prevQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", prevMonth);
      
      if (effectiveTeam !== "all") {
        prevQuery = prevQuery.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        prevQuery = prevQuery.eq("cod_assessor", effectiveAssessorId);
      }
      
      const { data: prevData } = await prevQuery;

      const teamPhotoMap = new Map<string, string>();
      teamsData?.forEach((t: any) => {
        if (t.time && t.foto_url) {
          teamPhotoMap.set(t.time.toUpperCase(), t.foto_url);
        }
      });

      const filteredCurrent = data as AssessorResumo[];
      const filteredPrevious = (prevData || []) as AssessorResumo[];

      return {
        current: filteredCurrent,
        previous: filteredPrevious,
        teamPhotos: teamPhotoMap
      };
    }
  });

  // Fetch Yearly Data for Funding Trend
  const { data: yearlyData, isLoading: isYearlyLoading } = useQuery({
    queryKey: ["dash-yearly-data", selectedYear, effectiveTeam, effectiveAssessorId],
    enabled: !!selectedYear,
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);
      
      if (effectiveTeam !== "all") {
        query = query.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      }

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      
      return data as AssessorResumo[];
    }
  });

  // Fetch Yearly Data for Ranking Tab (Independent of global selectedYear)
  const { data: rankingData, isLoading: isRankingLoading } = useQuery({
    queryKey: ["dash-ranking-data", rankingYear, effectiveTeam, effectiveAssessorId],
    enabled: !!rankingYear && !!filtersData,
    queryFn: async () => {
      const startDate = `${rankingYear}-01-01`;
      const endDate = `${rankingYear}-12-31`;
      
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);
      
      if (effectiveTeam !== "all") {
        query = query.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      }

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;

      const activeIds = filtersData?.activeAssessorIds;
      if (activeIds) {
        return (data as AssessorResumo[]).filter(a => a.cod_assessor && activeIds.has(a.cod_assessor));
      }

      return data as AssessorResumo[];
    }
  });

  // Fetch Previous Yearly Data for YoY Comparison
  const { data: prevYearlyData, isLoading: isPrevYearlyLoading } = useQuery({
    queryKey: ["dash-prev-yearly-data", selectedYear, effectiveTeam, effectiveAssessorId],
    enabled: !!selectedYear,
    queryFn: async () => {
      const prevYear = (parseInt(selectedYear) - 1).toString();
      const startDate = `${prevYear}-01-01`;
      const endDate = `${prevYear}-12-31`;
      
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);
      
      if (effectiveTeam !== "all") {
        query = query.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      }

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      
      return data as AssessorResumo[];
    }
  });

  // Fetch Financial Planning Data (Latest Month + 12 Months Trend) independent of filters
  const { data: fpData, isLoading: isFPLoading } = useQuery({
    queryKey: ["fp-data", effectiveTeam, effectiveAssessorId],
    queryFn: async () => {
      // 1. Get Latest Date
      const { data: latestEntry } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      
      if (!latestEntry) return { latestDate: "", current: [], trend: [], teamPhotos: new Map() };
      
      const latestDate = latestEntry.data_posicao;
      // Start date for 12 months trend (current month included, so go back 11 months)
      const startDate = format(subMonths(parseISO(latestDate), 11), "yyyy-MM-01");

      // 2. Fetch Current Month Data (for KPIs/Tables)
      let currentQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", latestDate);

      if (effectiveTeam !== "all") {
        currentQuery = currentQuery.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        currentQuery = currentQuery.eq("cod_assessor", effectiveAssessorId);
      }

      const { data: currentData, error: currentError } = await currentQuery;
      if (currentError) throw currentError;

      // 3. Fetch Trend Data (Last 12 Months)
      let trendQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", latestDate)
        .order("data_posicao", { ascending: true });

      if (effectiveTeam !== "all") {
        trendQuery = trendQuery.eq("time", effectiveTeam);
      }

      if (effectiveAssessorId !== "all") {
        trendQuery = trendQuery.eq("cod_assessor", effectiveAssessorId);
      }

      const { data: trendData, error: trendError } = await trendQuery;
      if (trendError) throw trendError;

      const activeIds = filtersData?.activeAssessorIds;
      const filteredCurrent = activeIds 
        ? (currentData as AssessorResumo[]).filter(a => a.cod_assessor && activeIds.has(a.cod_assessor))
        : (currentData as AssessorResumo[]);
      
      const filteredTrend = activeIds
        ? (trendData as AssessorResumo[]).filter(a => a.cod_assessor && activeIds.has(a.cod_assessor))
        : (trendData as AssessorResumo[]);

      // 4. Fetch Team Photos
      const { data: teamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url");

      const teamPhotoMap = new Map<string, string>();
      teamsData?.forEach((t: any) => {
        if (t.time && t.foto_url) {
          teamPhotoMap.set(t.time.toUpperCase(), t.foto_url);
        }
      });

      return {
        latestDate,
        current: filteredCurrent,
        trend: filteredTrend,
        teamPhotos: teamPhotoMap
      };
    }
  });

  // Headline Calculations
  const stats = useMemo(() => {
    if (!dashData?.current.length) return null;

    const current = dashData.current;
    const prev = dashData.previous;

    const totalRevenue = current.reduce((acc, curr) => acc + curr.receita_total, 0);
    const prevRevenue = prev.reduce((acc, curr) => acc + curr.receita_total, 0);
    const revenueMeta = current.reduce((acc, curr) => acc + curr.meta_receita, 0);
    const revenueAchievement = (totalRevenue / (revenueMeta || 1)) * 100;

    const totalFunding = current.reduce((acc, curr) => acc + curr.captacao_liquida_total, 0);
    const totalEntries = current.reduce((acc, curr) => acc + curr.captacao_entradas, 0);
    const totalExits = current.reduce((acc, curr) => acc + curr.captacao_saidas, 0);
    const totalTransfersIn = current.reduce((acc, curr) => acc + (curr.captacao_entrada_transf || 0), 0);
    const totalTransfersOut = current.reduce((acc, curr) => acc + (curr.captacao_saida_transf || 0), 0);
    const fundingMeta = current.reduce((acc, curr) => acc + (curr.meta_captacao || 0), 0);
    const fundingAchievement = (totalFunding / (fundingMeta || 1)) * 100;

    const totalCustody = current.reduce((acc, curr) => acc + curr.custodia_net, 0);
    const totalClients = current.reduce((acc, curr) => acc + curr.total_clientes, 0);
    const avgTicket = totalClients > 0 ? totalCustody / totalClients : 0;

    const totalFP300k = current.reduce((acc, curr) => acc + (curr.total_fp_300k || 0), 0);
    const metaFP300k = current.reduce((acc, curr) => acc + (curr.meta_fp300k || 0), 0);
    const fp300kAchievement = (totalFP300k / (metaFP300k || 1)) * 100;

    const totalActivations300k = current.reduce((acc, curr) => acc + (curr.ativacao_300k || 0) + (curr.ativacao_1kk || 0), 0);
    const metaActivations300k = current.reduce((acc, curr) => acc + (curr.meta_ativacao_300k || 0), 0);
    const activationsAchievement = (totalActivations300k / (metaActivations300k || 1)) * 100;

    const leader = current[0];
    
    // NEW ROA CALCULATION: (Total Revenue / Total Custody) * 12
    const calculatedROA = totalCustody > 0 ? (totalRevenue / totalCustody) * 12 : 0;
    const metaROA = 0.0108; // 1.08%
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
        roa: calculatedROA * 100, // Store as percentage for display
        roaMeta: metaROA * 100,
        roaAchievement: roaAchievement,
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
      leader: {
        name: leader.nome_assessor || "Assessor",
        points: leader.pontos_totais_acumulado,
      },
      meta: {
        activeAssessors: current.length,
        avgROA: calculatedROA * 100,
        monthName: format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR }),
        teamName: effectiveTeam === "all" ? "Todos os Times" : effectiveTeam,
      }
    };
  }, [dashData, selectedMonth, effectiveTeam]);

  const handleAssessorClick = (assessor: AssessorResumo, rank?: number) => {
    setSelectedAssessor(assessor);
    setSelectedAssessorRank(rank);
    setIsSheetOpen(true);
  };

  const isDataLoading = isFiltersLoading || isDashLoading || isYearlyLoading || isPrevYearlyLoading || isFPLoading;

  if (!stats || !fpData) {
    return (
      <PageLayout className={cn(
        "bg-transparent text-[#E8E8E0] font-ui px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500 pt-24"
      )}>
        <LoadingOverlay isLoading={true} />
        <ImpactfulBackground opacity={0.3} />
      </PageLayout>
    );
  }

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isDataLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-12 relative z-10">
        <div className="relative flex items-center justify-center w-full mb-4 sm:mb-8 px-2 min-h-[32px]">
          {/* Back Action */}
          <div className="absolute left-2 sm:left-0 top-1 sm:top-0 z-50 sm:z-10">
            {/* Desktop Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dash")}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group hidden sm:flex items-center gap-2 h-8"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-data uppercase tracking-wider">Voltar</span>
            </Button>
            
            {/* Mobile icon button (smaller, discrete) */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dash")}
              className="sm:hidden glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold rounded-full w-8 h-8 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>

          <h1 className="text-base sm:text-xl font-data text-euro-gold tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-80 text-center leading-tight sm:leading-normal">
            Performance Comercial
          </h1>
          
          <div className="absolute right-2 sm:right-0 top-0 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group h-8 hidden sm:flex"
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
                  <span className="text-[10px] font-data uppercase tracking-wider">Maximizar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-12">
          {/* FILTERS & NAVIGATION HEADER - FLOATING GLASS DOCK STYLE */}
          <div className="sticky top-4 z-50 mx-auto w-full sm:max-w-fit px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2 p-2 sm:p-1.5 rounded-2xl sm:rounded-full bg-[#0F1218]/90 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20">
              
              {/* NAVIGATION TABS */}
              <TabsList className="bg-transparent border-none flex-shrink-0 h-9 p-0 gap-1 mx-2 w-full sm:w-auto flex justify-center overflow-x-auto flex-nowrap scrollbar-hide">
                <TabsTrigger 
                  value="geral" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none whitespace-nowrap"
                >
                  Geral
                </TabsTrigger>
                <TabsTrigger 
                  value="financial" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Financial
                </TabsTrigger>
                <TabsTrigger 
                  value="ranking" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Ranking
                </TabsTrigger>
                <TabsTrigger 
                  value="forecast" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none hidden sm:inline-flex"
                >
                  Forecast
                </TabsTrigger>
                {userRole !== 'user' && (
                  <TabsTrigger 
                    value="comparativo" 
                    className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none hidden sm:inline-flex"
                  >
                    Batalha
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* FILTERS SECTION (COMPACT MODE) */}
              <div className="flex items-center flex-shrink-0">
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
                  userRole={activeTab === "ranking" ? "admin" : userRole}
                />
              </div>
            </div>
          </div>

          <TabsContent value="geral" className="space-y-12 mt-0 border-none p-0 outline-none">
            {/* MANCHETE (TIER 1) - 5 CARDS INSPIRADOS NA IMAGEM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* CLIENTES ATIVOS */}
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
                      {stats.clients.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-data text-[#E8E8E0]">
                      R$ {(stats.clients.ticket / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k
                    </span>
                    <span className="text-xs font-ui text-white uppercase tracking-tight mt-1">Ticket Médio</span>
                  </div>
                </CardContent>
              </Card>

              {/* RECEITA TOTAL */}
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
                          {/* Sessão de Receita */}
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-4">
                            <div className="flex justify-between items-end">
                              <div>
                                <span className="text-xs font-data text-white/90 uppercase tracking-wider">Receita Realizada</span>
                                <p className="text-lg font-display text-[#F5F5F0]">R$ {formatCurrencyValue(stats.revenue.total)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-data text-white/90 uppercase tracking-wider">Meta Receita</span>
                                <p className="text-sm font-data text-euro-gold">R$ {formatMetaValue(stats.revenue.meta)}</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-data">
                                <span className="text-white/80">ATINGIMENTO RECEITA</span>
                                <span className={cn(
                                  stats.revenue.achievement >= 100 ? "text-green-500" : stats.revenue.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                                )}>{stats.revenue.achievement.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    stats.revenue.achievement >= 100 ? "bg-green-500" : stats.revenue.achievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                                  )}
                                  style={{ width: `${Math.min(stats.revenue.achievement, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Sessão de ROA */}
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-4">
                            <div className="flex justify-between items-end">
                              <div>
                                <span className="text-xs font-data text-white/90 uppercase tracking-wider">ROA Atual (Anualizado)</span>
                                <p className="text-lg font-display text-[#F5F5F0]">{stats.revenue.roa.toFixed(2)}%</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-data text-white/90 uppercase tracking-wider">Meta ROA</span>
                                <p className="text-sm font-data text-euro-gold">{stats.revenue.roaMeta.toFixed(2)}%</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-data">
                                <span className="text-white/80">ATINGIMENTO ROA</span>
                                <span className={cn(
                                  stats.revenue.roaAchievement >= 100 ? "text-green-500" : stats.revenue.roaAchievement >= 70 ? "text-euro-gold" : "text-red-500"
                                )}>{stats.revenue.roaAchievement.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    stats.revenue.roaAchievement >= 100 ? "bg-green-500" : stats.revenue.roaAchievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                                  )}
                                  style={{ width: `${Math.min(stats.revenue.roaAchievement, 100)}%` }}
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
                      R$ {formatCurrencyValue(stats.revenue.total)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-data text-[#E8E8E0]">ROA: {stats.revenue.roa.toFixed(2)}%</span>
                      <span className={cn(
                        "text-sm font-data",
                        stats.revenue.achievement >= 100 ? "text-green-500" : stats.revenue.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                      )}>
                        {stats.revenue.achievement.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stats.revenue.achievement >= 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : stats.revenue.achievement >= 70 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        )}
                        style={{ width: `${Math.min(stats.revenue.achievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CUSTÓDIA */}
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
                      R$ {(stats.custody.total / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-data text-[#E8E8E0]">FP300k+: {stats.custody.fpAchievement.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stats.custody.fpAchievement >= 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : stats.custody.fpAchievement >= 50 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        )}
                        style={{ width: `${Math.min(stats.custody.fpAchievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CAPTAÇÃO LÍQUIDA */}
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
                            <p className="text-base font-display">R$ {formatCurrencyValue(stats.funding.entries)}</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-red-400">
                              <ArrowDownRight className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Saídas</span>
                            </div>
                            <p className="text-base font-display">R$ {formatCurrencyValue(stats.funding.exits)}</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-blue-400">
                              <ArrowRightLeft className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Transf. Ent.</span>
                            </div>
                            <p className="text-base font-display">R$ {formatCurrencyValue(stats.funding.transfersIn)}</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-orange-400">
                              <ArrowRightLeft className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Transf. Saí.</span>
                            </div>
                            <p className="text-base font-display">R$ {formatCurrencyValue(stats.funding.transfersOut)}</p>
                          </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-end">
                          <div>
                            <span className="text-xs font-data text-[#5C5C50] uppercase">Resultado Líquido</span>
                            <p className="text-2xl font-display text-[#F5F5F0]">R$ {formatCurrencyValue(stats.funding.total)}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-data text-[#5C5C50] uppercase">Meta</span>
                            <p className="text-base font-data text-euro-gold">R$ {formatMetaValue(stats.funding.meta)}</p>
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
                      R$ {formatCurrencyValue(stats.funding.total)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-data text-[#E8E8E0] truncate max-w-[70%]">Meta (R$ {formatMetaValue(stats.funding.meta, 1)}):</span>
                      <span className={cn(
                        "text-sm font-data",
                        stats.funding.achievement >= 100 ? "text-green-500" : stats.funding.achievement >= 70 ? "text-euro-gold" : "text-red-500"
                      )}>
                        {stats.funding.achievement.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stats.funding.achievement >= 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : stats.funding.achievement >= 70 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        )}
                        style={{ width: `${Math.min(stats.funding.achievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ATIVAÇÕES 300K+ */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                      Ativações 300k+
                    </CardTitle>
                    <ActivationDetailsDialog 
                      selectedMonth={selectedMonth}
                      assessorId={effectiveAssessorId}
                      team={effectiveTeam}
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
                      {stats.activations.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-data text-[#E8E8E0] truncate max-w-[70%]">Meta ({stats.activations.meta} ativ.):</span>
                      <span className={cn(
                        "text-sm font-data",
                        stats.activations.achievement >= 80 ? "text-green-500" : stats.activations.achievement >= 50 ? "text-euro-gold" : "text-red-500"
                      )}>
                        {stats.activations.achievement.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stats.activations.achievement >= 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : stats.activations.achievement >= 50 ? "bg-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        )}
                        style={{ width: `${Math.min(stats.activations.achievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* ANÁLISES DE EVOLUÇÃO */}
            <div className="hidden sm:flex flex-col gap-8">
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[450px]">
                <RevenueEvolution 
                  data={yearlyData || []} 
                  previousYearData={prevYearlyData || []} 
                />
              </Card>
              
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[450px]">
                <EvolutionTrend 
                  data={yearlyData || []} 
                  previousYearData={prevYearlyData || []} 
                  metrics={KPI_METRICS}
                  defaultMetric="roa"
                  title="Evolução"
                  mode="percent"
                  icon={<LayoutDashboard className="w-4 h-4" />}
                />
              </Card>

              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[450px]">
                <FundingEvolution 
                  data={yearlyData || []} 
                />
              </Card>
            </div>

            {/* DETALHE (TIER 3) - NEW BEAUTIFUL TABLE (Moved below revenue evolution) */}
            <AdvisorRevenueTable 
              data={dashData.current} 
              teamPhotos={dashData.teamPhotos}
              onAssessorClick={handleAssessorClick}
              selectedMonth={selectedMonth}
            />

            {/* CONTEXTO (TIER 2) */}
          </TabsContent>

          <TabsContent value="financial" className="space-y-12 mt-0 border-none p-0 outline-none">
            <FinancialPlanningDash
              currentData={fpData?.current || []}
              yearlyData={fpData?.trend || []}
              selectedYear={fpData?.latestDate ? parseISO(fpData.latestDate).getFullYear().toString() : selectedYear}
              selectedMonth={fpData?.latestDate || selectedMonth}
              teamPhotos={fpData?.teamPhotos}
            />
          </TabsContent>


          <TabsContent value="ranking" className="space-y-12 mt-0 border-none p-0 outline-none">
            <SuperRanking 
              data={rankingData || []} 
              selectedYear={rankingYear}
              onYearChange={setRankingYear}
            />
            
            <div className="hidden sm:block">
              <RankingEvolution 
                data={rankingData || []} 
                selectedYear={rankingYear}
              />
            </div>
            
            {/* Detalhamento de pontos por cluster - apenas desktop */}
            <div className="hidden sm:block">
              <RankingTable 
                data={rankingData || []} 
                selectedYear={rankingYear}
              />
            </div>
            
            {/* Ranking Race - apenas desktop */}
            <div className="hidden sm:block bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
              <div className="min-h-[400px]">
                <RankingRace selectedYear={rankingYear} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-12 mt-0 border-none p-0 outline-none">
            <ForecastAnalysis 
              data={fpData?.trend || []} 
              selectedYear={selectedYear}
              userRole={userRole}
              userCode={userCode}
              effectiveAssessorId={effectiveAssessorId}
            />
          </TabsContent>

          {userRole !== 'user' && (
            <TabsContent value="comparativo" className="space-y-12 mt-0 border-none p-0 outline-none">
              <ComparisonView />
            </TabsContent>
          )}


        </Tabs>
      </div>

      <AssessorSheet 
        assessor={selectedAssessor}
        rank={selectedAssessorRank}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </PageLayout>
  );
}
