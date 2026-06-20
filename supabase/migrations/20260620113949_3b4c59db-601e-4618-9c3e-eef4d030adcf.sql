-- Tabela de configuração/opt-in do Comunicador para alertas da Central
CREATE TABLE public.comunicador_alerta_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  recebe_alertas_central boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_alerta_em timestamptz,
  ultimo_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicador_alerta_config TO authenticated;
GRANT ALL ON public.comunicador_alerta_config TO service_role;

ALTER TABLE public.comunicador_alerta_config ENABLE ROW LEVEL SECURITY;

-- O próprio usuário gerencia sua configuração
CREATE POLICY "Usuario gerencia propria config de alerta"
ON public.comunicador_alerta_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins podem visualizar todas as configurações (governança)
CREATE POLICY "Admins leem config de alerta"
ON public.comunicador_alerta_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_comunicador_alerta_config_updated_at
BEFORE UPDATE ON public.comunicador_alerta_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: estado da fila humana pendente (fonte oficial = whatsapp_handoffs)
CREATE OR REPLACE FUNCTION public.fila_humana_pendente()
RETURNS TABLE(total_pendentes integer, idade_mais_antiga_min integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS total_pendentes,
    COALESCE(MAX(EXTRACT(EPOCH FROM (now() - opened_at)) / 60)::int, 0) AS idade_mais_antiga_min
  FROM public.whatsapp_handoffs
  WHERE status = 'aberto' AND atendente_id IS NULL;
$$;

-- RPC: Comunicadores elegíveis ao alerta (vínculo por telefone normalizado, sem CPF)
CREATE OR REPLACE FUNCTION public.comunicadores_elegiveis()
RETURNS TABLE(user_id uuid, celular text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH comunicadores AS (
    SELECT public.fn_normalize_phone(v.celular) AS tel
    FROM public.voluntarios v
    JOIN public.voluntario_funcoes vf ON vf.voluntario_id = v.id
    JOIN public.funcoes_voluntariado f ON f.id = vf.funcao_id
    WHERE v.status = 'ativo'
      AND lower(trim(f.nome_funcao)) = 'comunicador'
      AND public.fn_normalize_phone(v.celular) IS NOT NULL
  ),
  -- telefones presentes em exatamente 1 voluntário comunicador (sem ambiguidade)
  tel_unico_vol AS (
    SELECT tel FROM comunicadores GROUP BY tel HAVING COUNT(*) = 1
  ),
  perfis AS (
    SELECT p.user_id, p.celular, public.fn_normalize_phone(p.celular) AS tel
    FROM public.profiles p
    WHERE public.fn_normalize_phone(p.celular) IS NOT NULL
  ),
  -- telefones presentes em exatamente 1 perfil (sem ambiguidade)
  tel_unico_perfil AS (
    SELECT tel FROM perfis GROUP BY tel HAVING COUNT(*) = 1
  )
  SELECT DISTINCT pf.user_id, pf.celular
  FROM tel_unico_vol uv
  JOIN tel_unico_perfil up ON up.tel = uv.tel
  JOIN perfis pf ON pf.tel = uv.tel
  JOIN public.comunicador_alerta_config cfg ON cfg.user_id = pf.user_id
  WHERE cfg.recebe_alertas_central = true
    AND cfg.ativo = true;
$$;

GRANT EXECUTE ON FUNCTION public.fila_humana_pendente() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.comunicadores_elegiveis() TO service_role;