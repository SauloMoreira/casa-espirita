import { getDay, isValid, parseISO, startOfDay } from "date-fns";
import {
  STATUS_GERA_AGENDA,
  elegibilidadeAgenda,
  projetarAgendaRestante,
  quantidadeRestante,
  type ParametrosTipoAgenda,
} from "@/lib/agendaRules";
import type { SessaoGerada } from "@/types/fazerEntrevista";

/**
 * Lógica pura da migração de assistidos legados (já em tratamento antes do
 * sistema). Sem efeitos colaterais — apenas montagem de payloads e validações.
 *
 * IMPORTANTE: a migração NÃO tem regra própria de agenda. Tanto a elegibilidade
 * (gera agenda agora?) quanto o cálculo de datas vêm da fonte única em
 * `src/lib/agendaRules.ts` / `generateSessionDates`. Qualquer divergência entre
 * fluxo normal e legado deve ser tratada como bug.
 */

export { quantidadeRestante };


/** Status reais aceitos pelo sistema para assistido_tratamentos. */
export const STATUS_TRATAMENTO = [
  "aguardando_inicio",
  "aguardando_agendamento",
  "liberado",
  "em_andamento",
  "concluido",
  "suspenso",
  "cancelado",
] as const;

export type StatusTratamento = (typeof STATUS_TRATAMENTO)[number];

/**
 * Status que geram agenda — DERIVADO da fonte única (`STATUS_GERA_AGENDA`).
 * A migração não define elegibilidade própria.
 */
export const STATUS_COM_PROXIMA_SESSAO: readonly StatusTratamento[] = STATUS_GERA_AGENDA;

export const STATUS_TRATAMENTO_LABELS: Record<StatusTratamento, string> = {
  aguardando_inicio: "Aguardando início",
  aguardando_agendamento: "Aguardando agendamento",
  liberado: "Liberado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

export function isStatusValido(status: string): status is StatusTratamento {
  return (STATUS_TRATAMENTO as readonly string[]).includes(status);
}

/**
 * Mantido por compatibilidade: indica se o status, por si só, é gerador de
 * agenda. Usa a mesma fonte única do fluxo normal.
 */
export function statusPermiteProximaSessao(status: string): boolean {
  return (STATUS_GERA_AGENDA as readonly string[]).includes(status);
}


export interface TratamentoLegadoInput {
  tratamento_id: string;
  status: string;
  quantidade_total: number;
  quantidade_realizada: number;
  observacao?: string | null;
  proxima_sessao_data?: string | null;
  proxima_sessao_horario?: string | null;
}

export interface TratamentoValidacaoContexto {
  /** dia_semana (0-6) cadastrado no tipo de tratamento, ou null. */
  diaSemana?: number | null;
  /** Datas (yyyy-MM-dd) de sessões já futuras desse tratamento para o assistido. */
  sessoesFuturas?: string[];
  /** Já existe vínculo ativo do mesmo tratamento para o assistido. */
  vinculoAtivoExistente?: boolean;
  /** Confirmações administrativas explícitas vindas da UI. */
  confirmarStatusIncompativel?: boolean;
  confirmarColisaoSessaoFutura?: boolean;
  confirmarDuplicidade?: boolean;
}

const DIAS_SEMANA_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Valida um único tratamento legado. Retorna lista de mensagens de erro. */
export function validateTratamentoLegado(
  input: TratamentoLegadoInput,
  ctx: TratamentoValidacaoContexto = {},
): string[] {
  const errors: string[] = [];

  if (!input.tratamento_id) {
    errors.push("Selecione o tipo de tratamento.");
  }

  if (!isStatusValido(input.status)) {
    errors.push("Status de tratamento inválido.");
  }

  const total = Number(input.quantidade_total);
  const realizada = Number(input.quantidade_realizada);

  if (!Number.isInteger(total) || total < 1) {
    errors.push("Quantidade total deve ser um número inteiro maior que zero.");
  }
  if (!Number.isInteger(realizada) || realizada < 0) {
    errors.push("Quantidade realizada deve ser um número inteiro não negativo.");
  }
  if (Number.isInteger(total) && Number.isInteger(realizada) && realizada > total) {
    errors.push("Quantidade realizada não pode ser maior que a quantidade total.");
  }

  if (ctx.vinculoAtivoExistente && !ctx.confirmarDuplicidade) {
    errors.push(
      "Já existe um vínculo ativo deste tratamento para o assistido. Confirme explicitamente para prosseguir.",
    );
  }

  const data = input.proxima_sessao_data?.trim();
  if (data) {
    const parsed = parseISO(data);
    if (!isValid(parsed)) {
      errors.push("Data da próxima sessão inválida.");
    } else {
      if (startOfDay(parsed) < startOfDay(new Date())) {
        errors.push("A próxima sessão não pode estar no passado.");
      }
      if (
        ctx.diaSemana !== null &&
        ctx.diaSemana !== undefined &&
        getDay(parsed) !== ctx.diaSemana
      ) {
        errors.push(
          `A data da próxima sessão deve cair em ${DIAS_SEMANA_LABEL[ctx.diaSemana]}, conforme o tipo de tratamento.`,
        );
      }
      if (
        !statusPermiteProximaSessao(input.status) &&
        !ctx.confirmarStatusIncompativel
      ) {
        errors.push(
          "O status atual não permite agendar uma próxima sessão. Ajuste o status ou confirme a exceção.",
        );
      }
      if (
        ctx.sessoesFuturas?.includes(data) &&
        !ctx.confirmarColisaoSessaoFutura
      ) {
        errors.push(
          "Já existe uma sessão futura neste mesmo dia para este tratamento. Confirme para prosseguir.",
        );
      }
    }

    if (input.proxima_sessao_horario && !/^\d{2}:\d{2}(:\d{2})?$/.test(input.proxima_sessao_horario)) {
      errors.push("Horário da próxima sessão inválido.");
    }
  }

  return errors;
}

export interface AssistidoLegadoBase {
  nome: string;
  cpf?: string | null;
  celular?: string | null;
  email?: string | null;
  data_nascimento?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  foto_url?: string | null;
}

const limpar = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

const limparDigitos = (v?: string | null) => {
  const t = (v ?? "").replace(/\D/g, "");
  return t.length > 0 ? t : null;
};

/** Monta o payload de inserção de um novo assistido legado. */
export function buildAssistidoLegadoInsert(
  base: AssistidoLegadoBase,
  opts: { userId: string; dataMigracao: string; observacaoMigracao?: string | null },
): Record<string, unknown> {
  return {
    nome: base.nome.trim(),
    cpf: limparDigitos(base.cpf),
    celular: limparDigitos(base.celular),
    email: limpar(base.email),
    data_nascimento: limpar(base.data_nascimento),
    cep: limparDigitos(base.cep),
    logradouro: limpar(base.logradouro),
    numero: limpar(base.numero),
    complemento: limpar(base.complemento),
    bairro: limpar(base.bairro),
    cidade: limpar(base.cidade),
    estado: base.estado ? base.estado.trim().toUpperCase() : null,
    foto_url: limpar(base.foto_url),
    status: "em_tratamento",
    origem_cadastro: "legado",
    migrado_legado: true,
    data_migracao: opts.dataMigracao,
    observacao_migracao: limpar(opts.observacaoMigracao),
    created_by: opts.userId,
  };
}

/**
 * Campos cadastrais considerados sensíveis: não devem ser sobrescritos em um
 * assistido existente sem confirmação explícita do administrador.
 */
export const CAMPOS_SENSIVEIS: (keyof AssistidoLegadoBase)[] = [
  "nome",
  "cpf",
  "data_nascimento",
  "email",
];

/** Monta o vínculo de tratamento legado para inserção. */
export function buildVinculoLegadoInsert(
  assistidoId: string,
  input: TratamentoLegadoInput,
  userId: string,
): Record<string, unknown> {
  return {
    assistido_id: assistidoId,
    tratamento_id: input.tratamento_id,
    quantidade_total: Number(input.quantidade_total),
    quantidade_realizada: Number(input.quantidade_realizada),
    status: input.status,
    entrevista_id: null,
    origem: "legado",
    observacoes: limpar(input.observacao),
    observacao_migracao: limpar(input.observacao),
    created_by: userId,
  };
}

/** Monta a linha de próxima sessão na agenda, ou null se não houver data. */
export function buildProximaSessaoInsert(
  assistidoId: string,
  vinculoId: string,
  input: TratamentoLegadoInput,
  userId: string,
): Record<string, unknown> | null {
  const data = input.proxima_sessao_data?.trim();
  if (!data) return null;
  return {
    assistido_id: assistidoId,
    assistido_tratamento_id: vinculoId,
    tratamento_id: input.tratamento_id,
    data_sessao: data,
    horario: input.proxima_sessao_horario?.trim() || null,
    status: "agendado",
    registrado_por: userId,
  };
}
