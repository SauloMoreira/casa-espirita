import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, User, UserCog, Search, MessageSquare } from "lucide-react";
import { ConversaDetalheDrawer } from "@/components/notificacoes/ConversaDetalheDrawer";
import {
  listConversasEnriquecidas,
  type ConversaEnriquecida, type ConversasFiltros,
} from "@/services/notificacoes/notificacoesService";

function dt(value?: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yy HH:mm", { locale: ptBR });
}

const AUTOR_META: Record<string, { label: string; cls: string; icon: any }> = {
  assistido: { label: "Assistido", cls: "bg-muted text-foreground", icon: User },
  ia: { label: "IA", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Bot },
  humano: { label: "Atendente", cls: "bg-primary/15 text-primary", icon: UserCog },
  sistema: { label: "Sistema", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", icon: MessageSquare },
};

function UltimoAutor({ autor }: { autor: ConversaEnriquecida["ultimo_autor"] }) {
  const meta = autor ? AUTOR_META[autor] : null;
  if (!meta) return <span className="text-muted-foreground">—</span>;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

const triBool = (v: string): boolean | null => (v === "sim" ? true : v === "nao" ? false : null);

export function ConversasTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ConversaEnriquecida[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<ConversaEnriquecida | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState("todos");
  const [identificado, setIdentificado] = useState("todos");
  const [handoff, setHandoff] = useState("todos");
  const [resolucaoIa, setResolucaoIa] = useState("todos");
  const [pendente, setPendente] = useState("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filtros: ConversasFiltros = {
        inicio: inicio || null,
        fim: fim || null,
        status: status === "todos" ? null : status,
        identificado: triBool(identificado),
        handoff: triBool(handoff),
        resolucaoIa: triBool(resolucaoIa),
        pendente: pendente === "sim" ? true : null,
        busca: busca || null,
      };
      const r = await listConversasEnriquecidas(filtros);
      setRows(r.rows);
      setTotal(r.total);
    } catch (e: any) {
      toast({ title: "Erro ao carregar conversas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [inicio, fim, status, identificado, handoff, resolucaoIa, pendente, busca, toast]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const abrir = (c: ConversaEnriquecida) => { setSelecionada(c); setDrawerOpen(true); };

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome ou telefone" className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Input type="date" aria-label="Data inicial" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <Input type="date" aria-label="Data final" value={fim} onChange={(e) => setFim(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativa">Aberta</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={identificado} onValueChange={setIdentificado}>
              <SelectTrigger aria-label="Identificação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Identificado: todos</SelectItem>
                <SelectItem value="sim">Identificado</SelectItem>
                <SelectItem value="nao">Não identificado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={handoff} onValueChange={setHandoff}>
              <SelectTrigger aria-label="Handoff"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Handoff: todos</SelectItem>
                <SelectItem value="sim">Com handoff</SelectItem>
                <SelectItem value="nao">Sem handoff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolucaoIa} onValueChange={setResolucaoIa}>
              <SelectTrigger aria-label="Resolução IA"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">IA: todos</SelectItem>
                <SelectItem value="sim">Respondida por IA</SelectItem>
                <SelectItem value="nao">Sem resposta da IA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pendente} onValueChange={setPendente}>
              <SelectTrigger aria-label="Pendência"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Pendência: todas</SelectItem>
                <SelectItem value="sim">Pendente de intervenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-2">{total} conversa(s)</p>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma conversa encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Última interação</TableHead>
                  <TableHead>Assistido</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último a responder</TableHead>
                  <TableHead>Handoff</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead className="text-right">Msgs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => abrir(c)}>
                    <TableCell className="whitespace-nowrap text-xs">{dt(c.ultimo_contato_em)}</TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {c.identificado ? (c.assistido_nome || "Assistido")
                        : <span className="text-muted-foreground">Não identificado</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{c.telefone}</TableCell>
                    <TableCell>
                      <Badge variant={c.status_conversa === "encerrada" ? "secondary" : "default"} className="text-[10px]">
                        {c.status_conversa === "encerrada" ? "Encerrada" : "Aberta"}
                      </Badge>
                    </TableCell>
                    <TableCell><UltimoAutor autor={c.ultimo_autor} /></TableCell>
                    <TableCell>
                      {c.tem_handoff
                        ? <Badge variant="outline" className="text-[10px]">{c.handoff_status || "—"}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{c.atendente_nome || "—"}</TableCell>
                    <TableCell className="text-right text-xs">{c.total_mensagens}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => abrir(c)}>Abrir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConversaDetalheDrawer
        conversa={selecionada}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={load}
      />
    </div>
  );
}
