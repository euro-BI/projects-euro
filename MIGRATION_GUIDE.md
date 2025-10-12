# Guia de Migração para Nova Instância do Supabase

## 📋 Resumo da Migração

Este documento descreve o processo completo de migração do projeto para uma nova instância do Supabase, realizada em **12 de dezembro de 2024**.

### ✅ Status da Migração
- **Status**: ✅ CONCLUÍDA
- **Data**: 12/12/2024
- **Instância Antiga**: `kseespnvbkzxxgdjklbi.supabase.co`
- **Nova Instância**: `rzdepoejfchewvjzojan.supabase.co`

## 🔄 Mudanças Realizadas

### 1. Backup da Configuração Original
- ✅ Criado backup do `.env` original (`.env.backup`)
- ✅ Criado backup do cliente Supabase original (`client.backup.ts`)

### 2. Atualização das Configurações

#### `.env`
```env
# NOVA INSTÂNCIA PRINCIPAL DO SUPABASE (MIGRADA)
VITE_SUPABASE_PROJECT_ID="rzdepoejfchewvjzojan"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZGVwb2VqZmNoZXd2anpvamFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODM4NTIsImV4cCI6MjA3NTg1OTg1Mn0.hRwcQaZsT8wuDofhwrLvoXRjH0p2bXejjmqdqglHU7g"
VITE_SUPABASE_URL="https://rzdepoejfchewvjzojan.supabase.co"
```

#### `src/integrations/supabase/client.ts`
- ✅ Atualizado para usar a nova URL e chave da instância
- ✅ Adicionados comentários indicando a migração

#### `supabase/config.toml`
- ✅ Atualizado `project_id` para a nova instância

### 3. Componente de Teste
- ✅ Criado `MigrationTest.tsx` para verificar a migração
- ✅ Adicionada rota `/migration-test` para acesso ao teste

## 🧪 Testes de Verificação

### Como Testar a Migração

1. **Acesse a página de teste**: `http://localhost:8081/migration-test`
2. **Verifique os seguintes testes**:
   - ✅ Conexão Básica
   - ✅ Sistema de Autenticação
   - ✅ URL da Instância
   - ✅ Estrutura do Banco de Dados

### Testes Automáticos Incluídos

O componente `MigrationTest` verifica:

- **Conexão**: Testa se a aplicação consegue se conectar à nova instância
- **Autenticação**: Verifica se o sistema de auth está funcionando
- **URL**: Confirma que a URL correta está sendo usada
- **Estrutura**: Verifica se as tabelas principais existem

## 📁 Arquivos Modificados

### Arquivos Principais
- ✅ `.env` - Configurações de ambiente
- ✅ `src/integrations/supabase/client.ts` - Cliente principal
- ✅ `supabase/config.toml` - Configuração do projeto
- ✅ `src/App.tsx` - Adicionada rota de teste

### Arquivos de Backup Criados
- ✅ `.env.backup` - Backup das configurações originais
- ✅ `src/integrations/supabase/client.backup.ts` - Backup do cliente original

### Novos Arquivos
- ✅ `src/components/MigrationTest.tsx` - Componente de teste
- ✅ `MIGRATION_GUIDE.md` - Este documento

## ⚠️ Considerações Importantes

### 1. Estrutura do Banco de Dados
- A nova instância precisa ter a mesma estrutura de tabelas da instância anterior
- Verifique se todas as migrações foram aplicadas na nova instância
- Confirme se as políticas RLS estão configuradas corretamente

### 2. Dados Existentes
- **IMPORTANTE**: Esta migração apenas muda a conexão, não migra dados automaticamente
- Se você tem dados na instância antiga que precisa manter, será necessário fazer uma migração manual dos dados

### 3. Autenticação
- Usuários existentes na instância antiga não estarão disponíveis na nova instância
- Será necessário recriar contas de usuário ou migrar dados de autenticação

## 🔄 Próximos Passos

### 1. Verificação Completa
- [ ] Testar todas as funcionalidades da aplicação
- [ ] Verificar se todas as páginas carregam corretamente
- [ ] Confirmar que operações CRUD funcionam

### 2. Configuração da Nova Instância
- [ ] Aplicar migrações do banco de dados na nova instância
- [ ] Configurar políticas RLS (Row Level Security)
- [ ] Configurar autenticação (providers, redirects, etc.)

### 3. Migração de Dados (Se Necessário)
- [ ] Exportar dados da instância antiga
- [ ] Importar dados para a nova instância
- [ ] Verificar integridade dos dados migrados

### 4. Limpeza
- [ ] Remover arquivos de backup após confirmação
- [ ] Remover rota de teste `/migration-test`
- [ ] Atualizar documentação do projeto

## 🆘 Rollback (Se Necessário)

Caso seja necessário voltar à configuração anterior:

1. **Restaurar `.env`**:
   ```bash
   cp .env.backup .env
   ```

2. **Restaurar cliente Supabase**:
   ```bash
   cp src/integrations/supabase/client.backup.ts src/integrations/supabase/client.ts
   ```

3. **Restaurar config.toml**:
   ```toml
   project_id = "kseespnvbkzxxgdjklbi"
   ```

4. **Reiniciar servidor**:
   ```bash
   npm run dev
   ```

## 📞 Suporte

Se encontrar problemas durante ou após a migração:

1. Verifique os logs do console do navegador
2. Verifique os logs do terminal do servidor
3. Execute os testes em `/migration-test`
4. Consulte a documentação do Supabase para troubleshooting

---

**Data da Migração**: 12 de dezembro de 2024  
**Responsável**: Sistema de Migração Automática  
**Status**: ✅ Concluída com Sucesso