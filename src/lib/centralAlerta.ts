/**
 * Lógica pura (determinística) do alerta externo de fila humana da Central.
 *
 * Mantida sem dependências de I/O para ser testável e reutilizável tanto pela
 * edge function `central-fila-alerta` quanto pelos testes unitários. Nenhuma
 * destas funções altera posse de conversa nem cria claim — apenas decidem se e
 * o que alertar.
 */

export interface RegrasAlertaCentral {
  ativo: boolean;
  minutosPendencia: number;
  minPendencias: number;
  cooldownMin: number;
  pioraMinutos: number;
}

export interface FilaSnapshot {
  total_pendentes: number;
  idade_mais_antiga_min: number;
  gerado_em: string; // ISO
  motivo_disparo?: string;
}

export interface EstadoFila {
  total_pendentes: number;
  idade_mais_antiga_min: number;
}

export const REGRAS_ALERTA_DEFAULT: RegrasAlertaCentral = {
  ativo: true,
  minutosPendencia: 10,
  minPendencias: 2,
  cooldownMin: 30,
  pioraMinutos: 5,
};

/** Converte o array bruto de regras_operacionais nas regras tipadas. */
export function parseRegrasAlerta(
  rows: Array<{ chave: string; valor: string; ativo: boolean }>,
): RegrasAlertaCentral {
  const get = (chave: string): { valor: string; ativo: boolean } | undefined =>
    rows.find((r) => r.chave === chave);

  const num = (chave: string, fallback: number): number => {
    const r = get(chave);
    if (!r) return fallback;
    const n = parseInt(r.valor, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const ativoRow = get("central_alerta_ativo");
  const ativo = ativoRow ? ativoRow.valor === "true" && ativoRow.ativo : REGRAS_ALERTA_DEFAULT.ativo;

  return {
    ativo,
    minutosPendencia: num("central_alerta_minutos_pendencia", REGRAS_ALERTA_DEFAULT.minutosPendencia),
    minPendencias: num("central_alerta_min_pendencias", REGRAS_ALERTA_DEFAULT.minPendencias),
    cooldownMin: num("central_alerta_cooldown_min", REGRAS_ALERTA_DEFAULT.cooldownMin),
    pioraMinutos: num("central_alerta_piora_minutos", REGRAS_ALERTA_DEFAULT.pioraMinutos),
  };
}

export interface GatilhoResultado {
  disparar: boolean;
  /** "tempo" quando a mais antiga excede o limite; "volume" quando atingiu o nº mínimo. */
  motivo: "tempo" | "volume" | "tempo+volume" | null;
}

/**
 * Avalia se o estado atual da fila atinge o gatilho de alerta.
 * Dispara quando: idade da mais antiga > minutosPendencia OU total >= minPendencias.
 */
export function avaliarGatilho(estado: EstadoFila, regras: RegrasAlertaCentral): GatilhoResultado {
  if (!regras.ativo || estado.total_pendentes <= 0) {
    return { disparar: false, motivo: null };
  }
  const porTempo = estado.idade_mais_antiga_min > regras.minutosPendencia;
  const porVolume = estado.total_pendentes >= regras.minPendencias;

  if (!porTempo && !porVolume) return { disparar: false, motivo: null };

  const motivo =
    porTempo && porVolume ? "tempo+volume" : porTempo ? "tempo" : "volume";
  return { disparar: true, motivo };
}

/** Houve piora relevante da fila em relação ao último snapshot enviado? */
export function houvePioraRelevante(
  estado: EstadoFila,
  snapshot: FilaSnapshot | null | undefined,
  regras: RegrasAlertaCentral,
): boolean {
  if (!snapshot) return true;
  if (estado.total_pendentes > snapshot.total_pendentes) return true;
  if (estado.idade_mais_antiga_min - snapshot.idade_mais_antiga_min >= regras.pioraMinutos) {
    return true;
  }
  return false;
}

/**
 * Decide se deve enviar alerta a um comunicador, considerando cooldown e piora.
 * - Antes do cooldown: só envia se houver piora relevante.
 * - Depois do cooldown: envia se a fila continuar pendente (gatilho ativo).
 */
export function deveEnviarAlerta(params: {
  estado: EstadoFila;
  gatilho: GatilhoResultado;
  ultimoAlertaEm: string | null | undefined;
  ultimoSnapshot: FilaSnapshot | null | undefined;
  regras: RegrasAlertaCentral;
  agora?: Date;
}): boolean {
  const { estado, gatilho, ultimoAlertaEm, ultimoSnapshot, regras } = params;
  if (!gatilho.disparar) return false;

  const agora = params.agora ?? new Date();

  if (!ultimoAlertaEm) return true;

  const minutosDesdeUltimo =
    (agora.getTime() - new Date(ultimoAlertaEm).getTime()) / 60000;

  if (minutosDesdeUltimo >= regras.cooldownMin) {
    // Cooldown passou: basta a fila continuar pendente (gatilho já garante).
    return true;
  }

  // Ainda dentro do cooldown: só reenvia se piorou de forma relevante.
  return houvePioraRelevante(estado, ultimoSnapshot, regras);
}

/** Monta a mensagem consolidada e minimalista (sem dados sensíveis). */
export function montarMensagemAlerta(estado: EstadoFila): string {
  const n = estado.total_pendentes;
  const m = estado.idade_mais_antiga_min;
  const plural = n === 1 ? "conversa" : "conversas";
  const aguardando = n === 1 ? "aguardando" : "aguardando";
  return (
    `Central FER: há ${n} ${plural} ${aguardando} atendimento humano ` +
    `(mais antiga há ${m} min). Acesse a Central para assumir a fila.`
  );
}

/** Constrói o snapshot a ser persistido após o envio. */
export function construirSnapshot(
  estado: EstadoFila,
  motivo: GatilhoResultado["motivo"],
  agora?: Date,
): FilaSnapshot {
  return {
    total_pendentes: estado.total_pendentes,
    idade_mais_antiga_min: estado.idade_mais_antiga_min,
    gerado_em: (agora ?? new Date()).toISOString(),
    motivo_disparo: motivo ?? undefined,
  };
}
