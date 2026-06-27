import { describe, it, expect } from "vitest";
import {
  ATUACAO_TIPOS,
  CAMADA_LABELS,
  verificarCoerenciaAtuacaoAcesso,
  temDivergenciaCoerencia,
} from "@/lib/atuacao";
import { TIPOS_VOLUNTARIO } from "@/constants/voluntarios";

/**
 * Etapa 4 — Atuação (catálogo único de funções operacionais).
 * Guarda a separação entre Atuação (camada operacional) e Acesso (user_roles),
 * a fonte única do catálogo e os alertas de coerência sem mutação cruzada.
 */
describe("INV-ATU — catálogo único de atuação", () => {
  it("o catálogo de tipos é fonte única e reexportado pelas constantes", () => {
    expect(TIPOS_VOLUNTARIO).toBe(ATUACAO_TIPOS);
    expect([...ATUACAO_TIPOS]).toEqual(["Médium", "Tarefeiro"]);
  });

  it("rótulos separam explicitamente Acesso de Atuação", () => {
    expect(CAMADA_LABELS.acesso.titulo).toBe("Acesso");
    expect(CAMADA_LABELS.atuacao.titulo).toBe("Atuação");
  });
});

describe("INV-ATU-NOCROSS — atuação nunca concede acesso", () => {
  it("divergência atuação x acesso gera alerta consultivo, não mutação", () => {
    const alertas = verificarCoerenciaAtuacaoAcesso(["Tarefeiro"], ["assistido"]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      tipo: "Tarefeiro",
      acessoSugerido: "tarefeiro",
      severidade: "atencao",
    });
    expect(alertas[0].mensagem).toContain("não concede acesso");
  });

  it("sem divergência quando o acesso correspondente já existe", () => {
    expect(
      verificarCoerenciaAtuacaoAcesso(["Tarefeiro"], ["assistido", "tarefeiro"]),
    ).toHaveLength(0);
    expect(temDivergenciaCoerencia(["Tarefeiro"], ["tarefeiro"])).toBe(false);
  });

  it("tipo sem acesso sugerido (Médium) nunca gera alerta", () => {
    expect(verificarCoerenciaAtuacaoAcesso(["Médium"], [])).toHaveLength(0);
    expect(verificarCoerenciaAtuacaoAcesso(["Médium"], ["assistido"])).toHaveLength(0);
  });

  it("entradas nulas/vazias são seguras", () => {
    expect(verificarCoerenciaAtuacaoAcesso(null, null)).toEqual([]);
    expect(verificarCoerenciaAtuacaoAcesso([], undefined)).toEqual([]);
    expect(temDivergenciaCoerencia(undefined, undefined)).toBe(false);
  });

  it("o helper nunca retorna nomes de papel fora do enum real", () => {
    const alertas = verificarCoerenciaAtuacaoAcesso(["Tarefeiro", "Médium"], []);
    for (const a of alertas) {
      expect(a.acessoSugerido).toBe("tarefeiro");
    }
  });
});
