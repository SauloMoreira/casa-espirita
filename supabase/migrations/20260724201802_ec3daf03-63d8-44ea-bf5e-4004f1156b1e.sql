CREATE OR REPLACE FUNCTION public.meu_assistido_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.assistidos WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.meu_assistido_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_assistido_id() TO authenticated;

-- 1) agenda_tratamentos_assistido
DROP POLICY IF EXISTS "Assistido views own agenda" ON public.agenda_tratamentos_assistido;
CREATE POLICY "Assistido views own agenda" ON public.agenda_tratamentos_assistido
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 2) assistido_tratamentos
DROP POLICY IF EXISTS "Assistido views own tratamentos" ON public.assistido_tratamentos;
CREATE POLICY "Assistido views own tratamentos" ON public.assistido_tratamentos
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 3) avisos_ausencia
DROP POLICY IF EXISTS "Assistido vê os próprios avisos" ON public.avisos_ausencia;
CREATE POLICY "Assistido vê os próprios avisos" ON public.avisos_ausencia
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 4) consentimentos_comunicacao (SELECT)
DROP POLICY IF EXISTS "Assistido vê seu histórico de consentimento" ON public.consentimentos_comunicacao;
CREATE POLICY "Assistido vê seu histórico de consentimento" ON public.consentimentos_comunicacao
  FOR SELECT TO authenticated
  USING (
    (assistido_id = public.meu_assistido_id())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador_de_tratamento'::app_role)
  );

-- 5) consentimentos_comunicacao (INSERT)
DROP POLICY IF EXISTS "Registro de consentimento" ON public.consentimentos_comunicacao;
CREATE POLICY "Registro de consentimento" ON public.consentimentos_comunicacao
  FOR INSERT TO authenticated
  WITH CHECK (
    (assistido_id = public.meu_assistido_id())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador_de_tratamento'::app_role)
  );

-- 6) entrevistas_fraternas
DROP POLICY IF EXISTS "Assistido views own entrevistas" ON public.entrevistas_fraternas;
CREATE POLICY "Assistido views own entrevistas" ON public.entrevistas_fraternas
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 7) notificacoes_preferencias (ALL)
DROP POLICY IF EXISTS "Assistido manages own notif prefs" ON public.notificacoes_preferencias;
CREATE POLICY "Assistido manages own notif prefs" ON public.notificacoes_preferencias
  FOR ALL TO authenticated
  USING (assistido_id = public.meu_assistido_id())
  WITH CHECK (assistido_id = public.meu_assistido_id());

-- 8) orientacoes_assistido
DROP POLICY IF EXISTS "Assistido views own orientacoes" ON public.orientacoes_assistido;
CREATE POLICY "Assistido views own orientacoes" ON public.orientacoes_assistido
  FOR SELECT TO authenticated
  USING (
    (visivel_assistido = true)
    AND (assistido_id = public.meu_assistido_id())
  );

-- 9) plano_tratamento_sessoes
DROP POLICY IF EXISTS "Assistido views own plano_tratamento_sessoes" ON public.plano_tratamento_sessoes;
CREATE POLICY "Assistido views own plano_tratamento_sessoes" ON public.plano_tratamento_sessoes
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 10) presencas_palestras
DROP POLICY IF EXISTS "Assistido views own presencas_palestras" ON public.presencas_palestras;
CREATE POLICY "Assistido views own presencas_palestras" ON public.presencas_palestras
  FOR SELECT TO authenticated
  USING (assistido_id = public.meu_assistido_id());

-- 11) checkins_publicos (INSERT)
DROP POLICY IF EXISTS "Authenticated insert own checkin" ON public.checkins_publicos;
CREATE POLICY "Authenticated insert own checkin" ON public.checkins_publicos
  FOR INSERT TO authenticated
  WITH CHECK (
    (registrado_por = auth.uid())
    OR (assistido_id = public.meu_assistido_id())
  );

-- 12) checkins_publicos (SELECT)
DROP POLICY IF EXISTS "Staff and owners read checkins" ON public.checkins_publicos;
CREATE POLICY "Staff and owners read checkins" ON public.checkins_publicos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'tarefeiro'::app_role)
    OR has_role(auth.uid(), 'coordenador_de_tratamento'::app_role)
    OR (registrado_por = auth.uid())
    OR (assistido_id = public.meu_assistido_id())
  );