
import React, { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Medal, 
  Crown, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Calendar,
  Filter,
  Users,
  User,
  AlertCircle,
  BookOpen,
  Banknote,
  TrendingUp,
  UserPlus,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

interface SuperRankingProps {
  data: AssessorResumo[];
  selectedYear: string;
  onYearChange?: (year: string) => void;
  onAssessorClick?: (assessor: AssessorResumo) => void;
}

type PeriodType = "year" | "s1" | "s2" | "month";

export default function SuperRanking({ data, selectedYear, onYearChange, onAssessorClick }: SuperRankingProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("year");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [mobileDetailAssessor, setMobileDetailAssessor] = useState<any | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Get available months for the selectedYear
  const availableMonths = useMemo(() => {
    const validData = data.filter(d => d.data_posicao);
    const months = Array.from(new Set(validData.map(d => format(parseISO(d.data_posicao), "yyyy-MM")))).sort();
    return months.filter(m => m.startsWith(selectedYear));
  }, [data, selectedYear]);

  // Get available years from data, filtered >= 2026
  const availableYears = useMemo(() => {
    const validData = data.filter(d => d.data_posicao);
    const years = Array.from(new Set(validData.map(d => getYear(parseISO(d.data_posicao)).toString()))).sort().reverse();
    const allYears = years.filter(y => parseInt(y) >= 2026);
    
    // Always ensure current selectedYear is in the list if valid
    if (!allYears.includes(selectedYear) && parseInt(selectedYear) >= 2026) {
      allYears.push(selectedYear);
      allYears.sort().reverse();
    }
    return allYears;
  }, [data, selectedYear]);

  // Aggregate and filter data based on selected period and selectedYear
  const rankingData = useMemo(() => {
    if (!data.length) return [];

    let filtered = data.filter(d => {
      // Basic data validation
      if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null" || d.nome_assessor.toLowerCase() === "undefined") return false;
      
      // Filter out blocked teams and assessors
      if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
      if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
      
      // Filter by selectedYear
      return getYear(parseISO(d.data_posicao)).toString() === selectedYear;
    });

    if (periodType === "s1") {
      filtered = filtered.filter(d => getMonth(parseISO(d.data_posicao)) < 6);
    } else if (periodType === "s2") {
      filtered = filtered.filter(d => getMonth(parseISO(d.data_posicao)) >= 6);
    } else if (periodType === "month" && selectedMonth !== "all") {
      filtered = filtered.filter(d => format(parseISO(d.data_posicao), "yyyy-MM") === selectedMonth);
    }

    // Group by assessor and sum points
    const grouped = filtered.reduce((acc: Record<string, any>, curr) => {
      const key = curr.cod_assessor || "unknown";
      if (!acc[key]) {
        acc[key] = {
          ...curr,
          pontos_captacao: 0,
          pontos_roa_invest: 0,
          pontos_roa_cs: 0,
          pontos_ativacoes: 0,
          pontos_lider: 0,
          pontos_total: 0,
          // Initialize tracking for eligibility (use the first found record as initial state)
          lastDataPosicao: curr.data_posicao,
          elegibilidade: curr.elegibilidade,
          media_movel_clientes_6m: curr.media_movel_clientes_6m,
          media_movel_rupturas_6m: curr.media_movel_rupturas_6m,
          total_fp_300k: curr.total_fp_300k,
          meta_fp300k: curr.meta_fp300k
        };
      }
      
      acc[key].pontos_captacao += curr.pontos_captacao || 0;
      acc[key].pontos_roa_invest += curr.pontos_roa_invest || 0;
      acc[key].pontos_roa_cs += curr.pontos_roa_cs || 0;
      acc[key].pontos_ativacoes += curr.pontos_ativacoes || 0;
      acc[key].pontos_lider += curr.pontos_lider || 0;
      acc[key].pontos_total += curr.pontos_total || 0;

      // Update eligibility info if current record is newer
      if (curr.data_posicao > acc[key].lastDataPosicao) {
        acc[key].lastDataPosicao = curr.data_posicao;
        acc[key].elegibilidade = curr.elegibilidade;
        acc[key].media_movel_clientes_6m = curr.media_movel_clientes_6m;
        acc[key].media_movel_rupturas_6m = curr.media_movel_rupturas_6m;
        acc[key].total_fp_300k = curr.total_fp_300k;
        acc[key].meta_fp300k = curr.meta_fp300k;
      }
      
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.pontos_total - a.pontos_total);
  }, [data, selectedYear, periodType, selectedMonth]);

  const getInelegibilityReason = (assessor: any) => {
    if (assessor.elegibilidade !== false) return null;

    const reasons: string[] = [];
    
    // Regra 1: Média Clientes >= 120
    if (assessor.media_movel_clientes_6m !== undefined && assessor.media_movel_clientes_6m >= 120) {
      reasons.push(`Média Clientes (${Math.round(assessor.media_movel_clientes_6m)}) ≥ 120`);
    }

    // Regra 2: Atingimento FP 300k+ > 50%
    const percFP = (assessor.total_fp_300k && assessor.meta_fp300k) 
      ? (assessor.total_fp_300k / assessor.meta_fp300k) * 100 
      : 0;
      
    if (percFP <= 50) {
      reasons.push(`Atingimento FP (${percFP.toFixed(0)}%) ≤ 50%`);
    }

    // Regra 3: Média Rupturas <= 5
    if (assessor.media_movel_rupturas_6m !== undefined && assessor.media_movel_rupturas_6m > 5) {
      reasons.push(`Média Rupturas (${assessor.media_movel_rupturas_6m.toFixed(1)}) > 5`);
    }
    
    if (reasons.length === 0) return "Critérios de elegibilidade não atingidos";
    
    return (
      <div className="flex flex-col gap-1">
        <span className="font-bold text-red-400 mb-1 text-xs uppercase tracking-wider">Inelegível ao Super Ranking</span>
        {reasons.map((r, i) => (
          <span key={i} className="text-[10px] text-white/80">• {r}</span>
        ))}
      </div>
    );
  };

  const top3 = rankingData.slice(0, 3);
  const others = rankingData.slice(3);

  const renderPodiumItem = (assessor: any, position: number) => {
    if (!assessor) return null;

    // Robust check for eligibility (handles boolean false, string "false", and 0/null if needed)
    const isInelegivel = assessor.elegibilidade === false || assessor.elegibilidade === "false";

    const colors = {
      1: "border-euro-gold text-euro-gold shadow-[0_0_50px_rgba(250,192,23,0.25)]",
      2: "border-[#C0C0C0] text-[#C0C0C0] shadow-[0_0_40px_rgba(192,192,192,0.15)]",
      3: "border-[#CD7F32] text-[#CD7F32] shadow-[0_0_30px_rgba(205,127,50,0.15)]"
    };

    const icons = {
      1: <Crown className="w-8 h-8" />,
      2: <Trophy className="w-6 h-6" />,
      3: <Medal className="w-6 h-6" />
    };

    const heights = {
      1: "h-[450px]",
      2: "h-[380px]",
      3: "h-[320px]"
    };

    const order = {
      1: "order-2",
      2: "order-1",
      3: "order-3"
    };

    const content = (
      <div 
        key={assessor.cod_assessor}
        onClick={() => onAssessorClick?.(assessor)}
        className={cn(
          "flex flex-col items-center justify-end flex-1 transition-all duration-500 hover:scale-105 cursor-pointer group relative",
          order[position as 1|2|3]
        )}
      >
        {/* Name and Rank */}
        <div className="text-center mb-4 space-y-1">
          {isInelegivel ? (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span className={cn("text-sm font-data uppercase tracking-widest font-bold", "text-red-500")}>
                    {assessor.nome_assessor ? (
                      `${assessor.nome_assessor.split(" ")[0]} ${assessor.nome_assessor.split(" ").slice(-1)[0][0]}.`
                    ) : "Assessor"}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="z-[100] bg-euro-card/95 border-red-500/30 backdrop-blur-xl p-3 shadow-2xl max-w-[250px]" side="top">
                  {getInelegibilityReason(assessor)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className={cn("text-sm font-data uppercase tracking-widest font-bold", colors[position as 1|2|3])}>
              {assessor.nome_assessor ? (
                `${assessor.nome_assessor.split(" ")[0]} ${assessor.nome_assessor.split(" ").slice(-1)[0][0]}.`
              ) : "Assessor"}
            </span>
          )}
          <div className="flex items-center justify-center gap-2">
            {icons[position as 1|2|3]}
          </div>
        </div>

        {/* Photo with Ring */}
        <div className={cn(
          "relative w-28 h-28 rounded-full bg-euro-inset border-4 overflow-hidden mb-6",
          colors[position as 1|2|3]
        )}>
          {assessor.foto_url ? (
            <img src={assessor.foto_url} alt={assessor.nome_assessor || ""} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-display opacity-20">
              {assessor.nome_assessor ? (
                assessor.nome_assessor.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
              ) : "A"}
            </div>
          )}
        </div>

        {/* Podium Base */}
        <div className={cn(
          "w-full rounded-t-2xl bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border-x border-t border-white/20 flex flex-col items-center p-6 space-y-4",
          heights[position as 1|2|3]
        )}>
          <div className="text-center">
            <span className="text-xs font-data text-[#8A8A7A] uppercase tracking-[0.2em]">Pontos Total</span>
            <div className="text-4xl font-display text-[#F5F5F0] mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{assessor.pontos_total.toLocaleString("pt-BR")}</div>
          </div>

          <div className="w-full space-y-2 pt-4 border-t border-white/10">
            {[
              { label: "Captação", val: assessor.pontos_captacao },
              { label: "ROA Invest", val: assessor.pontos_roa_invest },
              { label: "ROA CS", val: assessor.pontos_roa_cs },
              { label: "Ativação", val: assessor.pontos_ativacoes },
              { label: "Líder", val: assessor.pontos_lider }
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-xs font-data uppercase">
                <span className="text-[#8A8A7A]">{item.label}</span>
                <span className="text-[#F5F5F0] font-bold">{item.val > 0 ? item.val : "--"}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto pb-4">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-display",
              colors[position as 1|2|3]
            )}>
              {position}
            </div>
          </div>
        </div>
      </div>
    );

    return content;
  };

  return (
    <div className="space-y-12">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-euro-gold/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-euro-gold" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-display text-[#F5F5F0] tracking-wide flex items-center gap-2">
                <span className="md:hidden">Super Ranking</span>
                <span className="hidden md:inline">Super Ranking Eurostock</span>
              </h2>
              <p className="text-sm font-ui text-[#A0A090]">Elite de assessores e performance consolidada</p>
            </div>
          </div>

          {/* Botão de ajuda (mobile e desktop), alinhado ao título */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="w-8 h-8 rounded-full bg-euro-gold/10 hover:bg-euro-gold/20 text-euro-gold flex items-center justify-center transition-colors"
                title="Regras do Ranking"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="text-xl font-display text-euro-gold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Regras de Pontuação – Resumo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4 pr-2">
                {/* Seção Captação */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <Banknote className="w-4 h-4 text-euro-gold" /> Captação (Cap)
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontuação proporcional à meta do cluster (pode dobrar).</p>
                    <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                      <li><span className="text-euro-gold font-bold">100 pts</span> = 100% da meta</li>
                      <li><span className="text-euro-gold font-bold">200 pts</span> = 200% da meta (limite máximo)</li>
                    </ul>
                    <p className="text-xs italic text-white/50 mt-2 border-l-2 border-white/10 pl-2">
                      Exemplo: Meta Cluster A = R$ 1.500.000 → Se fizer R$ 3.000.000, recebe 200 pts.
                    </p>
                  </div>
                </div>

                {/* Seção ROA Investimentos */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <TrendingUp className="w-4 h-4 text-euro-gold" /> ROA Investimentos
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontua até 1% de ROA conforme escala definida.</p>
                    <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                      <li>Pontuação: <span className="text-euro-gold font-bold">70 pts</span> para 100% da meta (não dobra).</li>
                    </ul>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
                      <div className="bg-white/5 p-2 rounded text-white/70">A: 0,70%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">B: 0,80%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">C: 0,90%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">D: 1,00%</div>
                    </div>
                  </div>
                </div>

                {/* Seção Ativação */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <UserPlus className="w-4 h-4 text-euro-gold" /> Ativação de Contas Novas
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Sem limite de pontuação. Considera contas abertas e transferidas.</p>
                    <div className="flex gap-4 mt-2">
                      <div className="flex-1 bg-white/5 p-3 rounded border border-white/5 text-center">
                        <span className="block text-xs text-white/50 uppercase">300k+</span>
                        <span className="text-euro-gold font-bold text-lg">20 pts</span>
                      </div>
                      <div className="flex-1 bg-white/5 p-3 rounded border border-white/5 text-center">
                        <span className="block text-xs text-white/50 uppercase">1M+</span>
                        <span className="text-euro-gold font-bold text-lg">50 pts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção ROA Cross-Sell */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <ArrowRightLeft className="w-4 h-4 text-euro-gold" /> ROA Cross-Sell
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontuação limitada e acumulada mensalmente.</p>
                    <p className="text-white/70 text-xs leading-relaxed">
                      Considera ROA em produtos complementares: Previdência, Seguros, Offshore, Câmbio (PF/PJ),
                      Crédito, Consórcio, Compromissadas e outros fora do core de investimentos.
                    </p>
                    <p className="text-xs italic text-white/50 mt-2 border-l-2 border-white/10 pl-2">
                      Conta receita recorrente, mesmo de negócios antigos. Exemplo: Receita mensal de um consórcio antigo continua pontuando.
                    </p>
                  </div>
                </div>

                {/* Seção Elegibilidade */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <Medal className="w-4 h-4 text-euro-gold" /> Elegibilidade (Top 100)
                  </h3>
                  <div className="bg-euro-gold/5 p-4 rounded-lg border border-euro-gold/20 text-sm space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <p className="text-white/90 font-medium">Para concorrer, o assessor deve atender a todos os critérios:</p>
                    <ul className="space-y-2 text-white/80">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> NPS ≥ 80</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Máximo 5 clientes em ruptura (média semestral)</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> FP 300k+ ≥ 50%</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Máximo 120 clientes ativos (média semestral)</li>
                    </ul>
                    <p className="text-[10px] text-white/50 mt-2">* Casos de conta PJ com grande volume podem ser analisados individualmente.</p>
                  </div>
                </div>

                {/* Seção Rebaixamento */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-red-400">
                    <AlertTriangle className="w-4 h-4" /> Critérios para Rebaixamento
                  </h3>
                  <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10 text-sm space-y-3">
                    <p className="text-white/80">
                      Serão rebaixados de cluster os assessores que, ao final do ciclo semestral, falharem em cumprir qualquer um dos critérios abaixo:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="text-xs font-bold text-red-400 uppercase block mb-1">Captação / Pontuação Base</span>
                        <p className="text-xs text-white/70">
                          Não atingir pelo menos 30% do objetivo de captação do cluster ou dos pontos base definidos.
                        </p>
                      </div>
                      <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="text-xs font-bold text-red-400 uppercase block mb-1">Net</span>
                        <p className="text-xs text-white/70">
                          Encerrar o ciclo com o Net abaixo do mínimo permitido para o respectivo cluster.
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/50 mt-2 italic">
                      * O rebaixamento será avaliado com base no resultado consolidado do semestre, independentemente de oscilações mensais.
                    </p>
                  </div>
                </div>

                {/* Seção Ascensão */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <ArrowUp className="w-4 h-4 text-euro-gold" /> Critérios para Ascensão de Cluster
                  </h3>
                  <div className="bg-euro-gold/5 p-4 rounded-lg border border-euro-gold/20 text-sm space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <ul className="space-y-2 text-white/80">
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Subidas de cluster acontecem semestralmente.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Apenas dois assessores sobem por cluster em cada ciclo.</span>
                      </li>
                    </ul>

                    <div className="mt-3 space-y-2">
                      <p className="text-white/90 font-medium">Tamanho mínimo de base necessário para acessar o cluster:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster A</span>
                          <p className="text-xs text-white/70">a partir de 50M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster B</span>
                          <p className="text-xs text-white/70">25M a 50M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster C</span>
                          <p className="text-xs text-white/70">10M a 25M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster D</span>
                          <p className="text-xs text-white/70">de zero a 10M</p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 text-white/80 mt-3">
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Necessário cumprir pelo menos 50% do objetivo de captação líquida do cluster em que está inserido.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Necessário conquistar pelo menos 810 pontos no período (equivalente a 50% dos pontos base).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Terminar o ciclo em primeiro ou segundo lugar no seu cluster.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl p-2 rounded-lg border border-white/20">
          <Dialog>
            <DialogTrigger asChild>
              <button className="hidden md:inline-flex p-1.5 rounded-full bg-euro-gold/10 hover:bg-euro-gold/20 text-euro-gold transition-colors" title="Regras do Ranking">
                <HelpCircle className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-euro-navy border-white/10 text-[#E8E8E0] max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="text-xl font-display text-euro-gold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Regras de Pontuação – Resumo
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4 pr-2">
                {/* Seção Captação */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <Banknote className="w-4 h-4 text-euro-gold" /> Captação (Cap)
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontuação proporcional à meta do cluster (pode dobrar).</p>
                    <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                      <li><span className="text-euro-gold font-bold">100 pts</span> = 100% da meta</li>
                      <li><span className="text-euro-gold font-bold">200 pts</span> = 200% da meta (limite máximo)</li>
                    </ul>
                    <p className="text-xs italic text-white/50 mt-2 border-l-2 border-white/10 pl-2">
                      Exemplo: Meta Cluster A = R$ 1.500.000 → Se fizer R$ 3.000.000, recebe 200 pts.
                    </p>
                  </div>
                </div>

                {/* Seção ROA Investimentos */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <TrendingUp className="w-4 h-4 text-euro-gold" /> ROA Investimentos
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontua até 1% de ROA conforme escala definida.</p>
                    <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                      <li>Pontuação: <span className="text-euro-gold font-bold">70 pts</span> para 100% da meta (não dobra).</li>
                    </ul>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
                      <div className="bg-white/5 p-2 rounded text-white/70">A: 0,70%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">B: 0,80%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">C: 0,90%</div>
                      <div className="bg-white/5 p-2 rounded text-white/70">D: 1,00%</div>
                    </div>
                  </div>
                </div>

                {/* Seção Ativação */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <UserPlus className="w-4 h-4 text-euro-gold" /> Ativação de Contas Novas
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Sem limite de pontuação. Considera contas abertas e transferidas.</p>
                    <div className="flex gap-4 mt-2">
                      <div className="flex-1 bg-white/5 p-3 rounded border border-white/5 text-center">
                        <span className="block text-xs text-white/50 uppercase">300k+</span>
                        <span className="text-euro-gold font-bold text-lg">20 pts</span>
                      </div>
                      <div className="flex-1 bg-white/5 p-3 rounded border border-white/5 text-center">
                        <span className="block text-xs text-white/50 uppercase">1M+</span>
                        <span className="text-euro-gold font-bold text-lg">50 pts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção ROA Cross-Sell */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <ArrowRightLeft className="w-4 h-4 text-euro-gold" /> ROA Cross-Sell
                  </h3>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-sm space-y-2">
                    <p className="text-white/80">Pontuação limitada e acumulada mensalmente.</p>
                    <p className="text-white/70 text-xs leading-relaxed">Considera ROA em produtos complementares: Previdência, Seguros, Offshore, Câmbio (PF/PJ), Crédito, Consórcio, Compromissadas e outros fora do core de investimentos.</p>
                    <p className="text-xs italic text-white/50 mt-2 border-l-2 border-white/10 pl-2">
                      Conta receita recorrente, mesmo de negócios antigos. Exemplo: Receita mensal de um consórcio antigo continua pontuando.
                    </p>
                  </div>
                </div>

                {/* Seção Elegibilidade */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <Medal className="w-4 h-4 text-euro-gold" /> Elegibilidade (Top 100)
                  </h3>
                  <div className="bg-euro-gold/5 p-4 rounded-lg border border-euro-gold/20 text-sm space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <p className="text-white/90 font-medium">Para concorrer, o assessor deve atender a todos os critérios:</p>
                    <ul className="space-y-2 text-white/80">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> NPS ≥ 80</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Máximo 5 clientes em ruptura (média semestral)</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> FP 300k+ ≥ 50%</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Máximo 120 clientes ativos (média semestral)</li>
                    </ul>
                    <p className="text-[10px] text-white/50 mt-2">* Casos de conta PJ com grande volume podem ser analisados individualmente.</p>
                  </div>
                </div>

                {/* Seção Rebaixamento */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-red-400">
                    <AlertTriangle className="w-4 h-4" /> Critérios para Rebaixamento
                  </h3>
                  <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10 text-sm space-y-3">
                    <p className="text-white/80">Serão rebaixados de cluster os assessores que, ao final do ciclo semestral, falharem em cumprir qualquer um dos critérios abaixo:</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="text-xs font-bold text-red-400 uppercase block mb-1">Captação / Pontuação Base</span>
                        <p className="text-xs text-white/70">Não atingir pelo menos 30% do objetivo de captação do cluster ou dos pontos base definidos.</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="text-xs font-bold text-red-400 uppercase block mb-1">Net</span>
                        <p className="text-xs text-white/70">Encerrar o ciclo com o Net abaixo do mínimo permitido para o respectivo cluster.</p>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-white/50 mt-2 italic">
                      * O rebaixamento será avaliado com base no resultado consolidado do semestre, independentemente de oscilações mensais.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-data uppercase tracking-wider text-white">
                    <ArrowUp className="w-4 h-4 text-euro-gold" /> Critérios para Ascensão de Cluster
                  </h3>
                  <div className="bg-euro-gold/5 p-4 rounded-lg border border-euro-gold/20 text-sm space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
                    <ul className="space-y-2 text-white/80">
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Subidas de cluster acontecem semestralmente.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Apenas dois assessores sobem por cluster em cada ciclo.</span>
                      </li>
                    </ul>

                    <div className="mt-3 space-y-2">
                      <p className="text-white/90 font-medium">Tamanho mínimo de base necessário para acessar o cluster:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster A</span>
                          <p className="text-xs text-white/70">a partir de 50M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster B</span>
                          <p className="text-xs text-white/70">25M a 50M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster C</span>
                          <p className="text-xs text-white/70">10M a 25M</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-xs font-bold text-euro-gold uppercase block mb-1">Cluster D</span>
                          <p className="text-xs text-white/70">de zero a 10M</p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 text-white/80 mt-3">
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Necessário cumprir pelo menos 50% do objetivo de captação líquida do cluster em que está inserido.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Necessário conquistar pelo menos 810 pontos no período (equivalente a 50% dos pontos base).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-euro-gold font-bold">•</span>
                        <span>Terminar o ciclo em primeiro ou segundo lugar no seu cluster.</span>
                      </li>
                    </ul>
                  </div>
                </div>

              </div>
            </DialogContent>
          </Dialog>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <Select 
            value={selectedYear} 
            onValueChange={(val) => {
              onYearChange?.(val);
              // Reset period to year or update month list if needed
            }}
          >
            <SelectTrigger className="w-[120px] bg-euro-elevated/50 border-white/10 text-xs font-data">
              <Calendar className="w-3 h-3 mr-2 text-euro-gold" />
              <SelectValue>{selectedYear}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-euro-elevated border-white/10 text-white">
              {availableYears.length > 0 ? (
                availableYears.map(y => (
                  <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
                ))
              ) : (
                <SelectItem value={new Date().getFullYear().toString()} className="text-xs">{new Date().getFullYear()}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <Select 
            value={periodType} 
            onValueChange={(val: PeriodType) => {
              setPeriodType(val);
              if (val !== "month") setSelectedMonth("all");
            }}
          >
            <SelectTrigger className="w-[180px] md:w-[240px] bg-euro-elevated/50 border-white/10 text-xs font-data">
              <Filter className="w-3 h-3 mr-2 text-euro-gold" />
              <SelectValue>
                {periodType === "year" && `Ano de ${selectedYear}`}
                {periodType === "s1" && `1º Semestre de ${selectedYear}`}
                {periodType === "s2" && `2º Semestre de ${selectedYear}`}
                {periodType === "month" && "Por Mês"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-euro-elevated border-white/10 text-white">
              <SelectItem value="year" className="text-xs">Ano Todo</SelectItem>
              <SelectItem value="s1" className="text-xs">1º Semestre</SelectItem>
              <SelectItem value="s2" className="text-xs">2º Semestre</SelectItem>
              <SelectItem value="month" className="text-xs">Por Mês</SelectItem>
            </SelectContent>
          </Select>

          {periodType === "month" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px] bg-euro-elevated/50 border-white/10 text-xs font-data">
                <Calendar className="w-3 h-3 mr-2 text-euro-gold" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent className="bg-euro-elevated border-white/10 text-white">
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {format(parseISO(`${m}-01`), "MMMM yyyy", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        {/* PODIUM SECTION - escondido no mobile, visível a partir de md */}
        <div className="hidden md:flex lg:col-span-5 gap-4 min-h-[600px] items-end px-4">
          {renderPodiumItem(top3[1], 2)}
          {renderPodiumItem(top3[0], 1)}
          {renderPodiumItem(top3[2], 3)}
        </div>

        {/* TABLE SECTION */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-data text-white uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3 text-euro-gold" /> Ranking Completo
            </span>
            <span className="text-[10px] font-data text-euro-gold/60">{rankingData.length} {rankingData.length === 1 ? "assessor" : "assessores"}</span>
          </div>
          
          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-euro-card/95 backdrop-blur-md border-b border-white/10">
                  <tr className="text-xs font-data text-[#8A8A7A] uppercase tracking-wider">
                    <th className="p-4 font-normal">#</th>
                    <th className="p-4 font-normal">Assessor</th>
                    <th className="p-4 font-normal text-right">Total</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Captação</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Invest</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">CS</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Ativ.</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Líder</th>
                  </tr>
                </thead>
                {/* Mobile: tabela completa (inclui Top 3) com modal de detalhes */}
                <tbody className="divide-y divide-white/[0.05] md:hidden">
                  {rankingData.map((assessor: any, idx: number) => {
                    const isInelegivel = assessor.elegibilidade === false || assessor.elegibilidade === "false";

                    return (
                      <tr 
                        key={assessor.cod_assessor}
                        onClick={() => {
                          setMobileDetailAssessor(assessor);
                          setIsMobileDetailOpen(true);
                        }}
                        tabIndex={0}
                        className={cn(
                          "group hover:bg-white/[0.05] transition-colors cursor-pointer outline-none focus:bg-white/[0.1]",
                          idx < 3 && "bg-white/[0.05] border-l-2 border-euro-gold/80",
                          isInelegivel && "opacity-70 grayscale-[0.8] hover:grayscale-0 hover:opacity-100 bg-red-500/[0.02]"
                        )}
                      >
                        <td className="p-4 text-sm font-data text-[#FFFFFF]">
                          <span className={cn(
                            "inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs",
                            idx === 0 && "border-euro-gold text-euro-gold bg-euro-gold/10",
                            idx === 1 && "border-[#C0C0C0] text-[#C0C0C0] bg-white/5",
                            idx === 2 && "border-[#CD7F32] text-[#CD7F32] bg-[#CD7F32]/10"
                          )}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-sm font-ui text-[#F5F5F0] group-hover:text-euro-gold transition-colors whitespace-nowrap",
                              idx === 0 && "font-semibold text-euro-gold",
                              idx === 1 && "font-semibold text-white",
                              idx === 2 && "font-semibold text-white"
                            )}>
                              {assessor.nome_assessor}
                            </span>
                            <span className="text-xs font-data text-white">{assessor.cod_assessor}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-sm font-data text-euro-gold font-bold">
                            {assessor.pontos_total.toLocaleString("pt-BR")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Desktop: mantém tabela de "próximos" (sem Top 3) */}
                <tbody className="divide-y divide-white/[0.05] hidden md:table-row-group">
                  {others.map((assessor, idx) => {
                    const isInelegivel = assessor.elegibilidade === false || assessor.elegibilidade === "false";

                    const rowContent = (
                      <tr 
                        key={assessor.cod_assessor}
                        onClick={() => onAssessorClick?.(assessor)}
                        tabIndex={0}
                        className={cn(
                          "group hover:bg-white/[0.05] transition-colors cursor-pointer outline-none focus:bg-white/[0.1]",
                          isInelegivel && "opacity-70 grayscale-[0.8] hover:grayscale-0 hover:opacity-100 bg-red-500/[0.02]"
                        )}
                      >
                        <td className="p-4 text-sm font-data text-[#FFFFFF]">{idx + 4}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3 relative">
                            {isInelegivel && (
                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-red-500/20 p-1 rounded-full border border-red-500/50 animate-pulse">
                                <AlertCircle className="w-3 h-3 text-red-500" />
                              </div>
                            )}
                            <div className="w-8 h-8 rounded-full bg-euro-inset border border-white/10 overflow-hidden">
                              {assessor.foto_url ? (
                                <img src={assessor.foto_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] opacity-30">
                                  {assessor.nome_assessor ? assessor.nome_assessor[0] : "A"}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-ui text-[#F5F5F0] group-hover:text-euro-gold transition-colors whitespace-nowrap">{assessor.nome_assessor}</span>
                              <span className="text-xs font-data text-white">{assessor.cod_assessor}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-sm font-data text-euro-gold font-bold">
                            {assessor.pontos_total.toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="p-4 text-right text-xs font-data text-white hidden xl:table-cell">
                          {assessor.pontos_captacao > 0 ? assessor.pontos_captacao : "--"}
                        </td>
                        <td className="p-4 text-right text-xs font-data text-white hidden xl:table-cell">
                          {assessor.pontos_roa_invest > 0 ? assessor.pontos_roa_invest : "--"}
                        </td>
                        <td className="p-4 text-right text-xs font-data text-white hidden xl:table-cell">
                          {assessor.pontos_roa_cs > 0 ? assessor.pontos_roa_cs : "--"}
                        </td>
                        <td className="p-4 text-right text-xs font-data text-white hidden xl:table-cell">
                          {assessor.pontos_ativacoes > 0 ? assessor.pontos_ativacoes : "--"}
                        </td>
                        <td className="p-4 text-right text-xs font-data text-white hidden xl:table-cell">
                          {assessor.pontos_lider > 0 ? assessor.pontos_lider : "--"}
                        </td>
                      </tr>
                    );

                    if (isInelegivel) {
                      return (
                        <TooltipProvider key={assessor.cod_assessor}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              {rowContent}
                            </TooltipTrigger>
                            <TooltipContent side="left" className="z-[100] bg-euro-card/95 border-red-500/30 backdrop-blur-xl p-3 shadow-2xl max-w-[250px]">
                              {getInelegibilityReason(assessor)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }

                    return rowContent;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL MOBILE – Detalhamento do Assessor */}
      <Dialog open={isMobileDetailOpen} onOpenChange={setIsMobileDetailOpen}>
        <DialogContent className="md:hidden bg-euro-navy border-white/10 text-white max-w-sm w-[92vw] rounded-3xl px-5 pt-6 pb-5 shadow-2xl [&>button[aria-label='Close']]:hidden">
          {mobileDetailAssessor && (
            <>
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-euro-inset border border-euro-gold/60 overflow-hidden flex items-center justify-center shadow-[0_0_12px_rgba(250,192,23,0.35)]">
                      {mobileDetailAssessor.foto_url ? (
                        <img
                          src={mobileDetailAssessor.foto_url}
                          alt={mobileDetailAssessor.nome_assessor || ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-display text-euro-gold/70">
                          {mobileDetailAssessor.nome_assessor
                            ? mobileDetailAssessor.nome_assessor
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .slice(0, 2)
                            : "A"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-data uppercase tracking-[0.3em] text-euro-gold/70">
                        Detalhamento de Pontos
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-[10px] font-mono text-white/80">
                          {mobileDetailAssessor.cod_assessor}
                        </span>
                        <h3 className="text-sm font-display text-[#F5F5F0] leading-snug truncate max-w-[140px]">
                          {mobileDetailAssessor.nome_assessor}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-data uppercase text-white/40">
                      Pontos Totais
                    </span>
                    <span className="text-2xl font-display text-euro-gold">
                      {mobileDetailAssessor.pontos_total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Blocos de pontos */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Captação", value: mobileDetailAssessor.pontos_captacao, icon: <Banknote className="w-3 h-3" /> },
                  { label: "ROA Invest", value: mobileDetailAssessor.pontos_roa_invest, icon: <TrendingUp className="w-3 h-3" /> },
                  { label: "ROA CS", value: mobileDetailAssessor.pontos_roa_cs, icon: <ArrowRightLeft className="w-3 h-3" /> },
                  { label: "Ativação", value: mobileDetailAssessor.pontos_ativacoes, icon: <UserPlus className="w-3 h-3" /> },
                  { label: "Líder", value: mobileDetailAssessor.pontos_lider, icon: <Users className="w-3 h-3" /> },
                ]
                  // Esconde o card de Líder quando não houver pontuação
                  .filter(item => item.label !== "Líder" || (item.value && item.value > 0))
                  .map((item) => (
                  <div
                    key={item.label}
                    className="bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-data uppercase tracking-[0.16em] text-white/50">
                        {item.label}
                      </span>
                      <div className="text-euro-gold/80">
                        {item.icon}
                      </div>
                    </div>
                    <span className="text-lg font-display text-[#F5F5F0]">
                      {item.value > 0 ? item.value : "--"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Elegibilidade */}
              {(() => {
                const isInelegivel = mobileDetailAssessor.elegibilidade === false || mobileDetailAssessor.elegibilidade === "false";
                const percFP = (mobileDetailAssessor.total_fp_300k && mobileDetailAssessor.meta_fp300k)
                  ? (mobileDetailAssessor.total_fp_300k / mobileDetailAssessor.meta_fp300k) * 100
                  : 0;
                const mediaClientes = mobileDetailAssessor.media_movel_clientes_6m;
                const mediaRupturas = mobileDetailAssessor.media_movel_rupturas_6m;

                return (
                  <div className="mt-2 space-y-2">
                    <div className={cn(
                      "rounded-2xl px-3 py-2.5 border flex items-center justify-between",
                      isInelegivel
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-emerald-500/40 bg-emerald-500/5"
                    )}>
                      <div className="flex items-center gap-2">
                        {isInelegivel ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-data uppercase tracking-[0.2em]">
                            {isInelegivel ? "Inelegível ao Super Ranking" : "Elegível ao Super Ranking"}
                          </span>
                          <span className="text-[11px] text-white/70">
                            {isInelegivel
                              ? "Alguns critérios mínimos não foram atingidos."
                              : "Todos os critérios de elegibilidade cumpridos."}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chips dos critérios */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-data">
                      <div className="bg-white/3 border border-white/10 rounded-xl px-3 py-2">
                        <span className="block uppercase tracking-[0.16em] text-white/50 mb-1">
                          Média Clientes
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">
                            {Math.round(mediaClientes ?? 0)}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px]",
                            mediaClientes !== undefined && mediaClientes >= 120
                              ? "bg-red-500/20 text-red-400 border border-red-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          )}>
                            {mediaClientes !== undefined && mediaClientes >= 120 ? "≥ 120 (limite)" : "< 120 OK"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/3 border border-white/10 rounded-xl px-3 py-2">
                        <span className="block uppercase tracking-[0.16em] text-white/50 mb-1">
                          FP 300k+
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">
                            {percFP.toFixed(0)}%
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px]",
                            percFP <= 50
                              ? "bg-red-500/20 text-red-400 border border-red-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          )}>
                            {percFP <= 50 ? "≤ 50% (mín.)" : "> 50% OK"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/3 border border-white/10 rounded-xl px-3 py-2 col-span-2">
                        <span className="block uppercase tracking-[0.16em] text-white/50 mb-1">
                          Média Rupturas (6m)
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">
                            {(mediaRupturas ?? 0).toFixed(1)}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px]",
                            mediaRupturas !== undefined && mediaRupturas > 5
                              ? "bg-red-500/20 text-red-400 border border-red-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          )}>
                            {mediaRupturas !== undefined && mediaRupturas > 5 ? "> 5 (limite)" : "≤ 5 OK"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
