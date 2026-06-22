# Reorganização do menu administrativo

Atua **somente** em `src/components/AppSidebar.tsx` (estrutura do array `navGroups` e estado de colapso). Nenhuma rota, permissão, página, service ou regra de negócio é alterada. Todas as `url` e `roles` de cada item permanecem idênticas — só mudam agrupamento, ordem, label, ícone e comportamento de abertura.

## Nova árvore (admin)

```text
1. INÍCIO
   - Painel Inicial        (/dashboard)            [era "Dashboard"]
   - Notificações          (/notificacoes)
   - Ajuda                 (/ajuda)                 [era "Central de Ajuda"]

2. ATENDIMENTO
   - Assistidos            (/assistidos)
   - Visão do Assistido    (/consulta-assistido)    [era "Consulta do Assistido"]
   - Agenda de Tratamentos (/agenda)                [era "Agenda"]
   - Registro de Presenças (/presenca)              [era "Presença"]
   - Agendar Entrevista    (/entrevistas)
   - Realizar Entrevista   (/fazer-entrevista)
   - Sessões Públicas      (/sessoes-publicas)

3. PESSOAS
   - Usuários              (/usuarios)
   - Voluntários           (/voluntarios)
   - Funções de Voluntariado (/funcoes-voluntariado) [era "Funções Voluntariado"]

4. ACESSO E SEGURANÇA  (fechado por padrão)
   - Solicitações de Cadastro (/solicitacoes-cadastro)
   - Permissões de Acesso  (/governanca-acessos)    [era "Governança de Acessos"]
   - Segurança da Conta    (/seguranca)

5. INTELIGÊNCIA E MONITORAMENTO
   - Central de IA         (/central-ia)
   - Fila de Notificações  (/central-notificacoes)  [era "Central de Notificações"]
   - Relatórios            (/relatorios)
   - Programação Padrão    (/programacao-padrao)
   - Exceções Operacionais (/excecoes-operacionais)
   - Exceções do Sistema   (/excecoes)              [era "Exceções"]
   - Auditoria             (/auditoria)

6. INSTITUCIONAL
   - Instituição           (/instituicao)
   - Gestão Institucional  (/painel-institucional)  [era "Painel Institucional"]
   - Ação Social           (/acao-social)
   - Campanhas             (/campanhas)
   - Eventos               (/eventos)
   - Comunicação           (/comunicacao-institucional)

7. CONFIGURAÇÕES E REGRAS  (fechado por padrão)
   - Tipos de Tratamento   (/tratamentos)           [era "Tratamentos"]
   - Regras Operacionais   (/regras)
   - Configurações         (/configuracoes)
   - Gestão de Cores       (/configuracoes/cores)

8. FERRAMENTAS ADMINISTRATIVAS  (fechado por padrão)
   - Migrar Assistido      (/migrar-assistido)
   - Homologação da Nova Agenda (/homologacao-agenda) [era "Homologação da Agenda"]
```

## Preservação dos perfis não-admin (sem regressão)

Os itens exclusivos de coordenador e assistido (hoje no grupo "Tratamentos") **continuam existindo com as mesmas `url` e `roles`**, agrupados por perfil para não poluir o menu admin (admin não tem essas roles, então nunca os vê):

```text
COORDENAÇÃO (coordenador_de_tratamento)
   - Lista de Espera        (/lista-espera)
   - Meus Tratamentos       (/coordenador-tratamentos)
   - Agenda do Tratamento   (/coordenador-agenda)

MEU ESPAÇO (assistido)
   - Meus Tratamentos       (/meus-tratamentos)
   - Minha Agenda           (/minha-agenda)
   - Documentos             (/meus-documentos)
```

Itens com múltiplas roles (ex.: Dashboard, Notificações, Ajuda, Relatórios, Agendar Entrevista, Programação Padrão, Central de IA) mantêm exatamente o mesmo array `roles`, então entrevistador/tarefeiro/coordenador continuam vendo os mesmos links. A filtragem por `role` e o filtro de grupos vazios (`visibleGroups`) já existentes garantem que cada perfil só vê o que tem permissão.

## Comportamento de colapso

- Hoje todos os grupos começam fechados e abrem automaticamente quando contêm a rota ativa (efeito `useEffect` sobre `location.pathname`). Esse mecanismo é mantido.
- Grupos sensíveis (Acesso e Segurança, Configurações e Regras, Ferramentas Administrativas) permanecem fechados por padrão — o comportamento atual já satisfaz isso; nenhum `defaultOpen` extra é adicionado.
- Item ativo, highlight e auto-expansão continuam funcionando pois dependem de `item.url`, que não muda.

## Ícones

Ajustes pontuais para coerência de grupo, sem trocas aleatórias:
- Grupos: Início `Home`, Atendimento `HandHeart`, Pessoas `Users`, Acesso e Segurança `ShieldCheck`, Inteligência e Monitoramento `Brain`, Institucional `Landmark`, Configurações e Regras `Settings`/`SlidersHorizontal`, Ferramentas Administrativas `Wrench`, Coordenação `Stethoscope`, Meu Espaço `User`.
- Itens reaproveitam os ícones já importados (ex.: `Bell`, `LifeBuoy`, `UserSearch`, `BookOpen`, `Heart`, `QrCode`, `KeyRound`, `Brain`, `BarChart3`, `AlertTriangle`, `CalendarX`, `CalendarClock`, `Shield`, `Building2`, `Apple`, `Megaphone`, `CalendarDays`, `Send`, `Palette`, `History`, `FlaskConical`). Ícones novos necessários (`Home`, `Wrench`, `SlidersHorizontal`) serão adicionados ao import do `lucide-react`.

## Validação (sem regressão)

1. Conferir que toda `url` e `roles` na nova árvore batem 1:1 com a árvore atual (nenhum link novo, nenhum removido).
2. Rodar a suíte de testes (`bunx vitest run`) — deve continuar verde.
3. Smoke test no preview (Playwright) como admin: expandir/colapsar os 8 grupos, navegar em um item de cada grupo e confirmar highlight do item ativo + auto-expansão.
4. Conferir versão colapsada (modo ícone) e mobile.

## Relatório final

Ao concluir, apresento: árvore final, lista de labels alterados, itens reagrupados, itens movidos para Ferramentas Administrativas e confirmação explícita de que rotas, permissões e funcionalidades permanecem intactas.
