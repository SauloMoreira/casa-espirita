import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Database,
  FileLock2,
  UserCheck,
  Mail,
  ArrowLeft,
} from "lucide-react";

interface Instituicao {
  nome_fantasia: string | null;
  razao_social: string | null;
  email_institucional: string | null;
  cidade: string | null;
  estado: string | null;
}

const secoes = [
  {
    icon: UserCheck,
    titulo: "Acesso e autenticação",
    itens: [
      "Cada pessoa acessa apenas com login e senha individuais — não há cadastro anônimo.",
      "Os perfis (administração, coordenação, entrevista, tarefa e assistido) determinam o que cada usuário pode ver e fazer.",
      "Administradores podem ativar verificação em duas etapas (2FA) para reforçar o acesso.",
    ],
  },
  {
    icon: Lock,
    titulo: "Proteção dos dados",
    itens: [
      "O tráfego entre o navegador e a plataforma é criptografado (HTTPS).",
      "As informações ficam protegidas por regras de acesso por linha (RLS) no banco de dados, garantindo que cada usuário veja somente o que lhe é permitido.",
      "Notas e observações internas dos atendimentos não são exibidas aos assistidos.",
    ],
  },
  {
    icon: Database,
    titulo: "Coleta e uso de dados",
    itens: [
      "Coletamos apenas os dados necessários para o acompanhamento dos atendimentos e da agenda.",
      "Os dados são usados exclusivamente para fins operacionais da casa espírita, nunca comercializados.",
      "Exclusões seguem o princípio de remoção segura, preservando o histórico necessário e a auditoria.",
    ],
  },
  {
    icon: Mail,
    titulo: "Comunicação e consentimento",
    itens: [
      "As comunicações por WhatsApp respeitam consentimento explícito e registro de opt-in/opt-out.",
      "É possível solicitar a interrupção das mensagens a qualquer momento.",
    ],
  },
  {
    icon: FileLock2,
    titulo: "Auditoria e rastreabilidade",
    itens: [
      "Ações sensíveis ficam registradas em trilhas de auditoria para acompanhamento interno.",
      "Acessos e alterações relevantes podem ser revisados pela administração.",
    ],
  },
  {
    icon: KeyRound,
    titulo: "Solicitações de privacidade",
    itens: [
      "Você pode solicitar acesso, correção ou remoção dos seus dados pelos canais de contato da instituição.",
      "Pedidos relacionados à privacidade são tratados pela administração responsável.",
    ],
  },
];

export default function SegurancaPrivacidade() {
  const [inst, setInst] = useState<Instituicao | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("instituicao_config")
        .select("nome_fantasia, razao_social, email_institucional, cidade, estado")
        .maybeSingle();
      if (data) setInst(data as Instituicao);
    })();
  }, []);

  const nome =
    inst?.nome_fantasia || inst?.razao_social || "a instituição";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao acesso
        </Link>

        <header className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <Badge variant="secondary" className="rounded-full">
              Segurança &amp; Privacidade
            </Badge>
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Central de Segurança e Privacidade
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Esta página é mantida por {nome} para responder dúvidas comuns sobre
            como protegemos os dados e a privacidade de quem utiliza a
            plataforma. Reflete os controles atualmente ativos no sistema.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {secoes.map((sec) => {
            const Icon = sec.icon;
            return (
              <Card key={sec.titulo} className="rounded-xl border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5 text-primary" />
                    {sec.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {sec.itens.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 rounded-xl border-border/60 bg-muted/30">
          <CardContent className="space-y-3 py-6 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Responsabilidade compartilhada.</strong>{" "}
              A plataforma fornece os recursos técnicos de segurança (acesso por
              perfil, criptografia em trânsito e regras de acesso no banco de
              dados). As práticas de tratamento, retenção e atendimento a
              solicitações de privacidade são definidas e conduzidas por {nome}.
            </p>
            <p>
              Esta página descreve controles e práticas vigentes e não constitui
              uma certificação independente. Em caso de dúvidas sobre segurança
              ou privacidade, entre em contato com a administração
              {inst?.email_institucional ? (
                <>
                  {" "}pelo e-mail{" "}
                  <a
                    href={`mailto:${inst.email_institucional}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {inst.email_institucional}
                  </a>
                  .
                </>
              ) : (
                " pelos canais oficiais da instituição."
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
