
import React, { useMemo } from "react";
import { Group } from "@visx/group";
import { Treemap, treemapSquarify } from "@visx/hierarchy";
import { hierarchy } from "d3-hierarchy";
import { AssessorResumo } from "@/types/dashboard";
import { ParentSize } from "@visx/responsive";

interface RevenueTreemapProps {
  data: AssessorResumo[];
}

interface RevenueItem {
  name: string;
  value: number;
  id: string;
}

function TreemapChart({ data, width, height }: RevenueTreemapProps & { width: number; height: number }) {
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const revenueData = useMemo(() => {
    const total = data.reduce((acc, curr) => {
      acc.receita_b3 += curr.receita_b3;
      acc.asset_m_1 += curr.asset_m_1;
      acc.receitas_estruturadas += curr.receitas_estruturadas;
      acc.receita_cetipados += curr.receita_cetipados;
      acc.receitas_ofertas_fundos += curr.receitas_ofertas_fundos;
      acc.receitas_ofertas_rf += curr.receitas_ofertas_rf;
      acc.receita_renda_fixa += curr.receita_renda_fixa;
      acc.receita_seguros += curr.receita_seguros;
      acc.receita_previdencia += curr.receita_previdencia;
      acc.receita_consorcios += curr.receita_consorcios;
      acc.receita_cambio += curr.receita_cambio;
      acc.receita_compromissadas += curr.receita_compromissadas;
      acc.receitas_offshore += curr.receitas_offshore;
      return acc;
    }, {
      receita_b3: 0,
      asset_m_1: 0,
      receitas_estruturadas: 0,
      receita_cetipados: 0,
      receitas_ofertas_fundos: 0,
      receitas_ofertas_rf: 0,
      receita_renda_fixa: 0,
      receita_seguros: 0,
      receita_previdencia: 0,
      receita_consorcios: 0,
      receita_cambio: 0,
      receita_compromissadas: 0,
      receitas_offshore: 0,
    });

    const items: RevenueItem[] = [
      { id: 'b3', name: 'B3', value: total.receita_b3 },
      { id: 'asset', name: 'Asset M-1', value: total.asset_m_1 },
      { id: 'estruturadas', name: 'Estruturadas', value: total.receitas_estruturadas },
      { id: 'cetipados', name: 'Cetipados', value: total.receita_cetipados },
      { id: 'fundos', name: 'Fundos', value: total.receitas_ofertas_fundos },
      { id: 'rf_ofertas', name: 'RF Ofertas', value: total.receitas_ofertas_rf },
      { id: 'rf_fluxo', name: 'RF Fluxo', value: total.receita_renda_fixa },
      { id: 'seguros', name: 'Seguros', value: total.receita_seguros },
      { id: 'prev', name: 'Previdência', value: total.receita_previdencia },
      { id: 'consorcios', name: 'Consórcios', value: total.receita_consorcios },
      { id: 'cambio', name: 'Câmbio', value: total.receita_cambio },
      { id: 'compromissadas', name: 'Compromissadas', value: total.receita_compromissadas },
      { id: 'offshore', name: 'Offshore', value: total.receitas_offshore },
    ].filter(i => i.value > 0);

    return {
      name: 'root',
      children: items
    };
  }, [data]);

  const root = useMemo(() => 
    hierarchy(revenueData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0)),
    [revenueData]
  );

  return (
    <svg width={width} height={height}>
      <Treemap
        top={margin.top}
        left={margin.left}
        root={root}
        size={[innerWidth, innerHeight]}
        tile={treemapSquarify}
      >
        {(treemap) => (
          <Group>
            {treemap.descendants().map((node, i) => {
              if (node.depth === 0) return null;
              const nodeWidth = node.x1 - node.x0;
              const nodeHeight = node.y1 - node.y0;
              return (
                <Group key={`node-${i}`} top={node.y0} left={node.x0}>
                  <rect
                    width={nodeWidth}
                    height={nodeHeight}
                    stroke="#0A0D12"
                    strokeWidth={1}
                    fill={i === 1 ? "#FAC017" : "#1A2030"}
                    opacity={i === 1 ? 0.9 : 0.8}
                  />
                  {nodeWidth > 40 && nodeHeight > 20 && (
                    <text
                      x={nodeWidth / 2}
                      y={nodeHeight / 2}
                      dy=".33em"
                      textAnchor="middle"
                      className={cn(
                        "font-data text-[9px] pointer-events-none",
                        i === 1 ? "fill-euro-navy" : "fill-[#A0A090]"
                      )}
                    >
                      {node.data.name}
                    </text>
                  )}
                </Group>
              );
            })}
          </Group>
        )}
      </Treemap>
    </svg>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

export default function RevenueTreemap(props: RevenueTreemapProps) {
  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-xs font-data text-euro-gold/60 uppercase tracking-widest mb-4">Composição de Receita por Produto</h3>
      <div className="flex-1 w-full overflow-hidden">
        <ParentSize>
          {({ width, height }) => <TreemapChart {...props} width={width} height={height} />}
        </ParentSize>
      </div>
    </div>
  );
}
