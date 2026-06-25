import { describe, it, expect, afterAll } from "vitest";
import {
  HAS_DB,
  withRollback,
  actAs,
  getUserByRole,
  getAnyAssistido,
  getAssistidoTratamento,
  closePool,
} from "./_dbClient";

/**
 * L-07 — Auditoria REAL (INV-ARQ-003, INV-PRES-003, INV-GOV-002).
 *
 * Prova que ações críticas deixam trilha suficiente no banco: quem, quando,
 * antes/depois (quando aplicável) e vínculo com a entidade correta.
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

d("L-07 auditoria real — parâmetro governado", () => {
  it("alterar parâmetro grava audit_logs com autor e antes/depois", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      await actAs(c, admin!);
      const FLAG = "entrevista_confirmacao_agendamento_ativa";
      const antes = await c.query("SELECT valor FROM regras_operacionais WHERE chave=$1", [FLAG]);
      const novo = antes.rows[0].valor === "true" ? "false" : "true";
      await c.query("SELECT public.fn_atualizar_parametro_operacional($1,$2,'itest audit')", [FLAG, novo]);
      const log = await c.query(
        `SELECT user_id, acao, dados_anteriores, dados_novos
           FROM audit_logs
          WHERE tabela='regras_operacionais'
          ORDER BY created_at DESC LIMIT 1`,
      );
      expect(log.rowCount).toBeGreaterThan(0);
      expect(log.rows[0].user_id).toBe(admin);
      expect(log.rows[0].dados_anteriores.valor).toBe(antes.rows[0].valor);
      expect(log.rows[0].dados_novos.valor).toBe(novo);
    });
  });
});

d("L-07 auditoria real — presença (INV-PRES-003)", () => {
  it("registrar presença dispara trg_audit_presencas com vínculo correto", async () => {
    await withRollback(async (c) => {
      const tarefeiro = await getUserByRole(c, "tarefeiro");
      const at = await getAssistidoTratamento(c);
      expect(at).toBeTruthy();
      await actAs(c, tarefeiro!);
      const ins = await c.query(
        `INSERT INTO presencas_tratamentos (assistido_tratamento_id, data, status_presenca, registrado_por)
         VALUES ($1, date '2099-01-15', 'presente', $2) RETURNING id`,
        [at, tarefeiro],
      );
      const presencaId = ins.rows[0].id;
      const log = await c.query(
        `SELECT user_id, acao, registro_id, dados_novos
           FROM audit_logs WHERE tabela='presencas_tratamentos' AND registro_id=$1
          ORDER BY created_at DESC LIMIT 1`,
        [presencaId],
      );
      expect(log.rowCount).toBe(1);
      expect(log.rows[0].acao).toBe("INSERT");
      expect(log.rows[0].user_id).toBe(tarefeiro);
      expect(log.rows[0].dados_novos.status_presenca).toBe("presente");
    });
  });
});

d("L-07 auditoria real — entrevista", () => {
  it("INSERT de entrevista grava trilha em audit_logs", async () => {
    await withRollback(async (c) => {
      const entrevistador = await getUserByRole(c, "entrevistador");
      const assistido = await getAnyAssistido(c);
      await actAs(c, entrevistador!);
      const ins = await c.query(
        `INSERT INTO entrevistas_fraternas (assistido_id, entrevistador_id, data, status)
         VALUES ($1,$2, now()+interval '7 days', 'agendada') RETURNING id`,
        [assistido, entrevistador],
      );
      const log = await c.query(
        `SELECT acao, registro_id FROM audit_logs
          WHERE tabela='entrevistas_fraternas' AND registro_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [ins.rows[0].id],
      );
      expect(log.rowCount).toBe(1);
      expect(log.rows[0].acao).toBe("INSERT");
    });
  });
});
