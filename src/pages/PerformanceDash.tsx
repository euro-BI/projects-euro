
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Briefcase
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("geral");

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
      // Fetch active teams first
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
      
      // Filter teams to only include active ones
      const teams = Array.from(new Set(data.map((d: any) => d.time)))
        .filter(teamName => teamName && activeTeamNames.has(teamName));
      
      // Map of unique assessors: cod_assessor -> { name, teams }
      const assessorMap = new Map<string, { name: string, teams: Set<string> }>();
      data.forEach((d: any) => {
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
        .filter(a => a.teams.length > 0) // Only include assessors in at least one active team
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return { allMonths, years, teams, assessors };
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
    queryKey: ["dash-data", selectedMonth, selectedTeam, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      // Fetch active teams first
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (selectedTeam !== "all") {
        query = query.eq("time", selectedTeam);
      } else {
        // Filter by active teams if "all" is selected
        query = query.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        query = query.eq("cod_assessor", selectedAssessorId);
      }

      const { data, error } = await query.order("pontos_totais_acumulado", { ascending: false });
      if (error) throw error;

      // Fetch teams data for photos (already has active teams in context)
      const { data: teamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url")
        .eq("status", "ATIVO");

      const teamPhotoMap = new Map<string, string>();
      teamsData?.forEach((t: any) => {
        if (t.time && t.foto_url) {
          teamPhotoMap.set(t.time.toUpperCase(), t.foto_url);
        }
      });

      // Fetch previous month for deltas
      const prevMonth = format(subMonths(parseISO(selectedMonth), 1), "yyyy-MM-01");
      let prevQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", prevMonth);
      
      if (selectedTeam !== "all") {
        prevQuery = prevQuery.eq("time", selectedTeam);
      } else {
        prevQuery = prevQuery.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        prevQuery = prevQuery.eq("cod_assessor", selectedAssessorId);
      }
      
      const { data: prevData } = await prevQuery;

      return {
        current: data as AssessorResumo[],
        previous: (prevData || []) as AssessorResumo[],
        teamPhotos: teamPhotoMap
      };
    }
  });

  // Fetch Yearly Data for Funding Trend
  const { data: yearlyData, isLoading: isYearlyLoading } = useQuery({
    queryKey: ["dash-yearly-data", selectedYear, selectedTeam, selectedAssessorId],
    enabled: !!selectedYear,
    queryFn: async () => {
      // Fetch active teams first
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
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
      return data as AssessorResumo[];
    }
  });

  // Fetch Previous Yearly Data for YoY Comparison
  const { data: prevYearlyData, isLoading: isPrevYearlyLoading } = useQuery({
    queryKey: ["dash-prev-yearly-data", selectedYear, selectedTeam, selectedAssessorId],
    enabled: !!selectedYear,
    queryFn: async () => {
      // Fetch active teams first
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      const prevYear = (parseInt(selectedYear) - 1).toString();
      const startDate = `${prevYear}-01-01`;
      const endDate = `${prevYear}-12-31`;
      
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
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
      return data as AssessorResumo[];
    }
  });

  // Fetch Financial Planning Data (Latest Month + 12 Months Trend) independent of filters
  const { data: fpData, isLoading: isFPLoading } = useQuery({
    queryKey: ["fp-data", selectedTeam, selectedAssessorId],
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

      // Active teams logic
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      // 2. Fetch Current Month Data (for KPIs/Tables)
      let currentQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", latestDate);

      if (selectedTeam !== "all") {
        currentQuery = currentQuery.eq("time", selectedTeam);
      } else {
        currentQuery = currentQuery.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        currentQuery = currentQuery.eq("cod_assessor", selectedAssessorId);
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

      if (selectedTeam !== "all") {
        trendQuery = trendQuery.eq("time", selectedTeam);
      } else {
        trendQuery = trendQuery.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        trendQuery = trendQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: trendData, error: trendError } = await trendQuery;
      if (trendError) throw trendError;

      // 4. Fetch Team Photos
      const { data: teamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url")
        .eq("status", "ATIVO");

      const teamPhotoMap = new Map<string, string>();
      teamsData?.forEach((t: any) => {
        if (t.time && t.foto_url) {
          teamPhotoMap.set(t.time.toUpperCase(), t.foto_url);
        }
      });

      return {
        latestDate,
        current: currentData as AssessorResumo[],
        trend: trendData as AssessorResumo[],
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

    const totalActivations300k = current.reduce((acc, curr) => acc + (curr.ativacao_300k || 0), 0);
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
        teamName: selectedTeam === "all" ? "Todos os Times" : selectedTeam,
      }
    };
  }, [dashData, selectedMonth, selectedTeam]);

  const handleAssessorClick = (assessor: AssessorResumo) => {
    setSelectedAssessor(assessor);
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
      "bg-transparent text-[#E8E8E0] font-ui px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-8" : "pt-24"
    )}>
      <LoadingOverlay isLoading={isDataLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-12 relative z-10">
        {/* CENTRALIZED TOP TITLE WITH MAXIMIZE BUTTON */}
        <div className="relative flex items-center justify-center w-full mb-8">
          <h1 className="text-xl font-data text-euro-gold tracking-[0.4em] uppercase opacity-80">
            Performance Geral Eurostock
          </h1>
          
          <div className="absolute right-0">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group"
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
          {/* FILTERS & NAVIGATION HEADER - FLOATING GLASS DOCK STYLE */}
          <div className="sticky top-4 z-50 mx-auto max-w-fit">
            <div className="flex flex-row items-center gap-2 p-1.5 rounded-full bg-[#0F1218]/80 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-[#0F1218]/90">
              
              {/* NAVIGATION TABS */}
              <TabsList className="bg-transparent border-none flex-shrink-0 h-9 p-0 gap-1 mx-2">
                <TabsTrigger 
                  value="geral" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
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
                  value="cockpit" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Cockpit
                </TabsTrigger>
                <TabsTrigger 
                  value="ranking" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Ranking
                </TabsTrigger>
                <TabsTrigger 
                  value="forecast" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Forecast
                </TabsTrigger>
                <TabsTrigger 
                  value="comparativo" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                >
                  Batalha
                </TabsTrigger>
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
                    <span className="text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center">
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
                        <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
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
                                <p className="text-lg font-display text-[#F5F5F0]">R$ {(stats.revenue.total / 1000).toLocaleString("pt-BR")}k</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-data text-white/90 uppercase tracking-wider">Meta Receita</span>
                                <p className="text-sm font-data text-euro-gold">R$ {(stats.revenue.meta / 1000).toLocaleString("pt-BR")}k</p>
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
                    <span className="text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {(stats.revenue.total / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-data text-[#E8E8E0]">ROA: {stats.revenue.roa.toFixed(2)}%</span>
                      <span className={cn(
                        "text-xs font-data",
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
                    <span className="text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {(stats.custody.total / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-data text-[#E8E8E0]">FP300k+: {stats.custody.fpAchievement.toFixed(0)}%</span>
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
                        <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
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
                            <p className="text-base font-display">R$ {(stats.funding.entries / 1000).toLocaleString("pt-BR")}k</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-red-400">
                              <ArrowDownRight className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Saídas</span>
                            </div>
                            <p className="text-base font-display">R$ {(stats.funding.exits / 1000).toLocaleString("pt-BR")}k</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-blue-400">
                              <ArrowRightLeft className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Transf. Ent.</span>
                            </div>
                            <p className="text-base font-display">R$ {(stats.funding.transfersIn / 1000).toLocaleString("pt-BR")}k</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-orange-400">
                              <ArrowRightLeft className="w-4 h-4" />
                              <span className="text-xs font-data uppercase tracking-wider">Transf. Saí.</span>
                            </div>
                            <p className="text-base font-display">R$ {(stats.funding.transfersOut / 1000).toLocaleString("pt-BR")}k</p>
                          </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-end">
                          <div>
                            <span className="text-xs font-data text-[#5C5C50] uppercase">Resultado Líquido</span>
                            <p className="text-2xl font-display text-[#F5F5F0]">R$ {(stats.funding.total / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} Mi</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-data text-[#5C5C50] uppercase">Meta</span>
                            <p className="text-base font-data text-euro-gold">R$ {(stats.funding.meta / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} Mi</p>
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
                    <span className="text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {(stats.funding.total / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-data text-[#E8E8E0] truncate max-w-[70%]">Meta (R$ {(stats.funding.meta / 1000000).toFixed(1)}M):</span>
                      <span className={cn(
                        "text-xs font-data",
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
                  <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
                    Ativações 300k+
                  </CardTitle>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center leading-tight">
                      {stats.activations.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-data text-[#E8E8E0] truncate max-w-[70%]">Meta ({stats.activations.meta} ativ.):</span>
                      <span className={cn(
                        "text-xs font-data",
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
            <div className="flex flex-col gap-8">
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

          <TabsContent value="cockpit" className="space-y-12 mt-0 border-none p-0 outline-none">
            <CockpitDash
              currentData={dashData.current}
              yearlyData={yearlyData || []}
              selectedYear={selectedYear}
            />
          </TabsContent>

          <TabsContent value="ranking" className="space-y-12 mt-0 border-none p-0 outline-none">
            <SuperRanking 
              data={yearlyData || []} 
              selectedYear={selectedYear}
            />
            
            <RankingEvolution 
              data={yearlyData || []} 
              selectedYear={selectedYear}
            />
            
            <RankingTable 
              data={yearlyData || []} 
              selectedYear={selectedYear}
            />
            
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
              <div className="min-h-[400px]">
                <RankingRace selectedYear={selectedYear} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-12 mt-0 border-none p-0 outline-none">
            <ForecastAnalysis 
              data={fpData?.trend || []} 
              selectedYear={selectedYear}
            />
          </TabsContent>

          <TabsContent value="comparativo" className="space-y-12 mt-0 border-none p-0 outline-none">
            <ComparisonView />
          </TabsContent>


        </Tabs>
      </div>

      <AssessorSheet 
        assessor={selectedAssessor}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </PageLayout>
  );
}
