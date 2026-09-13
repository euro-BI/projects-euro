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

type NpsRow = {
  assessor: string;
  conta: string;
  data_envio: string | null;
  tipo_convite: string | null;
  jornada: string | null;
  abriu_email: string | null;
  data_resposta: string | null;
  continha_pergunta: null;
  nota_assessor: null;
  nota_nps_aniversario: number | null;
  nota_nps_onboarding: number | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function pick(row: IncomingRow, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const wanted = normalizeHeader(key);
    const exact = entries.find(([name]) => normalizeHeader(name) === wanted);
    if (exact && exact[1] != null && exact[1] !== "") return exact[1];
  }
  for (const key of keys) {
    const wanted = normalizeHeader(key);
    const fuzzy = entries.find(([name]) => {
      const normalized = normalizeHeader(name);
      return normalized === wanted || normalized.startsWith(`${wanted} `) || normalized.includes(wanted);
    });
    if (fuzzy && fuzzy[1] != null && fuzzy[1] !== "") return fuzzy[1];
  }
  return null;
}

function pickEmailOpened(row: IncomingRow) {
  for (const [name, value] of Object.entries(row)) {
    if (value == null || value === "") continue;
    const normalized = normalizeHeader(name);
    if (normalized.includes("email opened") && !normalized.includes("time")) return value;
    if (normalized === "abriu email" || normalized === "abriu_email") return value;
  }
  return null;
}

function pickAllTokens(row: IncomingRow, ...tokens: string[]) {
  const wanted = tokens.map((token) => normalizeHeader(token));
  for (const [name, value] of Object.entries(row)) {
    if (value == null || value === "") continue;
    const normalized = normalizeHeader(name);
    if (wanted.every((token) => normalized.includes(token))) return value;
  }
  return null;
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

function toIntScore(value: unknown) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function mapOnboardingNota(value: unknown) {
  if (value == null || value === "") return null;
  const raw = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (raw.includes("promotor")) return 10;
  if (raw.includes("neutro")) return 7;
  if (raw.includes("detrator")) return 3;
  return toIntScore(value);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }
  return "Erro inesperado";
}

function mapRow(row: IncomingRow): NpsRow | null {
  const assessor = normalizeAssessor(pick(row, "cod_assessor", "assessor"));
  const conta = toStringValue(pick(row, "cod_conta", "conta"));
  if (!assessor || !conta) return null;

  return {
    assessor,
    conta,
    data_envio: parseDate(pick(row, "record date", "data_envio", "data envio")),
    tipo_convite: toStringValue(pick(row, "distribution category", "tipo_convite")),
    jornada: toStringValue(pick(row, "survey id", "jornada")),
    abriu_email: toStringValue(pickEmailOpened(row)),
    data_resposta: parseDate(pick(row, "survey finished time", "data_resposta", "data resposta")),
    continha_pergunta: null,
    nota_assessor: null,
    nota_nps_aniversario: toIntScore(pickAllTokens(row, "q1", "aniversario") ?? pickAllTokens(row, "recomendaria o seu assessor")),
    nota_nps_onboarding: mapOnboardingNota(
      pickAllTokens(row, "primeira experiencia", "jornada 3 2")
        ?? pickAllTokens(row, "onboarding", "grupo"),
    ),
  };
}

function uniqueKey(row: NpsRow) {
  return [row.assessor, row.conta, row.data_envio, row.tipo_convite, row.jornada].join("|");
}

function dedupeRows(rows: NpsRow[]) {
  const seen = new Map<string, NpsRow>();
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
    const incoming = Array.isArray(body?.rows) ? body.rows as IncomingRow[] : [];
    if (incoming.length === 0) return json(400, { error: "Nenhuma linha recebida" });

    const chunked = body?.chunked === true;
    const replaceAll = chunked ? body?.replace_all === true : true;
    const rows = dedupeRows(incoming.map(mapRow).filter((row): row is NpsRow => row != null));
    const ignoradas = incoming.length - rows.length;
    if (rows.length === 0) {
      return json(400, { error: "Nenhuma linha válida (cod_assessor e cod_conta são obrigatórios)", recebidas: incoming.length, ignoradas });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (replaceAll) {
      const { error: deleteError } = await supabase
        .from("dados_nps")
        .delete()
        .not("id", "is", null);
      if (deleteError) throw deleteError;
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_nps").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      ignoradas,
      tabela_substituida: replaceAll,
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-nps", error);
    return json(500, { error: errorMessage(error) });
  }
});
