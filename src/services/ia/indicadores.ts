import { supabase } from "@/integrations/supabase/client";
import { aggregateIndicadores } from "@/lib/iaAssertividade";
import type { IaIndicadores } from "@/types/ia";

/** Busca sugestões e feedbacks e devolve os indicadores agregados de assertividade. */
export async function fetchIndicadoresIA(): Promise<IaIndicadores> {
  const [{ data: sugestoes }, { data: feedbacks }] = await Promise.all([
    supabase
      .from("ia_sugestoes")
      .select("id, created_at, status, tratamentos_sugeridos_json, queixas_identificadas_json")
      .order("created_at", { ascending: true }),
    supabase
      .from("ia_feedback")
      .select("sugestao_ia_id, classificacao, atribuicao_final_json"),
  ]);

  return aggregateIndicadores(sugestoes ?? [], feedbacks ?? []);
}
