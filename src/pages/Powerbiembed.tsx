import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, LayoutDashboard, FileBarChart, ArrowLeft, Maximize, Minimize, RefreshCw } from "lucide-react";
import { PowerBIEmbed } from "powerbi-client-react";
import { models } from "powerbi-client";
import { getAllDashboardSettings } from "@/services/dashboardSettingsService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Workspace {
  id: string;
  name: string;
  isReadOnly: boolean;
  isOnDedicatedCapacity: boolean;
}

interface Report {
  id: string;
  name: string;
  embedUrl: string;
  webUrl: string;
}

interface EmbedToken {
  token: string;
  tokenId: string;
  expiration: string;
}

export default function PowerBIEmbedPage() {
  const { user, userRole } = useAuth();
  // Estados de navegação
  const [view, setView] = useState<"workspaces" | "reports" | "embed">("workspaces");
  
  // Estados de dados
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenHeader, setShowFullscreenHeader] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"fitToPage" | "fitToWidth" | "actualSize">("fitToWidth");
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<any>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Obter Access Token via Service Principal
  const getAccessToken = useCallback(async (): Promise<string> => {
    // Se já temos um token válido, reutilizar
    if (accessTokenRef.current) {
      return accessTokenRef.current;
    }

    try {
      let response;
      
      if (import.meta.env.DEV) {
        // Em desenvolvimento, usa o proxy do Vite configurado no vite.config.ts
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
        // Em produção (Vercel), usa a Serverless Function para segurança e evitar CORS
        response = await fetch(`/api/powerbi?path=get-access-token`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro ao obter access token:", errorData);
        throw new Error(`Falha na autenticação: ${response.status}`);
      }

      const data = await response.json();
      accessTokenRef.current = data.access_token;
      
      // Renovar token antes de expirar
      setTimeout(() => {
        accessTokenRef.current = null;
      }, 50 * 60 * 1000);

      return data.access_token;
    } catch (error) {
      console.error("Erro ao obter token:", error);
      throw new Error("Não foi possível autenticar com o Power BI.");
    }
  }, []);

  // Obter Embed Token para o relatório
  const getEmbedToken = useCallback(async (workspaceId: string, reportId: string): Promise<string> => {
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
  }, [getAccessToken]);

  // Selecionar Relatório para Embed
  const handleSelectReport = useCallback(async (report: Report) => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    setStatusMessage("Preparando relatório...");
    setEmbedToken(null); // Clear token to force re-render
    
    try {
      const token = await getEmbedToken(currentWorkspace.id, report.id);
      setEmbedToken(token);
      setCurrentReport(report);
      setView("embed");
    } catch (e: unknown) {
      console.error("Erro ao preparar relatório:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Erro ao preparar relatório: ${errorMessage}`);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  }, [currentWorkspace, getEmbedToken]);

  // Handle Refresh
  const handleRefresh = useCallback(async () => {
    if (currentReport) {
      handleSelectReport(currentReport);
    }
  }, [currentReport, handleSelectReport]);

  // Handle View Mode Change
  const handleViewModeChange = useCallback(async (mode: "fitToPage" | "fitToWidth" | "actualSize") => {
    setViewMode(mode);
    
    if (reportRef.current) {
      try {
        let displayOption;
        
        switch (mode) {
          case "fitToPage":
            displayOption = models.DisplayOption.FitToPage;
            break;
          case "fitToWidth":
            displayOption = models.DisplayOption.FitToWidth;
            break;
          case "actualSize":
            displayOption = models.DisplayOption.ActualSize;
            break;
        }
        
        await reportRef.current.updateSettings({
          layoutType: models.LayoutType.Custom,
          customLayout: {
            displayOption: displayOption
          }
        });
        
        console.log(`Modo de visualização alterado para: ${mode}`);
      } catch (e) {
        console.error("Erro ao alterar modo de visualização:", e);
      }
    }
  }, []);

  // Inicializar - Carregar workspaces automaticamente
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Carregar relatórios automaticamente do primeiro workspace
  useEffect(() => {
    if (workspaces.length > 0 && view === "workspaces") {
      // Carrega os relatórios do primeiro workspace automaticamente
      loadReports(workspaces[0]);
    }
  }, [workspaces, view]);

  // Listener para fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reaplicar configurações de visualização quando mudar fullscreen ou viewMode
  useEffect(() => {
    if (reportRef.current && view === "embed") {
      const timer = setTimeout(() => {
        handleViewModeChange(viewMode);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, viewMode, view, handleViewModeChange]);

  // Carregar Workspaces
  const loadWorkspaces = async () => {
    console.log("Iniciando carregamento de workspaces...");
    setLoading(true);
    setError(null);
    setStatusMessage("Carregando workspaces...");
    
    try {
      const accessToken = await getAccessToken();
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
      console.log("Workspaces carregados:", data.value?.length || 0);
      setWorkspaces(data.value || []);
      setView("workspaces");
      setStatusMessage("");
    } catch (e: unknown) {
      console.error("Erro ao carregar workspaces:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Erro ao carregar workspaces: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Carregar Relatórios
  const loadReports = async (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setLoading(true);
    setError(null);
    setStatusMessage(`Carregando relatórios de ${workspace.name}...`);
    
    try {
      const accessToken = await getAccessToken();
      let response;
      const path = `v1.0/myorg/groups/${workspace.id}/reports`;
      
      if (import.meta.env.DEV) {
        response = await fetch(`/powerbi-api/${path}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } else {
        response = await fetch(`/api/powerbi?path=${path}`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao carregar relatórios: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const allReports: Report[] = data.value || [];
      
      // Buscar configurações de visibilidade do Supabase
      const settings = await getAllDashboardSettings();
      
      // Filtrar relatórios:
      // 1. Deve estar marcado como is_visible = true
      // 2. Se o usuário NÃO for admin_master, ele deve estar na lista assigned_users
      const visibleReports = allReports.filter(report => {
        const reportSetting = settings.find(s => s.dashboard_id === report.id);
        
        // Se não houver configuração ou is_visible for false, ninguém vê
        if (!reportSetting || !reportSetting.is_visible) return false;
        
        // Se for admin_master, vê tudo que está is_visible
        if (userRole === "admin_master") return true;
        
        // Se não for admin_master, verifica se o ID do usuário está em assigned_users
        // assigned_users na tabela é jsonb, o serviço o tipa como string[]
        const assignedUsers = Array.isArray(reportSetting.assigned_users) 
          ? reportSetting.assigned_users 
          : [];
          
        return user && assignedUsers.includes(user.id);
      });
      
      setReports(visibleReports);
      setView("reports");
    } catch (e: unknown) {
      console.error("Erro ao carregar relatórios:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Erro ao carregar relatórios: ${errorMessage}`);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  // Voltar
  const handleBack = () => {
    if (view === "embed") {
      setView("reports");
      setCurrentReport(null);
      setEmbedToken(null);
      setViewMode("fitToWidth");
      if (isFullscreen) {
        toggleFullscreen();
      }
    } else if (view === "reports") {
      setView("workspaces");
      setCurrentWorkspace(null);
      setReports([]);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!embedContainerRef.current) return;

    if (isFullscreen) {
      setShowFullscreenHeader(false);
    }

    if (!isFullscreen) {
      if (embedContainerRef.current.requestFullscreen) {
        embedContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <PageLayout title="Power BI - Sistema Próprio">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Header e Navegação */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {view === "embed" && (
              <Button variant="outline" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {view === "workspaces" && "Carregando relatórios..."}
                {view === "reports" && "Selecione um relatório para visualizar"}
                {view === "embed" && `Visualizando: ${currentReport?.name}`}
              </h2>
              <p className="text-muted-foreground">
                {view === "workspaces" && "Aguarde, carregando relatórios disponíveis..."}
                {view === "embed" && "Interaja com seu relatório Power BI"}
              </p>
            </div>
          </div>
        </div>

        {/* Mensagens de Status/Erro */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* View: Workspaces */}
        {!loading && view === "workspaces" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum workspace encontrado.
              </div>
            ) : (
              workspaces.map((ws) => (
                <Card 
                  key={ws.id} 
                  className="cursor-pointer hover:border-primary transition-all hover:shadow-md group"
                  onClick={() => loadReports(ws)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                        <LayoutDashboard className="h-6 w-6 text-blue-500" />
                      </div>
                      {ws.isOnDedicatedCapacity && (
                        <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full border border-amber-200">
                          Premium
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-4">{ws.name}</CardTitle>
                    <CardDescription className="line-clamp-1">ID: {ws.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className={ws.isReadOnly ? "text-orange-500" : "text-green-500"}>
                        {ws.isReadOnly ? "Somente Leitura" : "Acesso Completo"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* View: Reports */}
        {!loading && view === "reports" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum relatório encontrado neste workspace.
              </div>
            ) : (
              reports.map((report) => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:border-primary transition-all hover:shadow-md group"
                  onClick={() => handleSelectReport(report)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <FileBarChart className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="mt-4">{report.name}</CardTitle>
                    <CardDescription className="line-clamp-1">ID: {report.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" className="p-0 h-auto text-primary">
                      Visualizar Dashboard &rarr;
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* View: Embed */}
        {!loading && view === "embed" && currentReport && embedToken && (
          <div ref={embedContainerRef} className={isFullscreen ? "fixed inset-0 z-50 bg-[#0a0a0a] group flex items-center justify-center" : ""}>
            <Card className={`overflow-hidden border-2 border-primary/20 shadow-xl ${isFullscreen ? 'w-full h-full rounded-none border-0 bg-transparent' : 'h-[800px]'}`}>
              {/* Trigger area for hover at the top when in fullscreen */}
              {isFullscreen && (
                <div 
                  className="absolute top-0 left-0 right-0 h-4 z-[60] cursor-pointer" 
                  onMouseEnter={() => setShowFullscreenHeader(true)}
                />
              )}

              <div className={`transition-all duration-300 ease-in-out ${
                isFullscreen 
                  ? `absolute top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b shadow-lg ${
                      showFullscreenHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
                    }`
                  : ""
              }`}
               onMouseLeave={() => isFullscreen && !isSelectOpen && setShowFullscreenHeader(false)}
               >
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-4">
                    <div>
                      <CardTitle className="text-lg">{currentReport.name}</CardTitle>
                      <CardDescription>Dashboard Power BI</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Refresh Button */}
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleRefresh}
                      title="Atualizar dashboard"
                      disabled={loading}
                    >
                      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>

                    {/* View Mode Selector */}
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      <Select 
                        value={viewMode} 
                        onValueChange={(value) => handleViewModeChange(value as any)}
                        onOpenChange={setIsSelectOpen}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Visualização" />
                        </SelectTrigger>
                        <SelectContent container={embedContainerRef.current || undefined}>
                          <SelectItem value="fitToWidth">Ajustar à largura</SelectItem>
                          <SelectItem value="fitToPage">Ajustar à página</SelectItem>
                          <SelectItem value="actualSize">Tamanho real</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Fullscreen Button */}
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                    >
                      {isFullscreen ? (
                        <Minimize className="h-4 w-4" />
                      ) : (
                        <Maximize className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </div>
              
              <CardContent 
                 className={`p-0 ${isFullscreen ? 'h-full flex items-center justify-center' : 'h-[calc(100%-73px)]'}`}
                 onMouseEnter={() => isFullscreen && !isSelectOpen && setShowFullscreenHeader(false)}
               >
                <PowerBIEmbed
                  embedConfig={{
                    type: "report",
                    id: currentReport.id,
                    embedUrl: currentReport.embedUrl,
                    accessToken: embedToken,
                    tokenType: models.TokenType.Embed,
                    settings: {
                      panes: {
                        filters: {
                          expanded: false,
                          visible: false
                        },
                        pageNavigation: {
                          visible: false
                        }
                      },
                      background: models.BackgroundType.Default,
                      layoutType: models.LayoutType.Custom,
                      customLayout: {
                        displayOption: models.DisplayOption.FitToWidth
                      }
                    }
                  }}
                  eventHandlers={
                    new Map([
                      ['loaded', function () { 
                        console.log('Relatório carregado'); 
                      }],
                      ['rendered', function () { 
                        console.log('Relatório renderizado'); 
                      }],
                      ['error', function (event) { 
                        console.error('Erro no Power BI:', event?.detail); 
                      }]
                    ])
                  }
                  cssClassName={"h-full w-full border-0 m-0 p-0"}
                  getEmbeddedComponent={(embeddedReport) => {
                    reportRef.current = embeddedReport;
                    // @ts-expect-error - window.report referência para debug se necessário
                    window.report = embeddedReport;
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
