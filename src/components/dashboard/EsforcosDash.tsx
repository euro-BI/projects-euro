import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  PhoneCall,
  CalendarDays,
  Target,
  Banknote,
  Users,
  Briefcase,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  User,
  Shield,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

// ─── Tabela de metas por faixa NET ────────────────────────────────────────────
export interface EsforcosMeta {
  faixaLabel: string;
  metaLigacoes: number;       // Ligações Prospecção
  metaReunioes: number;       // Reuniões Prospecção
  metaRelacionamento: number; // Lig. e Reuniões Relacionamento
  metaCrossSell: number;      // Reuniões Cross-sell
  metaPermanencia: number;    // Permanência Euro (Esforço Total)
}

export const ESFORCOS_METAS: EsforcosMeta[] = [
  { faixaLabel: "0 – 10M",   metaLigacoes: 200, metaReunioes: 60, metaRelacionamento: 15, metaCrossSell: 12, metaPermanencia: 138 },
  { faixaLabel: "10M – 25M", metaLigacoes: 130, metaReunioes: 42, metaRelacionamento: 21, metaCrossSell: 12, metaPermanencia: 97  },
  { faixaLabel: "25M – 35M", metaLigacoes: 85,  metaReunioes: 29, metaRelacionamento: 29, metaCrossSell: 12, metaPermanencia: 72  },
  { faixaLabel: "35M – 50M", metaLigacoes: 55,  metaReunioes: 21, metaRelacionamento: 41, metaCrossSell: 12, metaPermanencia: 58  },
  { faixaLabel: "50M>",      metaLigacoes: 36,  metaReunioes: 14, metaRelacionamento: 58, metaCrossSell: 12, metaPermanencia: 54  },
];

export function getFaixaMeta(custodiaNet: number): EsforcosMeta {
  if (custodiaNet < 10_000_000)  return ESFORCOS_METAS[0];
  if (custodiaNet < 25_000_000)  return ESFORCOS_METAS[1];
  if (custodiaNet < 35_000_000)  return ESFORCOS_METAS[2];
  if (custodiaNet < 50_000_000)  return ESFORCOS_METAS[3];
  return ESFORCOS_METAS[4];
}

interface EsforcosDashProps {
  selectedYear: string;
  selectedMonth: string;
  targetAssessors: string[];
}

type ChartMetric = "pipeConvertido" | "ligacoesProspect" | "reunioesProspect" | "pontosRelacionamento" | "reunioesCrossSell" | "pontosPipe";

const CHART_METRICS: Record<ChartMetric, { label: string; color: string; isCurrency: boolean }> = {
  pipeConvertido:      { label: "Pipe Convertido",       color: "#22C55E", isCurrency: true  },
  ligacoesProspect:    { label: "Ligações Prospect",      color: "#FAC017", isCurrency: false },
  reunioesProspect:    { label: "Reuniões Prospect",      color: "#A855F7", isCurrency: false },
  pontosRelacionamento:{ label: "Pontos Relacionamento",  color: "#F97316", isCurrency: false },
  reunioesCrossSell:   { label: "Reuniões Cross-sell",    color: "#06B6D4", isCurrency: false },
  pontosPipe:          { label: "Esforço Total",           color: "#EC4899", isCurrency: false },
};

export default function EsforcosDash({
  selectedYear,
  selectedMonth,
  targetAssessors,
}: EsforcosDashProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>("pipeConvertido");
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'pontosPipe', direction: 'desc' });

  // ─── KPI query (current month) ───────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["esforcos-data", selectedMonth, targetAssessors],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const startDate = selectedMonth;
      const endDate = format(endOfMonth(parseISO(selectedMonth)), "yyyy-MM-dd");

      let q1 = supabase
        .from("vw_esforcos")
        .select("valor_lead")
        .in("tipo_pipe", ["Reunião de Diagnóstico (R1)", "Reunião de Proposta (R2)"])
        .eq("status_lead", "open");
      if (targetAssessors.length > 0) q1 = q1.in("cod_assessor", targetAssessors);

      let q2 = supabase
        .from("vw_esforcos")
        .select("valor_lead")
        .in("stage", ["EM NEGOCIAÇÃO", "REUNIÃO DE DIAGNÓSTICO (R1)", "REUNIÃO DE PROPOSTA (R2)"])
        .eq("status_lead", "won")
        .gte("ganho_em", startDate)
        .lte("ganho_em", endDate);
      if (targetAssessors.length > 0) q2 = q2.in("cod_assessor", targetAssessors);

      let q3 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .eq("tipo", "LIGAÇÃO DE PROSPECÇÃO")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q3 = q3.in("cod_assessor", targetAssessors);

      let q4 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .in("tipo_pipe", ["Reunião de Diagnóstico (R1)", "Reunião de Proposta (R2)"])
        .gte("update_time", startDate)
        .lte("update_time", endDate);
      if (targetAssessors.length > 0) q4 = q4.in("cod_assessor", targetAssessors);

      let q5 = supabase
        .from("vw_esforcos")
        .select("pipe_pontos")
        .eq("tipo", "RELACIONAMENTO")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q5 = q5.in("cod_assessor", targetAssessors);

      let q6 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .eq("tipo", "REUNIÃO CROSS-SELL")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q6 = q6.in("cod_assessor", targetAssessors);

      // 7. Pontos Pipe (soma pipe_pontos, todos os tipos, filtrado por add_time)
      let q7 = supabase
        .from("vw_esforcos")
        .select("pipe_pontos")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q7 = q7.in("cod_assessor", targetAssessors);

      const [res1, res2, res3, res4, res5, res6, res7] = await Promise.all([q1, q2, q3, q4, q5, q6, q7]);

      return {
        pipeEstimada:         res1.data?.reduce((a, c) => a + (Number(c.valor_lead) || 0), 0) || 0,
        pipeConvertido:       res2.data?.reduce((a, c) => a + (Number(c.valor_lead) || 0), 0) || 0,
        ligacoesProspect:     res3.count || 0,
        reunioesProspect:     res4.count || 0,
        pontosRelacionamento: res5.data?.reduce((a, c) => a + (Number(c.pipe_pontos) || 0), 0) || 0,
        reunioesCrossSell:    res6.count || 0,
        pontosPipe:           res7.data?.reduce((a, c) => a + (Number(c.pipe_pontos) || 0), 0) || 0,
      };
    },
  });

  // ─── Chart query (12 months rolling from selected month) ──────────────────
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ["esforcos-chart", selectedMonth, targetAssessors, chartMetric],
    enabled: !!selectedMonth,
    queryFn: async () => {
      // Build array of last 12 months
      const baseDate = parseISO(selectedMonth);
      const months: { key: string; label: string; start: string; end: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(baseDate, i);
        const start = format(startOfMonth(d), "yyyy-MM-dd");
        const end   = format(endOfMonth(d),   "yyyy-MM-dd");
        const key   = format(d, "yyyy-MM");
        const label = format(d, "MMM/yy", { locale: ptBR });
        months.push({ key, label, start, end });
      }

      // Fetch data for all months in parallel
      const results = await Promise.all(
        months.map(async (m) => {
          let value = 0;

          if (chartMetric === "pipeConvertido") {
            let q = supabase
              .from("vw_esforcos")
              .select("valor_lead")
              .in("stage", ["EM NEGOCIAÇÃO", "REUNIÃO DE DIAGNÓSTICO (R1)", "REUNIÃO DE PROPOSTA (R2)"])
              .eq("status_lead", "won")
              .gte("ganho_em", m.start)
              .lte("ganho_em", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { data } = await q;
            value = data?.reduce((a, c) => a + (Number(c.valor_lead) || 0), 0) || 0;

          } else if (chartMetric === "ligacoesProspect") {
            let q = supabase
              .from("vw_esforcos")
              .select("id_atividade", { count: "exact", head: true })
              .eq("tipo", "LIGAÇÃO DE PROSPECÇÃO")
              .gte("add_time", m.start)
              .lte("add_time", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { count } = await q;
            value = count || 0;

          } else if (chartMetric === "reunioesProspect") {
            let q = supabase
              .from("vw_esforcos")
              .select("id_atividade", { count: "exact", head: true })
              .in("tipo_pipe", ["Reunião de Diagnóstico (R1)", "Reunião de Proposta (R2)"])
              .gte("update_time", m.start)
              .lte("update_time", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { count } = await q;
            value = count || 0;

          } else if (chartMetric === "pontosRelacionamento") {
            let q = supabase
              .from("vw_esforcos")
              .select("pipe_pontos")
              .eq("tipo", "RELACIONAMENTO")
              .gte("add_time", m.start)
              .lte("add_time", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { data } = await q;
            value = data?.reduce((a, c) => a + (Number(c.pipe_pontos) || 0), 0) || 0;

          } else if (chartMetric === "reunioesCrossSell") {
            let q = supabase
              .from("vw_esforcos")
              .select("id_atividade", { count: "exact", head: true })
              .eq("tipo", "REUNIÃO CROSS-SELL")
              .gte("add_time", m.start)
              .lte("add_time", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { count } = await q;
            value = count || 0;

          } else if (chartMetric === "pontosPipe") {
            let q = supabase
              .from("vw_esforcos")
              .select("pipe_pontos")
              .gte("add_time", m.start)
              .lte("add_time", m.end);
            if (targetAssessors.length > 0) q = q.in("cod_assessor", targetAssessors);
            const { data } = await q;
            value = data?.reduce((a, c) => a + (Number(c.pipe_pontos) || 0), 0) || 0;
          }

          return { month: m.label, monthKey: m.key, value };
        })
      );

      return results;
    },
  });

  // ─── Table query: per-assessor breakdown ───────────────────────────────────
  const { data: tableResult, isLoading: isTableLoading } = useQuery({
    queryKey: ["esforcos-table", selectedMonth, targetAssessors],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const startDate = selectedMonth;
      const endDate = format(endOfMonth(parseISO(selectedMonth)), "yyyy-MM-dd");

      // 1. Get active teams from dados_times
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time, foto_url")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData || []).map((t: any) => t.time as string));

      // Build teamPhotoMap exactly as PerformanceDash / AdvisorRevenueTable
      const teamPhotoMap = new Map<string, string>();
      (activeTeamsData || []).forEach((t: any) => {
        if (t.time && t.foto_url) teamPhotoMap.set((t.time as string).toUpperCase(), t.foto_url);
      });

      // 2. Get max data_posicao from mv_resumo_assessor (active assessors = those present on latest date)
      const { data: latestEntry } = await (supabase.from("mv_resumo_assessor" as any) as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate: string = latestEntry?.data_posicao ?? endDate;

      // 3. Fetch assessor metadata from the LATEST date only (active assessors)
      let mvQ = (supabase.from("mv_resumo_assessor" as any) as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster, custodia_net")
        .eq("data_posicao", latestDate)
        .in("time", Array.from(activeTeamNames));
      if (targetAssessors.length > 0) mvQ = mvQ.in("cod_assessor", targetAssessors);
      const { data: mvRows } = await mvQ;

      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (!assessorMap.has(r.cod_assessor)) assessorMap.set(r.cod_assessor, r);
      });
      const activeAssessorIds = new Set(assessorMap.keys());

      // 4. Fetch esforcos for the selected period, filtered to active assessors
      let esQ = supabase
        .from("vw_esforcos")
        .select("cod_assessor, tipo, pipe_pontos")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) {
        esQ = esQ.in("cod_assessor", targetAssessors);
      } else {
        esQ = esQ.in("cod_assessor", Array.from(activeAssessorIds));
      }
      const { data: esRows } = await esQ;

      // 5. Aggregate per assessor
      const agg = new Map<string, { ligacoes: number; pontosRelac: number; crossSell: number; pontosPipe: number }>();
      (esRows as any[] || []).forEach((r: any) => {
        const cod = r.cod_assessor;
        if (!activeAssessorIds.has(cod)) return; // skip inactive
        if (!agg.has(cod)) agg.set(cod, { ligacoes: 0, pontosRelac: 0, crossSell: 0, pontosPipe: 0 });
        const entry = agg.get(cod)!;
        if ((r.tipo || "") === "LIGAÇÃO DE PROSPECÇÃO") entry.ligacoes += 1;
        if ((r.tipo || "") === "RELACIONAMENTO") entry.pontosRelac += Number(r.pipe_pontos) || 0;
        if ((r.tipo || "") === "REUNIÃO CROSS-SELL") entry.crossSell += 1;
        entry.pontosPipe += Number(r.pipe_pontos) || 0;
      });

      // 6. Build final rows (include ALL active assessors, even those with 0 activities)
      const rows: any[] = [];
      assessorMap.forEach((meta, cod) => {
        const vals = agg.get(cod) ?? { ligacoes: 0, pontosRelac: 0, crossSell: 0, pontosPipe: 0 };
        const custodiaNet = Number(meta.custodia_net) || 0;
        const faixaMeta = getFaixaMeta(custodiaNet);
        rows.push({
          cod_assessor: cod,
          nome_assessor: meta.nome_assessor || cod,
          time: meta.time || "",
          foto_url: meta.foto_url || null,
          lider: meta.lider || false,
          cluster: meta.cluster || "",
          custodia_net: custodiaNet,
          faixa_net: faixaMeta.faixaLabel,
          metas: faixaMeta,
          ...vals,
        });
      });

      return { rows, teamPhotoMap };
    },
  });

  const tableData = tableResult?.rows ?? [];
  const teamPhotoMap = tableResult?.teamPhotoMap ?? new Map<string, string>();

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatCurrencyValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mi";
    }
    return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
  };

  const formatChartValue = (val: number) => {
    const cfg = CHART_METRICS[chartMetric];
    if (cfg.isCurrency) {
      const absVal = Math.abs(val);
      if (absVal >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
      if (absVal >= 1000)    return `R$ ${(val / 1000).toFixed(0)}K`;
      return `R$ ${val.toFixed(0)}`;
    }
    return val.toLocaleString("pt-BR");
  };

  const formatTooltipValue = (val: number) => {
    const cfg = CHART_METRICS[chartMetric];
    if (cfg.isCurrency) return `R$ ${formatCurrencyValue(val)}`;
    return val.toLocaleString("pt-BR");
  };

  if (isLoading) {
    return (
      <div className="relative min-h-[400px]">
        <LoadingOverlay isLoading={true} />
      </div>
    );
  }

  const metrics = data || {
    pipeEstimada: 0,
    pipeConvertido: 0,
    ligacoesProspect: 0,
    reunioesProspect: 0,
    pontosRelacionamento: 0,
    reunioesCrossSell: 0,
    pontosPipe: 0,
  };

  const cfg = CHART_METRICS[chartMetric];
  const selectedMonthKey = selectedMonth?.substring(0, 7) ?? "";
  const maxVal = Math.max(...(chartData?.map(d => d.value) ?? [0]), 1);

  // ─── Metas agregadas (soma das metas de todos os assessores do tableData) ──
  const totalMetas = {
    ligacoes:     (tableData ?? []).reduce((s, r) => s + (r.metas?.metaLigacoes       ?? 0), 0),
    reunioes:     (tableData ?? []).reduce((s, r) => s + (r.metas?.metaReunioes       ?? 0), 0),
    relacionamento:(tableData ?? []).reduce((s, r) => s + (r.metas?.metaRelacionamento ?? 0), 0),
    crossSell:    (tableData ?? []).reduce((s, r) => s + (r.metas?.metaCrossSell      ?? 0), 0),
    permanencia:  (tableData ?? []).reduce((s, r) => s + (r.metas?.metaPermanencia    ?? 0), 0),
  };

  // Cards com barra de progresso
  const progressCards = [
    {
      label: "Ligações Prospect",
      value: metrics.ligacoesProspect,
      meta: totalMetas.ligacoes,
      sub: "Total de ligações",
      color: "#FAC017",
      Icon: PhoneCall,
    },
    {
      label: "Reuniões Prospect",
      value: metrics.reunioesProspect,
      meta: totalMetas.reunioes,
      sub: "R1 e R2",
      color: "#A855F7",
      Icon: CalendarDays,
    },
    {
      label: "Pontos Relac.",
      value: metrics.pontosRelacionamento,
      meta: totalMetas.relacionamento,
      sub: "Total de pontos",
      color: "#F97316",
      Icon: Users,
    },
    {
      label: "Cross-sell",
      value: metrics.reunioesCrossSell,
      meta: totalMetas.crossSell,
      sub: "Reuniões no período",
      color: "#06B6D4",
      Icon: Briefcase,
    },
    {
      label: "Esforço Total",
      value: metrics.pontosPipe,
      meta: totalMetas.permanencia,
      sub: "Soma de pontos",
      color: "#EC4899",
      Icon: Target,
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI row: 1 card duplo + 5 cards com progresso ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

        {/* Card duplo: Pipe Estimada + Convertida */}
        <Card className="col-span-1 bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full opacity-50" style={{ background: "#3B82F6" }} />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Pipe
            </CardTitle>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#3B82F620" }}>
              <Banknote className="w-3.5 h-3.5" style={{ color: "#3B82F6" }} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 space-y-1.5">
            <div>
              <span className="text-[9px] font-data text-white/40 uppercase tracking-wider block">Estimada</span>
              <span className="text-base font-display text-[#F5F5F0] leading-tight">R$ {formatCurrencyValue(metrics.pipeEstimada)}</span>
            </div>
            <div className="border-t border-white/10 pt-1.5">
              <span className="text-[9px] font-data text-white/40 uppercase tracking-wider block">Convertida</span>
              <span className="text-base font-display text-green-400 leading-tight">R$ {formatCurrencyValue(metrics.pipeConvertido)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cards com barra de progresso */}
        {progressCards.map((card) => {
          const pct = card.meta > 0 ? Math.min((card.value / card.meta) * 100, 100) : 0;
          const rawPct = card.meta > 0 ? (card.value / card.meta) * 100 : 0;
          const barColor = rawPct >= 100 ? "#22C55E" : rawPct >= 70 ? card.color : "#EF4444";
          return (
            <Card
              key={card.label}
              className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full opacity-50" style={{ background: card.color }} />
              <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
                  {card.label}
                </CardTitle>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${card.color}20` }}>
                  <card.Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 pl-5 pr-3">
                <span className="text-xl font-display text-[#F5F5F0] block leading-tight">
                  {card.value.toLocaleString("pt-BR")}
                </span>
                <span className="text-[10px] font-ui text-white/40 mt-0.5 block">{card.sub}</span>

                {/* Barra de progresso */}
                {card.meta > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-data text-white">
                        Meta {card.meta.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[10px] font-data font-bold" style={{ color: barColor }}>
                        {rawPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* ── Gráfico de barras por mês ── */}
      <Card className="bg-gradient-to-b from-white/[0.06] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
        <CardHeader className="pb-2 pt-5 px-6 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Evolução Mensal
            </CardTitle>
            <p className="text-xs font-ui text-white/40 mt-0.5">
              Últimos 12 meses · {cfg.label}
            </p>
          </div>

          {/* Seletor de métrica */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/30 text-xs font-data uppercase tracking-wider h-8 px-3 gap-1.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: cfg.color }}
                />
                {cfg.label}
                <ChevronDown className="w-3.5 h-3.5 text-white/50 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-euro-card/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl min-w-[200px]"
            >
              {(Object.entries(CHART_METRICS) as [ChartMetric, typeof CHART_METRICS[ChartMetric]][]).map(([key, m]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setChartMetric(key)}
                  className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-xs font-data uppercase tracking-wider flex items-center gap-2 py-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="px-4 pb-5 pt-2">
          {isChartLoading ? (
            <div className="relative h-64 flex items-center justify-center">
              <LoadingOverlay isLoading={true} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData ?? []}
                margin={{ top: 28, right: 8, left: 0, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "var(--font-data, monospace)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatChartValue}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                  axisLine={false}
                  tickLine={false}
                  width={cfg.isCurrency ? 72 : 40}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {(chartData ?? []).map((entry) => {
                    const isSelected = entry.monthKey === selectedMonthKey;
                    return (
                      <Cell
                        key={entry.monthKey}
                        fill={isSelected ? cfg.color : `${cfg.color}55`}
                        style={{ transition: "fill 0.2s" }}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(val: number) => formatChartValue(val)}
                    style={{
                      fill: "rgba(255,255,255,0.65)",
                      fontSize: 10,
                      fontFamily: "var(--font-data, monospace)",
                      fontWeight: 500,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Tabela por assessor ── */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 pt-5 pb-4">
          <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
            Esforços por Assessor
          </h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-euro-gold transition-colors" />
              <Input
                type="text"
                placeholder="Buscar assessor..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-white/30 focus:border-euro-gold/50 transition-all h-9 text-sm"
              />
            </div>
            <Button
              onClick={() => {
                const rows = (tableData ?? []).map((r: any) => ({
                  "Time":                  r.time || "",
                  "Cód. Assessor":         r.cod_assessor || "",
                  "Assessor":              r.nome_assessor || "",
                  "Faixa NET":             r.faixa_net || "",
                  "Esforço Total":         r.pontosPipe || 0,
                  "Meta Pontos":           (r.metas?.metaLigacoes ?? 0) + (r.metas?.metaReunioes ?? 0) + (r.metas?.metaRelacionamento ?? 0),
                  "Ligações Prospect":    r.ligacoes || 0,
                  "Pts Relacionamento":    r.pontosRelac || 0,
                  "Reuniões Cross-sell":  r.crossSell || 0,
                  "Pts Permanência":      r.pontosPipe || 0,
                  "% Esforço": (() => {
                    const meta = (r.metas?.metaLigacoes ?? 0) + (r.metas?.metaReunioes ?? 0) + (r.metas?.metaRelacionamento ?? 0);
                    return meta > 0 ? ((r.pontosPipe / meta) * 100).toFixed(1) + "%" : "0%";
                  })(),
                  "% Permanência": (() => {
                    const metaP = r.metas?.metaPermanencia ?? 0;
                    return metaP > 0 ? ((r.pontosPipe / metaP) * 100).toFixed(1) + "%" : "0%";
                  })(),
                }));
                const worksheet = XLSX.utils.json_to_sheet(rows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Esforços");
                XLSX.writeFile(workbook, `esforcos_assessores_${selectedMonthKey}.xlsx`);
              }}
              className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold h-9 gap-2 px-4 shadow-lg shadow-euro-gold/10 shrink-0"
            >
              <Download className="w-4 h-4" />
              XLSX
            </Button>
          </div>
        </div>

        <div className="overflow-auto max-h-[520px] relative">
          {isTableLoading ? (
            <div className="relative h-48">
              <LoadingOverlay isLoading={true} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              {/* Thead */}
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  {/* Time */}
                  <th className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">
                    Time
                  </th>
                  {/* Assessor */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'nome_assessor', direction: p.key === 'nome_assessor' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 md:left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor {tableSort.key === 'nome_assessor' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Faixa NET */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'faixa_net', direction: p.key === 'faixa_net' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-2">Faixa NET {tableSort.key === 'faixa_net' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Esforço Total */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'pontosPipe', direction: p.key === 'pontosPipe' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">Esforço Total {tableSort.key === 'pontosPipe' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Meta Pontos */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'metaPontos', direction: p.key === 'metaPontos' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">Meta Pontos {tableSort.key === 'metaPontos' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Ligações Prospect */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'ligacoes', direction: p.key === 'ligacoes' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">Ligações Prospect {tableSort.key === 'ligacoes' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Pontos Relacionamento */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'pontosRelac', direction: p.key === 'pontosRelac' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">Pts Relacionamento {tableSort.key === 'pontosRelac' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Cross-sell */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'crossSell', direction: p.key === 'crossSell' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">Reuniões Cross-sell {tableSort.key === 'crossSell' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* Pts Permanência */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'pontosPipe', direction: p.key === 'pontosPipe' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">Pts Permanência {tableSort.key === 'pontosPipe' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* % Esforço */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'pctEsforco', direction: p.key === 'pctEsforco' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">% Esforço {tableSort.key === 'pctEsforco' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  {/* % Permanência */}
                  <th
                    onClick={() => setTableSort(p => ({ key: 'pctPermanencia', direction: p.key === 'pctPermanencia' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">% Permanência {tableSort.key === 'pctPermanencia' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {(tableData ?? [])
                  .filter(row =>
                    (row.nome_assessor || "").toLowerCase().includes(tableSearch.toLowerCase()) ||
                    (row.cod_assessor || "").toLowerCase().includes(tableSearch.toLowerCase())
                  )
                  .sort((a, b) => {
                    const dir = tableSort.direction === 'asc' ? 1 : -1;
                    const getVal = (r: any) => {
                      if (tableSort.key === 'metaPontos') {
                        return (r.metas?.metaLigacoes ?? 0) + (r.metas?.metaReunioes ?? 0) + (r.metas?.metaRelacionamento ?? 0);
                      }
                      if (tableSort.key === 'pctEsforco') {
                        const meta = (r.metas?.metaLigacoes ?? 0) + (r.metas?.metaReunioes ?? 0) + (r.metas?.metaRelacionamento ?? 0);
                        return meta > 0 ? (r.pontosPipe / meta) * 100 : 0;
                      }
                      if (tableSort.key === 'pctPermanencia') {
                        const metaP = r.metas?.metaPermanencia ?? 1;
                        return metaP > 0 ? (r.pontosPipe / metaP) * 100 : 0;
                      }
                      return r[tableSort.key] ?? "";
                    };
                    const av = getVal(a);
                    const bv = getVal(b);
                    if (typeof av === 'string') return dir * av.localeCompare(bv);
                    return dir * ((av > bv ? 1 : av < bv ? -1 : 0));
                  })
                  .map((row, idx) => (
                    <tr
                      key={row.cod_assessor}
                      className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">
                        <div className="flex items-center justify-center">
                          {teamPhotoMap.has((row.time || "").toUpperCase()) ? (
                            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                              <img
                                src={teamPhotoMap.get((row.time || "").toUpperCase())}
                                alt={row.time}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                              {(row.time || "").substring(0, 3).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assessor */}
                      <td className="py-3 px-4 border-r border-white/10 sticky left-0 md:left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className={`w-9 h-9 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors${row.lider ? ' border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]' : ''}` }>
                              {row.foto_url
                                ? <img src={row.foto_url} alt={row.nome_assessor} className="w-full h-full object-cover" />
                                : <User className="w-4 h-4 opacity-20" />}
                            </div>
                            {row.lider && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                                <Shield className="w-2 h-2 text-euro-navy" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                              {row.nome_assessor}
                            </span>
                            <span className="text-[10px] text-white/50 font-mono">{row.cod_assessor}</span>
                          </div>
                        </div>
                      </td>

                      {/* Faixa NET */}
                      <td className="py-3 px-4 text-center border-r border-white/5">
                        <span className="text-[10px] font-data uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70 whitespace-nowrap">
                          {row.faixa_net || "–"}
                        </span>
                      </td>

                      {/* Esforço Total */}
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <span className="font-bold text-white">{row.pontosPipe.toLocaleString("pt-BR")}</span>
                      </td>

                      {/* Meta Pontos (valor apenas, sem % aqui) */}
                      {(() => {
                        const metaPontos = (row.metas?.metaLigacoes ?? 0) + (row.metas?.metaReunioes ?? 0) + (row.metas?.metaRelacionamento ?? 0);
                        return (
                          <td className="py-3 px-4 text-right border-r border-white/5">
                            <span className="text-white/60">{metaPontos.toLocaleString("pt-BR")}</span>
                          </td>
                        );
                      })()}

                      {/* Ligações Prospect */}
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <span className="text-white">{row.ligacoes.toLocaleString("pt-BR")}</span>
                      </td>

                      {/* Pontos Relacionamento */}
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <span className="text-white">{row.pontosRelac.toLocaleString("pt-BR")}</span>
                      </td>

                      {/* Cross-sell */}
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <span className="text-white">{row.crossSell.toLocaleString("pt-BR")}</span>
                      </td>

                      {/* Pts Permanência */}
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <span className="font-bold text-white">{row.pontosPipe.toLocaleString("pt-BR")}</span>
                      </td>

                      {/* % Esforço e % Permanência — colunas finais */}
                      {(() => {
                        const metaPontos = (row.metas?.metaLigacoes ?? 0) + (row.metas?.metaReunioes ?? 0) + (row.metas?.metaRelacionamento ?? 0);
                        const pctEsf = metaPontos > 0 ? (row.pontosPipe / metaPontos) * 100 : 0;
                        const metaPerm = row.metas?.metaPermanencia ?? 1;
                        const pctPerm = metaPerm > 0 ? (row.pontosPipe / metaPerm) * 100 : 0;
                        const colorEsf = pctEsf >= 100 ? "text-green-400" : pctEsf >= 70 ? "text-euro-gold" : "text-red-400";
                        const colorPerm = pctPerm >= 100 ? "text-green-400" : pctPerm >= 70 ? "text-euro-gold" : "text-red-400";
                        return (
                          <>
                            <td className="py-3 px-4 text-right border-r border-white/5">
                              <span className={`font-bold ${colorEsf}`}>{pctEsf.toFixed(1)}%</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-bold ${colorPerm}`}>{pctPerm.toFixed(1)}%</span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
              </tbody>

              {/* Footer totals */}
              <tfoot className="sticky bottom-0 z-30">
                <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                  <td colSpan={1} className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">Total</td>
                  <td className="sticky left-0 md:left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                  {/* Faixa NET */}
                  <td className="py-4 px-4 border-r border-white/5 bg-black/80"></td>
                  {/* Esforço Total */}
                  <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">
                    {(tableData ?? []).reduce((s, r) => s + (r.pontosPipe || 0), 0).toLocaleString("pt-BR")}
                  </td>
                  {/* Meta Pontos */}
                  {(() => {
                    const rows = tableData ?? [];
                    const totalPipe = rows.reduce((s, r) => s + (r.pontosPipe || 0), 0);
                    const totalMeta = rows.reduce((s, r) => {
                      const m = r.metas ?? {};
                      return s + ((m.metaLigacoes ?? 0) + (m.metaReunioes ?? 0) + (m.metaRelacionamento ?? 0));
                    }, 0);
                    const totalMetaPerm = rows.reduce((s, r) => s + (r.metas?.metaPermanencia ?? 0), 0);
                    const pctEsf = totalMeta > 0 ? (totalPipe / totalMeta) * 100 : 0;
                    const pctPerm = totalMetaPerm > 0 ? (totalPipe / totalMetaPerm) * 100 : 0;
                    const colorEsf = pctEsf >= 100 ? "text-green-400" : pctEsf >= 70 ? "text-euro-gold" : "text-red-400";
                    const colorPerm = pctPerm >= 100 ? "text-green-400" : pctPerm >= 70 ? "text-euro-gold" : "text-red-400";
                    return (
                      <>
                        <td className="py-4 px-4 text-right text-white/60 border-r border-white/5 bg-black/80">
                          {totalMeta.toLocaleString("pt-BR")}
                        </td>
                        {/* Ligações Prospect */}
                        <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">
                          {rows.reduce((s, r) => s + (r.ligacoes || 0), 0).toLocaleString("pt-BR")}
                        </td>
                        {/* Pts Relacionamento */}
                        <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">
                          {rows.reduce((s, r) => s + (r.pontosRelac || 0), 0).toLocaleString("pt-BR")}
                        </td>
                        {/* Cross-sell */}
                        <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">
                          {rows.reduce((s, r) => s + (r.crossSell || 0), 0).toLocaleString("pt-BR")}
                        </td>
                        {/* Pts Permanência */}
                        <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">
                          {totalPipe.toLocaleString("pt-BR")}
                        </td>
                        {/* % Esforço */}
                        <td className={`py-4 px-4 text-right font-bold border-r border-white/5 bg-black/80 ${colorEsf}`}>
                          {pctEsf.toFixed(1)}%
                        </td>
                        {/* % Permanência */}
                        <td className={`py-4 px-4 text-right font-bold bg-black/80 ${colorPerm}`}>
                          {pctPerm.toFixed(1)}%
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
