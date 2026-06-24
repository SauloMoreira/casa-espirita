/**
 * BLOCO: Contratos da Central de Notificações.
 *
 * A Central depende de formatos/semânticas estáveis para interpretar
 * origem/status/motivo dos itens. Estes contratos protegem os espelhos
 * `rotuloDiagnosticoPendencia` (L-02, contraparte de `fn_fila_diagnostico_pendentes`)
 * e `rotuloMotivo` (rótulos de inelegibilidade/saneamento).
 *
 * Invariante relacionada: INV-ARQ-002 — a UI apenas traduz; não recalcula regra.
 */
import { describe, it, expect } from "vitest";
import {
  rotuloDiagnosticoPendencia,
  rotuloMotivo,
} from "@/lib/notificacaoElegibilidade";

describe("CONTRATO Central — diagnóstico de pendência com tom correto", () => {
  it("item manual aguardando janela NÃO parece erro (tom de espera)", () => {
    const d = rotuloDiagnosticoPendencia("aguardando_janela");
    expect(d).not.toBeNull();
    expect(d!.tom).toBe("espera");
    expect(d!.label).toMatch(/janela/i);
  });

  it("item aguardando limite diário tem tom de espera (não bloqueio)", () => {
    const d = rotuloDiagnosticoPendencia("aguardando_limite_diario");
    expect(d!.tom).toBe("espera");
  });

  it("item pendente normal tem tom neutro", () => {
    expect(rotuloDiagnosticoPendencia("pendente")!.tom).toBe("neutro");
  });

  it("opt-out e sem telefone têm tom de bloqueio", () => {
    expect(rotuloDiagnosticoPendencia("opt_out")!.tom).toBe("bloqueio");
    expect(rotuloDiagnosticoPendencia("sem_telefone")!.tom).toBe("bloqueio");
  });

  it("bloqueado_inelegivel:<motivo> resolve para bloqueio + descrição do motivo", () => {
    const d = rotuloDiagnosticoPendencia("bloqueado_inelegivel:sessao_cancelada");
    expect(d!.tom).toBe("bloqueio");
    expect(d!.descricao).toMatch(/cancelada/i);
  });

  it("código nulo não gera destaque", () => {
    expect(rotuloDiagnosticoPendencia(null)).toBeNull();
  });

  it("código desconhecido cai em rótulo neutro seguro (sem quebrar a UI)", () => {
    const d = rotuloDiagnosticoPendencia("algo_novo_no_backend");
    expect(d).not.toBeNull();
    expect(d!.tom).toBe("neutro");
  });
});

describe("CONTRATO Central — rótulos de motivo de inelegibilidade", () => {
  it("traduz motivos críticos para pt-BR", () => {
    expect(rotuloMotivo("sessao_cancelada")).toBe("Sessão cancelada");
    expect(rotuloMotivo("entrevista_vencida")).toMatch(/vencida/i);
    expect(rotuloMotivo("erro_cadastro")).toMatch(/erro de cadastro/i);
  });

  it("motivo desconhecido devolve o próprio código (sem perder informação)", () => {
    expect(rotuloMotivo("motivo_inexistente_xyz")).toBe("motivo_inexistente_xyz");
  });

  it("código nulo devolve null", () => {
    expect(rotuloMotivo(null)).toBeNull();
  });
});
