import { describe, it, expect, afterAll } from "vitest";
import { HAS_DB, withRollback, closePool } from "./_dbClient";
import type { PoolClient } from "pg";

/**
 * BUG — Assistido recém-cadastrado não recebe acesso automaticamente.
 *
 * Correção: o autocadastro passa a criar o profile com status "ativo" (antes
 * "pendente"), e o gatilho AFTER INSERT em public.profiles concede o papel base
 * "assistido" automaticamente. Nenhum papel elevado é concedido.
 *
 * Invariantes provadas no banco REAL:
 *  - novo profile "ativo" recebe automaticamente o papel base "assistido";
 *  - o status do profile NÃO é bloqueante ("ativo" != "pendente"/"inativo");
 *  - NENHUM papel administrativo/elevado é concedido automaticamente;
 *  - o usuário consegue ler a própria role (policy "Users can view own role").
 */
const d = HAS_DB ? describe : describe.skip;

afterAll(async () => {
  await closePool();
});

/** Conta auth existente com papel elevado, sem profile e sem base. */
async function getContaElevadaSemBaseSemProfile(c: PoolClient): Promise<string | null> {
  const r = await c.query(
    `SELECT ur.user_id
       FROM user_roles ur
      WHERE ur.role <> 'assistido'
        AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ur.user_id)
        AND NOT EXISTS (SELECT 1 FROM user_roles b WHERE b.user_id = ur.user_id AND b.role = 'assistido')
      LIMIT 1`,
  );
  return r.rows[0]?.user_id ?? null;
}

async function rolesDe(c: PoolClient, uid: string): Promise<string[]> {
  const r = await c.query("SELECT role::text FROM user_roles WHERE user_id = $1 ORDER BY role", [uid]);
  return r.rows.map((x) => x.role);
}

const PAPEIS_ELEVADOS = [
  "admin",
  "administrador_master",
  "coordenador_de_tratamento",
  "tarefeiro",
  "entrevistador",
];

d("BUG autocadastro — acesso imediato de assistido (banco real)", () => {
  it("profile criado como 'ativo' recebe assistido e não é bloqueante", async () => {
    await withRollback(async (c) => {
      const uid = await getContaElevadaSemBaseSemProfile(c);
      if (!uid) return; // ambiente sem conta elegível

      await c.query(
        "INSERT INTO public.profiles (user_id, status) VALUES ($1, 'ativo')",
        [uid],
      );

      // status não bloqueante (espelha ProtectedRoute.blockedStatus)
      const st = await c.query("SELECT status FROM profiles WHERE user_id = $1", [uid]);
      const status = st.rows[0].status as string;
      expect(status).toBe("ativo");
      expect(["pendente", "inativo"]).not.toContain(status);

      // papel base concedido automaticamente
      expect(await rolesDe(c, uid)).toContain("assistido");
    });
  });

  it("autocadastro NUNCA concede papéis elevados automaticamente", async () => {
    await withRollback(async (c) => {
      const uid = await getContaElevadaSemBaseSemProfile(c);
      if (!uid) return;
      const antes = await rolesDe(c, uid);

      await c.query(
        "INSERT INTO public.profiles (user_id, status) VALUES ($1, 'ativo')",
        [uid],
      );

      const depois = await rolesDe(c, uid);
      const novos = depois.filter((r) => !antes.includes(r));
      // o único papel adicionado pelo gatilho é o base "assistido"
      expect(novos).toEqual(["assistido"]);
      for (const p of PAPEIS_ELEVADOS) {
        if (!antes.includes(p)) expect(novos).not.toContain(p);
      }
    });
  });

  it("a policy permite ao próprio usuário ler sua role", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT count(*)::int n
           FROM pg_policy
          WHERE polrelid = 'public.user_roles'::regclass
            AND polcmd = 'r'
            AND pg_get_expr(polqual, polrelid) ILIKE '%auth.uid() = user_id%'`,
      );
      expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
    });
  });
});
