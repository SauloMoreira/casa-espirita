import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS } from "@/constants/dashboard";
import type { PeriodKey } from "@/types/adminDashboard";

interface Props {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
}

export function AdminDashboardHeader({ period, onPeriodChange }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral operacional e gerencial</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={period === key ? "default" : "outline"}
            onClick={() => onPeriodChange(key)}
            className="text-xs h-8"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
