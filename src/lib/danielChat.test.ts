import { describe, it, expect } from "vitest";
import { deveExibirDigitando, type MensagemMinima } from "./danielChat";

const entrada: MensagemMinima = { direcao: "entrada", autor: "assistido" };
const respostaIa: MensagemMinima = { direcao: "saida", autor: "ia" };

describe("deveExibirDigitando", () => {
  it("mostra quando a última mensagem é do assistido e Daniel deve responder", () => {
    expect(deveExibirDigitando({ mensagens: [respostaIa, entrada] })).toBe(true);
  });

  it("não mostra quando a última mensagem já é resposta da IA", () => {
    expect(deveExibirDigitando({ mensagens: [entrada, respostaIa] })).toBe(false);
  });

  it("não mostra durante carregamento", () => {
    expect(deveExibirDigitando({ mensagens: [entrada], carregando: true })).toBe(false);
  });

  it("não mostra em handoff humano ou conversa encerrada", () => {
    expect(deveExibirDigitando({ mensagens: [entrada], emHandoff: true })).toBe(false);
    expect(deveExibirDigitando({ mensagens: [entrada], encerrada: true })).toBe(false);
  });

  it("não mostra sem mensagens", () => {
    expect(deveExibirDigitando({ mensagens: [] })).toBe(false);
  });
});
