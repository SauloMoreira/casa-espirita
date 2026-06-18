import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPainelWhatsappV2,
  type PainelV2,
  type PainelV2Filtros,
} from "@/services/notificacoes/notificacoesService";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export type RangePreset = "diario" | "semanal" | "mensal" | "custom";

const PRESET_DIAS: Record<Exclude<RangePreset, "custom">, number> = {
  diario: 0,
  semanal: 6,
  mensal: 29,
};

export interface UseWhatsappPanelV2 {
  data: PainelV2 | null;
  loading: boolean;
  error: string | null;
  inicio: string;
  fim: string;
  preset: RangePreset;
  filtros: PainelV2Filtros;
  setPreset: (p: RangePreset) => void;
  setInicio: (v: string) => void;
  setFim: (v: string) => void;
  setFiltro: <K extends keyof PainelV2Filtros>(k: K, v: PainelV2Filtros[K]) => void;
  resetFiltros: () => void;
  reload: () => void;
}

/** Carrega o painel completo de métricas do WhatsApp com presets e filtros. */
export function useWhatsappPanelV2(defaultPreset: RangePreset = "semanal"): UseWhatsappPanelV2 {
  const initialDias = defaultPreset === "custom" ? 6 : PRESET_DIAS[defaultPreset];
  const [preset, setPresetState] = useState<RangePreset>(defaultPreset);
  const [inicio, setInicio] = useState<string>(isoDaysAgo(initialDias));
  const [fim, setFim] = useState<string>(isoToday());
  const [filtros, setFiltros] = useState<PainelV2Filtros>({});
  const [data, setData] = useState<PainelV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setPreset = useCallback((p: RangePreset) => {
    setPresetState(p);
    if (p !== "custom") {
      setInicio(isoDaysAgo(PRESET_DIAS[p]));
      setFim(isoToday());
    }
  }, []);

  const setFiltro = useCallback<UseWhatsappPanelV2["setFiltro"]>((k, v) => {
    setFiltros((prev) => ({ ...prev, [k]: v }));
  }, []);

  const resetFiltros = useCallback(() => setFiltros({}), []);

  const filtrosKey = useMemo(() => JSON.stringify(filtros), [filtros]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPainelWhatsappV2(inicio, fim, filtros);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, filtrosKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    data, loading, error, inicio, fim, preset, filtros,
    setPreset, setInicio, setFim, setFiltro, resetFiltros, reload,
  };
}
