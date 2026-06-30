-- =====================================================================
-- P1 — Lote B · Endurecimento de funções privilegiadas
-- =====================================================================

-- 1) preparar_envio_institucional
--    Caller oficial = UI autenticada com guarda interna de gestor.
--    Execução interna NÃO é derivada de auth.uid() nulo: a ausência de
--    sessão é tratada explicitamente como acesso negado. Não há caminho
--    service_role/interno (caller único confirmado: src/services/comunicacaoInstitucional.ts).
CREATE OR REPLACE FUNCTION public.preparar_envio_institucional(
  p_comunicacao_id uuid, p_versao text, p_janela_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_com RECORD;
  v_janela integer := GREATEST(COALESCE(p_janela_dias, 7), 0);
  v_total integer := 0;
  v_bloqueados integer := 0;
BEGIN
  -- Guarda explícita: sem sessão -> negado (não é atalho de execução interna).
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Sessão obrigatória para preparar o envio.');
  END IF;
  -- Caller oficial: gestor (administrador, administrador_master, coordenador_de_tratamento).
  IF NOT public.fn_eh_gestor(v_uid) THEN
    RETURN jsonb_build_object('error', 'Apenas gestores podem preparar o envio.');
  END IF;

  IF p_versao IS NULL OR length(trim(p_versao)) = 0 THEN
    RETURN jsonb_build_object('error', 'Versão do termo de consentimento é obrigatória.');
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
  JOIN notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND p.whatsapp_ativo = true
    AND p.consentimento_status = 'concedido'
    AND p.consentimento_versao = p_versao
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
  VALUES (v_uid, 'comunicacoes_institucionais', 'ENVIO_PREPARADO', p_comunicacao_id,
    jsonb_build_object('total', v_total, 'bloqueados', v_bloqueados, 'janela_dias', v_janela, 'versao', p_versao));

  RETURN jsonb_build_object('success', true, 'total', v_total, 'bloqueados', v_bloqueados);
END;
$function$;

COMMENT ON FUNCTION public.preparar_envio_institucional(uuid, text, integer) IS
  'P1/Lote B: caller oficial = UI autenticada com guarda fn_eh_gestor; sessão obrigatória (auth.uid() nulo = negado, sem atalho interno); sem caminho service_role.';

-- Garante que o caminho de execução seja apenas authenticated (sem anon).
REVOKE EXECUTE ON FUNCTION public.preparar_envio_institucional(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparar_envio_institucional(uuid, text, integer) TO authenticated;

-- 2) Funções de piloto/homologação: mantêm guarda dura (admin) no Lote B.
--    Registradas como DÉBITO DE EXPIRAÇÃO: existem por causa do piloto/homologação
--    e devem ser revisadas para remoção ou restrição ainda mais dura ao encerrar o piloto.
COMMENT ON FUNCTION public.pts_homologacao_auditar(uuid, text, jsonb) IS
  'P1/Lote B: guarda dura (admin) mantida. DÉBITO DE EXPIRAÇÃO: função existe por causa do piloto/homologação; revisar para remoção/restrição ao encerrar o piloto.';

COMMENT ON FUNCTION public.pts_rollback_piloto(uuid) IS
  'P1/Lote B: guarda dura (admin) mantida. DÉBITO DE EXPIRAÇÃO: função existe por causa do piloto; revisar para remoção/restrição ao encerrar o piloto.';

REVOKE EXECUTE ON FUNCTION public.pts_homologacao_auditar(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pts_rollback_piloto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pts_homologacao_auditar(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pts_rollback_piloto(uuid) TO authenticated;