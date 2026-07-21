import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/PhotoUpload";
import { AddressFields } from "@/components/AddressFields";
import { ConsentimentoWhatsappCard } from "@/components/notificacoes/ConsentimentoWhatsappCard";
import { Switch } from "@/components/ui/switch";
import {
  getComunicacaoGeral,
  setComunicacaoGeral,
  type ComunicacaoGeralTarget,
} from "@/services/notificacoes/notificacoesService";
import { maskPhone, maskCPF, isValidPhone, isValidEmail } from "@/lib/validators";
import { User, Save, Megaphone } from "lucide-react";

export default function MeuPerfil() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAssistido = role === "assistido";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assistidoId, setAssistidoId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [staffMissing, setStaffMissing] = useState(false);
  const [comunicacaoGeral, setComunicacaoGeralState] = useState(true);
  const [savingPref, setSavingPref] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    celular: "",
    cpf: "",
    data_nascimento: "",
    foto_url: null as string | null,
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      if (isAssistido) {
        const { data: assistido } = await supabase
          .rpc("get_meu_registro_assistido" as never)
          .maybeSingle() as { data: any };

        if (assistido) {
          setAssistidoId(assistido.id);
          setForm({
            nome: assistido.nome || "",
            email: assistido.email || user.email || "",
            celular: assistido.celular ? maskPhone(assistido.celular) : "",
            cpf: assistido.cpf ? maskCPF(assistido.cpf) : "",
            data_nascimento: assistido.data_nascimento || "",
            foto_url: assistido.foto_url || null,
            cep: assistido.cep || "",
            logradouro: assistido.logradouro || "",
            numero: assistido.numero || "",
            complemento: assistido.complemento || "",
            bairro: assistido.bairro || "",
            cidade: assistido.cidade || "",
            estado: assistido.estado || "",
          });
          try {
            setComunicacaoGeralState(
              await getComunicacaoGeral({ tipo: "assistido", assistidoId: assistido.id }),
            );
          } catch {
            setComunicacaoGeralState(true);
          }
        }
        setLoading(false);
        return;
      }

      // Staff: fonte oficial é a tabela profiles, por user_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
        setForm((prev) => ({
          ...prev,
          nome: profile.nome_completo || "",
          email: user.email || "",
          celular: profile.celular ? maskPhone(profile.celular) : "",
          foto_url: profile.foto_url || null,
        }));
        try {
          setComunicacaoGeralState(
            await getComunicacaoGeral({ tipo: "staff", userId: user.id }),
          );
        } catch {
          setComunicacaoGeralState(true);
        }
      } else {
        setStaffMissing(true);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user, isAssistido]);

  const handleSave = async () => {
    if (form.celular && !isValidPhone(form.celular)) {
      toast({ title: "Celular inválido", variant: "destructive" });
      return;
    }

    setSaving(true);
    let error: { message: string } | null = null;

    if (isAssistido) {
      if (!assistidoId) {
        setSaving(false);
        return;
      }
      if (form.email && !isValidEmail(form.email)) {
        toast({ title: "E-mail inválido", variant: "destructive" });
        setSaving(false);
        return;
      }
      ({ error } = await supabase.from("assistidos").update({
        celular: form.celular.replace(/\D/g, "") || null,
        foto_url: form.foto_url || null,
        cep: form.cep.replace(/\D/g, "") || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim().toUpperCase() || null,
      } as any).eq("id", assistidoId));
    } else {
      if (!profileId || !user) {
        setSaving(false);
        return;
      }
      ({ error } = await supabase.from("profiles").update({
        celular: form.celular.replace(/\D/g, "") || null,
        foto_url: form.foto_url || null,
      } as any).eq("user_id", user.id));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
    }
    setSaving(false);
  };

  const handleToggleComunicacaoGeral = async (ativa: boolean) => {
    if (!user) return;
    const target: ComunicacaoGeralTarget = isAssistido
      ? { tipo: "assistido", assistidoId: assistidoId! }
      : { tipo: "staff", userId: user.id };
    if (isAssistido && !assistidoId) return;

    setComunicacaoGeralState(ativa);
    setSavingPref(true);
    try {
      await setComunicacaoGeral(target, ativa);
      toast({ title: "Preferência de comunicação atualizada!" });
    } catch (e: any) {
      setComunicacaoGeralState(!ativa);
      toast({ title: "Erro ao salvar preferência", description: e?.message, variant: "destructive" });
    }
    setSavingPref(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;
  }

  // Robustez: usuário válido sem registro de origem → mensagem tratável
  if ((isAssistido && !assistidoId) || (!isAssistido && (staffMissing || !profileId))) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center px-6">
        <User className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Não foi possível carregar o seu perfil</p>
        <p className="text-xs mt-1 max-w-sm">
          Seu cadastro ainda não está vinculado a um perfil. Entre em contato com a
          administração para regularizar o seu acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize e atualize seus dados</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PhotoUpload
            currentUrl={form.foto_url}
            onUrlChange={(url) => setForm({ ...form, foto_url: url })}
            folder={isAssistido ? "assistidos" : "profiles"}
          />

          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={form.nome} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Para alterar o nome, entre em contato com a administração.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input value={form.celular}
                onChange={(e) => setForm({ ...form, celular: maskPhone(e.target.value) })}
                placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>

          {isAssistido && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input value={form.data_nascimento} disabled className="bg-muted" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isAssistido && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Endereço (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressFields
              data={{
                cep: form.cep, logradouro: form.logradouro, numero: form.numero,
                complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
              }}
              onChange={(addr) => setForm({ ...form, ...addr })}
              errors={{}}
            />
          </CardContent>
        </Card>
      )}

      {isAssistido && assistidoId && <ConsentimentoWhatsappCard assistidoId={assistidoId} />}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Preferências de Comunicação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="comunicacao-geral" className="text-sm font-medium">
                Receber comunicações gerais da FER
              </Label>
              <p className="text-xs text-muted-foreground">
                {isAssistido
                  ? "Campanhas, eventos e comunicados institucionais. Avisos do seu tratamento (entrevistas, sessões, presença e faltas) continuam sendo enviados independentemente desta opção."
                  : "Campanhas, eventos e comunicados institucionais."}
              </p>
            </div>
            <Switch
              id="comunicacao-geral"
              checked={comunicacaoGeral}
              disabled={savingPref}
              onCheckedChange={handleToggleComunicacaoGeral}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar Perfil"}
      </Button>
    </div>
  );
}
