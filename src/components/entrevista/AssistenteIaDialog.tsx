import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { IaSugestaoEstruturada } from "@/types/ia";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  sugestao: string;
  estruturada?: IaSugestaoEstruturada | null;
  onApply?: () => void;
}

export function AssistenteIaDialog({ open, onOpenChange, loading, sugestao, estruturada, onApply }: Props) {
  const tratamentosAplicaveis = (estruturada?.tratamentos_sugeridos || []).filter((t) => t.tratamento_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente IA da Entrevista
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando observações...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {estruturada && estruturada.queixas_identificadas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Queixas identificadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {estruturada.queixas_identificadas.map((q, i) => (
                    <Badge key={i} variant="secondary">{q.nome}</Badge>
                  ))}
                </div>
              </div>
            )}

            {estruturada && estruturada.tratamentos_sugeridos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tratamentos sugeridos</p>
                <ul className="space-y-1">
                  {estruturada.tratamentos_sugeridos.map((t, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span>{t.nome}</span>
                      <span className="text-muted-foreground">{t.quantidade > 0 ? `${t.quantidade} sessões` : "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{sugestao}</ReactMarkdown>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                ⚠️ Esta é apenas uma sugestão gerada por IA. A decisão final é sempre do
                entrevistador.
              </p>
            </div>
          </div>
        )}

        {!loading && onApply && tratamentosAplicaveis.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={onApply}>
              <Check className="h-4 w-4 mr-1" />
              Aplicar sugestão ({tratamentosAplicaveis.length})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
