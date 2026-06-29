import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Trophy, Users, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RankingScope = "assessor" | "time";

type AssessorFilterItem = {
  id: string;
  name: string;
  teams: string[];
};

type ProductKey = "renda_variavel" | "alocacao" | "banco" | "seguros";

type Criterion = {
  key: string;
  label: string;
  weight: number;
  objective: number;
  kind: "percent" | "currency" | "count" | "ratio";
};

type ProductConfig = {
  key: ProductKey;
  title: string;
  subtitle: string;
  legend: string;
  eligibility: string;
  criteria: Criterion[];
};

const PRODUCT_CONFIGS: ProductConfig[] = [
  {
    key: "renda_variavel",
    title: "Renda Variável",
    subtitle: "KPIs - Direcionador estratégico",
    legend: "Clientes com estoque em PE",
    eligibility: "Atingir 70% do número de pontos válidos + 80% de E-NPS",
    criteria: [
      { key: "penetracao_aai_pe", label: "Penetração AAI | PE", weight: 0.3, objective: 1, kind: "percent" },
      { key: "penetracao_clientes", label: "Penetração Clientes", weight: 0.3, objective: 0.5, kind: "percent" },
      { key: "roa_rv", label: "ROA RV (B3 + PE)", weight: 0.4, objective: 0.007, kind: "ratio" },
    ],
  },
  {
    key: "alocacao",
    title: "Alocação",
    subtitle: "KPIs - Direcionador estratégico",
    legend: "Custódia em estoque nos clientes 3 estrelas",
    eligibility: "Atingir 70% do número de pontos válidos + 80% de E-NPS",
    criteria: [
      { key: "penetracao_ais_3_estrelas", label: "% Penetração AIs - Clientes 3 estrelas", weight: 0.3, objective: 0.75, kind: "percent" },
      { key: "penetracao_clientes_3_estrelas", label: "% Penetração Clientes 3 estrelas", weight: 0.2, objective: 0.6, kind: "percent" },
      { key: "roa_geral", label: "ROA Geral", weight: 0.5, objective: 0.01, kind: "ratio" },
    ],
  },
  {
    key: "banco",
    title: "Banco",
    subtitle: "KPIs - Direcionador estratégico",
    legend: "Uma venda de consórcios no tri para cada assessor",
    eligibility: "Atingir 70% do número de pontos válidos + 80% de E-NPS",
    criteria: [
      { key: "penetracao_aai_credito", label: "Penetração AAI/Crédito", weight: 0.3, objective: 1, kind: "percent" },
      { key: "receita_credito", label: "Receita em Crédito", weight: 0.5, objective: 1_200_000, kind: "currency" },
      { key: "abertura_contas_pj", label: "Abertura Contas PJ", weight: 0.2, objective: 48, kind: "count" },
    ],
  },
  {
    key: "seguros",
    title: "Seguros",
    subtitle: "KPIs - Direcionador estratégico",
    legend: "Uma venda de seguros no tri para cada assessor",
    eligibility: "Atingir 70% do número de pontos válidos + 80% de E-NPS",
    criteria: [
      { key: "penetracao_aai_seguros", label: "Penetração AAI/Seguros", weight: 0.3, objective: 1, kind: "percent" },
      { key: "receita_seguros", label: "Receita", weight: 0.5, objective: 960_000, kind: "currency" },
      { key: "qtd_apolices", label: "Qtd Apólices vendidas", weight: 0.2, objective: 144, kind: "count" },
    ],
  },
];

function clamp(min: number, v: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}

function formatRatio(v: number) {
  return `${(v * 100).toFixed(2).replace(".", ",")}%`;
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toLocaleString("pt-BR");
}

function formatValue(kind: Criterion["kind"], v: number) {
  if (kind === "percent") return formatPercent(v);
  if (kind === "ratio") return formatRatio(v);
  if (kind === "currency") return formatCurrency(v);
  return v.toLocaleString("pt-BR");
}

function generateActual(criterion: Criterion, seedKey: string) {
  const r = mulberry32(hashString(seedKey))();

  if (criterion.kind === "percent") {
    if (criterion.objective >= 1) return clamp(0.35, 0.6 + r * 0.55, 1.15);
    return clamp(0.05, criterion.objective * (0.5 + r * 1.2), 1);
  }

  if (criterion.kind === "ratio") {
    return clamp(0, criterion.objective * (0.45 + r * 1.1), criterion.objective * 1.35);
  }

  if (criterion.kind === "currency") {
    return clamp(0, criterion.objective * (0.45 + r * 1.25), criterion.objective * 1.5);
  }

  return Math.round(clamp(0, criterion.objective * (0.4 + r * 1.4), criterion.objective * 1.8));
}

type CriterionResult = {
  criterion: Criterion;
  actual: number;
  objective: number;
  scoreWeighted: number;
};

type ProductResult = {
  config: ProductConfig;
  criteria: CriterionResult[];
  score: number;
};

type EntityResult = {
  totalScore: number;
  products: Record<ProductKey, ProductResult>;
};

type RaceEntity = {
  id: string;
  label: string;
  team?: string;
};

type RaceRow = {
  id: string;
  label: string;
  team?: string;
  score: number;
};

type Frame = {
  key: string;
  label: string;
  rowsByScope: {
    assessor: RaceRow[];
    time: RaceRow[];
  };
  resultsByScope: {
    assessor: Record<string, EntityResult>;
    time: Record<string, EntityResult>;
  };
};

function computeEntityResult(entityId: string, frameKey: string): EntityResult {
  const products = Object.fromEntries(
    PRODUCT_CONFIGS.map((config) => {
      const criteria = config.criteria.map((criterion) => {
        const actual = generateActual(criterion, `${frameKey}:${entityId}:${config.key}:${criterion.key}`);
        const ratio = criterion.objective > 0 ? actual / criterion.objective : 0;
        const scoreWeighted = clamp(0, Math.min(ratio, 1) * criterion.weight, 1);
        return { criterion, actual, objective: criterion.objective, scoreWeighted };
      });

      const score = criteria.reduce((acc, c) => acc + c.scoreWeighted, 0) * 100;
      return [config.key, { config, criteria, score }] as const;
    }),
  ) as Record<ProductKey, ProductResult>;

  const totalScore = Object.values(products).reduce((acc, p) => acc + p.score, 0);
  return { totalScore, products };
}

function aggregateResults(results: EntityResult[]) {
  if (!results.length) return null;

  const totalScore = results.reduce((acc, r) => acc + r.totalScore, 0) / results.length;
  const products = Object.fromEntries(
    PRODUCT_CONFIGS.map((config) => {
      const criteria = config.criteria.map((criterion) => {
        const actual = results.reduce((acc, r) => acc + r.products[config.key].criteria.find((c) => c.criterion.key === criterion.key)!.actual, 0) / results.length;
        const objective = criterion.objective;
        const ratio = objective > 0 ? actual / objective : 0;
        const scoreWeighted = clamp(0, Math.min(ratio, 1) * criterion.weight, 1);
        return { criterion, actual, objective, scoreWeighted };
      });

      const score = criteria.reduce((acc, c) => acc + c.scoreWeighted, 0) * 100;
      return [config.key, { config, criteria, score }] as const;
    }),
  ) as Record<ProductKey, ProductResult>;

  return { totalScore, products } as EntityResult;
}

function deriveMainTeam(assessor: AssessorFilterItem, selectedTeam: string[]) {
  if (!assessor.teams?.length) return undefined;
  if (!selectedTeam.length) return assessor.teams[0];
  const match = assessor.teams.find((t) => selectedTeam.includes(t));
  return match ?? assessor.teams[0];
}

function getDefaultMonths(selectedYear: string) {
  return Array.from({ length: 6 }).map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, "0")}-01`);
}

type ManagementSuperRankingProps = {
  selectedYear: string;
  selectedMonth: string;
  filteredMonths: string[];
  selectedTeam: string[];
  selectedAssessorId: string[];
  assessors: AssessorFilterItem[];
};

export default function ManagementSuperRanking({
  selectedYear,
  selectedMonth,
  filteredMonths,
  selectedTeam,
  selectedAssessorId,
  assessors,
}: ManagementSuperRankingProps) {
  const [scope, setScope] = useState<RankingScope>("assessor");
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [focused, setFocused] = useState<{ scope: RankingScope; id: string } | null>(null);

  const months = useMemo(() => {
    const raw = (filteredMonths?.length ? filteredMonths : getDefaultMonths(selectedYear)).slice();
    raw.sort();
    return raw;
  }, [filteredMonths, selectedYear]);

  useEffect(() => {
    if (!months.length) return;
    const idx = selectedMonth ? months.indexOf(selectedMonth) : -1;
    if (idx >= 0) setCurrentStep(idx);
  }, [months, selectedMonth]);

  useEffect(() => {
    setFocused(null);
  }, [scope, selectedTeam.join("|"), selectedAssessorId.join("|")]);

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && months.length > 1) {
      interval = window.setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % months.length);
      }, 5000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isPlaying, months.length]);

  const visibleAssessors = useMemo(() => {
    let items = assessors;
    if (selectedTeam.length) items = items.filter((a) => a.teams?.some((t) => selectedTeam.includes(t)));
    if (selectedAssessorId.length) items = items.filter((a) => selectedAssessorId.includes(a.id));
    return items;
  }, [assessors, selectedTeam, selectedAssessorId]);

  const assessorEntities = useMemo(() => {
    return visibleAssessors.map((a) => ({
      id: a.id,
      label: a.name,
      team: deriveMainTeam(a, selectedTeam),
    })) satisfies RaceEntity[];
  }, [visibleAssessors, selectedTeam]);

  const teamEntities = useMemo(() => {
    const map = new Map<string, RaceEntity>();
    visibleAssessors.forEach((a) => {
      const t = deriveMainTeam(a, selectedTeam);
      if (!t) return;
      if (!map.has(t)) map.set(t, { id: t, label: t });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleAssessors, selectedTeam]);

  const frames = useMemo(() => {
    const frameKeyList = months.length ? months : getDefaultMonths(selectedYear);

    return frameKeyList.map((m) => {
      const label = format(parseISO(m), "MMM yyyy", { locale: ptBR });

      const assessorResults: Record<string, EntityResult> = {};
      assessorEntities.forEach((e) => {
        assessorResults[e.id] = computeEntityResult(e.id, m);
      });

      const teamResults: Record<string, EntityResult> = {};
      teamEntities.forEach((t) => {
        const members = assessorEntities.filter((a) => a.team === t.id);
        const memberResults = members.map((a) => assessorResults[a.id]).filter(Boolean);
        const agg = aggregateResults(memberResults);
        if (agg) teamResults[t.id] = agg;
      });

      const assessorRows = assessorEntities
        .map((e) => ({ id: e.id, label: e.label, team: e.team, score: assessorResults[e.id]?.totalScore ?? 0 }))
        .sort((a, b) => b.score - a.score);

      const teamRows = teamEntities
        .map((e) => ({ id: e.id, label: e.label, score: teamResults[e.id]?.totalScore ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return {
        key: m,
        label,
        rowsByScope: { assessor: assessorRows, time: teamRows },
        resultsByScope: { assessor: assessorResults, time: teamResults },
      } satisfies Frame;
    });
  }, [assessorEntities, teamEntities, months, selectedYear]);

  const currentFrame = frames[Math.min(currentStep, Math.max(frames.length - 1, 0))];
  const currentRows = currentFrame?.rowsByScope[scope] ?? [];
  const currentResults = currentFrame?.resultsByScope[scope] ?? {};

  const focusedResult = useMemo(() => {
    if (!currentFrame) return null;
    if (focused && focused.scope === scope) return currentResults[focused.id] ?? null;
    const sample = currentRows.slice(0, 50).map((r) => currentResults[r.id]).filter(Boolean);
    return aggregateResults(sample);
  }, [currentFrame, currentResults, focused, scope, currentRows]);

  const totalScore = focusedResult?.totalScore ?? 0;

  const focusLabel = useMemo(() => {
    if (!focused || focused.scope !== scope) return "Visão Geral";
    const row = currentRows.find((r) => r.id === focused.id);
    return row?.label ?? "Visão Geral";
  }, [focused, scope, currentRows]);

  const topRows = useMemo(() => {
    if (!currentRows.length) return [];
    const limit = 25;
    const sliced = currentRows.slice(0, limit);
    if (focused && focused.scope === scope && !sliced.some((r) => r.id === focused.id)) {
      const row = currentRows.find((r) => r.id === focused.id);
      if (row) sliced.push(row);
    }
    return sliced;
  }, [currentRows, focused, scope]);

  return (
    <div className="space-y-6 sm:space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-euro-gold/10 border border-euro-gold/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-euro-gold" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display text-[#F5F5F0] tracking-wide">
              Superranking Gerencial
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-data uppercase tracking-widest text-euro-gold/70">
                Dados mockados
              </span>
              <span className="text-xs font-data uppercase tracking-widest text-white/40">
                {currentFrame?.label ?? ""}
              </span>
              <span className="text-xs font-data uppercase tracking-widest text-white/40">
                Foco: {focusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0F1218]/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-2xl w-fit">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScope("assessor")}
              className={cn(
                "rounded-full h-8 px-4 text-[10px] font-data uppercase tracking-widest transition-all",
                scope === "assessor" ? "bg-white/10 text-white" : "text-[#A0A090] hover:text-white hover:bg-white/5",
              )}
            >
              <User className="w-3 h-3 mr-2 text-euro-gold/80" />
              Assessor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScope("time")}
              className={cn(
                "rounded-full h-8 px-4 text-[10px] font-data uppercase tracking-widest transition-all",
                scope === "time" ? "bg-white/10 text-white" : "text-[#A0A090] hover:text-white hover:bg-white/5",
              )}
            >
              <Users className="w-3 h-3 mr-2 text-euro-gold/80" />
              Time
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {focused && focused.scope === scope && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFocused(null)}
                className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 h-8"
                title="Limpar foco"
              >
                <X className="w-3 h-3 mr-2" />
                <span className="text-[10px] font-data uppercase tracking-wider">Limpar</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[#A0A090] hover:text-euro-gold hover:bg-white/5 rounded-full"
              onClick={() => setCurrentStep(0)}
              title="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full transition-all duration-300",
                isPlaying ? "bg-euro-gold/10 text-euro-gold hover:bg-euro-gold/20" : "text-[#A0A090] hover:text-white hover:bg-white/5",
              )}
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {PRODUCT_CONFIGS.map((product) => {
          const productResult = focusedResult?.products[product.key];
          const score = productResult?.score ?? 0;
          const progress = clamp(0, score / 100, 1);

          return (
            <Card
              key={product.key}
              className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-data uppercase tracking-widest text-white/50">
                      Card Principal
                    </div>
                    <div className="text-base sm:text-lg font-display text-[#F5F5F0] tracking-wide">
                      {product.title}
                    </div>
                    <div className="text-[10px] font-data uppercase tracking-widest text-euro-gold/70">
                      {product.subtitle}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-data uppercase tracking-widest text-white/40">
                      Score
                    </div>
                    <div className="text-2xl font-display text-euro-gold">
                      {score.toFixed(0)}
                    </div>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-euro-gold/40 to-euro-gold"
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 16 }}
                  />
                </div>

                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1fr_72px_72px_64px] bg-white/[0.04] text-[10px] font-data uppercase tracking-widest text-white/50">
                    <div className="px-3 py-2">Critérios</div>
                    <div className="px-3 py-2 text-right">Atual</div>
                    <div className="px-3 py-2 text-right">Objetivo</div>
                    <div className="px-3 py-2 text-right">Peso</div>
                  </div>
                  <div className="divide-y divide-white/[0.06] text-xs">
                    {productResult?.criteria?.map((c) => (
                      <div
                        key={c.criterion.key}
                        className="grid grid-cols-[1fr_72px_72px_64px] items-center"
                      >
                        <div className="px-3 py-2 text-white/80 font-ui leading-snug">
                          {c.criterion.label}
                        </div>
                        <div className="px-3 py-2 text-right font-data text-white">
                          {formatValue(c.criterion.kind, c.actual)}
                        </div>
                        <div className="px-3 py-2 text-right font-data text-white/70">
                          {formatValue(c.criterion.kind, c.objective)}
                        </div>
                        <div className="px-3 py-2 text-right font-data text-white/70">
                          {Math.round(c.criterion.weight * 100)}%
                        </div>
                      </div>
                    ))}
                    {!productResult?.criteria?.length && (
                      <div className="px-3 py-6 text-center text-xs font-data text-white/40 uppercase tracking-widest">
                        Sem dados para exibir
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] text-[10px] font-data uppercase tracking-widest">
                    <span className="text-white/50">Total</span>
                    <span className="text-white/70">100%</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-[10px] font-data uppercase tracking-widest text-emerald-300/90">
                    Elegibilidade
                  </div>
                  <div className="text-xs font-ui text-white/80 mt-1">
                    {product.eligibility}
                  </div>
                </div>

                <div className="text-[10px] font-data uppercase tracking-widest text-white/40">
                  Legenda Penetração
                </div>
                <div className="text-xs font-ui text-white/70">
                  {product.legend}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 space-y-2">
              <div className="text-[10px] font-data uppercase tracking-widest text-white/50">
                Score Total
              </div>
              <div className="text-4xl font-display text-euro-gold">
                {totalScore.toFixed(0)}
              </div>
              <div className="text-xs font-ui text-white/60">
                Soma dos 4 cards (0–400). O layout e a lógica estão mockados para validação.
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-8">
          <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-data uppercase tracking-widest text-white/50">
                  Ranking Race
                </div>
                <div className="text-sm font-data uppercase tracking-[0.2em] text-euro-gold/80">
                  {scope === "assessor" ? "Por assessor" : "Por time"}
                </div>
              </div>
              <div className="text-[10px] font-data uppercase tracking-widest text-white/40">
                {topRows.length} itens
              </div>
            </div>

            <div className="p-5">
              {!currentFrame ? (
                <div className="py-10 text-center text-xs font-data text-white/40 uppercase tracking-widest">
                  Preparando ranking...
                </div>
              ) : topRows.length === 0 ? (
                <div className="py-10 text-center text-xs font-data text-white/40 uppercase tracking-widest">
                  Nenhum item para exibir com os filtros atuais
                </div>
              ) : (
                <div className="max-h-[640px] overflow-y-auto custom-scrollbar pr-2">
                  <div style={{ height: topRows.length * 52 }} className="relative">
                    <AnimatePresence mode="popLayout">
                      {topRows.map((row, index) => {
                        const isFocused = focused?.scope === scope && focused?.id === row.id;
                        const widthPercentage = currentRows[0]?.score ? (row.score / currentRows[0].score) * 100 : 0;

                        return (
                          <motion.button
                            key={row.id}
                            layout
                            initial={{ opacity: 0, x: -30 }}
                            animate={{
                              opacity: 1,
                              x: 0,
                              y: index * 52,
                              scale: isFocused ? 1.02 : 1,
                              zIndex: isFocused ? 50 : 10 - index,
                            }}
                            exit={{ opacity: 0, x: 30 }}
                            transition={{ type: "spring", stiffness: 90, damping: 22, mass: 1 }}
                            className={cn(
                              "absolute left-0 w-full flex items-center gap-4 text-left focus:outline-none",
                              isFocused && "z-50",
                            )}
                            style={{ height: 44 }}
                            onClick={() => setFocused({ scope, id: row.id })}
                            type="button"
                          >
                            <div className="w-8 flex justify-center shrink-0">
                              <div
                                className={cn(
                                  "text-sm font-display w-6 h-6 flex items-center justify-center rounded-full border transition-all duration-300",
                                  index === 0
                                    ? "bg-yellow-400 text-black border-yellow-400 scale-125 shadow-[0_0_15px_rgba(250,204,21,0.6)]"
                                    : index === 1
                                      ? "bg-gray-300 text-black border-gray-300 scale-110 shadow-[0_0_10px_rgba(209,213,219,0.5)]"
                                      : index === 2
                                        ? "bg-amber-700 text-white border-amber-700 scale-105 shadow-[0_0_10px_rgba(180,83,9,0.5)]"
                                        : isFocused
                                          ? "bg-euro-gold text-euro-navy border-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.5)]"
                                          : "bg-white/5 text-white/40 border-white/10",
                                )}
                              >
                                {currentRows.findIndex((r) => r.id === row.id) + 1}
                              </div>
                            </div>

                            <div className="flex-1 relative h-full flex flex-col justify-center">
                              <div className="flex justify-between items-end mb-1 pr-4 gap-3">
                                <div className="min-w-0">
                                  <div className={cn("text-sm font-display truncate", isFocused ? "text-euro-gold" : "text-white/80")}>
                                    {row.label}
                                  </div>
                                  {row.team && scope === "assessor" && (
                                    <div className="text-[10px] font-data uppercase tracking-widest text-white/40 truncate">
                                      {row.team}
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm font-data text-white">
                                  {row.score.toFixed(0)}
                                </div>
                              </div>

                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                                <motion.div
                                  className={cn(
                                    "h-full rounded-full relative",
                                    index === 0
                                      ? "bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                                      : index === 1
                                        ? "bg-gradient-to-r from-gray-500 to-gray-300"
                                        : index === 2
                                          ? "bg-gradient-to-r from-amber-800 to-amber-600"
                                          : isFocused
                                            ? "bg-gradient-to-r from-euro-gold/50 to-euro-gold shadow-[0_0_15px_rgba(250,192,23,0.5)]"
                                            : "bg-white/20 group-hover:bg-white/30",
                                  )}
                                  animate={{ width: `${clamp(0, widthPercentage, 100)}%` }}
                                  transition={{ type: "spring", stiffness: 50, damping: 15 }}
                                >
                                  {(index < 3 || isFocused) && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2 h-full skew-x-12 animate-shimmer" />
                                  )}
                                </motion.div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
