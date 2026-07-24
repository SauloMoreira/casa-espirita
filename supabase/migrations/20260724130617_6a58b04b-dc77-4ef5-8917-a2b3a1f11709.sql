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
  v_email text;
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'assistido'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

  IF NOT EXISTS (SELECT 1 FROM public.assistidos WHERE user_id = NEW.user_id) THEN
    IF length(v_cpf_digits) = 11 THEN
      SELECT id INTO v_candidato_id FROM public.assistidos
      WHERE cpf = v_cpf_digits AND user_id IS NULL LIMIT 2;
      IF (SELECT count(*) FROM public.assistidos WHERE cpf = v_cpf_digits AND user_id IS NULL) <> 1 THEN
        v_candidato_id := NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NULL AND length(v_cel_digits) >= 10 THEN
      SELECT id INTO v_candidato_id FROM public.assistidos
      WHERE celular = v_cel_digits AND user_id IS NULL LIMIT 2;
      IF (SELECT count(*) FROM public.assistidos WHERE celular = v_cel_digits AND user_id IS NULL) <> 1 THEN
        v_candidato_id := NULL;
      END IF;
    END IF;

    IF v_candidato_id IS NOT NULL THEN
      UPDATE public.assistidos SET
        user_id = NEW.user_id,
        email = COALESCE(NULLIF(email, ''), v_email),
        cpf = COALESCE(NULLIF(cpf, ''), NULLIF(v_cpf_digits, '')),
        celular = COALESCE(NULLIF(celular, ''), NULLIF(v_cel_digits, '')),
        nome = CASE WHEN nome IS NULL OR trim(nome) = '' THEN NEW.nome_completo ELSE nome END
      WHERE id = v_candidato_id AND user_id IS NULL;

      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (NEW.user_id, 'reconciliacao_automatica_criacao_conta', 'assistidos', v_candidato_id,
              jsonb_build_object('motivo', 'Gatilho de criação de conta encontrou assistido pré-existente, campos vazios completados'));
    ELSE
      INSERT INTO public.assistidos (nome, cpf, celular, email, status, user_id, origem_cadastro, created_by)
      VALUES (
        COALESCE(NEW.nome_completo, 'Sem nome'),
        NULLIF(v_cpf_digits, ''),
        NULLIF(v_cel_digits, ''),
        v_email,
        'aguardando_palestras',
        NEW.user_id,
        'normal',
        NEW.user_id
      );
    END IF;
  ELSE
    UPDATE public.assistidos
    SET email = COALESCE(NULLIF(email, ''), v_email)
    WHERE user_id = NEW.user_id AND (email IS NULL OR email = '');
  END IF;

  RETURN NEW;
END;
$$;