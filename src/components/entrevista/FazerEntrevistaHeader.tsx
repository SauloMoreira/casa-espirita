import { BookOpen } from "lucide-react";

export function FazerEntrevistaHeader() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        Fazer Entrevista
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Realize a entrevista fraterna e designe tratamentos
      </p>
    </div>
  );
}
