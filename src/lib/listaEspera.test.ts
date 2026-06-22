import { describe, it, expect } from "vitest";
import {
  elegibilidadeListaEspera,
  MODO_AGENDADO_POR_DATA_INICIAL,
  MODO_LIVRE_CONCOMITANTE,
  MODO_SEQUENCIAL_BLOQUEANTE,
} from "@/lib/agendaRules";

const base = {
  quantidade_total: 4,
  quantidade_realizada: 0,
  modo_agendamento: MODO_AGENDADO_POR_DATA_INICIAL,
  temSessaoFuturaValida: false,
  temEtapaAtivaValida: false,
  legado: false,
  trabalhoPublico: false,
  permiteEntradaSemAgendamento: false,
};

describe("elegibilidadeListaEspera", () => {
  it("aguardando_agendamento entra na lista", () => {
    const r = elegibilidadeListaEspera({ ...base, status: "aguardando_agendamento" });
    expect(r).toEqual({ elegivel: true, motivo: "AGUARDANDO_AGENDAMENTO" });
  });

  it("aguardando_inicio sem próxima sessão e com saldo entra", () => {
    const r = elegibilidadeListaEspera({ ...base, status: "aguardando_inicio" });
    expect(r).toEqual({
      elegivel: true,
      motivo: "AGUARDANDO_INICIO_SEM_PROXIMA_SESSAO",
    });
  });

  it("aguardando_inicio com sessão futura válida NÃO entra", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "aguardando_inicio",
      temSessaoFuturaValida: true,
    });
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBeNull();
  });

  it("tratamento concluído/cancelado/suspenso não entra", () => {
    for (const status of ["concluido", "cancelado", "suspenso"]) {
      const r = elegibilidadeListaEspera({ ...base, status });
      expect(r.elegivel).toBe(false);
    }
  });

  it("sem saldo restante não entra", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "aguardando_inicio",
      quantidade_total: 4,
      quantidade_realizada: 4,
    });
    expect(r.elegivel).toBe(false);
  });

  it("legado elegível sem agenda entra como LEGADO_SEM_AGENDA", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "em_andamento",
      legado: true,
    });
    expect(r).toEqual({ elegivel: true, motivo: "LEGADO_SEM_AGENDA" });
  });

  it("novo modelo elegível sem sessão ativa nem etapa ativa entra como PLANO_SEM_ETAPA_ATIVA", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "em_andamento",
      legado: false,
    });
    expect(r).toEqual({ elegivel: true, motivo: "PLANO_SEM_ETAPA_ATIVA" });
  });

  it("novo modelo com etapa ativa válida NÃO entra", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "em_andamento",
      temEtapaAtivaValida: true,
    });
    expect(r.elegivel).toBe(false);
  });

  it("tratamento público/livre com apenas sugestão não entra", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "aguardando_inicio",
      modo_agendamento: MODO_LIVRE_CONCOMITANTE,
      trabalhoPublico: true,
      permiteEntradaSemAgendamento: true,
    });
    expect(r.elegivel).toBe(false);
  });

  it("sessão futura inválida/substituída não exclui (flag falsa => elegível)", () => {
    // O service só marca temSessaoFuturaValida para sessões realmente válidas;
    // uma sessão substituída/cancelada mantém a flag falsa.
    const r = elegibilidadeListaEspera({
      ...base,
      status: "aguardando_inicio",
      temSessaoFuturaValida: false,
    });
    expect(r.elegivel).toBe(true);
  });

  it("caso do print: Usuario Teste / Homeopatia / aguardando_inicio / 0 de 4 / sem próxima sessão", () => {
    const r = elegibilidadeListaEspera({
      status: "aguardando_inicio",
      quantidade_total: 4,
      quantidade_realizada: 0,
      modo_agendamento: MODO_AGENDADO_POR_DATA_INICIAL,
      temSessaoFuturaValida: false,
      temEtapaAtivaValida: false,
      legado: true,
      trabalhoPublico: false,
      permiteEntradaSemAgendamento: false,
    });
    expect(r).toEqual({
      elegivel: true,
      motivo: "AGUARDANDO_INICIO_SEM_PROXIMA_SESSAO",
    });
  });

  it("sequencial bloqueado mas em estado operacional elegível entra", () => {
    const r = elegibilidadeListaEspera({
      ...base,
      status: "aguardando_inicio",
      modo_agendamento: MODO_SEQUENCIAL_BLOQUEANTE,
    });
    expect(r.elegivel).toBe(true);
  });
});
