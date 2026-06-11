import { useState, useEffect, useCallback } from "react";
import { fetchIndicadoresIA } from "@/services/ia/indicadores";
import type { IaIndicadores } from "@/types/ia";

const EMPTY: IaIndicadores = {
  totalSugestoes: 0,
  avaliadas: 0,
  pendentes: 0,
  aderenciaTotal: 0,
  aderenciaParcial: 0,
  divergencia: 0,
  inconclusiva: 0,
  semUso: 0,
  taxaAderenciaTotal: 0,
  taxaAderenciaParcial: 0,
  taxaDivergencia: 0,
  tratamentosMaisSugeridos: [],
  tratamentosMaisAtribuidos: [],
  queixasMaiorAcerto: [],
  queixasMaiorDivergencia: [],
  evolucao: [],
};

export function useIaIndicadores() {
  const [data, setData] = useState<IaIndicadores>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIndicadoresIA());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar indicadores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
