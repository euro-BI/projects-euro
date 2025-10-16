import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Upload, UserCheck, FileSpreadsheet, Shield } from "lucide-react";
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
              Colaboradores
            </TabsTrigger>
            <TabsTrigger value="data-upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Atualizar Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="welcome" className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-primary/30">
                  <UserCheck className="w-12 h-12 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                Sistema de Gerenciamento de Colaboradores
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Plataforma centralizada para gerenciar informações de colaboradores, 
                realizar upload de dados e manter o banco de dados sempre atualizado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200 cursor-pointer" 
                    onClick={() => setActiveTab("assessors")}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Gerenciar Colaboradores</h3>
                    <p className="text-sm text-muted-foreground">
                      Cadastre, edite e organize informações dos colaboradores
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200 cursor-pointer"
                    onClick={() => setActiveTab("data-upload")}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <FileSpreadsheet className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Upload de Dados</h3>
                    <p className="text-sm text-muted-foreground">
                      Importe planilhas e atualize o banco de dados
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card border-primary/30 p-6 hover:scale-105 transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <Shield className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Controle de Dados</h3>
                    <p className="text-sm text-muted-foreground">
                      Validação e integridade das informações
                    </p>
                  </div>
                </div>
              </Card>
            </div>
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