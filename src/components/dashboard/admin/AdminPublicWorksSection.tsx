import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Megaphone, Users, UserPlus, Repeat, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchPublicCheckins } from "@/services/relatorios/trabalhosPublicos";
import { computePublicWorksAnalytics } from "@/lib/trabalhosPublicos";
import { getPeriodRange } from "@/services/dashboard/adminDashboard";
import type { PublicCheckinRecord } from "@/types/trabalhosPublicos";
import type { PeriodKey } from "@/types/adminDashboard";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

interface Props {
  period: PeriodKey;
}

/** Public works analytics block for the Admin Dashboard (real data). */
export function AdminPublicWorksSection({ period }: Props) {
  const [records, setRecords] = useState<PublicCheckinRecord[]>([]);

  useEffect(() => {
    let active = true;
    fetchPublicCheckins().then((r) => active && setRecords(r));
    return () => {
      active = false;
    };
  }, []);

  const analytics = useMemo(() => {
    const range = getPeriodRange(period);
    return computePublicWorksAnalytics(records, {
      dataInicio: range.start,
      dataFim: range.end,
      tratamentoId: "todos",
      faixa: "todos",
      tipoParticipante: "todos",
      modoCheckin: "todos",
    });
  }, [records, period]);

  const novosVsRec = [
    { name: "Novos", value: analytics.novos },
    { name: "Recorrentes", value: analytics.recorrentes },
  ];
  const ranking = analytics.porTrabalho.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Trabalhos Públicos — Período
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Participantes" value={analytics.totalParticipantes} icon={Users} />
        <StatCard title="Novos" value={analytics.novos} subtitle={`${analytics.percentualNovos}%`} icon={UserPlus} />
        <StatCard title="Recorrentes" value={analytics.recorrentes} subtitle={`${analytics.percentualRecorrentes}%`} icon={Repeat} />
        <StatCard title="Taxa de Retorno" value={`${analytics.taxaRetornoGeral}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Maior Participação"
            value={analytics.topTrabalho?.tratamentoNome ?? "—"}
            subtitle={analytics.topTrabalho ? `${analytics.topTrabalho.presencas} presenças` : undefined}
            icon={TrendingUp}
          />
          <StatCard
            title="Menor Participação"
            value={analytics.bottomTrabalho?.tratamentoNome ?? "—"}
            subtitle={analytics.bottomTrabalho ? `${analytics.bottomTrabalho.presencas} presenças` : undefined}
            icon={Megaphone}
          />
          <StatCard
            title="Faixa + Presente"
            value={analytics.topFaixa?.faixa ?? "—"}
            subtitle={analytics.topFaixa ? `${analytics.topFaixa.participantes} participantes` : undefined}
            icon={Users}
          />
          <StatCard
            title="Faixa - Presente"
            value={analytics.bottomFaixa?.faixa ?? "—"}
            subtitle={analytics.bottomFaixa ? `${analytics.bottomFaixa.participantes} participantes` : undefined}
            icon={Users}
          />
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Novos vs Recorrentes</CardTitle></CardHeader>
          <CardContent>
            {analytics.totalParticipantes === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem participação no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={novosVsRec} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {novosVsRec.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Ranking de trabalhos públicos</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, ranking.length * 42)}>
              <BarChart data={ranking} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="tratamentoNome" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="presencas" name="Presenças" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
