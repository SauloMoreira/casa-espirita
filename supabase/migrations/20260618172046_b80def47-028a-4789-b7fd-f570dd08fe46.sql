CREATE OR REPLACE FUNCTION public.gerenciar_voluntario(
  p_action text,
  p_voluntario_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_exists boolean;
  v_nome text;
  v_blockers text[] := ARRAY[]::text[];
  v_funcoes int;
  v_can_delete boolean;
BEGIN
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem gerenciar voluntários');
  END IF;

  IF p_action NOT IN ('inactivate','reactivate','check','delete') THEN
    RETURN jsonb_build_object('error', 'Ação inválida');
  END IF;

  SELECT true, nome_completo INTO v_exists, v_nome
  FROM voluntarios WHERE id = p_voluntario_id;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('error', 'Voluntário não encontrado');
  END IF;

  -- INACTIVATE
  IF p_action = 'inactivate' THEN
    UPDATE voluntarios SET status = 'inativo' WHERE id = p_voluntario_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (auth.uid(), 'voluntarios', 'VOLUNTARIO_INACTIVATED', p_voluntario_id,
      jsonb_build_object('executed_by', auth.uid(), 'motivo', p_motivo, 'nome', v_nome));
    RETURN jsonb_build_object('success', true, 'message', 'Voluntário inativado. O histórico foi preservado.');
  END IF;

  -- REACTIVATE
  IF p_action = 'reactivate' THEN
    UPDATE voluntarios SET status = 'ativo' WHERE id = p_voluntario_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (auth.uid(), 'voluntarios', 'VOLUNTARIO_REACTIVATED', p_voluntario_id,
      jsonb_build_object('executed_by', auth.uid(), 'motivo', p_motivo, 'nome', v_nome));
    RETURN jsonb_build_object('success', true, 'message', 'Voluntário reativado.');
  END IF;

  -- Evaluate critical links (CHECK / DELETE)
  SELECT COUNT(*) INTO v_funcoes FROM voluntario_funcoes WHERE voluntario_id = p_voluntario_id;
  IF v_funcoes > 0 THEN v_blockers := array_append(v_blockers, 'vínculos com funções/atuações'); END IF;

  IF EXISTS (SELECT 1 FROM voluntarios WHERE id = p_voluntario_id AND data_adesao_voluntariado IS NOT NULL) THEN
    v_blockers := array_append(v_blockers, 'termo de adesão assinado');
  END IF;

  v_can_delete := array_length(v_blockers, 1) IS NULL;

  IF p_action = 'check' THEN
    RETURN jsonb_build_object('success', true, 'can_delete', v_can_delete, 'blockers', to_jsonb(v_blockers));
  END IF;

  -- DELETE: always audit the attempt
  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'voluntarios', 'VOLUNTARIO_DELETE_ATTEMPT', p_voluntario_id,
    jsonb_build_object('executed_by', auth.uid(), 'motivo', p_motivo, 'can_delete', v_can_delete, 'blockers', to_jsonb(v_blockers), 'nome', v_nome));

  IF NOT v_can_delete THEN
    RETURN jsonb_build_object(
      'error', 'Exclusão bloqueada: o voluntário possui vínculos históricos relevantes.',
      'blockers', to_jsonb(v_blockers),
      'suggestion', 'Use a inativação para preservar o histórico.'
    );
  END IF;

  DELETE FROM voluntario_funcoes WHERE voluntario_id = p_voluntario_id;
  DELETE FROM voluntarios WHERE id = p_voluntario_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'voluntarios', 'VOLUNTARIO_DELETED', p_voluntario_id,
    jsonb_build_object('executed_by', auth.uid(), 'motivo', p_motivo, 'nome', v_nome));

  RETURN jsonb_build_object('success', true, 'message', 'Voluntário excluído definitivamente.');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerenciar_voluntario(text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gerenciar_voluntario(text, uuid, text) FROM anon;