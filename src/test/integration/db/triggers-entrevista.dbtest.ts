import { describe, it, expect, afterAll } from "vitest";
import {
  HAS_DB,
  withRollback,
  actAs,
  getUserByRole,
  getAnyAssistido,
  closePool,
} from "./_dbClient";

/**
 * L-07 — Efeito REAL do trigger de entrevista governado pela flag (caso B).
 *
 * Prova, no banco real, o contrato de `fn_confirmacao_entrevista_ativa` e o
 * trigger `trg_notif_entrevista`:
 *   - flag ON  → `entrevista_criada` é enfileirada no INSERT;
 *   - flag OFF → confirmação imediata NÃO entra;
 *   - lembrete de 24h SEMPRE entra (date-only, sem horário fantasma).
 * Invariantes: INV-FILA-005, INV-GOV-001, INV-TEMPO-001..003.
 */
const d = HAS_DB ? describe : describe.skip;
const FLAG = "entrevista_confirmacao_agendamento_ativa";

afterAll(async () => {
  await closePool();
});

async function inserirEntrevista(c: import("pg").PoolClient) {
  const assistido = await getAnyAssistido(c);
  const entrevistador = await getUserByRole(c, "entrevistador");
  const r = await c.query(
    `INSERT INTO entrevistas_fraternas (assistido_id, entrevistador_id, data, status)
     VALUES ($1, $2, now() + interval '5 days', 'agendada') RETURNING id`,
    [assistido, entrevistador],
  );
  return r.rows[0].id as string;
}

async function filaDaEntrevista(c: import("pg").PoolClient, id: string) {
  const r = await c.query(
    `SELECT evento_origem, scheduled_at, dedupe_key
       FROM notificacoes_fila
      WHERE split_part(dedupe_key, ':', 2) = $1
      ORDER BY evento_origem`,
    [id],
  );
  return r.rows as { evento_origem: string; scheduled_at: string; dedupe_key: string }[];
}

d("L-07 trigger real — entrevista governada (caso B)", () => {
  it("flag ON: entrevista_criada + entrevista_lembrete são enfileiradas", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      await actAs(c, admin!);
      await c.query("SELECT public.fn_atualizar_parametro_operacional($1,'true','itest ON')", [FLAG]);
      const id = await inserirEntrevista(c);
      const eventos = (await filaDaEntrevista(c, id)).map((r) => r.evento_origem);
      expect(eventos).toContain("entrevista_criada");
      expect(eventos).toContain("entrevista_lembrete");
    });
  });

  it("flag OFF: confirmação imediata NÃO entra, mas lembrete continua", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      await actAs(c, admin!);
      await c.query("SELECT public.fn_atualizar_parametro_operacional($1,'false','itest OFF')", [FLAG]);
      const id = await inserirEntrevista(c);
      const eventos = (await filaDaEntrevista(c, id)).map((r) => r.evento_origem);
      expect(eventos).not.toContain("entrevista_criada");
      expect(eventos).toContain("entrevista_lembrete");
    });
  });

  it("lembrete agenda 24h antes da data (sem deslocar dia / sem horário fantasma)", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      await actAs(c, admin!);
      await c.query("SELECT public.fn_atualizar_parametro_operacional($1,'true','itest tempo')", [FLAG]);
      const id = await inserirEntrevista(c);
      const r = await c.query(
        `SELECT data FROM entrevistas_fraternas WHERE id=$1`,
        [id],
      );
      const dataEntrevista = new Date(r.rows[0].data).getTime();
      const lembrete = (await filaDaEntrevista(c, id)).find(
        (x) => x.evento_origem === "entrevista_lembrete",
      );
      expect(lembrete).toBeTruthy();
      const sched = new Date(lembrete!.scheduled_at).getTime();
      // exatamente 24h antes (tolerância de 1 minuto)
      expect(Math.abs(dataEntrevista - sched - 24 * 3600 * 1000)).toBeLessThan(60 * 1000);
    });
  });
});
