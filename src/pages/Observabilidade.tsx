import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Clock,
  CalendarX,
  GitBranch,
  History,
} from "lucide-react";
import { useObservabilidade } from "@/hooks/useObservabilidade";
import {
  JANELAS_OBSERVABILIDADE,
  JANELA_LABEL,
  rotuloOrigem,
  rotuloStatusFila,
  rotuloMotivoObservabilidade,
  rotuloDiagnostico,
  somaQtd,
  SCHEMA_VERSION_SUPORTADA,
  type JanelaObservabilidade,
  type DiagnosticoContagem,
} from "@/lib/observabilidade";
import { rotuloDiagnosticoPendencia } from "@/lib/notificacaoElegibilidade";

/** Lista simples código→qtd; trata vazio como "sem ocorrência", nunca erro. */
function ListaContagem({
  itens,
  rotulo,
  vazioLabel = "Sem ocorrências no período.",
}: {
  itens: ReadonlyArray<{ qtd: number }>;
  rotulo: (item: never) => string;
  vazioLabel?: string;
}) {
  if (!itens || itens.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazioLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {itens.map((item, idx) => (
        <li
          key={idx}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
        >
          <span className="text-sm">{rotulo(item as never)}</span>
          <Badge variant="secondary" className="tabular-nums">
            {item.qtd}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default function Observabilidade() {
  const { janela, setJanela, data, isLoading, isFetching, isError, refetch } =
    useObservabilidade();

  const snapshot = data?.snapshot;
  const historico = data?.historico;

  const totalAnomalias = snapshot?.anomalias_lembrete_por_vinculo.length ?? 0;
  const totalInconsistencias = snapshot?.inconsistencias_agenda_fila.length ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Observabilidade Operacional
            </h1>
            <p className="text-sm text-muted-foreground">
              Saúde do pipeline de notificações, avisos e agenda — somente leitura.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={janela}
            onValueChange={(v) => setJanela(v as JanelaObservabilidade)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JANELAS_OBSERVABILIDADE.map((j) => (
                <SelectItem key={j} value={j}>
                  {JANELA_LABEL[j]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Não foi possível carregar os indicadores. Tente atualizar.
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ===================== SNAPSHOT ATUAL ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-medium">Snapshot atual</h2>
              <span className="text-xs text-muted-foreground">
                estado em {new Date(data.snapshot_reference_time).toLocaleString("pt-BR")}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pendências por status</CardTitle>
                  <CardDescription>Itens atuais na fila de notificações.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ListaContagem
                    itens={snapshot!.pendencias_por_status}
                    rotulo={(i: { status: string }) => rotuloStatusFila(i.status)}
                    vazioLabel="Fila vazia."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Aguardando janela / limite</CardTitle>
                  <CardDescription>Diagnóstico de itens pendentes (L-02).</CardDescription>
                </CardHeader>
                <CardContent>
                  <ListaContagem
                    itens={snapshot!.aguardando_janela_limite}
                    rotulo={(i: DiagnosticoContagem) =>
                      rotuloDiagnostico(i.motivo_codigo)
                    }
                    vazioLabel="Nenhum item aguardando."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarX className="h-4 w-4" /> Avisos de ausência
                  </CardTitle>
                  <CardDescription>Abertos e em tratamento agora.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">Abertos</span>
                    <Badge variant="destructive">{snapshot!.avisos_ausencia.abertos}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">Em tratamento</span>
                    <Badge>{snapshot!.avisos_ausencia.em_tratamento}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Anomalias de lembrete</CardTitle>
                  <CardDescription>
                    Mais de 1 lembrete ativo por vínculo (INV-FILA-002).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {totalAnomalias === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma anomalia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {snapshot!.anomalias_lembrete_por_vinculo.map((a) => (
                        <li
                          key={`${a.assistido_id}-${a.evento}`}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {a.assistido_id.slice(0, 8)}… · {rotuloStatusFila(a.evento)}
                          </span>
                          <Badge variant="destructive">{a.qtd}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" /> Inconsistências agenda × fila
                  </CardTitle>
                  <CardDescription>
                    Itens ativos sem compromisso válido correspondente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {totalInconsistencias === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma inconsistência detectada.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {snapshot!.inconsistencias_agenda_fila.map((i) => (
                        <li
                          key={i.fila_id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {i.fila_id.slice(0, 8)}…
                          </span>
                          <Badge variant="outline">
                            {rotuloMotivoObservabilidade(i.motivo_codigo)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ===================== HISTÓRICO POR PERÍODO ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-medium">Histórico — {JANELA_LABEL[janela]}</h2>
              <span className="text-xs text-muted-foreground">
                o que aconteceu na janela
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Falhas por motivo</CardTitle>
                  <CardDescription>
                    Total {somaQtd(historico!.falhas_por_motivo)} no período.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ListaContagem
                    itens={historico!.falhas_por_motivo}
                    rotulo={(i: DiagnosticoContagem) =>
                      rotuloMotivoObservabilidade(i.motivo_codigo)
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Saneados por motivo</CardTitle>
                  <CardDescription>
                    Total {somaQtd(historico!.saneados_por_motivo)} no período.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ListaContagem
                    itens={historico!.saneados_por_motivo}
                    rotulo={(i: DiagnosticoContagem) =>
                      rotuloMotivoObservabilidade(i.motivo_codigo)
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Distribuição por origem</CardTitle>
                  <CardDescription>
                    Itens criados no período (total {somaQtd(historico!.distribuicao_por_origem)}).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ListaContagem
                    itens={historico!.distribuicao_por_origem}
                    rotulo={(i: { origem: string }) => rotuloOrigem(i.origem)}
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            schema v{data.schema_version}
            {data.schema_version !== SCHEMA_VERSION_SUPORTADA &&
              " (versão diferente da suportada pelo painel)"}{" "}
            · gerado em {new Date(data.generated_at).toLocaleString("pt-BR")}
          </p>
        </>
      )}
    </div>
  );
}
