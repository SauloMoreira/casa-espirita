DROP POLICY IF EXISTS "Staff gerencia entregas acao social" ON public.acao_social_entregas;

CREATE POLICY "Staff gerencia entregas acao social"
  ON public.acao_social_entregas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social') OR public.has_role(auth.uid(), 'tarefeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social') OR public.has_role(auth.uid(), 'tarefeiro'));

CREATE OR REPLACE FUNCTION public.listar_beneficiarios_para_entrega(p_competencia date)
RETURNS TABLE (
  beneficiario_id uuid,
  nome text,
  celular text,
  ativo boolean,
  entrega_id uuid,
  entregue boolean,
  entregue_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.nome,
    b.celular,
    b.ativo,
    e.id,
    COALESCE(e.entregue, false),
    e.entregue_em
  FROM public.acao_social_beneficiarios b
  LEFT JOIN public.acao_social_entregas e
    ON e.beneficiario_id = b.id AND e.competencia = date_trunc('month', p_competencia)::date
  WHERE b.ativo = true
  ORDER BY b.nome;
$$;

REVOKE ALL ON FUNCTION public.listar_beneficiarios_para_entrega(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_beneficiarios_para_entrega(date) TO authenticated;