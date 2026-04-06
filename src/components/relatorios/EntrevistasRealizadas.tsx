import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, FileText, Users, ClipboardList, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { exportCsv } from "@/lib/exportCsv";

interface Row {
  id: string;
  data: string;
  assistido: string;
  entrevistador: string;
  tipo: string;
  status: string;
  tratamentosAtribuidos: number;
}

export default function EntrevistasRealizadas() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const [rows, setRows] = useState<Row[]>([]);
  const [entrevistadorNames, setEntrevistadorNames] = useState<Map<string, string>>(new Map());
  const { role, user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("entrevistas_fraternas")
        .select("id, data, assistido_id, entrevistador_id, tipo_entrevista, status, assistido:assistidos(nome)")
        .gte("data", filters.dataInicio)
        .lte("data", filters.dataFim + "T23:59:59")
        .in("status", ["concluida", "realizada"]);

      q = q.limit(5000);
      if (filters.entrevistadorId !== "todos") q = q.eq("entrevistador_id", filters.entrevistadorId);
      if (filters.tipoEntrevista !== "todos") q = q.eq("tipo_entrevista", filters.tipoEntrevista);
      if (role === "entrevistador") q = q.eq("entrevistador_id", user!.id);

      const { data } = await q;
      if (!data || data.length === 0) { setRows([]); return; }

      // Get entrevistador names
      const eIds = [...new Set(data.map((d: any) => d.entrevistador_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome_completo").in("user_id", eIds);
      const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.nome_completo || "—"]));
      setEntrevistadorNames(nameMap);

      // Get treatment counts per entrevista
      const entrevistaIds = data.map((d: any) => d.id);
      const { data: tratamentos } = await supabase.from("assistido_tratamentos").select("entrevista_id").in("entrevista_id", entrevistaIds);
      const tratCount = new Map<string, number>();
      (tratamentos || []).forEach((t) => {
        if (t.entrevista_id) tratCount.set(t.entrevista_id, (tratCount.get(t.entrevista_id) || 0) + 1);
      });

      setRows(data.map((d: any) => ({
        id: d.id,
        data: new Date(d.data).toLocaleDateString("pt-BR"),
        assistido: d.assistido?.nome || "—",
        entrevistador: nameMap.get(d.entrevistador_id) || "—",
        tipo: d.tipo_entrevista === "regular" ? "Regular" : "Retorno",
        status: d.status,
        tratamentosAtribuidos: tratCount.get(d.id) || 0,
      })));
    };
    fetch();
  }, [filters, role, user]);

  const totalRegulares = rows.filter((r) => r.tipo === "Regular").length;
  const totalRetornos = rows.filter((r) => r.tipo === "Retorno").length;
  const totalTrat = rows.reduce((s, r) => s + r.tratamentosAtribuidos, 0);

  const porEntrevistador = Array.from(
    rows.reduce((m, r) => { m.set(r.entrevistador, (m.get(r.entrevistador) || 0) + 1); return m; }, new Map<string, number>())
  ).map(([name, count]) => ({ name: name.split(" ")[0], total: count }));

  const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "entrevistadorId", "tipoEntrevista"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Entrevistas" value={rows.length} icon={FileText} />
        <StatCard title="Regulares" value={totalRegulares} icon={ClipboardList} />
        <StatCard title="Retornos" value={totalRetornos} icon={Calendar} />
        <StatCard title="Tratamentos Atribuídos" value={totalTrat} icon={Users} />
      </div>

      {porEntrevistador.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEntrevistador}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Entrevistas" radius={[4, 4, 0, 0]}>
                  {porEntrevistador.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Detalhamento</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCsv("entrevistas_realizadas.csv", ["Data", "Assistido", "Entrevistador", "Tipo", "Tratamentos Atribuídos"], rows.map((r) => [r.data, r.assistido, r.entrevistador, r.tipo, String(r.tratamentosAtribuidos)]))}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Assistido</TableHead>
                  <TableHead>Entrevistador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Trat. Atribuídos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.data}</TableCell>
                    <TableCell className="font-medium">{r.assistido}</TableCell>
                    <TableCell className="text-sm">{r.entrevistador}</TableCell>
                    <TableCell className="text-sm">{r.tipo}</TableCell>
                    <TableCell className="text-center">{r.tratamentosAtribuidos}</TableCell>
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