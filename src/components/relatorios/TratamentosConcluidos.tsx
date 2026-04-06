import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CheckCircle, Users, Activity, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportCsv } from "@/lib/exportCsv";

interface Row {
  id: string;
  assistido: string;
  tratamento: string;
  dataInicio: string;
  dataConclusao: string;
  total: number;
  realizada: number;
  status: string;
}

export default function TratamentosConcluidos() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const [rows, setRows] = useState<Row[]>([]);
  const { role, user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("assistido_tratamentos")
        .select("id, data_inicio, quantidade_total, quantidade_realizada, status, updated_at, assistido:assistidos(nome), tratamento:tipos_tratamento(nome, tarefeiro_id, coordenador_responsavel_id)")
        .eq("status", "concluido")
        .gte("updated_at", filters.dataInicio)
        .lte("updated_at", filters.dataFim + "T23:59:59");

      if (filters.tratamentoId !== "todos") q = q.eq("tratamento_id", filters.tratamentoId);

      const { data } = await q;
      if (!data) { setRows([]); return; }

      const filtered = data.filter((d: any) => {
        const t = d.tratamento as any;
        if (!t) return false;
        if (filters.tarefeiroId !== "todos" && t.tarefeiro_id !== filters.tarefeiroId) return false;
        if (filters.coordenadorId !== "todos" && t.coordenador_responsavel_id !== filters.coordenadorId) return false;
        if (role === "coordenador_de_tratamento" && t.coordenador_responsavel_id !== user?.id) return false;
        if (role === "tarefeiro" && t.tarefeiro_id && t.tarefeiro_id !== user?.id) return false;
        return true;
      });

      setRows(filtered.map((d: any) => ({
        id: d.id,
        assistido: d.assistido?.nome || "—",
        tratamento: d.tratamento?.nome || "—",
        dataInicio: d.data_inicio ? new Date(d.data_inicio + "T12:00:00").toLocaleDateString("pt-BR") : "—",
        dataConclusao: new Date(d.updated_at).toLocaleDateString("pt-BR"),
        total: d.quantidade_total,
        realizada: d.quantidade_realizada,
        status: d.status,
      })));
    };
    fetch();
  }, [filters, role, user]);

  const assistidosUnicos = new Set(rows.map((r) => r.assistido)).size;
  const tratamentosUnicos = new Set(rows.map((r) => r.tratamento)).size;
  const totalSessoes = rows.reduce((s, r) => s + r.realizada, 0);

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Concluídos" value={rows.length} icon={CheckCircle} />
        <StatCard title="Assistidos" value={assistidosUnicos} icon={Users} />
        <StatCard title="Tratamentos" value={tratamentosUnicos} icon={Activity} />
        <StatCard title="Sessões Realizadas" value={totalSessoes} icon={Calendar} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Detalhamento</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCsv("tratamentos_concluidos.csv", ["Assistido", "Tratamento", "Início", "Conclusão", "Total", "Realizada", "Status"], rows.map((r) => [r.assistido, r.tratamento, r.dataInicio, r.dataConclusao, String(r.total), String(r.realizada), r.status]))}>
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
                  <TableHead>Início</TableHead>
                  <TableHead>Conclusão</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realizada</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.assistido}</TableCell>
                    <TableCell className="text-sm">{r.tratamento}</TableCell>
                    <TableCell className="text-sm">{r.dataInicio}</TableCell>
                    <TableCell className="text-sm">{r.dataConclusao}</TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
                    <TableCell className="text-center">{r.realizada}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">Concluído</Badge></TableCell>
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