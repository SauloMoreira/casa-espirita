CREATE OR REPLACE FUNCTION public.fn_buscar_pessoa_para_voluntario(p_termo text)
RETURNS TABLE (
  origem text,
  origem_id uuid,
  user_id uuid,
  nome text,
  cpf text,
  celular text,
  email text,
  data_nascimento date,
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, estado text, foto_url text,
  ja_voluntario boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_termo text := btrim(coalesce(p_termo,''));
  v_digits text := NULLIF(regexp_replace(coalesce(p_termo,''),'\D','','g'),'');
BEGIN
  IF NOT (has_role(auth.uid(),'admin')
          OR has_role(auth.uid(),'administrador_master')
          OR has_role(auth.uid(),'coordenador_de_tratamento')) THEN
    RAISE EXCEPTION 'Sem permissão para buscar pessoas';
  END IF;
  IF length(v_termo) < 3 AND v_digits IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT 1 AS prio, 'assistido'::text AS origem, a.id AS origem_id, a.user_id,
           a.nome AS nome, a.cpf, coalesce(a.celular, a.telefone) AS celular, a.email,
           a.data_nascimento, a.cep, a.logradouro, a.numero, a.complemento,
           a.bairro, a.cidade, a.estado, a.foto_url
    FROM assistidos a
    WHERE a.deleted_at IS NULL
      AND (
        a.nome ILIKE '%'||v_termo||'%'
        OR (v_digits IS NOT NULL AND regexp_replace(coalesce(a.cpf,''),'\D','','g') ILIKE '%'||v_digits||'%')
        OR (v_digits IS NOT NULL AND public.fn_normalize_phone(coalesce(a.celular,a.telefone)) ILIKE '%'||v_digits||'%')
      )
    UNION ALL
    SELECT 2 AS prio, 'usuario'::text AS origem, p.id AS origem_id, p.user_id,
           p.nome_completo AS nome, p.cpf, p.celular, NULL::text AS email,
           NULL::date AS data_nascimento, p.cep, p.logradouro, p.numero, p.complemento,
           p.bairro, p.cidade, p.estado, p.foto_url
    FROM profiles p
    WHERE (
        p.nome_completo ILIKE '%'||v_termo||'%'
        OR (v_digits IS NOT NULL AND regexp_replace(coalesce(p.cpf,''),'\D','','g') ILIKE '%'||v_digits||'%')
        OR (v_digits IS NOT NULL AND public.fn_normalize_phone(p.celular) ILIKE '%'||v_digits||'%')
      )
  ),
  chaveado AS (
    SELECT c.*,
      coalesce(
        NULLIF(regexp_replace(coalesce(c.cpf,''),'\D','','g'),''),
        public.fn_normalize_phone(c.celular),
        c.origem||':'||c.origem_id::text
      ) AS dedupe_key
    FROM candidatos c
  ),
  unico AS (
    SELECT DISTINCT ON (dedupe_key) *
    FROM chaveado
    ORDER BY dedupe_key, prio
  )
  SELECT u.origem, u.origem_id, u.user_id, u.nome, u.cpf, u.celular, u.email,
         u.data_nascimento, u.cep, u.logradouro, u.numero, u.complemento,
         u.bairro, u.cidade, u.estado, u.foto_url,
         EXISTS (
           SELECT 1 FROM voluntarios v
           WHERE v.status <> 'desligado'
             AND (
               (u.origem = 'assistido' AND v.origem_assistido_id = u.origem_id)
               OR (u.user_id IS NOT NULL AND v.origem_user_id = u.user_id)
               OR (NULLIF(regexp_replace(coalesce(u.cpf,''),'\D','','g'),'') IS NOT NULL
                   AND NULLIF(regexp_replace(coalesce(v.cpf,''),'\D','','g'),'')
                       = NULLIF(regexp_replace(coalesce(u.cpf,''),'\D','','g'),''))
               OR (public.fn_normalize_phone(v.celular) IS NOT NULL
                   AND public.fn_normalize_phone(v.celular) = public.fn_normalize_phone(u.celular))
             )
         ) AS ja_voluntario
  FROM unico u
  ORDER BY u.nome
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_buscar_pessoa_para_voluntario(text) TO authenticated;