import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users as UsersIcon, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  entrevistador: "Entrevistador",
  tarefeiro: "Tarefeiro",
  assistido: "Assistido",
};

interface UserRow {
  user_id: string;
  role: string;
  email?: string;
}

export default function Usuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("assistido");
  const [loading, setLoading] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("assistido");
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    if (data) setUsers(data as any);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: newRole as any });
        toast({ title: "Usuário criado com sucesso" });
        setOpen(false);
        setNewEmail("");
        setNewPassword("");
        setNewRole("assistido");
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleUpdateRole = async () => {
    if (!editUserId) return;
    setLoading(true);
    const { error } = await supabase.from("user_roles").update({ role: editRole as any }).eq("user_id", editUserId);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado" });
      setEditOpen(false);
      fetchUsers();
    }
    setLoading(false);
  };

  const filtered = users.filter((u) => u.user_id.includes(search) || (u.email && u.email.includes(search)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciar acesso ao sistema</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateRole} disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UsersIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID do Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-mono text-xs">{u.user_id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="default">{ROLE_LABELS[u.role] || u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditUserId(u.user_id); setEditRole(u.role); setEditOpen(true); }}>
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
