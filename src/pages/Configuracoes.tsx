import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Configuracoes() {
  const [minPalestras, setMinPalestras] = useState("3");
  const [permitirLivre, setPermitirLivre] = useState(true);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("configuracoes_gerais").select("chave, valor");
      if (data) {
        const minP = data.find((c) => c.chave === "quantidade_minima_palestras");
        const livre = data.find((c) => c.chave === "permitir_entrevista_livre");
        if (minP) setMinPalestras(minP.valor);
        if (livre) setPermitirLivre(livre.valor === "true");
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const configs = [
      { chave: "quantidade_minima_palestras", valor: minPalestras, descricao: "Quantidade mínima de palestras para entrevista fraterna" },
      { chave: "permitir_entrevista_livre", valor: permitirLivre.toString(), descricao: "Permite agendar entrevista sem o mínimo de palestras" },
    ];

    for (const c of configs) {
      const { data: existing } = await supabase.from("configuracoes_gerais").select("id").eq("chave", c.chave).maybeSingle();
      if (existing) {
        await supabase.from("configuracoes_gerais").update({ valor: c.valor, updated_by: user?.id }).eq("chave", c.chave);
      } else {
        await supabase.from("configuracoes_gerais").insert({ ...c, updated_by: user?.id });
      }
    }

    toast({ title: "Configurações salvas" });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Parâmetros gerais do sistema</p>
      </div>

      <Card className="glass-card max-w-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Regras da Entrevista Fraterna
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="min-palestras">Quantidade mínima de palestras para entrevista</Label>
            <Input id="min-palestras" type="number" min={0} value={minPalestras} onChange={(e) => setMinPalestras(e.target.value)} className="max-w-32" />
            <p className="text-xs text-muted-foreground">
              Assistido deve ter este número de palestras para ser elegível à entrevista fraterna regular
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Permitir entrevista fraterna livre</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permite agendar entrevistas sem atingir o mínimo de palestras
              </p>
            </div>
            <Switch checked={permitirLivre} onCheckedChange={setPermitirLivre} />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
