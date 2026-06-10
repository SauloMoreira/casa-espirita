import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildAgeDistribution } from "@/lib/ageGroups";
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
  EntrevistasPorTipo,
  PeriodKey,
} from "@/types/adminDashboard";

const EMPTY: AdminDashboardData = {
  range: getPeriodRange("mes"),
  assistidos: [],
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
  presencas: [],
  cargaTarefeiros: [],
  entrevistas: [],
};

/**
 * Domain hook for the Admin Dashboard. Owns period selection, data loading,
 * derived/aggregated state and the "aguardando agendamento" dialog. Keeps the
 * page component declarative and testable.
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
  const ageData = useMemo<DashboardGraficoSerie[]>(
    () => buildAgeDistribution(data.assistidos),
    [data.assistidos],
  );

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

  const presenceChart = useMemo<DashboardPresencaSerie[]>(() => {
    const map = new Map<string, { presentes: number; ausentes: number }>();
    data.presencas.forEach((p) => {
      if (!map.has(p.data)) map.set(p.data, { presentes: 0, ausentes: 0 });
      const entry = map.get(p.data)!;
      if (p.status_presenca === "presente") entry.presentes++;
      else entry.ausentes++;
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-15)
      .map(([date, v]) => ({
        data: format(new Date(date + "T12:00:00"), "dd/MM", { locale: ptBR }),
        Presenças: v.presentes,
        Ausências: v.ausentes,
      }));
  }, [data.presencas]);

  const entrevistasPorTipo = useMemo<EntrevistasPorTipo>(() => {
    let regulares = 0;
    let livres = 0;
    let realizadas = 0;
    data.entrevistas.forEach((e) => {
      if (e.tipo_entrevista === "livre") livres++;
      else regulares++;
      if (e.status === "realizada") realizadas++;
    });
    return { regulares, livres, realizadas, total: data.entrevistas.length };
  }, [data.entrevistas]);

  const funnel = useMemo<DashboardGraficoSerie[]>(
    () => [
      { name: "Cadastrados", value: data.assistidos.length },
      { name: "Entrevistados", value: entrevistasPorTipo.realizadas },
      { name: "Em Tratamento", value: data.tratAtivos },
      { name: "Aguardando", value: data.aguardandoAgend },
      { name: "Concluídos", value: data.tratConcluidos },
    ],
    [data.assistidos.length, data.tratAtivos, data.tratConcluidos, data.aguardandoAgend, entrevistasPorTipo.realizadas],
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
      totalAssistidos: data.assistidos.length,
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
