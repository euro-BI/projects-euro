import React, { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown, Compass, Target, TrendingUp } from "lucide-react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type TargetKind = "breakeven" | "roa";
type Horizon = "month" | "year" | "pace" | "yearPace";
type ProductSortKey = "label" | "realized" | "target" | "percent" | "gap";

type BreakEvenTargetRow = {
  competencia: string;
  product_key: string;
  value: number;
};

type ProductDef = { key: string; label: string; fields: string[]; roa: number; family: "allocation" | "variable" | "banking" | "insurance" };

const PRODUCTS: ProductDef[] = [
  { key: "rf", label: "RF", fields: ["receita_renda_fixa"], roa: 0.0015, family: "allocation" },
  { key: "asset", label: "Asset", fields: ["asset_m_1"], roa: 0.0002, family: "allocation" },
  { key: "previdencia", label: "Previdência", fields: ["receita_previdencia"], roa: 0.0001, family: "allocation" },
  { key: "cetipados", label: "Cetipados", fields: ["receita_cetipados"], roa: 0.0005, family: "allocation" },
  { key: "ofertas", label: "Ofertas", fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"], roa: 0.0010, family: "allocation" },
  { key: "offshore", label: "Offshore", fields: ["receitas_offshore"], roa: 0.0002, family: "allocation" },
  { key: "cambio_pf", label: "Câmbio PF", fields: ["receita_cambio_pf"], roa: 0.0001, family: "allocation" },
  { key: "estruturadas", label: "Estruturadas", fields: ["receitas_estruturadas"], roa: 0.0035, family: "variable" },
  { key: "b3", label: "B3", fields: ["receita_b3"], roa: 0.0020, family: "variable" },
  { key: "consorcios", label: "Consórcios", fields: ["receita_consorcios"], roa: 0.0009, family: "banking" },
  { key: "compromissadas_pj", label: "Compromissadas PJ", fields: ["receita_compromissadas"], roa: 0.0001, family: "banking" },
  { key: "cambio", label: "Câmbio PJ", fields: ["receita_cambio_pj"], roa: 0.0001, family: "banking" },
  { key: "seguros", label: "Seguros", fields: ["receita_seguros"], roa: 0.0007, family: "insurance" },
];

const FAMILIES = [
  { key: "allocation" as const, label: "Alocação", color: "#FAC017" },
  { key: "variable" as const, label: "Renda Variável", color: "#3B82F6" },
  { key: "banking" as const, label: "Banking", color: "#8B5CF6" },
  { key: "insurance" as const, label: "Seguros", color: "#EC4899" },
];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function statusColor(percent: number) {
  if (percent >= 100) return "text-green-500";
  if (percent >= 70) return "text-euro-gold";
  return "text-red-500";
}

function barColor(percent: number) {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 70) return "bg-euro-gold";
  return "bg-red-500";
}

function sumFields(row: AssessorResumo, fields: string[]) {
  return fields.reduce((acc, field) => acc + ((row as any)[field] || 0), 0);
}

function getBusinessDayPaceFactor(referenceDate: Date) {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  const totalDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
  const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter((d) => !isWeekend(d)).length;
  const passedDays = Math.max(1, rawPassedDays - 2);
  if (passedDays > 0 && totalDays > 0) return totalDays / passedDays;
  return 1;
}

export function CockpitGlobalPulse({
  yearlyData,
  currentData,
  selectedYear,
  targetKind,
  breakEvenTargets,
  referenceDate,
}: {
  yearlyData: AssessorResumo[];
  currentData: AssessorResumo[];
  selectedYear: string;
  targetKind: TargetKind;
  breakEvenTargets: BreakEvenTargetRow[];
  referenceDate: Date;
}) {
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [productSort, setProductSort] = useState<{ key: ProductSortKey; dir: "asc" | "desc" }>({
    key: "label",
    dir: "asc",
  });

  const breakEvenMap = useMemo(() => {
    const map = new Map<string, number>();
    breakEvenTargets.forEach((row) => {
      const monthKey = format(parseISO(row.competencia), "yyyy-MM");
      map.set(`${monthKey}|${row.product_key}`, Number(row.value) || 0);
    });
    return map;
  }, [breakEvenTargets]);

  const pulse = useMemo(() => {
    const grouped: Record<string, { label: string; custody: number; realized: Record<string, number> }> = {};

    yearlyData.forEach((row) => {
      if (!row.data_posicao) return;
      const monthKey = format(parseISO(row.data_posicao), "yyyy-MM");
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: format(parseISO(row.data_posicao), "MMM", { locale: ptBR }),
          custody: 0,
          realized: {},
        };
      }
      grouped[monthKey].custody += row.custodia_net || 0;
      PRODUCTS.forEach((product) => {
        grouped[monthKey].realized[product.key] =
          (grouped[monthKey].realized[product.key] || 0) + sumFields(row, product.fields);
      });
    });

    const productTarget = (monthKey: string, product: ProductDef, custody: number) => {
      if (targetKind === "roa") return (custody * product.roa) / 12;
      return breakEvenMap.get(`${monthKey}|${product.key}`) ?? 0;
    };

    const months = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const lastCustody = months.length ? grouped[months[months.length - 1]].custody : 0;

    const monthRows = months.map((key) => {
      const entry = grouped[key];
      const products = PRODUCTS.map((product) => {
        const realized = entry.realized[product.key] || 0;
        const target = productTarget(key, product, entry.custody);
        return { ...product, realized, target };
      });
      const families = FAMILIES.map((family) => {
        const items = products.filter((p) => p.family === family.key);
        return {
          ...family,
          realized: items.reduce((acc, item) => acc + item.realized, 0),
          target: items.reduce((acc, item) => acc + item.target, 0),
        };
      });
      return {
        key,
        label: entry.label,
        custody: entry.custody,
        products,
        families,
        realized: families.reduce((acc, item) => acc + item.realized, 0),
        target: families.reduce((acc, item) => acc + item.target, 0),
      };
    });

    let yearTargetFull = 0;
    for (let idx = 0; idx < 12; idx += 1) {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const custody = grouped[monthKey]?.custody || lastCustody;
      yearTargetFull += PRODUCTS.reduce((acc, product) => acc + productTarget(monthKey, product, custody), 0);
    }

    let accRealized = 0;
    let accTarget = 0;
    const familyRunning: Record<string, number> = {
      allocation: 0,
      variable: 0,
      banking: 0,
      insurance: 0,
    };
    const lastDataMonth = months[months.length - 1] || "";
    const yearChartData = Array.from({ length: 12 }, (_, idx) => {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const monthName = format(new Date(Number(selectedYear), idx, 1), "MMM", { locale: ptBR });
      const row = monthRows.find((item) => item.key === monthKey);
      const custody = row?.custody || lastCustody;
      accTarget += PRODUCTS.reduce((acc, product) => acc + productTarget(monthKey, product, custody), 0);

      if (row) {
        accRealized += row.realized;
        row.families.forEach((family) => {
          familyRunning[family.key] += family.realized;
        });
      }

      const hasRealizedPoint = Boolean(lastDataMonth) && monthKey <= lastDataMonth;
      return {
        monthKey,
        monthName,
        totalAcc: hasRealizedPoint ? accRealized : null,
        targetAcc: accTarget,
        allocation: hasRealizedPoint ? familyRunning.allocation : null,
        variable: hasRealizedPoint ? familyRunning.variable : null,
        banking: hasRealizedPoint ? familyRunning.banking : null,
        insurance: hasRealizedPoint ? familyRunning.insurance : null,
      };
    });

    const currentMonthKey = currentData[0]?.data_posicao
      ? format(parseISO(currentData[0].data_posicao), "yyyy-MM")
      : months[months.length - 1];
    const currentMonth = monthRows.find((row) => row.key === currentMonthKey) || monthRows[monthRows.length - 1];
    const isLiveMonth = Boolean(
      currentData[0]?.data_posicao &&
        isSameMonth(parseISO(currentData[0].data_posicao), referenceDate) &&
        parseISO(currentData[0].data_posicao).getFullYear() === referenceDate.getFullYear()
    );
    const paceFactor = isLiveMonth ? getBusinessDayPaceFactor(referenceDate) : 1;

    const ytdRealized = monthRows.reduce((acc, row) => acc + row.realized, 0);
    const ytdTarget = monthRows.reduce((acc, row) => acc + row.target, 0);

    const currentMonthIndex = currentMonth ? Number(currentMonth.key.slice(5, 7)) - 1 : 11;
    const remainingMonths = Math.max(0, 11 - currentMonthIndex);
    const currentPaceTotal = currentMonth ? currentMonth.realized * paceFactor : 0;
    const closedRealized = monthRows
      .filter((row) => row.key !== currentMonth?.key)
      .reduce((acc, row) => acc + row.realized, 0);
    const yearPace = closedRealized + currentPaceTotal + remainingMonths * currentPaceTotal;

    const yearProductTargets: Record<string, number> = {};
    PRODUCTS.forEach((product) => {
      yearProductTargets[product.key] = 0;
    });
    for (let idx = 0; idx < 12; idx += 1) {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const custody = grouped[monthKey]?.custody || lastCustody;
      PRODUCTS.forEach((product) => {
        yearProductTargets[product.key] += productTarget(monthKey, product, custody);
      });
    }

    const pacedFamilies: Record<string, number> = {
      allocation: 0,
      variable: 0,
      banking: 0,
      insurance: 0,
    };
    currentMonth?.families.forEach((family) => {
      pacedFamilies[family.key] = family.realized * paceFactor;
    });

    let paceAccRealized = 0;
    let paceAccTarget = 0;
    const paceFamilyRunning: Record<string, number> = {
      allocation: 0,
      variable: 0,
      banking: 0,
      insurance: 0,
    };
    const yearPaceChartData = Array.from({ length: 12 }, (_, idx) => {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const monthName = format(new Date(Number(selectedYear), idx, 1), "MMM", { locale: ptBR });
      const row = monthRows.find((item) => item.key === monthKey);
      const custody = row?.custody || lastCustody;
      paceAccTarget += PRODUCTS.reduce((acc, product) => acc + productTarget(monthKey, product, custody), 0);

      const isPast = Boolean(currentMonthKey) && monthKey < currentMonthKey;
      const isCurrentOrFuture = !currentMonthKey || monthKey >= currentMonthKey;

      if (isPast && row) {
        paceAccRealized += row.realized;
        row.families.forEach((family) => {
          paceFamilyRunning[family.key] += family.realized;
        });
      } else if (isCurrentOrFuture) {
        paceAccRealized += currentPaceTotal;
        FAMILIES.forEach((family) => {
          paceFamilyRunning[family.key] += pacedFamilies[family.key] || 0;
        });
      }

      return {
        monthKey,
        monthName,
        totalAcc: paceAccRealized,
        targetAcc: paceAccTarget,
        allocation: paceFamilyRunning.allocation,
        variable: paceFamilyRunning.variable,
        banking: paceFamilyRunning.banking,
        insurance: paceFamilyRunning.insurance,
        projected: Boolean(currentMonthKey) && monthKey > currentMonthKey,
      };
    });

    return {
      monthRows,
      yearChartData,
      yearPaceChartData,
      yearProductTargets,
      currentMonth,
      currentMonthKey,
      isLiveMonth,
      paceFactor,
      ytdRealized,
      ytdTarget,
      yearTargetFull,
      yearPace,
      remainingMonths,
    };
  }, [yearlyData, currentData, selectedYear, targetKind, breakEvenMap, referenceDate]);

  const view = useMemo(() => {
    const month = pulse.currentMonth;
    if (!month) {
      return {
        realized: 0,
        target: 0,
        percent: 0,
        gap: 0,
        products: [] as Array<ProductDef & { realized: number; target: number; percent: number; gap: number }>,
        families: [] as Array<{ key: string; label: string; color: string; realized: number; target: number; percent: number }>,
        story: "Sem dados no período.",
      };
    }

    const withPct = (realized: number, target: number) => ({
      realized,
      target,
      percent: target > 0 ? (realized / target) * 100 : 0,
      gap: target - realized,
    });

    if (horizon === "year" || horizon === "yearPace") {
      const isYearPace = horizon === "yearPace";
      const products = PRODUCTS.map((product) => {
        const closed = pulse.monthRows
          .filter((row) => row.key !== pulse.currentMonth?.key)
          .reduce((acc, row) => acc + (row.products.find((item) => item.key === product.key)?.realized || 0), 0);
        const currentRaw = pulse.currentMonth?.products.find((item) => item.key === product.key)?.realized || 0;
        const currentPaced = currentRaw * pulse.paceFactor;
        const realized = isYearPace
          ? closed + currentPaced + pulse.remainingMonths * currentPaced
          : pulse.monthRows.reduce(
              (acc, row) => acc + (row.products.find((item) => item.key === product.key)?.realized || 0),
              0
            );
        const target = isYearPace
          ? pulse.yearProductTargets[product.key] || 0
          : pulse.monthRows.reduce(
              (acc, row) => acc + (row.products.find((item) => item.key === product.key)?.target || 0),
              0
            );
        return { ...product, ...withPct(realized, target) };
      });
      const families = FAMILIES.map((family) => {
        const items = products.filter((item) => item.family === family.key);
        const realized = items.reduce((acc, item) => acc + item.realized, 0);
        const target = items.reduce((acc, item) => acc + item.target, 0);
        return { ...family, ...withPct(realized, target) };
      });
      const totals = isYearPace
        ? withPct(pulse.yearPace, pulse.yearTargetFull)
        : withPct(pulse.ytdRealized, pulse.ytdTarget);
      const yearPct = pulse.yearTargetFull > 0 ? (pulse.ytdRealized / pulse.yearTargetFull) * 100 : 0;
      const pacePct = pulse.yearTargetFull > 0 ? (pulse.yearPace / pulse.yearTargetFull) * 100 : 0;
      const remainingLabel =
        pulse.remainingMonths === 1 ? "1 mês restante" : `${pulse.remainingMonths} meses restantes`;
      const story = isYearPace
        ? totals.percent >= 100
          ? `No ritmo atual, o ano fecha acima da meta cheia (${Math.round(totals.percent)}%). Sobra ${formatCurrency(Math.abs(totals.gap))}.`
          : pulse.remainingMonths > 0
            ? `Se o ritmo deste mês se repetir nos ${remainingLabel}, o ano fecha em ${formatCurrency(pulse.yearPace)} contra meta de ${formatCurrency(pulse.yearTargetFull)}. Faltam ${formatCurrency(Math.max(totals.gap, 0))}.`
            : `No ritmo atual, o ano fecha em ${formatCurrency(pulse.yearPace)} contra meta de ${formatCurrency(pulse.yearTargetFull)}. Faltam ${formatCurrency(Math.max(totals.gap, 0))}.`
        : totals.percent >= 100
          ? `O acumulado do ano já passou a meta YTD. Falta ${formatCurrency(Math.max(pulse.yearTargetFull - pulse.ytdRealized, 0))} para a meta cheia.`
          : `Estamos em ${Math.round(totals.percent)}% da meta acumulada. No pace, o ano fecharia em ${formatCurrency(pulse.yearPace)} (${Math.round(pacePct)}% da meta cheia de ${formatCurrency(pulse.yearTargetFull)}).`;
      return { ...totals, products, families, story, yearPct, pacePct };
    }

    const paced = horizon === "pace";
    const products = month.products.map((product) => {
      const realized = paced ? product.realized * pulse.paceFactor : product.realized;
      return { ...product, ...withPct(realized, product.target) };
    });
    const families = FAMILIES.map((family) => {
      const items = products.filter((item) => item.family === family.key);
      const realized = items.reduce((acc, item) => acc + item.realized, 0);
      const target = items.reduce((acc, item) => acc + item.target, 0);
      return { ...family, ...withPct(realized, target) };
    });
    const realized = families.reduce((acc, item) => acc + item.realized, 0);
    const target = families.reduce((acc, item) => acc + item.target, 0);
    const totals = withPct(realized, target);
    const story = paced
      ? totals.percent >= 100
        ? `No ritmo atual, o mês fecha acima da meta (${Math.round(totals.percent)}%). Sobra ${formatCurrency(Math.abs(totals.gap))}.`
        : `No ritmo atual, o mês fecha em ${formatCurrency(totals.realized)} contra meta de ${formatCurrency(totals.target)}. Faltam ${formatCurrency(Math.max(totals.gap, 0))}.`
      : totals.percent >= 100
        ? `O mês já superou a meta. Estamos ${formatCurrency(Math.abs(totals.gap))} acima.`
        : `No mês, estamos em ${Math.round(totals.percent)}% da meta. Faltam ${formatCurrency(Math.max(totals.gap, 0))} para o alvo.`;
    return { ...totals, products, families, story };
  }, [horizon, pulse]);

  const sortedProducts = useMemo(() => {
    const rows = [...view.products];
    rows.sort((a, b) => {
      if (productSort.key === "label") {
        const cmp = a.label.localeCompare(b.label, "pt-BR");
        return productSort.dir === "asc" ? cmp : -cmp;
      }
      const av = a[productSort.key];
      const bv = b[productSort.key];
      return productSort.dir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [view.products, productSort]);

  const toggleProductSort = (key: ProductSortKey) => {
    setProductSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "label" ? "asc" : "desc" }
    );
  };

  const ProductSortIcon = ({ column }: { column: ProductSortKey }) => {
    if (productSort.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return productSort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const productChartData = view.products.map((product) => ({
    name: product.label,
    realized: product.realized,
    target: product.target,
    percent: product.percent,
  }));

  const YearTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A2030] border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-euro-gold font-data text-xs mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1 text-xs font-data">
          <div className="flex justify-between gap-6">
            <span className="text-white/50">{data.projected ? "Pace acum." : "Acumulado"}</span>
            <span className="text-white">{data.totalAcc == null ? "—" : formatCurrency(data.totalAcc)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-white/50">Meta acum.</span>
            <span className="text-white">{formatCurrency(data.targetAcc)}</span>
          </div>
          {data.projected ? (
            <p className="pt-1 text-[10px] text-white/35">Projeção pelo ritmo do mês atual</p>
          ) : null}
        </div>
      </div>
    );
  };

  const ProductTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A2030] border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-euro-gold font-data text-xs mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1 text-xs font-data">
          <div className="flex justify-between gap-6">
            <span className="text-white/50">{horizon === "pace" ? "Pace" : "Realizado"}</span>
            <span className="text-white">{formatCurrency(data.realized)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-white/50">Meta</span>
            <span className="text-white">{formatCurrency(data.target)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-euro-gold/8 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-display text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-euro-gold" />
            Onde estamos
          </h3>
          <p className="text-xs text-white/40 font-data mt-1">
            Leitura global da receita frente à meta • {selectedYear}
          </p>
        </div>
        <div className="flex flex-wrap bg-black/20 p-1 rounded-lg border border-white/5">
          {([
            { key: "month", label: "Mês" },
            { key: "year", label: "Ano" },
            { key: "pace", label: "Pace mês" },
            { key: "yearPace", label: "Pace ano" },
          ] as const).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setHorizon(option.key)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-data transition-all uppercase tracking-wider",
                horizon === option.key
                  ? "bg-euro-gold text-black font-bold shadow-lg"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-6">
        <div className="flex items-start gap-3">
          <Target className="w-4 h-4 text-euro-gold mt-0.5 shrink-0" />
          <p className="text-sm text-white/80 font-data leading-relaxed">{view.story}</p>
        </div>
      </div>

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label:
              horizon === "yearPace"
                ? "Pace do ano"
                : horizon === "pace"
                  ? "Pace"
                  : horizon === "year"
                    ? "Acumulado"
                    : "Realizado",
            value: formatCurrency(view.realized),
            color: "text-white",
          },
          {
            label: horizon === "yearPace" ? "Meta cheia" : horizon === "year" ? "Meta YTD" : "Meta do mês",
            value: formatCurrency(view.target),
            color: "text-euro-gold",
          },
          {
            label: "Gap",
            value: `${view.gap > 0 ? "-" : "+"}${formatCurrency(Math.abs(view.gap))}`,
            color: view.gap > 0 ? "text-red-400" : "text-green-400",
          },
          { label: "Atingimento", value: view.target > 0 ? `${Math.round(view.percent)}%` : "—", color: statusColor(view.percent) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] font-data uppercase tracking-widest text-white/40">{card.label}</div>
            <div className={cn("mt-2 text-xl font-display", card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {horizon === "year" && (
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-euro-gold/20 bg-euro-gold/[0.06] p-4">
            <div className="text-[10px] font-data uppercase tracking-widest text-white/40">Meta cheia do ano</div>
            <div className="mt-2 text-lg font-display text-euro-gold">{formatCurrency(pulse.yearTargetFull)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] font-data uppercase tracking-widest text-white/40">% da meta cheia</div>
            <div className={cn("mt-2 text-lg font-display", statusColor((view as any).yearPct || 0))}>
              {Math.round((view as any).yearPct || 0)}%
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] font-data uppercase tracking-widest text-white/40">Pace de fechamento do ano</div>
            <div className="mt-2 text-lg font-display text-white">{formatCurrency(pulse.yearPace)}</div>
          </div>
        </div>
      )}

      <div className="relative grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {view.families.map((family) => (
          <div key={family.key} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-data uppercase tracking-widest text-white/40">{family.label}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: family.color }} />
            </div>
            <div className="mt-2 text-white font-display text-lg">{formatCurrency(family.realized)}</div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full", barColor(family.percent))}
                style={{ width: `${family.target > 0 ? Math.min(Math.max(family.percent, 0), 100) : 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-data">
              <span className="text-white/35">meta {formatCurrency(family.target)}</span>
              <span className={statusColor(family.percent)}>{family.target > 0 ? `${Math.round(family.percent)}%` : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="relative h-[340px] w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          {horizon === "year" || horizon === "yearPace" ? (
            <ComposedChart
              data={horizon === "yearPace" ? pulse.yearPaceChartData : pulse.yearChartData}
              margin={{ top: 16, right: 20, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                tickFormatter={(value) =>
                  Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<YearTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }} />
              {FAMILIES.map((family) => (
                <Bar
                  key={family.key}
                  dataKey={family.key}
                  name={family.label}
                  stackId="rev"
                  fill={family.color}
                  fillOpacity={horizon === "yearPace" ? 0.72 : 0.85}
                />
              ))}
              {horizon === "yearPace" ? (
                <Line
                  type="monotone"
                  dataKey="totalAcc"
                  name="Pace acumulado"
                  stroke="#FAC017"
                  strokeWidth={2}
                  dot={false}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="targetAcc"
                name="Meta acumulada"
                stroke="#FFFFFF"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <ReferenceLine
                y={pulse.yearTargetFull}
                stroke="#FAC017"
                strokeDasharray="2 6"
                strokeOpacity={0.55}
                label={{ value: "Meta cheia", fill: "rgba(250,192,23,0.8)", fontSize: 10, position: "insideTopRight" }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={productChartData} margin={{ top: 16, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} interval={0} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                tickFormatter={(value) =>
                  Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<ProductTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }} />
              <Bar dataKey="realized" name={horizon === "pace" ? "Pace" : "Realizado"} fill="#FAC017" radius={[4, 4, 0, 0]} barSize={18} />
              <Line type="monotone" dataKey="target" name="Meta" stroke="#FFFFFF" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 3, fill: "#11141D", stroke: "#fff" }} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="relative rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-euro-gold" />
          <span className="text-[11px] font-data uppercase tracking-widest text-white/55">
            Produtos •{" "}
            {horizon === "yearPace"
              ? "pace do ano"
              : horizon === "year"
                ? "acumulado do ano"
                : horizon === "pace"
                  ? "pace do mês"
                  : "mês atual"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                {(
                  [
                    { key: "label", label: "Produto", align: "left" },
                    {
                      key: "realized",
                      label: horizon === "yearPace" ? "Pace ano" : horizon === "pace" ? "Pace" : "Realizado",
                      align: "right",
                    },
                    { key: "target", label: "Meta", align: "right" },
                    { key: "percent", label: "Ating.", align: "right" },
                    { key: "gap", label: "Gap", align: "right" },
                  ] as const
                ).map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "sticky top-0 z-20 bg-euro-gold py-4 px-4 font-bold",
                      column.align === "right" && "text-right"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleProductSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 hover:opacity-80",
                        column.align === "right" && "w-full justify-end"
                      )}
                    >
                      {column.label}
                      <ProductSortIcon column={column.key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {sortedProducts.map((product, rowIndex) => {
                const rowBg = rowIndex % 2 === 1 ? "bg-[#141824]" : "bg-[#11141D]";
                return (
                  <tr key={product.key} className={cn("text-xs font-data", rowBg)}>
                    <td className="py-3 px-4 text-white/85">{product.label}</td>
                    <td className="py-3 px-4 text-right text-white">{formatCurrency(product.realized)}</td>
                    <td className="py-3 px-4 text-right text-white/55">{formatCurrency(product.target)}</td>
                    <td className={cn("py-3 px-4 text-right", statusColor(product.percent))}>
                      {product.target > 0 ? `${Math.round(product.percent)}%` : "—"}
                    </td>
                    <td className={cn("py-3 px-4 text-right", product.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {product.gap > 0 ? "-" : "+"}
                      {formatCurrency(Math.abs(product.gap))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
