import { combinarPublicacoes, type PublicacaoItem } from "@/lib/painelInstitucional";
import { listCampanhas } from "@/services/campanhas";
import { listEventos } from "@/services/eventos";
import { listAlimentosAtivos } from "@/services/acaoSocial";

export interface PainelInstitucionalDados {
  publicacoes: PublicacaoItem[];
  alimentosAtivos: number;
}

/**
 * Carrega a visão consolidada do Painel Institucional reaproveitando os
 * serviços já existentes. Não cria CRUD novo — apenas leitura para governança.
 */
export async function carregarPainelInstitucional(ref: Date = new Date()): Promise<PainelInstitucionalDados> {
  const [campanhas, eventos, alimentos] = await Promise.all([
    listCampanhas(),
    listEventos(),
    listAlimentosAtivos(),
  ]);
  return {
    publicacoes: combinarPublicacoes(campanhas, eventos, ref),
    alimentosAtivos: alimentos.length,
  };
}
