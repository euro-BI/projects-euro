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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

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
  data_cancelamento: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssessorOption = { code: string; name: string };
type AdmConfig = { id: number; administradora: string; comissao_percent: number };
type StatusFilter = "all" | "active" | "cancelled";

const fieldClass =
  "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-[#F4F1E8] placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-euro-gold/40 focus-visible:ring-offset-0";
const dialogClass =
  "gap-5 border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px] p-6 sm:p-8";
const labelClass = "text-[13px] font-medium text-white/50";

const Consorcios = () => {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<DadosConsorcio[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DadosConsorcio | null>(null);
  const [cancellingRecord, setCancellingRecord] = useState<DadosConsorcio | null>(null);
  const [cancelForm, setCancelForm] = useState<{ data_cancelamento: string; observacao: string }>({ data_cancelamento: "", observacao: "" });
  const [form, setForm] = useState<Partial<DadosConsorcio>>({});
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
      const base = parts.join(".");
      return v.length >= 10 ? `${base}-${d.trim()}` : base;
    } else {
      const p = v.padEnd(14, "");
      const a = p.slice(0, 2);
      const b = p.slice(2, 5);
      const c = p.slice(5, 8);
      const d = p.slice(8, 12);
      const e = p.slice(12, 14);
      const mid = v.length >= 9 ? `/${d.trim()}` : "";
      const end = v.length >= 13 ? `-${e.trim()}` : "";
      return `${a.length ? `${a}` : ""}${v.length >= 3 ? `.${b}` : ""}${v.length >= 6 ? `.${c}` : ""}${mid}${end}`;
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
      const { data: mvData, error: mvError } = await supabase
        .from("mv_resumo_assessor" as any)
        .select("data_posicao, cod_assessor, nome_assessor")
        .order("data_posicao", { ascending: false });

      const map = new Map<string, string>();

      if (!mvError && mvData && mvData.length > 0) {
        const latestDate = mvData[0].data_posicao;
        const latestRows = mvData.filter((d: any) => d.data_posicao === latestDate);
        latestRows.forEach((r: any) => {
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
    return registros.filter((r) => {
      if (statusFilter === "active" && r.data_cancelamento) return false;
      if (statusFilter === "cancelled" && !r.data_cancelamento) return false;
      if (!term) return true;
      const assessor = r.cod_assessor ? assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor : "";
      const s = [
        r.administradora,
        r.cliente,
        r.cpf_cnpj,
        r.produto,
        r.contrato,
        assessor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return s.includes(term);
    });
  }, [registros, searchTerm, statusFilter, assessorLabelByCode]);

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
  const endIndex = Math.min(sorted.length, startIndex + pageSize);
  const pageItems = sorted.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, registros.length]);

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
    const payload: Omit<DadosConsorcio, "id" | "created_at" | "updated_at"> = {
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

  const openCancelamento = (r: DadosConsorcio) => {
    setCancellingRecord(r);
    setCancelForm({ data_cancelamento: "", observacao: "" });
  };

  const doCancelamento = async () => {
    if (!cancellingRecord) return;
    if (!cancelForm.data_cancelamento) {
      toast.error("Informe a data do cancelamento");
      return;
    }
    const { error } = await supabase
      .from("dados_consorcio")
      .update({
        data_cancelamento: cancelForm.data_cancelamento,
        observacao: cancelForm.observacao || null,
      })
      .eq("id", cancellingRecord.id);
    if (error) {
      toast.error("Erro ao cancelar consórcio");
    } else {
      toast.success("Consórcio cancelado com sucesso");
      loadRegistros();
    }
    setCancellingRecord(null);
    setCancelForm({ data_cancelamento: "", observacao: "" });
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

  const saveProduct = async () => {
    const name = productName.trim().toUpperCase();
    if (!name || !productAdminId) {
      toast.error("Informe o nome do produto");
      return;
    }
    const { error } = await supabase
      .from("dados_produtos_consorcio")
      .insert({ administradora_id: productAdminId, nome_produto: name });
    if (error) {
      toast.error("Erro ao salvar produto");
      return;
    }
    toast.success("Produto adicionado");
    setProductDialogOpen(false);
    setProductName("");
    await loadAdminProducts();
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
            <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-4xl">Consórcios</h1>
            <p className="mt-2 text-sm text-white/45">Vendas, comissões e administradoras.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
              Configurações
            </GhostButton>
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

        <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              placeholder="Buscar cliente, contrato, CPF, assessor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(fieldClass, "h-12 pl-11")}
            />
          </div>
          <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {([
              ["all", "Todos"],
              ["active", "Ativos"],
              ["cancelled", "Cancelados"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "h-10 rounded-xl px-3.5 text-sm transition-colors",
                  statusFilter === value
                    ? "bg-euro-gold text-euro-navy font-semibold"
                    : "text-white/50 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 shrink-0 text-xs text-white/35">
          {loading ? "Carregando..." : `${sorted.length} ${sorted.length === 1 ? "registro" : "registros"}`}
        </p>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
          <span className="pointer-events-none block h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.025] text-[11px] uppercase tracking-wide text-white/40">
                  <th className="px-5 py-3.5 font-medium">Cliente</th>
                  <th className="px-4 py-3.5 font-medium">Administradora</th>
                  <th className="px-4 py-3.5 font-medium">Assessor</th>
                  <th className="px-4 py-3.5 font-medium">Produto</th>
                  <th className="px-4 py-3.5 font-medium">Venda</th>
                  <th className="px-4 py-3.5 font-medium text-right">Comissão</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
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
                  pageItems.map((r) => {
                    const cancelled = !!r.data_cancelamento;
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.035]",
                          cancelled && "opacity-60",
                        )}
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">{r.cliente || "—"}</p>
                          <p className="mt-0.5 text-xs text-white/40">
                            {r.contrato ? `Contrato ${r.contrato}` : "Sem contrato"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <AdminChip
                            name={r.administradora}
                            percent={r.administradora ? adminCommissions[r.administradora] : undefined}
                            formatPercent={formatPercent}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-white/75">
                          {r.cod_assessor ? assessorLabelByCode.get(r.cod_assessor) || r.cod_assessor : "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-white/75">{r.produto || "—"}</td>
                        <td className="px-4 py-4 font-data text-sm tabular-nums text-white/75">{formatDateBR(r.data_venda)}</td>
                        <td className="px-4 py-4 text-right font-data text-sm tabular-nums text-euro-gold">
                          {formatCurrency(r.valor_comissao_total)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusChip cancelled={cancelled} />
                        </td>
                        <td className="px-5 py-4">
                          <RowActions
                            cancelled={cancelled}
                            onView={() => setViewing(r)}
                            onEdit={() => openEdit(r)}
                            onCancel={() => openCancelamento(r)}
                          />
                        </td>
                      </tr>
                    );
                  })
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
              pageItems.map((r) => {
                const cancelled = !!r.data_cancelamento;
                return (
                  <div key={r.id} className={cn("space-y-3 px-5 py-4", cancelled && "opacity-60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{r.cliente || "—"}</p>
                        <p className="mt-0.5 text-xs text-white/40">{r.contrato ? `Contrato ${r.contrato}` : "Sem contrato"}</p>
                      </div>
                      <StatusChip cancelled={cancelled} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                      <AdminChip
                        name={r.administradora}
                        percent={r.administradora ? adminCommissions[r.administradora] : undefined}
                        formatPercent={formatPercent}
                      />
                      <span>{r.produto || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="font-data text-sm tabular-nums text-euro-gold">{formatCurrency(r.valor_comissao_total)}</p>
                      <RowActions
                        cancelled={cancelled}
                        onView={() => setViewing(r)}
                        onEdit={() => openEdit(r)}
                        onCancel={() => openCancelamento(r)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-5 flex shrink-0 items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            {sorted.length === 0 ? "Nenhum item" : `${startIndex + 1}–${endIndex} de ${sorted.length}`}
          </p>
          <div className="flex items-center gap-2">
            <GhostButton
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-10 w-10 px-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </GhostButton>
            <span className="min-w-[4.5rem] text-center text-sm text-white/60">
              {currentPage} / {totalPages}
            </span>
            <GhostButton
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-10 w-10 px-0"
            >
              <ChevronRight className="h-4 w-4" />
            </GhostButton>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className={cn(dialogClass, "max-w-5xl")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {editing ? "Editar registro" : "Novo registro"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-4">
              <Field label="Administradora">
                <Select value={form.administradora || ""} onValueChange={(v) => setForm((f) => ({ ...f, administradora: v }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {adminOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Código assessor">
                <Select value={form.cod_assessor || ""} onValueChange={(v) => setForm((f) => ({ ...f, cod_assessor: v }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {assessorOptions.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {`${opt.code} - ${opt.name.toUpperCase()}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data venda">
                <Input type="date" value={form.data_venda || ""} onChange={(e) => setForm((f) => ({ ...f, data_venda: e.target.value }))} className={fieldClass} />
              </Field>
              <Field label="Produto">
                <Select value={form.produto || ""} onValueChange={(v) => setForm((f) => ({ ...f, produto: v }))}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Observação" className="md:col-span-2">
                <Input value={form.observacao || ""} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} className={fieldClass} />
              </Field>
              <Field label="Código cliente">
                <Input inputMode="numeric" pattern="[0-9]*" value={form.codigo_cliente || ""} onChange={(e) => setForm((f) => ({ ...f, codigo_cliente: e.target.value.replace(/\D/g, "") }))} className={fieldClass} />
              </Field>
              <Field label="Cliente">
                <Input value={form.cliente || ""} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} className={fieldClass} />
              </Field>
              <Field label="CPF/CNPJ">
                <Input inputMode="numeric" pattern="[0-9]*" value={formatCpfCnpjMask(form.cpf_cnpj || "")} onChange={(e) => setForm((f) => ({ ...f, cpf_cnpj: e.target.value.replace(/\D/g, "") }))} className={fieldClass} />
              </Field>
              <Field label="Contrato">
                <Input inputMode="numeric" pattern="[0-9]*" value={form.contrato || ""} onChange={(e) => setForm((f) => ({ ...f, contrato: e.target.value.replace(/\D/g, "") }))} className={fieldClass} />
              </Field>
              <Field label="Grupo">
                <Input inputMode="numeric" pattern="[0-9]*" value={form.grupo || ""} onChange={(e) => setForm((f) => ({ ...f, grupo: e.target.value.replace(/\D/g, "") }))} className={fieldClass} />
              </Field>
              <Field label="Cota">
                <Input inputMode="numeric" pattern="[0-9]*" value={form.cota || ""} onChange={(e) => setForm((f) => ({ ...f, cota: e.target.value.replace(/\D/g, "") }))} className={fieldClass} />
              </Field>
              <Field label="Valor carta">
                <Input type="number" value={form.valor_carta ?? ""} onChange={(e) => setForm((f) => ({ ...f, valor_carta: e.target.value ? Number(e.target.value) : null }))} className={fieldClass} />
              </Field>
              <Field label="Comissão total">
                <Input type="number" value={form.valor_comissao_total ?? ""} readOnly className={cn(fieldClass, "text-euro-gold")} />
              </Field>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <GhostButton onClick={() => setIsDialogOpen(false)}>Cancelar</GhostButton>
              <button type="button" onClick={save} className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90">
                Salvar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className={cn(dialogClass, "max-w-lg")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Administradoras</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Nome da administradora">
                <Input value={settingsForm.administradora} onChange={(e) => setSettingsForm((f) => ({ ...f, administradora: e.target.value.toUpperCase() }))} className={fieldClass} />
              </Field>
              <Field label="% Comissão">
                <Input value={settingsForm.comissao_percent} onChange={(e) => setSettingsForm((f) => ({ ...f, comissao_percent: e.target.value }))} className={fieldClass} />
              </Field>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/40">
                      <th className="px-3 py-2.5 text-left font-medium">Administradora</th>
                      <th className="px-3 py-2.5 text-left font-medium">%</th>
                      <th className="px-3 py-2.5 text-right font-medium">Produto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admConfigs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-white/40">Nenhuma configuração cadastrada</td>
                      </tr>
                    ) : (
                      admConfigs.map((c) => (
                        <tr key={c.id} className="border-b border-white/[0.06] last:border-0">
                          <td className="px-3 py-2.5 text-white">{c.administradora}</td>
                          <td className="px-3 py-2.5 text-white/70">{formatPercent(c.comissao_percent)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => { setProductAdminId(c.id); setProductDialogOpen(true); }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 hover:border-euro-gold/40 hover:text-euro-gold"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <GhostButton onClick={() => setSettingsOpen(false)}>Cancelar</GhostButton>
              <button type="button" onClick={saveSettings} className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90">
                Salvar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className={cn(dialogClass, "max-w-md")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Adicionar produto</DialogTitle>
            </DialogHeader>
            <Field label="Nome do produto">
              <Input value={productName} onChange={(e) => setProductName(e.target.value.toUpperCase())} className={fieldClass} />
            </Field>
            <DialogFooter className="gap-2">
              <GhostButton onClick={() => { setProductDialogOpen(false); setProductName(""); }}>Cancelar</GhostButton>
              <button type="button" onClick={saveProduct} className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90">
                Salvar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!cancellingRecord} onOpenChange={(open) => !open && setCancellingRecord(null)}>
          <DialogContent className={cn(dialogClass, "max-w-md")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Cancelar consórcio</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Data do cancelamento *">
                <Input
                  type="date"
                  value={cancelForm.data_cancelamento}
                  onChange={(e) => setCancelForm((f) => ({ ...f, data_cancelamento: e.target.value }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="Motivo do cancelamento">
                <Input
                  placeholder="Informe o motivo"
                  value={cancelForm.observacao}
                  onChange={(e) => setCancelForm((f) => ({ ...f, observacao: e.target.value }))}
                  className={fieldClass}
                />
              </Field>
            </div>
            <DialogFooter className="gap-2">
              <GhostButton onClick={() => setCancellingRecord(null)}>Voltar</GhostButton>
              <button
                type="button"
                onClick={doCancelamento}
                className="inline-flex h-11 items-center rounded-2xl bg-red-500 px-5 text-sm font-semibold text-white hover:bg-red-500/90"
              >
                Confirmar cancelamento
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
          <DialogContent className={cn(dialogClass, "max-w-4xl")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Detalhes do consórcio</DialogTitle>
            </DialogHeader>
            {viewing && (
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-3">
                <Detail label="Administradora" value={viewing.administradora} />
                <Detail label="Assessor" value={viewing.cod_assessor ? assessorLabelByCode.get(viewing.cod_assessor) || viewing.cod_assessor : viewing.cod_assessor} />
                <Detail label="Data da venda" value={formatDateBR(viewing.data_venda)} />
                <Detail label="Produto" value={viewing.produto} />
                <Detail label="Observação" value={viewing.observacao} className="sm:col-span-2" />
                <Detail label="Código do cliente" value={viewing.codigo_cliente} />
                <Detail label="Cliente" value={viewing.cliente} />
                <Detail label="CPF/CNPJ" value={formatCpfCnpjMask(viewing.cpf_cnpj)} />
                <Detail label="Contrato" value={viewing.contrato} />
                <Detail label="Grupo" value={viewing.grupo} />
                <Detail label="Cota" value={viewing.cota} />
                <Detail label="Valor carta" value={formatCurrency(viewing.valor_carta)} />
                <Detail label="Comissão total" value={formatCurrency(viewing.valor_comissao_total)} highlight />
              </div>
            )}
          </DialogContent>
        </Dialog>
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

function Detail({
  label,
  value,
  className,
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-wide text-white/35">{label}</p>
      <p className={cn("mt-1 text-sm", highlight ? "font-medium text-euro-gold" : "text-white")}>{value || "—"}</p>
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

function AdminChip({
  name,
  percent,
  formatPercent,
}: {
  name: string | null;
  percent?: number;
  formatPercent: (n: number | null | undefined) => string;
}) {
  const dot =
    name === "MAPFRE" ? "bg-red-400" :
    name === "ADEMICON" ? "bg-euro-gold" :
    name === "CONSÓRCIO XP" ? "bg-sky-400" :
    "bg-white/50";

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">
        {name || "—"}
        {percent !== undefined ? ` · ${formatPercent(percent)}` : ""}
      </span>
    </span>
  );
}

function StatusChip({ cancelled }: { cancelled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
        cancelled
          ? "border-red-400/25 bg-red-400/15 text-red-300"
          : "border-emerald-400/25 bg-emerald-400/15 text-emerald-300",
      )}
    >
      {cancelled ? "Cancelado" : "Ativo"}
    </span>
  );
}

function RowActions({
  cancelled,
  onView,
  onEdit,
  onCancel,
}: {
  cancelled: boolean;
  onView: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <IconAction label="Ver" onClick={onView}><Eye className="h-4 w-4" /></IconAction>
      <IconAction label="Editar" onClick={onEdit}><Edit className="h-4 w-4" /></IconAction>
      <IconAction label={cancelled ? "Já cancelado" : "Cancelar"} onClick={onCancel} disabled={cancelled} danger>
        <Ban className="h-4 w-4" />
      </IconAction>
    </div>
  );
}

function IconAction({
  children,
  onClick,
  disabled,
  danger,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30",
        danger && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300",
      )}
    >
      {children}
    </button>
  );
}

export default Consorcios;
