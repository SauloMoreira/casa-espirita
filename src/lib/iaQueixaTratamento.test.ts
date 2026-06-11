import { describe, it, expect } from "vitest";
import {
  ordenarRelacoes,
  derivarTratamentosCandidatos,
  type IaRelacaoQueixaTratamento,
} from "./iaQueixaTratamento";

const rel = (
  p: Partial<IaRelacaoQueixaTratamento> & { tratamento_id: string },
): IaRelacaoQueixaTratamento => ({
  nome: p.tratamento_id,
  prioridade: "media",
  peso: 5,
  tipo_relacao: "principal",
  status: "ativo",
  ...p,
});

describe("ordenarRelacoes", () => {
  it("coloca principal antes de complementar", () => {
    const r = ordenarRelacoes([
      rel({ tratamento_id: "a", tipo_relacao: "complementar" }),
      rel({ tratamento_id: "b", tipo_relacao: "principal" }),
    ]);
    expect(r.map((x) => x.tratamento_id)).toEqual(["b", "a"]);
  });

  it("desempata por prioridade e depois por peso", () => {
    const r = ordenarRelacoes([
      rel({ tratamento_id: "a", prioridade: "media", peso: 9 }),
      rel({ tratamento_id: "b", prioridade: "alta", peso: 1 }),
      rel({ tratamento_id: "c", prioridade: "media", peso: 10 }),
    ]);
    // alta vem primeiro; entre as médias, maior peso primeiro
    expect(r.map((x) => x.tratamento_id)).toEqual(["b", "c", "a"]);
  });
});

describe("derivarTratamentosCandidatos", () => {
  it("dedup por tratamento mantendo a relação de maior peso", () => {
    const out = derivarTratamentosCandidatos([
      rel({ tratamento_id: "passe", peso: 3 }),
      rel({ tratamento_id: "passe", peso: 8 }),
      rel({ tratamento_id: "agua", peso: 5 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((t) => t.tratamento_id === "passe")?.peso).toBe(8);
  });

  it("ignora relações inativas", () => {
    const out = derivarTratamentosCandidatos([
      rel({ tratamento_id: "passe", status: "inativo" }),
      rel({ tratamento_id: "agua", status: "ativo" }),
    ]);
    expect(out.map((t) => t.tratamento_id)).toEqual(["agua"]);
  });

  it("ordena o resultado por força (principal/prioridade/peso)", () => {
    const out = derivarTratamentosCandidatos([
      rel({ tratamento_id: "comp", tipo_relacao: "complementar", peso: 10 }),
      rel({ tratamento_id: "princ", tipo_relacao: "principal", peso: 4 }),
    ]);
    expect(out[0].tratamento_id).toBe("princ");
  });
});
