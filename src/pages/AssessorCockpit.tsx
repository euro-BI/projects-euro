import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { parseISO, format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
  Cell
} from "recharts";
import { 
  ArrowLeft,
  Maximize2,
  Minimize2,
  Trophy,
  Medal,
  TrendingUp,
  Target,
  Briefcase,
  Calendar,
  Wallet,
  ArrowUpRight,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

// --- Configurações de Métricas Copiadas e Ajustadas do Cockpit ---
type MetricType = 'funding' | 'allocation' | 'variable' | 'banking' | 'insurance';

const METRIC_CONFIG: Record<MetricType, any> = {
  funding: { label: "Captação Líquida", fields: ["captacao_liquida_total"], targetField: "meta_captacao", isRoaBased: false },
  allocation: { label: "Alocação", fields: ["receita_renda_fixa", "asset_m_1", "receita_previdencia", "receita_cetipados", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receitas_offshore"], isRoaBased: true, roaTarget: 0.0015 + 0.0002 + 0.0001 + 0.0005 + 0.0010 + 0.0002 },
  variable: { label: "Renda Variável", fields: ["receitas_estruturadas", "receita_b3"], isRoaBased: true, roaTarget: 0.0035 + 0.0020 },
  banking: { label: "Banking", fields: ["receita_consorcios", "receita_compromissadas", "receita_cambio"], isRoaBased: true, roaTarget: 0.0009 + 0.0001 + 0.0001 },
  insurance: { label: "Seguros", fields: ["receita_seguros"], isRoaBased: true, roaTarget: 0.0007 }
};

const PRODUCT_METRICS = {
  investimentos: [ // Era "eurostock"
    { label: "R. Fixa", fields: ["receita_renda_fixa"], roa: 0.0015 },
    { label: "Asset", fields: ["asset_m_1"], roa: 0.0002 },
    { label: "Previd.", fields: ["receita_previdencia"], roa: 0.0001 },
    { label: "Cetipados", fields: ["receita_cetipados"], roa: 0.0005 },
    { label: "Ofertas", fields: ["receitas_ofertas_fundos", "receitas_ofertas_rf"], roa: 0.0010 },
    { label: "Offshore", fields: ["receitas_offshore"], roa: 0.0002 },
    { label: "Estruturas", fields: ["receitas_estruturadas"], roa: 0.0035 },
    { label: "B3", fields: ["receita_b3"], roa: 0.0020 },
  ],
  cross_sell: [ // Era "affare"
    { label: "Consórc.", fields: ["receita_consorcios"], roa: 0.0009 },
    { label: "Compromis.", fields: ["receita_compromissadas"], roa: 0.0001 },
    { label: "Câmbio", fields: ["receita_cambio"], roa: 0.0001 },
    { label: "Seguros", fields: ["receita_seguros"], roa: 0.0007 },
  ]
};

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const getStatusColor = (percent: number) => percent >= 100 ? "text-green-500" : percent >= 70 ? "text-euro-gold" : "text-red-500";
const getProgressBarColor = (percent: number) => percent >= 100 ? "bg-green-500" : percent >= 70 ? "bg-euro-gold" : "bg-red-500";
const formatCurrencyValue = (val: number) => {
  const absVal = Math.abs(val);
  if (absVal >= 1000000) {
    return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mi";
  } else {
    return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
  }
};

import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { Briefcase as BriefcaseIcon } from "lucide-react";

export default function AssessorCockpit() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [displayMode, setDisplayMode] = useState<'meta' | 'proportional' | 'pace'>('meta');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  
  const navigate = useNavigate();
  const { userCode, userRole } = useAuth();
  
  const [selectedAssessorCode, setSelectedAssessorCode] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  useEffect(() => {
    if (userCode && !selectedAssessorCode) {
      setSelectedAssessorCode(userCode);
    }
  }, [userCode]);

  const effectiveAssessorId = selectedAssessorCode || userCode || "A0000"; 
  
  const isAdmin = userRole === "admin" || userRole === "admin_master";

  const toggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsMaximized(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsMaximized(false);
        }
      }
    } catch (err) {
      console.error(`Error attempting to toggle full-screen mode: ${err}`);
      setIsMaximized(!isMaximized);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => setIsMaximized(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Fetch Available Dates, Teams & Assessors for Filter
  const { data: filtersData, isLoading: isDatesLoading } = useQuery({
    queryKey: ["dash-cockpit-filters-data"],
    queryFn: async () => {
      // 1. Fetch dates
      const { data: datesData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false });
      
      const rawMonths = Array.from(new Set(datesData?.map((d: any) => d.data_posicao) || [])) as string[];
      const allMonths = rawMonths.filter(m => {
        if (!m) return false;
        try { return !isNaN(parseISO(m).getTime()); } catch { return false; }
      });
      const years = Array.from(new Set(allMonths.map(m => parseISO(m).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));

      // 2. Fetch Active Profiles and Teams
      const { data: activeProfiles } = await supabase
        .from("projects_profiles" as any)
        .select("codigo")
        .eq("is_active", true);
      const activeCodes = ((activeProfiles || []) as any[]).map(p => p.codigo).filter(Boolean);

      const { data: activeTeamsData } = await supabase
        .from("dados_times" as any)
        .select("time, foto_url")
        .eq("status", "ATIVO");
      const activeTeamNames = new Set((activeTeamsData as any[])?.map(t => t.time) || []);
      const teamLogoMap = new Map((activeTeamsData as any[])?.map(t => [t.time, t.foto_url]) || []);

      // 3. Fetch Teams & Assessors
      const { data: profileData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time")
        .order("nome_assessor", { ascending: true });

      const teams = Array.from(new Set(profileData?.map((p: any) => p.time) || []))
        .filter(t => t && t !== 'null' && activeTeamNames.has(t) && !BLOCKED_TEAMS.includes(t)) as string[];
      
      const assessorsMap = new Map();
      profileData?.forEach((p: any) => {
        if (!p.cod_assessor || BLOCKED_ASSESSORS.includes(p.cod_assessor) || !activeCodes.includes(p.cod_assessor)) return;
        if (!p.time || !activeTeamNames.has(p.time)) return; // Exclude assessors from inactive teams
        
        if (!assessorsMap.has(p.cod_assessor)) {
          assessorsMap.set(p.cod_assessor, { id: p.cod_assessor, name: p.nome_assessor, teams: [] });
        }
        if (p.time && !assessorsMap.get(p.cod_assessor).teams.includes(p.time)) {
          assessorsMap.get(p.cod_assessor).teams.push(p.time);
        }
      });
      const assessorsList = Array.from(assessorsMap.values()).filter(a => a.name && a.name !== 'null');

      // 4. Fetch Reference Date
      let referenceDateISO = null;
      try {
        const { data: refData } = await (supabase
          .from('wv_tabelas_atualizacao' as any) as any)
          .select('ultima_atualizacao')
          .order('ultima_atualizacao', { ascending: false })
          .limit(1);
        referenceDateISO = refData?.[0]?.ultima_atualizacao || null;
      } catch (err) {
        console.warn("Failed to fetch wv_tabelas_atualizacao, using default date.");
      }

      return {
        allMonths,
        years,
        teams,
        assessors: assessorsList,
        teamLogoMap,
        referenceDateISO
      };
    }
  });

  const globalDates = filtersData;

  useEffect(() => {
    if (globalDates?.referenceDateISO) {
      setReferenceDate(parseISO(globalDates.referenceDateISO));
    }
  }, [globalDates]);

  const filteredMonths = useMemo(() => {
    if (!globalDates?.allMonths) return [];
    return globalDates.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [globalDates, selectedYear]);

  useEffect(() => {
    if (filteredMonths.length > 0 && !filteredMonths.includes(selectedMonth)) {
      setSelectedMonth(filteredMonths[0]);
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  // Fetch Current Data
  const { data: currentData, isLoading: isCurrentLoading } = useQuery({
    queryKey: ["dash-cockpit-current", selectedMonth, effectiveAssessorId, selectedTeam],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      } else if (selectedTeam !== "all") {
        query = query.eq("time", selectedTeam);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    }
  });

  // Fetch Yearly Data for Chart
  const { data: yearlyData, isLoading: isYearlyLoading } = useQuery({
    queryKey: ["dash-cockpit-yearly", selectedYear, effectiveAssessorId, selectedTeam],
    enabled: !!selectedYear,
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);

      if (effectiveAssessorId !== "all") {
        query = query.eq("cod_assessor", effectiveAssessorId);
      } else if (selectedTeam !== "all") {
        query = query.eq("time", selectedTeam);
      }
      
      const { data, error } = await query.order("data_posicao", { ascending: true });
      
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    }
  });

  // Remove the old allAssessors query as it's now part of filtersData query if needed, 
  // or keep it if DashboardFilters doesn't handle the fetch. 
  // Actually, DashboardFilters expects the pre-fetched data.

  // Fetch all ranking data for this year to calculate Super Ranking position
  const { data: rankingData, isLoading: isRankingLoading } = useQuery({
    queryKey: ["dash-cockpit-super-ranking", selectedYear],
    enabled: !!selectedYear,
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);
      
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    }
  });

  const rankingProfile = useMemo(() => {
    if (!rankingData || rankingData.length === 0) return null;

    let filtered = rankingData.filter(d => {
      if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null") return false;
      if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
      if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
      return true;
    });

    const grouped = filtered.reduce((acc: Record<string, any>, curr) => {
      const key = curr.cod_assessor;
      if (!acc[key]) {
        acc[key] = {
          ...curr,
          pontos_total: 0,
        };
      }
      acc[key].pontos_total += curr.pontos_total || 0;
      return acc;
    }, {});

    const sortedRank = Object.values(grouped).sort((a: any, b: any) => b.pontos_total - a.pontos_total);
    const myIndex = sortedRank.findIndex((a: any) => a.cod_assessor === effectiveAssessorId);
    
    if (myIndex === -1) return null;
    const myData = sortedRank[myIndex] as any;

    return {
      position: myIndex + 1,
      points: myData.pontos_total,
      totalAssessors: sortedRank.length,
      assessorName: myData.nome_assessor,
      fotoUrl: myData.foto_url
    };
  }, [rankingData, effectiveAssessorId]);

  // -- KPIS CALCULATIONS (Adapted from CockpitDash) --
  const getPaceValue = (value: number) => {
    if (displayMode !== 'pace') return value;
    if (!currentData || currentData.length === 0 || !currentData[0].data_posicao) return value;
    
    try {
      const dataDate = parseISO(currentData[0].data_posicao);
      if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) return value;

      const start = startOfMonth(referenceDate);
      const end = endOfMonth(referenceDate);
      const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
      const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
      const passedDays = Math.max(1, rawPassedDays - 2);
      
      if (passedDays > 0 && totalDays > 0) {
        return (value / passedDays) * totalDays;
      }
    } catch {
       return value;
    }
    return value;
  };

  const getProportionalTarget = (target: number) => {
    if (displayMode !== 'proportional') return target;
    if (!currentData || currentData.length === 0 || !currentData[0].data_posicao) return target;

    try {
      const dataDate = parseISO(currentData[0].data_posicao);
      if (!isSameMonth(dataDate, referenceDate) || dataDate.getFullYear() !== referenceDate.getFullYear()) return target;

      const start = startOfMonth(referenceDate);
      const end = endOfMonth(referenceDate);
      
      const totalDays = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
      const rawPassedDays = eachDayOfInterval({ start, end: referenceDate }).filter(d => !isWeekend(d)).length;
      const passedDays = Math.max(1, rawPassedDays - 2);
      
      if (totalDays > 0) {
        return (target / totalDays) * passedDays;
      }
    } catch {
      return target;
    }
    return target;
  };

  const kpis = useMemo(() => {
    if (!currentData || currentData.length === 0) return null;

    const custodyTotal = currentData.reduce((acc, curr) => acc + (curr.custodia_net || 0), 0);
    
    const calculateMetric = (type: MetricType) => {
      const config = METRIC_CONFIG[type];
      let rawRealized = currentData.reduce((acc, curr) => {
        let sum = 0;
        config.fields.forEach((field: string) => sum += (curr as any)[field] || 0);
        return acc + sum;
      }, 0);

      const realized = getPaceValue(rawRealized);

      let target = 0;
      if (config.isRoaBased) {
        target = (custodyTotal * (config.roaTarget || 0)) / 12;
      } else {
        target = currentData.reduce((acc, curr) => acc + ((curr as any)[config.targetField!] || 0), 0);
      }

      target = getProportionalTarget(target);

      const percent = target > 0 ? (realized / target) * 100 : 0;
      const gap = target - realized;

      return { realized, target, percent, gap };
    };

    const calculateProductMetrics = (products: any[]) => {
      return products.map(product => {
        const rawRealized = currentData.reduce((acc, curr) => {
          let sum = 0;
          product.fields.forEach((field: string) => sum += (curr as any)[field] || 0);
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

    const invProducts = calculateProductMetrics(PRODUCT_METRICS.investimentos);
    const csProducts = calculateProductMetrics(PRODUCT_METRICS.cross_sell);

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
      funding: metrics.funding,
      invest: {
        ...invest,
        percent: invest.target > 0 ? (invest.realized / invest.target) * 100 : 0,
        gap: invest.target - invest.realized,
        products: invProducts
      },
      cs: {
        ...cs,
        percent: cs.target > 0 ? (cs.realized / cs.target) * 100 : 0,
        gap: cs.target - cs.realized,
        products: csProducts
      },
      global: {
        ...global,
        percent: global.target > 0 ? (global.realized / global.target) * 100 : 0,
        gap: global.target - global.realized
      }
    };
  }, [currentData, displayMode, referenceDate]);

  // -- CHART DATA (Receita Total Evolution) --
  const chartData = useMemo(() => {
    if (!yearlyData || yearlyData.length === 0) return [];

    const grouped = yearlyData.reduce((acc: Record<string, any>, curr) => {
      if (!curr.data_posicao) return acc;
      
      try {
        const parsedDate = parseISO(curr.data_posicao);
        const monthKey = format(parsedDate, "yyyy-MM");
        if (!acc[monthKey]) {
          acc[monthKey] = {
            monthKey,
            monthName: format(parsedDate, "MMM", { locale: ptBR }),
            realized: 0,
            custody: 0,
          };
        }

      
      const realizedFields = [
        "receita_renda_fixa", "asset_m_1", "receita_previdencia", "receita_cetipados", "receitas_ofertas_fundos", "receitas_ofertas_rf", "receitas_offshore", // allocation
        "receitas_estruturadas", "receita_b3", // variable
        "receita_consorcios", "receita_compromissadas", "receita_cambio", // banking
        "receita_seguros" // insurance
      ];

      let sum = 0;
      realizedFields.forEach(field => {
        sum += (curr as any)[field] || 0;
      });
      
      acc[monthKey].realized += sum;
      acc[monthKey].custody += curr.custodia_net || 0;
      } catch (err) {
        console.warn('Invalid date format skipped:', curr.data_posicao);
      }
      return acc;
    }, {} as Record<string, any>);

    let result = Object.values(grouped).sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey));

    // Calculate Target based on Total ROA (0.0108)
    const TOTAL_ROA = 0.0108;
    
    result = result.map((d: any) => {
      const target = (d.custody * TOTAL_ROA) / 12;
      return {
        ...d,
        target,
        gap: target - d.realized
      };
    });

    return result;
  }, [yearlyData]);

  const CustomChartTooltip = ({ active, payload, label }: any) => {
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

  const isLoading = isDatesLoading || isCurrentLoading || isRankingLoading || isYearlyLoading;
  
  const assessorName = useMemo(() => {
    if (effectiveAssessorId !== "all") {
       return currentData?.[0]?.nome_assessor || rankingProfile?.assessorName || "Assessor";
    }
    if (selectedTeam !== "all") {
       return `Time: ${selectedTeam}`;
    }
    return "Visão Geral";
  }, [effectiveAssessorId, selectedTeam, currentData, rankingProfile]);

  const assessorPhoto = useMemo(() => {
    if (effectiveAssessorId !== "all") {
       return currentData?.[0]?.foto_url || rankingProfile?.fotoUrl;
    }
    if (selectedTeam !== "all") {
       return filtersData?.teamLogoMap?.get(selectedTeam);
    }
    return null;
  }, [effectiveAssessorId, selectedTeam, currentData, rankingProfile, filtersData]);

  return (
    <PageLayout className={cn(
      "bg-[#0A0D14] text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500 min-h-screen",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1500px] mx-auto space-y-6 sm:space-y-8 relative z-10">
        
        {/* TOP BAR / TITLE */}
        <div className="relative flex flex-col md:flex-row items-center justify-between w-full mb-4 sm:mb-8 px-2 gap-4">
          {/* LEFT: BACK BUTTONS */}
          <div className="flex items-center gap-4 w-full md:w-auto left-2 sm:left-0 top-1 sm:top-0 md:flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dash")}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group hidden sm:flex items-center gap-2 h-8"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-data uppercase tracking-wider">Voltar</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dash")}
              className="sm:hidden glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold rounded-full w-8 h-8 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* CENTER: TITLE (Absolute on Desktop) */}
          <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center justify-center">
            <h1 className="text-base sm:text-lg font-data text-euro-gold tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-80 text-center">
              Meu Cockpit
            </h1>
          </div>
          
          {/* RIGHT: FILTERS & TOOLS */}
          <div className="flex items-center gap-3 md:flex-1 md:justify-end">
             <DashboardFilters 
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
                selectedAssessorId={effectiveAssessorId}
                setSelectedAssessorId={setSelectedAssessorCode}
                filtersData={filtersData}
                filteredMonths={filteredMonths}
                userRole={userRole}
             />

            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group h-8 hidden sm:flex"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* PROFILE & RANKING */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 bg-gradient-to-br from-white/[0.05] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center justify-center text-center shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50" />
            <div className="relative w-28 h-28 rounded-full border-4 border-white/10 mb-4 overflow-hidden bg-euro-inset">
              {assessorPhoto ? (
                <img src={assessorPhoto} alt={assessorName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-display text-white/50 bg-black/30">
                  {assessorName && assessorName.charAt(0)}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-display text-white relative z-10 uppercase tracking-wide">{assessorName}</h2>
            {effectiveAssessorId !== "all" && (
              <p className="text-sm font-data text-blue-400 font-bold uppercase tracking-widest mt-1 relative z-10">{effectiveAssessorId}</p>
            )}
          </div>

          <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-[#10141D] to-[#0A0D14] backdrop-blur-xl border border-euro-gold/30 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(250,192,23,0.1)] flex items-center justify-between">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Trophy className="w-48 h-48 text-euro-gold" />
            </div>
            <div className="flex-1 space-y-4 relative z-10 w-full">
              <h3 className="text-xs font-data text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Medal className="w-4 h-4 text-euro-gold" /> Super Ranking • {selectedYear}
              </h3>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-6 sm:gap-12 border-t border-white/5 pt-6 w-full">
                {rankingProfile ? (
                  <>
                     <div className="flex flex-col">
                       <span className="text-[10px] text-white/40 font-data uppercase tracking-widest mb-1">Posição</span>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl sm:text-5xl font-display text-euro-gold font-bold drop-shadow-md">
                            #{rankingProfile.position}
                          </span>
                          <span className="text-[10px] text-white/40 font-data uppercase">/ {rankingProfile.totalAssessors}</span>
                       </div>
                     </div>
                     
                     <div className="flex flex-col border-l border-white/5 pl-6 sm:border-l-0 sm:pl-0">
                       <span className="text-[10px] text-white/40 font-data uppercase tracking-widest mb-1">Pontuação</span>
                       <span className="text-2xl sm:text-3xl font-display text-white border-b-2 border-euro-gold/50 pb-1 w-fit">
                         {rankingProfile.points.toLocaleString('pt-BR')} 
                       </span>
                       <span className="text-[10px] font-data text-white/40 uppercase tracking-wider mt-1 block">Pts Acumulados</span>
                     </div>
                  </>
                ) : (
                  <div className="text-white/40 italic text-sm">Calculando dados de ranking...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DISPLAY MODES TABS */}
        <div className="flex justify-center mt-6">
           <div className="flex bg-[#1A2030]/50 p-1 rounded-xl border border-white/10 shadow-lg">
             <button
               onClick={() => setDisplayMode('meta')}
               className={cn(
                 "px-6 py-2 rounded-lg text-xs font-data transition-all uppercase tracking-wider font-bold",
                 displayMode === 'meta' ? "bg-euro-gold text-black shadow-md" : "text-white/50 hover:text-white"
               )}
             >
               Meta Original
             </button>
             <button
               onClick={() => setDisplayMode('proportional')}
               className={cn(
                 "px-6 py-2 rounded-lg text-xs font-data transition-all uppercase tracking-wider font-bold inline-flex items-center gap-2",
                 displayMode === 'proportional' ? "bg-euro-gold text-black shadow-md" : "text-white/50 hover:text-white"
               )}
             >
               Pace <span title="Ajusta a meta para hoje"><HelpCircle className="w-3 h-3 opacity-50" /></span>
             </button>
             <button
               onClick={() => setDisplayMode('pace')}
               className={cn(
                 "px-6 py-2 rounded-lg text-xs font-data transition-all uppercase tracking-wider font-bold inline-flex items-center gap-2",
                 displayMode === 'pace' ? "bg-euro-gold text-black shadow-md" : "text-white/50 hover:text-white"
               )}
             >
               Projeção <span title="Calcula o fechamento"><HelpCircle className="w-3 h-3 opacity-50" /></span>
             </button>
           </div>
        </div>

        {/* PERFORMANCE & REVENUE CARDS (Row 1) */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            
            {/* Global */}
            <Card className="lg:col-span-4 bg-gradient-to-b from-[#151923] to-[#0A0D14] border-euro-gold/20 shadow-xl overflow-hidden flex flex-col justify-center items-center py-10 relative group">
               <div className="absolute inset-0 bg-euro-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
               <div className="relative z-10 text-center mb-8">
                 <h3 className="text-xl font-display text-euro-gold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                   Performance Global
                 </h3>
               </div>
               <div className="relative w-56 h-56 flex items-center justify-center mb-6">
                 <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl">
                   <circle cx="112" cy="112" r="100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
                   <motion.circle
                     cx="112" cy="112" r="100" fill="none"
                     stroke={kpis.global.percent >= 100 ? "#22C55E" : kpis.global.percent >= 70 ? "#FAC017" : "#EF4444"}
                     strokeWidth="14" strokeDasharray={2 * Math.PI * 100}
                     initial={{ strokeDashoffset: 2 * Math.PI * 100 }}
                     animate={{ strokeDashoffset: 2 * Math.PI * 100 * (1 - Math.min(kpis.global.percent, 100) / 100) }}
                     transition={{ duration: 1.5, ease: "easeOut" }}
                     strokeLinecap="round"
                   />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className={cn("text-6xl font-display font-bold", getStatusColor(kpis.global.percent))}>
                     {kpis.global.percent.toFixed(0)}<span className="text-3xl">%</span>
                   </span>
                 </div>
               </div>
               <div className="grid grid-cols-3 w-full px-6 gap-2 border-t border-white/5 pt-6 mt-2 relative z-10">
                 <div className="text-center">
                    <p className="text-[10px] text-white/40 font-data uppercase tracking-widest mb-1">Meta</p>
                    <p className="text-sm font-display text-euro-gold truncate">{formatCurrency(kpis.global.target)}</p>
                 </div>
                 <div className="text-center border-l border-white/10">
                    <p className="text-[10px] text-white/40 font-data uppercase tracking-widest mb-1">Realizado</p>
                    <p className="text-sm font-display text-white truncate">{formatCurrency(kpis.global.realized)}</p>
                 </div>
                 <div className="text-center border-l border-white/10">
                    <p className="text-[10px] text-white/40 font-data uppercase tracking-widest mb-1">Gap</p>
                    <p className={cn("text-sm font-display truncate", kpis.global.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {kpis.global.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.global.gap))}
                    </p>
                 </div>
               </div>
            </Card>

            {/* INVEST & CS */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* INVEST */}
               <Card className="bg-[#151923]/80 border-white/5 overflow-hidden flex flex-col shadow-xl">
                 <CardContent className="p-6 sm:p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-data text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" /> Investimentos
                        </h3>
                      </div>
                      <span className={cn("text-4xl font-display", getStatusColor(kpis.invest.percent))}>
                        {kpis.invest.percent.toFixed(0)}%
                      </span>
                    </div>

                    <div className="w-full bg-white/5 h-3 rounded-full mb-8 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(kpis.invest.percent, 100)}%` }}
                        transition={{ duration: 1 }}
                        className={cn("h-full rounded-full", getProgressBarColor(kpis.invest.percent))}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Meta</span>
                        <p className="text-sm sm:text-base font-display text-euro-gold">{formatCurrency(kpis.invest.target)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Realizado</span>
                        <p className="text-sm sm:text-base font-display text-white">{formatCurrency(kpis.invest.realized)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Gap</span>
                        <p className={cn("text-sm sm:text-base font-display", kpis.invest.gap > 0 ? "text-red-400" : "text-green-400")}>
                          {kpis.invest.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.invest.gap))}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 mt-auto pt-4 border-t border-white/5">
                      <div className="grid grid-cols-4 gap-2 text-[10px] text-white/40 font-data uppercase tracking-wider mb-3">
                        <div className="col-span-1">Produto</div><div className="text-right">Meta</div><div className="text-right">Real.</div><div className="text-right">Gap</div>
                      </div>
                      <div className="space-y-1">
                        {kpis.invest.products.slice().sort((a: any, b: any) => b.target - a.target).map((p: any, i: number) => (
                          <div key={i} className="grid grid-cols-4 gap-2 text-[11px] font-data py-1.5 hover:bg-white/5 rounded px-2 transition-colors">
                            <div className="text-white truncate col-span-1">{p.label}</div>
                            <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                            <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                            <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                               {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                 </CardContent>
               </Card>

               {/* CROSS-SELL */}
               <Card className="bg-[#151923]/80 border-white/5 overflow-hidden flex flex-col shadow-xl">
                 <CardContent className="p-6 sm:p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-data text-purple-400 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Briefcase className="w-5 h-5" /> Cross-sell
                        </h3>
                      </div>
                      <span className={cn("text-4xl font-display", getStatusColor(kpis.cs.percent))}>
                        {kpis.cs.percent.toFixed(0)}%
                      </span>
                    </div>

                    <div className="w-full bg-white/5 h-3 rounded-full mb-8 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(kpis.cs.percent, 100)}%` }}
                        transition={{ duration: 1 }}
                        className={cn("h-full rounded-full", getProgressBarColor(kpis.cs.percent))}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Meta</span>
                        <p className="text-sm sm:text-base font-display text-euro-gold">{formatCurrency(kpis.cs.target)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Realizado</span>
                        <p className="text-sm sm:text-base font-display text-white">{formatCurrency(kpis.cs.realized)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 font-data uppercase">Gap</span>
                        <p className={cn("text-sm sm:text-base font-display", kpis.cs.gap > 0 ? "text-red-400" : "text-green-400")}>
                          {kpis.cs.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.cs.gap))}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 mt-auto pt-4 border-t border-white/5">
                      <div className="grid grid-cols-4 gap-2 text-[10px] text-white/40 font-data uppercase tracking-wider mb-3">
                        <div className="col-span-1">Produto</div><div className="text-right">Meta</div><div className="text-right">Real.</div><div className="text-right">Gap</div>
                      </div>
                      <div className="space-y-1">
                        {kpis.cs.products.slice().sort((a: any, b: any) => b.target - a.target).map((p: any, i: number) => (
                          <div key={i} className="grid grid-cols-4 gap-2 text-[11px] font-data py-1.5 hover:bg-white/5 rounded px-2 transition-colors">
                            <div className="text-white truncate col-span-1">{p.label}</div>
                            <div className="text-right text-white/60">{formatCurrency(p.target)}</div>
                            <div className="text-right text-white">{formatCurrency(p.realized)}</div>
                            <div className={cn("text-right", p.gap > 0 ? "text-red-400" : "text-green-400")}>
                               {p.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(p.gap))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                 </CardContent>
               </Card>
            </div>
          </div>
        )}

        {/* REVENUE ROW 2 - CAPTAÇÃO ONLY */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card className="col-span-1 lg:col-span-3 bg-gradient-to-tr from-[#0F172A] to-[#151923] border border-[#22C55E]/30 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-[#22C55E]/10 via-transparent to-transparent opacity-50" />
              <CardContent className="p-8 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 w-full">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center border border-[#22C55E]/20 text-[#22C55E] flex-shrink-0">
                    <Wallet className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display text-white uppercase tracking-wider mb-2">Captação Líquida</h3>
                    <p className="text-sm font-data text-white/40 uppercase tracking-widest">Acompanhamento do Net Mensal</p>
                  </div>
                </div>

                <div className="w-full lg:flex-1 max-w-2xl px-0 lg:px-8">
                   <div className="flex justify-between text-sm mb-4 font-data uppercase tracking-wider">
                     <span className="text-[#22C55E] font-bold">Atingimento</span>
                     <span className={cn("font-bold", getStatusColor(kpis.funding.percent))}>{kpis.funding.percent.toFixed(1)}%</span>
                   </div>
                   <div className="w-full bg-black/40 h-4 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(kpis.funding.percent, 100)}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full relative", getProgressBarColor(kpis.funding.percent))}
                      >
                         <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] -skew-x-12" />
                      </motion.div>
                   </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-12 w-full lg:w-auto">
                    <div>
                      <span className="text-xs text-white/40 font-data uppercase mb-1 block tracking-wider">Objetivo</span>
                      <p className="text-xl font-display text-white">{formatCurrency(kpis.funding.target)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-white/40 font-data uppercase mb-1 block tracking-wider">Realizado</span>
                      <p className="text-xl font-display text-[#22C55E]">{formatCurrency(kpis.funding.realized)}</p>
                    </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* EVOLUTION CHART */}
        {chartData.length > 0 && (
          <Card className="mt-6 bg-[#10141D]/90 backdrop-blur-xl border-euro-gold/20 shadow-2xl">
             <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
               <h3 className="text-lg font-data text-euro-gold uppercase tracking-widest flex items-center gap-2">
                 <TrendingUp className="w-5 h-5" /> Evolução da Receita Total
               </h3>
             </div>
             <CardContent className="p-6 md:p-8">
               <div className="h-[350px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 10, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#FAC017" stopOpacity={0.8}/>
                         <stop offset="95%" stopColor="#FAC017" stopOpacity={0.1}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                     <XAxis 
                       dataKey="monthName" 
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }}
                       tickFormatter={(val) => typeof val === 'string' ? val.toUpperCase() : val}
                       dy={10}
                     />
                     <YAxis 
                       yAxisId="left"
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }}
                       tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                       dx={-10}
                     />
                     <RechartsTooltip content={<CustomChartTooltip />} />
                     
                     <Bar yAxisId="left" dataKey="realized" name="Realizado" radius={[4, 4, 0, 0]} barSize={32}>
                        {chartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill="url(#colorRealized)" />
                         ))}
                     </Bar>
                     
                     <Line 
                       yAxisId="left"
                       type="monotone" 
                       dataKey="target" 
                       name="Meta"
                       stroke="#ffffff" 
                       strokeWidth={2}
                       strokeDasharray="5 5"
                       dot={{ r: 4, fill: "#ffffff", strokeWidth: 0 }}
                       activeDot={{ r: 6, fill: "#FAC017", strokeWidth: 0 }}
                     />
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
             </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
