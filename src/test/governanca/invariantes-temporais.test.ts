/**
 * BLOCO: Invariantes temporais (date-only × datetime real).
 *
 * Protege a renderização e a comparação temporal contra o bug clássico de
 * "horário fantasma": uma data pura (entrevista) NUNCA pode virar 21:00 por
 * vazamento de fuso, nem deslocar o dia.
 *
 * Invariantes protegidas:
 *  - INV-TEMPO-001 — entrevista date-only não inventa horário
 *  - INV-TEMPO-002 — data pura continua sendo data pura
 *  - INV-TEMPO-003 — só converter fuso quando existe hora real
 */
import { describe, it, expect } from "vitest";
import { renderTemplate, formatarDataBR, diffDiasCalendario } from "@/lib/notificacoes";

describe("INV-TEMPO-001/002 — data pura renderiza só a data (sem hora fantasma)", () => {
  it("YYYY-MM-DD vira DD/MM/AAAA sem hora", () => {
    const out = renderTemplate("Sua entrevista é {{data}}.", { data: "2026-07-15" });
    expect(out).toBe("Sua entrevista é 15/07/2026.");
    expect(out).not.toMatch(/\d{2}:\d{2}/);
  });

  it("timestamp à meia-noite UTC NÃO vira 21:00 nem desloca o dia", () => {
    const out = renderTemplate("{{data}}", { data: "2026-07-15T00:00:00Z" });
    expect(out).toBe("15/07/2026");
    expect(out).not.toContain("21:00");
    expect(out).not.toContain("14/07");
  });

  it("data de remarcação pura também não inventa horário", () => {
    const out = renderTemplate("Remarcada para {{nova_data}}.", {
      nova_data: "2026-08-01",
    });
    expect(out).toBe("Remarcada para 01/08/2026.");
    expect(out).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe("INV-TEMPO-003 — só converte/exibe hora quando existe hora real", () => {
  it("timestamp com hora real preserva a hora", () => {
    const out = renderTemplate("{{data}}", { data: "2026-07-15T15:30:00-03:00" });
    expect(out).toContain("15/07/2026");
    expect(out).toMatch(/15:30/);
  });

  it("novo_horario só aparece quando há horário real informado", () => {
    const comHora = renderTemplate("{{nova_data}}{{novo_horario}}", {
      nova_data: "2026-08-01",
      novo_horario: "09:00",
    });
    expect(comHora).toBe("01/08/2026 às 09:00");

    const semHora = renderTemplate("{{nova_data}}{{novo_horario}}", {
      nova_data: "2026-08-01",
    });
    expect(semHora).toBe("01/08/2026");
  });
});

describe("Contrato: helpers temporais base", () => {
  it("formatarDataBR é estável para ISO", () => {
    expect(formatarDataBR("2026-12-25")).toBe("25/12/2026");
  });

  it("diffDiasCalendario compara dias de calendário no fuso oficial", () => {
    const agora = new Date("2026-06-24T23:30:00-03:00");
    expect(diffDiasCalendario("2026-06-24", agora)).toBe(0);
    expect(diffDiasCalendario("2026-06-25", agora)).toBe(1);
    expect(diffDiasCalendario("2026-06-23", agora)).toBe(-1);
  });
});
