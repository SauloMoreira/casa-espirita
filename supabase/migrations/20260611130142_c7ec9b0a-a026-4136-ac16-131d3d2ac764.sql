-- Auditoria completa das tabelas da Central de IA (Sprint 2)
-- Captura INSERT/UPDATE/DELETE em audit_logs via fn_audit_trigger existente.

DROP TRIGGER IF EXISTS audit_ia_queixas ON public.ia_queixas;
CREATE TRIGGER audit_ia_queixas
AFTER INSERT OR UPDATE OR DELETE ON public.ia_queixas
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_queixa_tratamento ON public.ia_queixa_tratamento;
CREATE TRIGGER audit_ia_queixa_tratamento
AFTER INSERT OR UPDATE OR DELETE ON public.ia_queixa_tratamento
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_biblioteca ON public.ia_biblioteca;
CREATE TRIGGER audit_ia_biblioteca
AFTER INSERT OR UPDATE OR DELETE ON public.ia_biblioteca
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_biblioteca_relacoes ON public.ia_biblioteca_relacoes;
CREATE TRIGGER audit_ia_biblioteca_relacoes
AFTER INSERT OR UPDATE OR DELETE ON public.ia_biblioteca_relacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_configuracoes ON public.ia_configuracoes;
CREATE TRIGGER audit_ia_configuracoes
AFTER INSERT OR UPDATE OR DELETE ON public.ia_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_sugestoes ON public.ia_sugestoes;
CREATE TRIGGER audit_ia_sugestoes
AFTER INSERT OR UPDATE OR DELETE ON public.ia_sugestoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_ia_feedback ON public.ia_feedback;
CREATE TRIGGER audit_ia_feedback
AFTER INSERT OR UPDATE OR DELETE ON public.ia_feedback
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();