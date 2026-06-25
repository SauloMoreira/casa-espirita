/**
 * P1.1 — E2E real (JWT + PostgREST) — RPCs sensíveis no caminho real.
 *
 * Prova autorização real por perfil nas RPCs críticas: perfis corretos passam
 * o portão de permissão (chegando à validação de negócio), perfis indevidos
 * recebem erro coerente, e o anônimo é bloqueado. Testes não-destrutivos:
 * usam ids inexistentes para checar o portão SEM alterar estado real.
 */
import { describe, it, expect } from "vitest";
import { HAS_E2E, rpc } from "./_rlsClient";
import { HAS_SERVICE } from "./_seed";

const ENABLED = HAS_E2E && HAS_SERVICE;
const FAKE_UUID = "00000000-0000-0000-0000-0000000000ff";

function err(body: unknown): string {
  return JSON.stringify(body);
}

describe.skipIf(!ENABLED)("E2E RLS · RPCs sensíveis — autorização por perfil", () => {
  describe("fn_entrevistas_operacional", () => {
    it("admin/entrevistador/tarefeiro acessam (array)", async () => {
      for (const role of ["admin", "entrevistador", "tarefeiro"] as const) {
        const r = await rpc<unknown[]>(role, "fn_entrevistas_operacional");
        expect(r.ok, role).toBe(true);
        expect(Array.isArray(r.body)).toBe(true);
      }
    });
    it("assistido não recebe entrevistas operacionais (vazio)", async () => {
      const r = await rpc<unknown[]>("assistido", "fn_entrevistas_operacional");
      expect(Array.isArray(r.body)).toBe(true);
      expect(r.body).toHaveLength(0);
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_entrevistas_operacional");
      expect(r.status).toBe(401);
    });
  });

  describe("fn_avisos_ausencia_pendentes", () => {
    it("equipe autorizada e tarefeiro acessam", async () => {
      for (const role of ["admin", "coordenador", "entrevistador", "tarefeiro"] as const) {
        const r = await rpc<unknown[]>(role, "fn_avisos_ausencia_pendentes");
        expect(r.ok, role).toBe(true);
      }
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_avisos_ausencia_pendentes");
      expect(r.status).toBe(401);
    });
  });

  describe("fn_registrar_aviso_ausencia", () => {
    it("não-assistido (tarefeiro) é barrado por titularidade", async () => {
      const r = await rpc("tarefeiro", "fn_registrar_aviso_ausencia", {
        p_tipo_compromisso: "entrevista",
        p_compromisso_id: FAKE_UUID,
      });
      expect(r.ok).toBe(false);
      expect(err(r.body)).toMatch(/assistido_invalido/);
    });
    it("assistido autenticado passa a autenticação e cai em validação de domínio (não 401)", async () => {
      const r = await rpc("assistido", "fn_registrar_aviso_ausencia", {
        p_tipo_compromisso: "entrevista",
        p_compromisso_id: FAKE_UUID,
      });
      expect(r.status).not.toBe(401);
      expect(r.ok).toBe(false);
      // Sessão real reconhecida: erro é de domínio (titularidade/compromisso), nunca de permissão genérica.
      expect(err(r.body)).toMatch(/assistido_invalido|compromisso_invalido/);
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_registrar_aviso_ausencia", {
        p_tipo_compromisso: "entrevista",
        p_compromisso_id: FAKE_UUID,
      });
      expect(r.status).toBe(401);
    });
  });

  describe("fn_tratar_aviso_ausencia", () => {
    it("admin passa o portão de permissão (aviso_inexistente)", async () => {
      const r = await rpc("admin", "fn_tratar_aviso_ausencia", {
        p_aviso_id: FAKE_UUID,
        p_novo_status: "em_tratamento",
      });
      expect(r.ok).toBe(false);
      expect(err(r.body)).toMatch(/aviso_inexistente/);
    });
    it("tarefeiro e assistido são barrados (permissao_negada)", async () => {
      for (const role of ["tarefeiro", "assistido"] as const) {
        const r = await rpc(role, "fn_tratar_aviso_ausencia", {
          p_aviso_id: FAKE_UUID,
          p_novo_status: "em_tratamento",
        });
        expect(r.ok, role).toBe(false);
        expect(err(r.body)).toMatch(/permissao_negada/);
      }
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_tratar_aviso_ausencia", {
        p_aviso_id: FAKE_UUID,
        p_novo_status: "em_tratamento",
      });
      expect(r.status).toBe(401);
    });
  });

  describe("fn_enfileirar_mensagem_manual", () => {
    it("admin passa o portão de permissão (chega à validação de negócio)", async () => {
      const r = await rpc("admin", "fn_enfileirar_mensagem_manual", {
        p_assistido_id: FAKE_UUID,
        p_mensagem: "e2e_rls verificação de portão",
      });
      // Passou a permissão → erro é de negócio (destinatário inválido), não de permissão.
      expect(r.ok).toBe(false);
      expect(err(r.body)).not.toMatch(/permissao_negada/);
      expect(err(r.body)).toMatch(/destinatario_invalido/);
    });
    it("perfis indevidos são barrados (permissao_negada)", async () => {
      for (const role of ["tarefeiro", "entrevistador", "assistido"] as const) {
        const r = await rpc(role, "fn_enfileirar_mensagem_manual", {
          p_assistido_id: FAKE_UUID,
          p_mensagem: "x",
        });
        expect(r.ok, role).toBe(false);
        expect(err(r.body)).toMatch(/permissao_negada/);
      }
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_enfileirar_mensagem_manual", {
        p_assistido_id: FAKE_UUID,
        p_mensagem: "x",
      });
      expect(r.status).toBe(401);
    });
  });

  describe("fn_encerrar_item_fila_erro_cadastro", () => {
    it("admin passa o portão de permissão (item_inexistente)", async () => {
      const r = await rpc("admin", "fn_encerrar_item_fila_erro_cadastro", {
        p_fila_id: FAKE_UUID,
      });
      expect(r.ok).toBe(false);
      expect(err(r.body)).not.toMatch(/permissao_negada/);
      expect(err(r.body)).toMatch(/item_inexistente/);
    });
    it("perfis indevidos são barrados (permissao_negada)", async () => {
      for (const role of ["tarefeiro", "entrevistador", "assistido"] as const) {
        const r = await rpc(role, "fn_encerrar_item_fila_erro_cadastro", {
          p_fila_id: FAKE_UUID,
        });
        expect(r.ok, role).toBe(false);
        expect(err(r.body)).toMatch(/permissao_negada/);
      }
    });
    it("anônimo é bloqueado (401)", async () => {
      const r = await rpc("none", "fn_encerrar_item_fila_erro_cadastro", {
        p_fila_id: FAKE_UUID,
      });
      expect(r.status).toBe(401);
    });
  });
});
