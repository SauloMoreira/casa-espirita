import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Users, Heart, Clock } from "lucide-react";

export default function TarefeiroDashboard() {
  const [stats, setStats] = useState({ tratHoje: 0, assistidosEsperados: 0, pendentes: 0, registradas: 0 });
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const today = new Date();
      const diaSemana = today.getDay();
      const dataStr = today.toISOString().split("T")[0];

      const { data: tratamentos } = await supabase.from("tipos_tratamento")
        .select("id").eq("status", "ativo").eq("dia_semana", diaSemana).eq("tarefeiro_id", user!.id);

      if (!tratamentos || tratamentos.length === 0) return;

      const tratIds = tratamentos.map((t) => t.id);
      const { data: vinculos } = await supabase.from("assistido_tratamentos")
        .select("id").in("tratamento_id", tratIds).in("status", ["aguardando_inicio", "em_andamento", "liberado"]);

      const vinculoIds = (vinculos || []).map((v) => v.id);
      const { count: registradas } = await supabase.from("presencas_tratamentos")
        .select("*", { count: "exact", head: true }).in("assistido_tratamento_id", vinculoIds).eq("data", dataStr);

      setStats({
        tratHoje: tratamentos.length,
        assistidosEsperados: vinculoIds.length,
        pendentes: vinculoIds.length - (registradas || 0),
        registradas: registradas || 0,
      });
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel do Tarefeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Tratamentos e presenças do dia</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tratamentos Hoje" value={stats.tratHoje} icon={Heart} />
        <StatCard title="Assistidos Esperados" value={stats.assistidosEsperados} icon={Users} />
        <StatCard title="Presenças Pendentes" value={stats.pendentes} icon={Clock} />
        <StatCard title="Presenças Registradas" value={stats.registradas} icon={ClipboardCheck} />
      </div>
    </div>
  );
}
