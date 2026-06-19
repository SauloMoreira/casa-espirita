import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { campanhasVisiveis, type Campanha } from "@/lib/campanhas";
import { listCampanhasVigentes } from "@/services/campanhas";
import { VitrineCard } from "@/components/conteudo/VitrineCard";

/**
 * Bloco institucional de campanhas da casa exibido ao assistido.
 * Mostra apenas campanhas ativas e vigentes (destaques primeiro), em vitrine.
 * Não renderiza nada quando não há campanhas. Área própria, separada
 * de eventos e da ação social.
 */
export function CampanhasAssistidoBlock() {
  const [itens, setItens] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCampanhasVigentes()
      .then((d) => setItens(campanhasVisiveis(d)))
      .catch(() => setItens([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || itens.length === 0) return null;

  const [primeiro, ...restantes] = itens;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide uppercase text-primary">Campanhas da Casa</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <VitrineCard
          featured={itens.length > 1}
          imagemUrl={primeiro.imagem_url}
          titulo={primeiro.titulo}
          subtitulo={primeiro.subtitulo}
          descricao={primeiro.descricao_curta}
          destaque={primeiro.destaque}
          formato={primeiro.imagem_formato}
        />
        {restantes.map((c) => (
          <VitrineCard
            key={c.id}
            imagemUrl={c.imagem_url}
            titulo={c.titulo}
            subtitulo={c.subtitulo}
            descricao={c.descricao_curta}
            destaque={c.destaque}
            formato={c.imagem_formato}
          />
        ))}
      </div>
    </section>
  );
}
