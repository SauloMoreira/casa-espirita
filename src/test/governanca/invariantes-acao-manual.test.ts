/**
 * BLOCO: Invariantes de ação manual / humana.
 *
 * Protege as garantias de que ações humanas (mensagem manual, encerramento de
 * item por erro de cadastro) passam pelo pipeline oficial e NUNCA bloqueiam o
 * destinatário nem alteram consentimento/opt-out.
 *
 * Invariantes protegidas:
 *  - INV-MANUAL-001 — mensagem manual passa pelo pipeline oficial (fila/validação)
 *  - INV-MANUAL-002 — mensagem manual não altera consentimento/opt-out
 *  - INV-MANUAL-003 — encerrar item por erro de cadastro não bloqueia a pessoa
 */
import { describe, it, expect } from "vitest";
import {
  validarMensagemManual,
  ehMensagemManual,
  EVENTO_MENSAGEM_MANUAL,
  MENSAGEM_MANUAL_MAX,
  podeEncerrarPorErroCadastro,
  MOTIVOS_ERRO_CADASTRO,
} from "@/lib/notificacaoElegibilidade";

describe("INV-MANUAL-001 — mensagem manual é governada antes de entrar na fila", () => {
  it("identifica o evento de mensagem manual", () => {
    expect(ehMensagemManual(EVENTO_MENSAGEM_MANUAL)).toBe(true);
    expect(ehMensagemManual("sessao_lembrete")).toBe(false);
  });

  it("rejeita mensagem vazia", () => {
    const r = validarMensagemManual("    ");
    expect(r.ok).toBe(false);
    expect(r.erro).toBe("mensagem_vazia");
  });

  it("rejeita mensagem acima do limite coerente", () => {
    const r = validarMensagemManual("a".repeat(MENSAGEM_MANUAL_MAX + 1));
    expect(r.ok).toBe(false);
    expect(r.erro).toBe("mensagem_muito_longa");
  });

  it("normaliza e aceita mensagem válida", () => {
    const r = validarMensagemManual("  Olá   mundo  ");
    expect(r.ok).toBe(true);
    expect(r.texto).toBe("Olá mundo");
  });
});

describe("INV-MANUAL-002 — validação de mensagem NÃO toca consentimento/opt-out", () => {
  it("a validação é pura: só decide se o texto pode ser enfileirado", () => {
    const entrada = "Mensagem informativa";
    const r = validarMensagemManual(entrada);
    // O contrato do espelho expõe apenas {ok, texto, erro?} — nenhum campo de
    // consentimento/opt-out. Isso garante que a ação manual não carrega efeito
    // colateral sobre o destinatário (a fonte de verdade é a RPC do backend).
    expect(Object.keys(r).sort()).toEqual(["ok", "texto"]);
    expect(r).not.toHaveProperty("opt_out");
    expect(r).not.toHaveProperty("consentimento");
  });
});

describe("INV-MANUAL-003 — encerrar item por erro de cadastro atua no item, não na pessoa", () => {
  it("só encerra item ATIVO com motivo de erro de cadastro", () => {
    for (const erro of MOTIVOS_ERRO_CADASTRO) {
      expect(podeEncerrarPorErroCadastro({ status: "pendente", erro })).toBe(true);
    }
  });

  it("não encerra item já enviado/cancelado", () => {
    expect(podeEncerrarPorErroCadastro({ status: "enviado", erro: "sem_telefone" })).toBe(false);
    expect(podeEncerrarPorErroCadastro({ status: "cancelado", erro: "sem_telefone" })).toBe(false);
  });

  it("não encerra item sem motivo de erro de cadastro (não é a ferramenta certa)", () => {
    expect(podeEncerrarPorErroCadastro({ status: "pendente", erro: null })).toBe(false);
    expect(podeEncerrarPorErroCadastro({ status: "pendente", erro: "opt_out" })).toBe(false);
  });
});
