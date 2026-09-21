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

type DiversificadorRow = {
  assessor: string;
  cliente: string;
  produto: string | null;
  subproduto: string | null;
  cnpj: string | null;
  fator_risco: string | null;
  ativo: string | null;
  data_vencimento: string | null;
  net: string | null;
  data_posicao: string;
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

function dateInUtc(value: Date) {
  return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateInUtc(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + Math.round(value) * 86_400_000;
    return dateInUtc(new Date(ms));
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return dateInUtc(parsed);
  return null;
}

function normalizeAssessor(value: unknown) {
  const digits = String(value ?? "").trim().toUpperCase().replace(/^A/, "").replace(/\D/g, "");
  return digits || null;
}

function normalizeCliente(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function toStringValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const raw = String(value).trim();
  return raw || null;
}

function normalizeProdutoKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isSomenteFinanceiro(produto: unknown) {
  return normalizeProdutoKey(produto) === "somente financeiro";
}

function monthStart(date: string) {
  const raw = String(date ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (!iso) return null;
  return `${iso[1]}-${iso[2]}-01`;
}

function nextMonthStart(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }
  return "Erro inesperado";
}

function rowKey(row: DiversificadorRow) {
  return [
    row.data_posicao,
    row.assessor,
    row.cliente,
    row.produto ?? "",
    row.subproduto ?? "",
    row.ativo ?? "",
    row.cnpj ?? "",
    row.data_vencimento ?? "",
    row.net ?? "",
  ].join("|");
}

function mapRow(row: IncomingRow): { row: DiversificadorRow | null; descartadaFinanceiro: boolean; invalida: boolean } {
  const produtoRaw = pick(row, "produto", "Produto");
  if (isSomenteFinanceiro(produtoRaw)) {
    return { row: null, descartadaFinanceiro: true, invalida: false };
  }

  const assessor = normalizeAssessor(pick(row, "assessor", "Assessor", "Cod Assessor", "Código Assessor"));
  const cliente = normalizeCliente(pick(row, "cliente", "Cliente", "Conta", "Cod Cliente"));
  const dataPosicao = parseDate(pick(row, "data", "Data", "data_posicao", "Data Posição", "Data Posicao"));
  if (!assessor || !cliente || !dataPosicao) {
    return { row: null, descartadaFinanceiro: false, invalida: true };
  }

  return {
    row: {
      assessor,
      cliente,
      produto: toStringValue(produtoRaw),
      subproduto: toStringValue(pick(row, "subproduto", "Sub Produto", "SubProduto", "Sub produto")),
      cnpj: toStringValue(pick(row, "cnpj", "CNPJ Fundo", "CNPJ", "cnpj fundo")),
      fator_risco: toStringValue(pick(row, "fator_risco", "Fator Risco", "Fator de Risco")),
      ativo: toStringValue(pick(row, "ativo", "Ativo")),
      data_vencimento: parseDate(pick(row, "data_vencimento", "Data de Vencimento", "Data Vencimento", "Vencimento")),
      net: toStringValue(pick(row, "net", "NET", "Net")),
      data_posicao: dataPosicao,
    },
    descartadaFinanceiro: false,
    invalida: false,
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

    let descartadasFinanceiro = 0;
    let invalidas = 0;
    const unique = new Map<string, DiversificadorRow>();
    for (const raw of incoming) {
      const mapped = mapRow(raw);
      if (mapped.descartadaFinanceiro) {
        descartadasFinanceiro += 1;
        continue;
      }
      if (mapped.invalida || !mapped.row) {
        invalidas += 1;
        continue;
      }
      unique.set(rowKey(mapped.row), mapped.row);
    }

    const rows = [...unique.values()];
    const duplicadas = incoming.length - descartadasFinanceiro - invalidas - rows.length;

    if (rows.length === 0) {
      return json(400, {
        error: "Nenhuma linha válida (assessor, cliente e data são obrigatórios; 'Somente Financeiro' é descartado)",
        recebidas: incoming.length,
        descartadas_somente_financeiro: descartadasFinanceiro,
        ignoradas: invalidas,
        duplicadas,
      });
    }

    const monthsFromRows = [...new Set(rows.map((row) => monthStart(row.data_posicao)).filter((mes): mes is string => Boolean(mes)))].sort();
    const requestedMonths = Array.isArray(body?.meses_substituir)
      ? [...new Set((body.meses_substituir as unknown[]).map((mes) => monthStart(String(mes))).filter((mes): mes is string => Boolean(mes)))].sort()
      : [];
    const months = requestedMonths.length > 0 ? requestedMonths : monthsFromRows;

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (replaceMonths) {
      for (const mes of months) {
        const { error: deleteError } = await supabase
          .from("dados_diversificador_full")
          .delete()
          .gte("data_posicao", mes)
          .lt("data_posicao", nextMonthStart(mes));
        if (deleteError) throw deleteError;
      }
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_diversificador_full").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      descartadas_somente_financeiro: descartadasFinanceiro,
      ignoradas: invalidas,
      duplicadas,
      meses_substituidos: months,
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-diversificador", error);
    return json(500, { error: errorMessage(error) });
  }
});
