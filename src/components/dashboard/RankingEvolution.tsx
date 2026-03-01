import React, { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  TrendingUp, 
  Target, 
  Trophy, 
  Calendar, 
  User, 
  ChevronRight,
  Zap,
  LineChart as LineChartIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  ChevronsUpDown,
  Filter,
  Users,
  Grid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

interface RankingEvolutionProps {
  data: AssessorResumo[];
  selectedYear: string;
}

type AnalysisMode = "monthly" | "accumulated";

export default function RankingEvolution({ data, selectedYear }: RankingEvolutionProps) {
  const [mode, setMode] = useState<AnalysisMode>("accumulated");
  const [selectedAssessorId, setSelectedAssessorId] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [openClusterCombobox, setOpenClusterCombobox] = useState(false);
  const [openTeamCombobox, setOpenTeamCombobox] = useState(false);

  // 1. Process Data for Chart
  const { chartData, assessorsList, clustersList, teamsList } = useMemo(() => {
    if (!data.length) return { chartData: [], assessorsList: [], clustersList: [], teamsList: [] };

    // Filter valid data (must have name and not be blocked)
    const validData = data.filter(d => {
      // Name validation
      if (!d.nome_assessor || 
          d.nome_assessor.trim().length === 0 || 
          d.nome_assessor.toLowerCase() === "null" || 
          d.nome_assessor.toLowerCase() === "undefined") return false;

      // Blocked assessors
      if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;

      // Blocked teams
      if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;

      return true;
    });

    // Get unique months
    const months = Array.from(new Set(validData.map(d => d.data_posicao))).sort();
    
    // Get unique assessors, clusters and teams
    const assessorMap = new Map<string, { id: string; name: string; photo: string | null; cluster: string; team: string }>();
    const clusters = new Set<string>();
    const teams = new Set<string>();

    validData.forEach(d => {
      if (!assessorMap.has(d.cod_assessor)) {
        assessorMap.set(d.cod_assessor, { 
          id: d.cod_assessor, 
          name: d.nome_assessor, 
          photo: d.foto_url,
          cluster: d.cluster,
          team: d.time
        });
      }
      if (d.cluster) clusters.add(d.cluster);
      if (d.time) teams.add(d.time);
    });

    const assessors = Array.from(assessorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const sortedClusters = Array.from(clusters).sort();
    const sortedTeams = Array.from(teams).sort();

    // Create chart points
    const points = months.map(month => {
      const monthName = format(parseISO(month), "MMM", { locale: ptBR });
      const monthData: any = { month, monthName };
      
      assessors.forEach(assessor => {
        const entry = validData.find(d => d.data_posicao === month && d.cod_assessor === assessor.id);
        if (entry) {
          monthData[assessor.id] = mode === "monthly" ? entry.pontos_total : entry.pontos_totais_acumulado;
        } else {
          monthData[assessor.id] = 0;
        }
      });
      
      return monthData;
    });

    return { 
      chartData: points, 
      assessorsList: assessors,
      clustersList: sortedClusters,
      teamsList: sortedTeams
    };
  }, [data, mode]);

  // 2. Statistics for Highlighted Assessor
  const selectedStats = useMemo(() => {
    if (!data.length) return null;
    
    let targetAssessorId = selectedAssessorId;

    // If cluster or team is selected, find the best performer in that group
    if (selectedCluster || selectedTeam) {
      const groupData = data.filter(d => {
        const matchesCluster = !selectedCluster || d.cluster === selectedCluster;
        const matchesTeam = !selectedTeam || d.time === selectedTeam;
        return matchesCluster && matchesTeam;
      });

      if (!groupData.length) return null;

      // Find best performer in last month of the group
      const lastMonth = [...groupData].sort((a, b) => b.data_posicao.localeCompare(a.data_posicao))[0].data_posicao;
      const bestInGroup = groupData
        .filter(d => d.data_posicao === lastMonth)
        .sort((a, b) => b.pontos_totais_acumulado - a.pontos_totais_acumulado)[0];
      
      if (bestInGroup) targetAssessorId = bestInGroup.cod_assessor;
    }

    if (!targetAssessorId) return null;

    const assessorData = data
      .filter(d => d.cod_assessor === targetAssessorId)
      .sort((a, b) => a.data_posicao.localeCompare(b.data_posicao));
    
    if (!assessorData.length) return null;

    // Calculate final rank for the selected year
    const lastMonth = assessorData[assessorData.length - 1].data_posicao;
    const allAssessorsInLastMonth = data
      .filter(d => d.data_posicao === lastMonth)
      .sort((a, b) => b.pontos_totais_acumulado - a.pontos_totais_acumulado);
    
    const finalRank = allAssessorsInLastMonth.findIndex(d => d.cod_assessor === targetAssessorId) + 1;

    const lastEntry = assessorData[assessorData.length - 1];
    const bestMonth = [...assessorData].sort((a, b) => b.pontos_total - a.pontos_total)[0];
    const totalPoints = lastEntry.pontos_totais_acumulado;
    
    return {
      name: lastEntry.nome_assessor,
      photo: lastEntry.foto_url,
      total: totalPoints,
      rank: finalRank,
      bestMonth: format(parseISO(bestMonth.data_posicao), "MMMM", { locale: ptBR }),
      bestPoints: bestMonth.pontos_total,
      growth: assessorData.length > 1 
        ? ((lastEntry.pontos_totais_acumulado - assessorData[0].pontos_totais_acumulado) / (assessorData[0].pontos_totais_acumulado || 1)) * 100 
        : 0
    };
  }, [selectedAssessorId, selectedCluster, selectedTeam, data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // 1. Filter payload based on active filters (cluster/team)
      const filteredPayload = payload.filter((p: any) => {
        const assessor = assessorsList.find(a => a.id === p.dataKey);
        if (!assessor) return false;
        
        const matchesCluster = !selectedCluster || assessor.cluster === selectedCluster;
        const matchesTeam = !selectedTeam || assessor.team === selectedTeam;
        
        return matchesCluster && matchesTeam;
      });

      // 2. Sort and get top 3 from the FILTERED set
      const sortedPayload = [...filteredPayload].sort((a, b) => b.value - a.value);
      const top3 = sortedPayload.slice(0, 3);
      const selectedEntry = selectedAssessorId ? payload.find((p: any) => p.dataKey === selectedAssessorId) : null;

      // 3. Determine tooltip subtitle based on filters
      let tooltipSubtitle = "Top Performers";
      if (selectedCluster && selectedTeam) {
        tooltipSubtitle = `Top: ${selectedTeam} (${selectedCluster})`;
      } else if (selectedCluster) {
        tooltipSubtitle = `Top Cluster: ${selectedCluster}`;
      } else if (selectedTeam) {
        tooltipSubtitle = `Top Time: ${selectedTeam}`;
      }

      return (
        <div className="bg-euro-navy/95 border border-white/10 p-4 rounded-xl backdrop-blur-md shadow-2xl">
          <p className="text-xs font-data text-euro-gold/60 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
            {format(parseISO(payload[0].payload.month), "MMMM yyyy", { locale: ptBR })}
          </p>
          <div className="space-y-2">
            {selectedEntry && (
              <div className="flex items-center justify-between gap-8 bg-euro-gold/10 p-2 rounded-lg border border-euro-gold/20 mb-2">
                <span className="text-sm font-display text-euro-gold">{selectedEntry.name}</span>
                <span className="text-sm font-data text-euro-gold">{(selectedEntry.value || 0).toLocaleString()} pts</span>
              </div>
            )}
            <div className="text-[10px] font-data text-white/30 uppercase mb-1">{tooltipSubtitle}:</div>
            {top3.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-8 opacity-80">
                <span className="text-xs font-ui text-white/70">{entry.name}</span>
                <span className="text-xs font-data text-white/90">{(entry.value || 0).toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header Section */}
      <div className="p-8 border-b border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trajetória de Performance
            </h3>
            <p className="text-xs font-data text-white/40 uppercase tracking-widest">
              Análise de evolução {mode === "monthly" ? "mensal" : "acumulada"} do ranking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Cluster Selector */}
            <Popover open={openClusterCombobox} onOpenChange={setOpenClusterCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-9 w-[160px] justify-between bg-euro-navy/40 border-white/10 text-[10px] font-data uppercase tracking-wider",
                    selectedCluster && "border-euro-gold text-euro-gold"
                  )}
                >
                  <div className="flex items-center truncate">
                    <Grid className="w-3 h-3 mr-2 opacity-50" />
                    <span className="truncate">
                      {selectedCluster || "Cluster"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-0 bg-euro-elevated border-white/10">
                <Command className="bg-euro-elevated">
                  <CommandInput placeholder="Buscar Cluster..." className="h-8 text-[10px] font-data" />
                  <CommandList>
                    <CommandEmpty className="text-[10px] font-data p-2">Não encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedCluster(null);
                          setOpenClusterCombobox(false);
                        }}
                        className="text-[10px] font-data uppercase tracking-wider"
                      >
                        <Check className={cn("mr-2 h-3 w-3", !selectedCluster ? "opacity-100" : "opacity-0")} />
                        Todos os Clusters
                      </CommandItem>
                      {clustersList.map((cluster) => (
                        <CommandItem
                          key={cluster}
                          onSelect={() => {
                            setSelectedCluster(cluster);
                            setOpenClusterCombobox(false);
                          }}
                          className="text-[10px] font-data uppercase tracking-wider"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedCluster === cluster ? "opacity-100 text-euro-gold" : "opacity-0")} />
                          {cluster}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Team Selector */}
            <Popover open={openTeamCombobox} onOpenChange={setOpenTeamCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-9 w-[160px] justify-between bg-euro-navy/40 border-white/10 text-[10px] font-data uppercase tracking-wider",
                    selectedTeam && "border-euro-gold text-euro-gold"
                  )}
                >
                  <div className="flex items-center truncate">
                    <Users className="w-3 h-3 mr-2 opacity-50" />
                    <span className="truncate">
                      {selectedTeam || "Time"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-0 bg-euro-elevated border-white/10">
                <Command className="bg-euro-elevated">
                  <CommandInput placeholder="Buscar Time..." className="h-8 text-[10px] font-data" />
                  <CommandList>
                    <CommandEmpty className="text-[10px] font-data p-2">Não encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedTeam(null);
                          setOpenTeamCombobox(false);
                        }}
                        className="text-[10px] font-data uppercase tracking-wider"
                      >
                        <Check className={cn("mr-2 h-3 w-3", !selectedTeam ? "opacity-100" : "opacity-0")} />
                        Todos os Times
                      </CommandItem>
                      {teamsList.map((team) => (
                        <CommandItem
                          key={team}
                          onSelect={() => {
                            setSelectedTeam(team);
                            setOpenTeamCombobox(false);
                          }}
                          className="text-[10px] font-data uppercase tracking-wider"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedTeam === team ? "opacity-100 text-euro-gold" : "opacity-0")} />
                          {team}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Assessor Selector */}
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-9 w-[220px] justify-between bg-euro-navy/40 border-white/10 text-[10px] font-data uppercase tracking-wider",
                    selectedAssessorId && "border-euro-gold text-euro-gold"
                  )}
                >
                  <div className="flex items-center truncate">
                    <User className="w-3 h-3 mr-2 opacity-50" />
                    <span className="truncate">
                      {selectedAssessorId
                        ? assessorsList.find(a => a.id === selectedAssessorId)?.name
                        : "Destacar Assessor"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0 bg-euro-elevated border-white/10">
                <Command className="bg-euro-elevated">
                  <CommandInput placeholder="Buscar..." className="h-8 text-[10px] font-data" />
                  <CommandList>
                    <CommandEmpty className="text-[10px] font-data p-2">Não encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedAssessorId(null);
                          setOpenCombobox(false);
                        }}
                        className="text-[10px] font-data uppercase tracking-wider"
                      >
                        <Check className={cn("mr-2 h-3 w-3", !selectedAssessorId ? "opacity-100" : "opacity-0")} />
                        Ver Todos
                      </CommandItem>
                      {assessorsList.map((assessor) => (
                        <CommandItem
                          key={assessor.id}
                          onSelect={() => {
                            setSelectedAssessorId(assessor.id);
                            setOpenCombobox(false);
                          }}
                          className="text-[10px] font-data uppercase tracking-wider"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedAssessorId === assessor.id ? "opacity-100 text-euro-gold" : "opacity-0")} />
                          {assessor.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Mode Switcher */}
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 ml-2">
              <button
                onClick={() => setMode("monthly")}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-data uppercase tracking-wider rounded-md transition-all",
                  mode === "monthly" ? "bg-euro-gold text-black shadow-lg" : "text-white/40 hover:text-white/70"
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3 h-3" />
                  Mensal
                </div>
              </button>
              <button
                onClick={() => setMode("accumulated")}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-data uppercase tracking-wider rounded-md transition-all",
                  mode === "accumulated" ? "bg-euro-gold text-black shadow-lg" : "text-white/40 hover:text-white/70"
                )}
              >
                <div className="flex items-center gap-2">
                  <LineChartIcon className="w-3 h-3" />
                  Acumulado
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
        {/* Left Stats Panel (Visible when an assessor is selected) */}
        <div className={cn(
          "lg:col-span-1 border-r border-white/5 p-8 transition-all duration-500",
          !selectedStats ? "hidden lg:block opacity-30 grayscale pointer-events-none" : "opacity-100"
        )}>
          {selectedStats ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className={cn(
                    "w-20 h-20 rounded-full bg-euro-gold/10 border-2 overflow-hidden flex items-center justify-center transition-all duration-500",
                    selectedStats.rank === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]" : 
                    selectedStats.rank === 2 ? "border-gray-300 shadow-[0_0_15px_rgba(209,213,219,0.3)]" :
                    selectedStats.rank === 3 ? "border-amber-700 shadow-[0_0_15px_rgba(180,83,9,0.3)]" :
                    "border-euro-gold/30 shadow-[0_0_15px_rgba(250,192,23,0.2)]"
                  )}>
                    {selectedStats.photo ? (
                      <img src={selectedStats.photo} alt={selectedStats.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-display text-euro-gold/40">
                        {selectedStats.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  
                  {/* Rank Badge on Photo */}
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-display shadow-lg border",
                    selectedStats.rank === 1 ? "bg-yellow-400 text-black border-yellow-500" : 
                    selectedStats.rank === 2 ? "bg-gray-300 text-black border-gray-400" :
                    selectedStats.rank === 3 ? "bg-amber-700 text-white border-amber-800" :
                    "bg-euro-navy text-euro-gold border-euro-gold/50"
                  )}>
                    {selectedStats.rank}º
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <h4 className="text-lg font-display text-white leading-tight">{selectedStats.name}</h4>
                  <p className="text-[10px] font-data text-euro-gold uppercase tracking-[0.2em] animate-pulse">
                    {selectedCluster || selectedTeam ? "Melhor do Grupo" : "Performance Insights"}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-data text-euro-gold/60 uppercase tracking-widest">Melhor Mês</p>
                  <p className="text-xl font-display text-white">{selectedStats.bestMonth}</p>
                  <p className="text-[10px] font-data text-white/30">{(selectedStats.bestPoints || 0).toLocaleString()} pts</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-data text-euro-gold/60 uppercase tracking-widest">Posição no Ranking</p>
                  <p className="text-xl font-display text-white">{selectedStats.rank}º Lugar</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-data text-euro-gold/60 uppercase tracking-widest">Pontuação Total</p>
                  <p className="text-xl font-display text-white">{(selectedStats.total || 0).toLocaleString()} pts</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-data text-euro-gold/60 uppercase tracking-widest">Crescimento Anual</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-display text-white">{selectedStats.growth.toFixed(1)}%</p>
                    <div className={cn(
                      "p-1 rounded bg-white/5",
                      selectedStats.growth >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {selectedStats.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                <User className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-[10px] font-data text-white/20 uppercase tracking-[0.2em] leading-relaxed">
                Selecione um assessor<br />para ver insights detalhados
              </p>
            </div>
          )}
        </div>

        {/* Chart Area */}
        <div className="lg:col-span-3 p-8">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="monthName" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "inherit" }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "inherit" }}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(250,192,23,0.1)", strokeWidth: 40 }} />
                
                {assessorsList.map((assessor, idx) => {
                  const isAssessorHighlighted = selectedAssessorId === assessor.id;
                  const isClusterHighlighted = selectedCluster && assessor.cluster === selectedCluster;
                  const isTeamHighlighted = selectedTeam && assessor.team === selectedTeam;
                  
                  const isHighlighted = isAssessorHighlighted || isClusterHighlighted || isTeamHighlighted;
                  const isVisible = (!selectedAssessorId && !selectedCluster && !selectedTeam) || isHighlighted;
                  
                  return (
                    <React.Fragment key={assessor.id}>
                      <Line
                        type="monotone"
                        dataKey={assessor.id}
                        name={assessor.name}
                        stroke={isHighlighted ? "#FAC017" : "rgba(255,255,255,0.1)"}
                        strokeWidth={isHighlighted ? 3 : 1.5}
                        dot={false}
                        activeDot={{ r: isHighlighted ? 6 : 4, fill: isHighlighted ? "#FAC017" : "rgba(255,255,255,0.5)", stroke: "none" }}
                        opacity={isVisible ? 1 : 0.1}
                        filter={isHighlighted ? "url(#glow)" : "none"}
                        animationDuration={1500}
                        isAnimationActive={true}
                      />
                      
                      {/* Photo and Name at the end of the line */}
                      {isHighlighted && (
                        <foreignObject
                          x="92%"
                          y={`${((chartData[chartData.length - 1][assessor.id] / (Math.max(...chartData.map(d => Math.max(...Object.values(d).filter(v => typeof v === 'number')))) || 1)) * -300) + 320}px`}
                          width="120"
                          height="40"
                          style={{ overflow: 'visible' }}
                        >
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                            <div className="w-6 h-6 rounded-full border border-euro-gold overflow-hidden shrink-0 bg-euro-navy">
                              {assessor.photo ? (
                                <img src={assessor.photo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-euro-gold">
                                  {assessor.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] font-data text-euro-gold uppercase tracking-tighter whitespace-nowrap bg-euro-navy/80 px-1 rounded">
                              {assessor.name.split(' ')[0]}
                            </span>
                          </div>
                        </foreignObject>
                      )}
                    </React.Fragment>
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-8 flex items-center gap-6 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-euro-gold shadow-[0_0_8px_rgba(250,192,23,0.8)]" />
              <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">Destaque Selecionado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-white/10" />
              <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">Demais Assessores</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
