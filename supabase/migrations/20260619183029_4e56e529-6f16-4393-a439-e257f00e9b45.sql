DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can send realtime" ON realtime.messages;

CREATE POLICY "Scoped realtime receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic LIKE ('avisos-' || auth.uid()::text || '%')
  OR (
    topic LIKE 'sessao-%'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coordenador_de_tratamento')
      OR public.has_role(auth.uid(), 'tarefeiro')
    )
  )
);

CREATE POLICY "Scoped realtime send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  topic LIKE ('avisos-' || auth.uid()::text || '%')
  OR (
    topic LIKE 'sessao-%'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coordenador_de_tratamento')
      OR public.has_role(auth.uid(), 'tarefeiro')
    )
  )
);