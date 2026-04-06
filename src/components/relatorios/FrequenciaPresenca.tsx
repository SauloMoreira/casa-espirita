import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CalendarCheck, CalendarX, Percent, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { exportCsv } from "@/lib/exportCsv";

interface Row {
  nome: string;
  tratamento: string;
  presencas: number;
  ausencias: number;
  total: number;
  percentual: number;
}

export default function FrequenciaPresenca() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const [rows, setRows] = useState<Row[]>([]);
  const { role, user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("presencas_tratamentos")
        .select("status_presenca, assistido_tratamento_id, data, assistido_tratamento:assistido_tratamentos(assistido_id, tratamento_id, tratamento:tipos_tratamento(nome, tarefeiro_id, coordenador_responsavel_id), assistido:assistidos(nome))")
        .gte("data", filters.dataInicio)
        .lte("data", filters.dataFim);

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

      const map = new Map<string, Row>();
      filtered.forEach((d: any) => {
        const at = d.assistido_tratamento as any;
        const key = d.assistido_tratamento_id;
        if (!map.has(key)) map.set(key, { nome: at.assistido.nome, tratamento: at.tratamento.nome, presencas: 0, ausencias: 0, total: 0, percentual: 0 });
        const r = map.get(key)!;
        r.total++;
        if (d.status_presenca === "presente") r.presencas++;
        else r.ausencias++;
      });

      map.forEach((r) => { r.percentual = r.total > 0 ? Math.round((r.presencas / r.total) * 100) : 0; });
      setRows([...map.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
    };
    fetch();
  }, [filters, role, user]);

  const totals = rows.reduce((acc, r) => ({ total: acc.total + r.total, presencas: acc.presencas + r.presencas, ausencias: acc.ausencias + r.ausencias }), { total: 0, presencas: 0, ausencias: 0 });
  const pctGeral = totals.total > 0 ? Math.round((totals.presencas / totals.total) * 100) : 0;

  const chartData = rows.slice(0, 10).map((r) => ({ name: r.nome.split(" ")[0], Presenças: r.presencas, Ausências: r.ausencias }));

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "assistidoId", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sessões" value={totals.total} icon={Calendar} />
        <StatCard title="Presenças" value={totals.presencas} icon={CalendarCheck} />
        <StatCard title="Ausências" value={totals.ausencias} icon={CalendarX} />
        <StatCard title="% Presença" value={`${pctGeral}%`} icon={Percent} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Presenças" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ausências" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Detalhamento</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCsv("frequencia_presenca.csv", ["Assistido", "Tratamento", "Presenças", "Ausências", "Total", "% Presença"], rows.map((r) => [r.nome, r.tratamento, String(r.presencas), String(r.ausencias), String(r.total), `${r.percentual}%`]))}>
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
                  <TableHead className="text-center">Presenças</TableHead>
                  <TableHead className="text-center">Ausências</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">% Presença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.tratamento}</TableCell>
                    <TableCell className="text-center">{r.presencas}</TableCell>
                    <TableCell className="text-center">{r.ausencias}</TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
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