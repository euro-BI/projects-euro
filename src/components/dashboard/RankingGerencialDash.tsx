import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AssessorResumo } from "@/types/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  XCircle
} from "lucide-react";
import { addMonths, format } from "date-fns";

type ProductKey = "renda_variavel" | "allocation" | "banco" | "seguros";

const BLOCKED_TEAMS = new Set(["OPERACIONAIS", "ADVISORS", "ANYWHERE"]);
const BLOCKED_ASSESSORS = new Set(["A1607", "A26969"]);
const ROA_RV_TARGET = 0.0055;
const CREDITO_ANUAL_TARGET = 1_000_000;
const CREDITO_MENSAL_TARGET = CREDITO_ANUAL_TARGET / 12;
const ABERTURA_PJ_ANUAL_TARGET = 50;
const ABERTURA_PJ_MENSAL_TARGET = ABERTURA_PJ_ANUAL_TARGET / 12;
const SEGUROS_RECEITA_ANUAL_TARGET = 1_000_000;
const SEGUROS_RECEITA_MENSAL_TARGET = SEGUROS_RECEITA_ANUAL_TARGET / 12;
const SEGUROS_APOLICES_ANUAL_TARGET = 150;
const SEGUROS_APOLICES_MENSAL_TARGET = SEGUROS_APOLICES_ANUAL_TARGET / 12;

type KPI = {
  key: string;
  label: string;
  weight: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCount(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const raw = String(dateStr);
  const datePart = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("-").map((n) => Number(n));
    const localDate = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("pt-BR").format(localDate);
  }
  return new Intl.DateTimeFormat("pt-BR").format(new Date(raw));
}

function monthStartFromKey(key: string) {
  const [y, m] = key.split("-").map((n) => Number(n));
  return new Date(y, m - 1, 1);
}

function formatMonthKey(key: string | null | undefined) {
  if (!key) return "—";
  if (!/^\d{4}-\d{2}$/.test(key)) return "—";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(monthStartFromKey(key));
}

type ProductConfig = {
  key: ProductKey;
  label: string;
  short: string;
  kpis: KPI[];
};

const PRODUCTS: ProductConfig[] = [
  {
    key: "renda_variavel",
    label: "Renda Variável",
    short: "RV",
    kpis: [
      { key: "pen_aai_pe", label: "Penetração AAI|PE", weight: 0.3 },
      { key: "pen_clientes", label: "Penetração Clientes", weight: 0.3 },
      { key: "roa_rv", label: "ROA RV B3+PE", weight: 0.4 },
    ],
  },
  {
    key: "allocation",
    label: "Alocação (dados fictícios)",
    short: "AL",
    kpis: [
      { key: "pen_ai_3s", label: "% Penetração AIs 3★", weight: 0.3 },
      { key: "pen_clientes_3s", label: "% Penetração Clientes 3★", weight: 0.2 },
      { key: "roa_geral", label: "ROA Geral", weight: 0.5 },
    ],
  },
  {
    key: "banco",
    label: "Banco",
    short: "BK",
    kpis: [
      { key: "pen_credito", label: "Penetração AAI Crédito", weight: 0.3 },
      { key: "receita_credito", label: "Receita em Crédito", weight: 0.5 },
      { key: "abertura_pj", label: "Abertura Contas PJ", weight: 0.2 },
    ],
  },
  {
    key: "seguros",
    label: "Seguros",
    short: "SG",
    kpis: [
      { key: "pen_seguros", label: "Penetração AAI Seguros", weight: 0.3 },
      { key: "receita", label: "Receita", weight: 0.5 },
      { key: "apolices", label: "Qtd Apólices vendidas", weight: 0.2 },
    ],
  },
];

const COLORS = {
  success: "#1D9E75",
  warn: "#BA7517",
  danger: "#E24B4A",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function scoreTone(score: number) {
  if (score >= 70) return "success";
  if (score >= 50) return "warn";
  return "danger";
}

function teamTone(score: number) {
  if (score >= 70) return "success";
  if (score >= 55) return "warn";
  return "danger";
}

function toneColor(tone: "success" | "warn" | "danger") {
  if (tone === "success") return COLORS.success;
  if (tone === "warn") return COLORS.warn;
  return COLORS.danger;
}

type ProductScore = {
  score: number;
  kpis: Array<KPI & { value: number; displayValue?: number }>;
};

type AssessorRanking = {
  id: string;
  name: string;
  team: string;
  fotoUrl?: string | null;
  enps: number;
  products: Record<ProductKey, ProductScore>;
  pontosValidos: number;
  overall: number;
  badge: "Elegível" | "Em risco" | "Não elegível";
};

function computeAssessorRanking(a: AssessorResumo, salt: string): AssessorRanking {
  const seed = hashString(`${a.cod_assessor}:${salt}:${a.time}:${a.nome_assessor}`);
  const rng = mulberry32(seed);
  const enps = 100;

  const products = PRODUCTS.reduce((acc, p) => {
    const kpisWithValues = p.kpis.map((kpi) => {
      const value = clamp(40 + rng() * 65, 40, 105);
      return { ...kpi, value };
    });
    const score = kpisWithValues.reduce((s, k) => s + k.value * k.weight, 0);
    acc[p.key] = { score, kpis: kpisWithValues };
    return acc;
  }, {} as Record<ProductKey, ProductScore>);

  const rawOverall =
    (products.renda_variavel.score +
      products.allocation.score +
      products.banco.score +
      products.seguros.score) /
    4;

  const overall = enps < 80 ? rawOverall * 0.8 : rawOverall;

  let badge: AssessorRanking["badge"] = "Não elegível";
  if (rawOverall >= 70 && enps >= 80) badge = "Elegível";
  else if (rawOverall >= 55) badge = "Em risco";

  return {
    id: a.cod_assessor,
    name: a.nome_assessor,
    team: a.time || "Sem time",
    fotoUrl: a.foto_url,
    enps,
    products,
    pontosValidos: rawOverall,
    overall,
    badge,
  };
}

function BadgePill({ label, tone }: { label: string; tone: "success" | "warn" | "danger" }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
      style={{
        borderColor: `${toneColor(tone)}55`,
        background: `${toneColor(tone)}18`,
        color: toneColor(tone),
      }}
    >
      {label}
    </span>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: "success" | "warn" | "danger" }) {
  const v = clamp(value, 0, 110);
  return (
    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden" role="img" aria-label={`Progresso ${fmtPct(v)}`}>
      <div
        className="h-full rounded-full transition-all duration-150 ease-out"
        style={{ width: `${v}%`, background: toneColor(tone) }}
      />
    </div>
  );
}

function Donut({
  value,
  tone,
  label,
}: {
  value: number;
  tone: "success" | "warn" | "danger";
  label: string;
}) {
  const size = 44;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const v = clamp(value, 0, 110);
  const progress = v / 110;
  const dashOffset = circumference * (1 - progress);
  return (
    <div className="relative h-[44px] w-[44px]" role="img" aria-label={`${label} ${fmtPct(v)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor(tone)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 150ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-data uppercase tracking-widest text-white/70">
          {Math.round(v)}
        </span>
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const tone = scoreTone(value);
  const Icon = tone === "success" ? CheckCircle2 : tone === "warn" ? AlertCircle : XCircle;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-data uppercase tracking-widest hover:brightness-110 transition-[filter] duration-150 ease-out"
      style={{
        borderColor: `${toneColor(tone)}55`,
        background: `${toneColor(tone)}18`,
        color: toneColor(tone),
      }}
    >
      <Icon className="w-3.5 h-3.5" aria-label={label} />
      <span className="whitespace-nowrap">{label}</span>
      <span className="font-semibold">{fmtPct(value)}</span>
    </button>
  );
}

export default function RankingGerencialDash({
  data,
  selectedMonthLabel,
}: {
  data: AssessorResumo[];
  selectedMonthLabel?: string;
}) {
  const salt = selectedMonthLabel ?? "all";
  const selectedMonthKey = useMemo(() => {
    if (!selectedMonthLabel) return "";
    return selectedMonthLabel.substring(0, 7);
  }, [selectedMonthLabel]);
  const selectedMonthStart = useMemo(() => {
    if (!selectedMonthKey) return null;
    return monthStartFromKey(selectedMonthKey);
  }, [selectedMonthKey]);
  const selectedYearKey = useMemo(() => {
    if (!selectedMonthKey) return "";
    return selectedMonthKey.slice(0, 4);
  }, [selectedMonthKey]);

  const assessorCodes = useMemo(() => {
    const isAllowed = (d: AssessorResumo) => {
      const cod = String(d.cod_assessor ?? "").trim();
      const team = String(d.time ?? "").trim().toUpperCase();
      if (!cod) return false;
      if (BLOCKED_ASSESSORS.has(cod)) return false;
      if (team && BLOCKED_TEAMS.has(team)) return false;
      return true;
    };
    return Array.from(
      new Set((data || []).filter(isAllowed).map((d) => String(d.cod_assessor).trim()).filter(Boolean))
    );
  }, [data]);

  const { data: clientesPosicaoRv, isLoading: isLoadingClientesPosicaoRv } = useQuery({
    queryKey: ["ranking-gerencial-rv-clientes-posicao", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const start = `${selectedMonthKey}-01`;
      const next = format(addMonths(new Date(`${selectedMonthKey}-01T00:00:00`), 1), "yyyy-MM-01");
      let query = supabase
        .from("vw_resumo_clientes_posicao" as any)
        .select("cod_cliente, nome_cliente, cod_assessor, nome_assessor, net_em_m, data_ultima_operacao, comissao_ultima_operacao")
        .gte("data_ultima_operacao", start)
        .lt("data_ultima_operacao", next)
        .in("cod_assessor", assessorCodes);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: consorciosCreditoPen, isLoading: isLoadingConsorciosCreditoPen } = useQuery({
    queryKey: ["ranking-gerencial-banco-pen-credito", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const start = `${selectedMonthKey}-01`;
      const next = format(addMonths(new Date(`${selectedMonthKey}-01T00:00:00`), 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("vw_penetracao_aai_credito_consorcio" as any)
        .select("cod_assessor, competencia, data_venda, cliente, contrato, grupo, cota, administradora, produto, valor_carta, valor_comissao_total")
        .gte("competencia", start)
        .lt("competencia", next)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: consorciosCreditoSales, isLoading: isLoadingConsorciosCreditoSales } = useQuery({
    queryKey: ["ranking-gerencial-banco-pen-credito-sales", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const monthStart = monthStartFromKey(selectedMonthKey);
      const start = format(addMonths(monthStart, -18), "yyyy-MM-01");
      const next = format(addMonths(monthStart, 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("dados_consorcio" as any)
        .select("cod_assessor, data_venda, cliente, contrato, grupo, cota, administradora, produto, valor_carta, valor_comissao_total, data_cancelamento")
        .gte("data_venda", start)
        .lt("data_venda", next)
        .is("data_cancelamento", null)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: consorciosCreditoSalesYear, isLoading: isLoadingConsorciosCreditoSalesYear } = useQuery({
    queryKey: ["ranking-gerencial-banco-receita-credito-sales-year", selectedYearKey, assessorCodes.join("|")],
    enabled: !!selectedYearKey && assessorCodes.length > 0,
    queryFn: async () => {
      const start = `${selectedYearKey}-01-01`;
      const end = `${selectedYearKey}-12-31`;

      const { data, error } = await supabase
        .from("dados_consorcio" as any)
        .select("cod_assessor, data_venda, valor_carta, data_cancelamento")
        .gte("data_venda", start)
        .lte("data_venda", end)
        .is("data_cancelamento", null)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: ativacoesPjMonth, isLoading: isLoadingAtivacoesPjMonth } = useQuery({
    queryKey: ["ranking-gerencial-banco-ativacoes-pj-month", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const start = `${selectedMonthKey}-01`;
      const next = format(addMonths(new Date(`${selectedMonthKey}-01T00:00:00`), 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("detalhamento_ativacoes_pj" as any)
        .select("data_posicao, cod_assessor, cliente, tipo_ativacao, net_original")
        .gte("data_posicao", start)
        .lt("data_posicao", next)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: ativacoesPjYear, isLoading: isLoadingAtivacoesPjYear } = useQuery({
    queryKey: ["ranking-gerencial-banco-ativacoes-pj-year", selectedYearKey, assessorCodes.join("|")],
    enabled: !!selectedYearKey && assessorCodes.length > 0,
    queryFn: async () => {
      const start = `${selectedYearKey}-01-01`;
      const end = `${selectedYearKey}-12-31`;

      const { data, error } = await supabase
        .from("detalhamento_ativacoes_pj" as any)
        .select("data_posicao, cod_assessor, cliente, tipo_ativacao, net_original")
        .gte("data_posicao", start)
        .lte("data_posicao", end)
        .in("cod_assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: segurosWindowRows, isLoading: isLoadingSegurosWindow } = useQuery({
    queryKey: ["ranking-gerencial-seguros-window", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const monthStart = monthStartFromKey(selectedMonthKey);
      const start = format(addMonths(monthStart, -2), "yyyy-MM-01");
      const next = format(addMonths(monthStart, 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("vw_seguros" as any)
        .select("assessor, inscricao, cliente, periodicidade, seguradora, parcela, valor_comissao, data_inicio_seguro")
        .gte("data_inicio_seguro", start)
        .lt("data_inicio_seguro", next)
        .in("assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: segurosYearRows, isLoading: isLoadingSegurosYear } = useQuery({
    queryKey: ["ranking-gerencial-seguros-year", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const monthStart = monthStartFromKey(selectedMonthKey);
      const yearStart = format(new Date(monthStart.getFullYear(), 0, 1), "yyyy-MM-dd");
      const next = format(addMonths(monthStart, 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("vw_seguros" as any)
        .select("assessor, inscricao, cliente, periodicidade, seguradora, parcela, valor_comissao, data_inicio_seguro")
        .gte("data_inicio_seguro", yearStart)
        .lt("data_inicio_seguro", next)
        .in("assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: segurosHistoryRows, isLoading: isLoadingSegurosHistory } = useQuery({
    queryKey: ["ranking-gerencial-seguros-history", selectedMonthKey, assessorCodes.join("|")],
    enabled: !!selectedMonthKey && assessorCodes.length > 0,
    queryFn: async () => {
      const monthStart = monthStartFromKey(selectedMonthKey);
      const start = format(addMonths(monthStart, -18), "yyyy-MM-01");
      const next = format(addMonths(monthStart, 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("vw_seguros" as any)
        .select("assessor, inscricao, cliente, periodicidade, seguradora, parcela, valor_comissao, data_inicio_seguro")
        .gte("data_inicio_seguro", start)
        .lt("data_inicio_seguro", next)
        .in("assessor", assessorCodes);

      if (error) throw error;
      return data as any[];
    },
  });

  const assessoresComCredito = useMemo(() => {
    const set = new Set<string>();
    (consorciosCreditoPen || []).forEach((row: any) => {
      const cod = String(row?.cod_assessor ?? "").trim();
      if (!cod) return;
      set.add(cod);
    });
    return set;
  }, [consorciosCreditoPen]);

  const creditoSalesByAssessor = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        cod_assessor: string;
        data_venda: string | null;
        cliente: string;
        contrato: string;
        grupo: string;
        cota: string;
        administradora: string;
        produto: string;
        valor_carta: number;
        valor_comissao_total: number;
      }>
    >();
    (consorciosCreditoSales || []).forEach((row: any) => {
      const cod = String(row?.cod_assessor ?? "").trim();
      if (!cod) return;
      if (!map.has(cod)) map.set(cod, []);
      map.get(cod)!.push({
        cod_assessor: cod,
        data_venda: (row?.data_venda ?? null) as string | null,
        cliente: String(row?.cliente ?? "").trim(),
        contrato: String(row?.contrato ?? "").trim(),
        grupo: String(row?.grupo ?? "").trim(),
        cota: String(row?.cota ?? "").trim(),
        administradora: String(row?.administradora ?? "").trim(),
        produto: String(row?.produto ?? "").trim(),
        valor_carta: Number(row?.valor_carta ?? 0),
        valor_comissao_total: Number(row?.valor_comissao_total ?? 0),
      });
    });
    for (const [, list] of map.entries()) {
      list.sort((a, b) => String(b.data_venda ?? "").localeCompare(String(a.data_venda ?? "")));
    }
    return map;
  }, [consorciosCreditoSales]);

  const creditoValorCartaByAssessor = useMemo(() => {
    const byYear = new Map<string, number>();
    const byMonth = new Map<string, number>();

    (consorciosCreditoSalesYear || []).forEach((row: any) => {
      const cod = String(row?.cod_assessor ?? "").trim();
      if (!cod) return;
      const valor = Number(row?.valor_carta ?? 0) || 0;
      byYear.set(cod, (byYear.get(cod) || 0) + valor);

      const vendaKey = String(row?.data_venda ?? "").slice(0, 7);
      if (vendaKey && vendaKey === selectedMonthKey) {
        byMonth.set(cod, (byMonth.get(cod) || 0) + valor);
      }
    });

    return { byYear, byMonth };
  }, [consorciosCreditoSalesYear, selectedMonthKey]);

  const ativacoesPjByAssessor = useMemo(() => {
    const byYear = new Map<string, number>();
    const byMonth = new Map<string, number>();

    (ativacoesPjYear || []).forEach((row: any) => {
      const cod = String(row?.cod_assessor ?? "").trim();
      if (!cod) return;
      byYear.set(cod, (byYear.get(cod) || 0) + 1);
    });

    (ativacoesPjMonth || []).forEach((row: any) => {
      const cod = String(row?.cod_assessor ?? "").trim();
      if (!cod) return;
      byMonth.set(cod, (byMonth.get(cod) || 0) + 1);
    });

    return { byYear, byMonth };
  }, [ativacoesPjYear, ativacoesPjMonth]);

  const assessoresComSeguros = useMemo(() => {
    const set = new Set<string>();
    (segurosWindowRows || []).forEach((row: any) => {
      const cod = String(row?.assessor ?? row?.cod_assessor ?? "").trim();
      if (!cod) return;
      set.add(cod);
    });
    return set;
  }, [segurosWindowRows]);

  const segurosByAssessor = useMemo(() => {
    const receitaByYear = new Map<string, number>();
    const receitaByMonth = new Map<string, number>();
    const apolicesByYear = new Map<string, number>();
    const apolicesByMonth = new Map<string, number>();

    (segurosYearRows || []).forEach((row: any) => {
      const cod = String(row?.assessor ?? row?.cod_assessor ?? "").trim();
      if (!cod) return;
      const mk = String(row?.data_inicio_seguro ?? "").slice(0, 7);
      const parcela = parseNumber(row?.parcela);

      receitaByYear.set(cod, (receitaByYear.get(cod) || 0) + parcela);
      apolicesByYear.set(cod, (apolicesByYear.get(cod) || 0) + 1);

      if (mk && mk === selectedMonthKey) {
        receitaByMonth.set(cod, (receitaByMonth.get(cod) || 0) + parcela);
        apolicesByMonth.set(cod, (apolicesByMonth.get(cod) || 0) + 1);
      }
    });

    return { receitaByYear, receitaByMonth, apolicesByYear, apolicesByMonth };
  }, [segurosYearRows, selectedMonthKey]);

  const segurosHistoryByAssessor = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        assessor: string;
        inscricao: string;
        cliente: string;
        periodicidade: string;
        seguradora: string;
        parcela: number;
        valor_comissao: number;
        data_inicio_seguro: string | null;
      }>
    >();

    (segurosHistoryRows || []).forEach((row: any) => {
      const cod = String(row?.assessor ?? row?.cod_assessor ?? "").trim();
      if (!cod) return;
      if (!map.has(cod)) map.set(cod, []);
      map.get(cod)!.push({
        assessor: cod,
        inscricao: String(row?.inscricao ?? "").trim(),
        cliente: String(row?.cliente ?? "").trim(),
        periodicidade: String(row?.periodicidade ?? "").trim(),
        seguradora: String(row?.seguradora ?? "").trim(),
        parcela: parseNumber(row?.parcela),
        valor_comissao: parseNumber(row?.valor_comissao),
        data_inicio_seguro: (row?.data_inicio_seguro ?? null) as string | null,
      });
    });

    for (const [, list] of map.entries()) {
      list.sort((a, b) =>
        String(b.data_inicio_seguro ?? "").localeCompare(String(a.data_inicio_seguro ?? ""))
      );
    }

    return map;
  }, [segurosHistoryRows]);

  const ativacoesPjMonthRows = useMemo(() => {
    return (ativacoesPjMonth || [])
      .map((row: any) => {
        const cod = String(row?.cod_assessor ?? "").trim();
        const cliente = String(row?.cliente ?? "").trim();
        if (!cod || !cliente) return null;
        if (!assessorCodes.includes(cod)) return null;
        return {
          data_posicao: row?.data_posicao as string | null,
          cod_assessor: cod,
          cliente,
          tipo_ativacao: String(row?.tipo_ativacao ?? "").trim(),
          net_original: Number(row?.net_original ?? 0),
        };
      })
      .filter(Boolean) as Array<{
      data_posicao: string | null;
      cod_assessor: string;
      cliente: string;
      tipo_ativacao: string;
      net_original: number;
    }>;
  }, [ativacoesPjMonth, assessorCodes]);

  const ativacoesPjYearRows = useMemo(() => {
    return (ativacoesPjYear || [])
      .map((row: any) => {
        const cod = String(row?.cod_assessor ?? "").trim();
        const cliente = String(row?.cliente ?? "").trim();
        if (!cod || !cliente) return null;
        if (!assessorCodes.includes(cod)) return null;
        return {
          data_posicao: row?.data_posicao as string | null,
          cod_assessor: cod,
          cliente,
          tipo_ativacao: String(row?.tipo_ativacao ?? "").trim(),
          net_original: Number(row?.net_original ?? 0),
        };
      })
      .filter(Boolean) as Array<{
      data_posicao: string | null;
      cod_assessor: string;
      cliente: string;
      tipo_ativacao: string;
      net_original: number;
    }>;
  }, [ativacoesPjYear, assessorCodes]);

  const assessorInfoByCode = useMemo(() => {
    const map = new Map<string, { nome: string; time: string }>();
    (data || []).forEach((d) => {
      const cod = String(d.cod_assessor ?? "").trim();
      const time = String(d.time ?? "").trim();
      if (!cod) return;
      if (BLOCKED_ASSESSORS.has(cod)) return;
      if (time && BLOCKED_TEAMS.has(time.toUpperCase())) return;
      map.set(cod, { nome: String(d.nome_assessor ?? "").trim(), time });
    });
    return map;
  }, [data]);

  const clientesPorAssessor = useMemo(() => {
    if (!clientesPosicaoRv) return null;
    const map = new Map<string, Set<string>>();
    (clientesPosicaoRv || []).forEach((row: any) => {
      const codAssessor = String(row?.cod_assessor ?? "").trim();
      const codCliente = String(row?.cod_cliente ?? "").trim();
      if (!codAssessor || !codCliente) return;
      if (!map.has(codAssessor)) map.set(codAssessor, new Set());
      map.get(codAssessor)!.add(codCliente);
    });
    return map;
  }, [clientesPosicaoRv]);

  const clientesRvList = useMemo(() => {
    if (!clientesPosicaoRv) return [];
    return (clientesPosicaoRv || [])
      .map((row: any) => {
        const codAssessor = String(row?.cod_assessor ?? "").trim();
        const codCliente = String(row?.cod_cliente ?? "").trim();
        if (!codAssessor || !codCliente) return null;
        if (!assessorCodes.includes(codAssessor)) return null;
        return {
          cod_cliente: codCliente,
          nome_cliente: String(row?.nome_cliente ?? "").trim(),
          cod_assessor: codAssessor,
          nome_assessor: String(row?.nome_assessor ?? "").trim(),
          net_em_m: Number(row?.net_em_m ?? 0),
          data_ultima_operacao: row?.data_ultima_operacao as string | null,
          comissao_ultima_operacao: Number(row?.comissao_ultima_operacao ?? 0),
        };
      })
      .filter(Boolean) as Array<{
      cod_cliente: string;
      nome_cliente: string;
      cod_assessor: string;
      nome_assessor: string;
      net_em_m: number;
      data_ultima_operacao: string | null;
      comissao_ultima_operacao: number;
    }>;
  }, [clientesPosicaoRv, assessorCodes]);

  const ranking = useMemo(() => {
    const valid = (data || []).filter(
      (d) =>
        d.cod_assessor &&
        d.nome_assessor &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
        !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
    );
    return valid.map((a) => {
      const computed = computeAssessorRanking(a, salt);
      const codAssessor = String(a.cod_assessor ?? "").trim();
      const totalClientesMv = a.total_clientes || 0;
      const clientesCount = clientesPorAssessor?.get(codAssessor)?.size || 0;
      const penAaiPe = clientesCount > 0 ? 100 : 0;
      const penClientes = totalClientesMv > 0 ? clamp((clientesCount / totalClientesMv) * 100, 0, 100) : 0;
      const receitaRv = (a.receitas_estruturadas || 0) + (a.receita_b3 || 0);
      const metaRv = ((a.custodia_net || 0) * ROA_RV_TARGET) / 12;
      const roaRv = metaRv > 0 ? clamp((receitaRv / metaRv) * 100, 0, 100) : 0;
      const penCredito = assessoresComCredito.has(codAssessor) ? 100 : 0;
      const creditoMes = creditoValorCartaByAssessor.byMonth.get(codAssessor) || 0;
      const creditoAno = creditoValorCartaByAssessor.byYear.get(codAssessor) || 0;
      const receitaCreditoAnnual = CREDITO_ANUAL_TARGET > 0 ? clamp((creditoAno / CREDITO_ANUAL_TARGET) * 100, 0, 100) : 0;
      const receitaCreditoMonth = CREDITO_MENSAL_TARGET > 0 ? clamp((creditoMes / CREDITO_MENSAL_TARGET) * 100, 0, 100) : 0;
      const aberturaPjMesCount = ativacoesPjByAssessor.byMonth.get(codAssessor) || 0;
      const aberturaPjAnoCount = ativacoesPjByAssessor.byYear.get(codAssessor) || 0;
      const aberturaPjAnnual =
        ABERTURA_PJ_ANUAL_TARGET > 0 ? clamp((aberturaPjAnoCount / ABERTURA_PJ_ANUAL_TARGET) * 100, 0, 100) : 0;
      const aberturaPjMonth = aberturaPjMesCount > 0 ? 100 : 0;
      const penSeguros = assessoresComSeguros.has(codAssessor) ? 100 : 0;
      const segurosMes = segurosByAssessor.receitaByMonth.get(codAssessor) || 0;
      const segurosAno = segurosByAssessor.receitaByYear.get(codAssessor) || 0;
      const receitaSegurosMonth =
        SEGUROS_RECEITA_MENSAL_TARGET > 0 ? clamp((segurosMes / SEGUROS_RECEITA_MENSAL_TARGET) * 100, 0, 100) : 0;
      const apolicesMes = segurosByAssessor.apolicesByMonth.get(codAssessor) || 0;
      const apolicesAno = segurosByAssessor.apolicesByYear.get(codAssessor) || 0;
      const apolicesMonth =
        SEGUROS_APOLICES_MENSAL_TARGET > 0 ? clamp((apolicesMes / SEGUROS_APOLICES_MENSAL_TARGET) * 100, 0, 100) : 0;

      const rv = computed.products.renda_variavel;
      const nextKpis = rv.kpis.map((k) => {
        if (k.key === "pen_aai_pe") return { ...k, value: penAaiPe };
        if (k.key === "pen_clientes") return { ...k, value: penClientes };
        if (k.key === "roa_rv") return { ...k, value: roaRv };
        return k;
      });
      const nextScore = nextKpis.reduce((s, k) => s + k.value * k.weight, 0);

      const bk = computed.products.banco;
      const nextBkKpis = bk.kpis.map((k) => {
        if (k.key === "pen_credito") return { ...k, value: penCredito };
        if (k.key === "receita_credito") return { ...k, value: receitaCreditoMonth, displayValue: receitaCreditoMonth };
        if (k.key === "abertura_pj") return { ...k, value: aberturaPjMonth, displayValue: aberturaPjMonth };
        return k;
      });
      const nextBkScore = nextBkKpis.reduce((s, k) => s + k.value * k.weight, 0);

      const sg = computed.products.seguros;
      const nextSgKpis = sg.kpis.map((k) => {
        if (k.key === "pen_seguros") return { ...k, value: penSeguros };
        if (k.key === "receita") return { ...k, value: receitaSegurosMonth, displayValue: receitaSegurosMonth };
        if (k.key === "apolices") return { ...k, value: apolicesMonth, displayValue: apolicesMonth };
        return k;
      });
      const nextSgScore = nextSgKpis.reduce((s, k) => s + k.value * k.weight, 0);

      const pontosValidos =
        (nextScore + computed.products.allocation.score + nextBkScore + nextSgScore) / 4;
      const overall = computed.enps < 80 ? pontosValidos * 0.8 : pontosValidos;
      let badge: AssessorRanking["badge"] = "Não elegível";
      if (pontosValidos >= 70 && computed.enps >= 80) badge = "Elegível";
      else if (pontosValidos >= 55) badge = "Em risco";

      return {
        ...computed,
        products: {
          ...computed.products,
          renda_variavel: { score: nextScore, kpis: nextKpis },
          banco: { score: nextBkScore, kpis: nextBkKpis },
          seguros: { score: nextSgScore, kpis: nextSgKpis },
        },
        pontosValidos,
        overall,
        badge,
      };
    });
  }, [
    data,
    salt,
    clientesPorAssessor,
    assessoresComCredito,
    creditoValorCartaByAssessor,
    ativacoesPjByAssessor,
    assessoresComSeguros,
    segurosByAssessor,
  ]);

  const [expandedTopProduct, setExpandedTopProduct] = useState<ProductKey | null>(null);
  const [expandedAssessorId, setExpandedAssessorId] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<{ assessorId: string; product: ProductKey } | null>(null);
  const [kpiModal, setKpiModal] = useState<{ product: ProductKey; kpi: string } | null>(null);

  const productsSummary = useMemo(() => {
    const total = ranking.length;
    const byProduct = PRODUCTS.map((p) => {
      const scores = ranking.map((r) => r.products[p.key].score);
      const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0;
      const hit = scores.filter((s) => s >= 70).length;
      const kpis = p.kpis.map((kpi) => {
        const values = ranking
          .map((r) => {
            const found = r.products[p.key].kpis.find((k) => k.key === kpi.key);
            return (found as any)?.displayValue ?? found?.value;
          })
          .filter((v): v is number => typeof v === "number");
        const avgValue = values.length ? values.reduce((s, n) => s + n, 0) / values.length : 0;
        return { ...kpi, avgValue };
      });

      if (p.key === "renda_variavel") {
        const allowedData = (data || []).filter(
          (d) =>
            d.cod_assessor &&
            d.nome_assessor &&
            d.nome_assessor.toLowerCase() !== "null" &&
            d.nome_assessor.toLowerCase() !== "undefined" &&
            !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
            !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
        );

        const totalClientes = allowedData.reduce((acc, d) => acc + (d.total_clientes || 0), 0);
        const uniqueClientes = new Set(
          (clientesPosicaoRv || [])
            .map((row: any) => String(row?.cod_cliente ?? "").trim())
            .filter(Boolean)
        );
        const clientesComBoleta = uniqueClientes.size;
        const penClientesGlobal = totalClientes > 0 ? clamp((clientesComBoleta / totalClientes) * 100, 0, 100) : 0;

        const receitaRvTotal = allowedData.reduce(
          (acc, d) => acc + ((d.receitas_estruturadas || 0) + (d.receita_b3 || 0)),
          0
        );
        const metaRvTotal = allowedData.reduce(
          (acc, d) => acc + (((d.custodia_net || 0) * ROA_RV_TARGET) / 12),
          0
        );
        const roaRvGlobal = metaRvTotal > 0 ? clamp((receitaRvTotal / metaRvTotal) * 100, 0, 100) : 0;

        const kpisPatched = kpis.map((k) => {
          if (k.key === "pen_clientes") return { ...k, avgValue: penClientesGlobal };
          if (k.key === "roa_rv") return { ...k, avgValue: roaRvGlobal };
          return k;
        });

        return {
          key: p.key,
          label: p.label,
          short: p.short,
          avg,
          status: scoreTone(avg),
          hit,
          total,
          kpis: kpisPatched,
        };
      }

      if (p.key === "banco") {
        const allowedData = (data || []).filter(
          (d) =>
            d.cod_assessor &&
            d.nome_assessor &&
            d.nome_assessor.toLowerCase() !== "null" &&
            d.nome_assessor.toLowerCase() !== "undefined" &&
            !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
            !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
        );

        const validCreditoCount = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (assessoresComCredito.has(cod) ? 1 : 0);
        }, 0);
        const penCreditoGlobal = allowedData.length > 0 ? clamp((validCreditoCount / allowedData.length) * 100, 0, 100) : 0;

        const totalCreditoMes = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (creditoValorCartaByAssessor.byMonth.get(cod) || 0);
        }, 0);
        const receitaCreditoMesGlobal =
          CREDITO_MENSAL_TARGET > 0 ? clamp((totalCreditoMes / CREDITO_MENSAL_TARGET) * 100, 0, 100) : 0;

        const totalCreditoAno = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (creditoValorCartaByAssessor.byYear.get(cod) || 0);
        }, 0);
        const receitaCreditoAnoGlobal =
          CREDITO_ANUAL_TARGET > 0 ? clamp((totalCreditoAno / CREDITO_ANUAL_TARGET) * 100, 0, 100) : 0;

        const totalAberturasMes = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (ativacoesPjByAssessor.byMonth.get(cod) || 0);
        }, 0);
        const aberturaPjMesGlobal =
          ABERTURA_PJ_MENSAL_TARGET > 0 ? clamp((totalAberturasMes / ABERTURA_PJ_MENSAL_TARGET) * 100, 0, 100) : 0;

        const totalAberturasAno = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (ativacoesPjByAssessor.byYear.get(cod) || 0);
        }, 0);
        const aberturaPjAnoGlobal =
          ABERTURA_PJ_ANUAL_TARGET > 0 ? clamp((totalAberturasAno / ABERTURA_PJ_ANUAL_TARGET) * 100, 0, 100) : 0;

        const bancoAvg = clamp(
          penCreditoGlobal * 0.3 + receitaCreditoAnoGlobal * 0.5 + aberturaPjAnoGlobal * 0.2,
          0,
          100
        );

        const kpisPatched = kpis.map((k) => {
          if (k.key === "pen_credito") return { ...k, avgValue: penCreditoGlobal };
          if (k.key === "receita_credito") return { ...k, avgValue: receitaCreditoMesGlobal };
          if (k.key === "abertura_pj") return { ...k, avgValue: aberturaPjMesGlobal };
          return k;
        });

        return {
          key: p.key,
          label: p.label,
          short: p.short,
          avg: bancoAvg,
          status: scoreTone(bancoAvg),
          hit,
          total,
          kpis: kpisPatched,
        };
      }

      if (p.key === "seguros") {
        const allowedData = (data || []).filter(
          (d) =>
            d.cod_assessor &&
            d.nome_assessor &&
            d.nome_assessor.toLowerCase() !== "null" &&
            d.nome_assessor.toLowerCase() !== "undefined" &&
            !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
            !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
        );

        const validSegurosCount = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (assessoresComSeguros.has(cod) ? 1 : 0);
        }, 0);
        const penSegurosGlobal =
          allowedData.length > 0 ? clamp((validSegurosCount / allowedData.length) * 100, 0, 100) : 0;

        const totalReceitaMes = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (segurosByAssessor.receitaByMonth.get(cod) || 0);
        }, 0);
        const receitaMesGlobal =
          SEGUROS_RECEITA_MENSAL_TARGET > 0 ? clamp((totalReceitaMes / SEGUROS_RECEITA_MENSAL_TARGET) * 100, 0, 100) : 0;

        const totalReceitaAno = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (segurosByAssessor.receitaByYear.get(cod) || 0);
        }, 0);
        const receitaAnoGlobal =
          SEGUROS_RECEITA_ANUAL_TARGET > 0 ? clamp((totalReceitaAno / SEGUROS_RECEITA_ANUAL_TARGET) * 100, 0, 100) : 0;

        const totalApolicesAno = allowedData.reduce((acc, d) => {
          const cod = String(d.cod_assessor ?? "").trim();
          return acc + (segurosByAssessor.apolicesByYear.get(cod) || 0);
        }, 0);
        const apolicesAnoGlobal =
          SEGUROS_APOLICES_ANUAL_TARGET > 0 ? clamp((totalApolicesAno / SEGUROS_APOLICES_ANUAL_TARGET) * 100, 0, 100) : 0;

        const segurosAvg = clamp(
          penSegurosGlobal * 0.3 + receitaAnoGlobal * 0.5 + apolicesAnoGlobal * 0.2,
          0,
          100
        );

        const kpisPatched = kpis.map((k) => {
          if (k.key === "pen_seguros") return { ...k, avgValue: penSegurosGlobal };
          if (k.key === "receita") return { ...k, avgValue: receitaMesGlobal };
          if (k.key === "apolices") return { ...k, avgValue: apolicesAnoGlobal };
          return k;
        });

        return {
          key: p.key,
          label: p.label,
          short: p.short,
          avg: segurosAvg,
          status: scoreTone(segurosAvg),
          hit,
          total,
          kpis: kpisPatched,
        };
      }

      return {
        key: p.key,
        label: p.label,
        short: p.short,
        avg,
        status: scoreTone(avg),
        hit,
        total,
        kpis,
      };
    });
    return byProduct;
  }, [
    ranking,
    data,
    clientesPosicaoRv,
    creditoValorCartaByAssessor,
    assessoresComCredito,
    ativacoesPjByAssessor,
    assessoresComSeguros,
    segurosByAssessor,
  ]);

  const penAaiAssessorRows = useMemo(() => {
    const base = (data || []).filter(
      (d) =>
        d.cod_assessor &&
        d.nome_assessor &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
        !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
    );
    const rows = base.map((d) => {
      const cod = String(d.cod_assessor).trim();
      const clientesCount = clientesPorAssessor?.get(cod)?.size || 0;
      return {
        cod_assessor: cod,
        nome_assessor: d.nome_assessor,
        time: d.time,
        clientesCount,
        status: clientesCount > 0 ? "Com boleta" : "Sem boleta",
      };
    });
    return rows.sort((a, b) => b.clientesCount - a.clientesCount || a.nome_assessor.localeCompare(b.nome_assessor));
  }, [data, clientesPorAssessor]);

  const receitaCreditoRows = useMemo(() => {
    const base = (data || []).filter(
      (d) =>
        d.cod_assessor &&
        d.nome_assessor &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
        !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
    );
    return base
      .map((d) => {
        const cod = String(d.cod_assessor).trim();
        const valorMes = creditoValorCartaByAssessor.byMonth.get(cod) || 0;
        const valorAno = creditoValorCartaByAssessor.byYear.get(cod) || 0;
        const pctMes = CREDITO_MENSAL_TARGET > 0 ? clamp((valorMes / CREDITO_MENSAL_TARGET) * 100, 0, 100) : 0;
        return {
          cod_assessor: cod,
          nome_assessor: d.nome_assessor,
          time: d.time,
          valorMes,
          valorAno,
          pctMes,
        };
      })
      .sort((a, b) => b.valorMes - a.valorMes || a.nome_assessor.localeCompare(b.nome_assessor));
  }, [data, creditoValorCartaByAssessor]);

  const segurosReceitaRows = useMemo(() => {
    const base = (data || []).filter(
      (d) =>
        d.cod_assessor &&
        d.nome_assessor &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
        !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
    );
    return base
      .map((d) => {
        const cod = String(d.cod_assessor).trim();
        const valorMes = segurosByAssessor.receitaByMonth.get(cod) || 0;
        const valorAno = segurosByAssessor.receitaByYear.get(cod) || 0;
        const pctMes = SEGUROS_RECEITA_MENSAL_TARGET > 0 ? clamp((valorMes / SEGUROS_RECEITA_MENSAL_TARGET) * 100, 0, 100) : 0;
        return {
          cod_assessor: cod,
          nome_assessor: d.nome_assessor,
          time: d.time,
          valorMes,
          valorAno,
          pctMes,
        };
      })
      .sort((a, b) => b.valorMes - a.valorMes || a.nome_assessor.localeCompare(b.nome_assessor));
  }, [data, segurosByAssessor]);

  const segurosApolicesRows = useMemo(() => {
    const base = (data || []).filter(
      (d) =>
        d.cod_assessor &&
        d.nome_assessor &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
        !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
    );
    return base
      .map((d) => {
        const cod = String(d.cod_assessor).trim();
        const qtdMes = segurosByAssessor.apolicesByMonth.get(cod) || 0;
        const qtdAno = segurosByAssessor.apolicesByYear.get(cod) || 0;
        const pctAno = SEGUROS_APOLICES_ANUAL_TARGET > 0 ? clamp((qtdAno / SEGUROS_APOLICES_ANUAL_TARGET) * 100, 0, 100) : 0;
        return {
          cod_assessor: cod,
          nome_assessor: d.nome_assessor,
          time: d.time,
          qtdMes,
          qtdAno,
          pctAno,
        };
      })
      .sort((a, b) => b.qtdMes - a.qtdMes || a.nome_assessor.localeCompare(b.nome_assessor));
  }, [data, segurosByAssessor]);

  const groupedByTeam = useMemo(() => {
    const map = new Map<string, AssessorRanking[]>();
    for (const r of ranking) {
      const key = r.team || "Sem time";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const teams = Array.from(map.entries())
      .map(([team, list]) => {
        const avg = list.reduce((s, a) => s + a.overall, 0) / (list.length || 1);
        return { team, avg, list: list.sort((a, b) => b.overall - a.overall) };
      })
      .sort((a, b) => b.avg - a.avg);
    return teams;
  }, [ranking]);

  const titleMonth = selectedMonthKey
    ? ` • ${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthStartFromKey(selectedMonthKey))}`
    : selectedMonthLabel
      ? ` • ${selectedMonthLabel}`
      : "";

  return (
    <div className="space-y-6">
      <div className="sr-only">
        Ranking gerencial de indicadores estratégicos
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-white font-display text-xl tracking-wide">Ranking Gerencial{titleMonth}</h2>
        <p className="text-white/55 font-data text-xs uppercase tracking-widest">
          Elegibilidade: ≥ 70% pontos válidos e ≥ 80% E‑NPS
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {productsSummary.map((p) => (
          <Card
            key={p.key}
            className={cn(
              "bg-[#0F1218]/70 backdrop-blur-xl border-white/10 p-0 overflow-hidden",
              expandedTopProduct === p.key && "border-white/25"
            )}
          >
            <button
              type="button"
              className="w-full text-left p-4 hover:bg-white/5 transition-colors duration-150 ease-out"
              onClick={() => setExpandedTopProduct((prev) => (prev === p.key ? null : p.key))}
              aria-label={`Detalhar ${p.label}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                    {p.label}
                  </div>
                  <div className="text-white font-display text-2xl mt-1">
                    {fmtPct(p.avg)}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Donut value={p.avg} tone={p.status} label={p.label} />
                  <BadgePill
                    label={p.status === "success" ? "No alvo" : p.status === "warn" ? "Atenção" : "Crítico"}
                    tone={p.status}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-data uppercase tracking-widest text-white/55">
                <span>Assessores</span>
                <span className="text-white/80">{p.hit}/{p.total}</span>
              </div>
            </button>
          </Card>
        ))}
      </div>

      {expandedTopProduct && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-5">
          {(() => {
            const p = productsSummary.find((x) => x.key === expandedTopProduct);
            if (!p) return null;
            const tone = p.status;
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Detalhamento</div>
                    <div className="text-white font-display text-lg tracking-wide">{p.label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <BadgePill
                        label={tone === "success" ? "No alvo" : tone === "warn" ? "Atenção" : "Crítico"}
                        tone={tone}
                      />
                      <span className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                        Score médio {fmtPct(p.avg)}
                      </span>
                    </div>
                  </div>
                  <Donut value={p.avg} tone={tone} label={`Score médio ${p.label}`} />
                </div>

                <div className="space-y-3">
                  {p.kpis.map((k) => {
                    const ktone = scoreTone(k.avgValue);
                    const isClickable =
                      (p.key === "renda_variavel" && (k.key === "pen_aai_pe" || k.key === "pen_clientes")) ||
                      (p.key === "banco" && (k.key === "pen_credito" || k.key === "receita_credito" || k.key === "abertura_pj")) ||
                      (p.key === "seguros" && (k.key === "pen_seguros" || k.key === "receita" || k.key === "apolices"));
                    const labelText =
                      p.key === "banco" && k.key === "receita_credito"
                        ? `${k.label} (meta: ${formatCurrency(CREDITO_MENSAL_TARGET)})`
                        : p.key === "banco" && k.key === "abertura_pj"
                          ? `${k.label} (meta: ${formatCount(ABERTURA_PJ_MENSAL_TARGET)})`
                          : p.key === "seguros" && k.key === "receita"
                            ? `${k.label} (meta: ${formatCurrency(SEGUROS_RECEITA_MENSAL_TARGET)})`
                            : p.key === "seguros" && k.key === "apolices"
                              ? `${k.label} (meta: ${formatCount(SEGUROS_APOLICES_MENSAL_TARGET)})`
                        : k.label;
                    return (
                      <button
                        key={k.key}
                        type="button"
                        disabled={!isClickable}
                        onClick={() => setKpiModal({ product: p.key, kpi: k.key })}
                        className={cn(
                          "w-full grid grid-cols-1 sm:grid-cols-[1fr_64px] gap-2 items-center text-left rounded-lg p-2 -m-2",
                          isClickable ? "hover:bg-white/5 transition-colors duration-150 ease-out" : ""
                        )}
                        aria-label={isClickable ? `Detalhar ${k.label}` : undefined}
                      >
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-white/80 font-data text-xs">{labelText}</div>
                            <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                              Peso {Math.round(k.weight * 100)}%
                            </div>
                          </div>
                          <ProgressBar value={k.avgValue} tone={ktone} />
                        </div>
                        <div className="text-right text-white font-display text-base" style={{ color: toneColor(ktone) }}>
                          {fmtPct(k.avgValue)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      <div className="space-y-3">
        {groupedByTeam.map((team) => {
          const tone = teamTone(team.avg);
          return (
            <Card key={team.team} className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-white font-display text-base tracking-wide truncate">{team.team}</div>
                  <BadgePill label={`Média ${fmtPct(team.avg)}`} tone={tone} />
                </div>
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  {team.list.length} assessores
                </div>
              </div>

              <div className="divide-y divide-white/10">
                {team.list.map((a) => {
                  const isOpen = expandedAssessorId === a.id;
                  const badgeTone = a.badge === "Elegível" ? "success" : a.badge === "Em risco" ? "warn" : "danger";
                  return (
                    <div key={a.id} className="px-5 py-4">
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left cursor-pointer"
                        onClick={() => setExpandedAssessorId((prev) => (prev === a.id ? null : a.id))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedAssessorId((prev) => (prev === a.id ? null : a.id));
                          }
                        }}
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 border border-white/10">
                              {a.fotoUrl ? <AvatarImage src={a.fotoUrl} alt={a.name} /> : null}
                              <AvatarFallback
                                className="text-[10px] font-data uppercase tracking-widest"
                                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)" }}
                              >
                                {initials(a.name)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <div className="text-white font-display text-sm truncate">{a.name}</div>
                              <div className="text-white/45 font-data text-[10px] uppercase tracking-widest">
                                AAI-{a.id} • E‑NPS {fmtPct(a.enps)} • Pontos válidos {Math.round(a.pontosValidos)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {PRODUCTS.map((p) => (
                              <Chip
                                key={p.key}
                                label={p.short}
                                value={a.products[p.key].score}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAssessorId(a.id);
                                  setExpandedProduct((prev) =>
                                    prev?.assessorId === a.id && prev.product === p.key
                                      ? null
                                      : { assessorId: a.id, product: p.key }
                                  );
                                }}
                              />
                            ))}
                            <Badge
                              className="rounded-full px-3 py-1 text-[10px] font-data uppercase tracking-widest border"
                              style={{
                                borderColor: `${toneColor(badgeTone)}55`,
                                background: `${toneColor(badgeTone)}18`,
                                color: toneColor(badgeTone),
                              }}
                            >
                              {a.badge}
                            </Badge>
                            <span className="text-white/35">
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mt-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {PRODUCTS.map((p) => {
                              const s = a.products[p.key].score;
                              const tone = scoreTone(s);
                              const isProductOpen = expandedProduct?.assessorId === a.id && expandedProduct.product === p.key;
                              return (
                                <button
                                  key={p.key}
                                  type="button"
                                  className={cn(
                                    "rounded-xl border p-4 text-left transition-colors duration-150 ease-out",
                                    isProductOpen ? "bg-white/5" : "bg-black/20 hover:bg-white/5"
                                  )}
                                  style={{ borderColor: "rgba(255,255,255,0.10)" }}
                                  onClick={() =>
                                    setExpandedProduct((prev) =>
                                      prev?.assessorId === a.id && prev.product === p.key
                                        ? null
                                        : { assessorId: a.id, product: p.key }
                                    )
                                  }
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">{p.label}</div>
                                      <div className="text-white font-display text-xl mt-1">{fmtPct(s)}</div>
                                    </div>
                                    <BadgePill label={tone === "success" ? "No alvo" : tone === "warn" ? "Atenção" : "Crítico"} tone={tone} />
                                  </div>
                                  <div className="mt-3">
                                    <ProgressBar value={s} tone={tone} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {expandedProduct?.assessorId === a.id && (
                            <Card className="bg-black/20 border-white/10 p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-white font-display text-sm tracking-wide">
                                  {PRODUCTS.find((p) => p.key === expandedProduct.product)?.label}
                                </div>
                                <div className="text-white/45 font-data text-[10px] uppercase tracking-widest">
                                  KPIs e pesos
                                </div>
                              </div>

                              <div className="mt-4 space-y-3">
                                {a.products[expandedProduct.product].kpis.map((k) => {
                                  const displayValue = (k as any).displayValue ?? k.value;
                                  const tone = scoreTone(displayValue);
                                  return (
                                    <div key={k.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                                      <div className="space-y-1">
                                        <div className="flex items-baseline justify-between gap-3">
                                          <div className="text-white/80 font-data text-xs">{k.label}</div>
                                          <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                                            Peso {Math.round(k.weight * 100)}%
                                          </div>
                                        </div>
                                        <ProgressBar value={displayValue} tone={tone} />
                                      </div>
                                      <div
                                        className="text-right text-white font-display text-base"
                                        style={{ color: toneColor(tone) }}
                                      >
                                        {fmtPct(displayValue)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {ranking.length === 0 && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Nenhum assessor encontrado para os filtros atuais.
          </div>
        </Card>
      )}

      {isLoadingClientesPosicaoRv && (
        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
          Carregando Penetrações RV…
        </div>
      )}
      {isLoadingConsorciosCreditoPen && (
        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
          Carregando Penetração Crédito…
        </div>
      )}
      {isLoadingConsorciosCreditoSalesYear && (
        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
          Carregando Receita em Crédito…
        </div>
      )}
      {(isLoadingAtivacoesPjMonth || isLoadingAtivacoesPjYear) && (
        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
          Carregando Aberturas PJ…
        </div>
      )}
      {(isLoadingSegurosWindow || isLoadingSegurosYear || isLoadingSegurosHistory) && (
        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
          Carregando Seguros…
        </div>
      )}

      <Dialog open={!!kpiModal} onOpenChange={(open) => (!open ? setKpiModal(null) : null)}>
        <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[980px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-display text-lg tracking-wide">
              {kpiModal?.kpi === "pen_aai_pe"
                ? "Penetração AAI|PE — Detalhamento"
                : kpiModal?.kpi === "pen_clientes"
                  ? "Penetração Clientes — Detalhamento"
                  : kpiModal?.kpi === "pen_credito"
                    ? "Penetração AAI Crédito — Detalhamento"
                    : kpiModal?.kpi === "receita_credito"
                      ? "Receita em Crédito — Detalhamento"
                      : kpiModal?.kpi === "abertura_pj"
                        ? "Abertura Contas PJ — Detalhamento"
                        : kpiModal?.product === "seguros" && kpiModal?.kpi === "pen_seguros"
                          ? "Penetração AAI Seguros — Detalhamento"
                          : kpiModal?.product === "seguros" && kpiModal?.kpi === "receita"
                            ? "Receita Seguros — Detalhamento"
                            : kpiModal?.product === "seguros" && kpiModal?.kpi === "apolices"
                              ? "Qtd Apólices vendidas — Detalhamento"
                        : "Detalhamento"}
            </DialogTitle>
          </DialogHeader>

          {kpiModal?.kpi === "pen_clientes" && (
            <div className="space-y-3">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                Clientes com boleta no mês (data_ultima_operacao)
              </div>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                      <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                        <th className="py-3 px-4 font-medium">Cliente</th>
                        <th className="py-3 px-4 font-medium text-right">Net</th>
                        <th className="py-3 px-4 font-medium text-right">Valor</th>
                        <th className="py-3 px-4 font-medium">Última Op.</th>
                        <th className="py-3 px-4 font-medium">Assessor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {clientesRvList.map((c) => (
                        <tr key={`${c.cod_cliente}-${c.cod_assessor}`} className="text-sm">
                          <td className="py-3 px-4">
                            <div className="text-white/85 font-data text-xs">
                              {c.nome_cliente || c.cod_cliente}
                            </div>
                            <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                              {c.cod_cliente}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-white/80 font-data text-xs">
                            {formatCurrency(c.net_em_m)}
                          </td>
                          <td className="py-3 px-4 text-right text-white/80 font-data text-xs">
                            {formatCurrency(c.comissao_ultima_operacao)}
                          </td>
                          <td className="py-3 px-4 text-white/70 font-data text-xs">
                            {formatDate(c.data_ultima_operacao)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-white/85 font-data text-xs">
                              {c.nome_assessor || `AAI-${c.cod_assessor}`}
                            </div>
                            <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                              AAI-{c.cod_assessor}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {clientesRvList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                            Nenhum cliente encontrado para o mês e filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {kpiModal?.kpi === "pen_aai_pe" && (
            <div className="space-y-3">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                Assessores e total de clientes com boleta no mês
              </div>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                      <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                        <th className="py-3 px-4 font-medium">Assessor</th>
                        <th className="py-3 px-4 font-medium">Time</th>
                        <th className="py-3 px-4 font-medium text-right">Clientes</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {penAaiAssessorRows.map((r) => (
                        <tr key={r.cod_assessor} className="text-sm">
                          <td className="py-3 px-4">
                            <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                            <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                              AAI-{r.cod_assessor}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                          <td className="py-3 px-4 text-right text-white/80 font-data text-xs">
                            {r.clientesCount}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                              style={{
                                borderColor: `${toneColor(r.clientesCount > 0 ? "success" : "danger")}55`,
                                background: `${toneColor(r.clientesCount > 0 ? "success" : "danger")}18`,
                                color: toneColor(r.clientesCount > 0 ? "success" : "danger"),
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {penAaiAssessorRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                            Nenhum assessor encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {kpiModal?.kpi === "pen_credito" && (
            <div className="space-y-5">
              {isLoadingConsorciosCreditoSales && (
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  Carregando histórico de consórcios…
                </div>
              )}

              {(() => {
                const base = (data || []).filter(
                  (d) =>
                    d.cod_assessor &&
                    d.nome_assessor &&
                    d.nome_assessor.toLowerCase() !== "null" &&
                    d.nome_assessor.toLowerCase() !== "undefined" &&
                    !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
                    !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
                );

                const monthStart = selectedMonthStart;
                const rows = base
                  .map((d) => {
                    const cod = String(d.cod_assessor).trim();
                    const sales = creditoSalesByAssessor.get(cod) || [];
                    const lastSale = sales[0] || null;

                    const validSale =
                      monthStart
                        ? sales.find((s) => {
                            const saleKey = String(s.data_venda ?? "").slice(0, 7);
                            if (!/^\d{4}-\d{2}$/.test(saleKey)) return false;
                            const saleStart = monthStartFromKey(saleKey);
                            const validUntil = addMonths(saleStart, 2);
                            return monthStart >= saleStart && monthStart <= validUntil;
                          }) || null
                        : null;

                    const saleForDisplay = validSale || lastSale;
                    const saleKey = saleForDisplay ? String(saleForDisplay.data_venda ?? "").slice(0, 7) : "";
                    const validUntilKey =
                      saleForDisplay && /^\d{4}-\d{2}$/.test(saleKey)
                        ? format(addMonths(monthStartFromKey(saleKey), 2), "yyyy-MM")
                        : "";

                    const isValid = !!validSale;
                    return {
                      cod_assessor: cod,
                      nome_assessor: d.nome_assessor,
                      time: d.time,
                      isValid,
                      cota: saleForDisplay?.cota || "—",
                      contrato: saleForDisplay?.contrato || "",
                      data_venda: saleForDisplay?.data_venda || null,
                      validUntilKey: validUntilKey || "—",
                      lastValidKey: !isValid ? validUntilKey || "—" : validUntilKey || "—",
                    };
                  })
                  .sort((a, b) => Number(b.isValid) - Number(a.isValid) || a.nome_assessor.localeCompare(b.nome_assessor));

                const validRows = rows.filter((r) => r.isValid);
                const invalidRows = rows.filter((r) => !r.isValid);

                const Table = ({ items, title }: { items: typeof rows; title: string }) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                        {title}
                      </div>
                      <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                        {items.length} assessores
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-4 font-medium">Assessor</th>
                              <th className="py-3 px-4 font-medium">Time</th>
                              <th className="py-3 px-4 font-medium">Status</th>
                              <th className="py-3 px-4 font-medium">Última cota</th>
                              <th className="py-3 px-4 font-medium">Vendida em</th>
                              <th className="py-3 px-4 font-medium">Válido até</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {items.map((r) => (
                              <tr key={r.cod_assessor} className="text-sm">
                                <td className="py-3 px-4">
                                  <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                  <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                                    AAI-{r.cod_assessor}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                                    style={{
                                      borderColor: `${toneColor(r.isValid ? "success" : "danger")}55`,
                                      background: `${toneColor(r.isValid ? "success" : "danger")}18`,
                                      color: toneColor(r.isValid ? "success" : "danger"),
                                    }}
                                  >
                                    {r.isValid ? "Válido" : "Sem válido"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-white/80 font-data text-xs">
                                  {r.cota}
                                </td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">
                                  {formatDate(r.data_venda)}
                                </td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">
                                  {formatMonthKey(r.validUntilKey)}
                                </td>
                              </tr>
                            ))}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  Nenhum assessor encontrado para os filtros atuais.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <BadgePill label={`Válidos ${validRows.length}/${rows.length}`} tone="success" />
                      <BadgePill label={`Sem válido ${invalidRows.length}/${rows.length}`} tone="danger" />
                    </div>
                    <Table items={validRows} title="Com consórcio válido no mês" />
                    <Table items={invalidRows} title="Sem consórcio válido no mês (mostra última venda e último mês válido)" />
                  </div>
                );
              })()}
            </div>
          )}

          {kpiModal?.kpi === "abertura_pj" && (
            <div className="space-y-4">
              {(isLoadingAtivacoesPjMonth || isLoadingAtivacoesPjYear) && (
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  Carregando ativações PJ…
                </div>
              )}

              {(() => {
                const totalMes = ativacoesPjMonthRows.length;
                const totalAno = ativacoesPjYearRows.length;

                const monthKey = selectedMonthKey;
                const rowsMes = [...ativacoesPjMonthRows].sort(
                  (a, b) =>
                    String(b.tipo_ativacao || "").localeCompare(String(a.tipo_ativacao || "")) ||
                    b.net_original - a.net_original
                );
                const rowsOutrosMeses = ativacoesPjYearRows
                  .filter((r) => {
                    const key = String(r.data_posicao ?? "").slice(0, 7);
                    return monthKey ? key !== monthKey : true;
                  })
                  .sort(
                    (a, b) =>
                      String(b.data_posicao ?? "").localeCompare(String(a.data_posicao ?? "")) ||
                      String(b.tipo_ativacao || "").localeCompare(String(a.tipo_ativacao || "")) ||
                      b.net_original - a.net_original
                  );

                const baseAssessores = (data || []).filter(
                  (d) =>
                    d.cod_assessor &&
                    d.nome_assessor &&
                    d.nome_assessor.toLowerCase() !== "null" &&
                    d.nome_assessor.toLowerCase() !== "undefined" &&
                    !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
                    !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
                );
                const assessoresSemPj = baseAssessores
                  .filter((d) => {
                    const cod = String(d.cod_assessor ?? "").trim();
                    return (ativacoesPjByAssessor.byYear.get(cod) || 0) === 0;
                  })
                  .map((d) => ({
                    cod_assessor: String(d.cod_assessor ?? "").trim(),
                    nome_assessor: String(d.nome_assessor ?? "").trim(),
                    time: String(d.time ?? "").trim(),
                  }))
                  .sort((a, b) => a.nome_assessor.localeCompare(b.nome_assessor));

                const Table = ({
                  items,
                  title,
                }: {
                  items: Array<{
                    data_posicao: string | null;
                    cod_assessor: string;
                    cliente: string;
                    tipo_ativacao: string;
                    net_original: number;
                  }>;
                  title: string;
                }) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">{title}</div>
                      <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                        {items.length} clientes
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-4 font-medium">Assessor</th>
                              <th className="py-3 px-4 font-medium">Cliente</th>
                              <th className="py-3 px-4 font-medium">Tipo ativação</th>
                              <th className="py-3 px-4 font-medium">Mês</th>
                              <th className="py-3 px-4 font-medium text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {items.map((r) => {
                              const info = assessorInfoByCode.get(r.cod_assessor);
                              const key = String(r.data_posicao ?? "").slice(0, 7);
                              return (
                                <tr key={`${r.cod_assessor}-${r.cliente}-${r.tipo_ativacao}-${r.data_posicao}`} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{info?.nome || `AAI-${r.cod_assessor}`}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/80 font-data text-xs">{r.cliente}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.tipo_ativacao || "—"}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{formatMonthKey(key)}</td>
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(r.net_original)}</td>
                                </tr>
                              );
                            })}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  Nenhum cliente encontrado.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgePill label={`Meta mensal ${formatCount(ABERTURA_PJ_MENSAL_TARGET)}`} tone="warn" />
                      <BadgePill label={`Meta anual ${formatCount(ABERTURA_PJ_ANUAL_TARGET, 0)}`} tone="warn" />
                      <BadgePill label={`Total mês ${formatCount(totalMes, 0)}`} tone="success" />
                      <BadgePill label={`Total ano ${formatCount(totalAno, 0)}`} tone="success" />
                      <BadgePill label={`Sem PJ ${formatCount(assessoresSemPj.length, 0)}`} tone="danger" />
                    </div>

                    <Table items={rowsMes} title="Clientes ativados no mês selecionado" />
                    <Table items={rowsOutrosMeses} title="Clientes ativados em outros meses do ano (mostra o mês que entrou)" />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                          Assessores sem novos clientes PJ no ano
                        </div>
                        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                          {assessoresSemPj.length} assessores
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="max-h-[35vh] overflow-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                              <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                                <th className="py-3 px-4 font-medium">Assessor</th>
                                <th className="py-3 px-4 font-medium">Time</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {assessoresSemPj.map((r) => (
                                <tr key={r.cod_assessor} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                                      AAI-{r.cod_assessor}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                  <td className="py-3 px-4">
                                    <span
                                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                                      style={{
                                        borderColor: `${toneColor("danger")}55`,
                                        background: `${toneColor("danger")}18`,
                                        color: toneColor("danger"),
                                      }}
                                    >
                                      Sem PJ
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {assessoresSemPj.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                    Nenhum assessor encontrado para os filtros atuais.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {kpiModal?.product === "seguros" && kpiModal?.kpi === "pen_seguros" && (
            <div className="space-y-5">
              {(isLoadingSegurosWindow || isLoadingSegurosHistory) && (
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  Carregando histórico de seguros…
                </div>
              )}

              {(() => {
                const base = (data || []).filter(
                  (d) =>
                    d.cod_assessor &&
                    d.nome_assessor &&
                    d.nome_assessor.toLowerCase() !== "null" &&
                    d.nome_assessor.toLowerCase() !== "undefined" &&
                    !BLOCKED_ASSESSORS.has(String(d.cod_assessor).trim()) &&
                    !BLOCKED_TEAMS.has(String(d.time ?? "").trim().toUpperCase())
                );

                const monthStart = selectedMonthStart;
                const rows = base
                  .map((d) => {
                    const cod = String(d.cod_assessor).trim();
                    const apolices = segurosHistoryByAssessor.get(cod) || [];
                    const lastApolice = apolices[0] || null;

                    const validApolice =
                      monthStart
                        ? apolices.find((a) => {
                            const apoliceKey = String(a.data_inicio_seguro ?? "").slice(0, 7);
                            if (!/^\d{4}-\d{2}$/.test(apoliceKey)) return false;
                            const apoliceStart = monthStartFromKey(apoliceKey);
                            const validUntil = addMonths(apoliceStart, 2);
                            return monthStart >= apoliceStart && monthStart <= validUntil;
                          }) || null
                        : null;

                    const apoliceForDisplay = validApolice || lastApolice;
                    const apoliceKey = apoliceForDisplay ? String(apoliceForDisplay.data_inicio_seguro ?? "").slice(0, 7) : "";
                    const validUntilKey =
                      apoliceForDisplay && /^\d{4}-\d{2}$/.test(apoliceKey)
                        ? format(addMonths(monthStartFromKey(apoliceKey), 2), "yyyy-MM")
                        : "";

                    const isValid = !!validApolice;
                    return {
                      cod_assessor: cod,
                      nome_assessor: d.nome_assessor,
                      time: d.time,
                      isValid,
                      inscricao: apoliceForDisplay?.inscricao || "—",
                      cliente: apoliceForDisplay?.cliente || "",
                      seguradora: apoliceForDisplay?.seguradora || "",
                      data_inicio_seguro: apoliceForDisplay?.data_inicio_seguro || null,
                      validUntilKey: validUntilKey || "—",
                    };
                  })
                  .sort((a, b) => Number(b.isValid) - Number(a.isValid) || a.nome_assessor.localeCompare(b.nome_assessor));

                const validRows = rows.filter((r) => r.isValid);
                const invalidRows = rows.filter((r) => !r.isValid);

                const Table = ({ items, title }: { items: typeof rows; title: string }) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">{title}</div>
                      <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                        {items.length} assessores
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-4 font-medium">Assessor</th>
                              <th className="py-3 px-4 font-medium">Time</th>
                              <th className="py-3 px-4 font-medium">Status</th>
                              <th className="py-3 px-4 font-medium">Última apólice</th>
                              <th className="py-3 px-4 font-medium">Início</th>
                              <th className="py-3 px-4 font-medium">Válido até</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {items.map((r) => (
                              <tr key={r.cod_assessor} className="text-sm">
                                <td className="py-3 px-4">
                                  <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                  <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                </td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                                    style={{
                                      borderColor: `${toneColor(r.isValid ? "success" : "danger")}55`,
                                      background: `${toneColor(r.isValid ? "success" : "danger")}18`,
                                      color: toneColor(r.isValid ? "success" : "danger"),
                                    }}
                                  >
                                    {r.isValid ? "Válido" : "Sem válido"}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-white/80 font-data text-xs">{r.inscricao}</div>
                                  <div className="text-white/45 font-data text-[10px] uppercase tracking-widest">
                                    {r.cliente ? r.cliente : r.seguradora ? r.seguradora : "—"}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">{formatDate(r.data_inicio_seguro)}</td>
                                <td className="py-3 px-4 text-white/70 font-data text-xs">{formatMonthKey(r.validUntilKey)}</td>
                              </tr>
                            ))}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  Nenhum assessor encontrado para os filtros atuais.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <BadgePill label={`Válidos ${validRows.length}/${rows.length}`} tone="success" />
                      <BadgePill label={`Sem válido ${invalidRows.length}/${rows.length}`} tone="danger" />
                    </div>
                    <Table items={validRows} title="Com apólice válida no mês (janela de 3 meses)" />
                    <Table items={invalidRows} title="Sem apólice válida no mês (mostra a última apólice e o último mês válido)" />
                  </div>
                );
              })()}
            </div>
          )}

          {kpiModal?.product === "seguros" && kpiModal?.kpi === "receita" && (
            <div className="space-y-4">
              {(isLoadingSegurosYear || isLoadingSegurosHistory) && (
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  Carregando seguros…
                </div>
              )}

              {(() => {
                const totalMes = segurosReceitaRows.reduce((acc, r) => acc + r.valorMes, 0);
                const totalAno = segurosReceitaRows.reduce((acc, r) => acc + r.valorAno, 0);

                const monthKey = selectedMonthKey;
                const apolicesMes = (segurosYearRows || [])
                  .filter((r: any) => String(r?.data_inicio_seguro ?? "").slice(0, 7) === monthKey)
                  .map((r: any) => {
                    const cod = String(r?.assessor ?? r?.cod_assessor ?? "").trim();
                    return {
                      cod_assessor: cod,
                      inscricao: String(r?.inscricao ?? "").trim(),
                      cliente: String(r?.cliente ?? "").trim(),
                      seguradora: String(r?.seguradora ?? "").trim(),
                      periodicidade: String(r?.periodicidade ?? "").trim(),
                      parcela: parseNumber(r?.parcela),
                      data_inicio_seguro: (r?.data_inicio_seguro ?? null) as string | null,
                    };
                  })
                  .sort((a, b) => b.parcela - a.parcela || String(b.data_inicio_seguro ?? "").localeCompare(String(a.data_inicio_seguro ?? "")));

                const apolicesOutrosMeses = (segurosYearRows || [])
                  .filter((r: any) => {
                    const mk = String(r?.data_inicio_seguro ?? "").slice(0, 7);
                    return monthKey ? mk !== monthKey : true;
                  })
                  .map((r: any) => {
                    const cod = String(r?.assessor ?? r?.cod_assessor ?? "").trim();
                    return {
                      cod_assessor: cod,
                      inscricao: String(r?.inscricao ?? "").trim(),
                      cliente: String(r?.cliente ?? "").trim(),
                      seguradora: String(r?.seguradora ?? "").trim(),
                      periodicidade: String(r?.periodicidade ?? "").trim(),
                      parcela: parseNumber(r?.parcela),
                      data_inicio_seguro: (r?.data_inicio_seguro ?? null) as string | null,
                      monthKey: String(r?.data_inicio_seguro ?? "").slice(0, 7),
                    };
                  })
                  .sort(
                    (a, b) =>
                      String(b.data_inicio_seguro ?? "").localeCompare(String(a.data_inicio_seguro ?? "")) || b.parcela - a.parcela
                  );

                const assessoresSemReceita = segurosReceitaRows
                  .filter((r) => r.valorAno <= 0)
                  .map((r) => ({
                    cod_assessor: r.cod_assessor,
                    nome_assessor: r.nome_assessor,
                    time: r.time,
                  }))
                  .sort((a, b) => a.nome_assessor.localeCompare(b.nome_assessor));

                const TableApolices = ({
                  items,
                  title,
                  showMonth,
                }: {
                  items: Array<{
                    cod_assessor: string;
                    inscricao: string;
                    cliente: string;
                    seguradora: string;
                    periodicidade: string;
                    parcela: number;
                    data_inicio_seguro: string | null;
                    monthKey?: string;
                  }>;
                  title: string;
                  showMonth?: boolean;
                }) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">{title}</div>
                      <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                        {items.length} apólices
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-4 font-medium">Assessor</th>
                              <th className="py-3 px-4 font-medium">Cliente</th>
                              <th className="py-3 px-4 font-medium">Inscrição</th>
                              <th className="py-3 px-4 font-medium">Seguradora</th>
                              <th className="py-3 px-4 font-medium">Periodicidade</th>
                              {showMonth ? <th className="py-3 px-4 font-medium">Mês</th> : null}
                              <th className="py-3 px-4 font-medium text-right">Parcela</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {items.map((r) => {
                              const info = assessorInfoByCode.get(r.cod_assessor);
                              return (
                                <tr key={`${r.cod_assessor}-${r.inscricao}-${r.data_inicio_seguro}`} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{info?.nome || `AAI-${r.cod_assessor}`}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/80 font-data text-xs">{r.cliente || "—"}</td>
                                  <td className="py-3 px-4 text-white/80 font-data text-xs">{r.inscricao || "—"}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.seguradora || "—"}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.periodicidade || "—"}</td>
                                  {showMonth ? (
                                    <td className="py-3 px-4 text-white/70 font-data text-xs">{formatMonthKey(r.monthKey || "—")}</td>
                                  ) : null}
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(r.parcela)}</td>
                                </tr>
                              );
                            })}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={showMonth ? 7 : 6} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  Nenhuma apólice encontrada.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgePill label={`Meta mensal ${formatCurrency(SEGUROS_RECEITA_MENSAL_TARGET)}`} tone="warn" />
                      <BadgePill label={`Meta anual ${formatCurrency(SEGUROS_RECEITA_ANUAL_TARGET)}`} tone="warn" />
                      <BadgePill label={`Total mês ${formatCurrency(totalMes)}`} tone="success" />
                      <BadgePill label={`Total ano ${formatCurrency(totalAno)}`} tone="success" />
                      <BadgePill label={`Sem receita ${formatCount(assessoresSemReceita.length, 0)}`} tone="danger" />
                    </div>

                    <div className="space-y-2">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Resumo por assessor</div>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="max-h-[45vh] overflow-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                              <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                                <th className="py-3 px-4 font-medium">Assessor</th>
                                <th className="py-3 px-4 font-medium">Time</th>
                                <th className="py-3 px-4 font-medium text-right">Mês</th>
                                <th className="py-3 px-4 font-medium text-right">Ano</th>
                                <th className="py-3 px-4 font-medium text-right">% mês</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {segurosReceitaRows.map((r) => (
                                <tr key={r.cod_assessor} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(r.valorMes)}</td>
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(r.valorAno)}</td>
                                  <td className="py-3 px-4 text-right text-white font-display text-xs">{fmtPct(r.pctMes)}</td>
                                </tr>
                              ))}
                              {segurosReceitaRows.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                    Nenhum assessor encontrado para os filtros atuais.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <TableApolices items={apolicesMes} title="Apólices do mês selecionado" />
                    <TableApolices items={apolicesOutrosMeses} title="Apólices em outros meses do ano (mostra o mês que entrou)" showMonth />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                          Assessores sem receita no ano
                        </div>
                        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                          {assessoresSemReceita.length} assessores
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="max-h-[35vh] overflow-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                              <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                                <th className="py-3 px-4 font-medium">Assessor</th>
                                <th className="py-3 px-4 font-medium">Time</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {assessoresSemReceita.map((r) => (
                                <tr key={r.cod_assessor} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                  <td className="py-3 px-4">
                                    <span
                                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                                      style={{
                                        borderColor: `${toneColor("danger")}55`,
                                        background: `${toneColor("danger")}18`,
                                        color: toneColor("danger"),
                                      }}
                                    >
                                      Sem receita
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {assessoresSemReceita.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                    Nenhum assessor encontrado para os filtros atuais.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {kpiModal?.product === "seguros" && kpiModal?.kpi === "apolices" && (
            <div className="space-y-4">
              {isLoadingSegurosYear && (
                <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                  Carregando apólices…
                </div>
              )}

              {(() => {
                const totalMes = segurosApolicesRows.reduce((acc, r) => acc + r.qtdMes, 0);
                const totalAno = segurosApolicesRows.reduce((acc, r) => acc + r.qtdAno, 0);

                const monthKey = selectedMonthKey;
                const apolicesMes = (segurosYearRows || [])
                  .filter((r: any) => String(r?.data_inicio_seguro ?? "").slice(0, 7) === monthKey)
                  .map((r: any) => {
                    const cod = String(r?.assessor ?? r?.cod_assessor ?? "").trim();
                    return {
                      cod_assessor: cod,
                      inscricao: String(r?.inscricao ?? "").trim(),
                      cliente: String(r?.cliente ?? "").trim(),
                      seguradora: String(r?.seguradora ?? "").trim(),
                      periodicidade: String(r?.periodicidade ?? "").trim(),
                      parcela: parseNumber(r?.parcela),
                      data_inicio_seguro: (r?.data_inicio_seguro ?? null) as string | null,
                    };
                  })
                  .sort((a, b) => String(b.data_inicio_seguro ?? "").localeCompare(String(a.data_inicio_seguro ?? "")));

                const apolicesOutrosMeses = (segurosYearRows || [])
                  .filter((r: any) => {
                    const mk = String(r?.data_inicio_seguro ?? "").slice(0, 7);
                    return monthKey ? mk !== monthKey : true;
                  })
                  .map((r: any) => {
                    const cod = String(r?.assessor ?? r?.cod_assessor ?? "").trim();
                    return {
                      cod_assessor: cod,
                      inscricao: String(r?.inscricao ?? "").trim(),
                      cliente: String(r?.cliente ?? "").trim(),
                      seguradora: String(r?.seguradora ?? "").trim(),
                      periodicidade: String(r?.periodicidade ?? "").trim(),
                      parcela: parseNumber(r?.parcela),
                      data_inicio_seguro: (r?.data_inicio_seguro ?? null) as string | null,
                      monthKey: String(r?.data_inicio_seguro ?? "").slice(0, 7),
                    };
                  })
                  .sort((a, b) => String(b.data_inicio_seguro ?? "").localeCompare(String(a.data_inicio_seguro ?? "")));

                const assessoresSemApolice = segurosApolicesRows
                  .filter((r) => r.qtdAno <= 0)
                  .map((r) => ({
                    cod_assessor: r.cod_assessor,
                    nome_assessor: r.nome_assessor,
                    time: r.time,
                  }))
                  .sort((a, b) => a.nome_assessor.localeCompare(b.nome_assessor));

                const TableApolices = ({
                  items,
                  title,
                  showMonth,
                }: {
                  items: Array<{
                    cod_assessor: string;
                    inscricao: string;
                    cliente: string;
                    seguradora: string;
                    periodicidade: string;
                    parcela: number;
                    data_inicio_seguro: string | null;
                    monthKey?: string;
                  }>;
                  title: string;
                  showMonth?: boolean;
                }) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">{title}</div>
                      <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                        {items.length} apólices
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-4 font-medium">Assessor</th>
                              <th className="py-3 px-4 font-medium">Cliente</th>
                              <th className="py-3 px-4 font-medium">Inscrição</th>
                              <th className="py-3 px-4 font-medium">Seguradora</th>
                              <th className="py-3 px-4 font-medium">Periodicidade</th>
                              {showMonth ? <th className="py-3 px-4 font-medium">Mês</th> : null}
                              <th className="py-3 px-4 font-medium text-right">Parcela</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {items.map((r) => {
                              const info = assessorInfoByCode.get(r.cod_assessor);
                              return (
                                <tr key={`${r.cod_assessor}-${r.inscricao}-${r.data_inicio_seguro}`} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{info?.nome || `AAI-${r.cod_assessor}`}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/80 font-data text-xs">{r.cliente || "—"}</td>
                                  <td className="py-3 px-4 text-white/80 font-data text-xs">{r.inscricao || "—"}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.seguradora || "—"}</td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.periodicidade || "—"}</td>
                                  {showMonth ? (
                                    <td className="py-3 px-4 text-white/70 font-data text-xs">{formatMonthKey(r.monthKey || "—")}</td>
                                  ) : null}
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(r.parcela)}</td>
                                </tr>
                              );
                            })}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={showMonth ? 7 : 6} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                  Nenhuma apólice encontrada.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgePill label={`Meta mensal ${formatCount(SEGUROS_APOLICES_MENSAL_TARGET)}`} tone="warn" />
                      <BadgePill label={`Meta anual ${formatCount(SEGUROS_APOLICES_ANUAL_TARGET, 0)}`} tone="warn" />
                      <BadgePill label={`Total mês ${formatCount(totalMes, 0)}`} tone="success" />
                      <BadgePill label={`Total ano ${formatCount(totalAno, 0)}`} tone="success" />
                      <BadgePill label={`Sem apólices ${formatCount(assessoresSemApolice.length, 0)}`} tone="danger" />
                    </div>

                    <div className="space-y-2">
                      <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Resumo por assessor</div>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="max-h-[45vh] overflow-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                              <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                                <th className="py-3 px-4 font-medium">Assessor</th>
                                <th className="py-3 px-4 font-medium">Time</th>
                                <th className="py-3 px-4 font-medium text-right">Mês</th>
                                <th className="py-3 px-4 font-medium text-right">Ano</th>
                                <th className="py-3 px-4 font-medium text-right">% ano</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {segurosApolicesRows.map((r) => (
                                <tr key={r.cod_assessor} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCount(r.qtdMes, 0)}</td>
                                  <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCount(r.qtdAno, 0)}</td>
                                  <td className="py-3 px-4 text-right text-white font-display text-xs">{fmtPct(r.pctAno)}</td>
                                </tr>
                              ))}
                              {segurosApolicesRows.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                    Nenhum assessor encontrado para os filtros atuais.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <TableApolices items={apolicesMes} title="Apólices do mês selecionado" />
                    <TableApolices items={apolicesOutrosMeses} title="Apólices em outros meses do ano (mostra o mês que entrou)" showMonth />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                          Assessores sem apólices no ano
                        </div>
                        <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                          {assessoresSemApolice.length} assessores
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="max-h-[35vh] overflow-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                              <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                                <th className="py-3 px-4 font-medium">Assessor</th>
                                <th className="py-3 px-4 font-medium">Time</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {assessoresSemApolice.map((r) => (
                                <tr key={r.cod_assessor} className="text-sm">
                                  <td className="py-3 px-4">
                                    <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                                    <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">AAI-{r.cod_assessor}</div>
                                  </td>
                                  <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                                  <td className="py-3 px-4">
                                    <span
                                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-data uppercase tracking-widest"
                                      style={{
                                        borderColor: `${toneColor("danger")}55`,
                                        background: `${toneColor("danger")}18`,
                                        color: toneColor("danger"),
                                      }}
                                    >
                                      Sem apólices
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {assessoresSemApolice.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                                    Nenhum assessor encontrado para os filtros atuais.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {kpiModal?.kpi === "receita_credito" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <BadgePill label={`Meta mensal ${formatCurrency(CREDITO_MENSAL_TARGET)}`} tone="warn" />
                <BadgePill label={`Meta anual ${formatCurrency(CREDITO_ANUAL_TARGET)}`} tone="warn" />
                <BadgePill
                  label={`Total mês ${formatCurrency(receitaCreditoRows.reduce((acc, r) => acc + r.valorMes, 0))}`}
                  tone="success"
                />
                <BadgePill
                  label={`Total ano ${formatCurrency(receitaCreditoRows.reduce((acc, r) => acc + r.valorAno, 0))}`}
                  tone="success"
                />
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                      <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                        <th className="py-3 px-4 font-medium">Assessor</th>
                        <th className="py-3 px-4 font-medium">Time</th>
                        <th className="py-3 px-4 font-medium text-right">Mês</th>
                        <th className="py-3 px-4 font-medium text-right">Ano</th>
                        <th className="py-3 px-4 font-medium text-right">% mês</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {receitaCreditoRows.map((r) => (
                        <tr key={r.cod_assessor} className="text-sm">
                          <td className="py-3 px-4">
                            <div className="text-white/85 font-data text-xs">{r.nome_assessor}</div>
                            <div className="text-white/40 font-data text-[10px] uppercase tracking-widest">
                              AAI-{r.cod_assessor}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-white/70 font-data text-xs">{r.time}</td>
                          <td className="py-3 px-4 text-right text-white/80 font-data text-xs">
                            {formatCurrency(r.valorMes)}
                          </td>
                          <td className="py-3 px-4 text-right text-white/80 font-data text-xs">
                            {formatCurrency(r.valorAno)}
                          </td>
                          <td className="py-3 px-4 text-right text-white font-display text-xs">
                            {fmtPct(r.pctMes)}
                          </td>
                        </tr>
                      ))}
                      {receitaCreditoRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                            Nenhum assessor encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
