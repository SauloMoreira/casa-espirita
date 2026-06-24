/**
 * BLOCO: Invariantes de fila e notificações (trava final do dispatch).
 *
 * Garante que a fila reflita apenas compromissos reais válidos e que o dispatch
 * funcione como trava final, barrando tudo que não corresponde mais à agenda.
 *
 * Invariantes protegidas:
 *  - INV-FILA-001 — a fila reflete apenas compromissos reais válidos
 *  - INV-FILA-006 — itens inválidos deixam de ser elegíveis antes do envio
 *  - INV-TEMPO-001 — entrevista date-only não inventa horário (vencimento por dia)
 */
import { describe, it, expect } from "vitest";
import {
  motivoInelegibilidadeLembrete,
  motivoInelegibilidadeEntrevista,
  entrevistaElegivelParaFila,
} from "@/lib/notificacaoElegibilidade";

const AGORA = new Date("2026-06-24T12:00:00-03:00");

describe("INV-FILA-006 — dispatch barra todos os estados inválidos de sessão", () => {
  const casos: Array<[string, string]> = [
    ["substituida_plano", "sessao_substituida"],
    ["cancelado", "sessao_cancelada"],
    ["remarcado", "sessao_nao_agendada"],
    ["concluido", "sessao_nao_agendada"],
  ];
  it.each(casos)("status '%s' → motivo '%s'", (status, esperado) => {
    expect(
      motivoInelegibilidadeLembrete({
        evento: "sessao_lembrete",
        existeAgenda: true,
        agendaStatus: status,
        sessaoData: "2026-07-15",
        horario: "15:00",
        ehProxima: true,
        agora: AGORA,
      }),
    ).toBe(esperado);
  });
});

describe("INV-FILA-006 — dispatch barra entrevistas inválidas", () => {
  it("entrevista inexistente é barrada", () => {
    expect(
      motivoInelegibilidadeEntrevista({
        evento: "entrevista_lembrete",
        existeEntrevista: false,
        agora: AGORA,
      }),
    ).toBe("entrevista_inexistente");
  });

  it("entrevista cancelada é barrada", () => {
    expect(
      motivoInelegibilidadeEntrevista({
        evento: "entrevista_lembrete",
        existeEntrevista: true,
        entrevistaStatus: "cancelada",
        entrevistaData: "2026-07-15",
        agora: AGORA,
      }),
    ).toBe("entrevista_cancelada");
  });

  it("lembrete com versão superada (remarcada) é barrado", () => {
    expect(
      motivoInelegibilidadeEntrevista({
        evento: "entrevista_lembrete",
        existeEntrevista: true,
        entrevistaStatus: "agendada",
        entrevistaData: "2026-07-15",
        mesmaVersao: false,
        agora: AGORA,
      }),
    ).toBe("entrevista_remarcada");
  });

  it("entrevista válida atual (mesma versão, futura) é elegível", () => {
    expect(
      entrevistaElegivelParaFila({
        evento: "entrevista_lembrete",
        existeEntrevista: true,
        entrevistaStatus: "agendada",
        entrevistaData: "2026-07-15",
        mesmaVersao: true,
        agora: AGORA,
      }),
    ).toBe(true);
  });
});

describe("INV-TEMPO-001 — entrevista date-only vence por dia, sem horário fantasma", () => {
  it("entrevista de hoje (date-only) ainda é elegível o dia inteiro", () => {
    expect(
      entrevistaElegivelParaFila({
        evento: "entrevista_lembrete",
        existeEntrevista: true,
        entrevistaStatus: "agendada",
        entrevistaData: "2026-06-24",
        agora: AGORA,
      }),
    ).toBe(true);
  });

  it("entrevista de ontem (date-only) está vencida", () => {
    expect(
      motivoInelegibilidadeEntrevista({
        evento: "entrevista_lembrete",
        existeEntrevista: true,
        entrevistaStatus: "agendada",
        entrevistaData: "2026-06-23",
        agora: AGORA,
      }),
    ).toBe("entrevista_vencida");
  });
});

describe("INV-FILA-001 — eventos fora do escopo de agenda não são barrados aqui", () => {
  it("evento manual não é avaliado pela regra de sessão", () => {
    expect(
      motivoInelegibilidadeLembrete({
        evento: "mensagem_manual",
        existeAgenda: false,
        agora: AGORA,
      }),
    ).toBeNull();
  });
});
