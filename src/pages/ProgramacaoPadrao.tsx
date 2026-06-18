import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock, Plus, Search, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  TIPO_PROGRAMACAO_OPTIONS, DIAS_SEMANA_OPTIONS, labelTipo, labelDiaSemana,
} from "@/constants/programacao";
import {
  listarProgramacao, salvarProgramacao, alternarAtivoProgramacao, excluirProgramacao,
  type ProgramacaoPadrao, type ProgramacaoInput,
} from "@/services/programacao/programacaoPadraoService";

const emptyForm: ProgramacaoInput = {
  tipo: "publico", atividade: "", dia_semana: 4, horario: null,
  frequencia: "semanal", observacao: "", ativo: true,
};

export default function ProgramacaoPadraoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProgramacaoPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("all");
  const [fDia, setFDia] = useState("all");
  const [fAtivo, setFAtivo] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramacaoInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarProgramacao({
        busca,
        tipo: fTipo === "all" ? undefined : fTipo,
        dia_semana: fDia === "all" ? null : parseInt(fDia, 10),
        ativo: fAtivo === "all" ? null : fAtivo === "ativos",
      });
      setRows(data);
    } catch (e: any) {
      toast.error("Erro ao carregar programação", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [fTipo, fDia, fAtivo]);

  const set = (patch: Partial<ProgramacaoInput>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: ProgramacaoPadrao) => {
    setEditId(r.id);
    setForm({
      tipo: r.tipo, atividade: r.atividade, dia_semana: r.dia_semana, horario: r.horario,
      frequencia: r.frequencia ?? "", observacao: r.observacao ?? "", ativo: r.ativo,
      tratamento_id: r.tratamento_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.atividade?.trim()) { toast.error("Informe a atividade."); return; }
    setSaving(true);
    try {
      const payload: ProgramacaoInput = {
        ...form,
        horario: form.horario || null,
        atualizado_por: user?.id ?? null,
        ...(editId ? {} : { criado_por: user?.id ?? null }),
      };
      await salvarProgramacao(payload, editId ?? undefined);
      toast.success(editId ? "Programação atualizada." : "Programação cadastrada.");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: ProgramacaoPadrao) => {
    try {
      await alternarAtivoProgramacao(r.id, !r.ativo);
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, ativo: !r.ativo } : x)));
    } catch (e: any) {
      toast.error("Erro ao atualizar", { description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await excluirProgramacao(deleteId);
      toast.success("Item removido.");
      setRows((rs) => rs.filter((x) => x.id !== deleteId));
    } catch (e: any) {
      toast.error("Erro ao remover", { description: e.message });
    } finally {
      setDeleteId(null);
    }
  };

  const fmtHora = (h: string | null) => (h ? h.slice(0, 5) : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Programação Padrão da Casa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Programação recorrente usada pela IA apenas como fallback, quando não há exceção nem sessão real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button size="sm" className="gap-1" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova programação
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Atividade ou observação" value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TIPO_PROGRAMACAO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dia da semana</Label>
            <Select value={fDia} onValueChange={setFDia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {DIAS_SEMANA_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Situação</Label>
            <Select value={fAtivo} onValueChange={setFAtivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ativos">Ativas</SelectItem>
                <SelectItem value="inativos">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma programação cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{labelDiaSemana(r.dia_semana)}</TableCell>
                      <TableCell>{fmtHora(r.horario)}</TableCell>
                      <TableCell><Badge variant="secondary">{labelTipo(r.tipo)}</Badge></TableCell>
                      <TableCell className="font-medium">{r.atividade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.frequencia || "—"}</TableCell>
                      <TableCell><Switch checked={r.ativo} onCheckedChange={() => handleToggle(r)} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar programação" : "Nova programação padrão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set({ tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_PROGRAMACAO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select value={String(form.dia_semana ?? 4)} onValueChange={(v) => set({ dia_semana: parseInt(v, 10) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Atividade *</Label>
              <Input value={form.atividade ?? ""} onChange={(e) => set({ atividade: e.target.value })}
                placeholder="Ex.: Palestra Pública" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={form.horario ?? ""} onChange={(e) => set({ horario: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Frequência</Label>
                <Input value={form.frequencia ?? ""} onChange={(e) => set({ frequencia: e.target.value })}
                  placeholder="Ex.: semanal" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea value={form.observacao ?? ""} onChange={(e) => set({ observacao: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.ativo} onCheckedChange={(v) => set({ ativo: v })} />
              <Label className="text-xs">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover programação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
