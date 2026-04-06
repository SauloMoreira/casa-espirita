import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Config {
  id: string;
  usar_base_doutrinaria: boolean;
  usar_base_operacional: boolean;
  usar_historico_supervisionado: boolean;
  peso_base_doutrinaria: number;
  peso_base_operacional: number;
  peso_historico: number;
  exigir_feedback: boolean;
  exibir_justificativa: boolean;
  nivel_confianca_minimo: number;
}

export default function ConfiguracoesIA() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("ia_configuracoes").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) setConfig(data[0] as Config);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!config || !user) return;
    setSaving(true);
    const { error } = await supabase.from("ia_configuracoes").update({
      usar_base_doutrinaria: config.usar_base_doutrinaria,
      usar_base_operacional: config.usar_base_operacional,
      usar_historico_supervisionado: config.usar_historico_supervisionado,
      peso_base_doutrinaria: config.peso_base_doutrinaria,
      peso_base_operacional: config.peso_base_operacional,
      peso_historico: config.peso_historico,
      exigir_feedback: config.exigir_feedback,
      exibir_justificativa: config.exibir_justificativa,
      nivel_confianca_minimo: config.nivel_confianca_minimo,
      updated_by: user.id,
    }).eq("id", config.id);

    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configurações salvas" });
  };

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;
  if (!config) return <div className="text-center text-muted-foreground py-12">Configuração não encontrada</div>;

  const update = (key: keyof Config, value: any) => setConfig(prev => prev ? { ...prev, [key]: value } : prev);

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-5 w-5" /> Fontes de dados</CardTitle>
          <CardDescription>Defina quais fontes a IA deve consultar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Base doutrinária</Label><p className="text-xs text-muted-foreground">Usar materiais da Biblioteca Doutrinária</p></div>
            <Switch checked={config.usar_base_doutrinaria} onCheckedChange={v => update("usar_base_doutrinaria", v)} disabled={!isAdmin} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Base operacional</Label><p className="text-xs text-muted-foreground">Usar queixas e tratamentos cadastrados</p></div>
            <Switch checked={config.usar_base_operacional} onCheckedChange={v => update("usar_base_operacional", v)} disabled={!isAdmin} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Histórico supervisionado</Label><p className="text-xs text-muted-foreground">Usar feedback de sugestões anteriores</p></div>
            <Switch checked={config.usar_historico_supervisionado} onCheckedChange={v => update("usar_historico_supervisionado", v)} disabled={!isAdmin} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesos de influência</CardTitle>
          <CardDescription>Defina o peso relativo de cada fonte (1 a 10)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2"><Label>Base doutrinária</Label><span className="text-sm font-medium">{config.peso_base_doutrinaria}</span></div>
            <Slider value={[config.peso_base_doutrinaria]} onValueChange={([v]) => update("peso_base_doutrinaria", v)} min={1} max={10} step={1} disabled={!isAdmin} />
          </div>
          <div>
            <div className="flex justify-between mb-2"><Label>Base operacional</Label><span className="text-sm font-medium">{config.peso_base_operacional}</span></div>
            <Slider value={[config.peso_base_operacional]} onValueChange={([v]) => update("peso_base_operacional", v)} min={1} max={10} step={1} disabled={!isAdmin} />
          </div>
          <div>
            <div className="flex justify-between mb-2"><Label>Histórico</Label><span className="text-sm font-medium">{config.peso_historico}</span></div>
            <Slider value={[config.peso_historico]} onValueChange={([v]) => update("peso_historico", v)} min={1} max={10} step={1} disabled={!isAdmin} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comportamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Exigir feedback obrigatório</Label><p className="text-xs text-muted-foreground">Requer avaliação após cada sugestão</p></div>
            <Switch checked={config.exigir_feedback} onCheckedChange={v => update("exigir_feedback", v)} disabled={!isAdmin} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Exibir justificativa</Label><p className="text-xs text-muted-foreground">Mostra o raciocínio da IA ao entrevistador</p></div>
            <Switch checked={config.exibir_justificativa} onCheckedChange={v => update("exibir_justificativa", v)} disabled={!isAdmin} />
          </div>
          <div>
            <div className="flex justify-between mb-2"><Label>Nível mínimo de confiança (%)</Label><span className="text-sm font-medium">{config.nivel_confianca_minimo}%</span></div>
            <Slider value={[config.nivel_confianca_minimo]} onValueChange={([v]) => update("nivel_confianca_minimo", v)} min={0} max={100} step={5} disabled={!isAdmin} />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      )}
    </div>
  );
}
