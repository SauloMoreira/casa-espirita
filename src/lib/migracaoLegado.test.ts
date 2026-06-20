import { describe, it, expect } from "vitest";
import {
  validateTratamentoLegado,
  buildAssistidoLegadoInsert,
  buildVinculoLegadoInsert,
  buildProximaSessaoInsert,
  isStatusValido,
  statusPermiteProximaSessao,
  type TratamentoLegadoInput,
} from "./migracaoLegado";

const futuro = (offsetDays: number, weekdayTarget?: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  if (weekdayTarget !== undefined) {
    while (d.getDay() !== weekdayTarget) d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
};

const baseInput = (over: Partial<TratamentoLegadoInput> = {}): TratamentoLegadoInput => ({
  tratamento_id: "t1",
  status: "em_andamento",
  quantidade_total: 10,
  quantidade_realizada: 4,
  ...over,
});

describe("status helpers", () => {
  it("identifica status válidos", () => {
    expect(isStatusValido("em_andamento")).toBe(true);
    expect(isStatusValido("inexistente")).toBe(false);
  });
  it("controla compatibilidade de próxima sessão", () => {
    expect(statusPermiteProximaSessao("liberado")).toBe(true);
    expect(statusPermiteProximaSessao("concluido")).toBe(false);
    expect(statusPermiteProximaSessao("cancelado")).toBe(false);
  });
});

describe("validateTratamentoLegado", () => {
  it("aceita payload coerente sem próxima sessão", () => {
    expect(validateTratamentoLegado(baseInput())).toEqual([]);
  });

  it("rejeita realizada > total", () => {
    const errs = validateTratamentoLegado(baseInput({ quantidade_realizada: 12 }));
    expect(errs.some((e) => /realizada não pode ser maior/.test(e))).toBe(true);
  });

  it("rejeita status inválido", () => {
    const errs = validateTratamentoLegado(baseInput({ status: "xpto" }));
    expect(errs.some((e) => /Status de tratamento inválido/.test(e))).toBe(true);
  });

  it("bloqueia próxima sessão em status incompatível sem confirmação", () => {
    const errs = validateTratamentoLegado(
      baseInput({ status: "suspenso", proxima_sessao_data: futuro(7) }),
    );
    expect(errs.some((e) => /não permite agendar/.test(e))).toBe(true);
  });

  it("permite próxima sessão em status incompatível com confirmação", () => {
    const errs = validateTratamentoLegado(
      baseInput({ status: "suspenso", proxima_sessao_data: futuro(7) }),
      { confirmarStatusIncompativel: true },
    );
    expect(errs.some((e) => /não permite agendar/.test(e))).toBe(false);
  });

  it("rejeita data no passado", () => {
    const errs = validateTratamentoLegado(
      baseInput({ proxima_sessao_data: "2020-01-01" }),
    );
    expect(errs.some((e) => /passado/.test(e))).toBe(true);
  });

  it("valida coerência com dia_semana", () => {
    const data = futuro(3, 1); // segunda-feira
    const okMonday = validateTratamentoLegado(
      baseInput({ proxima_sessao_data: data }),
      { diaSemana: 1 },
    );
    expect(okMonday).toEqual([]);
    const errWrong = validateTratamentoLegado(
      baseInput({ proxima_sessao_data: data }),
      { diaSemana: 3 },
    );
    expect(errWrong.some((e) => /deve cair em/.test(e))).toBe(true);
  });

  it("bloqueia colisão com sessão futura sem confirmação", () => {
    const data = futuro(7);
    const errs = validateTratamentoLegado(
      baseInput({ proxima_sessao_data: data }),
      { sessoesFuturas: [data] },
    );
    expect(errs.some((e) => /sessão futura/.test(e))).toBe(true);
    const ok = validateTratamentoLegado(
      baseInput({ proxima_sessao_data: data }),
      { sessoesFuturas: [data], confirmarColisaoSessaoFutura: true },
    );
    expect(ok.some((e) => /sessão futura/.test(e))).toBe(false);
  });

  it("bloqueia duplicidade de vínculo ativo sem confirmação", () => {
    const errs = validateTratamentoLegado(baseInput(), { vinculoAtivoExistente: true });
    expect(errs.some((e) => /vínculo ativo/.test(e))).toBe(true);
    const ok = validateTratamentoLegado(baseInput(), {
      vinculoAtivoExistente: true,
      confirmarDuplicidade: true,
    });
    expect(ok.some((e) => /vínculo ativo/.test(e))).toBe(false);
  });
});

describe("builders", () => {
  it("monta assistido legado com flags corretas", () => {
    const payload = buildAssistidoLegadoInsert(
      { nome: "  Maria  ", cpf: "123.456.789-00", celular: "(11) 99999-8888", estado: "sp" },
      { userId: "u1", dataMigracao: "2026-06-20T00:00:00Z", observacaoMigracao: "Veio da rotina manual" },
    );
    expect(payload.origem_cadastro).toBe("legado");
    expect(payload.migrado_legado).toBe(true);
    expect(payload.status).toBe("em_tratamento");
    expect(payload.nome).toBe("Maria");
    expect(payload.cpf).toBe("12345678900");
    expect(payload.celular).toBe("11999998888");
    expect(payload.estado).toBe("SP");
    expect(payload.created_by).toBe("u1");
  });

  it("monta vínculo legado sem entrevista", () => {
    const v = buildVinculoLegadoInsert("a1", baseInput({ observacao: "já em desobsessão" }), "u1");
    expect(v.entrevista_id).toBeNull();
    expect(v.origem).toBe("legado");
    expect(v.status).toBe("em_andamento");
    expect(v.quantidade_total).toBe(10);
    expect(v.quantidade_realizada).toBe(4);
    expect(v.observacao_migracao).toBe("já em desobsessão");
  });

  it("não monta próxima sessão sem data", () => {
    expect(buildProximaSessaoInsert("a1", "v1", baseInput(), "u1")).toBeNull();
  });

  it("monta próxima sessão agendada quando há data", () => {
    const data = futuro(7);
    const row = buildProximaSessaoInsert(
      "a1",
      "v1",
      baseInput({ proxima_sessao_data: data, proxima_sessao_horario: "19:30" }),
      "u1",
    );
    expect(row).not.toBeNull();
    expect(row!.status).toBe("agendado");
    expect(row!.data_sessao).toBe(data);
    expect(row!.horario).toBe("19:30");
  });
});
