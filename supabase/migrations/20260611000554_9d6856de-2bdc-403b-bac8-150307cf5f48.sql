-- 1. audit_logs: remove client-side insert (audit handled by SECURITY DEFINER trigger)
DROP POLICY IF EXISTS "Authenticated users insert own audit_logs" ON public.audit_logs;

-- 2. avatars storage: scope writes to the user's own folder (first path segment = uid)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

CREATE POLICY "Users upload own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. checkins_publicos: restrict broad read to staff roles + own records
DROP POLICY IF EXISTS "Authenticated read checkins" ON public.checkins_publicos;

CREATE POLICY "Staff and owners read checkins"
ON public.checkins_publicos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'tarefeiro'::app_role)
  OR has_role(auth.uid(), 'coordenador_de_tratamento'::app_role)
  OR registrado_por = auth.uid()
  OR assistido_id IN (SELECT id FROM public.assistidos WHERE user_id = auth.uid())
);

-- 4. profiles: remove overly broad coordenador read; provide safe name directory
DROP POLICY IF EXISTS "Coordenador reads profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.staff_directory
WITH (security_invoker = false) AS
  SELECT user_id, nome_completo FROM public.profiles;

GRANT SELECT ON public.staff_directory TO authenticated;