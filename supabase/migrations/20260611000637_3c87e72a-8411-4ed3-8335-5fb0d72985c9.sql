DROP VIEW IF EXISTS public.staff_directory;

CREATE OR REPLACE FUNCTION public.staff_names(_ids uuid[] DEFAULT NULL)
RETURNS TABLE(user_id uuid, nome_completo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome_completo
  FROM public.profiles p
  WHERE _ids IS NULL OR p.user_id = ANY(_ids)
$$;

REVOKE EXECUTE ON FUNCTION public.staff_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_names(uuid[]) TO authenticated;