// ============================================================================
// Fase 5 — Métricas, observabilidade e calibração da IA (WhatsApp)
// Helpers PUROS e determinísticos (sem rede, sem LLM, sem estado).
// Consomem o JSON da RPC public.metricas_ia_whatsapp e produzem:
//  - formatação de KPIs e deltas vs período anterior
//  - ranking top-N
//  - agrupamento determinístico de padrões de falha
//  - categorização de falha + backlog de calibração com impacto baixo/médio/alto
// ============================================================================

// ---------------------------------------------------------------------------
// Tipos do payload da RPC
// ---------------------------------------------------------------------------
export interface ContagemTexto { texto: string; total: number }
export interface ContagemMotivo { motivo: string; total: number }
export interface ContagemIntencao { intencao: string; total: number }
export interface ContagemEscopo { escopo: string; total: number }
export interface ContagemStatus { status: string; total: number }
export interface ItemAmbiguidade {
  texto: string;
  total: number;
  intencao: string | null;
  escopo: string | null;
  fallback_motivo: string | null;
  hibrido_baixa_conf: boolean | null;
}

export interface MetricasIaWhatsapp {
  autorizado: boolean;
  periodo: { inicio: string; fim: string };
  volume: { mensagens_recebidas: number; respostas_ia: number; conversas: number };
  handoff: {
    total: number;
    pct_sobre_mensagens: number;
    classificado_por_ia: number;
    top_motivos: ContagemMotivo[];
    por_status: ContagemStatus[];
  };
  classificacao: {
    top_intents: ContagemIntencao[];
    pct_sem_fallback: number;
    top_fallback: ContagemMotivo[];
    top_complexo: ContagemTexto[];
    total_complexo: number;
  };
  hibrido: {
    total_turnos: number;
    pct_sobre_total: number;
    confianca_media: number;
    respostas_com_llm: number;
  };
  escopo: {
    distribuicao: ContagemEscopo[];
    pessoais: number;
    pessoais_nao_identificados: number;
    pct_pessoais_nao_ident: number;
  };
  ambiguidades: ItemAmbiguidade[];
}

// ---------------------------------------------------------------------------
// Períodos pré-definidos
// ---------------------------------------------------------------------------
export type PeriodoDias = 7 | 30 | 90;

export interface JanelaPeriodo { inicio: string; fim: string }

/**
 * Calcula a janela atual e a janela anterior equivalente para um nº de dias.
 * Retorna ISO strings (timestamptz) prontas para a RPC.
 */
export function calcularJanelas(dias: PeriodoDias, agora: Date = new Date()): {
  atual: JanelaPeriodo;
  anterior: JanelaPeriodo;
} {
  const fim = new Date(agora);
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - dias);

  const fimAnt = new Date(inicio);
  const inicioAnt = new Date(inicio);
  inicioAnt.setDate(inicioAnt.getDate() - dias);

  return {
    atual: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    anterior: { inicio: inicioAnt.toISOString(), fim: fimAnt.toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Formatação / cálculos básicos
// ---------------------------------------------------------------------------
export function pct(parte: number, total: number, casas = 1): number {
  if (!total || total <= 0) return 0;
  const v = (parte / total) * 100;
  const f = Math.pow(10, casas);
  return Math.round(v * f) / f;
}

export function truncar(texto: string | null | undefined, max = 80): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

export type DirecaoDelta = "subiu" | "desceu" | "estavel";

export interface Delta {
  atual: number;
  anterior: number;
  diferenca: number;
  variacaoPct: number | null; // null quando não há base anterior
  direcao: DirecaoDelta;
}

/** Calcula o delta entre valor atual e anterior. */
export function calcularDelta(atual: number, anterior: number, casas = 1): Delta {
  const diferenca = atual - anterior;
  let variacaoPct: number | null = null;
  if (anterior !== 0) {
    const f = Math.pow(10, casas);
    variacaoPct = Math.round((diferenca / Math.abs(anterior)) * 100 * f) / f;
  } else if (atual !== 0) {
    variacaoPct = null; // crescimento a partir de zero não tem % significativo
  } else {
    variacaoPct = 0;
  }
  const direcao: DirecaoDelta = diferenca > 0 ? "subiu" : diferenca < 0 ? "desceu" : "estavel";
  return { atual, anterior, diferenca, variacaoPct, direcao };
}

// ---------------------------------------------------------------------------
// Ranking top-N genérico
// ---------------------------------------------------------------------------
/**
 * Ordena por `total` desc e retorna no máximo N itens (default 10, teto 20).
 */
export function topN<T extends { total: number }>(itens: T[], n = 10): T[] {
  const limite = Math.min(Math.max(n, 1), 20);
  return [...(itens ?? [])]
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// Agrupamento determinístico de padrões de falha
// ---------------------------------------------------------------------------
export type CategoriaFalha =
  | "erro_temporal"
  | "erro_atividade"
  | "pessoal_sem_identificacao"
  | "mensagem_curta_ambigua"
  | "erro_digitacao"
  | "fallback_baixa_confianca"
  | "desambiguacao_publico_pessoal"
  | "handoff_repetido"
  | "outro";

export const ROTULO_CATEGORIA: Record<CategoriaFalha, string> = {
  erro_temporal: "Erro temporal",
  erro_atividade: "Erro de atividade/entidade",
  pessoal_sem_identificacao: "Pergunta pessoal sem identificação",
  mensagem_curta_ambigua: "Mensagem curta ambígua",
  erro_digitacao: "Erro de digitação fora do dicionário",
  fallback_baixa_confianca: "Fallback por baixa confiança",
  desambiguacao_publico_pessoal: "Falha de desambiguação público × pessoal",
  handoff_repetido: "Handoff repetido pela mesma causa",
  outro: "Outro padrão",
};

const RX_TEMPORAL = /\b(hoje|amanh[ãa]|ontem|depois de amanh[ãa]|semana|fim de semana|s[áa]bado|domingo|segunda|ter[çc]a|quarta|quinta|sexta|m[êe]s|dia|data|quando|hor[áa]rio|que vem|pr[óo]xim)/i;
const RX_PESSOAL = /\b(meu|minha|meus|minhas|tenho|eu)\b/i;
const RX_ATIVIDADE = /\b(passe|desobsess[ãa]o|evangelhoterap|palestra|tratamento|sess[ãa]o|fluido|[áa]gua|consulta|atendimento)/i;

/**
 * Classifica uma mensagem problemática numa categoria de falha,
 * combinando intenção, escopo, motivos e a forma do texto.
 */
export function categorizarFalha(item: {
  texto?: string | null;
  intencao?: string | null;
  escopo?: string | null;
  fallback_motivo?: string | null;
  hibrido_baixa_conf?: boolean | null;
}): CategoriaFalha {
  const texto = (item.texto ?? "").trim();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const baixoConf = !!item.hibrido_baixa_conf;
  const escopo = (item.escopo ?? "").toLowerCase();

  // 1. Pessoal sem identificação confiável.
  if (escopo === "pessoal" && RX_PESSOAL.test(texto)) {
    return "pessoal_sem_identificacao";
  }

  // 2. Ambiguidade público × pessoal: cita atividade mas escopo indefinido/ambíguo.
  if ((escopo === "ambiguo" || escopo === "geral" || escopo === "") && RX_ATIVIDADE.test(texto)) {
    return "desambiguacao_publico_pessoal";
  }

  // 3. Erro temporal: pergunta sobre data/quando.
  if (RX_TEMPORAL.test(texto)) {
    return "erro_temporal";
  }

  // 4. Erro de atividade/entidade.
  if (RX_ATIVIDADE.test(texto)) {
    return "erro_atividade";
  }

  // 5. Mensagem curta ambígua (1–2 palavras, sem sinal claro).
  if (palavras.length > 0 && palavras.length <= 2) {
    return "mensagem_curta_ambigua";
  }

  // 6. Erro de digitação fora do dicionário (caiu em complexo, texto com palavra "longa" não reconhecida).
  if ((item.intencao ?? "") === "complexo" && palavras.length >= 1 && palavras.some((p) => p.length >= 5)) {
    return "erro_digitacao";
  }

  // 7. Fallback por baixa confiança.
  if (baixoConf || item.fallback_motivo) {
    return "fallback_baixa_confianca";
  }

  return "outro";
}

export interface GrupoFalha {
  categoria: CategoriaFalha;
  rotulo: string;
  total: number;
  exemplos: string[]; // textos truncados, ordenados por frequência
}

/**
 * Agrupa as mensagens de ambiguidade/erro por categoria de falha (determinístico).
 */
export function agruparPadroesFalha(
  ambiguidades: ItemAmbiguidade[],
  maxExemplos = 3,
): GrupoFalha[] {
  const mapa = new Map<CategoriaFalha, { total: number; exemplos: { texto: string; total: number }[] }>();

  for (const item of ambiguidades ?? []) {
    const cat = categorizarFalha(item);
    const atual = mapa.get(cat) ?? { total: 0, exemplos: [] };
    atual.total += item.total;
    atual.exemplos.push({ texto: truncar(item.texto, 80), total: item.total });
    mapa.set(cat, atual);
  }

  return [...mapa.entries()]
    .map(([categoria, v]) => ({
      categoria,
      rotulo: ROTULO_CATEGORIA[categoria],
      total: v.total,
      exemplos: v.exemplos
        .sort((a, b) => b.total - a.total)
        .slice(0, Math.max(1, maxExemplos))
        .map((e) => e.texto),
    }))
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Backlog de calibração
// ---------------------------------------------------------------------------
export type Impacto = "baixo" | "medio" | "alto";

export interface ItemBacklog {
  categoria: CategoriaFalha;
  rotulo: string;
  frequencia: number;
  impacto: Impacto;
  sugestao: string;
}

const SUGESTAO_POR_CATEGORIA: Record<CategoriaFalha, string> = {
  erro_temporal: "Revisar herança temporal e a resolução de datas relativas.",
  erro_atividade: "Ampliar o vocabulário/entidades de tratamentos e atividades.",
  pessoal_sem_identificacao: "Revisar o fluxo de identificação confiável antes de responder dados pessoais.",
  mensagem_curta_ambigua: "Reforçar a herança de contexto e os pedidos de esclarecimento em follow-ups curtos.",
  erro_digitacao: "Expandir a normalização de typos e o dicionário do classificador.",
  fallback_baixa_confianca: "Calibrar o limiar do classificador híbrido e os exemplos de intenção.",
  desambiguacao_publico_pessoal: "Revisar regras de escopo público × pessoal e os sinais de possessivo.",
  handoff_repetido: "Revisar regras de handoff e a retenção antes de escalar.",
  outro: "Investigar manualmente os exemplos para identificar a frente de correção.",
};

/**
 * Regra simples e previsível de impacto: combina frequência (relativa ao volume
 * recebido) com a associação a handoff/fallback. Sem score sofisticado.
 */
export function calcularImpacto(
  frequencia: number,
  totalRecebidas: number,
  associadoHandoffOuFallback: boolean,
): Impacto {
  const proporcao = totalRecebidas > 0 ? frequencia / totalRecebidas : 0;
  let nivel = 0;
  if (proporcao >= 0.1 || frequencia >= 20) nivel = 2;
  else if (proporcao >= 0.03 || frequencia >= 5) nivel = 1;
  if (associadoHandoffOuFallback) nivel += 1;
  if (nivel >= 2) return "alto";
  if (nivel === 1) return "medio";
  return "baixo";
}

const CATEGORIAS_CRITICAS: Set<CategoriaFalha> = new Set([
  "pessoal_sem_identificacao",
  "fallback_baixa_confianca",
  "handoff_repetido",
  "desambiguacao_publico_pessoal",
]);

/**
 * Gera o backlog de calibração a partir dos grupos de falha + volume do período.
 */
export function gerarBacklog(
  grupos: GrupoFalha[],
  totalRecebidas: number,
): ItemBacklog[] {
  return (grupos ?? [])
    .filter((g) => g.total > 0)
    .map((g) => ({
      categoria: g.categoria,
      rotulo: g.rotulo,
      frequencia: g.total,
      impacto: calcularImpacto(g.total, totalRecebidas, CATEGORIAS_CRITICAS.has(g.categoria)),
      sugestao: SUGESTAO_POR_CATEGORIA[g.categoria],
    }))
    .sort((a, b) => {
      const peso: Record<Impacto, number> = { alto: 3, medio: 2, baixo: 1 };
      if (peso[b.impacto] !== peso[a.impacto]) return peso[b.impacto] - peso[a.impacto];
      return b.frequencia - a.frequencia;
    });
}

// ---------------------------------------------------------------------------
// KPIs derivados (com delta vs período anterior)
// ---------------------------------------------------------------------------
export interface KpiResumo {
  mensagens: Delta;
  pctHandoff: Delta;
  pctSemFallback: Delta;
  pctHibrido: Delta;
  respostasComLlm: Delta;
}

export function montarKpis(
  atual: MetricasIaWhatsapp,
  anterior?: MetricasIaWhatsapp | null,
): KpiResumo {
  const a = anterior;
  return {
    mensagens: calcularDelta(atual.volume.mensagens_recebidas, a?.volume.mensagens_recebidas ?? 0),
    pctHandoff: calcularDelta(atual.handoff.pct_sobre_mensagens, a?.handoff.pct_sobre_mensagens ?? 0),
    pctSemFallback: calcularDelta(atual.classificacao.pct_sem_fallback, a?.classificacao.pct_sem_fallback ?? 0),
    pctHibrido: calcularDelta(atual.hibrido.pct_sobre_total, a?.hibrido.pct_sobre_total ?? 0),
    respostasComLlm: calcularDelta(atual.hibrido.respostas_com_llm, a?.hibrido.respostas_com_llm ?? 0),
  };
}
