import { describe, it, expect } from "vitest";
import {
  classificarEvento,
  isOperacional,
  EVENTOS_OPERACIONAIS,
} from "./comunicacaoCanal";

describe("comunicacaoCanal", () => {
  it("classifica todos os eventos operacionais conhecidos", () => {
    for (const ev of EVENTOS_OPERACIONAIS) {
      expect(classificarEvento(ev)).toBe("operacional");
      expect(isOperacional(ev)).toBe(true);
    }
  });

  it("classifica presença e falta como operacionais", () => {
    expect(classificarEvento("presenca_registrada")).toBe("operacional");
    expect(classificarEvento("falta_registrada")).toBe("operacional");
  });

  it("trata campanhas/eventos institucionais como geral", () => {
    expect(classificarEvento("campanha")).toBe("geral");
    expect(classificarEvento("evento")).toBe("geral");
    expect(classificarEvento("comunicado_institucional")).toBe("geral");
  });

  it("default seguro: valores vazios/desconhecidos são geral", () => {
    expect(classificarEvento(null)).toBe("geral");
    expect(classificarEvento(undefined)).toBe("geral");
    expect(classificarEvento("")).toBe("geral");
    expect(classificarEvento("evento_inexistente")).toBe("geral");
    expect(isOperacional(null)).toBe(false);
  });
});
