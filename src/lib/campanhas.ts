import type { Tables } from "@/integrations/supabase/types";

export type Campanha = Tables<"campanhas">;

export type ImagemOrigem = "manual" | "ia";

/** Verifica se a campanha está dentro do período de exibição em `ref`. */
export function campanhaVigente(c: Pick<Campanha, "data_inicio" | "data_fim">, ref: Date = new Date()): boolean {
  const hoje = ref.toISOString().slice(0, 10);
  if (c.data_inicio && c.data_inicio > hoje) return false;
  if (c.data_fim && c.data_fim < hoje) return false;
  return true;
}

/**
 * Campanhas visíveis ao assistido: ativas e vigentes, com destaques primeiro,
 * depois pela ordem definida e por título.
 */
export function campanhasVisiveis(itens: Campanha[], ref: Date = new Date()): Campanha[] {
  return [...itens]
    .filter((c) => c.ativo && campanhaVigente(c, ref))
    .sort(ordenarExibicao);
}

/** Ordenação de exibição: destaque desc, ordem asc, título asc. */
export function ordenarExibicao(a: Campanha, b: Campanha): number {
  if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/** Valida o payload mínimo de uma campanha. */
export function validarCampanha(input: { titulo?: string | null; data_inicio?: string | null; data_fim?: string | null }): string | null {
  if (!input.titulo || input.titulo.trim().length < 2) {
    return "Informe o título da campanha (mínimo 2 caracteres).";
  }
  if (input.data_inicio && input.data_fim && input.data_inicio > input.data_fim) {
    return "A data de início não pode ser posterior à data de fim.";
  }
  return null;
}
