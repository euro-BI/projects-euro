
import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState, useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown,
  Info,
  ArrowRightLeft,
  Wallet,
  Star,
  Users as UsersIcon,
  HelpCircle,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FundingEvolutionProps {
  data: AssessorResumo[];
  title?: string;
}

export default function FundingEvolution({ data, title = "Análise de Captação" }: FundingEvolutionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Aggregate data by month
  const monthlyData = useMemo(() => {
    if (!data.length) return [];

    const groupedByMonth = data.reduce((acc: Record<string, any>, curr) => {
      const month = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!acc[month]) {
        acc[month] = {
          month,
          date: parseISO(`${month}-01`),
          entradas: 0,
          saidas: 0,
          entradas_transf: 0,
          saidas_transf: 0,
          liquida_direta: 0,
          liquida_transf: 0,
          liquida_total: 0,
          bestAssessor: null,
          bestTeam: null,
          allAssessors: []
        };
      }
      acc[month].entradas += curr.captacao_entradas || 0;
      acc[month].saidas += curr.captacao_saidas || 0;
      acc[month].entradas_transf += curr.captacao_entrada_transf || 0;
      acc[month].saidas_transf += curr.captacao_saida_transf || 0;
      acc[month].liquida_direta += curr.captacao_liquida || 0;
      acc[month].liquida_transf += curr.captacao_transf_liquida || 0;
      acc[month].liquida_total += curr.captacao_liquida_total || 0;
      acc[month].allAssessors.push(curr);
      return acc;
    }, {});

    return Object.values(groupedByMonth).map((m: any) => {
      // Find best assessor for this month
      const sorted = [...m.allAssessors].sort((a, b) => b.captacao_liquida_total - a.captacao_liquida_total);
      m.bestAssessor = sorted[0];

      // Find best team for this month
      const teamTotals = m.allAssessors.reduce((acc: Record<string, number>, curr: AssessorResumo) => {
        const team = curr.time || "Sem Time";
        acc[team] = (acc[team] || 0) + (curr.captacao_liquida_total || 0);
        return acc;
      }, {});
      const bestTeam = Object.entries(teamTotals).sort((a: any, b: any) => b[1] - a[1])[0];
      m.bestTeam = bestTeam ? { name: bestTeam[0], value: bestTeam[1] } : null;

      return m;
    }).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [data]);

  // Transform data for Plot (Entradas and Saídas as background bars)
  const barsData = useMemo(() => {
    const result: any[] = [];
    monthlyData.forEach((d: any) => {
      result.push({ date: d.date, value: Math.abs(d.entradas), type: "Entradas", color: "#22c55e" });
      result.push({ date: d.date, value: -Math.abs(d.saidas), type: "Saídas", color: "#ef4444" });
    });
    return result;
  }, [monthlyData]);

  useEffect(() => {
    if (!barsData.length || dimensions.width === 0) return;

    // Calculate dynamic margin for badges
    const maxVal = Math.max(...monthlyData.map(d => Math.max(d.entradas, Math.abs(d.saidas))));
    const marginTop = 50; // Increased margin for badges

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
      marginTop: marginTop,
      x: {
        type: "band",
        label: null,
        tickFormat: (d) => format(d, "MMM yy", { locale: ptBR }),
        padding: 0.3,
      },
      y: {
        grid: true,
        label: null,
        tickFormat: (d) => {
          const absD = Math.abs(d);
          if (absD >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
          if (absD >= 1000) return `${(d / 1000).toFixed(0)}k`;
          return d;
        },
      },
      marks: [
        // Opaque bars for Entradas and Saídas
        Plot.barY(barsData, {
          x: "date",
          y: "value",
          fill: "color",
          rx: 4,
          inset: 1,
          fillOpacity: 0.7, // Increased opacity as requested
          stroke: "color",
          strokeWidth: 1,
          strokeOpacity: 0.4,
        }),



        // Net Total Badge Text (Result)
        Plot.text(monthlyData, {
          x: "date",
          y: (d) => maxVal * 1.25,
          text: (d) => {
            const val = d.liquida_total;
            const absVal = Math.abs(val);
            const arrow = val >= 0 ? "↗" : "↘";
            let formattedVal = "";
            if (absVal >= 1000000) formattedVal = `${(val / 1000000).toFixed(1)}M`;
            else if (absVal >= 1000) formattedVal = `${(val / 1000).toFixed(0)}k`;
            else formattedVal = val.toFixed(0);
            return `R$ ${formattedVal} ${arrow}`;
          },
          fontSize: 12,
          fontWeight: "900",
          fill: (d) => d.liquida_total >= 0 ? "#22c55e" : "#ef4444",
        }),

        // Zero line
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
  }, [barsData, monthlyData, dimensions]);

  const formatDisplayValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) return `R$ ${(val / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
    if (absVal >= 1000) return `R$ ${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return `R$ ${val.toLocaleString("pt-BR")}`;
  };

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {title}
          </h3>
          <p className="text-xs font-data text-white/40 uppercase tracking-widest">
            Resultado Líquido Consolidado (Captação Direta + Transferências)
          </p>
        </div>


      </div>

      <div ref={containerRef} className="flex-1 w-full min-h-[350px] overflow-hidden cursor-pointer" />

      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#22c55e]/80 border border-[#22c55e]" />
          <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">Fluxo de Entrada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#ef4444]/80 border border-[#ef4444]" />
          <span className="text-[10px] font-data text-white/40 uppercase tracking-widest">Fluxo de Saída</span>
        </div>
      </div>

      {/* MODAL DE DETALHES */}
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
                      {formatDisplayValue(selectedMonthData.liquida_total)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-data text-white/60 uppercase tracking-wider">
                      Status Líquido
                    </span>
                    <span className={cn(
                      "text-sm font-data",
                      selectedMonthData.liquida_total >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {selectedMonthData.liquida_total >= 0 ? "SUPERÁVIT" : "DÉFICIT"}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-[10px] font-data text-white/40 uppercase">Entradas Diretas</span>
                  <p className="text-sm font-data text-green-500 mt-1">{formatDisplayValue(selectedMonthData.entradas)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-[10px] font-data text-white/40 uppercase">Saídas Diretas</span>
                  <p className="text-sm font-data text-red-500 mt-1">{formatDisplayValue(selectedMonthData.saidas)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-[10px] font-data text-white/40 uppercase">Entradas Transf.</span>
                  <p className="text-sm font-data text-blue-400 mt-1">{formatDisplayValue(selectedMonthData.entradas_transf)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-[10px] font-data text-white/40 uppercase">Saídas Transf.</span>
                  <p className="text-sm font-data text-orange-400 mt-1">{formatDisplayValue(selectedMonthData.saidas_transf)}</p>
                </div>
              </div>

              {selectedMonthData.bestAssessor && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-euro-gold fill-euro-gold" />
                    <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Assessor (Net)</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-euro-inset border border-euro-gold/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {selectedMonthData.bestAssessor.foto_url ? (
                        <img src={selectedMonthData.bestAssessor.foto_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-data text-euro-gold/40">
                          {selectedMonthData.bestAssessor.nome_assessor.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-ui text-[#E8E8E0] truncate">{selectedMonthData.bestAssessor.nome_assessor}</span>
                      <span className="text-xs font-data text-euro-gold">{formatDisplayValue(selectedMonthData.bestAssessor.captacao_liquida_total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedMonthData.bestTeam && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-euro-gold" />
                    <span className="text-xs font-data text-white uppercase tracking-widest">Melhor Time (Net)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg border border-white/5">
                    <span className="text-sm font-ui text-[#E8E8E0]">{selectedMonthData.bestTeam.name}</span>
                    <span className="text-sm font-data text-euro-gold">{formatDisplayValue(selectedMonthData.bestTeam.value)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
