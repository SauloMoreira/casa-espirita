import { describe, it, expect } from "vitest";
import {
  combinarPublicacoes,
  filtrarPublicacoes,
  resumoPublicacoes,
  ordenarPublicacoes,
  statusLabel,
  periodoLabel,
  mapCampanha,
  mapEvento,
  FILTRO_PADRAO,
  type PublicacaoItem,
} from "@/lib/painelInstitucional";
import type { Campanha } from "@/lib/campanhas";
import type { Evento } from "@/lib/eventos";

const REF = new Date("2026-06-15T12:00:00Z");

function campanha(p: Partial<Campanha>): Campanha {
  return {
    id: "c1", titulo: "Campanha", subtitulo: null, descricao_curta: null,
    descricao_completa: null, imagem_url: null, imagem_origem: null,
    imagem_otimizada: false, imagem_atualizada_em: null, imagem_atualizada_por: null,
    ordem: 0, destaque: false, data_inicio: null, data_fim: null, ativo: true,
    created_at: "", updated_at: "", ...p,
  } as Campanha;
}

function evento(p: Partial<Evento>): Evento {
  return {
    id: "e1", titulo: "Evento", subtitulo: null, descricao_curta: null,
    descricao_completa: null, imagem_url: null, imagem_origem: null,
    imagem_otimizada: false, imagem_atualizada_em: null, imagem_atualizada_por: null,
    local: null, data_evento: null, data_evento_fim: null,
    ordem: 0, destaque: false, data_inicio: null, data_fim: null, ativo: true,
    created_at: "", updated_at: "", ...p,
  } as Evento;
}

describe("painelInstitucional", () => {
  it("mapeia campanha vigente corretamente", () => {
    const item = mapCampanha(campanha({ ativo: true, data_inicio: "2026-06-01", data_fim: "2026-06-30" }), REF);
    expect(item.tipo).toBe("campanha");
    expect(item.vigente).toBe(true);
    expect(item.status).toBe("vigente");
  });

  it("marca ativo fora do período", () => {
    const item = mapCampanha(campanha({ ativo: true, data_inicio: "2026-07-01" }), REF);
    expect(item.vigente).toBe(false);
    expect(item.status).toBe("fora_periodo");
  });

  it("marca inativo independentemente do período", () => {
    const item = mapEvento(evento({ ativo: false, data_inicio: "2026-06-01", data_fim: "2026-06-30" }), REF);
    expect(item.status).toBe("inativo");
    expect(item.vigente).toBe(false);
  });

  it("combina e ordena com destaque e vigência primeiro", () => {
    const itens = combinarPublicacoes(
      [campanha({ id: "c1", titulo: "B", destaque: false }), campanha({ id: "c2", titulo: "A", destaque: true })],
      [evento({ id: "e1", titulo: "Ev", ativo: false })],
      REF,
    );
    expect(itens[0].id).toBe("c2"); // destaque primeiro
    expect(itens[itens.length - 1].id).toBe("e1"); // inativo por último
  });

  it("ordenarPublicacoes usa ordem como desempate", () => {
    const base: PublicacaoItem = mapCampanha(campanha({}), REF);
    const a = { ...base, id: "a", ordem: 2, titulo: "A" };
    const b = { ...base, id: "b", ordem: 1, titulo: "B" };
    expect(ordenarPublicacoes([a, b])[0].id).toBe("b");
  });

  it("filtra por tipo", () => {
    const itens = combinarPublicacoes([campanha({})], [evento({})], REF);
    expect(filtrarPublicacoes(itens, { ...FILTRO_PADRAO, tipo: "evento" })).toHaveLength(1);
    expect(filtrarPublicacoes(itens, { ...FILTRO_PADRAO, tipo: "evento" })[0].tipo).toBe("evento");
  });

  it("filtra por status inativo e por destaque", () => {
    const itens = combinarPublicacoes(
      [campanha({ id: "c1", ativo: true, destaque: true }), campanha({ id: "c2", ativo: false })],
      [],
      REF,
    );
    expect(filtrarPublicacoes(itens, { ...FILTRO_PADRAO, status: "inativo" }).map((i) => i.id)).toEqual(["c2"]);
    expect(filtrarPublicacoes(itens, { ...FILTRO_PADRAO, apenasDestaque: true }).map((i) => i.id)).toEqual(["c1"]);
  });

  it("filtra apenas vigentes", () => {
    const itens = combinarPublicacoes(
      [campanha({ id: "c1", ativo: true }), campanha({ id: "c2", ativo: true, data_inicio: "2026-07-01" })],
      [],
      REF,
    );
    expect(filtrarPublicacoes(itens, { ...FILTRO_PADRAO, apenasVigentes: true }).map((i) => i.id)).toEqual(["c1"]);
  });

  it("calcula resumo", () => {
    const itens = combinarPublicacoes(
      [campanha({ id: "c1", ativo: true, destaque: true }), campanha({ id: "c2", ativo: false })],
      [evento({ id: "e1", ativo: true, data_inicio: "2026-07-01" })],
      REF,
    );
    const r = resumoPublicacoes(itens);
    expect(r.campanhasAtivas).toBe(1);
    expect(r.eventosAtivos).toBe(1);
    expect(r.destaquesAtivos).toBe(1);
    expect(r.vigentesHoje).toBe(1); // só c1 (e1 está fora do período)
  });

  it("formata status e período", () => {
    expect(statusLabel("fora_periodo")).toBe("Ativo fora do período");
    expect(periodoLabel({ data_inicio: null, data_fim: null })).toBe("Sem prazo definido");
    expect(periodoLabel({ data_inicio: "2026-06-10", data_fim: null })).toContain("A partir de");
    expect(periodoLabel({ data_inicio: "2026-06-10", data_fim: "2026-06-30" })).toContain("–");
  });
});
