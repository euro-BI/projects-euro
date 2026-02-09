import { supabase } from "@/integrations/supabase/client";

export interface DashboardSettings {
  id?: string; // Optional for creation, Supabase will generate
  dashboard_id: string;
  is_visible: boolean;
  assigned_users: string[]; // Array of user UUIDs
  created_at?: string;
  updated_at?: string;
}

const TABLE_NAME = "powerbi_dashboard_settings";

/**
 * Obtém as configurações de um dashboard específico.
 * @param dashboardId O ID do dashboard do Power BI.
 * @returns Promise<DashboardSettings | null> As configurações do dashboard ou null se não encontradas.
 */
export const getDashboardSettings = async (
  dashboardId: string
): Promise<DashboardSettings | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("dashboard_id", dashboardId)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 means "no rows found"
    console.error("Erro ao buscar configurações do dashboard:", error);
    throw new Error(`Erro ao buscar configurações do dashboard: ${error.message}`);
  }

  return data || null;
};

/**
 * Obtém todas as configurações de dashboards.
 * @returns Promise<DashboardSettings[]> Uma lista de todas as configurações de dashboards.
 */
export const getAllDashboardSettings = async (): Promise<DashboardSettings[]> => {
  const { data, error } = await supabase.from(TABLE_NAME).select("*");

  if (error) {
    console.error("Erro ao buscar todas as configurações de dashboards:", error);
    throw new Error(`Erro ao buscar todas as configurações de dashboards: ${error.message}`);
  }

  return data || [];
};

/**
 * Cria ou atualiza as configurações de um dashboard.
 * Se um registro com o dashboard_id já existir, ele será atualizado. Caso contrário, um novo será criado.
 * @param settings As configurações do dashboard a serem salvas.
 * @returns Promise<DashboardSettings> As configurações salvas.
 */
export const upsertDashboardSettings = async (
  settings: Omit<DashboardSettings, "id" | "created_at" | "updated_at">
): Promise<DashboardSettings> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      {
        dashboard_id: settings.dashboard_id,
        is_visible: settings.is_visible,
        assigned_users: settings.assigned_users,
      },
      { onConflict: "dashboard_id" } // Upsert based on dashboard_id
    )
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar configurações do dashboard:", error);
    throw new Error(`Erro ao salvar configurações do dashboard: ${error.message}`);
  }

  return data;
};

/**
 * Remove as configurações de um dashboard específico.
 * @param dashboardId O ID do dashboard do Power BI.
 * @returns Promise<void>
 */
export const deleteDashboardSettings = async (dashboardId: string): Promise<void> => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("dashboard_id", dashboardId);

  if (error) {
    console.error("Erro ao deletar configurações do dashboard:", error);
    throw new Error(`Erro ao deletar configurações do dashboard: ${error.message}`);
  }
};
