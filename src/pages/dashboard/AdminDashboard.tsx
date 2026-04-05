import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Heart, Calendar, ClipboardCheck, BookOpen, UserCheck } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ assistidos: 0, tratAtivos: 0, entAgendadas: 0, presencasHoje: 0 });
  const [entRecentes, setEntRecentes] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [{ count: assistidos }, { count: tratAtivos }, { count: entAgendadas }, { count: presencasHoje }, { data: recentes }] = await Promise.all([
        supabase.from("assistidos").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("assistido_tratamentos").select("*", { count: "exact", head: true }).in("status", ["aguardando_inicio", "em_andamento"]),
        supabase.from("entrevistas_fraternas").select("*", { count: "exact", head: true }).eq("status", "agendada"),
        supabase.from("presencas_tratamentos").select("*", { count: "exact", head: true }).eq("data", today),
        supabase.from("entrevistas_fraternas").select("id, data, status, assistido_id").order("data", { ascending: false }).limit(5),
      ]);
      setStats({
        assistidos: assistidos || 0,
        tratAtivos: tratAtivos || 0,
        entAgendadas: entAgendadas || 0,
        presencasHoje: presencasHoje || 0,
      });
      if (recentes) {
        const ids = [...new Set(recentes.map((r) => r.assistido_id))];
        const { data: nomes } = await supabase.from("assistidos").select("id, nome").in("id", ids);
        const nomeMap = Object.fromEntries((nomes || []).map((n) => [n.id, n.nome]));
        setEntRecentes(recentes.map((r) => ({ ...r, assistido_nome: nomeMap[r.assistido_id] || "—" })));
      }
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Assistidos" value={stats.assistidos} subtitle="Cadastrados" icon={Users} />
        <StatCard title="Tratamentos Ativos" value={stats.tratAtivos} subtitle="Em andamento" icon={Heart} />
        <StatCard title="Entrevistas Agendadas" value={stats.entAgendadas} subtitle="Pendentes" icon={Calendar} />
        <StatCard title="Presenças Hoje" value={stats.presencasHoje} subtitle="Registradas" icon={ClipboardCheck} />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Entrevistas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entRecentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma entrevista registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entRecentes.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{e.assistido_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
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
