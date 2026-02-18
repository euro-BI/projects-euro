-- Habilita RLS na tabela chat_config (caso não esteja)
ALTER TABLE chat_config ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Leitura pública para autenticados" ON chat_config;
DROP POLICY IF EXISTS "Apenas admin_master pode atualizar" ON chat_config;
DROP POLICY IF EXISTS "Apenas admin_master pode inserir" ON chat_config;

-- 1. Permite leitura para TODOS os usuários autenticados (admin, user, admin_master, etc)
CREATE POLICY "Leitura pública para autenticados" 
ON chat_config FOR SELECT 
TO authenticated 
USING (true);

-- 2. Permite atualização APENAS para admin_master
CREATE POLICY "Apenas admin_master pode atualizar" 
ON chat_config FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM projects_user_roles
        WHERE user_id = auth.uid() 
        AND role = 'admin_master'
    )
);

-- 3. Permite inserção APENAS para admin_master
CREATE POLICY "Apenas admin_master pode inserir" 
ON chat_config FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects_user_roles
        WHERE user_id = auth.uid() 
        AND role = 'admin_master'
    )
);

-- Verifica se já existe configuração. Se não, insere a padrão.
INSERT INTO chat_config (n8n_url, is_active)
SELECT 'https://n8n-n8n.ffder9.easypanel.host/webhook/euro', true
WHERE NOT EXISTS (SELECT 1 FROM chat_config);
