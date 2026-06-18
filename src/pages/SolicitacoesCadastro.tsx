import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Check, X, Info, Mail, IdCard, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Solicitacao {
  id: string;
  user_id: string | null;
  nome_completo: string;
  email: string;
  cpf: string | null;
  celular: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  motivo_rejeicao: string | null;
  decidido_em: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<Solicitacao["status"], "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};
const STATUS_LABEL: Record<Solicitacao["status"], string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export default function SolicitacoesCadastro() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Solicitacao | null>(null);
  const [motivo, setMotivo] = useState("");

  const fetchAll = useCallback(async () => {
    const { data } = await supabase
      .from("cadastro_solicitacoes")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Solicitacao[]) || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const decide = async (s: Solicitacao, action: "aprovar" | "rejeitar", motivoArg?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-signup", {
        body: { action, solicitacao_id: s.id, motivo: motivoArg || null },
      });
      if (error) {
        const ctx = (error as any)?.context;
        let msg = error.message;
        try {
          const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (parsed?.error) msg = parsed.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: action === "aprovar" ? "Cadastro aprovado" : "Cadastro rejeitado",
        description: action === "aprovar" ? "Usuário criado como assistido." : undefined,
      });
      setRejectTarget(null);
      setMotivo("");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pendentes = rows.filter((r) => r.status === "pendente");
  const historico = rows.filter((r) => r.status !== "pendente");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" /> Solicitações de Cadastro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastros feitos pela tela de login aguardando aprovação administrativa.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Papel padrão seguro</AlertTitle>
        <AlertDescription className="text-xs">
          Ao aprovar, o usuário entra com o papel <strong>assistido</strong>. Papéis adicionais
          (tarefeiro, médium/entrevistador, etc.) são atribuídos depois em <strong>Usuários</strong>.
          O papel de <strong>Administrador</strong> segue o fluxo de <strong>Governança de Acessos</strong>.
        </AlertDescription>
      </Alert>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Pendentes ({pendentes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma solicitação pendente.</p>
          ) : pendentes.map((s) => (
            <div key={s.id} className="rounded-xl border p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{s.nome_completo}</p>
                <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>
                {s.cpf && <span className="flex items-center gap-1"><IdCard className="h-3 w-3" /> {s.cpf}</span>}
                {s.celular && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.celular}</span>}
                <span>Solicitado em {new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={loading} onClick={() => decide(s, "aprovar")}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar como assistido
                </Button>
                <Button size="sm" variant="destructive" disabled={loading}
                  onClick={() => { setRejectTarget(s); setMotivo(""); }}>
                  <X className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum histórico ainda.</p>
          ) : historico.map((s) => (
            <div key={s.id} className="rounded-xl border p-4 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{s.nome_completo}</p>
                <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.email}
                {s.decidido_em ? ` · ${new Date(s.decidido_em).toLocaleDateString("pt-BR")}` : ""}
              </p>
              {s.motivo_rejeicao && (
                <p className="text-xs text-destructive">Motivo: {s.motivo_rejeicao}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar cadastro</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              placeholder="Explique o motivo (mín. 3 caracteres)" />
          </div>
          <DialogFooter>
            <Button variant="destructive" disabled={loading || motivo.trim().length < 3}
              onClick={() => rejectTarget && decide(rejectTarget, "rejeitar", motivo)}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
