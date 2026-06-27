import { supabase } from "@/integrations/supabase/client";

/**
 * ETAPA 5 — Escopo Operacional (coordenação N:N).
 *
 * Fonte ÚNICA de leitura dos tratamentos sob coordenação de um usuário.
 * Lê pela relação N:N `coordenacao_tratamento` através da RPC centralizada
 * `fn_tratamentos_do_coordenador`, evitando que cada consumidor reimplemente
 * a regra de escopo.
 */
export async function getTratamentosCoordenados(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("fn_tratamentos_do_coordenador", {
    _user_id: userId,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}

export interface CoordenadorDesignado {
  coordenador_id: string;
  nome: string;
  tem_acesso: boolean;
}

export interface CoordenacaoTratamentoItem {
  tratamento_id: string;
  tratamento_nome: string;
  tratamento_tipo: string;
  coordenadores: CoordenadorDesignado[];
}

/** Leitura consolidada para a área de gestão de Escopo Operacional. */
export async function listarCoordenacaoTratamentos(): Promise<CoordenacaoTratamentoItem[]> {
  const { data, error } = await supabase.rpc("fn_listar_coordenacao_tratamentos");
  if (error) throw error;
  return (data ?? []) as unknown as CoordenacaoTratamentoItem[];
}

export async function designarCoordenador(tratamentoId: string, coordenadorId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_designar_coordenador", {
    p_tratamento_id: tratamentoId,
    p_coordenador_id: coordenadorId,
  });
  if (error) throw error;
}

export async function removerCoordenador(tratamentoId: string, coordenadorId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_remover_coordenador", {
    p_tratamento_id: tratamentoId,
    p_coordenador_id: coordenadorId,
  });
  if (error) throw error;
}
