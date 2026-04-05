import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, BookOpen, UserCheck, Clock } from "lucide-react";

export default function EntrevistadorDashboard() {
  const [stats, setStats] = useState({ hoje: 0, agendadas: 0, concluidas: 0, encaminhados: 0 });
  const [entrevistasHoje, setEntrevistasHoje] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const startOfDay = today + "T00:00:00";
      const endOfDay = today + "T23:59:59";

      const [{ data: hoje }, { count: agendadas }, { count: concluidas }] = await Promise.all([
        supabase.from("entrevistas_fraternas").select("id, data, assistido_id, status")
          .eq("entrevistador_id", user!.id).gte("data", startOfDay).lte("data", endOfDay),
        supabase.from("entrevistas_fraternas").select("*", { count: "exact", head: true })
          .eq("entrevistador_id", user!.id).eq("status", "agendada"),
        supabase.from("entrevistas_fraternas").select("*", { count: "exact", head: true })
          .eq("entrevistador_id", user!.id).eq("status", "realizada"),
      ]);

      const hojeList = hoje || [];
      if (hojeList.length > 0) {
        const ids = hojeList.map((h) => h.assistido_id);
        const { data: nomes } = await supabase.from("assistidos").select("id, nome").in("id", ids);
        const nomeMap = Object.fromEntries((nomes || []).map((n) => [n.id, n.nome]));
        setEntrevistasHoje(hojeList.map((h) => ({ ...h, assistido_nome: nomeMap[h.assistido_id] || "—" })));
      }

      setStats({ hoje: hojeList.length, agendadas: agendadas || 0, concluidas: concluidas || 0, encaminhados: 0 });
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel do Entrevistador</h1>
        <p className="text-sm text-muted-foreground mt-1">Suas entrevistas e atendimentos</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Entrevistas Hoje" value={stats.hoje} icon={Calendar} />
        <StatCard title="Agendadas" value={stats.agendadas} subtitle="Pendentes" icon={Clock} />
        <StatCard title="Concluídas" value={stats.concluidas} subtitle="Total" icon={BookOpen} />
        <StatCard title="Encaminhados" value={stats.encaminhados} icon={UserCheck} />
      </div>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Entrevistas do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          {entrevistasHoje.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma entrevista agendada para hoje</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entrevistasHoje.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{e.assistido_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
