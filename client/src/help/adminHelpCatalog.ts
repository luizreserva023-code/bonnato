export type AdminHelpTopic = {
  id: string;
  title: string;
  summary: string;
  details?: string;
  whenToUse?: string;
  after?: string;
  warning?: string;
  keywords?: string[];
  relatedTutorialId?: string;
};

export type AdminScreenHelp = {
  title: string;
  purpose: string;
  canDo: string[];
  recommendedFlow: string[];
  cautions?: string[];
};

export type AdminTutorialStep = {
  title: string;
  description: string;
  path?: string;
  helpId?: string;
};

export type AdminTutorialModule = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  steps: AdminTutorialStep[];
};
export const HELP_TOPICS: Record<string, AdminHelpTopic> = {
  "common.commandPalette": {
    id: "common.commandPalette",
    title: "Busca e comandos",
    summary: "Abre a busca global do painel para localizar áreas e executar atalhos sem navegar manualmente pelo menu.",
    whenToUse: "Use quando souber o nome da área ou da ação que procura. O atalho de teclado é Ctrl + K.",
    after: "A busca é aberta sobre a tela atual; nada é alterado até você escolher uma opção.",
    keywords: ["buscar", "comando", "atalho", "ctrl k"],
  },
  "common.refresh": {
    id: "common.refresh",
    title: "Atualizar dados",
    summary: "Busca novamente os dados mais recentes desta tela.",
    after: "Os cards, tabelas e indicadores são recarregados sem alterar registros.",
    keywords: ["atualizar", "recarregar", "refresh"],
  },
  "common.save": {
    id: "common.save",
    title: "Salvar alterações",
    summary: "Grava as alterações feitas no formulário ou configuração atual.",
    whenToUse: "Use somente depois de revisar os campos alterados.",
    after: "Os novos dados passam a ser usados pelo sistema assim que o salvamento for confirmado.",
    warning: "Campos obrigatórios ou regras de validação podem impedir o salvamento até serem corrigidos.",
    keywords: ["salvar", "gravar", "confirmar"],
  },
  "common.cancel": {
    id: "common.cancel",
    title: "Cancelar edição",
    summary: "Fecha a edição atual sem concluir a ação em andamento.",
    after: "Alterações ainda não salvas são descartadas. Registros já salvos anteriormente não são afetados.",
    keywords: ["cancelar", "fechar", "descartar"],
  },
  "common.edit": {
    id: "common.edit",
    title: "Editar",
    summary: "Abre o item selecionado em modo de edição.",
    after: "Nenhum dado é alterado até você salvar.",
    keywords: ["editar", "alterar"],
  },
  "common.remove": {
    id: "common.remove",
    title: "Remover",
    summary: "Exclui ou remove o item selecionado da área em que ele está cadastrado.",
    warning: "É uma ação destrutiva. Quando houver confirmação, confira o item antes de prosseguir.",
    keywords: ["remover", "excluir", "apagar"],
  },
  "common.add": {
    id: "common.add",
    title: "Adicionar",
    summary: "Abre o formulário para cadastrar um novo item nesta área.",
    after: "O novo item só passa a existir depois da confirmação ou salvamento.",
    keywords: ["adicionar", "novo", "criar"],
  },
  "common.activate": {
    id: "common.activate",
    title: "Ativar",
    summary: "Torna o item ativo e disponível para o fluxo correspondente.",
    after: "O item passa a ser considerado pelo sistema assim que a atualização for concluída.",
    keywords: ["ativar", "habilitar"],
  },
  "common.deactivate": {
    id: "common.deactivate",
    title: "Desativar",
    summary: "Mantém o cadastro, mas impede que ele continue disponível no fluxo correspondente.",
    after: "O histórico é preservado; apenas a disponibilidade futura é alterada.",
    keywords: ["desativar", "inativar", "ocultar"],
  },
  "navigation.collapse": {
    id: "navigation.collapse",
    title: "Recolher menu",
    summary: "Reduz a barra lateral para liberar mais espaço para a área de trabalho.",
    after: "Os ícones continuam disponíveis e o estado do menu fica salvo neste navegador.",
    keywords: ["menu", "recolher", "sidebar"],
  },
  "navigation.expand": {
    id: "navigation.expand",
    title: "Expandir menu",
    summary: "Reabre a barra lateral completa, exibindo os nomes das áreas.",
    after: "A preferência fica salva neste navegador.",
    keywords: ["menu", "expandir", "sidebar"],
  },
  "navigation.site": {
    id: "navigation.site",
    title: "Ver site",
    summary: "Sai do painel administrativo e abre a experiência pública da loja.",
    whenToUse: "Use para conferir como as alterações aparecem para o cliente.",
    keywords: ["site", "loja", "cliente"],
  },
  "navigation.store": {
    id: "navigation.store",
    title: "Selecionar loja",
    summary: "Troca a unidade que está sendo administrada no painel.",
    after: "Pedidos, cardápio, clientes, relatórios e configurações passam a usar o contexto da loja selecionada.",
    warning: "Confira sempre a unidade antes de editar dados para evitar alterações na loja errada.",
    keywords: ["loja", "unidade", "selecionar"],
    relatedTutorialId: "getting-started",
  },
  "navigation.mobileMenu": {
    id: "navigation.mobileMenu",
    title: "Abrir menu",
    summary: "Abre a navegação lateral do painel em telas menores.",
    after: "Você poderá escolher outra área do sistema; nenhuma informação é alterada.",
    keywords: ["menu", "mobile", "navegação"],
  },
  "settings.interface": {
    id: "settings.interface",
    title: "Preferências da interface",
    summary: "Abre as opções pessoais de visualização e os atalhos de ajuda do painel.",
    after: "Você pode ajustar a densidade, abrir a busca, acessar o tutorial completo ou rever a introdução.",
    keywords: ["interface", "preferências", "densidade"],
  },
  "settings.densityComfortable": {
    id: "settings.densityComfortable",
    title: "Densidade confortável",
    summary: "Usa espaçamentos maiores para deixar tabelas, controles e áreas do painel mais arejados.",
    after: "A preferência visual é aplicada ao painel e fica salva neste navegador.",
    keywords: ["densidade", "confortável", "interface"],
  },
  "settings.densityCompact": {
    id: "settings.densityCompact",
    title: "Densidade compacta",
    summary: "Reduz espaçamentos para exibir mais informações na mesma área da tela.",
    after: "A preferência visual é aplicada ao painel e fica salva neste navegador.",
    keywords: ["densidade", "compacta", "interface"],
  },
  "common.fullTutorial": {
    id: "common.fullTutorial",
    title: "Tutorial completo",
    summary: "Abre o treinamento completo do sistema, dividido em módulos operacionais.",
    after: "Você pode avançar no seu ritmo e marcar módulos como concluídos; o progresso fica salvo neste navegador.",
    keywords: ["tutorial", "treinamento", "ajuda"],
    relatedTutorialId: "getting-started",
  },
  "common.introduction": {
    id: "common.introduction",
    title: "Rever introdução",
    summary: "Reabre o guia curto de primeiro acesso com os conceitos básicos do painel.",
    after: "A introdução é mostrada novamente sem alterar nenhuma configuração operacional.",
    keywords: ["introdução", "primeiro acesso", "tutorial"],
  },
  "settings.push": {
    id: "settings.push",
    title: "Notificações Push",
    summary: "Ativa ou desativa as notificações do navegador para eventos operacionais relevantes.",
    whenToUse: "Mantenha ativo em computadores usados para acompanhar pedidos e alertas.",
    after: "O navegador pode solicitar permissão. A preferência é vinculada ao dispositivo e ao navegador.",
    warning: "Bloquear a permissão no navegador pode impedir o recebimento mesmo que o sistema mostre o recurso como disponível.",
    keywords: ["push", "notificação", "alerta"],
  },
  "orders.advance": {
    id: "orders.advance",
    title: "Avançar pedido",
    summary: "Move o pedido para a próxima etapa operacional válida.",
    details: "O fluxo segue a sequência configurada, como Aguardando → Confirmado → Preparando → Saiu para entrega → Entregue.",
    after: "O novo status passa a aparecer para a operação e pode gerar atualização para o cliente.",
    warning: "Não avance um pedido antes da etapa realmente ter acontecido. Algumas transições exigem confirmação de pagamento ou motoboy.",
    keywords: ["pedido", "status", "avançar", "preparo", "entrega"],
    relatedTutorialId: "orders",
  },
  "orders.cancel": {
    id: "orders.cancel",
    title: "Cancelar pedido",
    summary: "Abre o formulário de cancelamento do pedido.",
    details: "O cancelamento exige categoria e motivo para manter os indicadores operacionais e a auditoria corretos.",
    after: "Depois de confirmado, o pedido fica cancelado e deixa de compor a receita operacional considerada pelo sistema.",
    warning: "O cancelamento é uma decisão operacional importante. Registre o motivo real e evite usar esta ação apenas para corrigir status.",
    keywords: ["pedido", "cancelar", "motivo", "receita"],
    relatedTutorialId: "orders",
  },
  "orders.confirmCancel": {
    id: "orders.confirmCancel",
    title: "Confirmar cancelamento",
    summary: "Efetiva o cancelamento depois que o motivo foi informado.",
    after: "O pedido recebe status Cancelado, o motivo fica registrado e os indicadores são atualizados.",
    warning: "Revise o pedido e o motivo antes de confirmar.",
    keywords: ["cancelamento", "pedido", "auditoria"],
    relatedTutorialId: "orders",
  },
  "orders.confirmPix": {
    id: "orders.confirmPix",
    title: "Marcar PIX como recebido",
    summary: "Confirma manualmente que o valor do PIX foi recebido pela loja.",
    whenToUse: "Use quando o pagamento foi conferido de forma segura e o pedido está aguardando essa confirmação.",
    after: "O pedido é liberado para continuar o fluxo quando a regra de pagamento exigir confirmação.",
    warning: "Não marque como recebido sem conferir o pagamento.",
    keywords: ["pix", "pagamento", "pedido"],
    relatedTutorialId: "orders",
  },
  "orders.assignDriver": {
    id: "orders.assignDriver",
    title: "Atribuir ou trocar motoboy",
    summary: "Vincula o pedido de entrega a um motoboy ativo.",
    after: "A responsabilidade da entrega é atualizada sem alterar automaticamente o status do pedido.",
    warning: "Confirme o motoboy correto antes de despachar.",
    keywords: ["motoboy", "entrega", "atribuir"],
    relatedTutorialId: "delivery",
  },
  "orders.nfce": {
    id: "orders.nfce",
    title: "Emitir NFC-e",
    summary: "Solicita a emissão fiscal do pedido quando a integração e os dados fiscais permitem.",
    after: "Se a emissão for aprovada, a chave e o DANFE ficam vinculados ao pedido.",
    warning: "A emissão fiscal depende da configuração tributária e do provedor fiscal.",
    keywords: ["nfce", "nota", "fiscal", "danfe"],
  },
  "orders.showMore": {
    id: "orders.showMore",
    title: "Mostrar mais pedidos",
    summary: "Carrega mais cartões dentro desta coluna do quadro sem mudar o status de nenhum pedido.",
    keywords: ["kanban", "pedidos", "mais"],
  },
  "menu.carousel.add": {
    id: "menu.carousel.add",
    title: "Adicionar imagem ao carrossel",
    summary: "Cria um novo banner para o carrossel da página inicial da loja selecionada.",
    after: "Você deverá escolher a imagem, ordem, estado e destino do clique antes de salvar.",
    keywords: ["carrossel", "banner", "imagem", "home"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.edit": {
    id: "menu.carousel.edit",
    title: "Editar imagem do carrossel",
    summary: "Abre este banner para trocar imagem, legenda, ordem ou destino.",
    after: "A Home só muda depois de salvar.",
    keywords: ["carrossel", "editar", "banner"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.remove": {
    id: "menu.carousel.remove",
    title: "Remover imagem do carrossel",
    summary: "Exclui este banner do carrossel da loja.",
    after: "A imagem deixa de aparecer na Home após a remoção.",
    warning: "Remover é diferente de desativar. Se pretende usar o banner novamente, prefira deixá-lo inativo.",
    keywords: ["carrossel", "remover", "banner"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.toggle": {
    id: "menu.carousel.toggle",
    title: "Ativar ou desativar banner",
    summary: "Controla se esta imagem participa do carrossel sem apagar o cadastro.",
    after: "Banners inativos permanecem configurados, mas não aparecem para o cliente.",
    keywords: ["carrossel", "ativo", "inativo"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.image": {
    id: "menu.carousel.image",
    title: "Imagem do banner",
    summary: "Seleciona ou troca a imagem exibida neste banner do carrossel.",
    details: "Aceita JPG, PNG ou WebP dentro do limite informado. Imagens largas são exibidas com recorte centralizado.",
    after: "A nova imagem só passa a valer no carrossel depois que o banner for salvo.",
    warning: "Use uma imagem horizontal com boa resolução e confira o recorte na prévia.",
    keywords: ["carrossel", "imagem", "upload", "banner"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.destination": {
    id: "menu.carousel.destination",
    title: "Destino do banner",
    summary: "Define o que acontece quando o cliente clica nesta imagem.",
    details: "Você pode deixar sem ação, abrir um produto, abrir uma categoria, ir para uma página interna ou abrir um endereço externo.",
    after: "O clique do cliente passa a seguir o destino salvo para este banner.",
    warning: "Em links externos, use endereços HTTPS completos e confiáveis.",
    keywords: ["carrossel", "destino", "link", "produto", "categoria"],
    relatedTutorialId: "catalog",
  },
  "menu.carousel.save": {
    id: "menu.carousel.save",
    title: "Salvar banner",
    summary: "Grava a imagem, ordem, legenda e destino configurados para este banner.",
    after: "A configuração passa a valer para a loja selecionada.",
    keywords: ["carrossel", "salvar", "banner"],
    relatedTutorialId: "catalog",
  },
  "catalog.replicate": {
    id: "catalog.replicate",
    title: "Sincronizar catálogo",
    summary: "Abre a ferramenta de replicação para copiar estruturas de catálogo entre lojas conforme as opções escolhidas.",
    warning: "Revise loja de origem, loja de destino e o que será copiado antes de confirmar para não misturar cadastros.",
    keywords: ["cardápio", "replicar", "sincronizar", "loja", "catálogo"],
    relatedTutorialId: "catalog",
  },
  "menu.tab.structure": {
    id: "menu.tab.structure",
    title: "Cardápio",
    summary: "Mostra a estrutura geral do catálogo para organizar categorias e produtos em conjunto.",
    relatedTutorialId: "catalog",
  },
  "menu.tab.products": {
    id: "menu.tab.products",
    title: "Produtos",
    summary: "Abre a gestão detalhada dos produtos da loja selecionada.",
    relatedTutorialId: "catalog",
  },
  "menu.tab.categories": {
    id: "menu.tab.categories",
    title: "Categorias",
    summary: "Abre a gestão de categorias, ordem, imagem e organização do catálogo.",
    relatedTutorialId: "catalog",
  },
  "menu.tab.modifiers": {
    id: "menu.tab.modifiers",
    title: "Complementos",
    summary: "Abre os grupos de complementos, adicionais e escolhas vinculados aos produtos.",
    relatedTutorialId: "catalog",
  },
  "menu.tab.performance": {
    id: "menu.tab.performance",
    title: "Desempenho do cardápio",
    summary: "Mostra métricas de acesso, conversão e vendas para avaliar produtos e estrutura do catálogo.",
    relatedTutorialId: "performance",
  },
  "menu.tab.slides": {
    id: "menu.tab.slides",
    title: "Banners",
    summary: "Abre a gestão dos banners promocionais configurados para esta unidade.",
    relatedTutorialId: "catalog",
  },
  "menu.tab.carousel": {
    id: "menu.tab.carousel",
    title: "Carrossel",
    summary: "Abre a gestão das imagens Hero exibidas na página inicial e seus destinos de clique.",
    relatedTutorialId: "catalog",
  },
  "delivery.driver": {
    id: "delivery.driver",
    title: "Gerenciar motoboy",
    summary: "Permite cadastrar, editar, ativar ou desativar pessoas responsáveis pelas entregas.",
    keywords: ["motoboy", "entrega", "motorista"],
    relatedTutorialId: "delivery",
  },
  "common.move": {
    id: "common.move",
    title: "Mover ou reordenar",
    summary: "Altera a posição ou o agrupamento do item sem excluir seu cadastro.",
    after: "A nova ordem ou destino passa a ser usada na apresentação e organização correspondente.",
    warning: "Confira a posição final para não alterar a experiência do cliente ou da operação sem intenção.",
    keywords: ["mover", "ordem", "reordenar"],
  },
  "common.archive": {
    id: "common.archive",
    title: "Arquivar",
    summary: "Retira o item do fluxo ativo mantendo seu registro e histórico quando suportado.",
    after: "O item deixa de aparecer entre os ativos, mas pode continuar disponível para consulta histórica.",
    keywords: ["arquivar", "histórico"],
  },
  "common.retry": {
    id: "common.retry",
    title: "Tentar novamente",
    summary: "Repete a última consulta ou processamento que não foi concluído.",
    after: "O sistema executa novamente a operação usando os dados atuais.",
    warning: "Em operações externas, confira se a tentativa anterior realmente falhou antes de repetir.",
    keywords: ["tentar novamente", "reprocessar", "retry"],
  },
  "common.pagination": {
    id: "common.pagination",
    title: "Navegar entre páginas",
    summary: "Muda a página da listagem sem alterar os registros.",
    after: "A mesma consulta é exibida em outra página de resultados.",
    keywords: ["anterior", "próxima", "página", "paginação"],
  },
  "common.expandCollapse": {
    id: "common.expandCollapse",
    title: "Expandir ou recolher",
    summary: "Mostra ou oculta detalhes de uma seção sem alterar os dados salvos.",
    keywords: ["expandir", "recolher", "detalhes"],
  },
  "reports.exportCsv": {
    id: "reports.exportCsv",
    title: "Exportar CSV",
    summary: "Baixa os dados disponíveis na visão atual em formato CSV para análise ou arquivamento.",
    after: "Um arquivo é gerado no navegador; os dados do sistema não são alterados.",
    keywords: ["csv", "exportar", "relatório"],
    relatedTutorialId: "performance",
  },
  "reports.sendWhatsApp": {
    id: "reports.sendWhatsApp",
    title: "Enviar relatório por WhatsApp",
    summary: "Envia ou prepara o compartilhamento do relatório atual pelo canal de WhatsApp configurado.",
    warning: "Revise destinatário e conteúdo antes do envio.",
    keywords: ["whatsapp", "relatório", "enviar"],
    relatedTutorialId: "integrations",
  },
  "catalog.viewPerformance": {
    id: "catalog.viewPerformance",
    title: "Ver desempenho",
    summary: "Abre as métricas do produto selecionado para analisar tráfego, conversão e vendas.",
    after: "Você é levado à visão de desempenho sem alterar o produto.",
    keywords: ["produto", "desempenho", "conversão"],
    relatedTutorialId: "performance",
  },
  "catalog.applyLayout": {
    id: "catalog.applyLayout",
    title: "Aplicar layout",
    summary: "Salva a organização visual escolhida para o cardápio desta loja.",
    after: "A estrutura passa a usar o layout selecionado após o salvamento.",
    keywords: ["layout", "cardápio", "aplicar"],
    relatedTutorialId: "catalog",
  },
  "coupons.generateCodes": {
    id: "coupons.generateCodes",
    title: "Gerar códigos seguros",
    summary: "Cria códigos de cupom únicos automaticamente para a campanha.",
    after: "Os novos códigos ficam associados à configuração do cupom e podem ser distribuídos conforme a regra criada.",
    warning: "Defina quantidade, validade e regras antes de distribuir os códigos.",
    keywords: ["cupom", "código", "gerar"],
    relatedTutorialId: "marketing",
  },
  "recovery.trigger": {
    id: "recovery.trigger",
    title: "Disparar reativação",
    summary: "Inicia a ação de reativação configurada para clientes ou oportunidades elegíveis.",
    after: "A régua é processada conforme os filtros e limites configurados.",
    warning: "Confira público, frequência e mensagem para evitar contatos duplicados ou indevidos.",
    keywords: ["reativação", "recuperação", "disparar"],
    relatedTutorialId: "marketing",
  },
  "whatsapp.connect": {
    id: "whatsapp.connect",
    title: "Conectar WhatsApp",
    summary: "Inicia o processo de conexão da conta ou instância de WhatsApp usada pelo sistema.",
    after: "Depois da autenticação, o estado da integração deve ser validado antes de usar automações.",
    warning: "Use apenas a conta autorizada para a operação e confirme os dados antes de conectar.",
    keywords: ["whatsapp", "conectar", "integração"],
    relatedTutorialId: "integrations",
  },
  "orders.viewDanfe": {
    id: "orders.viewDanfe",
    title: "Ver DANFE",
    summary: "Abre a representação auxiliar da NFC-e já emitida para este pedido.",
    after: "O documento é aberto para consulta; nenhuma informação fiscal é alterada.",
    keywords: ["danfe", "nfce", "fiscal"],
    relatedTutorialId: "payments",
  },
  "raffles.close": {
    id: "raffles.close",
    title: "Encerrar campanha",
    summary: "Finaliza a campanha ou sorteio, impedindo novas participações quando a regra da área assim determina.",
    warning: "Revise período, participantes e pendências antes de encerrar.",
    keywords: ["encerrar", "sorteio", "campanha"],
    relatedTutorialId: "marketing",
  },
};
export const SCREEN_HELP: Record<string, AdminScreenHelp> = {
  dashboard: {
    title: "Dashboard",
    purpose: "Acompanhar rapidamente o estado comercial e operacional da loja selecionada.",
    canDo: ["Ver receita, pedidos, ticket e indicadores-chave.", "Comparar períodos e identificar mudanças relevantes.", "Atualizar os dados quando precisar de uma leitura mais recente."],
    recommendedFlow: ["Confirme a loja selecionada.", "Confira o período do relatório.", "Leia os indicadores principais antes dos gráficos.", "Abra Pedidos ou Desempenho quando um número exigir investigação."],
    cautions: ["Indicadores dependem do período selecionado e da qualidade dos eventos registrados."],
  },
  orders: {
    title: "Pedidos",
    purpose: "Controlar o ciclo completo do pedido, da entrada até entrega ou cancelamento.",
    canDo: ["Buscar pedidos.", "Mover pedidos entre etapas válidas.", "Confirmar PIX quando necessário.", "Atribuir motoboy.", "Cancelar com motivo registrado.", "Emitir ou consultar NFC-e quando disponível."],
    recommendedFlow: ["Comece pelos pedidos aguardando ação.", "Abra o pedido e confira cliente, itens, pagamento e endereço.", "Avance o status somente quando a etapa realmente acontecer.", "Para delivery, atribua o motoboy antes do despacho.", "Finalize como entregue apenas quando a entrega estiver confirmada."],
    cautions: ["Cancelar altera indicadores e receita operacional.", "Status incorreto prejudica cliente, relatórios e automações."],
  },
  menu: {
    title: "Cardápio",
    purpose: "Controlar tudo que o cliente vê e pode comprar no catálogo da loja.",
    canDo: ["Organizar categorias.", "Criar e editar produtos.", "Definir complementos.", "Acompanhar desempenho.", "Gerenciar banners e carrossel.", "Replicar estruturas quando permitido."],
    recommendedFlow: ["Organize categorias primeiro.", "Cadastre produtos com nome, preço, foto e descrição.", "Configure complementos e regras.", "Confira o cardápio público.", "Use Desempenho para decidir o que destacar ou simplificar."],
    cautions: ["A loja selecionada define qual catálogo está sendo editado.", "Desativar preserva histórico; remover pode ser definitivo."],
  },
  club: {
    title: "Clube",
    purpose: "Configurar a experiência de assinatura e benefícios do clube da marca.",
    canDo: ["Ajustar planos, preços e benefícios.", "Definir textos de apresentação e checkout.", "Controlar destaques e mensagens de sucesso."],
    recommendedFlow: ["Revise a proposta do plano.", "Valide preço e benefícios.", "Confira textos do checkout.", "Teste a experiência como cliente."],
  },
  rewards: {
    title: "Clube de Recompensas",
    purpose: "Gerenciar recompensas, cupons únicos, resgates e estornos do programa de pontos.",
    canDo: ["Criar recompensas.", "Gerenciar cupons vinculados às recompensas.", "Acompanhar resgates e estornos."],
    recommendedFlow: ["Crie a recompensa.", "Defina o custo em pontos.", "Adicione cupons quando necessário.", "Acompanhe os resgates."],
  },
  reviews: {
    title: "Avaliações",
    purpose: "Configurar campanhas pós-compra com avaliação do pedido, convite ao Google ou os dois fluxos.",
    canDo: ["Escolher o tipo de campanha.", "Definir cashback e conversão em pontos para a avaliação interna.", "Configurar prazo e momento da notificação.", "Personalizar a mensagem.", "Cadastrar o link do Google por unidade.", "Acompanhar resultados de recompensas."],
    recommendedFlow: ["Confirme a loja selecionada.", "Escolha o tipo de campanha.", "Configure a notificação e a validade.", "Se usar Google, cadastre o link da unidade.", "Salve e acompanhe os indicadores."],
    cautions: ["O Google não permite oferecer pagamento, desconto, pontos ou outro incentivo em troca de uma avaliação. Por isso, no modo Google o sistema apenas solicita a avaliação; os pontos ficam vinculados à avaliação interna do pedido."],
  },
  coupons: {
    title: "Cupons",
    purpose: "Criar incentivos de desconto com regras claras de uso.",
    canDo: ["Criar códigos.", "Definir validade, valor e restrições.", "Ativar, pausar ou encerrar campanhas."],
    recommendedFlow: ["Defina objetivo e público.", "Configure a condição.", "Teste o cupom.", "Acompanhe uso e impacto em margem."],
    cautions: ["Cupons mal configurados podem gerar desconto acima do planejado."],
  },
  promotions: {
    title: "Promoções",
    purpose: "Montar ofertas comerciais exibidas no ecossistema da loja.",
    canDo: ["Criar promoções.", "Definir período e itens.", "Ativar e desativar ofertas."],
    recommendedFlow: ["Escolha itens com objetivo claro.", "Calcule margem.", "Defina duração.", "Publique e acompanhe desempenho."],
  },
  raffles: {
    title: "Sorteios",
    purpose: "Administrar campanhas promocionais baseadas em sorteios.",
    canDo: ["Criar campanhas.", "Definir regras e períodos.", "Acompanhar participantes e resultados."],
    recommendedFlow: ["Defina regra transparente.", "Configure período.", "Divulgue.", "Finalize e registre o resultado."],
  },
  upsells: {
    title: "Up-sells",
    purpose: "Aumentar ticket sugerindo itens complementares no momento adequado.",
    canDo: ["Criar sugestões.", "Relacionar produtos.", "Ativar ou pausar ofertas."],
    recommendedFlow: ["Escolha um produto principal.", "Associe complemento coerente.", "Evite excesso de sugestões.", "Acompanhe conversão e ticket."],
  },
  recovery: {
    title: "Recuperação",
    purpose: "Recuperar oportunidades abandonadas sem repetir mensagens de forma invasiva.",
    canDo: ["Configurar réguas.", "Acompanhar carrinhos e oportunidades.", "Medir recuperação."],
    recommendedFlow: ["Defina quem entra na régua.", "Escolha momento e mensagem.", "Limite repetições.", "Meça pedidos recuperados."],
  },
  users: {
    title: "Clientes",
    purpose: "Consultar e organizar a base de clientes e seu histórico de relacionamento.",
    canDo: ["Buscar pessoas.", "Consultar dados e histórico.", "Usar informações operacionais e de relacionamento permitidas."],
    recommendedFlow: ["Localize o cliente.", "Confira histórico.", "Use os dados somente para a finalidade necessária.", "Evite alterações desnecessárias."],
  },
  reports: {
    title: "Desempenho",
    purpose: "Entender vendas, conversão, produtos, confiabilidade e qualidade operacional.",
    canDo: ["Comparar períodos.", "Analisar funil.", "Ver produtos com melhor e pior desempenho.", "Acompanhar cancelamentos, avaliações e confiabilidade."],
    recommendedFlow: ["Confirme período e loja.", "Leia o funil na ordem correta.", "Compare tráfego, conversão e receita.", "Cruze indicadores antes de tomar decisão."],
    cautions: ["Uma métrica isolada raramente explica o problema inteiro.", "O funil considera progressão sequencial real das sessões."],
  },
  growth: {
    title: "Central de Crescimento",
    purpose: "Reunir oportunidades práticas de crescimento comercial e retenção.",
    canDo: ["Identificar alavancas.", "Priorizar ações.", "Acompanhar iniciativas de crescimento."],
    recommendedFlow: ["Comece pelo maior gargalo.", "Escolha poucas ações por vez.", "Defina métrica de sucesso.", "Revise o resultado antes da próxima mudança."],
  },
  network: {
    title: "Rede & Financeiro",
    purpose: "Acompanhar informações consolidadas de rede, lojas e visão financeira conforme permissões.",
    canDo: ["Comparar unidades.", "Consultar consolidados.", "Acompanhar indicadores financeiros."],
    recommendedFlow: ["Confirme o escopo.", "Compare unidades equivalentes.", "Investigue divergências antes de concluir."],
  },
  distribution: {
    title: "Centro de Distribuição",
    purpose: "Acompanhar fluxos de distribuição e abastecimento entre estruturas da operação.",
    canDo: ["Consultar movimentações.", "Acompanhar distribuição.", "Analisar necessidades de abastecimento."],
    recommendedFlow: ["Confira origem e destino.", "Valide quantidades.", "Acompanhe pendências até a conclusão."],
  },
  drivers: {
    title: "Entregas",
    purpose: "Gerenciar motoboys e acompanhar a operação de entrega.",
    canDo: ["Cadastrar e ativar motoboys.", "Acompanhar localização quando disponível.", "Vincular responsáveis aos pedidos."],
    recommendedFlow: ["Mantenha apenas motoboys ativos disponíveis.", "Atribua corretamente.", "Acompanhe pedidos em rota.", "Confirme conclusão da entrega."],
    cautions: ["Localização depende de permissão e disponibilidade do dispositivo do motoboy."],
  },
  payments: {
    title: "Pagamentos",
    purpose: "Configurar e acompanhar os meios de pagamento aceitos pela operação.",
    canDo: ["Ver integrações.", "Ajustar opções disponíveis.", "Conferir estado de provedores."],
    recommendedFlow: ["Configure credenciais em ambiente seguro.", "Teste antes de liberar.", "Monitore falhas.", "Mantenha alternativa de contingência quando fizer sentido."],
    cautions: ["Alterações de pagamento podem impedir pedidos se forem publicadas sem teste."],
  },
  whatsapp: {
    title: "WhatsApp",
    purpose: "Configurar integrações e fluxos de comunicação pelo WhatsApp quando habilitados.",
    canDo: ["Gerenciar conexão.", "Configurar mensagens.", "Acompanhar estado da integração."],
    recommendedFlow: ["Confirme a conexão.", "Revise templates.", "Teste com número controlado.", "Só então libere em produção."],
  },
  marketplaces: {
    title: "Integrações",
    purpose: "Centralizar conexões com serviços externos e canais de venda.",
    canDo: ["Consultar integrações.", "Configurar provedores suportados.", "Ver estado de conexão."],
    recommendedFlow: ["Configure uma integração por vez.", "Valide credenciais.", "Teste sincronização.", "Monitore erros iniciais."],
  },
  settings: {
    title: "Configurações",
    purpose: "Controlar parâmetros gerais da loja e recursos que afetam a operação.",
    canDo: ["Ajustar dados operacionais.", "Configurar recursos.", "Revisar parâmetros de funcionamento."],
    recommendedFlow: ["Altere somente o necessário.", "Leia o impacto antes de salvar.", "Teste mudanças que afetam cliente ou operação.", "Documente parâmetros críticos."],
    cautions: ["Configurações podem afetar várias telas e fluxos ao mesmo tempo."],
  },
  stores: {
    title: "Lojas",
    purpose: "Administrar unidades e seus dados estruturais quando o perfil possui permissão.",
    canDo: ["Cadastrar unidades.", "Editar informações.", "Controlar disponibilidade e parâmetros por loja."],
    recommendedFlow: ["Confirme a unidade antes de editar.", "Evite duplicidades.", "Revise integrações e catálogo relacionados."],
  },
};
export const TUTORIAL_MODULES: AdminTutorialModule[] = [
  {
    id: "getting-started",
    title: "1. Começando pelo painel",
    description: "Entenda contexto de loja, navegação, busca, notificações e regras básicas antes de operar.",
    estimatedMinutes: 6,
    steps: [
      { title: "Selecione a loja correta", description: "O seletor define o contexto de pedidos, cardápio, clientes e relatórios. Sempre confira a unidade antes de editar.", path: "Topo / seletor de loja" },
      { title: "Aprenda a navegação lateral", description: "Use o menu para trocar de módulo. Submenus agrupam áreas relacionadas e o estado recolhido é salvo no navegador." },
      { title: "Use a busca global", description: "Pressione Ctrl + K para localizar áreas e atalhos sem percorrer o menu.", helpId: "common.commandPalette" },
      { title: "Configure notificações", description: "Ative Push em estações operacionais para receber alertas relevantes, respeitando a permissão do navegador.", helpId: "settings.push" },
      { title: "Use a Ajuda", description: "Abra a Central de Ajuda para pesquisar funções, entender a tela atual ou ativar o Modo Ajuda." },
    ],
  },
  {
    id: "dashboard",
    title: "2. Dashboard e leitura da operação",
    description: "Aprenda a interpretar os indicadores sem tirar conclusões por uma métrica isolada.",
    estimatedMinutes: 7,
    steps: [
      { title: "Confira loja e período", description: "Toda leitura deve começar pelo escopo correto." },
      { title: "Leia receita, pedidos e ticket", description: "Use os indicadores principais como visão geral e depois investigue causas." },
      { title: "Compare períodos equivalentes", description: "Evite comparar dias ou janelas com comportamento operacional muito diferente." },
      { title: "Atualize quando necessário", description: "O botão Atualizar refaz a consulta sem alterar os dados.", helpId: "common.refresh" },
    ],
  },
  {
    id: "orders",
    title: "3. Pedidos do início ao fim",
    description: "Domine entrada, pagamento, preparo, despacho, entrega e cancelamento.",
    estimatedMinutes: 12,
    steps: [
      { title: "Priorize Aguardando", description: "Pedidos novos exigem ação rápida. Abra o detalhe antes de avançar." },
      { title: "Confira pagamento", description: "Para PIX manual, confirme o recebimento somente após conferir o valor.", helpId: "orders.confirmPix" },
      { title: "Avance por etapas", description: "Use Avançar para mover o pedido apenas quando a etapa operacional realmente aconteceu.", helpId: "orders.advance" },
      { title: "Atribua motoboy", description: "Pedidos de delivery podem receber ou trocar motoboy sem alterar automaticamente o status.", helpId: "orders.assignDriver" },
      { title: "Cancele com motivo real", description: "Abra o cancelamento, selecione categoria e descreva o motivo. Isso alimenta auditoria e indicadores.", helpId: "orders.cancel" },
      { title: "Finalize a entrega", description: "Marque como entregue somente após confirmação da entrega conforme a regra operacional." },
    ],
  },
  {
    id: "catalog",
    title: "4. Cardápio, produtos e carrossel",
    description: "Aprenda a estruturar o catálogo que o cliente vê e compra.",
    estimatedMinutes: 14,
    steps: [
      { title: "Organize categorias", description: "Coloque as categorias na ordem em que o cliente normalmente escolhe o que vai pedir." },
      { title: "Cadastre produtos", description: "Use nome claro, preço correto, descrição objetiva e foto fiel ao item." },
      { title: "Configure complementos", description: "Use grupos para adicionais, escolhas obrigatórias e limites sem duplicar produtos." },
      { title: "Revise disponibilidade", description: "Prefira desativar temporariamente quando quiser preservar histórico." },
      { title: "Configure o carrossel", description: "Adicione imagens, defina ordem e escolha o destino do clique.", helpId: "menu.carousel.destination" },
      { title: "Confira o site", description: "Depois de salvar, abra Ver Site para validar a experiência real do cliente.", helpId: "navigation.site" },
    ],
  },
  {
    id: "marketing",
    title: "5. Marketing: cupons, promoções e up-sell",
    description: "Configure incentivos sem perder controle de margem e experiência.",
    estimatedMinutes: 10,
    steps: [
      { title: "Defina objetivo", description: "Cada ação deve ter meta: aquisição, ticket, recorrência ou giro de item." },
      { title: "Crie a oferta", description: "Configure benefício, período e público com regras simples." },
      { title: "Teste antes de publicar", description: "Valide preço final, restrições e comportamento no checkout." },
      { title: "Acompanhe impacto", description: "Cruze uso da campanha com receita, margem, ticket e novos pedidos." },
      { title: "Evite excesso", description: "Muitas promoções simultâneas podem canibalizar venda e confundir o cliente." },
    ],
  },
  {
    id: "customers",
    title: "6. Clientes e relacionamento",
    description: "Use a base de clientes para atendimento e relacionamento com contexto.",
    estimatedMinutes: 7,
    steps: [
      { title: "Localize o cliente", description: "Use busca por dados disponíveis e confirme que está no cadastro correto." },
      { title: "Leia o histórico", description: "Consulte pedidos e informações relevantes antes de agir." },
      { title: "Segmente com propósito", description: "Quando houver recursos de CRM, use grupos coerentes com comportamento real." },
      { title: "Respeite o contexto", description: "Evite alterar dados ou disparar comunicação sem necessidade operacional ou autorização adequada." },
    ],
  },
  {
    id: "delivery",
    title: "7. Entregas e motoboys",
    description: "Organize responsáveis, rotas e conclusão das entregas.",
    estimatedMinutes: 9,
    steps: [
      { title: "Mantenha motoboys atualizados", description: "Ative somente quem está disponível para receber entregas." },
      { title: "Atribua o pedido", description: "Escolha o responsável correto no detalhe do pedido.", helpId: "orders.assignDriver" },
      { title: "Acompanhe em rota", description: "Use o mapa quando a localização estiver ativa e autorizada." },
      { title: "Confirme conclusão", description: "A entrega deve ser concluída conforme o fluxo de confirmação definido pela operação." },
      { title: "Revise taxas e distância", description: "Nas configurações de entrega, valide faixas, origem e limites antes de publicar." },
    ],
  },
  {
    id: "performance",
    title: "8. Desempenho e funil",
    description: "Aprenda a interpretar conversão, produtos e confiabilidade operacional.",
    estimatedMinutes: 10,
    steps: [
      { title: "Comece pelo período", description: "Confirme loja e intervalo antes de comparar números." },
      { title: "Leia o funil em sequência", description: "Uma sessão só avança quando cumpriu a etapa anterior; etapas posteriores não podem superar as anteriores." },
      { title: "Cruze tráfego e conversão", description: "Muito acesso com pouca compra pede ação diferente de alta conversão com pouco tráfego." },
      { title: "Analise cancelamentos", description: "Separe volume, motivo e impacto operacional." },
      { title: "Use avaliações como diagnóstico", description: "Leia recorrência dos problemas antes de alterar processo ou cardápio." },
    ],
  },
  {
    id: "payments",
    title: "9. Pagamentos e fiscal",
    description: "Entenda meios de pagamento, confirmação e emissão fiscal.",
    estimatedMinutes: 8,
    steps: [
      { title: "Valide os meios ativos", description: "Mantenha apenas opções realmente disponíveis para o cliente." },
      { title: "Teste integrações", description: "Faça testes controlados antes de depender de um provedor em produção." },
      { title: "Confirme PIX com segurança", description: "Nunca avance um pagamento manual sem conferência.", helpId: "orders.confirmPix" },
      { title: "Use NFC-e quando aplicável", description: "A emissão depende de configuração fiscal e disponibilidade da integração.", helpId: "orders.nfce" },
    ],
  },
  {
    id: "settings",
    title: "10. Configurações da loja",
    description: "Altere parâmetros gerais com segurança e rastreabilidade.",
    estimatedMinutes: 8,
    steps: [
      { title: "Confirme o escopo", description: "Veja se a configuração vale para uma loja ou para toda a operação." },
      { title: "Altere uma coisa por vez", description: "Mudanças pequenas são mais fáceis de validar e reverter." },
      { title: "Salve e teste", description: "Depois de salvar, percorra o fluxo afetado como operador ou cliente.", helpId: "common.save" },
      { title: "Documente parâmetros críticos", description: "Horários, pagamentos e regras de entrega devem ter responsável e processo de revisão." },
    ],
  },
  {
    id: "integrations",
    title: "11. Integrações, WhatsApp e automações",
    description: "Conecte serviços externos sem transformar uma falha externa em falha operacional.",
    estimatedMinutes: 10,
    steps: [
      { title: "Configure credenciais em ambiente seguro", description: "Nunca exponha chaves ou tokens em telas públicas ou documentação insegura." },
      { title: "Valide estado da conexão", description: "Confirme autenticação, webhook e permissões necessárias." },
      { title: "Teste com cenário controlado", description: "Faça um fluxo completo antes de ativar para todos." },
      { title: "Evite notificações duplicadas", description: "Automações devem ter deduplicação e regra clara de reenvio." },
      { title: "Monitore erros", description: "Integrações precisam de logs e uma forma segura de recuperação." },
    ],
  },
  {
    id: "daily-routine",
    title: "12. Rotina diária recomendada",
    description: "Uma sequência curta para operar o sistema com consistência.",
    estimatedMinutes: 5,
    steps: [
      { title: "Abertura", description: "Confira loja, disponibilidade, notificações e pedidos pendentes." },
      { title: "Durante o turno", description: "Mantenha pedidos atualizados, estoque disponível e entregas atribuídas." },
      { title: "Picos", description: "Priorize execução e atualização de status; evite mudanças estruturais no cardápio em horário crítico." },
      { title: "Fechamento", description: "Revise cancelamentos, falhas, pagamentos pendentes e indicadores do dia." },
      { title: "Aprendizado", description: "Registre problemas recorrentes e trate a causa na próxima janela operacional." },
    ],
  },
];
const EXACT_LABEL_HELP: Record<string, string> = {
  "atualizar": "common.refresh",
  "salvar": "common.save",
  "adicionar": "common.add",
  "editar": "common.edit",
  "remover": "common.remove",
  "excluir": "common.remove",
  "cancelar": "common.cancel",
  "voltar": "common.cancel",
  "ativar": "common.activate",
  "desativar": "common.deactivate",
  "ver site": "navigation.site",
  "ativar push": "settings.push",
  "push ativo": "settings.push",
  "marcar pix recebido": "orders.confirmPix",
  "emitir nfce": "orders.nfce",
  "emitir nfc-e": "orders.nfce",
  "atribuir motoboy": "orders.assignDriver",
  "atualizar motoboy": "orders.assignDriver",
  "confirmar cancelamento": "orders.confirmCancel",
  "adicionar imagem": "menu.carousel.add",
  "exportar csv": "reports.exportCsv",
  "enviar por whatsapp": "reports.sendWhatsApp",
  "ver desempenho": "catalog.viewPerformance",
  "aplicar layout": "catalog.applyLayout",
  "gerar códigos seguros": "coupons.generateCodes",
  "gerar codigos seguros": "coupons.generateCodes",
  "disparar reativação": "recovery.trigger",
  "disparar reativacao": "recovery.trigger",
  "conectar whatsapp": "whatsapp.connect",
  "ver danfe": "orders.viewDanfe",
  "encerrar": "raffles.close",
  "arquivar": "common.archive",
  "reprocessar": "common.retry",
  "tentar novamente": "common.retry",
  "anterior": "common.pagination",
  "próxima": "common.pagination",
  "proxima": "common.pagination",
  "expandir": "common.expandCollapse",
  "recolher": "common.expandCollapse",
};

export function normalizeHelpLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[✓✕×]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function resolveAdminActionHelp(input: {
  helpId?: string | null;
  label?: string | null;
  activeTab?: string | null;
}): AdminHelpTopic | null {
  const explicit = input.helpId?.trim();
  if (explicit && HELP_TOPICS[explicit]) return HELP_TOPICS[explicit];

  const label = normalizeHelpLabel(input.label ?? "");
  if (!label) return null;

  if (/^avançar para:/.test(label)) return HELP_TOPICS["orders.advance"];
  if (/^mostrar mais \d+ pedidos?/.test(label)) return HELP_TOPICS["orders.showMore"];
  if (label.includes("buscar ou executar comando")) return HELP_TOPICS["common.commandPalette"];
  if (label === "recolher menu") return HELP_TOPICS["navigation.collapse"];
  if (label === "expandir menu") return HELP_TOPICS["navigation.expand"];

  const exactId = EXACT_LABEL_HELP[label];
  if (exactId) return HELP_TOPICS[exactId];

  const genericRules: Array<[RegExp, string]> = [
    [/^(adicionar|novo|nova|criar|cadastrar)\b/, "common.add"],
    [/^(salvar|gravar|aplicar)\b/, "common.save"],
    [/^(editar|alterar)\b/, "common.edit"],
    [/^(remover|excluir|apagar)\b/, "common.remove"],
    [/^(ativar|habilitar)\b/, "common.activate"],
    [/^(desativar|inativar|pausar)\b/, "common.deactivate"],
    [/^(cancelar|fechar|voltar)\b/, "common.cancel"],
    [/^(atualizar|recarregar)\b/, "common.refresh"],
    [/^(mover|reordenar)\b/, "common.move"],
    [/^(arquivar)\b/, "common.archive"],
    [/^(reprocessar|tentar novamente)\b/, "common.retry"],
    [/^(expandir|recolher)\b/, "common.expandCollapse"],
  ];
  for (const [pattern, topicId] of genericRules) {
    if (pattern.test(label)) {
      const base = HELP_TOPICS[topicId];
      return { ...base, title: input.label?.trim() || base.title };
    }
  }

  const screenEntry = Object.entries(SCREEN_HELP).find(([, screen]) => normalizeHelpLabel(screen.title) === label);
  if (screenEntry) {
    const [screenId, screen] = screenEntry;
    return {
      id: `screen.${screenId}`,
      title: screen.title,
      summary: screen.purpose,
      details: screen.canDo.join(" "),
      whenToUse: screen.recommendedFlow.join(" "),
      warning: screen.cautions?.join(" "),
      keywords: [screen.title, screenId],
    };
  }

  return null;
}

export function searchAdminHelp(query: string) {
  const screenTopics: AdminHelpTopic[] = Object.entries(SCREEN_HELP).map(([screenId, screen]) => ({
    id: "screen." + screenId,
    title: screen.title,
    summary: screen.purpose,
    details: screen.canDo.join(" "),
    whenToUse: screen.recommendedFlow.join(" "),
    warning: screen.cautions?.join(" "),
    keywords: [screen.title, screenId],
  }));
  const topics = [...Object.values(HELP_TOPICS), ...screenTopics];
  const q = normalizeHelpLabel(query);
  if (!q) return topics;
  return topics.filter((topic) => {
    const haystack = [
      topic.title,
      topic.summary,
      topic.details ?? "",
      topic.whenToUse ?? "",
      topic.after ?? "",
      topic.warning ?? "",
      ...(topic.keywords ?? []),
    ].join(" ").toLocaleLowerCase("pt-BR");
    return haystack.includes(q);
  });
}
