-- =====================================================================
-- P1 — Lote B · Policies do bucket conteudo-institucional
-- Modelo: conteúdo INSTITUCIONAL (não escopado por auth.uid()/pasta).
--   - Leitura pública por URL direta: depende do flag público do bucket
--     (bloqueado no workspace no momento; ver docs/SECURITY.md). Sem policy
--     anon de SELECT => SEM listagem pública.
--   - Listagem/gestão: apenas staff.
--   - Upload/update/delete: apenas staff/gestor.
-- =====================================================================

-- Listagem/leitura via API autenticada: apenas staff (sem anon => sem listagem pública).
CREATE POLICY "conteudo_institucional_select_staff"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'conteudo-institucional' AND public.fn_eh_staff(auth.uid()));

-- Upload: apenas staff/gestor (sem escopo de pasta por uid).
CREATE POLICY "conteudo_institucional_insert_staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'conteudo-institucional' AND public.fn_eh_staff(auth.uid()));

-- Update: apenas staff/gestor.
CREATE POLICY "conteudo_institucional_update_staff"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'conteudo-institucional' AND public.fn_eh_staff(auth.uid()))
WITH CHECK (bucket_id = 'conteudo-institucional' AND public.fn_eh_staff(auth.uid()));

-- Delete: apenas staff/gestor.
CREATE POLICY "conteudo_institucional_delete_staff"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'conteudo-institucional' AND public.fn_eh_staff(auth.uid()));