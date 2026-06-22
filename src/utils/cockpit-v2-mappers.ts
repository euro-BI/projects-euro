import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssessorResumo } from "@/types/dashboard";

export const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
export const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

type MetricType = "funding" | "allocation" | "variable" | "banking" | "insurance";
type DisplayMode = "meta" | "proportional" | "pace";

const METRIC_CONFIG: Record<MetricType, { fields: string[]; targetField?: keyof AssessorResumo; isRoaBased: boolean; roaTarget?: number }> = {
  funding: { fields: ["captacao_liquida_total"], targetField: "meta_captacao", isRoaBased: false },
  allocation: { label: "Alocacao", fields: ["receita_renda_fixa", "asset_m_1", "receita_previdencia", "receita_cetipados", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receitas_offshore"], isRoaBased: true, roaTarget: 0.0015 + 0.0002 + 0.0001 + 0.0005 + 0.0010 + 0.0002 } as any,
  variable: { fields: ["receitas_estruturadas", "receita_b3"], isRoaBased: true, roaTarget: 0.0035 + 0.0020 },
  banking: { fields: ["receita_consorcios", "receita_compromissadas", "receita_cambio"], isRoaBased: true, roaTarget: 0.0009 + 0.0001 + 0.0001 },
  insurance: { fields: ["receita_seguros"], isRoaBased: true, roaTarget: 0.0007 },
};

const PRODUCT_METRICS = {
  investimentos: [
    { label: "R. Fixa", fields: ["receita_renda_fixa"], roa: 0.0015 },
    { label: "Asset", fields: ["asset_m_1"], roa: 0.0002 },
    { label: "Previd.", fields: ["receita_previdencia"], roa: 0.0001 },
    { label: "Cetipados", fields: ["receita_cetipados"], roa: 0.0005 },
    { label: "Ofertas", fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"], roa: 0.0010 },
    { label: "Offshore", fields: ["receitas_offshore"], roa: 0.0002 },
    { label: "Estruturas", fields: ["receitas_estruturadas"], roa: 0.0035 },
    { label: "B3", fields: ["receita_b3"], roa: 0.0020 },
  ],
  cross_sell: [
    { label: "Consor.", fields: ["receita_consorcios"], roa: 0.0009 },
    { label: "Comprom.", fields: ["receita_compromissadas"], roa: 0.0001 },
    { label: "Cambio", fields: ["receita_cambio"], roa: 0.0001 },
    { label: "Seguros", fields: ["receita_seguros"], roa: 0.0007 },
  ],
};

export type CockpitV2FiltersData = {
  allMonths: string[];
  years: string[];
  teams: string[];
  assessors: { id: string; name: string; teams: string[] }[];
  teamLogoMap?: Map<string, string | null>;
  referenceDateISO?: string | null;
};

export type RankingSummary = {
  position: number;
  points: number;
  totalAssessors: number;
  assessorName: string;
  fotoUrl?: string | null;
} | null;

export type KPIBlock = {
  realized: number;
  target: number;
  percent: number;
  gap: number;
};

export type ProductRow = KPIBlock & {
  label: string;
};

export type CockpitV2Kpis = {
  funding: KPIBlock;
  invest: KPIBlock & { products: ProductRow[] };
  cs: KPIBlock & { products: ProductRow[] };
  global: KPIBlock;
} | null;

export type CockpitV2ChartPoint = {
  monthKey: string;
  monthLabel: string;
  realized: number;
  target: number;
  gap: number;
};

export type RevenueViewKey = "total" | "investimentos" | "cross_sell" | "captação";

export type CaptureAnalysisPoint = {
  monthKey: string;
  monthLabel: string;
  entries: number;
  exits: number;
  transfersIn: number;
  transfersOut: number;
  incomingFlow: number;
  outgoingFlow: number;
  net: number;
};

export type CockpitV2TopMetric = {
  id: string;
  label: string;
  value: string;
  support: string;
  tone: "gold" | "green" | "blue" | "magenta" | "neutral";
};

export const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const formatCurrencyCompact = (value: number) => {
  const absVal = Math.abs(value);
  if (absVal >= 1000000) {
    return `R$ ${(value / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`;
  }
  return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} K`;
};

export const formatPercent = (value: number, digits = 0) => `${value.toFixed(digits)}%`;

const REVENUE_SERIES_CONFIG: Record<
  RevenueViewKey,
  { label: string; fields: string[]; roaTarget?: number; useFundingTarget?: boolean }
> = {
  total: {
    label: "Receita Total",
    fields: [
      "receita_renda_fixa",
      "asset_m_1",
      "receita_previdencia",
      "receita_cetipados",
      "receitas_ofertas_fundos",
      "receitas_ofertas_rf",
      "receitas_offshore",
      "receitas_estruturadas",
      "receita_b3",
      "receita_consorcios",
      "receita_compromissadas",
      "receita_cambio",
      "receita_seguros",
    ],
    roaTarget: 0.0108,
  },
  investimentos: {
    label: "Investimentos",
    fields: [
      "receita_renda_fixa",
      "asset_m_1",
      "receita_previdencia",
      "receita_cetipados",
      "receitas_ofertas_fundos",
      "receitas_ofertas_rf",
      "receitas_offshore",
      "receitas_estruturadas",
      "receita_b3",
    ],
    roaTarget: 0.0089,
  },
  cross_sell: {
    label: "Cross-Sell",
    fields: ["receita_consorcios", "receita_compromissadas", "receita_cambio", "receita_seguros"],
    roaTarget: 0.0018,
  },
  captação: {
    label: "Captação Líquida",
    fields: ["captacao_liquida_total"],
    useFundingTarget: true,
  },
};

const getProgressiveValue = (
  value: number,
  displayMode: DisplayMode,
  currentData: AssessorResumo[],
  referenceDate: Date
) => {
  if (displayMode !== "pace" || !currentData.length || !currentData[0].data_posicao) return value;

  try {
    const dataDate = parseISO(currentData[0].data_posicao);
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) return value;

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    const totalDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
    const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter((d) => !isWeekend(d)).length;
    const passedDays = Math.max(1, rawPassedDays - 2);
    return totalDays > 0 ? (value / passedDays) * totalDays : value;
  } catch {
    return value;
  }
};

const getProportionalTarget = (
  target: number,
  displayMode: DisplayMode,
  currentData: AssessorResumo[],
  referenceDate: Date
) => {
  if (displayMode !== "proportional" || !currentData.length || !currentData[0].data_posicao) return target;

  try {
    const dataDate = parseISO(currentData[0].data_posicao);
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) return target;

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    const totalDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
    const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter((d) => !isWeekend(d)).length;
    const passedDays = Math.max(1, rawPassedDays - 2);
    return totalDays > 0 ? (target / totalDays) * passedDays : target;
  } catch {
    return target;
  }
};

export const buildRankingSummary = (
  rankingData: AssessorResumo[] | undefined,
  assessorCode: string
): RankingSummary => {
  if (!rankingData?.length || assessorCode === "all") return null;

  const filtered = rankingData.filter((d) => {
    if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null") return false;
    if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
    if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, AssessorResumo & { pontos_total: number }>>((acc, curr) => {
    if (!acc[curr.cod_assessor]) {
      acc[curr.cod_assessor] = { ...curr, pontos_total: 0 };
    }
    acc[curr.cod_assessor].pontos_total += curr.pontos_total || 0;
    return acc;
  }, {});

  const sorted = Object.values(grouped).sort((a, b) => b.pontos_total - a.pontos_total);
  const index = sorted.findIndex((item) => item.cod_assessor === assessorCode);
  if (index === -1) return null;

  const item = sorted[index];
  return {
    position: index + 1,
    points: item.pontos_total,
    totalAssessors: sorted.length,
    assessorName: item.nome_assessor,
    fotoUrl: item.foto_url,
  };
};

export const buildKpis = (
  currentData: AssessorResumo[] | undefined,
  displayMode: DisplayMode,
  referenceDate: Date
): CockpitV2Kpis => {
  if (!currentData?.length) return null;

  const custodyTotal = currentData.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);

  const calculateMetric = (type: MetricType): KPIBlock => {
    const config = METRIC_CONFIG[type];
    const rawRealized = currentData.reduce((acc, curr) => {
      const sum = config.fields.reduce((fieldAcc, field) => fieldAcc + ((curr as any)[field] || 0), 0);
      return acc + sum;
    }, 0);

    const realized = getProgressiveValue(rawRealized, displayMode, currentData, referenceDate);
    let target = 0;

    if (config.isRoaBased) target = (custodyTotal * (config.roaTarget || 0)) / 12;
    else target = currentData.reduce((acc, curr) => acc + ((curr as any)[config.targetField!] || 0), 0);

    target = getProportionalTarget(target, displayMode, currentData, referenceDate);
    const percent = target > 0 ? (realized / target) * 100 : 0;
    return { realized, target, percent, gap: target - realized };
  };

  const calculateProductMetrics = (products: typeof PRODUCT_METRICS.investimentos): ProductRow[] =>
    products.map((product) => {
      const rawRealized = currentData.reduce((acc, curr) => {
        const sum = product.fields.reduce((fieldAcc, field) => fieldAcc + ((curr as any)[field] || 0), 0);
        return acc + sum;
      }, 0);

      const realized = getProgressiveValue(rawRealized, displayMode, currentData, referenceDate);
      const target = getProportionalTarget((custodyTotal * product.roa) / 12, displayMode, currentData, referenceDate);
      const percent = target > 0 ? (realized / target) * 100 : 0;

      return { label: product.label, realized, target, percent, gap: target - realized };
    });

  const funding = calculateMetric("funding");
  const allocation = calculateMetric("allocation");
  const variable = calculateMetric("variable");
  const banking = calculateMetric("banking");
  const insurance = calculateMetric("insurance");

  const investBase = { realized: allocation.realized + variable.realized, target: allocation.target + variable.target };
  const csBase = { realized: banking.realized + insurance.realized, target: banking.target + insurance.target };
  const globalBase = { realized: investBase.realized + csBase.realized, target: investBase.target + csBase.target };

  return {
    funding,
    invest: {
      ...investBase,
      percent: investBase.target > 0 ? (investBase.realized / investBase.target) * 100 : 0,
      gap: investBase.target - investBase.realized,
      products: calculateProductMetrics(PRODUCT_METRICS.investimentos),
    },
    cs: {
      ...csBase,
      percent: csBase.target > 0 ? (csBase.realized / csBase.target) * 100 : 0,
      gap: csBase.target - csBase.realized,
      products: calculateProductMetrics(PRODUCT_METRICS.cross_sell),
    },
    global: {
      ...globalBase,
      percent: globalBase.target > 0 ? (globalBase.realized / globalBase.target) * 100 : 0,
      gap: globalBase.target - globalBase.realized,
    },
  };
};

export const buildRevenueChartData = (
  yearlyData: AssessorResumo[] | undefined,
  view: RevenueViewKey = "total"
): CockpitV2ChartPoint[] => {
  if (!yearlyData?.length) return [];

  const config = REVENUE_SERIES_CONFIG[view];

  const grouped = yearlyData.reduce<
    Record<string, { monthKey: string; monthLabel: string; realized: number; custody: number; fundingTarget: number }>
  >((acc, curr) => {
    if (!curr.data_posicao) return acc;

    try {
      const parsed = parseISO(curr.data_posicao);
      const monthKey = format(parsed, "yyyy-MM");
      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthLabel: format(parsed, "MMM", { locale: ptBR }).toUpperCase(),
          realized: 0,
          custody: 0,
          fundingTarget: 0,
        };
      }

      acc[monthKey].realized += config.fields.reduce((sum, field) => sum + ((curr as any)[field] || 0), 0);
      acc[monthKey].custody += curr.custodia_net || 0;
      acc[monthKey].fundingTarget += curr.meta_captacao || 0;
    } catch {
      return acc;
    }

    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((item) => {
      const target = config.useFundingTarget ? item.fundingTarget : (item.custody * (config.roaTarget || 0)) / 12;
      return { monthKey: item.monthKey, monthLabel: item.monthLabel, realized: item.realized, target, gap: target - item.realized };
    });
};

export const buildCaptureAnalysisData = (yearlyData: AssessorResumo[] | undefined): CaptureAnalysisPoint[] => {
  if (!yearlyData?.length) return [];

  const grouped = yearlyData.reduce<Record<string, CaptureAnalysisPoint>>((acc, curr) => {
    if (!curr.data_posicao) return acc;

    try {
      const parsed = parseISO(curr.data_posicao);
      const monthKey = format(parsed, "yyyy-MM");
      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthLabel: format(parsed, "MMM", { locale: ptBR }).toUpperCase(),
          entries: 0,
          exits: 0,
          transfersIn: 0,
          transfersOut: 0,
          incomingFlow: 0,
          outgoingFlow: 0,
          net: 0,
        };
      }

      acc[monthKey].entries += curr.captacao_entradas || 0;
      acc[monthKey].exits += curr.captacao_saidas || 0;
      acc[monthKey].transfersIn += curr.captacao_entrada_transf || 0;
      acc[monthKey].transfersOut += curr.captacao_saida_transf || 0;
      acc[monthKey].incomingFlow += (curr.captacao_entradas || 0) + (curr.captacao_entrada_transf || 0);
      acc[monthKey].outgoingFlow += -((curr.captacao_saidas || 0) + (curr.captacao_saida_transf || 0));
      acc[monthKey].net += curr.captacao_liquida_total || 0;
    } catch {
      return acc;
    }

    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
};

export const buildTopMetrics = (currentData: AssessorResumo[] | undefined): CockpitV2TopMetric[] => {
  if (!currentData?.length) return [];

  const totalClients = currentData.reduce((acc, curr) => acc + (curr.total_clientes || 0), 0);
  const receitaTotal = currentData.reduce((acc, curr) => acc + (curr.receita_total || 0), 0);
  const custodyTotal = currentData.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);
  const fundingTotal = currentData.reduce((acc, curr) => acc + (curr.captacao_liquida_total || 0), 0);
  const fundingMeta = currentData.reduce((acc, curr) => acc + (curr.meta_captacao || 0), 0);
  const activation300k = currentData.reduce((acc, curr) => acc + (curr.ativacao_300k || 0) + (curr.ativacao_1kk || 0), 0);
  const activationMeta = currentData.reduce((acc, curr) => acc + (curr.meta_ativacao_300k || 0), 0);
  const repasseTotal = currentData.reduce((acc, curr) => acc + (curr.repasse_total || 0), 0);
  const roaTotal = custodyTotal > 0 ? (receitaTotal / custodyTotal) * 100 : 0;
  const fundingPercent = fundingMeta > 0 ? (fundingTotal / fundingMeta) * 100 : 0;

  return [
    { id: "clientes", label: "Clientes Ativos", value: `${totalClients}`, support: `${currentData.length} linha(s) no recorte`, tone: "blue" },
    { id: "receita", label: "Receita Total", value: formatCurrencyCompact(receitaTotal), support: `Meta ${formatCurrencyCompact(currentData.reduce((acc, curr) => acc + (curr.meta_receita || 0), 0))}`, tone: "gold" },
    { id: "custodia", label: "Custodia", value: formatCurrencyCompact(custodyTotal), support: `ROA total ${roaTotal.toFixed(2)}%`, tone: "neutral" },
    { id: "captacao", label: "Captacao Liquida", value: formatCurrencyCompact(fundingTotal), support: `${formatPercent(fundingPercent, 1)} da meta`, tone: "green" },
    { id: "ativacoes", label: "Ativacoes 300k+", value: `${activation300k}`, support: `Meta ${activationMeta}`, tone: "magenta" },
    { id: "repasse", label: "Repasse Total", value: formatCurrencyCompact(repasseTotal), support: `Base auditavel do mes`, tone: "neutral" },
  ];
};

export const getGaugeTone = (percent: number) => {
  if (percent >= 100) return { text: "text-emerald-400", line: "#22C55E", bar: "bg-emerald-400" };
  if (percent >= 70) return { text: "text-euro-gold", line: "#FAC017", bar: "bg-euro-gold" };
  return { text: "text-rose-400", line: "#FB7185", bar: "bg-rose-400" };
};
