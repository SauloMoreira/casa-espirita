import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone, CalendarDays, Star, ImageOff, Pencil, Apple, ArrowRight,
  Sparkles, Upload, Link2, CheckCircle2, AlertTriangle, Circle, Layers,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { origemLabel } from "@/lib/conteudoImagem";
import {
  carregarPainelInstitucional, type PainelInstitucionalDados,
} from "@/services/painelInstitucional";
import {
  filtrarPublicacoes, resumoPublicacoes, periodoLabel, statusLabel,
  FILTRO_PADRAO, type PublicacaoFiltro, type PublicacaoItem, type PublicacaoStatus,
} from "@/lib/painelInstitucional";

const STATUS_STYLE: Record<PublicacaoStatus, { icon: typeof Circle; cls: string }> = {
  vigente: { icon: CheckCircle2, cls: "border-primary/30 bg-primary/[0.06] text-primary" },
  fora_periodo: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  inativo: { icon: Circle, cls: "border-border bg-muted text-muted-foreground" },
};

function OrigemBadge({ origem, otimizada }: { origem: string | null; otimizada: boolean }) {
  const Icon = origem === "ai" ? Sparkles : origem === "upload" ? Upload : Link2;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3" /> {origemLabel(origem)}
      {otimizada && <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[9px]">Otimizada IA</Badge>}
    </span>
  );
}

function ResumoCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Circle }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-display font-bold text-foreground leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicacaoRow({ item, onEdit }: { item: PublicacaoItem; onEdit: (i: PublicacaoItem) => void }) {
  const TipoIcon = item.tipo === "campanha" ? Megaphone : CalendarDays;
  const st = STATUS_STYLE[item.status];
  const StatusIcon = st.icon;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center">
      {/* Imagem */}
      <div className="h-16 w-full overflow-hidden rounded-lg bg-secondary/30 sm:h-14 sm:w-20 shrink-0">
        {item.imagem_url ? (
          <img src={item.imagem_url} alt={item.titulo} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TipoIcon className="h-3 w-3" /> {item.tipo === "campanha" ? "Campanha" : "Evento"}
          </span>
          {item.destaque && (
            <Badge variant="outline" className="gap-1 border-primary/30 px-1.5 py-0 text-[10px] text-primary">
              <Star className="h-3 w-3" /> Destaque
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{item.titulo}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] text-muted-foreground">{periodoLabel(item)}</span>
          <span className="text-[11px] text-muted-foreground/50">·</span>
          <OrigemBadge origem={item.imagem_origem} otimizada={item.imagem_otimizada} />
        </div>
      </div>

      {/* Status + ação */}
      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
        <Badge variant="outline" className={`gap-1 text-[10px] ${st.cls}`}>
          <StatusIcon className="h-3 w-3" /> {statusLabel(item.status)}
        </Badge>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => onEdit(item)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      </div>
    </div>
  );
}

const TIPO_OPCOES: { value: PublicacaoFiltro["tipo"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "campanha", label: "Campanhas" },
  { value: "evento", label: "Eventos" },
];
const STATUS_OPCOES: { value: PublicacaoFiltro["status"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "inativo", label: "Inativos" },
];

export default function PainelInstitucional() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [dados, setDados] = useState<PainelInstitucionalDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<PublicacaoFiltro>(FILTRO_PADRAO);

  useEffect(() => {
    carregarPainelInstitucional()
      .then(setDados)
      .catch((e: any) =>
        toast({ title: "Erro ao carregar painel", description: e.message, variant: "destructive" }),
      )
      .finally(() => setLoading(false));
  }, [toast]);

  const publicacoes = dados?.publicacoes ?? [];
  const resumo = useMemo(() => resumoPublicacoes(publicacoes), [publicacoes]);
  const filtradas = useMemo(() => filtrarPublicacoes(publicacoes, filtro), [publicacoes, filtro]);

  const onEdit = (i: PublicacaoItem) =>
    navigate(i.tipo === "campanha" ? ROUTES.campanhas : ROUTES.eventos);

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel Institucional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada do conteúdo publicado na vitrine do assistido.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumoCard label="Campanhas ativas" value={resumo.campanhasAtivas} icon={Megaphone} />
        <ResumoCard label="Eventos ativos" value={resumo.eventosAtivos} icon={CalendarDays} />
        <ResumoCard label="Destaques ativos" value={resumo.destaquesAtivos} icon={Star} />
        <ResumoCard label="Vigentes hoje" value={resumo.vigentesHoje} icon={Layers} />
      </div>

      {/* Ação Social — visão leve */}
      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Apple className="h-4 w-4 text-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Ação Social</p>
              <p className="text-xs text-muted-foreground">
                {dados?.alimentosAtivos ?? 0} item(ns) ativo(s) na lista de alimentos
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(ROUTES.acaoSocial)}>
            Abrir Ação Social <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TIPO_OPCOES.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={filtro.tipo === o.value ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFiltro((f) => ({ ...f, tipo: o.value }))}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPCOES.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={filtro.status === o.value ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFiltro((f) => ({ ...f, status: o.value }))}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <Button
          size="sm"
          variant={filtro.apenasDestaque ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => setFiltro((f) => ({ ...f, apenasDestaque: !f.apenasDestaque }))}
        >
          <Star className="h-3.5 w-3.5" /> Destaque
        </Button>
        <Button
          size="sm"
          variant={filtro.apenasVigentes ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => setFiltro((f) => ({ ...f, apenasVigentes: !f.apenasVigentes }))}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Vigentes agora
        </Button>
      </div>

      {/* Lista consolidada */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-muted-foreground gap-2">
              <Layers className="h-7 w-7 opacity-30" />
              <p className="text-sm">Nenhuma publicação encontrada com os filtros atuais</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((item) => (
            <PublicacaoRow key={`${item.tipo}-${item.id}`} item={item} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
