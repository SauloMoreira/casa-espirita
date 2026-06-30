-- P1 — Lote C: classificação final do residual 0029.
-- Balde C: funções internas (cron/service_role/owner) e órfãs sem caller autenticado.
-- Ação: revogar EXECUTE de authenticated + limpeza de anon/PUBLIC por consistência.
-- Caminhos internos (service_role / SECURITY DEFINER owner) permanecem funcionais.

-- Órfãs (sem caller no código)
REVOKE EXECUTE ON FUNCTION public.count_active_masters() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_apt_admins() FROM authenticated, anon, PUBLIC;

-- Internas de fila/notificação (cron/service_role; dispatch usa client service_role)
REVOKE EXECUTE ON FUNCTION public.fn_sanear_fila_notificacoes() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_fila_motivo_inelegivel(p_fila_id uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_reconciliar_excecoes_notificacoes() FROM authenticated, anon, PUBLIC;

-- Leitores de parâmetro internos (consumidos por outras funções SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.fn_confirmacao_agendamento_ativa() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_confirmacao_entrevista_ativa() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_lembrete_antecedencia_horas() FROM authenticated, anon, PUBLIC;

-- Helpers internos de vínculo/próxima sessão (sem caller autenticado)
REVOKE EXECUTE ON FUNCTION public.fn_proxima_sessao_vinculo(p_vinculo uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_eh_proxima_sessao(p_agenda_id uuid) FROM authenticated, anon, PUBLIC;