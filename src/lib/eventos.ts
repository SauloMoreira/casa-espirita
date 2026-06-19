import type { Tables } from "@/integrations/supabase/types";

export type Evento = Tables<"eventos">;

export type ImagemOrigem = "manual" | "ia";

/** Verifica se o evento está dentro do período de exibição em `ref`. */
export function eventoVigente(e: Pick<Evento, "data_inicio" | "data_fim">, ref: Date = new Date()): boolean {
  const hoje = ref.toISOString().slice(0, 10);
  if (e.data_inicio && e.data_inicio > hoje) return false;
  if (e.data_fim && e.data_fim < hoje) return false;
  return true;
}

/**
 * Eventos visíveis ao assistido: ativos e vigentes, com destaques primeiro,
 * depois pela data do evento (mais próxima primeiro), ordem e título.
 */
export function eventosVisiveis(itens: Evento[], ref: Date = new Date()): Evento[] {
  return [...itens]
    .filter((e) => e.ativo && eventoVigente(e, ref))
    .sort(ordenarExibicao);
}

/** Ordenação de exibição: destaque desc, data do evento asc, ordem asc, título asc. */
export function ordenarExibicao(a: Evento, b: Evento): number {
  if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
  if (a.data_evento && b.data_evento && a.data_evento !== b.data_evento) {
    return a.data_evento < b.data_evento ? -1 : 1;
  }
  if (!!a.data_evento !== !!b.data_evento) return a.data_evento ? -1 : 1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/** Valida o payload mínimo de um evento. */
export function validarEvento(input: {
  titulo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  data_evento?: string | null;
  data_evento_fim?: string | null;
}): string | null {
  if (!input.titulo || input.titulo.trim().length < 2) {
    return "Informe o título do evento (mínimo 2 caracteres).";
  }
  if (input.data_inicio && input.data_fim && input.data_inicio > input.data_fim) {
    return "A data de início da exibição não pode ser posterior à data de fim.";
  }
  if (input.data_evento && input.data_evento_fim && input.data_evento > input.data_evento_fim) {
    return "O término do evento não pode ser anterior ao seu início.";
  }
  return null;
}
