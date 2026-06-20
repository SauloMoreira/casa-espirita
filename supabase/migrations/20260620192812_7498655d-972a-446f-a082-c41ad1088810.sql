CREATE POLICY "Block client inserts on cadastro_solicitacoes"
ON public.cadastro_solicitacoes
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client inserts on checkin_tentativas"
ON public.checkin_tentativas
FOR INSERT
TO authenticated, anon
WITH CHECK (false);