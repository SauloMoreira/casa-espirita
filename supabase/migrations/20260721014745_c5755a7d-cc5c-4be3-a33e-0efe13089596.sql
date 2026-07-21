CREATE OR REPLACE FUNCTION public.get_meu_registro_assistido()
RETURNS TABLE (
  id uuid, nome text, email text, celular text, cpf text,
  data_nascimento date, foto_url text, cep text, logradouro text,
  numero text, complemento text, bairro text, cidade text, estado text,
  status text, quantidade_palestras integer, cadastro_completo boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.email, a.celular, a.cpf,
         a.data_nascimento, a.foto_url, a.cep, a.logradouro,
         a.numero, a.complemento, a.bairro, a.cidade, a.estado,
         a.status, a.quantidade_palestras, a.cadastro_completo
  FROM public.assistidos a
  WHERE a.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_meu_registro_assistido() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meu_registro_assistido() TO authenticated;

DROP POLICY IF EXISTS "Assistido views own record" ON public.assistidos;

CREATE OR REPLACE FUNCTION public.proteger_campos_staff_assistido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'entrevistador')
     OR public.has_role(auth.uid(), 'coordenador_de_tratamento') THEN
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
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_staff_assistido ON public.assistidos;
CREATE TRIGGER trg_proteger_campos_staff_assistido
BEFORE UPDATE ON public.assistidos
FOR EACH ROW
EXECUTE FUNCTION public.proteger_campos_staff_assistido();