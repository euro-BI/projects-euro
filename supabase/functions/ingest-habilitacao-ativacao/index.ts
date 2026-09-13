import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BATCH_SIZE = 500;
const FONTES = new Set(["habilitacao", "ativacao"]);

type IncomingRow = Record<string, unknown>;
type Fonte = "habilitacao" | "ativacao";

type HabAtivRow = {
  fonte: Fonte;
  conta: string;
  cod_assessor: string;
  data: string;
  faixa: string | null;
  conta_ativada: string | null;
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateInUtc(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n > 20_000 && n < 80_000) {
      return dateInUtc(new Date(Date.UTC(1899, 11, 30) + n * 86_400_000));
    }
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function normalizeAssessor(value: unknown) {
  const digits = String(value ?? "").trim().toUpperCase().replace(/^A/, "").replace(/\D/g, "");
  return digits ? `A${digits}` : null;
}

function toStringValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = String(value).trim();
  return raw || null;
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

function resolveFonte(body: Record<string, unknown>): Fonte | null {
  const raw = String(body?.fonte ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (raw === "habilitacao" || raw === "habilitacoes") return "habilitacao";
  if (raw === "ativacao" || raw === "ativacoes") return "ativacao";
  return FONTES.has(raw) ? raw as Fonte : null;
}

function mapRow(row: IncomingRow, fonte: Fonte): HabAtivRow | null {
  const conta = toStringValue(pick(row, "conta", "Conta"));
  const codAssessor = normalizeAssessor(pick(row, "cod_assessor", "Assessor", "Cód. Assessor", "Cod. Assessor"));
  const data = parseDate(pick(row, "data", "Data"));
  if (!conta || !codAssessor || !data) return null;
  return {
    fonte,
    conta,
    cod_assessor: codAssessor,
    data,
    faixa: toStringValue(pick(row, "faixa", "Faixa")),
    conta_ativada: fonte === "habilitacao"
      ? toStringValue(pick(row, "conta_ativada", "Conta Ativada"))
      : null,
  };
}

function uniqueKey(row: HabAtivRow) {
  return `${row.fonte}|${row.conta}|${row.data}`;
}

function dedupeRows(rows: HabAtivRow[]) {
  const seen = new Map<string, HabAtivRow>();
  for (const row of rows) seen.set(uniqueKey(row), row);
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
    const fonte = resolveFonte(body);
    if (!fonte) return json(400, { error: "Informe fonte: habilitacao ou ativacao" });

    const incoming = Array.isArray(body?.rows) ? body.rows as IncomingRow[] : [];
    if (incoming.length === 0) return json(400, { error: "Nenhuma linha recebida" });

    const chunked = body?.chunked === true;
    const replaceMonths = chunked ? body?.replace_months === true : true;
    const rows = dedupeRows(incoming.map((row) => mapRow(row, fonte)).filter((row): row is HabAtivRow => row != null));
    const ignoradas = incoming.length - rows.length;
    if (rows.length === 0) {
      return json(400, { error: "Nenhuma linha válida (Conta, Assessor e Data são obrigatórios)", recebidas: incoming.length, ignoradas });
    }

    const monthsFromRows = [...new Set(rows.map((row) => monthStart(row.data)).filter((mes): mes is string => Boolean(mes)))].sort();
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
          .from("dados_habilitacao_ativacao")
          .delete()
          .eq("fonte", fonte)
          .gte("data", mes)
          .lt("data", nextMonthStart(mes));
        if (deleteError) throw deleteError;
      }
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_habilitacao_ativacao").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      fonte,
      recebidas: incoming.length,
      gravadas,
      ignoradas,
      meses_substituidos: months,
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-habilitacao-ativacao", error);
    return json(500, { error: errorMessage(error) });
  }
});
