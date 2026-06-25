import { describe, it, expect, afterAll } from "vitest";
import { HAS_DB, withRollback, closePool } from "./_dbClient";
import { classificarPresenca } from "@/lib/presencaClassificacao";

/**
 * L-07 — Coerência REAL banco ↔ espelho de classificação de presença
 * (INV-PRES-001/002/003). Prova que a fonte única no banco
 * (`fn_presenca_classificacao`) e o espelho TS (`presencaClassificacao.ts`)
 * concordam — sem semântica paralela — e que `justificado` permanece
 * SOMENTE histórico no banco real.
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

d("L-07 contrato real — fn_presenca_classificacao ↔ espelho", () => {
  const statuses = ["presente", "ausente", "justificado"];

  it("banco e espelho concordam para todos os status", async () => {
    await withRollback(async (c) => {
      for (const s of statuses) {
        const r = await c.query("SELECT public.fn_presenca_classificacao($1) AS res", [s]);
        const db = r.rows[0].res;
        const espelho = classificarPresenca(s);
        expect(db.conta_presenca, `conta_presenca ${s}`).toBe(espelho.contaPresenca);
        expect(db.conta_ausencia, `conta_ausencia ${s}`).toBe(espelho.contaAusencia);
        expect(db.dispara_remarcacao, `dispara_remarcacao ${s}`).toBe(espelho.disparaRemarcacao);
        expect(db.avanca_sessao, `avanca_sessao ${s}`).toBe(espelho.avancaSessao);
        expect(db.somente_historico, `somente_historico ${s}`).toBe(espelho.somenteHistorico);
      }
    });
  });

  it("justificado é somente histórico (sem efeito operacional) no banco", async () => {
    await withRollback(async (c) => {
      const r = await c.query("SELECT public.fn_presenca_classificacao('justificado') AS res");
      const db = r.rows[0].res;
      expect(db.somente_historico).toBe(true);
      expect(db.conta_presenca).toBe(false);
      expect(db.conta_ausencia).toBe(false);
      expect(db.dispara_remarcacao).toBe(false);
      expect(db.avanca_sessao).toBe(false);
    });
  });
});
