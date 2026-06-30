import { describe, it, expect, afterAll } from "vitest";
import { HAS_DB, withRollback, closePool } from "./_dbClient";
import {
  NOTIF_STATUS_VALORES,
  NOTIF_CANAL_VALORES,
  NOTIF_EVENTO,
} from "@/constants/notificacoes";
import { type StatusAviso } from "@/services/avisos/avisosAusenciaService";

/**
 * Q1-B3 — Paridade REAL dos status operacionais remanescentes (requer banco).
 *
 * Confronta enums (`notif_status`, `notif_evento`, `notif_canal`) em pg_enum e o
 * CHECK de `avisos_ausencia.status` (via pg_get_constraintdef) — fonte da
 * verdade — contra os espelhos TS canônicos do Q1-B3. Somente leitura: não
 * altera função, RLS, grants nem comportamento. Roda em `npm run test:db`.
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

async function enumValues(c: import("pg").PoolClient, name: string): Promise<string[]> {
  const r = await c.query(
    `SELECT e.enumlabel AS v
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = $1
      ORDER BY e.enumsortorder`,
    [name],
  );
  return r.rows.map((row) => row.v as string);
}

d("Q1-B3 contrato real — paridade DB × TS", () => {
  it("notif_status (pg_enum) == NOTIF_STATUS (TS)", async () => {
    await withRollback(async (c) => {
      const db = await enumValues(c, "notif_status");
      expect(new Set(db)).toEqual(new Set(NOTIF_STATUS_VALORES));
    });
  });

  it("notif_canal (pg_enum) == NOTIF_CANAL (TS)", async () => {
    await withRollback(async (c) => {
      const db = await enumValues(c, "notif_canal");
      expect(new Set(db)).toEqual(new Set(NOTIF_CANAL_VALORES));
    });
  });

  it("notif_evento (pg_enum) == NOTIF_EVENTO (TS, inclui aviso_ausencia_recebido)", async () => {
    await withRollback(async (c) => {
      const db = await enumValues(c, "notif_evento");
      expect(new Set(db)).toEqual(new Set(NOTIF_EVENTO));
      expect(db).toContain("aviso_ausencia_recebido");
    });
  });

  it("avisos_ausencia.status (CHECK) == StatusAviso (TS)", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conname = 'avisos_ausencia_status_check'`,
      );
      const def = (r.rows[0]?.def ?? "") as string;
      const valores = (def.match(/'([a-z_]+)'::text/g) ?? []).map((m) =>
        m.replace(/'::text/, "").replace(/'/g, ""),
      );
      const espelho: StatusAviso[] = ["aberto", "em_tratamento", "resolvido", "descartado"];
      expect(new Set(valores)).toEqual(new Set(espelho));
    });
  });
});
