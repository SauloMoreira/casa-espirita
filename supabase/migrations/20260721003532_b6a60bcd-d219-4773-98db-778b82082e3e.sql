CREATE OR REPLACE FUNCTION public.reconciliar_assistido_com_conta_existente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidato RECORD;
  qtd_candidatos int;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    SELECT count(*) INTO qtd_candidatos
    FROM public.profiles p
    WHERE p.cpf = NEW.cpf
      AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id);

    IF qtd_candidatos = 1 THEN
      SELECT p.user_id INTO candidato
      FROM public.profiles p
      WHERE p.cpf = NEW.cpf
        AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id)
      LIMIT 1;

      NEW.user_id := candidato.user_id;

      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (candidato.user_id, 'reconciliacao_automatica_pos_migracao', 'assistidos', NEW.id,
              jsonb_build_object('match_por', 'cpf'));
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.celular IS NOT NULL AND NEW.celular <> '' THEN
    SELECT count(*) INTO qtd_candidatos
    FROM public.profiles p
    WHERE p.celular = NEW.celular
      AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id);

    IF qtd_candidatos = 1 THEN
      SELECT p.user_id INTO candidato
      FROM public.profiles p
      WHERE p.celular = NEW.celular
        AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id)
      LIMIT 1;

      NEW.user_id := candidato.user_id;

      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (candidato.user_id, 'reconciliacao_automatica_pos_migracao', 'assistidos', NEW.id,
              jsonb_build_object('match_por', 'celular'));
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciliar_assistido_insert ON public.assistidos;
CREATE TRIGGER trg_reconciliar_assistido_insert
BEFORE INSERT ON public.assistidos
FOR EACH ROW
EXECUTE FUNCTION public.reconciliar_assistido_com_conta_existente();

DROP TRIGGER IF EXISTS trg_reconciliar_assistido_update ON public.assistidos;
CREATE TRIGGER trg_reconciliar_assistido_update
BEFORE UPDATE OF cpf, celular ON public.assistidos
FOR EACH ROW
WHEN (NEW.user_id IS NULL)
EXECUTE FUNCTION public.reconciliar_assistido_com_conta_existente();