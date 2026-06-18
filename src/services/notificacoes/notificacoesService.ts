import { supabase } from "@/integrations/supabase/client";

export interface PreferenciaNotificacao {
  id: string;
  assistido_id: string;
  whatsapp_ativo: boolean;
  opt_out_at: string | null;
  opt_out_motivo: string | null;
  horario_inicio_envio: string;
  horario_fim_envio: string;
}

export interface FilaItem {
  id: string;
  evento_origem: string;
  assistido_id: string | null;
  telefone_normalizado: string | null;
  canal: string;
  template_codigo: string | null;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  retry_count: number;
  external_message_id: string | null;
  erro: string | null;
  created_at: string;
}

export interface Conversa {
  id: string;
  assistido_id: string | null;
  telefone: string;
  status_conversa: string;
  ultimo_contato_em: string;
  em_handoff: boolean;
  atendente_responsavel: string | null;
}

export interface Handoff {
  id: string;
  conversa_id: string;
  motivo: string | null;
  classificado_por_ia: boolean;
  status: string;
  atendente_id: string | null;
  opened_at: string;
  closed_at: string | null;
}

/** Preferência do assistido logado (cria default se não existir). */
export async function getMinhaPreferencia(assistidoId: string): Promise<PreferenciaNotificacao | null> {
  const { data } = await supabase
    .from("notificacoes_preferencias")
    .select("*")
    .eq("assistido_id", assistidoId)
    .maybeSingle();
  return (data as PreferenciaNotificacao) ?? null;
}

export async function setWhatsappAtivo(
  assistidoId: string,
  ativo: boolean,
  motivo?: string,
): Promise<void> {
  const payload = {
    assistido_id: assistidoId,
    whatsapp_ativo: ativo,
    opt_out_at: ativo ? null : new Date().toISOString(),
    opt_out_motivo: ativo ? null : (motivo || "solicitado_no_app"),
  };
  const { error } = await supabase
    .from("notificacoes_preferencias")
    .upsert(payload, { onConflict: "assistido_id" });
  if (error) throw error;
}

export async function listFila(limit = 100): Promise<FilaItem[]> {
  const { data, error } = await supabase
    .from("notificacoes_fila")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as FilaItem[]) ?? [];
}

export async function listConversas(limit = 100): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from("whatsapp_conversas")
    .select("*")
    .order("ultimo_contato_em", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Conversa[]) ?? [];
}

export async function listHandoffs(limit = 100): Promise<Handoff[]> {
  const { data, error } = await supabase
    .from("whatsapp_handoffs")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Handoff[]) ?? [];
}

export async function assumirHandoff(id: string, atendenteId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_handoffs")
    .update({ status: "em_atendimento", atendente_id: atendenteId })
    .eq("id", id);
  if (error) throw error;
}

export async function fecharHandoff(id: string, conversaId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_handoffs")
    .update({ status: "fechado", closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await supabase.from("whatsapp_conversas").update({ em_handoff: false }).eq("id", conversaId);
}

/** Dispara manualmente o processamento da fila. */
export async function processarFila(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("notificacoes-dispatch");
  if (error) throw error;
  return data;
}

// ===== Painel operacional do canal WhatsApp =====

export interface PainelPorTipo {
  tipo: string;
  geradas: number;
  enviadas: number;
  falhas: number;
  taxa_entrega: number;
}

export interface PainelIntent {
  intent: string;
  total: number;
}

export interface PainelFalha {
  tipo: string;
  telefone: string | null;
  erro: string | null;
  quando: string | null;
}

export interface PainelWhatsapp {
  autorizado: boolean;
  periodo?: { inicio: string; fim: string };
  operacional?: {
    geradas: number;
    enviadas: number;
    falhas: number;
    pendentes: number;
    agendados: number;
    canceladas: number;
    inbound: number;
    optout: number;
    handoffs_abertos: number;
    handoffs_resolvidos: number;
    intents_ia: number;
  };
  por_tipo?: PainelPorTipo[];
  intents?: PainelIntent[];
  falhas_recentes?: PainelFalha[];
  impacto?: {
    presenca_atual_pct: number;
    presenca_anterior_pct: number;
    faltas_atual: number;
    faltas_anterior: number;
    presentes_atual: number;
    ausentes_atual: number;
    periodo_anterior: { inicio: string; fim: string };
  };
}

/** Indicadores operacionais e de impacto do canal WhatsApp por período. */
export async function getPainelWhatsapp(inicio: string, fim: string): Promise<PainelWhatsapp> {
  const { data, error } = await supabase.rpc("painel_whatsapp", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw error;
  return (data as unknown as PainelWhatsapp) ?? { autorizado: false };
}

// ===== Painel de métricas v2 (5 blocos + filtros) =====

export interface PainelV2Filtros {
  template?: string | null;
  status?: string | null;
  assistido?: string | null;
  resolucao?: "ia" | "handoff" | null;
  optout?: boolean | null;
}

export interface SeriePonto {
  dia: string;
  geradas: number;
  enviadas: number;
  falhas: number;
  inbound: number;
}

export interface PainelV2 {
  autorizado: boolean;
  periodo?: { inicio: string; fim: string; dias: number };
  periodo_anterior?: { inicio: string; fim: string };
  entrega?: {
    geradas: number; enviadas: number; falhas: number;
    pendentes: number; agendados: number; canceladas: number;
    retries: number; tempo_medio_envio_seg: number; sem_telefone: number; inbound: number;
    falhas_por_evento: { evento: string; falhas: number; total: number }[];
    falhas_recentes: { tipo: string; evento: string; telefone: string | null; erro: string | null; retries: number; quando: string | null }[];
  };
  engajamento?: {
    inbound: number; optout: number; reativacoes: number;
    assistidos_impactados: number; media_msgs_por_assistido: number;
    horarios: { hora: number; total: number }[];
    resposta_por_tipo: { tipo: string; enviadas: number }[];
  };
  efetividade?: {
    presenca_atual_pct: number; presenca_anterior_pct: number;
    faltas_atual: number; faltas_anterior: number;
    presentes_atual: number; ausentes_atual: number;
    comparecimento_apos_lembrete_pct: number; comparecimento_base: number;
  };
  ia_humano?: {
    inbound: number; resolvidas_ia: number; handoffs: number; handoffs_resolvidos: number;
    tempo_medio_resolucao_seg: number;
    motivos: { motivo: string; total: number }[];
    intents: { intent: string; total: number; resolvida: boolean }[];
  };
  qualidade?: {
    fora_janela: number; dedup_bloqueadas: number; limite_diario_barradas: number;
    canceladas: number; sem_telefone: number; retries: number;
    por_tipo: { tipo: string; geradas: number; enviadas: number; falhas: number; taxa_entrega: number }[];
    optout_por_tipo: { tipo: string; total: number }[];
  };
  serie?: SeriePonto[];
}

/** Painel completo de métricas do canal WhatsApp (5 blocos) com filtros. */
export async function getPainelWhatsappV2(
  inicio: string,
  fim: string,
  filtros: PainelV2Filtros = {},
): Promise<PainelV2> {
  const { data, error } = await supabase.rpc("painel_whatsapp_v2", {
    p_inicio: inicio,
    p_fim: fim,
    p_template: filtros.template ?? null,
    p_status: filtros.status ?? null,
    p_assistido: filtros.assistido ?? null,
    p_resolucao: filtros.resolucao ?? null,
    p_optout: filtros.optout ?? null,
  });
  if (error) throw error;
  return (data as unknown as PainelV2) ?? { autorizado: false };
}
