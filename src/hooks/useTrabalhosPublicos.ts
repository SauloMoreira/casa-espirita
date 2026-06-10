/**
 * Domain hook for the Public Works analytics report. Loads the full real
 * check-in history once, exposes filters and recomputes the analytics view
 * model (pure) whenever filters change.
 */
import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicCheckins,
  fetchTrabalhosPublicos,
} from "@/services/relatorios/trabalhosPublicos";
import { computePublicWorksAnalytics } from "@/lib/trabalhosPublicos";
import type {
  PublicCheckinRecord,
  PublicWorksFilters,
} from "@/types/trabalhosPublicos";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};

export const defaultPublicWorksFilters = (): PublicWorksFilters => ({
  dataInicio: startOfMonth(),
  dataFim: new Date().toISOString().split("T")[0],
  tratamentoId: "todos",
  faixa: "todos",
  tipoParticipante: "todos",
  modoCheckin: "todos",
});

export function useTrabalhosPublicos() {
  const [records, setRecords] = useState<PublicCheckinRecord[]>([]);
  const [trabalhos, setTrabalhos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PublicWorksFilters>(defaultPublicWorksFilters());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchPublicCheckins(), fetchTrabalhosPublicos()])
      .then(([recs, trabs]) => {
        if (!active) return;
        setRecords(recs);
        setTrabalhos(trabs);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const analytics = useMemo(
    () => computePublicWorksAnalytics(records, filters),
    [records, filters],
  );

  const setFilter = <K extends keyof PublicWorksFilters>(key: K, value: PublicWorksFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return { loading, filters, setFilter, trabalhos, analytics };
}
