import { describe, it, expect } from "vitest";
import {
  eventoVigente,
  eventosVisiveis,
  ordenarExibicao,
  validarEvento,
  type Evento,
} from "./eventos";

const make = (over: Partial<Evento>): Evento =>
  ({
    id: over.id ?? crypto.randomUUID(),
    titulo: over.titulo ?? "Evento",
    subtitulo: over.subtitulo ?? null,
    descricao_curta: over.descricao_curta ?? null,
    descricao_completa: over.descricao_completa ?? null,
    imagem_url: over.imagem_url ?? null,
    imagem_origem: over.imagem_origem ?? "manual",
    local: over.local ?? null,
    data_evento: over.data_evento ?? null,
    data_evento_fim: over.data_evento_fim ?? null,
    ordem: over.ordem ?? 0,
    destaque: over.destaque ?? false,
    data_inicio: over.data_inicio ?? null,
    data_fim: over.data_fim ?? null,
    ativo: over.ativo ?? true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    updated_by: null,
  }) as Evento;

const ref = new Date("2026-06-15T12:00:00Z");

describe("eventoVigente", () => {
  it("aceita sem período definido", () => {
    expect(eventoVigente({ data_inicio: null, data_fim: null }, ref)).toBe(true);
  });
  it("rejeita antes do início", () => {
    expect(eventoVigente({ data_inicio: "2026-07-01", data_fim: null }, ref)).toBe(false);
  });
  it("rejeita após o fim", () => {
    expect(eventoVigente({ data_inicio: null, data_fim: "2026-06-01" }, ref)).toBe(false);
  });
  it("aceita dentro do período", () => {
    expect(eventoVigente({ data_inicio: "2026-06-01", data_fim: "2026-06-30" }, ref)).toBe(true);
  });
});

describe("eventosVisiveis", () => {
  it("oculta inativos e fora do período", () => {
    const out = eventosVisiveis([
      make({ titulo: "Inativo", ativo: false }),
      make({ titulo: "Expirado", data_fim: "2026-06-01" }),
      make({ titulo: "Vigente" }),
    ], ref);
    expect(out.map((e) => e.titulo)).toEqual(["Vigente"]);
  });

  it("coloca destaques primeiro", () => {
    const out = eventosVisiveis([
      make({ titulo: "Normal", ordem: 0 }),
      make({ titulo: "Destaque", destaque: true, ordem: 5 }),
    ], ref);
    expect(out.map((e) => e.titulo)).toEqual(["Destaque", "Normal"]);
  });

  it("ordena por data do evento mais próxima primeiro", () => {
    const out = eventosVisiveis([
      make({ titulo: "Depois", data_evento: "2026-07-20T19:00:00Z" }),
      make({ titulo: "Antes", data_evento: "2026-07-01T19:00:00Z" }),
    ], ref);
    expect(out.map((e) => e.titulo)).toEqual(["Antes", "Depois"]);
  });
});

describe("ordenarExibicao", () => {
  it("desempata por ordem e título quando sem data", () => {
    const arr = [make({ titulo: "B", ordem: 1 }), make({ titulo: "A", ordem: 1 })].sort(ordenarExibicao);
    expect(arr.map((e) => e.titulo)).toEqual(["A", "B"]);
  });
});

describe("validarEvento", () => {
  it("rejeita título vazio", () => {
    expect(validarEvento({ titulo: "" })).not.toBeNull();
  });
  it("rejeita período de exibição invertido", () => {
    expect(validarEvento({ titulo: "X", data_inicio: "2026-06-10", data_fim: "2026-06-01" })).not.toBeNull();
  });
  it("rejeita término do evento anterior ao início", () => {
    expect(validarEvento({ titulo: "X", data_evento: "2026-07-10T20:00:00Z", data_evento_fim: "2026-07-10T18:00:00Z" })).not.toBeNull();
  });
  it("aceita evento válido", () => {
    expect(validarEvento({ titulo: "Festa Junina", data_evento: "2026-07-10T18:00:00Z", data_evento_fim: "2026-07-10T22:00:00Z" })).toBeNull();
  });
});
