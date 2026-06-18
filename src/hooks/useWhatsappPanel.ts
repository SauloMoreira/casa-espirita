import { useCallback, useEffect, useState } from "react";
import { getPainelWhatsapp, type PainelWhatsapp } from "@/services/notificacoes/notificacoesService";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface UseWhatsappPanel {
  data: PainelWhatsapp | null;
  loading: boolean;
  error: string | null;
  inicio: string;
  fim: string;
  setInicio: (v: string) => void;
  setFim: (v: string) => void;
  reload: () => void;
}

/** Carrega indicadores operacionais e de impacto do canal WhatsApp. */
export function useWhatsappPanel(defaultDias = 14): UseWhatsappPanel {
  const [inicio, setInicio] = useState<string>(isoDaysAgo(defaultDias));
  const [fim, setFim] = useState<string>(isoToday());
  const [data, setData] = useState<PainelWhatsapp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPainelWhatsapp(inicio, fim);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [inicio, fim]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, inicio, fim, setInicio, setFim, reload };
}
