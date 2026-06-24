
-- ============================================================================
-- 1) Helpers: próxima sessão real agendada por vínculo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_proxima_sessao_vinculo(p_vinculo uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id
  FROM agenda_tratamentos_assistido a
  WHERE a.assistido_tratamento_id = p_vinculo
    AND a.status = 'agendado'
    AND a.data_sessao >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY a.data_sessao ASC, a.horario ASC NULLS FIRST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.fn_eh_proxima_sessao(p_agenda_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vinc uuid;
BEGIN
  SELECT assistido_tratamento_id INTO v_vinc
  FROM agenda_tratamentos_assistido WHERE id = p_agenda_id;
  IF v_vinc IS NULL THEN RETURN false; END IF;
  RETURN fn_proxima_sessao_vinculo(v_vinc) = p_agenda_id;
END $$;

-- ============================================================================
-- 2) Promoção: ativa/reativa o lembrete da próxima sessão do vínculo
--    (idempotente; nunca toca itens já enviados; evita duplicidade)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_promover_proxima_sessao(p_vinculo uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_ag record;
  v_nome text;
  v_trat text;
  v_when timestamptz;
  v_sched timestamptz;
  v_status public.notif_status;
  v_phone text;
BEGIN
  v_id := fn_proxima_sessao_vinculo(p_vinculo);
  IF v_id IS NULL THEN RETURN; END IF;

  -- Já existe lembrete ativo/enviado para essa sessão? Nada a fazer.
  IF EXISTS (
    SELECT 1 FROM notificacoes_fila
    WHERE evento_origem = 'sessao_lembrete'
      AND split_part(dedupe_key, ':', 2) = v_id::text
      AND status IN ('pendente','agendado','enviado')
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_ag FROM agenda_tratamentos_assistido WHERE id = v_id;
  SELECT nome INTO v_nome FROM assistidos WHERE id = v_ag.assistido_id;
  SELECT nome INTO v_trat FROM tipos_tratamento WHERE id = v_ag.tratamento_id;
  SELECT fn_normalize_phone(COALESCE(celular, telefone)) INTO v_phone
  FROM assistidos WHERE id = v_ag.assistido_id;

  v_when  := (v_ag.data_sessao::timestamp + COALESCE(v_ag.horario, '08:00'::time));
  v_sched := v_when - interval '24 hours';
  v_status := CASE WHEN v_sched > now() THEN 'agendado'::public.notif_status
                   ELSE 'pendente'::public.notif_status END;

  INSERT INTO notificacoes_fila (
    evento_origem, assistido_id, telefone_normalizado, canal,
    template_codigo, payload_json, status, scheduled_at, dedupe_key
  ) VALUES (
    'sessao_lembrete', v_ag.assistido_id, v_phone, 'whatsapp',
    'sessao_lembrete',
    jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', v_ag.data_sessao, 'horario', v_ag.horario),
    v_status, v_sched, 'sessao_lembrete:'||v_id
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    status       = CASE WHEN notificacoes_fila.status = 'enviado' THEN notificacoes_fila.status ELSE EXCLUDED.status END,
    scheduled_at = CASE WHEN notificacoes_fila.status = 'enviado' THEN notificacoes_fila.scheduled_at ELSE EXCLUDED.scheduled_at END,
    payload_json = CASE WHEN notificacoes_fila.status = 'enviado' THEN notificacoes_fila.payload_json ELSE EXCLUDED.payload_json END,
    retry_count  = CASE WHEN notificacoes_fila.status = 'enviado' THEN notificacoes_fila.retry_count ELSE 0 END,
    erro         = CASE WHEN notificacoes_fila.status = 'enviado' THEN notificacoes_fila.erro ELSE NULL END,
    updated_at   = now();
END $$;

-- ============================================================================
-- 3) Elegibilidade / trava de dispatch — sessões E entrevistas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_fila_motivo_inelegivel(p_fila_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item record;
  v_part text;
  v_id uuid;
  v_ag record;
  v_inst timestamptz;
  v_ent record;
  v_epoch text;
BEGIN
  SELECT * INTO v_item FROM notificacoes_fila WHERE id = p_fila_id;
  IF NOT FOUND THEN RETURN 'item_inexistente'; END IF;

  -- ---- Sessões de tratamento -------------------------------------------------
  IF v_item.evento_origem IN ('sessao_lembrete','sessao_criada') THEN
    v_part := split_part(v_item.dedupe_key, ':', 2);
    IF length(v_part) != 36 THEN RETURN 'sessao_inexistente'; END IF;
    BEGIN v_id := v_part::uuid; EXCEPTION WHEN others THEN RETURN 'sessao_inexistente'; END;
    SELECT * INTO v_ag FROM agenda_tratamentos_assistido WHERE id = v_id;
    IF NOT FOUND THEN RETURN 'sessao_inexistente'; END IF;
    IF v_ag.status = 'substituida_plano' THEN RETURN 'sessao_substituida'; END IF;
    IF v_ag.status = 'cancelado' THEN RETURN 'sessao_cancelada'; END IF;
    IF v_ag.status != 'agendado' THEN RETURN 'sessao_nao_agendada'; END IF;
    v_inst := (v_ag.data_sessao::timestamp + COALESCE(v_ag.horario, '08:00'::time)) AT TIME ZONE 'America/Sao_Paulo';
    IF greatest(now(), v_inst) = now() THEN RETURN 'lembrete_vencido'; END IF;
    -- Só a PRÓXIMA sessão real do vínculo é elegível; cadeia futura prevista não.
    IF NOT fn_eh_proxima_sessao(v_id) THEN RETURN 'sessao_futura_nao_proxima'; END IF;
    RETURN NULL;
  END IF;

  -- ---- Entrevistas -----------------------------------------------------------
  IF v_item.evento_origem IN ('entrevista_lembrete','entrevista_criada') THEN
    v_part := split_part(v_item.dedupe_key, ':', 2);
    IF length(v_part) != 36 THEN RETURN 'entrevista_inexistente'; END IF;
    BEGIN v_id := v_part::uuid; EXCEPTION WHEN others THEN RETURN 'entrevista_inexistente'; END;
    SELECT * INTO v_ent FROM entrevistas_fraternas WHERE id = v_id;
    IF NOT FOUND THEN RETURN 'entrevista_inexistente'; END IF;
    IF v_ent.status = 'cancelada' THEN RETURN 'entrevista_cancelada'; END IF;
    -- lembrete carrega o epoch da data; divergência = versão superada por remarcação
    IF v_item.evento_origem = 'entrevista_lembrete' THEN
      v_epoch := split_part(v_item.dedupe_key, ':', 3);
      IF v_epoch <> '' AND v_epoch <> extract(epoch from v_ent.data)::bigint::text THEN
        RETURN 'entrevista_remarcada';
      END IF;
    END IF;
    -- vencida: a data (date-only à meia-noite UTC) já passou no calendário local
    IF (now() AT TIME ZONE 'America/Sao_Paulo')::date > (v_ent.data AT TIME ZONE 'UTC')::date THEN
      RETURN 'entrevista_vencida';
    END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END $$;

-- ============================================================================
-- 4) Geração: só a próxima sessão real gera lembrete/confirmação;
--    promoção automática quando a sessão atual deixa de estar agendada
-- ============================================================================
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
    -- Plano previsto NÃO gera lembrete antecipado: só a próxima sessão real.
    IF NOT fn_eh_proxima_sessao(NEW.id) THEN
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

      -- A sessão atual saiu de cena: ativa o lembrete da próxima sessão real.
      PERFORM fn_promover_proxima_sessao(NEW.assistido_tratamento_id);
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
      -- Só re-enfileira o lembrete se a sessão remarcada continuar sendo a próxima real.
      IF fn_eh_proxima_sessao(NEW.id) THEN
        PERFORM fn_enqueue_notificacao('sessao_lembrete', NEW.assistido_id, 'sessao_lembrete',
          jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
          v_when - interval '24 hours', 'sessao_lembrete:'||NEW.id||':'||NEW.data_sessao::text);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $function$;
