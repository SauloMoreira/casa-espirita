import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  /** Número de linhas do esqueleto. */
  rows?: number;
  /** Número de colunas por linha. */
  columns?: number;
  /** Classe extra opcional para o contêiner. */
  className?: string;
}

/**
 * Esqueleto de carregamento para tabelas/listas de maior volume.
 * Mantém o layout estável durante o fetch, evitando "saltos" de conteúdo.
 */
export function TableSkeleton({ rows = 6, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`} aria-busy="true" aria-live="polite">
      <div className="flex gap-3 pb-1">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={`h-${c}`} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-9 flex-1 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
