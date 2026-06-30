-- ============================================================
-- P1 — Lote A: endurecimento de superfícies privilegiadas
-- ============================================================

-- Auxiliares de perfil (SECURITY DEFINER, executáveis por authenticated p/ uso em guardas)
CREATE OR REPLACE FUNCTION public.fn_eh_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _uid AND ur.role <> 'assistido'::app_role
  );
$$;
REVOKE ALL ON FUNCTION public.fn_eh_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_eh_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_eh_gestor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'administrador_master'::app_role)
    OR public.has_role(_uid, 'coordenador_de_tratamento'::app_role)
  );
$$;
REVOKE ALL ON FUNCTION public.fn_eh_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_eh_gestor(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- A1: fn_excecao_alvos — helper 100% interno que retorna PII
-- (telefone/nome). Sem chamada direta do frontend. Revogar de
-- authenticated; permanece chamável pelo pipeline (service_role
-- / SECURITY DEFINER chamador).
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_excecao_alvos(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- A2: pipeline de exceção (admin UI + cron). Exigir gestor quando
-- houver usuário autenticado; permitir execução interna (cron via
-- service_role, auth.uid() IS NULL).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_processar_excecao_notificacoes(p_excecao_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  e record; t record; v_tipo text; v_event public.notif_evento; v_template text;
  v_dedupe text; v_payload jsonb; v_count int := 0; v_fallback int := 0;
  v_nova_data date; v_novo_horario time; v_nova_ts timestamptz;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.fn_eh_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de gestão.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO e FROM excecoes_operacionais WHERE id = p_excecao_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('erro', 'excecao_inexistente'); END IF;
  IF e.ativo = false THEN RETURN jsonb_build_object('ignorado', 'excecao_inativa'); END IF;

  IF lower(coalesce((SELECT valor FROM regras_operacionais WHERE chave = 'excecao_notificacao_ativa'), 'true')) <> 'true' THEN
    RETURN jsonb_build_object('contido', 'rollout_pausado');
  END IF;

  IF e.status = 'remarcado' AND e.nova_data IS NOT NULL THEN
    v_tipo := 'remarcacao'; v_nova_data := e.nova_data; v_novo_horario := e.novo_horario;
  ELSE
    v_tipo := 'cancelamento';
  END IF;

  PERFORM set_config('app.excecao_ctx', '1', true);

  FOR t IN SELECT * FROM fn_excecao_alvos(p_excecao_id) LOOP
    IF t.usou_fallback_nome THEN v_fallback := v_fallback + 1; END IF;

    IF t.dominio = 'tratamento' THEN
      v_event := (CASE WHEN v_tipo='remarcacao' THEN 'sessao_remarcada_por_excecao' ELSE 'sessao_cancelada_por_excecao' END)::public.notif_evento;
      v_template := CASE WHEN v_tipo='remarcacao' THEN 'sessao_remarcada_excecao' ELSE 'sessao_cancelada_excecao' END;
    ELSIF t.dominio = 'entrevista' THEN
      v_event := (CASE WHEN v_tipo='remarcacao' THEN 'entrevista_remarcada_por_excecao' ELSE 'entrevista_cancelada_por_excecao' END)::public.notif_evento;
      v_template := CASE WHEN v_tipo='remarcacao' THEN 'entrevista_remarcada_excecao' ELSE 'entrevista_cancelada_excecao' END;
    ELSE
      v_event := (CASE WHEN v_tipo='remarcacao' THEN 'publico_remarcado_por_excecao' ELSE 'publico_cancelado_por_excecao' END)::public.notif_evento;
      v_template := CASE WHEN v_tipo='remarcacao' THEN 'publico_remarcado_excecao' ELSE 'publico_cancelado_excecao' END;
    END IF;

    IF t.dominio = 'tratamento' THEN
      IF v_tipo = 'cancelamento' THEN
        UPDATE agenda_tratamentos_assistido SET status = 'cancelado', updated_at = now()
          WHERE id = t.sessao_ref AND status = 'agendado';
      ELSE
        UPDATE agenda_tratamentos_assistido
          SET data_sessao = v_nova_data, horario = COALESCE(v_novo_horario, horario), updated_at = now()
          WHERE id = t.sessao_ref AND status = 'agendado'
            AND (data_sessao <> v_nova_data OR COALESCE(horario,'00:00') <> COALESCE(v_novo_horario, horario, '00:00'));
      END IF;
    ELSIF t.dominio = 'entrevista' THEN
      IF v_tipo = 'cancelamento' THEN
        UPDATE entrevistas_fraternas SET status = 'cancelada', updated_at = now()
          WHERE id = t.sessao_ref AND status NOT IN ('cancelada','remarcada','concluida','realizada');
      ELSE
        v_nova_ts := (v_nova_data::timestamp + COALESCE(v_novo_horario, t.horario_impactado, '08:00'::time));
        UPDATE entrevistas_fraternas SET data = v_nova_ts, updated_at = now()
          WHERE id = t.sessao_ref AND status NOT IN ('cancelada','remarcada','concluida','realizada') AND data <> v_nova_ts;
      END IF;
    ELSE
      IF v_tipo = 'cancelamento' THEN
        UPDATE sessoes_publicas SET status = 'cancelado', updated_at = now()
          WHERE id = t.sessao_ref AND status <> 'cancelado';
      ELSE
        UPDATE sessoes_publicas
          SET data_sessao = v_nova_data, horario_inicio = COALESCE(v_novo_horario, horario_inicio), updated_at = now()
          WHERE id = t.sessao_ref AND status <> 'cancelado'
            AND (data_sessao <> v_nova_data OR COALESCE(horario_inicio,'00:00') <> COALESCE(v_novo_horario, horario_inicio, '00:00'));
      END IF;
    END IF;

    v_payload := jsonb_strip_nulls(jsonb_build_object(
      'nome', t.nome, 'tratamento', t.tratamento, 'data', t.data_impactada, 'horario', t.horario_impactado,
      'excecao_id', p_excecao_id, 'motivo_origem', 'excecao_operacional', 'evento_tipo', v_tipo,
      'compromisso_id', t.compromisso_id, 'data_impactada', t.data_impactada));
    IF v_tipo = 'remarcacao' THEN
      v_payload := v_payload || jsonb_strip_nulls(jsonb_build_object(
        'data_anterior', t.data_impactada, 'nova_data', v_nova_data, 'novo_horario', v_novo_horario));
    END IF;

    v_dedupe := v_event::text || ':' || t.compromisso_id::text || ':' || p_excecao_id::text;

    IF t.assistido_id IS NOT NULL THEN
      PERFORM fn_enqueue_notificacao(v_event, t.assistido_id, v_template, v_payload, now(), v_dedupe);
    ELSIF t.telefone IS NOT NULL THEN
      INSERT INTO notificacoes_fila (evento_origem, assistido_id, telefone_normalizado, canal, template_codigo, payload_json, status, scheduled_at, dedupe_key)
      VALUES (v_event, NULL, t.telefone, 'whatsapp', v_template, v_payload, 'pendente', now(), v_dedupe)
      ON CONFLICT (dedupe_key) DO NOTHING;
    ELSE
      CONTINUE;
    END IF;

    INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
    SELECT f.id, 'saida', 'enfileirado', 'excecao_operacional' FROM notificacoes_fila f
    WHERE f.dedupe_key = v_dedupe
      AND NOT EXISTS (SELECT 1 FROM notificacoes_log l WHERE l.fila_id = f.id AND l.status = 'enfileirado');

    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('app.excecao_ctx', '', true);

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'excecoes_operacionais', 'PROCESSAR_NOTIFICACAO', p_excecao_id,
          jsonb_build_object('evento_tipo', v_tipo, 'alvos', v_count, 'fallback_por_nome', v_fallback, 'tipo_excecao', e.tipo));

  RETURN jsonb_build_object('evento_tipo', v_tipo, 'alvos', v_count, 'fallback_por_nome', v_fallback);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_reconciliar_excecoes_notificacoes()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; v_total int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.fn_eh_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de gestão.' USING ERRCODE='42501';
  END IF;
  IF lower(coalesce((SELECT valor FROM regras_operacionais WHERE chave = 'excecao_notificacao_ativa'), 'true')) <> 'true' THEN
    RETURN jsonb_build_object('contido', 'rollout_pausado', 'processadas', 0);
  END IF;
  FOR r IN
    SELECT id FROM excecoes_operacionais
    WHERE ativo = true AND status IN ('cancelado', 'remarcado')
      AND COALESCE(nova_data, data_excecao) >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)
  LOOP
    PERFORM fn_processar_excecao_notificacoes(r.id);
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('processadas', v_total);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_sanear_fila_notificacoes()
 RETURNS TABLE(r_fila_id uuid, r_motivo text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.fn_eh_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de gestão.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH alvo AS (
    SELECT f.id AS fid, public.fn_fila_motivo_inelegivel(f.id) AS mot
    FROM notificacoes_fila f
    WHERE f.status IN ('pendente','agendado')
      AND f.evento_origem IN ('sessao_lembrete','sessao_criada','entrevista_lembrete','entrevista_criada')
  ),
  inelegiveis AS (SELECT fid, mot FROM alvo WHERE mot IS NOT NULL),
  logged AS (
    INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
    SELECT fid, 'saida', 'cancelado', mot FROM inelegiveis RETURNING 1
  ),
  upd AS (
    UPDATE notificacoes_fila nf SET status = 'cancelado', erro = i.mot, updated_at = now()
    FROM inelegiveis i WHERE nf.id = i.fid RETURNING nf.id AS uid, i.mot AS umot
  )
  SELECT u.uid, u.umot FROM upd u;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_monitor_excecao_notificacoes(p_desde timestamp with time zone DEFAULT (now() - '14 days'::interval))
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.fn_eh_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de gestão.' USING ERRCODE='42501';
  END IF;
  RETURN (SELECT jsonb_build_object(
    'rollout_ativo', lower(coalesce((SELECT valor FROM regras_operacionais WHERE chave='excecao_notificacao_ativa'),'true')) = 'true',
    'desde', p_desde,
    'excecoes_processadas', (SELECT count(*) FROM audit_logs WHERE tabela='excecoes_operacionais' AND acao='PROCESSAR_NOTIFICACAO' AND created_at >= p_desde),
    'cancelamentos', (SELECT count(*) FROM audit_logs WHERE tabela='excecoes_operacionais' AND acao='PROCESSAR_NOTIFICACAO' AND created_at >= p_desde AND dados_novos->>'evento_tipo'='cancelamento'),
    'remarcacoes', (SELECT count(*) FROM audit_logs WHERE tabela='excecoes_operacionais' AND acao='PROCESSAR_NOTIFICACAO' AND created_at >= p_desde AND dados_novos->>'evento_tipo'='remarcacao'),
    'fila_por_status', (SELECT coalesce(jsonb_object_agg(status, c), '{}'::jsonb) FROM (SELECT status, count(*) c FROM notificacoes_fila WHERE evento_origem::text LIKE '%excecao%' AND created_at >= p_desde GROUP BY status) s),
    'fila_por_evento', (SELECT coalesce(jsonb_object_agg(evento_origem, c), '{}'::jsonb) FROM (SELECT evento_origem::text evento_origem, count(*) c FROM notificacoes_fila WHERE evento_origem::text LIKE '%excecao%' AND created_at >= p_desde GROUP BY evento_origem) e),
    'fallback_por_nome', (SELECT coalesce(sum((dados_novos->>'fallback_por_nome')::int),0) FROM audit_logs WHERE tabela='excecoes_operacionais' AND acao='PROCESSAR_NOTIFICACAO' AND created_at >= p_desde),
    'publico_com_alvo', (SELECT count(DISTINCT (dados_novos->>'tipo_excecao')) FROM audit_logs WHERE tabela='excecoes_operacionais' AND acao='PROCESSAR_NOTIFICACAO' AND created_at >= p_desde AND dados_novos->>'tipo_excecao'='publico' AND (dados_novos->>'alvos')::int > 0),
    'dedupe_duplicados', (SELECT count(*) FROM (SELECT dedupe_key FROM notificacoes_fila WHERE evento_origem::text LIKE '%excecao%' AND created_at >= p_desde GROUP BY dedupe_key HAVING count(*) > 1) d)
  ));
END $function$;

-- ------------------------------------------------------------
-- A2: pts_registrar_presenca / pts_registrar_ausencia
-- Exigir perfil de equipe e gravar o operador real (auth.uid())
-- como registrado_por, ignorando o parâmetro do cliente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pts_registrar_ausencia(p_vinculo_id uuid, p_data date, p_registrado_por uuid, p_nova_data date DEFAULT NULL::date, p_nova_horario time without time zone DEFAULT NULL::time without time zone)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_vinc RECORD; v_etapa_ativa RECORD; v_max_remarc int; v_max_faltas int; v_max_dias int;
  v_suspender boolean := false; v_sessao_id uuid; v_nome text; v_trat text; v_tipo text; v_efetivo time without time zone;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT public.fn_eh_staff(v_uid) THEN RAISE EXCEPTION 'Acesso negado: requer perfil de equipe.' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;

  IF EXISTS (SELECT 1 FROM presencas_tratamentos WHERE assistido_tratamento_id = p_vinculo_id AND data = p_data) THEN
    RETURN jsonb_build_object('success', true, 'idempotente', true, 'suspenso', (v_vinc.status = 'suspenso'),
      'faltas_consecutivas', v_vinc.faltas_consecutivas, 'remarcacoes_automaticas', v_vinc.remarcacoes_automaticas);
  END IF;

  SELECT tt.tipo INTO v_tipo FROM tipos_tratamento tt WHERE tt.id = v_vinc.tratamento_id;

  INSERT INTO presencas_tratamentos (assistido_tratamento_id, data, status_presenca, registrado_por)
  VALUES (p_vinculo_id, p_data, 'ausente', v_uid);

  UPDATE assistido_tratamentos SET
    faltas_consecutivas = faltas_consecutivas + 1, remarcacoes_automaticas = remarcacoes_automaticas + 1,
    ultimo_status_operacional = 'ausente'
  WHERE id = p_vinculo_id;
  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id;

  SELECT COALESCE(MAX(CASE WHEN chave='tratamento_max_remarcacoes_automaticas' THEN valor::int END),7),
         COALESCE(MAX(CASE WHEN chave='tratamento_max_faltas_consecutivas' THEN valor::int END),3),
         COALESCE(MAX(CASE WHEN chave='tratamento_max_dias_sem_presenca' THEN valor::int END),60)
  INTO v_max_remarc, v_max_faltas, v_max_dias
  FROM regras_operacionais
  WHERE chave IN ('tratamento_max_remarcacoes_automaticas','tratamento_max_faltas_consecutivas','tratamento_max_dias_sem_presenca') AND ativo = true;

  v_suspender := (v_vinc.remarcacoes_automaticas >= v_max_remarc)
    OR (v_vinc.faltas_consecutivas >= v_max_faltas)
    OR (v_vinc.ultima_presenca_em IS NOT NULL AND (CURRENT_DATE - v_vinc.ultima_presenca_em) >= v_max_dias);

  SELECT * INTO v_etapa_ativa FROM plano_tratamento_sessoes
  WHERE assistido_tratamento_id = p_vinculo_id AND status_etapa = 'ativa' ORDER BY numero_etapa LIMIT 1;

  SELECT a.nome, tt.nome INTO v_nome, v_trat
  FROM assistidos a LEFT JOIN tipos_tratamento tt ON tt.id = v_vinc.tratamento_id WHERE a.id = v_vinc.assistido_id;

  IF v_suspender THEN
    UPDATE assistido_tratamentos SET status = 'suspenso', ultimo_status_operacional = 'suspenso' WHERE id = p_vinculo_id;
    IF FOUND AND v_etapa_ativa.id IS NOT NULL THEN
      UPDATE plano_tratamento_sessoes SET status_etapa = 'suspensa', updated_at = now() WHERE id = v_etapa_ativa.id;
      IF v_etapa_ativa.agenda_sessao_id IS NOT NULL THEN
        UPDATE agenda_tratamentos_assistido SET status = 'cancelado', updated_at = now() WHERE id = v_etapa_ativa.agenda_sessao_id;
      END IF;
    END IF;
    PERFORM fn_enqueue_notificacao('falta_registrada', v_vinc.assistido_id, 'tratamento_suspenso',
      jsonb_build_object('nome', v_nome, 'tratamento', v_trat), now(), 'tratamento_suspenso:'||p_vinculo_id||':'||p_data::text);
  ELSE
    IF v_etapa_ativa.id IS NOT NULL AND p_nova_data IS NOT NULL THEN
      IF v_tipo = 'holistico' AND p_nova_horario IS NULL THEN
        RAISE EXCEPTION 'Tratamentos holísticos exigem o horário da consulta.' USING ERRCODE='23514';
      END IF;
      IF v_etapa_ativa.agenda_sessao_id IS NOT NULL THEN
        UPDATE agenda_tratamentos_assistido SET status = 'ausente', updated_at = now() WHERE id = v_etapa_ativa.agenda_sessao_id;
      END IF;
      SELECT id INTO v_sessao_id FROM agenda_tratamentos_assistido
      WHERE assistido_tratamento_id = p_vinculo_id AND data_sessao = p_nova_data AND status = 'agendado' LIMIT 1;
      IF v_sessao_id IS NULL THEN
        INSERT INTO agenda_tratamentos_assistido (assistido_id, assistido_tratamento_id, tratamento_id, data_sessao, horario, status, registrado_por)
        VALUES (v_vinc.assistido_id, p_vinculo_id, v_vinc.tratamento_id, p_nova_data, p_nova_horario, 'agendado', v_uid)
        RETURNING horario INTO v_efetivo;
        SELECT id INTO v_sessao_id FROM agenda_tratamentos_assistido
        WHERE assistido_tratamento_id = p_vinculo_id AND data_sessao = p_nova_data AND status = 'agendado' ORDER BY created_at DESC LIMIT 1;
      ELSE
        UPDATE agenda_tratamentos_assistido SET horario = COALESCE(p_nova_horario, horario), updated_at = now()
        WHERE id = v_sessao_id RETURNING horario INTO v_efetivo;
      END IF;
      UPDATE plano_tratamento_sessoes
        SET data_prevista = p_nova_data, agenda_sessao_id = v_sessao_id, horario_previsto = v_efetivo, updated_at = now()
      WHERE id = v_etapa_ativa.id;
      PERFORM fn_enqueue_notificacao('falta_registrada', v_vinc.assistido_id, 'tratamento_ausencia_remarcada',
        jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'nova_data', p_nova_data),
        now(), 'tratamento_remarca:'||p_vinculo_id||':'||p_data::text);
    END IF;
  END IF;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_uid, 'plano_tratamento_sessoes', 'PLANO_AUSENCIA_REMARCA', p_vinculo_id,
    jsonb_build_object('data', p_data, 'nova_data', p_nova_data, 'suspenso', v_suspender,
      'faltas_consecutivas', v_vinc.faltas_consecutivas, 'remarcacoes', v_vinc.remarcacoes_automaticas));

  RETURN jsonb_build_object('success', true, 'suspenso', v_suspender,
    'faltas_consecutivas', v_vinc.faltas_consecutivas, 'remarcacoes_automaticas', v_vinc.remarcacoes_automaticas);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pts_registrar_presenca(p_vinculo_id uuid, p_data date, p_registrado_por uuid, p_proxima_numero_etapa integer DEFAULT NULL::integer, p_proxima_data date DEFAULT NULL::date, p_proxima_horario time without time zone DEFAULT NULL::time without time zone)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_vinc RECORD; v_etapa_ativa RECORD; v_concluido boolean := false; v_sessao_id uuid; v_tipo text; v_efetivo time without time zone;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT public.fn_eh_staff(v_uid) THEN RAISE EXCEPTION 'Acesso negado: requer perfil de equipe.' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;

  IF EXISTS (SELECT 1 FROM presencas_tratamentos WHERE assistido_tratamento_id = p_vinculo_id AND data = p_data) THEN
    RETURN jsonb_build_object('success', true, 'idempotente', true, 'concluido', (v_vinc.status = 'concluido'),
      'quantidade_realizada', v_vinc.quantidade_realizada, 'quantidade_total', v_vinc.quantidade_total);
  END IF;

  SELECT tt.tipo INTO v_tipo FROM tipos_tratamento tt WHERE tt.id = v_vinc.tratamento_id;

  INSERT INTO presencas_tratamentos (assistido_tratamento_id, data, status_presenca, registrado_por)
  VALUES (p_vinculo_id, p_data, 'presente', v_uid);

  SELECT * INTO v_etapa_ativa FROM plano_tratamento_sessoes
  WHERE assistido_tratamento_id = p_vinculo_id AND status_etapa = 'ativa' ORDER BY numero_etapa LIMIT 1;

  IF FOUND THEN
    UPDATE plano_tratamento_sessoes SET status_etapa = 'realizada', updated_at = now() WHERE id = v_etapa_ativa.id;
    IF v_etapa_ativa.agenda_sessao_id IS NOT NULL THEN
      UPDATE agenda_tratamentos_assistido SET status = 'realizada', updated_at = now() WHERE id = v_etapa_ativa.agenda_sessao_id;
    END IF;
  END IF;

  UPDATE assistido_tratamentos SET
    quantidade_realizada = LEAST(quantidade_realizada + 1, quantidade_total),
    ultima_presenca_em = p_data, faltas_consecutivas = 0, ultimo_status_operacional = 'presente',
    status = CASE WHEN status = 'aguardando_inicio' THEN 'em_andamento' ELSE status END
  WHERE id = p_vinculo_id;

  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id;

  IF v_vinc.quantidade_realizada >= v_vinc.quantidade_total THEN
    UPDATE assistido_tratamentos SET status = 'concluido', ultimo_status_operacional = 'concluido' WHERE id = p_vinculo_id;
    v_concluido := true;
  ELSIF p_proxima_numero_etapa IS NOT NULL AND p_proxima_data IS NOT NULL THEN
    IF v_tipo = 'holistico' AND p_proxima_horario IS NULL THEN
      RAISE EXCEPTION 'Tratamentos holísticos exigem o horário da consulta.' USING ERRCODE='23514';
    END IF;
    SELECT id INTO v_sessao_id FROM agenda_tratamentos_assistido
    WHERE assistido_tratamento_id = p_vinculo_id AND data_sessao = p_proxima_data AND status = 'agendado' LIMIT 1;
    IF v_sessao_id IS NULL THEN
      INSERT INTO agenda_tratamentos_assistido (assistido_id, assistido_tratamento_id, tratamento_id, data_sessao, horario, status, registrado_por)
      VALUES (v_vinc.assistido_id, p_vinculo_id, v_vinc.tratamento_id, p_proxima_data, p_proxima_horario, 'agendado', v_uid)
      RETURNING horario INTO v_efetivo;
      SELECT id INTO v_sessao_id FROM agenda_tratamentos_assistido
      WHERE assistido_tratamento_id = p_vinculo_id AND data_sessao = p_proxima_data AND status = 'agendado' ORDER BY created_at DESC LIMIT 1;
    ELSE
      UPDATE agenda_tratamentos_assistido SET horario = COALESCE(p_proxima_horario, horario), updated_at = now()
      WHERE id = v_sessao_id RETURNING horario INTO v_efetivo;
    END IF;
    UPDATE plano_tratamento_sessoes
      SET status_etapa = 'ativa', agenda_sessao_id = v_sessao_id, data_prevista = p_proxima_data, horario_previsto = v_efetivo, updated_at = now()
    WHERE assistido_tratamento_id = p_vinculo_id AND numero_etapa = p_proxima_numero_etapa
      AND status_etapa NOT IN ('realizada','ausente','suspensa','cancelada');
  END IF;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_uid, 'plano_tratamento_sessoes', 'PLANO_PRESENCA_AVANCO', p_vinculo_id,
    jsonb_build_object('data', p_data, 'concluido', v_concluido, 'proxima_etapa', p_proxima_numero_etapa));

  RETURN jsonb_build_object('success', true, 'concluido', v_concluido,
    'quantidade_realizada', v_vinc.quantidade_realizada, 'quantidade_total', v_vinc.quantidade_total);
END;
$function$;

-- ------------------------------------------------------------
-- A1: fn_voluntario_pendencias_cadastro — leitura de voluntarios.
-- Exigir perfil de equipe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_voluntario_pendencias_cadastro(p_voluntario_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v voluntarios%ROWTYPE; pend text[] := '{}';
BEGIN
  IF NOT public.fn_eh_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de equipe.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v FROM voluntarios WHERE id = p_voluntario_id;
  IF v.id IS NULL THEN RETURN ARRAY['Voluntário não encontrado']; END IF;
  IF coalesce(regexp_replace(coalesce(v.cpf,''),'\D','','g'),'') = '' THEN pend := pend || 'CPF'; END IF;
  IF coalesce(btrim(v.email),'') = '' THEN pend := pend || 'E-mail'; END IF;
  IF v.data_nascimento IS NULL THEN pend := pend || 'Data de nascimento'; END IF;
  IF coalesce(regexp_replace(coalesce(v.cep,''),'\D','','g'),'') = '' THEN pend := pend || 'CEP'; END IF;
  IF coalesce(btrim(v.logradouro),'') = '' THEN pend := pend || 'Logradouro'; END IF;
  IF coalesce(btrim(v.numero),'') = '' THEN pend := pend || 'Número'; END IF;
  IF coalesce(btrim(v.bairro),'') = '' THEN pend := pend || 'Bairro'; END IF;
  IF coalesce(btrim(v.cidade),'') = '' THEN pend := pend || 'Cidade'; END IF;
  IF coalesce(btrim(v.estado),'') = '' THEN pend := pend || 'Estado'; END IF;
  RETURN pend;
END;
$function$;