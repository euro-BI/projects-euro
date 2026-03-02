import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AssessorResumo } from "@/types/dashboard";
import { 
  Target, 
  TrendingUp, 
  Wallet, 
  Award,
  Sparkles,
  ArrowRight,
  Info,
  Calendar,
  BarChart2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_KEYS, REPASSE_CONFIG } from "@/constants/revenue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdvisorSimulatorProps {
  data: AssessorResumo[];
  userCode?: string | null;
  userRole?: string;
}

export function AdvisorSimulator({ data, userCode, userRole }: AdvisorSimulatorProps) {
  // 1. Calcula distribuição histórica e taxas médias de repasse por produto
  const historicalMix = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    data.forEach(item => {
      Object.entries(PRODUCT_KEYS).forEach(([key, label]) => {
        const val = (item as any)[key] || 0;
        totals[key] = (totals[key] || 0) + val;
        grandTotal += val;
      });
    });

    return Object.entries(totals).map(([key, value]) => {
      // Determina a taxa de repasse para este produto
      let baseRate = 0;
      let productRate = 0;

      if (key in REPASSE_CONFIG.investimentos.produtos) {
        baseRate = REPASSE_CONFIG.investimentos.base;
        productRate = (REPASSE_CONFIG.investimentos.produtos as any)[key];
      } else if (key in REPASSE_CONFIG.cross_sell.produtos) {
        baseRate = REPASSE_CONFIG.cross_sell.base;
        productRate = (REPASSE_CONFIG.cross_sell.produtos as any)[key];
      } else {
        // Fallback genérico se não encontrar (assumindo investimento padrão)
        baseRate = 0.82;
        productRate = 0.50;
      }

      const effectiveRate = baseRate * productRate;

      return {
        key,
        label: PRODUCT_KEYS[key as keyof typeof PRODUCT_KEYS],
        value,
        share: grandTotal > 0 ? value / grandTotal : 0,
        effectiveRate // Taxa de repasse efetiva (ex: 0.82 * 0.40 = 0.328 ou 32.8%)
      };
    }).sort((a, b) => b.value - a.value);
  }, [data]);

  // 3. Análise Histórica (Nova Feature)
  const historicalStats = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Se o usuário não tiver código, não faz sentido calcular comparativo específico
    // Mas se data já estiver filtrado, podemos usar.
    // Porém, o pedido é explícito: "se o assessor logado não tiver codigo, informe que o assessor não tem codigo informado"
    if (userRole === 'user' && !userCode) return null;

    // a. Ordenar dados por data (mais recente primeiro)
    const sortedData = [...data].sort((a, b) => 
      new Date(b.data_posicao).getTime() - new Date(a.data_posicao).getTime()
    );

    // b. Calcular Net Income para cada mês histórico
    const monthlyNetIncomes = sortedData.map(item => {
      let monthNet = 0;
      Object.entries(PRODUCT_KEYS).forEach(([key, label]) => {
        const val = (item as any)[key] || 0;
        
        // Determina taxa (mesma lógica do historicalMix)
        let baseRate = 0;
        let productRate = 0;
        if (key in REPASSE_CONFIG.investimentos.produtos) {
          baseRate = REPASSE_CONFIG.investimentos.base;
          productRate = (REPASSE_CONFIG.investimentos.produtos as any)[key];
        } else if (key in REPASSE_CONFIG.cross_sell.produtos) {
          baseRate = REPASSE_CONFIG.cross_sell.base;
          productRate = (REPASSE_CONFIG.cross_sell.produtos as any)[key];
        } else {
          baseRate = 0.82;
          productRate = 0.50;
        }
        const effectiveRate = baseRate * productRate;
        
        monthNet += val * effectiveRate;
      });
      return {
        date: item.data_posicao,
        netIncome: monthNet
      };
    });

    // c. Extrair métricas
    const lastMonth = monthlyNetIncomes[0]; // Último mês fechado
    
    const calculateAvg = (months: number) => {
      const slice = monthlyNetIncomes.slice(0, months);
      if (slice.length === 0) return 0;
      return slice.reduce((acc, curr) => acc + curr.netIncome, 0) / slice.length;
    };

    return {
      lastMonthIncome: lastMonth?.netIncome || 0,
      avg3: calculateAvg(3),
      avg6: calculateAvg(6),
      avg9: calculateAvg(9),
      avg12: calculateAvg(12),
      history: monthlyNetIncomes
    };
  }, [data]);

  const getComparison = (current: number, baseline: number) => {
    if (!baseline) return { diff: 0, percent: 0, status: 'neutral' };
    const diff = current - baseline;
    const percent = (diff / baseline) * 100;
    return {
      diff,
      percent,
      status: diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'
    };
  };

  // 2. Estado
  const [targetNetIncome, setTargetNetIncome] = useState<number>(10000); // Meta de Repasse Líquido
  const [productAllocations, setProductAllocations] = useState<Record<string, number>>({}); // Receita Bruta por Produto
  const [grossRevenueNeeded, setGrossRevenueNeeded] = useState<number>(0);

  // Inicializa alocações baseadas no histórico quando o target muda
  useEffect(() => {
    // Calcula a Taxa Média Ponderada Global do Assessor
    // TaxaMedia = Soma(Share_i * Taxa_i)
    const weightedAverageRate = historicalMix.reduce((acc, curr) => acc + (curr.share * curr.effectiveRate), 0);
    
    // Receita Bruta Necessária = Repasse Líquido / Taxa Média
    // Evita divisão por zero
    const estimatedGross = targetNetIncome / (weightedAverageRate || 0.35); 
    
    setGrossRevenueNeeded(estimatedGross);

    // Distribui a receita bruta necessária pelos produtos conforme o share histórico
    const initialAllocations: Record<string, number> = {};
    historicalMix.forEach(prod => {
      initialAllocations[prod.key] = estimatedGross * prod.share;
    });
    setProductAllocations(initialAllocations);

  }, [targetNetIncome, historicalMix]);

  // Handler para ajuste manual de um produto
  const handleAllocationChange = (key: string, newGrossValue: number) => {
    const newAllocations = { ...productAllocations, [key]: newGrossValue };
    setProductAllocations(newAllocations);

    // Recalcula o total bruto e o repasse resultante
    const newTotalGross = Object.values(newAllocations).reduce((acc, curr) => acc + curr, 0);
    setGrossRevenueNeeded(newTotalGross);
    
    // Recalcula o repasse líquido estimado com base nas taxas individuais
    let newEstimatedNet = 0;
    historicalMix.forEach(prod => {
      const gross = newAllocations[prod.key] || 0;
      newEstimatedNet += gross * prod.effectiveRate;
    });
    
    // Não atualizamos o targetNetIncome aqui para não criar um loop infinito, 
    // mas poderíamos mostrar um "Repasse Estimado" vs "Meta Original".
    // Para simplificar a UX, vamos assumir que ele está ajustando o mix para ver o resultado.
  };

  // Recalcula o repasse real baseado nas alocações atuais (para feedback visual)
  const currentSimulatedNetIncome = useMemo(() => {
    let net = 0;
    historicalMix.forEach(prod => {
      const gross = productAllocations[prod.key] || 0;
      net += gross * prod.effectiveRate;
    });
    return net;
  }, [productAllocations, historicalMix]);

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-12">
      
      {/* SEÇÃO 1: INPUT DE META (GAMIFICADA) */}
      <div className="relative flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-euro-gold/5 blur-3xl rounded-full opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center space-y-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-euro-gold/10 border border-euro-gold/20 text-euro-gold text-xs font-data uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3" />
            Simulador de Comissão
          </div>

          <h3 className="text-xl md:text-2xl font-display text-white/80 text-center max-w-lg">
            Quanto você quer colocar no bolso este mês?
          </h3>

          <div className="relative group scale-100 transition-transform duration-300 focus-within:scale-105">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-display text-white/20 select-none group-focus-within:text-euro-gold/50 transition-colors">R$</span>
            <Input
              type="text"
              value={Math.round(targetNetIncome).toLocaleString('pt-BR')}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/\D/g, '');
                setTargetNetIncome(Number(rawValue));
              }}
              className="w-[320px] md:w-[480px] h-24 text-5xl md:text-6xl font-display text-center bg-transparent border-b-2 border-white/10 border-t-0 border-x-0 rounded-none focus-visible:ring-0 focus-visible:border-euro-gold px-16 text-white placeholder:text-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]"
            />
          </div>

          <p className="text-sm font-ui text-white/40 italic">
            * Valor líquido estimado de repasse
          </p>
        </div>
      </div>

      {/* SEÇÃO 2: RESULTADO E AJUSTE FINO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: RESUMO EXECUTIVO (4 COLUNAS) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-data uppercase text-white/40 tracking-wider">Receita Bruta Necessária</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display text-white">
                    {formatMoney(grossRevenueNeeded)}
                  </span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Para atingir seu repasse desejado com o mix de produtos atual.
                </p>
              </div>

              <div className="h-px w-full bg-white/10" />

              <div className="space-y-1">
                <span className="text-xs font-data uppercase text-white/40 tracking-wider">Repasse Projetado Atual</span>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-2xl font-display transition-colors duration-500",
                    currentSimulatedNetIncome >= targetNetIncome ? "text-emerald-400" : "text-euro-gold"
                  )}>
                    {formatMoney(currentSimulatedNetIncome)}
                  </span>
                </div>
                {currentSimulatedNetIncome < targetNetIncome && (
                  <p className="text-xs text-red-400/80 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Faltam {formatMoney(targetNetIncome - currentSimulatedNetIncome)} para a meta
                  </p>
                )}
                {currentSimulatedNetIncome >= targetNetIncome && (
                  <p className="text-xs text-emerald-400/80 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Meta atingida! Parabéns!
                  </p>
                )}
              </div>

                {/* ANÁLISE COMPARATIVA HISTÓRICA */}
                {(userRole === 'user' && !userCode) ? (
                  <div className="pt-4 mt-4 border-t border-white/10">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
                      <Info className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="text-xs font-bold text-red-400 uppercase">Atenção</p>
                        <p className="text-xs text-red-300/80">
                          Seu usuário não possui um Código de Assessor vinculado. Não é possível gerar comparativos históricos personalizados.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : historicalStats ? (
                  <div className="pt-4 mt-4 border-t border-white/10 space-y-4">
                    <h5 className="text-xs font-data text-white/60 uppercase flex items-center gap-2">
                      <BarChart2 className="w-3 h-3" />
                      Performance Comparada
                    </h5>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Vs Último Mês */}
                      <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40 uppercase">Vs Mês Anterior</span>
                          <span className="text-[10px] text-white/60">{formatMoney(historicalStats.lastMonthIncome)}</span>
                        </div>
                        {(() => {
                          const comp = getComparison(currentSimulatedNetIncome, historicalStats.lastMonthIncome);
                          return (
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-sm font-bold font-mono",
                                comp.status === 'positive' ? "text-emerald-400" : comp.status === 'negative' ? "text-red-400" : "text-white/40"
                              )}>
                                {comp.status === 'positive' ? '+' : ''}{comp.percent.toFixed(1)}%
                              </span>
                              <span className="text-[10px] text-white/30">
                                {comp.diff > 0 ? `+${formatMoney(comp.diff)}` : formatMoney(comp.diff)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
  
                      {/* Vs Médias Móveis */}
                      <div className="space-y-2">
                        {[
                          { label: 'Média 3 Meses', val: historicalStats.avg3 },
                          { label: 'Média 6 Meses', val: historicalStats.avg6 },
                          { label: 'Média 12 Meses', val: historicalStats.avg12 },
                        ].map((metric) => {
                           const comp = getComparison(currentSimulatedNetIncome, metric.val);
                           return (
                             <div key={metric.label} className="flex items-center justify-between text-xs">
                                <span className="text-white/40 w-24">{metric.label}</span>
                                <span className="text-white/60 font-mono text-[10px]">{formatMoney(metric.val)}</span>
                                <span className={cn(
                                  "font-mono font-bold w-12 text-right",
                                  comp.status === 'positive' ? "text-emerald-400" : comp.status === 'negative' ? "text-red-400" : "text-white/40"
                                )}>
                                  {comp.status === 'positive' ? '+' : ''}{comp.percent.toFixed(0)}%
                                </span>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

              <div className="bg-euro-gold/5 rounded-lg p-4 border border-euro-gold/10 mt-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-euro-gold mt-0.5 shrink-0" />
                  <p className="text-xs text-euro-gold/80 leading-relaxed">
                    <strong>Dica de Ouro:</strong> Produtos como <span className="text-white">Seguros</span> e <span className="text-white">Consórcios</span> possuem taxas de repasse menores para a casa (maior comissão para você). Aumente o mix deles para reduzir a Receita Bruta necessária!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: AJUSTE FINO POR PRODUTO (8 COLUNAS) */}
        <div className="lg:col-span-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-lg font-display text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-euro-gold" />
                Planejamento Tático por Produto
              </h4>
              <span className="text-xs font-data text-white/40 uppercase hidden sm:block">Ajuste os valores para simular</span>
            </div>

            <div className="grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {historicalMix.map((prod) => {
                const currentGross = productAllocations[prod.key] || 0;
                const currentNet = currentGross * prod.effectiveRate;
                const isZero = currentGross === 0;

                return (
                  <div key={prod.key} className="group relative bg-white/5 hover:bg-white/[0.07] transition-all rounded-xl p-4 border border-white/5 hover:border-euro-gold/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      
                      {/* Label e Taxa */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border",
                          isZero ? "bg-white/5 border-white/10 text-white/20" : "bg-euro-gold/10 border-euro-gold/20 text-euro-gold"
                        )}>
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-euro-gold transition-colors">{prod.label}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                              Repasse: {(prod.effectiveRate * 100).toFixed(1)}%
                            </span>
                            {prod.share > 0.1 && (
                              <span className="text-[10px] font-mono text-emerald-400/60 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Alta Relevância
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Inputs de Valor */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-white/30 font-data mb-0.5">Receita Bruta Necessária</p>
                          <div className="relative">
                             <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-white/30">R$</span>
                             <Input
                               type="text"
                               value={Math.round(currentGross).toLocaleString('pt-BR')}
                               onChange={(e) => {
                                 const val = Number(e.target.value.replace(/\D/g, ''));
                                 handleAllocationChange(prod.key, val);
                               }}
                               className="h-8 w-32 pl-6 text-sm bg-transparent border-white/10 text-right font-mono text-white focus:border-euro-gold transition-colors p-0 border-b border-t-0 border-x-0 rounded-none"
                             />
                          </div>
                        </div>
                        
                        <div className="hidden sm:block w-px h-8 bg-white/10" />
                        
                        <div className="text-right min-w-[100px]">
                          <p className="text-[10px] uppercase text-white/30 font-data mb-0.5">Comissão Gerada</p>
                          <p className="text-sm font-mono text-emerald-400 font-bold">
                            {formatMoney(currentNet)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="px-2 pb-2">
                      <Slider
                        value={[currentGross]}
                        max={grossRevenueNeeded * 1.5} // Margem dinâmica
                        step={100}
                        onValueChange={([v]) => handleAllocationChange(prod.key, v)}
                        className="py-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
