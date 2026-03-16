import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  User,
  Shield,
  FileText,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Info,
  Calendar,
  UserCheck,
  Zap,
  Target,
  ListChecks
} from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

// Types defined based on user prompt
interface ClientePosicaoBlack {
  cod_cliente: string;
  nome_cliente: string;
  cod_assessor: string;
  nome_assessor: string;
  status_cliente: string;
  net_em_m: number;
  data_ultima_posicao: string;
  data_ultima_operacao: string;
  codigo_ultima_operacao: string;
  comissao_ultima_operacao: number;
  qtd_boletas_ultima_operacao: number;
  data_penultima_operacao: string;
  codigo_penultima_operacao: string;
  comissao_penultima_operacao: number;
  qtd_boletas_penultima_operacao: number;
  validado: string; // "SIM" | "NAO"
  era_validado: string; // "SIM" | "NAO"
  validado_bonus: string; // "SIM" | "NAO"
  dias_desde_ultima_operacao: number;
  dias_entre_operacoes: number;
  chave_data_assessor: string;
  chave_data_cliente: string;
  nivel: string;
  trigger: number;
  bonus: number;
  soma_valor_euro: number;
}

interface AssessorInfo {
  cod_assessor: string;
  nome_assessor: string;
  foto_url: string | null;
  time: string;
  lider: boolean;
  cluster: string;
}

interface PosicaoBlackProps {
  selectedMonth: string;
  selectedTeam?: string;
  selectedAssessorId?: string;
  teamPhotos?: Map<string, string>;
}

export function PosicaoBlack({ selectedMonth, selectedTeam = "all", selectedAssessorId = "all", teamPhotos }: PosicaoBlackProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedAssessorForModal, setSelectedAssessorForModal] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [opportunitiesSearch, setOpportunitiesSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [oppsSortConfig, setOppsSortConfig] = useState<{
    key: keyof ClientePosicaoBlack | 'time';
    direction: 'asc' | 'desc';
  }>({ key: 'dias_desde_ultima_operacao', direction: 'desc' });
  const [advisorSortConfig, setAdvisorSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'validosBonus', direction: 'desc' });
  const itemsPerPage = 10;
  const isMobile = useIsMobile();

  // 1. Fetch ALL data from the view (Centralized)
  const { data: allViewData, isLoading: isLoadingView } = useQuery({
    queryKey: ["posicao-black-all-view-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_resumo_clientes_posicao" as any)
        .select("*");
        
      if (error) throw error;
      return data as any as ClientePosicaoBlack[];
    }
  });

  const selectedMonthKey = useMemo(() => {
    if (!selectedMonth) return "";
    return selectedMonth.substring(0, 7);
  }, [selectedMonth]);

  const previousMonthKey = useMemo(() => {
    if (!selectedMonthKey) return "";
    const base = new Date(`${selectedMonthKey}-01T00:00:00`);
    base.setMonth(base.getMonth() - 1);
    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [selectedMonthKey]);

  const isInMonth = (dateStr: string | null, monthKey: string) => {
    if (!dateStr || !monthKey) return false;
    return dateStr.substring(0, 7) === monthKey;
  };

  const isSameMonth = (dateStr: string | null) => isInMonth(dateStr, selectedMonthKey);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  // 1.2 Fetch Active Assessors Info (From Latest Position in mv_resumo_assessor)
  const { data: activeAssessorsData, isLoading: isLoadingActive } = useQuery({
    queryKey: ["active-assessors-info-posicao-black"],
    queryFn: async () => {
      // 1. Get latest date
      const { data: latestDateData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      
      const latestDate = (latestDateData as any)?.data_posicao;
      if (!latestDate) return new Map<string, AssessorInfo>();

      // 2. Get assessors info in that date
      const { data } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, foto_url, time, lider, cluster")
        .eq("data_posicao", latestDate);
      
      const infoMap = new Map<string, AssessorInfo>();
      data?.forEach((a: any) => {
        if (a.cod_assessor) infoMap.set(a.cod_assessor, a);
      });
      return infoMap;
    }
  });

  const { aggregatedData, totals, comparisons, opportunitiesData } = useMemo(() => {
    if (!allViewData || !activeAssessorsData) {
      return { 
        aggregatedData: [], 
        totals: { oportunidades: 0, oportunidadesNuncaBoletaram: 0, oportunidadesBoletaramMaisDeUmAno: 0, novasBoletas: 0, bonusBruto: 0, bonusLiquido: 0 },
        comparisons: {
          oportunidades: { previous: 0 },
          novasBoletas: { previous: 0 },
          bonusBruto: { previous: 0 },
          bonusLiquido: { previous: 0 }
        },
        opportunitiesData: []
      };
    }

    // Aggregate by assessor
    const assessorStats = new Map<string, {
      cod_assessor: string;
      nome_assessor: string;
      nivel: string | null;
      trigger: number;
      oportunidades: number;
      novasBoletas: number;
      validosBonus: number;
      bonusBruto: number;
      advisorInfo?: AssessorInfo;
    }>();

    const opportunities: ClientePosicaoBlack[] = [];
    let totalOportunidades = 0;
    let totalOportunidadesNuncaBoletaram = 0;
    let totalOportunidadesBoletaramMaisDeUmAno = 0;
    let totalNovasBoletas = 0;
    let totalBonusBruto = 0;
    let prevTotalNovasBoletas = 0;
    let prevTotalBonusBruto = 0;

    allViewData.forEach(row => {
      const cod = row.cod_assessor;
      
      // Only process if assessor is active in the latest position
      if (!activeAssessorsData.has(cod)) return;
      const advisorInfo = activeAssessorsData.get(cod);
      if (selectedTeam !== "all" && advisorInfo?.time !== selectedTeam) return;
      if (selectedAssessorId !== "all" && cod !== selectedAssessorId) return;
      
      if (!assessorStats.has(cod)) {
        assessorStats.set(cod, {
          cod_assessor: cod,
          nome_assessor: advisorInfo?.nome_assessor || row.nome_assessor || "",
          nivel: row.nivel ?? null,
          trigger: row.trigger || 0,
          oportunidades: 0,
          novasBoletas: 0,
          validosBonus: 0,
          bonusBruto: 0,
          advisorInfo
        });
      }

      const stats = assessorStats.get(cod)!;
      if (!stats.nivel && row.nivel) {
        stats.nivel = row.nivel;
      }

      // 1. Oportunidades (sempre da posição atual; não respeita filtro de data)
      const isCurrentOperationMonth = isInMonth(row.data_ultima_operacao, selectedMonthKey);
      const isPreviousOperationMonth = isInMonth(row.data_ultima_operacao, previousMonthKey);

      if (row.validado === "SIM") {
        stats.oportunidades++;
        totalOportunidades++;
        opportunities.push(row);

        const nuncaBoletou = !row.data_ultima_operacao;
        if (nuncaBoletou) {
          totalOportunidadesNuncaBoletaram++;
        } else if ((row.dias_desde_ultima_operacao ?? 0) > 365) {
          totalOportunidadesBoletaramMaisDeUmAno++;
        }
      }

      // 2. Novas Boletas (If operated in selected month and was recovery/new)
      if (row.era_validado === "SIM" && isCurrentOperationMonth) {
        stats.novasBoletas++;
        totalNovasBoletas++;
      }
      if (row.era_validado === "SIM" && isPreviousOperationMonth) {
        prevTotalNovasBoletas++;
      }

      // 3. Bonus & Position (If position is in selected month)
      if (row.validado_bonus === "SIM" && isCurrentOperationMonth) {
        stats.validosBonus++;
        stats.bonusBruto += (row.bonus || 0);
        totalBonusBruto += (row.bonus || 0);
      }
      if (row.validado_bonus === "SIM" && isPreviousOperationMonth) {
        prevTotalBonusBruto += (row.bonus || 0);
      }
    });

    const data = Array.from(assessorStats.values())
      .filter(item => {
        if (item.nivel === null) return false;
        if (isMobile && item.bonusBruto <= 0) return false;
        const searchLower = searchTerm.toLowerCase();
        const name = item.nome_assessor || "";
        const code = item.cod_assessor || "";
        return (
          name.toLowerCase().includes(searchLower) ||
          code.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => {
        const key = advisorSortConfig.key;
        const dir = advisorSortConfig.direction;
        
        let aValue: any = a[key as keyof typeof a];
        let bValue: any = b[key as keyof typeof b];

        // Custom handling for nested advisor info if needed
        if (key === 'time') {
          aValue = a.advisorInfo?.time || "";
          bValue = b.advisorInfo?.time || "";
        } else if (key === 'bonusLiquido') {
          aValue = a.bonusBruto * 0.82;
          bValue = b.bonusBruto * 0.82;
        }

        if (aValue === null || aValue === undefined) aValue = "";
        if (bValue === null || bValue === undefined) bValue = "";

        if (typeof aValue === 'string') {
          return dir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return dir === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
      });

    return {
      aggregatedData: data,
      totals: {
        oportunidades: totalOportunidades,
        oportunidadesNuncaBoletaram: totalOportunidadesNuncaBoletaram,
        oportunidadesBoletaramMaisDeUmAno: totalOportunidadesBoletaramMaisDeUmAno,
        novasBoletas: totalNovasBoletas,
        bonusBruto: totalBonusBruto,
        bonusLiquido: totalBonusBruto * 0.82
      },
      comparisons: {
        oportunidades: { previous: 0 },
        novasBoletas: { previous: prevTotalNovasBoletas },
        bonusBruto: { previous: prevTotalBonusBruto },
        bonusLiquido: { previous: prevTotalBonusBruto * 0.82 }
      },
      opportunitiesData: opportunities
    };
  }, [allViewData, activeAssessorsData, selectedMonthKey, previousMonthKey, searchTerm, advisorSortConfig, selectedTeam, selectedAssessorId, isMobile]);

  // Opportunities filtered and paginated
  const { filteredOpportunities, paginatedOpportunities, totalPages } = useMemo(() => {
    const searchLower = opportunitiesSearch.toLowerCase();
    
    // 1. Filter
    let filtered = opportunitiesData.filter(op => {
      const advisorInfo = activeAssessorsData?.get(op.cod_assessor);
      const assessorName = advisorInfo?.nome_assessor || op.nome_assessor || "";
      const assessorCode = op.cod_assessor || "";
      const clientName = op.nome_cliente || "Nome não identificado";
      const clientCode = op.cod_cliente || "";
      
      return (
        assessorName.toLowerCase().includes(searchLower) ||
        assessorCode.toLowerCase().includes(searchLower) ||
        clientName.toLowerCase().includes(searchLower) ||
        clientCode.toLowerCase().includes(searchLower)
      );
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (oppsSortConfig.key === 'time') {
        aValue = activeAssessorsData?.get(a.cod_assessor)?.time || "";
        bValue = activeAssessorsData?.get(b.cod_assessor)?.time || "";
      } else if (oppsSortConfig.key === 'nome_assessor') {
        aValue = activeAssessorsData?.get(a.cod_assessor)?.nome_assessor || a.nome_assessor || "";
        bValue = activeAssessorsData?.get(b.cod_assessor)?.nome_assessor || b.nome_assessor || "";
      } else {
        aValue = a[oppsSortConfig.key as keyof ClientePosicaoBlack];
        bValue = b[oppsSortConfig.key as keyof ClientePosicaoBlack];
      }

      // Handle nulls
      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (typeof aValue === 'string') {
        const aStr = String(aValue);
        const bStr = String(bValue);
        return oppsSortConfig.direction === 'asc' 
          ? aStr.localeCompare(bStr) 
          : bStr.localeCompare(aStr);
      }

      return oppsSortConfig.direction === 'asc' 
        ? (aValue > bValue ? 1 : -1) 
        : (bValue > aValue ? 1 : -1);
    });

    const pages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return { 
      filteredOpportunities: filtered, 
      paginatedOpportunities: paginated, 
      totalPages: pages 
    };
  }, [opportunitiesData, opportunitiesSearch, currentPage, oppsSortConfig, activeAssessorsData]);

  const handleSort = (key: keyof ClientePosicaoBlack | 'time') => {
    setOppsSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    setCurrentPage(1);
  };

  const handleAdvisorSort = (key: string) => {
    setAdvisorSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const HelpDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="w-10 h-10 rounded-xl bg-euro-gold/10 border-euro-gold/20 hover:bg-euro-gold/20 text-euro-gold transition-colors shrink-0">
          <HelpCircle className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="border-b border-white/10 pb-4 mb-6">
          <DialogTitle className="text-2xl font-display text-euro-gold flex items-center gap-3 tracking-tight">
            <Info className="w-6 h-6" />
            Regras de Validação – Posição Black
          </DialogTitle>
          <p className="text-sm text-white/40 font-data uppercase tracking-widest mt-2">
            Entenda como identificamos clientes novos e reativados
          </p>
        </DialogHeader>

        <div className="space-y-8">
          {/* Seção Agrupamento */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white font-bold">
              <Calendar className="w-4 h-4 text-euro-gold" /> Agrupamento Mensal (Safras)
            </h3>
            <div className="bg-white/5 p-5 rounded-xl border border-white/10 text-sm leading-relaxed text-white/70">
              <p>Para simplificar a análise, consolidamos todas as movimentações dentro do <span className="text-white font-bold">Mês Fechado</span>.</p>
              <p className="mt-2 text-xs italic text-white/40 border-l-2 border-euro-gold/30 pl-3">
                Exemplo: Se o cliente operou nos dias 05 e 20 do mesmo mês, somamos os valores e consideramos uma única safra de bônus.
              </p>
            </div>
          </section>

          {/* Seção Cliente Validado */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white font-bold">
              <UserCheck className="w-4 h-4 text-euro-gold" /> Cliente Validado
            </h3>
            <div className="bg-white/5 p-5 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-euro-gold/10 flex items-center justify-center shrink-0 border border-euro-gold/20">
                  <span className="text-euro-gold font-bold text-xs">01</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Novo Cliente</p>
                  <p className="text-xs text-white/50 mt-1 italic">Clientes que nunca realizaram operações na base histórica da Euro.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-euro-gold/10 flex items-center justify-center shrink-0 border border-euro-gold/20">
                  <span className="text-euro-gold font-bold text-xs">02</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Cliente Reativado</p>
                  <p className="text-xs text-white/50 mt-1 italic">Clientes que realizaram operações, mas estavam inativos há mais de 365 dias.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Seção Bônus */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white font-bold">
              <Zap className="w-4 h-4 text-euro-gold" /> Validação com Bônus
            </h3>
            <div className="bg-euro-gold/5 p-5 rounded-xl border border-euro-gold/20 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
              <p className="text-white/90 font-medium text-sm">O bônus é liberado quando o cliente passa por dois critérios:</p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <ListChecks className="w-3 h-3 text-green-500" />
                  </div>
                  <span>Ser um cliente <span className="text-white font-bold">Validado</span> (Novo ou Reativado).</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <Target className="w-3 h-3 text-green-500" />
                  </div>
                  <span>Atingir o <span className="text-white font-bold">Gatilho (Trigger)</span> de receita definido para o nível do assessor.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-[10px] text-white/20 font-data uppercase tracking-[0.3em]">
            Sistema de Bonificação – Eurostock
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  const downloadXLSX = () => {
    const rows = filteredOpportunities.map((op) => {
      const advisorInfo = activeAssessorsData?.get(op.cod_assessor);
      const assessorName = advisorInfo?.nome_assessor || op.nome_assessor || "";

      return {
        Time: advisorInfo?.time || "",
        "Assessor": assessorName,
        "Cód. Assessor": op.cod_assessor || "",
        "Cód. Cliente": op.cod_cliente || "",
        "Nome do Cliente": op.nome_cliente || "Nome não identificado",
        "Custódia": op.net_em_m || 0,
        "Última Operação": formatDate(op.data_ultima_operacao),
        "Dias s/ Boletar": op.dias_desde_ultima_operacao || 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Oportunidades");
    XLSX.writeFile(workbook, `oportunidades_posicao_black_${selectedMonthKey}.xlsx`);
  };

  const SortIcon = ({ column, config }: { column: string, config: { key: string, direction: 'asc' | 'desc' } }) => {
    if (config.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return config.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" /> 
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  // Clients for the modal table
  const clientsForModal = useMemo(() => {
    if (!selectedAssessorForModal || !allViewData) return [];
    
    return allViewData
      .filter(row => 
        row.cod_assessor === selectedAssessorForModal && 
        isSameMonth(row.data_ultima_operacao) &&
        row.era_validado === "SIM" // Only show clients that "boletaram" (new/recovery)
      )
      .sort((a, b) => {
        // Highlight SIM first
        if (a.validado_bonus === "SIM" && b.validado_bonus !== "SIM") return -1;
        if (a.validado_bonus !== "SIM" && b.validado_bonus === "SIM") return 1;
        return b.comissao_ultima_operacao - a.comissao_ultima_operacao;
      });
  }, [selectedAssessorForModal, allViewData, selectedMonth]);

  const selectedAssessorName = useMemo(() => {
    if (!selectedAssessorForModal || !activeAssessorsData) return "";
    return activeAssessorsData.get(selectedAssessorForModal)?.nome_assessor || "";
  }, [selectedAssessorForModal, activeAssessorsData]);

  const handleRowClick = (codAssessor: string, novasBoletas: number) => {
    if (novasBoletas > 0) {
      setSelectedAssessorForModal(codAssessor);
      setIsModalOpen(true);
    }
  };

  if (isLoadingView || isLoadingActive) {
    return <LoadingOverlay isLoading={true} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total de Oportunidades" 
          value={totals.oportunidades} 
          icon={Users}
          breakdown={[
            {
              label: "Nunca boletaram",
              value: totals.oportunidadesNuncaBoletaram,
              pct: totals.oportunidades > 0 ? (totals.oportunidadesNuncaBoletaram / totals.oportunidades) * 100 : 0
            },
            {
              label: "Boletaram há >1 ano",
              value: totals.oportunidadesBoletaramMaisDeUmAno,
              pct: totals.oportunidades > 0 ? (totals.oportunidadesBoletaramMaisDeUmAno / totals.oportunidades) * 100 : 0
            }
          ]}
        />
        <KPICard 
          title="Novas Boletas" 
          value={totals.novasBoletas} 
          previousValue={comparisons.novasBoletas.previous}
          icon={Briefcase}
        />
        <KPICard 
          title="Bônus Assessor (Bruto)" 
          value={totals.bonusBruto} 
          isCurrency 
          previousValue={comparisons.bonusBruto.previous}
          icon={DollarSign}
        />
        <KPICard 
          title="Bônus Assessor (Líquido)" 
          value={totals.bonusLiquido} 
          isCurrency 
          previousValue={comparisons.bonusLiquido.previous}
          icon={TrendingUp}
        />
      </div>

      {/* Table Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
            Detalhamento por Assessor
          </h3>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
              <Input
                type="text"
                placeholder="Buscar assessor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
              />
            </div>
            <HelpDialog />
          </div>
        </div>

        <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative group/table">
           <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />
           
           <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
            <table className="w-full text-left border-collapse min-w-full sm:min-w-[1000px]">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10.5px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th 
                    onClick={() => handleAdvisorSort('time')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] text-center cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2">Time <SortIcon column="time" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('nome_assessor')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 sm:left-[80px] bg-euro-gold z-40 min-w-[200px] sm:min-w-[250px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('nivel')}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-center">Nível <SortIcon column="nivel" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('trigger')}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-end">Trigger <SortIcon column="trigger" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('oportunidades')}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-center">Oportunidades <SortIcon column="oportunidades" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('novasBoletas')}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-center">Novas Boletas <SortIcon column="novasBoletas" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('validosBonus')}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-center">Válidos p/ Bônus <SortIcon column="validosBonus" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('bonusBruto')}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-2 justify-end">Bônus Bruto <SortIcon column="bonusBruto" config={advisorSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleAdvisorSort('bonusLiquido')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 justify-end">Bônus Líquido <SortIcon column="bonusLiquido" config={advisorSortConfig} /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {aggregatedData.map((item) => (
                  <tr
                    key={item.cod_assessor}
                    onClick={() => handleRowClick(item.cod_assessor, item.novasBoletas)}
                    className={cn(
                      "group even:bg-white/[0.02] transition-all text-[12.6px] font-data border-b border-white/5",
                      item.novasBoletas > 0 ? "cursor-pointer hover:bg-euro-gold/20" : "opacity-80"
                    )}
                  >
                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] hidden sm:table-cell">
                      <div className="flex items-center justify-center">
                        {item.advisorInfo?.time && teamPhotos?.has(item.advisorInfo.time.toUpperCase()) ? (
                          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                            <img 
                              src={teamPhotos.get(item.advisorInfo.time.toUpperCase())} 
                              alt={item.advisorInfo.time} 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                            {item.advisorInfo?.time?.substring(0, 3).toUpperCase() || "-"}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Assessor */}
                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 sm:left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 hidden sm:block">
                          <div className={cn(
                            "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-[12.6px] font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors",
                            item.advisorInfo?.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                          )}>
                            {item.advisorInfo?.foto_url ? (
                              <img src={item.advisorInfo.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 opacity-20" />
                            )}
                          </div>
                          {item.advisorInfo?.lider && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                              <Shield className="w-2 h-2 text-euro-navy" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 py-1 sm:py-0">
                          <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight text-xs sm:text-[12.6px]">
                            {item.nome_assessor}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] sm:text-[12.6px] text-white/90 font-medium">
                            <span className="font-mono">{item.cod_assessor}</span>
                            {item.advisorInfo?.cluster && (
                              <>
                                <span className="text-white/40">•</span>
                                <span className="uppercase">{item.advisorInfo.cluster}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center text-white/80 border-r border-white/5 hidden sm:table-cell">
                      {item.nivel || "-"}
                    </td>
                    <td className="py-3 px-4 text-right text-white/80 border-r border-white/5 hidden sm:table-cell">
                      {formatCurrency(item.trigger)}
                    </td>
                    <td className="py-3 px-4 text-center text-white border-r border-white/5 font-bold hidden sm:table-cell">
                      {formatNumber(item.oportunidades)}
                    </td>
                    <td className="py-3 px-4 text-center text-euro-gold border-r border-white/5 font-bold hidden sm:table-cell">
                      {item.novasBoletas === 0 ? "--" : formatNumber(item.novasBoletas)}
                    </td>
                    <td className="py-3 px-4 text-center text-white border-r border-white/5 hidden sm:table-cell">
                      {item.validosBonus === 0 ? "--" : formatNumber(item.validosBonus)}
                    </td>
                    <td className="py-3 px-4 text-right text-white border-r border-white/5 hidden sm:table-cell">
                      {item.bonusBruto === 0 ? "--" : formatCurrency(item.bonusBruto)}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right font-bold",
                      item.bonusBruto === 0 ? "text-white" : "text-green-400"
                    )}>
                      {item.bonusBruto === 0 ? "--" : formatCurrency(item.bonusBruto * 0.82)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
        </div>
      </div>

      {/* Opportunities Section */}
      <div className="hidden sm:block space-y-4 pt-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
              <Users className="w-5 h-5 text-euro-gold" />
            </div>
            <div>
              <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
                Listagem de Oportunidades
              </h3>
              <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
                Clientes há mais de 365 dias sem boletar
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
              <Input
                type="text"
                placeholder="Buscar por cliente ou assessor..."
                value={opportunitiesSearch}
                onChange={(e) => {
                  setOpportunitiesSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
              />
            </div>
            <Button 
              onClick={downloadXLSX}
              className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold h-10 gap-2 px-4 shadow-lg shadow-euro-gold/10"
            >
              <Download className="w-4 h-4" />
              XLSX
            </Button>
          </div>
        </div>

        <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />
          
          <div className="overflow-auto custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10.5px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th 
                    onClick={() => handleSort('time')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Time <SortIcon column="time" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('nome_assessor')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[250px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('cod_cliente')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Cód. Cliente <SortIcon column="cod_cliente" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('nome_cliente')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 min-w-[250px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Nome do Cliente <SortIcon column="nome_cliente" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('net_em_m')}
                    className="py-4 px-4 font-bold text-right border-r border-euro-navy/10 w-[150px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 justify-end">Custódia <SortIcon column="net_em_m" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('data_ultima_operacao')}
                    className="py-4 px-4 font-bold text-center border-r border-euro-navy/10 w-[150px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 justify-center">Última Op. <SortIcon column="data_ultima_operacao" config={oppsSortConfig} /></div>
                  </th>
                  <th 
                    onClick={() => handleSort('dias_desde_ultima_operacao')}
                    className="py-4 px-4 font-bold text-right w-[150px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 justify-end">Dias s/ Boletar <SortIcon column="dias_desde_ultima_operacao" config={oppsSortConfig} /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {paginatedOpportunities.map((op) => {
                  const advisorInfo = activeAssessorsData?.get(op.cod_assessor);
                  const assessorName = advisorInfo?.nome_assessor || op.nome_assessor || "";

                  return (
                    <tr
                      key={`${op.cod_cliente}-${op.cod_assessor}`}
                      className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-[12.6px] font-data"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px]">
                        <div className="flex items-center justify-center">
                          {advisorInfo?.time && teamPhotos?.has(advisorInfo.time.toUpperCase()) ? (
                            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                              <img 
                                src={teamPhotos.get(advisorInfo.time.toUpperCase())} 
                                alt={advisorInfo.time} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                              {advisorInfo?.time?.substring(0, 3).toUpperCase() || "-"}
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
                              advisorInfo?.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                            )}>
                              {advisorInfo?.foto_url ? (
                                <img src={advisorInfo.foto_url} alt={assessorName} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 opacity-20" />
                              )}
                            </div>
                            {advisorInfo?.lider && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                                <Shield className="w-2 h-2 text-euro-navy" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-white transition-colors uppercase tracking-tight">
                              {assessorName}
                            </span>
                            <div className="flex items-center gap-2 text-[12.6px] text-white font-medium">
                              <span>{op.cod_assessor}</span>
                              {advisorInfo?.cluster && (
                                <>
                                  <span className="text-white">•</span>
                                  <span className="uppercase">{advisorInfo.cluster}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 border-r border-white/10 text-white">
                        {op.cod_cliente}
                      </td>
                      <td className="py-3 px-4 border-r border-white/10">
                        <span className="text-white font-bold uppercase tracking-tight">
                          {op.nome_cliente || "Nome não identificado"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right border-r border-white/10 text-white">
                        {formatCurrency(op.net_em_m)}
                      </td>
                      <td className="py-3 px-4 text-center border-r border-white/10 text-white">
                        {formatDate(op.data_ultima_operacao)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-euro-gold">
                        {formatNumber(op.dias_desde_ultima_operacao || 0)}
                      </td>
                    </tr>
                  );
                })}
                {paginatedOpportunities.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center opacity-20">
                      <div className="flex flex-col items-center gap-4">
                        <Search className="w-10 h-10" />
                        <p className="text-sm font-data uppercase tracking-widest">Nenhuma oportunidade encontrada</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-white/10 bg-black/40 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 px-8">
              <p className="text-[10px] text-white/30 font-data uppercase tracking-widest text-center sm:text-left">
                Mostrando <span className="text-white/60">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white/60">{Math.min(currentPage * itemsPerPage, filteredOpportunities.length)}</span> de <span className="text-white/60">{filteredOpportunities.length}</span> oportunidades
              </p>
              <div className="flex items-center gap-2 justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-euro-gold font-bold px-2">{currentPage}</span>
                  <span className="text-xs font-mono text-white/20">/</span>
                  <span className="text-xs font-mono text-white/40 px-2">{totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="hidden sm:block" />
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalhamento de Boletas */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl bg-[#0D121F] border-euro-gold/30 text-white p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,192,23,0.1),transparent_70%)] pointer-events-none" />
          
          <DialogHeader className="p-8 border-b border-white/10 bg-gradient-to-r from-euro-gold/10 via-transparent to-transparent relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shadow-[0_0_20px_rgba(250,192,23,0.1)]">
                  <Briefcase className="w-7 h-7 text-euro-gold" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-display text-euro-gold tracking-tight">
                    Detalhamento de Boletas
                  </DialogTitle>
                  <p className="text-sm text-white/50 font-data uppercase tracking-[0.2em] mt-1">
                    Assessor: <span className="text-white font-bold">{selectedAssessorName}</span> <span className="text-white/30 ml-2">[{selectedAssessorForModal}]</span>
                  </p>
                </div>
              </div>
              
              <div className="flex gap-10 pr-4">
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-1 font-bold">Total Clientes</p>
                  <p className="text-2xl font-display text-white">{formatNumber(clientsForModal.length)}</p>
                </div>
                <div className="text-right border-l border-white/10 pl-10">
                  <p className="text-[10px] text-euro-gold/50 uppercase tracking-[0.2em] mb-1 font-bold">Válidos p/ Bônus</p>
                  <p className="text-2xl font-display text-euro-gold drop-shadow-[0_0_10px_rgba(250,192,23,0.3)]">
                    {formatNumber(clientsForModal.filter(c => c.validado_bonus === "SIM").length)}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-6">
              <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                      <th className="py-3 px-4 font-bold border-r border-euro-navy/10">Cód. Cliente</th>
                      <th className="py-3 px-4 font-bold border-r border-euro-navy/10">Nome do Cliente</th>
                      <th className="py-3 px-4 font-bold text-right border-r border-euro-navy/10">Custódia</th>
                      <th className="py-3 px-4 font-bold text-right border-r border-euro-navy/10">Vlr. Operações</th>
                      <th className="py-3 px-4 font-bold text-right border-r border-euro-navy/10">Trigger</th>
                      <th className="py-3 px-4 font-bold text-center border-r border-euro-navy/10">Boletas</th>
                      <th className="py-3 px-4 font-bold text-center">Status Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {clientsForModal.map((client) => (
                      <tr 
                        key={client.cod_cliente}
                        className={cn(
                          "group transition-all text-[11px] font-data",
                          client.validado_bonus === "SIM" 
                            ? "bg-euro-gold/10 hover:bg-euro-gold/20" 
                            : "even:bg-white/[0.02] hover:bg-white/[0.05]"
                        )}
                      >
                        <td className="py-3 px-4 font-mono text-white border-r border-white/5">
                          {client.cod_cliente}
                        </td>
                        <td className="py-3 px-4 border-r border-white/5">
                          <span className={cn(
                            "font-bold uppercase tracking-tight",
                            client.validado_bonus === "SIM" ? "text-euro-gold" : "text-white"
                          )}>
                            {client.nome_cliente || "Nome não identificado"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white border-r border-white/5">
                          {formatCurrency(client.net_em_m)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white border-r border-white/5">
                          {formatCurrency(client.comissao_ultima_operacao)}
                        </td>
                        <td className="py-3 px-4 text-right text-white border-r border-white/5">
                          {formatCurrency(client.trigger)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white border-r border-white/5">
                          {formatNumber(client.qtd_boletas_ultima_operacao)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            {client.validado_bonus === "SIM" ? (
                              <Badge className="bg-green-500 text-black border-none font-black px-2 py-0 h-5 text-[9px] uppercase shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                SIM
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-white/20 border-white/10 px-2 py-0 h-5 text-[9px] uppercase font-bold">
                                NÃO
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {clientsForModal.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-20 text-center opacity-20">
                          <div className="flex flex-col items-center gap-4">
                            <FileText className="w-10 h-10" />
                            <p className="text-sm font-data uppercase tracking-widest">Nenhum cliente com boletas</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>

          <div className="p-5 border-t border-white/10 bg-black/60 flex justify-center items-center px-8">
            <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
              Lógica: <span className="text-white/50">Recuperação ({">"}365 dias) ou Novo Cliente + Comissão {">"} Trigger</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({
  title,
  value,
  isCurrency = false,
  previousValue,
  icon: Icon,
  secondaryValue,
  secondaryLabel,
  secondaryIsCurrency = false,
  breakdown,
}: {
  title: string;
  value: number;
  isCurrency?: boolean;
  previousValue?: number;
  icon: any;
  secondaryValue?: number;
  secondaryLabel?: string;
  secondaryIsCurrency?: boolean;
  breakdown?: { label: string; value: number; pct: number }[];
}) {
  const delta = previousValue === undefined ? undefined : value - previousValue;
  const deltaPct = previousValue && delta !== undefined ? (delta / previousValue) * 100 : undefined;
  const deltaTone =
    delta === undefined ? "text-white/50" : delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : "text-euro-gold";

  const deltaValueText =
    delta === undefined
      ? ""
      : `${delta >= 0 ? "+" : "-"}${isCurrency ? formatCurrency(Math.abs(delta)) : formatNumber(Math.abs(delta))}`;
  const deltaPctText =
    delta === undefined ? "" : previousValue && previousValue > 0 && deltaPct !== undefined ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—";

  const showSecondary = secondaryValue !== undefined && !!secondaryLabel;
  const showDelta = delta !== undefined;
  const showBreakdown = !!breakdown?.length;
  const showFooter = showDelta || showSecondary || showBreakdown;

  return (
    <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
      <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-data text-white uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="w-6 h-6 rounded-full bg-euro-gold/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-euro-gold" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className={cn(
          "flex flex-col items-center justify-center py-2",
          showFooter ? "border-b border-euro-gold/20 mb-3" : ""
        )}>
          <span className={cn(
            "text-xl md:text-2xl xl:text-3xl font-display text-[#F5F5F0] text-center leading-tight",
            isCurrency ? "tabular-nums" : ""
          )}>
            {isCurrency ? formatCurrency(value) : formatNumber(value)}
          </span>
        </div>
        {delta !== undefined && (
          <div className="flex items-center justify-between px-1 mb-3 gap-3">
            <span className="text-[10px] font-data uppercase tracking-widest text-white">
              vs mês anterior
            </span>
            <div className="flex flex-col items-end leading-none">
              <div className="flex items-center gap-2 whitespace-nowrap">
                {delta > 0 ? (
                  <TrendingUp className={cn("w-3 h-3", deltaTone)} />
                ) : delta < 0 ? (
                  <TrendingDown className={cn("w-3 h-3", deltaTone)} />
                ) : (
                  <Minus className={cn("w-3 h-3", deltaTone)} />
                )}
                <span className={cn("text-xs font-data tabular-nums whitespace-nowrap", deltaTone)}>
                  {deltaValueText}
                </span>
              </div>
              <span className="text-xs font-data tabular-nums text-white whitespace-nowrap mt-1">
                {deltaPctText}
              </span>
            </div>
          </div>
        )}
        {secondaryValue !== undefined && secondaryLabel && (
          <div className="flex flex-col items-center">
            <span className="text-sm font-data text-[#E8E8E0]">
              {secondaryIsCurrency ? formatCurrency(secondaryValue) : formatNumber(secondaryValue)}
            </span>
            <span className="text-xs font-ui text-white uppercase tracking-tight mt-1">{secondaryLabel}</span>
          </div>
        )}
        {showBreakdown && (
          <div className="space-y-2">
            {breakdown!.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-data uppercase tracking-widest text-white whitespace-nowrap">
                  {item.label}
                </span>
                <span className="text-[10px] font-data tabular-nums text-white/70 whitespace-nowrap">
                  {formatNumber(item.value)} <span className="text-xs text-white">({item.pct.toFixed(1)}%)</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
