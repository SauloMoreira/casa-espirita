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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agente_acao_social')
    OR public.has_role(auth.uid(), 'tarefeiro')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de admin, agente de ação social ou tarefeiro.';
  END IF;

  RETURN QUERY
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
END;
$$;

ALTER TABLE public.configuracoes_gerais
  ADD COLUMN IF NOT EXISTS sensivel boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Authenticated can read config" ON public.configuracoes_gerais;

CREATE POLICY "Authenticated read non-sensitive config"
  ON public.configuracoes_gerais
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(sensivel, false) = false
    OR public.has_role(auth.uid(), 'admin')
  );