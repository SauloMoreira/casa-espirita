import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/constants/voluntarios";

interface Props {
  status: string;
}

export function VoluntarioStatusBadge({ status }: Props) {
  return <Badge className={STATUS_COLORS[status] || ""}>{STATUS_LABELS[status] || status}</Badge>;
}
