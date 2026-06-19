import { describe, it, expect } from "vitest";
import {
  normalizarEnvioStatus,
  normalizarItemStatus,
  podePreparar,
  podeDisparar,
  pendentes,
  progressoPercentual,
  ENVIO_STATUS_LABEL,
  MOTIVO_LABEL,
} from "./comunicacaoEnvio";

describe("comunicacaoEnvio - normalização", () => {
  it("normaliza estados gerais desconhecidos para nao_iniciado", () => {
    expect(normalizarEnvioStatus(undefined)).toBe("nao_iniciado");
    expect(normalizarEnvioStatus("xpto")).toBe("nao_iniciado");
    expect(normalizarEnvioStatus("em_andamento")).toBe("em_andamento");
    expect(normalizarEnvioStatus("concluido")).toBe("concluido");
  });

  it("normaliza estados de item desconhecidos para pendente", () => {
    expect(normalizarItemStatus(null)).toBe("pendente");
    expect(normalizarItemStatus("enviado")).toBe("enviado");
    expect(normalizarItemStatus("bloqueado")).toBe("bloqueado");
  });

  it("possui rótulos para todos os estados gerais", () => {
    expect(ENVIO_STATUS_LABEL.preparado).toBeTruthy();
    expect(ENVIO_STATUS_LABEL.concluido).toBeTruthy();
  });

  it("descreve os motivos de bloqueio anti-spam", () => {
    expect(MOTIVO_LABEL.limite_frequencia).toMatch(/anti-spam/i);
    expect(MOTIVO_LABEL.consentimento_revogado).toBeTruthy();
  });
});

describe("comunicacaoEnvio - regras de preparação/disparo", () => {
  it("só permite preparar comunicação aprovada não disparada", () => {
    expect(podePreparar({ status: "aprovada", envio_status: "nao_iniciado" })).toBe(true);
    expect(podePreparar({ status: "aprovada", envio_status: "preparado" })).toBe(true);
    expect(podePreparar({ status: "rascunho", envio_status: "nao_iniciado" })).toBe(false);
    expect(podePreparar({ status: "aprovada", envio_status: "concluido" })).toBe(false);
  });

  it("só permite disparar quando há pendentes em fila preparada/andamento", () => {
    expect(
      podeDisparar({
        status: "aprovada",
        envio_status: "preparado",
        total_destinatarios: 10,
        total_enviados: 0,
        total_falhas: 0,
        total_bloqueados: 2,
      }),
    ).toBe(true);
    expect(
      podeDisparar({
        status: "aprovada",
        envio_status: "concluido",
        total_destinatarios: 10,
        total_enviados: 8,
        total_bloqueados: 2,
      }),
    ).toBe(false);
    expect(
      podeDisparar({
        status: "aprovada",
        envio_status: "em_andamento",
        total_destinatarios: 5,
        total_enviados: 5,
      }),
    ).toBe(false);
  });
});

describe("comunicacaoEnvio - métricas", () => {
  it("calcula pendentes sem ficar negativo", () => {
    expect(pendentes({ total_destinatarios: 10, total_enviados: 3, total_falhas: 1, total_bloqueados: 2 })).toBe(4);
    expect(pendentes({ total_destinatarios: 5, total_enviados: 10 })).toBe(0);
    expect(pendentes({})).toBe(0);
  });

  it("calcula progresso sobre elegíveis (exclui bloqueados)", () => {
    expect(
      progressoPercentual({ total_destinatarios: 12, total_bloqueados: 2, total_enviados: 5, total_falhas: 0 }),
    ).toBe(50);
    expect(progressoPercentual({ total_destinatarios: 0 })).toBe(0);
    expect(
      progressoPercentual({ total_destinatarios: 5, total_bloqueados: 5 }),
    ).toBe(0);
  });

  it("limita o progresso a 100%", () => {
    expect(
      progressoPercentual({ total_destinatarios: 10, total_bloqueados: 0, total_enviados: 10, total_falhas: 2 }),
    ).toBe(100);
  });
});
