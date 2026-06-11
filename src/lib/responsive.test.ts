import { describe, it, expect } from "vitest";
import {
  BREAKPOINTS,
  VIEWPORTS,
  todosViewports,
  classificarDispositivo,
  usaBottomNav,
  colunasGridLg,
  colunasGridXl,
  colunasStatCards,
  larguraConteudo,
  temOverflowHorizontal,
  type DeviceClass,
} from "./responsive";

// ============================================================================
// Testes responsivos dedicados — validam formalmente o comportamento de layout
// dos fluxos críticos (assistido, tarefeiro, navegação) em todos os breakpoints
// obrigatórios da frente de operação móvel.
// ============================================================================

describe("responsive: breakpoints obrigatórios", () => {
  it("cobre celular, tablet, notebook e desktop", () => {
    const classes = Object.keys(VIEWPORTS) as DeviceClass[];
    expect(classes).toEqual(["mobile", "tablet", "notebook", "desktop"]);
  });

  it("inclui exatamente os viewports exigidos pela frente", () => {
    const larguras = todosViewports().map((v) => v.w);
    for (const esperado of [375, 390, 768, 1280, 1366, 1440, 1536, 1920]) {
      expect(larguras).toContain(esperado);
    }
  });

  it("notebook é cenário obrigatório (não apenas mobile)", () => {
    expect(VIEWPORTS.notebook.length).toBeGreaterThanOrEqual(3);
  });
});

describe("responsive: classificação de dispositivo", () => {
  const casos: [number, DeviceClass][] = [
    [375, "mobile"],
    [390, "mobile"],
    [767, "mobile"],
    [768, "tablet"],
    [1023, "tablet"],
    [1280, "notebook"],
    [1366, "notebook"],
    [1440, "notebook"],
    [1535, "notebook"],
    [1536, "desktop"],
    [1920, "desktop"],
  ];

  it.each(casos)("largura %i => %s", (w, esperado) => {
    expect(classificarDispositivo(w)).toBe(esperado);
  });
});

describe("responsive: navegação (bottom nav do assistido)", () => {
  it("aparece em celular e some a partir de tablet", () => {
    expect(usaBottomNav(375)).toBe(true);
    expect(usaBottomNav(390)).toBe(true);
    expect(usaBottomNav(767)).toBe(true);
    expect(usaBottomNav(768)).toBe(false);
    expect(usaBottomNav(1366)).toBe(false);
  });
});

describe("responsive: grids da área do assistido", () => {
  it("painel/agenda/avisos: 1 coluna até lg, 2 colunas a partir de lg", () => {
    expect(colunasGridLg(375)).toBe(1);
    expect(colunasGridLg(768)).toBe(1); // tablet ainda 1 coluna
    expect(colunasGridLg(1024)).toBe(2);
    expect(colunasGridLg(1280)).toBe(2); // notebook = 2 colunas
    expect(colunasGridLg(1920)).toBe(2);
  });

  it("tratamentos: só 2 colunas a partir de xl (notebook largo+)", () => {
    expect(colunasGridXl(768)).toBe(1);
    expect(colunasGridXl(1024)).toBe(1);
    expect(colunasGridXl(1279)).toBe(1);
    expect(colunasGridXl(1280)).toBe(2);
    expect(colunasGridXl(1440)).toBe(2);
  });

  it("cards-resumo: 2 colunas no mobile/tablet, 4 a partir de lg", () => {
    expect(colunasStatCards(375)).toBe(2);
    expect(colunasStatCards(768)).toBe(2);
    expect(colunasStatCards(1024)).toBe(4);
    expect(colunasStatCards(1366)).toBe(4);
  });
});

describe("responsive: contêineres e overflow", () => {
  it("max-w-screen-xl limita a largura do conteúdo em desktop", () => {
    expect(larguraConteudo(1920)).toBe(BREAKPOINTS.xl);
    expect(larguraConteudo(1536)).toBe(BREAKPOINTS.xl);
    expect(larguraConteudo(1024)).toBe(1024);
    expect(larguraConteudo(375)).toBe(375);
  });

  it("não há overflow horizontal quando o conteúdo cabe na viewport", () => {
    for (const v of todosViewports()) {
      // Conteúdo dos cards do assistido cabe folgado (largura mínima ~320px).
      expect(temOverflowHorizontal(320, v.w)).toBe(false);
    }
  });

  it("detecta overflow quando o conteúdo mínimo excede a viewport", () => {
    expect(temOverflowHorizontal(420, 375)).toBe(true);
    expect(temOverflowHorizontal(420, 768)).toBe(false);
  });
});

describe("responsive: consistência em todos os breakpoints obrigatórios", () => {
  it("todo viewport produz uma classificação válida e layout sem overflow", () => {
    for (const v of todosViewports()) {
      const cls = classificarDispositivo(v.w);
      expect(["mobile", "tablet", "notebook", "desktop"]).toContain(cls);
      // Cada classe declarada deve bater com a classificação por largura.
      expect(cls).toBe(v.cls);
      // Conteúdo base (300px) nunca estoura.
      expect(temOverflowHorizontal(300, v.w)).toBe(false);
    }
  });
});
