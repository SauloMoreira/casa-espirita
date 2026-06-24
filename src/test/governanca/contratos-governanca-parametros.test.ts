/**
 * BLOCO: Contratos de governança de parâmetros operacionais.
 *
 * Protege a pré-validação ergonômica (espelho de `fn_atualizar_parametro_operacional`):
 * parâmetros governados aceitam/rejeitam valores conforme o tipo. A fonte de
 * verdade autoritativa é o backend; este contrato garante paridade do espelho.
 *
 * Invariante relacionada: INV-GOV-001 — flags/parâmetros críticos são governados.
 */
import { describe, it, expect } from "vitest";
import { validarValor, formatarValor, houveMudanca } from "@/lib/parametrosOperacionais";

describe("CONTRATO parâmetro booleano — só aceita true/false", () => {
  it("aceita true/false e rejeita o resto", () => {
    expect(validarValor({ tipo: "booleano", valor_min: null, valor_max: null, opcoes: null }, "true").valido).toBe(true);
    expect(validarValor({ tipo: "booleano", valor_min: null, valor_max: null, opcoes: null }, "false").valido).toBe(true);
    expect(validarValor({ tipo: "booleano", valor_min: null, valor_max: null, opcoes: null }, "sim").valido).toBe(false);
  });

  it("formata flag booleana de forma amigável", () => {
    expect(formatarValor({ tipo: "booleano", valor: "true" })).toBe("Ativado");
    expect(formatarValor({ tipo: "booleano", valor: "false" })).toBe("Desativado");
  });
});

describe("CONTRATO parâmetro inteiro — respeita min/max", () => {
  it("rejeita não-inteiro", () => {
    expect(validarValor({ tipo: "inteiro", valor_min: 0, valor_max: 72, opcoes: null }, "abc").valido).toBe(false);
    expect(validarValor({ tipo: "inteiro", valor_min: 0, valor_max: 72, opcoes: null }, "1.5").valido).toBe(false);
  });

  it("respeita limites mínimo e máximo", () => {
    expect(validarValor({ tipo: "inteiro", valor_min: 1, valor_max: 72, opcoes: null }, "0").valido).toBe(false);
    expect(validarValor({ tipo: "inteiro", valor_min: 1, valor_max: 72, opcoes: null }, "73").valido).toBe(false);
    expect(validarValor({ tipo: "inteiro", valor_min: 1, valor_max: 72, opcoes: null }, "24").valido).toBe(true);
  });
});

describe("CONTRATO parâmetro enum — só aceita opções válidas", () => {
  it("aceita valor da lista e rejeita fora dela", () => {
    const p = { tipo: "enum" as const, valor_min: null, valor_max: null, opcoes: ["a", "b"] };
    expect(validarValor(p, "a").valido).toBe(true);
    expect(validarValor(p, "c").valido).toBe(false);
  });
});

describe("CONTRATO parâmetro json — exige JSON válido", () => {
  it("aceita JSON válido e rejeita inválido", () => {
    const p = { tipo: "json" as const, valor_min: null, valor_max: null, opcoes: null };
    expect(validarValor(p, '{"x":1}').valido).toBe(true);
    expect(validarValor(p, "{x:1}").valido).toBe(false);
  });
});

describe("CONTRATO mudança real — evita gravação/auditoria sem alteração", () => {
  it("detecta mudança ignorando espaços nas bordas", () => {
    expect(houveMudanca("true", "true")).toBe(false);
    expect(houveMudanca(" 24 ", "24")).toBe(false);
    expect(houveMudanca("24", "48")).toBe(true);
  });
});
