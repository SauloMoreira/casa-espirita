import { addDays, addWeeks, addMonths, getDay, startOfDay, format } from "date-fns";
import type { SessaoGerada } from "@/types/fazerEntrevista";

/**
 * Pure function: generates session dates for a treatment given its cadence.
 * Behavior preserved 1:1 from the original FazerEntrevista implementation.
 */
export function generateSessionDates(
  dataEntrevista: Date,
  diaSemana: number | null,
  horario: string | null,
  freqValor: number,
  freqUnidade: string,
  quantidade: number
): SessaoGerada[] {
  const sessions: SessaoGerada[] = [];
  let cursor: Date;

  if (diaSemana !== null) {
    const entDay = getDay(dataEntrevista);
    if (entDay === diaSemana) {
      cursor = startOfDay(dataEntrevista);
      if (horario) {
        const [h, m] = horario.split(":").map(Number);
        const treatmentTime = new Date(dataEntrevista);
        treatmentTime.setHours(h, m, 0, 0);
        if (dataEntrevista > treatmentTime) {
          if (freqUnidade === "semanas") cursor = addWeeks(cursor, freqValor);
          else if (freqUnidade === "meses") cursor = addMonths(cursor, freqValor);
          else cursor = addDays(cursor, freqValor);
        }
      }
    } else {
      let diff = diaSemana - entDay;
      if (diff <= 0) diff += 7;
      cursor = addDays(startOfDay(dataEntrevista), diff);
    }
  } else {
    cursor = addDays(startOfDay(dataEntrevista), 1);
  }

  for (let i = 0; i < quantidade; i++) {
    sessions.push({
      data_sessao: format(cursor, "yyyy-MM-dd"),
      horario: horario || null,
    });

    if (freqUnidade === "semanas") {
      cursor = addWeeks(cursor, freqValor);
    } else if (freqUnidade === "meses") {
      cursor = addMonths(cursor, freqValor);
    } else {
      cursor = addDays(cursor, freqValor);
    }
  }

  return sessions;
}

/**
 * Resolves valid designations from the quantities map, applying default
 * session quantities when the interviewer leaves the field blank.
 */
export function buildValidDesignacoes(
  quantidades: Record<string, string>,
  tratamentoMap: Record<string, { quantidade_padrao_sessoes: number }>
): { tratamento_id: string; quantidade_total: number }[] {
  const valid: { tratamento_id: string; quantidade_total: number }[] = [];
  for (const [tid, qtyStr] of Object.entries(quantidades)) {
    const trat = tratamentoMap[tid];
    if (!trat) continue;
    const parsedQty = qtyStr ? parseInt(qtyStr) : 0;
    const effectiveQty = parsedQty > 0 ? parsedQty : trat.quantidade_padrao_sessoes;
    if (effectiveQty > 0) {
      valid.push({ tratamento_id: tid, quantidade_total: effectiveQty });
    }
  }
  return valid;
}
