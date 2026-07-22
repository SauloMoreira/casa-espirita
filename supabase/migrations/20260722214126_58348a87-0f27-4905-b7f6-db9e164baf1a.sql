CREATE OR REPLACE FUNCTION public.fn_conceder_acesso_operacional(p_target_user_id uuid, p_role public.app_role, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_inserted boolean := false;
BEGIN
  IF NOT public.is_active_admin(v_caller) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores ativos podem conceder acessos operacionais.');
  END IF;

  -- Papéis operacionais permitidos. Assistido (base) e administrativos são recusados.
  IF p_role NOT IN ('entrevistador','tarefeiro','coordenador_de_tratamento','agente_acao_social') THEN
    IF p_role = 'assistido' THEN
      RETURN jsonb_build_object('error', 'Assistido é o papel base automático e não é gerenciado na Gestão de Acesso.');
    ELSIF p_role IN ('admin','administrador_master') THEN
      RETURN jsonb_build_object('error', 'Acessos administrativos são concedidos apenas pelo fluxo de aprovação reforçado.');
    ELSE
      RETURN jsonb_build_object('error', 'Papel operacional inválido.');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado.');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('success', true, 'status', 'ja_concedido', 'role', p_role);
  END IF;

  INSERT INTO public.audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_caller, 'user_roles', 'ACESSO_OPERACIONAL_CONCEDIDO', p_target_user_id,
    jsonb_build_object('target_user_id', p_target_user_id, 'role', p_role, 'motivo', p_motivo));

  RETURN jsonb_build_object('success', true, 'status', 'concedido', 'role', p_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_revogar_acesso_operacional(p_target_user_id uuid, p_role public.app_role, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_deleted boolean := false;
BEGIN
  IF NOT public.is_active_admin(v_caller) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores ativos podem revogar acessos operacionais.');
  END IF;

  IF p_role NOT IN ('entrevistador','tarefeiro','coordenador_de_tratamento','agente_acao_social') THEN
    IF p_role = 'assistido' THEN
      RETURN jsonb_build_object('error', 'Assistido é o papel base automático e não pode ser revogado na Gestão de Acesso.');
    ELSIF p_role IN ('admin','administrador_master') THEN
      RETURN jsonb_build_object('error', 'Acessos administrativos são revogados apenas pelo fluxo de governança administrativa.');
    ELSE
      RETURN jsonb_build_object('error', 'Papel operacional inválido.');
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id AND role = p_role;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF NOT v_deleted THEN
    RETURN jsonb_build_object('success', true, 'status', 'inexistente', 'role', p_role);
  END IF;

  INSERT INTO public.audit_logs (user_id, tabela, acao, registro_id, dados_anteriores)
  VALUES (v_caller, 'user_roles', 'ACESSO_OPERACIONAL_REVOGADO', p_target_user_id,
    jsonb_build_object('target_user_id', p_target_user_id, 'role', p_role, 'motivo', p_motivo));

  RETURN jsonb_build_object('success', true, 'status', 'revogado', 'role', p_role);
END;
$function$;