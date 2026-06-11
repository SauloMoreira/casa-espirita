CREATE OR REPLACE FUNCTION public.dashboard_admin(p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_today date := CURRENT_DATE;
  v_start timestamp := p_inicio::timestamp;
  v_end timestamp := (p_fim::timestamp + interval '1 day' - interval '1 second');
  v_ent_recentes jsonb;
  v_trat_por_tipo jsonb;
  v_carga jsonb;
  v_presenca jsonb;
  v_ent_tipo jsonb;
  v_faixa jsonb;
BEGIN
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('autorizado', false);
  END IF;

  CREATE TEMP TABLE _trat ON COMMIT DROP AS
  SELECT at.tratamento_id, tt.nome AS trat_nome, tt.tarefeiro_id
  FROM assistido_tratamentos at
  JOIN tipos_tratamento tt ON tt.id = at.tratamento_id
  WHERE at.status IN ('aguardando_inicio', 'em_andamento');

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_ent_recentes FROM (
    SELECT e.id, e.data, e.status, e.assistido_id, e.entrevistador_id, e.tipo_entrevista,
      COALESCE(a.nome, '—') AS assistido_nome,
      COALESCE(p.nome_completo, '—') AS entrevistador_nome
    FROM entrevistas_fraternas e
    LEFT JOIN assistidos a ON a.id = e.assistido_id
    LEFT JOIN profiles p ON p.user_id = e.entrevistador_id
    ORDER BY e.data DESC
    LIMIT 5
  ) r;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_trat_por_tipo FROM (
    SELECT trat_nome AS nome, COUNT(*)::int AS count
    FROM _trat
    GROUP BY tratamento_id, trat_nome
    ORDER BY COUNT(*) DESC
  ) r;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_carga FROM (
    SELECT COALESCE(p.nome_completo,
             CASE WHEN p.user_id IS NOT NULL THEN 'Sem nome' ELSE LEFT(t.tarefeiro_id::text, 8) END) AS nome,
           COUNT(*)::int AS total
    FROM _trat t
    LEFT JOIN profiles p ON p.user_id = t.tarefeiro_id
    WHERE t.tarefeiro_id IS NOT NULL
    GROUP BY t.tarefeiro_id, p.user_id, p.nome_completo
    ORDER BY COUNT(*) DESC
  ) r;

  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_presenca FROM (
    SELECT data, presentes, ausentes FROM (
      SELECT data::text AS data,
        COUNT(*) FILTER (WHERE status_presenca = 'presente')::int AS presentes,
        COUNT(*) FILTER (WHERE status_presenca <> 'presente')::int AS ausentes
      FROM presencas_tratamentos
      WHERE data >= p_inicio AND data <= p_fim
      GROUP BY data
      ORDER BY data DESC
      LIMIT 15
    ) s
    ORDER BY data ASC
  ) x;

  SELECT jsonb_build_object(
    'regulares', COUNT(*) FILTER (WHERE tipo_entrevista IS DISTINCT FROM 'livre')::int,
    'livres', COUNT(*) FILTER (WHERE tipo_entrevista = 'livre')::int,
    'realizadas', COUNT(*) FILTER (WHERE status = 'realizada')::int,
    'total', COUNT(*)::int
  ) INTO v_ent_tipo
  FROM entrevistas_fraternas
  WHERE data >= v_start AND data <= v_end;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_faixa FROM (
    SELECT grp AS name, cnt AS value FROM (
      SELECT grp, COUNT(*)::int AS cnt,
        CASE grp
          WHEN 'Até 17' THEN 1 WHEN '18–24' THEN 2 WHEN '25–34' THEN 3
          WHEN '35–44' THEN 4 WHEN '45–59' THEN 5 WHEN '60+' THEN 6 ELSE 7
        END AS ord
      FROM (
        SELECT CASE
          WHEN data_nascimento IS NULL THEN 'Não informado'
          WHEN date_part('year', age(data_nascimento)) BETWEEN 0 AND 17 THEN 'Até 17'
          WHEN date_part('year', age(data_nascimento)) BETWEEN 18 AND 24 THEN '18–24'
          WHEN date_part('year', age(data_nascimento)) BETWEEN 25 AND 34 THEN '25–34'
          WHEN date_part('year', age(data_nascimento)) BETWEEN 35 AND 44 THEN '35–44'
          WHEN date_part('year', age(data_nascimento)) BETWEEN 45 AND 59 THEN '45–59'
          WHEN date_part('year', age(data_nascimento)) >= 60 THEN '60+'
          ELSE 'Não informado'
        END AS grp
        FROM assistidos
        WHERE deleted_at IS NULL
      ) g
      GROUP BY grp
    ) s
    WHERE cnt > 0
    ORDER BY ord
  ) r;

  RETURN jsonb_build_object(
    'autorizado', true,
    'assistidos_total', (SELECT COUNT(*)::int FROM assistidos WHERE deleted_at IS NULL),
    'trat_ativos', (SELECT COUNT(*)::int FROM assistido_tratamentos WHERE status IN ('aguardando_inicio', 'em_andamento')),
    'trat_concluidos', (SELECT COUNT(*)::int FROM assistido_tratamentos WHERE status = 'concluido' AND updated_at >= v_start AND updated_at <= v_end),
    'ent_agendadas', (SELECT COUNT(*)::int FROM entrevistas_fraternas WHERE status = 'agendada'),
    'presencas_hoje', (SELECT COUNT(*)::int FROM presencas_tratamentos WHERE data = v_today),
    'lista_espera', (SELECT COUNT(*)::int FROM assistido_tratamentos WHERE status = 'aguardando_liberacao'),
    'aguardando_agend', (SELECT COUNT(*)::int FROM assistido_tratamentos WHERE status = 'aguardando_agendamento'),
    'faltas_mes', (SELECT COUNT(*)::int FROM presencas_tratamentos WHERE status_presenca = 'ausente' AND data >= p_inicio AND data <= p_fim),
    'publico_palestras', (SELECT COUNT(*)::int FROM presencas_palestras WHERE presente = true),
    'ent_recentes', v_ent_recentes,
    'trat_por_tipo', v_trat_por_tipo,
    'carga_tarefeiros', v_carga,
    'presenca_pontos', v_presenca,
    'entrevistas_por_tipo', v_ent_tipo,
    'faixa_etaria', v_faixa
  );
END;
$function$;