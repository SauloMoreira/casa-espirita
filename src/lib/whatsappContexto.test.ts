import { describe, it, expect } from "vitest";
import {
  resolverTempo,
  temMarcadorTemporal,
  resumirTurno,
  adicionarTurno,
  contextoHerdavel,
  ehFollowUpCurto,
  MAX_TURNOS,
  type ContextoConversa,
} from "./whatsappContexto";

// Base fixa: 2026-06-19 é uma SEXTA-FEIRA (dow=5).
const BASE = "2026-06-19";

describe("resolverTempo — dias relativos", () => {
  it("hoje", () => {
    const r = resolverTempo("tem palestra hoje?", null, BASE);
    expect(r).toMatchObject({ tipo: "dia", inicio: BASE, fim: BASE, label: "hoje", origem: "explicito" });
  });
  it("amanhã", () => {
    const r = resolverTempo("amanhã tem evangelhoterapia?", null, BASE);
    expect(r.inicio).toBe("2026-06-20");
    expect(r.label).toBe("amanhã");
  });
  it("depois de amanhã", () => {
    const r = resolverTempo("e depois de amanhã?", null, BASE);
    expect(r.inicio).toBe("2026-06-21");
    expect(r.label).toBe("depois de amanhã");
  });
});

describe("resolverTempo — dias da semana", () => {
  it("domingo (próxima ocorrência)", () => {
    const r = resolverTempo("e domingo?", null, BASE); // sexta -> domingo = +2
    expect(r.inicio).toBe("2026-06-21");
    expect(r.diasSemana).toEqual([0]);
  });
  it("no sábado", () => {
    const r = resolverTempo("no sábado tem passe?", null, BASE); // sexta -> sábado = +1
    expect(r.inicio).toBe("2026-06-20");
  });
  it("próxima sexta pula para a semana seguinte", () => {
    const r = resolverTempo("próxima sexta", null, BASE); // hoje é sexta -> +7
    expect(r.inicio).toBe("2026-06-26");
  });
  it("sexta sem 'próxima' resolve hoje", () => {
    const r = resolverTempo("tem culto sexta?", null, BASE);
    expect(r.inicio).toBe(BASE);
  });
});

describe("resolverTempo — intervalos", () => {
  it("fim de semana = sábado+domingo", () => {
    const r = resolverTempo("tem algo no fim de semana?", null, BASE);
    expect(r.tipo).toBe("intervalo");
    expect(r.inicio).toBe("2026-06-20");
    expect(r.fim).toBe("2026-06-21");
    expect(r.diasSemana).toEqual([6, 0]);
  });
  it("essa semana = hoje até domingo", () => {
    const r = resolverTempo("quais eventos tem essa semana?", null, BASE);
    expect(r.tipo).toBe("intervalo");
    expect(r.inicio).toBe(BASE);
    expect(r.fim).toBe("2026-06-21"); // próximo domingo
  });
});

describe("resolverTempo — herança e default", () => {
  it("sem marcador herda referencia_temporal do contexto", () => {
    const ctx: ContextoConversa = { referencia_temporal: "2026-06-21" };
    const r = resolverTempo("e a desobsessão?", ctx, BASE);
    expect(r.inicio).toBe("2026-06-21");
    expect(r.origem).toBe("herdado");
  });
  it("sem marcador e sem contexto cai em hoje (default)", () => {
    const r = resolverTempo("e a desobsessão?", null, BASE);
    expect(r.inicio).toBe(BASE);
    expect(r.origem).toBe("default_hoje");
  });
  it("não herda contexto temporal passado", () => {
    const ctx: ContextoConversa = { referencia_temporal: "2020-01-01" };
    const r = resolverTempo("e a desobsessão?", ctx, BASE);
    expect(r.origem).toBe("default_hoje");
  });
});

describe("temMarcadorTemporal", () => {
  it.each([
    ["hoje tem?", true],
    ["e amanhã?", true],
    ["no fim de semana?", true],
    ["essa semana?", true],
    ["domingo?", true],
    ["e a desobsessão?", false],
    ["quando é a evangelhoterapia?", false],
  ])("%s -> %s", (txt, esperado) => {
    expect(temMarcadorTemporal(txt as string)).toBe(esperado);
  });
});

describe("memória curta — resumo e limite", () => {
  it("trunca turno longo a ~120 chars", () => {
    const longo = "a".repeat(300);
    const t = resumirTurno("user", longo, "2026-06-19T10:00:00Z");
    expect(t.resumo.length).toBeLessThanOrEqual(120);
    expect(t.resumo.endsWith("…")).toBe(true);
  });
  it("mantém no máximo MAX_TURNOS (FIFO)", () => {
    let turnos = [] as ReturnType<typeof resumirTurno>[];
    for (let i = 0; i < 8; i++) {
      turnos = adicionarTurno(turnos, resumirTurno("user", `msg ${i}`, "2026-06-19T10:00:00Z"));
    }
    expect(turnos.length).toBe(MAX_TURNOS);
    expect(turnos[0].resumo).toBe("msg 4");
    expect(turnos[MAX_TURNOS - 1].resumo).toBe("msg 7");
  });
});

describe("herança com limite de janela", () => {
  const agora = new Date("2026-06-19T10:00:00Z").getTime();
  it("herda quando turno é recente (<=10min)", () => {
    expect(contextoHerdavel("2026-06-19T09:55:00Z", agora)).toBe(true);
  });
  it("não herda quando turno é antigo (>10min)", () => {
    expect(contextoHerdavel("2026-06-19T09:40:00Z", agora)).toBe(false);
  });
  it("não herda sem timestamp", () => {
    expect(contextoHerdavel(null, agora)).toBe(false);
  });
});

describe("ehFollowUpCurto", () => {
  it.each([
    ["e domingo?", true],
    ["e a desobsessão?", true],
    ["e eu?", true],
    ["passe?", true],
    ["quando é a próxima evangelhoterapia da casa?", false],
  ])("%s -> %s", (txt, esperado) => {
    expect(ehFollowUpCurto(txt as string)).toBe(esperado);
  });
});
