// ============================================================================
// Lógica pura da relação Queixa ↔ Tratamentos (sem efeitos colaterais).
// Apoia a IA na derivação de tratamentos candidatos a partir das queixas
// identificadas. A decisão final é SEMPRE humana — estas funções apenas
// ordenam/priorizam candidatos para exibição ao entrevistador.
// ============================================================================

export type IaPrioridade = "alta" | "media" | "baixa";
export type IaTipoRelacao = "principal" | "complementar";

/** Relação persistida em `ia_queixa_tratamento`. */
export interface IaRelacaoQueixaTratamento {
  tratamento_id: string;
  nome?: string | null;
  prioridade: string;
  peso: number;
  tipo_relacao: string;
  status?: string | null;
}

/** Tratamento candidato derivado das relações (para apoio à sugestão). */
export interface IaTratamentoCandidato {
  tratamento_id: string;
  nome: string;
  peso: number;
  prioridade: string;
  tipo_relacao: string;
}

const PRIORIDADE_RANK: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
const TIPO_RANK: Record<string, number> = { principal: 2, complementar: 1 };

const prioridadeRank = (p: string) => PRIORIDADE_RANK[p?.toLowerCase()] ?? 0;
const tipoRank = (t: string) => TIPO_RANK[t?.toLowerCase()] ?? 0;
const pesoNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Ordena relações de uma (ou várias) queixa(s): principal antes de
 * complementar, depois prioridade (alta > média > baixa), depois peso
 * (desc) e, por fim, nome (asc) para estabilidade.
 */
export function ordenarRelacoes<T extends IaRelacaoQueixaTratamento>(
  relacoes: T[],
): T[] {
  return [...relacoes].sort((a, b) => {
    const tipo = tipoRank(b.tipo_relacao) - tipoRank(a.tipo_relacao);
    if (tipo !== 0) return tipo;
    const prio = prioridadeRank(b.prioridade) - prioridadeRank(a.prioridade);
    if (prio !== 0) return prio;
    const peso = pesoNum(b.peso) - pesoNum(a.peso);
    if (peso !== 0) return peso;
    return (a.nome || "").localeCompare(b.nome || "");
  });
}

/**
 * A partir das relações de todas as queixas identificadas, deriva a lista de
 * tratamentos candidatos, deduplicando por `tratamento_id` e mantendo a
 * relação de maior força (maior peso; em empate, prioridade/tipo mais altos).
 * Considera apenas relações ativas.
 */
export function derivarTratamentosCandidatos(
  relacoes: IaRelacaoQueixaTratamento[],
): IaTratamentoCandidato[] {
  const melhores = new Map<string, IaRelacaoQueixaTratamento>();

  for (const r of relacoes) {
    if (!r.tratamento_id) continue;
    if (r.status && r.status !== "ativo") continue;

    const atual = melhores.get(r.tratamento_id);
    if (!atual || isMaisForte(r, atual)) {
      melhores.set(r.tratamento_id, r);
    }
  }

  return ordenarRelacoes([...melhores.values()]).map((r) => ({
    tratamento_id: r.tratamento_id,
    nome: r.nome || "—",
    peso: pesoNum(r.peso),
    prioridade: r.prioridade,
    tipo_relacao: r.tipo_relacao,
  }));
}

function isMaisForte(
  a: IaRelacaoQueixaTratamento,
  b: IaRelacaoQueixaTratamento,
): boolean {
  if (pesoNum(a.peso) !== pesoNum(b.peso)) return pesoNum(a.peso) > pesoNum(b.peso);
  if (prioridadeRank(a.prioridade) !== prioridadeRank(b.prioridade)) {
    return prioridadeRank(a.prioridade) > prioridadeRank(b.prioridade);
  }
  return tipoRank(a.tipo_relacao) > tipoRank(b.tipo_relacao);
}
