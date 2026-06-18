CREATE OR REPLACE FUNCTION public.painel_whatsapp(p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_is_coord boolean := has_role(auth.uid(), 'coordenador_de_tratamento');
  v_start timestamptz := p_inicio::timestamp;
  v_end timestamptz := (p_fim::timestamp + interval '1 day' - interval '1 second');
  v_len integer := GREATEST((p_fim - p_inicio) + 1, 1);
  v_prev_inicio date := p_inicio - v_len;
  v_prev_fim date := p_inicio - 1;
  v_operacional jsonb;
  v_por_tipo jsonb;
  v_intents jsonb;
  v_falhas jsonb;
  v_impacto jsonb;
  v_pres_atual numeric; v_pres_ant numeric;
  v_faltas_atual integer; v_faltas_ant integer;
  v_presentes_atual integer; v_ausentes_atual integer;
BEGIN
  IF NOT (v_is_admin OR v_is_coord) THEN
    RETURN jsonb_build_object('autorizado', false);
  END IF;

  -- Operational volume from the queue (by creation time)
  SELECT jsonb_build_object(
    'geradas',   COUNT(*)::int,
    'enviadas',  COUNT(*) FILTER (WHERE status = 'enviado')::int,
    'falhas',    COUNT(*) FILTER (WHERE status = 'falha')::int,
    'pendentes', COUNT(*) FILTER (WHERE status = 'pendente')::int,
    'agendados', COUNT(*) FILTER (WHERE status = 'agendado')::int,
    'canceladas',COUNT(*) FILTER (WHERE status = 'cancelado')::int
  ) INTO v_operacional
  FROM notificacoes_fila
  WHERE created_at >= v_start AND created_at <= v_end;

  -- Delivery rate by message type
  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'tipo'), '[]'::jsonb) INTO v_por_tipo FROM (
    SELECT jsonb_build_object(
      'tipo', COALESCE(template_codigo, '—'),
      'geradas', COUNT(*)::int,
      'enviadas', COUNT(*) FILTER (WHERE status = 'enviado')::int,
      'falhas', COUNT(*) FILTER (WHERE status = 'falha')::int,
      'taxa_entrega', CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'enviado')::numeric / COUNT(*) * 100)
        ELSE 0 END
    ) AS r
    FROM notificacoes_fila
    WHERE created_at >= v_start AND created_at <= v_end
    GROUP BY template_codigo
  ) s;

  -- Top inbound intents (stored on the inbound log payload)
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) INTO v_intents FROM (
    SELECT jsonb_build_object(
      'intent', COALESCE(NULLIF(payload_recebido->>'intencao', ''), 'desconhecido'),
      'total', COUNT(*)::int
    ) AS r
    FROM notificacoes_log
    WHERE direcao = 'entrada' AND created_at >= v_start AND created_at <= v_end
    GROUP BY COALESCE(NULLIF(payload_recebido->>'intencao', ''), 'desconhecido')
  ) s;

  -- Recent send failures
  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_falhas FROM (
    SELECT jsonb_build_object(
      'tipo', COALESCE(template_codigo, '—'),
      'telefone', telefone_normalizado,
      'erro', erro,
      'quando', COALESCE(sent_at, created_at)
    ) AS r
    FROM notificacoes_fila
    WHERE status = 'falha' AND created_at >= v_start AND created_at <= v_end
    ORDER BY COALESCE(sent_at, created_at) DESC
    LIMIT 15
  ) s;

  -- Impact: presence/absences in period vs previous equal-length window
  SELECT COUNT(*) FILTER (WHERE status_presenca = 'presente')::int,
         COUNT(*) FILTER (WHERE status_presenca <> 'presente')::int,
         COUNT(*) FILTER (WHERE status_presenca = 'ausente')::int
    INTO v_presentes_atual, v_ausentes_atual, v_faltas_atual
  FROM presencas_tratamentos
  WHERE data >= p_inicio AND data <= p_fim;

  v_pres_atual := CASE WHEN (v_presentes_atual + v_ausentes_atual) > 0
    THEN ROUND(v_presentes_atual::numeric / (v_presentes_atual + v_ausentes_atual) * 100) ELSE 0 END;

  SELECT CASE WHEN (COUNT(*) FILTER (WHERE status_presenca = 'presente')
                  + COUNT(*) FILTER (WHERE status_presenca <> 'presente')) > 0
              THEN ROUND(COUNT(*) FILTER (WHERE status_presenca = 'presente')::numeric
                  / (COUNT(*) FILTER (WHERE status_presenca = 'presente')
                   + COUNT(*) FILTER (WHERE status_presenca <> 'presente')) * 100)
              ELSE 0 END,
         COUNT(*) FILTER (WHERE status_presenca = 'ausente')::int
    INTO v_pres_ant, v_faltas_ant
  FROM presencas_tratamentos
  WHERE data >= v_prev_inicio AND data <= v_prev_fim;

  v_impacto := jsonb_build_object(
    'presenca_atual_pct', v_pres_atual,
    'presenca_anterior_pct', COALESCE(v_pres_ant, 0),
    'faltas_atual', v_faltas_atual,
    'faltas_anterior', COALESCE(v_faltas_ant, 0),
    'presentes_atual', v_presentes_atual,
    'ausentes_atual', v_ausentes_atual,
    'periodo_anterior', jsonb_build_object('inicio', v_prev_inicio, 'fim', v_prev_fim)
  );

  RETURN jsonb_build_object(
    'autorizado', true,
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'operacional', v_operacional || jsonb_build_object(
      'inbound', (SELECT COUNT(*)::int FROM notificacoes_log
                   WHERE direcao = 'entrada' AND created_at >= v_start AND created_at <= v_end),
      'optout', (SELECT COUNT(*)::int FROM notificacoes_preferencias
                  WHERE whatsapp_ativo = false AND opt_out_at >= v_start AND opt_out_at <= v_end),
      'handoffs_abertos', (SELECT COUNT(*)::int FROM whatsapp_handoffs
                            WHERE opened_at >= v_start AND opened_at <= v_end),
      'handoffs_resolvidos', (SELECT COUNT(*)::int FROM whatsapp_handoffs
                               WHERE closed_at >= v_start AND closed_at <= v_end),
      'intents_ia', (SELECT COUNT(*)::int FROM notificacoes_log
                      WHERE direcao = 'entrada' AND created_at >= v_start AND created_at <= v_end
                        AND COALESCE(payload_recebido->>'intencao','complexo') <> 'complexo')
    ),
    'por_tipo', v_por_tipo,
    'intents', v_intents,
    'falhas_recentes', v_falhas,
    'impacto', v_impacto
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.painel_whatsapp(date, date) TO authenticated;