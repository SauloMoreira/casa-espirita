CREATE OR REPLACE FUNCTION public.fn_notif_presenca()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assistido_id uuid;
  v_nome text;
  v_trat text;
  v_class jsonb;
  v_evento text;
BEGIN
  -- Fonte única: classificação operacional do registro.
  v_class := fn_presenca_classificacao(NEW.status_presenca);
  v_evento := v_class->>'evento_notificacao';

  -- Registros somente históricos (ex.: justificado) não geram aviso operacional.
  IF v_evento IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só dispara quando o status realmente muda.
  IF TG_OP = 'UPDATE' AND NEW.status_presenca = OLD.status_presenca THEN
    RETURN NEW;
  END IF;

  SELECT at.assistido_id, a.nome, t.nome
    INTO v_assistido_id, v_nome, v_trat
  FROM assistido_tratamentos at
  JOIN assistidos a ON a.id = at.assistido_id
  LEFT JOIN tipos_tratamento t ON t.id = at.tratamento_id
  WHERE at.id = NEW.assistido_tratamento_id;

  IF v_assistido_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Correção L-07: v_evento é text; o 1º parâmetro de fn_enqueue_notificacao é
  -- o enum notif_evento (text -> enum não tem cast implícito na resolução de
  -- função). Sem o cast explícito, qualquer registro de presença "presente"/
  -- "ausente" falhava em runtime ("function does not exist"). O 3º parâmetro
  -- (template_codigo) é text e permanece text.
  PERFORM fn_enqueue_notificacao(
    v_evento::notif_evento, v_assistido_id, v_evento,
    jsonb_build_object('nome', v_nome, 'tratamento', v_trat, 'data', NEW.data),
    now(), v_evento||':'||NEW.id||':'||NEW.data::text);

  RETURN NEW;
END $function$;