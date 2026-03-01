
import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState, useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronDown, 
  TrendingUp, 
  Users as UsersIcon,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Calculator,
  CalendarDays,
  Target as TargetIcon,
  Percent,
  History,
  Star
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

interface KPIEvolutionProps {
  data: AssessorResumo[];
  previousYearData?: AssessorResumo[];
}

type KPIKey = "roa" | "clients" | "custody";

type AnalysisType = "meta" | "mom" | "yoy" | "avg" | "mm3" | "mm6" | "mm12" | "acc";

const KPIS: Record<KPIKey, { label: string; icon: any; unit: string; format: (v: number) => string; metaField?: string }> = {
  roa: { 
    label: "ROA", 
    icon: Activity, 
    unit: "%", 
    format: (v) => `${(v * 100).toFixed(2)}%`,
    metaField: "roa_meta" // Meta fixa de 1.08% conforme dash
  },
  clients: { 
    label: "Total de Clientes", 
    icon: UsersIcon, 
    unit: "", 
    format: (v) => v.toLocaleString("pt-BR"),
  },
  custody: { 
    label: "Custódia Net", 
    icon: Wallet, 
    unit: "R$", 
    format: (v) => `R$ ${(v / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`,
  },
};

export default function KPIEvolution({ data, previousYearData = [] }: KPIEvolutionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedKPI, setSelectedKPI] = useState<KPIKey>("roa");
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

  // Aggregate data by month for the selected KPI
  const monthlyData = useMemo(() => {
    if (!data.length) return [];

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
      
      const calculateKPI = (assessors: AssessorResumo[]) => {
        if (!assessors.length) return 0;
        
        const totalRevenue = assessors.reduce((sum, curr) => sum + (curr.receita_total || 0), 0);
        const totalCustody = assessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
        const totalClients = assessors.reduce((sum, curr) => sum + (curr.total_clientes || 0), 0);
        
        switch (selectedKPI) {
          case "roa":
            return totalCustody > 0 ? (totalRevenue / totalCustody) * 12 : 0;
          case "clients":
            return totalClients;
          case "custody":
            return totalCustody;
          default:
            return 0;
        }
      };

      const currentValue = calculateKPI(monthAssessors);
      
      // Target values
      let targetValue = 0;
      if (selectedKPI === "roa") {
        targetValue = 0.0108; // 1.08% fixed meta
      } else if (selectedKPI === "custody") {
        // For custody, target could be the sum of meta_captacao (incremental) but users usually track revenue/funding metas.
        // Let's use the sum of meta_captacao if we had it, but for now we'll use a placeholder or previous month's custody + meta_captacao
        const totalFundingMeta = monthAssessors.reduce((sum, curr) => sum + (curr.meta_captacao || 0), 0);
        // This is complex. Let's just use 0 if no specific target is defined for Clients/Custody in meta mode.
        targetValue = 0; 
      }

      // YoY Calculation
      const prevMonthKey = format(subMonths(monthDate, 12), "yyyy-MM");
      const prevYearValue = prevGroupedByMonth[prevMonthKey] ? calculateKPI(prevGroupedByMonth[prevMonthKey]) : 0;
      const yoyPercentage = prevYearValue > 0 ? ((currentValue - prevYearValue) / prevYearValue) * 100 : 0;

      // Moving Averages
      const getMM = (window: number) => {
        const monthIndex = allMonthsKeys.indexOf(monthKey);
        if (monthIndex === -1) return 0;
        const start = Math.max(0, monthIndex - window);
        const windowKeys = allMonthsKeys.slice(start, monthIndex);
        if (windowKeys.length === 0) return 0;
        const windowValues = windowKeys.map(k => calculateKPI(allGroupedData[k]));
        return windowValues.reduce((s, v) => s + v, 0) / windowValues.length;
      };

      // Best Assessor for this month/KPI
      const bestAssessorRaw = [...monthAssessors].sort((a, b) => {
        const getVal = (assessor: AssessorResumo) => {
          switch (selectedKPI) {
            case "roa": return assessor.custodia_net > 0 ? (assessor.receita_total / assessor.custodia_net) * 12 : 0;
            case "clients": return assessor.total_clientes;
            case "custody": return assessor.custodia_net;
            default: return 0;
          }
        };
        return getVal(b) - getVal(a);
      })[0];

      // Best Team for this month/KPI
      const teamTotals = monthAssessors.reduce((acc: Record<string, { rev: number; cust: number; cli: number }>, curr) => {
        const team = curr.time || "Sem Time";
        if (!acc[team]) acc[team] = { rev: 0, cust: 0, cli: 0 };
        acc[team].rev += curr.receita_total || 0;
        acc[team].cust += curr.custodia_net || 0;
        acc[team].cli += curr.total_clientes || 0;
        return acc;
      }, {});
      
      const bestTeam = Object.entries(teamTotals).map(([name, totals]) => {
        let val = 0;
        if (selectedKPI === "roa") val = totals.cust > 0 ? (totals.rev / totals.cust) * 12 : 0;
        else if (selectedKPI === "clients") val = totals.cli;
        else if (selectedKPI === "custody") val = totals.cust;
        return { name, value: val };
      }).sort((a, b) => b.value - a.value)[0];

      return {
        month: monthKey,
        date: monthDate,
        value: currentValue,
        targetValue,
        prevYearValue,
        yoyPercentage,
        achievement: targetValue > 0 ? (currentValue / targetValue) * 100 : 0,
        mm3: getMM(3),
        mm6: getMM(6),
        mm12: getMM(12),
        bestAssessor: {
          name: bestAssessorRaw.nome_assessor,
          photo: bestAssessorRaw.foto_url,
          value: (() => {
            const a = bestAssessorRaw;
            if (selectedKPI === "roa") return a.custodia_net > 0 ? (a.receita_total / a.custodia_net) * 12 : 0;
            if (selectedKPI === "clients") return a.total_clientes;
            if (selectedKPI === "custody") return a.custodia_net;
            return 0;
          })()
        },
        bestTeam: bestTeam || { name: "N/A", value: 0 }
      };
    });

    const overallAvg = aggregated.reduce((s, curr) => s + curr.value, 0) / aggregated.length;
    
    let currentAcc = 0;
    return aggregated.map((d, i, arr) => {
      currentAcc += d.value;
      let prevValue = 0;
      if (i > 0) {
        prevValue = arr[i - 1].value;
      } else {
        const prevMonthDate = subMonths(d.date, 1);
        const prevMonthKey = format(prevMonthDate, "yyyy-MM");
        if (prevGroupedByMonth[prevMonthKey]) {
          const calculateKPI = (assessors: AssessorResumo[]) => {
            if (!assessors.length) return 0;
            const totalRevenue = assessors.reduce((sum, curr) => sum + (curr.receita_total || 0), 0);
            const totalCustody = assessors.reduce((sum, curr) => sum + (curr.custodia_net || 0), 0);
            const totalClients = assessors.reduce((sum, curr) => sum + (curr.total_clientes || 0), 0);
            if (selectedKPI === "roa") return totalCustody > 0 ? (totalRevenue / totalCustody) * 12 : 0;
            if (selectedKPI === "clients") return totalClients;
            if (selectedKPI === "custody") return totalCustody;
            return 0;
          };
          prevValue = calculateKPI(prevGroupedByMonth[prevMonthKey]);
        }
      }

      const percentage = prevValue > 0 ? ((d.value - prevValue) / prevValue) * 100 : 0;
      return { ...d, percentage, overallAvg, prevValue, accValue: currentAcc };
    });
  }, [data, previousYearData, selectedKPI]);

  useEffect(() => {
    if (!monthlyData.length || dimensions.width === 0) return;

    const plot = Plot.plot({
      width: dimensions.width,
      height: dimensions.height,
      style: {
        background: "transparent",
        color: "#A0A090",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "10px",
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
          if (selectedKPI === "roa") return `${(d * 100).toFixed(1)}%`;
          if (selectedKPI === "custody") return `R$ ${(d / 1000000).toFixed(0)}M`;
          return d.toLocaleString("pt-BR");
        },
      },
      marks: [
        Plot.areaY(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          fill: "#FAC017",
          fillOpacity: 0.1,
          curve: "monotone-x",
        }),
        Plot.lineY(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          stroke: "#FAC017",
          strokeWidth: 2.5,
          curve: "monotone-x",
        }),
        ...(analysisType === "meta" && selectedKPI === "roa" ? [
          Plot.ruleY([0.0108], {
            stroke: "#FFFFFF",
            strokeDasharray: "4,4",
            strokeOpacity: 0.3,
            strokeWidth: 1.5,
          }),
          Plot.text([0.0108], {
            text: () => "META: 1.08%",
            x: monthlyData[0]?.date,
            dy: -10,
            fontSize: 10,
            fill: "#FFFFFF",
            fillOpacity: 0.5,
          })
        ] : []),
        ...(analysisType === "yoy" ? [
          Plot.barY(monthlyData, {
            x: "date",
            y: "prevYearValue",
            fill: "#FFFFFF",
            fillOpacity: 0.05,
            inset: 2,
          })
        ] : []),
        ...(analysisType === "avg" ? [
          Plot.ruleY([monthlyData[0]?.overallAvg], {
            stroke: "#FFFFFF",
            strokeDasharray: "4,4",
            strokeOpacity: 0.3,
            strokeWidth: 1.5,
          })
        ] : []),
        Plot.dot(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          fill: "#FAC017",
          stroke: "#1A2030",
          strokeWidth: 2,
          r: 5,
        }),
        Plot.text(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          text: (d) => {
            if (analysisType === "meta" && selectedKPI === "roa") return `${d.achievement.toFixed(0)}%`;
            if ((analysisType === "mom" || analysisType === "acc") && d.percentage !== 0) return `${d.percentage > 0 ? "↑" : "↓"} ${Math.abs(d.percentage).toFixed(1)}%`;
            if (analysisType === "yoy" && d.yoyPercentage !== 0) return `${d.yoyPercentage > 0 ? "↑" : "↓"} ${Math.abs(d.yoyPercentage).toFixed(1)}%`;
            return "";
          },
          dy: -25,
          fontSize: 10,
          fontWeight: "bold",
          fill: (d) => {
            if (analysisType === "meta") return d.achievement >= 100 ? "#22c55e" : d.achievement >= 70 ? "#FAC017" : "#ef4444";
            return (d.percentage || d.yoyPercentage) > 0 ? "#22c55e" : "#ef4444";
          },
        }),
        Plot.text(monthlyData, {
          x: "date",
          y: analysisType === "acc" ? "accValue" : "value",
          text: (d) => {
            const val = analysisType === "acc" ? d.accValue : d.value;
            return KPIS[selectedKPI].format(val);
          },
          dy: -12,
          fontSize: 10,
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
      containerRef.current.addEventListener("click", handleClick);
    }

    return () => {
      plot.remove();
      if (containerRef.current) containerRef.current.removeEventListener("click", handleClick);
    };
  }, [monthlyData, dimensions, analysisType, selectedKPI]);

  const analysisSubtitles: Record<AnalysisType, string> = {
    meta: "Comparativo em relação à meta projetada",
    mom: "Variação percentual em relação ao mês anterior",
    yoy: "Comparativo com o mesmo período do ano anterior",
    avg: "Comparação com a média histórica",
    mm3: "Média móvel de 3 meses",
    mm6: "Média móvel de 6 meses",
    mm12: "Média móvel de 12 meses",
    acc: "Evolução acumulada do ano (YTD)",
  };

  const currentKPI = KPIS[selectedKPI];

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
            <currentKPI.icon className="w-4 h-4" />
            Evolução: {currentKPI.label}
          </h3>
          <p className="text-xs font-data text-white/40 uppercase tracking-widest">
            {analysisSubtitles[analysisType]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-euro-elevated p-1 rounded-md border border-white/5">
            {["meta", "mom", "yoy", "avg", "acc"].map((type) => (
              <Button 
                key={type}
                variant="ghost" 
                size="sm"
                onClick={() => setAnalysisType(type as AnalysisType)}
                className={cn(
                  "h-8 px-3 text-[10px] font-data uppercase tracking-wider transition-all",
                  analysisType === type ? "bg-euro-gold text-euro-navy shadow-lg" : "text-[#5C5C50] hover:text-[#A0A090]"
                )}
              >
                {type === "avg" ? "Média" : type === "acc" ? "Acum." : type.toUpperCase()}
              </Button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-euro-elevated border-white/10 text-[#E8E8E0] font-data text-xs h-10 gap-3 min-w-[200px] justify-between">
                <div className="flex items-center gap-2">
                  <currentKPI.icon className="w-4 h-4 text-euro-gold" />
                  {currentKPI.label}
                </div>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0] w-[200px]">
              {(Object.entries(KPIS) as [KPIKey, typeof KPIS[KPIKey]][]).map(([key, kpi]) => (
                <DropdownMenuItem key={key} onClick={() => setSelectedKPI(key)} className="gap-2 cursor-pointer">
                  <kpi.icon className="w-4 h-4 text-euro-gold" /> {kpi.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full min-h-[350px] overflow-hidden cursor-pointer" />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1A2030]/95 backdrop-blur-xl border border-euro-gold/20 text-white max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {selectedMonthData && (
            <div className="space-y-6">
              <DialogHeader className="border-b border-white/5 pb-4">
                <DialogTitle className="flex flex-col items-start">
                  <span className="text-xs font-data text-euro-gold uppercase tracking-[0.2em]">
                    {format(selectedMonthData.date, "MMMM yyyy", { locale: ptBR })}
                  </span>
                  <span className="text-2xl font-display text-[#F5F5F0]">
                    {currentKPI.format(selectedMonthData.value)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-euro-gold fill-euro-gold" />
                  <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Assessor</span>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="w-12 h-12 rounded-full bg-euro-inset border border-euro-gold/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {selectedMonthData.bestAssessor.photo ? (
                      <img src={selectedMonthData.bestAssessor.photo} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-data text-euro-gold/40">
                        {selectedMonthData.bestAssessor.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-ui text-[#E8E8E0]">{selectedMonthData.bestAssessor.name}</span>
                    <span className="text-sm font-data text-euro-gold">{currentKPI.format(selectedMonthData.bestAssessor.value)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-euro-gold" />
                  <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Time</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg border border-white/5">
                  <span className="text-base font-ui text-[#E8E8E0]">{selectedMonthData.bestTeam.name}</span>
                  <span className="text-base font-data text-euro-gold">{currentKPI.format(selectedMonthData.bestTeam.value)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
