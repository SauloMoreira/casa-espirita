import { describe, it, expect } from "vitest";
import {
  JANELAS_OBSERVABILIDADE,
  JANELA_PADRAO,
  ehJanelaValida,
  rotuloOrigem,
  rotuloStatusFila,
  rotuloMotivoObservabilidade,
  rotuloDiagnostico,
  somaQtd,
  SCHEMA_VERSION_SUPORTADA,
  type ObservabilidadePayload,
} from "@/lib/observabilidade";

/**
 * P1.2 — Contratos de governança da Observabilidade Operacional.
 *
 * INV-OBS-001 — Indicadores operacionais são somente leitura, derivados de
 * fontes canônicas do backend, e nunca disparam efeito colateral.
 *
 * Esta suíte protege o CONTRATO do payload e a regra "UI só traduz" — não
 * recalcula indicador. Falha aqui = regressão de contrato/governança.
 */
describe("P1.2 — contrato de janela temporal", () => {
  it("oferece exatamente 24h / 7d / 30d e default 7d", () => {
    expect([...JANELAS_OBSERVABILIDADE]).toEqual(["24h", "7d", "30d"]);
    expect(JANELA_PADRAO).toBe("7d");
  });

  it("valida janelas conhecidas e rejeita desconhecidas", () => {
    expect(ehJanelaValida("24h")).toBe(true);
    expect(ehJanelaValida("7d")).toBe(true);
    expect(ehJanelaValida("30d")).toBe(true);
    expect(ehJanelaValida("90d")).toBe(false);
    expect(ehJanelaValida("")).toBe(false);
  });
});

describe("P1.2 — UI apenas traduz código→rótulo (sem cálculo)", () => {
  it("traduz origens conhecidas e devolve o próprio código se desconhecida", () => {
    expect(rotuloOrigem("automatico")).toBe("Automático");
    expect(rotuloOrigem("manual")).toBe("Manual");
    expect(rotuloOrigem("excecao")).toBe("Exceção");
    expect(rotuloOrigem("origem_nova_backend")).toBe("origem_nova_backend");
  });

  it("traduz status da fila e mantém código desconhecido", () => {
    expect(rotuloStatusFila("falha")).toBe("Falha");
    expect(rotuloStatusFila("status_novo")).toBe("status_novo");
  });

  it("traduz motivo do histórico, com 'desconhecido' explícito e fallback seguro", () => {
    expect(rotuloMotivoObservabilidade("desconhecido")).toBe("Sem motivo registrado");
    expect(rotuloMotivoObservabilidade("codigo_inexistente_xyz")).toBe(
      "codigo_inexistente_xyz",
    );
  });

  it("traduz diagnóstico de pendência reusando o catálogo canônico (L-02)", () => {
    expect(rotuloDiagnostico("aguardando_janela")).toBe("Aguardando janela de envio");
    expect(rotuloDiagnostico("aguardando_limite_diario")).toBe("Aguardando limite diário");
  });
});

describe("P1.2 — comportamento de vazio e shape", () => {
  it("soma de listas vazias é 0 (vazio = sem ocorrência, nunca erro)", () => {
    expect(somaQtd([])).toBe(0);
    expect(somaQtd([{ qtd: 2 }, { qtd: 3 }])).toBe(5);
  });

  it("payload válido tem metadados, snapshot completo e histórico podendo ser vazio", () => {
    const payload: ObservabilidadePayload = {
      schema_version: SCHEMA_VERSION_SUPORTADA,
      generated_at: new Date().toISOString(),
      snapshot_reference_time: new Date().toISOString(),
      historical_window: { code: "7d", from: "x", to: "y" },
      snapshot: {
        pendencias_por_status: [],
        aguardando_janela_limite: [],
        avisos_ausencia: { abertos: 0, em_tratamento: 0 },
        anomalias_lembrete_por_vinculo: [],
        inconsistencias_agenda_fila: [],
      },
      historico: {
        falhas_por_motivo: [],
        saneados_por_motivo: [],
        distribuicao_por_origem: [],
      },
    };

    // metadados mínimos autoexplicativos
    expect(payload.schema_version).toBe(1);
    expect(payload.historical_window.code).toBe("7d");
    expect(typeof payload.snapshot_reference_time).toBe("string");
    expect(typeof payload.generated_at).toBe("string");

    // snapshot sempre tem o shape completo (todas as chaves presentes)
    expect(payload.snapshot.avisos_ausencia).toHaveProperty("abertos");
    expect(payload.snapshot.avisos_ausencia).toHaveProperty("em_tratamento");

    // blocos históricos podem ser listas vazias — tratado como "sem ocorrência"
    expect(payload.historico.falhas_por_motivo).toEqual([]);
    expect(payload.historico.saneados_por_motivo).toEqual([]);
    expect(payload.historico.distribuicao_por_origem).toEqual([]);
  });
});
