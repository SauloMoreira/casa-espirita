CREATE POLICY "Tarefeiros read assistidos"
ON public.assistidos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'tarefeiro'::app_role));