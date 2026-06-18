// Shared options for the operational governance modules (exceptions + default
// schedule) that act as official truth sources for the WhatsApp IA.

export const TIPO_PROGRAMACAO_OPTIONS = [
  { value: "publico", label: "Público" },
  { value: "tratamento", label: "Tratamento" },
  { value: "entrevista", label: "Entrevista" },
  { value: "outro", label: "Outro" },
] as const;

export const STATUS_EXCECAO_OPTIONS = [
  { value: "mantido", label: "Mantido" },
  { value: "cancelado", label: "Cancelado" },
  { value: "remarcado", label: "Remarcado" },
  { value: "excepcional", label: "Excepcional" },
] as const;

export const DIAS_SEMANA_OPTIONS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
] as const;

export function labelTipo(v: string): string {
  return TIPO_PROGRAMACAO_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelStatusExcecao(v: string): string {
  return STATUS_EXCECAO_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelDiaSemana(v: number): string {
  return DIAS_SEMANA_OPTIONS.find((o) => o.value === v)?.label ?? String(v);
}
