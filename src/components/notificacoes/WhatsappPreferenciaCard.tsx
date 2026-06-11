import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";
import {
  getMinhaPreferencia,
  setWhatsappAtivo,
  type PreferenciaNotificacao,
} from "@/services/notificacoes/notificacoesService";

/** Card de opt-in/opt-out de mensagens operacionais por WhatsApp. */
export function WhatsappPreferenciaCard({ assistidoId }: { assistidoId: string }) {
  const { toast } = useToast();
  const [pref, setPref] = useState<PreferenciaNotificacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMinhaPreferencia(assistidoId)
      .then(setPref)
      .finally(() => setLoading(false));
  }, [assistidoId]);

  // Default opt-in quando ainda não há registro.
  const ativo = pref ? pref.whatsapp_ativo : true;

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      await setWhatsappAtivo(assistidoId, next);
      const atualizado = await getMinhaPreferencia(assistidoId);
      setPref(atualizado);
      toast({
        title: next ? "WhatsApp ativado" : "WhatsApp desativado",
        description: next
          ? "Você voltará a receber lembretes e avisos por WhatsApp."
          : "Você não receberá mais mensagens operacionais por WhatsApp.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar preferência", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" /> Mensagens por WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Receber avisos operacionais</p>
            <p className="text-xs text-muted-foreground">
              Lembretes de entrevistas e sessões, remarcações e cancelamentos. Mensagens
              úteis e em volume controlado — nunca spam.
            </p>
          </div>
          <Switch checked={ativo} disabled={loading || saving} onCheckedChange={handleToggle} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {ativo ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary">Desativado</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
