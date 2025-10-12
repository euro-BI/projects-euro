-- Script para configurar o bucket 'fotos' e suas políticas de segurança
-- Execute este script no SQL Editor do painel do Supabase

-- 1. Criar o bucket 'fotos' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos',
  'fotos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Remover políticas existentes se houver
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- 3. Política para permitir que todos vejam as imagens (bucket público)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos');

-- 4. Política para permitir que usuários autenticados façam upload de imagens
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos' 
  AND (storage.foldername(name))[1] = 'fotos-assessores'
);

-- 5. Política para permitir que usuários autenticados atualizem imagens
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fotos')
WITH CHECK (bucket_id = 'fotos');

-- 6. Política para permitir que usuários autenticados deletem imagens
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fotos');

-- Verificar se o bucket foi criado
SELECT * FROM storage.buckets WHERE id = 'fotos';