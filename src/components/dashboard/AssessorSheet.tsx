
import React, { useMemo, useRef, useState, useCallback } from "react";
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
  TrendingDown,
  Minus,
  Target, 
  DollarSign, 
  Wallet, 
  Briefcase, 
  PieChart,
  Activity,
  Award,
  Trophy,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessorSheetProps {
  assessor: AssessorResumo | null;
  rank?: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AssessorSheet({ assessor, rank, isOpen, onOpenChange }: AssessorSheetProps) {
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!assessor || isExporting) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");

      // Find the ScrollArea viewport and temporarily expand it
      const sheetEl = sheetContentRef.current;
      if (!sheetEl) return;

      const scrollViewport = sheetEl.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
      const originalViewportStyles = scrollViewport
        ? { height: scrollViewport.style.height, overflow: scrollViewport.style.overflow }
        : null;

      if (scrollViewport) {
        scrollViewport.style.height = "auto";
        scrollViewport.style.overflow = "visible";
      }

      // Small delay to let layout settle
      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await toPng(sheetEl, {
        backgroundColor: "#0d1117",
        pixelRatio: 2,
        skipFonts: true,
        width: sheetEl.offsetWidth,
      });

      // Restore scroll area
      if (scrollViewport && originalViewportStyles) {
        scrollViewport.style.height = originalViewportStyles.height;
        scrollViewport.style.overflow = originalViewportStyles.overflow;
      }

      const link = document.createElement("a");
      link.download = `${assessor.nome_assessor.replace(/\s+/g, "_")}_performance.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [assessor, isExporting]);

  // All useMemo hooks MUST be called before any early return (Rules of Hooks)
  const revenueAchievement = assessor ? (assessor.receita_total / (assessor.meta_receita || 1)) * 100 : 0;
  const fundingAchievement = assessor ? (assessor.captacao_liquida_total / (assessor.meta_captacao || 1)) * 100 : 0;

  // ROA calculated the same way as AdvisorRevenueTable
  const roa_total = (assessor && assessor.custodia_net > 0)
    ? (assessor.receita_total / assessor.custodia_net) * 12 * 100
    : 0;
  const ROA_TARGET = 1.0;
  const roaIcon = roa_total >= ROA_TARGET
    ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
    : roa_total >= ROA_TARGET * 0.7
      ? <Minus className="w-3.5 h-3.5 text-euro-gold" />
      : <TrendingDown className="w-3.5 h-3.5 text-red-500" />;

  const investRevenue = useMemo(() => {
    if (!assessor) return 0;
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
    if (!assessor) return 0;
    return (
      assessor.receita_seguros +
      assessor.receita_previdencia +
      assessor.receita_consorcios +
      assessor.receita_cambio
    );
  }, [assessor]);

  const investShare = assessor ? (investRevenue / (assessor.receita_total || 1)) * 100 : 0;
  const csShare = assessor ? (csRevenue / (assessor.receita_total || 1)) * 100 : 0;

  const investProducts = useMemo(() => {
    if (!assessor) return [];
    return [
      { label: 'Renda Variável (B3)', value: assessor.receita_b3 },
      { label: 'Fundos (Asset)', value: assessor.asset_m_1 },
      { label: 'Estruturadas', value: assessor.receitas_estruturadas },
      { label: 'Renda Fixa & Cetip', value: assessor.receita_cetipados + assessor.receita_renda_fixa + assessor.receitas_ofertas_rf },
      { label: 'Ofertas Fundos', value: assessor.receitas_ofertas_fundos },
      { label: 'Offshore', value: assessor.receitas_offshore },
    ].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  }, [assessor]);

  const csProducts = useMemo(() => {
    if (!assessor) return [];
    return [
      { label: 'Seguros', value: assessor.receita_seguros },
      { label: 'Previdência', value: assessor.receita_previdencia },
      { label: 'Consórcios', value: assessor.receita_consorcios },
      { label: 'Câmbio', value: assessor.receita_cambio },
    ].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  }, [assessor]);

  // Early return AFTER all hooks
  if (!assessor) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent ref={sheetContentRef} className="bg-gradient-to-b from-[#0d1117] to-[#141820] text-white border-l border-white/5 w-full sm:max-w-2xl p-0 shadow-2xl flex flex-col h-full [&>button]:text-white [&>button]:bg-white/5 [&>button]:hover:bg-white/10 [&>button]:border-white/10 [&>button]:z-50">
        {/* HERO HEADER */}
        <div className="relative w-full overflow-hidden border-b border-white/5">
            {/* Dark gradient base */}
            <div className="absolute inset-0 bg-gradient-to-b from-euro-navy/90 via-[#0F1014]/95 to-[#0A0A0B] z-0" />
            {/* Background Image (Rocha) - Mobile Only */}
            <div 
                className="absolute inset-0 z-[1] md:hidden pointer-events-none"
                style={{
                    backgroundImage: `url('https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/rocha.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center top',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.25,
                    mixBlendMode: 'screen',
                }}
            />
            
            {/* Download button — top right of header */}
            <button
                onClick={handleDownload}
                disabled={isExporting}
                className="absolute top-3 right-10 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/60 hover:text-white text-[10px] font-data uppercase tracking-wider disabled:opacity-40"
                title="Baixar como PNG"
            >
                {isExporting
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Download className="w-3 h-3" />}
                <span className="hidden sm:inline">{isExporting ? "Exportando..." : "Download"}</span>
            </button>

            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8">
                {/* Avatar with Glow */}
                <div className="relative group shrink-0">
                    <div className={cn(
                        "w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 border-2 border-white/10",
                        !assessor.foto_url && "bg-euro-elevated",
                        assessor.lider && "ring-2 ring-euro-gold ring-offset-2 ring-offset-[#0A0A0B] shadow-[0_0_20px_rgba(250,192,23,0.3)]"
                    )}>
                        {assessor.foto_url ? (
                            <img src={assessor.foto_url} alt={assessor.nome_assessor} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-3xl font-display text-euro-gold">{assessor.nome_assessor.charAt(0)}</span>
                        )}
                    </div>
                </div>

                {/* Name & Badges & Ranking */}
                <div className="flex-1 text-center md:text-left space-y-3">
                    <div className="space-y-1">
                        <SheetTitle className="text-2xl md:text-3xl font-display text-white tracking-tight leading-none">
                            {assessor.nome_assessor}
                        </SheetTitle>
                        <div className="flex flex-wrap justify-center md:justify-start gap-1.5 shadow-sm">
                            <Badge variant="outline" className="bg-white/5 border-white/10 text-white/70 uppercase tracking-tight text-[9px] px-1.5 py-0">
                                {assessor.cod_assessor}
                            </Badge>
                            <Badge variant="outline" className="bg-euro-gold/5 border-euro-gold/20 text-euro-gold uppercase tracking-tight text-[9px] px-1.5 py-0">
                                {assessor.time}
                            </Badge>
                            <Badge variant="outline" className="bg-white/5 border-white/10 text-white/50 uppercase tracking-tight text-[9px] px-1.5 py-0">
                                {assessor.cluster}
                            </Badge>
                        </div>
                    </div>

                    {/* Elegant Super Ranking Box */}
                    <div className="inline-flex items-stretch gap-0 bg-black/30 backdrop-blur-md rounded-lg border border-white/10 shadow-inner overflow-hidden">
                        {/* Position */}
                        <div className="flex flex-col items-center justify-center px-3 py-1.5 border-r border-white/10 bg-euro-gold/10">
                            <span className="text-[9px] text-euro-gold/70 uppercase tracking-widest font-data leading-none mb-0.5">Posição</span>
                            <div className="flex items-baseline gap-0.5">
                                <Trophy className="w-3 h-3 text-euro-gold" />
                                <span className="text-sm font-display text-euro-gold leading-none">
                                    {rank ? `${rank}º` : '—'}
                                </span>
                            </div>
                        </div>
                        {/* Points */}
                        <div className="flex flex-col items-center justify-center px-3 py-1.5">
                            <span className="text-[9px] text-white/40 uppercase tracking-widest font-data leading-none mb-0.5">Super Ranking</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-data text-white font-bold leading-none">
                                    {assessor.pontos_totais_acumulado.toLocaleString("pt-BR")}
                                </span>
                                <span className="text-[9px] text-white/30 uppercase">pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* CONTENT SCROLL AREA */}
        <ScrollArea className="flex-1">
            {/* Subtle ambient glow — mobile only */}
            <div className="md:hidden absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(250,192,23,0.04) 0%, transparent 70%)' }} />
            {/* Printable content ref — captures all data including scroll area contents */}
            <div className="px-5 pb-12 space-y-4 pt-5 relative">
                
                {/* KPI CARDS */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white/[0.04] backdrop-blur-sm p-3.5 rounded-xl border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.07] transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Receita Bruta</span>
                            <DollarSign className="w-4 h-4 text-euro-gold opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-lg md:text-2xl font-display text-white">R$ {assessor.receita_total.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}</p>
                        <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-euro-gold" style={{ width: `${Math.min(revenueAchievement, 100)}%` }} />
                        </div>
                    </div>
                    
                    <div className="bg-white/[0.04] backdrop-blur-sm p-3.5 rounded-xl border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.07] transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Captação Líq.</span>
                            <TrendingUp className="w-4 h-4 text-green-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className={cn("text-base md:text-2xl font-display", assessor.captacao_liquida_total >= 0 ? "text-white" : "text-red-400")}>
                            R$ {assessor.captacao_liquida_total.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}
                        </p>
                        <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                             <div className={cn("h-full", assessor.captacao_liquida_total >= 0 ? "bg-green-400" : "bg-red-400")} style={{ width: `${Math.min(fundingAchievement, 100)}%` }} />
                        </div>
                    </div>

                    <div className="bg-white/[0.04] backdrop-blur-sm p-3.5 rounded-xl border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.07] transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">ROA</span>
                            <Activity className="w-4 h-4 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-base md:text-2xl font-display text-white">{roa_total.toFixed(2)}%</p>
                            {roaIcon}
                        </div>
                        <span className="text-[10px] text-white">Target: {ROA_TARGET.toFixed(2)}%</span>
                    </div>

                    <div className="bg-white/[0.04] backdrop-blur-sm p-3.5 rounded-xl border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.07] transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-data text-white uppercase tracking-widest">Custódia Net</span>
                            <Wallet className="w-4 h-4 text-purple-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-base md:text-2xl font-display text-white">R$ {(assessor.custodia_net / 1000000).toFixed(1)}M</p>
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

