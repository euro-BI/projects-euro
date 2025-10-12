import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'loading';
  message: string;
  details?: any;
}

export const MigrationTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name);
      const newTest = { name, status, message, details };
      
      if (existing) {
        return prev.map(t => t.name === name ? newTest : t);
      } else {
        return [...prev, newTest];
      }
    });
  };

  const runTests = async () => {
    setIsRunning(true);
    setTests([]);

    // Teste 1: Verificar conexão básica
    updateTest('Conexão Básica', 'loading', 'Testando conexão com a nova instância...');
    try {
      const { data, error } = await supabase.from('projects_profiles').select('count').limit(1);
      if (error) {
        updateTest('Conexão Básica', 'error', `Erro na conexão: ${error.message}`, error);
      } else {
        updateTest('Conexão Básica', 'success', 'Conexão estabelecida com sucesso!', data);
      }
    } catch (err) {
      updateTest('Conexão Básica', 'error', `Erro inesperado: ${err}`, err);
    }

    // Teste 2: Verificar autenticação
    updateTest('Autenticação', 'loading', 'Verificando sistema de autenticação...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        updateTest('Autenticação', 'warning', `Aviso na autenticação: ${error.message}`, error);
      } else {
        updateTest('Autenticação', 'success', 
          session ? 'Usuário autenticado' : 'Sistema de auth funcionando (sem usuário logado)', 
          session
        );
      }
    } catch (err) {
      updateTest('Autenticação', 'error', `Erro na autenticação: ${err}`, err);
    }

    // Teste 3: Verificar URL da instância
    updateTest('URL da Instância', 'loading', 'Verificando URL da nova instância...');
    const currentUrl = supabase.supabaseUrl;
    const expectedUrl = 'https://rzdepoejfchewvjzojan.supabase.co';
    
    if (currentUrl === expectedUrl) {
      updateTest('URL da Instância', 'success', `URL correta: ${currentUrl}`);
    } else {
      updateTest('URL da Instância', 'error', `URL incorreta. Esperado: ${expectedUrl}, Atual: ${currentUrl}`);
    }

    // Teste 4: Verificar tabelas disponíveis
    updateTest('Estrutura do Banco', 'loading', 'Verificando estrutura do banco de dados...');
    try {
      // Tentar acessar algumas tabelas principais com prefixo projects_
      const tables = ['projects_profiles', 'projects_projects', 'projects_activities', 'projects_subactivities', 'projects_comments', 'projects_user_roles'];
      const results = [];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          results.push({ table, exists: !error, error: error?.message });
        } catch (err) {
          results.push({ table, exists: false, error: String(err) });
        }
      }
      
      const existingTables = results.filter(r => r.exists).length;
      if (existingTables === tables.length) {
        updateTest('Estrutura do Banco', 'success', `Todas as ${tables.length} tabelas principais encontradas`, results);
      } else if (existingTables > 0) {
        updateTest('Estrutura do Banco', 'warning', `${existingTables}/${tables.length} tabelas encontradas`, results);
      } else {
        updateTest('Estrutura do Banco', 'error', 'Nenhuma tabela principal encontrada', results);
      }
    } catch (err) {
      updateTest('Estrutura do Banco', 'error', `Erro ao verificar estrutura: ${err}`, err);
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'loading':
        return 'bg-blue-100 text-blue-800';
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Teste de Migração para Nova Instância
          {isRunning && <Loader2 className="h-5 w-5 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Verificando se a migração para a nova instância do Supabase foi bem-sucedida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button onClick={runTests} disabled={isRunning}>
            {isRunning ? 'Executando...' : 'Executar Testes Novamente'}
          </Button>
        </div>

        <div className="space-y-3">
          {tests.map((test, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              {getStatusIcon(test.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{test.name}</span>
                  <Badge className={getStatusColor(test.status)}>
                    {test.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{test.message}</p>
                {test.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      Ver detalhes
                    </summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>

        {tests.length === 0 && !isRunning && (
          <div className="text-center text-gray-500 py-8">
            Clique em "Executar Testes" para verificar a migração
          </div>
        )}
      </CardContent>
    </Card>
  );
};