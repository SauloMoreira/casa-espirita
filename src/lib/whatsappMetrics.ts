// Pure helpers for the WhatsApp metrics panel. No side-effects, fully testable.

export function pct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Taxa de sucesso de envio = enviadas / geradas */
export function taxaSucesso(enviadas: number, geradas: number): number {
  return pct(enviadas, geradas);
}

/** Taxa de resposta = inbound / enviadas */
export function taxaResposta(inbound: number, enviadas: number): number {
  return pct(inbound, enviadas);
}

/** Taxa de opt-out = opt-outs / assistidos impactados */
export function taxaOptOut(optouts: number, assistidosImpactados: number): number {
  return pct(optouts, assistidosImpactados);
}

/** Taxa de handoff = handoffs / inbound */
export function taxaHandoff(handoffs: number, inbound: number): number {
  return pct(handoffs, inbound);
}

/** Redução de faltas = (antes - depois) / antes (em %) */
export function reducaoFaltas(faltasAntes: number, faltasDepois: number): number {
  if (!faltasAntes || faltasAntes <= 0) return 0;
  return Math.round(((faltasAntes - faltasDepois) / faltasAntes) * 100);
}

/** Comparecimento após lembrete = comparecimentos com lembrete / total analisado */
export function comparecimentoAposLembrete(comparecimentos: number, totalAnalisado: number): number {
  return pct(comparecimentos, totalAnalisado);
}

/** Formata segundos em texto curto legível (s / min / h). */
export function formatDuracao(segundos?: number | null): string {
  const s = Math.round(segundos ?? 0);
  if (s <= 0) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

/** Constrói uma linha CSV escapando aspas e separadores. */
export function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",;\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Monta um CSV (separador ;) a partir de cabeçalhos e linhas. */
export function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const head = headers.map(csvCell).join(";");
  const body = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  return body ? `${head}\n${body}` : head;
}

/** Dispara o download de um CSV no browser (BOM para Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TIPO_LABELS: Record<string, string> = {
  entrevista_agendada: "Entrevista agendada",
  entrevista_lembrete: "Lembrete de entrevista",
  sessao_agendada: "Sessão agendada",
  sessao_lembrete: "Lembrete de sessão",
  remarcacao: "Remarcação",
  cancelamento: "Cancelamento",
};

export const EVENTO_LABELS: Record<string, string> = {
  entrevista_criada: "Entrevista criada",
  entrevista_lembrete: "Lembrete de entrevista",
  sessao_criada: "Sessão criada",
  sessao_lembrete: "Lembrete de sessão",
  remarcacao: "Remarcação",
  cancelamento: "Cancelamento",
};

export const INTENT_LABELS: Record<string, string> = {
  proxima_sessao: "Próxima sessão",
  horario_entrevista: "Horário entrevista",
  confirmacao_agendamento: "Confirmação",
  onde_ver_app: "Onde ver no app",
  opt_out: "Opt-out",
  reativar: "Reativar",
  complexo: "Atendimento humano",
  desconhecido: "Desconhecido",
};

export function tipoLabel(code?: string | null): string {
  if (!code) return "—";
  return TIPO_LABELS[code] || code;
}

export function intentLabel(code?: string | null): string {
  if (!code) return "—";
  return INTENT_LABELS[code] || code;
}
