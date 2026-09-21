import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BATCH_SIZE = 500;

type IncomingRow = Record<string, unknown>;

type MigracaoRegra = {
  cliente: string;
  assessor_destino: string;
  assessor_origem: string | null;
  desde_data: string;
};

type PositivadorRow = {
  assessor: string;
  cliente: string;
  sexo: string | null;
  data_cadastro: string | null;
  data_nascimento: string | null;
  status: string | null;
  receita_bovespa: string | null;
  receita_futuros: string | null;
  receita_rf_bancarios: string | null;
  receita_rf_privados: string | null;
  receita_rf_publicos: string | null;
  net_em_m: string | null;
  tipo_pessoa: string | null;
  data_posicao: string;
  data_atualizacao: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function pick(row: IncomingRow, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const wanted = normalizeHeader(key);
    const hit = entries.find(([name]) => normalizeHeader(name) === wanted);
    if (hit && hit[1] != null && hit[1] !== "") return hit[1];
  }
  return null;
}

function normalizeHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function dateInSaoPaulo(value: Date) {
  return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateInSaoPaulo(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + Math.round(value) * 86_400_000;
    return dateInSaoPaulo(new Date(ms));
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return dateInSaoPaulo(parsed);
  return null;
}

function normalizeAssessor(value: unknown) {
  const digits = String(value ?? "").trim().toUpperCase().replace(/^A/, "").replace(/\D/g, "");
  return digits || null;
}

function toStringValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const raw = String(value).trim();
  return raw || null;
}

function normalizeTipoPessoa(...values: unknown[]) {
  for (const value of values) {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) continue;
    if (raw.includes("PESSOA JUR") || raw.startsWith("PJ")) return "PESSOA JURÍDICA";
    if (raw.includes("PESSOA FIS") || raw.startsWith("PF") || raw.includes("PRIVATE")) return "PESSOA FÍSICA";
    if (raw === "PESSOA FÍSICA" || raw === "PESSOA FISICA") return "PESSOA FÍSICA";
  }
  return null;
}

function monthStart(date: string) {
  const raw = String(date ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (!iso) return null;
  return `${iso[1]}-${iso[2]}-01`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }
  return "Erro inesperado";
}

function nextMonthStart(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function normalizeCliente(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function assessorDigits(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/^A/, "").replace(/\D/g, "");
}

function assessorComRegra(
  assessor: string,
  cliente: string,
  dataPosicao: string,
  regras: Map<string, MigracaoRegra>,
) {
  const regra = regras.get(cliente);
  if (!regra) return assessor;
  if (dataPosicao < regra.desde_data) return assessor;
  if (regra.assessor_origem) {
    const origem = assessorDigits(regra.assessor_origem);
    if (origem && assessorDigits(assessor) !== origem) return assessor;
  }
  const destino = assessorDigits(regra.assessor_destino);
  return destino || assessor;
}

function rowKey(row: Pick<PositivadorRow, "assessor" | "cliente" | "data_posicao">) {
  return `${row.assessor}|${row.cliente}|${row.data_posicao}`;
}

function mapRow(
  row: IncomingRow,
  regras: Map<string, MigracaoRegra>,
): Omit<PositivadorRow, "data_atualizacao"> | null {
  const assessor = normalizeAssessor(pick(row, "assessor", "Assessor", "Cod Assessor", "Código Assessor"));
  const cliente = normalizeCliente(pick(
    row,
    "cliente",
    "Cliente",
    "Conta",
    "Cod Cliente",
    "Código Cliente",
    "Codigo Cliente",
    "Código do Cliente",
    "Codigo do Cliente",
  ));
  const dataPosicao = parseDate(pick(row, "data_posicao", "Data Posição", "Data Posicao", "Data"));
  if (!assessor || !cliente || !dataPosicao) return null;

  return {
    assessor: assessorComRegra(assessor, cliente, dataPosicao, regras),
    cliente,
    sexo: toStringValue(pick(row, "sexo", "Sexo")),
    data_cadastro: parseDate(pick(row, "data_cadastro", "Data de Cadastro")),
    data_nascimento: parseDate(pick(row, "data_nascimento", "Data de Nascimento")),
    status: toStringValue(pick(row, "status", "Status")),
    receita_bovespa: toStringValue(pick(row, "receita_bovespa", "Receita Bovespa")),
    receita_futuros: toStringValue(pick(row, "receita_futuros", "Receita Futuros")),
    receita_rf_bancarios: toStringValue(pick(row, "receita_rf_bancarios", "Receita RF Bancários", "Receita RF Bancarios")),
    receita_rf_privados: toStringValue(pick(row, "receita_rf_privados", "Receita RF Privados")),
    receita_rf_publicos: toStringValue(pick(row, "receita_rf_publicos", "Receita RF Públicos", "Receita RF Publicos")),
    net_em_m: toStringValue(pick(row, "net_em_m", "Net Em M", "Net em M")),
    tipo_pessoa: normalizeTipoPessoa(
      pick(row, "tipo_pessoa", "Tipo Pessoa"),
      pick(row, "Segmentação Cliente", "Segmentacao Cliente"),
    ),
    data_posicao: dataPosicao,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Use POST" });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "JWT obrigatório" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(500, { error: "Credenciais internas do Supabase ausentes" });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Sessão inválida" });
    }

    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body?.rows) ? body.rows as IncomingRow[] : [];
    if (incoming.length === 0) {
      return json(400, { error: "Nenhuma linha recebida" });
    }

    const chunked = body?.chunked === true;
    const replaceMonths = chunked ? body?.replace_months === true : true;
    const aplicarRealocacao = chunked ? body?.aplicar_realocacao === true : true;

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: regrasRows, error: regrasError } = await supabase
      .from("cliente_assessor_regra")
      .select("cliente, assessor_destino, assessor_origem, desde_data")
      .eq("ativo", true);
    if (regrasError) throw regrasError;

    const regras = new Map<string, MigracaoRegra>();
    for (const row of (regrasRows ?? []) as MigracaoRegra[]) {
      const cliente = normalizeCliente(row.cliente);
      if (!cliente) continue;
      regras.set(cliente, {
        cliente,
        assessor_destino: row.assessor_destino,
        assessor_origem: row.assessor_origem,
        desde_data: String(row.desde_data).slice(0, 10),
      });
    }

    const mapped = incoming.map((row) => mapRow(row, regras));
    const valid = mapped.filter((row): row is Omit<PositivadorRow, "data_atualizacao"> => row != null);
    const unique = new Map<string, Omit<PositivadorRow, "data_atualizacao">>();
    for (const row of valid) unique.set(rowKey(row), row);
    const deduped = [...unique.values()];
    const ignoradas = incoming.length - valid.length;
    const duplicadas = valid.length - deduped.length;

    if (deduped.length === 0) {
      return json(400, {
        error: "Nenhuma linha válida (assessor, cliente e data são obrigatórios)",
        recebidas: incoming.length,
        ignoradas,
        duplicadas,
      });
    }

    const dataAtualizacao = parseDate(body?.data_atualizacao)
      || deduped.reduce((max, row) => row.data_posicao > max ? row.data_posicao : max, deduped[0].data_posicao);
    const rows: PositivadorRow[] = deduped.map((row) => ({ ...row, data_atualizacao: dataAtualizacao }));
    const monthsFromRows = [...new Set(rows.map((row) => monthStart(row.data_posicao)).filter((mes): mes is string => Boolean(mes)))].sort();
    const requestedMonths = Array.isArray(body?.meses_substituir)
      ? [...new Set((body.meses_substituir as unknown[]).map((mes) => monthStart(String(mes))).filter((mes): mes is string => Boolean(mes)))].sort()
      : [];
    const months = requestedMonths.length > 0 ? requestedMonths : monthsFromRows;

    if (replaceMonths) {
      for (const mes of months) {
        const { error: deleteError } = await supabase
          .from("dados_positivador")
          .delete()
          .gte("data_posicao", mes)
          .lt("data_posicao", nextMonthStart(mes));
        if (deleteError) throw deleteError;
      }
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("dados_positivador")
        .upsert(batch, { onConflict: "assessor,cliente,data_posicao" });
      if (upsertError) throw upsertError;
      gravadas += batch.length;
    }

    let realocados = 0;
    if (aplicarRealocacao && regras.size > 0) {
      for (const regra of regras.values()) {
        const destino = assessorDigits(regra.assessor_destino);
        if (!destino) continue;
        let query = supabase
          .from("dados_positivador")
          .update({ assessor: destino }, { count: "exact" })
          .eq("cliente", regra.cliente)
          .gte("data_posicao", regra.desde_data)
          .neq("assessor", destino);
        if (regra.assessor_origem) {
          const origem = assessorDigits(regra.assessor_origem);
          if (origem) query = query.eq("assessor", origem);
        }
        const { error: realocacaoError, count } = await query;
        if (realocacaoError) throw realocacaoError;
        realocados += count ?? 0;
      }
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      ignoradas,
      duplicadas,
      meses_substituidos: months,
      data_atualizacao: dataAtualizacao,
      clientes_realocados: realocados,
      regras_ativas: regras.size,
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-positivador", error);
    return json(500, { error: errorMessage(error) });
  }
});
