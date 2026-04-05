import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, HandHeart, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Assistido {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  observacoes: string | null;
  status: string;
  quantidade_palestras: number;
}

const STATUS_OPTIONS = [
  { value: "aguardando_palestras", label: "Aguardando Palestras" },
  { value: "apto_para_entrevista", label: "Apto para Entrevista" },
  { value: "entrevista_agendada", label: "Entrevista Agendada" },
  { value: "entrevistado", label: "Entrevistado" },
  { value: "em_tratamento", label: "Em Tratamento" },
  { value: "concluido", label: "Concluído" },
  { value: "inativo", label: "Inativo" },
];

const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s;

const emptyForm = { nome: "", telefone: "", email: "", data_nascimento: "", endereco: "", observacoes: "", status: "aguardando_palestras", quantidade_palestras: "0" };

export default function Assistidos() {
  const [assistidos, setAssistidos] = useState<Assistido[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAssistidos = async () => {
    const { data } = await supabase.from("assistidos").select("*").is("deleted_at", null).order("nome");
    if (data) setAssistidos(data as any);
  };

  useEffect(() => { fetchAssistidos(); }, []);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setLoading(true);
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      data_nascimento: form.data_nascimento || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      status: form.status,
      quantidade_palestras: parseInt(form.quantidade_palestras) || 0,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("assistidos").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("assistidos").insert({ ...payload, created_by: user!.id }));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Assistido atualizado" : "Assistido cadastrado" });
      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      fetchAssistidos();
    }
    setLoading(false);
  };

  const openEdit = (a: Assistido) => {
    setEditId(a.id);
    setForm({
      nome: a.nome, telefone: a.telefone || "", email: a.email || "",
      data_nascimento: a.data_nascimento || "", endereco: a.endereco || "",
      observacoes: a.observacoes || "", status: a.status,
      quantidade_palestras: a.quantidade_palestras?.toString() || "0",
    });
    setOpen(true);
  };

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };

  const filtered = assistidos.filter((a) => {
    const matchSearch = a.nome.toLowerCase().includes(search.toLowerCase()) ||
      (a.telefone && a.telefone.includes(search));
    const matchStatus = statusFilter === "todos" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Assistidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro e acompanhamento</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo Assistido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Assistido" : "Novo Assistido"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Palestras Assistidas</Label>
                  <Input type="number" min={0} value={form.quantidade_palestras} onChange={(e) => setForm({ ...form, quantidade_palestras: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={loading} className="w-full">
                {loading ? "Salvando..." : editId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Todos os status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <HandHeart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum assistido encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead>Palestras</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.telefone || "—"}</TableCell>
                      <TableCell>{a.quantidade_palestras}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "em_tratamento" ? "default" : "secondary"} className="text-xs">
                          {statusLabel(a.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
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
    </div>
  );
}
