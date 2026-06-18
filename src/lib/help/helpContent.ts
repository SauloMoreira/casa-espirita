import { ROUTES } from "@/constants/routes";
import type { HelpArticle, OnboardingFlow } from "./types";

/**
 * Central knowledge base for in-app help. Content is intentionally short,
 * operational and role-aware. Editing happens here (versioned in code) so the
 * material can be maintained over time without touching UI logic.
 *
 * NOTE: This phase adds help/adoption content only — no business rules change.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  // ───────────────────────── Manuais por papel ─────────────────────────
  {
    id: "manual-admin",
    kind: "manual",
    title: "Manual do Administrador",
    module: "geral",
    roles: ["admin"],
    active: true,
    summary: "Visão geral, principais ações e boas práticas do Administrador.",
    tags: ["administrador", "manual", "gestão"],
    body: [
      {
        heading: "Visão geral",
        text: "O Administrador tem acesso amplo ao sistema: pessoas, tratamentos, agenda, relatórios, configurações e inteligência.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Gerir usuários, voluntários e solicitações de cadastro",
          "Configurar tratamentos, regras operacionais e a instituição",
          "Acompanhar dashboards, relatórios e auditoria",
          "Supervisionar a Central de IA e as conversas de WhatsApp",
        ],
      },
      {
        heading: "Passos principais",
        steps: [
          "Confira o Dashboard para ver pendências do dia",
          "Aprove solicitações de cadastro e ajuste papéis quando necessário",
          "Acompanhe exceções e a agenda para evitar gargalos",
          "Revise relatórios semanalmente para apoiar decisões",
        ],
      },
      {
        heading: "Erros comuns",
        bullets: [
          "Conceder papéis administrativos fora do fluxo de aprovação",
          "Editar tratamentos com sessões já agendadas sem checar impacto",
        ],
      },
      {
        heading: "Boas práticas",
        bullets: [
          "Ative MFA na sua conta (Segurança da Conta)",
          "Use a auditoria para rastrear mudanças sensíveis",
        ],
      },
      {
        note: "Quando precisar de algo que envolva acesso total/governança, acione um Administrador Master.",
      },
    ],
  },
  {
    id: "manual-master",
    kind: "manual",
    title: "Manual do Administrador Master",
    module: "governanca",
    roles: ["administrador_master"],
    masterOnly: true,
    active: true,
    summary: "Governança de acessos, aprovações e segurança reforçada.",
    tags: ["master", "governança", "segurança", "mfa"],
    body: [
      {
        heading: "Visão geral",
        text: "O Administrador Master concentra a governança: aprova acessos administrativos e zela pela segurança da plataforma.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Aprovar promoções para Administrador (dupla aprovação quando houver 2+ aptos)",
          "Resetar/desativar MFA de outros administradores em caso de necessidade",
          "Acompanhar a auditoria de ações críticas",
        ],
      },
      {
        heading: "Regras importantes",
        bullets: [
          "Não há autoaprovação: ninguém promove a si mesmo",
          "Com 2+ administradores aptos, a promoção exige dupla aprovação",
          "A exceção de aprovação única só vale quando há um único Master",
        ],
      },
      {
        heading: "Boas práticas",
        bullets: [
          "Mantenha MFA sempre ativo",
          "Revise periodicamente quem possui acesso administrativo",
        ],
      },
      { note: "Toda promoção e reset de MFA fica auditado. Em dúvida, registre o contexto na auditoria." },
    ],
  },
  {
    id: "manual-entrevistador",
    kind: "manual",
    title: "Manual do Entrevistador",
    module: "entrevista",
    roles: ["entrevistador"],
    active: true,
    summary: "Como conduzir entrevistas e encaminhar tratamentos.",
    tags: ["entrevistador", "entrevista", "tratamento"],
    body: [
      {
        heading: "Visão geral",
        text: "O Entrevistador realiza entrevistas fraternas, registra queixas e encaminha tratamentos com agenda real.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Buscar/cadastrar assistidos e iniciar entrevistas",
          "Registrar a entrevista e indicar tratamentos",
          "Consultar a agenda e a Central de IA como apoio",
        ],
      },
      {
        heading: "Passos principais",
        steps: [
          "Abra Realizar Entrevista e localize o assistido",
          "Preencha os dados e selecione os tratamentos indicados",
          "Defina quantidades/datas conforme a modalidade",
          "Salve para gerar agenda e o comprovante",
        ],
      },
      {
        heading: "Erros comuns",
        bullets: [
          "Esquecer de definir a data inicial em tratamentos por data",
          "Indicar tratamento sem validar a sugestão da IA",
        ],
      },
      { heading: "Boas práticas", bullets: ["Sempre valide as sugestões da IA antes de aplicar", "Use a transcrição por voz para agilizar"] },
      { note: "Casos clínicos ou sensíveis fora do seu alcance: encaminhe ao coordenador/administração." },
    ],
  },
  {
    id: "manual-coordenador",
    kind: "manual",
    title: "Manual do Coordenador de Tratamento",
    module: "programacao",
    roles: ["coordenador_de_tratamento"],
    active: true,
    summary: "Lista de espera, agenda do tratamento e exceções.",
    tags: ["coordenador", "tratamento", "fila", "lista de espera"],
    body: [
      {
        heading: "Visão geral",
        text: "O Coordenador organiza a fila do tratamento, gerencia a agenda e cuida de exceções operacionais do seu escopo.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Gerir a lista de espera por prioridade (Normal, Alta, Urgente)",
          "Acompanhar seus tratamentos e a agenda correspondente",
          "Registrar exceções operacionais e a programação padrão",
        ],
      },
      {
        heading: "Passos principais",
        steps: [
          "Priorize a lista de espera do dia",
          "Confirme a agenda do tratamento",
          "Registre exceções quando o dia fugir do padrão",
        ],
      },
      { heading: "Erros comuns", bullets: ["Esquecer de registrar uma exceção que afeta a IA e a agenda"] },
      { heading: "Boas práticas", bullets: ["Mantenha a fila atualizada para refletir a realidade"] },
      { note: "Você vê apenas o escopo da sua coordenação. Para visão global, acione a administração." },
    ],
  },
  {
    id: "manual-tarefeiro",
    kind: "manual",
    title: "Manual do Tarefeiro",
    module: "presenca",
    roles: ["tarefeiro"],
    active: true,
    summary: "Presença, sessões públicas e agendamento de entrevistas.",
    tags: ["tarefeiro", "presença", "plantão", "entrevista", "agenda"],
    body: [
      {
        heading: "Visão geral",
        text: "O Tarefeiro registra presenças do plantão, apoia as sessões públicas e pode marcar (agendar) entrevistas fraternas para os assistidos.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Lançar presença dos assistidos no plantão",
          "Apoiar o check-in das sessões públicas",
          "Agendar entrevistas e consultar a Agenda para ver a disponibilidade de horários",
        ],
      },
      {
        heading: "Passos principais",
        steps: [
          "Abra Presença e selecione o plantão do dia",
          "Marque os presentes e salve",
          "Para sessões públicas, use o QR do dia ou o registro manual",
          "Para marcar entrevista: abra Agendar Entrevista, escolha o tipo, selecione o assistido, defina data e hora e salve",
        ],
      },
      {
        heading: "Agendar entrevista — quando e o que conferir",
        bullets: [
          "Marque a entrevista quando o assistido estiver apto (entrevista regular exige o mínimo de palestras; a tela só lista quem está apto)",
          "Antes de salvar confira: assistido correto, tipo (Regular ou Livre) e data/hora sem conflito na Agenda",
          "Use a Agenda para checar a disponibilidade de horários antes de confirmar",
          "Você marca a entrevista, mas não a realiza: registrar a entrevista e designar tratamentos é da entrevista/coordenação",
        ],
      },
      { heading: "Erros comuns", bullets: ["Marcar presença em dia/sessão errados", "Duplicar check-in público", "Agendar entrevista em horário já ocupado"] },
      { heading: "Boas práticas", bullets: ["Confira o nome/foto do assistido antes de confirmar", "Na dúvida sobre aptidão ou horário, peça apoio à coordenação"] },
      { note: "Relatórios de produtividade não são acessíveis ao tarefeiro. Parametrizações e regras estruturais da agenda continuam com coordenação/admin. Dúvidas, fale com a coordenação." },
    ],
  },
  {
    id: "manual-assistido",
    kind: "manual",
    title: "Manual do Assistido",
    module: "assistido",
    roles: ["assistido"],
    active: true,
    summary: "Sua agenda, tratamentos, perfil e documentos.",
    tags: ["assistido", "agenda", "perfil"],
    body: [
      {
        heading: "Visão geral",
        text: "Na sua área você acompanha seus tratamentos, sua agenda, seu perfil e seus documentos.",
      },
      {
        heading: "O que você consegue fazer",
        bullets: [
          "Ver Meus Tratamentos e Minha Agenda",
          "Atualizar dados no Meu Perfil (opcional)",
          "Reimprimir documentos e comprovantes",
          "Receber avisos da casa",
        ],
      },
      { heading: "Passos principais", steps: ["Confira Minha Agenda antes de comparecer", "Mantenha seu perfil atualizado"] },
      { heading: "Boas práticas", bullets: ["Siga as orientações alimentares do comprovante quando houver"] },
      { note: "Dúvidas sobre seu tratamento: fale com a recepção/coordenação da casa." },
    ],
  },

  // ───────────────────────── FAQ contextual por tela ─────────────────────────
  {
    id: "faq-fazer-entrevista",
    kind: "faq",
    title: "Ajuda — Realizar Entrevista",
    module: "entrevista",
    roles: ["admin", "entrevistador"],
    route: ROUTES.fazerEntrevista,
    active: true,
    summary: "Pergunta pública vs pessoal, sequência e agendamento.",
    tags: ["entrevista", "tratamento", "fila", "agenda"],
    body: [
      { heading: "O que esta tela faz", text: "Registra a entrevista do assistido e encaminha tratamentos, gerando agenda real e comprovante." },
      {
        heading: "Como usar",
        steps: [
          "Busque ou cadastre o assistido",
          "Preencha os dados e selecione os tratamentos",
          "Defina quantidade/data conforme a modalidade (Livre, Sequencial ou por Data)",
          "Salve para gerar a agenda",
        ],
      },
      {
        heading: "Regras importantes",
        bullets: [
          "Pergunta pública é doutrinária e geral; pergunta pessoal é específica do assistido",
          "Tratamento sequencial libera o próximo item automaticamente ao concluir",
          "Casos sem vaga imediata entram na fila do coordenador",
        ],
      },
      { heading: "Erros comuns", bullets: ["Data inicial em dia da semana diferente do cadastro do tratamento", "Aplicar sugestão da IA sem validar"] },
      { heading: "O que acontece depois", text: "A agenda é gerada de forma antecipada e integral, e o comprovante fica disponível para impressão." },
      { note: "A IA apenas sugere — a indicação final é sempre humana." },
    ],
  },
  {
    id: "faq-agendar-entrevista",
    kind: "faq",
    title: "Ajuda — Agendar Entrevista",
    module: "entrevista",
    roles: ["admin", "entrevistador", "tarefeiro"],
    route: ROUTES.entrevistas,
    active: true,
    summary: "Como marcar uma entrevista para o assistido.",
    tags: ["entrevista", "agendar", "tarefeiro", "agenda"],
    body: [
      { heading: "O que esta tela faz", text: "Permite marcar (agendar) entrevistas fraternas, além de remarcar ou cancelar." },
      {
        heading: "Como agendar",
        steps: [
          "Clique em Agendar Entrevista",
          "Escolha o tipo: Regular (exige o mínimo de palestras) ou Livre",
          "Selecione o assistido (a lista mostra apenas quem está apto)",
          "Defina data e hora e confira a Agenda para evitar conflito de horário",
          "Salve para registrar o agendamento",
        ],
      },
      {
        heading: "O que conferir antes de salvar",
        bullets: [
          "Assistido correto e tipo de entrevista adequado",
          "Data/hora disponível, sem sobreposição na Agenda",
          "Aptidão do assistido em caso de entrevista regular",
        ],
      },
      {
        heading: "Quando pedir apoio",
        bullets: [
          "Dúvida sobre aptidão, exceções ou disponibilidade",
          "Necessidade de realizar a entrevista ou designar tratamentos (cabe à entrevista/coordenação)",
        ],
      },
      { note: "O Tarefeiro marca a entrevista, mas não a realiza nem altera regras estruturais da agenda — isso permanece com coordenação/admin." },
    ],
  },
  {
    id: "faq-agenda",
    kind: "faq",
    title: "Ajuda — Agenda",
    module: "agenda",
    roles: ["admin", "entrevistador", "tarefeiro"],
    route: ROUTES.agenda,
    active: true,
    summary: "Como ler e navegar a agenda de atendimentos.",
    tags: ["agenda", "calendário"],
    body: [
      { heading: "O que esta tela faz", text: "Mostra a agenda real de entrevistas e tratamentos por dia, semana e mês." },
      { heading: "Como usar", steps: ["Escolha a visão (dia/semana/mês)", "Use os filtros para focar no que importa", "Clique em um evento para ver detalhes"] },
      { heading: "Regras importantes", bullets: ["A agenda é a fonte única de programação", "Sessões passadas não são alteradas em reconciliações", "O Tarefeiro consulta a agenda para conferir disponibilidade ao marcar entrevistas"] },
      { note: "Discrepâncias na agenda geram alertas operacionais automáticos." },
    ],
  },
  {
    id: "faq-presenca",
    kind: "faq",
    title: "Ajuda — Controle de Presença",
    module: "presenca",
    roles: ["admin", "tarefeiro"],
    route: ROUTES.presenca,
    active: true,
    summary: "Como lançar presença sem duplicar.",
    tags: ["presença", "plantão", "falta"],
    body: [
      { heading: "O que esta tela faz", text: "Permite registrar a presença dos assistidos no plantão do dia." },
      { heading: "Como usar", steps: ["Selecione o plantão/dia", "Marque os presentes", "Salve o registro"] },
      { heading: "Regras importantes", bullets: ["Não é possível duplicar a mesma sessão", "Faltas recorrentes (3+) são sinalizadas proativamente"] },
      { heading: "Erros comuns", bullets: ["Marcar presença no dia errado"] },
      { note: "Em caso de divergência de agenda, confira com a coordenação antes de salvar." },
    ],
  },
  {
    id: "faq-sessoes-publicas",
    kind: "faq",
    title: "Ajuda — Sessões Públicas",
    module: "sessoes_publicas",
    roles: ["admin", "tarefeiro"],
    route: ROUTES.sessoesPublicas,
    active: true,
    summary: "QR do dia, registro manual e deduplicação.",
    tags: ["sessões públicas", "qr", "check-in"],
    body: [
      { heading: "O que esta tela faz", text: "Gerencia as sessões públicas e o check-in rápido dos participantes." },
      {
        heading: "Como usar",
        steps: [
          "Abra a sessão do dia para gerar o QR",
          "Participantes fazem check-in pelo QR",
          "Use o registro manual quando alguém não conseguir pelo QR",
        ],
      },
      { heading: "Regras importantes", bullets: ["O QR é válido para a sessão do dia", "A deduplicação evita check-ins repetidos do mesmo participante"] },
      { heading: "O que acontece depois", text: "Os dados alimentam a analítica de trabalhos públicos (novos vs recorrentes, demografia, reincidência)." },
      { note: "No registro manual capture apenas os dados essenciais para não criar fila." },
    ],
  },
  {
    id: "faq-whatsapp",
    kind: "faq",
    title: "Ajuda — Conversas WhatsApp / Atendimentos",
    module: "whatsapp",
    roles: ["admin", "coordenador_de_tratamento"],
    route: ROUTES.centralNotificacoes,
    active: true,
    summary: "Quando a IA responde, handoff e atendimento manual.",
    tags: ["whatsapp", "ia", "handoff", "atendimento"],
    body: [
      { heading: "O que esta tela faz", text: "Centraliza as conversas de WhatsApp, com respostas automáticas da IA e atendimento humano." },
      {
        heading: "Como funciona a IA",
        bullets: [
          "A IA responde dúvidas comuns automaticamente",
          "Ordem de consulta: exceção → agenda/sessão real → programação padrão → fallback",
        ],
      },
      {
        heading: "Quando vira handoff",
        text: "Quando a IA não resolve ou o assunto exige decisão humana, a conversa entra em handoff para atendimento.",
      },
      {
        heading: "Como atender",
        steps: ["Assuma a conversa em handoff", "Responda manualmente pelo painel", "Encerre quando concluir o atendimento"],
      },
      { note: "Exceções sempre têm prioridade sobre a programação padrão nas respostas da IA." },
    ],
  },
  {
    id: "faq-excecoes-operacionais",
    kind: "faq",
    title: "Ajuda — Exceções Operacionais",
    module: "excecoes",
    roles: ["admin", "coordenador_de_tratamento"],
    route: ROUTES.excecoesOperacionais,
    active: true,
    summary: "Prioridade sobre sessão real e impacto na IA.",
    tags: ["exceção", "programação", "ia"],
    body: [
      { heading: "O que esta tela faz", text: "Registra exceções (feriados, mudanças pontuais) que alteram o funcionamento normal da casa." },
      { heading: "Como usar", steps: ["Cadastre a exceção com data e descrição", "Confirme o impacto no dia indicado"] },
      {
        heading: "Regras importantes",
        bullets: [
          "A exceção tem prioridade sobre a sessão real e a programação padrão",
          "A IA consulta primeiro as exceções ao responder sobre funcionamento",
        ],
      },
      { note: "Cadastre exceções com antecedência para que a IA responda corretamente." },
    ],
  },
  {
    id: "faq-programacao-padrao",
    kind: "faq",
    title: "Ajuda — Programação Padrão",
    module: "programacao",
    roles: ["admin", "coordenador_de_tratamento"],
    route: ROUTES.programacaoPadrao,
    active: true,
    summary: "A rotina semanal usada como base da casa.",
    tags: ["programação", "rotina", "ia"],
    body: [
      { heading: "O que esta tela faz", text: "Define a programação semanal padrão da casa (atividades por dia)." },
      { heading: "Regras importantes", bullets: ["É a base usada quando não há exceção nem sessão real específica", "A IA usa a programação padrão como fallback"] },
      { note: "Para mudanças pontuais, use Exceções Operacionais — elas têm prioridade." },
    ],
  },
  {
    id: "faq-central-ia",
    kind: "faq",
    title: "Ajuda — Central de IA",
    module: "central_ia",
    roles: ["admin", "entrevistador"],
    route: ROUTES.centralIa,
    active: true,
    summary: "Calibração da base e supervisão das sugestões.",
    tags: ["ia", "calibração", "doutrina"],
    body: [
      { heading: "O que esta tela faz", text: "Mantém a base estruturada da IA (queixas, tratamentos, biblioteca doutrinária) e acompanha a assertividade." },
      { heading: "Como usar", steps: ["Mantenha a base de queixas e tratamentos atualizada", "Acompanhe os indicadores de assertividade", "Registre feedback para o aprendizado supervisionado"] },
      { heading: "Regras importantes", bullets: ["As sugestões da IA exigem validação humana", "Feedbacks registram histórico de aprendizado"] },
      { note: "Quanto melhor a base, melhores as sugestões — revise periodicamente." },
    ],
  },
  {
    id: "faq-painel-assistido",
    kind: "faq",
    title: "Ajuda — Seu Painel",
    module: "assistido",
    roles: ["assistido"],
    route: ROUTES.dashboard,
    active: true,
    summary: "Como acompanhar sua agenda e tratamentos.",
    tags: ["assistido", "painel", "agenda"],
    body: [
      { heading: "O que esta tela faz", text: "Reúne seus próximos compromissos, tratamentos e avisos." },
      { heading: "Como usar", bullets: ["Confira Minha Agenda antes de comparecer", "Veja Meus Tratamentos para acompanhar o andamento", "Acesse seus documentos quando precisar"] },
      { note: "Dúvidas sobre o atendimento: fale com a recepção da casa." },
    ],
  },
  {
    id: "faq-voluntarios",
    kind: "faq",
    title: "Ajuda — Voluntários",
    module: "voluntarios",
    roles: ["admin"],
    route: ROUTES.voluntarios,
    active: true,
    summary: "Cadastro, funções e termo de adesão.",
    tags: ["voluntários", "termo", "funções"],
    body: [
      { heading: "O que esta tela faz", text: "Gerencia voluntários, suas funções e o termo de adesão." },
      { heading: "Como usar", steps: ["Cadastre o voluntário e selecione as funções", "Gere o termo de adesão", "Inative em vez de excluir quando o vínculo encerrar"] },
      { heading: "Regras importantes", bullets: ["Funções de voluntariado são parametrizáveis", "Prefira inativar para preservar histórico"] },
    ],
  },
  {
    id: "faq-usuarios",
    kind: "faq",
    title: "Ajuda — Gestão de Usuários",
    module: "usuarios",
    roles: ["admin"],
    route: ROUTES.usuarios,
    active: true,
    summary: "Criar usuários, papéis e acessos com segurança.",
    tags: ["usuários", "papéis", "acesso"],
    body: [
      { heading: "O que esta tela faz", text: "Cria e gerencia usuários e seus papéis de acesso." },
      {
        heading: "Regras importantes",
        bullets: [
          "Papéis administrativos só são concedidos via fluxo de aprovação (Governança)",
          "O papel padrão de um cadastro aprovado é Assistido",
          "Prefira inativar usuários a excluí-los",
        ],
      },
      { heading: "Erros comuns", bullets: ["Tentar promover a Administrador direto pelo formulário (use Governança de Acessos)"] },
      { note: "Resets de senha são manuais e auditados pela administração." },
    ],
  },
  {
    id: "faq-relatorios",
    kind: "faq",
    title: "Ajuda — Relatórios",
    module: "relatorios",
    roles: ["admin", "entrevistador", "coordenador_de_tratamento", "tarefeiro"],
    route: ROUTES.relatorios,
    active: true,
    summary: "Como ler, filtrar e exportar relatórios.",
    tags: ["relatórios", "csv", "exportação"],
    body: [
      { heading: "O que esta tela faz", text: "Apresenta relatórios operacionais e gerenciais com filtros e exportação CSV." },
      { heading: "Como usar", steps: ["Selecione o período e os filtros", "Analise os indicadores", "Exporte em CSV quando precisar"] },
      { heading: "Regras importantes", bullets: ["Coordenadores veem apenas o seu escopo", "Relatórios de produtividade não ficam disponíveis ao tarefeiro"] },
    ],
  },
  {
    id: "faq-governanca",
    kind: "faq",
    title: "Ajuda — Governança de Acessos",
    module: "governanca",
    roles: ["admin"],
    route: ROUTES.governancaAcessos,
    active: true,
    summary: "Aprovação de acesso administrativo e dupla aprovação.",
    tags: ["governança", "aprovação", "administrador"],
    body: [
      { heading: "O que esta tela faz", text: "Controla a concessão de acesso administrativo com aprovação obrigatória." },
      {
        heading: "Regras importantes",
        bullets: [
          "Promoção a Administrador nunca é automática",
          "Com 2+ administradores aptos, exige dupla aprovação",
          "Aprovação única do Master só vale quando há um único Master",
          "Não há autoaprovação",
        ],
      },
      { note: "Todas as ações ficam auditadas." },
    ],
  },
];

/** Short onboarding flows shown on first access, by role. */
export const ONBOARDING_FLOWS: OnboardingFlow[] = [
  {
    role: "admin",
    steps: [
      { title: "Bem-vindo(a)", description: "Este é o painel administrativo. O menu lateral agrupa todas as áreas por tema." },
      { title: "Pendências do dia", description: "O Dashboard reúne aprovações, exceções e gargalos que precisam de atenção." },
      { title: "Segurança", description: "Ative o MFA em Segurança da Conta para proteger seu acesso." },
      { title: "Ajuda sempre à mão", description: "Use o botão Ajuda nas telas e a Central de Ajuda para manuais e FAQ." },
    ],
  },
  {
    role: "entrevistador",
    steps: [
      { title: "Bem-vindo(a)", description: "Aqui você realiza entrevistas e encaminha tratamentos." },
      { title: "Realizar Entrevista", description: "Busque o assistido, registre a entrevista e indique tratamentos." },
      { title: "Apoio da IA", description: "A IA sugere tratamentos, mas a indicação final é sempre sua." },
      { title: "Ajuda em tela", description: "Clique em Ajuda em qualquer tela para ver o passo a passo." },
    ],
  },
  {
    role: "coordenador_de_tratamento",
    steps: [
      { title: "Bem-vindo(a)", description: "Você coordena a fila, a agenda e as exceções do tratamento." },
      { title: "Lista de Espera", description: "Priorize a fila por Normal, Alta e Urgente." },
      { title: "Exceções", description: "Registre exceções: elas têm prioridade sobre a programação padrão." },
      { title: "Ajuda em tela", description: "Use o botão Ajuda para orientações específicas de cada tela." },
    ],
  },
  {
    role: "tarefeiro",
    steps: [
      { title: "Bem-vindo(a)", description: "Você registra presenças e apoia as sessões públicas." },
      { title: "Presença", description: "Selecione o plantão, marque os presentes e salve." },
      { title: "Sessões Públicas", description: "Use o QR do dia ou o registro manual quando necessário." },
      { title: "Ajuda em tela", description: "O botão Ajuda explica cada passo sem complicação." },
    ],
  },
  {
    role: "assistido",
    steps: [
      { title: "Bem-vindo(a)", description: "Aqui você acompanha seus tratamentos e sua agenda." },
      { title: "Minha Agenda", description: "Confira seus próximos atendimentos antes de comparecer." },
      { title: "Meus Documentos", description: "Reimprima comprovantes e documentos quando precisar." },
      { title: "Ajuda", description: "Use a Central de Ajuda para tirar dúvidas da sua área." },
    ],
  },
];
