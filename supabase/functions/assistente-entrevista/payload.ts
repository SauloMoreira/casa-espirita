// ============================================================================
// Q2-A1 — Minimização LGPD do payload enviado ao gateway de IA.
//
// Objetivo: reduzir a exposição de dados pessoais/sensíveis enviados ao gateway
// de IA, preservando o comportamento funcional. O nome do assistido e quaisquer
// identificadores diretos NÃO são enviados à IA — apenas as observações/queixa
// da sessão, que são o único dado indispensável para a sugestão assistida.
//
// A rastreabilidade interna (assistido_id, entrevista_id, vínculo com a
// sugestão, auditoria e trilha de decisão humana) permanece intacta fora deste
// payload — este helper cuida SOMENTE do conteúdo enviado ao gateway externo.
// ============================================================================

/**
 * Constrói a mensagem do usuário enviada ao gateway de IA a partir apenas das
 * observações da entrevista. Não inclui nome, id, telefone, e-mail ou qualquer
 * identificador direto do assistido.
 */
export function buildUserMessage(observacoes: string): string {
  return `Observações da entrevista:\n${observacoes}`;
}
