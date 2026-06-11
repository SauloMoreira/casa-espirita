import { useCallback, useEffect, useState } from "react";
import { fetchCargaTarefeiro } from "@/services/relatorios/cargaTarefeiro";
import type { CargaTarefeiroFiltros, CargaTarefeiroResult } from "@/types/relatorios";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const EMPTY: CargaTarefeiroResult = {
  rows: [],
  totais: { sessoes: 0, assistidos: 0, presencas: 0, ausencias: 0, emAndamento: 0, concluidos: 0, maiorCarga: "—" },
  registros: 0,
};

/** Hook do relatório de Carga por Tarefeiro com paginação real server-side. */
export function useCargaTarefeiro(filtros: CargaTarefeiroFiltros) {
  const [data, setData] = useState<CargaTarefeiroResult>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.tarefeiroId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCargaTarefeiro(filtros, { page, pageSize })
      .then((res) => { if (active) setData(res); })
      .catch(() => { if (active) setData(EMPTY); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filtros.dataInicio, filtros.dataFim, filtros.tratamentoId, filtros.tarefeiroId, page, pageSize]);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return { data, page, pageSize, loading, setPage, onPageSizeChange };
}
