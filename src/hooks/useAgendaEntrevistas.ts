import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchEntrevistasNoRange } from "@/services/agenda/agendaEntrevistas";
import { AGENDA_DEFAULT_FILTERS } from "@/constants/agenda";
import type {
  AgendaDateRange,
  AgendaEntrevistador,
  AgendaFilterState,
  AgendaViewMode,
  EntrevistaAgendaItem,
} from "@/types/agenda";

/**
 * Domain hook for the Agenda page. Owns view mode, current period, filters,
 * data loading and all derived state (date range, filtering, grouping, title).
 * Keeps the page declarative and testable. Data source is unchanged: real
 * scheduled interviews from entrevistas_fraternas.
 */
export function useAgendaEntrevistas() {
  const isMobile = useIsMobile();
  const [entrevistas, setEntrevistas] = useState<EntrevistaAgendaItem[]>([]);
  const [entrevistadores, setEntrevistadores] = useState<AgendaEntrevistador[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<AgendaViewMode>(isMobile ? "dia" : "semana");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<AgendaFilterState>(AGENDA_DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntrevista, setSelectedEntrevista] = useState<EntrevistaAgendaItem | null>(null);

  const setFilter = useCallback(
    <K extends keyof AgendaFilterState>(key: K, value: AgendaFilterState[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const dateRange = useMemo<AgendaDateRange>(() => {
    if (viewMode === "dia") return { start: currentDate, end: currentDate };
    if (viewMode === "semana") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    return {
      start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
    };
  }, [viewMode, currentDate]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEntrevistasNoRange(dateRange)
      .then((data) => {
        if (!active) return;
        setEntrevistas(data.entrevistas);
        setEntrevistadores(data.entrevistadores);
      })
      .catch((err) => {
        console.error("Erro ao buscar entrevistas:", err);
        if (active) {
          setEntrevistas([]);
          setEntrevistadores([]);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dateRange]);

  const filtered = useMemo(() => {
    const { searchAssistido, status, entrevistador, tipo } = filters;
    return entrevistas.filter((e) => {
      if (searchAssistido && !e.assistido_nome.toLowerCase().includes(searchAssistido.toLowerCase())) return false;
      if (status === "todas_ativas" && e.status === "cancelada") return false;
      if (status !== "todas_ativas" && status !== "todos" && e.status !== status) return false;
      if (entrevistador !== "todos" && e.entrevistador_id !== entrevistador) return false;
      if (tipo !== "todos" && e.tipo_entrevista !== tipo) return false;
      return true;
    });
  }, [entrevistas, filters]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, EntrevistaAgendaItem[]>();
    filtered.forEach((e) => {
      const key = format(parseISO(e.data), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [filtered]);

  const navigatePrev = useCallback(() => {
    setCurrentDate((d) =>
      viewMode === "dia" ? subDays(d, 1) : viewMode === "semana" ? subWeeks(d, 1) : subMonths(d, 1),
    );
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    setCurrentDate((d) =>
      viewMode === "dia" ? addDays(d, 1) : viewMode === "semana" ? addWeeks(d, 1) : addMonths(d, 1),
    );
  }, [viewMode]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const title = useMemo(() => {
    if (viewMode === "dia") return format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "dd/MM")} — ${format(end, "dd/MM/yyyy")}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [viewMode, currentDate]);

  return {
    isMobile,
    loading,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    filters,
    setFilter,
    showFilters,
    setShowFilters,
    entrevistadores,
    dateRange,
    filtered,
    groupedByDate,
    navigatePrev,
    navigateNext,
    goToToday,
    title,
    selectedEntrevista,
    setSelectedEntrevista,
  };
}
