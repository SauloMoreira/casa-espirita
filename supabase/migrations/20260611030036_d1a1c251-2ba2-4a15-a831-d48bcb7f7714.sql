DROP TRIGGER IF EXISTS audit_ia_sugestoes ON public.ia_sugestoes;
CREATE TRIGGER audit_ia_sugestoes
AFTER INSERT OR UPDATE OR DELETE ON public.ia_sugestoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_feedback ON public.ia_feedback;
CREATE TRIGGER audit_ia_feedback
AFTER INSERT OR UPDATE OR DELETE ON public.ia_feedback
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();