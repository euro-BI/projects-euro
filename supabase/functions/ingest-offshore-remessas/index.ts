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

type RemessaRow = {
  date: string;
  data_abertura_conta: string | null;
  valor_ordem_remessa_rs: string | null;
  taxa_percentual_spread: string | null;
  ordem_realizada_mercado: string | null;
  cod_assessor: string | null;
  nome_matriz: string | null;
  segmento: string | null;
  canal: string | null;
  identificador_unico_ordem: string;
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
  return value.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateInSaoPaulo(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return dateInSaoPaulo(new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000));
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
  return digits ? `A${digits}` : null;
}

function toStringValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const raw = String(value).trim();
  return raw || null;
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function nextMonthStart(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function mapRow(row: IncomingRow): RemessaRow | null {
  const date = parseDate(pick(row, "date", "Date", "Data"));
  const identificador = toStringValue(pick(
    row,
    "identificador_unico_ordem",
    "Identificador Único da Ordem - Câmbio",
    "Identificador Unico da Ordem - Cambio",
    "Identificador Único da Ordem",
  ));
  if (!date || !identificador) return null;

  return {
    date,
    data_abertura_conta: parseDate(pick(row, "data_abertura_conta", "Data de Abertura da Conta Offshore Digital")),
    valor_ordem_remessa_rs: toStringValue(pick(row, "valor_ordem_remessa_rs", "Valor da Ordem de Remessa (R$)")),
    taxa_percentual_spread: toStringValue(pick(row, "taxa_percentual_spread", "Taxa Percentual do Spread")),
    ordem_realizada_mercado: toStringValue(pick(row, "ordem_realizada_mercado", "Ordem realizada com o Mercado Aberto ou Fechado?")),
    cod_assessor: normalizeAssessor(pick(row, "cod_assessor", "Código do Assessor", "Codigo do Assessor")),
    nome_matriz: toStringValue(pick(row, "nome_matriz", "Nome da Matriz")),
    segmento: toStringValue(pick(row, "segmento", "Segmento")),
    canal: toStringValue(pick(row, "canal", "Canal")),
    identificador_unico_ordem: identificador,
  };
}

function dedupeRows(rows: RemessaRow[]) {
  const seen = new Map<string, RemessaRow>();
  for (const row of rows) seen.set(row.identificador_unico_ordem, row);
  return [...seen.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "JWT obrigatório" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { error: "Credenciais internas do Supabase ausentes" });

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Sessão inválida" });

    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body?.rows) ? body.rows as IncomingRow[] : [];
    if (incoming.length === 0) return json(400, { error: "Nenhuma linha recebida" });

    const chunked = body?.chunked === true;
    const replaceMonths = chunked ? body?.replace_months === true : true;
    const rows = dedupeRows(incoming.map(mapRow).filter((row): row is RemessaRow => row != null));
    const ignoradas = incoming.length - rows.length;
    if (rows.length === 0) {
      return json(400, { error: "Nenhuma linha válida (Date e identificador da ordem são obrigatórios)", recebidas: incoming.length, ignoradas });
    }

    const monthsFromRows = [...new Set(rows.map((row) => monthStart(row.date)))].sort();
    const months = Array.isArray(body?.meses_substituir) && body.meses_substituir.length > 0
      ? [...new Set((body.meses_substituir as unknown[]).map((mes) => monthStart(String(mes))))].sort()
      : monthsFromRows;

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (replaceMonths) {
      for (const mes of months) {
        const { error: deleteError } = await supabase
          .from("dados_offshore_remessas")
          .delete()
          .gte("date", mes)
          .lt("date", nextMonthStart(mes));
        if (deleteError) throw deleteError;
      }
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_offshore_remessas").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      ignoradas,
      meses_substituidos: months,
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-offshore-remessas", error);
    return json(500, { error: error instanceof Error ? error.message : "Erro inesperado" });
  }
});
