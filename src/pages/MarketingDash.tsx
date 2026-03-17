
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  TrendingUp, 
  BarChart3, 
  MousePointer2, 
  Users, 
  Wallet,
  Layers,
  Search,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Target,
  RefreshCcw,
  Zap,
  Info,
  HelpCircle,
  Calculator
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ComposedChart,
  Line
} from 'recharts';
import { format, parseISO, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FacebookAdsData } from "@/types/dashboard";
import { motion, AnimatePresence } from "framer-motion";
import { MarketingFilters } from "@/components/dashboard/MarketingFilters";
import { MetricHelpDialog } from "@/components/dashboard/MetricHelpDialog";

type MetricType = "impressions" | "inline_link_clicks" | "results";

export default function MarketingDash() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressions");
  const [searchTerm, setSearchTerm] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedAdForModal, setSelectedAdForModal] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'ctr',
    direction: 'desc'
  });

  // Fetch Filters Data
  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["marketing-filters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_ads_data")
        .select("date_start, campaign_name");
      
      if (error) throw error;

      const allDates = Array.from(new Set(data.map(d => d.date_start))).sort().reverse();
      const allMonths = Array.from(new Set(allDates.map(d => format(parseISO(d), "yyyy-MM-01")))).sort().reverse();
      const years = Array.from(new Set(allMonths.map(m => parseISO(m).getFullYear().toString()))).sort().reverse();
      const campaigns = Array.from(new Set(data.map(d => d.campaign_name))).sort();

      return { allMonths, years, campaigns };
    }
  });

  const filteredMonths = useMemo(() => {
    if (!filtersData?.allMonths) return [];
    return filtersData.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [filtersData, selectedYear]);

  // Synchronization between Year and Month
  React.useEffect(() => {
    if (filteredMonths.length > 0) {
      const isStillValid = filteredMonths.includes(selectedMonth);
      if (!isStillValid) {
        setSelectedMonth(filteredMonths[0]);
      }
    }
  }, [filteredMonths, selectedYear]);

  // Fetch Dashboard Data
  const { data: adsData, isLoading: isDataLoading } = useQuery({
    queryKey: ["marketing-data", selectedMonth, selectedYear, selectedCampaign],
    enabled: selectedCampaign !== "all" || !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("facebook_ads_data")
        .select("*");
      
      if (selectedCampaign !== "all") {
        query = query.eq("campaign_name", selectedCampaign);
      } else if (selectedMonth) {
        const start = selectedMonth;
        const end = format(endOfMonth(parseISO(selectedMonth)), "yyyy-MM-dd");
        query = query.gte("date_start", start).lte("date_start", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FacebookAdsData[];
    }
  });

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

  // Advanced Metrics Calculation
  const stats = useMemo(() => {
    if (!adsData) return null;

    const filtered = adsData.filter(d => {
      const matchesSearch = d.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            d.ad_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    const totalSpend = filtered.reduce((acc, curr) => acc + (Number(curr.spend) || 0), 0);
    const totalImpressions = filtered.reduce((acc, curr) => acc + (Number(curr.impressions) || 0), 0);
    const totalClicks = filtered.reduce((acc, curr) => acc + (Number(curr.inline_link_clicks) || 0), 0);
    const totalReach = filtered.reduce((acc, curr) => acc + (Number(curr.reach) || 0), 0);

    // Advanced Stats
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const frequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    return { totalSpend, totalImpressions, totalClicks, totalReach, ctr, cpm, cpc, frequency, filtered };
  }, [adsData, searchTerm]);

  // Ranking de Anúncios Logic
  const adRanking = useMemo(() => {
    if (!stats) return [];
    
    // Group by Ad Name
    const adMap = new Map();
    stats.filtered.forEach(d => {
      const name = d.ad_name;
      if (!adMap.has(name)) {
        adMap.set(name, { 
          name, 
          campaign: d.campaign_name,
          spend: 0, 
          clicks: 0, 
          impressions: 0, 
          reach: 0 
        });
      }
      const entry = adMap.get(name);
      entry.spend += Number(d.spend) || 0;
      entry.clicks += Number(d.inline_link_clicks) || 0;
      entry.impressions += Number(d.impressions) || 0;
      entry.reach += Number(d.reach) || 0;
    });

    return Array.from(adMap.values())
      .map(ad => {
        const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
        const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0;
        const freq = ad.reach > 0 ? ad.impressions / ad.reach : 0;
        
        // Status Logic
        let ctrStatus = "Ok";
        let statusColor = "bg-emerald-500/10 text-emerald-400/80";
        if (ctr >= 3) {
          ctrStatus = "Ótimo";
          statusColor = "bg-green-500/20 text-green-400";
        } else if (ctr < 1) {
          ctrStatus = "Revisar";
          statusColor = "bg-red-500/20 text-red-400";
        }

        return { ...ad, ctr, cpc, freq, ctrStatus, statusColor };
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        const aVal = a[key as keyof typeof a];
        const bVal = b[key as keyof typeof b];
        
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
  }, [stats, sortConfig]);

  // Chart Data (Combination)
  const chartData = useMemo(() => {
    if (!stats) return [];
    const dailyMap = new Map();
    stats.filtered.forEach(d => {
      const date = d.date_start;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, spend: 0, clicks: 0 });
      }
      const entry = dailyMap.get(date);
      entry.spend += Number(d.spend) || 0;
      entry.clicks += Number(d.inline_link_clicks) || 0;
    });
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      formattedDate: format(parseISO(d.date), "dd/MM")
    }));
  }, [stats]);

  const formatCurrencyValue = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const formatNumber = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
    if (val >= 1000) return (val / 1000).toFixed(1) + "k";
    return val.toLocaleString('pt-BR');
  };

  const isLoading = isFiltersLoading || isDataLoading;

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <TooltipProvider>
        <LoadingOverlay isLoading={isLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <div className="relative flex items-center justify-center w-full mb-8 min-h-[40px]">
          <div className="absolute left-0 top-0 z-[100]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dash")}
              className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-euro-gold/30 text-[#A0A090] hover:text-euro-gold h-8 w-8 sm:w-auto p-0 sm:px-4 rounded-full sm:rounded-xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center group"
            >
              <ArrowLeft className="w-4 h-4 sm:mr-2 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline font-data">Voltar</span>
            </Button>
          </div>

          <h1 className="text-xl font-data text-euro-gold tracking-[0.4em] uppercase opacity-80 text-center">
            Marketing Performance
          </h1>
          
          <div className="absolute right-0 top-0 hidden sm:flex z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold h-8 px-4 transition-all duration-300 group"
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

        {/* Filters Panel */}
        <div className="sticky top-4 z-50 flex justify-center">
          <MarketingFilters 
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedCampaign={selectedCampaign}
            setSelectedCampaign={setSelectedCampaign}
            filtersData={filtersData}
            filteredMonths={filteredMonths}
          />
        </div>

        {stats ? (
          <>
            {/* KPI GRID - REFINED TO MATCH /comercial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* INVESTIMENTO */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">Investimento</CardTitle>
                    <MetricHelpDialog 
                      title="Investimento Total"
                      definition="Valor total gasto em mídia paga nas plataformas de anúncios (Facebook Ads) para o período e campanhas selecionadas."
                      formula="SUM(spend)"
                      importance="Mostra o fôlego financeiro da operação e o quanto está sendo aportado para gerar tráfego."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {formatCurrencyValue(stats.totalSpend)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      {selectedCampaign !== "all" ? "Gasto Vitalício" : "Gasto no Período"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* IMPRESSÕES */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">Impressões</CardTitle>
                    <MetricHelpDialog 
                      title="Impressões"
                      definition="Quantas vezes o anúncio apareceu na tela das pessoas. Uma pessoa pode ver o anúncio várias vezes."
                      formula="SUM(impressions)"
                      importance="Mede a visibilidade da marca e a escala com que sua mensagem está circulando."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      {formatNumber(stats.totalImpressions)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      Visualizações Totais
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* CLIQUES */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">Cliques</CardTitle>
                    <MetricHelpDialog 
                      title="Cliques no Link"
                      definition="Número de cliques que direcionaram o usuário para o destino desejado (site, WhatsApp, formulário)."
                      formula="SUM(inline_link_clicks)"
                      importance="Principal métrica de interesse. Indica quantos usuários foram convencidos pelo anúncio a tomar uma ação."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <MousePointer2 className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      {formatNumber(stats.totalClicks)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      Interações de Link
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* FREQUÊNCIA */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">Frequência</CardTitle>
                    <MetricHelpDialog 
                      title="Frequência"
                      definition="Média de vezes que cada pessoa única viu o anúncio. Se for 3.0, significa que em média cada pessoa viu o anúncio 3 vezes."
                      formula="impressions / reach"
                      importance="Controla a saturação. Acima de 5, as pessoas começam a 'cansar' do anúncio, derrubando a performance."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <RefreshCcw className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className={cn(
                      "text-lg md:text-xl xl:text-2xl font-display text-center leading-tight",
                      stats.frequency > 5 ? "text-red-400" : stats.frequency > 4 ? "text-euro-gold" : "text-[#F5F5F0]"
                    )}>
                      {stats.frequency.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-[10px] font-data text-white uppercase tracking-tighter"
                    )}>
                      {stats.frequency > 5 ? "Saturação Crítica" : stats.frequency > 4 ? "Atenção: Saturando" : "Repetição Saudável"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* CTR */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">CTR</CardTitle>
                    <MetricHelpDialog 
                      title="CTR (Click-Through Rate)"
                      definition="Taxa de Cliques. Mostra a porcentagem de pessoas que clicaram após verem o anúncio."
                      formula="(clicks / impressions) * 100"
                      importance="Principal indicador de qualidade do criativo. Se estiver baixo (<1%), o anúncio não está chamando atenção."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className={cn(
                      "text-lg md:text-xl xl:text-2xl font-display text-center leading-tight",
                      stats.ctr >= 3 ? "text-green-400" : stats.ctr >= 1 ? "text-euro-gold" : "text-red-400"
                    )}>
                      {stats.ctr.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-[10px] font-data text-white uppercase tracking-tighter"
                    )}>
                      {stats.ctr >= 3 ? "Excelente Impacto" : stats.ctr >= 1 ? "CTR Saudável" : "Revisar Criativo"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* CPM */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">CPM</CardTitle>
                    <MetricHelpDialog 
                      title="CPM (Custo por Mil Impressões)"
                      definition="Quanto custa exibir seus anúncios 1.000 vezes para o público-alvo."
                      formula="(spend / impressions) * 1000"
                      importance="Mede quão caro está o leilão. Públicos muito disputados geram CPMs mais altos."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {formatCurrencyValue(stats.totalSpend === 0 ? 0 : stats.cpm)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      Custo por 1k Exibições
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* CPC */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">CPC</CardTitle>
                    <MetricHelpDialog 
                      title="CPC (Custo por Clique)"
                      definition="Quanto você pagou, em média, por cada clique no link do seu anúncio."
                      formula="spend / clicks"
                      importance="Combina o custo do leilão (CPM) com a qualidade do criativo (CTR). Quanto menor, melhor o custo-benefício."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      R$ {formatCurrencyValue(stats.totalClicks === 0 ? 0 : stats.cpc)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      Investimento por Clique
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* ALCANCE ÚNICO */}
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-data text-white uppercase tracking-wider">Alcance Único</CardTitle>
                    <MetricHelpDialog 
                      title="Alcance Único"
                      definition="Número de pessoas diferentes que viram seus anúncios pelo menos uma vez."
                      formula="SUM(reach) — deduzido pela plataforma"
                      importance="Indica o tamanho do novo público que sua marca está impactando. Crucial para expansão."
                    >
                      <button className="text-[#5C5C50] hover:text-euro-gold transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </MetricHelpDialog>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-euro-gold" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-euro-gold/20 mb-3">
                    <span className="text-lg md:text-xl xl:text-2xl font-display text-[#F5F5F0] text-center leading-tight">
                      {formatNumber(stats.totalReach)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-data text-white uppercase tracking-widest">
                      Pessoas Distintas
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evolution Chart (Combination) */}
            <Card className="bg-euro-card/95 border-white/10 rounded-3xl glass p-8 hidden lg:block">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-data text-white/60 uppercase tracking-widest">Investimento vs Cliques por Dia</h3>
                <TrendingUp className="w-4 h-4 text-euro-gold" />
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="formattedDate" stroke="#FFFFFF" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis yAxisId="left" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 18, 24, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                      labelStyle={{ color: '#FAC017', fontWeight: 'bold', marginBottom: '4px' }}
                      formatter={(value: any, name: string) => {
                        if (name.includes("Investimento")) return [`R$ ${formatCurrencyValue(Number(value))}`, name];
                        return [value, name];
                      }}
                    />
                    <Bar yAxisId="left" dataKey="spend" fill="#4B5563" fillOpacity={0.9} radius={[4, 4, 0, 0]} name="Investimento (R$)" />
                    <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6 }} name="Cliques" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Ranking de Anúncios Table */}
            <div className="space-y-6 hidden lg:block">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h3 className="text-xl font-data text-euro-gold tracking-widest uppercase">
                   Ranking de Anúncios
                </h3>
                <div className="relative w-full md:w-80 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold" />
                  <Input
                    type="text"
                    placeholder="Buscar anúncio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-euro-card/95 border-white/10 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 h-10 rounded-xl shadow-xl"
                  />
                </div>
              </div>

              <div className="bg-euro-card/95 border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass relative group/table">
                <div className="overflow-auto custom-scrollbar relative max-h-[600px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-30">
                      <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                        <th onClick={() => handleSort('name')} className="py-4 px-6 font-bold cursor-pointer hover:bg-euro-gold/80 min-w-[240px]">
                          <div className="flex items-center gap-2">Anúncio <SortIcon column="name" /></div>
                        </th>
                        <th onClick={() => handleSort('campaign')} className="py-4 px-6 font-bold cursor-pointer hover:bg-euro-gold/80 min-w-[200px]">
                          <div className="flex items-center gap-2">Campanha <SortIcon column="campaign" /></div>
                        </th>
                        <th onClick={() => handleSort('spend')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">Gasto <SortIcon column="spend" /></div>
                        </th>
                        <th onClick={() => handleSort('impressions')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">Impressões <SortIcon column="impressions" /></div>
                        </th>
                        <th onClick={() => handleSort('clicks')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">Cliques <SortIcon column="clicks" /></div>
                        </th>
                        <th onClick={() => handleSort('ctr')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">CTR <SortIcon column="ctr" /></div>
                        </th>
                        <th onClick={() => handleSort('cpc')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">CPC <SortIcon column="cpc" /></div>
                        </th>
                        <th onClick={() => handleSort('freq')} className="py-4 px-6 font-bold text-right cursor-pointer hover:bg-euro-gold/80">
                          <div className="flex items-center justify-end gap-2">Freq. <SortIcon column="freq" /></div>
                        </th>
                        <th className="py-4 px-6 font-bold text-center">CTR Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {adRanking.map((ad, idx) => (
                        <motion.tr 
                          layout
                          key={idx} 
                          className="group even:bg-white/[0.02] hover:bg-euro-gold/5 transition-all text-xs font-data"
                        >
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-white uppercase tracking-tight">{ad.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-white font-medium">
                            {ad.campaign}
                          </td>
                          <td className="py-4 px-6 text-right text-white tabular-nums">
                            R$ {formatCurrencyValue(ad.spend)}
                          </td>
                          <td className="py-4 px-6 text-right text-white tabular-nums">
                            {formatNumber(ad.impressions)}
                          </td>
                          <td className="py-4 px-6 text-right text-white tabular-nums">
                            {formatNumber(ad.clicks)}
                          </td>
                          <td className="py-4 px-6 text-right text-white font-bold">
                            {ad.ctr.toFixed(2)}%
                          </td>
                          <td className="py-4 px-6 text-right text-white tabular-nums">
                            R$ {formatCurrencyValue(ad.cpc)}
                          </td>
                          <td className="py-4 px-6 text-right text-white tabular-nums">
                            {ad.freq.toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <Badge 
                              onClick={() => setSelectedAdForModal(ad)}
                              className={cn(
                                "px-3 py-1 text-[9px] uppercase cursor-pointer hover:scale-105 active:scale-95 transition-all", 
                                ad.statusColor
                              )}
                            >
                              {ad.ctrStatus}
                            </Badge>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="text-[10px] text-white/40 font-mono italic text-center">
                Ordenado por CTR decrescente — anúncios com melhor engajamento primeiro.
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-black/40 border border-white/10 rounded-3xl glass backdrop-blur-xl">
            <Search className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40 font-light italic">Selecione um período ou campanha para visualizar os dados.</p>
          </div>
        )}
      </div>

      {/* CTR Status Modal */}
      <Dialog open={!!selectedAdForModal} onOpenChange={(open) => !open && setSelectedAdForModal(null)}>
        <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-xl backdrop-blur-3xl p-0 overflow-hidden">
          {selectedAdForModal && (
            <>
              <DialogHeader className="p-8 pb-4 bg-white/5 border-b border-white/5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <Badge className={cn("px-4 py-1 text-[10px] uppercase", selectedAdForModal.statusColor)}>
                      {selectedAdForModal.ctrStatus}
                    </Badge>
                    <DialogTitle className="text-2xl font-display text-white truncate max-w-[350px]">
                      {selectedAdForModal.name}
                    </DialogTitle>
                  </div>
                  <span className="text-xs font-data text-white/50 uppercase tracking-widest mt-2 block">
                    {selectedAdForModal.campaign}
                  </span>
                </div>
              </DialogHeader>

              <div className="p-8 space-y-8">
                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Investimento", value: `R$ ${formatCurrencyValue(selectedAdForModal.spend)}`, icon: Wallet },
                    { label: "Cliques", value: formatNumber(selectedAdForModal.clicks), icon: MousePointer2 },
                    { label: "CTR", value: `${selectedAdForModal.ctr.toFixed(2)}%`, icon: Target },
                    { label: "Impressões", value: formatNumber(selectedAdForModal.impressions), icon: BarChart3 },
                    { label: "CPC", value: `R$ ${formatCurrencyValue(selectedAdForModal.cpc)}`, icon: Activity },
                    { label: "Frequência", value: `${selectedAdForModal.freq.toFixed(2)}x`, icon: RefreshCcw },
                  ].map((m, i) => (
                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                       <div className="flex items-center gap-2 text-white/40">
                         <m.icon className="w-3.5 h-3.5" />
                         <span className="text-[10px] uppercase font-data tracking-wider">{m.label}</span>
                       </div>
                       <span className="text-lg font-display text-white">{m.value}</span>
                    </div>
                  ))}
                </div>

                {/* Explanation Section */}
                <div className="bg-euro-gold/5 border border-euro-gold/20 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-20 h-20 text-euro-gold" />
                  </div>
                  <h4 className="text-[10px] font-data text-euro-gold uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4" />
                    Análise do Especialista
                  </h4>
                  <div className="text-sm text-white/90 leading-relaxed font-ui space-y-4 relative z-10">
                    {selectedAdForModal.ctrStatus === "Ótimo" && (
                      <p>
                        Este anúncio está com uma performance **excepcional**! Um CTR acima de 3% indica que o 
                        criativo e o público estão em perfeita harmonia. O custo por clique tende a ser mais baixo 
                        devido ao alto engajamento. **Recomendação:** Manter o investimento ou até escalar com cautela.
                      </p>
                    )}
                    {selectedAdForModal.ctrStatus === "Ok" && (
                      <p>
                        A performance deste criativo está **dentro da média** saudável do mercado. Ele cumpre o 
                        papel de atrair tráfego constante. **Recomendação:** Monitorar a frequência para garantir 
                        que o público não canse do anúncio nos próximos dias.
                      </p>
                    )}
                    {selectedAdForModal.ctrStatus === "Revisar" && (
                      <p>
                        Atenção! O CTR abaixo de 1% sugere que este anúncio **não está sendo relevante** para as pessoas 
                        que o veem. Isso encarece o leilão e diminui o ROI. **Recomendação:** Testar uma nova 
                        imagem de capa, um título mais agressivo ou revisar o público-alvo.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-4 border-t border-white/5 flex justify-end">
                <Button 
                  onClick={() => setSelectedAdForModal(null)}
                  className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold uppercase text-[10px] tracking-widest px-8 rounded-lg"
                >
                  Entendido
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      </TooltipProvider>
    </PageLayout>
  );
}
