import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartHandshake } from "lucide-react";
import { alimentosVisiveis, formatFaltante, type AlimentoAcaoSocial } from "@/lib/acaoSocial";
import { listAlimentosAtivos } from "@/services/acaoSocial";

/**
 * Bloco acolhedor exibido ao assistido com os alimentos mais necessários
 * no momento. Mostra apenas itens ativos, respeitando a ordem definida pela
 * administração. Não renderiza nada quando não há itens.
 */
export function AlimentosAssistidoCard() {
  const [itens, setItens] = useState<AlimentoAcaoSocial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAlimentosAtivos()
      .then((d) => setItens(alimentosVisiveis(d)))
      .catch(() => setItens([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || itens.length === 0) return null;

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2 tracking-wide uppercase">
          <HeartHandshake className="h-4 w-4" /> Ação Social
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Se desejar contribuir com nossa ação social, veja abaixo os alimentos que mais precisamos no momento.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/50">
          {itens.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{it.nome}</p>
                {it.observacao && (
                  <p className="text-xs text-muted-foreground mt-0.5">{it.observacao}</p>
                )}
              </div>
              {it.quantidade_faltante != null && (
                <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {formatFaltante(it)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
