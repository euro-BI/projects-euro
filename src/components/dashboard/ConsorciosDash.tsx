import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
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
  Download
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
  Pie
} from "recharts";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

// ==========================================================================
// Types & Props
// ==========================================================================

interface ConsorciosDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string[];
  selectedAssessorId: string[];
  teamPhotos?: Map<string, string>;
}

type ChartMetric = "contratos_ativos" | "vs_meta" | "contratos_novos" | "previsao_receita";

const CHART_METRICS: Record<ChartMetric, { label: string; icon: React.ReactNode; tooltip: string }> = {
  contratos_ativos: { label: "Contratos Ativos", icon: <Target className="w-3.5 h-3.5" />, tooltip: "Contratos ativos gerando comissão no mês" },
  vs_meta: { label: "Receita vs Meta", icon: <TrendingUp className="w-3.5 h-3.5" />, tooltip: "Acompanhamento mensal vs Meta (ROA 0.09%)" },
  contratos_novos: { label: "Novos Contratos", icon: <FileText className="w-3.5 h-3.5" />, tooltip: "Qtd de Vendas (Linha) e Volume em R$ (Barra)" },
  previsao_receita: { label: "Previsão de Receita", icon: <Calendar className="w-3.5 h-3.5" />, tooltip: "Projeção total de recebíveis por mês" },
};

// ==========================================================================
// Helpers
// ==========================================================================

const formatCurrency = (value: number, decimals: number = 0) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const formatNumber = (value: number) =>
  value.toLocaleString("pt-BR");

const formatMetaLabel = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return "R$ " + (value / 1000000).toFixed(2).replace(".", ",") + "M";
  }
  return "R$ " + (value / 1000).toFixed(2).replace(".", ",") + "K";
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#11141D]/90 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
      <p className="text-white font-data text-xs uppercase tracking-widest mb-3 pb-2 border-b border-white/10">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any, index: number) => {
          let displayName = entry.name;
          if (entry.dataKey === "previsao" && entry.payload) {
            displayName = entry.payload.isFuture ? "Previsão (R$)" : "Realizado (R$)";
          }

          const isCount = displayName.includes("Qtd") || displayName.includes("Ativos");

          return (
            <div key={index} className="flex justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} 
                />
                <span className="text-white/70 font-data text-[10px] uppercase">
                  {displayName}
                </span>
              </div>
              <span className="text-white font-display text-sm">
                {isCount ? entry.value : formatCurrency(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================================================
// Card Component (Same pattern as RendaVariavelDash)
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
  action?: { label: string; onClick: () => void };
  tooltipInfo?: string;
  infoMessage?: string;
}

function KpiCard({ title, value, rawValue, metaValue, subtitle, icon: Icon, color, trend, delay = 0, ring, action, tooltipInfo, infoMessage }: KpiCardProps) {
  const isMeta = metaValue !== undefined && rawValue !== undefined;
  const achievement = isMeta && metaValue > 0 ? (rawValue / metaValue) * 100 : 0;

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
                <span className="text-[10px] font-data text-white/50 mt-1 block">{subtitle}</span>
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

          {/* Trend & Action & Target */}
          {isMeta && !infoMessage && (
            <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-data text-white/50 uppercase font-bold tracking-widest">
                   META: {formatMetaLabel(metaValue)}
                 </span>
                 <span className={cn(
                   "text-[10px] font-data font-bold tracking-widest",
                   achievement >= 100 ? "text-green-500" : achievement >= 70 ? "text-euro-gold" : "text-red-500"
                 )}>
                   {achievement.toFixed(0)}%
                 </span>
               </div>
               <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(achievement, 100)}%` }}
                   transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
                   className={cn(
                     "h-full rounded-full",
                     achievement >= 100 ? "bg-green-500" : achievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                   )}
                 />
               </div>
            </div>
          )}

          {!isMeta && (trend || action) && !infoMessage && (
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
                    {trend.value > 0 ? "+" : ""}{trend.prefix || ""}{formatNumber(Math.abs(trend.value))}
                  </span>
                  <span className="text-[10px] font-data text-white/50">
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
              <Info className="w-3.5 h-3.5 shrink-0 text-white/50 mt-[1px]" />
              <span className="text-[10px] font-data text-white/50 block">
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

export default function ConsorciosDash({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
  teamPhotos,
}: ConsorciosDashProps) {

  const [chartMetric, setChartMetric] = React.useState<ChartMetric>("contratos_ativos");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'comissao_total_num', direction: 'desc' });

  // Convert selectedMonth to guaranteed YYYY-MM
  const selectedMonthKey = selectedMonth ? selectedMonth.substring(0, 7) : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // 1. Fetch Assessor -> Team mapping to filter properly
  const { data: activeAssessorsData } = useQuery({
    queryKey: ["active-assessors-info-consorcio"],
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
    }
  });

  // 2. Fetch Base View (Dimensão) - All sales in selectedYear
  const { data: consorcioData, isLoading: isLoadingDim } = useQuery({
    queryKey: ["consorcios-dim", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from("dados_consorcio" as any)
        .select("*")
        .gte("data_venda", startDate)
        .lte("data_venda", endDate);

      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  // 3. Fetch Comissões View (Fato) - All commissions falling in selectedMonth
  const { data: comissoesDataMes, isLoading: isLoadingFact } = useQuery({
    queryKey: ["consorcios-fact", selectedMonthKey],
    queryFn: async () => {
      if (!selectedMonthKey) return [];
      
      const [year, month] = selectedMonthKey.split("-").map(Number);
      const startDate = `${selectedMonthKey}-01`;
      const endDt = new Date(year, month, 0); // last day of the selected month
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from("vw_dados_consorcio_comissoes" as any)
        .select("*")
        .gte("data_vencimento", startDate)
        .lte("data_vencimento", endDate);

      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  // 4. Fetch Comissões for the entire Year (for Chart)
  const { data: comissoesDataAno } = useQuery({
    queryKey: ["consorcios-fact-ano", selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("vw_dados_consorcio_comissoes" as any)
        .select("id, data_vencimento, cod_assessor, valor_comissao_mensal")
        .gte("data_vencimento", `${selectedYear}-01-01`)
        .lte("data_vencimento", `${selectedYear}-12-31`);
      return (data as any[]) || [];
    }
  });

  // 5. Fetch mv_resumo_assessor for the entire Year (for Chart target calculation)
  const { data: mvDataAno } = useQuery({
    queryKey: ["mv-resumo-assessor-ano-consorcio", selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, cod_assessor, time, custodia_net")
        .gte("data_posicao", `${selectedYear}-01-01`)
        .lte("data_posicao", `${selectedYear}-12-31`);
      return (data as any[]) || [];
    }
  });

  // ==========================================================================
  // Metrics Calculation
  // ==========================================================================
  
  const metrics = useMemo(() => {
    if (!consorcioData || !comissoesDataMes || !activeAssessorsData) {
      return {
        totalCotasAno: 0,
        totalClientesAno: 0,
        valorTotalAno: 0,
        ticketMedio: 0,
        totalCotasMes: 0,
        valorTotalMes: 0,
        receitaTotalMes: 0,
        metaReceitaMes: 0,
      };
    }

    let totalCustody = 0;

    // A. Filter Dimensions (Year context)
    const filteredYear = consorcioData.filter(c => {
      const cod = (c.cod_assessor || "").trim().toUpperCase();
      const assessor = activeAssessorsData.get(cod);

      if (selectedTeam !== "all" && assessor?.time !== selectedTeam) return false;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return false;
      
      // Filter out cancelled ones
      if (c.data_cancelamento) return false;

      return true;
    });

    // B. Filter Comissions (Month context)
    const filteredMonth = comissoesDataMes.filter(c => {
      const cod = (c.cod_assessor || "").trim().toUpperCase();
      const assessor = activeAssessorsData.get(cod);

      if (selectedTeam !== "all" && assessor?.time !== selectedTeam) return false;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return false;
      
      // Calculate active custody to use for meta
      if (assessor && assessor.custodia_net && c.data_cancelamento === null) {
        // Just sum custody if this is a unique client or we sum unique assesssors?
        // Wait, multiple consorcios per assessor shouldn't multiply custody. 
      }
      return true;
    });

    // To calculate custody properly for the target, we gather ALL active assessors 
    // that match the current filters
    activeAssessorsData.forEach((assessor, cod) => {
      if (selectedTeam !== "all" && assessor.time !== selectedTeam) return;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return;
      
      if (assessor && assessor.custodia_net) {
        totalCustody += Number(assessor.custodia_net);
      }
    });

    // Calculate Year Metrics
    const totalCotasAno = filteredYear.length;
    
    // Unique clients using available identifiers
    const uniqueClients = new Set(filteredYear.map(c => c.codigo_cliente || c.cpf_cnpj || c.cliente || c.id));
    const totalClientesAno = uniqueClients.size;
    
    const valorTotalAno = filteredYear.reduce((acc, curr) => acc + (Number(curr.valor_carta) || 0), 0);
    const ticketMedio = totalCotasAno > 0 ? valorTotalAno / totalCotasAno : 0;

    // Calculate Month Metrics (filter year dimension subset by exact month)
    const filteredYearForMonth = filteredYear.filter(c => {
      if (!c.data_venda) return false;
      return c.data_venda.substring(0, 7) === selectedMonthKey; // Safe string match
    });

    const totalCotasMes = filteredYearForMonth.length;
    const valorTotalMes = filteredYearForMonth.reduce((acc, curr) => acc + (Number(curr.valor_carta) || 0), 0);

    // Calculate Revenue and Meta (from Fact and Custody)
    const receitaTotalMes = filteredMonth.reduce((acc, curr) => acc + (Number(curr.valor_comissao_mensal) || 0), 0);
    const metaReceitaMes = (totalCustody * 0.0009) / 12;

    return {
      totalCotasAno,
      totalClientesAno,
      valorTotalAno,
      ticketMedio,
      totalCotasMes,
      valorTotalMes,
      receitaTotalMes,
      metaReceitaMes
    };
  }, [consorcioData, comissoesDataMes, activeAssessorsData, selectedTeam, selectedAssessorId, selectedMonthKey]);

  // ==========================================================================
  // Chart Data Preparation
  // ==========================================================================

  const chartData = useMemo(() => {
    if (!comissoesDataAno || !mvDataAno) return [];

    const grouped: Record<string, {
      realized: number;
      custody: number;
      ativos: Set<string>;
      novosQtd: number;
      novosVol: number;
    }> = {};

    // 1. Initialize months
    for (let i = 1; i <= 12; i++) {
        const mKey = `${selectedYear}-${String(i).padStart(2, "0")}`;
        grouped[mKey] = { realized: 0, custody: 0, ativos: new Set(), novosQtd: 0, novosVol: 0 };
    }

    const currentYearNum = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;

    // 2. Fetch custody points
    const custodyMap: Record<string, number> = {};
    mvDataAno.forEach((mv: any) => {
      const cod = (mv.cod_assessor || "").trim().toUpperCase();
      if (selectedTeam !== "all" && mv.time !== selectedTeam) return;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return;

      const mKey = mv.data_posicao?.substring(0, 7);
      if (mKey && mv.custodia_net && mKey.startsWith(selectedYear)) {
          if (!custodyMap[mKey]) custodyMap[mKey] = 0;
          custodyMap[mKey] += Number(mv.custodia_net);
      }
    });

    for (const mKey of Object.keys(grouped)) {
        grouped[mKey].custody = custodyMap[mKey] || 0;
    }

    // 3. Populate comissoesDataAno (realized, ativos)
    comissoesDataAno.forEach((curr: any) => {
      const cod = (curr.cod_assessor || "").trim().toUpperCase();
      const ptInfo = activeAssessorsData?.get(cod);
      
      if (selectedTeam !== "all" && ptInfo?.time !== selectedTeam) return;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return;

      const mKey = curr.data_vencimento?.substring(0, 7);
      if (mKey && grouped[mKey]) {
         grouped[mKey].realized += (Number(curr.valor_comissao_mensal) || 0);
         if (curr.id) grouped[mKey].ativos.add(String(curr.id));
      }
    });

    // 4. Populate consorcioData (novosQtd, novosVol)
    if (consorcioData) {
      consorcioData.forEach((curr: any) => {
        const cod = (curr.cod_assessor || "").trim().toUpperCase();
        const ptInfo = activeAssessorsData?.get(cod);
        
        if (selectedTeam !== "all" && ptInfo?.time !== selectedTeam) return;
        if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return;
  
        const mKey = curr.data_venda?.substring(0, 7);
        if (mKey && grouped[mKey]) {
           grouped[mKey].novosQtd += 1;
           grouped[mKey].novosVol += (Number(curr.valor_carta) || 0);
        }
      });
    }

    // 5. Build Array
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, rawVals]) => {
        const vals = rawVals as { realized: number; custody: number; ativos: Set<string>; novosQtd: number; novosVol: number; };
        const isFuture = Number(selectedYear) > currentYearNum || (Number(selectedYear) === currentYearNum && Number(monthKey.substring(5, 7)) > currentMonthNum);
        const target = (vals.custody * 0.0009) / 12;
        
        // Hide vs_meta data if target is zero OR if it's a future month
        const hasDataVsMeta = target > 0 && !isFuture;

        return {
          monthKey,
          monthName: format(parseISO(`${monthKey}-01`), "MMM", { locale: ptBR }),
          
          // Vs Meta metrics
          realized: hasDataVsMeta ? vals.realized : null,
          target: hasDataVsMeta ? target : null,
          
          // Previsão always has realized sum (past and future)
          previsao: vals.realized,

          // Ativos
          ativos: vals.ativos.size,
          
          // Novos
          novosQtd: vals.novosQtd,
          novosVol: vals.novosVol,
          
          isFuture
        };
      });
  }, [comissoesDataAno, mvDataAno, consorcioData, activeAssessorsData, selectedTeam, selectedAssessorId, selectedYear]);

  // Derived filtered data depending on the metric
  const displayChartData = useMemo(() => {
    return chartData.filter(d => {
      // Show future months only if we're looking at previsao
      if (d.isFuture && chartMetric !== "previsao_receita") return false;
      return true;
    });
  }, [chartData, chartMetric]);

  // ==========================================================================
  // Donut & Table Data Preparation
  // ==========================================================================

  const donutData = useMemo(() => {
    if (!comissoesDataMes || comissoesDataMes.length === 0) return [];
    
    // Group active quotas by administradora
    const grouped = comissoesDataMes.reduce((acc, curr) => {
       const cod = (curr.cod_assessor || "").trim().toUpperCase();
       const ptInfo = activeAssessorsData?.get(cod);
       if (selectedTeam !== "all" && ptInfo?.time !== selectedTeam) return acc;
       if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return acc;
       
       const adm = curr.administradora || "NÃO INFORMADA";
       if (!acc[adm]) acc[adm] = new Set();
       if (curr.id) acc[adm].add(curr.id);
       return acc;
    }, {} as Record<string, Set<string>>);
    
    // Convert to Recharts format
    const cData = Object.entries(grouped).map(([name, set]) => ({
      name,
      value: (set as Set<string>).size
    })).sort((a, b) => b.value - a.value);
    
    // Assign colors
    const colors = ["#FAC017", "#0066FF", "#8B5CF6", "#10B981", "#F43F5E", "#F97316", "#A855F7", "#3B82F6"];
    const total = cData.reduce((acc, curr) => acc + curr.value, 0);
    
    return cData.map((d, i) => ({
      ...d,
      percent: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0",
      color: colors[i % colors.length]
    }));
  }, [comissoesDataMes, selectedTeam, selectedAssessorId, activeAssessorsData]);

  const tableData = useMemo(() => {
    if (!activeAssessorsData || !comissoesDataMes || !mvDataAno) return [];
    
    const rows: any[] = [];
    
    activeAssessorsData.forEach((info, cod) => {
       if (selectedTeam !== 'all' && info.time !== selectedTeam) return;
       if (selectedAssessorId !== 'all' && cod !== selectedAssessorId.toUpperCase()) return;
       
       // Calculate this assessor's meta based on their custody in the selected month
       const mvHist = mvDataAno.find(mv => (mv.cod_assessor || "").toUpperCase() === cod && mv.data_posicao?.startsWith(selectedMonthKey));
       const custody = mvHist ? Number(mvHist.custodia_net || 0) : Number(info.custodia_net || 0);
       const meta = (custody * 0.0009) / 12;
       
       // Calculate comissions for the selected month
       const comissions = comissoesDataMes.filter(c => (c.cod_assessor || "").toUpperCase() === cod);
       const receita = comissions.reduce((acc, curr) => acc + Number(curr.valor_comissao_mensal || 0), 0);
       
       // Include if they have a target OR if they produced revenue
       if (receita > 0 || meta > 0) {
           rows.push({
               cod_assessor: cod,
               nome: info.nome_assessor,
               foto_url: info.foto_url || teamPhotos?.get(cod),
               meta,
               receita,
               atingimento: meta > 0 ? (receita / meta) * 100 : 0
           });
       }
    });
    
    return rows.sort((a, b) => b.receita - a.receita);
  }, [activeAssessorsData, comissoesDataMes, mvDataAno, selectedTeam, selectedAssessorId, selectedMonthKey, teamPhotos]);

  // Derived data for the Details Table
  const detailTableData = useMemo(() => {
    if (!consorcioData || !activeAssessorsData) return [];
    
    // Filter for selected month
    return consorcioData.filter((item: any) => {
      // 1. Filter by selected month
      if (!item.data_venda?.startsWith(selectedMonthKey)) return false;
      
      const cod = (item.cod_assessor || "").trim().toUpperCase();
      const assessor = activeAssessorsData.get(cod);
      
      // 2. Filter by Team and Assessor
      if (selectedTeam !== "all" && assessor?.time !== selectedTeam) return false;
      if (selectedAssessorId.length > 0 && !selectedAssessorId.map(i=>i.toUpperCase()).includes(cod)) return false;
      
      return true;
    }).map((item: any) => {
      const cod = (item.cod_assessor || "").trim().toUpperCase();
      const assessor = activeAssessorsData.get(cod);
      const valor_carta = Number(item.valor_carta) || 0;
      const comissao_total = Number(item.valor_comissao_total) || 0;
      const percentual = valor_carta > 0 ? (comissao_total / valor_carta) * 100 : 0;
      
      return {
        ...item,
        time: assessor?.time || "NÃO INFORMADO",
        nome_assessor: assessor?.nome_assessor || item.cod_assessor || "NÃO INFORMADO",
        foto_url: assessor?.foto_url || teamPhotos?.get(cod),
        percentual,
        valor_carta_num: valor_carta,
        comissao_total_num: comissao_total
      };
    })
    .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.administradora || "").toLowerCase().includes(term) ||
          (r.cliente || "").toLowerCase().includes(term) ||
          (r.contrato || "").toLowerCase().includes(term) ||
          (r.grupo || "").toLowerCase().includes(term) ||
          (r.cota || "").toLowerCase().includes(term) ||
          (r.produto || "").toLowerCase().includes(term)
        );
    })
    .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
    });
  }, [consorcioData, activeAssessorsData, selectedTeam, selectedAssessorId, selectedMonthKey, teamPhotos, searchTerm, sortConfig]);

  const totalValorCarta = detailTableData.reduce((acc, curr) => acc + curr.valor_carta_num, 0);
  const totalComissao = detailTableData.reduce((acc, curr) => acc + curr.comissao_total_num, 0);
  const totalPercentual = totalValorCarta > 0 ? (totalComissao / totalValorCarta) * 100 : 0;

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-gold ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-gold ml-auto" />;
  };

  const isLoading = isLoadingDim || isLoadingFact;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* HEADER INFO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display text-white tracking-wide flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
              <Briefcase className="w-6 h-6 text-euro-gold" />
            </span>
            Consórcios
          </h2>
          <p className="text-white/40 font-data tracking-widest uppercase text-xs mt-2 ml-15">
            Volumetria e Receita Consolidada
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-white/30 font-data uppercase tracking-widest text-xs">
          Analisando volumes e parcelas de consórcios...
        </div>
      ) : (
        <>
          {/* VISÃO DO MÊS SELECIONADO */}
          <div className="space-y-4">
            <h3 className="text-sm font-data text-euro-gold uppercase tracking-[0.2em] opacity-80 pl-2">
              Visão Mensal ({format(parseISO(`${selectedMonthKey}-01`), "MMM/yyyy", { locale: ptBR })})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                title="Receita do Mês"
                value={formatCurrency(metrics.receitaTotalMes)}
                rawValue={metrics.receitaTotalMes}
                metaValue={metrics.metaReceitaMes}
                subtitle="Soma das parcelas projetadas"
                icon={TrendingUp}
                color="#0066FF" // Azul Euro
                delay={0}
              />
              <KpiCard
                title="Valor de Cotas no Mês"
                value={formatCurrency(metrics.valorTotalMes)}
                subtitle="Cotas realizadas localizadas neste mês"
                icon={DollarSign}
                color="#FAC017" // Ouro Euro
                delay={0.1}
              />
              <KpiCard
                title="Cotas Realizadas (Mês)"
                value={formatNumber(metrics.totalCotasMes)}
                subtitle="Contratos comercializados no mês"
                icon={FileText}
                color="#10B981" // Verde Esmeralda
                delay={0.2}
              />
            </div>
          </div>

          <div className="w-full h-px bg-white/5 my-8"></div>

          {/* VISÃO DO ANO SELECIONADO */}
          <div className="space-y-4">
            <h3 className="text-sm font-data text-euro-gold uppercase tracking-[0.2em] opacity-80 pl-2">
              Visão Anual ({selectedYear})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Total Cotas Ativas (Ano)"
                value={formatNumber(metrics.totalCotasAno)}
                subtitle="Soma de contratos no ano"
                icon={Target}
                color="#FAC017"
                delay={0.3}
              />
              <KpiCard
                title="Total de Clientes"
                value={formatNumber(metrics.totalClientesAno)}
                subtitle="CPFs/CNPJs Únicos"
                icon={Users}
                color="#A0A090"
                delay={0.4}
              />
              <KpiCard
                title="Valor Total das Cotas"
                value={formatCurrency(metrics.valorTotalAno)}
                subtitle="Volume financeiro total"
                icon={Briefcase}
                color="#8B5CF6" // Roxo suave
                delay={0.5}
              />
              <KpiCard
                title="Ticket Médio"
                value={formatCurrency(metrics.ticketMedio)}
                subtitle="Média por consórcio"
                icon={DollarSign}
                color="#14B8A6" // Teal (Ciano escuro)
                delay={0.6}
              />
            </div>
          </div>
          {/* CHART: EVOLUÇÃO MENSAL */}
          <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 hidden sm:block">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                <h3 className="text-lg font-display text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-euro-gold" />
                  Consórcios — Evolução {selectedYear}
                </h3>
                <p className="text-[11px] text-white/70 font-data mt-1 uppercase tracking-widest">
                  {CHART_METRICS[chartMetric].tooltip}
                </p>
              </div>

              {/* Chart Selector Dropdown */}
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
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setChartMetric(key)}
                      className={cn(
                        "gap-2 cursor-pointer text-xs hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white",
                        chartMetric === key && "bg-white/10 text-euro-gold"
                      )}
                    >
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
                    <linearGradient id="rfBarPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0066FF" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#0066FF" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="rfBarSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="rfBarNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="ativosBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="novosBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FAC017" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#FAC017" stopOpacity={0.2} />
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

                  {/* Left Axis */}
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    tickFormatter={(v) =>
                      chartMetric === "contratos_ativos" 
                         ? v 
                         : Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
                    }
                  />
                  
                  {/* Right Axis (Only for Novos Qtd) */}
                  {chartMetric === "contratos_novos" && (
                     <YAxis
                       yAxisId="right"
                       orientation="right"
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                     />
                  )}

                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CustomTooltip />} />
                  
                  {/* Views */}
                  {chartMetric === "previsao_receita" && (
                    <Bar yAxisId="left" dataKey="previsao" name="Previsão (R$)" radius={[4, 4, 0, 0]} barSize={40}>
                      {displayChartData.map((entry, index) => {
                        let fill = entry.isFuture ? "rgba(255, 255, 255, 0.2)" : "url(#rfBarPositive)";
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  )}

                  {chartMetric === "vs_meta" && (
                    <>
                      <Bar yAxisId="left" dataKey="realized" name="Realizado" radius={[4, 4, 0, 0]} barSize={40}>
                        {displayChartData.map((entry, index) => {
                          let fill = "url(#rfBarPositive)";
                          if (entry.target > 0 && entry.realized >= entry.target) fill = "url(#rfBarSuccess)";
                          else if (entry.realized < 0) fill = "url(#rfBarNegative)";
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="target"
                        name="Meta (ROA)"
                        stroke="#FFFFFF"
                        strokeOpacity={0.5}
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#1A2030", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#FAC017", stroke: "#fff" }}
                      />
                    </>
                  )}

                  {chartMetric === "contratos_ativos" && (
                      <Bar yAxisId="left" dataKey="ativos" name="Qtd. Contratos Ativos" fill="url(#ativosBar)" barSize={40} radius={[4, 4, 0, 0]} />
                  )}

                  {chartMetric === "contratos_novos" && (
                    <>
                      <Bar yAxisId="left" dataKey="novosVol" name="Volume (R$)" fill="url(#novosBar)" barSize={40} radius={[4, 4, 0, 0]} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="novosQtd"
                        name="Qtd. Novos Contratos"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#1A2030", stroke: "#8B5CF6", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#8B5CF6", stroke: "#fff" }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {/* DETALHES INFERIORES: DONUT E TABELA */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mt-6">
          {/* Gráfico de Donut: Cotas Ativas por Adm */}
          <Card className="lg:col-span-3 bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 flex flex-col hover:border-euro-gold/30 transition-all h-[420px]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-euro-gold/10 flex items-center justify-center border border-euro-gold/20">
                <Target className="w-4 h-4 text-euro-gold" />
              </div>
              <div>
                <h3 className="text-[13px] font-data text-white uppercase tracking-widest font-bold">Cotas Ativas</h3>
                <p className="text-[11px] text-white/70 font-medium uppercase tracking-tighter">Por Administradora</p>
              </div>
            </div>
            
            <div className="h-[220px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={true}
                    style={{ outline: "none" }}
                  >
                    {donutData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" style={{ outline: "none" }} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-white leading-none">
                  {donutData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Total Cotas</span>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {donutData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-data">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-white/60">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{item.value}</span>
                    <span className="text-[10px] text-white">({item.percent}%)</span>
                  </div>
                </div>
              ))}
              {donutData.length === 0 && (
                <div className="text-center text-xs font-data uppercase tracking-widest text-white/30 py-4">
                  Sem dados para exibição
                </div>
              )}
            </div>
          </Card>

          {/* Tabela de Assessores */}
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
                            {row.foto_url ? (
                              <img src={row.foto_url} alt={row.nome} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 opacity-20" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                              {row.nome}
                            </span>
                            <span className="text-[12.6px] text-white/60 font-mono">{row.cod_assessor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 border-r border-white/10 text-right text-white/70">
                        {formatCurrency(row.meta)}
                      </td>
                      <td className="py-3 px-4 border-r border-white/10 text-right text-white font-bold">
                        {formatCurrency(row.receita)}
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end">
                         <div className={cn(
                           "px-2 py-1 rounded-md text-xs font-bold text-center w-20", 
                           row.atingimento >= 100 ? "bg-[#22C55E]/10 text-[#22C55E]" : 
                           row.atingimento >= 70 ? "bg-[#FAC017]/10 text-[#FAC017]" : 
                           "bg-[#EF4444]/10 text-[#EF4444]"
                         )}>
                           {row.atingimento.toFixed(1)}%
                         </div>
                      </td>
                    </tr>
                  ))}
                  {tableData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center opacity-30 text-xs font-data uppercase tracking-widest text-white">Nenhum desempenho registrado no período</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* DETALHADA: TABELA DE BOLETAS DO MÊS */}
      {!isLoading && (
        <div className="space-y-6 mt-10">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
            <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
              <FileStack className="w-5 h-5" />
              Detalhamento de Consórcios ({format(parseISO(`${selectedMonthKey}-01`), "MMMM yyyy", { locale: ptBR })})
            </h3>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-80 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
                <Input
                  type="text"
                  placeholder="Buscar por assessor, cliente, grupo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
                />
              </div>
              <Button
                onClick={() => {
                  const rows = detailTableData.map((r: any) => ({
                    "Time": r.time || "",
                    "Cód. Assessor": r.cod_assessor || "",
                    "Assessor": r.nome_assessor || "",
                    "Administradora": r.administradora || "",
                    "Data Venda": r.data_venda || "",
                    "Cliente": r.cliente || "",
                    "Contrato": r.contrato || "",
                    "Grupo/Cota": r.grupo ? `${r.grupo} / ${r.cota || "-"}` : "",
                    "Produto": r.produto || "",
                    "Valor Carta": r.valor_carta_num || 0,
                    "%": r.percentual ? r.percentual.toFixed(2) + "%" : "0%",
                    "Comissão R$": r.comissao_total_num || 0,
                  }));
                  const worksheet = XLSX.utils.json_to_sheet(rows);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Consórcios");
                  XLSX.writeFile(workbook, `detalhamento_consorcios_${selectedMonthKey}.xlsx`);
                }}
                className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold h-10 gap-2 px-4 shadow-lg shadow-euro-gold/10"
              >
                <Download className="w-4 h-4" />
                XLSX
              </Button>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

            <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1200px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                    <th onClick={() => handleSort('time')} className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                    </th>
                    <th onClick={() => handleSort('nome_assessor')} className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                    </th>
                    <th onClick={() => handleSort('administradora')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Administradora <SortIcon column="administradora" /></div>
                    </th>
                    <th onClick={() => handleSort('data_venda')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Venda <SortIcon column="data_venda" /></div>
                    </th>
                    <th onClick={() => handleSort('cliente')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Cliente <SortIcon column="cliente" /></div>
                    </th>
                    <th onClick={() => handleSort('contrato')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Contrato <SortIcon column="contrato" /></div>
                    </th>
                    <th onClick={() => handleSort('grupo')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Grupo/Cota <SortIcon column="grupo" /></div>
                    </th>
                    <th onClick={() => handleSort('produto')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2">Produto <SortIcon column="produto" /></div>
                    </th>
                    <th onClick={() => handleSort('valor_carta_num')} className="py-4 px-4 font-bold border-r border-euro-navy/5 text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2 justify-end">Valor Carta <SortIcon column="valor_carta_num" /></div>
                    </th>
                    <th onClick={() => handleSort('percentual')} className="py-4 px-4 font-bold border-r border-euro-navy/5 text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2 justify-end">% <SortIcon column="percentual" /></div>
                    </th>
                    <th onClick={() => handleSort('comissao_total_num')} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                      <div className="flex items-center gap-2 justify-end">Comissão R$ <SortIcon column="comissao_total_num" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {detailTableData.map((item, i) => (
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
                          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors">
                            {item.foto_url ? (
                              <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 opacity-20" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                              {item.nome_assessor}
                            </span>
                            <span className="text-[10.5px] text-white/60 font-mono tracking-widest">{item.cod_assessor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-white border-r border-white/5 uppercase">
                        {item.administradora || "—"}
                      </td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5">
                        {item.data_venda ? format(parseISO(item.data_venda), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="py-3 px-4 text-white border-r border-white/5 uppercase max-w-[200px] truncate">
                        {item.cliente || "—"}
                      </td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5 font-mono">
                        {item.contrato || "—"}
                      </td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5 font-mono">
                        {item.grupo ? `${item.grupo} / ${item.cota || "-"}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-white/80 border-r border-white/5 uppercase">
                        {item.produto || "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-white font-bold border-r border-white/5">
                        {formatCurrency(item.valor_carta_num)}
                      </td>
                      <td className="py-3 px-4 text-right text-euro-gold/70 border-r border-white/5 font-mono">
                        {item.percentual.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-euro-gold font-bold">
                        {formatCurrency(item.comissao_total_num)}
                      </td>
                    </tr>
                  ))}
                  {detailTableData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-20 text-center opacity-20">
                        <div className="flex flex-col items-center gap-4">
                          <Search className="w-10 h-10" />
                          <p className="text-sm font-data uppercase tracking-widest">Nenhuma cota encontrada no período</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-30">
                  <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                    <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                    <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                    <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                      <span className="text-white/50">{detailTableData.length} registros</span>
                    </td>
                    <td className="py-4 px-4 text-right text-white bg-black/80">{formatCurrency(totalValorCarta)}</td>
                    <td className="py-4 px-4 text-right text-euro-gold/70 bg-black/80 font-mono">{totalPercentual.toFixed(2)}%</td>
                    <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrency(totalComissao)}</td>
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
