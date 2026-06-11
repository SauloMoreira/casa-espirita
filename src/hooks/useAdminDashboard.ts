import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  fetchAdminDashboard,
  fetchAguardandoList,
  getPeriodRange,
} from "@/services/dashboard/adminDashboard";
import type {
  AdminDashboardData,
  DashboardAguardandoItem,
  DashboardGraficoSerie,
  DashboardPendencia,
  DashboardPresencaSerie,
  PeriodKey,
} from "@/types/adminDashboard";

const EMPTY: AdminDashboardData = {
  range: getPeriodRange("mes"),
  assistidosTotal: 0,
  tratAtivos: 0,
  tratConcluidos: 0,
  entAgendadas: 0,
  presencasHoje: 0,
  listaEspera: 0,
  aguardandoAgend: 0,
  faltasMes: 0,
  publicoPalestras: 0,
  entRecentes: [],
  tratPorTipo: [],
  cargaTarefeiros: [],
  presencaPontos: [],
  entrevistasPorTipo: { regulares: 0, livres: 0, realizadas: 0, total: 0 },
  faixaEtaria: [],
};

/**
 * Domain hook for the Admin Dashboard. Owns period selection, data loading,
 * light derived state and the "aguardando agendamento" dialog. All heavy
 * aggregation now happens server-side (RPC `dashboard_admin`).
 */
export function useAdminDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<AdminDashboardData>(EMPTY);

  const [aguardandoOpen, setAguardandoOpen] = useState(false);
  const [aguardandoList, setAguardandoList] = useState<DashboardAguardandoItem[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminDashboard(period)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((e) => active && setError(e as Error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const openAguardando = useCallback(async () => {
    const list = await fetchAguardandoList();
    setAguardandoList(list);
    setAguardandoOpen(true);
  }, []);

  /* ------------------------------ Derived ------------------------------- */
  const ageData = data.faixaEtaria;

  const topAge = useMemo(
    () => ageData.reduce((a, b) => (b.value > a.value ? b : a), { name: "—", value: 0 }),
    [ageData],
  );

  const bottomAge = useMemo(
    () =>
      ageData
        .filter((a) => a.name !== "Não informado")
        .reduce((a, b) => (b.value < a.value ? b : a), { name: "—", value: Infinity }),
    [ageData],
  );

  const presenceChart = useMemo<DashboardPresencaSerie[]>(
    () =>
      data.presencaPontos.map((p) => ({
        data: format(new Date(p.data + "T12:00:00"), "dd/MM", { locale: ptBR }),
        Presenças: p.presentes,
        Ausências: p.ausentes,
      })),
    [data.presencaPontos],
  );

  const entrevistasPorTipo = data.entrevistasPorTipo;

  const funnel = useMemo<DashboardGraficoSerie[]>(
    () => [
      { name: "Cadastrados", value: data.assistidosTotal },
      { name: "Entrevistados", value: entrevistasPorTipo.realizadas },
      { name: "Em Tratamento", value: data.tratAtivos },
      { name: "Aguardando", value: data.aguardandoAgend },
      { name: "Concluídos", value: data.tratConcluidos },
    ],
    [data.assistidosTotal, data.tratAtivos, data.tratConcluidos, data.aguardandoAgend, entrevistasPorTipo.realizadas],
  );

  const pendencias = useMemo<DashboardPendencia[]>(() => {
    const list: DashboardPendencia[] = [];
    if (data.aguardandoAgend > 0)
      list.push({ tipo: "aguardando", label: "Assistidos aguardando agendamento", count: data.aguardandoAgend });
    if (data.listaEspera > 0)
      list.push({ tipo: "lista_espera", label: "Itens na lista de espera", count: data.listaEspera });
    if (data.faltasMes > 0)
      list.push({ tipo: "faltas", label: "Faltas no período", count: data.faltasMes });
    return list;
  }, [data.aguardandoAgend, data.listaEspera, data.faltasMes]);

  const topTrat = data.tratPorTipo[0];
  const bottomTrat = data.tratPorTipo[data.tratPorTipo.length - 1];
  const topTarefeiro = data.cargaTarefeiros[0];

  const aiDashboardData = useMemo(
    () => ({
      totalAssistidos: data.assistidosTotal,
      tratAtivos: data.tratAtivos,
      tratConcluidos: data.tratConcluidos,
      entAgendadas: data.entAgendadas,
      presencasHoje: data.presencasHoje,
      listaEspera: data.listaEspera,
      faltasMes: data.faltasMes,
      aguardandoAgend: data.aguardandoAgend,
      publicoPalestras: data.publicoPalestras,
      periodo: `${data.range.start} a ${data.range.end}`,
      faixaEtaria: ageData,
      tratPorTipo: data.tratPorTipo,
      cargaTarefeiros: data.cargaTarefeiros,
      entrevistasPorTipo,
    }),
    [data, ageData, entrevistasPorTipo],
  );

  return {
    period,
    setPeriod,
    loading,
    error,
    data,
    // derived
    ageData,
    topAge,
    bottomAge,
    presenceChart,
    entrevistasPorTipo,
    funnel,
    pendencias,
    topTrat,
    bottomTrat,
    topTarefeiro,
    aiDashboardData,
    // aguardando dialog
    aguardandoOpen,
    setAguardandoOpen,
    aguardandoList,
    openAguardando,
  };
}
