import { describe, it, expect } from "vitest";
import {
  parseRegrasAlerta,
  avaliarGatilho,
  houvePioraRelevante,
  deveEnviarAlerta,
  montarMensagemAlerta,
  construirSnapshot,
  REGRAS_ALERTA_DEFAULT,
  type RegrasAlertaCentral,
  type FilaSnapshot,
} from "./centralAlerta";

const regras: RegrasAlertaCentral = {
  ativo: true,
  minutosPendencia: 10,
  minPendencias: 2,
  cooldownMin: 30,
  pioraMinutos: 5,
};

describe("parseRegrasAlerta", () => {
  it("usa defaults quando não há linhas", () => {
    expect(parseRegrasAlerta([])).toEqual(REGRAS_ALERTA_DEFAULT);
  });

  it("interpreta valores e considera central_alerta_ativo desativado", () => {
    const r = parseRegrasAlerta([
      { chave: "central_alerta_ativo", valor: "true", ativo: false },
      { chave: "central_alerta_minutos_pendencia", valor: "15", ativo: true },
      { chave: "central_alerta_min_pendencias", valor: "3", ativo: true },
    ]);
    expect(r.ativo).toBe(false); // ativo=false na regra desliga
    expect(r.minutosPendencia).toBe(15);
    expect(r.minPendencias).toBe(3);
  });

  it("ativa quando valor=true e ativo=true", () => {
    const r = parseRegrasAlerta([{ chave: "central_alerta_ativo", valor: "true", ativo: true }]);
    expect(r.ativo).toBe(true);
  });
});

describe("avaliarGatilho", () => {
  it("não dispara com fila vazia", () => {
    expect(avaliarGatilho({ total_pendentes: 0, idade_mais_antiga_min: 0 }, regras).disparar).toBe(false);
  });

  it("não dispara abaixo dos limites", () => {
    const r = avaliarGatilho({ total_pendentes: 1, idade_mais_antiga_min: 5 }, regras);
    expect(r.disparar).toBe(false);
  });

  it("dispara por tempo (mais antiga > limite)", () => {
    const r = avaliarGatilho({ total_pendentes: 1, idade_mais_antiga_min: 11 }, regras);
    expect(r.disparar).toBe(true);
    expect(r.motivo).toBe("tempo");
  });

  it("dispara por volume (>= mínimo de pendências)", () => {
    const r = avaliarGatilho({ total_pendentes: 2, idade_mais_antiga_min: 3 }, regras);
    expect(r.disparar).toBe(true);
    expect(r.motivo).toBe("volume");
  });

  it("dispara por tempo+volume", () => {
    const r = avaliarGatilho({ total_pendentes: 3, idade_mais_antiga_min: 20 }, regras);
    expect(r.motivo).toBe("tempo+volume");
  });

  it("não dispara quando regras inativas", () => {
    const r = avaliarGatilho({ total_pendentes: 5, idade_mais_antiga_min: 30 }, { ...regras, ativo: false });
    expect(r.disparar).toBe(false);
  });
});

describe("houvePioraRelevante", () => {
  const base: FilaSnapshot = { total_pendentes: 2, idade_mais_antiga_min: 12, gerado_em: new Date().toISOString() };

  it("considera piora quando não há snapshot", () => {
    expect(houvePioraRelevante({ total_pendentes: 1, idade_mais_antiga_min: 1 }, null, regras)).toBe(true);
  });

  it("piora por aumento de pendências", () => {
    expect(houvePioraRelevante({ total_pendentes: 3, idade_mais_antiga_min: 12 }, base, regras)).toBe(true);
  });

  it("piora por aumento de idade >= limiar", () => {
    expect(houvePioraRelevante({ total_pendentes: 2, idade_mais_antiga_min: 17 }, base, regras)).toBe(true);
  });

  it("não piora com mudança pequena", () => {
    expect(houvePioraRelevante({ total_pendentes: 2, idade_mais_antiga_min: 14 }, base, regras)).toBe(false);
  });
});

describe("deveEnviarAlerta (cooldown + idempotência)", () => {
  const agora = new Date("2026-06-20T12:00:00Z");
  const gatilho = { disparar: true as const, motivo: "volume" as const };

  it("não envia se gatilho não dispara", () => {
    expect(
      deveEnviarAlerta({
        estado: { total_pendentes: 2, idade_mais_antiga_min: 12 },
        gatilho: { disparar: false, motivo: null },
        ultimoAlertaEm: null,
        ultimoSnapshot: null,
        regras,
        agora,
      }),
    ).toBe(false);
  });

  it("envia quando nunca houve alerta", () => {
    expect(
      deveEnviarAlerta({
        estado: { total_pendentes: 2, idade_mais_antiga_min: 12 },
        gatilho,
        ultimoAlertaEm: null,
        ultimoSnapshot: null,
        regras,
        agora,
      }),
    ).toBe(true);
  });

  it("NÃO reenvia dentro do cooldown sem piora (idempotência no mesmo estado)", () => {
    const snap: FilaSnapshot = { total_pendentes: 2, idade_mais_antiga_min: 12, gerado_em: "2026-06-20T11:50:00Z" };
    expect(
      deveEnviarAlerta({
        estado: { total_pendentes: 2, idade_mais_antiga_min: 12 },
        gatilho,
        ultimoAlertaEm: "2026-06-20T11:50:00Z", // 10 min atrás, cooldown 30
        ultimoSnapshot: snap,
        regras,
        agora,
      }),
    ).toBe(false);
  });

  it("reenvia dentro do cooldown se houver piora relevante", () => {
    const snap: FilaSnapshot = { total_pendentes: 2, idade_mais_antiga_min: 12, gerado_em: "2026-06-20T11:50:00Z" };
    expect(
      deveEnviarAlerta({
        estado: { total_pendentes: 4, idade_mais_antiga_min: 12 },
        gatilho,
        ultimoAlertaEm: "2026-06-20T11:50:00Z",
        ultimoSnapshot: snap,
        regras,
        agora,
      }),
    ).toBe(true);
  });

  it("reenvia após o cooldown com fila ainda pendente", () => {
    const snap: FilaSnapshot = { total_pendentes: 2, idade_mais_antiga_min: 12, gerado_em: "2026-06-20T11:20:00Z" };
    expect(
      deveEnviarAlerta({
        estado: { total_pendentes: 2, idade_mais_antiga_min: 12 },
        gatilho,
        ultimoAlertaEm: "2026-06-20T11:20:00Z", // 40 min atrás
        ultimoSnapshot: snap,
        regras,
        agora,
      }),
    ).toBe(true);
  });
});

describe("montarMensagemAlerta", () => {
  it("monta mensagem consolidada sem dados sensíveis", () => {
    const msg = montarMensagemAlerta({ total_pendentes: 3, idade_mais_antiga_min: 12 });
    expect(msg).toContain("3 conversas");
    expect(msg).toContain("12 min");
    expect(msg).toContain("Central");
  });

  it("usa singular para 1 conversa", () => {
    const msg = montarMensagemAlerta({ total_pendentes: 1, idade_mais_antiga_min: 11 });
    expect(msg).toContain("1 conversa ");
  });
});

describe("construirSnapshot", () => {
  it("inclui campos mínimos", () => {
    const agora = new Date("2026-06-20T12:00:00Z");
    const snap = construirSnapshot({ total_pendentes: 2, idade_mais_antiga_min: 12 }, "volume", agora);
    expect(snap.total_pendentes).toBe(2);
    expect(snap.idade_mais_antiga_min).toBe(12);
    expect(snap.gerado_em).toBe("2026-06-20T12:00:00.000Z");
    expect(snap.motivo_disparo).toBe("volume");
  });
});
