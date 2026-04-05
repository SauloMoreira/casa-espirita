import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Calendar, CheckCircle } from "lucide-react";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const STATUS_LABELS: Record<string, string> = {
  aguardando_inicio: "Aguardando Início",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

interface MeuTratamento {
  id: string;
  tratamento_nome: string;
  tratamento_tipo: string;
  dia_semana: number | null;
  horario: string | null;
  quantidade_total: number;
  quantidade_realizada: number;
  quantidade_faltante: number | null;
  status: string;
}

export default function MeusTratamentos() {
  const [tratamentos, setTratamentos] = useState<MeuTratamento[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      // First get assistido record linked to this user
      const { data: assistido } = await supabase.from("assistidos").select("id").eq("user_id", user!.id).maybeSingle();
      if (!assistido) { setLoading(false); return; }

      const { data: vinculos } = await supabase
        .from("assistido_tratamentos")
        .select("id, tratamento_id, quantidade_total, quantidade_realizada, quantidade_faltante, status")
        .eq("assistido_id", assistido.id)
        .in("status", ["aguardando_inicio", "em_andamento", "concluido"]);

      if (!vinculos || vinculos.length === 0) { setLoading(false); return; }

      const tratIds = [...new Set(vinculos.map((v) => v.tratamento_id))];
      const { data: tipos } = await supabase.from("tipos_tratamento").select("id, nome, tipo, dia_semana, horario").in("id", tratIds);
      const tipoMap = Object.fromEntries((tipos || []).map((t) => [t.id, t]));

      setTratamentos(vinculos.map((v) => ({
        id: v.id,
        tratamento_nome: tipoMap[v.tratamento_id]?.nome || "—",
        tratamento_tipo: tipoMap[v.tratamento_id]?.tipo || "—",
        dia_semana: tipoMap[v.tratamento_id]?.dia_semana ?? null,
        horario: tipoMap[v.tratamento_id]?.horario || null,
        quantidade_total: v.quantidade_total,
        quantidade_realizada: v.quantidade_realizada,
        quantidade_faltante: v.quantidade_faltante,
        status: v.status,
      })));
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Meus Tratamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus tratamentos e sessões</p>
      </div>

      {tratamentos.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-muted-foreground">
              <Heart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum tratamento designado</p>
              <p className="text-xs mt-1">Após sua entrevista fraterna, seus tratamentos aparecerão aqui</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tratamentos.map((t) => {
            const pct = t.quantidade_total > 0 ? (t.quantidade_realizada / t.quantidade_total) * 100 : 0;
            return (
              <Card key={t.id} className="glass-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{t.tratamento_nome}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.tratamento_tipo === "espiritual" ? "Espiritual" : "Holístico"}
                      </p>
                    </div>
                    <Badge variant={t.status === "concluido" ? "default" : t.status === "em_andamento" ? "secondary" : "outline"}>
                      {STATUS_LABELS[t.status] || t.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    {t.dia_semana !== null && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{DIAS_SEMANA[t.dia_semana]}</span>
                      </div>
                    )}
                    {t.horario && (
                      <span className="text-muted-foreground">{t.horario}</span>
                    )}
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t.quantidade_realizada} realizadas
                    </span>
                    <span>{t.quantidade_faltante ?? 0} faltantes</span>
                    <span>Total: {t.quantidade_total}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
