import { describe, it, expect } from "vitest";
import {
  tipoEventoExcecao,
  eventoExcecao,
  alvoExcecaoElegivel,
  ehEventoExcecao,
  rotuloMotivo,
} from "@/lib/notificacaoElegibilidade";
import { renderTemplate } from "@/lib/notificacoes";

// "agora" fixo: 2026-06-22 12:00 (-03:00)
const AGORA = new Date("2026-06-22T15:00:00Z");
const FUTURO = "2026-06-25";
const PASSADO = "2026-06-20";

describe("tipoEventoExcecao", () => {
  it("cancelado → cancelamento", () => {
    expect(tipoEventoExcecao("cancelado", null)).toBe("cancelamento");
  });
  it("remarcado sem nova_data → cancelamento (não finge remarcação)", () => {
    expect(tipoEventoExcecao("remarcado", null)).toBe("cancelamento");
    expect(tipoEventoExcecao("remarcado", "")).toBe("cancelamento");
  });
  it("remarcado com nova_data → remarcacao", () => {
    expect(tipoEventoExcecao("remarcado", FUTURO)).toBe("remarcacao");
  });
});

describe("eventoExcecao mapeia domínio + tipo", () => {
  it("tratamento", () => {
    expect(eventoExcecao("tratamento", "cancelamento")).toBe("sessao_cancelada_por_excecao");
    expect(eventoExcecao("tratamento", "remarcacao")).toBe("sessao_remarcada_por_excecao");
  });
  it("entrevista", () => {
    expect(eventoExcecao("entrevista", "cancelamento")).toBe("entrevista_cancelada_por_excecao");
    expect(eventoExcecao("entrevista", "remarcacao")).toBe("entrevista_remarcada_por_excecao");
  });
  it("publico", () => {
    expect(eventoExcecao("publico", "cancelamento")).toBe("publico_cancelado_por_excecao");
    expect(eventoExcecao("publico", "remarcacao")).toBe("publico_remarcado_por_excecao");
  });
});

describe("alvoExcecaoElegivel — tratamento", () => {
  const base = { dominio: "tratamento" as const, existe: true, agora: AGORA };
  it("sessão agendada futura → elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "agendado", dataCompromisso: FUTURO, horario: "19:00" })).toBe(true);
  });
  it("sessão substituída → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "substituida_plano", dataCompromisso: FUTURO })).toBe(false);
  });
  it("sessão cancelada → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "cancelado", dataCompromisso: FUTURO })).toBe(false);
  });
  it("sessão vencida → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "agendado", dataCompromisso: PASSADO, horario: "08:00" })).toBe(false);
  });
  it("sessão inexistente → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, existe: false, status: "agendado", dataCompromisso: FUTURO })).toBe(false);
  });
});

describe("alvoExcecaoElegivel — entrevista", () => {
  const base = { dominio: "entrevista" as const, existe: true, agora: AGORA };
  it("entrevista válida futura → elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "agendada", dataCompromisso: FUTURO, horario: "10:00" })).toBe(true);
  });
  it("entrevista cancelada/remarcada → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "cancelada", dataCompromisso: FUTURO })).toBe(false);
    expect(alvoExcecaoElegivel({ ...base, status: "remarcada", dataCompromisso: FUTURO })).toBe(false);
  });
  it("entrevista vencida → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "agendada", dataCompromisso: PASSADO, horario: "08:00" })).toBe(false);
  });
});

describe("alvoExcecaoElegivel — publico (sem disparo cego)", () => {
  const base = { dominio: "publico" as const, existe: true, agora: AGORA };
  it("com alvo rastreável → elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "aberta", alvoRastreavel: true })).toBe(true);
  });
  it("sem alvo rastreável → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "aberta", alvoRastreavel: false })).toBe(false);
  });
  it("sessão pública cancelada → não elegível", () => {
    expect(alvoExcecaoElegivel({ ...base, status: "cancelado", alvoRastreavel: true })).toBe(false);
  });
});

describe("ehEventoExcecao e rótulos", () => {
  it("reconhece eventos gerados por exceção", () => {
    expect(ehEventoExcecao("sessao_cancelada_por_excecao")).toBe(true);
    expect(ehEventoExcecao("publico_remarcado_por_excecao")).toBe(true);
    expect(ehEventoExcecao("sessao_lembrete")).toBe(false);
    expect(ehEventoExcecao(null)).toBe(false);
  });
  it("rotula a origem e a invalidação", () => {
    expect(rotuloMotivo("excecao_operacional")).toBe("Gerado por exceção operacional");
    expect(rotuloMotivo("sessao_remarcada_por_excecao")).toContain("Lembrete invalidado");
  });
});

describe("renderTemplate dos modelos de exceção (pt-BR, placeholders vazios somem)", () => {
  it("cancelamento de sessão", () => {
    const corpo = "Olá, {{nome}}! Sua sessão de {{tratamento}} do dia {{data}} foi cancelada por uma exceção operacional da casa.";
    expect(renderTemplate(corpo, { nome: "Ana", tratamento: "Passe", data: "2026-06-25" })).toBe(
      "Olá, Ana! Sua sessão de Passe do dia 25/06/2026 foi cancelada por uma exceção operacional da casa.",
    );
  });
  it("remarcação com novo horário", () => {
    const corpo = "Sua sessão de {{tratamento}} foi remarcada de {{data_anterior}} para {{nova_data}}{{novo_horario}}.";
    expect(renderTemplate(corpo, {
      tratamento: "Passe", data_anterior: "2026-06-25", nova_data: "2026-06-28", novo_horario: "19:00:00",
    })).toBe("Sua sessão de Passe foi remarcada de 25/06/2026 para 28/06/2026 às 19:00.");
  });
  it("remarcação sem novo horário (placeholder some)", () => {
    const corpo = "remarcada de {{data_anterior}} para {{nova_data}}{{novo_horario}}.";
    expect(renderTemplate(corpo, { data_anterior: "2026-06-25", nova_data: "2026-06-28" })).toBe(
      "remarcada de 25/06/2026 para 28/06/2026.",
    );
  });
});
