import { useRef } from "react";
import { models } from "powerbi-client";

export interface Workspace {
  id: string;
  name: string;
  isReadOnly: boolean;
  isOnDedicatedCapacity: boolean;
}

export interface Report {
  id: string;
  name: string;
  embedUrl: string;
  webUrl: string;
  workspaceId: string; // Adicionado para facilitar o uso
  workspaceName?: string; // Adicionado para facilitar a exibição
}

export interface ReportPage {
  name: string;
  displayName: string;
  order: number;
}

interface EmbedToken {
  token: string;
  tokenId: string;
  expiration: string;
}

// Usamos um useRef para armazenar o accessToken e evitar recriação desnecessária
const accessTokenRef = { current: null as string | null };

/**
 * Obtém o Access Token para autenticação com o Power BI via Service Principal.
 * Reutiliza o token se ainda for válido.
 * @returns Promise<string> O access token.
 */
export const getAccessToken = async (): Promise<string> => {
  if (accessTokenRef.current) {
    return accessTokenRef.current;
  }

  try {
    let response;
    
    if (import.meta.env.DEV) {
      const tenantId = import.meta.env.VITE_MSAL_TENANT_ID;
      const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_MSAL_CLIENT_SECRET;
      
      response = await fetch(`/microsoft-token/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        })
      });
    } else {
      response = await fetch(`/api/powerbi?path=get-access-token`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Erro ao obter access token:", errorData);
      throw new Error(`Falha na autenticação: ${response.status}`);
    }

    const data = await response.json();
    accessTokenRef.current = data.access_token;
    
    // Renovar token antes de expirar (50 minutos)
    setTimeout(() => {
      accessTokenRef.current = null;
    }, 50 * 60 * 1000);

    return data.access_token;
  } catch (error) {
    console.error("Erro ao obter token:", error);
    throw new Error("Não foi possível autenticar com o Power BI.");
  }
};

/**
 * Obtém o Embed Token para um relatório específico.
 * @param workspaceId O ID do workspace.
 * @param reportId O ID do relatório.
 * @returns Promise<string> O embed token.
 */
export const getEmbedToken = async (workspaceId: string, reportId: string): Promise<string> => {
  const accessToken = await getAccessToken();
  
  try {
    let response;
    const path = `v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
    
    if (import.meta.env.DEV) {
      response = await fetch(`/powerbi-api/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessLevel: 'View' })
      });
    } else {
      response = await fetch(`/api/powerbi?path=${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessLevel: 'View' })
      });
    }

    if (!response.ok) {
      throw new Error('Falha ao gerar embed token');
    }

    const data: EmbedToken = await response.json();
    return data.token;
  } catch (error) {
    console.error("Erro ao obter embed token:", error);
    throw error;
  }
};

/**
 * Obtém a lista de todos os workspaces do Power BI.
 * @returns Promise<Workspace[]> A lista de workspaces.
 */
export const getWorkspaces = async (): Promise<Workspace[]> => {
  const accessToken = await getAccessToken();
  
  try {
    let response;
    const path = "v1.0/myorg/groups";
    
    if (import.meta.env.DEV) {
      response = await fetch(`/powerbi-api/${path}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } else {
      response = await fetch(`/api/powerbi?path=${path}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao carregar workspaces: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  } catch (e) {
    console.error("Erro ao carregar workspaces:", e);
    throw e;
  }
};

/**
 * Obtém a lista de relatórios em um workspace específico.
 * @param workspaceId O ID do workspace.
 * @returns Promise<Report[]> A lista de relatórios.
 */
export const getReportsInWorkspace = async (workspaceId: string): Promise<Report[]> => {
  const accessToken = await getAccessToken();
  
  try {
    let response;
    const path = `v1.0/myorg/groups/${workspaceId}/reports`;
    
    if (import.meta.env.DEV) {
      response = await fetch(`/powerbi-api/${path}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } else {
      response = await fetch(`/api/powerbi?path=${path}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao carregar relatórios do workspace ${workspaceId}: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  } catch (e) {
    console.error(`Erro ao carregar relatórios do workspace ${workspaceId}:`, e);
    throw e;
  }
};

/**
 * Obtém todos os relatórios de todos os workspaces.
 * @returns Promise<Report[]> Uma lista consolidada de todos os relatórios.
 */
export const getAllReports = async (): Promise<Report[]> => {
  try {
    const workspaces = await getWorkspaces();
    let allReports: Report[] = [];

    for (const workspace of workspaces) {
      const reports = await getReportsInWorkspace(workspace.id);
      const reportsWithWorkspaceData = reports.map(report => ({
        ...report,
        workspaceId: workspace.id,
        workspaceName: workspace.name
      }));
      allReports = allReports.concat(reportsWithWorkspaceData);
    }
    return allReports;
  } catch (e) {
    console.error("Erro ao obter todos os relatórios:", e);
    throw e;
  }
};

/**
 * Obtém as páginas de um relatório específico.
 * @param workspaceId O ID do workspace.
 * @param reportId O ID do relatório.
 * @returns Promise<ReportPage[]> A lista de páginas.
 */
export const getReportPages = async (workspaceId: string, reportId: string): Promise<ReportPage[]> => {
  const accessToken = await getAccessToken();
  
  try {
    let response;
    const path = `v1.0/myorg/groups/${workspaceId}/reports/${reportId}/pages`;
    
    if (import.meta.env.DEV) {
      response = await fetch(`/powerbi-api/${path}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } else {
      response = await fetch(`/api/powerbi?path=${path}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao carregar páginas do relatório: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  } catch (e) {
    console.error(`Erro ao carregar páginas do relatório ${reportId}:`, e);
    throw e;
  }
};
