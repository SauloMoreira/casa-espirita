import { describe, it, expect } from "vitest";
import {
  campanhaVigente,
  campanhasVisiveis,
  ordenarExibicao,
  validarCampanha,
  type Campanha,
} from "./campanhas";

const make = (over: Partial<Campanha>): Campanha =>
  ({
    id: over.id ?? crypto.randomUUID(),
    titulo: over.titulo ?? "Campanha",
    subtitulo: over.subtitulo ?? null,
    descricao_curta: over.descricao_curta ?? null,
    descricao_completa: over.descricao_completa ?? null,
    imagem_url: over.imagem_url ?? null,
    imagem_origem: over.imagem_origem ?? "manual",
    ordem: over.ordem ?? 0,
    destaque: over.destaque ?? false,
    data_inicio: over.data_inicio ?? null,
    data_fim: over.data_fim ?? null,
    ativo: over.ativo ?? true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    updated_by: null,
  }) as Campanha;

const ref = new Date("2026-06-15T12:00:00Z");

describe("campanhaVigente", () => {
  it("aceita sem período definido", () => {
    expect(campanhaVigente({ data_inicio: null, data_fim: null }, ref)).toBe(true);
  });
  it("rejeita antes do início", () => {
    expect(campanhaVigente({ data_inicio: "2026-07-01", data_fim: null }, ref)).toBe(false);
  });
  it("rejeita após o fim", () => {
    expect(campanhaVigente({ data_inicio: null, data_fim: "2026-06-01" }, ref)).toBe(false);
  });
  it("aceita dentro do período", () => {
    expect(campanhaVigente({ data_inicio: "2026-06-01", data_fim: "2026-06-30" }, ref)).toBe(true);
  });
});

describe("campanhasVisiveis", () => {
  it("oculta inativas e fora do período", () => {
    const out = campanhasVisiveis([
      make({ titulo: "Inativa", ativo: false }),
      make({ titulo: "Expirada", data_fim: "2026-06-01" }),
      make({ titulo: "Vigente" }),
    ], ref);
    expect(out.map((c) => c.titulo)).toEqual(["Vigente"]);
  });

  it("coloca destaques primeiro", () => {
    const out = campanhasVisiveis([
      make({ titulo: "Normal", ordem: 0 }),
      make({ titulo: "Destaque", destaque: true, ordem: 5 }),
    ], ref);
    expect(out.map((c) => c.titulo)).toEqual(["Destaque", "Normal"]);
  });
});

describe("ordenarExibicao", () => {
  it("desempata por ordem e título", () => {
    const arr = [make({ titulo: "B", ordem: 1 }), make({ titulo: "A", ordem: 1 })].sort(ordenarExibicao);
    expect(arr.map((c) => c.titulo)).toEqual(["A", "B"]);
  });
});

describe("validarCampanha", () => {
  it("rejeita título vazio", () => {
    expect(validarCampanha({ titulo: "" })).not.toBeNull();
  });
  it("rejeita período invertido", () => {
    expect(validarCampanha({ titulo: "X", data_inicio: "2026-06-10", data_fim: "2026-06-01" })).not.toBeNull();
  });
  it("aceita campanha válida", () => {
    expect(validarCampanha({ titulo: "Cesta básica", data_inicio: "2026-06-01", data_fim: "2026-06-30" })).toBeNull();
  });
});
