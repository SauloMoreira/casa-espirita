// ============================================================================
// Etapa 4 — Atuação (catálogo único de funções operacionais).
//
// "Atuação" é a CAMADA OPERACIONAL: o que a pessoa FAZ na casa (tipos de
// voluntariado + funções do catálogo `funcoes_voluntariado`). É independente de
// "Acesso" (permissão do sistema em `user_roles`).
//
// REGRAS INVIOLÁVEIS (INV-ATU-*):
//  - Atuação NUNCA altera user_roles (sem concessão automática cruzada).
//  - Divergência entre atuação e acesso gera ALERTA DE COERÊNCIA, jamais
//    concessão silenciosa de acesso.
//  - O catálogo de tipos de atuação é fonte única (não duplicar em telas).
//
// Este módulo é puro e testável; espelha o domínio para dar feedback na UI.
// ============================================================================

import type { AppRole } from "@/constants/roles";
import { getRoleLabel } from "@/constants/roles";

/** Catálogo único de tipos de atuação (voluntariado). Fonte de verdade. */
export const ATUACAO_TIPOS = ["Médium", "Tarefeiro"] as const;
export type AtuacaoTipo = (typeof ATUACAO_TIPOS)[number];

/**
 * Rótulos que separam explicitamente as duas camadas na UI.
 * Acesso = permissão do sistema. Atuação = papel operacional/domínio.
 */
export const CAMADA_LABELS = {
  acesso: {
    titulo: "Acesso",
    descricao: "Permissão do sistema (gerida em Gestão de Acesso).",
  },
  atuacao: {
    titulo: "Atuação",
    descricao: "O que a pessoa faz na casa (tipo e funções de voluntariado).",
  },
} as const;

/**
 * Relação INFORMATIVA entre um tipo de atuação e o acesso operacional que
 * normalmente o acompanha. NÃO é uma regra de concessão — apenas referência
 * para alertas de coerência. Um tipo sem mapeamento não sugere acesso algum.
 */
const ATUACAO_ACESSO_SUGERIDO: Partial<Record<AtuacaoTipo, AppRole>> = {
  Tarefeiro: "tarefeiro",
};

export type CoerenciaSeveridade = "info" | "atencao";

export interface CoerenciaAlerta {
  tipo: AtuacaoTipo;
  acessoSugerido?: AppRole;
  severidade: CoerenciaSeveridade;
  mensagem: string;
}

/**
 * Verifica a COERÊNCIA entre a atuação (tipos de voluntariado) e o acesso real
 * (papéis em user_roles). Retorna apenas ALERTAS — nunca muta nada.
 *
 * Caso atual coberto: pessoa atua como "Tarefeiro" mas não possui o acesso
 * operacional `tarefeiro`. O alerta é consultivo; a concessão de acesso, se
 * desejada, é decisão manual exclusiva da Gestão de Acesso.
 */
export function verificarCoerenciaAtuacaoAcesso(
  tipos: readonly string[] | null | undefined,
  accessRoles: readonly (AppRole | string)[] | null | undefined,
): CoerenciaAlerta[] {
  const tiposSet = new Set((tipos ?? []).map((t) => t.trim()));
  const roles = new Set((accessRoles ?? []).map((r) => String(r)));
  const alertas: CoerenciaAlerta[] = [];

  for (const tipo of ATUACAO_TIPOS) {
    if (!tiposSet.has(tipo)) continue;
    const sugerido = ATUACAO_ACESSO_SUGERIDO[tipo];
    if (sugerido && !roles.has(sugerido)) {
      alertas.push({
        tipo,
        acessoSugerido: sugerido,
        severidade: "atencao",
        mensagem:
          `Atua como "${tipo}" mas não possui o acesso operacional ` +
          `"${getRoleLabel(sugerido)}". A atuação não concede acesso — ` +
          `conceda manualmente em Gestão de Acesso, se aplicável.`,
      });
    }
  }

  return alertas;
}

/** Conveniência: há alguma divergência de coerência? */
export function temDivergenciaCoerencia(
  tipos: readonly string[] | null | undefined,
  accessRoles: readonly (AppRole | string)[] | null | undefined,
): boolean {
  return verificarCoerenciaAtuacaoAcesso(tipos, accessRoles).length > 0;
}
