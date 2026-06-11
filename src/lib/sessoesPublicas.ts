// ============================================================================
// Helpers puros da tela de Sessões Públicas (contador e rótulos operacionais).
// Mantidos isolados para teste e reuso, sem alterar regras de negócio.
// ============================================================================

export interface CheckinLike {
  cadastro_rapido?: boolean | null;
  modo_checkin?: string | null;
}

/** Conta participantes registrados via cadastro rápido (novos no dia). */
export function contarNovos(checkins: CheckinLike[]): number {
  return checkins.filter((c) => c.cadastro_rapido === true).length;
}

/** Rótulo amigável da origem do check-in. */
export function modoLabel(modo?: string | null): "QR" | "Manual" {
  return modo === "qr" ? "QR" : "Manual";
}

/** Monta a URL pública de check-in a partir do token da sessão. */
export function checkinUrl(origin: string, token?: string | null): string {
  if (!token) return "";
  return `${origin}/checkin-publico/${token}`;
}
