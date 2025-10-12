# Guia: Múltiplas Instâncias do Supabase

Este guia explica como usar múltiplas instâncias do Supabase no mesmo projeto React.

## 📋 Visão Geral

O projeto agora suporta duas instâncias do Supabase:
- **Instância Principal**: `kseespnvbkzxxgdjklbi` (instância original do projeto)
- **Instância Secundária**: `rzdepoejfchewvjzojan` (nova instância)

## 🔧 Configuração

### 1. Variáveis de Ambiente

As credenciais estão configuradas no arquivo `.env`:

```env
# Instância principal do Supabase (atual)
VITE_SUPABASE_PROJECT_ID="kseespnvbkzxxgdjklbi"
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="https://kseespnvbkzxxgdjklbi.supabase.co"

# Segunda instância do Supabase
VITE_SUPABASE_SECONDARY_URL="https://rzdepoejfchewvjzojan.supabase.co"
VITE_SUPABASE_SECONDARY_ANON_KEY="..."
```

### 2. Arquivos Criados

- `src/integrations/supabase/clients.ts` - Gerenciamento dos clientes
- `src/contexts/SecondaryAuthContext.tsx` - Contexto de autenticação para instância secundária
- `src/components/SecondarySupabaseTest.tsx` - Componente de teste de conexão
- `src/examples/MultipleSupabaseExample.tsx` - Exemplos de uso

## 🚀 Como Usar

### Método 1: Clientes Diretos

```typescript
import { supabase, supabaseSecondary } from '@/integrations/supabase/clients';

// Instância principal (mantém compatibilidade)
const { data } = await supabase.from('projects').select('*');

// Instância secundária
const { data } = await supabaseSecondary.from('sua_tabela').select('*');
```

### Método 2: Função getSupabaseClient()

```typescript
import { getSupabaseClient, SupabaseInstance } from '@/integrations/supabase/clients';

// Instância principal
const primaryClient = getSupabaseClient(SupabaseInstance.PRIMARY);
const { data } = await primaryClient.from('projects').select('*');

// Instância secundária
const secondaryClient = getSupabaseClient(SupabaseInstance.SECONDARY);
const { data } = await secondaryClient.from('sua_tabela').select('*');
```

### Método 3: Hook useSupabaseClient()

```typescript
import { useSupabaseClient, SupabaseInstance } from '@/integrations/supabase/clients';

const MyComponent = () => {
  const primaryClient = useSupabaseClient(SupabaseInstance.PRIMARY);
  const secondaryClient = useSupabaseClient(SupabaseInstance.SECONDARY);
  
  // Use os clientes conforme necessário
};
```

## 🔐 Autenticação

### Contexto de Autenticação Secundária

```typescript
import { useSecondaryAuth } from '@/contexts/SecondaryAuthContext';

const MyComponent = () => {
  const { user, signIn, signOut } = useSecondaryAuth();
  
  const handleLogin = async () => {
    const { error } = await signIn('email@example.com', 'password');
    if (!error) {
      console.log('Logado na instância secundária!');
    }
  };
};
```

### Autenticação Dual

```typescript
import { useDualAuth } from '@/contexts/SecondaryAuthContext';

const MyComponent = () => {
  const { primary, secondary, bothAuthenticated, anyAuthenticated } = useDualAuth();
  
  if (bothAuthenticated) {
    console.log('Usuário autenticado em ambas as instâncias');
  }
};
```

## 🧪 Testando a Conexão

Use o componente `SecondarySupabaseTest` para verificar se a conexão com a instância secundária está funcionando:

```typescript
import { SecondarySupabaseTest } from '@/components/SecondarySupabaseTest';

const TestPage = () => {
  return (
    <div>
      <h1>Teste de Conexão</h1>
      <SecondarySupabaseTest />
    </div>
  );
};
```

## 📝 Exemplos Práticos

### 1. Sincronização de Dados

```typescript
const syncDataBetweenInstances = async () => {
  // Buscar dados da instância principal
  const { data: primaryData } = await supabase
    .from('projects')
    .select('*');

  // Inserir na instância secundária
  if (primaryData) {
    const { error } = await supabaseSecondary
      .from('projects_backup')
      .insert(primaryData);
      
    if (!error) {
      console.log('Dados sincronizados com sucesso!');
    }
  }
};
```

### 2. Autenticação Condicional

```typescript
const authenticateBasedOnCondition = async (useSecondary: boolean) => {
  const client = getSupabaseClient(
    useSecondary ? SupabaseInstance.SECONDARY : SupabaseInstance.PRIMARY
  );
  
  const { data, error } = await client.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'password'
  });
  
  return { data, error };
};
```

### 3. Fallback entre Instâncias

```typescript
const fetchWithFallback = async (tableName: string) => {
  try {
    // Tentar instância principal primeiro
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
      
    if (error) throw error;
    return data;
  } catch (primaryError) {
    console.log('Falha na instância principal, tentando secundária...');
    
    try {
      const { data, error } = await supabaseSecondary
        .from(tableName)
        .select('*');
        
      if (error) throw error;
      return data;
    } catch (secondaryError) {
      console.error('Ambas as instâncias falharam:', {
        primary: primaryError,
        secondary: secondaryError
      });
      throw secondaryError;
    }
  }
};
```

## ⚠️ Considerações Importantes

### 1. Compatibilidade
- O código existente continua funcionando normalmente
- A instância principal (`supabase`) mantém o mesmo comportamento
- Apenas adicione a instância secundária onde necessário

### 2. Gerenciamento de Estado
- Cada instância tem seu próprio estado de autenticação
- Use os contextos apropriados para cada instância
- Considere sincronizar estados quando necessário

### 3. Políticas RLS
- Configure as políticas de Row Level Security em ambas as instâncias
- Certifique-se de que as permissões estão corretas
- Teste o acesso aos dados em ambas as instâncias

### 4. Schemas e Tabelas
- As instâncias podem ter schemas diferentes
- Adapte as queries conforme necessário
- Documente as diferenças entre as instâncias

## 🔍 Debugging

### Logs de Conexão
```typescript
// Verificar status da conexão
console.log('Primary client:', supabase);
console.log('Secondary client:', supabaseSecondary);

// Testar conectividade
const testConnections = async () => {
  try {
    const primaryTest = await supabase.from('projects').select('count').limit(1);
    console.log('Primary connection:', primaryTest.error ? 'Failed' : 'Success');
    
    const secondaryTest = await supabaseSecondary.from('any_table').select('count').limit(1);
    console.log('Secondary connection:', secondaryTest.error ? 'Failed' : 'Success');
  } catch (error) {
    console.error('Connection test failed:', error);
  }
};
```

### Verificar Autenticação
```typescript
const checkAuthStatus = async () => {
  const primaryAuth = await supabase.auth.getSession();
  const secondaryAuth = await supabaseSecondary.auth.getSession();
  
  console.log('Primary auth:', primaryAuth.data.session?.user?.email || 'Not authenticated');
  console.log('Secondary auth:', secondaryAuth.data.session?.user?.email || 'Not authenticated');
};
```

## 📚 Próximos Passos

1. **Configurar Tabelas**: Crie as tabelas necessárias na instância secundária
2. **Implementar Telas**: Desenvolva as novas funcionalidades usando a instância secundária
3. **Sincronização**: Implemente sincronização de dados se necessário
4. **Monitoramento**: Configure logs e monitoramento para ambas as instâncias

## 🆘 Suporte

Se encontrar problemas:
1. Verifique as credenciais no arquivo `.env`
2. Use o componente `SecondarySupabaseTest` para diagnosticar conexões
3. Verifique os logs do console para erros específicos
4. Confirme se as políticas RLS estão configuradas corretamente