-- Restringir SELECT da ia-biblioteca a perfis de equipe (não mais todos os autenticados)
DROP POLICY IF EXISTS "Authenticated read ia-biblioteca" ON storage.objects;

CREATE POLICY "Staff read ia-biblioteca"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ia-biblioteca'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'administrador_master'::app_role)
    OR has_role(auth.uid(), 'entrevistador'::app_role)
    OR has_role(auth.uid(), 'coordenador_de_tratamento'::app_role)
  )
);

-- Adicionar política de UPDATE para administradores
CREATE POLICY "Admins update ia-biblioteca"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ia-biblioteca'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'administrador_master'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'ia-biblioteca'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'administrador_master'::app_role)
  )
);