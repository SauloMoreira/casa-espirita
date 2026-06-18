import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ShieldX, Loader2, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  onDeleted: () => void;
  onInactivate: (motivo: string) => void;
}

const CONFIRM_WORD = "EXCLUIR";

export function DeleteUserDialog({ open, onOpenChange, targetUserId, targetUserName, onDeleted, onInactivate }: Props) {
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
        const { data, error } = await supabase.functions.invoke("manage-user", {
          body: { action: "check", target_user_id: targetUserId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setCanDelete(!!data?.can_delete);
        setBlockers(data?.blockers || []);
      } catch (err: any) {
        toast({ title: "Erro ao verificar vínculos", description: err.message, variant: "destructive" });
        setCanDelete(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [open, targetUserId, toast]);

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", target_user_id: targetUserId, motivo: motivo.trim() || null },
      });
      if (error) throw error;
      if (data?.error) {
        if (data?.blockers) setBlockers(data.blockers);
        setCanDelete(false);
        throw new Error(data.error);
      }
      toast({ title: "Usuário excluído", description: data?.message });
      onOpenChange(false);
      onDeleted();
    } catch (err: any) {
      toast({ title: "Não foi possível excluir", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Excluir usuário
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{targetUserName}</span>
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
                    Este usuário possui vínculos históricos que devem ser preservados para auditoria e integridade do sistema:
                  </p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                    {blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Use a <span className="font-medium text-foreground">inativação</span> para revogar o acesso mantendo todo o histórico.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => { onInactivate(motivo.trim()); onOpenChange(false); }}>
                Inativar usuário
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-muted-foreground">
                  Esta ação é <span className="font-semibold text-foreground">irreversível</span>. O acesso e os dados de perfil
                  deste usuário serão removidos permanentemente. Se houver qualquer dúvida, prefira a inativação.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Motivo (opcional, registrado em auditoria)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={500}
                placeholder="Ex.: usuário criado por engano para teste" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Digite <span className="font-mono font-semibold">{CONFIRM_WORD}</span> para confirmar</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} autoComplete="off" />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
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
