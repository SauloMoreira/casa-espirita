import { useCallback, useEffect, useState } from "react";
import { fetchFrequenciaPresenca } from "@/services/relatorios/frequencia";
import type { FrequenciaResult, RelatorioPresencaFiltros } from "@/types/relatorios";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const EMPTY: FrequenciaResult = {
  rows: [],
  totais: { total: 0, presencas: 0, ausencias: 0 },
  registros: 0,
};

/** Hook do relatório de Frequência de Presença com paginação real server-side. */
export function useFrequenciaPresenca(filtros: RelatorioPresencaFiltros) {
  const [data, setData] = useState<FrequenciaResult>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  // Sempre que os filtros mudam, volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.assistidoId, filtros.tarefeiroId, filtros.coordenadorId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchFrequenciaPresenca(filtros, { page, pageSize })
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
