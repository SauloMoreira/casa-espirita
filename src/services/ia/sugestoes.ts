import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { computeDiferencas, classifyAderencia } from "@/lib/iaAssertividade";
import type {
  IaClassificacao,
  IaTratamentoAtribuido,
  IaTratamentoSugerido,
} from "@/types/ia";

/**
 * Registra a decisão final humana para uma sugestão da IA: calcula as
 * diferenças, classifica a aderência automaticamente (refletindo o que o
 * humano efetivamente fez) e grava o feedback supervisionado.
 */
export async function recordDecisaoFinal(params: {
  sugestaoId: string;
  avaliadorId: string;
  sugeridos: IaTratamentoSugerido[];
  atribuidos: IaTratamentoAtribuido[];
  classificacao?: IaClassificacao;
  motivo?: string | null;
  observacao?: string | null;
}): Promise<void> {
  const diff = computeDiferencas(params.sugeridos, params.atribuidos);
  const classificacao =
    params.classificacao ?? classifyAderencia(diff, params.sugeridos.length);

  const { error } = await supabase.from("ia_feedback").insert({
    sugestao_ia_id: params.sugestaoId,
    avaliador_id: params.avaliadorId,
    classificacao,
    sugestao_original_json: params.sugeridos as never,
    atribuicao_final_json: params.atribuidos as never,
    diferencas_json: diff as never,
    motivo_ajuste: params.motivo ?? null,
    observacao: params.observacao ?? null,
  });
  if (error) throw error;

  await supabase
    .from("ia_sugestoes")
    .update({ status: "avaliada" })
    .eq("id", params.sugestaoId);
}
