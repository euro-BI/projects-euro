import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type DadosConsorcio = {
  id: number;
  administradora: string | null;
  cod_assessor: string | null;
  data_venda: string | null;
  produto: string | null;
  observacao: string | null;
  codigo_cliente: string | null;
  cliente: string | null;
  cpf_cnpj: string | null;
  contrato: string | null;
  grupo: string | null;
  cota: string | null;
  valor_carta: number | null;
  valor_comissao_mensal_6m: number | null;
  valor_comissao_13m: number | null;
  valor_comissao_total: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const Consorcios = () => {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<DadosConsorcio[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DadosConsorcio | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<DadosConsorcio>>({});
  type AssessorOption = { code: string; name: string };
  const [assessorOptions, setAssessorOptions] = useState<AssessorOption[]>([]);
  const produtosPorAdmin: Record<string, string[]> = {
    MAPFRE: [
      "CONSÓRCIO AUTO MAPFRE",
      "CONSÓRCIO IMÓVEL MAPFRE",
      "CONSÓRCIO MAQ/EQUIP MAPFRE",
    ],
    ADEMICON: [
      "CONSÓRCIO IMÓVEL ADEMICON 50%",
    ],
    "CONSÓRCIO XP": [
      "CONSÓRCIO AUTO XP",
      "CONSÓRCIO IMÓVEL XP",
      "CONSÓRCIO AUTO LUXO XP",
      "CONSÓRCIO IMÓVEL XP 50%",
    ],
  };
  const availableProducts = useMemo(() => produtosPorAdmin[form.administradora || ""] || [], [form.administradora]);

  const loadRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dados_consorcio")
      .select("*")
      .order("id", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar registros");
    } else {
      setRegistros(data as DadosConsorcio[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRegistros();
    (async () => {
      const { data, error } = await supabase
        .from("dados_colaboradores")
        .select("cod_assessor, nome_completo");
      if (!error && data) {
        const rows = data as { cod_assessor: string | null; nome_completo: string | null }[];
        const map = new Map<string, string>();
        rows.forEach((r) => {
          if (r.cod_assessor) {
            const current = map.get(r.cod_assessor);
            if (!current) {
              map.set(r.cod_assessor, r.nome_completo || r.cod_assessor);
            }
          }
        });
        const opts = Array.from(map.entries()).map(([code, name]) => ({ code, name }));
        opts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
        setAssessorOptions(opts);
      }
    })();
  }, []);

  useEffect(() => {
    if (form.produto && !availableProducts.includes(form.produto)) {
      setForm((f) => ({ ...f, produto: "" }));
    }
  }, [availableProducts]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return registros;
    return registros.filter((r) => {
      const s = [
        r.administradora,
        r.cliente,
        r.cpf_cnpj,
        r.produto,
        r.contrato,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return s.includes(term);
    });
  }, [registros, searchTerm]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filtered.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, registros.length]);

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setIsDialogOpen(true);
  };

  const openEdit = (r: DadosConsorcio) => {
    setEditing(r);
    setForm({ ...r });
    setIsDialogOpen(true);
  };

  const save = async () => {
    const payload: Omit<DadosConsorcio, 'id' | 'created_at' | 'updated_at'> = {
      administradora: form.administradora || null,
      cod_assessor: form.cod_assessor || null,
      data_venda: form.data_venda || null,
      produto: form.produto || null,
      observacao: form.observacao || null,
      codigo_cliente: form.codigo_cliente || null,
      cliente: form.cliente || null,
      cpf_cnpj: form.cpf_cnpj || null,
      contrato: form.contrato || null,
      grupo: form.grupo || null,
      cota: form.cota || null,
      valor_carta: form.valor_carta ?? null,
      valor_comissao_mensal_6m: form.valor_comissao_mensal_6m ?? null,
      valor_comissao_13m: form.valor_comissao_13m ?? null,
      valor_comissao_total: form.valor_comissao_total ?? null,
    };

    if (editing) {
      const { error } = await supabase
        .from("dados_consorcio")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast.error("Erro ao atualizar registro");
        return;
      }
      toast.success("Registro atualizado");
    } else {
      const { error } = await supabase.from("dados_consorcio").insert(payload);
      if (error) {
        toast.error("Erro ao criar registro");
        return;
      }
      toast.success("Registro criado");
    }
    setIsDialogOpen(false);
    setForm({});
    setEditing(null);
    loadRegistros();
  };

  const confirmDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    const { error } = await supabase
      .from("dados_consorcio")
      .delete()
      .eq("id", confirmDeleteId);
    if (error) {
      toast.error("Erro ao excluir registro");
    } else {
      toast.success("Registro excluído");
      loadRegistros();
    }
    setConfirmDeleteId(null);
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">Consórcios</h1>
            <p className="text-muted-foreground">Gerencie os dados de consórcios</p>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Novo Registro
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <Input
                placeholder="Buscar por cliente, administradora, CPF/CNPJ, contrato"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Administradora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data Venda</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Cota</TableHead>
                <TableHead>Valor Carta</TableHead>
                <TableHead>Comissão Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">Nenhum registro encontrado</TableCell>
                </TableRow>
              ) : (
                pageItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.administradora || "-"}</TableCell>
                    <TableCell>{r.cliente || "-"}</TableCell>
                    <TableCell>{r.cpf_cnpj || "-"}</TableCell>
                    <TableCell>{r.produto || "-"}</TableCell>
                    <TableCell>{r.data_venda || "-"}</TableCell>
                    <TableCell>{r.contrato || "-"}</TableCell>
                    <TableCell>{r.grupo || "-"}</TableCell>
                    <TableCell>{r.cota || "-"}</TableCell>
                    <TableCell>{typeof r.valor_carta === "number" ? r.valor_carta : r.valor_carta || "-"}</TableCell>
                    <TableCell>{typeof r.valor_comissao_total === "number" ? r.valor_comissao_total : r.valor_comissao_total || "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(r.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationPrevious
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            />
            <PaginationItem>
              <span className="px-3 text-sm">Página {currentPage} de {totalPages}</span>
            </PaginationItem>
            <PaginationNext
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            />
          </PaginationContent>
        </Pagination>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Administradora</Label>
                <Select value={form.administradora || ""} onValueChange={(v) => setForm((f) => ({ ...f, administradora: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONSÓRCIO XP">CONSÓRCIO XP</SelectItem>
                    <SelectItem value="ADEMICON">ADEMICON</SelectItem>
                    <SelectItem value="MAPFRE">MAPFRE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código Assessor</Label>
                <Select value={form.cod_assessor || ""} onValueChange={(v) => setForm((f) => ({ ...f, cod_assessor: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessorOptions.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {`${opt.code} - ${opt.name.toUpperCase()}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Venda</Label>
                <Input type="date" value={form.data_venda || ""} onChange={(e) => setForm((f) => ({ ...f, data_venda: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={form.produto || ""} onValueChange={(v) => setForm((f) => ({ ...f, produto: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Observação</Label>
                <Input value={form.observacao || ""} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Código Cliente</Label>
                <Input value={form.codigo_cliente || ""} onChange={(e) => setForm((f) => ({ ...f, codigo_cliente: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={form.cliente || ""} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj || ""} onChange={(e) => setForm((f) => ({ ...f, cpf_cnpj: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Input value={form.contrato || ""} onChange={(e) => setForm((f) => ({ ...f, contrato: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Input value={form.grupo || ""} onChange={(e) => setForm((f) => ({ ...f, grupo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Cota</Label>
                <Input value={form.cota || ""} onChange={(e) => setForm((f) => ({ ...f, cota: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valor Carta</Label>
                <Input type="number" value={form.valor_carta ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_carta: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="space-y-2">
                <Label>Comissão Mensal 6m</Label>
                <Input type="number" value={form.valor_comissao_mensal_6m ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_comissao_mensal_6m: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="space-y-2">
                <Label>Comissão 13m</Label>
                <Input type="number" value={form.valor_comissao_13m ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_comissao_13m: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="space-y-2">
                <Label>Comissão Total</Label>
                <Input type="number" value={form.valor_comissao_total ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_comissao_total: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  );
};

export default Consorcios;