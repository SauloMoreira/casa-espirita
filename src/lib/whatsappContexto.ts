// ============================================================================
// FASE 1 — Memória curta da conversa + Resolução temporal explícita
// ----------------------------------------------------------------------------
// Camadas DETERMINÍSTICAS (custo zero, sem LLM) que rodam ANTES da consulta às
// fontes. Compartilhado entre a edge function `whatsapp-inbound` e os testes,
// para que as regras de tempo/contexto sejam verificáveis isoladamente.
//
// Regras implementadas (ver .lovable/plan.md):
//  - Seção 4: resolução temporal explícita (dias e intervalos).
//  - Seção 9: herança de contexto com limite (janela de 10 min, último turno).
//  - Seção 12: memória curta resumida (máx. 4 turnos, ~120 chars cada).
// ============================================================================

import { normalizarTexto } from "./whatsappInbound";

// ===================== TIPOS =====================

export type Escopo = "publico" | "pessoal" | "geral";

/** Um turno resumido da conversa (papel + texto curto + timestamp ISO). */
export interface TurnoResumo {
  papel: "user" | "ia";
  resumo: string;
  em: string; // ISO timestamp
}

/** Estado estruturado e curto da conversa, persistido em whatsapp_conversas.contexto_conversa. */
export interface ContextoConversa {
  assunto_atual?: string | null;
  entidade_atual?: string | null;
  referencia_temporal?: string | null; // ISO date (YYYY-MM-DD)
  escopo?: Escopo | null;
  assistido_identificado?: boolean;
  assistido_id?: string | null;
  ultimos_turnos?: TurnoResumo[];
}

// ===================== RESOLUÇÃO TEMPORAL (Seção 4) =====================

export interface AlvoTempoResolvido {
  tipo: "dia" | "intervalo";
  inicio: string; // ISO YYYY-MM-DD
  fim: string; // ISO YYYY-MM-DD (igual a inicio quando tipo = "dia")
  diasSemana: number[]; // dias da semana cobertos (0=domingo..6=sábado)
  label: string; // rótulo humano ("hoje", "amanhã", "neste fim de semana"...)
  origem: "explicito" | "herdado" | "default_hoje";
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3,
  quinta: 4, sexta: 5, sabado: 6,
};

const NOME_DIA: Record<number, string> = {
  0: "domingo", 1: "segunda-feira", 2: "terça-feira", 3: "quarta-feira",
  4: "quinta-feira", 5: "sexta-feira", 6: "sábado",
};

/** Soma `offset` dias a uma data ISO (meio-dia UTC, defensivo contra fuso). */
function addDias(baseIso: string, offset: number): { iso: string; dow: number } {
  const d = new Date(baseIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
}

function diaUTC(baseIso: string): number {
  return new Date(baseIso + "T12:00:00Z").getUTCDay();
}

function mkDia(baseIso: string, offset: number, label: string,
  origem: AlvoTempoResolvido["origem"]): AlvoTempoResolvido {
  const { iso, dow } = addDias(baseIso, offset);
  return { tipo: "dia", inicio: iso, fim: iso, diasSemana: [dow], label, origem };
}

/** Lista os dias-da-semana cobertos por um intervalo [inicioIso, fimIso]. */
function diasSemanaRange(inicioIso: string, fimIso: string): number[] {
  const dias: number[] = [];
  let cur = inicioIso;
  for (let i = 0; i < 14 && cur <= fimIso; i++) {
    const { iso, dow } = addDias(cur, 0);
    dias.push(dow);
    cur = addDias(iso, 1).iso;
  }
  return dias;
}

/**
 * Resolução temporal explícita. Devolve SEMPRE um alvo concreto (dia ou
 * intervalo) a partir da mensagem atual; quando a mensagem não tem marcador
 * temporal, herda `contexto.referencia_temporal` (Seção 9) e, em último caso,
 * usa o dia de hoje.
 */
export function resolverTempo(
  texto: string,
  contexto: ContextoConversa | null | undefined,
  baseIso: string,
): AlvoTempoResolvido {
  const txt = normalizarTexto(texto);

  // --- Intervalos ---
  if (txt.includes("fim de semana") || txt.includes("final de semana")) {
    // Próximo sábado e domingo (se hoje já é sáb/dom, usa o atual).
    const hojeDow = diaUTC(baseIso);
    const offSab = (6 - hojeDow + 7) % 7;
    const sab = addDias(baseIso, offSab);
    const dom = addDias(sab.iso, 1);
    return {
      tipo: "intervalo", inicio: sab.iso, fim: dom.iso,
      diasSemana: [6, 0], label: "neste fim de semana", origem: "explicito",
    };
  }
  if (txt.includes("essa semana") || txt.includes("esta semana") || txt.includes("nesta semana")) {
    const hojeDow = diaUTC(baseIso);
    const offDom = (0 - hojeDow + 7) % 7; // próximo domingo (fecha a semana)
    const fim = addDias(baseIso, offDom === 0 ? 0 : offDom);
    return {
      tipo: "intervalo", inicio: baseIso, fim: fim.iso,
      diasSemana: diasSemanaRange(baseIso, fim.iso), label: "esta semana", origem: "explicito",
    };
  }

  // --- Dias relativos ---
  if (txt.includes("depois de amanha")) return mkDia(baseIso, 2, "depois de amanhã", "explicito");
  if (txt.includes("amanha")) return mkDia(baseIso, 1, "amanhã", "explicito");
  if (txt.includes("hoje")) return mkDia(baseIso, 0, "hoje", "explicito");

  // --- Dias da semana nomeados ---
  for (const [nome, dow] of Object.entries(DIAS_SEMANA)) {
    if (txt.includes(nome)) {
      let offset = (dow - diaUTC(baseIso) + 7) % 7;
      const querProxima = txt.includes("proxima") || txt.includes("proximo") || txt.includes("que vem");
      // Se o dia cair hoje e a pessoa pediu "próxima", pula para a semana seguinte.
      if (offset === 0 && querProxima) offset = 7;
      return mkDia(baseIso, offset, NOME_DIA[dow], "explicito");
    }
  }

  // --- Sem marcador: herda contexto (Seção 9) ---
  const herdado = contexto?.referencia_temporal;
  if (herdado && /^\d{4}-\d{2}-\d{2}$/.test(herdado) && herdado >= baseIso) {
    const dow = diaUTC(herdado);
    const diff = Math.round(
      (new Date(herdado + "T12:00:00Z").getTime() - new Date(baseIso + "T12:00:00Z").getTime()) / 86400000,
    );
    const label = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff === 2 ? "depois de amanhã" : NOME_DIA[dow];
    return { tipo: "dia", inicio: herdado, fim: herdado, diasSemana: [dow], label, origem: "herdado" };
  }

  // --- Default: hoje ---
  return mkDia(baseIso, 0, "hoje", "default_hoje");
}

/** True quando a mensagem carrega um marcador temporal explícito. */
export function temMarcadorTemporal(texto: string): boolean {
  const txt = normalizarTexto(texto);
  if (/hoje|amanha|depois de amanha/.test(txt)) return true;
  if (/fim de semana|final de semana|essa semana|esta semana|nesta semana/.test(txt)) return true;
  for (const nome of Object.keys(DIAS_SEMANA)) if (txt.includes(nome)) return true;
  return false;
}

// ===================== MEMÓRIA CURTA RESUMIDA (Seção 12) =====================

export const MAX_TURNOS = 4;
export const MAX_CHARS_TURNO = 120;

/** Resume um turno de forma determinística (corta a ~120 chars, mantém o início). */
export function resumirTurno(papel: "user" | "ia", texto: string, em: string): TurnoResumo {
  const limpo = (texto || "").replace(/\s+/g, " ").trim();
  const resumo = limpo.length > MAX_CHARS_TURNO ? limpo.slice(0, MAX_CHARS_TURNO - 1) + "…" : limpo;
  return { papel, resumo, em };
}

/**
 * Acrescenta um turno à memória curta, mantendo no máximo MAX_TURNOS (FIFO).
 * Nunca usa LLM — apenas truncamento e descarte do mais antigo.
 */
export function adicionarTurno(
  turnos: TurnoResumo[] | null | undefined,
  novo: TurnoResumo,
): TurnoResumo[] {
  const base = Array.isArray(turnos) ? [...turnos] : [];
  base.push(novo);
  return base.slice(-MAX_TURNOS);
}

// ===================== HERANÇA DE CONTEXTO COM LIMITE (Seção 9) =====================

export const JANELA_HERANCA_MIN = 10;

/** True quando o último turno é recente o bastante para herdar contexto. */
export function contextoHerdavel(
  ultimoContatoIso: string | null | undefined,
  agoraMs: number = Date.now(),
  janelaMin = JANELA_HERANCA_MIN,
): boolean {
  if (!ultimoContatoIso) return false;
  const t = new Date(ultimoContatoIso).getTime();
  if (isNaN(t)) return false;
  const diffMin = (agoraMs - t) / 60000;
  return diffMin >= 0 && diffMin <= janelaMin;
}

/** Detecta uma mensagem curta/elíptica do tipo follow-up ("e domingo?", "e a desobsessão?"). */
export function ehFollowUpCurto(texto: string): boolean {
  const txt = normalizarTexto(texto);
  if (!txt) return false;
  // Começa com "e " (e domingo? / e a desobsessão? / e eu?) ou é muito curta.
  if (/^e\s+/.test(txt)) return true;
  const palavras = txt.split(" ").filter(Boolean);
  return palavras.length <= 3;
}
