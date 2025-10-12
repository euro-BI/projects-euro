-- =====================================================
-- SQL PARA NOVA INSTÂNCIA DO SUPABASE COM PREFIXO projects_
-- Data: 12/12/2024
-- =====================================================

-- 1. CRIAR ENUM PARA ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. CRIAR TABELA projects_projects (equivalente a projects)
CREATE TABLE public.projects_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. CRIAR TABELA projects_activities (equivalente a activities)
CREATE TABLE public.projects_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em andamento', 'Concluído')),
  responsible TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. CRIAR TABELA projects_subactivities (equivalente a subactivities)
CREATE TABLE public.projects_subactivities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.projects_activities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluído')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. CRIAR TABELA projects_comments (equivalente a comments)
CREATE TABLE public.projects_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.projects_activities(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. CRIAR TABELA projects_profiles (equivalente a profiles)
CREATE TABLE public.projects_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. CRIAR TABELA projects_user_roles (equivalente a user_roles)
CREATE TABLE public.projects_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- 8. FUNÇÃO PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. FUNÇÃO PARA VERIFICAR ROLES
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects_user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 10. FUNÇÃO PARA CRIAR PERFIL AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.projects_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- 11. TRIGGER PARA ATUALIZAR updated_at EM projects_activities
CREATE TRIGGER update_projects_activities_updated_at
BEFORE UPDATE ON public.projects_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. TRIGGER PARA ATUALIZAR updated_at EM projects_profiles
CREATE TRIGGER update_projects_profiles_updated_at
  BEFORE UPDATE ON public.projects_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 13. TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- 14. ÍNDICES
CREATE INDEX idx_projects_activities_project_id ON public.projects_activities(project_id);
CREATE INDEX idx_projects_activities_status ON public.projects_activities(status);
CREATE INDEX idx_projects_subactivities_activity_id ON public.projects_subactivities(activity_id);
CREATE INDEX idx_projects_comments_activity_id ON public.projects_comments(activity_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- 15. HABILITAR RLS
ALTER TABLE public.projects_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_subactivities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- 16. POLÍTICAS PARA projects_projects
CREATE POLICY "Allow all operations on projects_projects" 
  ON public.projects_projects FOR ALL USING (true) WITH CHECK (true);

-- 17. POLÍTICAS PARA projects_activities
CREATE POLICY "Allow all operations on projects_activities" 
  ON public.projects_activities FOR ALL USING (true) WITH CHECK (true);

-- 18. POLÍTICAS PARA projects_subactivities
CREATE POLICY "Allow all operations on projects_subactivities" 
  ON public.projects_subactivities FOR ALL USING (true) WITH CHECK (true);

-- 19. POLÍTICAS PARA projects_comments
CREATE POLICY "Allow all operations on projects_comments" 
  ON public.projects_comments FOR ALL USING (true) WITH CHECK (true);

-- 20. POLÍTICAS PARA projects_profiles
CREATE POLICY "Users can view all projects_profiles"
  ON public.projects_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own projects_profile"
  ON public.projects_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any projects_profile"
  ON public.projects_profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert projects_profiles"
  ON public.projects_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 21. POLÍTICAS PARA projects_user_roles
CREATE POLICY "Users can view all projects_user_roles"
  ON public.projects_user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage projects_user_roles"
  ON public.projects_user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- =====================================================

-- 22. INSERIR PROJETO DE EXEMPLO
INSERT INTO public.projects_projects (name, description) VALUES 
('Projeto Exemplo', 'Este é um projeto de exemplo para testar a nova estrutura');

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- 23. VERIFICAR SE TODAS AS TABELAS FORAM CRIADAS
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'projects_%'
ORDER BY table_name;

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================

/*
INSTRUÇÕES PARA APLICAR ESTE SQL:

1. Acesse o painel do Supabase da nova instância
2. Vá em "SQL Editor"
3. Cole todo este código SQL
4. Execute o script
5. Verifique se todas as tabelas foram criadas corretamente
6. Teste a conexão usando o componente MigrationTest

TABELAS CRIADAS:
- projects_projects (projetos)
- projects_activities (atividades)
- projects_subactivities (sub-atividades/checklist)
- projects_comments (comentários)
- projects_profiles (perfis de usuário)
- projects_user_roles (roles dos usuários)

PRÓXIMOS PASSOS:
1. Aplicar este SQL na nova instância
2. Atualizar os tipos TypeScript
3. Adaptar todas as queries do sistema
4. Testar todas as funcionalidades
*/