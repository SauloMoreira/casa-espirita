CREATE OR REPLACE FUNCTION public.proteger_campos_staff_assistido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'entrevistador')
     OR public.has_role(auth.uid(), 'coordenador_de_tratamento') THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.quantidade_palestras IS NOT DISTINCT FROM OLD.quantidade_palestras
     AND NEW.cadastro_completo IS NOT DISTINCT FROM OLD.cadastro_completo
     AND NEW.observacoes IS NOT DISTINCT FROM OLD.observacoes
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.nome IS NOT DISTINCT FROM OLD.nome
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.data_nascimento IS NOT DISTINCT FROM OLD.data_nascimento
     AND NEW.cpf IS NOT DISTINCT FROM OLD.cpf
     AND NEW.telefone IS NOT DISTINCT FROM OLD.telefone
     AND NEW.endereco IS NOT DISTINCT FROM OLD.endereco
     AND NEW.origem_cadastro IS NOT DISTINCT FROM OLD.origem_cadastro
     AND NEW.migrado_legado IS NOT DISTINCT FROM OLD.migrado_legado
     AND NEW.data_migracao IS NOT DISTINCT FROM OLD.data_migracao
     AND NEW.usa_agenda_plano IS NOT DISTINCT FROM OLD.usa_agenda_plano
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.quantidade_palestras IS DISTINCT FROM OLD.quantidade_palestras
     OR NEW.cadastro_completo IS DISTINCT FROM OLD.cadastro_completo
     OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.nome IS DISTINCT FROM OLD.nome
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.data_nascimento IS DISTINCT FROM OLD.data_nascimento
     OR NEW.cpf IS DISTINCT FROM OLD.cpf
     OR NEW.telefone IS DISTINCT FROM OLD.telefone
     OR NEW.endereco IS DISTINCT FROM OLD.endereco
     OR NEW.origem_cadastro IS DISTINCT FROM OLD.origem_cadastro
     OR NEW.migrado_legado IS DISTINCT FROM OLD.migrado_legado
     OR NEW.data_migracao IS DISTINCT FROM OLD.data_migracao
     OR NEW.usa_agenda_plano IS DISTINCT FROM OLD.usa_agenda_plano
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar esse campo. Fale com a administração.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_assistido_cadastro_minimo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cel text;
  v_cel_antigo text;
  v_dup_count int;
  v_auto text;
BEGIN
  v_auto := current_setting('app.auto_provision_assistido', true);

  NEW.nome := btrim(coalesce(NEW.nome, ''));
  IF NEW.nome = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório para o cadastro do assistido.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_cel := regexp_replace(coalesce(NEW.celular, ''), '\D', '', 'g');

  IF TG_OP = 'INSERT' THEN
    IF v_cel = '' AND coalesce(v_auto,'') <> 'on' THEN
      RAISE EXCEPTION 'Celular é obrigatório para o cadastro do assistido.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_cel <> '' AND length(v_cel) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'Celular inválido: informe DDD + número (10 ou 11 dígitos).'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.celular := NULLIF(v_cel, '');
  IF coalesce(regexp_replace(coalesce(NEW.telefone,''),'\D','','g'),'') = '' AND v_cel <> '' THEN
    NEW.telefone := v_cel;
  END IF;

  IF coalesce(NEW.cpf,'') <> '' THEN
    NEW.cpf := NULLIF(regexp_replace(NEW.cpf, '\D', '', 'g'), '');
  END IF;
  IF coalesce(NEW.cep,'') <> '' THEN
    NEW.cep := NULLIF(regexp_replace(NEW.cep, '\D', '', 'g'), '');
  END IF;

  v_cel_antigo := CASE WHEN TG_OP = 'UPDATE'
    THEN regexp_replace(coalesce(OLD.celular,''),'\D','','g') ELSE '' END;
  IF v_cel <> '' AND v_cel IS DISTINCT FROM NULLIF(v_cel_antigo,'') THEN
    SELECT count(*) INTO v_dup_count
    FROM public.assistidos x
    WHERE x.deleted_at IS NULL
      AND x.id <> NEW.id
      AND regexp_replace(coalesce(x.celular,''),'\D','','g') = v_cel;
    IF v_dup_count > 0 THEN
      RAISE EXCEPTION 'Já existe um assistido cadastrado com este celular.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  NEW.cadastro_completo := public.fn_assistido_cadastro_esta_completo(NEW);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_conceder_acesso_base()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidato_id uuid;
  v_cpf_digits text := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
  v_cel_digits text := regexp_replace(COALESCE(NEW.celular, ''), '\D', '', 'g');
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'assistido'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.assistidos WHERE user_id = NEW.user_id) THEN
    IF length(v_cpf_digits) = 11 THEN
      IF (SELECT count(*) FROM public.assistidos WHERE cpf = v_cpf_digits AND user_id IS NULL) = 1 THEN
        SELECT id INTO v_candidato_id FROM public.assistidos
        WHERE cpf = v_cpf_digits AND user_id IS NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NULL AND length(v_cel_digits) >= 10 THEN
      IF (SELECT count(*) FROM public.assistidos WHERE celular = v_cel_digits AND user_id IS NULL) = 1 THEN
        SELECT id INTO v_candidato_id FROM public.assistidos
        WHERE celular = v_cel_digits AND user_id IS NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NOT NULL THEN
      UPDATE public.assistidos SET user_id = NEW.user_id WHERE id = v_candidato_id AND user_id IS NULL;
      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (NEW.user_id, 'reconciliacao_automatica_criacao_conta', 'assistidos', v_candidato_id,
              jsonb_build_object('motivo', 'Gatilho de criação de conta encontrou assistido pré-existente'));
    ELSE
      PERFORM set_config('app.auto_provision_assistido', 'on', true);
      INSERT INTO public.assistidos (nome, cpf, celular, status, user_id, created_by, origem_cadastro)
      VALUES (
        COALESCE(NEW.nome_completo, 'Sem nome'),
        NULLIF(v_cpf_digits, ''),
        NULLIF(v_cel_digits, ''),
        'aguardando_palestras',
        NEW.user_id,
        NEW.user_id,
        'normal'
      );
      PERFORM set_config('app.auto_provision_assistido', 'off', true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_perfil RECORD;
  v_candidato_id uuid;
  v_cpf_digits text;
  v_cel_digits text;
BEGIN
  PERFORM set_config('app.auto_provision_assistido', 'on', true);
  FOR v_perfil IN
    SELECT p.user_id, p.nome_completo, p.cpf, p.celular
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'assistido'
    WHERE NOT EXISTS (SELECT 1 FROM public.assistidos a WHERE a.user_id = p.user_id)
  LOOP
    v_cpf_digits := regexp_replace(COALESCE(v_perfil.cpf, ''), '\D', '', 'g');
    v_cel_digits := regexp_replace(COALESCE(v_perfil.celular, ''), '\D', '', 'g');
    v_candidato_id := NULL;

    IF length(v_cpf_digits) = 11 THEN
      IF (SELECT count(*) FROM public.assistidos WHERE cpf = v_cpf_digits AND user_id IS NULL) = 1 THEN
        SELECT id INTO v_candidato_id FROM public.assistidos WHERE cpf = v_cpf_digits AND user_id IS NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NULL AND length(v_cel_digits) >= 10 THEN
      IF (SELECT count(*) FROM public.assistidos WHERE celular = v_cel_digits AND user_id IS NULL) = 1 THEN
        SELECT id INTO v_candidato_id FROM public.assistidos WHERE celular = v_cel_digits AND user_id IS NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NOT NULL THEN
      UPDATE public.assistidos SET user_id = v_perfil.user_id WHERE id = v_candidato_id AND user_id IS NULL;
      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (v_perfil.user_id, 'reconciliacao_backfill_papel_sem_registro', 'assistidos', v_candidato_id,
              jsonb_build_object('motivo', 'Backfill: papel assistido concedido sem registro correspondente'));
    ELSE
      INSERT INTO public.assistidos (nome, cpf, celular, status, user_id, created_by, origem_cadastro)
      VALUES (
        COALESCE(v_perfil.nome_completo, 'Sem nome'),
        NULLIF(v_cpf_digits, ''),
        NULLIF(v_cel_digits, ''),
        'aguardando_palestras',
        v_perfil.user_id,
        v_perfil.user_id,
        'normal'
      );
    END IF;
  END LOOP;
  PERFORM set_config('app.auto_provision_assistido', 'off', true);
END $$;