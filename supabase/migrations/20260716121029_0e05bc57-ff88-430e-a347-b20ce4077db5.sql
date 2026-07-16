CREATE TABLE IF NOT EXISTS public.signup_tentativas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text,
  email text,
  sucesso boolean NOT NULL DEFAULT false,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_tentativas TO service_role;
GRANT SELECT ON public.signup_tentativas TO authenticated;
ALTER TABLE public.signup_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read signup_tentativas"
ON public.signup_tentativas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Block client inserts on signup_tentativas"
ON public.signup_tentativas
FOR INSERT
TO authenticated, anon
WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_signup_tentativas_ip_created
ON public.signup_tentativas (ip, created_at DESC);