
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play, Pause, RotateCcw, Search, User, ChevronsUpDown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

interface RankingRaceProps {
  selectedYear: string;
}

export default function RankingRace({ selectedYear }: RankingRaceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedAssessorId, setSelectedAssessorId] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Fetch ALL historical data for the race
  const { data: allHistory, isLoading } = useQuery({
    queryKey: ["dash-ranking-race-v3"],
    queryFn: async () => {
      // Fetch active teams first
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      
      const activeTeamNames = new Set(activeTeamsData?.map(t => t.time).filter(t => !BLOCKED_TEAMS.includes(t)) || []);

      const { data, error } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, foto_url, pontos_totais_acumulado, data_posicao, time")
        .order("data_posicao", { ascending: true })
        .not("cod_assessor", "in", `(${BLOCKED_ASSESSORS.map(a => `"${a}"`).join(',')})`);
      
      if (error) throw error;
      
      // Filter by active teams and ensure name exists and is valid
      return (data as any[]).filter(d => 
        d.nome_assessor && 
        d.nome_assessor.trim().length > 0 &&
        d.nome_assessor.toLowerCase() !== "null" &&
        d.nome_assessor.toLowerCase() !== "undefined" &&
        d.time && 
        activeTeamNames.has(d.time)
      ) as Pick<AssessorResumo, "cod_assessor" | "nome_assessor" | "foto_url" | "pontos_totais_acumulado" | "data_posicao" | "time">[];
    }
  });

  // Extract unique assessors for the filter
  const uniqueAssessors = useMemo(() => {
    if (!allHistory) return [];
    const map = new Map();
    allHistory.forEach(d => {
      if (!map.has(d.cod_assessor) && d.nome_assessor && d.nome_assessor.trim() !== "") {
        map.set(d.cod_assessor, {
          cod_assessor: d.cod_assessor,
          nome_assessor: d.nome_assessor.trim(),
          foto_url: d.foto_url
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const nameA = String(a.nome_assessor || "");
      const nameB = String(b.nome_assessor || "");
      return nameA.localeCompare(nameB);
    });
  }, [allHistory]);

  // Group data by month and calculate ranks, filtered by year
  const processedData = useMemo(() => {
    if (!allHistory) return [];

    const grouped = allHistory
      .filter(d => 
         d.data_posicao && 
         parseISO(d.data_posicao).getFullYear().toString() === selectedYear &&
         d.nome_assessor &&
         d.nome_assessor.trim().length > 0 &&
         d.nome_assessor.toLowerCase() !== "null" &&
         d.nome_assessor.toLowerCase() !== "undefined"
       )
      .reduce((acc, curr) => {
        const month = curr.data_posicao;
        if (!acc[month]) acc[month] = [];
        acc[month].push(curr);
        return acc;
      }, {} as Record<string, typeof allHistory>);

    const months = Object.keys(grouped).sort();
    
    return months.map(month => {
      const allAssessorsInMonth = grouped[month]
        .sort((a, b) => b.pontos_totais_acumulado - a.pontos_totais_acumulado)
        .map((a, index) => ({
          ...a,
          rank: index
        }));

      // Determine which assessors to show
      // Show ALL assessors, not just top 10
      let visibleAssessors = allAssessorsInMonth;

      // If an assessor is selected, we want to make sure they are highlighted (logic handled in render)
      // but since we are showing everyone, we don't need to force add them to the list
      
      return {
        month,
        assessors: visibleAssessors,
        totalParticipants: allAssessorsInMonth.length,
        maxPoints: Math.max(...allAssessorsInMonth.map(a => a.pontos_totais_acumulado))
      };
    });
  }, [allHistory, selectedYear, selectedAssessorId]);

  // Reset step when year changes
  useEffect(() => {
    setCurrentStep(0);
  }, [selectedYear]);

  // Animation Loop
  useEffect(() => {
    let interval: any;
    if (isPlaying && processedData.length > 0) {
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % processedData.length);
      }, 5000); // 5 seconds per month
    }
    return () => clearInterval(interval);
  }, [isPlaying, processedData.length]);

  if (isLoading || !processedData.length) {
    return (
      <div className="w-full min-h-[400px] flex flex-col p-6 space-y-6">
        <div className="flex justify-between items-end border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-[10px] font-data text-euro-gold/60 uppercase tracking-[0.2em]">
              Evolução Histórica do Ranking
            </h3>
            <div className="h-8 w-32 bg-white/5 animate-pulse rounded" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-data text-euro-gold/40 animate-pulse uppercase tracking-widest">
            {isLoading ? "Preparando a Corrida..." : "Nenhum dado para este ano"}
          </span>
        </div>
      </div>
    );
  }

  const currentStepSafe = Math.min(currentStep, processedData.length - 1);
  const currentData = processedData[currentStepSafe];
  
  if (!currentData) return null;
  
  const maxPoints = currentData.maxPoints;

  return (
    <div className="w-full flex flex-col p-0 space-y-6 relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-euro-gold/5 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-4 gap-4 relative z-10">
        <div className="space-y-1">
          <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
            <Zap className="w-4 h-4 fill-euro-gold/20" />
            Evolução Dinâmica do Ranking
          </h3>
          <p className="text-xs font-data text-white/40 uppercase tracking-widest">
            Corrida histórica de performance - {format(parseISO(currentData.month), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Assessor Filter */}
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className={cn(
                            "w-[250px] justify-between bg-euro-elevated border-white/10 text-[#E8E8E0] font-data hover:bg-euro-elevated/80",
                            selectedAssessorId && "border-euro-gold/50 text-euro-gold bg-euro-gold/5"
                        )}
                    >
                        <div className="flex items-center truncate">
                            <User className={cn("w-3 h-3 mr-2", selectedAssessorId ? "text-euro-gold" : "text-euro-gold/60")} />
                            <span className="truncate">
                                {selectedAssessorId
                                    ? uniqueAssessors.find((a) => a.cod_assessor === selectedAssessorId)?.nome_assessor
                                    : "Buscar Assessor..."}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 bg-euro-elevated border-white/10 text-[#E8E8E0]">
                    <Command className="bg-euro-elevated text-[#E8E8E0]">
                        <CommandInput placeholder="Buscar assessor..." className="h-9 font-data" />
                        <CommandList>
                            <CommandEmpty className="py-2 text-center text-xs font-data text-[#5C5C50]">
                                Nenhum assessor encontrado.
                            </CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                <CommandItem
                                    value="all"
                                    onSelect={() => {
                                        setSelectedAssessorId(null);
                                        setOpenCombobox(false);
                                    }}
                                    className="font-data text-xs cursor-pointer aria-selected:bg-white/10"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            !selectedAssessorId ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    Todos os Assessores
                                </CommandItem>
                                {uniqueAssessors.map((assessor) => (
                                    <CommandItem
                                        key={assessor.cod_assessor}
                                        value={assessor.nome_assessor || "Sem Nome"}
                                        onSelect={() => {
                                            setSelectedAssessorId(assessor.cod_assessor === selectedAssessorId ? null : assessor.cod_assessor);
                                            setOpenCombobox(false);
                                        }}
                                        className="font-data text-xs cursor-pointer aria-selected:bg-white/10"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedAssessorId === assessor.cod_assessor ? "opacity-100 text-euro-gold" : "opacity-0"
                                            )}
                                        />
                                        {assessor.nome_assessor || "Sem Nome"}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-[#A0A090] hover:text-euro-gold hover:bg-white/5 rounded-full"
            onClick={() => setCurrentStep(0)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
                "h-9 w-9 rounded-full transition-all duration-300",
                isPlaying ? "bg-euro-gold/10 text-euro-gold hover:bg-euro-gold/20" : "text-[#A0A090] hover:text-white hover:bg-white/5"
            )}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </Button>
        </div>
      </div>

      {/* Race Area - No internal scroll, dynamic height */}
      <div className="relative mt-4 perspective-[1000px] pr-2">
        <div style={{ height: currentData.assessors.length * 52 }}>
        <AnimatePresence mode="popLayout">
          {currentData.assessors.map((assessor, index) => {
            const isSelected = selectedAssessorId === assessor.cod_assessor;
            const isOthers = selectedAssessorId && !isSelected;
            
            // Calculate width based on max points
            const widthPercentage = (assessor.pontos_totais_acumulado / (maxPoints || 1)) * 100;
            
            // Calculate Y position:
            // If filtering and this is the selected one, maybe center it? 
            // For now, let's just stick to rank-based positioning but handle the case where rank > 10
            // If it's the selected assessor and they are outside top 10, we'll place them at the bottom with a separator
            let yPos = index * 52; // 52px height per row
            
            // Highlight Top 3 with special spacing/positioning if needed, but for now simple list is cleaner
            // We can add a podium effect later if requested, but user asked for list with top 3 focus

            return (
              <motion.div
                key={assessor.cod_assessor}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ 
                  opacity: isOthers ? 0.3 : 1, 
                  x: 0,
                  y: yPos,
                  scale: isSelected ? 1.02 : 1,
                  zIndex: isSelected ? 50 : 10 - index
                }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 80, 
                  damping: 20,
                  mass: 1
                }}
                className={cn(
                    "absolute left-0 w-full flex items-center gap-4 group",
                    isSelected && "z-50"
                )}
                style={{ height: 44 }}
              >
                {/* Rank Indicator */}
                <div className="w-8 flex justify-center shrink-0">
                    <div className={cn(
                        "text-sm font-display w-6 h-6 flex items-center justify-center rounded-full border transition-all duration-300",
                        index === 0 ? "bg-yellow-400 text-black border-yellow-400 scale-125 shadow-[0_0_15px_rgba(250,204,21,0.6)]" : 
                        index === 1 ? "bg-gray-300 text-black border-gray-300 scale-110 shadow-[0_0_10px_rgba(209,213,219,0.5)]" :
                        index === 2 ? "bg-amber-700 text-white border-amber-700 scale-105 shadow-[0_0_10px_rgba(180,83,9,0.5)]" :
                        isSelected ? "bg-euro-gold text-euro-navy border-euro-gold shadow-[0_0_10px_rgba(250,192,23,0.5)]" :
                        "bg-white/5 text-white/40 border-white/10"
                    )}>
                        {assessor.rank + 1}
                    </div>
                </div>

                {/* Photo/Avatar */}
                <div className="relative z-10">
                  <div className={cn(
                    "w-10 h-10 rounded-full bg-[#0A0A0B] border-2 overflow-hidden flex items-center justify-center transition-transform duration-300",
                    index === 0 ? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)] scale-110" : 
                    index === 1 ? "border-gray-300 scale-105" :
                    index === 2 ? "border-amber-700 scale-105" :
                    isSelected ? "border-euro-gold shadow-[0_0_20px_rgba(250,192,23,0.6)] scale-110" :
                    "border-white/10 group-hover:border-white/30"
                  )}>
                    {assessor.foto_url ? (
                      <img src={assessor.foto_url} alt={assessor.nome_assessor || "Assessor"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-data text-white/40">
                        {(assessor.nome_assessor || "A").split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bar & Info Container */}
                <div className="flex-1 relative h-full flex flex-col justify-center">
                    <div className="flex justify-between items-end mb-1 pr-4">
                        <span className={cn(
                            "text-sm font-display truncate transition-colors",
                            isSelected ? "text-euro-gold text-base" : "text-white/80"
                        )}>
                            {assessor.nome_assessor}
                        </span>
                        <span className={cn(
                            "text-xs font-data transition-colors",
                            isSelected ? "text-euro-gold" : "text-white/40"
                        )}>
                            {assessor.pontos_totais_acumulado.toLocaleString()} pts
                        </span>
                    </div>
                    
                    {/* Progress Track */}
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                        {/* Animated Bar */}
                        <motion.div
                            className={cn(
                                "h-full rounded-full relative",
                                index === 0 ? "bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]" :
                                index === 1 ? "bg-gradient-to-r from-gray-500 to-gray-300" :
                                index === 2 ? "bg-gradient-to-r from-amber-800 to-amber-600" :
                                isSelected ? "bg-gradient-to-r from-euro-gold/50 to-euro-gold shadow-[0_0_15px_rgba(250,192,23,0.5)]" :
                                "bg-white/20 group-hover:bg-white/30"
                            )}
                            animate={{ width: `${widthPercentage}%` }}
                            transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        >
                            {/* Shine Effect for Top 3 or Selected */}
                            {(index < 3 || isSelected) && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2 h-full skew-x-12 animate-shimmer" />
                            )}
                        </motion.div>
                    </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
