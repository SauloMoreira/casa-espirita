import { describe, it, expect } from "vitest";
import {
  projetarAgendaConsolidada,
  isTratamentoPublicoLivre,
  ocorrenciaContaParaTratamentoPublico,
  type TratamentoProjecaoInput,
} from "@/lib/agendaRules";

const tipo = (dia: number, horario: string) => ({
  dia_semana: dia,
  horario,
  frequencia_valor: 1,
  frequencia_unidade: "semanas",
});

// Base: sábado 20/06/2026, espelhando o caso piloto Ana Carmen.
const BASE = new Date("2026-06-20T12:00:00");

describe("projetarAgendaConsolidada — encadeamento sequencial bloqueante", () => {
  it("encadeia tratamentos sequenciais por ordem, sem sobreposição de datas", () => {
    const tratamentos: TratamentoProjecaoInput[] = [
      // concluído: não gera agenda e não avança a cadeia
      {
        ref: "desob",
        tratamento_id: "t1",
        status: "concluido",
        quantidade_total: 7,
        quantidade_realizada: 7,
        modo_agendamento: "sequencial_bloqueante",
        ordem_tratamento: 1,
        tipo: tipo(3, "19:00"),
      },
      {
        ref: "anti",
        tratamento_id: "t2",
        status: "em_andamento",
        quantidade_total: 7,
        quantidade_realizada: 2,
        modo_agendamento: "sequencial_bloqueante",
        ordem_tratamento: 2,
        tipo: tipo(2, "19:00"),
      },
      {
        ref: "mag",
        tratamento_id: "t3",
        status: "aguardando_inicio",
        quantidade_total: 7,
        quantidade_realizada: 0,
        modo_agendamento: "sequencial_bloqueante",
        ordem_tratamento: 3,
        tipo: tipo(1, "19:00"),
      },
      {
        ref: "cura",
        tratamento_id: "t4",
        status: "aguardando_inicio",
        quantidade_total: 7,
        quantidade_realizada: 0,
        modo_agendamento: "sequencial_bloqueante",
        ordem_tratamento: 4,
        tipo: tipo(1, "18:00"),
      },
      {
        ref: "evang",
        tratamento_id: "t5",
        status: "aguardando_inicio",
        quantidade_total: 7,
        quantidade_realizada: 0,
        modo_agendamento: "livre_concomitante",
        ordem_tratamento: 5,
        tipo: tipo(5, "19:00"),
      },
    ];

    const res = projetarAgendaConsolidada(tratamentos, BASE);
    const byRef = Object.fromEntries(res.map((r) => [r.ref, r]));

    // Desobsessão concluída → sem agenda
    expect(byRef.desob.sessoes).toHaveLength(0);

    // Anti-Goécia: 5 restantes a partir da próxima terça
    expect(byRef.anti.sessoes.map((s) => s.data_sessao)).toEqual([
      "2026-06-23",
      "2026-06-30",
      "2026-07-07",
      "2026-07-14",
      "2026-07-21",
    ]);

    // Magnetismo: encadeado APÓS o término do Anti-Goécia (21/07)
    expect(byRef.mag.sessoes[0].data_sessao).toBe("2026-07-27");
    expect(byRef.mag.sessoes).toHaveLength(7);
    expect(byRef.mag.sessoes[6].data_sessao).toBe("2026-09-07");

    // Cura: encadeada APÓS o término do Magnetismo (07/09)
    expect(byRef.cura.sessoes[0].data_sessao).toBe("2026-09-14");
    expect(byRef.cura.sessoes[6].data_sessao).toBe("2026-10-26");

    // Evangelhoterapia (livre): independente, a partir da base
    expect(byRef.evang.sessoes[0].data_sessao).toBe("2026-06-26");
  });

  it("não gera agenda para tratamentos concluídos/cancelados", () => {
    const res = projetarAgendaConsolidada(
      [
        {
          ref: "c",
          tratamento_id: "x",
          status: "cancelado",
          quantidade_total: 7,
          quantidade_realizada: 0,
          modo_agendamento: "sequencial_bloqueante",
          ordem_tratamento: 1,
          tipo: tipo(2, "19:00"),
        },
      ],
      BASE,
    );
    expect(res[0].geraAgenda).toBe(false);
    expect(res[0].sessoes).toHaveLength(0);
  });
});

const publico = (over: Partial<TratamentoProjecaoInput> = {}): TratamentoProjecaoInput => ({
  ref: "evang",
  tratamento_id: "tev",
  status: "em_andamento",
  quantidade_total: 10,
  quantidade_realizada: 2,
  modo_agendamento: "livre_concomitante",
  ordem_tratamento: 9,
  tipo: tipo(5, "19:00"), // sexta
  trabalhoPublico: true,
  permiteEntradaSemAgendamento: true,
  ...over,
});

describe("isTratamentoPublicoLivre — detecção apenas por metadados", () => {
  it("detecta público livre por flags estruturais (sem hardcode)", () => {
    expect(
      isTratamentoPublicoLivre({
        modo_agendamento: "livre_concomitante",
        trabalhoPublico: true,
        permiteEntradaSemAgendamento: true,
      }),
    ).toBe(true);
  });
  it("não detecta quando falta qualquer flag ou modo difere", () => {
    expect(
      isTratamentoPublicoLivre({ modo_agendamento: "livre_concomitante", trabalhoPublico: true }),
    ).toBe(false);
    expect(
      isTratamentoPublicoLivre({
        modo_agendamento: "sequencial_bloqueante",
        trabalhoPublico: true,
        permiteEntradaSemAgendamento: true,
      }),
    ).toBe(false);
  });
});

describe("tratamento público livre com sugestões", () => {
  it("não gera agenda rígida; libera desde a base e sugere após a cadeia bloqueante", () => {
    const tratamentos: TratamentoProjecaoInput[] = [
      {
        ref: "anti",
        tratamento_id: "t2",
        status: "em_andamento",
        quantidade_total: 7,
        quantidade_realizada: 2,
        modo_agendamento: "sequencial_bloqueante",
        ordem_tratamento: 2,
        tipo: tipo(2, "19:00"),
      },
      publico(),
    ];
    const res = projetarAgendaConsolidada(tratamentos, BASE);
    const ev = res.find((r) => r.ref === "evang")!;

    expect(ev.geraAgenda).toBe(false);
    expect(ev.sessoes).toHaveLength(0);
    expect(ev.tratamentoPublicoComSugestao).toBe(true);
    expect(ev.liberadoParaComparecimento).toBe(true);
    expect(ev.liberadoDesde).toBe("2026-06-20");
    // Anti-Goécia termina 21/07 (terça); marco posterior → primeira sexta válida
    expect(ev.sugestoesAPartirDe).toBe("2026-07-24");
    expect(ev.sugestoes!.length).toBeGreaterThan(0);
    expect(ev.sugestoes![0].data_sessao).toBe("2026-07-24");
  });

  it("sem cadeia bloqueante aplicável, sugestões nascem da base resolvida", () => {
    const res = projetarAgendaConsolidada([publico()], BASE);
    const ev = res[0];
    expect(ev.tratamentoPublicoComSugestao).toBe(true);
    // Primeira sexta em/após a base (sáb 20/06) → 26/06
    expect(ev.sugestoesAPartirDe).toBe("2026-06-26");
  });

  it("não sugere quando concluído (restante 0)", () => {
    const res = projetarAgendaConsolidada(
      [publico({ status: "concluido", quantidade_realizada: 10 })],
      BASE,
    );
    expect(res[0].sugestoes).toHaveLength(0);
    expect(res[0].sugestoesAPartirDe).toBeNull();
  });
});

describe("ocorrenciaContaParaTratamentoPublico — predicado de progresso", () => {
  const baseOco = {
    ocorrencia_id: "o1",
    tratamento_id: "tev",
    assistido_tratamento_id: "v1",
    data_ocorrencia: "2026-06-26",
    vinculadaAoTrabalhoPublico: true,
  };
  const args = { tratamentoId: "tev", liberadoDesde: "2026-06-20", vinculoId: "v1" };

  it("conta presença válida do próprio tratamento após liberação", () => {
    expect(ocorrenciaContaParaTratamentoPublico({ ocorrencia: baseOco, ...args })).toBe(true);
  });
  it("não conta palestra/evento genérico não vinculado", () => {
    expect(
      ocorrenciaContaParaTratamentoPublico({
        ocorrencia: { ...baseOco, vinculadaAoTrabalhoPublico: false },
        ...args,
      }),
    ).toBe(false);
  });
  it("não conta ocorrência de outro tratamento", () => {
    expect(
      ocorrenciaContaParaTratamentoPublico({
        ocorrencia: { ...baseOco, tratamento_id: "outro" },
        ...args,
      }),
    ).toBe(false);
  });
  it("não conta antes da liberação", () => {
    expect(
      ocorrenciaContaParaTratamentoPublico({
        ocorrencia: { ...baseOco, data_ocorrencia: "2026-06-10" },
        ...args,
      }),
    ).toBe(false);
  });
  it("não conta consumo duplicado da mesma ocorrência", () => {
    expect(
      ocorrenciaContaParaTratamentoPublico({
        ocorrencia: baseOco,
        ...args,
        consumidas: new Set(["o1"]),
      }),
    ).toBe(false);
  });
});

