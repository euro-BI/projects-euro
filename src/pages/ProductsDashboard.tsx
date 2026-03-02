import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Maximize2,
  Minimize2,
  Construction,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

export default function ProductsDashboard() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedAssessorId, setSelectedAssessorId] = useState<string>("all");
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("geral");

  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();

  // Determine effective assessor ID based on role and active tab
  const effectiveAssessorId = useMemo(() => {
    if (userRole === "user" && userCode) {
      // Products Dashboard doesn't have a Ranking tab yet, but applying same logic for consistency
      if (activeTab === "ranking") {
        return selectedAssessorId;
      }
      return userCode;
    }
    return selectedAssessorId;
  }, [userRole, userCode, activeTab, selectedAssessorId]);

  const effectiveTeam = selectedTeam;

  // Apply user filter if role is user
  React.useEffect(() => {
    if (userRole === "user" && userCode) {
       if (activeTab !== "ranking") {
          setSelectedAssessorId(userCode);
       } else {
          setSelectedAssessorId("all");
          setSelectedTeam("all");
       }
    }
  }, [userRole, userCode, activeTab]);

  // Toggle maximization and handle ESC key
  const toggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsMaximized(true);
        (window as any).isDashMaximized = true;
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsMaximized(false);
          (window as any).isDashMaximized = false;
        }
      }
    } catch (err) {
      console.error(`Error attempting to toggle full-screen mode: ${err}`);
      const nextState = !isMaximized;
      setIsMaximized(nextState);
      (window as any).isDashMaximized = nextState;
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsMaximized(isFull);
      (window as any).isDashMaximized = isFull;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMaximized) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  // Fetch unique months, teams, and assessors for filters (SAME AS PERFORMANCEDASH)
  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-filters"],
    queryFn: async () => {
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      const { data, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, time, cod_assessor, nome_assessor")
        .order("data_posicao", { ascending: false });
      
      if (error) throw error;
      
      const allMonths = Array.from(new Set(data.map((d: any) => d.data_posicao)));
      const years = Array.from(new Set(allMonths.map(m => parseISO(m).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));
      
      const teams = Array.from(new Set(data.map((d: any) => d.time)))
        .filter(teamName => teamName && activeTeamNames.has(teamName));
      
      const assessorMap = new Map<string, { name: string, teams: Set<string> }>();
      data.forEach((d: any) => {
        if (d.cod_assessor && d.nome_assessor) {
          if (!assessorMap.has(d.cod_assessor)) {
            assessorMap.set(d.cod_assessor, { name: d.nome_assessor, teams: new Set() });
          }
          if (d.time && activeTeamNames.has(d.time)) {
            assessorMap.get(d.cod_assessor)?.teams.add(d.time);
          }
        }
      });
      const assessors = Array.from(assessorMap.entries())
        .map(([id, info]) => ({ id, name: info.name, teams: Array.from(info.teams) }))
        .filter(a => a.teams.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return { allMonths, years, teams, assessors };
    }
  });

  const filteredMonths = useMemo(() => {
    if (!filtersData?.allMonths) return [];
    return filtersData.allMonths.filter(m => parseISO(m).getFullYear().toString() === selectedYear);
  }, [filtersData, selectedYear]);

  React.useEffect(() => {
    if (filteredMonths.length > 0) {
      const isStillValid = filteredMonths.includes(selectedMonth);
      if (!isStillValid) {
        setSelectedMonth(filteredMonths[0]);
      }
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  const tabs = [
    { id: "geral", label: "Geral" },
    { id: "renda-fixa", label: "Renda Fixa" },
    { id: "renda-variavel", label: "Renda Variável" },
    { id: "consorcios", label: "Consórcios" },
    { id: "seguros", label: "Seguros" },
    { id: "posicao-black", label: "Posição Black" },
  ];

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-8" : "pt-24"
    )}>
      <LoadingOverlay isLoading={isFiltersLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-12 relative z-10">
        {/* HEADER */}
        <div className="relative flex items-center justify-center w-full mb-8">
          <div className="absolute left-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dash")}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group flex items-center gap-2"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-data uppercase tracking-wider hidden sm:inline">Voltar</span>
            </Button>
          </div>
          
          <h1 className="text-xl font-data text-euro-gold tracking-[0.4em] uppercase opacity-80">
            Performance Produtos Eurostock
          </h1>
          
          <div className="absolute right-0">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group"
              title={isMaximized ? "Sair da Tela Cheia (Esc)" : "Tela Cheia"}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Sair</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-data uppercase tracking-wider">Maximizar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
          {/* FILTERS & NAVIGATION HEADER */}
          <div className="sticky top-4 z-50 mx-auto max-w-fit">
            <div className="flex flex-row items-center gap-2 p-1.5 rounded-full bg-[#0F1218]/80 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-[#0F1218]/90">
              
              <TabsList className="bg-transparent border-none flex-shrink-0 h-9 p-0 gap-1 mx-2">
                {tabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white hover:bg-white/5 transition-all border-none"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="w-px h-4 bg-white/10 mx-1" />

              <div className="flex items-center flex-shrink-0">
                <DashboardFilters 
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                  selectedAssessorId={selectedAssessorId}
                  setSelectedAssessorId={setSelectedAssessorId}
                  filtersData={filtersData}
                  filteredMonths={filteredMonths}
                  userRole={activeTab === "ranking" ? "admin" : userRole}
                />
              </div>
            </div>
          </div>

          {/* TABS CONTENT */}
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 border-none p-0 outline-none">
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative min-h-[400px] flex items-center justify-center">
                <CardContent className="flex flex-col items-center justify-center space-y-4 p-12">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                    <Construction className="w-10 h-10 text-euro-gold/50" />
                  </div>
                  <h2 className="text-2xl font-display text-white tracking-wide">
                    {tab.label}
                  </h2>
                  <p className="text-[#A0A090] font-light text-lg">
                    EM DESENVOLVIMENTO
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageLayout>
  );
}
