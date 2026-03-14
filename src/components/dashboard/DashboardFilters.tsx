
import React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Check,
  ChevronsUpDown,
  Filter,
  User,
  Users,
  X,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface FilterData {
  allMonths: string[];
  years: string[];
  teams: string[];
  assessors: { id: string; name: string; teams: string[] }[];
}

interface DashboardFiltersProps {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedTeam: string;
  setSelectedTeam: (team: string) => void;
  selectedAssessorId: string;
  setSelectedAssessorId: (id: string) => void;
  filtersData: FilterData | undefined;
  filteredMonths: string[];
  userRole?: string | null;
}

export function DashboardFilters({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedTeam,
  setSelectedTeam,
  selectedAssessorId,
  setSelectedAssessorId,
  filtersData,
  filteredMonths,
  userRole,
}: DashboardFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAssessorOpen, setIsAssessorOpen] = React.useState(false);

  // Helpers para display
  const getMonthName = (dateStr: string) => {
    if (!dateStr) return "";
    return format(parseISO(dateStr), "MMM yyyy", { locale: ptBR });
  };

  const getTeamName = (team: string) => {
    return team === "all" ? "Todos os Times" : team;
  };

  const getAssessorName = (id: string) => {
    if (id === "all") return "Todos os Assessores";
    return filtersData?.assessors.find((a) => a.id === id)?.name || id;
  };

  // Contagem de filtros ativos (diferentes do padrão)
  const activeFiltersCount = [
    selectedTeam !== "all",
    selectedAssessorId !== "all",
  ].filter(Boolean).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 border-white/10 bg-white/5 hover:bg-white/10 hover:border-euro-gold/30 transition-all group gap-3 px-4",
            isOpen && "border-euro-gold/50 bg-euro-gold/5"
          )}
        >
          <div className="flex items-center gap-2">
            <Filter className={cn("w-4 h-4 text-euro-gold", isOpen && "fill-euro-gold/20")} />
            <span className="text-sm font-data text-white/80 uppercase tracking-wider hidden sm:inline">Filtros</span>
          </div>
          
          <div className="h-4 w-px bg-white/10" />
          
          <div className="flex items-center gap-2 text-xs font-mono text-white/60">
            <span className="text-white">{selectedYear}</span>
            <span>•</span>
            <span className="text-white capitalize">{selectedMonth ? format(parseISO(selectedMonth), "MMM", { locale: ptBR }) : "..."}</span>
            
            {(selectedTeam !== "all" || selectedAssessorId !== "all") && (
               <>
                 <span>•</span>
                 <Badge 
                   variant="secondary" 
                   className="h-5 px-1.5 bg-euro-gold/20 text-euro-gold hover:bg-euro-gold/30 border-none rounded-sm font-normal text-[10px]"
                 >
                   +{activeFiltersCount}
                 </Badge>
               </>
            )}
          </div>
          
          <ChevronsUpDown className="w-3 h-3 text-white/30 ml-1" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="center" className="w-[calc(100vw-32px)] sm:w-[340px] p-4 bg-[#0F1218]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
           <h4 className="text-sm font-display text-white flex items-center gap-2">
             <Filter className="w-4 h-4 text-euro-gold" />
             Configuração de Visualização
           </h4>
           
           {(selectedTeam !== "all" || selectedAssessorId !== "all") && (
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-6 px-2 text-[10px] text-white/40 hover:text-white hover:bg-white/5"
               onClick={(e) => {
                 e.stopPropagation();
                 setSelectedTeam("all");
                 if (userRole !== 'user') {
                    setSelectedAssessorId("all");
                 }
               }}
             >
               Limpar Filtros
             </Button>
           )}
        </div>

        <div className="space-y-4">
          {/* GRUPO DE DATA */}
          <div className="space-y-2">
            <label className="text-[10px] font-data text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Período
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-9 focus:ring-euro-gold/20">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1D24] border-white/10 text-white">
                  {filtersData?.years.map((year) => (
                    <SelectItem key={year} value={year} className="text-xs font-mono focus:bg-white/5 focus:text-euro-gold cursor-pointer">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-9 focus:ring-euro-gold/20">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1D24] border-white/10 text-white max-h-[200px]">
                  {filteredMonths.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs font-mono capitalize focus:bg-white/5 focus:text-euro-gold cursor-pointer">
                      {format(parseISO(m), "MMMM", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-white/5" />

          {/* GRUPO DE EQUIPE */}
          <div className="space-y-2">
            <label className="text-[10px] font-data text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3" /> Equipe
            </label>
            <Select 
              value={selectedTeam} 
              onValueChange={(val) => {
                setSelectedTeam(val);
                if (userRole !== 'user') {
                   setSelectedAssessorId("all");
                }
              }}
              disabled={userRole === 'user'}
            >
              <SelectTrigger className={cn(
                "bg-white/5 border-white/10 text-white text-xs h-9 focus:ring-euro-gold/20 disabled:opacity-50 disabled:cursor-not-allowed",
                selectedTeam !== "all" && "border-euro-gold/30 text-euro-gold bg-euro-gold/5"
              )}>
                <SelectValue placeholder="Selecione o time" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D24] border-white/10 text-white">
                <SelectItem value="all" className="text-xs focus:bg-white/5 focus:text-euro-gold cursor-pointer">
                  Todos os Times
                </SelectItem>
                {filtersData?.teams.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs focus:bg-white/5 focus:text-euro-gold cursor-pointer">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GRUPO DE ASSESSOR */}
          <div className="space-y-2">
            <label className="text-[10px] font-data text-white/40 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" /> Assessor Específico
            </label>
            <Popover open={isAssessorOpen} onOpenChange={setIsAssessorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isAssessorOpen}
                  disabled={userRole === 'user'}
                  className={cn(
                    "w-full justify-between bg-white/5 border-white/10 text-white text-xs h-9 hover:bg-white/10 font-normal disabled:opacity-50 disabled:cursor-not-allowed",
                    selectedAssessorId !== "all" && "border-euro-gold/30 text-euro-gold bg-euro-gold/5"
                  )}
                >
                  <span className="truncate">
                    {selectedAssessorId === "all"
                      ? "Todos os Assessores"
                      : filtersData?.assessors.find((a) => a.id === selectedAssessorId)?.name}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-64px)] sm:w-[300px] p-0 bg-[#1A1D24] border-white/10" align="center" side="bottom">
                <Command className="bg-transparent text-white">
                  <CommandInput placeholder="Buscar assessor..." className="h-9 text-xs font-data" />
                  <CommandList className="custom-scrollbar">
                    <CommandEmpty className="py-2 text-center text-xs text-white/40">
                      Nenhum assessor encontrado.
                    </CommandEmpty>
                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedAssessorId("all");
                          setIsAssessorOpen(false);
                        }}
                        className="text-xs aria-selected:bg-white/5 aria-selected:text-euro-gold cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            selectedAssessorId === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Todos os Assessores
                      </CommandItem>
                      {filtersData?.assessors
                        .filter((a) => {
                          if (selectedTeam === "all") return true;
                          return a.teams.includes(selectedTeam);
                        })
                        .map((assessor) => (
                          <CommandItem
                            key={assessor.id}
                            value={assessor.name}
                            onSelect={() => {
                              setSelectedAssessorId(assessor.id);
                              setIsAssessorOpen(false);
                            }}
                            className="text-xs aria-selected:bg-white/5 aria-selected:text-euro-gold cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3",
                                selectedAssessorId === assessor.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {assessor.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="pt-2 text-[10px] text-white/20 text-center font-mono">
          Eurostock Intelligence v2.0
        </div>
      </PopoverContent>
    </Popover>
  );
}
