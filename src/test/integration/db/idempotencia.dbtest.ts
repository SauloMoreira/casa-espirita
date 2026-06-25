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
 * L-07 — Idempotência REAL (INV-SEG-003, INV-FILA-001/002).
 *
 * Executar o mesmo efeito duas vezes não pode duplicar envio, cancelamento ou
 * remarcação, nem criar estado inconsistente. Prova a barreira `dedupe_key`
 * (ON CONFLICT DO NOTHING) e a idempotência do trigger de remarcação.
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

d("L-07 idempotência real — fila/dedupe", () => {
  it("mesmo dedupe_key enfileirado duas vezes gera UM único item", async () => {
    await withRollback(async (c) => {
      const assistido = await getAnyAssistido(c);
      const dedupe = "itest-idem:fixo-001";
      const enqueue = () =>
        c.query(
          `SELECT public.fn_enqueue_notificacao('entrevista_lembrete'::notif_evento, $1, 'entrevista_lembrete',
             '{}'::jsonb, now() + interval '2 days', $2)`,
          [assistido, dedupe],
        );
      await enqueue();
      await enqueue();
      const r = await c.query("SELECT count(*)::int n FROM notificacoes_fila WHERE dedupe_key=$1", [
        dedupe,
      ]);
      expect(r.rows[0].n).toBe(1);
    });
  });

  it("remarcação para a MESMA data não reprocessa (sem duplicar)", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      const entrevistador = await getUserByRole(c, "entrevistador");
      const assistido = await getAnyAssistido(c);
      await actAs(c, admin!);
      await c.query(
        "SELECT public.fn_atualizar_parametro_operacional('entrevista_confirmacao_agendamento_ativa','true','itest')",
      );
      const ins = await c.query(
        `INSERT INTO entrevistas_fraternas (assistido_id, entrevistador_id, data, status)
         VALUES ($1,$2, now()+interval '10 days','agendada') RETURNING id`,
        [assistido, entrevistador],
      );
      const id = ins.rows[0].id;
      const countFila = async () =>
        (
          await c.query(
            "SELECT count(*)::int n FROM notificacoes_fila WHERE split_part(dedupe_key,':',2)=$1",
            [id],
          )
        ).rows[0].n as number;
      const base = await countFila();
      // "Atualiza" sem mudar a data nem o status → trigger não deve enfileirar nada.
      await c.query("UPDATE entrevistas_fraternas SET observacoes='nota' WHERE id=$1", [id]);
      expect(await countFila()).toBe(base);
    });
  });
});

d("L-07 idempotência real — remarcação efetiva única", () => {
  it("remarcar para nova data cancela o lembrete antigo e cria só um novo", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      const entrevistador = await getUserByRole(c, "entrevistador");
      const assistido = await getAnyAssistido(c);
      await actAs(c, admin!);
      const ins = await c.query(
        `INSERT INTO entrevistas_fraternas (assistido_id, entrevistador_id, data, status)
         VALUES ($1,$2, now()+interval '10 days','agendada') RETURNING id`,
        [assistido, entrevistador],
      );
      const id = ins.rows[0].id;
      await c.query("UPDATE entrevistas_fraternas SET data = now()+interval '12 days' WHERE id=$1", [id]);
      const lembretes = await c.query(
        `SELECT status FROM notificacoes_fila
          WHERE split_part(dedupe_key,':',2)=$1 AND evento_origem='entrevista_lembrete'`,
        [id],
      );
      const ativos = lembretes.rows.filter((r) => r.status === "pendente" || r.status === "agendado");
      // Exatamente um lembrete vivo após a remarcação (os anteriores ficam cancelados).
      expect(ativos.length).toBe(1);
    });
  });
});
