import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { RefreshCw, Calendar, Users, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

interface AssessorHistorico {
  id: string;
  cod_assessor: string;
  pipe_id: string;
  cluster: string;
  time_id: string;
  lider: boolean;
  referencia: string;
  nome_completo?: string;
  telefone?: string;
  foto_url?: string;
  time_nome?: string;
  time_cor?: string;
}

interface ReferenceOption {
  value: string;
  label: string;
}

export function AssessorsHistoryManagement() {
  const [assessorsHistorico, setAssessorsHistorico] = useState<AssessorHistorico[]>([]);
  const [filteredAssessors, setFilteredAssessors] = useState<AssessorHistorico[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReference, setSelectedReference] = useState<string>("");
  const [availableReferences, setAvailableReferences] = useState<ReferenceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [currentMonthExists, setCurrentMonthExists] = useState(false);
  const [lastReferenceDate, setLastReferenceDate] = useState<string>("");
  const [dataCache, setDataCache] = useState<Record<string, AssessorHistorico[]>>({});

  // Função para formatar telefone no padrão brasileiro
  const formatPhone = (phone: string): string => {
    if (!phone) return "";
    
    // Remove todos os caracteres não numéricos
    const numbers = phone.replace(/\D/g, "");
    
    // Verifica se tem 11 dígitos (celular) ou 10 dígitos (fixo)
    if (numbers.length === 11) {
      // Formato: (XX) x xxxx-xxxx
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else if (numbers.length === 10) {
      // Formato: (XX) xxxx-xxxx
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
    
    return phone; // Retorna original se não conseguir formatar
  };



  useEffect(() => {
    loadAvailableReferences();
    checkCurrentMonthExists();
  }, []);

  useEffect(() => {
    if (selectedReference) {
      loadAssessorsHistoryByReference(selectedReference);
    }
  }, [selectedReference]);

  // Filtrar assessores baseado no termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAssessors(assessorsHistorico);
    } else {
      const filtered = assessorsHistorico.filter(assessor =>
        (assessor.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (assessor.telefone?.includes(searchTerm)) ||
        (assessor.cod_assessor?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (assessor.time_nome?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (assessor.cluster?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredAssessors(filtered);
    }
  }, [assessorsHistorico, searchTerm]);

  // Função para obter o primeiro dia do mês atual no formato YYYY-MM-01
  const getCurrentMonthReference = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Função para formatar data para exibição
  const formatDate = (dateString: string): string => {
    // Garantir que a data seja interpretada corretamente sem problemas de fuso horário
    const [year, month] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  // Carregar todas as referências disponíveis
  const loadAvailableReferences = async () => {
    try {
      const { data, error } = await supabase
        .from("dados_times_historico")
        .select("referencia")
        .order("referencia", { ascending: false });

      if (error) throw error;

      // Remover duplicatas e criar opções
      const uniqueReferences = [...new Set(data?.map(item => item.referencia) || [])];
      const options = uniqueReferences.map(ref => ({
        value: ref,
        label: formatDate(ref)
      }));

      setAvailableReferences(options);
      
      // Selecionar automaticamente a referência mais recente
      if (options.length > 0) {
        setSelectedReference(options[0].value);
        setLastReferenceDate(options[0].value);
      }
    } catch (error) {
      console.error("Erro ao carregar referências:", error);
      toast.error("Erro ao carregar referências disponíveis");
    }
  };

  // Verificar se já existe registro para o mês atual
  const checkCurrentMonthExists = async () => {
    try {
      const currentMonth = getCurrentMonthReference();
      const { data, error } = await supabase
        .from("dados_times_historico")
        .select("id")
        .eq("referencia", currentMonth)
        .limit(1);

      if (error) throw error;
      setCurrentMonthExists(data && data.length > 0);
    } catch (error) {
      console.error("Erro ao verificar mês atual:", error);
    }
  };

  // Carregar assessores por referência específica
  const loadAssessorsHistoryByReference = async (reference: string) => {
    try {
      setIsLoading(true);

      // Verificar se os dados já estão em cache
      if (dataCache[reference]) {
        console.log(`Dados carregados do cache para referência: ${reference}`);
        setAssessorsHistorico(dataCache[reference]);
        setIsLoading(false);
        return;
      }

      // Buscar todos os assessores da referência selecionada
      const { data, error } = await supabase
        .from("dados_times_historico")
        .select("*")
        .eq("referencia", reference)
        .order("cod_assessor", { ascending: true });

      if (error) throw error;

      // Buscar informações complementares dos colaboradores e times, filtrando apenas os ativos
      const mappedData = [];
      for (const item of data || []) {
        // Buscar dados do colaborador apenas se o status for ATIVO
        const { data: colaboradorData, error: colaboradorError } = await supabase
          .from("dados_colaboradores")
          .select("nome_completo, telefone, foto_url, status")
          .eq("cod_assessor", item.cod_assessor)
          .eq("status", "ATIVO")
          .maybeSingle();

        // Só incluir se o colaborador existe, está ativo e não houve erro
        if (colaboradorData && !colaboradorError) {
          // Buscar dados do time incluindo a cor
          const { data: timeData, error: timeError } = await supabase
            .from("dados_times")
            .select("time, cor_time")
            .eq("time_id", item.time_id)
            .maybeSingle();

          mappedData.push({
            ...item,
            nome_completo: colaboradorData.nome_completo,
            telefone: colaboradorData.telefone,
            foto_url: colaboradorData.foto_url,
            time_nome: timeData?.time || "Time não encontrado",
            time_cor: timeData?.cor_time || "#6b7280" // cor padrão cinza se não encontrar
          });
        }
      }

      // Ordenar alfabeticamente por nome completo
      const sortedData = mappedData.sort((a, b) => {
        const nameA = (a.nome_completo || a.cod_assessor).toLowerCase();
        const nameB = (b.nome_completo || b.cod_assessor).toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Armazenar dados no cache
      setDataCache(prevCache => ({
        ...prevCache,
        [reference]: sortedData
      }));

      console.log(`Dados carregados do banco e armazenados no cache para referência: ${reference}`);
      setAssessorsHistorico(sortedData);
    } catch (error) {
      console.error("Erro ao carregar histórico de assessores:", error);
      toast.error("Erro ao carregar histórico de assessores");
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar os últimos assessores ativos do histórico (função mantida para compatibilidade)
  const loadLatestAssessorsHistory = async () => {
    if (availableReferences.length > 0) {
      await loadAssessorsHistoryByReference(availableReferences[0].value);
    }
  };

  // Atualizar assessores para o mês atual
  const handleUpdateAssessors = async () => {
    try {
      setIsSubmitting(true);
      const currentMonth = getCurrentMonthReference();

      // Verificar novamente se já existe para o mês atual
      const { data: existingData, error: checkError } = await supabase
        .from("dados_times_historico")
        .select("id")
        .eq("referencia", currentMonth)
        .limit(1);

      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        toast.error("Já existe registro para o mês atual");
        setIsUpdateModalOpen(false);
        return;
      }

      // Replicar os dados da última referência para o mês atual
      const dataToInsert = assessorsHistorico.map(assessor => ({
        cod_assessor: assessor.cod_assessor,
        pipe_id: assessor.pipe_id,
        cluster: assessor.cluster,
        time_id: assessor.time_id,
        lider: assessor.lider,
        referencia: currentMonth
      }));

      const { error: insertError } = await supabase
        .from("dados_times_historico")
        .insert(dataToInsert);

      if (insertError) throw insertError;

      toast.success(`Histórico atualizado para ${formatDate(currentMonth)}`);
      setIsUpdateModalOpen(false);
      setCurrentMonthExists(true);
      
      // Recarregar as referências e dados
      await loadAvailableReferences();
    } catch (error) {
      console.error("Erro ao atualizar assessores:", error);
      toast.error("Erro ao atualizar assessores");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Histórico de Assessores
              </CardTitle>
              <CardDescription>
                Gerenciamento do histórico mensal de assessores nos times
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsUpdateModalOpen(true)}
              disabled={currentMonthExists || isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar Assessores
            </Button>
          </div>
          
          {currentMonthExists && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                O histórico para {formatDate(getCurrentMonthReference())} já foi criado com {assessorsHistorico.length} assessores.
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Campo de busca */}
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Buscar por nome, código, telefone, time ou cluster..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Seletor de mês/ano de referência */}
              <div className="space-y-2">
                <Label htmlFor="reference">Mês/Ano de Referência</Label>
                <Select value={selectedReference} onValueChange={setSelectedReference}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma referência" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReferences.map((ref) => (
                      <SelectItem key={ref.value} value={ref.value}>
                        {ref.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessor</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Pipe ID</TableHead>
                  <TableHead>Líder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Carregando histórico...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAssessors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {searchTerm ? "Nenhum assessor encontrado com os filtros aplicados" : "Nenhum histórico de assessores encontrado"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessors.map((assessor) => (
                    <TableRow key={assessor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={assessor.foto_url} alt={assessor.nome_completo} />
                            <AvatarFallback>
                              {assessor.nome_completo?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                               assessor.cod_assessor.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium uppercase">
                              {assessor.nome_completo || assessor.cod_assessor}
                            </p>
                            {assessor.telefone && (
                              <p className="text-sm text-muted-foreground">
                                {formatPhone(assessor.telefone)}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{assessor.cod_assessor}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className="text-white hover:opacity-80"
                          style={{ backgroundColor: assessor.time_cor || "#6b7280" }}
                        >
                          {assessor.time_nome || assessor.time_id}
                        </Badge>
                      </TableCell>
                      <TableCell>{assessor.cluster}</TableCell>
                      <TableCell>{assessor.pipe_id}</TableCell>
                      <TableCell>
                        {assessor.lider ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white">
                            Líder
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Membro</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação para Atualização */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atualização</DialogTitle>
            <DialogDescription>
              Você está prestes a criar o histórico de assessores para{" "}
              <strong>{formatDate(getCurrentMonthReference())}</strong>.
              <br /><br />
              Serão replicados <strong>{assessorsHistorico.length} assessores</strong> da última 
              referência ({lastReferenceDate ? formatDate(lastReferenceDate) : 'N/A'}) 
              para o mês atual.
              <br /><br />
              Esta ação não pode ser desfeita. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUpdateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateAssessors}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Confirmar Atualização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}