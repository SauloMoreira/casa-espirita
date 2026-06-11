import { useCallback, useEffect, useState } from "react";
import { fetchFaltasPorPeriodo } from "@/services/relatorios/faltas";
import type { FaltasResult, RelatorioPresencaFiltros } from "@/types/relatorios";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const EMPTY: FaltasResult = {
  rows: [],
  totais: { totalFaltas: 0, assistidosComFalta: 0, pctMedio: 0, vinculosComFalta: 0 },
  registros: 0,
};

/** Hook do relatório de Faltas por Período com paginação real server-side. */
export function useFaltasPorPeriodo(filtros: RelatorioPresencaFiltros) {
  const [data, setData] = useState<FaltasResult>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.assistidoId, filtros.tarefeiroId, filtros.coordenadorId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchFaltasPorPeriodo(filtros, { page, pageSize })
      .then((res) => { if (active) setData(res); })
      .catch(() => { if (active) setData(EMPTY); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.assistidoId, filtros.tarefeiroId, filtros.coordenadorId, page, pageSize]);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return { data, page, pageSize, loading, setPage, onPageSizeChange };
}
