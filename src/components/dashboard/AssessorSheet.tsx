
import React, { useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Star, 
  TrendingUp, 
  Target, 
  DollarSign, 
  Wallet, 
  Briefcase, 
  PieChart,
  Activity,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessorSheetProps {
  assessor: AssessorResumo | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AssessorSheet({ assessor, isOpen, onOpenChange }: AssessorSheetProps) {
  if (!assessor) return null;

  const revenueAchievement = (assessor.receita_total / (assessor.meta_receita || 1)) * 100;
  const fundingAchievement = (assessor.captacao_liquida_total / (assessor.meta_captacao || 1)) * 100;

  // Categorização de Receitas
  const investRevenue = useMemo(() => {
    return (
      assessor.receita_b3 +
      assessor.asset_m_1 +
      assessor.receitas_estruturadas +
      assessor.receita_cetipados +
      assessor.receitas_ofertas_fundos +
      assessor.receitas_ofertas_rf +
      assessor.receita_renda_fixa +
      assessor.receita_compromissadas +
      assessor.receitas_offshore
    );
  }, [assessor]);

  const csRevenue = useMemo(() => {
    return (
      assessor.receita_seguros +
      assessor.receita_previdencia +
      assessor.receita_consorcios +
      assessor.receita_cambio
    );
  }, [assessor]);

  const investShare = (investRevenue / (assessor.receita_total || 1)) * 100;
  const csShare = (csRevenue / (assessor.receita_total || 1)) * 100;

  const investProducts = [
    { label: 'Renda Variável (B3)', value: assessor.receita_b3 },
    { label: 'Fundos (Asset)', value: assessor.asset_m_1 },
    { label: 'Estruturadas', value: assessor.receitas_estruturadas },
    { label: 'Renda Fixa & Cetip', value: assessor.receita_cetipados + assessor.receita_renda_fixa + assessor.receitas_ofertas_rf },
    { label: 'Ofertas Fundos', value: assessor.receitas_ofertas_fundos },
    { label: 'Offshore', value: assessor.receitas_offshore },
  ].filter(p => p.value > 0).sort((a, b) => b.value - a.value);

  const csProducts = [
    { label: 'Seguros', value: assessor.receita_seguros },
    { label: 'Previdência', value: assessor.receita_previdencia },
    { label: 'Consórcios', value: assessor.receita_consorcios },
    { label: 'Câmbio', value: assessor.receita_cambio },
  ].filter(p => p.value > 0).sort((a, b) => b.value - a.value);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#0A0A0B] text-white border-l border-white/5 w-full sm:max-w-2xl p-0 shadow-2xl overflow-hidden flex flex-col h-full [&>button]:text-white [&>button]:bg-white/5 [&>button]:hover:bg-white/10 [&>button]:border-white/10">
        {/* HERO HEADER */}
        <div className="relative w-full bg-gradient-to-b from-euro-navy via-[#0F1014] to-[#0A0A0B] p-8 pb-12 border-b border-white/5">
            
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar with Glow */}
                <div className="relative group">
                    <div className={cn(
                        "w-24 h-24 rounded-full flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105",
                        !assessor.foto_url && "bg-euro-elevated border border-white/10",
                        assessor.lider && "ring-2 ring-euro-gold ring-offset-2 ring-offset-[#0A0A0B]"
                    )}>
                        {assessor.foto_url ? (
                            <img src={assessor.foto_url} alt={assessor.nome_assessor} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-3xl font-display text-euro-gold">{assessor.nome_assessor.charAt(0)}</span>
                        )}
                    </div>
                    {assessor.lider && (
                        <div className="absolute -top-2 -right-2 bg-euro-gold text-euro-navy p-1.5 rounded-lg shadow-lg rotate-12">
                            <Star className="w-4 h-4 fill-current" />
                        </div>
                    )}
                </div>

                {/* Name & Badges */}
                <div className="flex-1 text-center md:text-left space-y-2">
                    <SheetTitle className="text-3xl md:text-4xl font-display text-white tracking-tight leading-none">
                        {assessor.nome_assessor}
                    </SheetTitle>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <Badge variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors uppercase tracking-wider text-[10px] px-2 py-1">
                            {assessor.cod_assessor}
                        </Badge>
                        <Badge variant="outline" className="bg-euro-gold/10 border-euro-gold/20 text-euro-gold hover:bg-euro-gold/20 transition-colors uppercase tracking-wider text-[10px] px-2 py-1">
                            Cluster {assessor.cluster}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors uppercase tracking-wider text-[10px] px-2 py-1">
                            {assessor.time}
                        </Badge>
                    </div>
                </div>

                {/* Ranking Score */}
                <div className="text-center md:text-right bg-white/5 p-3 rounded-xl border border-white/5 backdrop-blur-md">
                    <span className="block text-[10px] font-data text-white uppercase tracking-widest mb-1">Ranking YTD</span>
                    <div className="flex items-baseline gap-1 justify-center md:justify-end">
                        <span className="text-2xl font-display text-euro-gold">{assessor.pontos_totais_acumulado.toLocaleString()}</span>
                        <span className="text-xs text-white">pts</span>
                    </div>
                </div>
            </div>
        </div>

        {/* CONTENT SCROLL AREA */}
        <ScrollArea className="flex-1 z-10">
            <div className="px-6 pb-12 space-y-8 pt-6">
                
                {/* KPI CARDS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Receita Bruta</span>
                            <DollarSign className="w-4 h-4 text-euro-gold opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xl md:text-2xl font-display text-white">R$ {assessor.receita_total.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}</p>
                        <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-euro-gold" style={{ width: `${Math.min(revenueAchievement, 100)}%` }} />
                        </div>
                    </div>
                    
                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Captação Líq.</span>
                            <TrendingUp className="w-4 h-4 text-green-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className={cn("text-xl md:text-2xl font-display", assessor.captacao_liquida_total >= 0 ? "text-white" : "text-red-400")}>
                            R$ {assessor.captacao_liquida_total.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}
                        </p>
                        <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                             <div className={cn("h-full", assessor.captacao_liquida_total >= 0 ? "bg-green-400" : "bg-red-400")} style={{ width: `${Math.min(fundingAchievement, 100)}%` }} />
                        </div>
                    </div>

                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">ROA Anual</span>
                            <Activity className="w-4 h-4 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xl md:text-2xl font-display text-white">{assessor.roa.toFixed(2)}%</p>
                        <span className="text-[10px] text-white">Target: 1.08%</span>
                    </div>

                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Custódia Net</span>
                            <Wallet className="w-4 h-4 text-purple-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xl md:text-2xl font-display text-white">R$ {(assessor.custodia_net / 1000000).toFixed(1)}M</p>
                        <span className="text-[10px] text-white">{assessor.total_clientes} Clientes</span>
                    </div>
                </div>

                {/* REVENUE BREAKDOWN - STORYTELLING */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <h3 className="text-xs font-data text-white uppercase tracking-[0.2em]">Composição de Receita</h3>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        {/* INVESTIMENTOS */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <PieChart className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-display text-white">Investimentos</h4>
                                        <span className="text-[10px] font-data text-white">{investShare.toFixed(0)}% do total</span>
                                    </div>
                                </div>
                                <span className="text-lg font-display text-blue-400">R$ {investRevenue.toLocaleString("pt-BR")}</span>
                            </div>

                            <div className="bg-[#121214] rounded-xl border border-white/5 overflow-hidden">
                                {investProducts.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex flex-col gap-1 flex-1">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-white">{item.label}</span>
                                                <span className="text-xs font-data text-white">R$ {item.value.toLocaleString("pt-BR")}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden w-full">
                                                <div className="h-full bg-blue-500/50" style={{ width: `${(item.value / investRevenue) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CS & SOLUÇÕES */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Briefcase className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-display text-white">Cross-Sell</h4>
                                        <span className="text-[10px] font-data text-white">{csShare.toFixed(0)}% do total</span>
                                    </div>
                                </div>
                                <span className="text-lg font-display text-purple-400">R$ {csRevenue.toLocaleString("pt-BR")}</span>
                            </div>

                            <div className="bg-[#121214] rounded-xl border border-white/5 overflow-hidden">
                                {csProducts.length > 0 ? csProducts.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex flex-col gap-1 flex-1">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-white">{item.label}</span>
                                                <span className="text-xs font-data text-white">R$ {item.value.toLocaleString("pt-BR")}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden w-full">
                                                <div className="h-full bg-purple-500/50" style={{ width: `${(item.value / csRevenue) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-6 text-center text-xs text-white/20 font-data italic">
                                        Nenhuma receita de CS no período.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ATIVAÇÕES & QUALIDADE */}
                {(assessor.ativacao_300k > 0 || assessor.ativacao_1kk > 0) && (
                    <div className="bg-gradient-to-br from-euro-gold/10 to-transparent p-6 rounded-xl border border-euro-gold/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Award className="w-24 h-24 text-euro-gold" />
                        </div>
                        <h3 className="text-sm font-display text-euro-gold mb-4 relative z-10">Performance de Ativação</h3>
                        <div className="flex gap-8 relative z-10">
                            {assessor.ativacao_300k > 0 && (
                                <div>
                                    <span className="text-3xl font-display text-white block">{assessor.ativacao_300k}</span>
                                    <span className="text-[10px] font-data text-euro-gold uppercase tracking-wider">Clientes &gt; 300k</span>
                                </div>
                            )}
                            {assessor.ativacao_1kk > 0 && (
                                <div>
                                    <span className="text-3xl font-display text-white block">{assessor.ativacao_1kk}</span>
                                    <span className="text-[10px] font-data text-euro-gold uppercase tracking-wider">Clientes &gt; 1M</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

