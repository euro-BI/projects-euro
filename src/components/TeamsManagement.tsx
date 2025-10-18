import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, Filter } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  time_id: string;
  time: string;
  foto_url?: string;
  cor_time?: string;
  status?: string;
  created_at?: string;
}

export function TeamsManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  // Filtrar times baseado no termo de busca e status
  useEffect(() => {
    let filtered = teams;

    // Filtrar por status
    if (statusFilter !== "TODOS") {
      filtered = filtered.filter(team => team.status === statusFilter);
    }

    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      filtered = filtered.filter(team =>
        team.time.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.time_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Manter ordenação alfabética nos resultados filtrados
    filtered.sort((a, b) => a.time.localeCompare(b.time));
    setFilteredTeams(filtered);
  }, [teams, searchTerm, statusFilter]);

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("dados_times")
        .select("*")
        .order("time", { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Erro ao carregar times:", error);
      toast.error("Erro ao carregar times");
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Times</h2>
          <p className="text-muted-foreground">
            Visualize e gerencie os times cadastrados no sistema
          </p>
        </div>
      </div>

      {/* Campo de busca e filtros */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome do time..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filtros de Status */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Button
            variant={statusFilter === "TODOS" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("TODOS")}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === "ATIVO" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("ATIVO")}
          >
            Ativos
          </Button>
          <Button
            variant={statusFilter === "INATIVO" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("INATIVO")}
          >
            Inativos
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Nome do Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  Carregando times...
                </TableCell>
              </TableRow>
            ) : filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum time encontrado" : "Nenhum time cadastrado"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage 
                        src={team.foto_url} 
                        alt={team.time}
                      />
                      <AvatarFallback 
                        className="text-sm font-medium"
                        style={{ backgroundColor: team.cor_time || '#6366f1' }}
                      >
                        {getInitials(team.time)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{team.time.toUpperCase()}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={team.status === "ATIVO" ? "default" : "secondary"}
                      className={team.status === "ATIVO" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600 text-white"}
                    >
                      {team.status === "ATIVO" ? "ATIVO" : "INATIVO"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: team.cor_time || '#6366f1' }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {team.cor_time || '#6366f1'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && filteredTeams.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredTeams.length} de {teams.length} times
        </div>
      )}
    </div>
  );
}