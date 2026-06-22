import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Loader2,
  ArrowRight,
  FlaskConical,
  ShieldCheck,
  ShieldAlert,
  Eye,
  RefreshCw,
  Undo2,
  Layers,
  CalendarCheck,
  History as HistoryIcon,
  CheckCircle2,
  Sparkles,
  Lock,
  AlertTriangle,
  Phone,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  buscarAssistidos,
  carregarVisaoConsolidada,
  ROTULO_ORIGEM_PROXIMA,
  type AssistidoResumoBusca,
  type VisaoConsolidada,
  type TratamentoConsolidado,
  type SessaoConsolidada,
  type OrigemProxima,
} from "@/services/assistidos/consultaConsolidada";
import {
  obterGateHomologacao,
  gerarPreviaConversao,
  converterAssistidoParaPlano,
  avaliarSegurancaRollback,
  rollbackControladoPlano,
  reprocessarAssistidoHomologacao,
  type GateHomologacao,
  type PreviaConversao,
  type RollbackSeguranca,
} from "@/services/agendaPlano/orquestracao";

const iniciais = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const fmtData = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

/** Variante de badge por rótulo de etapa/origem (rotulagem obrigatória). */
const ORIGEM_VARIANT: Record<OrigemProxima, "default" | "secondary" | "outline"> = {
  ativa: "default",
  prevista: "secondary",
  agendada: "default",
  projetada: "secondary",
  sugestao: "outline",
  sem_proxima: "outline",
};

type ModeloEstado = "antigo" | "novo" | "homologacao";

function estadoModelo(visao: VisaoConsolidada): ModeloEstado {
  const usaPlano = visao.assistido.usa_agenda_plano;
  if (!usaPlano) return "antigo";
  const algumRealizado = visao.tratamentos.some((t) => t.etapas_realizadas > 0);
  return algumRealizado ? "novo" : "homologacao";
}

const MODELO_BADGE: Record<ModeloEstado, { label: string; variant: "default" | "secondary" | "outline" }> = {
  antigo: { label: "Modelo antigo", variant: "outline" },
  homologacao: { label: "Em homologação", variant: "secondary" },
  novo: { label: "Novo modelo (em execução)", variant: "default" },
};

export default function HomologacaoAgenda() {
  const { toast } = useToast();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<AssistidoResumoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [visao, setVisao] = useState<VisaoConsolidada | null>(null);
  const [gate, setGate] = useState<GateHomologacao | null>(null);
  const [seguranca, setSeguranca] = useState<RollbackSeguranca | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [previa, setPrevia] = useState<PreviaConversao | null>(null);
  const [previaOpen, setPreviaOpen] = useState(false);
  const [acaoEmCurso, setAcaoEmCurso] = useState<null | "previa" | "converter" | "rollback" | "reprocessar">(null);

  const carregarTudo = async (id: string) => {
    const [v, g, s] = await Promise.all([
      carregarVisaoConsolidada(id),
      obterGateHomologacao(id),
      avaliarSegurancaRollback(id),
    ]);
    setVisao(v);
    setGate(g);
    setSeguranca(s);
  };

  const handleBuscar = async (valor: string) => {
    setTermo(valor);
    setErro(null);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    try {
      setResultados(await buscarAssistidos(valor));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro na busca.");
    } finally {
      setBuscando(false);
    }
  };

  const selecionar = async (id: string) => {
    setCarregando(true);
    setErro(null);
    setResultados([]);
    setPrevia(null);
    try {
      await carregarTudo(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar assistido.");
      setVisao(null);
    } finally {
      setCarregando(false);
    }
  };

  const recarregar = async () => {
    if (!visao) return;
    try {
      await carregarTudo(visao.assistido.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao recarregar.");
    }
  };

  const handlePrevia = async () => {
    if (!visao) return;
    setAcaoEmCurso("previa");
    try {
      const p = await gerarPreviaConversao(visao.assistido.id);
      setPrevia(p);
      setPreviaOpen(true);
    } catch (e) {
      toast({ title: "Não foi possível gerar a prévia", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAcaoEmCurso(null);
    }
  };

  const handleConverter = async () => {
    if (!visao || !previa) return;
    setAcaoEmCurso("converter");
    try {
      const r = await converterAssistidoParaPlano(visao.assistido.id);
      toast({
        title: "Assistido convertido para o novo modelo",
        description: `${r.planos} plano(s) gerado(s) · ${r.sessoes_neutralizadas} sessão(ões) antiga(s) substituída(s).`,
      });
      setPrevia(null);
      setPreviaOpen(false);
      await recarregar();
    } catch (e) {
      toast({ title: "Falha na conversão", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAcaoEmCurso(null);
    }
  };

  const handleRollback = async () => {
    if (!visao) return;
    setAcaoEmCurso("rollback");
    try {
      const r = await rollbackControladoPlano(visao.assistido.id);
      toast({
        title: "Rollback concluído",
        description: `${r.etapas_removidas} etapa(s) removida(s) · ${r.sessoes_restauradas} sessão(ões) antiga(s) restaurada(s).`,
      });
      await recarregar();
    } catch (e) {
      toast({ title: "Rollback bloqueado", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAcaoEmCurso(null);
    }
  };

  const handleReprocessar = async () => {
    if (!visao) return;
    setAcaoEmCurso("reprocessar");
    try {
      await reprocessarAssistidoHomologacao(visao.assistido.id);
      toast({ title: "Reprocessamento concluído", description: "Plano reconciliado de forma idempotente." });
      await recarregar();
    } catch (e) {
      toast({ title: "Falha no reprocessamento", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAcaoEmCurso(null);
    }
  };

  const modelo = visao ? estadoModelo(visao) : null;
  const usaPlano = visao?.assistido.usa_agenda_plano === true;
  const busy = acaoEmCurso !== null;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <FlaskConical className="h-6 w-6 text-primary" /> Homologação da Agenda
        </h1>
        <p className="text-sm text-muted-foreground">
          Superfície administrativa controlada do novo modelo (plano previsto + agenda ativa +
          histórico). Prévia obrigatória, conversão pela porta única, rollback controlado e auditoria.
          <strong className="ml-1">Sem rollout global.</strong>
        </p>
      </header>

      <Card className="rounded-xl">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termo}
              onChange={(e) => handleBuscar(e.target.value)}
              placeholder="Buscar por nome, celular, CPF ou e-mail..."
              className="pl-9"
              aria-label="Buscar assistido"
            />
            {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>

          {resultados.length > 0 && (
            <div className="mt-3 divide-y rounded-lg border">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selecionar(r.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{iniciais(r.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.celular, r.email].filter(Boolean).join(" · ") || "Sem contato"}
                    </p>
                  </div>
                  {r.migrado_legado && <Badge variant="outline">Legado</Badge>}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        </CardContent>
      </Card>

      {carregando && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando assistido...
        </div>
      )}

      {visao && !carregando && gate && (
        <div className="space-y-6">
          {/* Cabeçalho + estado do modelo */}
          <Card className="rounded-xl">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
              <Avatar className="h-14 w-14">
                {visao.assistido.foto_url && <AvatarImage src={visao.assistido.foto_url} alt={visao.assistido.nome} />}
                <AvatarFallback>{iniciais(visao.assistido.nome)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{visao.assistido.nome}</h2>
                  {modelo && <Badge variant={MODELO_BADGE[modelo].variant}>{MODELO_BADGE[modelo].label}</Badge>}
                  {visao.assistido.migrado_legado && <Badge variant="outline">Legado</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {visao.assistido.celular && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {visao.assistido.celular}</span>}
                  {visao.assistido.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {visao.assistido.email}</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gate global + por assistido */}
          <div className="grid gap-3 sm:grid-cols-2">
            <GateCard
              titulo="Gate global"
              ativo={gate.global_ativo}
              descricao={gate.global_ativo
                ? "Modelo ligado globalmente."
                : "Desligado — nenhum rollout geral. O painel converte apenas assistidos selecionados."}
            />
            <GateCard
              titulo="Gate por assistido"
              ativo={gate.assistido_ativo}
              descricao={gate.assistido_ativo
                ? "Este assistido usa o novo modelo (plano + agenda ativa)."
                : "Este assistido ainda está no modelo antigo."}
            />
          </div>

          {/* Ações controladas */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Ações de homologação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={handlePrevia} disabled={busy} variant="outline" className="gap-2">
                {acaoEmCurso === "previa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Prévia de conversão
              </Button>
              {!usaPlano ? (
                <Button onClick={handlePrevia} disabled={busy} className="gap-2">
                  <ArrowRight className="h-4 w-4" /> Converter (exige prévia)
                </Button>
              ) : (
                <>
                  <Button onClick={handleReprocessar} disabled={busy} variant="secondary" className="gap-2">
                    {acaoEmCurso === "reprocessar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Reprocessar / reconciliar
                  </Button>
                  <Button
                    onClick={handleRollback}
                    disabled={busy || !seguranca?.seguro}
                    variant="destructive"
                    className="gap-2"
                    title={seguranca?.seguro ? undefined : seguranca?.motivo ?? undefined}
                  >
                    {acaoEmCurso === "rollback" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                    Rollback controlado
                  </Button>
                </>
              )}
            </CardContent>
            {usaPlano && seguranca && !seguranca.seguro && (
              <CardContent className="pt-0">
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Rollback limpo bloqueado: {seguranca.motivo} ({seguranca.etapas_realizadas} realizada(s),{" "}
                    {seguranca.presencas_pos_conversao} presença(s)). Use <strong>Reprocessar / reconciliar</strong>.
                  </span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Visão consolidada — três camadas */}
          <BlocoPlanoPrevisto tratamentos={visao.tratamentos} />
          <BlocoAgendaAtiva tratamentos={visao.tratamentos} />
          <BlocoHistorico sessoes={visao.sessoes} />
        </div>
      )}

      {!visao && !carregando && resultados.length === 0 && termo.length < 2 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <FlaskConical className="h-10 w-10 opacity-40" />
          <p className="text-sm">Pesquise um assistido para conduzir a homologação.</p>
        </div>
      )}

      <PreviaDialog
        open={previaOpen}
        onOpenChange={setPreviaOpen}
        previa={previa}
        jaConvertido={usaPlano}
        convertendo={acaoEmCurso === "converter"}
        onConfirmar={handleConverter}
      />
    </div>
  );
}

function GateCard({ titulo, ativo, descricao }: { titulo: string; ativo: boolean; descricao: string }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-start gap-3 pt-6">
        {ativo ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ShieldAlert className="h-5 w-5 text-muted-foreground" />}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{titulo}</span>
            <Badge variant={ativo ? "default" : "outline"}>{ativo ? "Ativo" : "Desligado"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Camada 1 — Plano previsto (estrutura lógica + bloqueios + parametrização). */
function BlocoPlanoPrevisto({ tratamentos }: { tratamentos: TratamentoConsolidado[] }) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" /> Plano previsto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tratamentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tratamento vinculado.</p>}
        {tratamentos.map((t) => {
          const proxRotulo = ROTULO_ORIGEM_PROXIMA[t.proxima_origem];
          return (
            <div key={t.vinculo_id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {t.ordem_tratamento != null && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{t.ordem_tratamento}</span>
                )}
                <span className="font-medium">{t.tratamento_nome}</span>
                <Badge variant={ORIGEM_VARIANT[t.proxima_origem]}>{proxRotulo}</Badge>
                {t.publico && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Público</Badge>}
                {t.usa_plano && <Badge variant="secondary">Plano ativo</Badge>}
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Quantidade parametrizada: <strong>{t.quantidade_total}</strong> sessão(ões)</p>
                <p>Realizadas: <strong>{t.quantidade_realizada}</strong> · Faltam {Math.max(t.quantidade_total - t.quantidade_realizada, 0)}</p>
                {t.usa_plano && t.etapa_ativa_numero != null && <p>Etapa ativa: <strong>nº {t.etapa_ativa_numero}</strong></p>}
                {t.usa_plano && <p>Etapas já realizadas no plano: <strong>{t.etapas_realizadas}</strong></p>}
                {t.sequencial_bloqueante && t.proxima_origem === "prevista" && (
                  <p className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                    <Lock className="h-3 w-3" /> Bloqueado pela cadeia (aguardando a vez)
                  </p>
                )}
                {t.publico && t.sugestoes_a_partir_de && <p>Sugestões a partir de {fmtData(t.sugestoes_a_partir_de)}</p>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Camada 2 — Agenda ativa (apenas a próxima etapa real, com rótulo). */
function BlocoAgendaAtiva({ tratamentos }: { tratamentos: TratamentoConsolidado[] }) {
  const comProxima = tratamentos.filter((t) => t.proxima_origem !== "sem_proxima");
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4" /> Agenda ativa
          <Badge variant="secondary" className="ml-1">{comProxima.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {comProxima.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa ativa no momento.</p>}
        {comProxima.map((t) => (
          <div key={t.vinculo_id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
            <Separator orientation="vertical" className="h-8" />
            <div className="w-28 shrink-0 font-medium">{fmtData(t.proxima_data)}</div>
            <div className="min-w-0 flex-1 truncate">{t.tratamento_nome}</div>
            <Badge variant={ORIGEM_VARIANT[t.proxima_origem]}>{ROTULO_ORIGEM_PROXIMA[t.proxima_origem]}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const SESSAO_STATUS_LABEL: Record<string, string> = {
  agendado: "Agendada",
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  cancelado: "Cancelada",
  realizado: "Realizada",
  substituida_plano: "Substituída pelo plano",
};

/** Camada 3 — Histórico de execução (sessões passadas / com presença). */
function BlocoHistorico({ sessoes }: { sessoes: SessaoConsolidada[] }) {
  const hist = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    return [...sessoes]
      .filter((s) => s.data_sessao < hojeStr || (s.status_presenca && s.status_presenca !== "pendente"))
      .sort((a, b) => b.data_sessao.localeCompare(a.data_sessao));
  }, [sessoes]);

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon className="h-4 w-4" /> Histórico de execução
          <Badge variant="secondary" className="ml-1">{hist.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {hist.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão no histórico.</p>}
        {hist.map((s) => {
          const statusVisivel = s.status_presenca ?? s.status;
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
              <Separator orientation="vertical" className="h-8" />
              <div className="w-24 shrink-0 font-medium">{fmtData(s.data_sessao)}</div>
              <div className="w-16 shrink-0 text-muted-foreground">{s.horario?.slice(0, 5) ?? "--:--"}</div>
              <div className="min-w-0 flex-1 truncate">{s.tratamento_nome}</div>
              <Badge variant="outline">{SESSAO_STATUS_LABEL[statusVisivel] ?? statusVisivel}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PreviaDialog({
  open,
  onOpenChange,
  previa,
  jaConvertido,
  convertendo,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  previa: PreviaConversao | null;
  jaConvertido: boolean;
  convertendo: boolean;
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Prévia de conversão
          </DialogTitle>
          <DialogDescription>
            Exatamente o que a porta única oficial irá gerar. Nada é gravado até confirmar.
          </DialogDescription>
        </DialogHeader>

        {previa && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Planos" valor={previa.total_planos} />
              <Stat label="Etapas previstas" valor={previa.total_etapas} />
              <Stat label="Etapas ativas" valor={previa.total_sessoes_ativas} />
              <Stat label="Sessões substituídas" valor={previa.total_sessoes_a_substituir} />
            </div>

            <div className="space-y-2">
              {previa.itens.map((i) => (
                <div key={i.vinculo_id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {i.ordem_tratamento != null && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{i.ordem_tratamento}</span>
                    )}
                    <span className="font-medium">{i.tratamento_nome}</span>
                    {i.publico_livre ? (
                      <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Sugestão pública</Badge>
                    ) : i.etapa_ativa_numero != null ? (
                      <Badge>Etapa ativa nº {i.etapa_ativa_numero}</Badge>
                    ) : (
                      <Badge variant="outline">Sem próxima etapa</Badge>
                    )}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Parametrizado no tipo: <strong>{i.quantidade_parametrizada ?? "—"}</strong></p>
                    <p>Plano: <strong>{i.etapas_previstas}</strong> etapa(s) · {i.quantidade_realizada}/{i.quantidade_total} realizadas</p>
                    {!i.publico_livre && (
                      <p className="flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3" /> Agenda ativa:{" "}
                        <strong>{i.agenda_ativa_data ? fmtData(i.agenda_ativa_data) : "—"}</strong>
                        {i.agenda_ativa_horario ? ` ${i.agenda_ativa_horario.slice(0, 5)}` : ""}
                      </p>
                    )}
                    {i.publico_livre && i.sugestoes_a_partir_de && <p>Sugestões a partir de {fmtData(i.sugestoes_a_partir_de)}</p>}
                    <p>Sessões antigas a substituir: <strong>{i.sessoes_a_substituir}</strong></p>
                  </div>
                </div>
              ))}
            </div>

            {jaConvertido ? (
              <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Assistido já está no novo modelo. Esta prévia é apenas para conferência (use Reprocessar para reconciliar).
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                A conversão liga o gate por assistido, neutraliza a agenda antiga futura e ativa apenas a próxima etapa.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={convertendo}>Fechar</Button>
          {!jaConvertido && (
            <Button onClick={onConfirmar} disabled={convertendo || !previa} className="gap-2">
              {convertendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Confirmar conversão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-lg font-semibold">{valor}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
