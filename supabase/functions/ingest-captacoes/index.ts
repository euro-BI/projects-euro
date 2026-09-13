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

type CaptacaoRow = {
  data_captacao: string;
  cod_assessor: string | null;
  cod_cliente: string;
  tipo_captacao: string | null;
  aux: string | null;
  valor_captacao: number;
  data_atualizacao: string;
  tipo_pessoa: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function todaySaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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
  const digits = String(value ?? "").trim().toUpperCase().replace(/^A/, "");
  const code = digits.replace(/\D/g, "");
  return code ? `A${code}` : null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") && !raw.includes(".")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTipoPessoa(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes("PESSOA JUR") || raw.startsWith("PJ")) return "PESSOA JURÍDICA";
  if (raw.includes("PESSOA FIS") || raw.startsWith("PF") || raw.includes("PRIVATE")) return "PESSOA FÍSICA";
  return raw;
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

function mapRow(row: IncomingRow, uploadedAt: string): CaptacaoRow | null {
  const dataCaptacao = parseDate(
    pick(row, "data_captacao", "Data", "Data da Captação", "Data Captacao"),
  );
  const codCliente = String(
    pick(row, "cod_cliente", "Cód do Cliente", "Cod do Cliente", "Codigo do Cliente") ?? "",
  ).trim();
  if (!dataCaptacao || !codCliente) return null;

  return {
    data_captacao: dataCaptacao,
    cod_assessor: normalizeAssessor(pick(row, "cod_assessor", "Assessor")),
    cod_cliente: codCliente,
    tipo_captacao: String(pick(row, "tipo_captacao", "Tipo de Captação", "Tipo de Captacao") ?? "").trim() || null,
    aux: String(pick(row, "aux", "Aux") ?? "").trim() || null,
    valor_captacao: parseNumber(pick(row, "valor_captacao", "Captação", "Captacao")),
    data_atualizacao: parseDate(pick(row, "data_atualizacao", "Data Atualização", "Data Atualizacao")) || uploadedAt,
    tipo_pessoa: normalizeTipoPessoa(pick(row, "tipo_pessoa", "Tipo Pessoa", "Segmentação Cliente", "Segmentacao Cliente")),
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

    const uploadedAt = todaySaoPaulo();
    const mapped = incoming.map((row) => mapRow(row, uploadedAt));
    const rows = mapped.filter((row): row is CaptacaoRow => row != null);
    const ignoradas = incoming.length - rows.length;

    if (rows.length === 0) {
      return json(400, { error: "Nenhuma linha válida (data_captacao e cliente são obrigatórios)", recebidas: incoming.length, ignoradas });
    }

    const dias = [...new Set(rows.map((row) => row.data_captacao))].sort();
    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const dia of dias) {
      const { error: deleteError } = await supabase
        .from("dados_captacoes")
        .delete()
        .eq("data_captacao", dia);
      if (deleteError) throw deleteError;
    }

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_captacoes").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      ignoradas,
      dias_substituidos: dias,
      meses_substituidos: [...new Set(dias.map((dia) => monthStart(dia)).filter((mes): mes is string => Boolean(mes)))],
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-captacoes", error);
    return json(500, { error: errorMessage(error) });
  }
});
