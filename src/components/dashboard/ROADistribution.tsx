
import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";
import { AssessorResumo } from "@/types/dashboard";

interface ROADistributionProps {
  data: AssessorResumo[];
}

export default function ROADistribution({ data }: ROADistributionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data.length) return;

    const avgROA = data.reduce((acc, curr) => acc + curr.roa, 0) / data.length;

    const plot = Plot.plot({
      style: {
        background: "transparent",
        color: "#A0A090",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "10px",
      },
      marginLeft: 40,
      marginBottom: 40,
      x: {
        label: "ROA (%)",
        grid: true,
        tickFormat: (d) => `${d.toFixed(1)}%`,
      },
      y: {
        label: "Assessores",
        domain: [0, Math.max(...data.map(d => d.custodia_net)) * 1.1],
        tickFormat: (d) => `R$ ${(d / 1000000).toFixed(0)}M`,
      },
      marks: [
        // Background for zones
        Plot.rectX([0, avgROA], {
          fill: "#080B0F",
          opacity: 0.5,
          inset: 0,
        }),
        Plot.rectX([1.0, 5.0], {
          fill: "#FAC01708",
          inset: 0,
        }),
        // Dots for assessors
        Plot.dot(data, {
          x: "roa",
          y: "custodia_net",
          r: (d) => Math.sqrt(d.custodia_net / 100000) + 2,
          fill: (d) => d.roa >= 1.0 ? "#FAC017" : "#3A3A3060",
          stroke: (d) => d.lider ? "#FAC017" : "transparent",
          strokeWidth: 2,
          title: (d) => `${d.nome_assessor}\nROA: ${d.roa.toFixed(2)}%\nCustódia: R$ ${d.custodia_net.toLocaleString()}`,
        }),
        // Lines for averages
        Plot.ruleX([avgROA], {
          stroke: "#FAC01740",
          strokeWidth: 1,
          strokeDasharray: "4,2",
        }),
        Plot.text([avgROA], {
          x: avgROA,
          y: Math.max(...data.map(d => d.custodia_net)),
          text: (d) => `Média: ${d.toFixed(2)}%`,
          dy: -10,
          fill: "#FAC01780",
          fontFamily: "Lora, serif",
        }),
        Plot.ruleX([1.0], {
          stroke: "#FFFFFF20",
          strokeWidth: 1,
          strokeDasharray: "2,2",
        }),
        Plot.text([1.0], {
          x: 1.0,
          y: 0,
          text: (d) => `Ref 1%`,
          dy: 15,
          fill: "#5C5C50",
          fontFamily: "Lora, serif",
        }),
      ],
    });

    containerRef.current?.append(plot);
    return () => plot.remove();
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-xs font-data text-euro-gold/60 uppercase tracking-widest mb-4">Distribuição de ROA vs Custódia</h3>
      <div ref={containerRef} className="flex-1 w-full overflow-hidden" />
    </div>
  );
}
