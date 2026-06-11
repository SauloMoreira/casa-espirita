import { describe, it, expect } from "vitest";
import {
  computeDiferencas,
  classifyAderencia,
  aggregateIndicadores,
  type SugestaoRow,
  type FeedbackRow,
} from "./iaAssertividade";
import type { IaTratamentoSugerido, IaTratamentoAtribuido } from "@/types/ia";

const sug = (id: string, nome: string, q: number): IaTratamentoSugerido => ({
  tratamento_id: id,
  nome,
  quantidade: q,
});
const atr = (id: string, nome: string, q: number): IaTratamentoAtribuido => ({
  tratamento_id: id,
  nome,
  quantidade: q,
});

describe("computeDiferencas", () => {
  it("identifica tratamento mantido com mesma quantidade", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], [atr("a", "Passe", 5)]);
    expect(d.mantidos).toHaveLength(1);
    expect(d.adicionados).toHaveLength(0);
    expect(d.removidos).toHaveLength(0);
    expect(d.alterados).toHaveLength(0);
  });

  it("detecta alteração de quantidade", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], [atr("a", "Passe", 8)]);
    expect(d.alterados).toEqual([{ tratamento_id: "a", nome: "Passe", de: 5, para: 8 }]);
    expect(d.mantidos).toHaveLength(0);
  });

  it("detecta adicionados e removidos", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], [atr("b", "Água", 3)]);
    expect(d.adicionados.map((x) => x.tratamento_id)).toEqual(["b"]);
    expect(d.removidos.map((x) => x.tratamento_id)).toEqual(["a"]);
  });
});

describe("classifyAderencia", () => {
  it("sem uso quando nada atribuído", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], []);
    expect(classifyAderencia(d, 1)).toBe("sem uso");
  });

  it("inconclusiva quando IA não sugeriu nada mas houve atribuição", () => {
    const d = computeDiferencas([], [atr("a", "Passe", 5)]);
    expect(classifyAderencia(d, 0)).toBe("inconclusiva");
  });

  it("acertou totalmente quando tudo coincide", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], [atr("a", "Passe", 5)]);
    expect(classifyAderencia(d, 1)).toBe("acertou totalmente");
  });

  it("inadequada quando não há interseção", () => {
    const d = computeDiferencas([sug("a", "Passe", 5)], [atr("b", "Água", 3)]);
    expect(classifyAderencia(d, 1)).toBe("inadequada");
  });

  it("acertou parcialmente quando há ajustes mas mantém algo", () => {
    const d = computeDiferencas(
      [sug("a", "Passe", 5), sug("b", "Água", 2)],
      [atr("a", "Passe", 8)],
    );
    expect(classifyAderencia(d, 2)).toBe("acertou parcialmente");
  });
});

describe("aggregateIndicadores", () => {
  const sugestoes: SugestaoRow[] = [
    {
      id: "s1",
      created_at: "2026-01-10T10:00:00Z",
      tratamentos_sugeridos_json: [{ nome: "Passe" }, { nome: "Água" }],
      queixas_identificadas_json: [{ nome: "Ansiedade" }],
    },
    {
      id: "s2",
      created_at: "2026-02-05T10:00:00Z",
      tratamentos_sugeridos_json: [{ nome: "Passe" }],
      queixas_identificadas_json: [{ nome: "Ansiedade" }],
    },
    {
      id: "s3",
      created_at: "2026-02-20T10:00:00Z",
      tratamentos_sugeridos_json: [{ nome: "Passe" }],
      queixas_identificadas_json: [{ nome: "Insônia" }],
    },
  ];
  const feedbacks: FeedbackRow[] = [
    { sugestao_ia_id: "s1", classificacao: "acertou totalmente", atribuicao_final_json: [{ nome: "Passe" }, { nome: "Água" }] },
    { sugestao_ia_id: "s2", classificacao: "inadequada", atribuicao_final_json: [{ nome: "Água" }] },
  ];

  it("conta totais e taxas", () => {
    const r = aggregateIndicadores(sugestoes, feedbacks);
    expect(r.totalSugestoes).toBe(3);
    expect(r.avaliadas).toBe(2);
    expect(r.pendentes).toBe(1);
    expect(r.aderenciaTotal).toBe(1);
    expect(r.divergencia).toBe(1);
    expect(r.taxaAderenciaTotal).toBe(50);
  });

  it("ranqueia tratamentos sugeridos x atribuídos", () => {
    const r = aggregateIndicadores(sugestoes, feedbacks);
    expect(r.tratamentosMaisSugeridos[0]).toEqual({ nome: "Passe", total: 3 });
    expect(r.tratamentosMaisAtribuidos.find((t) => t.nome === "Água")?.total).toBe(2);
  });

  it("calcula acerto e divergência por queixa", () => {
    const r = aggregateIndicadores(sugestoes, feedbacks);
    const ansiedade = r.queixasMaiorAcerto.find((q) => q.nome === "Ansiedade");
    expect(ansiedade?.total).toBe(2);
    expect(ansiedade?.acertos).toBe(1);
    const div = r.queixasMaiorDivergencia.find((q) => q.nome === "Ansiedade");
    expect(div?.divergencias).toBe(1);
  });

  it("gera evolução por mês ordenada", () => {
    const r = aggregateIndicadores(sugestoes, feedbacks);
    expect(r.evolucao.map((e) => e.periodo)).toEqual(["2026-01", "2026-02"]);
    expect(r.evolucao[0].sugestoes).toBe(1);
    expect(r.evolucao[1].sugestoes).toBe(2);
  });
});
