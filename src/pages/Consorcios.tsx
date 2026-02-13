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
import { ArrowLeft, Edit, Trash2, FileSpreadsheet, Download, Eye, Settings, Plus } from "lucide-react";
import * as XLSX from "xlsx";
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
  const assessorLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    assessorOptions.forEach((o) => {
      m.set(o.code, `${o.code} - ${o.name.toUpperCase()}`);
    });
    return m;
  }, [assessorOptions]);
  const [productsByAdmin, setProductsByAdmin] = useState<Record<string, string[]>>({});
  const availableProducts = useMemo(() => productsByAdmin[form.administradora || ""] || [], [form.administradora, productsByAdmin]);
  const [viewing, setViewing] = useState<DadosConsorcio | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{ administradora: string; comissao_percent: string }>({ administradora: "", comissao_percent: "" });
  type AdmConfig = { id: number; administradora: string; comissao_percent: number };
  const [admConfigs, setAdmConfigs] = useState<AdmConfig[]>([]);
  const [adminOptions, setAdminOptions] = useState<string[]>([]);
  const [adminCommissions, setAdminCommissions] = useState<Record<string, number>>({});
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productAdminId, setProductAdminId] = useState<number | null>(null);
  const [productName, setProductName] = useState<string>("");
  const formatCurrency = (n: number | null) => {
    if (n === null || n === undefined) return "-";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
    } catch {
      return String(n);
    }
  };
  const formatDateBR = (isoDate: string | null) => {
    if (!isoDate) return "-";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return "-";
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  };
  const formatCpfCnpjMask = (digits: string | null) => {
    const v = (digits || "").replace(/\D/g, "");
    if (v.length <= 11) {
      const p = v.padEnd(11, "");
      const a = p.slice(0, 3).replace(/(\d{3})/, "$1");
      const b = p.slice(3, 6).replace(/(\d{3})/, "$1");
      const c = p.slice(6, 9).replace(/(\d{3})/, "$1");
      const d = p.slice(9, 11).replace(/(\d{2})/, "$1");
      const parts = [] as string[];
      if (v.length >= 1) parts.push(a);
      if (v.length >= 4) parts.push(b);
      if (v.length >= 7) parts.push(c);
      const base = parts.join('.')
      return v.length >= 10 ? `${base}-${d.trim()}` : base;
    } else {
      const p = v.padEnd(14, "");
      const a = p.slice(0, 2);
      const b = p.slice(2, 5);
      const c = p.slice(5, 8);
      const d = p.slice(8, 12);
      const e = p.slice(12, 14);
      const base = `${a}.${b}.${c}`.replace(/\.+$/, match => match);
      const mid = v.length >= 9 ? `/${d.trim()}` : '';
      const end = v.length >= 13 ? `-${e.trim()}` : '';
      return `${a.length?`${a}`:''}${v.length>=3?`.${b}`:''}${v.length>=6?`.${c}`:''}${mid}${end}`;
    }
  };
  const getAdminBadgeClass = (admin: string | null) => {
    switch (admin) {
      case "CONSÓRCIO XP":
        return "bg-cyan-600 text-white";
      case "ADEMICON":
        return "bg-primary text-primary-foreground";
      case "MAPFRE":
        return "bg-red-600 text-white";
      default:
        return "bg-muted text-foreground";
    }
  };
  const formatPercent = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "-";
    try {
      const v = Number(n);
      return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)}%`;
    } catch {
      return String(n);
    }
  };

  const saveSettings = async () => {
    const pct = Number(String(settingsForm.comissao_percent).replace(",", "."));
    const name = (settingsForm.administradora || "").trim().toUpperCase();
    if (!name || isNaN(pct)) {
      toast.error("Preencha administradora e % comissão válidos");
      return;
    }
    const { error } = await supabase
      .from("dados_consorcios_adm")
      .upsert({ administradora: name, comissao_percent: pct }, { onConflict: "administradora" });
    if (error) {
      toast.error("Erro ao salvar configurações");
      return;
    }
    toast.success("Configurações salvas");
    const { data: admins } = await supabase
      .from("dados_consorcios_adm")
      .select("administradora, comissao_percent")
      .order("administradora", { ascending: true });
    if (admins) {
      const rows = admins as { administradora: string; comissao_percent: number }[];
      setAdminOptions(rows.map((a) => a.administradora));
      const map: Record<string, number> = {};
      rows.forEach((r) => { map[r.administradora] = r.comissao_percent; });
      setAdminCommissions(map);
    }
    await loadAdminProducts();
    setSettingsOpen(false);
    setSettingsForm({ administradora: "", comissao_percent: "" });
  };

  const loadAdminProducts = async () => {
    const { data: admins } = await supabase
      .from("dados_consorcios_adm")
      .select("id, administradora")
      .order("administradora", { ascending: true });
    const { data: prods } = await supabase
      .from("dados_produtos_consorcio")
      .select("administradora_id, nome_produto");
    const map: Record<string, string[]> = {};
    const idToName = new Map<number, string>();
    (admins as { id: number; administradora: string }[] | null)?.forEach((a) => {
      idToName.set(a.id, a.administradora);
      map[a.administradora] = [];
    });
    (prods as { administradora_id: number; nome_produto: string }[] | null)?.forEach((p) => {
      const name = idToName.get(p.administradora_id);
      if (name) {
        (map[name] ||= []).push(p.nome_produto);
      }
    });
    setProductsByAdmin(map);
  };

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
    (async () => {
      const defaults = [
        { administradora: "CONSÓRCIO XP", comissao_percent: 4.0 },
        { administradora: "MAPFRE", comissao_percent: 4.0 },
        { administradora: "ADEMICON", comissao_percent: 2.3 },
      ];
      await supabase
        .from("dados_consorcios_adm")
        .upsert(defaults, { onConflict: "administradora" });
      const { data: admins } = await supabase
        .from("dados_consorcios_adm")
        .select("administradora, comissao_percent")
        .order("administradora", { ascending: true });
      if (admins) {
        const rows = admins as { administradora: string; comissao_percent: number }[];
        setAdminOptions(rows.map((a) => a.administradora));
        const map: Record<string, number> = {};
        rows.forEach((r) => { map[r.administradora] = r.comissao_percent; });
        setAdminCommissions(map);
      }
      await loadAdminProducts();
    })();
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    (async () => {
      const { data } = await supabase
        .from("dados_consorcios_adm")
        .select("id, administradora, comissao_percent")
        .order("administradora", { ascending: true });
      if (data) setAdmConfigs(data as AdmConfig[]);
    })();
  }, [settingsOpen]);

  useEffect(() => {
    if (form.produto && !availableProducts.includes(form.produto)) {
      setForm((f) => ({ ...f, produto: "" }));
    }
  }, [availableProducts]);

  useEffect(() => {
    const adm = form.administradora || "";
    const carta = form.valor_carta;
    if (adm && typeof carta === "number" && !isNaN(carta)) {
      const pct = adminCommissions[adm];
      if (pct !== undefined) {
        const total = Number((carta * (pct / 100)).toFixed(2));
        setForm((f) => ({ ...f, valor_comissao_total: total }));
      }
    } else {
      setForm((f) => ({ ...f, valor_comissao_total: null }));
    }
  }, [form.administradora, form.valor_carta, adminCommissions]);

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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const da = a.data_venda || "";
      const db = b.data_venda || "";
      const byDateDesc = db.localeCompare(da);
      if (byDateDesc !== 0) return byDateDesc;
      const la = a.cod_assessor ? (assessorLabelByCode.get(a.cod_assessor) || a.cod_assessor) : "";
      const lb = b.cod_assessor ? (assessorLabelByCode.get(b.cod_assessor) || b.cod_assessor) : "";
      const byAssessorAsc = la.localeCompare(lb, "pt-BR", { sensitivity: "base" });
      if (byAssessorAsc !== 0) return byAssessorAsc;
      const ca = typeof a.valor_comissao_total === "number" ? a.valor_comissao_total : -Infinity;
      const cb = typeof b.valor_comissao_total === "number" ? b.valor_comissao_total : -Infinity;
      return cb - ca;
    });
    return arr;
  }, [filtered, assessorLabelByCode]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = sorted.slice(startIndex, endIndex);

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

  const exportXlsx = () => {
    const rows = filtered.map((r) => ({
      Administradora: r.administradora || "",
      "Código Assessor": r.cod_assessor || "",
      "Data Venda": r.data_venda || "",
      Produto: r.produto || "",
      Observacao: r.observacao || "",
      "Código Cliente": r.codigo_cliente || "",
      Cliente: r.cliente || "",
      "CPF/CNPJ": r.cpf_cnpj || "",
      Contrato: r.contrato || "",
      Grupo: r.grupo || "",
      Cota: r.cota || "",
      "Valor Carta": r.valor_carta ?? "",
      "Comissão Mensal 6m": r.valor_comissao_mensal_6m ?? "",
      "Comissão 13m": r.valor_comissao_13m ?? "",
      "Comissão Total": r.valor_comissao_total ?? "",
      "Criado Em": r.created_at || "",
      "Atualizado Em": r.updated_at || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consórcios");
    XLSX.writeFile(wb, "consorcios.xlsx");
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
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Novo Registro
          </Button>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)} className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </Button>
          <Button variant="outline" onClick={exportXlsx} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar XLSX
          </Button>
        </div>
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
                <TableHead>Assessor</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data Venda</TableHead>
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
                    <TableCell className="font-medium">
                      <Badge className={getAdminBadgeClass(r.administradora)}>
                        {r.administradora ? `${r.administradora}${adminCommissions[r.administradora] !== undefined ? ` - ${formatPercent(adminCommissions[r.administradora])}` : ""}` : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.cod_assessor ? (assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor) : "-"}</TableCell>
                    <TableCell>{r.contrato || "-"}</TableCell>
                    <TableCell>{r.produto || "-"}</TableCell>
                    <TableCell>{formatDateBR(r.data_venda)}</TableCell>
                    <TableCell>{formatCurrency(r.valor_comissao_total)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => confirmDelete(r.id)}>
                        <Trash2 className="w-4 h-4" />
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
                    {adminOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
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
                <Input inputMode="numeric" pattern="[0-9]*" value={form.codigo_cliente || ""} onChange={(e) => setForm((f) => ({ ...f, codigo_cliente: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={form.cliente || ""} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={formatCpfCnpjMask(form.cpf_cnpj || "")} onChange={(e) => setForm((f) => ({ ...f, cpf_cnpj: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={form.contrato || ""} onChange={(e) => setForm((f) => ({ ...f, contrato: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={form.grupo || ""} onChange={(e) => setForm((f) => ({ ...f, grupo: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-2">
                <Label>Cota</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={form.cota || ""} onChange={(e) => setForm((f) => ({ ...f, cota: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-2">
                <Label>Valor Carta</Label>
                <Input type="number" value={form.valor_carta ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_carta: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="space-y-2">
                <Label>Comissão Total</Label>
                <Input type="number" value={form.valor_comissao_total ?? ""} readOnly />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurações de Administradora</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Nome da Administradora</Label>
                <Input value={settingsForm.administradora} onChange={(e) => setSettingsForm((f) => ({ ...f, administradora: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>% Comissão</Label>
                <Input value={settingsForm.comissao_percent} onChange={(e) => setSettingsForm((f) => ({ ...f, comissao_percent: e.target.value }))} />
              </div>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Administradora</TableHead>
                      <TableHead>% Comissão</TableHead>
                      <TableHead className="text-right">Produtos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admConfigs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6">Nenhuma configuração cadastrada</TableCell>
                      </TableRow>
                    ) : (
                      admConfigs.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.administradora}</TableCell>
                          <TableCell>{formatPercent(c.comissao_percent)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setProductAdminId(c.id); setProductDialogOpen(true); }}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
              <Button onClick={saveSettings}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Produto</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Nome do Produto</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value.toUpperCase())} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setProductDialogOpen(false); setProductName(""); }}>Cancelar</Button>
              <Button onClick={async () => {
                const name = productName.trim().toUpperCase();
                if (!name || !productAdminId) { toast.error("Informe o nome do produto"); return; }
                const { error } = await supabase
                  .from("dados_produtos_consorcio")
                  .insert({ administradora_id: productAdminId, nome_produto: name });
                if (error) { toast.error("Erro ao salvar produto"); return; }
                toast.success("Produto adicionado");
                setProductDialogOpen(false);
                setProductName("");
                await loadAdminProducts();
              }}>Salvar</Button>
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

        <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Consórcio</DialogTitle>
            </DialogHeader>
            {viewing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-4 col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Administradora</Label>
                    <div className="text-sm mt-1">{viewing.administradora || "-"}</div>
                  </div>
                  <div>
                    <Label>Código Assessor</Label>
                    <div className="text-sm mt-1">{viewing.cod_assessor || "-"}</div>
                  </div>
                  <div>
                    <Label>Data da Venda</Label>
                    <div className="text-sm mt-1">{formatDateBR(viewing.data_venda)}</div>
                  </div>
                  <div>
                    <Label>Produto</Label>
                    <div className="text-sm mt-1">{viewing.produto || "-"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observação</Label>
                    <div className="text-sm mt-1">{viewing.observacao || "-"}</div>
                  </div>
                  <div>
                    <Label>Código do Cliente</Label>
                    <div className="text-sm mt-1">{viewing.codigo_cliente || "-"}</div>
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <div className="text-sm mt-1">{viewing.cliente || "-"}</div>
                  </div>
                  <div>
                    <Label>CPF/CNPJ</Label>
                    <div className="text-sm mt-1">{formatCpfCnpjMask(viewing.cpf_cnpj)}</div>
                  </div>
                  <div>
                    <Label>Contrato</Label>
                    <div className="text-sm mt-1">{viewing.contrato || "-"}</div>
                  </div>
                  <div>
                    <Label>Grupo</Label>
                    <div className="text-sm mt-1">{viewing.grupo || "-"}</div>
                  </div>
                  <div>
                    <Label>Cota</Label>
                    <div className="text-sm mt-1">{viewing.cota || "-"}</div>
                  </div>
                  <div>
                    <Label>Valor Carta</Label>
                    <div className="text-sm mt-1">{formatCurrency(viewing.valor_carta)}</div>
                  </div>
                  <div>
                    <Label>Comissão Total</Label>
                    <div className="text-sm mt-1">{formatCurrency(viewing.valor_comissao_total)}</div>
                  </div>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
};

export default Consorcios;