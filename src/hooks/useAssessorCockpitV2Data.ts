import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { readSessionJson, writeSessionJson } from "@/lib/utils";
import {
  BLOCKED_ASSESSORS,
  BLOCKED_TEAMS,
  CockpitV2FiltersData,
  buildKpis,
  buildRankingSummary,
  buildTopMetrics,
} from "@/utils/cockpit-v2-mappers";

type DisplayMode = "meta" | "proportional" | "pace";

export function useAssessorCockpitV2Data() {
  const persistKey = "filters:AssessorCockpit";
  const persisted = readSessionJson<{
    selectedYear?: string;
    selectedMonth?: string;
    displayMode?: DisplayMode;
    referenceDate?: string;
    selectedAssessorCode?: string;
    selectedTeam?: string;
  } | null>(persistKey, null);

  const [selectedYear, setSelectedYear] = useState<string>(() => persisted?.selectedYear ?? new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => persisted?.selectedMonth ?? "");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => persisted?.displayMode ?? "meta");
  const [referenceDate, setReferenceDate] = useState<Date>(() => {
    const date = persisted?.referenceDate ? new Date(persisted.referenceDate) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });
  const [selectedAssessorCode, setSelectedAssessorCode] = useState<string>(() => persisted?.selectedAssessorCode ?? "all");
  const [selectedTeam, setSelectedTeam] = useState<string>(() => persisted?.selectedTeam ?? "all");

  const { userCode, userRole } = useAuth();
  const effectiveAssessorId = selectedAssessorCode;

  useEffect(() => {
    writeSessionJson(persistKey, {
      selectedYear,
      selectedMonth,
      displayMode,
      referenceDate: referenceDate.toISOString(),
      selectedAssessorCode,
      selectedTeam,
    });
  }, [displayMode, persistKey, referenceDate, selectedAssessorCode, selectedMonth, selectedTeam, selectedYear]);

  useEffect(() => {
    if (userRole === "user" && userCode && selectedAssessorCode !== userCode) {
      setSelectedAssessorCode(userCode);
    }
  }, [selectedAssessorCode, userCode, userRole]);

  const { data: leaderTeamData } = useQuery({
    queryKey: ["leader-team-v2", userCode],
    enabled: userRole === "lider" && !!userCode,
    queryFn: async () => {
      const { data } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("time")
        .eq("cod_assessor", userCode)
        .order("data_posicao", { ascending: false })
        .limit(1);
      return data?.[0]?.time || "all";
    },
  });

  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-cockpit-v2-filters-data"],
    queryFn: async (): Promise<CockpitV2FiltersData> => {
      const { data: activeTeamsData } = await supabase.from("dados_times").select("time, foto_url").eq("status", "ATIVO");
      const activeTeamNames = new Set(activeTeamsData?.map((t) => t.time) || []);
      const teamLogoMap = new Map(activeTeamsData?.map((t) => [t.time, t.foto_url]) || []);

      const { data: latestEntry } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false })
        .limit(1)
        .single();

      const latestDate = latestEntry?.data_posicao;
      const { data: latestData, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("time, cod_assessor, nome_assessor")
        .eq("data_posicao", latestDate);

      if (error) throw error;

      const { data: monthData } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao")
        .order("data_posicao", { ascending: false });

      const allMonths = Array.from(new Set(monthData?.map((d: any) => d.data_posicao) || []));
      const years = Array.from(new Set(allMonths.map((m) => parseISO(m).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));

      const teams = Array.from(new Set((latestData || []).map((d: any) => d.time)))
        .filter((teamName) => teamName && activeTeamNames.has(teamName) && !BLOCKED_TEAMS.includes(teamName)) as string[];

      const assessorMap = new Map<string, { name: string; teams: Set<string> }>();
      (latestData || []).forEach((d: any) => {
        if (d.cod_assessor && d.nome_assessor && d.time && activeTeamNames.has(d.time) && !BLOCKED_ASSESSORS.includes(d.cod_assessor)) {
          if (!assessorMap.has(d.cod_assessor)) assessorMap.set(d.cod_assessor, { name: d.nome_assessor, teams: new Set() });
          assessorMap.get(d.cod_assessor)?.teams.add(d.time.toUpperCase());
        }
      });

      let referenceDateISO = null;
      try {
        const { data: refData } = await (supabase.from("vw_tabelas_atualizacao" as any) as any)
          .select("ultima_atualizacao")
          .order("ultima_atualizacao", { ascending: false })
          .limit(1);
        referenceDateISO = refData?.[0]?.ultima_atualizacao || null;
      } catch {
        referenceDateISO = null;
      }

      return {
        allMonths,
        years,
        teams,
        assessors: Array.from(assessorMap.entries())
          .map(([id, info]) => ({ id, name: info.name, teams: Array.from(info.teams) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        teamLogoMap,
        referenceDateISO,
      };
    },
  });

  useEffect(() => {
    const role = userRole?.toLowerCase();
    if (role === "lider" && userCode) {
      const foundTeam = leaderTeamData || filtersData?.assessors.find((a) => a.id.toLowerCase() === userCode.toLowerCase())?.teams?.[0];
      const userTeam = foundTeam?.trim().toUpperCase() || "all";
      if (userTeam !== "ALL" && selectedTeam.toUpperCase() !== userTeam) setSelectedTeam(userTeam);
    }
  }, [filtersData, leaderTeamData, selectedTeam, userCode, userRole]);

  useEffect(() => {
    if (filtersData?.referenceDateISO) setReferenceDate(parseISO(filtersData.referenceDateISO));
  }, [filtersData]);

  const filteredMonths = useMemo(
    () => filtersData?.allMonths.filter((m) => parseISO(m).getFullYear().toString() === selectedYear) || [],
    [filtersData, selectedYear]
  );

  useEffect(() => {
    if (filteredMonths.length > 0 && !filteredMonths.includes(selectedMonth)) setSelectedMonth(filteredMonths[0]);
  }, [filteredMonths, selectedMonth]);

  const { data: currentData, isLoading: isCurrentLoading } = useQuery({
    queryKey: ["dash-cockpit-v2-current", selectedMonth, effectiveAssessorId, selectedTeam],
    enabled: !!selectedMonth,
    queryFn: async () => {
      let query = supabase.from("mv_resumo_assessor" as any).select("*").eq("data_posicao", selectedMonth);
      if (effectiveAssessorId !== "all") query = query.eq("cod_assessor", effectiveAssessorId);
      else if (selectedTeam !== "all") query = query.eq("time", selectedTeam);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    },
  });

  const { data: yearlyData, isLoading: isYearlyLoading } = useQuery({
    queryKey: ["dash-cockpit-v2-yearly", selectedYear, effectiveAssessorId, selectedTeam],
    enabled: !!selectedYear,
    queryFn: async () => {
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", `${selectedYear}-01-01`)
        .lte("data_posicao", `${selectedYear}-12-31`);
      if (effectiveAssessorId !== "all") query = query.eq("cod_assessor", effectiveAssessorId);
      else if (selectedTeam !== "all") query = query.eq("time", selectedTeam);
      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    },
  });

  const { data: rankingData, isLoading: isRankingLoading } = useQuery({
    queryKey: ["dash-cockpit-v2-super-ranking", selectedYear],
    enabled: !!selectedYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", `${selectedYear}-01-01`)
        .lte("data_posicao", `${selectedYear}-12-31`);
      if (error) throw error;
      return data as unknown as AssessorResumo[];
    },
  });

  const rankingSummary = useMemo(() => buildRankingSummary(rankingData, effectiveAssessorId), [effectiveAssessorId, rankingData]);
  const kpis = useMemo(() => buildKpis(currentData, displayMode, referenceDate), [currentData, displayMode, referenceDate]);
  const topMetrics = useMemo(() => buildTopMetrics(currentData), [currentData]);

  const hero = useMemo(() => {
    const firstRow = currentData?.[0];
    const assessorName = firstRow?.nome_assessor || (effectiveAssessorId === "all" ? "Visao Consolidada" : filtersData?.assessors.find((a) => a.id === effectiveAssessorId)?.name || "Assessor");
    const assessorCode = effectiveAssessorId === "all" ? "CONSOLIDADO" : effectiveAssessorId;
    const teamName = selectedTeam !== "all" ? selectedTeam : firstRow?.time || "Todos os Times";
    const photo = firstRow?.foto_url || rankingSummary?.fotoUrl || null;
    const monthLabel = selectedMonth ? format(parseISO(selectedMonth), "MMMM 'de' yyyy", { locale: ptBR }) : "Periodo em aberto";

    return { assessorName, assessorCode, teamName, photo, monthLabel };
  }, [currentData, effectiveAssessorId, filtersData, rankingSummary, selectedMonth, selectedTeam]);

  const tableRows = useMemo(() => {
    return [...(currentData || [])]
      .sort((a, b) => (b.receita_total || 0) - (a.receita_total || 0))
      .map((row) => ({
        code: row.cod_assessor,
        assessor: row.nome_assessor,
        team: row.time,
        netClientes: row.custodia_net || 0,
        metaCaptacao: row.meta_captacao || 0,
        captacaoLiquida: row.captacao_liquida_total || 0,
        metaReceita: row.meta_receita || 0,
        receitaTotal: row.receita_total || 0,
        receitaInvest:
          (row.receita_renda_fixa || 0) + (row.asset_m_1 || 0) + (row.receita_previdencia || 0) + (row.receita_cetipados || 0) +
          (row.receitas_ofertas_fundos || 0) + (row.receitas_ofertas_rf || 0) + (row.receitas_offshore || 0) + (row.receitas_estruturadas || 0) + (row.receita_b3 || 0),
        receitaCs: (row.receita_consorcios || 0) + (row.receita_compromissadas || 0) + (row.receita_cambio || 0) + (row.receita_seguros || 0),
        roaTotal: row.roa || 0,
        ativacao300k: row.ativacao_300k || 0,
        repasseTotal: row.repasse_total || 0,
      }));
  }, [currentData]);

  return {
    userRole,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedTeam,
    setSelectedTeam,
    selectedAssessorCode,
    setSelectedAssessorCode,
    displayMode,
    setDisplayMode,
    filteredMonths,
    filtersData,
    currentData,
    yearlyData,
    rankingSummary,
    kpis,
    topMetrics,
    hero,
    tableRows,
    isLoading: isFiltersLoading || isCurrentLoading || isYearlyLoading || isRankingLoading,
  };
}
