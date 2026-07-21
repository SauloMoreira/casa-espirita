CREATE OR REPLACE FUNCTION public.contar_publico_elegivel(p_versao text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'nao autorizado';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.assistidos a
  LEFT JOIN public.notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND COALESCE(p.consentimento_status, 'concedido') <> 'revogado'
    AND COALESCE(p.whatsapp_ativo, true) = true;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_envio_institucional(
  p_comunicacao_id uuid,
  p_versao text,
  p_janela_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_com RECORD;
  v_janela integer := GREATEST(COALESCE(p_janela_dias, 7), 0);
  v_total integer := 0;
  v_bloqueados integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem preparar o envio.');
  END IF;

  SELECT * INTO v_com FROM comunicacoes_institucionais WHERE id = p_comunicacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Comunicação não encontrada.');
  END IF;
  IF v_com.status <> 'aprovada' THEN
    RETURN jsonb_build_object('error', 'A comunicação precisa estar aprovada antes do envio.');
  END IF;
  IF v_com.envio_status NOT IN ('nao_iniciado', 'preparado') THEN
    RETURN jsonb_build_object('error', 'O envio desta comunicação já foi iniciado ou concluído.');
  END IF;

  INSERT INTO comunicacoes_institucionais_envios (
    comunicacao_id, assistido_id, telefone_normalizado, status, motivo
  )
  SELECT
    p_comunicacao_id,
    a.id,
    fn_normalize_phone(COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, ''))),
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'bloqueado'
      ELSE 'pendente'
    END,
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'limite_frequencia'
      ELSE NULL
    END
  FROM assistidos a
  LEFT JOIN notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND COALESCE(p.consentimento_status, 'concedido') <> 'revogado'
    AND COALESCE(p.whatsapp_ativo, true) = true
  ON CONFLICT (comunicacao_id, assistido_id) DO NOTHING;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'bloqueado')
  INTO v_total, v_bloqueados
  FROM comunicacoes_institucionais_envios
  WHERE comunicacao_id = p_comunicacao_id;

  UPDATE comunicacoes_institucionais
  SET envio_status = 'preparado',
      total_destinatarios = v_total,
      total_bloqueados = v_bloqueados
  WHERE id = p_comunicacao_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'comunicacoes_institucionais', 'ENVIO_PREPARADO', p_comunicacao_id,
    jsonb_build_object('total', v_total, 'bloqueados', v_bloqueados, 'janela_dias', v_janela, 'modelo', 'opt-out'));

  RETURN jsonb_build_object('success', true, 'total', v_total, 'bloqueados', v_bloqueados);
END;
$$;