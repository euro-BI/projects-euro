import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AssessorResumo } from "@/types/dashboard";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, ComposedChart, Cell, PieChart, Pie, BarChart, Bar
} from 'recharts';
import {
  TrendingUp,
  Calculator,
  BrainCircuit,
  Target,
  HelpCircle,
  X,
  ArrowRight,
  MousePointerClick,
  Info,
  Users,
  Building2,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { RevenueDistribution } from "./RevenueDistribution";
import { PRODUCT_KEYS, REPASSE_CONFIG } from "@/constants/revenue";
import { AdvisorSimulator } from "./AdvisorSimulator";

interface ForecastAnalysisProps {
  data: AssessorResumo[];
  selectedYear: string;
  userRole?: string;
  userCode?: string | null;
  effectiveAssessorId?: string;
}

const COLORS = [
  "#FAFAFA", // Branco
  "#C0A055", // Euro Gold
  "#A0A090", // Cinza Euro
  "#5C5C50", // Cinza Escuro
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#D946EF", // Fuchsia
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#6366F1", // Indigo
];



export default function ForecastAnalysis({ data, selectedYear, userRole, userCode, effectiveAssessorId }: ForecastAnalysisProps) {
  const [activeMode, setActiveMode] = useState<"temporal" | "causal" | "advisor">(userRole === 'user' ? "advisor" : "temporal");
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (userRole === 'user') {
      setActiveMode('advisor');
    }
  }, [userRole]);

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display text-euro-gold flex items-center gap-2">
            <BrainCircuit className="w-6 h-6" />
            {userRole === 'user' ? 'Simulador de Repasse' : 'Euro Intelligence Forecast'}
          </h2>
          <p className="text-sm font-ui text-[#A0A090]">
            {userRole === 'user' ? 'Simule seus ganhos e planeje suas metas.' : 'Análise preditiva e simulação de cenários de receita.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTutorial(!showTutorial)}
            className={cn(
              "text-xs font-data uppercase tracking-wider transition-all gap-2",
              showTutorial ? "text-euro-gold bg-euro-gold/10" : "text-[#A0A090] hover:text-white"
            )}
          >
            {showTutorial ? <X className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
            {showTutorial ? "Fechar Guia" : "Como funciona?"}
          </Button>

          {userRole !== 'user' && (
            <div className="bg-euro-elevated/50 p-1 rounded-lg border border-white/10 flex gap-1">
              <Button
                variant={activeMode === "temporal" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveMode("temporal")}
                className={cn(
                  "font-data text-xs uppercase tracking-wider transition-all",
                  activeMode === "temporal" ? "bg-euro-gold text-euro-navy hover:bg-euro-gold/90" : "text-[#A0A090] hover:text-white"
                )}
              >
                <TrendingUp className="w-3 h-3 mr-2" />
                Série Temporal
              </Button>
              <Button
                variant={activeMode === "causal" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveMode("causal")}
                className={cn(
                  "font-data text-xs uppercase tracking-wider transition-all",
                  activeMode === "causal" ? "bg-euro-gold text-euro-navy hover:bg-euro-gold/90" : "text-[#A0A090] hover:text-white"
                )}
              >
                <Calculator className="w-3 h-3 mr-2" />
                Simulador Causal
              </Button>
              <Button
                variant={activeMode === "advisor" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveMode("advisor")}
                className={cn(
                  "font-data text-xs uppercase tracking-wider transition-all",
                  activeMode === "advisor" ? "bg-euro-gold text-euro-navy hover:bg-euro-gold/90" : "text-[#A0A090] hover:text-white"
                )}
              >
                <Wallet className="w-3 h-3 mr-2" />
                Simulador de Repasse
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden min-h-[600px] relative">
        <CardContent className="p-6 md:p-8">
          {showTutorial ? (
            <TutorialMode activeMode={activeMode} onClose={() => setShowTutorial(false)} />
          ) : (
            activeMode === "temporal" ? (
              <TemporalAnalysis data={data} />
            ) : activeMode === "causal" ? (
              <CausalSimulator data={data} />
            ) : (
              (userRole !== 'user' && (!effectiveAssessorId || effectiveAssessorId === 'all')) ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-euro-gold/10 flex items-center justify-center animate-pulse">
                    <Users className="w-8 h-8 text-euro-gold" />
                  </div>
                  <h3 className="text-xl font-display text-white">Selecione um Assessor</h3>
                  <p className="text-sm text-white/60 max-w-md">
                    Para utilizar o Simulador de Repasse, é necessário selecionar um assessor específico no filtro acima. A simulação individual requer dados históricos exclusivos.
                  </p>
                </div>
              ) : (
                <AdvisorSimulator data={data} userCode={userCode} userRole={userRole} />
              )
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- COMPONENTE DE TUTORIAL ---

function TutorialMode({ activeMode, onClose }: { activeMode: "temporal" | "causal" | "advisor", onClose: () => void }) {
  if (activeMode === "temporal") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-euro-gold/20 text-euro-gold">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-display text-white">Guia: Série Temporal</h3>
              <p className="text-sm text-white/60">Aprenda a prever o futuro com dados.</p>
            </div>
          </div>

          <div className="space-y-4">
            <TutorialStep
              number={1}
              title="Defina o Passado (Base Histórica)"
              desc="Use o primeiro slider para dizer ao sistema quantos meses para trás ele deve olhar. Se você escolher 6 meses, ele vai analisar a tendência da sua receita nos últimos 6 meses. (Desconsiderando o mês vigente)"
            />
            <TutorialStep
              number={2}
              title="Escolha o Futuro (Projeção)"
              desc="Use o segundo slider para definir até onde você quer ver. O sistema vai traçar uma linha tracejada azul mostrando a previsão matemática para os próximos meses."
            />
            <TutorialStep
              number={3}
              title="Entenda o Gráfico"
              desc="A linha DOURADA é o que realmente aconteceu. A linha AZUL TRACEJADA é a previsão. Se a linha azul estiver subindo, sua tendência é de alta!"
            />
            <TutorialStep
              number={4}
              title="Analise os Indicadores"
              desc="No rodapé, o sistema calcula automaticamente o impacto financeiro. Ele te diz se você vai ganhar mais ou menos dinheiro do que a sua média atual."
            />
          </div>

          <Button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 text-white w-full border border-white/5">
            Entendi, quero testar!
          </Button>
        </div>

        <div className="relative bg-black/40 rounded-xl border border-white/10 p-6 flex items-center justify-center overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-euro-gold/5 to-cyan-500/5" />

          {/* Abstract Visual Representation */}
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 opacity-80 group-hover:opacity-100 transition-opacity">
            <div className="flex items-end gap-1 h-32 w-full max-w-[300px] justify-between">
              {[40, 50, 45, 60, 75, 90].map((h, i) => (
                <div key={i} className="w-8 bg-euro-gold rounded-t-sm animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
              ))}
              {[95, 100, 110].map((h, i) => (
                <div key={i} className="w-8 border-2 border-dashed border-cyan-400 rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="text-xs font-mono text-cyan-400 mt-4 animate-bounce">Projeção Futura Detectada</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeMode === "advisor") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-euro-gold/20 text-euro-gold">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-display text-white">Guia: Simulador de Repasse</h3>
              <p className="text-sm text-white/60">Calcule quanto precisa vender para atingir seu objetivo financeiro.</p>
            </div>
          </div>

          <div className="space-y-4">
            <TutorialStep
              number={1}
              title="Defina sua Meta Líquida"
              desc="Digite quanto você quer RECEBER de comissão no final do mês. O sistema fará a engenharia reversa para você."
            />
            <TutorialStep
              number={2}
              title="Entenda a Receita Necessária"
              desc="O sistema calculará automaticamente quanto de receita bruta você precisa gerar, baseado no seu histórico de vendas (mix de produtos)."
            />
            <TutorialStep
              number={3}
              title="Otimize seu Mix"
              desc="Arraste os sliders para simular diferentes cenários. Foque em produtos com maior repasse (como Seguros e Consórcios) para atingir sua meta vendendo menos!"
            />
          </div>

          <Button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 text-white w-full border border-white/5">
            Entendi, quero ganhar dinheiro!
          </Button>
        </div>

        <div className="relative bg-black/40 rounded-xl border border-white/10 p-6 flex items-center justify-center overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-euro-gold/5 to-emerald-500/5" />

          <div className="relative flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full border-4 border-euro-gold/20 flex items-center justify-center animate-pulse">
              <Wallet className="w-12 h-12 text-euro-gold" />
            </div>
            <p className="text-sm font-data text-emerald-400 animate-bounce">Meta Atingida!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-euro-gold/20 text-euro-gold">
            <Calculator className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-display text-white">Guia: Simulador Causal</h3>
            <p className="text-sm text-white/60">Crie cenários e metas personalizadas.</p>
          </div>
        </div>

        <div className="space-y-4">
          <TutorialStep
            number={1}
            title="Defina sua Meta Global"
            desc="Digite no campo grande o valor total que você QUER faturar (ex: R$ 500.000). O sistema vai distribuir esse valor automaticamente entre seus produtos baseado no seu histórico."
          />
          <TutorialStep
            number={2}
            title="Ajuste Fino por Produto"
            desc="Quer focar mais em Seguros? Vá na lista e arraste o slider de Seguros para aumentar a meta dele. O valor total será recalculado automaticamente."
          />
          <TutorialStep
            number={3}
            title="Visualize a Distribuição"
            desc="O gráfico de distribuição mostra visualmente o quanto dessa receita vai para os Assessores (Repasse) e quanto fica para o Administrativo (House)."
          />
        </div>

        <Button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 text-white w-full border border-white/5">
          Entendi, vamos simular!
        </Button>
      </div>

      <div className="relative bg-black/40 rounded-xl border border-white/10 p-6 flex items-center justify-center overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-euro-gold/5 to-purple-500/5" />

        <div className="relative w-64 h-64">
          <div className="absolute inset-0 rounded-full border-8 border-white/5 animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border-8 border-euro-gold/20 border-t-euro-gold animate-[spin_3s_ease-in-out_infinite]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <MousePointerClick className="w-12 h-12 text-white/50 mb-2" />
            <span className="text-sm font-data text-white/50">Interativo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorialStep({ number, title, desc }: { number: number, title: string, desc: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-euro-gold text-euro-navy font-bold flex items-center justify-center font-mono">
        {number}
      </div>
      <div>
        <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
        <p className="text-xs text-white/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// --- COMPONENTE DE EXPLICAÇÃO MÁGICA (MODAL) ---

function MagicExplanation({
  title,
  formula,
  explanation,
  example
}: {
  title: string,
  formula: string,
  explanation: string,
  example: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-white/20 hover:text-euro-gold transition-colors p-1">
          <Info className="w-3 h-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f172a]/95 backdrop-blur-xl border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display text-euro-gold flex items-center gap-2">
            <BrainCircuit className="w-6 h-6" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Entenda a ciência por trás do número.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-black/40 p-4 rounded-lg border border-white/5">
            <span className="text-xs font-mono text-cyan-400 uppercase mb-2 block">A Fórmula Mágica</span>
            <code className="text-sm font-mono text-white block bg-white/5 p-3 rounded border border-white/5 whitespace-pre-wrap">
              {formula}
            </code>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white">O que isso significa?</h4>
            <p className="text-sm text-white/70 leading-relaxed">
              {explanation}
            </p>
          </div>

          <div className="bg-euro-gold/10 p-4 rounded-lg border border-euro-gold/20">
            <h4 className="text-sm font-bold text-euro-gold mb-2">Exemplo Real com seus Dados:</h4>
            {example}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- SUB-COMPONENTE: SÉRIE TEMPORAL ---

function TemporalAnalysis({ data }: { data: AssessorResumo[] }) {
  const [lookback, setLookback] = useState(6);
  const [projection, setProjection] = useState(6);

  // Prepara dados históricos
  const historyData = useMemo(() => {
    // Agrupa por mês e soma receita
    const grouped = data.reduce((acc, curr) => {
      const date = curr.data_posicao;
      if (!acc[date]) acc[date] = 0;
      acc[date] += curr.receita_total;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, value]) => ({ date, value, type: 'history' }));
  }, [data]);

  // Extrai o valor real do mês atual (que é o último registro antes da consolidação)
  const currentMonthReal = useMemo(() => {
    if (historyData.length === 0) return null;
    const lastPoint = historyData[historyData.length - 1];
    return {
      date: lastPoint.date,
      value: lastPoint.value
    };
  }, [historyData]);

  // Lógica de Projeção e Preparação de Dados para o Gráfico
  const chartData = useMemo(() => {
    if (historyData.length < 2) return [];

    // MODIFICAÇÃO: Desconsiderar o mês atual (último ponto) como base de cálculo
    // O histórico consolidado vai até o penúltimo mês.
    const consolidatedHistory = historyData.slice(0, -1);
    const lastConsolidatedDate = parseISO(consolidatedHistory[consolidatedHistory.length - 1].date);

    // 1. Calcula Regressão Linear baseada nos últimos X meses consolidando (lookback)
    const baseData = consolidatedHistory.slice(-lookback);
    const n = baseData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    baseData.forEach((point, i) => {
      sumX += i;
      sumY += point.value;
      sumXY += i * point.value;
      sumXX += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 2. Prepara dados unificados para o Recharts
    // Estrutura: { date, valueReal, valueProj }
    const combinedData = consolidatedHistory.map(item => ({
      date: item.date,
      valueReal: item.value,
      valueProj: null as number | null
    }));

    // Identify the current month (the one excluded from consolidated)
    const currentMonthPoint = historyData[historyData.length - 1];

    // 3. Gera pontos futuros (incluindo o mês atual que foi excluído do histórico real)
    // O loop começa em 1, onde i=1 representa o "mês atual" que foi removido
    for (let i = 1; i <= projection; i++) {
      const nextDate = addMonths(lastConsolidatedDate, i);
      const x = (n - 1) + i;
      const predictedValue = Math.max(0, slope * x + intercept);

      const dateStr = format(nextDate, 'yyyy-MM-dd');

      // No i=1 (mês atual), mostramos tanto o valor real acumulado quanto a projeção
      if (i === 1) {
        combinedData.push({
          date: dateStr,
          valueReal: currentMonthPoint.value,
          valueProj: predictedValue
        });
      } else {
        combinedData.push({
          date: dateStr,
          valueReal: null,
          valueProj: predictedValue
        });
      }
    }

    // Ponto de conexão: O último ponto real CONSOLIDADO também é o início da projeção
    // Para que a linha de projeção seja contínua, ela deve começar no último ponto real.
    if (combinedData.length > 0) {
      const connectionPoint = combinedData.find(d => d.date === consolidatedHistory[consolidatedHistory.length - 1].date);
      if (connectionPoint) {
        // Marcamos como um valor especial que o formatter pode ignorar no tooltip
        (connectionPoint as any).isConnection = true;
        connectionPoint.valueProj = connectionPoint.valueReal;
      }
    }

    return combinedData;
  }, [historyData, lookback, projection]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(val);
  };

  // Calcula Média Projetada (somente a parte futura, excluindo o ponto de conexão se duplicado)
  const projectedValues = chartData.filter(d => d.valueReal === null && d.valueProj !== null);
  const totalProjected = projectedValues.reduce((acc, curr) => acc + (curr.valueProj || 0), 0);
  const avgProjected = projectedValues.length > 0 ? totalProjected / projectedValues.length : 0;

  // Valor projetado específico para o mês atual (primeiro ponto da projeção)
  const currentMonthProjectedValue = useMemo(() => {
    if (projectedValues.length === 0) return 0;
    return projectedValues[0].valueProj || 0;
  }, [projectedValues]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Controles */}
        <div className="lg:col-span-1 space-y-6 bg-black/20 p-6 rounded-xl border border-white/5 h-fit">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-data uppercase text-[#A0A090]">Base Histórica (Meses)</label>
              <Badge variant="outline" className="font-mono text-euro-gold border-euro-gold/30">{lookback}</Badge>
            </div>
            <Slider
              value={[lookback]}
              min={2}
              max={12}
              step={1}
              onValueChange={([v]) => setLookback(v)}
              className="py-4"
            />
            <p className="text-[10px] text-white/40 leading-tight">
              Considerar os últimos {lookback} meses para calcular a tendência de crescimento.
            </p>
          </div>

          <div className="w-full h-px bg-white/10" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-data uppercase text-[#A0A090]">Projeção (Meses)</label>
              <Badge variant="outline" className="font-mono text-cyan-400 border-cyan-400/30">{projection}</Badge>
            </div>
            <Slider
              value={[projection]}
              min={1}
              max={12}
              step={1}
              onValueChange={([v]) => setProjection(v)}
              className="py-4"
            />
            <p className="text-[10px] text-white/40 leading-tight">
              Projetar receita para os próximos {projection} meses.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-data uppercase text-white/60">Média Mensal (Projeção)</span>
                <MagicExplanation
                  title="Média Mensal Projetada"
                  formula="Σ (Receita Prevista Mês N) / Número de Meses"
                  explanation="É a média simples de quanto o sistema prevê que você vai faturar por mês no futuro. Ele soma todas as previsões e divide pelo número de meses."
                  example={
                    <div className="text-xs font-mono text-white/80">
                      <p>Soma Projetada: {formatCurrency(totalProjected)}</p>
                      <p>Meses: {projectedValues.length}</p>
                      <p className="mt-2 text-euro-gold font-bold">= {formatCurrency(avgProjected)} / mês</p>
                    </div>
                  }
                />
              </div>
              <p className="text-2xl font-display text-euro-gold">
                {formatCurrency(avgProjected)}
              </p>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="lg:col-span-3 min-h-[400px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-sm font-data uppercase tracking-widest text-white/60 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-euro-gold shadow-[0_0_8px_rgba(192,160,85,0.6)]" />
              Projeção de Receita
            </h3>

            {currentMonthReal && currentMonthProjectedValue > 0 && (
              <div className="flex items-center gap-2 text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full animate-in fade-in slide-in-from-right-2 duration-700">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                  LIVE INSIGHT:
                </span>
                <span className="text-white line-clamp-1">
                  {Math.min(100, (currentMonthReal.value / currentMonthProjectedValue) * 100).toFixed(0)}% da projeção de {format(parseISO(currentMonthReal.date), 'MMMM', { locale: ptBR })} atingida.
                </span>
                <span className="text-white hidden md:inline">
                  ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(currentMonthReal.value)} de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(currentMonthProjectedValue)})
                </span>
              </div>
            )}
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C0A055" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C0A055" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => format(parseISO(val), 'MMM/yy', { locale: ptBR })}
                stroke="#5C5C50"
                fontSize={12}
                tickMargin={10}
              />
              <YAxis
                stroke="#5C5C50"
                fontSize={12}
                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '12px' }}
                formatter={(value: number, name: string, props: any) => {
                  // Se for o ponto de conexão, não mostramos a "Projeção" duplicada no tooltip
                  if (props.payload.isConnection && name === "Projeção") return [null, null];
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label) => format(parseISO(label), "MMMM yyyy", { locale: ptBR })}
                itemSorter={(item) => (item.name === "Realizado" ? -1 : 1)}
              />

              <Area
                type="monotone"
                dataKey="valueReal"
                stroke="#C0A055"
                fill="url(#colorValue)"
                strokeWidth={2}
                name="Realizado"
                connectNulls={false}
              />

              <Area
                type="monotone"
                dataKey="valueProj"
                stroke="#22d3ee"
                strokeDasharray="5 5"
                fill="url(#colorProj)"
                strokeWidth={2}
                name="Projeção"
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <ForecastInsight
            data={chartData}
            lookback={lookback}
            projection={projection}
          />
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE: INSIGHT DO ANALISTA ---

function ForecastInsight({ data, lookback, projection }: { data: any[], lookback: number, projection: number }) {
  const insight = useMemo(() => {
    // Separa dados reais e projetados
    const realData = data.filter(d => d.valueReal !== null);
    const projData = data.filter(d => d.valueProj !== null);

    if (realData.length < 2 || projData.length === 0) return null;

    // 1. Calcula Média Histórica Recente (lookback) - Usando os dados reais consolidados
    const recentHistory = realData.slice(-lookback);
    const avgHistory = recentHistory.reduce((acc, curr) => acc + curr.valueReal, 0) / recentHistory.length;

    // 2. Calcula Média Projetada (apenas valores puramente projetados, sem histórico consolidado)
    const pureProjectedData = projData.filter(d => d.valueReal === null);
    const avgProjected = pureProjectedData.length > 0
      ? pureProjectedData.reduce((acc, curr) => acc + curr.valueProj, 0) / pureProjectedData.length
      : 0;

    // 3. Variação Percentual (Média Projetada vs Média Histórica)
    const variation = ((avgProjected - avgHistory) / avgHistory) * 100;

    // 4. Último Real Consolidado vs Último Projetado (Crescimento Total no período)
    const lastReal = realData[realData.length - 1].valueReal;
    const lastProj = projData[projData.length - 1].valueProj;
    const totalGrowth = ((lastProj - lastReal) / lastReal) * 100;

    // 5. Determina Viés e Intensidade
    let bias: "ALTA" | "BAIXA" | "NEUTRO" = "NEUTRO";
    let intensity: "forte" | "moderada" | "leve" = "leve";

    if (Math.abs(totalGrowth) > 20) intensity = "forte";
    else if (Math.abs(totalGrowth) > 5) intensity = "moderada";

    if (totalGrowth > 2) bias = "ALTA";
    else if (totalGrowth < -2) bias = "BAIXA";

    // 6. Impacto Financeiro Acumulado
    const totalFutureRevenue = pureProjectedData.reduce((acc, curr) => acc + curr.valueProj, 0);
    const totalBaselineRevenue = avgHistory * pureProjectedData.length;

    const financialImpact = totalFutureRevenue - totalBaselineRevenue;

    return {
      avgHistory,
      avgProjected,
      variation,
      totalGrowth,
      bias,
      intensity,
      financialImpact,
      monthsAnalyzed: lookback,
      monthsProjected: projection,
      lastReal,
      lastProj
    };
  }, [data, lookback, projection]);

  if (!insight) return null;

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(val);
  const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

  return (
    <div className="mt-8 relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10 p-6 animate-in fade-in slide-in-from-bottom-2 duration-1000">
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        insight.bias === "ALTA" ? "bg-emerald-500" : insight.bias === "BAIXA" ? "bg-red-500" : "bg-euro-gold"
      )} />

      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-4 h-4 text-euro-gold animate-pulse" />
        <span className="text-xs font-data uppercase tracking-widest text-white/60">Análise de Inteligência</span>
      </div>

      <div className="space-y-4">
        <p className="text-sm md:text-base font-display text-[#E8E8E0] leading-relaxed">
          Com base na regressão dos últimos <span className="text-euro-gold">{insight.monthsAnalyzed} meses</span>, identificamos uma tendência de <strong className={cn(
            insight.bias === "ALTA" ? "text-emerald-400" : insight.bias === "BAIXA" ? "text-red-400" : "text-white"
          )}>{insight.bias} {insight.intensity.toUpperCase()}</strong>.

          {insight.bias === "ALTA" && (
            <>
              Projeta-se uma aceleração de receita,
              {insight.financialImpact >= 0 ? (
                <> com um impacto financeiro positivo estimado em <strong className="text-emerald-400">{formatMoney(insight.financialImpact)}</strong> acima da média atual.</>
              ) : (
                <> porém com um impacto financeiro negativo estimado em <strong className="text-red-400">{formatMoney(Math.abs(insight.financialImpact))}</strong> abaixo da média atual.</>
              )}
            </>
          )}

          {insight.bias === "BAIXA" && (
            <> O modelo aponta uma retração estrutural. Se a tendência persistir, o impacto negativo acumulado será de <strong className="text-red-400">{formatMoney(Math.abs(insight.financialImpact))}</strong> frente à média histórica.</>
          )}

          {insight.bias === "NEUTRO" && (
            <> O cenário aponta para uma estabilidade de receita, mantendo-se próxima à média histórica de {formatMoney(insight.avgHistory)}.</>
          )}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-data uppercase text-white/40">Crescimento Projetado</span>
              <MagicExplanation
                title="Crescimento Projetado"
                formula="(Valor Final - Valor Inicial) / Valor Inicial"
                explanation="Mede a velocidade da sua evolução. Compara a sua receita de HOJE com a receita prevista para o ÚLTIMO MÊS da projeção."
                example={
                  <div className="text-xs font-mono text-white/80">
                    <p>Hoje: {formatMoney(insight.lastReal)}</p>
                    <p>Futuro: {formatMoney(insight.lastProj)}</p>
                    <p className={cn("mt-2 font-bold", insight.totalGrowth > 0 ? "text-emerald-400" : "text-red-400")}>
                      = {formatPercent(insight.totalGrowth)}
                    </p>
                  </div>
                }
              />
            </div>
            <p className={cn("text-lg font-mono", insight.totalGrowth > 0 ? "text-emerald-400" : "text-red-400")}>
              {formatPercent(insight.totalGrowth)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-data uppercase text-white/40">Média Histórica (Recente)</span>
              <MagicExplanation
                title="Média Histórica"
                formula="Σ (Receita Passada) / Meses Analisados"
                explanation={`É o seu 'normal' atual. Calculamos a média do que você faturou nos últimos ${insight.monthsAnalyzed} meses.`}
                example={
                  <div className="text-xs font-mono text-white/80">
                    <p>Base: Últimos {insight.monthsAnalyzed} meses</p>
                    <p className="mt-2 text-white font-bold">= {formatMoney(insight.avgHistory)} / mês</p>
                  </div>
                }
              />
            </div>
            <p className="text-lg font-mono text-white/70">{formatMoney(insight.avgHistory)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-data uppercase text-white/40">Média Projetada</span>
              <MagicExplanation
                title="Média Projetada"
                formula="Σ (Receita Futura) / Meses Projetados"
                explanation={`É o seu 'novo normal' esperado. Calculamos a média do que prevemos que você vai faturar nos próximos ${insight.monthsProjected} meses.`}
                example={
                  <div className="text-xs font-mono text-white/80">
                    <p>Base: Próximos {insight.monthsProjected} meses</p>
                    <p className="mt-2 text-white font-bold">= {formatMoney(insight.avgProjected)} / mês</p>
                  </div>
                }
              />
            </div>
            <p className="text-lg font-mono text-white">{formatMoney(insight.avgProjected)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-data uppercase text-white/40">Impacto Financeiro</span>
              <MagicExplanation
                title="Impacto Financeiro"
                formula="(Média Futura - Média Passada) * Meses"
                explanation="É dinheiro no bolso! Calcula o acumulado extra que você vai ganhar (ou deixar de ganhar) se essa tendência se confirmar, comparado a se você ficasse estagnado."
                example={
                  <div className="text-xs font-mono text-white/80">
                    <p>Diferença Mensal: {formatMoney(insight.avgProjected - insight.avgHistory)}</p>
                    <p>Acumulado em {insight.monthsProjected} meses</p>
                    <p className={cn("mt-2 font-bold", insight.financialImpact > 0 ? "text-emerald-400" : "text-red-400")}>
                      = {formatMoney(insight.financialImpact)}
                    </p>
                  </div>
                }
              />
            </div>
            <p className={cn("text-lg font-mono", insight.financialImpact > 0 ? "text-emerald-400" : "text-red-400")}>
              {formatMoney(insight.financialImpact)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE: SIMULADOR CAUSAL ---

function CausalSimulator({ data }: { data: AssessorResumo[] }) {
  // 1. Calcula distribuição histórica (últimos 12 meses)
  const historicalDistribution = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    data.forEach(item => {
      Object.entries(PRODUCT_KEYS).forEach(([key, label]) => {
        const val = (item as any)[key] || 0;
        totals[key] = (totals[key] || 0) + val;
        grandTotal += val;
      });
    });

    return Object.entries(totals).map(([key, value]) => ({
      key,
      label: PRODUCT_KEYS[key as keyof typeof PRODUCT_KEYS],
      value,
      share: grandTotal > 0 ? value / grandTotal : 0
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  // 2. Estado do Simulador
  const [targetRevenue, setTargetRevenue] = useState<number>(700000);
  const [simulatedValues, setSimulatedValues] = useState<Record<string, number>>({});
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Inicializa com base na média mensal histórica se estiver zerado
  useEffect(() => {
    if (historicalDistribution.length > 0 && targetRevenue === 0) {
      const avgMonthly = historicalDistribution.reduce((acc, curr) => acc + curr.value, 0) / (data.length || 1);
      // Sugere um target 10% acima da média
      const suggested = Math.ceil(avgMonthly * 1.1);
      setTargetRevenue(suggested);
    }
  }, [historicalDistribution, data.length]);

  // Atualiza valores simulados quando o Target Global muda (se não for override manual recente)
  useEffect(() => {
    if (isManualOverride) return;

    const newValues: Record<string, number> = {};
    historicalDistribution.forEach(prod => {
      newValues[prod.key] = targetRevenue * prod.share;
    });
    setSimulatedValues(newValues);
  }, [targetRevenue, historicalDistribution, isManualOverride]);

  const handleProductChange = (key: string, newValue: number) => {
    setIsManualOverride(true);
    const newSimulated = { ...simulatedValues, [key]: newValue };
    setSimulatedValues(newSimulated);

    // Recalcula o Total Global
    const newTotal = Object.values(newSimulated).reduce((acc, curr) => acc + curr, 0);
    setTargetRevenue(newTotal);

    // O timeout foi removido para evitar que o recálculo automático ocorra enquanto o usuário ajusta valores individuais.
    // A flag isManualOverride só voltará a ser false se o usuário editar o valor global explicitamente.
  };



  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8">
      {/* Input Gigante de Meta */}
      <div className="flex flex-col items-center justify-center space-y-4 py-8 border-b border-white/10">
        <div className="flex items-center gap-3 text-euro-gold mb-2">
          <Target className="w-6 h-6" />
          <span className="text-sm font-data uppercase tracking-[0.2em]">Meta de Receita Mensal Desejada</span>
        </div>
        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-display text-white/30">R$</span>
          <Input
            type="text"
            value={Math.round(targetRevenue).toLocaleString('pt-BR')}
            onChange={(e) => {
              const rawValue = e.target.value.replace(/\D/g, '');
              const numericValue = Number(rawValue);

              setIsManualOverride(false); // Force redistribution
              setTargetRevenue(numericValue);
            }}
            className="w-[300px] md:w-[400px] h-20 text-4xl md:text-5xl font-display text-center bg-transparent border-b-2 border-white/20 border-t-0 border-x-0 rounded-none focus-visible:ring-0 focus-visible:border-euro-gold px-12 text-[#F5F5F0] placeholder:text-white/10"
          />
        </div>
        <p className="text-xs text-white/40 font-ui italic">
          * Digite o valor total e o sistema distribuirá baseado no histórico. Ou ajuste cada produto abaixo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Lista de Ajustes */}
        <div className="space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar pr-4 bg-white/5 p-6 rounded-2xl border border-white/10">
          {historicalDistribution.map((prod) => (
            <div key={prod.key} className="space-y-2 group">
              <div className="flex justify-between items-end">
                <span className="text-sm font-data text-white/80 group-hover:text-euro-gold transition-colors">{prod.label}</span>
                <span className="text-xs font-mono text-white/40">
                  {((simulatedValues[prod.key] / targetRevenue) * 100 || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  value={[simulatedValues[prod.key] || 0]}
                  max={targetRevenue * 1.5} // Dá uma margem para brincar
                  step={100}
                  onValueChange={([v]) => handleProductChange(prod.key, v)}
                  className="flex-1"
                />
                <div className="w-28 relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/30">R$</span>
                  <Input
                    type="text"
                    value={Math.round(simulatedValues[prod.key] || 0).toLocaleString('pt-BR')}
                    onChange={(e) => {
                      const val = Number(e.target.value.replace(/\D/g, ''));
                      handleProductChange(prod.key, val);
                    }}
                    className="h-8 pl-6 text-xs bg-white/5 border-white/10 text-right font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visualização de Repasse (Nova) */}
        <div className="flex flex-col gap-6">
          <RevenueDistribution
            simulatedValues={simulatedValues}
            targetRevenue={targetRevenue}
          />
        </div>
      </div>
    </div>
  );
}
