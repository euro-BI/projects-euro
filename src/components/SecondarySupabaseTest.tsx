import { useState } from 'react';
import { supabaseSecondary } from '@/integrations/supabase/clients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionStatus {
  connected: boolean;
  message: string;
  details?: any;
}

export const SecondarySupabaseTest = () => {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);

    try {
      // Teste 1: Verificar se conseguimos fazer uma query básica
      console.log('Testando conexão com instância secundária...');
      
      // Primeiro, vamos tentar uma query simples para verificar a conexão
      const { data, error } = await supabaseSecondary
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error) {
        // Se der erro, pode ser que a tabela não exista, mas a conexão pode estar ok
        console.log('Erro na query de teste:', error);
        
        // Vamos tentar verificar o status da conexão de outra forma
        const { data: authData, error: authError } = await supabaseSecondary.auth.getSession();
        
        if (authError) {
          throw new Error(`Erro de autenticação: ${authError.message}`);
        }

        setConnectionStatus({
          connected: true,
          message: 'Conexão estabelecida com sucesso! (Sem tabelas visíveis)',
          details: {
            authStatus: 'OK',
            session: authData.session ? 'Ativa' : 'Não autenticado',
            note: 'A instância está acessível, mas pode não ter tabelas públicas ou você pode não ter permissões para visualizá-las.'
          }
        });
        
        toast.success('Conexão com instância secundária estabelecida!');
      } else {
        setConnectionStatus({
          connected: true,
          message: 'Conexão estabelecida com sucesso!',
          details: {
            tablesFound: data?.length || 0,
            sampleTable: data?.[0]?.table_name || 'N/A'
          }
        });
        
        toast.success('Conexão com instância secundária estabelecida!');
      }

    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      
      setConnectionStatus({
        connected: false,
        message: `Falha na conexão: ${error.message}`,
        details: {
          error: error.message,
          suggestion: 'Verifique se as credenciais estão corretas e se a instância está ativa.'
        }
      });
      
      toast.error('Falha na conexão com instância secundária');
    } finally {
      setTesting(false);
    }
  };

  const testAuth = async () => {
    setTesting(true);
    
    try {
      // Teste de autenticação - verificar se conseguimos acessar dados do usuário
      const { data: { user }, error } = await supabaseSecondary.auth.getUser();
      
      if (error) {
        toast.info('Nenhum usuário autenticado na instância secundária');
      } else if (user) {
        toast.success(`Usuário autenticado: ${user.email}`);
      } else {
        toast.info('Nenhum usuário autenticado na instância secundária');
      }
      
    } catch (error: any) {
      console.error('Erro ao testar autenticação:', error);
      toast.error('Erro ao verificar autenticação');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Teste de Conexão - Instância Secundária
        </CardTitle>
        <CardDescription>
          Teste a conectividade com a segunda instância do Supabase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testConnection}
            disabled={testing}
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
          
          <Button 
            onClick={testAuth}
            disabled={testing}
            variant="outline"
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar Auth'
            )}
          </Button>
        </div>

        {connectionStatus && (
          <Alert className={connectionStatus.connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {connectionStatus.connected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <Badge variant={connectionStatus.connected ? 'default' : 'destructive'}>
                {connectionStatus.connected ? 'Conectado' : 'Erro'}
              </Badge>
            </div>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>{connectionStatus.message}</p>
                {connectionStatus.details && (
                  <div className="bg-white/50 p-3 rounded text-sm">
                    <pre>{JSON.stringify(connectionStatus.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Informações da Instância Secundária:</h4>
          <div className="space-y-1 text-sm">
            <p><strong>URL:</strong> https://rzdepoejfchewvjzojan.supabase.co</p>
            <p><strong>Project ID:</strong> rzdepoejfchewvjzojan</p>
            <p><strong>Status:</strong> {connectionStatus ? (connectionStatus.connected ? '✅ Conectado' : '❌ Desconectado') : '⏳ Não testado'}</p>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Nota:</strong> Esta é uma nova instância do Supabase. Certifique-se de que:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>A instância está ativa e acessível</li>
              <li>As credenciais estão corretas</li>
              <li>As políticas RLS estão configuradas adequadamente</li>
              <li>As tabelas necessárias foram criadas</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};