// Pure presentation helpers for the Daniel (FER virtual assistant) chat UX.
// These only drive VISUAL state — they do not touch the IA, handoff, audit or
// central de atendimento logic already homologated.

export const DANIEL_NOME = "Daniel";
export const DANIEL_DIGITANDO_TEXTO = "Daniel está respondendo...";

/** A minimal shape of a conversation message for the typing heuristic. */
export interface MensagemMinima {
  direcao?: "entrada" | "saida" | string | null;
  autor?: "assistido" | "ia" | "humano" | "sistema" | string | null;
}

/**
 * Decides whether to show the "Daniel está respondendo..." typing indicator.
 *
 * It appears only when the conversation is still automated (not handed off to a
 * human and not closed) AND the most recent message came from the assistido —
 * i.e. Daniel is expected to be preparing a reply. This is purely visual: it
 * never fires while a human attendant owns the conversation.
 */
export function deveExibirDigitando(opts: {
  mensagens: MensagemMinima[];
  emHandoff?: boolean | null;
  encerrada?: boolean | null;
  carregando?: boolean | null;
}): boolean {
  if (opts.carregando) return false;
  if (opts.emHandoff) return false;
  if (opts.encerrada) return false;
  const ultima = opts.mensagens[opts.mensagens.length - 1];
  if (!ultima) return false;
  return ultima.direcao === "entrada" || ultima.autor === "assistido";
}
