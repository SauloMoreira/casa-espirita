import { describe, it, expect } from "vitest";
import {
  NOTIF_STATUS,
  NOTIF_STATUS_VALORES,
  NOTIF_CANAL,
  NOTIF_CANAL_VALORES,
  NOTIF_EVENTO,
  NOTIF_EVENTO_SET,
  isNotifEvento,
} from "@/constants/notificacoes";
import {
  EVENTOS_OPERACIONAIS,
} from "@/lib/comunicacaoCanal";
import {
  EVENTOS_SESSAO,
  EVENTOS_ENTREVISTA,
  EVENTOS_EXCECAO,
  EVENTO_MENSAGEM_MANUAL,
  type DiagnosticoPendencia,
  rotuloDiagnosticoPendencia,
} from "@/lib/notificacaoElegibilidade";
import {
  STATUS_AVISO_LABELS,
  type StatusAviso,
} from "@/services/avisos/avisosAusenciaService";

/**
 * Q1-B3 — Paridade PURA dos contratos de status operacionais remanescentes.
 *
 * Trava o conjunto canônico espelhado do banco (notif_status, notif_evento,
 * notif_canal) e garante que os subconjuntos de finalidade sejam ⊂ NOTIF_EVENTO.
 * A paridade REAL contra pg_enum/CHECK vive em src/test/integration/db.
 */

// Allowlists documentadas (espelho do banco — Q1-B3-INVENTARIO.md §1).
const ESPERADO_NOTIF_STATUS = [
  "pendente",
  "agendado",
  "enviado",
  "falha",
  "cancelado",
].sort();

const ESPERADO_NOTIF_CANAL = ["whatsapp"].sort();

const ESPERADO_NOTIF_EVENTO = [
  "entrevista_criada",
  "entrevista_lembrete",
  "sessao_criada",
  "sessao_lembrete",
  "remarcacao",
  "cancelamento",
  "presenca_registrada",
  "falta_registrada",
  "sessao_cancelada_por_excecao",
  "sessao_remarcada_por_excecao",
  "entrevista_cancelada_por_excecao",
  "entrevista_remarcada_por_excecao",
  "publico_cancelado_por_excecao",
  "publico_remarcado_por_excecao",
  "mensagem_manual",
  "aviso_ausencia_recebido",
].sort();

describe("Q1-B3 — notif_status canônico", () => {
  it("reflete exatamente os valores reais do banco", () => {
    expect([...NOTIF_STATUS_VALORES].sort()).toEqual(ESPERADO_NOTIF_STATUS);
  });

  it("expõe constante nomeada para cada valor", () => {
    expect(Object.values(NOTIF_STATUS).sort()).toEqual(ESPERADO_NOTIF_STATUS);
  });
});

describe("Q1-B3 — notif_canal canônico", () => {
  it("reflete exatamente o(s) valor(es) real(is) do banco", () => {
    expect([...NOTIF_CANAL_VALORES].sort()).toEqual(ESPERADO_NOTIF_CANAL);
  });

  it("whatsapp é o canal único conhecido", () => {
    expect(NOTIF_CANAL.whatsapp).toBe("whatsapp");
  });
});

describe("Q1-B3 — notif_evento canônico", () => {
  it("reflete exatamente os 16 valores reais do banco", () => {
    expect([...NOTIF_EVENTO].sort()).toEqual(ESPERADO_NOTIF_EVENTO);
    expect(NOTIF_EVENTO.length).toBe(16);
  });

  it("inclui aviso_ausencia_recebido (antes ausente em TS)", () => {
    expect(NOTIF_EVENTO_SET.has("aviso_ausencia_recebido")).toBe(true);
    expect(isNotifEvento("aviso_ausencia_recebido")).toBe(true);
  });

  it("isNotifEvento rejeita valores desconhecidos/vazios", () => {
    expect(isNotifEvento(null)).toBe(false);
    expect(isNotifEvento(undefined)).toBe(false);
    expect(isNotifEvento("")).toBe(false);
    expect(isNotifEvento("evento_inexistente")).toBe(false);
  });

  it("subconjuntos de finalidade são ⊂ NOTIF_EVENTO (trava de regressão)", () => {
    const subconjuntos: readonly string[] = [
      ...EVENTOS_OPERACIONAIS,
      ...EVENTOS_SESSAO,
      ...EVENTOS_ENTREVISTA,
      ...EVENTOS_EXCECAO,
      EVENTO_MENSAGEM_MANUAL,
    ];
    for (const ev of subconjuntos) {
      expect(NOTIF_EVENTO_SET.has(ev)).toBe(true);
    }
  });
});

describe("Q1-B3 — DiagnosticoPendencia (contrato existente, reforço de teste)", () => {
  const classesBase: DiagnosticoPendencia[] = [
    "agendado_futuro",
    "aguardando_janela",
    "aguardando_limite_diario",
    "opt_out",
    "comunicacao_geral_desativada",
    "sem_telefone",
    "pendente",
  ];

  it("toda classe base produz rótulo, descrição e tom", () => {
    for (const codigo of classesBase) {
      const r = rotuloDiagnosticoPendencia(codigo);
      expect(r).not.toBeNull();
      expect(r!.label.length).toBeGreaterThan(0);
      expect(r!.descricao.length).toBeGreaterThan(0);
      expect(["neutro", "espera", "atencao", "bloqueio"]).toContain(r!.tom);
    }
  });

  it("bloqueado_inelegivel:<motivo> é tratado como bloqueio", () => {
    const r = rotuloDiagnosticoPendencia("bloqueado_inelegivel:sessao_cancelada");
    expect(r).not.toBeNull();
    expect(r!.tom).toBe("bloqueio");
  });
});

describe("Q1-B3 — StatusAviso (contrato existente, reforço de teste)", () => {
  const esperado: StatusAviso[] = ["aberto", "em_tratamento", "resolvido", "descartado"];

  it("possui rótulo para cada status do CHECK avisos_ausencia.status", () => {
    expect(Object.keys(STATUS_AVISO_LABELS).sort()).toEqual([...esperado].sort());
    for (const s of esperado) {
      expect(STATUS_AVISO_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});
