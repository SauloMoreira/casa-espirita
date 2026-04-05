import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Heart, BookOpen } from "lucide-react";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function MinhaAgenda() {
  const [tratamentos, setTratamentos] = useState<any[]>([]);
  const [entrevistas, setEntrevistas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const { data: assistido } = await supabase.from("assistidos").select("id").eq("user_id", user!.id).maybeSingle();
      if (!assistido) { setLoading(false); return; }

      const [{ data: vinculos }, { data: ent }] = await Promise.all([
        supabase.from("assistido_tratamentos").select("tratamento_id, status")
          .eq("assistido_id", assistido.id).in("status", ["aguardando_inicio", "em_andamento"]),
        supabase.from("entrevistas_fraternas").select("id, data, tipo_entrevista, status")
          .eq("assistido_id", assistido.id).eq("status", "agendada").order("data"),
      ]);

      if (vinculos && vinculos.length > 0) {
        const tratIds = [...new Set(vinculos.map((v) => v.tratamento_id))];
        const { data: tipos } = await supabase.from("tipos_tratamento").select("id, nome, dia_semana, horario").in("id", tratIds);
        setTratamentos(tipos || []);
      }
      setEntrevistas(ent || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Minha Agenda</h1>
        <p className="text-sm text-muted-foreground mt-1">Seus próximos atendimentos</p>
      </div>

      {entrevistas.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Entrevistas Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entrevistas.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Entrevista Fraterna</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.data).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                </div>
                <Badge variant="secondary">{e.tipo_entrevista === "livre" ? "Livre" : "Regular"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Dias de Tratamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tratamentos.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Heart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum atendimento agendado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tratamentos.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.dia_semana !== null ? DIAS_SEMANA[t.dia_semana] : "—"} {t.horario ? `às ${t.horario}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
