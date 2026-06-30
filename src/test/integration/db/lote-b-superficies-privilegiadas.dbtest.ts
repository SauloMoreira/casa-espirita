import { describe, it, expect, afterAll } from "vitest";
import {
  HAS_DB,
  withRollback,
  actAs,
  actAsAnon,
  getUserByRole,
  closePool,
} from "./_dbClient";

/**
 * P1 — Lote B — Superfícies privilegiadas (storage institucional + funções).
 *
 * Prova, em execução real, que:
 *  - `preparar_envio_institucional` exige sessão (auth.uid() nulo = negado, sem
 *    atalho de "execução interna") e papel de gestor;
 *  - o bucket `conteudo-institucional` existe e é privado (leitura pública por
 *    URL depende do flag público, hoje bloqueado no workspace);
 *  - as policies de staff do bucket institucional estão presentes (sem policy anon
 *    => sem listagem pública).
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

d("Lote B — preparar_envio_institucional (guarda de gestor, sem atalho interno)", () => {
  it("sessão ausente (auth.uid() nulo) é negada explicitamente", async () => {
    await withRollback(async (c) => {
      await actAsAnon(c);
      const r = await c.query(
        "SELECT public.preparar_envio_institucional($1,$2,$3) AS res",
        ["00000000-0000-0000-0000-000000000000", "v1", 7],
      );
      expect(r.rows[0].res.error).toMatch(/Sessão obrigatória/i);
    });
  });

  it("usuário sem papel de gestor (assistido) é bloqueado", async () => {
    await withRollback(async (c) => {
      const assistido = await getUserByRole(c, "assistido");
      expect(assistido).toBeTruthy();
      await actAs(c, assistido!);
      const r = await c.query(
        "SELECT public.preparar_envio_institucional($1,$2,$3) AS res",
        ["00000000-0000-0000-0000-000000000000", "v1", 7],
      );
      expect(r.rows[0].res.error).toMatch(/gestores/i);
    });
  });

  it("anon não tem EXECUTE concedido na função", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT has_function_privilege('anon',
           'public.preparar_envio_institucional(uuid,text,integer)', 'EXECUTE') AS can`,
      );
      expect(r.rows[0].can).toBe(false);
    });
  });
});

d("Lote B — bucket conteudo-institucional", () => {
  it("existe e é privado (leitura pública por URL depende do flag público)", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        "SELECT public FROM storage.buckets WHERE id = 'conteudo-institucional'",
      );
      expect(r.rows.length).toBe(1);
      expect(r.rows[0].public).toBe(false);
    });
  });

  it("possui policies de staff e NENHUMA policy anônima (sem listagem pública)", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT policyname FROM pg_policies
          WHERE schemaname='storage' AND tablename='objects'
            AND policyname LIKE 'conteudo_institucional_%'`,
      );
      const names = r.rows.map((x) => x.policyname).sort();
      expect(names).toContain("conteudo_institucional_select_staff");
      expect(names).toContain("conteudo_institucional_insert_staff");
      expect(names).toContain("conteudo_institucional_update_staff");
      expect(names).toContain("conteudo_institucional_delete_staff");
      // Nenhuma policy do bucket institucional concede acesso ao papel anon.
      const anon = await c.query(
        `SELECT 1 FROM pg_policies
          WHERE schemaname='storage' AND tablename='objects'
            AND policyname LIKE 'conteudo_institucional_%'
            AND 'anon' = ANY(roles)`,
      );
      expect(anon.rows.length).toBe(0);
    });
  });
});

d("Lote B — pts_* de piloto/homologação (guarda dura mantida)", () => {
  it("anon não tem EXECUTE nas funções de piloto/homologação", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT
           has_function_privilege('anon','public.pts_homologacao_auditar(uuid,text,jsonb)','EXECUTE') AS aud,
           has_function_privilege('anon','public.pts_rollback_piloto(uuid)','EXECUTE') AS roll`,
      );
      expect(r.rows[0].aud).toBe(false);
      expect(r.rows[0].roll).toBe(false);
    });
  });
});
