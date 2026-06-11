// ============================================================================
// Tipos compartilhados dos relatórios pesados (agregação server-side + paginação real).
// ============================================================================

/** Filtros comuns aos relatórios de presença/faltas. */
export interface RelatorioPresencaFiltros {
  dataInicio: string;
  dataFim: string;
  tratamentoId?: string | null;
  assistidoId?: string | null;
  tarefeiroId?: string | null;
  coordenadorId?: string | null;
}

/** Parâmetros de paginação real (server-side). */
export interface PaginacaoParams {
  page: number;
  pageSize: number;
}

/** Envelope padrão de resposta paginada com totalizadores. */
export interface PaginatedResult<TRow, TTotais> {
  rows: TRow[];
  totais: TTotais;
  /** Total de registros (linhas após filtros) — base do count real. */
  registros: number;
}

// ---- Frequência de Presença ----
export interface FrequenciaRow {
  nome: string;
  tratamento: string;
  presencas: number;
  ausencias: number;
  total: number;
  percentual: number;
}

export interface FrequenciaTotais {
  total: number;
  presencas: number;
  ausencias: number;
}

export type FrequenciaResult = PaginatedResult<FrequenciaRow, FrequenciaTotais>;

// ---- Faltas por Período ----
export interface FaltasRow {
  assistido: string;
  tratamento: string;
  totalFaltas: number;
  datasFaltas: string[];
  totalSessoes: number;
  percentual: number;
}

export interface FaltasTotais {
  totalFaltas: number;
  assistidosComFalta: number;
  pctMedio: number;
  vinculosComFalta: number;
}

export type FaltasResult = PaginatedResult<FaltasRow, FaltasTotais>;
