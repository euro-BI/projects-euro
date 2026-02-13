import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, FileBarChart } from "lucide-react";
import { getAllReports, Report } from "@/services/powerBiApiService";
import { Switch } from "@/components/ui/switch"; // New import
import { Label } from "@/components/ui/label"; // New import
import { MultiSelect, OptionType } from "@/components/MultiSelect"; // New import
import { getAllUsers, UserProfile } from "@/services/userService"; // New import
import { getAllDashboardSettings, upsertDashboardSettings, DashboardSettings } from "@/services/dashboardSettingsService"; // New import
import { toast } from "sonner"; // New import

export default function DashboardManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]); // New state
  const [dashboardSettings, setDashboardSettings] = useState<Record<string, DashboardSettings>>({}); // New state
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({}); // New state for saving status

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedReports, fetchedUsers, fetchedSettings] = await Promise.all([
          getAllReports(),
          getAllUsers(),
          getAllDashboardSettings(),
        ]);

        setReports(fetchedReports);
        setUsers(fetchedUsers);

        // Initialize dashboard settings
        const initialSettings: Record<string, DashboardSettings> = {};
        fetchedReports.forEach(report => {
          const existingSetting = fetchedSettings.find(s => s.dashboard_id === report.id);
          initialSettings[report.id] = existingSetting || {
            dashboard_id: report.id,
            is_visible: true, // Default to visible
            assigned_users: [],
          };
        });
        setDashboardSettings(initialSettings);

      } catch (e: unknown) {
        console.error("Erro ao carregar dados:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(`Erro ao carregar dados: ${errorMessage}`);
        toast.error(`Erro ao carregar dados: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const userOptions: OptionType[] = users.map(user => ({
    label: `${user.first_name} ${user.last_name}`,
    value: user.id,
  }));

  const handleSettingChange = async (
    dashboardId: string,
    key: keyof DashboardSettings,
    value: any
  ) => {
    setSavingSettings(prev => ({ ...prev, [dashboardId]: true }));
    const currentSettings = dashboardSettings[dashboardId];
    const updatedSettings = { ...currentSettings, [key]: value };

    setDashboardSettings(prev => ({
      ...prev,
      [dashboardId]: updatedSettings,
    }));

    try {
      await upsertDashboardSettings(updatedSettings);
      toast.success("Configurações salvas com sucesso!");
    } catch (e: unknown) {
      console.error("Erro ao salvar configurações:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`Erro ao salvar configurações: ${errorMessage}`);
      // Revert to previous state if save fails
      setDashboardSettings(prev => ({
        ...prev,
        [dashboardId]: currentSettings,
      }));
    } finally {
      setSavingSettings(prev => ({ ...prev, [dashboardId]: false }));
    }
  };

  return (
    <PageLayout title="Gerenciar Dashboards">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h2 className="text-2xl font-bold mb-4">Todos os Dashboards e Relatórios Power BI</h2>

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
              <p className="text-muted-foreground">Carregando todos os dashboards e relatórios...</p>
            </div>
          </div>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhum dashboard ou relatório encontrado.
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => {
              const settings = dashboardSettings[report.id];
              const isSaving = savingSettings[report.id];

              return (
                <Card
                  key={report.id}
                  className="hover:border-primary transition-all hover:shadow-md group relative"
                >
                  {isSaving && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <FileBarChart className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="mt-4">{report.name}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      Workspace: {report.workspaceName || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`visibility-${report.id}`}>Visível</Label>
                      <Switch
                        id={`visibility-${report.id}`}
                        checked={settings?.is_visible ?? true}
                        onCheckedChange={(checked) =>
                          handleSettingChange(report.id, "is_visible", checked)
                        }
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`assigned-users-${report.id}`} className="mb-2 block">
                        Atribuir Usuários
                      </Label>
                      <MultiSelect
                        options={userOptions}
                        selected={settings?.assigned_users || []}
                        onChange={(selectedUsers) =>
                          handleSettingChange(report.id, "assigned_users", selectedUsers)
                        }
                        placeholder="Selecione usuários"
                        disabled={isSaving}
                        showCountOnly={true}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
