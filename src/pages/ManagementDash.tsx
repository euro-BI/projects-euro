
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { parseISO } from "date-fns";
import { 
  ArrowLeft,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  Settings
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

// Dashboard Components
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import CockpitDash from "@/components/dashboard/CockpitDash";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";

export default function ManagementDash() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedAssessorId, setSelectedAssessorId] = useState<string>("all");
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("cockpit");
  
  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();

  // Toggle maximization and handle ESC key
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
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Fetch unique months, teams, and assessors for filters
  const { data: filtersData, isLoading: isFiltersLoading } = useQuery({
    queryKey: ["dash-filters-mgmt"],
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
      const latestDate = data?.[0]?.data_posicao;
      const latestRows = latestDate ? data.filter((d: any) => d.data_posicao === latestDate) : [];
      latestRows.forEach((d: any) => {
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
    if (filteredMonths.length > 0 && !filteredMonths.includes(selectedMonth)) {
      setSelectedMonth(filteredMonths[0]);
    }
  }, [filteredMonths, selectedYear, selectedMonth]);

  // Fetch dashboard data
  const { data: dashData, isLoading: isDashLoading } = useQuery({
    queryKey: ["dash-mgmt-data", selectedMonth, selectedTeam, selectedAssessorId],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time) || []);

      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);
      
      if (selectedTeam !== "all") query = query.eq("time", selectedTeam);
      else query = query.in("time", Array.from(activeTeamNames));

      if (selectedAssessorId !== "all") query = query.eq("cod_assessor", selectedAssessorId);

      const { data, error } = await query;
      if (error) throw error;
      return data as AssessorResumo[];
    }
  });

  const { data: yearlyData } = useQuery({
    queryKey: ["dash-mgmt-yearly", selectedYear, selectedTeam, selectedAssessorId],
    enabled: !!selectedYear,
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      let query = supabase
        .from("mv_resumo_assessor" as any)
        .select("*")
        .gte("data_posicao", startDate)
        .lte("data_posicao", endDate);
      
      if (selectedTeam !== "all") query = query.eq("time", selectedTeam);
      if (selectedAssessorId !== "all") query = query.eq("cod_assessor", selectedAssessorId);

      const { data, error } = await query.order("data_posicao", { ascending: true });
      if (error) throw error;
      return data as AssessorResumo[];
    }
  });

  const isLoading = isFiltersLoading || isDashLoading;

  return (
    <PageLayout className={cn(
      "bg-transparent text-[#E8E8E0] font-ui px-4 sm:px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative transition-all duration-500",
      isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"
    )}>
      <LoadingOverlay isLoading={isLoading} />
      <ImpactfulBackground opacity={0.3} />

      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-12 relative z-10">
        <div className="relative flex items-center justify-center w-full mb-4 sm:mb-8 px-2 min-h-[32px]">
          {/* Back Action */}
          <div className="absolute left-2 sm:left-0 top-1 sm:top-0 z-50 sm:z-10">
            {/* Desktop Button */}
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

            {/* Mobile icon button (smaller, discrete) */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dash")}
              className="sm:hidden glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold rounded-full w-8 h-8 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
          
          <h1 className="text-base sm:text-xl font-data text-euro-gold tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-80 text-center">
            Análise Gerencial
          </h1>
          
          <div className="absolute right-2 sm:right-0 top-0 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMaximize}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 group h-8 hidden sm:flex"
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-12">
          <div className="sticky top-4 z-50 mx-auto w-full sm:max-w-fit px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2 p-2 sm:p-1.5 rounded-2xl sm:rounded-full bg-[#0F1218]/90 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300">
              <TabsList className="bg-transparent border-none h-9 p-0 gap-1 mx-2 w-full sm:w-auto flex justify-start sm:justify-center overflow-x-auto flex-nowrap scrollbar-hide">
                <TabsTrigger 
                  value="cockpit" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#A0A090] hover:text-white transition-all whitespace-nowrap"
                >
                  Cockpit
                </TabsTrigger>
                <TabsTrigger 
                  value="em-breve" 
                  disabled
                  className="rounded-full px-4 h-full text-[10px] font-data uppercase tracking-widest text-[#5C5C50] flex-1 sm:flex-initial"
                >
                  Novas Abas +
                </TabsTrigger>
              </TabsList>

              <div className="hidden sm:block w-px h-4 bg-white/10 mx-1" />

              <div className="w-full sm:w-auto flex justify-center">
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
                  userRole={userRole}
                />
              </div>
            </div>
          </div>

          <TabsContent value="cockpit" className="space-y-12 mt-0 border-none p-0 outline-none">
            <CockpitDash
              currentData={dashData || []}
              yearlyData={yearlyData || []}
              selectedYear={selectedYear}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
