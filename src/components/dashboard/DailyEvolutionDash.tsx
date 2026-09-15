import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Coins,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

const REVENUE_METRICS = [
  { key: "receita_total", label: "Receita total" },
  { key: "receita_renda_fixa", label: "Renda fixa" },
  { key: "receitas_ofertas_fundos", label: "Ofertas fundos" },
  { key: "receitas_ofertas_rf", label: "Ofertas RF" },
  { key: "receita_cetipados", label: "Cetipados" },
  { key: "receitas_offshore", label: "Offshore" },
  { key: "receitas_estruturadas", label: "Estruturadas" },
  { key: "receita_b3", label: "B3" },
  { key: "asset_m_1", label: "Asset" },
  { key: "receita_seguros", label: "Seguros" },
  { key: "receita_previdencia", label: "Previdência" },
  { key: "receita_consorcios", label: "Consórcios" },
  { key: "receita_cambio", label: "Câmbio" },
  { key: "receita_cambio_pf", label: "Câmbio PF" },
  { key: "receita_cambio_pj", label: "Câmbio PJ" },
  { key: "receita_compromissadas", label: "Compromissadas" },
] as const;

const FUNDING_METRICS = [
  { key: "captacao_liquida_total", label: "Captação líquida total" },
  { key: "captacao_liquida", label: "Captação líquida" },
  { key: "captacao_entradas", label: "Entradas" },
  { key: "captacao_saidas", label: "Saídas" },
  { key: "captacao_transf_liquida", label: "Transf. líquida" },
  { key: "captacao_entrada_transf", label: "Transf. entradas" },
  { key: "captacao_saida_transf", label: "Transf. saídas" },
] as const;

const ALL_METRICS = [...REVENUE_METRICS, ...FUNDING_METRICS];

type DailyRow = {
  foto_em: string;
  data_posicao: string;
  cod_assessor: string;
  nome_assessor: string;
  time: string;
  foto_url: string | null;
  [key: string]: string | number | boolean | null;
};

type SortKey = "nome" | "valor" | "delta";

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`;
  }
  return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} K`;
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value)}`;
}

function formatDay(value: string) {
  return format(parseISO(value), "dd/MM", { locale: ptBR });
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function metricLabel(key: string) {
  return ALL_METRICS.find((metric) => metric.key === key)?.label ?? key;
}

export default function DailyEvolutionDash({
  targetAssessors,
  selectedTeam,
  teamPhotos,
}: {
  targetAssessors: string[];
  selectedTeam: string[];
  teamPhotos?: Map<string, string>;
}) {
  const [metric, setMetric] = useState<string>("receita_total");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "delta", dir: "desc" });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["resumo-assessor-diario"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("mv_resumo_assessor_diario" as any) as any)
        .select([
          "foto_em",
          "data_posicao",
          "cod_assessor",
          "nome_assessor",
          "time",
          "foto_url",
          ...ALL_METRICS.map((item) => item.key),
        ].join(","))
        .order("foto_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyRow[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const code = String(row.cod_assessor ?? "").toUpperCase();
      const team = String(row.time ?? "").toUpperCase();
      if (BLOCKED_ASSESSORS.includes(code) || BLOCKED_TEAMS.includes(team)) return false;
      if (selectedTeam.length > 0 && !selectedTeam.includes(row.time)) return false;
      if (targetAssessors.length > 0 && !targetAssessors.includes(row.cod_assessor)) return false;
      return true;
    });
  }, [rows, selectedTeam, targetAssessors]);

  const days = useMemo(() => [...new Set(filtered.map((row) => row.foto_em))].sort(), [filtered]);
  const lastDay = days.at(-1) ?? null;
  const prevDay = days.length > 1 ? days.at(-2) ?? null : null;
  const competencia = filtered[0]?.data_posicao ?? null;

  const officeSeries = useMemo(() => {
    return days.map((day) => {
      const ofDay = filtered.filter((row) => row.foto_em === day);
      const point: Record<string, string | number> = { day, label: formatDay(day) };
      for (const item of ALL_METRICS) {
        point[item.key] = ofDay.reduce((sum, row) => sum + num(row[item.key]), 0);
      }
      return point;
    });
  }, [days, filtered]);

  const lastOffice = officeSeries.at(-1);
  const prevOffice = officeSeries.length > 1 ? officeSeries.at(-2) : undefined;
  const receitaNow = num(lastOffice?.receita_total);
  const receitaDelta = receitaNow - num(prevOffice?.receita_total);
  const captacaoNow = num(lastOffice?.captacao_liquida_total);
  const captacaoDelta = captacaoNow - num(prevOffice?.captacao_liquida_total);

  const tableRows = useMemo(() => {
    if (!lastDay) return [];
    const lastByCode = new Map(filtered.filter((row) => row.foto_em === lastDay).map((row) => [row.cod_assessor, row]));
    const prevByCode = new Map(filtered.filter((row) => row.foto_em === prevDay).map((row) => [row.cod_assessor, row]));

    return [...lastByCode.values()].map((row) => {
      const now = num(row[metric]);
      const before = prevDay ? num(prevByCode.get(row.cod_assessor)?.[metric]) : null;
      const delta = before == null ? null : now - before;
      return {
        ...row,
        valor: now,
        anterior: before,
        delta,
        foto: row.foto_url || teamPhotos?.get(String(row.time ?? "").toUpperCase()) || null,
      };
    });
  }, [filtered, lastDay, prevDay, metric, teamPhotos]);

  const selectedSeries = useMemo(() => {
    if (!selectedCode) return [];
    return days.map((day, index) => {
      const row = filtered.find((item) => item.cod_assessor === selectedCode && item.foto_em === day);
      const valor = num(row?.[metric]);
      const previous = index > 0
        ? num(filtered.find((item) => item.cod_assessor === selectedCode && item.foto_em === days[index - 1])?.[metric])
        : null;
      const delta = previous == null ? null : valor - previous;
      const deltaPct = previous == null || Math.abs(previous) < 0.005
        ? null
        : ((valor - previous) / Math.abs(previous)) * 100;
      return {
        day,
        label: formatDay(day),
        valor,
        delta,
        deltaPct,
      };
    });
  }, [days, filtered, metric, selectedCode]);

  const selectedAssessor = tableRows.find((row) => row.cod_assessor === selectedCode) ?? null;

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const searched = term
      ? tableRows.filter((row) =>
        row.nome_assessor.toLowerCase().includes(term)
        || row.cod_assessor.toLowerCase().includes(term)
        || row.time.toLowerCase().includes(term))
      : tableRows;

    const direction = sort.dir === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      if (sort.key === "nome") return a.nome_assessor.localeCompare(b.nome_assessor, "pt-BR") * direction;
      if (sort.key === "valor") return (a.valor - b.valor) * direction;
      return (Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)) * (sort.dir === "desc" ? 1 : -1);
    });
  }, [tableRows, search, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "nome" ? "asc" : "desc" }
    ));
  };

  if (isLoading) {
    return (
      <div className="relative min-h-[400px]">
        <LoadingOverlay isLoading />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#12141A] px-6 py-16 text-center text-white/45">
        Ainda não tem foto diária. Atualize os dashboards em Cargas para gravar o primeiro dia.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita total"
          value={formatMoney(receitaNow)}
          delta={prevOffice ? formatDelta(receitaDelta) : "primeira foto"}
          up={prevOffice ? receitaDelta > 0 : undefined}
          icon={<Coins className="h-3.5 w-3.5 text-euro-gold" />}
        />
        <KpiCard
          label="Captação líquida"
          value={formatMoney(captacaoNow)}
          delta={prevOffice ? formatDelta(captacaoDelta) : "primeira foto"}
          up={prevOffice ? captacaoDelta > 0 : undefined}
          icon={<Wallet className="h-3.5 w-3.5 text-euro-gold" />}
        />
        <KpiCard
          label="Fotos no mês"
          value={String(days.length)}
          delta={competencia ? `competência ${format(parseISO(competencia), "MMM/yy", { locale: ptBR })}` : "—"}
          icon={<CalendarDays className="h-3.5 w-3.5 text-euro-gold" />}
        />
        <KpiCard
          label="Assessores"
          value={String(tableRows.length)}
          delta={lastDay ? `última foto ${formatDay(lastDay)}` : "—"}
          icon={<Users className="h-3.5 w-3.5 text-euro-gold" />}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141A] p-4">
        <p className="mb-3 text-[11px] font-data uppercase tracking-widest text-white/40">Receitas</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {REVENUE_METRICS.map((item) => (
            <MetricChip key={item.key} active={metric === item.key} label={item.label} onClick={() => setMetric(item.key)} />
          ))}
        </div>
        <p className="mb-3 text-[11px] font-data uppercase tracking-widest text-white/40">Captação</p>
        <div className="flex flex-wrap gap-1.5">
          {FUNDING_METRICS.map((item) => (
            <MetricChip key={item.key} active={metric === item.key} label={item.label} onClick={() => setMetric(item.key)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2 border-white/10 bg-[#12141A]">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
              <TrendingUp className="h-4 w-4 text-euro-gold" />
              {metricLabel(metric)}
            </CardTitle>
            <p className="text-xs text-white/40">
              {days.length < 2
                ? "A curva aparece a partir da segunda foto do mês."
                : `${formatDay(days[0])} → ${formatDay(days[days.length - 1])}`}
            </p>
          </CardHeader>
          <CardContent className="h-[320px] pt-2">
            {days.length < 2 ? (
              <div className="flex h-full items-center justify-center text-sm text-white/40">
                Só tem uma foto. O próximo refresh libera a evolução.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={officeSeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatMoney(Number(value)).replace("R$ ", "")}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0F1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                    formatter={(value: number) => [formatMoney(Number(value)), metricLabel(metric)]}
                  />
                  <Line type="monotone" dataKey={metric} stroke="#FAC017" strokeWidth={3} dot={{ r: 4, fill: "#FAC017", stroke: "#0F1520", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-3 overflow-hidden rounded-2xl border border-white/10 bg-[#12141A]">
          <div className="flex flex-col gap-3 px-5 pt-5 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-data text-sm uppercase tracking-widest text-euro-gold">Por assessor</h3>
              <p className="text-xs text-white/40">{metricLabel(metric)} · último dia vs foto anterior</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar assessor..."
                className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#12141A] text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-5 py-3">
                    <SortButton label="Assessor" active={sort.key === "nome"} dir={sort.dir} onClick={() => toggleSort("nome")} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortButton label="Agora" active={sort.key === "valor"} dir={sort.dir} onClick={() => toggleSort("valor")} align="right" />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <SortButton label="Delta" active={sort.key === "delta"} dir={sort.dir} onClick={() => toggleSort("delta")} align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const up = (row.delta ?? 0) > 0.005;
                  const down = (row.delta ?? 0) < -0.005;
                  return (
                    <tr key={row.cod_assessor} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/5">
                            {row.foto ? <img src={row.foto} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedCode(row.cod_assessor)}
                              className="text-left font-medium text-white underline-offset-4 hover:text-euro-gold hover:underline"
                            >
                              {row.nome_assessor}
                            </button>
                            <p className="font-data text-[11px] text-white/35">{row.cod_assessor} · {row.time}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-data text-sm text-white/80">{formatMoney(row.valor)}</td>
                      <td className={cn(
                        "px-5 py-3 text-right font-data text-sm",
                        up ? "text-emerald-400" : down ? "text-red-400" : "text-white/35",
                      )}>
                        <span className="inline-flex items-center justify-end gap-1">
                          {up && <ArrowUp className="h-3.5 w-3.5" />}
                          {down && <ArrowDown className="h-3.5 w-3.5" />}
                          {row.delta == null ? "—" : formatDelta(row.delta)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedCode)} onOpenChange={(open) => { if (!open) setSelectedCode(null); }}>
        <DialogContent className="w-[min(96vw,72rem)] max-w-[72rem] gap-5 border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {selectedAssessor?.nome_assessor ?? "Assessor"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {metricLabel(metric)} · {selectedAssessor?.cod_assessor} · {selectedAssessor?.time}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[440px]">
            {selectedSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-white/40">
                Sem fotos para este assessor.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedSeries} margin={{ top: 28, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatMoney(Number(value)).replace("R$ ", "")}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={<AssessorBarTooltip metric={metric} />}
                  />
                  <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                    {selectedSeries.map((point) => {
                      const fill = point.delta == null
                        ? "#FAC017"
                        : point.delta > 0.005
                          ? "#34D399"
                          : point.delta < -0.005
                            ? "#F87171"
                            : "#FAC017";
                      return <Cell key={point.day} fill={fill} />;
                    })}
                    <LabelList dataKey="deltaPct" content={<PctBarLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssessorBarTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: { valor: number; delta: number | null; deltaPct: number | null } }>;
  label?: string;
  metric: string;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  const pctTone = point.deltaPct == null
    ? "text-white/50"
    : point.deltaPct > 0.05
      ? "text-emerald-400"
      : point.deltaPct < -0.05
        ? "text-red-400"
        : "text-euro-gold";

  return (
    <div className="rounded-xl border border-white/15 bg-[#0F1520] px-3 py-2.5 text-[#F4F1E8] shadow-xl">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className="mt-1 font-data text-sm text-white">{formatMoney(point.valor)}</p>
      <p className="text-[11px] text-white/45">{metricLabel(metric)}</p>
      {point.deltaPct != null && (
        <p className={cn("mt-1 font-data text-sm", pctTone)}>
          {formatPct(point.deltaPct)}
          {point.delta != null ? ` · ${formatDelta(point.delta)}` : ""}
        </p>
      )}
    </div>
  );
}

function PctBarLabel({
  x,
  y,
  width,
  value,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return null;
  const pct = Number(value);
  const left = Number(x ?? 0);
  const top = Number(y ?? 0);
  const barWidth = Number(width ?? 0);
  const fill = pct > 0.05 ? "#34D399" : pct < -0.05 ? "#F87171" : "#FAC017";

  return (
    <text
      x={left + barWidth / 2}
      y={top - 8}
      textAnchor="middle"
      fill={fill}
      fontSize={11}
      fontFamily="var(--font-data, monospace)"
    >
      {formatPct(pct)}
    </text>
  );
}

function KpiCard({
  label,
  value,
  delta,
  up,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  up?: boolean;
  icon: ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-[#12141A]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
        <CardTitle className="text-[10px] font-data uppercase tracking-widest text-white/60">{label}</CardTitle>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-euro-gold/10">{icon}</div>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="font-display text-xl text-[#F5F5F0] sm:text-2xl">{value}</p>
        <p className={cn("mt-1 text-xs", up === true ? "text-emerald-400" : up === false ? "text-red-400" : "text-white/40")}>
          {delta}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-euro-gold/40 bg-euro-gold/15 text-euro-gold"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wide",
        align === "right" && "ml-auto",
        active ? "text-white" : "text-white/40",
      )}
    >
      {label}
      {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
    </button>
  );
}
