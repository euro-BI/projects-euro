import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, isEqual, startOfDay, differenceInCalendarWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import SuperRanking from "@/components/dashboard/SuperRanking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Maximize2, Minimize2, CalendarCheck, Clock, ThumbsUp, Target, TrendingUp, TrendingDown, Users, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Play, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type PeriodType = "currentWeek" | "prevWeek" | "currentMonth";

export default function WeeklyEffortsDash() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicTV = location.pathname === "/tv/esforco-semanal";

  const [isMaximized, setIsMaximized] = useState(false);
  const [showPresentation, setShowPresentation] = useState(isPublicTV);
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

  const today = startOfDay(new Date());

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

      const todayStr = format(today, "yyyy-MM-dd");

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
        ranking,
        zerados,
        totalAssessores
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

  const isLoading = isMetaLoading || isDataLoading;

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

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 bg-euro-card/60 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl mx-auto w-fit max-w-full">
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
              <SelectTrigger className="w-[200px] h-9 bg-black/20 border-white/10 text-white text-xs font-data uppercase">
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

        {processedData && (
          <>
            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
              {/* R1 Realizadas */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#06B6D4] opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    R1 Realizadas
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-4 h-4 text-[#06B6D4]" />
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight">
                      {processedData.current.realizadas}
                    </span>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    No período selecionado
                  </span>
                </CardContent>
              </Card>

              {/* R1 Agendadas/Em Aberto */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#A855F7] opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    R1 Agendadas
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-[#A855F7]/10 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#A855F7]" />
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight">
                      {processedData.current.agendadas}
                    </span>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    Futuras no período
                  </span>
                </CardContent>
              </Card>

              {/* Novos Negócios (Indicação) */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#EAB308] opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    R1 de Indicação
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-[#EAB308]/10 flex items-center justify-center shrink-0">
                    <ThumbsUp className="w-4 h-4 text-[#EAB308]" />
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight">
                      {processedData.current.indicacao}
                    </span>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    Origem "Indicação"
                  </span>
                </CardContent>
              </Card>

              {/* % Bateu a Meta */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    Atingimento
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-green-400" />
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-green-400 leading-tight">
                      {processedData.current.pctMeta.toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    Assessores com ≥ 1 R1
                  </span>
                </CardContent>
              </Card>

              {/* SemAtual x SemAnterior */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group flex flex-col">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    Comparativo R1
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    {processedData.comparative.currentWeek.realizadas > processedData.comparative.prevWeek.realizadas ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : processedData.comparative.currentWeek.realizadas < processedData.comparative.prevWeek.realizadas ? (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-euro-gold" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5 flex-1 flex flex-col justify-center">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight">
                        {processedData.comparative.currentWeek.realizadas}
                      </span>
                      <span className="text-xs text-white/40 mb-1">vs {processedData.comparative.prevWeek.realizadas} ant.</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    Semana atual vs anterior
                  </span>
                </CardContent>
              </Card>

              {/* Total Mensal */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group flex flex-col">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-80" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0 px-5">
                  <CardTitle className="text-[10px] sm:text-xs font-data text-white/70 uppercase tracking-widest leading-tight">
                    Acumulado Mês
                  </CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5 flex-1 flex flex-col justify-center">
                  <div className="flex flex-col py-2 border-b border-white/5 mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight">
                        {processedData.comparative.currentMonth.realizadas}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                    Total realizadas no mês
                  </span>
                </CardContent>
              </Card>
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
                        <div className="flex items-center gap-2">Assessor <SortIcon column="nome" /></div>
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
                            {idx < 3 && sortConfig.key === 'realizadas' && sortConfig.direction === 'desc' && (
                              <span className="font-display text-euro-gold text-lg w-5 text-center">
                                {idx + 1}
                              </span>
                            )}
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
    { kind: "superRanking" as const, title: "Mensal", accent: "#FAC017", tvMode: "month" as const },
    { kind: "superRanking" as const, title: "Semestral", accent: "#FAC017", tvMode: "semester" as const },
    { kind: "superRanking" as const, title: "Anual", accent: "#FAC017", tvMode: "year" as const },
  ], [data]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 15000); // 15 segundos por tela
    return () => clearInterval(timer);
  }, [slides.length]);

  const currentSlide = slides[slideIndex];
  
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
          className="h-full bg-euro-gold transition-all duration-[15000ms] ease-linear"
          key={slideIndex}
          style={{ width: "100%", animation: "progress 15s linear" }}
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
                <SuperRanking
                  data={superRankingData as any}
                  selectedYear={superRankingYear}
                  onYearChange={onSuperRankingYearChange}
                  variant="tv"
                  tvMode={(currentSlide as any).tvMode}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
