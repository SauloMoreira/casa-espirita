CREATE OR REPLACE FUNCTION public.proteger_campos_staff_assistido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Chamadas via service role (edge functions confiáveis, ex: create-user)
  -- não têm auth.uid() (não são uma sessão de usuário comum) — tratamos
  -- isso como contexto de backend confiável, não como tentativa de burla.
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin')
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