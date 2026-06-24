import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, Send, ShieldCheck, AlertTriangle, Search, User, ChevronLeft,
} from "lucide-react";
import {
  buscarDestinatariosManual, enfileirarMensagemManual,
  type DestinatarioManual,
} from "@/services/notificacoes/notificacoesService";
import {
  validarMensagemManual, MENSAGEM_MANUAL_MAX, rotuloMotivo,
} from "@/lib/notificacaoElegibilidade";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Destinatário já resolvido (ex.: aberto a partir de um item da fila). */
  destinatarioInicial?: DestinatarioManual | null;
  /** Chamado após enfileirar com sucesso (para recarregar a Central). */
  onEnviado?: () => void;
}

type Etapa = "compor" | "previa";

/** Traduz o código de erro da RPC para uma mensagem clara ao operador. */
function traduzErroEnvio(message?: string): string {
  const m = message || "";
  if (m.includes("permissao_negada")) return "Você não tem permissão para enviar mensagem manual.";
  if (m.includes("mensagem_vazia")) return "A mensagem não pode estar vazia.";
  if (m.includes("mensagem_muito_longa")) return `A mensagem excede ${MENSAGEM_MANUAL_MAX} caracteres.`;
  if (m.includes("destinatario_invalido")) return "Destinatário inválido.";
  if (m.includes("sem_telefone")) return "Destinatário sem telefone válido cadastrado.";
  if (m.includes("opt_out")) return "Destinatário optou por não receber mensagens.";
  return m || "Não foi possível enviar a mensagem.";
}

export function MensagemManualDialog({ open, onOpenChange, destinatarioInicial, onEnviado }: Props) {
  const { toast } = useToast();
  const fixo = !!destinatarioInicial;

  const [etapa, setEtapa] = useState<Etapa>("compor");
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<DestinatarioManual[]>([]);
  const [destinatario, setDestinatario] = useState<DestinatarioManual | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Reset ao abrir/fechar; respeita destinatário fixo (contexto da fila).
  useEffect(() => {
    if (open) {
      setEtapa("compor");
      setTermo("");
      setResultados([]);
      setDestinatario(destinatarioInicial ?? null);
      setMensagem("");
      setObservacao("");
      setEnviando(false);
    }
  }, [open, destinatarioInicial]);

  // Busca de destinatário com debounce simples (somente quando não há fixo).
  useEffect(() => {
    if (fixo) return;
    const q = termo.trim();
    if (q.length < 2) { setResultados([]); return; }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarDestinatariosManual(q);
        if (!cancelado) setResultados(r);
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [termo, fixo]);

  const validacao = validarMensagemManual(mensagem);

  const irParaPrevia = useCallback(() => {
    if (!destinatario) {
      toast({ title: "Escolha um destinatário", variant: "destructive" });
      return;
    }
    if (!destinatario.telefone) {
      toast({ title: "Destinatário sem telefone", description: "Não é possível enviar mensagem manual.", variant: "destructive" });
      return;
    }
    if (!validacao.ok) {
      toast({ title: "Mensagem inválida", description: rotuloMotivo(validacao.erro) ?? "Verifique o conteúdo.", variant: "destructive" });
      return;
    }
    setEtapa("previa");
  }, [destinatario, validacao, toast]);

  const confirmarEnvio = useCallback(async () => {
    if (!destinatario) return;
    setEnviando(true);
    try {
      const r = await enfileirarMensagemManual({
        assistidoId: destinatario.id,
        mensagem: validacao.texto,
        observacao,
      });
      toast({
        title: "Mensagem manual enfileirada",
        description: `Para ${r.assistido_nome ?? "destinatário"} — entrará no envio oficial e será auditada.`,
      });
      onOpenChange(false);
      onEnviado?.();
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: traduzErroEnvio(e?.message), variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }, [destinatario, validacao.texto, observacao, toast, onOpenChange, onEnviado]);

  return (
    <Dialog open={open} onOpenChange={(v) => !enviando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Mensagem manual
          </DialogTitle>
          <DialogDescription>
            Envio manual controlado para um destinatário específico. Passa pela fila oficial,
            respeita consentimento e telefone, e fica auditado.
          </DialogDescription>
        </DialogHeader>

        {etapa === "compor" ? (
          <div className="space-y-4">
            {/* Destinatário */}
            {fixo && destinatario ? (
              <div className="rounded-xl border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-muted-foreground" /> {destinatario.nome}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {destinatario.telefone || "sem telefone"}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Destinatário</Label>
                {destinatario ? (
                  <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <User className="h-4 w-4 text-muted-foreground" /> {destinatario.nome}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {destinatario.telefone || "sem telefone"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDestinatario(null)}>Trocar</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={termo}
                        onChange={(e) => setTermo(e.target.value)}
                        placeholder="Buscar assistido por nome..."
                        className="pl-8"
                        autoFocus
                      />
                    </div>
                    {buscando ? (
                      <div className="space-y-2">
                        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                      </div>
                    ) : termo.trim().length >= 2 && resultados.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic px-1">Nenhum assistido encontrado.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {resultados.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setDestinatario(r)}
                            className="w-full text-left rounded-lg border p-2.5 text-sm hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium">{r.nome}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{r.telefone || "sem telefone"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Conteúdo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva a mensagem que será enviada ao destinatário."
                className="min-h-[110px]"
                maxLength={MENSAGEM_MANUAL_MAX + 50}
              />
              <p className={`text-[11px] ${mensagem.length > MENSAGEM_MANUAL_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {mensagem.trim().length}/{MENSAGEM_MANUAL_MAX} caracteres
              </p>
            </div>

            {/* Observação interna */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observação interna (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Motivo/contexto desta mensagem manual (apenas auditoria)."
                className="min-h-[60px]"
              />
            </div>
          </div>
        ) : (
          // Prévia obrigatória
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">
                Esta é uma <strong>mensagem manual</strong> e será <strong>auditada</strong>.
                Ela entrará na fila oficial e será enviada pelo pipeline padrão.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border p-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground min-w-[90px]">Destinatário</span>
                <span className="font-medium ml-auto">{destinatario?.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground min-w-[90px]">Telefone</span>
                <span className="font-medium ml-auto">{destinatario?.telefone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground min-w-[90px]">Origem</span>
                <span className="font-medium ml-auto">Manual (Central de Notificações)</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Conteúdo que será enviado</Label>
              <div className="mt-1 rounded-2xl rounded-tr-sm bg-secondary text-secondary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
                {validacao.texto}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {etapa === "compor" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
              <Button onClick={irParaPrevia} disabled={!destinatario || !validacao.ok}>
                Ver prévia
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setEtapa("compor")} disabled={enviando}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={confirmarEnvio} disabled={enviando}>
                {enviando ? "Enviando..." : (<><Send className="h-4 w-4 mr-1" /> Enviar mensagem</>)}
              </Button>
            </>
          )}
        </DialogFooter>

        {etapa === "compor" && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Não altera consentimento nem opt-out. Comunicação pontual e auditada.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
