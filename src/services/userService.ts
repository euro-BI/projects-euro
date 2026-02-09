import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_image_url: string | null;
  is_active: boolean | null;
  role: string | null; // Adicionado para incluir o papel do usuário
}

/**
 * Busca todos os usuários com seus perfis e papéis.
 * @returns Promise<UserProfile[]> Uma lista de objetos UserProfile.
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const { data: profilesData, error: profilesError } = await supabase
      .from("projects_profiles")
      .select(`
        id,
        first_name,
        last_name,
        profile_image_url,
        is_active
      `);

    if (profilesError) {
      console.error("Erro ao buscar perfis:", profilesError);
      throw new Error(`Erro ao buscar perfis: ${profilesError.message}`);
    }

    // 2. Buscar todos os papéis dos usuários
    const { data: rolesData, error: rolesError } = await supabase
      .from("projects_user_roles")
      .select(`
        user_id,
        role
      `);

    if (rolesError) {
      console.error("Erro ao buscar papéis dos usuários:", rolesError);
      throw new Error(`Erro ao buscar papéis dos usuários: ${rolesError.message}`);
    }

    // Mapear os papéis para um objeto para fácil acesso
    const userRolesMap = rolesData.reduce((acc, curr) => {
      if (!acc[curr.user_id]) {
        acc[curr.user_id] = [];
      }
      acc[curr.user_id].push(curr.role);
      return acc;
    }, {} as Record<string, string[]>);

    // 3. Buscar emails dos usuários do auth.users (COMENTADO TEMPORARIAMENTE DEVIDO A ERRO DE PERMISSÃO)
    // const userIds = profilesData.map(profile => profile.id);
    // const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
    //   ids: userIds,
    // });

    // if (authError) {
    //   console.error("Erro ao buscar emails dos usuários:", authError);
    //   throw new Error(`Erro ao buscar emails dos usuários: ${authError.message}`);
    // }

    // 4. Combinar todos os dados
    const usersWithEmailAndRole = profilesData.map(profile => {
      // const authUser = authUsers.users.find(u => u.id === profile.id);
      const roles = userRolesMap[profile.id] || [];
      // Para simplificar, pegamos o primeiro papel. Se precisar de múltiplos, a interface UserProfile precisaria ser ajustada.
      const primaryRole = roles.length > 0 ? roles[0] : null;

      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: null, // Definido como null temporariamente
        profile_image_url: profile.profile_image_url,
        is_active: profile.is_active,
        role: primaryRole,
      };
    });

    return usersWithEmailAndRole;
  } catch (e) {
    console.error("Erro geral ao buscar usuários:", e);
    throw e;
  }
};
