import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Undo2, PackageCheck, Search } from "lucide-react";

interface EntregaRow {
  beneficiario_id: string;
  nome: string;
  celular: string | null;
  ativo: boolean;
  entrega_id: string | null;
  entregue: boolean;
  entregue_em: string | null;
}

function primeiroDiaDoMes(competenciaYYYYMM: string): string {
  // competenciaYYYYMM = "2026-07"
  return `${competenciaYYYYMM}-01`;
}

function mesAtualYYYYMM(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EntregaAcaoSocial() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [competencia, setCompetencia] = useState<string>(mesAtualYYYYMM());
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("listar_beneficiarios_para_entrega", {
      p_competencia: primeiroDiaDoMes(competencia),
    });
    setLoading(false);
    if (error) {
      toast({
        title: "Erro ao carregar beneficiários",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setLista(((data as unknown) as EntregaRow[]) || []);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((r) => r.nome.toLowerCase().includes(q));
  }, [busca, lista]);

  const totalEntregues = useMemo(
    () => lista.filter((r) => r.entregue).length,
    [lista],
  );

  const marcarEntregue = async (row: EntregaRow) => {
    setProcessandoId(row.beneficiario_id);
    const agora = new Date().toISOString();
    const { data, error } = await supabase
      .from("acao_social_entregas")
      .upsert(
        {
          beneficiario_id: row.beneficiario_id,
          competencia: primeiroDiaDoMes(competencia),
          entregue: true,
          entregue_em: agora,
          entregue_por: user?.id ?? null,
        },
        { onConflict: "beneficiario_id,competencia" },
      )
      .select("id, entregue, entregue_em")
      .single();
    setProcessandoId(null);
    if (error || !data) {
      toast({
        title: "Erro ao registrar entrega",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }
    setLista((prev) =>
      prev.map((r) =>
        r.beneficiario_id === row.beneficiario_id
          ? {
              ...r,
              entrega_id: (data as { id: string }).id,
              entregue: true,
              entregue_em: (data as { entregue_em: string | null }).entregue_em ?? agora,
            }
          : r,
      ),
    );
    toast({ title: "Entrega registrada" });
  };

  const desfazerEntrega = async (row: EntregaRow) => {
    if (!row.entrega_id) return;
    setProcessandoId(row.beneficiario_id);
    const { error } = await supabase
      .from("acao_social_entregas")
      .update({ entregue: false, entregue_em: null })
      .eq("id", row.entrega_id);
    setProcessandoId(null);
    if (error) {
      toast({
        title: "Erro ao desfazer",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setLista((prev) =>
      prev.map((r) =>
        r.beneficiario_id === row.beneficiario_id
          ? { ...r, entregue: false, entregue_em: null }
          : r,
      ),
    );
    toast({ title: "Entrega desfeita" });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <PackageCheck className="h-6 w-6 text-primary" />
          Entrega de Cesta Básica
        </h1>
        <p className="text-sm text-muted-foreground">
          Controle mensal de entrega para beneficiários ativos.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Competência
              </label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value || mesAtualYYYYMM())}
                className="w-48"
              />
            </div>
            <CardTitle className="text-base">
              {totalEntregues} de {lista.length} entregues este mês
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : listaFiltrada.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum beneficiário ativo encontrado.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {listaFiltrada.map((row) => {
                const processando = processandoId === row.beneficiario_id;
                return (
                  <div
                    key={row.beneficiario_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.celular ?? "sem celular"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.entregue ? (
                        <>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            <Check className="h-3 w-3 mr-1" />
                            Entregue{" "}
                            {row.entregue_em ? `em ${formatarDataHora(row.entregue_em)}` : ""}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={processando}
                            onClick={() => desfazerEntrega(row)}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Desfazer
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={processando}
                          onClick={() => marcarEntregue(row)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Marcar como entregue
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
