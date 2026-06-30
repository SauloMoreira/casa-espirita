/**
 * Q1-B3 — Contratos canônicos dos status operacionais de notificação.
 *
 * Fonte da verdade: enums reais do banco (`notif_status`, `notif_evento`,
 * `notif_canal`). Estes são espelhos READ-ONLY de classificação/paridade — NÃO
 * alteram lógica de envio, dispatch, fila, inserts nem regras de elegibilidade.
 *
 * Subconjuntos de finalidade já existentes (EVENTOS_OPERACIONAIS,
 * EVENTOS_SESSAO, EVENTOS_ENTREVISTA, EVENTOS_EXCECAO, EVENTO_MENSAGEM_MANUAL)
 * permanecem onde estão e devem ser ⊂ `NOTIF_EVENTO`.
 */

// enum notif_status (5 valores reais do banco).
export const NOTIF_STATUS = {
  pendente: "pendente",
  agendado: "agendado",
  enviado: "enviado",
  falha: "falha",
  cancelado: "cancelado",
} as const;
export type NotifStatus = (typeof NOTIF_STATUS)[keyof typeof NOTIF_STATUS];
export const NOTIF_STATUS_VALORES = Object.values(NOTIF_STATUS) as NotifStatus[];

// enum notif_canal (1 valor real do banco).
export const NOTIF_CANAL = {
  whatsapp: "whatsapp",
} as const;
export type NotifCanal = (typeof NOTIF_CANAL)[keyof typeof NOTIF_CANAL];
export const NOTIF_CANAL_VALORES = Object.values(NOTIF_CANAL) as NotifCanal[];

// enum notif_evento (16 valores reais do banco) — conjunto de referência
// canônico completo, usado para travar paridade e detectar evento novo no banco
// sem espelho. Inclui `aviso_ausencia_recebido` (antes ausente em qualquer
// subconjunto de finalidade TS).
export const NOTIF_EVENTO = [
  "entrevista_criada",
  "entrevista_lembrete",
  "sessao_criada",
  "sessao_lembrete",
  "remarcacao",
  "cancelamento",
  "presenca_registrada",
  "falta_registrada",
  "sessao_cancelada_por_excecao",
  "sessao_remarcada_por_excecao",
  "entrevista_cancelada_por_excecao",
  "entrevista_remarcada_por_excecao",
  "publico_cancelado_por_excecao",
  "publico_remarcado_por_excecao",
  "mensagem_manual",
  "aviso_ausencia_recebido",
] as const;
export type NotifEvento = (typeof NOTIF_EVENTO)[number];
export const NOTIF_EVENTO_SET = new Set<string>(NOTIF_EVENTO);

/** True se `evento` pertence ao conjunto canônico real do banco. */
export function isNotifEvento(evento?: string | null): evento is NotifEvento {
  return !!evento && NOTIF_EVENTO_SET.has(evento);
}
