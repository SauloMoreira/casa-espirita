CREATE OR REPLACE FUNCTION public.pts_homologacao_auditar(
  p_assistido_id uuid,
  p_acao text,
  p_resultado jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem auditar a homologação.' USING ERRCODE='42501';
  END IF;

  IF p_acao NOT IN ('PLANO_PREVIA_HOMOLOGACAO','PLANO_REPROCESSAMENTO_HOMOLOGACAO') THEN
    RAISE EXCEPTION 'Ação de auditoria inválida: %', p_acao;
  END IF;

  PERFORM 1 FROM assistidos WHERE id = p_assistido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assistido não encontrado.'; END IF;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_uid, 'assistidos', p_acao, p_assistido_id, COALESCE(p_resultado,'{}'::jsonb));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.pts_homologacao_auditar(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pts_homologacao_auditar(uuid,text,jsonb) TO authenticated, service_role;