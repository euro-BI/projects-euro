import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  TrendingUp,
  Landmark,
  Globe,
  FileStack,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Search,
  User,
  Users,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { format, parseISO, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// ==========================================================================
// Types
// ==========================================================================

interface RendaFixaDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string;
  selectedAssessorId: string;
  teamPhotos?: Map<string, string>;
}

type RFMetricKey = "total_rf" | "renda_fixa" | "ofertas" | "cetipados" | "offshore";

// ==========================================================================
// Helpers
// ==========================================================================

const formatCurrency = (value: number, decimals: number = 0) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const formatMetaLabel = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(2).replace(".", ",") + "M";
  }
  return (value / 1000).toFixed(2).replace(".", ",") + "K";
};

// ==========================================================================
// ROA Targets (same pattern as PerformanceDash)
// ==========================================================================

const ROA_TARGETS = {
  renda_fixa: 0.0015,        // 0.15%
  ofertas: 0.0010,           // 0.10% (fundos + rf)
  cetipados: 0.0005,         // 0.05%
  offshore: 0.0002,          // 0.02%
};

// Metric config for the chart selector
const RF_METRICS: Record<RFMetricKey, {
  label: string;
  icon: React.ReactNode;
  color: string;
  fields: string[];
  roa: number;
}> = {
  total_rf: {
    label: "Total Renda Fixa",
    icon: <Coins className="w-3.5 h-3.5" />,
    color: "#FAC017",
    fields: ["receita_renda_fixa", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receita_cetipados", "receitas_offshore"],
    roa: ROA_TARGETS.renda_fixa + ROA_TARGETS.ofertas + ROA_TARGETS.cetipados + ROA_TARGETS.offshore,
  },
  renda_fixa: {
    label: "Renda Fixa",
    icon: <Landmark className="w-3.5 h-3.5" />,
    color: "#3B82F6",
    fields: ["receita_renda_fixa"],
    roa: ROA_TARGETS.renda_fixa,
  },
  ofertas: {
    label: "Receita Ofertas",
    icon: <FileStack className="w-3.5 h-3.5" />,
    color: "#8B5CF6",
    fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"],
    roa: ROA_TARGETS.ofertas,
  },
  cetipados: {
    label: "Receita Cetipados",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    color: "#22C55E",
    fields: ["receita_cetipados"],
    roa: ROA_TARGETS.cetipados,
  },
  offshore: {
    label: "Receita Offshore",
    icon: <Globe className="w-3.5 h-3.5" />,
    color: "#F97316",
    fields: ["receitas_offshore"],
    roa: ROA_TARGETS.offshore,
  },
};

// ==========================================================================
// Revenue Card with Progress Bar sub-component
// ==========================================================================

interface RevenueCardProps {
  title: string;
  value: number;
  target: number;
  icon: React.ElementType;
  color: string;
  delay?: number;
  isTotal?: boolean;
}

function RevenueCard({ title, value, target, icon: Icon, color, delay = 0, isTotal = false }: RevenueCardProps) {
  const achievement = target > 0 ? (value / target) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card className={cn(
        "bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full",
        isTotal && "border-euro-gold/30 from-euro-gold/[0.05]"
      )}>
        <div 
          className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" 
          style={{ background: color }} 
        />
        <CardHeader className="pb-1 pt-4 pl-6 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className={cn(
              "text-[10px] font-data uppercase tracking-widest",
              isTotal ? "text-euro-gold/80" : "text-white/50"
            )}>
              {title}
            </CardTitle>
          </div>
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center -mt-2" 
            style={{ background: `${color}15` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </CardHeader>
        <CardContent className="pb-4 pt-0 pl-6">
          <div className={cn(
            "flex flex-col items-center justify-center py-2 mb-3 border-b",
          )} style={{ borderColor: `${color}33` }}>
            <span className={cn(
              "text-2xl font-display text-center leading-tight truncate px-1",
              isTotal ? "text-euro-gold" : "text-white"
            )}>
              {formatCurrency(value)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-data text-white/50 uppercase font-bold tracking-widest">
                META: R$ {formatMetaLabel(target)}
              </span>
              <span className={cn(
                "text-[10px] font-data font-bold tracking-widest",
                achievement >= 100 ? "text-green-500" : achievement >= 70 ? "text-euro-gold" : "text-red-500"
              )}>
                {achievement.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(achievement, 100)}%` }}
                transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  achievement >= 100 ? "bg-green-500" : achievement >= 70 ? "bg-euro-gold" : "bg-red-500"
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================================================
// Main Component
// ==========================================================================

export default function RendaFixaDash({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
  teamPhotos,
}: RendaFixaDashProps) {

  const [chartMetric, setChartMetric] = useState<RFMetricKey>("total_rf");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita_total_rf',
    direction: 'desc'
  });
  const [rfFluxoSearch, setRfFluxoSearch] = useState("");
  const [rfFluxoSort, setRfFluxoSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita',
    direction: 'desc'
  });
  const [ofertasRfSearch, setOfertasRfSearch] = useState("");
  const [ofertasRfSort, setOfertasRfSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita',
    direction: 'desc'
  });
  const [ofertasFundosSearch, setOfertasFundosSearch] = useState("");
  const [ofertasFundosSort, setOfertasFundosSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita',
    direction: 'desc'
  });
  const [cetipadosSearch, setCetipadosSearch] = useState("");
  const [cetipadosSort, setCetipadosSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita',
    direction: 'desc'
  });
  const [offshoreSearch, setOffshoreSearch] = useState("");
  const [offshoreSort, setOffshoreSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'receita',
    direction: 'desc'
  });
  const [detailTab, setDetailTab] = useState<string>("renda_fixa");

  // Opportunities table state
  const [oppsSearch, setOppsSearch] = useState("");
  const [oppsSort, setOppsSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'net_em_m',
    direction: 'desc'
  });
  const [oppsPage, setOppsPage] = useState(1);
  const oppsPerPage = 10;

  // ────────────────────────────────────────────────────────────────────────
  // Query — mv_resumo_assessor (receitas renda fixa fields)
  // ────────────────────────────────────────────────────────────────────────
  const { data: mvData, isLoading: isMvLoading } = useQuery({
    queryKey: ["rf-mv-data", selectedYear, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, cod_assessor, nome_assessor, time, receita_renda_fixa, receitas_ofertas_fundos, receitas_ofertas_rf, receita_cetipados, receitas_offshore, custodia_net, foto_url, lider, cluster")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);

      if (selectedTeam !== "all") {
        query = query.eq("time", selectedTeam);
      } else {
        query = query.in("time", Array.from(activeTeamNames));
      }

      if (selectedAssessorId !== "all") {
        query = query.eq("cod_assessor", selectedAssessorId);
      }

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedMonthKey = selectedMonth
    ? selectedMonth.substring(0, 7)
    : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Compute proper end-of-month date (e.g. 2026-04-30 instead of invalid 2026-04-31)
  const selectedMonthEndDate = format(endOfMonth(parseISO(`${selectedMonthKey}-01`)), "yyyy-MM-dd");

  // ────────────────────────────────────────────────────────────────────────
  // Query — dados_rf_fluxo (detalhamento renda fixa)
  // ────────────────────────────────────────────────────────────────────────
  const { data: rfFluxoData, isLoading: isRfFluxoLoading } = useQuery({
    queryKey: ["rf-fluxo-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      // Get all active teams
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      // Get assessor metadata (for team/name/photo mapping)
      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      // Fetch rf fluxo data for the selected month
      const startDate = `${selectedMonthKey}-01`;
      const endDate = selectedMonthEndDate;

      let rfQuery = supabase
        .from("dados_rf_fluxo" as any)
        .select("data, cod_assessor, cod_conta, indexador, tipo_operacao, receita_a_dividir")
        .gte("data", startDate)
        .lte("data", endDate);

      if (selectedAssessorId !== "all") {
        rfQuery = rfQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: rfRows, error } = await rfQuery;
      if (error) throw error;

      // Filter by team and enrich with assessor metadata
      const validAssessors = assessorMap;
      return (rfRows as any[] || []).filter((r: any) => {
        const assessor = validAssessors.get(r.cod_assessor);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;
        return true;
      }).map((r: any) => {
        const assessor = validAssessors.get(r.cod_assessor) || {};
        const rawReceita = parseFloat(String(r.receita_a_dividir || "0").replace(",", "."));
        return {
          ...r,
          nome_assessor: assessor.nome_assessor || r.cod_assessor,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
          receita: rawReceita / 2,
        };
      }).filter((r: any) => {
        // Only APLICAÇÃO and RESGATE
        const tipo = (r.tipo_operacao || "").toUpperCase().trim();
        if (tipo !== "APLICAÇÃO" && tipo !== "RESGATE") return false;
        // Remove zero receita
        if (Math.abs(r.receita) < 0.01) return false;
        return true;
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query — dados_fundos (Ofertas RF)
  // ────────────────────────────────────────────────────────────────────────
  const { data: ofertasRfData, isLoading: isOfertasRfLoading } = useQuery({
    queryKey: ["ofertas-rf-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      // Get assessor metadata
      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      // Fetch ofertas rf data from dados_ofertas
      // Logic: if day 1-7, references previous month; else current month
      // So we need to fetch: selectedMonth (for day >= 8) + next month's 1-7
      const [year, month] = selectedMonthKey.split("-").map(Number);
      // Start: first day of selected month (captures day >= 8 entries)
      const fetchStart = `${selectedMonthKey}-01`;
      // End: 7th day of next month (captures day 1-7 entries that reference selected month)
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const fetchEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-07`;

      let ofertasQuery = supabase
        .from("dados_ofertas" as any)
        .select("codigo_aai, status_solicitacao_reserva, data_liquidacao_prevista, comissao_escritorio, cliente, oferta, fee, financeiro_a_liquidar, serie, valor_solicitado")
        .gte("data_liquidacao_prevista", fetchStart)
        .lte("data_liquidacao_prevista", fetchEnd);

      if (selectedAssessorId !== "all") {
        ofertasQuery = ofertasQuery.eq("codigo_aai", selectedAssessorId);
      }

      const { data: ofertasRows, error } = await ofertasQuery;
      if (error) throw error;

      return (ofertasRows as any[] || []).filter((r: any) => {
        const assessor = assessorMap.get(r.codigo_aai);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;
        return true;
      }).map((r: any) => {
        const assessor = assessorMap.get(r.codigo_aai) || {};
        const fee = parseFloat(String(r.fee || "0").replace(",", "."));
        const valorSolicitado = parseFloat(String(r.valor_solicitado || "0").replace(",", "."));
        const receita = (0.7 * fee / 100) * valorSolicitado;

        // Compute data_referencia (M logic)
        const dataLiq = parseISO(r.data_liquidacao_prevista);
        const dia = dataLiq.getDate();
        let dataRef: Date;
        if (dia >= 1 && dia <= 7) {
          // Move to previous month, then start of month
          dataRef = new Date(dataLiq.getFullYear(), dataLiq.getMonth() - 1, 1);
        } else {
          dataRef = new Date(dataLiq.getFullYear(), dataLiq.getMonth(), 1);
        }
        const dataRefKey = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, "0")}`;

        return {
          ...r,
          cod_assessor: r.codigo_aai,
          nome_assessor: assessor.nome_assessor || r.codigo_aai,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
          receita,
          valor_solicitado_num: valorSolicitado,
          fee_num: fee,
          data_referencia: format(dataRef, "yyyy-MM-dd"),
          data_referencia_key: dataRefKey,
        };
      }).filter((r: any) => {
        // Filter by reference month matching selected month
        if (r.data_referencia_key !== selectedMonthKey) return false;
        // Remove zero receita
        if (Math.abs(r.receita) < 0.01) return false;
        // Exclude Cancelled entries
        const status = (r.status_solicitacao_reserva || "").toUpperCase();
        if (status.includes("CANCEL")) return false;
        return true;
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query — dados_fundos_novo (Ofertas Fundos)
  // ────────────────────────────────────────────────────────────────────────
  const { data: ofertasFundosData, isLoading: isOfertasFundosLoading } = useQuery({
    queryKey: ["ofertas-fundos-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      const [year, month] = selectedMonthKey.split("-").map(Number);
      // Fetch up to the 5th of next month as per M logic (day <= 5 shifts to previous month)
      const fetchStart = `${selectedMonthKey}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const fetchEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-05`;

      let fundosQuery = supabase
        .from("dados_fundos_novo" as any)
        .select("ativo, nome_oferta, data_liquidacao, fee, assessor, cliente, valor_qtde_reserva, status_reserva")
        .gte("data_liquidacao", fetchStart)
        .lte("data_liquidacao", fetchEnd);

      const { data: fundosRows, error } = await fundosQuery;
      if (error) throw error;

      return (fundosRows as any[] || []).filter((r: any) => {
        const rawAssessor = (r.assessor || "").trim();
        const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") ? rawAssessor.toUpperCase() : `A${rawAssessor}`.toUpperCase();
        
        const assessor = assessorMap.get(codAssessorStr);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;

        const status = (r.status_reserva || "").toUpperCase();
        if (status !== "EFETIVADO" && status !== "EM PROCESSAMENTO" && status !== "SOLICITADO") return false;

        return true;
      }).map((r: any) => {
        const rawAssessor = (r.assessor || "").trim();
        const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") ? rawAssessor.toUpperCase() : `A${rawAssessor}`.toUpperCase();
        const assessor = assessorMap.get(codAssessorStr) || {};
        
        const fee = parseFloat(String(r.fee || "0").replace(",", "."));
        const valorReq = parseFloat(String(r.valor_qtde_reserva || "0").replace(",", "."));
        const receita = (fee / 100) * 0.7 * valorReq;

        // Compute data_referencia (rule: day <= 5 goes to previous month)
        let dataRef: Date;
        if (r.data_liquidacao) {
          const dataLiq = parseISO(r.data_liquidacao);
          const dia = dataLiq.getDate();
          if (dia >= 1 && dia <= 5) {
            dataRef = new Date(dataLiq.getFullYear(), dataLiq.getMonth() - 1, 1);
          } else {
            dataRef = new Date(dataLiq.getFullYear(), dataLiq.getMonth(), 1);
          }
        } else {
          dataRef = new Date(`${selectedMonthKey}-01`);
        }
        
        const dataRefStr = format(dataRef, "yyyy-MM-dd");
        const dataRefKey = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, "0")}`;

        return {
          ...r,
          cod_assessor: codAssessorStr,
          nome_assessor: assessor.nome_assessor || codAssessorStr,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
          receita,
          valor_qtde_reserva_num: valorReq,
          fee_num: fee,
          data_referencia: dataRefStr,
          data_referencia_key: dataRefKey,
        };
      }).filter((r: any) => {
        if (r.data_referencia_key !== selectedMonthKey) return false;
        if (Math.abs(r.receita) < 0.01) return false;
        return true;
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query — dados_cetipados (Cetipados)
  // ────────────────────────────────────────────────────────────────────────
  const { data: cetipadosData, isLoading: isCetipadosLoading } = useQuery({
    queryKey: ["cetipados-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      const fetchStart = `${selectedMonthKey}-01`;
      const fetchEnd = selectedMonthEndDate;

      let cetipadosQuery = supabase
        .from("dados_cetipados" as any)
        .select("data, assessor, cliente, fundo, valor, receita_estimada")
        .gte("data", fetchStart)
        .lte("data", fetchEnd);

      const { data: cetipadosRows, error } = await cetipadosQuery;
      if (error) throw error;

      return (cetipadosRows as any[] || []).filter((r: any) => {
        const rawAssessor = (r.assessor || "").trim();
        const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") ? rawAssessor.toUpperCase() : `A${rawAssessor}`.toUpperCase();
        
        const assessor = assessorMap.get(codAssessorStr);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;

        return true;
      }).map((r: any) => {
        const rawAssessor = (r.assessor || "").trim();
        const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") ? rawAssessor.toUpperCase() : `A${rawAssessor}`.toUpperCase();
        const assessor = assessorMap.get(codAssessorStr) || {};
        
        const receita = parseFloat(String(r.receita_estimada || "0").replace(",", "."));
        const valorNum = parseFloat(String(r.valor || "0").replace(",", "."));

        return {
          ...r,
          cod_assessor: codAssessorStr,
          nome_assessor: assessor.nome_assessor || codAssessorStr,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
          receita,
          valor_num: valorNum,
        };
      }).filter((r: any) => {
        if (Math.abs(r.receita) < 0.01) return false;
        return true;
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query — Offshore (dados_offshore_operacoes + dados_offshore_remessas)
  // Replicates vw_detalhamento_offshore logic client-side since PostgREST
  // can't serve that view (400). 
  // ────────────────────────────────────────────────────────────────────────
  const { data: offshoreData, isLoading: isOffshoreLoading } = useQuery({
    queryKey: ["offshore-detail-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      const fetchStart = `${selectedMonthKey}-01`;
      const fetchEnd = selectedMonthEndDate;

      // 1. Fetch operações
      let opQuery = supabase
        .from("dados_offshore_operacoes" as any)
        .select("date, cod_assessor, cod_conta_brasil, valor_receita_usd")
        .gte("date", fetchStart)
        .lte("date", fetchEnd);
      if (selectedAssessorId !== "all") {
        opQuery = opQuery.eq("cod_assessor", selectedAssessorId);
      }
      const { data: opRows } = await opQuery;

      // 2. Fetch remessas
      let remQuery = supabase
        .from("dados_offshore_remessas" as any)
        .select("date, cod_assessor, valor_ordem_remessa_rs, taxa_percentual_spread")
        .gte("date", fetchStart)
        .lte("date", fetchEnd);
      if (selectedAssessorId !== "all") {
        remQuery = remQuery.eq("cod_assessor", selectedAssessorId);
      }
      const { data: remRows } = await remQuery;

      // 3. Fetch cotações dólar for the selected month period (YYYYMM)
      const periodo = selectedMonthKey.replace("-", "");
      const { data: cotacaoRows } = await supabase
        .from("dados_cotacoes_dolar" as any)
        .select("periodo, valor_dolar")
        .eq("periodo", periodo);
      const valorDolar = parseFloat(String((cotacaoRows as any[])?.[0]?.valor_dolar || "0").replace(",", "."));

      // Build combined results replicating vw_detalhamento_offshore logic
      const combined: any[] = [];

      // Operações: receita = COALESCE(NULLIF(replace(valor_receita_usd,',','.')::numeric,0),0) * valor_dolar * 0.325
      (opRows as any[] || []).forEach((r: any) => {
        const rawCod = (r.cod_assessor || "").trim();
        const codAssessor = rawCod.toUpperCase().startsWith("A") ? rawCod.toUpperCase() : `A${rawCod}`.toUpperCase();
        const valorUsd = parseFloat(String(r.valor_receita_usd || "0").replace(",", ".")) || 0;
        const receita = valorUsd * valorDolar * 0.325;

        combined.push({
          data: r.date,
          cod_assessor: codAssessor,
          tipo_offshore: "Offshore Operações",
          receita,
        });
      });

      // Remessas: receita = COALESCE(NULLIF(replace(valor_ordem_remessa_rs,',','.')::numeric,0),0) * COALESCE(NULLIF(replace(taxa_percentual_spread,',','.')::numeric,0),0)
      (remRows as any[] || []).forEach((r: any) => {
        const rawCod = (r.cod_assessor || "").trim();
        const codAssessor = rawCod.toUpperCase().startsWith("A") ? rawCod.toUpperCase() : `A${rawCod}`.toUpperCase();
        const valorRemessa = parseFloat(String(r.valor_ordem_remessa_rs || "0").replace(",", ".")) || 0;
        const taxaSpread = parseFloat(String(r.taxa_percentual_spread || "0").replace(",", ".")) || 0;
        const receita = valorRemessa * taxaSpread;

        combined.push({
          data: r.date,
          cod_assessor: codAssessor,
          tipo_offshore: "Offshore Remessas",
          receita,
        });
      });

      // Filter by team & enrich with assessor metadata
      return combined.filter((r: any) => {
        const assessor = assessorMap.get(r.cod_assessor);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;
        return true;
      }).map((r: any) => {
        const assessor = assessorMap.get(r.cod_assessor) || {};
        return {
          ...r,
          nome_assessor: assessor.nome_assessor || r.cod_assessor,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
        };
      }).filter((r: any) => {
        if (Math.abs(r.receita) < 0.01) return false;
        return true;
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // Query — vw_oportunidades_renda_fixa (Opportunities)
  // ────────────────────────────────────────────────────────────────────────
  const { data: oppsData, isLoading: isOppsLoading } = useQuery({
    queryKey: ["rf-opportunities-data", selectedTeam, selectedAssessorId],
    queryFn: async () => {
      const { data: activeTeamsData } = await (supabase
        .from("dados_times" as any) as any)
        .select("time")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map((t: any) => t.time) || []);

      // Get assessor metadata from latest position
      const { data: latestDateData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();
      const latestDate = (latestDateData as any)?.data_posicao;

      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster");
      if (latestDate) mvQuery = mvQuery.eq("data_posicao", latestDate);

      if (selectedTeam !== "all") {
        mvQuery = mvQuery.eq("time", selectedTeam);
      } else {
        mvQuery = mvQuery.in("time", Array.from(activeTeamNames));
      }
      if (selectedAssessorId !== "all") {
        mvQuery = mvQuery.eq("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      const assessorMap = new Map<string, any>();
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor && !assessorMap.has(r.cod_assessor)) {
          assessorMap.set(r.cod_assessor, r);
        }
      });

      let { data: vw_oportunidades_renda_fixa, error: oppsError } = await supabase
        .from('vw_oportunidades_renda_fixa' as any)
        .select('*')
        .range(0, 10000); // fetch up to 10k rows
      if (oppsError) throw oppsError;

      const allOppsRows = (vw_oportunidades_renda_fixa as any[]) || [];

      return allOppsRows.filter((r: any) => {
        const codAssessor = (r.cod_assessor || "").trim().toUpperCase();
        const assessor = assessorMap.get(codAssessor);
        if (!assessor) return false;
        if (selectedTeam !== "all" && assessor.time !== selectedTeam) return false;
        return true;
      }).map((r: any) => {
        const codAssessor = (r.cod_assessor || "").trim().toUpperCase();
        const assessor = assessorMap.get(codAssessor) || {};
        const netEmM = parseFloat(String(r.net_em_m || "0").replace(",", ".")) || 0;

        return {
          cod_cliente: r.cod_cliente,
          nome_cliente: r.nome_cliente,
          cod_assessor: codAssessor,
          assessor_nome: assessor.nome_assessor || r.nome_assessor || codAssessor,
          time: assessor.time || "",
          foto_url: assessor.foto_url || null,
          lider: assessor.lider || false,
          cluster: assessor.cluster || "",
          net_em_m_num: netEmM,
          data_ultima_posicao: r.data_ultima_posicao,
          data_ultima_operacao: r.data_ultima_operacao,
          status_geral: r.status_geral,
          status_titulo: r.status_titulo,
          status_credito: r.status_credito,
        };
      });
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // KPI Calculations
  // ────────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const currentMonthMv = (mvData || []).filter(
      (d: any) => d.data_posicao && d.data_posicao.substring(0, 7) === selectedMonthKey
    );

    const custodiaTotal = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.custodia_net || 0), 0
    );

    const receitaRendaFixa = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receita_renda_fixa || 0), 0
    );
    const receitaOfertasFundos = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receitas_ofertas_fundos || 0), 0
    );
    const receitaOfertasRF = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receitas_ofertas_rf || 0), 0
    );
    const receitaOfertas = receitaOfertasFundos + receitaOfertasRF;
    const receitaCetipados = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receita_cetipados || 0), 0
    );
    const receitaOffshore = currentMonthMv.reduce(
      (acc: number, d: any) => acc + (d.receitas_offshore || 0), 0
    );

    const targetRendaFixa = (custodiaTotal * ROA_TARGETS.renda_fixa) / 12;
    const targetOfertas = (custodiaTotal * ROA_TARGETS.ofertas) / 12;
    const targetCetipados = (custodiaTotal * ROA_TARGETS.cetipados) / 12;
    const targetOffshore = (custodiaTotal * ROA_TARGETS.offshore) / 12;

    const receitaTotal = receitaRendaFixa + receitaOfertas + receitaCetipados + receitaOffshore;
    const targetTotal = targetRendaFixa + targetOfertas + targetCetipados + targetOffshore;

    return {
      receitaRendaFixa,
      targetRendaFixa,
      receitaOfertas,
      targetOfertas,
      receitaCetipados,
      targetCetipados,
      receitaOffshore,
      targetOffshore,
      receitaTotal,
      targetTotal,
    };
  }, [mvData, selectedMonthKey]);

  // ────────────────────────────────────────────────────────────────────────
  // Chart data — Evolução mensal da métrica selecionada
  // ────────────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!mvData || mvData.length === 0) return [];

    const metric = RF_METRICS[chartMetric];

    const grouped = mvData.reduce((acc: Record<string, { realized: number; custody: number }>, curr: any) => {
      const monthKey = curr.data_posicao?.substring(0, 7);
      if (!monthKey) return acc;
      if (!monthKey.startsWith(selectedYear)) return acc;
      if (!acc[monthKey]) acc[monthKey] = { realized: 0, custody: 0 };

      // Sum all fields for this metric
      const value = metric.fields.reduce((sum: number, field: string) => sum + ((curr as any)[field] || 0), 0);
      acc[monthKey].realized += value;
      acc[monthKey].custody += curr.custodia_net || 0;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, vals]) => {
        const d = vals as { realized: number; custody: number };
        return {
          monthKey,
          monthName: format(parseISO(`${monthKey}-01`), "MMM", { locale: ptBR }),
          realized: d.realized,
          target: (d.custody * metric.roa) / 12,
        };
      });
  }, [mvData, selectedYear, chartMetric]);

  // ────────────────────────────────────────────────────────────────────────
  // Chart tooltip
  // ────────────────────────────────────────────────────────────────────────

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
              <span className="text-white/60">Meta (ROA):</span>
              <span className="text-white font-medium">{formatCurrency(data.target)}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs font-data pt-1 border-t border-white/5">
              <span className="text-white/60">Gap:</span>
              <span className={cn("font-medium", data.realized >= data.target ? "text-green-400" : "text-red-400")}>
                {data.realized >= data.target ? "+" : "-"}{formatCurrency(Math.abs(data.realized - data.target))}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // ────────────────────────────────────────────────────────────────────────
  // Loading state
  // ────────────────────────────────────────────────────────────────────────

  if (isMvLoading) {
    return <LoadingOverlay isLoading={true} />;
  }

  const currentMetric = RF_METRICS[chartMetric];

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" style={{ gridAutoRows: '1fr' }}>
        
        {/* 1. Receita Total Renda Fixa */}
        <RevenueCard
          title="Receita Total Renda Fixa"
          value={kpis.receitaTotal}
          target={kpis.targetTotal}
          icon={DollarSign}
          color="#FAC017"
          delay={0}
          isTotal={true}
        />

        {/* 2. Renda Fixa */}
        <RevenueCard
          title="Renda Fixa"
          value={kpis.receitaRendaFixa}
          target={kpis.targetRendaFixa}
          icon={Landmark}
          color="#3B82F6"
          delay={0.05}
        />

        {/* 3. Receita Ofertas (Fundos + RF) */}
        <RevenueCard
          title="Receita Ofertas"
          value={kpis.receitaOfertas}
          target={kpis.targetOfertas}
          icon={FileStack}
          color="#8B5CF6"
          delay={0.10}
        />

        {/* 4. Receita Cetipados */}
        <RevenueCard
          title="Receita Cetipados"
          value={kpis.receitaCetipados}
          target={kpis.targetCetipados}
          icon={TrendingUp}
          color="#22C55E"
          delay={0.15}
        />

        {/* 5. Receita Offshore */}
        <RevenueCard
          title="Receita Offshore"
          value={kpis.receitaOffshore}
          target={kpis.targetOffshore}
          icon={Globe}
          color="#F97316"
          delay={0.20}
        />
      </div>

      {/* ── Chart: Evolução Mensal da Métrica Selecionada ── */}
      <Card className="bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 hidden sm:block">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-euro-gold" />
              {currentMetric.label} — Evolução {selectedYear}
            </h3>
            <p className="text-[11px] text-white/70 font-data mt-1 uppercase tracking-widest">
              Acompanhamento mensal vs Meta (ROA {(currentMetric.roa * 100).toFixed(2)}%)
            </p>
          </div>

          {/* Metric Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-euro-elevated border-white/10 text-[#E8E8E0] font-data text-xs h-10 gap-3 min-w-[220px] justify-between hover:bg-white/10 hover:text-white hover:border-white/20">
                <div className="flex items-center gap-2">
                  <span className="text-euro-gold">{currentMetric.icon}</span>
                  {currentMetric.label}
                </div>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-euro-elevated border-white/10 text-[#E8E8E0] w-[260px]">
              {(Object.keys(RF_METRICS) as RFMetricKey[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setChartMetric(key)}
                  className={cn(
                    "gap-2 cursor-pointer text-xs hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white",
                    chartMetric === key && "bg-white/10 text-euro-gold"
                  )}
                >
                  <span className="text-euro-gold/80">{RF_METRICS[key].icon}</span>
                  {RF_METRICS[key].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="rfBarPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentMetric.color} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={currentMetric.color} stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="rfBarSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="rfBarNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="monthName"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CustomTooltip />} />
              <Bar dataKey="realized" name="Realizado" radius={[4, 4, 0, 0]} barSize={30}>
                {chartData.map((entry, index) => {
                  let fill = "url(#rfBarPositive)";
                  if (entry.realized >= entry.target) fill = "url(#rfBarSuccess)";
                  else if (entry.realized < 0) fill = "url(#rfBarNegative)";
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="target"
                name="Meta (ROA)"
                stroke="#FFFFFF"
                strokeOpacity={0.5}
                strokeWidth={2}
                dot={{ r: 4, fill: "#1A2030", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#FAC017", stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Tabela: Receita RF por Assessor ── */}
      <RFAssessorTable
        mvData={mvData || []}
        selectedMonthKey={selectedMonthKey}
        selectedMonth={selectedMonth}
        teamPhotos={teamPhotos}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortConfig={sortConfig}
        setSortConfig={setSortConfig}
      />

      {/* ── Tabelas Detalhadas com Seletor ── */}
      <div className="space-y-6 hidden lg:block">
        {/* Tab Selector */}
        <div className="flex items-center gap-2">
          <div className="flex bg-euro-elevated p-1 rounded-lg border border-white/5 shadow-inner">
            {[
              { key: "renda_fixa", label: "Renda Fixa", icon: <Landmark className="w-3.5 h-3.5" /> },
              { key: "ofertas_rf", label: "Ofertas RF", icon: <FileStack className="w-3.5 h-3.5" /> },
              { key: "ofertas_fundos", label: "Ofertas Fundos", icon: <FileStack className="w-3.5 h-3.5" /> },
              { key: "cetipados", label: "Cetipados", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { key: "offshore", label: "Offshore", icon: <Globe className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDetailTab(tab.key)}
                className={cn(
                  "px-5 py-2 text-xs font-data uppercase tracking-widest transition-all rounded-md flex items-center gap-2",
                  detailTab === tab.key
                    ? "bg-euro-gold text-euro-navy shadow-lg font-bold"
                    : "text-[#5C5C50] hover:text-[#A0A090]"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <Button
            onClick={() => {
              const workbook = XLSX.utils.book_new();

              // 1. Renda Fixa sheet
              const rfRows = (rfFluxoData || []).map((r: any) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.nome_assessor || "",
                "Data": r.data || "",
                "Cód. Conta": r.cod_conta || "",
                "Indexador": r.indexador || "",
                "Tipo Operação": r.tipo_operacao || "",
                "Receita": r.receita || 0,
              }));
              XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rfRows.length ? rfRows : [{}]), "Renda Fixa");

              // 2. Ofertas RF sheet
              const ofertasRfExportRows = (ofertasRfData || []).map((r: any) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.nome_assessor || "",
                "Oferta": r.oferta || "",
                "Série": r.serie != null ? String(r.serie) : "",
                "Cliente": r.cliente || "",
                "Data Liq. Prevista": r.data_liquidacao_prevista || "",
                "Mês Referência": r.data_referencia || "",
                "Fee (%)": r.fee_num || 0,
                "Valor Solicitado": r.valor_solicitado_num || 0,
                "Receita": r.receita || 0,
              }));
              XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ofertasRfExportRows.length ? ofertasRfExportRows : [{}]), "Ofertas RF");

              // 3. Ofertas Fundos sheet
              const ofertasFundosExportRows = (ofertasFundosData || []).map((r: any) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.nome_assessor || "",
                "Ativo": r.ativo || "",
                "Oferta": r.nome_oferta || "",
                "Cliente": r.cliente || "",
                "Data Liq.": r.data_liquidacao || "",
                "Mês Referência": r.data_referencia || "",
                "Status": r.status_reserva || "",
                "Fee (%)": r.fee_num || 0,
                "Valor Reserva": r.valor_qtde_reserva_num || 0,
                "Receita": r.receita || 0,
              }));
              XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ofertasFundosExportRows.length ? ofertasFundosExportRows : [{}]), "Ofertas Fundos");

              // 4. Cetipados sheet
              const cetipadosExportRows = (cetipadosData || []).map((r: any) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.nome_assessor || "",
                "Data": r.data || "",
                "Fundo": r.fundo || "",
                "Cliente": r.cliente || "",
                "Valor": r.valor_num || 0,
                "Receita": r.receita || 0,
              }));
              XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cetipadosExportRows.length ? cetipadosExportRows : [{}]), "Cetipados");

              // 5. Offshore sheet
              const offshoreExportRows = (offshoreData || []).map((r: any) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.nome_assessor || "",
                "Data": r.data || "",
                "Tipo Offshore": r.tipo_offshore || "",
                "Receita": r.receita || 0,
              }));
              XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(offshoreExportRows.length ? offshoreExportRows : [{}]), "Offshore");

              XLSX.writeFile(workbook, `detalhamento_renda_fixa_${selectedMonthKey}.xlsx`);
            }}
            className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold h-10 gap-2 px-4 shadow-lg shadow-euro-gold/10"
          >
            <Download className="w-4 h-4" />
            XLSX
          </Button>
        </div>

        {/* Conditional Detail Tables */}
        {detailTab === "renda_fixa" && (
          <RFFluxoDetailTable
            data={rfFluxoData || []}
            isLoading={isRfFluxoLoading}
            selectedMonth={selectedMonth}
            teamPhotos={teamPhotos}
            searchTerm={rfFluxoSearch}
            setSearchTerm={setRfFluxoSearch}
            sortConfig={rfFluxoSort}
            setSortConfig={setRfFluxoSort}
          />
        )}
        {detailTab === "ofertas_rf" && (
          <OfertasRFDetailTable
            data={ofertasRfData || []}
            isLoading={isOfertasRfLoading}
            selectedMonth={selectedMonth}
            teamPhotos={teamPhotos}
            searchTerm={ofertasRfSearch}
            setSearchTerm={setOfertasRfSearch}
            sortConfig={ofertasRfSort}
            setSortConfig={setOfertasRfSort}
          />
        )}
        {detailTab === "ofertas_fundos" && (
          <OfertasFundosDetailTable
            data={ofertasFundosData || []}
            isLoading={isOfertasFundosLoading}
            selectedMonth={selectedMonth}
            teamPhotos={teamPhotos}
            searchTerm={ofertasFundosSearch}
            setSearchTerm={setOfertasFundosSearch}
            sortConfig={ofertasFundosSort}
            setSortConfig={setOfertasFundosSort}
          />
        )}
        {detailTab === "cetipados" && (
          <CetipadosDetailTable
            data={cetipadosData || []}
            isLoading={isCetipadosLoading}
            selectedMonth={selectedMonth}
            teamPhotos={teamPhotos}
            searchTerm={cetipadosSearch}
            setSearchTerm={setCetipadosSearch}
            sortConfig={cetipadosSort}
            setSortConfig={setCetipadosSort}
          />
        )}
        {detailTab === "offshore" && (
          <OffshoreDetailTable
            data={offshoreData || []}
            isLoading={isOffshoreLoading}
            selectedMonth={selectedMonth}
            teamPhotos={teamPhotos}
            searchTerm={offshoreSearch}
            setSearchTerm={setOffshoreSearch}
            sortConfig={offshoreSort}
            setSortConfig={setOffshoreSort}
          />
        )}
      </div>

      {/* ── Tabela de Oportunidades Renda Fixa ── */}
      <RFOpportunitiesTable
        data={oppsData || []}
        isLoading={isOppsLoading}
        teamPhotos={teamPhotos}
        searchTerm={oppsSearch}
        setSearchTerm={setOppsSearch}
        sortConfig={oppsSort}
        setSortConfig={setOppsSort}
        currentPage={oppsPage}
        setCurrentPage={setOppsPage}
        itemsPerPage={oppsPerPage}
      />
    </div>
  );
}

// ==========================================================================
// RF Assessor Table Sub-component
// ==========================================================================

interface RFAssessorTableProps {
  mvData: any[];
  selectedMonthKey: string;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function RFAssessorTable({
  mvData,
  selectedMonthKey,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: RFAssessorTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  // Aggregate by assessor for the selected month
  const tableData = useMemo(() => {
    const currentMonthData = mvData.filter(
      (d: any) => d.data_posicao && d.data_posicao.substring(0, 7) === selectedMonthKey
    );

    const assessorMap = new Map<string, any>();
    currentMonthData.forEach((d: any) => {
      if (!d.cod_assessor) return;
      const existing = assessorMap.get(d.cod_assessor);
      if (existing) {
        existing.receita_renda_fixa += d.receita_renda_fixa || 0;
        existing.receitas_ofertas_rf += d.receitas_ofertas_rf || 0;
        existing.receitas_ofertas_fundos += d.receitas_ofertas_fundos || 0;
        existing.receita_cetipados += d.receita_cetipados || 0;
        existing.receitas_offshore += d.receitas_offshore || 0;
        existing.custodia_net += d.custodia_net || 0;
      } else {
        assessorMap.set(d.cod_assessor, {
          cod_assessor: d.cod_assessor,
          nome_assessor: d.nome_assessor || d.cod_assessor,
          time: d.time || "",
          foto_url: d.foto_url || null,
          lider: d.lider || false,
          cluster: d.cluster || "",
          receita_renda_fixa: d.receita_renda_fixa || 0,
          receitas_ofertas_rf: d.receitas_ofertas_rf || 0,
          receitas_ofertas_fundos: d.receitas_ofertas_fundos || 0,
          receita_cetipados: d.receita_cetipados || 0,
          receitas_offshore: d.receitas_offshore || 0,
          custodia_net: d.custodia_net || 0,
        });
      }
    });

    const totalROA = ROA_TARGETS.renda_fixa + ROA_TARGETS.ofertas + ROA_TARGETS.cetipados + ROA_TARGETS.offshore;

    return Array.from(assessorMap.values())
      .map((a) => {
        const receita_total_rf = a.receita_renda_fixa + a.receitas_ofertas_rf + a.receitas_ofertas_fundos + a.receita_cetipados + a.receitas_offshore;
        const meta_rf = (a.custodia_net * totalROA) / 12;
        const pct_meta = meta_rf > 0 ? (receita_total_rf / meta_rf) * 100 : 0;
        return { ...a, receita_total_rf, meta_rf, pct_meta };
      })
      .filter((a) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (a.nome_assessor || "").toLowerCase().includes(term) ||
               (a.cod_assessor || "").toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [mvData, selectedMonthKey, searchTerm, sortConfig]);

  const totals = useMemo(() => {
    const totalROA = ROA_TARGETS.renda_fixa + ROA_TARGETS.ofertas + ROA_TARGETS.cetipados + ROA_TARGETS.offshore;
    const sums = tableData.reduce((acc, curr) => ({
      receita_total_rf: acc.receita_total_rf + curr.receita_total_rf,
      meta_rf: acc.meta_rf + curr.meta_rf,
      receita_renda_fixa: acc.receita_renda_fixa + curr.receita_renda_fixa,
      receitas_ofertas_rf: acc.receitas_ofertas_rf + curr.receitas_ofertas_rf,
      receitas_ofertas_fundos: acc.receitas_ofertas_fundos + curr.receitas_ofertas_fundos,
      receita_cetipados: acc.receita_cetipados + curr.receita_cetipados,
      receitas_offshore: acc.receitas_offshore + curr.receitas_offshore,
    }), {
      receita_total_rf: 0, meta_rf: 0, receita_renda_fixa: 0, receitas_ofertas_rf: 0,
      receitas_ofertas_fundos: 0, receita_cetipados: 0, receitas_offshore: 0,
    });
    const pct_meta = sums.meta_rf > 0 ? (sums.receita_total_rf / sums.meta_rf) * 100 : 0;
    return { ...sums, pct_meta };
  }, [tableData]);

  const columns = [
    { key: "receita_total_rf", label: "Receita Total RF" },
    { key: "meta_rf", label: "Meta R$" },
    { key: "pct_meta", label: "% Meta" },
    { key: "receita_renda_fixa", label: "Renda Fixa" },
    { key: "receitas_ofertas_rf", label: "Ofertas RF" },
    { key: "receitas_ofertas_fundos", label: "Ofertas Fundos" },
    { key: "receita_cetipados", label: "Cetipados" },
    { key: "receitas_offshore", label: "Offshore" },
  ];

  return (
    <div className="space-y-6 hidden lg:block">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0">
          Receita Renda Fixa por Assessor {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
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
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                {/* Time */}
                <th
                  onClick={() => handleSort('time')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                </th>
                {/* Assessor */}
                <th
                  onClick={() => handleSort('nome_assessor')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                </th>
                {/* Data Columns */}
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className="flex items-center justify-end gap-2">{col.label} <SortIcon column={col.key} /></div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item) => (
                <tr
                  key={item.cod_assessor}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time.toUpperCase()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Data Cells */}
                  <td className="py-3 px-4 text-right border-r border-white/5">
                    <span className="font-bold text-white">{formatCurrencyTable(item.receita_total_rf)}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.meta_rf)}
                  </td>
                  <td className="py-3 px-4 text-right border-r border-white/5">
                    <span className={cn(
                      "font-bold",
                      item.pct_meta >= 100 ? "text-green-500" : item.pct_meta >= 70 ? "text-euro-gold" : "text-red-500"
                    )}>
                      {item.pct_meta.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.receita_renda_fixa)}
                  </td>
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.receitas_ofertas_rf)}
                  </td>
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.receitas_ofertas_fundos)}
                  </td>
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.receita_cetipados)}
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {formatCurrencyTable(item.receitas_offshore)}
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum assessor encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.receita_total_rf)}</td>
                <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.meta_rf)}</td>
                <td className="py-4 px-4 text-right bg-black/80 border-r border-white/5">
                  <span className={cn(
                    "font-bold",
                    totals.pct_meta >= 100 ? "text-green-500" : totals.pct_meta >= 70 ? "text-euro-gold" : "text-red-500"
                  )}>
                    {totals.pct_meta.toFixed(0)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.receita_renda_fixa)}</td>
                <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.receitas_ofertas_rf)}</td>
                <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.receitas_ofertas_fundos)}</td>
                <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrencyTable(totals.receita_cetipados)}</td>
                <td className="py-4 px-4 text-right text-white bg-black/80">{formatCurrencyTable(totals.receitas_offshore)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// RF Fluxo Detail Table Sub-component
// ==========================================================================

interface RFFluxoDetailTableProps {
  data: any[];
  isLoading: boolean;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function RFFluxoDetailTable({
  data,
  isLoading,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: RFFluxoDetailTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const tableData = useMemo(() => {
    return data
      .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.cod_conta || "").toLowerCase().includes(term) ||
          (r.indexador || "").toLowerCase().includes(term) ||
          (r.tipo_operacao || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totalReceita = useMemo(() => tableData.reduce((s, r) => s + (r.receita || 0), 0), [tableData]);

  const columns = [
    { key: "data", label: "Data", align: "left" as const },
    { key: "cod_conta", label: "Cód. Conta", align: "left" as const },
    { key: "indexador", label: "Indexador", align: "left" as const },
    { key: "tipo_operacao", label: "Tipo Operação", align: "left" as const },
    { key: "receita", label: "Receita", align: "right" as const },
  ];

  if (isLoading) {
    return (
      <div>
        <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando dados de fluxo RF...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
          <Landmark className="w-5 h-5" />
          Detalhamento Renda Fixa {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
          <Input
            type="text"
            placeholder="Buscar por assessor, conta, indexador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                {/* Time */}
                <th
                  onClick={() => handleSort('time')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                </th>
                {/* Assessor */}
                <th
                  onClick={() => handleSort('nome_assessor')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                </th>
                {/* Data Columns */}
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      col.align === "right" ? "text-right" : "text-left",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", col.align === "right" && "justify-end")}>
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item, idx) => (
                <tr
                  key={`${item.cod_assessor}-${item.cod_conta}-${item.data}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Data */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data ? format(parseISO(item.data), "dd/MM/yyyy") : "—"}
                  </td>
                  {/* Cód. Conta */}
                  <td className="py-3 px-4 text-white border-r border-white/5 font-mono">
                    {item.cod_conta || "—"}
                  </td>
                  {/* Indexador */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.indexador || "—"}
                  </td>
                  {/* Tipo Operação */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.tipo_operacao || "—"}
                  </td>
                  {/* Receita (÷2) */}
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-bold",
                      item.receita >= 0 ? "text-white" : "text-red-400"
                    )}>
                      {formatCurrencyTable(item.receita)}
                    </span>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                  <span className="text-white/50">{tableData.length} registros</span>
                </td>
                <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrencyTable(totalReceita)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Ofertas RF Detail Table Sub-component
// ==========================================================================

interface OfertasRFDetailTableProps {
  data: any[];
  isLoading: boolean;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function OfertasRFDetailTable({
  data,
  isLoading,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: OfertasRFDetailTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const tableData = useMemo(() => {
    return data
      .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.oferta || "").toLowerCase().includes(term) ||
          (r.cliente || "").toLowerCase().includes(term) ||
          (r.status_solicitacao_reserva || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totalReceita = useMemo(() => tableData.reduce((s, r) => s + (r.receita || 0), 0), [tableData]);

  const columns = [
    { key: "oferta", label: "Oferta", align: "left" as const },
    { key: "serie", label: "Série", align: "left" as const },
    { key: "cliente", label: "Cliente", align: "left" as const },
    { key: "data_liquidacao_prevista", label: "Data Liq. Prevista", align: "left" as const },
    { key: "data_referencia", label: "Mês Referência", align: "left" as const },
    { key: "fee_num", label: "Fee (%)", align: "right" as const },
    { key: "valor_solicitado_num", label: "Valor Solicitado", align: "right" as const },
    { key: "receita", label: "Receita", align: "right" as const },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando dados de Ofertas RF...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
          <FileStack className="w-5 h-5" />
          Detalhamento Ofertas RF {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
          <Input
            type="text"
            placeholder="Buscar por assessor, oferta, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
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
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      col.align === "right" ? "text-right" : "text-left",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", col.align === "right" && "justify-end")}>
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item, idx) => (
                <tr
                  key={`${item.oferta}-${item.cliente}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Oferta */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.oferta || "—"}
                  </td>
                  {/* Série */}
                  <td className="py-3 px-4 text-white font-mono border-r border-white/5">
                    {item.serie != null ? String(item.serie) : "—"}
                  </td>
                  {/* Cliente */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.cliente || "—"}
                  </td>
                  {/* Data Liq. Prevista */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data_liquidacao_prevista ? format(parseISO(item.data_liquidacao_prevista), "dd/MM/yyyy") : "—"}
                  </td>
                  {/* Mês Referência */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data_referencia ? format(parseISO(item.data_referencia), "MMM/yyyy", { locale: ptBR }) : "—"}
                  </td>
                  {/* Fee (%) */}
                  <td className="py-3 px-4 text-right text-white border-r border-white/5 font-mono">
                    {item.fee_num.toFixed(2)}%
                  </td>
                  {/* Valor Solicitado */}
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.valor_solicitado_num)}
                  </td>
                  {/* Receita */}
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-bold",
                      item.receita >= 0 ? "text-white" : "text-red-400"
                    )}>
                      {formatCurrencyTable(item.receita)}
                    </span>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                  <span className="text-white/50">{tableData.length} registros</span>
                </td>
                <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrencyTable(totalReceita)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Ofertas Fundos Detail Table Sub-component
// ==========================================================================

interface OfertasFundosDetailTableProps {
  data: any[];
  isLoading: boolean;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function OfertasFundosDetailTable({
  data,
  isLoading,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: OfertasFundosDetailTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const tableData = useMemo(() => {
    return data
      .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.ativo || "").toLowerCase().includes(term) ||
          (r.nome_oferta || "").toLowerCase().includes(term) ||
          (r.cliente || "").toLowerCase().includes(term) ||
          (r.status_reserva || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totalReceita = useMemo(() => {
    return tableData.reduce((s, r) => s + (r.receita || 0), 0);
  }, [tableData]);

  const columns = [
    { key: "ativo", label: "Ativo", align: "left" as const },
    { key: "nome_oferta", label: "Oferta", align: "left" as const },
    { key: "cliente", label: "Cliente", align: "left" as const },
    { key: "data_liquidacao", label: "Data Liq.", align: "left" as const },
    { key: "data_referencia", label: "Mês Referência", align: "left" as const },
    { key: "status_reserva", label: "Status", align: "left" as const },
    { key: "fee_num", label: "Fee (%)", align: "right" as const },
    { key: "valor_qtde_reserva_num", label: "Valor Reserva", align: "right" as const },
    { key: "receita", label: "Receita", align: "right" as const },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando dados de Ofertas Fundos...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
          <FileStack className="w-5 h-5" />
          Detalhamento Ofertas Fundos {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
          <Input
            type="text"
            placeholder="Buscar por assessor, ativo, oferta, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
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
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      col.align === "right" ? "text-right" : "text-left",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", col.align === "right" && "justify-end")}>
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item, idx) => (
                <tr
                  key={`${item.ativo}-${item.cliente}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Ativo */}
                  <td className="py-3 px-4 text-white font-mono border-r border-white/5">
                    {item.ativo || "—"}
                  </td>
                  {/* Nome Oferta */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.nome_oferta || "—"}
                  </td>
                  {/* Cliente */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.cliente || "—"}
                  </td>
                  {/* Data Liq. */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data_liquidacao ? format(parseISO(item.data_liquidacao), "dd/MM/yyyy") : "—"}
                  </td>
                  {/* Mês Referência */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data_referencia ? format(parseISO(item.data_referencia), "MMM/yyyy", { locale: ptBR }) : "—"}
                  </td>
                  {/* Status */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      (item.status_reserva || "").toUpperCase().includes("EFETIVAD") ? "bg-green-500/20 text-green-400" :
                      (item.status_reserva || "").toUpperCase().includes("SOLICITAD") ? "bg-yellow-500/20 text-yellow-400" :
                      (item.status_reserva || "").toUpperCase().includes("PROCESSAMENT") ? "bg-blue-500/20 text-blue-400" :
                      "bg-white/10 text-white/70"
                    )}>
                      {item.status_reserva || "—"}
                    </span>
                  </td>
                  {/* Fee (%) */}
                  <td className="py-3 px-4 text-right text-white border-r border-white/5 font-mono">
                    {item.fee_num?.toFixed?.(2)}%
                  </td>
                  {/* Valor Reserva */}
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.valor_qtde_reserva_num)}
                  </td>
                  {/* Receita */}
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-bold",
                      item.receita >= 0 ? "text-white" : "text-red-400"
                    )}>
                      {formatCurrencyTable(item.receita)}
                    </span>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                  <span className="text-white/50">{tableData.length} registros</span>
                </td>
                <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrencyTable(totalReceita)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Cetipados Detail Table Sub-component
// ==========================================================================

interface CetipadosDetailTableProps {
  data: any[];
  isLoading: boolean;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function CetipadosDetailTable({
  data,
  isLoading,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: CetipadosDetailTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const tableData = useMemo(() => {
    return data
      .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.cliente || "").toLowerCase().includes(term) ||
          (r.fundo || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totalReceita = useMemo(() => {
    return tableData.reduce((s, r) => s + (r.receita || 0), 0);
  }, [tableData]);

  const columns = [
    { key: "data", label: "Data", align: "left" as const },
    { key: "fundo", label: "Fundo", align: "left" as const },
    { key: "cliente", label: "Cliente", align: "left" as const },
    { key: "valor_num", label: "Valor", align: "right" as const },
    { key: "receita", label: "Receita", align: "right" as const },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando dados de Cetipados...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Detalhamento Cetipados {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
          <Input
            type="text"
            placeholder="Buscar por assessor, cliente, fundo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
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
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      col.align === "right" ? "text-right" : "text-left",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", col.align === "right" && "justify-end")}>
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item, idx) => (
                <tr
                  key={`${item.data}-${item.cliente}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Data */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data ? format(parseISO(item.data), "dd/MM/yyyy") : "—"}
                  </td>
                  {/* Fundo */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.fundo || "—"}
                  </td>
                  {/* Cliente */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.cliente || "—"}
                  </td>
                  {/* Valor */}
                  <td className="py-3 px-4 text-right text-white border-r border-white/5">
                    {formatCurrencyTable(item.valor_num)}
                  </td>
                  {/* Receita */}
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-bold",
                      item.receita >= 0 ? "text-white" : "text-red-400"
                    )}>
                      {formatCurrencyTable(item.receita)}
                    </span>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                  <span className="text-white/50">{tableData.length} registros</span>
                </td>
                <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrencyTable(totalReceita)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Offshore Detail Table Sub-component
// ==========================================================================

interface OffshoreDetailTableProps {
  data: any[];
  isLoading: boolean;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
}

function OffshoreDetailTable({
  data,
  isLoading,
  selectedMonth,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: OffshoreDetailTableProps) {

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const tableData = useMemo(() => {
    return data
      .filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (r.nome_assessor || "").toLowerCase().includes(term) ||
          (r.cod_assessor || "").toLowerCase().includes(term) ||
          (r.tipo_offshore || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
  }, [data, searchTerm, sortConfig]);

  const totalReceita = useMemo(() => {
    return tableData.reduce((s, r) => s + (r.receita || 0), 0);
  }, [tableData]);

  const columns = [
    { key: "data", label: "Data", align: "left" as const },
    { key: "tipo_offshore", label: "Tipo Offshore", align: "left" as const },
    { key: "receita", label: "Receita", align: "right" as const },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando dados de Offshore...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Detalhamento Offshore {formattedMonth ? `(${formattedMonth})` : ""}
        </h3>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
          <Input
            type="text"
            placeholder="Buscar por assessor, tipo, conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

        <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
          <table className="w-full text-left border-collapse">
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
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors",
                      col.align === "right" ? "text-right" : "text-left",
                      i < columns.length - 1 && "border-r border-euro-navy/5"
                    )}
                  >
                    <div className={cn("flex items-center gap-2", col.align === "right" && "justify-end")}>
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {tableData.map((item, idx) => (
                <tr
                  key={`${item.data}-${item.tipo_offshore}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Data */}
                  <td className="py-3 px-4 text-white/80 border-r border-white/5">
                    {item.data ? format(parseISO(item.data), "dd/MM/yyyy") : "—"}
                  </td>
                  {/* Tipo Offshore */}
                  <td className="py-3 px-4 text-white border-r border-white/5">
                    {item.tipo_offshore || "—"}
                  </td>

                  {/* Receita */}
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-bold",
                      item.receita >= 0 ? "text-white" : "text-red-400"
                    )}>
                      {formatCurrencyTable(item.receita)}
                    </span>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-20">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10" />
                      <p className="text-sm font-data uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5"></td>
                <td className="py-4 px-4 bg-black/80 border-r border-white/5">
                  <span className="text-white/50">{tableData.length} registros</span>
                </td>
                <td className="py-4 px-4 text-right text-euro-gold bg-black/80">{formatCurrencyTable(totalReceita)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// RF Opportunities Table Sub-component
// ==========================================================================

interface RFOpportunitiesTableProps {
  data: any[];
  isLoading: boolean;
  teamPhotos?: Map<string, string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: (v: { key: string; direction: 'asc' | 'desc' }) => void;
  currentPage: number;
  setCurrentPage: (v: number | ((p: number) => number)) => void;
  itemsPerPage: number;
}

function RFOpportunitiesTable({
  data,
  isLoading,
  teamPhotos,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
  currentPage,
  setCurrentPage,
  itemsPerPage,
}: RFOpportunitiesTableProps) {
  const [activeFilter, setActiveFilter] = useState<'Todos' | 'Geral' | 'Título' | 'Crédito'>('Todos');

  const formatCurrencyTable = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch { return dateStr; }
  };

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const isAtivo = (status || "").toUpperCase() === "ATIVO";
    return (
      <span className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
        isAtivo
          ? "bg-green-500/20 text-green-400"
          : "bg-euro-gold/20 text-euro-gold"
      )}>
        {status || "—"}
      </span>
    );
  };

  const { filteredData, paginatedData, totalPages } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    let filtered = data.filter((r) => {
      if (activeFilter === 'Geral' && (r.status_geral || "").toUpperCase() !== 'OPORTUNIDADE') return false;
      if (activeFilter === 'Título' && (r.status_titulo || "").toUpperCase() !== 'OPORTUNIDADE') return false;
      if (activeFilter === 'Crédito' && (r.status_credito || "").toUpperCase() !== 'OPORTUNIDADE') return false;

      if (!searchTerm) return true;
      return (
        (r.assessor_nome || "").toLowerCase().includes(searchLower) ||
        (r.cod_assessor || "").toLowerCase().includes(searchLower) ||
        (r.nome_cliente || "").toLowerCase().includes(searchLower) ||
        (r.cod_cliente || "").toLowerCase().includes(searchLower) ||
        (r.status_geral || "").toLowerCase().includes(searchLower) ||
        (r.status_titulo || "").toLowerCase().includes(searchLower) ||
        (r.status_credito || "").toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal: any = key === 'net_em_m' ? a.net_em_m_num : a[key as keyof typeof a];
      let bVal: any = key === 'net_em_m' ? b.net_em_m_num : b[key as keyof typeof b];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
    });

    const pages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return { filteredData: filtered, paginatedData: paginated, totalPages: pages };
  }, [data, searchTerm, sortConfig, currentPage, itemsPerPage, activeFilter]);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/30 text-sm font-data uppercase tracking-widest">Carregando oportunidades...</div>
    );
  }

  return (
    <div className="hidden lg:block space-y-4 pt-8 border-t border-white/10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
            <Users className="w-5 h-5 text-euro-gold" />
          </div>
          <div>
            <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
              Oportunidades Renda Fixa
            </h3>
            <p className="text-[10px] text-white/30 font-data uppercase tracking-widest">
              Clientes com oportunidades em produtos de renda fixa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 w-full md:w-auto flex-1 md:justify-center px-4">
          {['Todos', 'Geral', 'Título', 'Crédito'].map((f) => (
            <Button
              key={f}
              variant={activeFilter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveFilter(f as any); setCurrentPage(1); }}
              className={cn(
                "h-8 text-[10px] sm:text-xs font-data uppercase tracking-widest transition-all whitespace-nowrap",
                activeFilter === f
                  ? "bg-euro-gold text-euro-navy hover:bg-euro-gold/90 border-transparent shadow-[0_0_15px_rgba(250,192,23,0.3)] font-bold"
                  : "bg-euro-elevated/50 text-euro-gold/70 border-euro-gold/20 hover:bg-euro-gold/10 hover:text-euro-gold hover:border-euro-gold/50"
              )}
            >
              {f === 'Todos' ? 'Todas' : f}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
            <Input
              type="text"
              placeholder="Buscar por cliente ou assessor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
            />
          </div>
          <Button
            onClick={() => {
              const rows = filteredData.map((r) => ({
                "Time": r.time || "",
                "Cód. Assessor": r.cod_assessor || "",
                "Assessor": r.assessor_nome || "",
                "Cód. Cliente": r.cod_cliente || "",
                "Nome Cliente": r.nome_cliente || "",
                "Net (M)": r.net_em_m_num || 0,
                "Últ. Posição": r.data_ultima_posicao || "",
                "Últ. Operação": r.data_ultima_operacao || "",
                "Status Geral": r.status_geral || "",
                "Status Título": r.status_titulo || "",
                "Status Crédito": r.status_credito || "",
              }));
              const worksheet = XLSX.utils.json_to_sheet(rows);
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, "Oportunidades RF");
              XLSX.writeFile(workbook, `oportunidades_renda_fixa.xlsx`);
            }}
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
                  onClick={() => handleSort('assessor_nome')}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="assessor_nome" /></div>
                </th>
                <th onClick={() => handleSort('cod_cliente')} className="py-4 px-4 font-bold border-r border-euro-navy/5 w-[110px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2">Cód. Cliente <SortIcon column="cod_cliente" /></div>
                </th>
                <th onClick={() => handleSort('nome_cliente')} className="py-4 px-4 font-bold border-r border-euro-navy/5 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2">Nome Cliente <SortIcon column="nome_cliente" /></div>
                </th>
                <th onClick={() => handleSort('net_em_m')} className="py-4 px-4 font-bold text-right border-r border-euro-navy/5 w-[140px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-end">Net (M) <SortIcon column="net_em_m" /></div>
                </th>
                <th onClick={() => handleSort('data_ultima_posicao')} className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 w-[130px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-center">Últ. Posição <SortIcon column="data_ultima_posicao" /></div>
                </th>
                <th onClick={() => handleSort('data_ultima_operacao')} className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 w-[130px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-center">Últ. Operação <SortIcon column="data_ultima_operacao" /></div>
                </th>
                <th onClick={() => handleSort('status_geral')} className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-center">Status Geral <SortIcon column="status_geral" /></div>
                </th>
                <th onClick={() => handleSort('status_titulo')} className="py-4 px-4 font-bold text-center border-r border-euro-navy/5 w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-center">Status Título <SortIcon column="status_titulo" /></div>
                </th>
                <th onClick={() => handleSort('status_credito')} className="py-4 px-4 font-bold text-center w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                  <div className="flex items-center gap-2 justify-center">Status Crédito <SortIcon column="status_credito" /></div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {paginatedData.map((item, idx) => (
                <tr
                  key={`${item.cod_cliente}-${item.cod_assessor}-${idx}`}
                  className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                >
                  {/* Time */}
                  <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                    <div className="flex items-center justify-center">
                      {teamPhotos?.has(item.time?.toUpperCase?.()) ? (
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                          <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                          {(item.time || "").substring(0, 3).toUpperCase()}
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
                            <img src={item.foto_url} alt={item.assessor_nome} className="w-full h-full object-cover" />
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
                          {item.assessor_nome}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
                          <span className="font-mono">{item.cod_assessor}</span>
                          {item.cluster && (
                            <>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{item.cluster}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Cód. Cliente */}
                  <td className="py-3 px-4 border-r border-white/5 text-white font-mono">
                    {item.cod_cliente || "—"}
                  </td>
                  {/* Nome Cliente */}
                  <td className="py-3 px-4 border-r border-white/5">
                    <span className="text-white font-bold uppercase tracking-tight">
                      {item.nome_cliente || "Nome não identificado"}
                    </span>
                  </td>
                  {/* Net (M) */}
                  <td className="py-3 px-4 text-right border-r border-white/5 text-white">
                    {formatCurrencyTable(item.net_em_m_num)}
                  </td>
                  {/* Última Posição */}
                  <td className="py-3 px-4 text-center border-r border-white/5 text-white/80">
                    {formatDate(item.data_ultima_posicao)}
                  </td>
                  {/* Última Operação */}
                  <td className="py-3 px-4 text-center border-r border-white/5 text-white/80">
                    {formatDate(item.data_ultima_operacao)}
                  </td>
                  {/* Status Geral */}
                  <td className="py-3 px-4 text-center border-r border-white/5">
                    <StatusBadge status={item.status_geral} />
                  </td>
                  {/* Status Título */}
                  <td className="py-3 px-4 text-center border-r border-white/5">
                    <StatusBadge status={item.status_titulo} />
                  </td>
                  {/* Status Crédito */}
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={item.status_credito} />
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-20 text-center opacity-20">
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
              Mostrando <span className="text-white/60">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white/60">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="text-white/60">{filteredData.length}</span> oportunidades
            </p>
            <div className="flex items-center gap-2 justify-center">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
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
  );
}
