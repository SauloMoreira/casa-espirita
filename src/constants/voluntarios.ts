/** Centralized labels, colors and constants for the Voluntários module. */
import type { VoluntarioFormState } from "@/types/voluntarios";

export const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  afastado: "Afastado",
  desligado: "Desligado",
};

export const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-gray-100 text-gray-800",
  afastado: "bg-yellow-100 text-yellow-800",
  desligado: "bg-red-100 text-red-800",
};

export const TIPOS_VOLUNTARIO = ["Médium", "Tarefeiro"];

export const FILTER_TODOS = "todos";

export const VOLUNTARIO_MESSAGES = {
  required: "Obrigatório",
  invalidCpf: "CPF inválido",
  invalidEmail: "E-mail inválido",
  invalidPhone: "Celular inválido",
  cpfDuplicado: "CPF já cadastrado",
  selectTipo: "Selecione pelo menos um tipo",
  saveError: "Erro ao salvar",
  created: "Voluntário cadastrado",
  updated: "Voluntário atualizado",
  emptyList: "Nenhum voluntário encontrado",
} as const;

export const emptyVoluntarioForm: VoluntarioFormState = {
  nome_completo: "",
  celular: "",
  cpf: "",
  email: "",
  rg: "",
  data_nascimento: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  foto_url: null,
  data_ingresso_sistema: new Date().toISOString().split("T")[0],
  data_adesao_voluntariado: "",
  tipos_voluntario: [],
  funcoes_ids: [],
  atuacao_detalhada: "",
  status: "ativo",
  data_desligamento: "",
  observacoes: "",
};
