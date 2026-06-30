import { describe, it, expect } from "vitest";
import {
  ENTREVISTA_STATUS,
  VINCULO_STATUS,
} from "@/constants/status";
import { VINCULO_STATUS_RESETAVEL } from "@/constants/fazerEntrevista";

/**
 * Q1-B2 — Paridade pura (sem banco) dos contratos críticos de status.
 *
 * Trava de regressão das constantes canônicas alinhadas aos CHECK reais.
 * A paridade contra o banco vivo é validada em
 * src/test/integration/db/q1b2-status-paridade.dbtest.ts (`npm run test:db`).
 */

const ENTREVISTA_ESPERADO = ["agendada", "realizada", "cancelada", "remarcada"];

const VINCULO_ESPERADO = [
  "aguardando_inicio",
  "aguardando_liberacao",
  "aguardando_agendamento",
  "liberado",
  "em_andamento",
  "concluido",
  "suspenso",
  "cancelado",
];

describe("Q1-B2 — contratos canônicos de status", () => {
  it("ENTREVISTA_STATUS contempla exatamente os valores do CHECK", () => {
    expect(new Set(Object.values(ENTREVISTA_STATUS))).toEqual(
      new Set(ENTREVISTA_ESPERADO),
    );
  });

  it("ENTREVISTA_STATUS inclui remarcada (valor canônico)", () => {
    expect(Object.values(ENTREVISTA_STATUS)).toContain("remarcada");
  });

  it("VINCULO_STATUS reflete exatamente os 8 valores reais do CHECK", () => {
    expect(new Set(Object.values(VINCULO_STATUS))).toEqual(
      new Set(VINCULO_ESPERADO),
    );
  });

  it("VINCULO_STATUS não contém valores inventados (ativo/pausado)", () => {
    const vals = Object.values(VINCULO_STATUS) as string[];
    expect(vals).not.toContain("ativo");
    expect(vals).not.toContain("pausado");
  });

  it("VINCULO_STATUS_RESETAVEL é subconjunto de VINCULO_STATUS", () => {
    const canonicos = new Set(Object.values(VINCULO_STATUS) as string[]);
    for (const v of VINCULO_STATUS_RESETAVEL) {
      expect(canonicos.has(v)).toBe(true);
    }
  });
});
