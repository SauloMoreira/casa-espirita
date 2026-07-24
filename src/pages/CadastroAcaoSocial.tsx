import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressFields } from "@/components/AddressFields";
import {
  Camera,
  Paperclip,
  Plus,
  Search,
  Trash2,
  HeartHandshake,
} from "lucide-react";

const TIPOS_DOC_BENEFICIARIO = [
  { value: "comprovante_endereco", label: "Comprovante de endereço" },
  { value: "cpf", label: "CPF" },
  { value: "outro", label: "Outro" },
];

const TIPOS_DOC_PARENTE = [
  { value: "cpf", label: "CPF" },
  { value: "certidao_nascimento", label: "Certidão de nascimento" },
  { value: "carteira_vacinacao", label: "Carteira de vacinação" },
  { value: "comprovante_matricula", label: "Comprovante de matrícula" },
  { value: "outro", label: "Outro" },
];

const TIPOS_PARENTE = [
  { value: "esposa", label: "Esposa" },
  { value: "marido", label: "Marido" },
  { value: "filho", label: "Filho" },
  { value: "filha", label: "Filha" },
  { value: "agregado", label: "Agregado" },
  { value: "outro", label: "Outro" },
];

function calcularIdade(dataNascimentoStr: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimentoStr);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aniversarioJaPassouEsteAno =
    hoje.getMonth() > nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() >= nascimento.getDate());
  if (!aniversarioJaPassouEsteAno) idade--;
  return idade;
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

interface Parente {
  id?: string;
  nome: string;
  tipo: string;
  data_nascimento: string;
}

interface Beneficiario {
  id: string;
  nome: string;
  cpf: string | null;
  celular: string | null;
  ativo: boolean;
  beneficio_desde: string;
  nova_data_limite: string | null;
  prorrogado: boolean;
  cidade: string | null;
  data_nascimento: string | null;
}

const emptyAddress = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

const emptyForm = () => ({
  id: null as string | null,
  assistido_id: null as string | null,
  nome: "",
  data_nascimento: "",
  cpf: "",
  rg: "",
  celular: "",
  endereco: { ...emptyAddress },
  situacao_moradia: "" as string,
  renda_familiar: "" as string,
  bens: "",
  gasto_luz: "" as string,
  gasto_agua: "" as string,
  gasto_gas: "" as string,
  gasto_alimentacao: "" as string,
  observacoes: "",
  ativo: true,
  beneficio_desde: new Date().toISOString().slice(0, 10),
  prorrogado: false,
  motivo_prorrogacao: "",
  nova_data_limite: "" as string,
  parentes: [] as Parente[],
});

export default function CadastroAcaoSocial() {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const isAdmin = roles.includes("admin");

  const [lista, setLista] = useState<Beneficiario[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [salvando, setSalvando] = useState(false);

  // Assistido search
  const [buscaAssistido, setBuscaAssistido] = useState("");
  const [resultadosAssistido, setResultadosAssistido] = useState<any[]>([]);

  const isEditando = !!form.id;
  const datasBeneficioBloqueadas = isEditando && !isAdmin;

  const carregarLista = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("acao_social_beneficiarios")
      .select("id, nome, cpf, celular, ativo, beneficio_desde, nova_data_limite, prorrogado, cidade, data_nascimento")
      .order("nome", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar beneficiários", description: error.message, variant: "destructive" });
      return;
    }
    setLista((data as any) || []);
  };

  useEffect(() => {
    carregarLista();
  }, []);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (b) =>
        b.nome.toLowerCase().includes(q) ||
        (b.cpf ?? "").toLowerCase().includes(q) ||
        (b.celular ?? "").toLowerCase().includes(q),
    );
  }, [busca, lista]);

  const openNovo = () => {
    setForm(emptyForm());
    setBuscaAssistido("");
    setResultadosAssistido([]);
    setDialogOpen(true);
  };

  const openEditar = async (id: string) => {
    const { data: b, error } = await supabase
      .from("acao_social_beneficiarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !b) {
      toast({ title: "Erro ao abrir cadastro", description: error?.message, variant: "destructive" });
      return;
    }
    const { data: pars } = await supabase
      .from("acao_social_parentes")
      .select("*")
      .eq("beneficiario_id", id)
      .order("created_at", { ascending: true });
    const bb = b as any;
    setForm({
      id: bb.id,
      assistido_id: bb.assistido_id,
      nome: bb.nome ?? "",
      data_nascimento: bb.data_nascimento ?? "",
      cpf: bb.cpf ?? "",
      rg: bb.rg ?? "",
      celular: bb.celular ?? "",
      endereco: {
        cep: bb.cep ?? "",
        logradouro: bb.logradouro ?? "",
        numero: bb.numero ?? "",
        complemento: bb.complemento ?? "",
        bairro: bb.bairro ?? "",
        cidade: bb.cidade ?? "",
        estado: bb.estado ?? "",
      },
      situacao_moradia: bb.situacao_moradia ?? "",
      renda_familiar: bb.renda_familiar != null ? String(bb.renda_familiar) : "",
      bens: bb.bens ?? "",
      gasto_luz: bb.gasto_luz != null ? String(bb.gasto_luz) : "",
      gasto_agua: bb.gasto_agua != null ? String(bb.gasto_agua) : "",
      gasto_gas: bb.gasto_gas != null ? String(bb.gasto_gas) : "",
      gasto_alimentacao: bb.gasto_alimentacao != null ? String(bb.gasto_alimentacao) : "",
      observacoes: bb.observacoes ?? "",
      ativo: bb.ativo,
      beneficio_desde: bb.beneficio_desde,
      prorrogado: bb.prorrogado,
      motivo_prorrogacao: bb.motivo_prorrogacao ?? "",
      nova_data_limite: bb.nova_data_limite ?? "",
      parentes: ((pars as any) || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        data_nascimento: p.data_nascimento ?? "",
      })),
    });
    setBuscaAssistido("");
    setResultadosAssistido([]);
    setDialogOpen(true);
  };

  const buscarAssistidos = async () => {
    const q = buscaAssistido.trim();
    if (q.length < 2) return;
    const { data } = await supabase
      .from("assistidos")
      .select("id, nome, cpf, celular, cep, logradouro, numero, complemento, bairro, cidade, estado, data_nascimento")
      .or(`nome.ilike.%${q}%,cpf.ilike.%${q}%`)
      .limit(10);
    setResultadosAssistido((data as any) || []);
  };

  const vincularAssistido = (a: any) => {
    setForm((f) => ({
      ...f,
      assistido_id: a.id,
      nome: a.nome ?? f.nome,
      cpf: a.cpf ?? f.cpf,
      celular: a.celular ?? f.celular,
      data_nascimento: a.data_nascimento ?? f.data_nascimento,
      endereco: {
        cep: a.cep ?? "",
        logradouro: a.logradouro ?? "",
        numero: a.numero ?? "",
        complemento: a.complemento ?? "",
        bairro: a.bairro ?? "",
        cidade: a.cidade ?? "",
        estado: a.estado ?? "",
      },
    }));
    setResultadosAssistido([]);
    setBuscaAssistido("");
  };

  const setParente = (idx: number, patch: Partial<Parente>) => {
    setForm((f) => ({
      ...f,
      parentes: f.parentes.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  };

  const addParente = () => {
    setForm((f) => ({
      ...f,
      parentes: [...f.parentes, { nome: "", tipo: "filho", data_nascimento: "" }],
    }));
  };

  const removerParente = (idx: number) => {
    setForm((f) => ({ ...f, parentes: f.parentes.filter((_, i) => i !== idx) }));
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (form.prorrogado && !form.motivo_prorrogacao.trim()) {
      toast({ title: "Informe o motivo da prorrogação", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const payload: any = {
      assistido_id: form.assistido_id,
      nome: form.nome.trim(),
      data_nascimento: form.data_nascimento || null,
      cpf: form.cpf || null,
      rg: form.rg || null,
      celular: form.celular || null,
      cep: form.endereco.cep || null,
      logradouro: form.endereco.logradouro || null,
      numero: form.endereco.numero || null,
      complemento: form.endereco.complemento || null,
      bairro: form.endereco.bairro || null,
      cidade: form.endereco.cidade || null,
      estado: form.endereco.estado || null,
      situacao_moradia: form.situacao_moradia || null,
      renda_familiar: form.renda_familiar ? Number(form.renda_familiar) : null,
      bens: form.bens || null,
      gasto_luz: form.gasto_luz ? Number(form.gasto_luz) : null,
      gasto_agua: form.gasto_agua ? Number(form.gasto_agua) : null,
      gasto_gas: form.gasto_gas ? Number(form.gasto_gas) : null,
      gasto_alimentacao: form.gasto_alimentacao ? Number(form.gasto_alimentacao) : null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
      prorrogado: form.prorrogado,
      motivo_prorrogacao: form.prorrogado ? form.motivo_prorrogacao : null,
      updated_by: user?.id,
    };
    if (!datasBeneficioBloqueadas) {
      payload.beneficio_desde = form.beneficio_desde;
      payload.nova_data_limite = form.nova_data_limite || null;
    }

    let beneficiarioId = form.id;
    if (form.id) {
      const { error } = await supabase
        .from("acao_social_beneficiarios")
        .update(payload)
        .eq("id", form.id);
      if (error) {
        setSalvando(false);
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      payload.created_by = user?.id;
      const { data, error } = await supabase
        .from("acao_social_beneficiarios")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        toast({ title: "Erro ao criar", description: error?.message, variant: "destructive" });
        return;
      }
      beneficiarioId = (data as any).id;
    }

    if (beneficiarioId) {
      // Diff-based save: preserva ids existentes (mantém documentos vinculados),
      // insere só novos e deleta só os removidos da tela.
      const parentesValidos = form.parentes.filter((p) => p.nome.trim());

      const { data: existentes, error: exErr } = await supabase
        .from("acao_social_parentes")
        .select("id")
        .eq("beneficiario_id", beneficiarioId);
      if (exErr) {
        setSalvando(false);
        toast({ title: "Erro ao carregar parentes", description: exErr.message, variant: "destructive" });
        return;
      }
      const idsExistentes = new Set<string>(((existentes as any) || []).map((r: any) => r.id as string));
      const idsMantidos = new Set<string>(
        parentesValidos.filter((p) => p.id && idsExistentes.has(p.id)).map((p) => p.id as string),
      );

      // UPDATE dos que já têm id
      for (const p of parentesValidos) {
        if (p.id && idsExistentes.has(p.id)) {
          const { error: uerr } = await supabase
            .from("acao_social_parentes")
            .update({
              nome: p.nome.trim(),
              tipo: p.tipo,
              data_nascimento: p.data_nascimento || null,
            })
            .eq("id", p.id);
          if (uerr) {
            setSalvando(false);
            toast({ title: "Erro ao atualizar parente", description: uerr.message, variant: "destructive" });
            return;
          }
        }
      }

      // INSERT dos novos (sem id, ou com id que não existe mais no banco)
      const novos = parentesValidos
        .filter((p) => !p.id || !idsExistentes.has(p.id))
        .map((p) => ({
          beneficiario_id: beneficiarioId,
          nome: p.nome.trim(),
          tipo: p.tipo,
          data_nascimento: p.data_nascimento || null,
        }));
      if (novos.length) {
        const { error: ierr } = await supabase.from("acao_social_parentes").insert(novos);
        if (ierr) {
          setSalvando(false);
          toast({ title: "Erro ao inserir parentes", description: ierr.message, variant: "destructive" });
          return;
        }
      }

      // DELETE apenas os removidos da tela
      const idsParaRemover = Array.from(idsExistentes).filter((id) => !idsMantidos.has(id));
      if (idsParaRemover.length) {
        const { error: derr } = await supabase
          .from("acao_social_parentes")
          .delete()
          .in("id", idsParaRemover);
        if (derr) {
          setSalvando(false);
          toast({ title: "Erro ao remover parentes", description: derr.message, variant: "destructive" });
          return;
        }
      }
    }

    setSalvando(false);
    toast({ title: form.id ? "Cadastro atualizado" : "Beneficiário cadastrado" });

    // Reload to fetch fresh parentes with ids
    if (beneficiarioId) {
      await openEditar(beneficiarioId);
    }
    carregarLista();
  };

  const dataLimiteCalculada = form.nova_data_limite
    ? form.nova_data_limite
    : form.beneficio_desde
    ? addYears(form.beneficio_desde, 2)
    : "";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" />
            Cadastro Ação Social
          </h1>
          <p className="text-sm text-muted-foreground">
            Beneficiários da cesta básica mensal.
          </p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="h-4 w-4 mr-2" /> Novo beneficiário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beneficiários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, CPF ou celular"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : listaFiltrada.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhum beneficiário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  listaFiltrada.map((b) => {
                    const limite = b.nova_data_limite ?? addYears(b.beneficio_desde, 2);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.nome}</TableCell>
                        <TableCell>{b.cpf ?? "—"}</TableCell>
                        <TableCell>{b.cidade ?? "—"}</TableCell>
                        <TableCell>{b.beneficio_desde}</TableCell>
                        <TableCell>{limite}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded ${b.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {b.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEditar(b.id)}>
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar beneficiário" : "Novo beneficiário"}</DialogTitle>
            <DialogDescription>
              Cadastro para acompanhamento da cesta básica mensal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {!form.id && (
              <div className="rounded-md border border-dashed p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Vincular a assistido existente (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome ou CPF"
                    value={buscaAssistido}
                    onChange={(e) => setBuscaAssistido(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        buscarAssistidos();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={buscarAssistidos}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {resultadosAssistido.length > 0 && (
                  <div className="space-y-1">
                    {resultadosAssistido.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => vincularAssistido(a)}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                      >
                        <span className="font-medium">{a.nome}</span>
                        <span className="text-muted-foreground"> — {a.cpf ?? "sem CPF"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.assistido_id && (
                  <p className="text-xs text-primary">Vinculado a assistido existente.</p>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                />
                {form.data_nascimento && (
                  <p className="text-xs text-muted-foreground">
                    Idade: {calcularIdade(form.data_nascimento)} anos
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Celular</Label>
                <Input
                  value={form.celular}
                  onChange={(e) => setForm({ ...form, celular: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Endereço
              </Label>
              <div className="mt-2">
                <AddressFields
                  data={form.endereco}
                  onChange={(d) => setForm({ ...form, endereco: d })}
                  required={false}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Situação de moradia</Label>
                <Select
                  value={form.situacao_moradia}
                  onValueChange={(v) => setForm({ ...form, situacao_moradia: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propria">Própria</SelectItem>
                    <SelectItem value="alugada">Alugada</SelectItem>
                    <SelectItem value="cedida">Cedida</SelectItem>
                    <SelectItem value="outra">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Renda familiar (R$)</Label>
                <Input
                  type="number"
                  value={form.renda_familiar}
                  onChange={(e) => setForm({ ...form, renda_familiar: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Bens</Label>
                <Textarea
                  rows={2}
                  value={form.bens}
                  onChange={(e) => setForm({ ...form, bens: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {(
                [
                  ["gasto_luz", "Gasto luz"],
                  ["gasto_agua", "Gasto água"],
                  ["gasto_gas", "Gasto gás"],
                  ["gasto_alimentacao", "Gasto alimentação"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Beneficiário desde</Label>
                <Input
                  type="date"
                  value={form.beneficio_desde}
                  disabled={datasBeneficioBloqueadas}
                  onChange={(e) => setForm({ ...form, beneficio_desde: e.target.value })}
                />
                {datasBeneficioBloqueadas && (
                  <p className="text-xs text-muted-foreground">
                    Apenas administradores podem alterar esta data após o cadastro.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Nova data limite</Label>
                <Input
                  type="date"
                  value={form.nova_data_limite || dataLimiteCalculada}
                  disabled={datasBeneficioBloqueadas}
                  onChange={(e) => setForm({ ...form, nova_data_limite: e.target.value })}
                />
                {!form.nova_data_limite && form.beneficio_desde && (
                  <p className="text-xs text-muted-foreground">
                    Limite padrão: {dataLimiteCalculada} (2 anos)
                  </p>
                )}
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <Switch
                  checked={form.prorrogado}
                  onCheckedChange={(v) => setForm({ ...form, prorrogado: v })}
                />
                <Label>Prorrogar benefício (exceção)</Label>
              </div>
              {form.prorrogado && (
                <div className="md:col-span-2 space-y-1">
                  <Label>Motivo da prorrogação *</Label>
                  <Textarea
                    rows={2}
                    value={form.motivo_prorrogacao}
                    onChange={(e) => setForm({ ...form, motivo_prorrogacao: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
              <Label>Ativo</Label>
            </div>

            {/* Anexos do beneficiário */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Documentos do responsável
              </Label>
              <AnexosDocumento
                beneficiarioId={form.id}
                parenteId={null}
                tipos={TIPOS_DOC_BENEFICIARIO}
              />
            </div>

            {/* Parentes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Parentes / composição familiar
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addParente}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {form.parentes.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum parente cadastrado.</p>
              )}
              {form.parentes.map((p, idx) => {
                const menor = p.data_nascimento ? calcularIdade(p.data_nascimento) < 18 : false;
                return (
                  <div key={p.id ?? idx} className="rounded-md border p-3 space-y-2">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Nome</Label>
                        <Input
                          value={p.nome}
                          onChange={(e) => setParente(idx, { nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Parentesco</Label>
                        <Select
                          value={p.tipo}
                          onValueChange={(v) => setParente(idx, { tipo: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_PARENTE.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Nascimento</Label>
                        <Input
                          type="date"
                          value={p.data_nascimento}
                          onChange={(e) => setParente(idx, { data_nascimento: e.target.value })}
                        />
                        {p.data_nascimento && (
                          <p className="text-xs text-muted-foreground">
                            {calcularIdade(p.data_nascimento)} anos
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {menor && p.id && (
                          <AnexosDocumento
                            beneficiarioId={form.id}
                            parenteId={p.id}
                            tipos={TIPOS_DOC_PARENTE}
                          />
                        )}
                        {menor && !p.id && (
                          <p className="text-xs text-muted-foreground">
                            Salve o cadastro para anexar documentos deste menor.
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removerParente(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Nested to reuse toast/user in this file
  function AnexosDocumento({
    beneficiarioId,
    parenteId,
    tipos,
  }: {
    beneficiarioId: string | null;
    parenteId?: string | null;
    tipos: { value: string; label: string }[];
  }) {
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [tipoSelecionado, setTipoSelecionado] = useState(tipos[0]?.value ?? "outro");
    const [enviando, setEnviando] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const carregar = async () => {
      if (!beneficiarioId) return;
      let query = supabase
        .from("acao_social_documentos")
        .select("*")
        .eq("beneficiario_id", beneficiarioId);
      query = parenteId ? query.eq("parente_id", parenteId) : query.is("parente_id", null);
      const { data } = await query.order("created_at", { ascending: false });
      setDocumentos(data || []);
    };

    useEffect(() => {
      carregar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beneficiarioId, parenteId]);

    const handleUpload = async (file: File) => {
      if (!beneficiarioId || !file) return;
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast({
          title: "Formato não suportado",
          description: "Envie uma foto ou um PDF.",
          variant: "destructive",
        });
        return;
      }
      setEnviando(true);
      const path = `${beneficiarioId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("acao-social-documentos")
        .upload(path, file);
      if (uploadError) {
        setEnviando(false);
        toast({
          title: "Erro ao enviar documento",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }
      const { error: insertError } = await supabase.from("acao_social_documentos").insert({
        beneficiario_id: beneficiarioId,
        parente_id: parenteId ?? null,
        tipo_documento: tipoSelecionado,
        storage_path: path,
        nome_arquivo: file.name,
        content_type: file.type,
        created_by: user?.id,
      } as any);
      setEnviando(false);
      if (insertError) {
        toast({
          title: "Erro ao registrar documento",
          description: insertError.message,
          variant: "destructive",
        });
        return;
      }
      carregar();
    };

    const handleVisualizar = async (doc: any) => {
      const { data } = await supabase.storage
        .from("acao-social-documentos")
        .createSignedUrl(doc.storage_path, 300);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    };

    const handleRemover = async (doc: any) => {
      await supabase.storage.from("acao-social-documentos").remove([doc.storage_path]);
      await supabase.from("acao_social_documentos").delete().eq("id", doc.id);
      carregar();
    };

    if (!beneficiarioId) {
      return (
        <p className="text-xs text-muted-foreground">Salve o cadastro para anexar documentos.</p>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={enviando}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1" /> Tirar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={enviando}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivo
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>
        {documentos.length > 0 && (
          <div className="space-y-1">
            {documentos.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1"
              >
                <span>
                  {tipos.find((t) => t.value === d.tipo_documento)?.label ?? d.tipo_documento} —{" "}
                  {d.nome_arquivo}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => handleVisualizar(d)}
                  >
                    Ver / Baixar
                  </button>
                  <button
                    type="button"
                    className="text-destructive underline"
                    onClick={() => handleRemover(d)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
