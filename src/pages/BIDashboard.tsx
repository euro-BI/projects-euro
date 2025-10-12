import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, TrendingUp, Database, Upload } from "lucide-react";
import { AssessorsManagement } from "@/components/AssessorsManagement";
import { DataUploadManagement } from "@/components/DataUploadManagement";

export default function BIDashboard() {
  const [activeTab, setActiveTab] = useState("welcome");

  return (
    <PageLayout title="Gerenciamento de Dados BI">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 glass-card border-primary/30">
            <TabsTrigger value="welcome" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Boas-vindas
            </TabsTrigger>
            <TabsTrigger value="assessors" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Assessores
            </TabsTrigger>
            <TabsTrigger value="data-upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Atualizar Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="welcome" className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-primary/30">
                  <BarChart3 className="w-12 h-12 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Bem-vindo ao BI Dashboard
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Gerencie dados de inteligência de negócios, assessores e relatórios analíticos
                de forma centralizada e eficiente.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Assessores</h3>
                    <p className="text-sm text-muted-foreground">
                      Gerencie informações dos assessores
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Relatórios</h3>
                    <p className="text-sm text-muted-foreground">
                      Análises e métricas detalhadas
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <Database className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Dados</h3>
                    <p className="text-sm text-muted-foreground">
                      Gestão centralizada de informações
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="glass-card border-primary/30 p-6">
              <h2 className="text-xl font-semibold mb-4">Funcionalidades Disponíveis</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-primary">Gestão de Assessores</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Cadastro completo de assessores</li>
                    <li>• Upload de fotos de perfil</li>
                    <li>• Informações de contato</li>
                    <li>• Histórico de atividades</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-primary">Relatórios e Análises</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Dashboards interativos</li>
                    <li>• Métricas de performance</li>
                    <li>• Exportação de dados</li>
                    <li>• Análises personalizadas</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-primary">Atualização de Dados</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload de planilhas Excel</li>
                    <li>• Dados de captações</li>
                    <li>• Dados de positivador</li>
                    <li>• Validação automática</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="assessors">
            <AssessorsManagement />
          </TabsContent>

          <TabsContent value="data-upload">
            <DataUploadManagement />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}