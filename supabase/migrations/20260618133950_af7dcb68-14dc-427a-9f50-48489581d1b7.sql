
CREATE OR REPLACE FUNCTION public.painel_whatsapp_v2(
  p_inicio date,
  p_fim date,
  p_template text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_assistido uuid DEFAULT NULL,
  p_resolucao text DEFAULT NULL,
  p_optout boolean DEFAULT NULL
)
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
  v_prev_start timestamptz := (p_inicio - v_len)::timestamp;
  v_prev_end timestamptz := ((p_inicio - 1)::timestamp + interval '1 day' - interval '1 second');

  -- bloco 1
  v_geradas int; v_enviadas int; v_falhas int; v_pendentes int; v_agendados int; v_canceladas int;
  v_retries int; v_tempo_envio numeric; v_sem_telefone int;
  v_inbound int;
  v_falhas_evento jsonb; v_serie jsonb; v_falhas_recentes jsonb;
  -- bloco 2
  v_optout int; v_reativacoes int; v_assistidos_impactados int; v_media_msgs numeric;
  v_horarios jsonb; v_resp_tipo jsonb;
  -- bloco 3
  v_pres_atual numeric; v_pres_ant numeric;
  v_faltas_atual int; v_faltas_ant int; v_presentes_atual int; v_ausentes_atual int;
  v_compar_lembrete numeric; v_compar_base int; v_compar_pres int;
  -- bloco 4
  v_resolvidas_ia int; v_handoffs int; v_handoffs_resolvidos int;
  v_tempo_resolucao numeric; v_motivos jsonb; v_intents jsonb;
  -- bloco 5
  v_por_tipo jsonb; v_optout_por_tipo jsonb;
BEGIN
  IF NOT (v_is_admin OR v_is_coord) THEN
    RETURN jsonb_build_object('autorizado', false);
  END IF;

  -- ===== Conjunto filtrado da fila =====
  CREATE TEMP TABLE _fila ON COMMIT DROP AS
  SELECT *
  FROM notificacoes_fila f
  WHERE f.created_at >= v_start AND f.created_at <= v_end
    AND (p_template IS NULL OR f.template_codigo = p_template)
    AND (p_status IS NULL OR f.status::text = p_status)
    AND (p_assistido IS NULL OR f.assistido_id = p_assistido);

  -- ===== Conjunto filtrado de inbound (logs de entrada) =====
  CREATE TEMP TABLE _inbound ON COMMIT DROP AS
  SELECT l.*,
    COALESCE(NULLIF(l.payload_recebido->>'intencao', ''), 'desconhecido') AS intencao,
    EXTRACT(HOUR FROM l.created_at)::int AS hora
  FROM notificacoes_log l
  WHERE l.direcao = 'entrada'
    AND l.created_at >= v_start AND l.created_at <= v_end
    AND (p_resolucao IS NULL
         OR (p_resolucao = 'ia' AND COALESCE(NULLIF(l.payload_recebido->>'intencao',''),'complexo') <> 'complexo')
         OR (p_resolucao = 'handoff' AND COALESCE(NULLIF(l.payload_recebido->>'intencao',''),'complexo') = 'complexo'));

  -- ================= BLOCO 1: ENTREGA E OPERAÇÃO =================
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'enviado')::int,
    COUNT(*) FILTER (WHERE status = 'falha')::int,
    COUNT(*) FILTER (WHERE status = 'pendente')::int,
    COUNT(*) FILTER (WHERE status = 'agendado')::int,
    COUNT(*) FILTER (WHERE status = 'cancelado')::int,
    COALESCE(SUM(retry_count),0)::int,
    ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) FILTER (WHERE status = 'enviado' AND sent_at IS NOT NULL))::numeric,
    COUNT(*) FILTER (WHERE telefone_normalizado IS NULL)::int
  INTO v_geradas, v_enviadas, v_falhas, v_pendentes, v_agendados, v_canceladas, v_retries, v_tempo_envio, v_sem_telefone
  FROM _fila;

  v_inbound := (SELECT COUNT(*)::int FROM _inbound);

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'falhas')::int DESC), '[]'::jsonb) INTO v_falhas_evento FROM (
    SELECT jsonb_build_object(
      'evento', COALESCE(evento_origem::text, '—'),
      'falhas', COUNT(*) FILTER (WHERE status = 'falha')::int,
      'total', COUNT(*)::int
    ) AS r
    FROM _fila
    GROUP BY evento_origem
    HAVING COUNT(*) FILTER (WHERE status = 'falha') > 0
  ) s;

  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'dia'), '[]'::jsonb) INTO v_serie FROM (
    WITH dias AS (SELECT generate_series(p_inicio, p_fim, interval '1 day')::date AS dia),
    fl AS (
      SELECT created_at::date AS dia,
        COUNT(*)::int AS geradas,
        COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviadas,
        COUNT(*) FILTER (WHERE status = 'falha')::int AS falhas
      FROM _fila GROUP BY created_at::date
    ),
    inb AS (
      SELECT created_at::date AS dia, COUNT(*)::int AS inbound
      FROM _inbound GROUP BY created_at::date
    )
    SELECT jsonb_build_object(
      'dia', d.dia,
      'geradas', COALESCE(fl.geradas,0),
      'enviadas', COALESCE(fl.enviadas,0),
      'falhas', COALESCE(fl.falhas,0),
      'inbound', COALESCE(inb.inbound,0)
    ) AS r
    FROM dias d
    LEFT JOIN fl ON fl.dia = d.dia
    LEFT JOIN inb ON inb.dia = d.dia
  ) s;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_falhas_recentes FROM (
    SELECT jsonb_build_object(
      'tipo', COALESCE(template_codigo, '—'),
      'evento', COALESCE(evento_origem::text, '—'),
      'telefone', telefone_normalizado,
      'erro', erro,
      'retries', retry_count,
      'quando', COALESCE(sent_at, updated_at, created_at)
    ) AS r
    FROM _fila
    WHERE status = 'falha'
    ORDER BY COALESCE(sent_at, updated_at, created_at) DESC
    LIMIT 20
  ) s;

  -- ================= BLOCO 2: ENGAJAMENTO =================
  SELECT COUNT(*)::int INTO v_optout
  FROM notificacoes_preferencias
  WHERE whatsapp_ativo = false AND opt_out_at >= v_start AND opt_out_at <= v_end;

  SELECT COUNT(*)::int INTO v_reativacoes
  FROM notificacoes_preferencias
  WHERE whatsapp_ativo = true AND opt_out_at IS NOT NULL
    AND updated_at >= v_start AND updated_at <= v_end;

  SELECT COUNT(DISTINCT assistido_id)::int INTO v_assistidos_impactados
  FROM _fila WHERE status = 'enviado' AND assistido_id IS NOT NULL;

  v_media_msgs := CASE WHEN v_assistidos_impactados > 0
    THEN ROUND(v_enviadas::numeric / v_assistidos_impactados, 2) ELSE 0 END;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'hora')::int), '[]'::jsonb) INTO v_horarios FROM (
    SELECT jsonb_build_object('hora', hora, 'total', COUNT(*)::int) AS r
    FROM _inbound GROUP BY hora
  ) s;

  -- Resposta por tipo de mensagem: inbound vs enviadas por template (proxy de engajamento)
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'enviadas')::int DESC), '[]'::jsonb) INTO v_resp_tipo FROM (
    SELECT jsonb_build_object(
      'tipo', COALESCE(template_codigo,'—'),
      'enviadas', COUNT(*) FILTER (WHERE status = 'enviado')::int
    ) AS r
    FROM _fila
    GROUP BY template_codigo
    HAVING COUNT(*) FILTER (WHERE status = 'enviado') > 0
  ) s;

  -- ================= BLOCO 3: EFETIVIDADE =================
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

  -- Comparecimento após lembrete: presenças de assistidos que receberam lembrete enviado no período
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE pt.status_presenca = 'presente')::int
  INTO v_compar_base, v_compar_pres
  FROM presencas_tratamentos pt
  JOIN assistido_tratamentos at ON at.id = pt.assistido_tratamento_id
  WHERE pt.data >= p_inicio AND pt.data <= p_fim
    AND at.assistido_id IN (
      SELECT DISTINCT assistido_id FROM notificacoes_fila
      WHERE status = 'enviado' AND template_codigo LIKE '%lembrete%'
        AND created_at >= v_prev_start AND created_at <= v_end
        AND assistido_id IS NOT NULL
    );

  v_compar_lembrete := CASE WHEN v_compar_base > 0
    THEN ROUND(v_compar_pres::numeric / v_compar_base * 100) ELSE 0 END;

  -- ================= BLOCO 4: IA E HUMANO =================
  v_resolvidas_ia := (SELECT COUNT(*)::int FROM _inbound WHERE intencao <> 'complexo' AND intencao <> 'desconhecido');

  SELECT COUNT(*)::int INTO v_handoffs
  FROM whatsapp_handoffs WHERE opened_at >= v_start AND opened_at <= v_end;

  SELECT COUNT(*)::int,
         ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - opened_at))) FILTER (WHERE closed_at IS NOT NULL))::numeric
    INTO v_handoffs_resolvidos, v_tempo_resolucao
  FROM whatsapp_handoffs
  WHERE opened_at >= v_start AND opened_at <= v_end;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) INTO v_motivos FROM (
    SELECT jsonb_build_object('motivo', COALESCE(NULLIF(motivo,''),'—'), 'total', COUNT(*)::int) AS r
    FROM whatsapp_handoffs
    WHERE opened_at >= v_start AND opened_at <= v_end
    GROUP BY COALESCE(NULLIF(motivo,''),'—')
  ) s;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) INTO v_intents FROM (
    SELECT jsonb_build_object('intent', intencao, 'total', COUNT(*)::int,
      'resolvida', (intencao <> 'complexo' AND intencao <> 'desconhecido')) AS r
    FROM _inbound
    GROUP BY intencao
  ) s;

  -- ================= BLOCO 5: QUALIDADE / TAXA POR TIPO =================
  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'tipo'), '[]'::jsonb) INTO v_por_tipo FROM (
    SELECT jsonb_build_object(
      'tipo', COALESCE(template_codigo, '—'),
      'geradas', COUNT(*)::int,
      'enviadas', COUNT(*) FILTER (WHERE status = 'enviado')::int,
      'falhas', COUNT(*) FILTER (WHERE status = 'falha')::int,
      'taxa_entrega', CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'enviado')::numeric / COUNT(*) * 100) ELSE 0 END
    ) AS r
    FROM _fila GROUP BY template_codigo
  ) s;

  -- Opt-out por tipo: último template enviado antes do opt-out
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) INTO v_optout_por_tipo FROM (
    SELECT jsonb_build_object('tipo', COALESCE(tpl,'—'), 'total', COUNT(*)::int) AS r
    FROM (
      SELECT pref.assistido_id,
        (SELECT f.template_codigo FROM notificacoes_fila f
          WHERE f.assistido_id = pref.assistido_id AND f.status = 'enviado'
            AND f.created_at <= pref.opt_out_at
          ORDER BY f.created_at DESC LIMIT 1) AS tpl
      FROM notificacoes_preferencias pref
      WHERE pref.whatsapp_ativo = false
        AND pref.opt_out_at >= v_start AND pref.opt_out_at <= v_end
    ) z
    GROUP BY tpl
  ) s;

  RETURN jsonb_build_object(
    'autorizado', true,
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_len),
    'periodo_anterior', jsonb_build_object('inicio', v_prev_inicio, 'fim', v_prev_fim),
    'entrega', jsonb_build_object(
      'geradas', v_geradas, 'enviadas', v_enviadas, 'falhas', v_falhas,
      'pendentes', v_pendentes, 'agendados', v_agendados, 'canceladas', v_canceladas,
      'retries', v_retries, 'tempo_medio_envio_seg', COALESCE(v_tempo_envio, 0),
      'sem_telefone', v_sem_telefone, 'inbound', v_inbound,
      'falhas_por_evento', v_falhas_evento,
      'falhas_recentes', v_falhas_recentes
    ),
    'engajamento', jsonb_build_object(
      'inbound', v_inbound, 'optout', v_optout, 'reativacoes', v_reativacoes,
      'assistidos_impactados', v_assistidos_impactados,
      'media_msgs_por_assistido', v_media_msgs,
      'horarios', v_horarios, 'resposta_por_tipo', v_resp_tipo
    ),
    'efetividade', jsonb_build_object(
      'presenca_atual_pct', v_pres_atual,
      'presenca_anterior_pct', COALESCE(v_pres_ant, 0),
      'faltas_atual', v_faltas_atual,
      'faltas_anterior', COALESCE(v_faltas_ant, 0),
      'presentes_atual', v_presentes_atual,
      'ausentes_atual', v_ausentes_atual,
      'comparecimento_apos_lembrete_pct', v_compar_lembrete,
      'comparecimento_base', v_compar_base
    ),
    'ia_humano', jsonb_build_object(
      'inbound', v_inbound,
      'resolvidas_ia', v_resolvidas_ia,
      'handoffs', v_handoffs,
      'handoffs_resolvidos', v_handoffs_resolvidos,
      'tempo_medio_resolucao_seg', COALESCE(v_tempo_resolucao, 0),
      'motivos', v_motivos,
      'intents', v_intents
    ),
    'qualidade', jsonb_build_object(
      'fora_janela', 0,
      'dedup_bloqueadas', 0,
      'limite_diario_barradas', 0,
      'canceladas', v_canceladas,
      'sem_telefone', v_sem_telefone,
      'retries', v_retries,
      'por_tipo', v_por_tipo,
      'optout_por_tipo', v_optout_por_tipo
    ),
    'serie', v_serie
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.painel_whatsapp_v2(date, date, text, text, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_whatsapp_v2(date, date, text, text, uuid, text, boolean) TO service_role;
