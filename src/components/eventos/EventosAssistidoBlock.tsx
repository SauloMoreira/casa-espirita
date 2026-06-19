import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Star, MapPin } from "lucide-react";
import { eventosVisiveis, type Evento } from "@/lib/eventos";
import { listEventosVigentes } from "@/services/eventos";

function formatEventoData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

/**
 * Bloco institucional de eventos da casa exibido ao assistido.
 * Mostra apenas eventos ativos e vigentes (destaques e próximos primeiro).
 * Não renderiza nada quando não há eventos. Área própria, separada
 * de campanhas e da ação social.
 */
export function EventosAssistidoBlock() {
  const [itens, setItens] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEventosVigentes()
      .then((d) => setItens(eventosVisiveis(d)))
      .catch(() => setItens([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || itens.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide uppercase text-primary">Eventos da Casa</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {itens.map((e) => (
          <Card key={e.id} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
            {e.imagem_url && (
              <div className="aspect-[16/9] w-full overflow-hidden bg-secondary/30">
                <img src={e.imagem_url} alt={e.titulo} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-display font-bold text-foreground">{e.titulo}</h3>
                {e.destaque && (
                  <Badge variant="outline" className="shrink-0 text-[10px] gap-1 border-primary/30 text-primary">
                    <Star className="h-3 w-3" /> Destaque
                  </Badge>
                )}
              </div>
              {e.subtitulo && <p className="text-xs font-medium text-muted-foreground">{e.subtitulo}</p>}
              {(e.data_evento || e.local) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {e.data_evento && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {formatEventoData(e.data_evento)}
                    </span>
                  )}
                  {e.local && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {e.local}
                    </span>
                  )}
                </div>
              )}
              {e.descricao_curta && <p className="text-xs text-muted-foreground leading-relaxed">{e.descricao_curta}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
