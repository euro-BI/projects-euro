import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState, useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FundingTrendProps {
  data: AssessorResumo[];
}

export default function FundingTrend({ data }: FundingTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Aggregate data by month
  const monthlyData = useMemo(() => {
    if (!data.length) return [];
    
    return data.reduce((acc: any[], curr) => {
      const month = curr.data_posicao;
      const existing = acc.find(d => d.month === month);
      if (existing) {
        existing.entradas += curr.captacao_entradas;
        existing.saidas += curr.captacao_saidas;
        existing.transf_entrada += curr.captacao_entrada_transf;
        existing.transf_saida += curr.captacao_saida_transf;
        existing.liquida += curr.captacao_liquida_total;
      } else {
        acc.push({
          month,
          date: parseISO(month),
          entradas: curr.captacao_entradas,
          saidas: curr.captacao_saidas,
          transf_entrada: curr.captacao_entrada_transf,
          transf_saida: curr.captacao_saida_transf,
          liquida: curr.captacao_liquida_total,
        });
      }
      return acc;
    }, []).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  // Descriptive analysis
  const insights = useMemo(() => {
    if (!monthlyData.length) return null;

    const sortedByLiquida = [...monthlyData].sort((a, b) => b.liquida - a.liquida);
    const best = sortedByLiquida[0];
    const worst = sortedByLiquida[sortedByLiquida.length - 1];

    return { best, worst };
  }, [monthlyData]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!monthlyData.length || dimensions.width === 0) return;

    // Calculate dynamic margin and data for components
    const trendBarsData: any[] = [];
    monthlyData.forEach(d => {
      trendBarsData.push({ date: d.date, value: d.entradas, type: "Entradas", color: "#FAC017" });
      trendBarsData.push({ date: d.date, value: -Math.abs(d.saidas), type: "Saídas", color: "#E05A40" });
    });

    const maxVal = Math.max(...monthlyData.map(d => Math.max(d.entradas, Math.abs(d.saidas))));
    const marginTop = 50;

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
      marginTop: marginTop,
      x: {
        type: "band",
        label: null,
        tickFormat: (d) => format(d, "MMM yy", { locale: ptBR }),
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
        Plot.barY(trendBarsData, {
          x: "date",
          y: "value",
          fill: "color",
          rx: 4,
          inset: 1,
          fillOpacity: 0.7,
          stroke: "color",
          strokeWidth: 1,
          strokeOpacity: 0.4,
        }),

        // Net Total Badge Background (Pill shape - Wider)
        Plot.rectY(monthlyData, {
          x: "date",
          y1: (d) => maxVal * 1.12,
          y2: (d) => maxVal * 1.38,
          fill: (d) => d.liquida >= 0 ? "#22c55e" : "#ef4444",
          fillOpacity: 0.12,
          stroke: (d) => d.liquida >= 0 ? "#22c55e" : "#ef4444",
          strokeWidth: 1.5,
          rx: 12,
        }),

        // Net Total Badge Text (Result)
        Plot.text(monthlyData, {
          x: "date",
          y: (d) => maxVal * 1.25,
          text: (d) => {
            const val = d.liquida;
            const absVal = Math.abs(val);
            let formattedVal = "";
            if (absVal >= 1000000) formattedVal = `${(val / 1000000).toFixed(1)}M`;
            else if (absVal >= 1000) formattedVal = `${(val / 1000).toFixed(0)}k`;
            else formattedVal = val.toFixed(0);
            return `R$ ${formattedVal}`;
          },
          fontSize: 10,
          fontWeight: "900",
          fill: (d) => d.liquida >= 0 ? "#22c55e" : "#ef4444",
        }),

        // Zero line
        Plot.ruleY([0], { stroke: "#FFFFFF10" }),
      ],
    });

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      
      // Add SVG icons after the plot
      const plotSvg = plot.querySelector("svg");
      if (plotSvg) {
        monthlyData.forEach((d, i) => {
          const xScale = plot.scale("x");
          const yScale = plot.scale("y");
          
          if (xScale && yScale) {
            const xPos = xScale.apply(d.date);
            const yPos = yScale.apply(maxVal * 1.25);
            
            // Create foreign object for icon
            const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            foreignObject.setAttribute("x", String(xPos + 35)); // Adjust position
            foreignObject.setAttribute("y", String(yPos - 8));
            foreignObject.setAttribute("width", "16");
            foreignObject.setAttribute("height", "16");
            
            const iconDiv = document.createElement("div");
            iconDiv.style.display = "flex";
            iconDiv.style.alignItems = "center";
            iconDiv.style.justifyContent = "center";
            iconDiv.style.width = "100%";
            iconDiv.style.height = "100%";
            
            // Determine which icon to use
            let iconSvg = "";
            const color = d.liquida > 0 ? "#22c55e" : d.liquida < 0 ? "#ef4444" : "#A0A090";
            
            if (d.liquida > 0) {
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.97 8.97a1.51 1.51 0 0 1-2.12 0L7 12.06a1.5 1.5 0 0 1 0-2.12L16 1"/><path d="M22 7h-7v7"/></svg>`;
            } else if (d.liquida < 0) {
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 17-8.97-8.97a1.51 1.51 0 0 0-2.12 0L7 11.97a1.5 1.5 0 0 0 0 2.12L16 23"/><path d="M22 17h-7v-7"/></svg>`;
            } else {
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
            }
            
            iconDiv.innerHTML = iconSvg;
            foreignObject.appendChild(iconDiv);
            plotSvg.appendChild(foreignObject);
          }
        });
      }
      
      containerRef.current.append(plot);
    }
    return () => plot.remove();
  }, [monthlyData, dimensions]);

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="text-xs font-data text-euro-gold/60 uppercase tracking-widest">Fluxo de Captação Mensal</h3>
        
        {insights && (
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-euro-gold/5 border border-euro-gold/10 rounded-sm">
              <TrendingUp className="w-3 h-3 text-euro-gold" />
              <div className="flex flex-col">
                <span className="text-[8px] font-data text-euro-gold/40 uppercase">Melhor Mês</span>
                <span className="text-[10px] font-data text-[#E8E8E0]">
                  {format(insights.best.date, "MMM/yy", { locale: ptBR })} (R$ {(insights.best.liquida / 1000000).toFixed(1)}M)
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-red-400/5 border border-red-400/10 rounded-sm">
              <TrendingDown className="w-3 h-3 text-red-400/60" />
              <div className="flex flex-col">
                <span className="text-[8px] font-data text-red-400/40 uppercase">Pior Mês</span>
                <span className="text-[10px] font-data text-[#E8E8E0]">
                  {format(insights.worst.date, "MMM/yy", { locale: ptBR })} (R$ {(insights.worst.liquida / 1000000).toFixed(1)}M)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-1 w-full overflow-hidden" />
      
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#FAC017]/80 border border-[#FAC017]" />
          <span className="text-[9px] font-data text-white/40 uppercase tracking-widest">Entradas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#E05A40]/80 border border-[#E05A40]" />
          <span className="text-[9px] font-data text-white/40 uppercase tracking-widest">Saídas</span>
        </div>
      </div>
    </div>
  );
}