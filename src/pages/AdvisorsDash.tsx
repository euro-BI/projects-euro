import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { parseISO, addMonths, format } from "date-fns";
import { motion } from "framer-motion";
import { 
  ArrowLeft,
  Maximize2,
  Minimize2,
  Construction,
  TrendingUp,
  Award,
  Users,
  Briefcase,
  Info,
  DollarSign,
  Heart,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dashboard Components
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { RelacionamentoDetailsDialog, RelacionamentoRow } from "@/components/dashboard/RelacionamentoDetailsDialog";
import { VolumeConsultivoDialog, VolumeConsultivoRow } from "@/components/dashboard/VolumeConsultivoDialog";

// ==========================================================================
// Local Components
// ==========================================================================

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
  tooltipInfo?: string;
}

function KpiCard({ title, value, subtitle, icon: Icon, color, delay = 0, tooltipInfo }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full">
        <div className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" style={{ background: color }} />
        <CardContent className="p-5 flex flex-col h-full pl-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-[10px] font-data uppercase tracking-widest text-white/60 mb-1 flex items-center gap-1.5 flex-wrap">
                {title}
                {tooltipInfo && (
                  <TooltipProvider delayDuration={100}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-white/20 hover:text-white/70 transition-colors cursor-help" />
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
                <span className="text-[10px] font-data text-white/40 mt-1 block uppercase tracking-tighter">{subtitle}</span>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// Main Component
// ==========================================================================

export default function AdvisorsDash() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string[]>(["ADVISORS"]);
  const [selectedAssessorId, setSelectedAssessorId] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("geral");
  
  const navigate = useNavigate();
  const { userRole } = useAuth();

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
      console.error(`Error attempting to toggle full-screen mode: ${err}`);
      setIsMaximized(!isMaximized);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-filters-advisors"],
    queryFn: async () => {
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
      const teams = Array.from(new Set(data.map((d: any) => d.time)))
        .filter(teamName => teamName && activeTeamNames.has(teamName));
      
      const assessorMap = new Map<string, { name: string, teams: Set<string> }>();
      const latestDate = data?.[0]?.data_posicao;
      const latestRows = latestDate ? data.filter((d: any) => d.data_posicao === latestDate) : [];
      latestRows.forEach((d: any) => {
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
        .filter(a => a.teams.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return { allMonths, years, teams, assessors };
    }
  });

  const filteredMonths = useMemo(() => {
    if (!filtersData?.allMonths) return [];
    return filtersData.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [filtersData, selectedYear]);

  React.useEffect(() => {
    if (filteredMonths.length > 0 && !filteredMonths.includes(selectedMonth)) {
      setSelectedMonth(filteredMonths[0]);
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  const { data: dashData, isLoading: isDashLoading } = useQuery({
    queryKey: ["dash-advisors-data", selectedMonth, selectedTeam, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (selectedTeam.length > 0) query = query.in("time", selectedTeam);
      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as AssessorResumo[];
    }
  });

  // Query para buscar dados de relacionamento da vw_esforcos_consolidado
  const { data: relacionamentoData, isLoading: isRelacionamentoLoading } = useQuery({
    queryKey: ["dash-advisors-relacionamento", selectedMonth, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("vw_esforcos_consolidado" as any)
        .select("cliente, tipo_pessoa, net_em_m, data_posicao, nome_assessor, cod_assessor, id_atividade, tipo, pipe, data_esforco, tipo_esforco, data_ultimo_contato, status_relacionamento")
        .eq("data_posicao", selectedMonth);

      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as RelacionamentoRow[];
    }
  });


  // Cálculo do Índice de Relacionamento
  const indiceRelacionamento = useMemo(() => {
    if (!relacionamentoData || relacionamentoData.length === 0) return null;

    // Clientes distintos com OK
    const clientesOk = new Set(
      relacionamentoData
        .filter(r => r.status_relacionamento === "OK")
        .map(r => r.cliente)
    ).size;

    // Total de clientes distintos
    const totalClientes = new Set(relacionamentoData.map(r => r.cliente)).size;

    if (totalClientes === 0) return null;

    const percentual = clientesOk / totalClientes;
    const atingido = percentual >= 0.75;

    return { percentual, clientesOk, totalClientes, atingido };
  }, [relacionamentoData]);

  // Query para buscar dados de volume consultivo (KPI 3)
  const { data: volumeConsultivoData, isLoading: isVolumeLoading } = useQuery({
    queryKey: ["dash-advisors-volume-consultivo", selectedMonth, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      // Calcula o range do mês selecionado para filtrar data_esforco
      const startDate = parseISO(selectedMonth);
      const endDate = addMonths(startDate, 1);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      let query = supabase
        .from("vw_esforcos_consolidado" as any)
        .select("cliente, tipo_pessoa, net_em_m, data_posicao, nome_assessor, cod_assessor, id_atividade, pipe, data_esforco")
        .in("pipe", ["Revis\u00e3o de Carteira", "Reuni\u00e3o de Apresenta\u00e7\u00e3o FP"])
        .gte("data_esforco", startStr)
        .lt("data_esforco", endStr);

      if (selectedAssessorId.length > 0) query = query.in("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as VolumeConsultivoRow[];
    }
  });

  // Cálculo do KPI 3: Volume Consultivo Mensal
  const META_VOLUME_CONSULTIVO = 30;
  const volumeConsultivo = useMemo(() => {
    if (!volumeConsultivoData) return null;
    const totalReunioes = volumeConsultivoData.length;
    const atingido = totalReunioes >= META_VOLUME_CONSULTIVO;
    return { totalReunioes, atingido };
  }, [volumeConsultivoData]);

  // Cálculo do Repasse Atingido (depende dos 3 KPIs)
  // Regra: 24% base + 2% por cada KPI atingido. Máximo 30%.
  const stats = useMemo(() => {
    if (!dashData) return { repasseEsperado: 0, repasseAtingido: 0, percentualRepasse: 0.24, kpisAtingidos: 0 };

    const totalRepasse = dashData.reduce((acc, curr) => acc + (curr.repasse_total || 0), 0);
    const repasseEsperado = totalRepasse * 0.30;

    const kpisAtingidos = [
      false,                                      // NPS — ainda não implementado
      indiceRelacionamento?.atingido ?? false,     // KPI 2: Índice de Relacionamento
      volumeConsultivo?.atingido ?? false,          // KPI 3: Volume Consultivo
    ].filter(Boolean).length;

    const percentualRepasse = 0.24 + kpisAtingidos * 0.02; // máx 0.30
    const repasseAtingido = totalRepasse * percentualRepasse;

    return { repasseEsperado, repasseAtingido, percentualRepasse, kpisAtingidos };
  }, [dashData, indiceRelacionamento, volumeConsultivo]);

  const isLoading = isFiltersLoading || isDashLoading || isRelacionamentoLoading || isVolumeLoading;

  const tabs = [
    { id: "geral", label: "Geral" },
    { id: "indicacoes", label: "Indicações Convertidas" },
    { id: "captacao", label: "Captação Líquida" },
    { id: "crossell", label: "Fechamentos Crossell" },
    { id: "open-investments", label: "Open Investments" },
  ];

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-12 relative z-10">
        <div className="relative flex items-center justify-center w-full mb-4 sm:mb-8 px-2 min-h-[32px]">
          {/* Back Action */}
          <div className="absolute left-2 sm:left-0 top-1 sm:top-0 z-50 sm:z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dash")}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group hidden sm:flex items-center gap-2 h-8"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-data uppercase tracking-wider">Voltar</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dash")}
              className="sm:hidden glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold rounded-full w-8 h-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
          
          <h1 className="text-base sm:text-xl font-data text-euro-gold tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-80 text-center leading-tight sm:leading-normal">
            Performance Advisors
          </h1>
          
          <div className="absolute right-2 sm:right-0 top-0 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group h-8 hidden sm:flex"
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Sair</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Maximizar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-12">
          <div className="sticky top-4 z-50 mx-auto w-full sm:max-w-fit px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2 p-2 sm:p-1.5 rounded-2xl sm:rounded-full bg-[#0F1218]/90 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300">
              <TabsList className="bg-transparent border-none h-9 p-0 gap-1 mx-2 w-full sm:w-auto flex justify-start sm:justify-center overflow-x-auto flex-nowrap scrollbar-hide">
                {tabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white transition-all whitespace-nowrap"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="hidden sm:block w-px h-4 bg-white/10 mx-1" />

              <div className="w-full sm:w-auto flex justify-center">
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
                  userRole={userRole}
                  isMultiSelect={true}
                  disableTeamSelection={true}
                />
              </div>
            </div>
          </div>

          <TabsContent value="geral" className="mt-0 border-none p-0 outline-none space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KpiCard
                title="Repasse Esperado"
                value={formatCurrency(stats.repasseEsperado)}
                subtitle="Soma Repasse * 30%"
                icon={DollarSign}
                color="#FAC017"
                tooltipInfo="Cálculo baseado em 30% do repasse total do time Advisors no período selecionado."
              />
              <KpiCard
                title="Repasse Atingido"
                value={formatCurrency(stats.repasseAtingido)}
                subtitle={`Base 24% + ${stats.kpisAtingidos * 2}% KPIs • ${(stats.percentualRepasse * 100).toFixed(0)}% aplicado`}
                icon={Award}
                color="#FAC017"
                tooltipInfo={`24% base + 2% por KPI atingido. KPIs atingidos: ${stats.kpisAtingidos}/3 (NPS não integrado; Relacionamento: ${indiceRelacionamento?.atingido ? '✓' : '✗'}; Volume Consultivo: ${volumeConsultivo?.atingido ? '✓' : '✗'}).`}
              />
              <KpiCard
                title="Qualidade (NPS)"
                value="--"
                subtitle="Em breve"
                icon={Heart}
                color="#F43F5E"
                tooltipInfo="Métrica de satisfação do cliente (NPS) em fase de coleta de dados."
              />
              <RelacionamentoDetailsDialog
                data={relacionamentoData ?? []}
                selectedMonth={selectedMonth}
                percentual={indiceRelacionamento?.percentual ?? 0}
                clientesOk={indiceRelacionamento?.clientesOk ?? 0}
                totalClientes={indiceRelacionamento?.totalClientes ?? 0}
                atingido={indiceRelacionamento?.atingido ?? false}
              >
                <div className="h-full cursor-pointer">
                  <KpiCard
                    title="Índice de Relacionamento"
                    value={
                      indiceRelacionamento
                        ? `${(indiceRelacionamento.percentual * 100).toFixed(1)}%`
                        : "--"
                    }
                    subtitle={
                      indiceRelacionamento
                        ? `${indiceRelacionamento.clientesOk}/${indiceRelacionamento.totalClientes} clientes • ${indiceRelacionamento.atingido ? "✓ Meta atingida" : "✗ Abaixo de 75%"}`
                        : "Cobertura 60 dias"
                    }
                    icon={MessageSquare}
                    color={indiceRelacionamento ? (indiceRelacionamento.atingido ? "#10B981" : "#F43F5E") : "#8B5CF6"}
                    tooltipInfo="Clique para ver o detalhamento. Percentual de clientes 300k+ PF com contato nos últimos 60 dias. Meta: ≥ 75%."
                  />
                </div>
              </RelacionamentoDetailsDialog>
              <VolumeConsultivoDialog
                data={volumeConsultivoData ?? []}
                totalReunioes={volumeConsultivo?.totalReunioes ?? 0}
                atingido={volumeConsultivo?.atingido ?? false}
                meta={META_VOLUME_CONSULTIVO}
              >
                <div className="h-full cursor-pointer">
                  <KpiCard
                    title="Volume Consultivo Mensal"
                    value={volumeConsultivo ? String(volumeConsultivo.totalReunioes) : "--"}
                    subtitle={
                      volumeConsultivo
                        ? `de ${META_VOLUME_CONSULTIVO} reuniões • ${volumeConsultivo.atingido ? "✓ Meta atingida" : "✗ Abaixo da meta"}`
                        : "Mínimo 30 reuniões"
                    }
                    icon={TrendingUp}
                    color={volumeConsultivo ? (volumeConsultivo.atingido ? "#10B981" : "#F43F5E") : "#10B981"}
                    tooltipInfo="Clique para ver o detalhamento. Mínimo de 30 reuniões de Revisão de Carteira ou Apresentação FP no mês."
                  />
                </div>
              </VolumeConsultivoDialog>
            </div>
            
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[300px] flex items-center justify-center">
              <CardContent className="flex flex-col items-center justify-center space-y-4 p-12">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                  <Construction className="w-8 h-8 text-euro-gold/50" />
                </div>
                <h3 className="text-xl font-display text-white tracking-wide">
                  Análises Detalhadas
                </h3>
                <p className="text-[#A0A090] font-light text-base">
                  GRÁFICOS E TABELAS EM DESENVOLVIMENTO
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {tabs.slice(1).map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 border-none p-0 outline-none">
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[400px] flex items-center justify-center">
                <CardContent className="flex flex-col items-center justify-center space-y-4 p-12">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                    <Construction className="w-10 h-10 text-euro-gold/50" />
                  </div>
                  <h2 className="text-2xl font-display text-white tracking-wide">
                    {tab.label}
                  </h2>
                  <p className="text-[#A0A090] font-light text-lg">
                    EM DESENVOLVIMENTO
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageLayout>
  );
}
