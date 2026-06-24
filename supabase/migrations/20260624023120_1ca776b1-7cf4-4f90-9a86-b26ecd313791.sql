-- Encerramento manual e auditável de item da fila inviável por erro de cadastro.
-- Atua SOMENTE sobre o item atual: não altera opt_out, consentimento, preferências
-- nem bloqueia o assistido. Futuros eventos elegíveis continuam podendo notificar.

CREATE OR REPLACE FUNCTION public.fn_encerrar_item_fila_erro_cadastro(
  p_fila_id uuid,
  p_motivo text DEFAULT 'erro_cadastro',
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.notificacoes_fila%ROWTYPE;
  v_motivos_cadastro text[] := ARRAY[
    'sem_telefone', 'telefone_invalido', 'dados_obrigatorios_ausentes', 'nome_ausente'
  ];
  v_motivo_anterior text;
  v_encerramento jsonb;
BEGIN
  -- 1) Permissão: somente perfis administrativos autorizados.
  IF v_uid IS NULL
     OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'administrador_master')) THEN
    RAISE EXCEPTION 'permissao_negada'
      USING HINT = 'Apenas administradores podem encerrar itens com erro de cadastro.';
  END IF;

  -- 2) Item precisa existir.
  SELECT * INTO v_item FROM public.notificacoes_fila WHERE id = p_fila_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_inexistente' USING HINT = 'Item da fila não encontrado.';
  END IF;

  -- 3) Não reprocessar itens já enviados ou já cancelados.
  IF v_item.status = 'enviado' THEN
    RAISE EXCEPTION 'item_ja_enviado'
      USING HINT = 'Não é possível encerrar um item que já foi enviado.';
  END IF;
  IF v_item.status = 'cancelado' THEN
    RAISE EXCEPTION 'item_ja_cancelado'
      USING HINT = 'Este item já está encerrado/cancelado.';
  END IF;

  -- 4) Elegibilidade: o motivo atual precisa ser realmente um erro de cadastro.
  v_motivo_anterior := v_item.erro;
  IF v_motivo_anterior IS NULL OR NOT (v_motivo_anterior = ANY(v_motivos_cadastro)) THEN
    RAISE EXCEPTION 'motivo_nao_elegivel'
      USING HINT = 'Esta ação só vale para itens com erro de cadastro (ex.: sem telefone).';
  END IF;

  -- 5) Encerrar SOMENTE o item atual. Sem tocar em preferências/opt-out/consentimento.
  v_encerramento := jsonb_build_object(
    'encerrado_manualmente', true,
    'origem_manual', 'central_notificacoes',
    'motivo_encerramento', COALESCE(p_motivo, 'erro_cadastro'),
    'motivo_anterior', v_motivo_anterior,
    'observacao', p_observacao,
    'encerrado_por', v_uid,
    'encerrado_em', now()
  );

  UPDATE public.notificacoes_fila
  SET status = 'cancelado',
      erro = 'erro_cadastro',
      payload_json = COALESCE(payload_json, '{}'::jsonb) || jsonb_build_object('encerramento', v_encerramento),
      updated_at = now()
  WHERE id = p_fila_id;

  -- 6) Trilha técnica no log da notificação.
  INSERT INTO public.notificacoes_log (fila_id, direcao, status, erro, payload_enviado)
  VALUES (
    p_fila_id, 'saida', 'cancelado', 'erro_cadastro',
    jsonb_build_object('acao', 'encerramento_manual_erro_cadastro', 'detalhe', v_encerramento)
  );

  -- 7) Auditoria da ação humana.
  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_uid,
    'encerrar_item_fila_erro_cadastro',
    'notificacoes_fila',
    p_fila_id,
    jsonb_build_object(
      'status', v_item.status,
      'erro', v_motivo_anterior,
      'assistido_id', v_item.assistido_id,
      'telefone_normalizado', v_item.telefone_normalizado,
      'evento_origem', v_item.evento_origem
    ),
    jsonb_build_object(
      'status', 'cancelado',
      'erro', 'erro_cadastro',
      'encerramento', v_encerramento
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'fila_id', p_fila_id,
    'status', 'cancelado',
    'motivo_encerramento', COALESCE(p_motivo, 'erro_cadastro'),
    'motivo_anterior', v_motivo_anterior,
    'assistido_id', v_item.assistido_id,
    'encerrado_por', v_uid,
    'encerrado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_encerrar_item_fila_erro_cadastro(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_encerrar_item_fila_erro_cadastro(uuid, text, text) TO authenticated, service_role;