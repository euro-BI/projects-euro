import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { HubAtmosphere } from "@/components/home/HubAtmosphere";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { addMonths, addYears, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type Periodicidade = "MENSAL" | "ANUAL" | "1 MÊS" | "2 MESES" | "3 MESES";
type Seguradora = "MAG" | "ICATU" | "METLIFE" | "OMINT" | "PRUDENTIAL" | "N/A";
type Produto = "PLANO DE SAÚDE" | "SEGURO DE VEÍCULOS" | "SEGURO RC" | "HOLDING" | "OFFSHORE" | "SEGURO DE VIDA";

type DadosSeguroNovo = {
  id: number;
  inscricao: string | null;
  conta: string | null;
  cliente: string | null;
  cod_assessor: string | null;
  periodicidade: Periodicidade | null;
  seguradora: Seguradora | null;
  produto: Produto | null;
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

const fieldClass =
  "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-[#F4F1E8] placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-euro-gold/40 focus-visible:ring-offset-0";
const dialogClass =
  "gap-5 border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px] p-6 sm:p-8";
const labelClass = "text-[13px] font-medium text-white/50";

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

const periodicidadeOptions: { value: Periodicidade; label: string }[] = [
  { value: "MENSAL", label: "Mensal" },
  { value: "ANUAL", label: "Anual" },
  { value: "1 MÊS", label: "1 Mês" },
  { value: "2 MESES", label: "2 Meses" },
  { value: "3 MESES", label: "3 Meses" },
];

const seguradoraOptions: Seguradora[] = ["MAG", "ICATU", "METLIFE", "OMINT", "PRUDENTIAL", "N/A"];
const produtoOptions: Produto[] = ["PLANO DE SAÚDE", "SEGURO DE VEÍCULOS", "SEGURO RC", "HOLDING", "OFFSHORE", "SEGURO DE VIDA"];

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
        const assessor = r.cod_assessor ? assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor : "";
        const s = [
          r.inscricao,
          r.conta,
          r.cliente,
          r.cod_assessor,
          assessor,
          r.seguradora,
          r.produto,
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
  }, [assessorLabelByCode, filterAssessor, filterDataAte, filterDataDe, filterPeriodicidade, filterSeguradora, registros, searchTerm]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = filtered.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(filtered.length, startIndex + pageSize);
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
    if (filterPeriodicidade) {
      const label = periodicidadeOptions.find((o) => o.value === filterPeriodicidade)?.label || filterPeriodicidade;
      chips.push({
        key: "periodicidade",
        label: `Periodicidade: ${label}`,
        onClear: () => setFilterPeriodicidade(""),
      });
    }
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
    const produto = form.produto as Produto | undefined;
    const dataInicial = String(form.data_inicial || "").trim();
    const parcela = form.valor_parcela;
    const pct = form.percent_comissao;

    if (!inscricao) return "Inscrição é obrigatória";
    if (contaRaw.trim() && !conta) return "Conta inválida";
    if (!cliente) return "Cliente é obrigatório";
    if (!codAssessor) return "Assessor é obrigatório";
    if (!periodicidade) return "Periodicidade é obrigatória";
    if (!produto) return "Produto é obrigatório";
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
      seguradora: form.seguradora || "N/A",
      produto: form.produto || null,
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

    let dates: string[] = [];
    if (periodicidade === "MENSAL") {
      dates = Array.from({ length: 24 }, (_, i) => format(addMonths(baseDate, i), "yyyy-MM-dd"));
    } else if (periodicidade === "ANUAL") {
      dates = [0, 1, 2].map((y) => format(addYears(baseDate, y), "yyyy-MM-dd"));
    } else if (periodicidade === "1 MÊS") {
      dates = [format(baseDate, "yyyy-MM-dd")];
    } else if (periodicidade === "2 MESES") {
      dates = Array.from({ length: 2 }, (_, i) => format(addMonths(baseDate, i), "yyyy-MM-dd"));
    } else if (periodicidade === "3 MESES") {
      dates = Array.from({ length: 3 }, (_, i) => format(addMonths(baseDate, i), "yyyy-MM-dd"));
    } else {
      dates = [format(baseDate, "yyyy-MM-dd")];
    }

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
      Produto: r.produto || "",
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

  return (
    <PageLayout className="relative overflow-hidden bg-transparent font-ui text-[#F4F1E8] selection:bg-euro-gold/30">
      <HubAtmosphere />

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] w-full flex-col px-5 py-6 sm:px-8 lg:px-10 xl:px-12">
        <header className="mb-6 flex shrink-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-5 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Início
            </button>
            <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-4xl">Seguros</h1>
            <p className="mt-2 text-sm text-white/45">Produção, parcelas e comissões da carteira.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={exportXlsx}>
              <Download className="h-4 w-4" />
              Exportar
            </GhostButton>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-euro-gold px-4 text-sm font-semibold text-euro-navy transition-colors hover:bg-euro-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo registro
            </button>
          </div>
        </header>

        <div className="mb-4 flex shrink-0 flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                placeholder="Buscar cliente, inscrição, assessor, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(fieldClass, "h-12 pl-11")}
              />
            </div>
            <GhostButton onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-euro-gold px-1.5 text-[11px] font-semibold text-euro-navy">
                  {activeFiltersCount}
                </span>
              )}
            </GhostButton>
            {activeFiltersCount > 0 && (
              <GhostButton onClick={clearFilters}>Limpar</GhostButton>
            )}
          </div>

          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="h-3 w-3 shrink-0 text-white/45" />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mb-3 shrink-0 text-xs text-white/35">
          {loading ? "Carregando..." : `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`}
        </p>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
          <span className="pointer-events-none block h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.025] text-[11px] uppercase tracking-wide text-white/40">
                  <th className="px-5 py-3.5 font-medium">Cliente</th>
                  <th className="px-4 py-3.5 font-medium">Assessor</th>
                  <th className="px-4 py-3.5 font-medium">Seguradora</th>
                  <th className="px-4 py-3.5 font-medium">Periodicidade</th>
                  <th className="px-4 py-3.5 font-medium text-right">Parcela</th>
                  <th className="px-4 py-3.5 font-medium text-right">Comissão</th>
                  <th className="px-4 py-3.5 font-medium">Data</th>
                  <th className="px-5 py-3.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-white/40">Carregando registros...</td>
                  </tr>
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-white/40">Nenhum registro encontrado</td>
                  </tr>
                ) : (
                  pageItems.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.035]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{r.cliente || "—"}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          {[r.inscricao ? `Inscrição ${r.inscricao}` : null, r.produto].filter(Boolean).join(" · ") || "Sem inscrição"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-white/75">
                        {r.cod_assessor ? assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <InsurerChip name={r.seguradora} />
                      </td>
                      <td className="px-4 py-4 text-sm text-white/75">
                        {periodicidadeOptions.find((o) => o.value === r.periodicidade)?.label || r.periodicidade || "—"}
                      </td>
                      <td className="px-4 py-4 text-right font-data text-sm tabular-nums text-white/80">
                        {formatCurrency(r.valor_parcela)}
                      </td>
                      <td className="px-4 py-4 text-right font-data text-sm tabular-nums text-euro-gold">
                        {formatCurrency(r.valor_comissao)}
                      </td>
                      <td className="px-4 py-4 font-data text-sm tabular-nums text-white/75">{formatDateBR(r.data_inicial)}</td>
                      <td className="px-5 py-4">
                        <RowActions
                          onEdit={() => openEdit(r)}
                          onDelete={() => setConfirmDeleteId(r.id)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/[0.06] md:hidden">
            {loading ? (
              <p className="px-5 py-16 text-center text-white/40">Carregando registros...</p>
            ) : pageItems.length === 0 ? (
              <p className="px-5 py-16 text-center text-white/40">Nenhum registro encontrado</p>
            ) : (
              pageItems.map((r) => (
                <div key={r.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{r.cliente || "—"}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {[r.inscricao ? `Inscrição ${r.inscricao}` : null, r.produto].filter(Boolean).join(" · ") || "Sem inscrição"}
                      </p>
                    </div>
                    <InsurerChip name={r.seguradora} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-data text-sm tabular-nums text-euro-gold">{formatCurrency(r.valor_comissao)}</p>
                      <p className="text-xs text-white/40">{formatCurrency(r.valor_parcela)} · {formatDateBR(r.data_inicial)}</p>
                    </div>
                    <RowActions
                      onEdit={() => openEdit(r)}
                      onDelete={() => setConfirmDeleteId(r.id)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex shrink-0 items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            {filtered.length === 0 ? "Nenhum item" : `${startIndex + 1}–${endIndex} de ${filtered.length}`}
          </p>
          <div className="flex items-center gap-2">
            <GhostButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-10 w-10 px-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </GhostButton>
            <span className="min-w-[4.5rem] text-center text-sm text-white/60">
              {page} / {pageCount}
            </span>
            <GhostButton
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="h-10 w-10 px-0"
            >
              <ChevronRight className="h-4 w-4" />
            </GhostButton>
          </div>
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="right" className="w-full border-white/10 bg-[#12141A] text-[#F4F1E8] sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="text-2xl font-semibold tracking-tight text-white">Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-6 grid grid-cols-1 gap-4">
              <Field label="Assessor">
                <Select value={filterAssessor} onValueChange={setFilterAssessor}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    {assessorOptions.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.code} - {o.name.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Seguradora">
                <Select value={filterSeguradora} onValueChange={(v) => setFilterSeguradora(v as Seguradora | "")}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    {seguradoraOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Periodicidade">
                <Select value={filterPeriodicidade} onValueChange={(v) => setFilterPeriodicidade(v as Periodicidade | "")}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    {periodicidadeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Data inicial (de)">
                  <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Data inicial (até)">
                  <Input type="date" value={filterDataAte} onChange={(e) => setFilterDataAte(e.target.value)} className={fieldClass} />
                </Field>
              </div>
            </div>
            <SheetFooter className="mt-6 gap-2 sm:space-x-0">
              <GhostButton onClick={clearFilters}>Limpar</GhostButton>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90"
              >
                Aplicar
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent
            className={cn(dialogClass, "max-w-3xl")}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {editing ? "Editar seguro" : "Novo seguro"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <Field label="Inscrição">
                <Input
                  value={String(form.inscricao ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, inscricao: onlyDigits(e.target.value) }))}
                  inputMode="numeric"
                  className={fieldClass}
                />
              </Field>
              <Field label="Conta (opcional)">
                <Input
                  value={String(form.conta ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, conta: onlyDigits(e.target.value) }))}
                  inputMode="numeric"
                  className={fieldClass}
                />
              </Field>
              <Field label="Cliente" className="md:col-span-2">
                <Input
                  value={String(form.cliente ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value.toUpperCase() }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="Assessor">
                <Select value={String(form.cod_assessor ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, cod_assessor: v }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {assessorOptions.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.code} - {o.name.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Produto">
                <Select
                  value={String(form.produto ?? "")}
                  onValueChange={(v) => {
                    const newProduto = v as Produto;
                    const validForHolding = ["1 MÊS", "2 MESES", "3 MESES"];
                    const validForOthers = ["MENSAL", "ANUAL"];
                    let newPeriodicidade = form.periodicidade;

                    if (newProduto === "HOLDING" && (!newPeriodicidade || !validForHolding.includes(newPeriodicidade))) {
                      newPeriodicidade = null;
                    } else if (newProduto !== "HOLDING" && (!newPeriodicidade || !validForOthers.includes(newPeriodicidade))) {
                      newPeriodicidade = null;
                    }

                    setForm((f) => ({ ...f, produto: newProduto, periodicidade: newPeriodicidade }));
                  }}
                >
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {produtoOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Seguradora">
                <Select value={String(form.seguradora ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, seguradora: v as Seguradora }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {seguradoraOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Periodicidade">
                <Select value={String(form.periodicidade ?? "")} onValueChange={(v) => setForm((f) => ({ ...f, periodicidade: v as Periodicidade }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {periodicidadeOptions
                      .filter((o) =>
                        form.produto === "HOLDING"
                          ? ["1 MÊS", "2 MESES", "3 MESES"].includes(o.value)
                          : ["MENSAL", "ANUAL"].includes(o.value),
                      )
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor da parcela">
                <Input
                  value={valorParcelaDigits ? formatCurrency(Number(onlyDigits(valorParcelaDigits)) / 100) : ""}
                  onChange={(e) => setValorParcelaDigits(onlyDigits(e.target.value))}
                  inputMode="numeric"
                  className={fieldClass}
                />
              </Field>
              <Field label="% de comissão">
                <Input
                  value={percentComissaoDigits ? formatNumberFromDigits(percentComissaoDigits, 2) : ""}
                  onChange={(e) => setPercentComissaoDigits(onlyDigits(e.target.value))}
                  inputMode="numeric"
                  className={fieldClass}
                />
              </Field>
              <Field label="Valor comissão">
                <Input
                  value={form.valor_comissao !== null && form.valor_comissao !== undefined ? formatCurrency(form.valor_comissao) : ""}
                  disabled
                  className={cn(fieldClass, "text-euro-gold")}
                />
              </Field>
              <Field label="Data inicial">
                <Input
                  type="date"
                  value={String(form.data_inicial ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicial: e.target.value }))}
                  className={fieldClass}
                />
              </Field>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              {!editing && (
                <GhostButton onClick={clearDraftAndResetForm}>Limpar rascunho</GhostButton>
              )}
              <GhostButton onClick={() => setIsDialogOpen(false)}>Cancelar</GhostButton>
              <button
                type="button"
                onClick={saveRegistro}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90"
              >
                <Plus className="h-4 w-4" />
                Salvar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
          <AlertDialogContent className="border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-white">Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription className="text-white/50">
                Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="h-11 rounded-2xl bg-red-500 text-white hover:bg-red-500/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  );
};

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className={labelClass}>{label}</Label>
      {children}
    </div>
  );
}

function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function InsurerChip({ name }: { name: string | null }) {
  const dot =
    name === "MAG" ? "bg-euro-gold" :
    name === "ICATU" ? "bg-sky-400" :
    name === "METLIFE" ? "bg-blue-400" :
    name === "OMINT" ? "bg-emerald-400" :
    name === "PRUDENTIAL" ? "bg-violet-400" :
    "bg-white/40";

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">{name || "—"}</span>
    </span>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <IconAction label="Editar" onClick={onEdit}><Edit className="h-4 w-4" /></IconAction>
      <IconAction label="Excluir" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconAction>
    </div>
  );
}

function IconAction({
  children,
  onClick,
  danger,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
        danger && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300",
      )}
    >
      {children}
    </button>
  );
}

export default Seguros;
