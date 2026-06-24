import { describe, it, expect } from "vitest";
import {
  validarValor,
  formatarValor,
  difereDoPadrao,
  houveMudanca,
  type ParametroOperacional,
} from "./parametrosOperacionais";

const base: Pick<ParametroOperacional, "tipo" | "valor_min" | "valor_max" | "opcoes"> = {
  tipo: "inteiro",
  valor_min: 1,
  valor_max: 168,
  opcoes: null,
};

describe("validarValor — booleano", () => {
  it("aceita true/false", () => {
    expect(validarValor({ ...base, tipo: "booleano" }, "true").valido).toBe(true);
    expect(validarValor({ ...base, tipo: "booleano" }, "false").valido).toBe(true);
  });
  it("rejeita valor inválido", () => {
    expect(validarValor({ ...base, tipo: "booleano" }, "1").valido).toBe(false);
    expect(validarValor({ ...base, tipo: "booleano" }, "sim").valido).toBe(false);
  });
});

describe("validarValor — inteiro com faixa", () => {
  it("aceita valor dentro da faixa", () => {
    expect(validarValor(base, "24").valido).toBe(true);
    expect(validarValor(base, "1").valido).toBe(true);
    expect(validarValor(base, "168").valido).toBe(true);
  });
  it("rejeita abaixo do mínimo", () => {
    expect(validarValor(base, "0").valido).toBe(false);
  });
  it("rejeita acima do máximo", () => {
    expect(validarValor(base, "200").valido).toBe(false);
  });
  it("rejeita não-inteiro", () => {
    expect(validarValor(base, "12.5").valido).toBe(false);
    expect(validarValor(base, "abc").valido).toBe(false);
  });
});

describe("validarValor — enum", () => {
  const enumP = { ...base, tipo: "enum" as const, opcoes: ["a", "b"] };
  it("aceita opção válida", () => {
    expect(validarValor(enumP, "a").valido).toBe(true);
  });
  it("rejeita opção fora da lista", () => {
    expect(validarValor(enumP, "c").valido).toBe(false);
  });
});

describe("formatarValor", () => {
  it("formata booleano", () => {
    expect(formatarValor({ tipo: "booleano", valor: "true" })).toBe("Ativado");
    expect(formatarValor({ tipo: "booleano", valor: "false" })).toBe("Desativado");
  });
  it("retorna valor cru para numérico", () => {
    expect(formatarValor({ tipo: "inteiro", valor: "24" })).toBe("24");
  });
});

describe("difereDoPadrao / houveMudanca", () => {
  it("detecta diferença do padrão", () => {
    expect(difereDoPadrao({ valor: "48", valor_padrao: "24" })).toBe(true);
    expect(difereDoPadrao({ valor: "24", valor_padrao: "24" })).toBe(false);
    expect(difereDoPadrao({ valor: "24", valor_padrao: null })).toBe(false);
  });
  it("detecta mudança real ignorando espaços", () => {
    expect(houveMudanca("24", " 24 ")).toBe(false);
    expect(houveMudanca("24", "48")).toBe(true);
  });
});
