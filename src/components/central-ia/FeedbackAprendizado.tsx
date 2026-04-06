import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CLASSIFICACOES = ["acertou totalmente", "acertou parcialmente", "inadequada", "inconclusiva", "sem uso"];

interface Feedback {
  id: string;
  sugestao_ia_id: string;
  avaliador_id: string;
  classificacao: string;
  motivo_ajuste: string | null;
  observacao: string | null;
  created_at: string;
  sugestao_original_json: any;
  atribuicao_final_json: any;
}

interface Sugestao {
  id: string;
  assistido_id: string;
  resumo_ia: string | null;
  tratamentos_sugeridos_json: any;
  created_at: string;
  status: string;
}

export default function FeedbackAprendizado() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [sugestoesPendentes, setSugestoesPendentes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSugestao, setSelectedSugestao] = useState<Sugestao | null>(null);
  const [classificacao, setClassificacao] = useState("acertou parcialmente");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  const fetch_ = async () => {
    const [{ data: fb }, { data: sug }] = await Promise.all([
      supabase.from("ia_feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("ia_sugestoes").select("*").eq("status", "pendente").order("created_at", { ascending: false }),
    ]);
    setFeedbacks(fb || []);
    setSugestoesPendentes(sug || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const handleSubmitFeedback = async () => {
    if (!selectedSugestao || !user) return;
    const { error } = await supabase.from("ia_feedback").insert({
      sugestao_ia_id: selectedSugestao.id,
      avaliador_id: user.id,
      classificacao,
      motivo_ajuste: motivo || null,
      observacao: obs || null,
      sugestao_original_json: selectedSugestao.tratamentos_sugeridos_json,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    await supabase.from("ia_sugestoes").update({ status: "avaliada" }).eq("id", selectedSugestao.id);
    toast({ title: "Feedback registrado" });
    setShowForm(false);
    setSelectedSugestao(null);
    setMotivo("");
    setObs("");
    fetch_();
  };

  const classColor = (c: string) => {
    if (c === "acertou totalmente") return "default";
    if (c === "acertou parcialmente") return "secondary";
    if (c === "inadequada") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {sugestoesPendentes.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Sugestões aguardando feedback ({sugestoesPendentes.length})
            </h3>
            <div className="space-y-2">
              {sugestoesPendentes.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    <span className="ml-2">{(s.resumo_ia || "").slice(0, 80)}...</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedSugestao(s); setShowForm(true); }}>
                    Avaliar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : feedbacks.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum feedback registrado</TableCell></TableRow>
              ) : feedbacks.map(f => (
                <TableRow key={f.id}>
                  <TableCell>{format(new Date(f.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell><Badge variant={classColor(f.classificacao) as any} className="capitalize">{f.classificacao}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{f.motivo_ajuste || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{f.observacao || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Avaliar Sugestão da IA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedSugestao && (
              <div className="p-3 bg-muted rounded text-sm">
                <p className="font-medium mb-1">Resumo da IA:</p>
                <p className="text-muted-foreground">{(selectedSugestao.resumo_ia || "").slice(0, 300)}</p>
              </div>
            )}
            <div><Label>Classificação</Label>
              <Select value={classificacao} onValueChange={setClassificacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLASSIFICACOES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Motivo do ajuste</Label><Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} /></div>
            <div><Label>Observação</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSubmitFeedback}>Registrar Feedback</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
