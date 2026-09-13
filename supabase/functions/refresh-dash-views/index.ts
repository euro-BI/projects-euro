import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const VIEWS = new Set(["mv_resumo_assessor", "mv_detalhamento_ativacoes"]);
const STEPS = new Set([...VIEWS, "snapshot"]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }
  return "Erro inesperado";
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
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(500, { error: "Credenciais internas do Supabase ausentes" });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Sessão inválida" });

    const body = await req.json().catch(() => ({}));
    const viewName = String(body?.view ?? "").trim();
    if (!STEPS.has(viewName)) {
      return json(400, { error: "Informe view: mv_resumo_assessor, mv_detalhamento_ativacoes ou snapshot" });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (viewName === "snapshot") {
      const { data, error } = await supabase.rpc("capture_dash_refresh_snapshot", {
        p_created_by: userData.user.id,
      });
      if (error) throw error;
      return json(200, {
        ok: true,
        view: "snapshot",
        snapshot: data,
        user_id: userData.user.id,
      });
    }

    const { data, error } = await supabase.rpc("refresh_dashboard_view", { view_name: viewName });
    if (error) throw error;

    return json(200, {
      ok: true,
      view: viewName,
      result: data,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("refresh-dash-views", error);
    return json(500, { error: errorMessage(error) });
  }
});
