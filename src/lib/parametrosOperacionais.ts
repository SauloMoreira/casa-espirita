/**
 * Helpers puros de governança de parâmetros operacionais.
 * A validação crítica (autoritativa) vive no backend (fn_atualizar_parametro_operacional).
 * Estes helpers servem apenas para ergonomia da UI: formatação e pré-validação.
 */

export type TipoParametro = "booleano" | "inteiro" | "texto" | "enum" | "json";

export interface ParametroOperacional {
  id: string;
  chave: string;
  nome_amigavel: string | null;
  descricao: string | null;
  impacto: string | null;
  tipo: TipoParametro;
  valor: string;
  valor_padrao: string | null;
  valor_min: number | null;
  valor_max: number | null;
  opcoes: string[] | null;
  sensivel: boolean;
  confirmacao_reforcada: boolean;
  ativo: boolean;
  updated_at: string | null;
  updated_by: string | null;
  alterado_por_nome: string | null;
}

export interface ValidacaoResultado {
  valido: boolean;
  erro?: string;
}

/** Exibe o valor de forma amigável conforme o tipo. */
export function formatarValor(p: Pick<ParametroOperacional, "tipo" | "valor">): string {
  if (p.tipo === "booleano") return p.valor === "true" ? "Ativado" : "Desativado";
  return p.valor;
}

/** Indica se o valor atual difere do padrão (útil para destacar alterações). */
export function difereDoPadrao(p: Pick<ParametroOperacional, "valor" | "valor_padrao">): boolean {
  if (p.valor_padrao == null) return false;
  return String(p.valor) !== String(p.valor_padrao);
}

/**
 * Pré-validação ergonômica. Espelha (sem ser fonte de verdade) as regras do backend.
 */
export function validarValor(
  p: Pick<ParametroOperacional, "tipo" | "valor_min" | "valor_max" | "opcoes">,
  valor: string,
): ValidacaoResultado {
  const v = (valor ?? "").trim();

  switch (p.tipo) {
    case "booleano":
      if (v !== "true" && v !== "false") {
        return { valido: false, erro: "Use Ativado ou Desativado." };
      }
      return { valido: true };

    case "inteiro": {
      if (!/^-?\d+$/.test(v)) {
        return { valido: false, erro: "Informe um número inteiro." };
      }
      const n = Number(v);
      if (p.valor_min != null && n < p.valor_min) {
        return { valido: false, erro: `Valor mínimo permitido: ${p.valor_min}.` };
      }
      if (p.valor_max != null && n > p.valor_max) {
        return { valido: false, erro: `Valor máximo permitido: ${p.valor_max}.` };
      }
      return { valido: true };
    }

    case "enum":
      if (!p.opcoes || !p.opcoes.includes(v)) {
        return { valido: false, erro: "Selecione uma opção válida." };
      }
      return { valido: true };

    case "json":
      try {
        JSON.parse(v);
        return { valido: true };
      } catch {
        return { valido: false, erro: "JSON inválido." };
      }

    case "texto":
    default:
      return { valido: true };
  }
}

/** Houve mudança real entre valor atual e o novo valor proposto. */
export function houveMudanca(atual: string, novo: string): boolean {
  return String(atual).trim() !== String(novo).trim();
}
