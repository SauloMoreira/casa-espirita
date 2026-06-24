-- ============================================================================
-- Correção: tratamentos não recebem confirmação imediata de "sessão agendada".
-- Política padrão da casa = apenas LEMBRETE 24h antes (antecedência parametrizável).
-- A confirmação imediata só é enfileirada se houver flag explícita ativa.
-- Não afeta: cancelamento, remarcação, entrevistas, mensagens manuais, exceções.
-- ============================================================================

-- Config parametrizável: antecedência do lembrete (default 24h)
INSERT INTO public.regras_operacionais (chave, descricao, valor, ativo)
VALUES (
  'tratamento_lembrete_antecedencia_horas',
  'Antecedência (em horas) do lembrete de sessão de tratamento enviado ao assistido. Padrão oficial: 24h.',
  '24'::jsonb,
  true
)
ON CONFLICT (chave) DO NOTHING;

-- Config parametrizável: enviar (ou não) confirmação imediata de agendamento p/ tratamento
INSERT INTO public.regras_operacionais (chave, descricao, valor, ativo)
VALUES (
  'tratamento_confirmacao_agendamento_ativa',
  'Se verdadeiro, envia uma mensagem imediata de "sessão agendada" ao criar a sessão de tratamento. Política padrão da casa = falso (somente lembrete 24h antes).',
  'false'::jsonb,
  true
)
ON CONFLICT (chave) DO NOTHING;

-- Helper: antecedência do lembrete em horas (default 24h, robusto a config ausente)
CREATE OR REPLACE FUNCTION public.fn_lembrete_antecedencia_horas()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(trim(both '"' from valor::text), '')::numeric::integer
       FROM regras_operacionais
      WHERE chave = 'tratamento_lembrete_antecedencia_horas' AND ativo = true),
    24
  )
$$;

-- Helper: confirmação imediata de agendamento ativa? (default false)
CREATE OR REPLACE FUNCTION public.fn_confirmacao_agendamento_ativa()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (valor::text = 'true')
       FROM regras_operacionais
      WHERE chave = 'tratamento_confirmacao_agendamento_ativa' AND ativo = true),
    false
  )
$$;

-- ============================================================================
-- Trigger de notificação de sessão: gera apenas o LEMBRETE por padrão.
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
  v_ante integer := fn_lembrete_antecedencia_horas();
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
    -- Confirmação imediata de "sessão agendada": SOMENTE se a casa habilitar.
    -- Por padrão NÃO enviamos comunicação de agendamento para sessão futura.
    IF fn_confirmacao_agendamento_ativa() THEN
      PERFORM fn_enqueue_notificacao('sessao_criada', NEW.assistido_id, 'sessao_agendada',
        jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
        now(), 'sessao_criada:'||NEW.id);
    END IF;
    -- Lembrete real: enviado N horas antes (padrão 24h).
    PERFORM fn_enqueue_notificacao('sessao_lembrete', NEW.assistido_id, 'sessao_lembrete',
      jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data_sessao, 'horario', NEW.horario),
      v_when - make_interval(hours => v_ante), 'sessao_lembrete:'||NEW.id);
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
          v_when - make_interval(hours => v_ante), 'sessao_lembrete:'||NEW.id||':'||NEW.data_sessao::text);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $function$;