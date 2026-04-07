
DROP POLICY IF EXISTS "Authenticated insert own checkin" ON public.checkins_publicos;
CREATE POLICY "Authenticated insert own checkin" ON public.checkins_publicos
  FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid() OR assistido_id IN (SELECT id FROM assistidos WHERE user_id = auth.uid()));
