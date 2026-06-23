-- =====================================================================
-- 1) Templates (cancelamento / remarcação) por domínio
-- =====================================================================
INSERT INTO public.notificacoes_templates (codigo_template, tipo_evento, canal, titulo_interno, corpo_template, ativo)
VALUES
  ('sessao_cancelada_excecao', 'sessao_cancelada_por_excecao', 'whatsapp',
   'Sessão cancelada por exceção operacional',
   'Olá, {{nome}}! 🌿 Informamos que sua sessão de {{tratamento}} do dia {{data}} foi cancelada por uma exceção operacional da casa. Qualquer dúvida, é só responder por aqui.', true),
  ('sessao_remarcada_excecao', 'sessao_remarcada_por_excecao', 'whatsapp',
   'Sessão remarcada por exceção operacional',
   'Olá, {{nome}}! 🌿 Sua sessão de {{tratamento}} foi remarcada de {{data_anterior}} para {{nova_data}}{{novo_horario}}. Qualquer dúvida, responda por aqui.', true),
  ('entrevista_cancelada_excecao', 'entrevista_cancelada_por_excecao', 'whatsapp',
   'Entrevista cancelada por exceção operacional',
   'Olá, {{nome}}! 🌿 Informamos que sua entrevista do dia {{data}} foi cancelada por uma exceção operacional da casa. Qualquer dúvida, é só responder por aqui.', true),
  ('entrevista_remarcada_excecao', 'entrevista_remarcada_por_excecao', 'whatsapp',
   'Entrevista remarcada por exceção operacional',
   'Olá, {{nome}}! 🌿 Sua entrevista foi remarcada de {{data_anterior}} para {{nova_data}}{{novo_horario}}. Qualquer dúvida, responda por aqui.', true),
  ('publico_cancelado_excecao', 'publico_cancelado_por_excecao', 'whatsapp',
   'Atividade pública cancelada por exceção operacional',
   'Olá, {{nome}}! 🌿 Informamos que a atividade de {{tratamento}} do dia {{data}} foi cancelada por uma exceção operacional da casa. Qualquer dúvida, é só responder por aqui.', true),
  ('publico_remarcado_excecao', 'publico_remarcado_por_excecao', 'whatsapp',
   'Atividade pública remarcada por exceção operacional',
   'Olá, {{nome}}! 🌿 A atividade de {{tratamento}} foi remarcada de {{data_anterior}} para {{nova_data}}{{novo_horario}}. Qualquer dúvida, responda por aqui.', true)
ON CONFLICT (codigo_template) DO UPDATE
  SET tipo_evento = EXCLUDED.tipo_evento,
      corpo_template = EXCLUDED.corpo_template,
      titulo_interno = EXCLUDED.titulo_interno,
      ativo = true,
      updated_at = now();

-- =====================================================================
-- 2) Regra OFICIAL ÚNICA de elegibilidade / alvos
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_excecao_alvos(p_excecao_id uuid)
RETURNS TABLE(
  dominio text,
  sessao_ref uuid,
  compromisso_id uuid,
  assistido_id uuid,
  telefone text,
  nome text,
  tratamento text,
  data_impactada date,
  horario_impactado time,
  usou_fallback_nome boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO e FROM excecoes_operacionais WHERE id = p_excecao_id;
  IF NOT FOUND OR e.ativo = false THEN RETURN; END IF;

  -- ===== TRATAMENTO (agenda rígida) =====
  IF e.tipo = 'tratamento' THEN
    RETURN QUERY
    SELECT 'tratamento'::text,
           a.id, a.id, a.assistido_id,
           fn_normalize_phone(COALESCE(asd.celular, asd.telefone)),
           asd.nome, tt.nome, a.data_sessao, a.horario,
           (e.tratamento_id IS NULL)
    FROM agenda_tratamentos_assistido a
    JOIN assistidos asd ON asd.id = a.assistido_id
    LEFT JOIN tipos_tratamento tt ON tt.id = a.tratamento_id
    WHERE a.status = 'agendado'
      AND a.data_sessao = e.data_excecao
      AND (e.horario_afetado IS NULL OR a.horario = e.horario_afetado)
      AND (
        (e.tratamento_id IS NOT NULL AND a.tratamento_id = e.tratamento_id)
        OR (e.tratamento_id IS NULL AND tt.nome IS NOT DISTINCT FROM e.atividade)
      )
      AND (a.data_sessao::timestamp + COALESCE(a.horario, '08:00'::time))
            AT TIME ZONE 'America/Sao_Paulo' > v_now;
  END IF;

  -- ===== ENTREVISTA =====
  IF e.tipo = 'entrevista' THEN
    RETURN QUERY
    SELECT 'entrevista'::text,
           ef.id, ef.id, ef.assistido_id,
           fn_normalize_phone(COALESCE(asd.celular, asd.telefone)),
           asd.nome, NULL::text, ef.data::date, ef.data::time,
           false
    FROM entrevistas_fraternas ef
    JOIN assistidos asd ON asd.id = ef.assistido_id
    WHERE ef.data::date = e.data_excecao
      AND (e.horario_afetado IS NULL OR ef.data::time = e.horario_afetado)
      AND ef.status NOT IN ('cancelada', 'remarcada', 'concluida', 'realizada')
      AND ef.data > v_now;
  END IF;

  -- ===== PÚBLICO (somente alvos rastreáveis em checkins_publicos) =====
  IF e.tipo = 'publico' THEN
    RETURN QUERY
    SELECT 'publico'::text,
           sp.id, cp.id, cp.assistido_id,
           fn_normalize_phone(COALESCE(asd.celular, asd.telefone, cp.celular)),
           COALESCE(asd.nome, cp.nome_participante), tt.nome, sp.data_sessao, sp.horario_inicio,
           (e.tratamento_id IS NULL)
    FROM sessoes_publicas sp
    JOIN checkins_publicos cp ON cp.sessao_id = sp.id
    LEFT JOIN assistidos asd ON asd.id = cp.assistido_id
    LEFT JOIN tipos_tratamento tt ON tt.id = sp.tratamento_id
    WHERE sp.data_sessao = e.data_excecao
      AND sp.status <> 'cancelado'
      AND (
        (e.tratamento_id IS NOT NULL AND sp.tratamento_id = e.tratamento_id)
        OR (e.tratamento_id IS NULL AND tt.nome IS NOT DISTINCT FROM e.atividade)
      )
      AND (cp.assistido_id IS NOT NULL OR cp.celular IS NOT NULL);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fn_excecao_alvos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_excecao_alvos(uuid) TO authenticated, service_role;

-- =====================================================================
-- 3) Processamento: efeito na agenda + enfileiramento (idempotente)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_processar_excecao_notificacoes(p_excecao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  t record;
  v_tipo text;                 -- 'cancelamento' | 'remarcacao'
  v_event public.notif_evento;
  v_template text;
  v_dedupe text;
  v_payload jsonb;
  v_count int := 0;
  v_fallback int := 0;
  v_nova_data date;
  v_novo_horario time;
  v_nova_ts timestamptz;
BEGIN
  SELECT * INTO e FROM excecoes_operacionais WHERE id = p_excecao_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('erro', 'excecao_inexistente'); END IF;
  IF e.ativo = false THEN RETURN jsonb_build_object('ignorado', 'excecao_inativa'); END IF;

  IF e.status = 'remarcado' AND e.nova_data IS NOT NULL THEN
    v_tipo := 'remarcacao';
    v_nova_data := e.nova_data;
    v_novo_horario := e.novo_horario;
  ELSE
    v_tipo := 'cancelamento';
  END IF;

  -- Suprime o enfileiramento genérico dos gatilhos da agenda/entrevista,
  -- evitando duplicidade de mensagem (a mensagem oficial é a dedicada abaixo).
  PERFORM set_config('app.excecao_ctx', '1', true);

  FOR t IN SELECT * FROM fn_excecao_alvos(p_excecao_id) LOOP
    IF t.usou_fallback_nome THEN v_fallback := v_fallback + 1; END IF;

    -- Resolve evento/template por domínio + tipo
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

    -- ===== Efeito real na agenda (idempotente) =====
    IF t.dominio = 'tratamento' THEN
      IF v_tipo = 'cancelamento' THEN
        UPDATE agenda_tratamentos_assistido
          SET status = 'cancelado', updated_at = now()
          WHERE id = t.sessao_ref AND status = 'agendado';
      ELSE
        UPDATE agenda_tratamentos_assistido
          SET data_sessao = v_nova_data,
              horario = COALESCE(v_novo_horario, horario),
              updated_at = now()
          WHERE id = t.sessao_ref AND status = 'agendado'
            AND (data_sessao <> v_nova_data
                 OR COALESCE(horario,'00:00') <> COALESCE(v_novo_horario, horario, '00:00'));
      END IF;

    ELSIF t.dominio = 'entrevista' THEN
      IF v_tipo = 'cancelamento' THEN
        UPDATE entrevistas_fraternas
          SET status = 'cancelada', updated_at = now()
          WHERE id = t.sessao_ref
            AND status NOT IN ('cancelada','remarcada','concluida','realizada');
      ELSE
        v_nova_ts := (v_nova_data::timestamp + COALESCE(v_novo_horario, t.horario_impactado, '08:00'::time));
        UPDATE entrevistas_fraternas
          SET data = v_nova_ts, updated_at = now()
          WHERE id = t.sessao_ref
            AND status NOT IN ('cancelada','remarcada','concluida','realizada')
            AND data <> v_nova_ts;
      END IF;

    ELSE -- publico
      IF v_tipo = 'cancelamento' THEN
        UPDATE sessoes_publicas
          SET status = 'cancelado', updated_at = now()
          WHERE id = t.sessao_ref AND status <> 'cancelado';
      ELSE
        UPDATE sessoes_publicas
          SET data_sessao = v_nova_data,
              horario_inicio = COALESCE(v_novo_horario, horario_inicio),
              updated_at = now()
          WHERE id = t.sessao_ref AND status <> 'cancelado'
            AND (data_sessao <> v_nova_data
                 OR COALESCE(horario_inicio,'00:00') <> COALESCE(v_novo_horario, horario_inicio, '00:00'));
      END IF;
    END IF;

    -- ===== Payload rastreável =====
    v_payload := jsonb_strip_nulls(jsonb_build_object(
      'nome', t.nome,
      'tratamento', t.tratamento,
      'data', t.data_impactada,
      'horario', t.horario_impactado,
      'excecao_id', p_excecao_id,
      'motivo_origem', 'excecao_operacional',
      'evento_tipo', v_tipo,
      'compromisso_id', t.compromisso_id,
      'data_impactada', t.data_impactada
    ));
    IF v_tipo = 'remarcacao' THEN
      v_payload := v_payload
        || jsonb_strip_nulls(jsonb_build_object(
             'data_anterior', t.data_impactada,
             'nova_data', v_nova_data,
             'novo_horario', v_novo_horario));
    END IF;

    v_dedupe := v_event::text || ':' || t.compromisso_id::text || ':' || p_excecao_id::text;

    -- ===== Enfileiramento (dedupe estável) =====
    IF t.assistido_id IS NOT NULL THEN
      PERFORM fn_enqueue_notificacao(v_event, t.assistido_id, v_template, v_payload, now(), v_dedupe);
    ELSIF t.telefone IS NOT NULL THEN
      INSERT INTO notificacoes_fila (
        evento_origem, assistido_id, telefone_normalizado, canal,
        template_codigo, payload_json, status, scheduled_at, dedupe_key
      ) VALUES (
        v_event, NULL, t.telefone, 'whatsapp',
        v_template, v_payload, 'pendente', now(), v_dedupe
      ) ON CONFLICT (dedupe_key) DO NOTHING;
    ELSE
      CONTINUE; -- sem alvo de contato → não notifica
    END IF;

    -- Trilha de geração (idempotente)
    INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
    SELECT f.id, 'saida', 'enfileirado', 'excecao_operacional'
    FROM notificacoes_fila f
    WHERE f.dedupe_key = v_dedupe
      AND NOT EXISTS (
        SELECT 1 FROM notificacoes_log l
        WHERE l.fila_id = f.id AND l.status = 'enfileirado'
      );

    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('app.excecao_ctx', '', true);

  -- Trilha de auditoria do processamento da exceção
  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'excecoes_operacionais', 'PROCESSAR_NOTIFICACAO', p_excecao_id,
          jsonb_build_object(
            'evento_tipo', v_tipo,
            'alvos', v_count,
            'fallback_por_nome', v_fallback,
            'tipo_excecao', e.tipo));

  RETURN jsonb_build_object(
    'evento_tipo', v_tipo,
    'alvos', v_count,
    'fallback_por_nome', v_fallback);
END $$;

REVOKE ALL ON FUNCTION public.fn_processar_excecao_notificacoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_processar_excecao_notificacoes(uuid) TO authenticated, service_role;

-- =====================================================================
-- 4) Reconciliação (rede de segurança do cron)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_reconciliar_excecoes_notificacoes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_total int := 0;
BEGIN
  FOR r IN
    SELECT id FROM excecoes_operacionais
    WHERE ativo = true
      AND status IN ('cancelado', 'remarcado')
      AND COALESCE(nova_data, data_excecao) >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)
  LOOP
    PERFORM fn_processar_excecao_notificacoes(r.id);
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('processadas', v_total);
END $$;

REVOKE ALL ON FUNCTION public.fn_reconciliar_excecoes_notificacoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reconciliar_excecoes_notificacoes() TO service_role;

-- =====================================================================
-- 5) Gatilhos: evitar mensagem duplicada quando a mudança vem da exceção
--    (mantém invalidação de lembretes e criação de novo lembrete)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_notif_sessao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_trat text;
  v_when timestamptz;
  v_skip boolean := COALESCE(current_setting('app.excecao_ctx', true), '') = '1';
BEGIN
  SELECT nome INTO v_nome FROM assistidos WHERE id = COALESCE(NEW.assistido_id, OLD.assistido_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status != 'agendado' THEN
      RETURN NEW;
    END IF;
    SELECT nome INTO v_trat FROM tipos_tratamento WHERE id = NEW.tratamento_id;
    v_when := (NEW.data_sessao::timestamp + COALESCE(NEW.horario, '08:00'::time));
    PERFORM fn_enqueue_notificacao('sessao_criada', NEW.assistido_id, 'sessao_agendada',
      jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
      now(), 'sessao_criada:'||NEW.id);
    PERFORM fn_enqueue_notificacao('sessao_lembrete', NEW.assistido_id, 'sessao_lembrete',
      jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
      v_when - interval '24 hours', 'sessao_lembrete:'||NEW.id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT nome INTO v_trat FROM tipos_tratamento WHERE id = NEW.tratamento_id;

    IF NEW.status != 'agendado' AND OLD.status = 'agendado' THEN
      UPDATE notificacoes_fila
      SET status = 'cancelado',
          erro = CASE
                   WHEN NEW.status = 'substituida_plano' THEN 'sessao_substituida'
                   WHEN NEW.status = 'cancelado' THEN 'sessao_cancelada'
                   ELSE 'sessao_nao_agendada'
                 END,
          updated_at = now()
      WHERE status IN ('pendente','agendado')
        AND evento_origem IN ('sessao_lembrete','sessao_criada')
        AND split_part(dedupe_key, ':', 2) = NEW.id::text;

      INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
      SELECT id, 'saida', 'cancelado', erro
      FROM notificacoes_fila
      WHERE evento_origem IN ('sessao_lembrete','sessao_criada')
        AND split_part(dedupe_key, ':', 2) = NEW.id::text
        AND status = 'cancelado';
    END IF;

    IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
      IF NOT v_skip THEN
        PERFORM fn_enqueue_notificacao('cancelamento', NEW.assistido_id, 'cancelamento',
          jsonb_build_object('nome', v_nome, 'tipo','sessao','tratamento', v_trat, 'data', NEW.data_sessao),
          now(), 'sessao_cancel:'||NEW.id);
      END IF;
    ELSIF NEW.status = 'agendado'
          AND (NEW.data_sessao != OLD.data_sessao OR COALESCE(NEW.horario,'00:00') != COALESCE(OLD.horario,'00:00')) THEN
      v_when := (NEW.data_sessao::timestamp + COALESCE(NEW.horario, '08:00'::time));
      IF NOT v_skip THEN
        PERFORM fn_enqueue_notificacao('remarcacao', NEW.assistido_id, 'remarcacao',
          jsonb_build_object('nome', v_nome, 'tipo','sessao','tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario, 'data_anterior', OLD.data_sessao),
          now(), 'sessao_remarca:'||NEW.id||':'||NEW.data_sessao::text||':'||COALESCE(NEW.horario::text,''));
      END IF;
      -- Invalida lembretes antigos da versão anterior do compromisso
      UPDATE notificacoes_fila
        SET status = 'cancelado', erro = 'sessao_remarcada_por_excecao', updated_at = now()
        WHERE status IN ('pendente','agendado')
          AND evento_origem = 'sessao_lembrete'
          AND split_part(dedupe_key, ':', 2) = NEW.id::text
          AND COALESCE(split_part(dedupe_key, ':', 3),'') <> NEW.data_sessao::text;
      PERFORM fn_enqueue_notificacao('sessao_lembrete', NEW.assistido_id, 'sessao_lembrete',
        jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
        v_when - interval '24 hours', 'sessao_lembrete:'||NEW.id||':'||NEW.data_sessao::text);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_notif_entrevista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_skip boolean := COALESCE(current_setting('app.excecao_ctx', true), '') = '1';
BEGIN
  SELECT nome INTO v_nome FROM assistidos WHERE id = NEW.assistido_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM fn_enqueue_notificacao('entrevista_criada', NEW.assistido_id, 'entrevista_agendada',
      jsonb_build_object('nome', v_nome, 'data', NEW.data),
      now(), 'entrevista_criada:'||NEW.id);
    PERFORM fn_enqueue_notificacao('entrevista_lembrete', NEW.assistido_id, 'entrevista_lembrete',
      jsonb_build_object('nome', v_nome, 'data', NEW.data),
      NEW.data - interval '24 hours', 'entrevista_lembrete:'||NEW.id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
      IF NOT v_skip THEN
        PERFORM fn_enqueue_notificacao('cancelamento', NEW.assistido_id, 'cancelamento',
          jsonb_build_object('nome', v_nome, 'tipo','entrevista','data', NEW.data),
          now(), 'entrevista_cancel:'||NEW.id);
      END IF;
    ELSIF NEW.data <> OLD.data THEN
      IF NOT v_skip THEN
        PERFORM fn_enqueue_notificacao('remarcacao', NEW.assistido_id, 'remarcacao',
          jsonb_build_object('nome', v_nome, 'tipo','entrevista','data', NEW.data,'data_anterior', OLD.data),
          now(), 'entrevista_remarca:'||NEW.id||':'||extract(epoch from NEW.data)::bigint);
      END IF;
      -- Invalida lembretes antigos da versão anterior
      UPDATE notificacoes_fila
        SET status = 'cancelado', erro = 'entrevista_remarcada_por_excecao', updated_at = now()
        WHERE status IN ('pendente','agendado')
          AND evento_origem = 'entrevista_lembrete'
          AND split_part(dedupe_key, ':', 2) = NEW.id::text
          AND COALESCE(split_part(dedupe_key, ':', 3),'') <> extract(epoch from NEW.data)::bigint::text;
      PERFORM fn_enqueue_notificacao('entrevista_lembrete', NEW.assistido_id, 'entrevista_lembrete',
        jsonb_build_object('nome', v_nome, 'data', NEW.data),
        NEW.data - interval '24 hours', 'entrevista_lembrete:'||NEW.id||':'||extract(epoch from NEW.data)::bigint);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $function$;