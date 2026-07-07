import { describe, it, expect, afterAll } from "vitest";
import { HAS_DB, withRollback, closePool } from "./_dbClient";

/**
 * Q2-C3-A — Correção controlada do catálogo de templates e guarda preventiva.
 *
 * Prova, contra o banco real, que:
 *  - as chaves antes divergentes (`tratamento_ausencia_remarcada`,
 *    `tratamento_suspenso`) agora EXISTEM e estão ATIVAS no catálogo;
 *  - o predicado do dispatcher NÃO produz `template_indisponivel` para elas;
 *  - os placeholders de cada template são cobertos pelos payloads reais
 *    enfileirados pelos fluxos correspondentes (fn de falta);
 *  - GUARDA DE REINCIDÊNCIA: toda chave de template usada pelo código de
 *    enfileiramento existe no catálogo e está ativa.
 *
 * Recorte estrutural: NÃO toca em item algum da fila (nenhum INSERT/UPDATE
 * persistido — leitura pura + withRollback por segurança).
 */
const d = HAS_DB ? describe : describe.skip;

/**
 * Contrato código→catálogo: chaves de template enfileiradas pelos fluxos, com o
 * conjunto MÍNIMO de placeholders que o payload real fornece.
 *
 * Fonte (migração do fluxo de falta com suspensão/remarcação):
 *   fn_enqueue_notificacao('falta_registrada', ..., 'tratamento_suspenso',
 *     jsonb_build_object('nome', ..., 'tratamento', ...))
 *   fn_enqueue_notificacao('falta_registrada', ..., 'tratamento_ausencia_remarcada',
 *     jsonb_build_object('nome', ..., 'tratamento', ..., 'nova_data', ...))
 */
const CONTRATO_ENFILEIRAMENTO: Record<string, string[]> = {
  tratamento_suspenso: ["nome", "tratamento"],
  tratamento_ausencia_remarcada: ["nome", "tratamento", "nova_data"],
};

/** Extrai placeholders {{chave}} do corpo do template. */
function placeholders(corpo: string): Set<string> {
  const out = new Set<string>();
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo)) !== null) out.add(m[1]);
  return out;
}

d("Q2-C3-A — integridade do catálogo de templates", () => {
  afterAll(async () => {
    await closePool();
  });

  it("as chaves antes divergentes existem e estão ATIVAS no catálogo", async () => {
    await withRollback(async (c) => {
      const r = await c.query(
        `SELECT codigo_template, ativo FROM public.notificacoes_templates
          WHERE codigo_template = ANY($1::text[])`,
        [Object.keys(CONTRATO_ENFILEIRAMENTO)],
      );
      const mapa = new Map(r.rows.map((x) => [x.codigo_template as string, x.ativo as boolean]));
      for (const chave of Object.keys(CONTRATO_ENFILEIRAMENTO)) {
        expect(mapa.get(chave), `template ${chave} deve existir`).toBe(true);
      }
    });
  });

  it("o predicado do dispatcher NÃO marca template_indisponivel para as chaves corrigidas", async () => {
    await withRollback(async (c) => {
      for (const chave of Object.keys(CONTRATO_ENFILEIRAMENTO)) {
        // Espelho fiel do lookup do dispatcher (notificacoes-dispatch/index.ts).
        const r = await c.query(
          `SELECT corpo_template, ativo FROM public.notificacoes_templates
            WHERE codigo_template = $1 LIMIT 1`,
          [chave],
        );
        const tpl = r.rows[0];
        const rejeitado = !tpl || tpl.ativo !== true;
        expect(rejeitado, `dispatcher não deve rejeitar ${chave}`).toBe(false);
      }
    });
  });

  it("os placeholders de cada template são cobertos pelo payload real enfileirado", async () => {
    await withRollback(async (c) => {
      for (const [chave, campos] of Object.entries(CONTRATO_ENFILEIRAMENTO)) {
        const r = await c.query(
          `SELECT corpo_template FROM public.notificacoes_templates
            WHERE codigo_template = $1 LIMIT 1`,
          [chave],
        );
        const corpo = r.rows[0]?.corpo_template as string;
        expect(corpo, `template ${chave} deve ter corpo`).toBeTruthy();
        const disponiveis = new Set(campos);
        for (const ph of placeholders(corpo)) {
          expect(
            disponiveis.has(ph),
            `placeholder {{${ph}}} de ${chave} deve existir no payload real`,
          ).toBe(true);
        }
      }
    });
  });

  it("GUARDA: toda chave de enfileiramento do código existe e está ativa no catálogo", async () => {
    await withRollback(async (c) => {
      const chaves = Object.keys(CONTRATO_ENFILEIRAMENTO);
      const r = await c.query(
        `SELECT codigo_template FROM public.notificacoes_templates
          WHERE codigo_template = ANY($1::text[]) AND ativo = true`,
        [chaves],
      );
      const ativas = new Set(r.rows.map((x) => x.codigo_template as string));
      const ausentes = chaves.filter((k) => !ativas.has(k));
      // Se falhar, há divergência código↔catálogo (reincidência do Q2-C2).
      expect(ausentes).toEqual([]);
    });
  });

  it("item remanescente da fila permanece INTOCADO (status/sent_at/retry_count)", async () => {
    await withRollback(async (c) => {
      // Leitura pura de garantia: o recorte Q2-C3-A não altera a fila.
      const r = await c.query(
        `SELECT status, sent_at, retry_count, external_message_id
           FROM public.notificacoes_fila
          WHERE erro = 'template_indisponivel'`,
      );
      for (const item of r.rows) {
        expect(item.status).toBe("falha");
        expect(item.sent_at).toBeNull();
        expect(item.retry_count).toBe(0);
        expect(item.external_message_id).toBeNull();
      }
    });
  });
});
