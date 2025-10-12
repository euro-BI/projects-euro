import { useState, useEffect } from 'react';
import { getSupabaseClient, SupabaseInstance, supabase, supabaseSecondary } from '@/integrations/supabase/clients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Componente de exemplo mostrando como usar múltiplas instâncias do Supabase
 * 
 * Este exemplo demonstra três formas de usar as diferentes instâncias:
 * 1. Usando os clientes diretamente (supabase, supabaseSecondary)
 * 2. Usando a função getSupabaseClient() com enum
 * 3. Usando o hook useSupabaseClient()
 */
export const MultipleSupabaseExample = () => {
  const [primaryData, setPrimaryData] = useState<any[]>([]);
  const [secondaryData, setSecondaryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Exemplo 1: Usando clientes diretamente
  const fetchFromPrimaryDirect = async () => {
    setLoading(true);
    try {
      // Usando o cliente principal diretamente
      const { data, error } = await supabase
        .from('projects') // Tabela da instância principal
        .select('*')
        .limit(5);

      if (error) throw error;
      setPrimaryData(data || []);
      toast.success('Dados carregados da instância principal!');
    } catch (error) {
      console.error('Erro ao carregar da instância principal:', error);
      toast.error('Erro ao carregar dados da instância principal');
    } finally {
      setLoading(false);
    }
  };

  const fetchFromSecondaryDirect = async () => {
    setLoading(true);
    try {
      // Usando o cliente secundário diretamente
      const { data, error } = await supabaseSecondary
        .from('sua_tabela_aqui') // Substitua pela tabela da segunda instância
        .select('*')
        .limit(5);

      if (error) throw error;
      setSecondaryData(data || []);
      toast.success('Dados carregados da instância secundária!');
    } catch (error) {
      console.error('Erro ao carregar da instância secundária:', error);
      toast.error('Erro ao carregar dados da instância secundária');
    } finally {
      setLoading(false);
    }
  };

  // Exemplo 2: Usando a função getSupabaseClient()
  const fetchUsingFunction = async (instance: SupabaseInstance) => {
    setLoading(true);
    try {
      const client = getSupabaseClient(instance);
      const tableName = instance === SupabaseInstance.PRIMARY ? 'projects' : 'sua_tabela_aqui';
      
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .limit(5);

      if (error) throw error;
      
      if (instance === SupabaseInstance.PRIMARY) {
        setPrimaryData(data || []);
      } else {
        setSecondaryData(data || []);
      }
      
      toast.success(`Dados carregados usando função - ${instance}!`);
    } catch (error) {
      console.error(`Erro ao carregar usando função - ${instance}:`, error);
      toast.error(`Erro ao carregar dados - ${instance}`);
    } finally {
      setLoading(false);
    }
  };

  // Exemplo 3: Função para demonstrar autenticação em instâncias diferentes
  const authenticateInInstance = async (instance: SupabaseInstance, email: string, password: string) => {
    try {
      const client = getSupabaseClient(instance);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success(`Autenticado com sucesso na instância ${instance}!`);
      return data;
    } catch (error) {
      console.error(`Erro na autenticação - ${instance}:`, error);
      toast.error(`Erro na autenticação - ${instance}`);
      throw error;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Exemplo: Múltiplas Instâncias Supabase</h1>
        <p className="text-muted-foreground">
          Demonstração de como usar diferentes instâncias do Supabase no mesmo projeto
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instância Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Instância Principal
              <Badge variant="default">Primary</Badge>
            </CardTitle>
            <CardDescription>
              Instância atual do projeto (kseespnvbkzxxgdjklbi)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={fetchFromPrimaryDirect}
                disabled={loading}
                className="w-full"
              >
                Carregar Dados (Direto)
              </Button>
              <Button 
                onClick={() => fetchUsingFunction(SupabaseInstance.PRIMARY)}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Carregar Dados (Função)
              </Button>
            </div>
            
            {primaryData.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Dados carregados:</h4>
                <div className="bg-muted p-3 rounded text-sm">
                  <pre>{JSON.stringify(primaryData, null, 2)}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instância Secundária */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Instância Secundária
              <Badge variant="secondary">Secondary</Badge>
            </CardTitle>
            <CardDescription>
              Nova instância (rzdepoejfchewvjzojan)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={fetchFromSecondaryDirect}
                disabled={loading}
                className="w-full"
              >
                Carregar Dados (Direto)
              </Button>
              <Button 
                onClick={() => fetchUsingFunction(SupabaseInstance.SECONDARY)}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Carregar Dados (Função)
              </Button>
            </div>
            
            {secondaryData.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Dados carregados:</h4>
                <div className="bg-muted p-3 rounded text-sm">
                  <pre>{JSON.stringify(secondaryData, null, 2)}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de Código de Exemplo */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Código</CardTitle>
          <CardDescription>
            Como usar as diferentes instâncias em seus componentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Usando clientes diretamente:</h4>
              <div className="bg-muted p-3 rounded text-sm">
                <pre>{`import { supabase, supabaseSecondary } from '@/integrations/supabase/clients';

// Instância principal
const { data } = await supabase.from('projects').select('*');

// Instância secundária  
const { data } = await supabaseSecondary.from('sua_tabela').select('*');`}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Usando função getSupabaseClient():</h4>
              <div className="bg-muted p-3 rounded text-sm">
                <pre>{`import { getSupabaseClient, SupabaseInstance } from '@/integrations/supabase/clients';

// Instância principal
const primaryClient = getSupabaseClient(SupabaseInstance.PRIMARY);
const { data } = await primaryClient.from('projects').select('*');

// Instância secundária
const secondaryClient = getSupabaseClient(SupabaseInstance.SECONDARY);
const { data } = await secondaryClient.from('sua_tabela').select('*');`}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Em um hook personalizado:</h4>
              <div className="bg-muted p-3 rounded text-sm">
                <pre>{`import { useSupabaseClient, SupabaseInstance } from '@/integrations/supabase/clients';

const MyComponent = () => {
  const primaryClient = useSupabaseClient(SupabaseInstance.PRIMARY);
  const secondaryClient = useSupabaseClient(SupabaseInstance.SECONDARY);
  
  // Use os clientes conforme necessário
};`}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};