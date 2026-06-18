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
