import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, TrendingUp, Brain } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function IndicadoresAssertividade() {
  const [stats, setStats] = useState({
    total: 0,
    aderencia_total: 0,
    aderencia_parcial: 0,
    divergencia: 0,
    sem_avaliacao: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      const [{ count: total }, { data: fb }] = await Promise.all([
        supabase.from("ia_sugestoes").select("*", { count: "exact", head: true }),
        supabase.from("ia_feedback").select("classificacao"),
      ]);

      let at = 0, ap = 0, dv = 0;
      (fb || []).forEach(f => {
        if (f.classificacao === "acertou totalmente") at++;
        else if (f.classificacao === "acertou parcialmente") ap++;
        else if (f.classificacao === "inadequada") dv++;
      });

      setStats({
        total: total || 0,
        aderencia_total: at,
        aderencia_parcial: ap,
        divergencia: dv,
        sem_avaliacao: (total || 0) - (fb || []).length,
      });
      setLoading(false);
    };
    fetch_();
  }, []);

  const totalAvaliados = stats.aderencia_total + stats.aderencia_parcial + stats.divergencia;
  const taxaAderencia = totalAvaliados > 0 ? Math.round(((stats.aderencia_total + stats.aderencia_parcial) / totalAvaliados) * 100) : 0;

  const pieData = [
    { name: "Acertou totalmente", value: stats.aderencia_total, color: "hsl(var(--primary))" },
    { name: "Acertou parcialmente", value: stats.aderencia_parcial, color: "hsl(var(--secondary))" },
    { name: "Inadequada", value: stats.divergencia, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  const barData = [
    { name: "Total", value: stats.total },
    { name: "Acerto total", value: stats.aderencia_total },
    { name: "Parcial", value: stats.aderencia_parcial },
    { name: "Divergência", value: stats.divergencia },
    { name: "Pendente", value: stats.sem_avaliacao },
  ];

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando indicadores...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Brain className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Sugestões da IA</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-2xl font-bold">{taxaAderencia}%</p><p className="text-xs text-muted-foreground">Taxa de aderência</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-yellow-600" /></div>
              <div><p className="text-2xl font-bold">{stats.aderencia_parcial}</p><p className="text-xs text-muted-foreground">Acertos parciais</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-2xl font-bold">{stats.divergencia}</p><p className="text-xs text-muted-foreground">Divergências</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por classificação</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados ainda</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Visão geral</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
