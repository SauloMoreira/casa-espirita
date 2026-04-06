import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sugestao {
  id: string;
  entrevista_id: string | null;
  assistido_id: string;
  entrevistador_id: string;
  resumo_ia: string | null;
  queixas_identificadas_json: any;
  tratamentos_sugeridos_json: any;
  quantidades_sugeridas_json: any;
  justificativa_ia: string | null;
  status: string;
  created_at: string;
}

export default function SugestoesIA() {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Sugestao | null>(null);
  const [assistidos, setAssistidos] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetch_ = async () => {
      const { data } = await supabase.from("ia_sugestoes").select("*").order("created_at", { ascending: false });
      setSugestoes(data || []);
      setLoading(false);

      // Fetch assistido names
      if (data && data.length > 0) {
        const ids = [...new Set(data.map(s => s.assistido_id))];
        const { data: ass } = await supabase.from("assistidos").select("id, nome").in("id", ids);
        if (ass) {
          const map: Record<string, string> = {};
          ass.forEach(a => { map[a.id] = a.nome; });
          setAssistidos(map);
        }
      }
    };
    fetch_();
  }, []);

  const filtered = sugestoes.filter(s =>
    (assistidos[s.assistido_id] || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.resumo_ia || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por assistido ou resumo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Assistido</TableHead>
                <TableHead>Tratamentos sugeridos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma sugestão registrada</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="font-medium">{assistidos[s.assistido_id] || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(s.tratamentos_sugeridos_json) ? s.tratamentos_sugeridos_json.slice(0, 3).map((t: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{t.nome || t.tratamento || t}</Badge>
                      )) : <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={s.status === "pendente" ? "outline" : "default"}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDetail(s)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da Sugestão</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assistido</p>
                <p>{assistidos[detail.assistido_id] || detail.assistido_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resumo da IA</p>
                <p className="text-sm whitespace-pre-wrap">{detail.resumo_ia || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queixas identificadas</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(detail.queixas_identificadas_json, null, 2)}</pre>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tratamentos sugeridos</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(detail.tratamentos_sugeridos_json, null, 2)}</pre>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Justificativa</p>
                <p className="text-sm whitespace-pre-wrap">{detail.justificativa_ia || "—"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
