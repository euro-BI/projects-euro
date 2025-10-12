-- Configuração do bucket 'fotos' e suas políticas de segurança

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

-- 2. Política para permitir que usuários autenticados vejam todas as imagens
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos');

-- 3. Política para permitir que usuários autenticados façam upload de imagens
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos' 
  AND (storage.foldername(name))[1] = 'fotos-assessores'
);

-- 4. Política para permitir que usuários autenticados atualizem suas próprias imagens
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fotos')
WITH CHECK (bucket_id = 'fotos');

-- 5. Política para permitir que usuários autenticados deletem suas próprias imagens
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fotos');