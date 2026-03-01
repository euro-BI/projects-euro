
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
  ArrowRightLeft,
  HelpCircle,
  Calculator,
  CalendarDays,
  Target as TargetIcon,
  Percent,
  History
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

interface RevenueEvolutionProps {
  data: AssessorResumo[];
  previousYearData?: AssessorResumo[];
}

type MetricKey = 
  | "total" | "invest" | "cross" 
  | "asset" | "b3" | "estruturadas" | "cetipados" | "ofertas" | "renda_fixa"
  | "seguros" | "previdencia" | "compromissadas" | "cambio" | "offshore" | "consorcios";

type AnalysisType = "meta" | "mom" | "yoy" | "avg" | "mm3" | "mm6" | "mm12" | "acc";

const METRICS: Record<MetricKey, { label: string; roa: number; fields?: string[]; field?: string; icon?: React.ReactNode }> = {
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
  ofertas: { label: "Ofertas (Fundos e RF)", roa: 0.0010, fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"] },
  renda_fixa: { label: "Renda Fixa", roa: 0.0015, field: "receita_renda_fixa" },
  seguros: { label: "Seguros", roa: 0.0007, field: "receita_seguros" },
  previdencia: { label: "Previdência", roa: 0.0001, field: "receita_previdencia" },
  compromissadas: { label: "Compromissadas", roa: 0.0001, field: "receita_compromissadas" },
  cambio: { label: "Câmbio PJ", roa: 0.0001, field: "receita_cambio" },
  offshore: { label: "Offshore", roa: 0.0002, field: "receitas_offshore" },
  consorcios: { label: "Consórcios", roa: 0.0009, field: "receita_consorcios" },
};

export default function RevenueEvolution({ data, previousYearData = [] }: RevenueEvolutionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("total");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("meta");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

    const metric = METRICS[selectedMetric];
    
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
      const calculateValue = (assessors: AssessorResumo[]) => assessors.reduce((sum, curr) => {
        if (metric.field) return sum + ((curr as any)[metric.field] || 0);
        if (metric.fields) return sum + metric.fields.reduce((fSum, f) => fSum + ((curr as any)[f] || 0), 0);
        return sum;
      }, 0);

      const totalValue = calculateValue(monthAssessors);
      const totalCustody = monthAssessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
      
      // Target Revenue = (Target ROA / 12) * Custody
      const targetValue = (metric.roa / 12) * totalCustody;

      // YoY Calculation: Find same month in previous year
      const prevMonthKey = format(subMonths(monthDate, 12), "yyyy-MM");
      const prevYearValue = prevGroupedByMonth[prevMonthKey] ? calculateValue(prevGroupedByMonth[prevMonthKey]) : 0;
      const yoyPercentage = prevYearValue > 0 ? ((totalValue - prevYearValue) / prevYearValue) * 100 : 0;

      // Calculate Moving Averages based on all available data (current + prev year)
      const getMM = (window: number) => {
        const monthIndex = allMonthsKeys.indexOf(monthKey);
        if (monthIndex === -1) return 0;
        
        // Get X previous months excluding current one
        const start = Math.max(0, monthIndex - window);
        const windowKeys = allMonthsKeys.slice(start, monthIndex);
        
        if (windowKeys.length === 0) return 0;

        const windowValues = windowKeys.map(k => calculateValue(allGroupedData[k]));
        return windowValues.reduce((s, v) => s + v, 0) / windowValues.length;
      };

      // Find best assessor for this month/metric
      const bestAssessorRaw = [...monthAssessors].sort((a, b) => {
        let valA = metric.field ? (a as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((a as any)[f] || 0), 0);
        let valB = metric.field ? (b as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((b as any)[f] || 0), 0);
        return (valB || 0) - (valA || 0);
      })[0];

      // Find best team for this month/metric
      const teamTotals = monthAssessors.reduce((acc: Record<string, number>, curr) => {
        const team = curr.time || "Sem Time";
        let val = metric.field ? (curr as any)[metric.field] : metric.fields?.reduce((s, f) => s + ((curr as any)[f] || 0), 0);
        acc[team] = (acc[team] || 0) + (val || 0);
        return acc;
      }, {});
      
      const bestTeam = Object.entries(teamTotals).sort((a, b) => b[1] - a[1])[0];

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
        bestAssessor: {
          name: bestAssessorRaw.nome_assessor,
          photo: bestAssessorRaw.foto_url,
          value: metric.field ? (bestAssessorRaw as any)[metric.field] : metric.fields?.reduce((s: number, f: string) => s + ((bestAssessorRaw as any)[f] || 0), 0)
        },
        bestTeam: {
          name: bestTeam[0],
          value: bestTeam[1]
        }
      };
    });

    // Overall Average
    const overallAvg = aggregated.reduce((s, curr) => s + curr.value, 0) / aggregated.length;
    
    // Calculate MoM percentage changes and Accumulated values
    let currentAcc = 0;
    return aggregated.map((d, i, arr) => {
      currentAcc += d.value;
      let prevValue = 0;
      if (i > 0) {
        prevValue = arr[i - 1].value;
      } else {
        // For the first month (e.g. Jan), check if Dec of prev year is available
        const prevMonthDate = subMonths(d.date, 1);
        const prevMonthKey = format(prevMonthDate, "yyyy-MM");
        if (prevGroupedByMonth[prevMonthKey]) {
          const calculateValue = (assessors: AssessorResumo[]) => assessors.reduce((sum, curr) => {
            if (metric.field) return sum + ((curr as any)[metric.field] || 0);
            if (metric.fields) return sum + metric.fields.reduce((fSum, f) => fSum + ((curr as any)[f] || 0), 0);
            return sum;
          }, 0);
          prevValue = calculateValue(prevGroupedByMonth[prevMonthKey]);
        }
      }

      const percentage = prevValue > 0 ? ((d.value - prevValue) / prevValue) * 100 : 0;
      return { ...d, percentage, overallAvg, prevValue, accValue: currentAcc };
    });
  }, [data, previousYearData, selectedMetric]);

  useEffect(() => {
    if (!monthlyData.length || dimensions.width === 0) return;

    const plot = Plot.plot({
      width: dimensions.width,
      height: dimensions.height,
      style: {
        background: "transparent",
        color: "#A0A090",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "12px",
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
        label: "Receita (R$)",
        tickFormat: (d) => `R$ ${(d / 1000).toFixed(0)}k`,
      },
      marks: [
        // Realized Area
        Plot.areaY(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          fill: "#FAC017",
          fillOpacity: 0.1,
          curve: "monotone-x",
        }),
        // Realized Line
        Plot.lineY(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
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
            text: (d) => `MÉDIA: R$ ${(d / 1000).toFixed(0)}k`,
            x: monthlyData[0]?.date,
            dy: -10,
            fontSize: 12,
            fill: "#FFFFFF",
            fillOpacity: 0.5,
          })
        ] : []),
        // Moving Average Line
        ...(analysisType === "mm3" ? [
          Plot.lineY(monthlyData, {
            x: "date",
            y: "mm3",
            stroke: "#FFFFFF",
            strokeOpacity: 0.4,
            strokeWidth: 2,
            curve: "monotone-x",
            strokeDasharray: "2,2",
          })
        ] : []),
        ...(analysisType === "mm6" ? [
          Plot.lineY(monthlyData, {
            x: "date",
            y: "mm6",
            stroke: "#FFFFFF",
            strokeOpacity: 0.4,
            strokeWidth: 2,
            curve: "monotone-x",
            strokeDasharray: "2,2",
          })
        ] : []),
        ...(analysisType === "mm12" ? [
          Plot.lineY(monthlyData, {
            x: "date",
            y: "mm12",
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
          y: analysisType === "acc" ? "accValue" : "value",
          fill: "#FAC017",
          stroke: "#1A2030",
          strokeWidth: 2,
          r: 5,
        }),
        // Analysis Labels
        Plot.text(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          text: (d) => {
            if (analysisType === "acc") {
              return `${d.percentage > 0 ? "↑" : "↓"} ${Math.abs(d.percentage).toFixed(1)}%`;
            }
            if (analysisType === "mom" && d.percentage !== 0) {
              return `${d.percentage > 0 ? "↑" : "↓"} ${Math.abs(d.percentage).toFixed(1)}%`;
            }
            if (analysisType === "meta") {
              return `${d.achievement.toFixed(0)}%`;
            }
            if (analysisType === "yoy" && d.yoyPercentage !== 0) {
              return `${d.yoyPercentage > 0 ? "↑" : "↓"} ${Math.abs(d.yoyPercentage).toFixed(1)}%`;
            }
            if (analysisType === "avg") {
              const perc = (d.value / (d.overallAvg || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            if (analysisType === "mm3") {
              const perc = (d.value / (d.mm3 || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            if (analysisType === "mm6") {
              const perc = (d.value / (d.mm6 || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            if (analysisType === "mm12") {
              const perc = (d.value / (d.mm12 || 1)) * 100;
              return `${perc.toFixed(0)}%`;
            }
            return "";
          },
          dy: -25,
          fontSize: 12,
          fontWeight: "bold",
          fill: (d) => {
            if (analysisType === "acc") return d.percentage > 0 ? "#22c55e" : "#ef4444";
            if (analysisType === "mom") return d.percentage > 0 ? "#22c55e" : "#ef4444";
            if (analysisType === "meta") return d.achievement >= 100 ? "#22c55e" : d.achievement >= 70 ? "#FAC017" : "#ef4444";
            if (analysisType === "yoy") return d.yoyPercentage > 0 ? "#22c55e" : "#ef4444";
            
            // For avg and MM, use the same logic as meta but relative to the reference
            const refValue = analysisType === "avg" ? d.overallAvg : (d as any)[analysisType];
            const perc = (d.value / (refValue || 1)) * 100;
            return perc >= 100 ? "#22c55e" : perc >= 70 ? "#FAC017" : "#ef4444";
          },
        }),
        // Absolute Value Labels
        Plot.text(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          text: (d) => {
            const val = analysisType === "acc" ? d.accValue : d.value;
            if (val >= 1000000) return `${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
            if (val >= 1000) return `${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
            return val.toLocaleString("pt-BR");
          },
          dy: -12,
          fontSize: 12,
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
  }, [monthlyData, dimensions, analysisType]);

  const analysisSubtitles: Record<AnalysisType, string> = {
    meta: "Comparativo de atingimento em relação à meta projetada",
    mom: "Variação percentual em relação ao mês anterior",
    yoy: "Comparativo de performance com o mesmo período do ano anterior",
    avg: "Comparação com a média histórica do período",
    mm3: "Tendência suavizada (média móvel de 3 meses)",
    mm6: "Tendência suavizada (média móvel de 6 meses)",
    mm12: "Tendência suavizada (média móvel de 12 meses)",
    acc: "Evolução acumulada do ano (YTD) com variação mensal",
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
      case "acc": return "Variação Mensal";
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
      case "acc": return d.percentage; // Note: This returns percentage, not a currency value. Needs handling.
      default: return 0;
    }
  };

  const formatAbbreviated = (val: number, forceCurrency = false) => {
    if (analysisType === "acc" && !forceCurrency) {
      // For ACC, the comparison value is a percentage
      return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
    }
    if (val >= 1000000) return `${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
    if (val >= 1000) return `${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return val.toLocaleString("pt-BR");
  };

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
            {METRICS[selectedMetric].icon || <TrendingUp className="w-4 h-4" />}
            Evolução: {METRICS[selectedMetric].label}
          </h3>
          <p className="text-xs font-data text-white/40 uppercase tracking-widest">
            {analysisSubtitles[analysisType]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Analysis Type Toggle */}
          <div className="flex bg-euro-elevated p-1 rounded-md border border-white/5 overflow-x-auto">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setAnalysisType("meta")}
              className={cn(
                "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                analysisType === "meta" ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              Meta
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setAnalysisType("mom")}
              className={cn(
                "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                analysisType === "mom" ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              MoM
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setAnalysisType("yoy")}
              className={cn(
                "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                analysisType === "yoy" ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              YoY
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setAnalysisType("avg")}
              className={cn(
                "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                analysisType === "avg" ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              Média
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setAnalysisType("acc")}
              className={cn(
                "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all whitespace-nowrap",
                analysisType === "acc" ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              Acumulado
            </Button>
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
                      <Percent className="w-4 h-4" />
                      <h4 className="text-sm font-data uppercase tracking-widest font-bold">Métricas de Receita</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-2">
                        <span className="text-xs font-bold text-white/80">Receita Investimento</span>
                        <p className="text-[11px] text-[#A0A090] leading-relaxed">
                          Soma de B3, Asset (m-1), Estruturadas, Cetipados, Ofertas Públicas (Fundos e RF) e Renda Fixa direta.
                        </p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-2">
                        <span className="text-xs font-bold text-white/80">Receita Cross-Sell (CS)</span>
                        <p className="text-[11px] text-[#A0A090] leading-relaxed">
                          Soma de Seguros, Previdência, Consórcios, Câmbio PJ, Compromissadas e Operações Offshore.
                        </p>
                      </div>
                    </div>
                  </section>

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
                            Compara a receita realizada com a meta calculada: <br/>
                            <span className="text-euro-gold font-mono italic">Meta = (ROA Alvo / 12) * Custódia Líquida do Mês</span>
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
                            Compara o mês atual com a média dos <span className="text-white">X meses anteriores</span> (sem contar o próprio mês). <br/>
                            Para meses no início do ano, o sistema busca automaticamente os dados do final do ano anterior para garantir a continuidade da análise.
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
                            <span className="text-white font-bold">MoM:</span> Variação em relação ao mês imediatamente anterior. <br/>
                            <span className="text-white font-bold">YoY:</span> Variação em relação ao mesmo mês do ano anterior.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="bg-euro-gold/5 border border-euro-gold/20 p-4 rounded-lg">
                    <p className="text-[10px] text-euro-gold/80 italic text-center">
                      * Todos os cálculos de ROA e Metas são baseados em receitas anualizadas e posições de custódia líquida (Net).
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-euro-elevated border-white/10 text-[#E8E8E0] font-data text-xs h-10 gap-3 min-w-[220px] justify-between">
                  <div className="flex items-center gap-2">
                    {METRICS[selectedMetric].icon ? (
                      <span className="text-euro-gold">{METRICS[selectedMetric].icon}</span>
                    ) : (
                      <BarChart3 className="w-4 h-4 text-euro-gold" />
                    )}
                    {METRICS[selectedMetric].label}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0] w-[260px]">
                <DropdownMenuLabel className="text-[10px] uppercase text-[#5C5C50] font-data">Consolidados</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSelectedMetric("total")} className="gap-2 cursor-pointer">
                  {METRICS.total.icon && <span className="text-euro-gold/80">{METRICS.total.icon}</span>}
                  {METRICS.total.label}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedMetric("invest")} className="gap-2 cursor-pointer">
                  {METRICS.invest.icon && <span className="text-euro-gold/80">{METRICS.invest.icon}</span>}
                  {METRICS.invest.label}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedMetric("cross")} className="gap-2 cursor-pointer">
                  {METRICS.cross.icon && <span className="text-euro-gold/80">{METRICS.cross.icon}</span>}
                  {METRICS.cross.label}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuLabel className="text-[10px] uppercase text-[#5C5C50] font-data">Individuais</DropdownMenuLabel>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {(Object.keys(METRICS) as MetricKey[])
                    .filter(k => !["total", "invest", "cross"].includes(k))
                    .map((key) => (
                      <DropdownMenuItem key={key} onClick={() => setSelectedMetric(key)} className="cursor-pointer text-xs">
                        {METRICS[key].label}
                      </DropdownMenuItem>
                    ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full min-h-[350px] overflow-hidden cursor-pointer" />

      {/* MODAL DE DETALHES DO MÊS */}
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
                      R$ {selectedMonthData.value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-data text-white/60 uppercase tracking-wider">
                      {getComparisonLabel()}
                    </span>
                    <span className="text-sm font-data text-euro-gold">
                      {analysisType === "acc" ? formatAbbreviated(getComparisonValue(selectedMonthData)) : `R$ ${formatAbbreviated(getComparisonValue(selectedMonthData))}`}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Melhor Assessor */}
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
                    <span className="text-sm font-data text-euro-gold">R$ {selectedMonthData.bestAssessor.value.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                {/* Share do Assessor */}
                <div className="px-1">
                  <div className="flex justify-between items-center text-[10px] font-data uppercase text-white/80">
                    <span>Participação no Mês</span>
                    <span>{((selectedMonthData.bestAssessor.value / (selectedMonthData.value || 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-euro-gold/60 shadow-[0_0_8px_rgba(250,192,23,0.3)]"
                      style={{ width: `${(selectedMonthData.bestAssessor.value / (selectedMonthData.value || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Melhor Time */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-euro-gold" />
                  <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Time</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg border border-white/5">
                  <span className="text-base font-ui text-[#E8E8E0]">{selectedMonthData.bestTeam.name}</span>
                  <span className="text-base font-data text-euro-gold">R$ {formatAbbreviated(selectedMonthData.bestTeam.value, true)}</span>
                </div>

                {/* Share do Time */}
                <div className="px-1">
                  <div className="flex justify-between items-center text-[10px] font-data uppercase text-white/80">
                    <span>Participação no Mês</span>
                    <span>{((selectedMonthData.bestTeam.value / (selectedMonthData.value || 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-euro-gold/60 shadow-[0_0_8px_rgba(250,192,23,0.3)]"
                      style={{ width: `${(selectedMonthData.bestTeam.value / (selectedMonthData.value || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

