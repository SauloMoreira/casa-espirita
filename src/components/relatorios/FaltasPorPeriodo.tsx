import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CalendarX, Users, Percent, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { exportCsv } from "@/lib/exportCsv";

interface Row {
  assistido: string;
  tratamento: string;
  totalFaltas: number;
  datasFaltas: string[];
  totalSessoes: number;
  percentual: number;
}

export default function FaltasPorPeriodo() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const [rows, setRows] = useState<Row[]>([]);
  const { role, user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("presencas_tratamentos")
        .select("status_presenca, data, assistido_tratamento_id, assistido_tratamento:assistido_tratamentos(assistido_id, tratamento_id, tratamento:tipos_tratamento(nome, tarefeiro_id, coordenador_responsavel_id), assistido:assistidos(nome))")
        .gte("data", filters.dataInicio)
        .lte("data", filters.dataFim)
        .limit(10000);

      if (filters.assistidoId !== "todos") q = q.eq("assistido_tratamento.assistido_id", filters.assistidoId);
      if (filters.tratamentoId !== "todos") q = q.eq("assistido_tratamento.tratamento_id", filters.tratamentoId);

      const { data } = await q;
      if (!data) { setRows([]); return; }

      const filtered = data.filter((d: any) => {
        const at = d.assistido_tratamento as any;
        if (!at || !at.tratamento || !at.assistido) return false;
        const t = at.tratamento;
        if (filters.tarefeiroId !== "todos" && t.tarefeiro_id !== filters.tarefeiroId) return false;
        if (filters.coordenadorId !== "todos" && t.coordenador_responsavel_id !== filters.coordenadorId) return false;
        if (role === "coordenador_de_tratamento" && t.coordenador_responsavel_id !== user?.id) return false;
        if (role === "tarefeiro" && t.tarefeiro_id && t.tarefeiro_id !== user?.id) return false;
        return true;
      });

      const map = new Map<string, { assistido: string; tratamento: string; faltas: string[]; total: number }>();
      filtered.forEach((d: any) => {
        const at = d.assistido_tratamento as any;
        const key = d.assistido_tratamento_id;
        if (!map.has(key)) map.set(key, { assistido: at.assistido.nome, tratamento: at.tratamento.nome, faltas: [], total: 0 });
        const r = map.get(key)!;
        r.total++;
        if (d.status_presenca === "ausente") r.faltas.push(d.data);
      });

      const result: Row[] = [];
      map.forEach((v) => {
        if (v.faltas.length > 0) {
          result.push({
            assistido: v.assistido,
            tratamento: v.tratamento,
            totalFaltas: v.faltas.length,
            datasFaltas: v.faltas.sort().map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR")),
            totalSessoes: v.total,
            percentual: Math.round((v.faltas.length / v.total) * 100),
          });
        }
      });

      setRows(result.sort((a, b) => b.totalFaltas - a.totalFaltas));
    };
    fetch();
  }, [filters, role, user]);

  const totalFaltas = rows.reduce((s, r) => s + r.totalFaltas, 0);
  const assistidosComFalta = new Set(rows.map((r) => r.assistido)).size;
  const pctMedio = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.percentual, 0) / rows.length) : 0;

  const chartData = rows.slice(0, 8).map((r) => ({ name: r.assistido.split(" ")[0], faltas: r.totalFaltas }));
  const colors = ["hsl(var(--destructive))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "assistidoId", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Faltas" value={totalFaltas} icon={CalendarX} />
        <StatCard title="Assistidos com Falta" value={assistidosComFalta} icon={Users} />
        <StatCard title="% Médio de Faltas" value={`${pctMedio}%`} icon={Percent} />
        <StatCard title="Vínculos com Falta" value={rows.length} icon={AlertTriangle} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="faltas" name="Faltas" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Detalhamento</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCsv("faltas_por_periodo.csv", ["Assistido", "Tratamento", "Total Faltas", "Datas", "Total Sessões", "% Faltas"], rows.map((r) => [r.assistido, r.tratamento, String(r.totalFaltas), r.datasFaltas.join(", "), String(r.totalSessoes), `${r.percentual}%`]))}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assistido</TableHead>
                  <TableHead>Tratamento</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead>Datas</TableHead>
                  <TableHead className="text-center">Total Sessões</TableHead>
                  <TableHead className="text-center">% Faltas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.assistido}</TableCell>
                    <TableCell className="text-sm">{r.tratamento}</TableCell>
                    <TableCell className="text-center font-medium">{r.totalFaltas}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.datasFaltas.join(", ")}</TableCell>
                    <TableCell className="text-center">{r.totalSessoes}</TableCell>
                    <TableCell className="text-center font-medium">{r.percentual}%</TableCell>
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