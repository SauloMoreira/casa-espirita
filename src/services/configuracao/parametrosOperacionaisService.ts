import { supabase } from "@/integrations/supabase/client";
import type { ParametroOperacional } from "@/lib/parametrosOperacionais";

/**
 * Serviço oficial de governança de parâmetros operacionais.
 * Toda leitura e escrita passa por RPCs SECURITY DEFINER no backend
 * (fonte de verdade: permissão, validação de tipo/faixa e auditoria).
 * Nunca fazer UPDATE direto na tabela a partir do frontend.
 */

export async function listarParametrosOperacionais(): Promise<ParametroOperacional[]> {
  const { data, error } = await supabase.rpc("fn_listar_parametros_operacionais");
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      chave: String(r.chave),
      nome_amigavel: (r.nome_amigavel as string) ?? null,
      descricao: (r.descricao as string) ?? null,
      impacto: (r.impacto as string) ?? null,
      tipo: (r.tipo as ParametroOperacional["tipo"]) ?? "texto",
      valor: String(r.valor ?? ""),
      valor_padrao: (r.valor_padrao as string) ?? null,
      valor_min: r.valor_min != null ? Number(r.valor_min) : null,
      valor_max: r.valor_max != null ? Number(r.valor_max) : null,
      opcoes: Array.isArray(r.opcoes) ? (r.opcoes as string[]) : null,
      sensivel: Boolean(r.sensivel),
      confirmacao_reforcada: Boolean(r.confirmacao_reforcada),
      ativo: Boolean(r.ativo),
      updated_at: (r.updated_at as string) ?? null,
      updated_by: (r.updated_by as string) ?? null,
      alterado_por_nome: (r.alterado_por_nome as string) ?? null,
    };
  });
}

export interface AtualizarParametroResultado {
  id: string;
  chave: string;
  valor: string;
  valor_anterior: string;
  updated_at: string;
  updated_by: string;
}

export async function atualizarParametroOperacional(args: {
  chave: string;
  valor: string;
  observacao?: string;
}): Promise<AtualizarParametroResultado> {
  const { data, error } = await supabase.rpc("fn_atualizar_parametro_operacional", {
    p_chave: args.chave,
    p_valor: args.valor,
    p_observacao: args.observacao?.trim() || null,
  });
  if (error) throw error;
  return data as unknown as AtualizarParametroResultado;
}
