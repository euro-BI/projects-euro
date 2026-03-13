import React, { useMemo, useState, useEffect } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
  Cell
} from "recharts";
import { format, parseISO, isSameMonth, isWeekend, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Briefcase,
  Landmark,
  Umbrella,
  Wallet,
  ArrowUpRight,
  Shield,
  Coins,
  LayoutDashboard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

interface CockpitDashProps {
  currentData: AssessorResumo[];
  yearlyData: AssessorResumo[];
  selectedYear: string;
}

type MetricType = 'funding' | 'allocation' | 'variable' | 'banking' | 'insurance';

const METRIC_CONFIG = {
  funding: {
    label: "Captação Líquida",
    icon: Wallet,
    color: "#22C55E", // Green
    fields: ["captacao_liquida_total"],
    targetField: "meta_captacao",
    isRoaBased: false
  },
  allocation: {
    label: "Alocação",
    icon: Briefcase,
    color: "#FAC017", // Euro Gold
    fields: [
      "receita_renda_fixa", 
      "asset_m_1", 
      "receita_previdencia", 
      "receita_cetipados", 
      "receitas_ofertas_fundos", 
      "receitas_ofertas_rf", 
      "receitas_offshore"
    ],
    isRoaBased: true,
    roaTarget: 0.0015 + 0.0002 + 0.0001 + 0.0005 + 0.0010 + 0.0002 // Sum of ROAs: 0.35% approx
  },
  variable: {
    label: "Renda Variável",
    icon: TrendingUp,
    color: "#3B82F6", // Blue
    fields: ["receitas_estruturadas", "receita_b3"],
    isRoaBased: true,
    roaTarget: 0.0035 + 0.0020 // 0.55%
  },
  banking: {
    label: "Banking",
    icon: Landmark,
    color: "#8B5CF6", // Purple
    fields: ["receita_consorcios", "receita_compromissadas", "receita_cambio"],
    isRoaBased: true,
    roaTarget: 0.0009 + 0.0001 + 0.0001 // 0.11%
  },
  insurance: {
    label: "Seguros",
    icon: Shield,
    color: "#EC4899", // Pink
    fields: ["receita_seguros"],
    isRoaBased: true,
    roaTarget: 0.0007 // 0.07%
  }
};

const PRODUCT_METRICS = {
  eurostock: [
    { label: "R. Fixa", fields: ["receita_renda_fixa"], roa: 0.0015 },
    { label: "Asset", fields: ["asset_m_1"], roa: 0.0002 },
    { label: "Previd.", fields: ["receita_previdencia"], roa: 0.0001 },
    { label: "Cetipados", fields: ["receita_cetipados"], roa: 0.0005 },
    { label: "Ofertas", fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"], roa: 0.0010 },
    { label: "Offshore", fields: ["receitas_offshore"], roa: 0.0002 },
    { label: "Estruturas", fields: ["receitas_estruturadas"], roa: 0.0035 },
    { label: "B3", fields: ["receita_b3"], roa: 0.0020 },
  ],
  affare: [
    { label: "Consórc.", fields: ["receita_consorcios"], roa: 0.0009 },
    { label: "Compromis.", fields: ["receita_compromissadas"], roa: 0.0001 },
    { label: "Câmbio", fields: ["receita_cambio"], roa: 0.0001 },
    { label: "Seguros", fields: ["receita_seguros"], roa: 0.0007 },
  ]
};

// Helper to format currency
const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Helper to calculate status color
const getStatusColor = (percent: number) => {
  if (percent >= 100) return "text-green-500";
  if (percent >= 70) return "text-euro-gold";
  return "text-red-500";
};

const getProgressBarColor = (percent: number) => {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 70) return "bg-euro-gold";
  return "bg-red-500";
};

export default function CockpitDash({ currentData, yearlyData, selectedYear }: CockpitDashProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('funding');
  const [viewMode, setViewMode] = useState<'monthly' | 'accumulated'>('monthly');
  const [displayMode, setDisplayMode] = useState<'meta' | 'proportional' | 'pace'>('meta');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchReferenceDate = async () => {
      try {
        const { data, error } = await supabase
          .from('wv_tabelas_atualizacao')
          .select('ultima_atualizacao')
          .order('ultima_atualizacao', { ascending: false })
          .limit(1);

        if (data && data[0]?.ultima_atualizacao) {
          setReferenceDate(parseISO(data[0].ultima_atualizacao));
        }
      } catch (error) {
        console.error("Error fetching reference date:", error);
      }
    };

    fetchReferenceDate();
  }, []);

  // Helper to calculate Pace (Projeção)
  const getPaceValue = (value: number) => {
    if (displayMode !== 'pace') return value;
    if (!currentData || currentData.length === 0) return value;
    
    const dataDate = parseISO(currentData[0].data_posicao);
    
    // Só aplica Pace se os dados forem do mesmo mês e ano da data de referência
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) {
      return value;
    }

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    
    // Dias úteis totais no mês da referência
    const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
    
    // Dias úteis passados até a data de referência (inclusive)
    const passedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
    
    // Se ainda estamos no começo do mês (ex: dia 1), evitamos divisão por zero ou projeção exagerada
    const effectivePassedDays = Math.max(1, passedDays);

    if (effectivePassedDays > 0 && totalDays > 0) {
      return (value / effectivePassedDays) * totalDays;
    }
    
    return value;
  };

  // Helper to calculate Proportional Target (Meta Proporcional)
  const getProportionalTarget = (target: number) => {
    if (displayMode !== 'proportional') return target;
    if (!currentData || currentData.length === 0) return target;

    const dataDate = parseISO(currentData[0].data_posicao);
    
    // Só aplica Proporcional se os dados forem do mesmo mês e ano da data de referência
    if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) {
      return target;
    }

    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    
    const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
    const passedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
    
    if (totalDays > 0) {
      return (target / totalDays) * passedDays;
    }

    return target;
  };

  // 1. Calculate Current KPIs
  const kpis = useMemo(() => {
    const custodyTotal = currentData.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);
    
    const calculateMetric = (type: MetricType) => {
      const config = METRIC_CONFIG[type];
      let realized = 0;
      let target = 0;

      // Calculate Realized
      let rawRealized = currentData.reduce((acc, curr) => {
        let sum = 0;
        config.fields.forEach(field => {
          sum += (curr as any)[field] || 0;
        });
        return acc + sum;
      }, 0);

      realized = getPaceValue(rawRealized);

      // Calculate Target
      if (config.isRoaBased) {
        // Monthly Target = (Custody * Annual ROA) / 12
        target = (custodyTotal * (config.roaTarget || 0)) / 12;
      } else {
        // Direct Target Field (e.g. Meta Captação)
        target = currentData.reduce((acc, curr) => acc + ((curr as any)[config.targetField!] || 0), 0);
      }

      target = getProportionalTarget(target);

      const percent = target > 0 ? (realized / target) * 100 : 0;
      const gap = target - realized;

      return { realized, target, percent, gap };
    };

    const calculateProductMetrics = (products: typeof PRODUCT_METRICS.eurostock) => {
      return products.map(product => {
        const rawRealized = currentData.reduce((acc, curr) => {
          let sum = 0;
          product.fields.forEach(field => {
            sum += (curr as any)[field] || 0;
          });
          return acc + sum;
        }, 0);

        const realized = getPaceValue(rawRealized);

        let target = (custodyTotal * product.roa) / 12;
        target = getProportionalTarget(target);

        const percent = target > 0 ? (realized / target) * 100 : 0;
        const gap = target - realized;

        return { ...product, realized, target, percent, gap };
      });
    };

    const metrics = {
      funding: calculateMetric('funding'),
      allocation: calculateMetric('allocation'),
      variable: calculateMetric('variable'),
      banking: calculateMetric('banking'),
      insurance: calculateMetric('insurance')
    };

    const eurostockProducts = calculateProductMetrics(PRODUCT_METRICS.eurostock);
    const affareProducts = calculateProductMetrics(PRODUCT_METRICS.affare);

    // Groups Calculation (Revenue Only)
    const invest = {
      realized: metrics.allocation.realized + metrics.variable.realized,
      target: metrics.allocation.target + metrics.variable.target,
    };
    const cs = {
      realized: metrics.banking.realized + metrics.insurance.realized,
      target: metrics.banking.target + metrics.insurance.target,
    };
    const global = {
      realized: invest.realized + cs.realized,
      target: invest.target + cs.target,
    };

    return {
      ...metrics,
      groups: {
        invest: {
          ...invest,
          percent: invest.target > 0 ? (invest.realized / invest.target) * 100 : 0,
          gap: invest.target - invest.realized,
          products: eurostockProducts
        },
        cs: {
          ...cs,
          percent: cs.target > 0 ? (cs.realized / cs.target) * 100 : 0,
          gap: cs.target - cs.realized,
          products: affareProducts
        },
        global: {
          ...global,
          percent: global.target > 0 ? (global.realized / global.target) * 100 : 0,
          gap: global.target - global.realized
        }
      }
    };
  }, [currentData, displayMode]);

  // 2. Prepare Chart Data
  const chartData = useMemo(() => {
    const config = METRIC_CONFIG[selectedMetric];
    
    // Group by Month
    const grouped = yearlyData.reduce((acc: Record<string, any>, curr) => {
      const monthKey = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthName: format(parseISO(curr.data_posicao), "MMM", { locale: ptBR }),
          realized: 0,
          target: 0,
          custody: 0
        };
      }
      
      // Realized
      let sum = 0;
      config.fields.forEach(field => {
        sum += (curr as any)[field] || 0;
      });
      acc[monthKey].realized += sum;

      // Target (Accumulate Custody or Target Field)
      if (config.isRoaBased) {
        acc[monthKey].custody += curr.custodia_net || 0;
      } else {
        acc[monthKey].target += (curr as any)[config.targetField!] || 0;
      }
      
      return acc;
    }, {});

    // Post-process to calculate targets based on ROA and handle Accumulation
    let result = Object.values(grouped).sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey));

    if (config.isRoaBased) {
      result = result.map((d: any) => ({
        ...d,
        target: (d.custody * (config.roaTarget || 0)) / 12
      }));
    }

    if (viewMode === 'accumulated') {
      let accRealized = 0;
      let accTarget = 0;
      result = result.map((d: any) => {
        accRealized += d.realized;
        accTarget += d.target;
        return {
          ...d,
          realized: accRealized,
          target: accTarget
        };
      });
    }

    // Add gap calculation
    return result.map((d: any) => ({
      ...d,
      gap: d.target - d.realized
    }));
  }, [yearlyData, selectedMetric, viewMode]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1A2030] border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-euro-gold font-data text-xs mb-2 uppercase tracking-wider">{label}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-6 text-xs font-data">
              <span className="text-white/60">Realizado:</span>
              <span className="text-white font-medium">{formatCurrency(data.realized)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data">
              <span className="text-white/60">Meta:</span>
              <span className="text-white font-medium">{formatCurrency(data.target)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data pt-1 border-t border-white/5">
              <span className="text-white/60">Gap:</span>
              <span className={cn("font-medium", data.gap > 0 ? "text-red-400" : "text-green-400")}>
                {data.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(data.gap))}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div>
            <p className="text-sm text-white/40 mt-1 font-data">Visão Estratégica Consolidada • {selectedYear}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-[#1A2030] p-1 rounded-lg border border-euro-gold/20 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
              <button
                onClick={() => setDisplayMode('meta')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold",
                  displayMode === 'meta' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Meta
              </button>
              <button
                onClick={() => setDisplayMode('proportional')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold flex items-center gap-1",
                  displayMode === 'proportional' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Pace
              </button>
              <button
                onClick={() => setDisplayMode('pace')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] md:text-xs font-data transition-all uppercase tracking-wider font-bold",
                  displayMode === 'pace' 
                    ? "bg-euro-gold text-black shadow-lg" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                Projeção
              </button>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-euro-gold hover:bg-white/5 rounded-full transition-all duration-300">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0A0A0B] border-euro-gold/20 text-white sm:max-w-[600px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />
                
                <DialogHeader className="p-6 pb-2 border-b border-white/5 bg-white/5">
                  <DialogTitle className="text-euro-gold font-display text-xl tracking-wide flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-euro-gold" />
                    Entenda os Modos de Visualização
                  </DialogTitle>
                  <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
                    Guia rápido de interpretação de métricas
                  </DialogDescription>
                </DialogHeader>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Meta */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-euro-gold/10 rounded-lg text-euro-gold group-hover:bg-euro-gold group-hover:text-black transition-colors">
                         <Target className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Meta (Original)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Representa o <strong>objetivo total</strong> definido para o mês. É o valor fixo que você precisa alcançar até o último dia útil, independente de quanto tempo já passou.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-euro-gold font-bold uppercase tracking-wider text-[10px] bg-euro-gold/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Sua meta mensal é <span className="text-white font-bold">R$ 100k</span>. O gráfico sempre mostrará 100k como alvo.
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>

                  {/* Pace */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                         <TrendingUp className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Pace (Ritmo Ideal)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Ajusta a meta proporcionalmente aos <strong>dias úteis decorridos</strong>. Indica quanto você <em>deveria ter feito</em> até hoje para estar "em dia" com a meta.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-blue-400 font-bold uppercase tracking-wider text-[10px] bg-blue-500/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Dia 15 (50% do mês). Pace ideal: <span className="text-white font-bold">R$ 50k</span>. Se fez 40k, está atrasado.
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>

                  {/* Projeção */}
                  <div className="group relative overflow-hidden bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-xl border border-white/5 hover:border-euro-gold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                         <ArrowUpRight className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-2">
                         <h4 className="text-white font-display text-base">Projeção (Forecast)</h4>
                         <p className="text-sm text-white/60 font-data leading-relaxed">
                           Estima seu <strong>fechamento mensal</strong> assumindo que você manterá o mesmo ritmo de produção diária até o fim do mês.
                         </p>
                         <div className="bg-black/40 p-4 rounded-lg border border-white/5 mt-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                          <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] bg-purple-500/10 px-2 py-1 rounded shrink-0 self-start mt-0.5">
                            Exemplo
                          </span> 
                          <p className="text-xs text-white/80 font-data leading-relaxed">
                            Fez R$ 40k em 50% do mês? Sua projeção é <span className="text-white font-bold">R$ 80k</span> (não bate a meta de 100k).
                          </p>
                        </div>
                       </div>
                     </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* PHENOMENAL INDICATOR SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: INVEST vs CS BREAKDOWN */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* INVEST CARD */}
          <Card className="bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-24 h-24 text-blue-400" />
             </div>
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-data text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      EUROSTOCK
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Alocação + Renda Variável</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-3xl font-display", getStatusColor(kpis.groups.invest.percent))}>
                      {kpis.groups.invest.percent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-white/5 h-2 rounded-full mb-6 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(kpis.groups.invest.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(kpis.groups.invest.percent))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Meta</span>
                    <p className="text-[10px] lg:text-xs xl:text-base font-display text-euro-gold">{formatCurrency(kpis.groups.invest.target)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Realizado</span>
                    <p className="text-[10px] lg:text-xs xl:text-base font-display text-white">{formatCurrency(kpis.groups.invest.realized)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Gap</span>
                    <p className={cn("text-[10px] lg:text-xs xl:text-base font-display", kpis.groups.invest.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {kpis.groups.invest.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.invest.gap))}
                    </p>
                  </div>
                </div>

            {/* PRODUCT TABLE */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-white/40 font-data uppercase tracking-wider mb-2">
                    <div className="col-span-1">Produto</div>
                    <div className="text-right">Meta</div>
                    <div className="text-right">Real.</div>
                    <div className="text-right">Gap</div>
                  </div>
                  {kpis.groups.invest.products
                    .slice()
                    .sort((a: any, b: any) => b.target - a.target)
                    .map((p: any, i: number) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-[9px] lg:text-[10px] xl:text-[11px] font-data border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 transition-colors rounded-sm px-1">
                      <div className="text-white truncate col-span-1 flex items-center" title={p.label}>{p.label}</div>
                      <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                      <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                      <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                         {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>

          {/* CS CARD */}
          <Card className="bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Briefcase className="w-24 h-24 text-purple-400" />
             </div>
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-data text-purple-400 uppercase tracking-widest flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      AFFARE
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Banking + Seguros</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-3xl font-display", getStatusColor(kpis.groups.cs.percent))}>
                      {kpis.groups.cs.percent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-white/5 h-2 rounded-full mb-6 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(kpis.groups.cs.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(kpis.groups.cs.percent))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Meta</span>
                    <p className="text-[10px] lg:text-xs xl:text-base font-display text-euro-gold">{formatCurrency(kpis.groups.cs.target)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Realizado</span>
                    <p className="text-[10px] lg:text-xs xl:text-base font-display text-white">{formatCurrency(kpis.groups.cs.realized)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 font-data uppercase">Gap</span>
                    <p className={cn("text-[10px] lg:text-xs xl:text-base font-display", kpis.groups.cs.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {kpis.groups.cs.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.cs.gap))}
                    </p>
                  </div>
                </div>

                {/* PRODUCT TABLE */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-white/40 font-data uppercase tracking-wider mb-2">
                    <div className="col-span-1">Produto</div>
                    <div className="text-right">Meta</div>
                    <div className="text-right">Real.</div>
                    <div className="text-right">Gap</div>
                  </div>
                  {kpis.groups.cs.products
                    .slice()
                    .sort((a: any, b: any) => b.target - a.target)
                    .map((p: any, i: number) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-[9px] lg:text-[10px] xl:text-[11px] font-data border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 transition-colors rounded-sm px-1">
                      <div className="text-white truncate col-span-1 flex items-center" title={p.label}>{p.label}</div>
                      <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                      <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                      <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                         {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>
        </div>

        {/* RIGHT: GLOBAL PHENOMENAL INDICATOR */}
        <Card className="lg:col-span-4 bg-gradient-to-b from-[#1A2030] to-[#11141D] border-euro-gold/30 shadow-[0_0_30px_rgba(250,192,23,0.05)] relative overflow-hidden flex flex-col justify-center items-center py-8">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-euro-gold/5 via-transparent to-transparent" />
           
           <div className="relative z-10 text-center mb-6">
             <h3 className="text-lg font-display text-euro-gold uppercase tracking-[0.2em] flex items-center justify-center gap-2 mb-1">
               <Target className="w-5 h-5" />
               Performance Global
             </h3>
             <p className="text-xs text-white/40 font-data">Consolidado de Receita (Eurostock + Affare)</p>
           </div>

           <div className="relative w-48 h-48 flex items-center justify-center mb-6">
             {/* Circular Progress Background */}
             <svg className="w-full h-full transform -rotate-90">
               <circle
                 cx="96"
                 cy="96"
                 r="88"
                 fill="none"
                 stroke="rgba(255,255,255,0.05)"
                 strokeWidth="12"
               />
               <motion.circle
                 cx="96"
                 cy="96"
                 r="88"
                 fill="none"
                 stroke={kpis.groups.global.percent >= 100 ? "#22C55E" : kpis.groups.global.percent >= 70 ? "#FAC017" : "#EF4444"}
                 strokeWidth="12"
                 strokeDasharray={2 * Math.PI * 88}
                 initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                 animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - Math.min(kpis.groups.global.percent, 100) / 100) }}
                 transition={{ duration: 1.5, ease: "easeOut" }}
                 strokeLinecap="round"
               />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className={cn("text-5xl font-display font-bold", getStatusColor(kpis.groups.global.percent))}>
                 {kpis.groups.global.percent.toFixed(0)}%
               </span>
               <span className="text-xs text-white/40 font-data uppercase tracking-wider mt-1">Atingimento</span>
             </div>
           </div>

           <div className="grid grid-cols-3 w-full px-2 gap-2 border-t border-white/5 pt-6">
             <div className="text-center overflow-hidden">
                <p className="text-[8px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Meta Global</p>
                <p className="text-[10px] lg:text-xs xl:text-base font-display text-euro-gold whitespace-nowrap text-ellipsis overflow-hidden" title={formatCurrency(kpis.groups.global.target)}>{formatCurrency(kpis.groups.global.target)}</p>
             </div>
             <div className="text-center border-l border-white/5 pl-2 overflow-hidden">
                <p className="text-[8px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Total Realizado</p>
                <p className="text-[10px] lg:text-xs xl:text-base font-display text-white whitespace-nowrap text-ellipsis overflow-hidden" title={formatCurrency(kpis.groups.global.realized)}>{formatCurrency(kpis.groups.global.realized)}</p>
             </div>
             <div className="text-center border-l border-white/5 pl-2 overflow-hidden">
                <p className="text-[8px] lg:text-[9px] text-white/40 font-data uppercase tracking-widest mb-1 whitespace-nowrap">Gap Global</p>
                <p className={cn("text-[10px] lg:text-xs xl:text-base font-display whitespace-nowrap text-ellipsis overflow-hidden", kpis.groups.global.gap > 0 ? "text-red-400" : "text-green-400")} title={(kpis.groups.global.gap > 0 ? "-" : "+") + formatCurrency(Math.abs(kpis.groups.global.gap))}>
                  {kpis.groups.global.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.groups.global.gap))}
                </p>
             </div>
           </div>
        </Card>
      </div>

      {/* KPI CARDS - 5 MAIN INDICATORS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {(Object.keys(METRIC_CONFIG) as MetricType[]).map((metric) => {
          const data = kpis[metric];
          const config = METRIC_CONFIG[metric];
          const Icon = config.icon;
          const isSelected = selectedMetric === metric;
          
          return (
            <Card 
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={cn(
                "relative overflow-hidden cursor-pointer transition-all duration-300 border rounded-2xl shadow-2xl group",
                "bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl",
                isSelected 
                  ? "border-euro-gold shadow-[0_0_20px_rgba(250,192,23,0.1)]" 
                  : "border-white/20 hover:border-euro-gold/50"
              )}
            >
              {isSelected && <div className="absolute top-0 left-0 w-full h-0.5 bg-euro-gold shadow-[0_0_10px_#FAC017]" />}
              
              <CardContent className="p-5 flex flex-col h-full justify-between">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={cn(
                      "text-[10px] font-data uppercase tracking-widest block mb-1",
                      isSelected ? "text-euro-gold" : "text-white/50"
                    )}>
                      {config.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-2xl font-display", getStatusColor(data.percent))}>
                        {data.percent.toFixed(0)}%
                      </span>
                      {data.percent >= 100 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : data.percent < 70 ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    isSelected ? "bg-euro-gold text-black" : "bg-white/5 text-white/40"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/5 h-1.5 rounded-full mb-4 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(data.percent, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", getProgressBarColor(data.percent))}
                  />
                </div>

                {/* Details */}
                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-[10px] text-white/40 font-data">META</span>
                    <span className="text-sm font-data text-euro-gold">{formatCurrency(data.target)}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-[10px] text-white/40 font-data">REALIZADO</span>
                    <span className="text-sm font-data text-white">{formatCurrency(data.realized)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] text-white/40 font-data">PENDENTE</span>
                    <span className={cn("text-xs font-data", data.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {data.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(data.gap))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CHART SECTION */}
      <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-euro-gold" />
              Evolução - {METRIC_CONFIG[selectedMetric].label}
            </h3>
            <p className="text-xs text-white/40 font-data mt-1">
              Acompanhamento mensal vs Meta
            </p>
          </div>

          <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-data transition-all",
                viewMode === 'monthly' 
                  ? "bg-euro-gold text-black font-bold shadow-lg" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setViewMode('accumulated')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-data transition-all",
                viewMode === 'accumulated' 
                  ? "bg-euro-gold text-black font-bold shadow-lg" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              Acumulado
            </button>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAC017" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#FAC017" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="barGradientSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="monthName" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                tickFormatter={(value) => 
                  Math.abs(value) >= 1000000 
                    ? `${(value / 1000000).toFixed(1)}M` 
                    : `${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={<CustomTooltip />}
              />
              <Bar 
                dataKey="realized" 
                name="Realizado" 
                radius={[4, 4, 0, 0]} 
                barSize={30}
              >
                {chartData.map((entry: any, index: number) => {
                  let fillUrl = "url(#barGradientPositive)";
                  if (entry.realized >= entry.target) {
                    fillUrl = "url(#barGradientSuccess)";
                  } else if (entry.realized < 0) {
                    fillUrl = "url(#barGradientNegative)";
                  }
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fillUrl}
                    />
                  );
                })}
              </Bar>
              <Line 
                type="monotone" 
                dataKey="target" 
                name="Meta" 
                stroke="#FFFFFF" 
                strokeOpacity={0.5} 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#1A2030', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#FAC017', stroke: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
