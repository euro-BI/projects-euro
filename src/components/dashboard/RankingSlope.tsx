
import React, { useMemo } from "react";
import { Group } from "@visx/group";
import { Line } from "@visx/shape";
import { scaleLinear } from "@visx/scale";
import { AssessorResumo } from "@/types/dashboard";
import { ParentSize } from "@visx/responsive";

interface RankingSlopeProps {
  current: AssessorResumo[];
  previous: AssessorResumo[];
}

function SlopeChart({ current, previous, width, height }: RankingSlopeProps & { width: number; height: number }) {
  const margin = { top: 40, right: 120, bottom: 40, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Prepare data: rank assessors in current and previous month
  const rankings = useMemo(() => {
    const currentRank = [...current].sort((a, b) => b.pontos_totais_acumulado - a.pontos_totais_acumulado);
    const prevRank = [...previous].sort((a, b) => b.pontos_totais_acumulado - a.pontos_totais_acumulado);

    return currentRank.map((assessor, idx) => {
      const prevIdx = prevRank.findIndex(p => p.cod_assessor === assessor.cod_assessor);
      return {
        id: assessor.cod_assessor,
        name: assessor.nome_assessor,
        currentRank: idx,
        prevRank: prevIdx === -1 ? idx : prevIdx, // Fallback if not in prev month
        points: assessor.pontos_totais_acumulado,
        lider: assessor.lider,
        cluster: assessor.cluster,
      };
    }).slice(0, 10); // Show top 10 for clarity
  }, [current, previous]);

  const yScale = scaleLinear({
    domain: [0, 9],
    range: [0, innerHeight],
  });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {rankings.map((assessor, i) => {
          const isUp = assessor.currentRank < assessor.prevRank;
          const isDown = assessor.currentRank > assessor.prevRank;
          const isStable = assessor.currentRank === assessor.prevRank;
          const isTop3 = assessor.currentRank < 3;

          const stroke = isUp ? "#FAC017" : isDown ? "#E05A4080" : "#3A3A3060";
          const strokeWidth = assessor.lider ? 3 : isTop3 ? 2 : 1;

          return (
            <React.Fragment key={assessor.id}>
              {/* Connection Line */}
              <Line
                from={{ x: 0, y: yScale(assessor.prevRank) }}
                to={{ x: innerWidth, y: yScale(assessor.currentRank) }}
                stroke={stroke}
                strokeWidth={strokeWidth}
                opacity={assessor.cluster === 'C' ? 0.3 : 1}
              />
              
              {/* Left Side (Previous) */}
              <text
                x={-10}
                y={yScale(assessor.prevRank)}
                textAnchor="end"
                alignmentBaseline="middle"
                className="fill-[#5C5C50] font-data text-[10px]"
              >
                #{assessor.prevRank + 1}
              </text>

              {/* Right Side (Current) */}
              <text
                x={innerWidth + 10}
                y={yScale(assessor.currentRank)}
                alignmentBaseline="middle"
                className={cn(
                  "font-ui text-[11px]",
                  isTop3 ? "fill-[#F5F5F0]" : "fill-[#A0A090]"
                )}
              >
                {assessor.name}
              </text>
              <text
                x={innerWidth + 10}
                y={yScale(assessor.currentRank) + 12}
                alignmentBaseline="middle"
                className="fill-[#5C5C50] font-data text-[9px]"
              >
                {assessor.points.toLocaleString()} pts
              </text>

              {/* Status Indicator */}
              {assessor.lider && (
                <rect
                  x={innerWidth + 2}
                  y={yScale(assessor.currentRank) - 5}
                  width={2}
                  height={10}
                  fill="#FAC017"
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Labels */}
        <text x={0} y={-20} textAnchor="middle" className="fill-[#5C5C50] font-data text-[10px] uppercase">Mês Anterior</text>
        <text x={innerWidth} y={-20} textAnchor="middle" className="fill-euro-gold font-data text-[10px] uppercase">Mês Atual</text>
      </Group>
    </svg>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

export default function RankingSlope(props: RankingSlopeProps) {
  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-xs font-data text-euro-gold/60 uppercase tracking-widest mb-4">Trajetória do Ranking (Top 10)</h3>
      <div className="flex-1 w-full overflow-hidden">
        <ParentSize>
          {({ width, height }) => <SlopeChart {...props} width={width} height={height} />}
        </ParentSize>
      </div>
    </div>
  );
}
