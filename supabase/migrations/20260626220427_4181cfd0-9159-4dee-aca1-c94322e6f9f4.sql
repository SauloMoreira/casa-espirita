-- Etapa 1: Acesso básico automático de "assistido" (papel base do sistema)
-- Fonte única: gatilho AFTER INSERT em public.profiles (artefato presente em toda conta).
-- Idempotente: ON CONFLICT DO NOTHING sobre user_roles_user_id_role_key.

CREATE OR REPLACE FUNCTION public.fn_conceder_acesso_base()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Concede o papel base "assistido" de forma idempotente e cumulativa.
  -- Nunca remove/substitui papéis elevados já existentes.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'assistido'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_acesso_base ON public.profiles;
CREATE TRIGGER trg_profiles_acesso_base
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_conceder_acesso_base();

-- Backfill seguro e idempotente: garante o papel base para contas já existentes
-- que ainda não o possuem, sem afetar papéis elevados.
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'assistido'::app_role
FROM public.profiles p
ON CONFLICT (user_id, role) DO NOTHING;