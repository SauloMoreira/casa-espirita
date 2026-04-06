CREATE POLICY "Assistido updates own record"
ON public.assistidos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());