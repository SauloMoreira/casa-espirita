import { useCallback, useEffect, useState } from "react";
import { fetchTratamentosConcluidos } from "@/services/relatorios/tratamentosConcluidos";
import type { TratamentosConcluidosFiltros, TratamentosConcluidosResult } from "@/types/relatorios";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const EMPTY: TratamentosConcluidosResult = {
  rows: [],
  totais: { total: 0, assistidos: 0, tipos: 0, sessoes: 0 },
  porTratamento: [],
  porTipo: [],
  registros: 0,
};

/** Hook do relatório de Tratamentos Concluídos com paginação real server-side. */
export function useTratamentosConcluidos(filtros: TratamentosConcluidosFiltros) {
  const [data, setData] = useState<TratamentosConcluidosResult>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.tipoTratamento, filtros.tarefeiroId, filtros.coordenadorId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTratamentosConcluidos(filtros, { page, pageSize })
      .then((res) => { if (active) setData(res); })
      .catch(() => { if (active) setData(EMPTY); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.tipoTratamento, filtros.tarefeiroId, filtros.coordenadorId, page, pageSize]);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return { data, page, pageSize, loading, setPage, onPageSizeChange };
}
