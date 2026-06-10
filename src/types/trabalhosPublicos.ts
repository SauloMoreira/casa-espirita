/**
 * Types for the Public Works (trabalhos públicos) analytics front.
 * Everything is derived from REAL data: sessoes_publicas + checkins_publicos
 * joined to tipos_tratamento (trabalho_publico = true). No theoretical values.
 */

export type PeriodGranularity = "semana" | "mes" | "ano";

/** A single real public check-in enriched with session/treatment/demographics. */
export interface PublicCheckinRecord {
  id: string;
  sessaoId: string;
  dataSessao: string; // yyyy-MM-dd (real session date)
  tratamentoId: string;
  tratamentoNome: string;
  modoCheckin: string; // "qr" | "manual" | other
  cadastroRapido: boolean;
  faixaRaw: string | null; // raw faixa_etaria from quick registration
  assistidoId: string | null;
  dataNascimento: string | null; // from linked assistido, when available
  nome: string | null;
  celular: string | null;
}

/** Enriched record after classification (faixa resolved, novo/recorrente). */
export interface ClassifiedRecord extends PublicCheckinRecord {
  participantKey: string;
  faixa: string;
  tipoParticipante: "novo" | "recorrente";
}

export interface PublicWorksFilters {
  dataInicio: string;
  dataFim: string;
  tratamentoId: string; // "todos" | id
  faixa: string; // "todos" | label
  tipoParticipante: string; // "todos" | "novo" | "recorrente"
  modoCheckin: string; // "todos" | "qr" | "manual"
}

export interface TrabalhoStat {
  tratamentoId: string;
  tratamentoNome: string;
  participantes: number;
  presencas: number;
  sessoes: number;
  mediaPorSessao: number;
  taxaRetorno: number; // % participants with more than one participation
}

export interface FaixaStat {
  faixa: string;
  participantes: number;
  presencas: number;
  percentual: number;
}

export interface PeriodoPonto {
  periodo: string; // label/key
  presencas: number;
  participantes: number;
}

export interface ParticipanteFrequencia {
  participantKey: string;
  nome: string;
  participacoes: number;
  faixa: string;
}

export interface PublicWorksAnalytics {
  totalParticipantes: number;
  totalPresencas: number;
  totalSessoes: number;
  mediaPorSessao: number;
  novos: number;
  recorrentes: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  retornoMedio: number; // average participations per participant in period
  taxaRetornoGeral: number; // % participants with > 1 participation
  porTrabalho: TrabalhoStat[];
  porFaixa: FaixaStat[];
  topParticipantes: ParticipanteFrequencia[];
  topTrabalho: TrabalhoStat | null;
  bottomTrabalho: TrabalhoStat | null;
  topFaixa: FaixaStat | null;
  bottomFaixa: FaixaStat | null;
  insights: string[];
  filtered: ClassifiedRecord[];
}
