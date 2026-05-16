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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toast } from "sonner";
import { ArrowLeft, Download, Edit, FileSpreadsheet, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { addMonths, addYears, format, parseISO } from "date-fns";

type Periodicidade = "MENSAL" | "ANUAL";
type Seguradora = "MAG" | "ICATU" | "METLIFE" | "OMINT" | "PRUDENTIAL";

type DadosSeguroNovo = {
  id: number;
  inscricao: string | null;
  conta: string | null;
  cliente: string | null;
  cod_assessor: string | null;
  periodicidade: Periodicidade | null;
  seguradora: Seguradora | null;
  valor_parcela: number | null;
  percent_comissao: number | null;
  valor_comissao: number | null;
  data_inicial: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssessorOption = { code: string; name: string };
type MvAssessorRow = { data_posicao: string | null; cod_assessor: string | null; nome_assessor: string | null };

type SeguroDraft = {
  form: Partial<DadosSeguroNovo>;
  valorParcelaDigits: string;
  percentComissaoDigits: string;
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const formatCurrency = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "-";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
  } catch {
    return String(n);
  }
};

const formatNumberFromDigits = (digits: string, fractionDigits: number) => {
  const d = onlyDigits(digits || "");
  const asNumber = d ? Number(d) / Math.pow(10, fractionDigits) : 0;
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(asNumber);
};

const formatDateBR = (isoDate: string | null) => {
  if (!isoDate) return "-";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return "-";
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
};

const DRAFT_KEY = "seguros_novo_draft_v1";
const DRAFT_OPEN_KEY = "seguros_novo_draft_open_v1";

const Seguros = () => {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<DadosSeguroNovo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAssessor, setFilterAssessor] = useState("");
  const [filterSeguradora, setFilterSeguradora] = useState<Seguradora | "">("");
  const [filterPeriodicidade, setFilterPeriodicidade] = useState<Periodicidade | "">("");
  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DadosSeguroNovo | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<DadosSeguroNovo>>({});
  const [valorParcelaDigits, setValorParcelaDigits] = useState("");
  const [percentComissaoDigits, setPercentComissaoDigits] = useState("");
  const [assessorOptions, setAssessorOptions] = useState<AssessorOption[]>([]);

  const getDraft = (): SeguroDraft | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SeguroDraft;
    } catch {
      return null;
    }
  };

  const setDraft = (draft: SeguroDraft) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      return;
    }
  };

  const setDraftOpen = (open: boolean) => {
    try {
      localStorage.setItem(DRAFT_OPEN_KEY, open ? "1" : "0");
    } catch {
      return;
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_OPEN_KEY);
    } catch {
      return;
    }
  };

  const clearDraftAndResetForm = () => {
    clearDraft();
    setForm({});
    setValorParcelaDigits("");
    setPercentComissaoDigits("");
    setEditing(null);
  };

  const assessorLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    assessorOptions.forEach((o) => {
      m.set(o.code, `${o.code} - ${o.name.toUpperCase()}`);
    });
    return m;
  }, [assessorOptions]);

  const loadRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dados_seguros_novo" as never)
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      toast.error(error.message || "Erro ao carregar seguros");
    } else {
      setRegistros((data as DadosSeguroNovo[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRegistros();
    (async () => {
      const { data: mvData, error: mvError } = await supabase
        .from("mv_resumo_assessor" as never)
        .select("data_posicao, cod_assessor, nome_assessor")
        .order("data_posicao", { ascending: false });

      const map = new Map<string, string>();

      if (!mvError && mvData && mvData.length > 0) {
        const rows = mvData as unknown as MvAssessorRow[];
        const latestDate = rows[0].data_posicao;
        const latestRows = rows.filter((d) => d.data_posicao === latestDate);
        latestRows.forEach((r) => {
          if (r.cod_assessor) {
            map.set(r.cod_assessor, r.nome_assessor || r.cod_assessor);
          }
        });
      }

      const { data: colabData, error: colabError } = await supabase
        .from("dados_colaboradores")
        .select("cod_assessor, nome_completo");

      if (!colabError && colabData) {
        const rows = colabData as { cod_assessor: string | null; nome_completo: string | null }[];
        rows.forEach((r) => {
          if (r.cod_assessor && !map.has(r.cod_assessor)) {
            map.set(r.cod_assessor, r.nome_completo || r.cod_assessor);
          }
        });
      }

      const opts = Array.from(map.entries()).map(([code, name]) => ({ code, name }));
      opts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
      setAssessorOptions(opts);
    })();
  }, []);

  useEffect(() => {
    if (editing) return;
    const draft = getDraft();
    if (draft) {
      setForm(draft.form || {});
      setValorParcelaDigits(draft.valorParcelaDigits || "");
      setPercentComissaoDigits(draft.percentComissaoDigits || "");
    }
    try {
      const shouldOpen = localStorage.getItem(DRAFT_OPEN_KEY) === "1";
      if (shouldOpen) setIsDialogOpen(true);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (editing) return;
    if (!isDialogOpen) {
      setDraftOpen(false);
      return;
    }
    setDraftOpen(true);
    setDraft({
      form,
      valorParcelaDigits,
      percentComissaoDigits,
    });
  }, [editing, form, isDialogOpen, percentComissaoDigits, valorParcelaDigits]);

  useEffect(() => {
    const parcela = onlyDigits(valorParcelaDigits) ? Number(onlyDigits(valorParcelaDigits)) / 100 : null;
    const pct = onlyDigits(percentComissaoDigits) ? Number(onlyDigits(percentComissaoDigits)) / 100 : null;
    const comissao = parcela !== null && pct !== null ? Number((parcela * (pct / 100)).toFixed(2)) : null;
    setForm((f) => ({ ...f, valor_parcela: parcela, percent_comissao: pct, valor_comissao: comissao }));
  }, [valorParcelaDigits, percentComissaoDigits]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = registros;

    if (term) {
      rows = rows.filter((r) => {
        const s = [
          r.inscricao,
          r.conta,
          r.cliente,
          r.cod_assessor,
          r.seguradora,
          r.periodicidade,
          r.data_inicial,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return s.includes(term);
      });
    }

    if (filterAssessor) {
      rows = rows.filter((r) => (r.cod_assessor || "") === filterAssessor);
    }

    if (filterSeguradora) {
      rows = rows.filter((r) => (r.seguradora || "") === filterSeguradora);
    }

    if (filterPeriodicidade) {
      rows = rows.filter((r) => (r.periodicidade || "") === filterPeriodicidade);
    }

    if (filterDataDe) {
      rows = rows.filter((r) => !!r.data_inicial && String(r.data_inicial) >= filterDataDe);
    }

    if (filterDataAte) {
      rows = rows.filter((r) => !!r.data_inicial && String(r.data_inicial) <= filterDataAte);
    }

    return rows;
  }, [filterAssessor, filterDataAte, filterDataDe, filterPeriodicidade, filterSeguradora, registros, searchTerm]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filterAssessor, filterDataAte, filterDataDe, filterPeriodicidade, filterSeguradora, searchTerm]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterAssessor("");
    setFilterSeguradora("");
    setFilterPeriodicidade("");
    setFilterDataDe("");
    setFilterDataAte("");
  };

  const activeFiltersCount = useMemo(() => {
    return [
      searchTerm.trim() ? 1 : 0,
      filterAssessor ? 1 : 0,
      filterSeguradora ? 1 : 0,
      filterPeriodicidade ? 1 : 0,
      filterDataDe ? 1 : 0,
      filterDataAte ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [filterAssessor, filterDataAte, filterDataDe, filterPeriodicidade, filterSeguradora, searchTerm]);

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (searchTerm.trim()) chips.push({ key: "q", label: `Busca: ${searchTerm.trim()}`, onClear: () => setSearchTerm("") });
    if (filterAssessor) chips.push({
      key: "assessor",
      label: `Assessor: ${assessorLabelByCode.get(filterAssessor) || filterAssessor}`,
      onClear: () => setFilterAssessor(""),
    });
    if (filterSeguradora) chips.push({ key: "seguradora", label: `Seguradora: ${filterSeguradora}`, onClear: () => setFilterSeguradora("") });
    if (filterPeriodicidade) chips.push({
      key: "periodicidade",
      label: `Periodicidade: ${filterPeriodicidade === "MENSAL" ? "Mensal" : "Anual"}`,
      onClear: () => setFilterPeriodicidade(""),
    });
    if (filterDataDe || filterDataAte) {
      const de = filterDataDe ? formatDateBR(filterDataDe) : "—";
      const ate = filterDataAte ? formatDateBR(filterDataAte) : "—";
      chips.push({ key: "data", label: `Data inicial: ${de} a ${ate}`, onClear: () => { setFilterDataDe(""); setFilterDataAte(""); } });
    }
    return chips;
  }, [assessorLabelByCode, filterAssessor, filterDataAte, filterDataDe, filterPeriodicidade, filterSeguradora, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    const draft = getDraft();
    if (draft) {
      setForm(draft.form || {});
      setValorParcelaDigits(draft.valorParcelaDigits || "");
      setPercentComissaoDigits(draft.percentComissaoDigits || "");
    } else {
      setForm({});
      setValorParcelaDigits("");
      setPercentComissaoDigits("");
    }
    setIsDialogOpen(true);
  };

  const openEdit = (r: DadosSeguroNovo) => {
    setEditing(r);
    setDraftOpen(false);
    setForm({
      ...r,
      inscricao: r.inscricao || "",
      conta: r.conta || "",
      cliente: r.cliente || "",
    });
    setValorParcelaDigits(r.valor_parcela !== null && r.valor_parcela !== undefined ? String(Math.round(Number(r.valor_parcela) * 100)) : "");
    setPercentComissaoDigits(r.percent_comissao !== null && r.percent_comissao !== undefined ? String(Math.round(Number(r.percent_comissao) * 100)) : "");
    setIsDialogOpen(true);
  };

  const validate = () => {
    const inscricao = onlyDigits(String(form.inscricao || ""));
    const contaRaw = String(form.conta || "");
    const conta = onlyDigits(contaRaw);
    const cliente = String(form.cliente || "").trim().toUpperCase();
    const codAssessor = String(form.cod_assessor || "").trim();
    const periodicidade = form.periodicidade as Periodicidade | undefined;
    const seguradora = form.seguradora as Seguradora | undefined;
    const dataInicial = String(form.data_inicial || "").trim();
    const parcela = form.valor_parcela;
    const pct = form.percent_comissao;

    if (!inscricao) return "Inscrição é obrigatória";
    if (contaRaw.trim() && !conta) return "Conta inválida";
    if (!cliente) return "Cliente é obrigatório";
    if (!codAssessor) return "Assessor é obrigatório";
    if (!periodicidade) return "Periodicidade é obrigatória";
    if (!seguradora) return "Seguradora é obrigatória";
    if (!dataInicial) return "Data inicial é obrigatória";
    if (typeof parcela !== "number" || isNaN(parcela)) return "Valor da parcela é obrigatório";
    if (typeof pct !== "number" || isNaN(pct)) return "% de comissão é obrigatório";

    return null;
  };

  const saveRegistro = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const nowIso = new Date().toISOString();
    const contaRaw = String(form.conta || "");

    const payload = {
      inscricao: onlyDigits(String(form.inscricao || "")),
      conta: contaRaw.trim() ? onlyDigits(contaRaw) : null,
      cliente: String(form.cliente || "").trim().toUpperCase(),
      cod_assessor: form.cod_assessor || null,
      periodicidade: form.periodicidade || null,
      seguradora: form.seguradora || null,
      valor_parcela: form.valor_parcela ?? null,
      percent_comissao: form.percent_comissao ?? null,
      valor_comissao: form.valor_comissao ?? null,
      data_inicial: form.data_inicial || null,
      updated_at: nowIso,
    };

    if (editing) {
      const { error } = await supabase
        .from("dados_seguros_novo" as never)
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message || "Erro ao atualizar registro");
      } else {
        toast.success("Registro atualizado");
        clearDraft();
        setIsDialogOpen(false);
        loadRegistros();
      }
      return;
    }

    const periodicidade = payload.periodicidade as Periodicidade;
    const baseDate = parseISO(String(payload.data_inicial));
    const dates =
      periodicidade === "MENSAL"
        ? Array.from({ length: 24 }, (_, i) => format(addMonths(baseDate, i), "yyyy-MM-dd"))
        : [0, 1, 2].map((y) => format(addYears(baseDate, y), "yyyy-MM-dd"));

    const insertRows = dates.map((d) => ({
      ...payload,
      data_inicial: d,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { error } = await supabase
      .from("dados_seguros_novo" as never)
      .insert(insertRows);

    if (error) {
      toast.error(error.message || "Erro ao criar registro");
    } else {
      toast.success(`${insertRows.length} parcelas lançadas`);
      clearDraft();
      setIsDialogOpen(false);
      loadRegistros();
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const { error } = await supabase
      .from("dados_seguros_novo" as never)
      .delete()
      .eq("id", confirmDeleteId);
    if (error) {
      toast.error(error.message || "Erro ao excluir registro");
    } else {
      toast.success("Registro excluído");
      loadRegistros();
    }
    setConfirmDeleteId(null);
  };

  const exportXlsx = () => {
    const rows = filtered.map((r) => ({
      Inscricao: r.inscricao || "",
      Conta: r.conta || "",
      Cliente: r.cliente || "",
      "Código Assessor": r.cod_assessor || "",
      Periodicidade: r.periodicidade || "",
      Seguradora: r.seguradora || "",
      "Valor Parcela": r.valor_parcela ?? "",
      "% Comissão": r.percent_comissao ?? "",
      "Valor Comissão": r.valor_comissao ?? "",
      "Data Inicial": r.data_inicial || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seguros");
    XLSX.writeFile(wb, "seguros.xlsx");
  };

  const periodicidadeOptions: { value: Periodicidade; label: string }[] = [
    { value: "MENSAL", label: "Mensal" },
    { value: "ANUAL", label: "Anual" },
  ];

  const seguradoraOptions: Seguradora[] = ["MAG", "ICATU", "METLIFE", "OMINT", "PRUDENTIAL"];

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">Seguros</h1>
            <p className="text-muted-foreground">Gerencie os dados de seguros</p>
          </div>
          <div className="flex items-center gap-2 md:pb-1">
            <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Novo Registro
            </Button>
            <Button variant="outline" onClick={exportXlsx} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar XLSX
            </Button>
          </div>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 md:max-w-[520px]">
                <Label className="sr-only">Busca</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por inscrição, conta, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <Button variant="outline" className="flex items-center gap-2" onClick={() => setFiltersOpen(true)}>
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                  <SheetContent side="right" className="w-full sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Filtros</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 grid grid-cols-1 gap-4">
                      <div>
                        <Label>Assessor</Label>
                        <Select value={filterAssessor} onValueChange={setFilterAssessor}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            {assessorOptions.map((o) => (
                              <SelectItem key={o.code} value={o.code}>
                                {o.code} - {o.name.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Seguradora</Label>
                        <Select value={filterSeguradora} onValueChange={(v) => setFilterSeguradora(v as Seguradora | "")}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            {seguradoraOptions.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Periodicidade</Label>
                        <Select value={filterPeriodicidade} onValueChange={(v) => setFilterPeriodicidade(v as Periodicidade | "")}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            {periodicidadeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>Data inicial (de)</Label>
                          <Input
                            type="date"
                            className=""
                            value={filterDataDe}
                            onChange={(e) => setFilterDataDe(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Data inicial (até)</Label>
                          <Input
                            type="date"
                            className=""
                            value={filterDataAte}
                            onChange={(e) => setFilterDataAte(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <SheetFooter className="mt-6">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          clearFilters();
                        }}
                      >
                        Limpar
                      </Button>
                      <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
                {activeFiltersCount > 0 && (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpar tudo
                  </Button>
                )}
              </div>
            </div>
            {filterChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filterChips.map((c) => (
                  <Badge key={c.key} variant="secondary" className="gap-2 pr-1">
                    <span className="truncate max-w-[420px]">{c.label}</span>
                    <button
                      type="button"
                      aria-label={`Remover filtro ${c.label}`}
                      className="rounded-full p-0.5 hover:bg-background/50"
                      onClick={c.onClear}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px] whitespace-nowrap">Inscrição</TableHead>
                <TableHead className="w-[320px] whitespace-nowrap">Cliente</TableHead>
                <TableHead className="w-[280px] whitespace-nowrap">Assessor</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Seguradora</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap text-right">Parcela</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap text-right">Comissão</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Data</TableHead>
                <TableHead className="w-[90px] whitespace-nowrap text-right">Ações</TableHead>
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
                    <TableCell className="font-medium whitespace-nowrap">{r.inscricao || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="truncate" title={r.cliente || ""}>
                        {r.cliente || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="truncate" title={r.cod_assessor ? (assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor) : ""}>
                        {r.cod_assessor ? (assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor) : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.seguradora || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.valor_parcela)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.valor_comissao)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateBR(r.data_inicial)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(r.id)} aria-label="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} {filtered.length === 1 ? "registro" : "registros"} • Página {page} de {pageCount}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPage((p) => Math.min(pageCount, p + 1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent
            className="max-w-3xl"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Seguro" : "Novo Seguro"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Inscrição</Label>
                <Input
                  value={String(form.inscricao ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, inscricao: onlyDigits(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Conta (opcional)</Label>
                <Input
                  value={String(form.conta ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, conta: onlyDigits(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Cliente</Label>
                <Input
                  value={String(form.cliente ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <Label>Assessor</Label>
                <Select value={String(form.cod_assessor ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, cod_assessor: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessorOptions.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.code} - {o.name.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Periodicidade</Label>
                <Select value={String(form.periodicidade ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, periodicidade: v as Periodicidade }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodicidadeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Seguradora</Label>
                <Select value={String(form.seguradora ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, seguradora: v as Seguradora }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {seguradoraOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da parcela</Label>
                <Input
                  value={valorParcelaDigits ? formatCurrency(Number(onlyDigits(valorParcelaDigits)) / 100) : ""}
                  onChange={(e) => setValorParcelaDigits(onlyDigits(e.target.value))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>% de comissão</Label>
                <Input
                  value={percentComissaoDigits ? formatNumberFromDigits(percentComissaoDigits, 2) : ""}
                  onChange={(e) => setPercentComissaoDigits(onlyDigits(e.target.value))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Valor comissão</Label>
                <Input value={form.valor_comissao !== null && form.valor_comissao !== undefined ? formatCurrency(form.valor_comissao) : ""} disabled />
              </div>
              <div>
                <Label>Data inicial</Label>
                <Input
                  type="date"
                  className=""
                  value={String(form.data_inicial ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicial: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              {!editing && (
                <Button variant="outline" onClick={clearDraftAndResetForm}>
                  Limpar rascunho
                </Button>
              )}
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveRegistro} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  );
};

export default Seguros;
