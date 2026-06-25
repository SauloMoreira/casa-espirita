import { describe, it, expect, afterAll } from "vitest";
import {
  HAS_DB,
  withRollback,
  actAs,
  actAsAnon,
  getUserByRole,
  getAssistidoComTelefone,
  closePool,
} from "./_dbClient";

/**
 * L-07 — Permissão REAL no backend (INV-ARQ-004, INV-SEG-001).
 *
 * Prova, em execução real, que as funções administrativas SECURITY DEFINER
 * impõem autorização por papel via `auth.uid()` — não basta a UI esconder.
 * Cobre os casos mínimos A (parâmetro governado), C (mensagem manual) e
 * D (encerrar item por erro de cadastro).
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

d("L-07 RLS/permissão real — parâmetro governado (caso A)", () => {
  const FLAG = "entrevista_confirmacao_agendamento_ativa";

  it("perfil autorizado (admin) altera e o valor muda de fato", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      expect(admin).toBeTruthy();
      await actAs(c, admin!);
      const r = await c.query("SELECT public.fn_atualizar_parametro_operacional($1,$2,$3) AS res", [
        FLAG,
        "false",
        "itest L-07",
      ]);
      expect(r.rows[0].res.ok).toBe(true);
      const v = await c.query("SELECT valor FROM regras_operacionais WHERE chave=$1", [FLAG]);
      expect(v.rows[0].valor).toBe("false");
    });
  });

  it("perfil NÃO autorizado (assistido) é bloqueado no backend", async () => {
    await withRollback(async (c) => {
      const assistidoUser = await getUserByRole(c, "assistido");
      expect(assistidoUser).toBeTruthy();
      await actAs(c, assistidoUser!);
      await expect(
        c.query("SELECT public.fn_atualizar_parametro_operacional($1,$2,$3)", [FLAG, "false", "x"]),
      ).rejects.toThrow(/Permiss/i);
    });
  });

  it("sem sessão (anon) também é bloqueado", async () => {
    await withRollback(async (c) => {
      await actAsAnon(c);
      await expect(
        c.query("SELECT public.fn_atualizar_parametro_operacional($1,$2,$3)", [FLAG, "false", "x"]),
      ).rejects.toThrow(/Permiss/i);
    });
  });
});

d("L-07 RLS/permissão real — mensagem manual (caso C)", () => {
  it("admin enfileira pelo pipeline oficial; item rastreável", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      const assistido = await getAssistidoComTelefone(c);
      expect(assistido).toBeTruthy();
      await actAs(c, admin!);
      const r = await c.query(
        "SELECT public.fn_enfileirar_mensagem_manual($1,$2,$3) AS res",
        [assistido, "Mensagem de teste L-07", "itest"],
      );
      expect(r.rows[0].res.ok).toBe(true);
      const fila = await c.query(
        "SELECT evento_origem, status, payload_json FROM notificacoes_fila WHERE id=$1",
        [r.rows[0].res.fila_id],
      );
      expect(fila.rows[0].evento_origem).toBe("mensagem_manual");
      expect(fila.rows[0].status).toBe("pendente");
      expect(fila.rows[0].payload_json.tipo_acao).toBe("mensagem_manual");
    });
  });

  it("perfil não autorizado (tarefeiro) não consegue disparar", async () => {
    await withRollback(async (c) => {
      const tarefeiro = await getUserByRole(c, "tarefeiro");
      const assistido = await getAssistidoComTelefone(c);
      await actAs(c, tarefeiro!);
      await expect(
        c.query("SELECT public.fn_enfileirar_mensagem_manual($1,$2,$3)", [
          assistido,
          "tentativa indevida",
          null,
        ]),
      ).rejects.toThrow(/permissao_negada/);
    });
  });
});

d("L-07 RLS/permissão real — encerrar item por erro de cadastro (caso D)", () => {
  it("só admin encerra; item atual é encerrado e destinatário não é bloqueado", async () => {
    await withRollback(async (c) => {
      const admin = await getUserByRole(c, "admin");
      const assistido = await getAssistidoComTelefone(c);
      // Cria um item de fila com erro de cadastro elegível.
      const ins = await c.query(
        `INSERT INTO notificacoes_fila (evento_origem, assistido_id, canal, payload_json, status, dedupe_key, erro)
         VALUES ('mensagem_manual', $1, 'whatsapp', '{}'::jsonb, 'pendente', 'itest-l07:'||gen_random_uuid()::text, 'sem_telefone')
         RETURNING id`,
        [assistido],
      );
      const filaId = ins.rows[0].id;

      // Perfil não autorizado não consegue.
      const coord = await getUserByRole(c, "coordenador_de_tratamento");
      await actAs(c, coord!);
      await expect(
        c.query("SELECT public.fn_encerrar_item_fila_erro_cadastro($1)", [filaId]),
      ).rejects.toThrow(/permissao_negada/);

      // Admin encerra somente o item atual.
      await actAs(c, admin!);
      const r = await c.query("SELECT public.fn_encerrar_item_fila_erro_cadastro($1) AS res", [filaId]);
      expect(r.rows[0].res.ok).toBe(true);
      const after = await c.query("SELECT status FROM notificacoes_fila WHERE id=$1", [filaId]);
      expect(after.rows[0].status).toBe("cancelado");

      // Destinatário não é bloqueado: nenhuma preferência/opt-out alterada.
      const pref = await c.query(
        "SELECT whatsapp_ativo FROM notificacoes_preferencias WHERE assistido_id=$1",
        [assistido],
      );
      if (pref.rowCount) {
        expect(pref.rows[0].whatsapp_ativo).not.toBe(false);
      }
    });
  });
});

d("L-07 — políticas RLS presentes nas tabelas sensíveis (INV-ARQ-004)", () => {
  it("tabelas críticas têm RLS habilitada e políticas declaradas", async () => {
    await withRollback(async (c) => {
      const tables = [
        "notificacoes_fila",
        "regras_operacionais",
        "audit_logs",
        "assistidos",
        "presencas_tratamentos",
      ];
      const rls = await c.query(
        `SELECT relname, relrowsecurity FROM pg_class
          WHERE relname = ANY($1) AND relnamespace = 'public'::regnamespace`,
        [tables],
      );
      for (const row of rls.rows) {
        expect(row.relrowsecurity, `${row.relname} deve ter RLS habilitada`).toBe(true);
      }
      const pol = await c.query(
        "SELECT tablename, count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename = ANY($1) GROUP BY tablename",
        [tables],
      );
      const map = Object.fromEntries(pol.rows.map((r) => [r.tablename, r.n]));
      for (const t of tables) expect(map[t] ?? 0, `${t} deve ter políticas`).toBeGreaterThan(0);
    });
  });
});
