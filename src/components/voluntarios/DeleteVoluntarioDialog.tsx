import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ShieldX, Loader2, Trash2 } from "lucide-react";
import { DELETE_CONFIRM_WORD, isDeleteConfirmed } from "@/lib/voluntarioManagement";
import { checkVoluntarioDeletion, deleteVoluntario } from "@/services/voluntarios/voluntariosService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voluntarioId: string;
  voluntarioNome: string;
  onDeleted: () => void;
  onInactivate: (motivo: string) => void;
}

export function DeleteVoluntarioDialog({
  open, onOpenChange, voluntarioId, voluntarioNome, onDeleted, onInactivate,
}: Props) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChecking(true);
    setConfirmText("");
    setMotivo("");
    setBlockers([]);
    setCanDelete(false);
    (async () => {
      try {
        const data = await checkVoluntarioDeletion(voluntarioId);
        if (data?.error) throw new Error(data.error);
        setCanDelete(!!data?.can_delete);
        setBlockers(data?.blockers || []);
      } catch (err) {
        toast({ title: "Erro ao verificar vínculos", description: (err as Error).message, variant: "destructive" });
        setCanDelete(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [open, voluntarioId, toast]);

  const handleDelete = async () => {
    if (!isDeleteConfirmed(confirmText)) return;
    setSubmitting(true);
    try {
      const data = await deleteVoluntario(voluntarioId, motivo.trim() || null);
      if (data?.error) {
        if (data?.blockers) setBlockers(data.blockers);
        setCanDelete(false);
        throw new Error(data.error);
      }
      toast({ title: "Voluntário excluído", description: data?.message });
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast({ title: "Não foi possível excluir", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Excluir voluntário
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{voluntarioNome}</span>
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando vínculos...
          </div>
        ) : !canDelete ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 text-destructive">
                <ShieldX className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Exclusão definitiva bloqueada</p>
                  <p className="text-xs text-muted-foreground">
                    Este voluntário possui histórico institucional que deve ser preservado para auditoria e integridade do sistema:
                  </p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                    {blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Use a <span className="font-medium text-foreground">inativação</span> para encerrar a atuação mantendo todo o histórico, ficha e termo.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => { onInactivate(motivo.trim()); onOpenChange(false); }}>
                Inativar voluntário
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-muted-foreground">
                  Não há vínculos relevantes para este voluntário. Esta ação é{" "}
                  <span className="font-semibold text-foreground">irreversível</span> e removerá o cadastro permanentemente.
                  Em caso de dúvida, prefira a inativação.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Motivo (opcional, registrado em auditoria)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={500}
                placeholder="Ex.: cadastro criado por engano para teste" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Digite <span className="font-mono font-semibold">{DELETE_CONFIRM_WORD}</span> para confirmar</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={DELETE_CONFIRM_WORD} autoComplete="off" />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting || !isDeleteConfirmed(confirmText)}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir definitivamente"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
