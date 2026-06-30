import { describe, it, expect, afterAll } from "vitest";
import { HAS_DB, withRollback, closePool } from "./_dbClient";
import { ENTREVISTA_STATUS, VINCULO_STATUS } from "@/constants/status";

/**
 * Q1-B2 — Paridade REAL dos contratos de status × CHECK constraints (banco vivo).
 *
 * Lê o conjunto de valores aceitos diretamente do `CHECK` real em
 * `pg_constraint` (fonte de verdade) e confronta com as constantes canônicas TS.
 * Roda apenas em `npm run test:db` — fora do CI puro.
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

/** Extrai os literais aceitos por um CHECK de status (ANY ('a','b',...)). */
async function checkValues(
  c: import("pg").PoolClient,
  constraintName: string,
): Promise<string[]> {
  const r = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = $1`,
    [constraintName],
  );
  const def: string = r.rows[0]?.def ?? "";
  const literals = def.match(/'([^']+)'/g) ?? [];
  return literals.map((s) => s.slice(1, -1));
}

d("Q1-B2 contrato real — paridade de status DB × TS", () => {
  it("entrevistas_fraternas_status_check == ENTREVISTA_STATUS (TS)", async () => {
    await withRollback(async (c) => {
      const db = await checkValues(c, "entrevistas_fraternas_status_check");
      expect(new Set(db)).toEqual(new Set(Object.values(ENTREVISTA_STATUS)));
    });
  });

  it("assistido_tratamentos_status_check == VINCULO_STATUS (TS)", async () => {
    await withRollback(async (c) => {
      const db = await checkValues(c, "assistido_tratamentos_status_check");
      expect(new Set(db)).toEqual(new Set(Object.values(VINCULO_STATUS)));
    });
  });
});
