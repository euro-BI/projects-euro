
import React, { useState, useMemo } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Info,
  User,
  Shield,
  Briefcase,
  PieChart,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

interface AdvisorRevenueTableProps {
  data: AssessorResumo[];
  teamPhotos?: Map<string, string>;
  onAssessorClick?: (assessor: AssessorResumo) => void;
  selectedMonth?: string;
}

type ViewType = "geral" | "invest" | "cs";

export default function AdvisorRevenueTable({ data, teamPhotos, onAssessorClick, selectedMonth }: AdvisorRevenueTableProps) {
  const [view, setView] = useState<ViewType>("geral");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita_total',
    direction: 'desc'
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" /> 
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch (e) {
      return "";
    }
  }, [selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return (value).toFixed(2) + "%";
  };

  const calculatedData = useMemo(() => {
    return data
      .filter(item => {
        const nameMatch = (item.nome_assessor || "").toLowerCase().includes(searchTerm.toLowerCase());
        const codeMatch = (item.cod_assessor || "").toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || codeMatch;
      })
      .map(item => {
        const receita_invest = (item.receita_b3 || 0) + (item.asset_m_1 || 0) + (item.receitas_estruturadas || 0) + 
                              (item.receita_cetipados || 0) + (item.receitas_ofertas_fundos || 0) + 
                              (item.receitas_ofertas_rf || 0) + (item.receita_renda_fixa || 0);
        
        const receita_cs = (item.receita_seguros || 0) + (item.receita_previdencia || 0) + (item.receita_consorcios || 0) + 
                           (item.receita_cambio || 0) + (item.receita_compromissadas || 0) + (item.receitas_offshore || 0);

        const roa_total = item.custodia_net > 0 ? (item.receita_total / item.custodia_net) * 12 * 100 : 0;
        const roa_invest = item.custodia_net > 0 ? (receita_invest / item.custodia_net) * 12 * 100 : 0;
        const roa_cs = item.custodia_net > 0 ? (receita_cs / item.custodia_net) * 12 * 100 : 0;

        return {
          ...item,
          receita_invest,
          receita_cs,
          roa_total,
          roa_invest,
          roa_cs
        };
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aValue: any = a[key as keyof typeof a];
        let bValue: any = b[key as keyof typeof b];

        if (aValue === null || aValue === undefined) aValue = "";
        if (bValue === null || bValue === undefined) bValue = "";

        if (typeof aValue === 'string') {
          return direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        return direction === 'asc' 
          ? (aValue > bValue ? 1 : -1) 
          : (bValue > aValue ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totals = useMemo(() => {
    const initial = {
      custodia_net: 0,
      total_clientes: 0,
      meta_captacao: 0,
      captacao_liquida_total: 0,
      meta_receita: 0,
      receita_total: 0,
      receita_invest: 0,
      receita_cs: 0,
      repasse_total: 0,
      asset_m_1: 0,
      receita_b3: 0,
      receitas_estruturadas: 0,
      receita_cetipados: 0,
      receitas_ofertas_fundos: 0,
      receitas_ofertas_rf: 0,
      receita_renda_fixa: 0,
      receita_seguros: 0,
      receita_previdencia: 0,
      receita_consorcios: 0,
      receita_cambio: 0,
      receita_compromissadas: 0,
      receitas_offshore: 0,
    };

    const sums = calculatedData.reduce((acc, curr) => ({
      custodia_net: acc.custodia_net + (curr.custodia_net || 0),
      total_clientes: acc.total_clientes + (curr.total_clientes || 0),
      meta_captacao: acc.meta_captacao + (curr.meta_captacao || 0),
      captacao_liquida_total: acc.captacao_liquida_total + (curr.captacao_liquida_total || 0),
      meta_receita: acc.meta_receita + (curr.meta_receita || 0),
      receita_total: acc.receita_total + (curr.receita_total || 0),
      receita_invest: acc.receita_invest + curr.receita_invest,
      receita_cs: acc.receita_cs + curr.receita_cs,
      repasse_total: acc.repasse_total + (curr.repasse_total || 0),
      asset_m_1: acc.asset_m_1 + (curr.asset_m_1 || 0),
      receita_b3: acc.receita_b3 + (curr.receita_b3 || 0),
      receitas_estruturadas: acc.receitas_estruturadas + (curr.receitas_estruturadas || 0),
      receita_cetipados: acc.receita_cetipados + (curr.receita_cetipados || 0),
      receitas_ofertas_fundos: acc.receitas_ofertas_fundos + (curr.receitas_ofertas_fundos || 0),
      receitas_ofertas_rf: acc.receitas_ofertas_rf + (curr.receitas_ofertas_rf || 0),
      receita_renda_fixa: acc.receita_renda_fixa + (curr.receita_renda_fixa || 0),
      receita_seguros: acc.receita_seguros + (curr.receita_seguros || 0),
      receita_previdencia: acc.receita_previdencia + (curr.receita_previdencia || 0),
      receita_consorcios: acc.receita_consorcios + (curr.receita_consorcios || 0),
      receita_cambio: acc.receita_cambio + (curr.receita_cambio || 0),
      receita_compromissadas: acc.receita_compromissadas + (curr.receita_compromissadas || 0),
      receitas_offshore: acc.receitas_offshore + (curr.receitas_offshore || 0),
    }), initial);

    const roa_total = sums.custodia_net > 0 ? (sums.receita_total / sums.custodia_net) * 12 * 100 : 0;
    const roa_invest = sums.custodia_net > 0 ? (sums.receita_invest / sums.custodia_net) * 12 * 100 : 0;
    const roa_cs = sums.custodia_net > 0 ? (sums.receita_cs / sums.custodia_net) * 12 * 100 : 0;

    return { ...sums, roa_total, roa_invest, roa_cs };
  }, [calculatedData]);

  const renderTrendIcon = (value: number, meta?: number) => {
    if (meta === undefined) return null;
    if (value >= meta) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (value >= meta * 0.7) return <Minus className="w-3 h-3 text-euro-gold" />;
    return <TrendingDown className="w-3 h-3 text-red-500" />;
  };

  return (
    <div className="space-y-8">
      {/* View Selectors & Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0">
          {view === "geral" && `Indicadores gerais por assessores ${formattedMonth ? `(${formattedMonth})` : ""}`}
          {view === "invest" && `Detalhamento da receita invest por assessor ${formattedMonth ? `(${formattedMonth})` : ""}`}
          {view === "cs" && `Detalhamento da receita CS por assessor ${formattedMonth ? `(${formattedMonth})` : ""}`}
        </h3>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Search Field */}
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
            <Input
              type="text"
              placeholder="Buscar assessor por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
            />
          </div>

          <div className="flex bg-euro-elevated p-1 rounded-lg border border-white/5 shadow-inner flex-shrink-0">
            <button
              onClick={() => setView("geral")}
              className={cn(
                "px-6 py-2 text-xs font-data uppercase tracking-widest transition-all rounded-md",
                view === "geral" 
                  ? "bg-euro-gold text-euro-navy shadow-lg font-bold" 
                  : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              Indicadores gerais
            </button>
            <button
              onClick={() => setView("invest")}
              className={cn(
                "px-6 py-2 text-xs font-data uppercase tracking-widest transition-all rounded-md",
                view === "invest" 
                  ? "bg-euro-gold text-euro-navy shadow-lg font-bold" 
                  : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              Invest
            </button>
            <button
              onClick={() => setView("cs")}
              className={cn(
                "px-6 py-2 text-xs font-data uppercase tracking-widest transition-all rounded-md",
                view === "cs" 
                  ? "bg-euro-gold text-euro-navy shadow-lg font-bold" 
                  : "text-[#5C5C50] hover:text-[#A0A090]"
              )}
            >
              CS
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative group/table">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />
        
        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-30">
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                <th 
                  onClick={() => handleSort('time')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                </th>
                <th 
                  onClick={() => handleSort('nome_assessor')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                </th>
                
                <AnimatePresence mode="wait">
                  {view === "geral" && (
                    <>
                      <th onClick={() => handleSort('custodia_net')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Net/Clientes <SortIcon column="custodia_net" /></div>
                      </th>
                      <th onClick={() => handleSort('meta_captacao')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Meta Captação <SortIcon column="meta_captacao" /></div>
                      </th>
                      <th onClick={() => handleSort('captacao_liquida_total')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Captação Líquida <SortIcon column="captacao_liquida_total" /></div>
                      </th>
                      <th onClick={() => handleSort('meta_receita')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Meta Receita <SortIcon column="meta_receita" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_total')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Total <SortIcon column="receita_total" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_invest')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Invest <SortIcon column="receita_invest" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_cs')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita CS <SortIcon column="receita_cs" /></div>
                      </th>
                      <th onClick={() => handleSort('roa_total')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">ROA Total <SortIcon column="roa_total" /></div>
                      </th>
                      <th onClick={() => handleSort('roa_invest')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">ROA Invest <SortIcon column="roa_invest" /></div>
                      </th>
                      <th onClick={() => handleSort('roa_cs')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">ROA CS <SortIcon column="roa_cs" /></div>
                      </th>
                      <th onClick={() => handleSort('repasse_total')} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Repasse Total <SortIcon column="repasse_total" /></div>
                      </th>
                    </>
                  )}
                  {view === "invest" && (
                    <>
                      <th onClick={() => handleSort('receita_invest')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Invest Total <SortIcon column="receita_invest" /></div>
                      </th>
                      <th onClick={() => handleSort('roa_invest')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">ROA Invest <SortIcon column="roa_invest" /></div>
                      </th>
                      <th onClick={() => handleSort('asset_m_1')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Asset m-1 <SortIcon column="asset_m_1" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_b3')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita B3 <SortIcon column="receita_b3" /></div>
                      </th>
                      <th onClick={() => handleSort('receitas_estruturadas')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Estruturadas <SortIcon column="receitas_estruturadas" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_cetipados')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Cetipados <SortIcon column="receita_cetipados" /></div>
                      </th>
                      <th onClick={() => handleSort('receitas_ofertas_fundos')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Ofertas - Fundos <SortIcon column="receitas_ofertas_fundos" /></div>
                      </th>
                      <th onClick={() => handleSort('receitas_ofertas_rf')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Ofertas - RF <SortIcon column="receitas_ofertas_rf" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_renda_fixa')} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Renda Fixa <SortIcon column="receita_renda_fixa" /></div>
                      </th>
                    </>
                  )}
                  {view === "cs" && (
                    <>
                      <th onClick={() => handleSort('receita_cs')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita CS <SortIcon column="receita_cs" /></div>
                      </th>
                      <th onClick={() => handleSort('roa_cs')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">ROA CS <SortIcon column="roa_cs" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_seguros')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Seguros <SortIcon column="receita_seguros" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_previdencia')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Previdência <SortIcon column="receita_previdencia" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_consorcios')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receita Consórcios <SortIcon column="receita_consorcios" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_compromissadas')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receitas Compromissadas <SortIcon column="receita_compromissadas" /></div>
                      </th>
                      <th onClick={() => handleSort('receita_cambio')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Receitas Câmbio <SortIcon column="receita_cambio" /></div>
                      </th>
                      <th onClick={() => handleSort('receitas_offshore')} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                        <div className="flex items-center justify-end gap-2">Offshore <SortIcon column="receitas_offshore" /></div>
                      </th>
                    </>
                  )}
                </AnimatePresence>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/[0.05]">
              {calculatedData.map((item) => (
                <motion.tr 
                  layout
                  key={item.cod_assessor}
                  onClick={() => onAssessorClick?.(item)}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all cursor-pointer text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time.toUpperCase()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img 
                            src={teamPhotos.get(item.time.toUpperCase())} 
                            alt={item.time} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {item.time.substring(0, 3).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Assessor */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors",
                          item.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                        )}>
                          {item.foto_url ? (
                            <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 opacity-20" />
                          )}
                        </div>
                        {item.lider && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                            <Shield className="w-2 h-2 text-euro-navy" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                          {item.nome_assessor}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
                          <span className="font-mono">{item.cod_assessor}</span>
                          <span className="text-white/40">•</span>
                          <span className="uppercase">{item.cluster}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Metrics View Geral */}
                  {view === "geral" && (
                    <>
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <div className="flex flex-col">
                          <span className="text-white">{formatCurrency(item.custodia_net)}</span>
                          <span className="text-[10px] text-white/60">({item.total_clientes})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.meta_captacao)}
                      </td>
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn(
                            "font-bold",
                            item.captacao_liquida_total >= 0 ? "text-white" : "text-red-400"
                          )}>
                            {formatCurrency(item.captacao_liquida_total)}
                          </span>
                          {renderTrendIcon(item.captacao_liquida_total, item.meta_captacao)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.meta_receita)}
                      </td>
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-white">
                            {formatCurrency(item.receita_total)}
                          </span>
                          {renderTrendIcon(item.receita_total, item.meta_receita)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_invest)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_cs)}
                      </td>
                      <td className="py-3 px-4 text-right border-r border-white/5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-white">{formatPercent(item.roa_total)}</span>
                          {renderTrendIcon(item.roa_total, 1.0)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatPercent(item.roa_invest)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatPercent(item.roa_cs)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatCurrency(item.repasse_total)}
                      </td>
                    </>
                  )}

                  {/* Metrics View Invest */}
                  {view === "invest" && (
                    <>
                      <td className="py-3 px-4 text-right font-bold text-white border-r border-white/5">
                        {formatCurrency(item.receita_invest)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatPercent(item.roa_invest)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.asset_m_1)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_b3)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receitas_estruturadas)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_cetipados)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receitas_ofertas_fundos)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receitas_ofertas_rf)}
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        {formatCurrency(item.receita_renda_fixa)}
                      </td>
                    </>
                  )}

                  {/* Metrics View CS */}
                  {view === "cs" && (
                    <>
                      <td className="py-3 px-4 text-right font-bold text-white border-r border-white/5">
                        {formatCurrency(item.receita_cs)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatPercent(item.roa_cs)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_seguros)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_previdencia)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_consorcios)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_compromissadas)}
                      </td>
                      <td className="py-3 px-4 text-right text-white border-r border-white/5">
                        {formatCurrency(item.receita_cambio)}
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        {formatCurrency(item.receitas_offshore)}
                      </td>
                    </>
                  )}
                </motion.tr>
              ))}
            </tbody>
            
            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td colSpan={1} className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                
                {view === "geral" && (
                  <>
                    <td className="py-4 px-4 text-right border-r border-white/5 bg-black/80">
                      <div className="flex flex-col">
                        <span className="text-white">{formatCurrency(totals.custodia_net)}</span>
                        <span className="text-[10px] text-white/60">({totals.total_clientes})</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.meta_captacao)}</td>
                    <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrency(totals.captacao_liquida_total)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.meta_receita)}</td>
                    <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_total)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_invest)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_cs)}</td>
                    <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatPercent(totals.roa_total)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatPercent(totals.roa_invest)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatPercent(totals.roa_cs)}</td>
                    <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrency(totals.repasse_total)}</td>
                  </>
                )}

                {view === "invest" && (
                  <>
                    <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_invest)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatPercent(totals.roa_invest)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.asset_m_1)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_b3)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receitas_estruturadas)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_cetipados)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receitas_ofertas_fundos)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receitas_ofertas_rf)}</td>
                    <td className="py-4 px-4 text-right text-white bg-black/80">{formatCurrency(totals.receita_renda_fixa)}</td>
                  </>
                )}

                {view === "cs" && (
                  <>
                    <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_cs)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatPercent(totals.roa_cs)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_seguros)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_previdencia)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_consorcios)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_compromissadas)}</td>
                    <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals.receita_cambio)}</td>
                    <td className="py-4 px-4 text-right text-white bg-black/80">{formatCurrency(totals.receitas_offshore)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info Legend */}
      <div className="flex flex-wrap gap-6 items-center text-[10px] font-data text-[#5C5C50] uppercase tracking-widest px-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Meta Atingida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-euro-gold" />
          <span>Alerta (+70% Meta)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Abaixo da Meta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-euro-gold/20 flex items-center justify-center border border-euro-gold/50 shadow-[0_0_5px_rgba(250,192,23,0.3)]">
            <Shield className="w-2.5 h-2.5 text-euro-gold" />
          </div>
          <span>Líder de Time</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Info className="w-3 h-3 text-euro-gold" />
          <span>Cálculo de ROA baseado em receita anualizada</span>
        </div>
      </div>
    </div>
  );
}
