import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const ProjectsDebugTest: React.FC = () => {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testProjectsData = async () => {
    setLoading(true);
    const testResults: any = {};

    try {
      // Teste 1: Verificar se a tabela projects_projects existe e tem dados
      console.log('Testando projects_projects...');
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects_projects')
        .select('*');
      
      testResults.projects_projects = {
        error: projectsError,
        data: projectsData,
        count: projectsData?.length || 0
      };

      // Teste 2: Verificar se a tabela projects_activities existe e tem dados
      console.log('Testando projects_activities...');
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('projects_activities')
        .select('*');
      
      testResults.projects_activities = {
        error: activitiesError,
        data: activitiesData,
        count: activitiesData?.length || 0
      };

      // Teste 3: Verificar se a tabela projects_profiles existe e tem dados
      console.log('Testando projects_profiles...');
      const { data: profilesData, error: profilesError } = await supabase
        .from('projects_profiles')
        .select('*');
      
      testResults.projects_profiles = {
        error: profilesError,
        data: profilesData,
        count: profilesData?.length || 0
      };

      // Teste 4: Verificar autenticação atual
      console.log('Testando autenticação...');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      testResults.auth = {
        error: authError,
        session: session,
        user: session?.user || null
      };

    } catch (err) {
      console.error('Erro nos testes:', err);
      testResults.generalError = err;
    }

    setResults(testResults);
    setLoading(false);
  };

  useEffect(() => {
    testProjectsData();
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>Debug: Teste de Carregamento de Projetos</CardTitle>
        <CardDescription>
          Verificando se há dados nas tabelas e diagnosticando problemas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testProjectsData} disabled={loading}>
          {loading ? 'Testando...' : 'Executar Testes Novamente'}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resultados dos Testes:</h3>
            
            {/* Teste projects_projects */}
            <div className="border p-4 rounded">
              <h4 className="font-medium">Tabela: projects_projects</h4>
              <p>Erro: {results.projects_projects?.error ? JSON.stringify(results.projects_projects.error) : 'Nenhum'}</p>
              <p>Quantidade de registros: {results.projects_projects?.count || 0}</p>
              {results.projects_projects?.data && results.projects_projects.data.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Ver dados</summary>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(results.projects_projects.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Teste projects_activities */}
            <div className="border p-4 rounded">
              <h4 className="font-medium">Tabela: projects_activities</h4>
              <p>Erro: {results.projects_activities?.error ? JSON.stringify(results.projects_activities.error) : 'Nenhum'}</p>
              <p>Quantidade de registros: {results.projects_activities?.count || 0}</p>
            </div>

            {/* Teste projects_profiles */}
            <div className="border p-4 rounded">
              <h4 className="font-medium">Tabela: projects_profiles</h4>
              <p>Erro: {results.projects_profiles?.error ? JSON.stringify(results.projects_profiles.error) : 'Nenhum'}</p>
              <p>Quantidade de registros: {results.projects_profiles?.count || 0}</p>
            </div>

            {/* Teste autenticação */}
            <div className="border p-4 rounded">
              <h4 className="font-medium">Autenticação</h4>
              <p>Erro: {results.auth?.error ? JSON.stringify(results.auth.error) : 'Nenhum'}</p>
              <p>Usuário logado: {results.auth?.user ? 'Sim' : 'Não'}</p>
              {results.auth?.user && (
                <p>ID do usuário: {results.auth.user.id}</p>
              )}
            </div>

            {results.generalError && (
              <div className="border p-4 rounded bg-red-50">
                <h4 className="font-medium text-red-700">Erro Geral</h4>
                <pre className="text-xs text-red-600">
                  {JSON.stringify(results.generalError, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};