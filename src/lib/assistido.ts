// ============================================================================
// Helpers puros da área do assistido (próxima sessão, progresso, rótulos).
// Isolados para teste e reuso, sem alterar regras de negócio.
// ============================================================================

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** Percentual de progresso do tratamento (0-100, limitado). */
export function progressoPct(realizada: number, total: number): number {
  if (!total || total <= 0) return 0;
  const pct = (realizada / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Dia da semana (pt-BR) a partir de uma data ISO (yyyy-MM-dd). */
export function diaSemanaDe(dataIso: string): string {
  const d = new Date(dataIso + "T12:00:00");
  return DIAS_SEMANA[d.getDay()] ?? "";
}

/** Formata horário "HH:MM:SS" -> "HH:MM". Retorna null se ausente. */
export function horarioCurto(horario?: string | null): string | null {
  if (!horario) return null;
  return horario.slice(0, 5);
}

export interface SessaoLike {
  data_sessao: string;
  status: string;
}

/**
 * Seleciona a próxima sessão agendada (>= hoje) com data mais próxima.
 * Mantém a regra real: só "agendado" no futuro conta como próxima sessão.
 */
export function proximaSessao<T extends SessaoLike>(sessoes: T[], hojeIso: string): T | null {
  const futuras = sessoes
    .filter((s) => s.status === "agendado" && s.data_sessao >= hojeIso)
    .sort((a, b) => a.data_sessao.localeCompare(b.data_sessao));
  return futuras[0] ?? null;
}
