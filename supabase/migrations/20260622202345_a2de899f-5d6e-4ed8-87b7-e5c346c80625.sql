CREATE OR REPLACE FUNCTION public.fn_notif_sessao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome text;
  v_trat text;
  v_when timestamptz;
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
      PERFORM fn_enqueue_notificacao('cancelamento', NEW.assistido_id, 'cancelamento',
        jsonb_build_object('nome', v_nome, 'tipo','sessao','tratamento', v_trat, 'data', NEW.data_sessao),
        now(), 'sessao_cancel:'||NEW.id);
    ELSIF NEW.status = 'agendado'
          AND (NEW.data_sessao != OLD.data_sessao OR COALESCE(NEW.horario,'00:00') != COALESCE(OLD.horario,'00:00')) THEN
      v_when := (NEW.data_sessao::timestamp + COALESCE(NEW.horario, '08:00'::time));
      PERFORM fn_enqueue_notificacao('remarcacao', NEW.assistido_id, 'remarcacao',
        jsonb_build_object('nome', v_nome, 'tipo','sessao','tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario, 'data_anterior', OLD.data_sessao),
        now(), 'sessao_remarca:'||NEW.id||':'||NEW.data_sessao::text||':'||COALESCE(NEW.horario::text,''));
      PERFORM fn_enqueue_notificacao('sessao_lembrete', NEW.assistido_id, 'sessao_lembrete',
        jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
        v_when - interval '24 hours', 'sessao_lembrete:'||NEW.id||':'||NEW.data_sessao::text);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;