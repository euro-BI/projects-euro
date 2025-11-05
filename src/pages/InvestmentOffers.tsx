import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PlusCircle, Search, Edit, Trash2, Wallet } from "lucide-react";

type OfertaAtiva = {
  id_oferta: number;
  nome_oferta: string;
  tipo: string;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes?: string | null;
};

type FaixaFee = {
  id_faixa: number;
  id_oferta: number;
  faixa_min: number;
  faixa_max: number;
  fee_percentual: number;
};

const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

const formatPercent = (value: number | string) => {
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "-";
  return `${(num * 100).toFixed(2)}%`;
};

const isAtiva = (oferta: OfertaAtiva) => {
  if (!oferta.data_fim) return true;
  try {
    const today = new Date();
    const fim = new Date(oferta.data_fim);
    return fim >= new Date(today.toDateString());
  } catch {
    return true;
  }
};

export default function InvestmentOffers() {
  const [activeTab, setActiveTab] = useState("ofertas");

  // Ofertas state
  const [ofertas, setOfertas] = useState<OfertaAtiva[]>([]);
  const [loadingOfertas, setLoadingOfertas] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Oferta form
  const [isOfertaDialogOpen, setIsOfertaDialogOpen] = useState(false);
  const [editingOferta, setEditingOferta] = useState<OfertaAtiva | null>(null);
  const [ofertaForm, setOfertaForm] = useState<Partial<OfertaAtiva>>({});
  const [confirmDeleteOferta, setConfirmDeleteOferta] = useState<OfertaAtiva | null>(null);

  // Faixas state
  const [selectedOferta, setSelectedOferta] = useState<OfertaAtiva | null>(null);
  const [faixas, setFaixas] = useState<FaixaFee[]>([]);
  const [loadingFaixas, setLoadingFaixas] = useState(false);

  // Faixa form
  const [isFaixaDialogOpen, setIsFaixaDialogOpen] = useState(false);
  const [editingFaixa, setEditingFaixa] = useState<FaixaFee | null>(null);
  const [faixaForm, setFaixaForm] = useState<Partial<FaixaFee>>({});
  const [confirmDeleteFaixa, setConfirmDeleteFaixa] = useState<FaixaFee | null>(null);

  const loadOfertas = async () => {
    setLoadingOfertas(true);
    try {
      const { data, error } = await supabase
        .from("dados_ofertas_ativas")
        .select("id_oferta, nome_oferta, tipo, data_inicio, data_fim, observacoes")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      setOfertas((data || []) as OfertaAtiva[]);
    } catch (err) {
      console.error("Erro ao carregar ofertas:", err);
      toast.error("Erro ao carregar ofertas ativas");
    } finally {
      setLoadingOfertas(false);
    }
  };

  const loadFaixas = async (ofertaId: number) => {
    setLoadingFaixas(true);
    try {
      const { data, error } = await supabase
        .from("dados_ofertas_faixa_fee")
        .select("id_faixa, id_oferta, faixa_min, faixa_max, fee_percentual")
        .eq("id_oferta", ofertaId)
        .order("faixa_min", { ascending: true });
      if (error) throw error;
      setFaixas((data || []) as FaixaFee[]);
    } catch (err) {
      console.error("Erro ao carregar faixas:", err);
      toast.error("Erro ao carregar faixas de fee");
    } finally {
      setLoadingFaixas(false);
    }
  };

  useEffect(() => {
    loadOfertas();
  }, []);

  useEffect(() => {
    if (selectedOferta) {
      loadFaixas(selectedOferta.id_oferta);
    } else {
      setFaixas([]);
    }
  }, [selectedOferta]);

  const filteredOfertas = useMemo(() => {
    let result = ofertas.filter((o) =>
      o.nome_oferta.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (statusFilter !== "all") {
      result = result.filter((o) => (statusFilter === "ativa" ? isAtiva(o) : !isAtiva(o)));
    }

    // Mantém a ordenação fornecida pela consulta (data_inicio desc)
    return result;
  }, [ofertas, searchTerm, statusFilter]);

  const openCreateOferta = () => {
    setEditingOferta(null);
    setOfertaForm({ nome_oferta: "", tipo: "", data_inicio: "", data_fim: "", observacoes: "" });
    setIsOfertaDialogOpen(true);
  };

  const openEditOferta = (oferta: OfertaAtiva) => {
    setEditingOferta(oferta);
    setOfertaForm({ ...oferta });
    setIsOfertaDialogOpen(true);
  };

  const saveOferta = async () => {
    const payload = {
      nome_oferta: ofertaForm.nome_oferta?.trim() || "",
      tipo: ofertaForm.tipo?.trim() || "",
      data_inicio: ofertaForm.data_inicio || null,
      data_fim: ofertaForm.data_fim || null,
      observacoes: ofertaForm.observacoes || null,
    };
    if (!payload.nome_oferta || !payload.tipo || !payload.data_inicio) {
      toast.error("Preencha nome, tipo e data de início");
      return;
    }

    try {
      if (editingOferta) {
        const { error } = await supabase
          .from("dados_ofertas_ativas")
          .update(payload)
          .eq("id_oferta", editingOferta.id_oferta);
        if (error) throw error;
        toast.success("Oferta atualizada");
      } else {
        const { error } = await supabase.from("dados_ofertas_ativas").insert(payload);
        if (error) throw error;
        toast.success("Oferta criada");
      }
      setIsOfertaDialogOpen(false);
      await loadOfertas();
    } catch (err) {
      console.error("Erro ao salvar oferta:", err);
      toast.error("Erro ao salvar oferta");
    }
  };

  const deleteOferta = async () => {
    if (!confirmDeleteOferta) return;
    try {
      const { error } = await supabase
        .from("dados_ofertas_ativas")
        .delete()
        .eq("id_oferta", confirmDeleteOferta.id_oferta);
      if (error) throw error;
      toast.success("Oferta excluída");
      setConfirmDeleteOferta(null);
      // If deleted oferta was selected, clear selection
      if (selectedOferta?.id_oferta === confirmDeleteOferta.id_oferta) {
        setSelectedOferta(null);
      }
      await loadOfertas();
    } catch (err) {
      console.error("Erro ao excluir oferta:", err);
      toast.error("Erro ao excluir oferta");
    }
  };

  const openCreateFaixa = () => {
    if (!selectedOferta) {
      toast.error("Selecione uma oferta para adicionar faixas");
      return;
    }
    setEditingFaixa(null);
    setFaixaForm({ id_oferta: selectedOferta.id_oferta, faixa_min: 0, faixa_max: 0, fee_percentual: 0.0 });
    setIsFaixaDialogOpen(true);
  };

  const openEditFaixa = (faixa: FaixaFee) => {
    setEditingFaixa(faixa);
    setFaixaForm({ ...faixa });
    setIsFaixaDialogOpen(true);
  };

  const faixasOverlap = (min: number, max: number, currentId?: number) => {
    return faixas.some((f) => {
      if (currentId && f.id_faixa === currentId) return false;
      return min <= f.faixa_max && max >= f.faixa_min;
    });
  };

  const saveFaixa = async () => {
    if (!selectedOferta) return;
    const min = Number(faixaForm.faixa_min);
    const max = Number(faixaForm.faixa_max);
    const fee = Number(faixaForm.fee_percentual);

    if (isNaN(min) || isNaN(max) || isNaN(fee)) {
      toast.error("Informe valores numéricos válidos");
      return;
    }
    if (min >= max) {
      toast.error("faixa_min deve ser menor que faixa_max");
      return;
    }
    if (faixasOverlap(min, max, editingFaixa?.id_faixa)) {
      toast.error("Faixa sobreposta detectada nesta oferta");
      return;
    }

    const payload = {
      id_oferta: selectedOferta.id_oferta,
      faixa_min: min,
      faixa_max: max,
      fee_percentual: fee,
    };

    try {
      if (editingFaixa) {
        const { error } = await supabase
          .from("dados_ofertas_faixa_fee")
          .update(payload)
          .eq("id_faixa", editingFaixa.id_faixa);
        if (error) throw error;
        toast.success("Faixa atualizada");
      } else {
        const { error } = await supabase.from("dados_ofertas_faixa_fee").insert(payload);
        if (error) throw error;
        toast.success("Faixa adicionada");
      }
      setIsFaixaDialogOpen(false);
      await loadFaixas(selectedOferta.id_oferta);
    } catch (err) {
      console.error("Erro ao salvar faixa:", err);
      toast.error("Erro ao salvar faixa");
    }
  };

  const deleteFaixa = async () => {
    if (!confirmDeleteFaixa) return;
    try {
      const { error } = await supabase
        .from("dados_ofertas_faixa_fee")
        .delete()
        .eq("id_faixa", confirmDeleteFaixa.id_faixa);
      if (error) throw error;
      toast.success("Faixa excluída");
      setConfirmDeleteFaixa(null);
      if (selectedOferta) await loadFaixas(selectedOferta.id_oferta);
    } catch (err) {
      console.error("Erro ao excluir faixa:", err);
      toast.error("Erro ao excluir faixa");
    }
  };

  return (
    <PageLayout title="Gerenciamento de Ofertas de Investimento">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 glass-card border-primary/30">
            <TabsTrigger value="ofertas" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Ofertas Ativas
            </TabsTrigger>
            <TabsTrigger value="faixas" className="flex items-center gap-2" disabled={!selectedOferta}>
              Faixas de Fee
            </TabsTrigger>
          </TabsList>

          {/* Ofertas Tab */}
          <TabsContent value="ofertas" className="space-y-6">
            <Card className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex-1 flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome da oferta"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded h-9 px-2 bg-background"
                  >
                    <option value="all">Todos</option>
                    <option value="ativa">Ativa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button onClick={openCreateOferta} className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Nova Oferta
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOfertas ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Carregando ofertas...</TableCell>
                    </TableRow>
                  ) : filteredOfertas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Nenhuma oferta encontrada</TableCell>
                    </TableRow>
                  ) : (
                    filteredOfertas.map((oferta) => (
                      <TableRow key={oferta.id_oferta} className={selectedOferta?.id_oferta === oferta.id_oferta ? "bg-muted/40" : ""}>
                        <TableCell className="font-medium">{oferta.nome_oferta}</TableCell>
                        <TableCell>{oferta.tipo}</TableCell>
                        <TableCell>{oferta.data_inicio ? new Date(oferta.data_inicio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{oferta.data_fim ? new Date(oferta.data_fim).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={isAtiva(oferta) ? "default" : "secondary"}>
                            {isAtiva(oferta) ? "Ativa" : "Encerrada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOferta(oferta);
                              setActiveTab("faixas");
                            }}
                          >
                            Faixas
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditOferta(oferta)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOferta(oferta)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Faixas Tab */}
          <TabsContent value="faixas" className="space-y-6">
            <Card className="p-4">
              {selectedOferta ? (
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">{selectedOferta.nome_oferta}</div>
                    <div className="text-sm text-muted-foreground">
                      Tipo: {selectedOferta.tipo} • Início: {selectedOferta.data_inicio ? new Date(selectedOferta.data_inicio).toLocaleDateString("pt-BR") : "-"} • Fim: {selectedOferta.data_fim ? new Date(selectedOferta.data_fim).toLocaleDateString("pt-BR") : "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button onClick={openCreateFaixa} className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Nova Faixa
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Selecione uma oferta na aba anterior para gerenciar faixas.</div>
              )}
            </Card>

            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa Mín</TableHead>
                    <TableHead>Faixa Máx</TableHead>
                    <TableHead>Fee (%)</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingFaixas ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">Carregando faixas...</TableCell>
                    </TableRow>
                  ) : !selectedOferta ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">Nenhuma oferta selecionada</TableCell>
                    </TableRow>
                  ) : faixas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">Nenhuma faixa cadastrada</TableCell>
                    </TableRow>
                  ) : (
                    faixas.map((faixa) => (
                      <TableRow key={faixa.id_faixa}>
                        <TableCell>{formatCurrency(faixa.faixa_min)}</TableCell>
                        <TableCell>{formatCurrency(faixa.faixa_max)}</TableCell>
                        <TableCell>{formatPercent(faixa.fee_percentual)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditFaixa(faixa)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteFaixa(faixa)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Oferta Dialog */}
      <Dialog open={isOfertaDialogOpen} onOpenChange={setIsOfertaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOferta ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Oferta</Label>
              <Input
                value={ofertaForm.nome_oferta || ""}
                onChange={(e) => setOfertaForm((f) => ({ ...f, nome_oferta: e.target.value }))}
                placeholder="Ex: CRA Seara JBS"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input
                value={ofertaForm.tipo || ""}
                onChange={(e) => setOfertaForm((f) => ({ ...f, tipo: e.target.value }))}
                placeholder="Ex: Renda Fixa, Fundo"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={ofertaForm.data_inicio || ""}
                onChange={(e) => setOfertaForm((f) => ({ ...f, data_inicio: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={ofertaForm.data_fim || ""}
                onChange={(e) => setOfertaForm((f) => ({ ...f, data_fim: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Observações</Label>
              <Input
                value={ofertaForm.observacoes || ""}
                onChange={(e) => setOfertaForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Notas gerais (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOfertaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveOferta}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Oferta Delete Confirm */}
      <AlertDialog open={!!confirmDeleteOferta} onOpenChange={(open) => !open && setConfirmDeleteOferta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A oferta "{confirmDeleteOferta?.nome_oferta}" será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteOferta}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Faixa Dialog */}
      <Dialog open={isFaixaDialogOpen} onOpenChange={setIsFaixaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFaixa ? "Editar Faixa" : "Nova Faixa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Faixa Mín (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={faixaForm.faixa_min ?? 0}
                onChange={(e) => setFaixaForm((f) => ({ ...f, faixa_min: Number(e.target.value) }))}
                placeholder="Ex: 1000.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Faixa Máx (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={faixaForm.faixa_max ?? 0}
                onChange={(e) => setFaixaForm((f) => ({ ...f, faixa_max: Number(e.target.value) }))}
                placeholder="Ex: 50000.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Fee (%)</Label>
              <Input
                type="number"
                step="0.0001"
                value={faixaForm.fee_percentual ?? 0}
                onChange={(e) => setFaixaForm((f) => ({ ...f, fee_percentual: Number(e.target.value) }))}
                placeholder="Ex: 0.0075 para 0,75%"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFaixaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveFaixa}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Faixa Delete Confirm */}
      <AlertDialog open={!!confirmDeleteFaixa} onOpenChange={(open) => !open && setConfirmDeleteFaixa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir faixa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A faixa selecionada será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFaixa}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}