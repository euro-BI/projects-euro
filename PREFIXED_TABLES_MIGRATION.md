# Migração para Tabelas com Prefixo `projects_`

## Resumo
Este documento descreve a migração completa do sistema para usar tabelas com prefixo `projects_` na nova instância do Supabase.

## Data da Migração
12 de dezembro de 2024

## Mudanças Realizadas

### 1. SQL para Nova Instância
- **Arquivo**: `NEW_INSTANCE_SETUP.sql`
- **Descrição**: Script SQL completo para criar todas as tabelas com prefixo `projects_` na nova instância
- **Tabelas criadas**:
  - `projects_projects` (antiga: `projects`)
  - `projects_activities` (antiga: `activities`)
  - `projects_subactivities` (antiga: `subactivities`)
  - `projects_comments` (antiga: `comments`)
  - `projects_profiles` (antiga: `profiles`)
  - `projects_user_roles` (antiga: `user_roles`)

### 2. Tipos TypeScript Atualizados
- **Arquivo**: `src/integrations/supabase/types.ts`
- **Mudanças**:
  - Todos os nomes de tabelas atualizados para usar prefixo `projects_`
  - Relacionamentos (foreign keys) atualizados
  - Nomes de constraints atualizados

### 3. Queries do Sistema Adaptadas

#### Arquivos Modificados:
1. **`src/pages/Users.tsx`**
   - `user_roles` → `projects_user_roles`
   - `profiles` → `projects_profiles`

2. **`src/pages/ProjectActivities.tsx`**
   - `projects` → `projects_projects`
   - `activities` → `projects_activities`
   - `subactivities` → `projects_subactivities`
   - `comments` → `projects_comments`
   - `profiles` → `projects_profiles`

3. **`src/pages/Dashboard.tsx`**
   - `projects` → `projects_projects`
   - `activities` → `projects_activities`

4. **`src/pages/Projects.tsx`**
   - `projects` → `projects_projects`

5. **`src/components/Header.tsx`**
   - `profiles` → `projects_profiles`
   - `user_roles` → `projects_user_roles`

## Estrutura das Novas Tabelas

### projects_projects
- Armazena informações dos projetos
- Campos: id, name, description, created_at

### projects_activities
- Armazena atividades dos projetos
- Campos: id, project_id, title, description, status, responsible, start_date, end_date, created_at, updated_at

### projects_subactivities
- Armazena sub-atividades/checklist das atividades
- Campos: id, activity_id, title, status, comment, created_at

### projects_comments
- Armazena comentários das atividades
- Campos: id, activity_id, author, comment, created_at

### projects_profiles
- Armazena perfis dos usuários
- Campos: id, first_name, last_name, phone, created_at, updated_at

### projects_user_roles
- Armazena roles dos usuários
- Campos: id, user_id, role, created_at

## Funcionalidades Implementadas

### Row Level Security (RLS)
- Todas as tabelas têm RLS habilitado
- Políticas específicas para cada tabela
- Controle de acesso baseado em roles (admin/user)

### Triggers e Funções
- `update_updated_at_column()`: Atualiza timestamp automaticamente
- `has_role()`: Verifica se usuário tem role específico
- `handle_new_user()`: Cria perfil automaticamente para novos usuários

### Índices de Performance
- Índices em campos frequentemente consultados
- Otimização para queries de relacionamento

## Próximos Passos

1. **Aplicar SQL na Nova Instância**
   - Executar o script `NEW_INSTANCE_SETUP.sql` no painel do Supabase
   - Verificar se todas as tabelas foram criadas

2. **Configurar Autenticação**
   - Configurar providers de autenticação na nova instância
   - Testar login/logout

3. **Migração de Dados (se necessário)**
   - Exportar dados da instância antiga
   - Importar para as novas tabelas com prefixo

4. **Testes Completos**
   - Testar todas as funcionalidades do sistema
   - Verificar CRUD operations
   - Testar permissões e RLS

## Verificação

Para verificar se a migração foi bem-sucedida:

1. Acesse `http://localhost:8081/migration-test`
2. Execute os testes de conexão
3. Verifique se todas as tabelas estão listadas
4. Teste as funcionalidades principais do sistema

## Rollback

Caso seja necessário reverter as mudanças:

1. Restaurar backup do arquivo `types.ts`
2. Reverter mudanças nos arquivos de páginas e componentes
3. Usar instância original do Supabase

## Observações Importantes

- Todas as queries foram atualizadas para usar o novo prefixo
- Os tipos TypeScript estão sincronizados com a nova estrutura
- O sistema mantém compatibilidade com todas as funcionalidades existentes
- RLS e permissões foram preservadas na migração