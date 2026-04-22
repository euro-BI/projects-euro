import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { cn } from "@/lib/utils";
import {
  PhoneCall,
  CalendarDays,
  Target,
  Banknote,
  Users,
  Briefcase
} from "lucide-react";

interface EsforcosDashProps {
  selectedYear: string;
  selectedMonth: string;
  targetAssessors: string[];
}

export default function EsforcosDash({
  selectedYear,
  selectedMonth,
  targetAssessors,
}: EsforcosDashProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["esforcos-data", selectedMonth, targetAssessors],
    enabled: !!selectedMonth,
    queryFn: async () => {
      // Data handling
      const startDate = selectedMonth; // Assuming format is YYYY-MM-DD
      const endDate = format(endOfMonth(parseISO(selectedMonth)), "yyyy-MM-dd");

      // 1. Pipe Estimada (does not respect date filters)
      let q1 = supabase
        .from("vw_esforcos")
        .select("valor_lead")
        .in("tipo_pipe", ["Reunião de Diagnóstico (R1)", "Reunião de Proposta (R2)"])
        .eq("status_lead", "open");
      if (targetAssessors.length > 0) q1 = q1.in("cod_assessor", targetAssessors);

      // 2. Pipe Convertido (filters by ganho_em)
      let q2 = supabase
        .from("vw_esforcos")
        .select("valor_lead")
        .in("stage", ["EM NEGOCIAÇÃO", "REUNIÃO DE DIAGNÓSTICO (R1)", "REUNIÃO DE PROPOSTA (R2)"])
        .eq("status_lead", "won")
        .gte("ganho_em", startDate)
        .lte("ganho_em", endDate);
      if (targetAssessors.length > 0) q2 = q2.in("cod_assessor", targetAssessors);

      // 3. Ligações Prospect (filters by add_time)
      let q3 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .eq("tipo", "LIGAÇÃO DE PROSPECÇÃO")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q3 = q3.in("cod_assessor", targetAssessors);

      // 4. Reuniões Prospect (filters by update_time)
      let q4 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .in("tipo_pipe", ["Reunião de Diagnóstico (R1)", "Reunião de Proposta (R2)"])
        .gte("update_time", startDate)
        .lte("update_time", endDate);
      if (targetAssessors.length > 0) q4 = q4.in("cod_assessor", targetAssessors);

      // 5. Pontos Relacionamento (filters by add_time)
      let q5 = supabase
        .from("vw_esforcos")
        .select("pipe_pontos")
        .eq("tipo", "RELACIONAMENTO")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q5 = q5.in("cod_assessor", targetAssessors);

      // 6. Reuniões Cross-sell (filters by add_time)
      let q6 = supabase
        .from("vw_esforcos")
        .select("id_atividade", { count: "exact", head: true })
        .eq("tipo", "REUNIÃO CROSS-SELL")
        .gte("add_time", startDate)
        .lte("add_time", endDate);
      if (targetAssessors.length > 0) q6 = q6.in("cod_assessor", targetAssessors);

      const [res1, res2, res3, res4, res5, res6] = await Promise.all([q1, q2, q3, q4, q5, q6]);

      // Calculate sums
      const pipeEstimada = res1.data?.reduce((acc, curr) => acc + (Number(curr.valor_lead) || 0), 0) || 0;
      const pipeConvertido = res2.data?.reduce((acc, curr) => acc + (Number(curr.valor_lead) || 0), 0) || 0;
      const ligacoesProspect = res3.count || 0;
      const reunioesProspect = res4.count || 0;
      const pontosRelacionamento = res5.data?.reduce((acc, curr) => acc + (Number(curr.pipe_pontos) || 0), 0) || 0;
      const reunioesCrossSell = res6.count || 0;

      return {
        pipeEstimada,
        pipeConvertido,
        ligacoesProspect,
        reunioesProspect,
        pontosRelacionamento,
        reunioesCrossSell,
      };
    },
  });

  const formatCurrencyValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return (val / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mi";
    } else {
      return (val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-[400px]">
        <LoadingOverlay isLoading={true} />
      </div>
    );
  }

  const metrics = data || {
    pipeEstimada: 0,
    pipeConvertido: 0,
    ligacoesProspect: 0,
    reunioesProspect: 0,
    pontosRelacionamento: 0,
    reunioesCrossSell: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Pipe Estimada */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Pipe Estimada
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                R$ {formatCurrencyValue(metrics.pipeEstimada)}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Geral - Não filtrado por data</span>
            </div>
          </CardContent>
        </Card>

        {/* Pipe Convertido */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Pipe Convertido
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                R$ {formatCurrencyValue(metrics.pipeConvertido)}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Convertidos no período</span>
            </div>
          </CardContent>
        </Card>

        {/* Ligações Prospect */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-euro-gold opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Ligações Prospect
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-euro-gold/10 flex items-center justify-center">
              <PhoneCall className="w-4 h-4 text-euro-gold" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                {metrics.ligacoesProspect.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Total de ligações</span>
            </div>
          </CardContent>
        </Card>

        {/* Reuniões Prospect */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Reuniões Prospect
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                {metrics.reunioesProspect.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Diagnóstico (R1) e Proposta (R2)</span>
            </div>
          </CardContent>
        </Card>

        {/* Pontos Relacionamento */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Pontos Relacionamento
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                {metrics.pontosRelacionamento.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Total de pontos</span>
            </div>
          </CardContent>
        </Card>

        {/* Reuniões Cross-sell */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-50" />
          <CardHeader className="pb-2 pt-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-data text-white uppercase tracking-wider">
              Reuniões Cross-sell
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span className="text-3xl font-display text-[#F5F5F0]">
                {metrics.reunioesCrossSell.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-ui text-white/50 mt-1">Total no período</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
