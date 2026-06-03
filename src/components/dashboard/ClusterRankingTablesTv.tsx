import React, { useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { format, getMonth, getYear, parseISO } from "date-fns";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

type Props = {
  data: AssessorResumo[];
  selectedYear: string;
  clusters?: string[];
};

const formatNet = (value: number) => {
  const v = Number(value || 0);
  return `${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
};

const formatCaptacaoAbreviada = (value: number) => {
  const v = Number(value || 0);
  const absValue = Math.abs(v);

  if (absValue >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`;
  }

  if (absValue >= 1_000) {
    return `${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} K`;
  }

  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const compactName = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]!}`;
};

type SemesterType = "s1" | "s2";

const buildClusterRanking = (data: AssessorResumo[], selectedYear: string, semesterType: SemesterType, cluster: string) => {
  if (!data?.length) return [];

  const validData = data.filter(d => {
    if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null" || d.nome_assessor.toLowerCase() === "undefined") return false;
    if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
    if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
    if (getYear(parseISO(d.data_posicao)).toString() !== selectedYear) return false;
    if (semesterType === "s1" && getMonth(parseISO(d.data_posicao)) >= 6) return false;
    if (semesterType === "s2" && getMonth(parseISO(d.data_posicao)) < 6) return false;
    if (!d.cluster || d.cluster === "ADV") return false;
    if (d.cluster !== cluster) return false;
    return true;
  });

  const grouped = validData.reduce((acc: Record<string, any>, curr) => {
    const key = curr.cod_assessor;
    if (!acc[key]) {
      acc[key] = {
        ...curr,
        pontos_captacao: 0,
        pontos_roa_invest: 0,
        pontos_roa_cs: 0,
        pontos_ativacoes: 0,
        pontos_lider: 0,
        pontos_total: 0,
        captacao_liquida_total: 0,
        ativacao_300k: 0,
        ativacao_1kk: 0,
        latest_date: curr.data_posicao,
        latest_custodia: curr.custodia_net
      };
    }

    acc[key].pontos_captacao += curr.pontos_captacao || 0;
    acc[key].pontos_roa_invest += curr.pontos_roa_invest || 0;
    acc[key].pontos_roa_cs += curr.pontos_roa_cs || 0;
    acc[key].pontos_ativacoes += curr.pontos_ativacoes || 0;
    acc[key].pontos_lider += (curr.pontos_lider || 0) + (curr.pontos_lider_roa || 0) + (curr.pontos_lider_cap || 0);
    acc[key].pontos_total += curr.pontos_total || 0;
    acc[key].captacao_liquida_total += curr.captacao_liquida_total || 0;
    acc[key].ativacao_300k += curr.ativacao_300k || 0;
    acc[key].ativacao_1kk += curr.ativacao_1kk || 0;

    if (curr.data_posicao > acc[key].latest_date) {
      acc[key].latest_date = curr.data_posicao;
      acc[key].latest_custodia = curr.custodia_net;
    }

    return acc;
  }, {});

  return Object.values(grouped).sort((a: any, b: any) => b.pontos_total - a.pontos_total);
};

export default function ClusterRankingTablesTv({ data, selectedYear, clusters = ["A", "B", "C", "D"] }: Props) {
  const semesterType = useMemo<SemesterType>(() => {
    const months = Array.from(new Set(
      (data || [])
        .filter(d => d?.data_posicao && getYear(parseISO(d.data_posicao)).toString() === selectedYear)
        .map(d => format(parseISO(d.data_posicao), "yyyy-MM"))
    )).sort();

    const latestMonth = months[months.length - 1];
    const baseDate = latestMonth ? parseISO(`${latestMonth}-01`) : new Date();
    const monthIdx = getMonth(baseDate);
    return monthIdx < 6 ? "s1" : "s2";
  }, [data, selectedYear]);

  const semesterLabel = semesterType === "s1" ? "1º Semestre" : "2º Semestre";

  const rankings = useMemo(() => {
    return clusters.map(cluster => ({
      cluster,
      rows: buildClusterRanking(data, selectedYear, semesterType, cluster)
    }));
  }, [clusters, data, selectedYear, semesterType]);

  const maxRows = useMemo(() => {
    return Math.max(1, ...rankings.map(r => r.rows.length));
  }, [rankings]);

  const density = maxRows >= 18 ? "dense" : "normal";
  const headText = density === "dense" ? "text-[9px]" : "text-[10px]";
  const clusterHeadText = density === "dense" ? "text-[10px]" : "text-xs";
  const cellText = density === "dense" ? "text-[9px]" : "text-[10px]";
  const cellPad = density === "dense" ? "py-1 px-2" : "py-1.5 px-2.5";
  const headPad = density === "dense" ? "py-1.5 px-3" : "py-2 px-3";

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-4 pb-2 pl-8">
        <Trophy className="w-10 h-10 text-euro-gold" />
        <h1 className="text-4xl font-data text-white tracking-[0.18em] uppercase whitespace-nowrap">
          Consolidado <span className="text-euro-gold font-light">· Por Cluster · Semestre Atual</span>
        </h1>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0">
        {rankings.map(({ cluster, rows }) => (
          <div
            key={cluster}
            style={{ flex: `${Math.max(1, rows.length)} 1 0%` }}
            className="bg-gradient-to-b from-white/[0.06] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-0"
          >
            <div className={cn("flex items-center justify-between bg-black/25 border-b border-white/10", headPad)}>
              <div className="flex items-center gap-2">
                <span className={cn("font-data uppercase tracking-widest text-euro-gold whitespace-nowrap", clusterHeadText)}>
                  Cluster {cluster}
                </span>
                <span className={cn("font-data text-white/35 uppercase tracking-widest whitespace-nowrap", headText)}>
                  {semesterLabel} {selectedYear}
                </span>
              </div>
              <span className={cn("font-data text-white/40 uppercase tracking-widest whitespace-nowrap", headText)}>
                {rows.length} {rows.length === 1 ? "assessor" : "assessores"}
              </span>
            </div>

            <div className="flex-1 min-h-0">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className={cn("font-data uppercase tracking-widest text-white/45 bg-black/20 leading-tight", headText)}>
                    <th className={cn(cellPad, "font-normal w-10")}>#</th>
                    <th className={cn(cellPad, "font-normal w-[260px]")}>Assessor</th>
                    <th className={cn(cellPad, "font-normal text-right w-20")}>Net</th>
                    <th className={cn(cellPad, "font-normal text-right w-24")}>Pontos Totais</th>
                    <th className={cn(cellPad, "font-normal text-right w-20")}>P. Captação</th>
                    <th className={cn(cellPad, "font-normal text-right w-24")}>Captação Liq.</th>
                    <th className={cn(cellPad, "font-normal text-right w-20")}>P. ROA Invest</th>
                    <th className={cn(cellPad, "font-normal text-right w-16")}>P. ROA CS</th>
                    <th className={cn(cellPad, "font-normal text-right w-14")}>Ativ.</th>
                    <th className={cn(cellPad, "font-normal text-right w-16")}>Ativ 300k+</th>
                    <th className={cn(cellPad, "font-normal text-right w-14")}>Ativ 1M</th>
                    <th className={cn(cellPad, "font-normal text-right w-16")}>P. Líder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {rows.map((assessor: any, idx: number) => (
                    <tr key={assessor.cod_assessor} className="hover:bg-white/[0.04] transition-colors leading-tight">
                      <td className={cn(cellPad, "font-data text-white/80 tabular-nums", cellText)}>{idx + 1}</td>
                      <td className={cn(cellPad, "min-w-0", cellText)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-euro-inset border border-white/10 overflow-hidden flex-shrink-0">
                            {assessor.foto_url ? (
                              <img src={assessor.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] font-data text-white/40">
                                {String(assessor.nome_assessor || "A").trim().slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-ui text-white truncate">
                              {assessor.nome_assessor}
                            </span>
                            <span className="font-data text-white/40 uppercase tracking-widest whitespace-nowrap">
                              {assessor.cod_assessor}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {formatNet(assessor.latest_custodia)}
                      </td>
                      <td className={cn(cellPad, "font-data text-euro-gold text-right tabular-nums whitespace-nowrap", cellText)}>
                        {Number(assessor.pontos_total || 0).toLocaleString("pt-BR")}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.pontos_captacao > 0 ? Number(assessor.pontos_captacao).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        R$ {formatCaptacaoAbreviada(assessor.captacao_liquida_total || 0)}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.pontos_roa_invest > 0 ? Number(assessor.pontos_roa_invest).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.pontos_roa_cs > 0 ? Number(assessor.pontos_roa_cs).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.pontos_ativacoes > 0 ? Number(assessor.pontos_ativacoes).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.ativacao_300k > 0 ? Number(assessor.ativacao_300k).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.ativacao_1kk > 0 ? Number(assessor.ativacao_1kk).toLocaleString("pt-BR") : "--"}
                      </td>
                      <td className={cn(cellPad, "font-data text-white/80 text-right tabular-nums whitespace-nowrap", cellText)}>
                        {assessor.pontos_lider > 0 ? Number(assessor.pontos_lider).toLocaleString("pt-BR") : "--"}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={12} className={cn(cellPad, "text-center font-data text-white/25 uppercase tracking-widest", cellText)}>
                        Sem dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
