import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SlidersHorizontal,
  ShieldAlert,
  Clock,
  History,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listarParametrosOperacionais,
  atualizarParametroOperacional,
} from "@/services/configuracao/parametrosOperacionaisService";
import {
  formatarValor,
  difereDoPadrao,
  validarValor,
  houveMudanca,
  type ParametroOperacional,
} from "@/lib/parametrosOperacionais";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function GovernancaParametros() {
  const queryClient = useQueryClient();
  const { data: parametros = [], isLoading, isError } = useQuery({
    queryKey: ["parametros-operacionais"],
    queryFn: listarParametrosOperacionais,
  });

  const [alvo, setAlvo] = useState<ParametroOperacional | null>(null);
  const [novoValor, setNovoValor] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (alvo) {
      setNovoValor(alvo.valor);
      setObservacao("");
    }
  }, [alvo]);

  const mutation = useMutation({
    mutationFn: atualizarParametroOperacional,
    onSuccess: (res) => {
      toast.success("Parâmetro atualizado", {
        description: `Novo valor aplicado e registrado na auditoria.`,
      });
      queryClient.invalidateQueries({ queryKey: ["parametros-operacionais"] });
      setAlvo(null);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Falha ao atualizar parâmetro.";
      toast.error("Não foi possível alterar", { description: msg });
    },
  });

  const validacao = useMemo(() => {
    if (!alvo) return { valido: false as const };
    return validarValor(alvo, novoValor);
  }, [alvo, novoValor]);

  const mudou = alvo ? houveMudanca(alvo.valor, novoValor) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6 text-primary" />
          Governança de Parâmetros Operacionais
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Flags e parâmetros que controlam o comportamento das notificações automáticas.
          Toda alteração exige confirmação, é validada no backend e fica registrada na auditoria.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando parâmetros…
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Você não tem permissão para acessar estes parâmetros ou houve uma falha ao carregá-los.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {parametros.map((p) => {
          const isBool = p.tipo === "booleano";
          const ligado = p.valor === "true";
          return (
            <Card
              key={p.id}
              className={`glass-card ${p.sensivel ? "border-amber-500/40" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  {p.sensivel ? (
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-primary" />
                  )}
                  {p.nome_amigavel || p.chave}
                  {p.sensivel && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-[10px]">
                      Crítico
                    </Badge>
                  )}
                  {isBool ? (
                    <Badge variant={ligado ? "default" : "secondary"} className="text-[10px]">
                      {ligado ? "Ativado" : "Desativado"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {formatarValor(p)}
                    </Badge>
                  )}
                  {difereDoPadrao(p) && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Padrão: {p.valor_padrao}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground">{p.chave}</p>
                {p.impacto && (
                  <p className="text-sm text-muted-foreground">{p.impacto}</p>
                )}

                <div className="flex items-center justify-between gap-4 pt-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Última alteração: {dataHora(p.updated_at)}
                    {p.alterado_por_nome ? ` • por ${p.alterado_por_nome}` : ""}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setAlvo(p)}>
                    Alterar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de confirmação */}
      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent>
          {alvo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {alvo.confirmacao_reforcada && (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  Alterar {alvo.nome_amigavel || alvo.chave}
                </DialogTitle>
                <DialogDescription>{alvo.impacto}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
                  <p>
                    <span className="text-muted-foreground">Valor atual:</span>{" "}
                    <strong>{formatarValor(alvo)}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Novo valor:</span>{" "}
                    <strong>
                      {alvo.tipo === "booleano"
                        ? novoValor === "true"
                          ? "Ativado"
                          : "Desativado"
                        : novoValor || "—"}
                    </strong>
                  </p>
                </div>

                {alvo.tipo === "booleano" ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label>{novoValor === "true" ? "Ativado" : "Desativado"}</Label>
                    <Switch
                      checked={novoValor === "true"}
                      onCheckedChange={(v) => setNovoValor(v ? "true" : "false")}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="novo-valor">
                      Novo valor
                      {alvo.tipo === "inteiro" && alvo.valor_min != null && alvo.valor_max != null
                        ? ` (${alvo.valor_min} a ${alvo.valor_max})`
                        : ""}
                    </Label>
                    <Input
                      id="novo-valor"
                      type={alvo.tipo === "inteiro" ? "number" : "text"}
                      value={novoValor}
                      min={alvo.valor_min ?? undefined}
                      max={alvo.valor_max ?? undefined}
                      onChange={(e) => setNovoValor(e.target.value)}
                    />
                  </div>
                )}

                {!validacao.valido && novoValor !== "" && (
                  <p className="text-xs text-destructive">{validacao.erro}</p>
                )}

                {alvo.confirmacao_reforcada && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Esta é uma configuração crítica de contenção. Confirme que entende o impacto
                      operacional antes de aplicar.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="observacao">Observação (opcional)</Label>
                  <Textarea
                    id="observacao"
                    placeholder="Motivo da alteração, para a trilha de auditoria…"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setAlvo(null)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!mudou || !validacao.valido || mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      chave: alvo.chave,
                      valor: novoValor.trim(),
                      observacao,
                    })
                  }
                >
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirmar alteração
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
