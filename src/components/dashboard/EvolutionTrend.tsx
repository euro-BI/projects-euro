
import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState, useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronDown, 
  TrendingUp, 
  Coins, 
  Briefcase, 
  BarChart3,
  Star,
  Users as UsersIcon,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Calculator,
  CalendarDays,
  Target as TargetIcon,
  Percent,
  History,
  LayoutDashboard
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnalysisType = "meta" | "mom" | "yoy" | "avg" | "mm3" | "mm6" | "mm12";

export interface MetricConfig {
  label: string;
  field?: string;
  fields?: string[];
  roa?: number; // Target ROA for revenue metrics
  targetValue?: number; // Direct target value if applicable
  mode?: "currency" | "percent" | "number"; // Override component mode
  icon?: React.ReactNode;
}

interface EvolutionTrendProps {
  data: AssessorResumo[];
  previousYearData?: AssessorResumo[];
  metrics: Record<string, MetricConfig>;
  defaultMetric: string;
  title: string;
  mode?: "currency" | "percent" | "number";
  icon?: React.ReactNode;
}

export default function EvolutionTrend({ 
  data, 
  previousYearData = [], 
  metrics, 
  defaultMetric, 
  title, 
  mode: defaultMode = "currency",
  icon = <TrendingUp className="w-4 h-4" />
}: EvolutionTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>(defaultMetric);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("meta");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeMetric = metrics[selectedMetric];
  const currentMode = activeMetric.mode || defaultMode;

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Aggregate data by month for the selected metric
  const monthlyData = useMemo(() => {
    if (!data.length) return [];

    const metric = metrics[selectedMetric];
    
    // Group raw data by month
    const groupData = (raw: AssessorResumo[]) => raw.reduce((acc: Record<string, AssessorResumo[]>, curr) => {
      const month = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!acc[month]) acc[month] = [];
      acc[month].push(curr);
      return acc;
    }, {});

    const groupedByMonth = groupData(data);
    const prevGroupedByMonth = groupData(previousYearData);

    // Combine current and previous year data for a continuous timeline
    const allGroupedData = { ...prevGroupedByMonth, ...groupedByMonth };
    const allMonthsKeys = Object.keys(allGroupedData).sort();

    // The months we want to actually display (only from current year 'data')
    const displayMonths = Object.keys(groupedByMonth).sort();
    
    const aggregated = displayMonths.map(monthKey => {
      const monthAssessors = groupedByMonth[monthKey];
      const monthDate = parseISO(`${monthKey}-01`);
      
      // Calculate total value and total custody for this month
      const calculateValue = (assessors: AssessorResumo[]) => {
        if (currentMode === "percent" && selectedMetric === "roa") {
          // Special case for ROA: (Total Revenue / Total Custody) * 12
          const totalRev = assessors.reduce((sum, curr) => sum + (curr.receita_total || 0), 0);
          const totalCust = assessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
          return totalCust > 0 ? (totalRev / totalCust) * 12 : 0;
        }

        return assessors.reduce((sum, curr) => {
          if (metric.field) return sum + ((curr as any)[metric.field] || 0);
          if (metric.fields) return sum + metric.fields.reduce((fSum, f) => fSum + ((curr as any)[f] || 0), 0);
          return sum;
        }, 0);
      };

      const totalValue = calculateValue(monthAssessors);
      const totalCustody = monthAssessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
      
      // Target Value
      let targetValue = 0;
      if (currentMode === "percent" && selectedMetric === "roa") {
        targetValue = 0.0108; // 1.08%
      } else if (metric.roa) {
        // Target Revenue = (Target ROA / 12) * Custody
        targetValue = (metric.roa / 12) * totalCustody;
      } else if (metric.targetValue) {
        targetValue = metric.targetValue;
      }

      // YoY Calculation: Find same month in previous year
      const prevMonthKey = format(subMonths(monthDate, 12), "yyyy-MM");
      const prevYearValue = prevGroupedByMonth[prevMonthKey] ? calculateValue(prevGroupedByMonth[prevMonthKey]) : 0;
      const yoyPercentage = prevYearValue > 0 ? ((totalValue - prevYearValue) / prevYearValue) * 100 : 0;

      // Calculate Moving Averages based on all available data (current + prev year)
      const getMM = (window: number) => {
        const monthIndex = allMonthsKeys.indexOf(monthKey);
        if (monthIndex === -1) return 0;
        
        const start = Math.max(0, monthIndex - window);
        const windowKeys = allMonthsKeys.slice(start, monthIndex);
        
        if (windowKeys.length === 0) return 0;

        const windowValues = windowKeys.map(k => calculateValue(allGroupedData[k]));
        return windowValues.reduce((s, v) => s + v, 0) / windowValues.length;
      };

      // Find best assessor for this month/metric
      const sortedAssessors = [...monthAssessors].sort((a, b) => {
        let valA = 0;
        let valB = 0;
        
        if (currentMode === "percent" && selectedMetric === "roa") {
          valA = a.roa || 0;
          valB = b.roa || 0;
        } else {
          valA = metric.field ? (a as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((a as any)[f] || 0), 0);
          valB = metric.field ? (b as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((b as any)[f] || 0), 0);
        }
        return (valB || 0) - (valA || 0);
      });
      
      const bestAssessorRaw = sortedAssessors[0];

      // Find best team for this month/metric
      const teamTotals = monthAssessors.reduce((acc: Record<string, number>, curr) => {
        const team = curr.time || "Sem Time";
        let val = 0;
        if (currentMode === "percent" && selectedMetric === "roa") {
          // Average ROA for the team
          if (!acc[team + "_rev"]) acc[team + "_rev"] = 0;
          if (!acc[team + "_cust"]) acc[team + "_cust"] = 0;
          acc[team + "_rev"] += curr.receita_total || 0;
          acc[team + "_cust"] += curr.custodia_net || 0;
        } else {
          val = metric.field ? (curr as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((curr as any)[f] || 0), 0);
          acc[team] = (acc[team] || 0) + (val || 0);
        }
        return acc;
      }, {});
      
      let bestTeam: [string, number] = ["Sem Dados", 0];
      if (currentMode === "percent" && selectedMetric === "roa") {
        const teams = Array.from(new Set(monthAssessors.map(a => a.time || "Sem Time")));
        const teamROAs = teams.map(t => {
          const rev = teamTotals[t + "_rev"] || 0;
          const cust = teamTotals[t + "_cust"] || 0;
          return [t, cust > 0 ? (rev / cust) * 12 : 0] as [string, number];
        });
        bestTeam = teamROAs.sort((a, b) => b[1] - a[1])[0] || ["Sem Dados", 0];
      } else {
        bestTeam = Object.entries(teamTotals).sort((a, b) => b[1] - a[1])[0] || ["Sem Dados", 0];
      }

      return {
        month: monthKey,
        date: monthDate,
        value: totalValue,
        targetValue: targetValue,
        prevYearValue: prevYearValue,
        yoyPercentage: yoyPercentage,
        achievement: (totalValue / (targetValue || 1)) * 100,
        mm3: getMM(3),
        mm6: getMM(6),
        mm12: getMM(12),
        bestAssessor: bestAssessorRaw ? {
          name: bestAssessorRaw.nome_assessor,
          photo: bestAssessorRaw.foto_url,
          value: currentMode === "percent" && selectedMetric === "roa" ? (bestAssessorRaw.roa || 0) : (metric.field ? (bestAssessorRaw as any)[metric.field] : metric.fields?.reduce((s: number, f: string) => s + ((bestAssessorRaw as any)[f] || 0), 0))
        } : null,
        bestTeam: {
          name: bestTeam[0],
          value: bestTeam[1]
        }
      };
    });

    // Overall Average
    const overallAvg = aggregated.reduce((s, curr) => s + curr.value, 0) / aggregated.length;
    
    // Calculate MoM percentage changes
    return aggregated.map((d, i, arr) => {
      let prevValue = 0;
      if (i > 0) {
        prevValue = arr[i - 1].value;
      } else {
        const prevMonthDate = subMonths(d.date, 1);
        const prevMonthKey = format(prevMonthDate, "yyyy-MM");
        if (prevGroupedByMonth[prevMonthKey]) {
          const calculateValue = (assessors: AssessorResumo[]) => {
            if (currentMode === "percent" && selectedMetric === "roa") {
              const totalRev = assessors.reduce((sum, curr) => sum + (curr.receita_total || 0), 0);
              const totalCust = assessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
              return totalCust > 0 ? (totalRev / totalCust) * 12 : 0;
            }
            return assessors.reduce((sum, curr) => {
              if (metric.field) return sum + ((curr as any)[metric.field] || 0);
              if (metric.fields) return sum + metric.fields.reduce((fSum, f) => fSum + ((curr as any)[f] || 0), 0);
              return sum;
            }, 0);
          };
          prevValue = calculateValue(prevGroupedByMonth[prevMonthKey]);
        }
      }

      const percentage = prevValue > 0 ? ((d.value - prevValue) / prevValue) * 100 : 0;
      return { ...d, percentage, overallAvg, prevValue };
    });
  }, [data, previousYearData, selectedMetric, currentMode, metrics]);

  useEffect(() => {
    if (!monthlyData.length || dimensions.width === 0) return;

    const plot = Plot.plot({
      width: dimensions.width,
      height: dimensions.height,
      style: {
        background: "transparent",
        color: "#A0A090",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "12.6px",
      },
      marginLeft: 60,
      marginBottom: 40,
      marginTop: 40,
      x: {
        type: "band",
        label: null,
        tickFormat: (d) => format(d, "MMM yy", { locale: ptBR }),
      },
      y: {
        grid: true,
        label: null,
        tickFormat: (d) => {
          if (currentMode === "percent") return `${(d * 100).toFixed(2)}%`;
          if (currentMode === "currency") {
            if (d >= 1000000) return `R$ ${(d / 1000000).toFixed(1)}M`;
            if (d >= 1000) return `R$ ${(d / 1000).toFixed(0)}k`;
            return `R$ ${d}`;
          }
          if (currentMode === "number") return d.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
          if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
          if (d >= 1000) return `${(d / 1000).toFixed(1)}k`;
          return d;
        },
      },
      marks: [
        // Realized Area
        Plot.areaY(monthlyData, {
          x: "date",
          y: "value",
          fill: "#FAC017",
          fillOpacity: 0.1,
          curve: "monotone-x",
        }),
        // Realized Line
        Plot.lineY(monthlyData, {
          x: "date",
          y: "value",
          stroke: "#FAC017",
          strokeWidth: 2.5,
          curve: "monotone-x",
        }),
        // Target Bars (Only in Meta analysis)
        ...(analysisType === "meta" ? [
          Plot.barY(monthlyData, {
            x: "date",
            y: "targetValue",
            fill: "#FFFFFF",
            fillOpacity: 0.05,
            inset: 2,
          })
        ] : []),
        // Previous Year Bars (Only in YoY analysis)
        ...(analysisType === "yoy" ? [
          Plot.barY(monthlyData, {
            x: "date",
            y: "prevYearValue",
            fill: "#FFFFFF",
            fillOpacity: 0.05,
            inset: 2,
          })
        ] : []),
        // Overall Average Line (Only in avg analysis)
        ...(analysisType === "avg" ? [
          Plot.ruleY([monthlyData[0]?.overallAvg], {
            stroke: "#FFFFFF",
            strokeDasharray: "4,4",
            strokeOpacity: 0.3,
            strokeWidth: 1.5,
          }),
          Plot.text([monthlyData[0]?.overallAvg], {
            text: (d) => `MÉDIA: ${formatDisplayValue(d, true)}`,
            x: monthlyData[0]?.date,
            dy: -10,
            fontSize: 12.6,
            fill: "#FFFFFF",
            fillOpacity: 0.5,
          })
        ] : []),
        // Moving Average Lines
        ...(["mm3", "mm6", "mm12"].includes(analysisType) ? [
          Plot.lineY(monthlyData, {
            x: "date",
            y: analysisType,
            stroke: "#FFFFFF",
            strokeOpacity: 0.4,
            strokeWidth: 2,
            curve: "monotone-x",
            strokeDasharray: "2,2",
          })
        ] : []),
        // Data points
        Plot.dot(monthlyData, {
          x: "date",
          y: "value",
          fill: "#FAC017",
          stroke: "#1A2030",
          strokeWidth: 2,
          r: 5,
        }),
        // Analysis Labels
        Plot.text(monthlyData, {
          x: "date",
          y: "value",
          text: (d) => {
            if (analysisType === "mom" && d.percentage !== 0) {
              return `${d.percentage > 0 ? "↑" : "↓"} ${Math.abs(d.percentage).toFixed(1)}%`;
            }
            if (analysisType === "meta") {
              return d.targetValue > 0 ? `${d.achievement.toFixed(0)}%` : "";
            }
            if (analysisType === "yoy" && d.yoyPercentage !== 0) {
              return `${d.yoyPercentage > 0 ? "↑" : "↓"} ${Math.abs(d.yoyPercentage).toFixed(1)}%`;
            }
            if (analysisType === "avg") {
              const perc = (d.value / (d.overallAvg || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            if (["mm3", "mm6", "mm12"].includes(analysisType)) {
              const refValue = (d as any)[analysisType];
              const perc = (d.value / (refValue || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            return "";
          },
          dy: -25,
          fontSize: 12.6,
          fontWeight: "bold",
          fill: (d) => {
            if (analysisType === "mom") return d.percentage > 0 ? "#22c55e" : "#ef4444";
            if (analysisType === "meta") return d.achievement >= 100 ? "#22c55e" : d.achievement >= 70 ? "#FAC017" : "#ef4444";
            if (analysisType === "yoy") return d.yoyPercentage > 0 ? "#22c55e" : "#ef4444";
            
            const refValue = analysisType === "avg" ? d.overallAvg : (d as any)[analysisType];
            const perc = (d.value / (refValue || 1)) * 100;
            return perc >= 100 ? "#22c55e" : perc >= 70 ? "#FAC017" : "#ef4444";
          },
        }),
        // Absolute Value Labels
        Plot.text(monthlyData, {
          x: "date",
          y: "value",
          text: (d) => {
            const val = d.value;
            if (currentMode === "percent") return `${(val * 100).toFixed(2)}%`;
            if (currentMode === "number") return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
            if (val >= 1000000) return `${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
            if (val >= 1000) return `${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
            return val.toLocaleString("pt-BR");
          },
          dy: -12,
          fontSize: 12.6,
          fontWeight: "500",
          fill: "#FFFFFF",
        }),
        Plot.ruleY([0], { stroke: "#FFFFFF10" }),
      ],
    });

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !monthlyData.length) return;
      
      const svg = containerRef.current.querySelector("svg");
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      
      const chartWidth = dimensions.width - 60 - 20; 
      const step = chartWidth / monthlyData.length;
      const index = Math.floor((mx - 60) / step);
      const clampedIndex = Math.max(0, Math.min(index, monthlyData.length - 1));
      
      setSelectedMonthData(monthlyData[clampedIndex]);
      setIsModalOpen(true);
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.append(plot);
      const container = containerRef.current;
      container.addEventListener("click", handleClick);
    }

    return () => {
      plot.remove();
      if (containerRef.current) {
        containerRef.current.removeEventListener("click", handleClick);
      }
    };
  }, [monthlyData, dimensions, analysisType, currentMode]);

  const analysisSubtitles: Record<AnalysisType, string> = {
    meta: "Comparativo de atingimento em relação à meta projetada",
    mom: "Variação percentual em relação ao mês anterior",
    yoy: "Comparativo de performance com o mesmo período do ano anterior",
    avg: "Comparação com a média histórica do período",
    mm3: "Tendência suavizada (média móvel de 3 meses)",
    mm6: "Tendência suavizada (média móvel de 6 meses)",
    mm12: "Tendência suavizada (média móvel de 12 meses)",
  };

  const formatDisplayValue = (val: number, isLabel = false) => {
    if (currentMode === "percent") return `${(val * 100).toFixed(2)}%`;
    if (currentMode === "currency") {
      if (val >= 1000000) return `R$ ${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
      if (val >= 1000) return `R$ ${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
      return `R$ ${val.toLocaleString("pt-BR")}`;
    }
    if (currentMode === "number") return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    if (val >= 1000000) return `${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
    if (val >= 1000) return `${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  const getComparisonLabel = () => {
    switch (analysisType) {
      case "meta": return "Meta Projetada";
      case "yoy": return "Ano Anterior";
      case "mom": return "Mês Anterior";
      case "avg": return "Média Geral";
      case "mm3": return "Média Móvel (3m)";
      case "mm6": return "Média Móvel (6m)";
      case "mm12": return "Média Móvel (12m)";
      default: return "";
    }
  };

  const getComparisonValue = (d: any) => {
    switch (analysisType) {
      case "meta": return d.targetValue;
      case "yoy": return d.prevYearValue;
      case "mom": return d.prevValue;
      case "avg": return d.overallAvg;
      case "mm3": return d.mm3;
      case "mm6": return d.mm6;
      case "mm12": return d.mm12;
      default: return 0;
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
            {metrics[selectedMetric].icon || icon}
            {title}: {metrics[selectedMetric].label}
          </h3>
          <p className="text-xs font-data text-white/40 uppercase tracking-widest">
            {analysisSubtitles[analysisType]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-euro-elevated p-1 rounded-md border border-white/5 overflow-x-auto">
            {(["meta", "mom", "yoy", "avg"] as AnalysisType[]).map((type) => (
              <Button 
                key={type}
                variant="ghost" 
                size="sm"
                onClick={() => setAnalysisType(type)}
                className={cn(
                  "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                  analysisType === type ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
                )}
              >
                {type === "avg" ? "Média" : type}
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                    ["mm3", "mm6", "mm12"].includes(analysisType) ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
                  )}
                >
                  MM {["mm3", "mm6", "mm12"].includes(analysisType) ? analysisType.replace("mm", "") : ""}
                  <ChevronDown className="ml-1 w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0]">
                <DropdownMenuItem onClick={() => setAnalysisType("mm3")} className="text-xs font-data">3 Meses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAnalysisType("mm6")} className="text-xs font-data">6 Meses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAnalysisType("mm12")} className="text-xs font-data">12 Meses</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-[#5C5C50] hover:text-euro-gold hover:bg-euro-gold/10 transition-all">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-euro-navy border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
                <DialogHeader className="border-b border-white/5 pb-4">
                  <DialogTitle className="text-xl font-display text-euro-gold flex items-center gap-3">
                    <Calculator className="w-6 h-6" />
                    Metodologia de Cálculos e Análises
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-8 py-6">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-euro-gold">
                      <TrendingUp className="w-4 h-4" />
                      <h4 className="text-sm font-data uppercase tracking-widest font-bold">Tipos de Análise (%)</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-euro-gold/10 flex items-center justify-center flex-shrink-0">
                          <TargetIcon className="w-4 h-4 text-euro-gold" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white/80">Meta Projetada</span>
                          <p className="text-[11px] text-[#A0A090] leading-relaxed">
                            Compara o valor realizado com a meta projetada para o período.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <History className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white/80">Médias Móveis (MM 3, 6 e 12)</span>
                          <p className="text-[11px] text-[#A0A090] leading-relaxed">
                            Compara o mês atual com a média dos X meses anteriores.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white/80">MoM & YoY</span>
                          <p className="text-[11px] text-[#A0A090] leading-relaxed">
                            MoM: Variação em relação ao mês anterior. <br/>
                            YoY: Variação em relação ao mesmo mês do ano anterior.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </DialogContent>
            </Dialog>

            {Object.keys(metrics).length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-euro-elevated border-white/10 text-[#E8E8E0] font-data text-xs h-10 gap-3 min-w-[200px] justify-between">
                  <div className="flex items-center gap-2">
                    {metrics[selectedMetric].icon ? (
                      <span className="text-euro-gold">{metrics[selectedMetric].icon}</span>
                    ) : (
                      <BarChart3 className="w-4 h-4 text-euro-gold" />
                    )}
                    {metrics[selectedMetric].label}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0] w-[240px]">
                  {Object.entries(metrics).map(([key, config]) => (
                    <DropdownMenuItem key={key} onClick={() => setSelectedMetric(key)} className="cursor-pointer text-xs gap-2">
                      {config.icon && <span className="text-euro-gold/80">{config.icon}</span>}
                      {config.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full min-h-[350px] overflow-hidden cursor-pointer" />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1A2030]/95 backdrop-blur-xl border border-euro-gold/20 text-white max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto custom-scrollbar">
          {selectedMonthData && (
            <div className="space-y-6">
              <DialogHeader className="border-b border-white/5 pb-4">
                <DialogTitle className="flex justify-between items-end w-full">
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-data text-euro-gold uppercase tracking-[0.2em]">
                      {format(selectedMonthData.date, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-2xl font-display text-[#F5F5F0]">
                      {formatDisplayValue(selectedMonthData.value, true)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-data text-white/60 uppercase tracking-wider">
                      {getComparisonLabel()}
                    </span>
                    <span className="text-sm font-data text-euro-gold">
                      {formatDisplayValue(getComparisonValue(selectedMonthData))}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {selectedMonthData.bestAssessor && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-euro-gold fill-euro-gold" />
                    <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Assessor</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="w-14 h-14 rounded-full bg-euro-inset border border-euro-gold/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {selectedMonthData.bestAssessor.photo ? (
                        <img src={selectedMonthData.bestAssessor.photo} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-data text-euro-gold/40">
                          {selectedMonthData.bestAssessor.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-base font-ui text-[#E8E8E0] truncate">{selectedMonthData.bestAssessor.name}</span>
                      <span className="text-sm font-data text-euro-gold">{formatDisplayValue(selectedMonthData.bestAssessor.value, true)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-euro-gold" />
                  <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Time</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg border border-white/5">
                  <span className="text-base font-ui text-[#E8E8E0]">{selectedMonthData.bestTeam.name}</span>
                  <span className="text-base font-data text-euro-gold">{formatDisplayValue(selectedMonthData.bestTeam.value, true)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
