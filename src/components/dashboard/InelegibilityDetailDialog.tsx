import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ELIGIBILITY_V2_START = "2026-07-01";
const CLIENTES_LIMIT = 120;
const SERVIR_MIN = 60;
const NPS_MIN = 80;
const FP_MIN = 50;
const RUPTURAS_MAX = 5;

type NpsRow = {
  assessor: string;
  conta: string;
  jornada: string;
  status: string;
  data_real: string | null;
  nota_score: number | null;
  classificacao_nps: string | null;
};

type MonthPoint = {
  key: string;
  label: string;
  value: number | null;
  meta?: number | null;
  fail?: boolean;
};

function normalizeAssessorCode(raw: string | null | undefined) {
  const value = (raw || "").trim().toUpperCase();
  if (!value) return "";
  return value.startsWith("A") ? value : `A${value}`;
}

function isV2(dataPosicao: string | null | undefined) {
  if (!dataPosicao) return false;
  return String(dataPosicao).slice(0, 10) >= ELIGIBILITY_V2_START;
}

function semesterBounds(dataPosicao: string) {
  const d = parseISO(String(dataPosicao).slice(0, 10));
  const year = getYear(d);
  const month = getMonth(d); // 0-based
  if (month < 6) {
    return {
      startKey: `${year}-01`,
      endKey: format(d, "yyyy-MM"),
      label: `1º semestre ${year}`,
    };
  }
  return {
    startKey: `${year}-07`,
    endKey: format(d, "yyyy-MM"),
    label: `2º semestre ${year}`,
  };
}

function monthKeysBetween(startKey: string, endKey: string) {
  const keys: string[] = [];
  let [y, m] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function shortMonth(key: string) {
  try {
    return format(parseISO(`${key}-01`), "MMM", { locale: ptBR });
  } catch {
    return key;
  }
}

function CriterionChart({
  title,
  subtitle,
  data,
  threshold,
  thresholdLabel,
  higherIsBetter,
  unit = "",
  onBarClick,
  finalLabel,
  finalValue,
  finalOk,
  finalExplain,
  colorOk = "#22C55E",
  colorFail = "#EF4444",
}: {
  title: string;
  subtitle: string;
  data: MonthPoint[];
  threshold: number;
  thresholdLabel: string;
  higherIsBetter: boolean;
  unit?: string;
  onBarClick?: (point: MonthPoint) => void;
  finalLabel: string;
  finalValue: string;
  finalOk: boolean;
  finalExplain: string;
  colorOk?: string;
  colorFail?: string;
}) {
  const chartData = data.map((d) => ({
    ...d,
    display: d.value == null ? 0 : d.value,
  }));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-display text-white">{title}</h4>
          <p className="text-[10px] font-data text-white/45 uppercase tracking-widest mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-data text-white/40 whitespace-nowrap">{thresholdLabel}</span>
      </div>

      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <ReferenceLine
              y={threshold}
              stroke="rgba(250,192,23,0.55)"
              strokeDasharray="4 4"
              label={{
                value: thresholdLabel,
                position: "insideTopRight",
                fill: "rgba(250,192,23,0.7)",
                fontSize: 9,
              }}
            />
            <RechartsTooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#0F1218",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                fontSize: 12,
                color: "#F5F5F0",
              }}
              labelStyle={{ color: "#F5F5F0" }}
              itemStyle={{ color: "#F5F5F0" }}
              formatter={(value: any, _name: any, item: any) => {
                const raw = item?.payload?.value;
                if (raw == null) return ["—", title];
                return [`${Number(raw).toFixed(1)}${unit}`, title];
              }}
            />
            <Bar
              dataKey="display"
              radius={[6, 6, 0, 0]}
              cursor={onBarClick ? "pointer" : "default"}
              onClick={(data: any) => {
                if (!onBarClick) return;
                const point = (data?.payload ?? data) as MonthPoint | undefined;
                if (!point?.key) return;
                onBarClick(point);
              }}
            >
              {chartData.map((entry) => {
                const fail =
                  entry.value == null
                    ? false
                    : higherIsBetter
                      ? entry.value < threshold
                      : entry.value >= threshold;
                return (
                  <Cell
                    key={entry.key}
                    fill={entry.value == null ? "rgba(255,255,255,0.12)" : fail ? colorFail : colorOk}
                    fillOpacity={entry.value == null ? 0.35 : 0.9}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className={cn(
          "rounded-xl border px-3 py-2 flex items-center justify-between gap-3",
          finalOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-data uppercase tracking-widest text-white/45">{finalLabel}</p>
          <p className="text-xs text-white/70 mt-0.5">{finalExplain}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xl font-display", finalOk ? "text-emerald-400" : "text-red-400")}>
            {finalValue}
          </span>
          {finalOk ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>
    </div>
  );
}

export type InelegibilityDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessor: AssessorResumo | null;
  yearData: AssessorResumo[];
};

export default function InelegibilityDetailDialog({
  open,
  onOpenChange,
  assessor,
  yearData,
}: InelegibilityDetailDialogProps) {
  const [npsMonthKey, setNpsMonthKey] = useState<string | null>(null);

  const cod = normalizeAssessorCode(assessor?.cod_assessor);
  const anchorDate = String(
    (assessor as any)?.lastDataPosicao || assessor?.data_posicao || ""
  ).slice(0, 10);
  const useV2 = isV2(anchorDate);
  const bounds = anchorDate
    ? semesterBounds(anchorDate)
    : { startKey: "", endKey: "", label: "" };
  const monthKeys = bounds.startKey ? monthKeysBetween(bounds.startKey, bounds.endKey) : [];

  const monthlyRows = useMemo(() => {
    if (!cod) return [] as AssessorResumo[];
    return yearData
      .filter((row) => normalizeAssessorCode(row.cod_assessor) === cod && row.data_posicao)
      .sort((a, b) => String(a.data_posicao).localeCompare(String(b.data_posicao)));
  }, [yearData, cod]);

  const rowByMonth = useMemo(() => {
    const map = new Map<string, AssessorResumo>();
    for (const row of monthlyRows) {
      map.set(String(row.data_posicao).slice(0, 7), row);
    }
    return map;
  }, [monthlyRows]);

  const { data: servirRows = [], isLoading: loadingServir } = useQuery({
    queryKey: ["ineleg-servir", cod, bounds.startKey, bounds.endKey],
    enabled: open && !!cod && useV2 && !!bounds.startKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dados_modelo_servir" as any)
        .select("periodo, indice_modelo_servir, cod_assessor")
        .eq("cod_assessor", cod)
        .gte("periodo", `${bounds.startKey}-01`)
        .lte("periodo", `${bounds.endKey}-01`);
      if (error) throw error;
      return (data || []) as Array<{ periodo: string; indice_modelo_servir: number; cod_assessor: string }>;
    },
  });

  const { data: npsRows = [], isLoading: loadingNps } = useQuery({
    queryKey: ["ineleg-nps", cod, bounds.startKey, bounds.endKey],
    enabled: open && !!cod && useV2 && !!bounds.startKey,
    queryFn: async () => {
      const start = `${bounds.startKey}-01`;
      const endExclusive = (() => {
        const [y, m] = bounds.endKey.split("-").map(Number);
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        return next;
      })();
      const codes = [cod, cod.replace(/^A/, "")];
      const { data, error } = await supabase
        .from("vw_nps_tratado" as any)
        .select("assessor, conta, jornada, status, data_real, nota_score, classificacao_nps")
        .in("assessor", codes)
        .gte("data_real", start)
        .lt("data_real", endExclusive);
      if (error) throw error;
      return ((data || []) as NpsRow[]).filter(
        (r) => r.status === "Finished" && r.nota_score != null
      );
    },
  });

  const servirByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of servirRows) {
      map.set(String(row.periodo).slice(0, 7), Number(row.indice_modelo_servir) || 0);
    }
    return map;
  }, [servirRows]);

  const npsByMonth = useMemo(() => {
    const buckets = new Map<string, { promotores: number; detratores: number; total: number; rows: NpsRow[] }>();
    for (const row of npsRows) {
      if (!row.data_real) continue;
      const key = String(row.data_real).slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, { promotores: 0, detratores: 0, total: 0, rows: [] });
      const b = buckets.get(key)!;
      b.total += 1;
      b.rows.push(row);
      if (row.classificacao_nps === "Promotor") b.promotores += 1;
      if (row.classificacao_nps === "Detrator") b.detratores += 1;
    }
    const scores = new Map<string, { score: number; total: number; rows: NpsRow[] }>();
    for (const [key, b] of buckets) {
      scores.set(key, {
        score: Math.round(((b.promotores - b.detratores) / b.total) * 100),
        total: b.total,
        rows: b.rows,
      });
    }
    return scores;
  }, [npsRows]);

  const clientesSeries: MonthPoint[] = monthKeys.map((key) => {
    const row = rowByMonth.get(key);
    const value = row?.media_movel_clientes_6m ?? null;
    return {
      key,
      label: shortMonth(key),
      value: value == null ? null : Number(value),
      fail: value != null && Number(value) >= CLIENTES_LIMIT,
    };
  });

  const servirSeries: MonthPoint[] = monthKeys.map((key) => {
    const value = servirByMonth.has(key) ? servirByMonth.get(key)! : null;
    return {
      key,
      label: shortMonth(key),
      value,
      fail: value != null && value < SERVIR_MIN,
    };
  });

  const npsSeries: MonthPoint[] = monthKeys.map((key) => {
    const bucket = npsByMonth.get(key);
    return {
      key,
      label: shortMonth(key),
      value: bucket ? bucket.score : null,
      fail: bucket ? bucket.score < NPS_MIN : false,
    };
  });

  const fpSeries: MonthPoint[] = monthKeys.map((key) => {
    const row = rowByMonth.get(key);
    const meta = Number(row?.meta_fp300k || 0);
    const total = Number(row?.total_fp_300k || 0);
    const value = meta > 0 ? (total / meta) * 100 : null;
    return {
      key,
      label: shortMonth(key),
      value,
      fail: value != null && value <= FP_MIN,
    };
  });

  const rupturasSeries: MonthPoint[] = monthKeys.map((key) => {
    const row = rowByMonth.get(key);
    const value = row?.media_movel_rupturas_6m ?? null;
    return {
      key,
      label: shortMonth(key),
      value: value == null ? null : Number(value),
      fail: value != null && Number(value) > RUPTURAS_MAX,
    };
  });

  const latest = rowByMonth.get(bounds.endKey) || assessor;
  const mediaClientes = latest?.media_movel_clientes_6m != null ? Number(latest.media_movel_clientes_6m) : null;
  const clientesOk = mediaClientes != null && mediaClientes < CLIENTES_LIMIT;

  const servirValues = servirSeries.map((s) => s.value).filter((v): v is number => v != null);
  const mediaServir =
    latest?.media_servir_semestre != null
      ? Number(latest.media_servir_semestre)
      : servirValues.length
        ? servirValues.reduce((a, b) => a + b, 0) / servirValues.length
        : null;
  const servirOk = mediaServir != null && mediaServir >= SERVIR_MIN;

  const npsRespostas = Number(latest?.nps_respostas_semestre ?? npsRows.length);
  const npsScore =
    latest?.nps_semestre != null
      ? Number(latest.nps_semestre)
      : npsRespostas > 0
        ? (() => {
            const promotores = npsRows.filter((r) => r.classificacao_nps === "Promotor").length;
            const detratores = npsRows.filter((r) => r.classificacao_nps === "Detrator").length;
            return Math.round(((promotores - detratores) / npsRespostas) * 100);
          })()
        : null;
  const npsOk = npsRespostas === 0 || (npsScore != null && npsScore >= NPS_MIN);

  const percFP =
    latest?.total_fp_300k != null && latest?.meta_fp300k
      ? (Number(latest.total_fp_300k) / Number(latest.meta_fp300k)) * 100
      : null;
  const fpOk = percFP != null && percFP > FP_MIN;

  const mediaRupturas =
    latest?.media_movel_rupturas_6m != null ? Number(latest.media_movel_rupturas_6m) : null;
  const rupturasOk = mediaRupturas != null && mediaRupturas <= RUPTURAS_MAX;

  const failedLabels = useV2
    ? [
        !clientesOk ? "Média de clientes" : null,
        !servirOk ? "Modelo de Servir" : null,
        !npsOk ? "NPS do semestre" : null,
      ].filter(Boolean)
    : [
        !clientesOk ? "Média de clientes" : null,
        !fpOk ? "FP 300k+" : null,
        !rupturasOk ? "Média de rupturas" : null,
      ].filter(Boolean);

  const npsMonthRows = npsMonthKey ? npsByMonth.get(npsMonthKey)?.rows || [] : [];
  const npsMonthMeta = npsMonthKey ? npsByMonth.get(npsMonthKey) : null;

  const loading = useV2 && (loadingServir || loadingNps);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[96vw] max-h-[78vh] overflow-y-auto bg-euro-navy border-white/10 text-white rounded-2xl p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-white/10 sticky top-0 z-10 bg-euro-navy/95 backdrop-blur-md">
            <DialogTitle className="flex items-start gap-3 pr-8">
              <div className="mt-0.5 rounded-full border border-red-500/40 bg-red-500/10 p-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-data uppercase tracking-[0.2em] text-red-400/90">
                  Inelegível ao Super Ranking
                </p>
                <p className="text-lg font-display text-white truncate">
                  {assessor?.nome_assessor || "Assessor"}
                </p>
                <p className="text-xs font-data text-white/45 mt-1">
                  {assessor?.cod_assessor}
                  {bounds.label ? ` · ${bounds.label}` : ""}
                  {anchorDate
                    ? ` · posição ${format(parseISO(anchorDate), "MMM/yyyy", { locale: ptBR })}`
                    : ""}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-3 space-y-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <p className="text-[11px] font-data uppercase tracking-widest text-white/45 mb-1">
                Por que não concorre
              </p>
              {failedLabels.length > 0 ? (
                <ul className="space-y-1">
                  {failedLabels.map((label) => (
                    <li key={String(label)} className="text-sm text-white/85 flex items-center gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/70">Critérios de elegibilidade não atingidos.</p>
              )}
              <p className="text-[11px] text-white/40 mt-1.5">
                Abaixo: evolução mês a mês dos critérios. A barra final mostra o consolidado usado no corte.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-white/50 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico…
              </div>
            ) : (
              <div className="space-y-3">
                <CriterionChart
                  title="Média de clientes"
                  subtitle="Média móvel das últimas 6 posições"
                  data={clientesSeries}
                  threshold={CLIENTES_LIMIT}
                  thresholdLabel={`limite ${CLIENTES_LIMIT}`}
                  higherIsBetter={false}
                  finalLabel="Média consolidada no corte"
                  finalValue={mediaClientes == null ? "—" : mediaClientes.toFixed(1)}
                  finalOk={clientesOk}
                  finalExplain={
                    mediaClientes == null
                      ? "Sem posição no período."
                      : clientesOk
                        ? `Abaixo de ${CLIENTES_LIMIT} — critério ok.`
                        : `Precisa ficar abaixo de ${CLIENTES_LIMIT} clientes na média móvel.`
                  }
                />

                {useV2 ? (
                  <>
                    <CriterionChart
                      title="Modelo de Servir"
                      subtitle="Índice mensal lançado · corte na média do semestre"
                      data={servirSeries}
                      threshold={SERVIR_MIN}
                      thresholdLabel={`mín. ${SERVIR_MIN}`}
                      higherIsBetter
                      finalLabel="Média do semestre (meses lançados)"
                      finalValue={mediaServir == null ? "—" : mediaServir.toFixed(1)}
                      finalOk={servirOk}
                      finalExplain={
                        mediaServir == null
                          ? "Sem lançamento no semestre até este mês — critério não bate."
                          : servirOk
                            ? `Média ≥ ${SERVIR_MIN} — critério ok.`
                            : `Média precisa ser ≥ ${SERVIR_MIN} pontos no semestre.`
                      }
                    />

                    <CriterionChart
                      title="NPS do semestre"
                      subtitle="Score mensal das respostas · clique na barra para ver o detalhe"
                      data={npsSeries}
                      threshold={NPS_MIN}
                      thresholdLabel={`mín. ${NPS_MIN}`}
                      higherIsBetter
                      onBarClick={(point) => {
                        if (point.value == null) return;
                        setNpsMonthKey(point.key);
                      }}
                      finalLabel="NPS acumulado no semestre"
                      finalValue={
                        npsRespostas === 0
                          ? "sem resp."
                          : npsScore == null
                            ? "—"
                            : `${npsScore.toFixed(0)}`
                      }
                      finalOk={npsOk}
                      finalExplain={
                        npsRespostas === 0
                          ? "Ainda sem respostas no semestre — este critério não derruba."
                          : npsOk
                            ? `${npsRespostas} resposta(s) · ≥ ${NPS_MIN} — critério ok.`
                            : `${npsRespostas} resposta(s) · precisa ≥ ${NPS_MIN} no acumulado do semestre.`
                      }
                    />
                  </>
                ) : (
                  <>
                    <CriterionChart
                      title="FP 300k+"
                      subtitle="% de cobertura no mês"
                      data={fpSeries}
                      threshold={FP_MIN}
                      thresholdLabel={`mín. > ${FP_MIN}%`}
                      higherIsBetter
                      unit="%"
                      finalLabel="Cobertura no mês do corte"
                      finalValue={percFP == null ? "—" : `${percFP.toFixed(0)}%`}
                      finalOk={!!fpOk}
                      finalExplain={
                        percFP == null
                          ? "Sem meta/FP no mês."
                          : fpOk
                            ? `Acima de ${FP_MIN}% — critério ok.`
                            : `Precisa superar ${FP_MIN}% de atingimento de FP 300k+.`
                      }
                    />

                    <CriterionChart
                      title="Média de rupturas"
                      subtitle="Média móvel das últimas 6 posições"
                      data={rupturasSeries}
                      threshold={RUPTURAS_MAX}
                      thresholdLabel={`máx. ${RUPTURAS_MAX}`}
                      higherIsBetter={false}
                      finalLabel="Média consolidada no corte"
                      finalValue={mediaRupturas == null ? "—" : mediaRupturas.toFixed(1)}
                      finalOk={!!rupturasOk}
                      finalExplain={
                        mediaRupturas == null
                          ? "Sem dados de ruptura."
                          : rupturasOk
                            ? `≤ ${RUPTURAS_MAX} — critério ok.`
                            : `Precisa ficar em até ${RUPTURAS_MAX} na média móvel.`
                      }
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!npsMonthKey} onOpenChange={(v) => !v && setNpsMonthKey(null)}>
        <DialogContent className="max-w-lg w-[94vw] max-h-[70vh] overflow-y-auto bg-euro-navy border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-white">
              NPS ·{" "}
              {npsMonthKey
                ? format(parseISO(`${npsMonthKey}-01`), "MMMM yyyy", { locale: ptBR })
                : ""}
            </DialogTitle>
          </DialogHeader>

          {npsMonthMeta ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-data uppercase tracking-widest text-white/40">Score</p>
                  <p
                    className={cn(
                      "text-2xl font-display mt-1",
                      npsMonthMeta.score >= NPS_MIN ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {npsMonthMeta.score}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-data uppercase tracking-widest text-white/40">Respostas</p>
                  <p className="text-2xl font-display mt-1 text-white">{npsMonthMeta.total}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-data uppercase tracking-widest text-white/40">Corte</p>
                  <p className="text-2xl font-display mt-1 text-euro-gold">≥ {NPS_MIN}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-[10px] font-data uppercase tracking-widest text-white/45">
                    <tr>
                      <th className="text-left px-3 py-2">Conta</th>
                      <th className="text-left px-3 py-2">Jornada</th>
                      <th className="text-right px-3 py-2">Nota</th>
                      <th className="text-right px-3 py-2">Classe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {npsMonthRows.map((row, idx) => (
                      <tr key={`${row.conta}-${idx}`}>
                        <td className="px-3 py-2 font-data text-white/80">{row.conta}</td>
                        <td className="px-3 py-2 text-white/60">{row.jornada}</td>
                        <td className="px-3 py-2 text-right font-display">{row.nota_score}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right text-xs",
                            row.classificacao_nps === "Promotor" && "text-emerald-400",
                            row.classificacao_nps === "Passivo" && "text-amber-400",
                            row.classificacao_nps === "Detrator" && "text-red-400"
                          )}
                        >
                          {row.classificacao_nps || "—"}
                        </td>
                      </tr>
                    ))}
                    {npsMonthRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-white/35 text-xs">
                          Sem respostas neste mês
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/50 py-8 text-center">Sem dados para este mês.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
