import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Users,
  CalendarCheck,
  UserPlus,
  Repeat,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrabalhosPublicos } from "@/hooks/useTrabalhosPublicos";
import { buildPeriodSeries, FAIXA_ORDER } from "@/lib/trabalhosPublicos";
import { exportCsv } from "@/lib/exportCsv";
import type { PeriodGranularity } from "@/types/trabalhosPublicos";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

export default function TrabalhosPublicos() {
  const { loading, filters, setFilter, trabalhos, analytics } = useTrabalhosPublicos();
  const [granularity, setGranularity] = useState<PeriodGranularity>("mes");

  const periodSeries = useMemo(
    () => buildPeriodSeries(analytics.filtered, granularity),
    [analytics.filtered, granularity],
  );

  const novosVsRec = [
    { name: "Novos", value: analytics.novos },
    { name: "Recorrentes", value: analytics.recorrentes },
  ];

  const exportTrabalhos = () =>
    exportCsv(
      "trabalhos_publicos_participacao.csv",
      ["Trabalho", "Participantes", "Presenças", "Sessões", "Média/Sessão", "Taxa Retorno"],
      analytics.porTrabalho.map((t) => [
        t.tratamentoNome,
        String(t.participantes),
        String(t.presencas),
        String(t.sessoes),
        String(t.mediaPorSessao),
        `${t.taxaRetorno}%`,
      ]),
    );

  const exportFaixas = () =>
    exportCsv(
      "trabalhos_publicos_faixa_etaria.csv",
      ["Faixa Etária", "Participantes", "Presenças", "% Participantes"],
      analytics.porFaixa.map((f) => [f.faixa, String(f.participantes), String(f.presencas), `${f.percentual}%`]),
    );

  if (loading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Carregando dados reais...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Início</Label>
              <Input type="date" value={filters.dataInicio} onChange={(e) => setFilter("dataInicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Fim</Label>
              <Input type="date" value={filters.dataFim} onChange={(e) => setFilter("dataFim", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trabalho Público</Label>
              <Select value={filters.tratamentoId} onValueChange={(v) => setFilter("tratamentoId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {trabalhos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Faixa Etária</Label>
              <Select value={filters.faixa} onValueChange={(v) => setFilter("faixa", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {FAIXA_ORDER.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Participante</Label>
              <Select value={filters.tipoParticipante} onValueChange={(v) => setFilter("tipoParticipante", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="novo">Novos</SelectItem>
                  <SelectItem value="recorrente">Recorrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Check-in</Label>
              <Select value={filters.modoCheckin} onValueChange={(v) => setFilter("modoCheckin", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="qr">QR Code</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Participantes" value={analytics.totalParticipantes} icon={Users} />
        <StatCard title="Presenças" value={analytics.totalPresencas} subtitle={`${analytics.totalSessoes} sessões`} icon={CalendarCheck} />
        <StatCard title="Novos" value={`${analytics.novos}`} subtitle={`${analytics.percentualNovos}% do total`} icon={UserPlus} />
        <StatCard title="Recorrentes" value={`${analytics.recorrentes}`} subtitle={`${analytics.percentualRecorrentes}% • retorno ${analytics.retornoMedio}x`} icon={Repeat} />
      </div>

      {/* Insights */}
      {analytics.insights.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Leitura analítica</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analytics.insights.map((t, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Gráfico principal: participação por período */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Participação por período
          </CardTitle>
          <Select value={granularity} onValueChange={(v) => setGranularity(v as PeriodGranularity)}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Semanal</SelectItem>
              <SelectItem value="mes">Mensal</SelectItem>
              <SelectItem value="ano">Anual</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {periodSeries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum dado no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={periodSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="presencas" name="Presenças" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="participantes" name="Participantes" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Novos vs recorrentes */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Novos vs Recorrentes</CardTitle></CardHeader>
          <CardContent>
            {analytics.totalParticipantes === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem participantes</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={novosVsRec} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {novosVsRec.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Participação por faixa */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Participação por faixa etária</CardTitle>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={exportFaixas}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </CardHeader>
          <CardContent>
            {analytics.porFaixa.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.porFaixa}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="participantes" name="Participantes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de trabalhos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Ranking de trabalhos públicos</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={exportTrabalhos}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {analytics.porTrabalho.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(160, analytics.porTrabalho.length * 44)}>
              <BarChart data={analytics.porTrabalho} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="tratamentoNome" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="presencas" name="Presenças" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabalho</TableHead>
                  <TableHead className="text-center">Participantes</TableHead>
                  <TableHead className="text-center">Presenças</TableHead>
                  <TableHead className="text-center">Sessões</TableHead>
                  <TableHead className="text-center">Média/Sessão</TableHead>
                  <TableHead className="text-center">Taxa Retorno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.porTrabalho.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : analytics.porTrabalho.map((t) => (
                  <TableRow key={t.tratamentoId}>
                    <TableCell className="font-medium">{t.tratamentoNome}</TableCell>
                    <TableCell className="text-center">{t.participantes}</TableCell>
                    <TableCell className="text-center">{t.presencas}</TableCell>
                    <TableCell className="text-center">{t.sessoes}</TableCell>
                    <TableCell className="text-center">{t.mediaPorSessao}</TableCell>
                    <TableCell className="text-center">{t.taxaRetorno}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reincidência / retorno */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Reincidência / Retorno</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <StatCard title="Retorno Médio" value={`${analytics.retornoMedio}x`} icon={Repeat} />
            <StatCard title="Taxa de Retorno" value={`${analytics.taxaRetornoGeral}%`} icon={TrendingUp} />
            <StatCard title="Participantes" value={analytics.totalParticipantes} icon={Users} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-center">Participações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topParticipantes.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : analytics.topParticipantes.map((p) => (
                  <TableRow key={p.participantKey}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.faixa}</TableCell>
                    <TableCell className="text-center font-medium">{p.participacoes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
