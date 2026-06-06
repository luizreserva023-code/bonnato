# Bonatto Pizza - TODO

## Banco de Dados & Schema
- [x] Tabela categories (categorias do cardápio)
- [x] Tabela products (produtos com preço, imagem, descrição)
- [x] Tabela orders (pedidos com status, total, endereço)
- [x] Tabela order_items (itens de cada pedido)
- [x] Tabela coupons (cupons de desconto)
- [x] Tabela transactions (histórico de pagamentos)
- [x] Migrar schema com pnpm db:push
- [x] Seed do cardápio completo da Bonatto Pizza (40+ produtos em 8 categorias)

## Identidade Visual
- [x] Upload da logo para CDN
- [x] Configurar paleta de cores vermelha no index.css
- [x] Configurar fontes (Poppins + Inter)

## Landing Page
- [x] Hero section com logo, headline e CTA
- [x] Seção de informações (endereço, avaliação, horários)
- [x] Seção de destaques/promoções
- [x] Navbar com carrinho e login
- [x] Footer com informações da pizzaria

## Cardápio Interativo
- [x] Listagem de categorias com tabs
- [x] Cards de produtos com imagem, nome, descrição e preço
- [x] Botão "Adicionar ao carrinho"
- [x] Filtro por categoria
- [x] Badge de promoção/destaque

## Carrinho de Compras
- [x] Drawer/sidebar do carrinho
- [x] Adicionar/remover itens
- [x] Alterar quantidade
- [x] Campo de observações por item
- [x] Aplicar cupom de desconto
- [x] Cálculo automático do total
- [x] Botão de finalizar pedido

## Checkout
- [x] Formulário de endereço de entrega
- [x] Busca de CEP automática
- [x] Seleção de método de pagamento (Cartão/PIX)
- [x] Resumo do pedido
- [x] Tela de confirmação pós-pedido

## Pagamento (Stripe)
- [x] Integração Stripe no backend
- [x] Payment Intent para cartão (Stripe Checkout)
- [x] Suporte a PIX (via Stripe)
- [x] Webhook de confirmação de pagamento
- [x] Histórico de transações

## Autenticação
- [x] Login via Manus OAuth
- [x] Histórico de pedidos do cliente

## Painel Administrativo
- [x] Dashboard com métricas principais
- [x] Gerenciamento de pedidos em tempo real (polling 30s)
- [x] Atualização de status do pedido
- [x] Gerenciamento de produtos (CRUD)
- [x] Gerenciamento de categorias (CRUD)
- [x] Gerenciamento de cupons
- [x] Relatórios de vendas por período
- [x] Produtos mais vendidos
- [x] Gráfico de receita diária

## Notificações
- [x] Notificação ao dono quando novo pedido chegar
- [x] Detalhes completos do pedido na notificação (cliente, itens, total, endereço)

## Testes
- [x] Testes de rotas do backend (15 testes passando)
- [x] Testes de criação de pedido
- [x] Testes de autenticação admin
- [x] Testes de validação de cupom
- [x] Testes de relatórios

## Auditoria v1.1 - Correções Aplicadas
- [x] BUG CRÍTICO: Corrigir insertId do Drizzle ORM em createOrder (array vs objeto)
- [x] BUG: Corrigir ordem do middleware Stripe webhook (deve vir antes do express.json)
- [x] BUG: Corrigir link morto /sobre no Navbar (substituído por /meus-pedidos)
- [x] MELHORIA: Adicionar visualização de itens do pedido no painel admin (expand/collapse)
- [x] MELHORIA: Adicionar visualização de itens do pedido em Meus Pedidos (expand/collapse)
- [x] MELHORIA: Adicionar polling de status em Meus Pedidos (30s)
- [x] MELHORIA: Adicionar router payments.createIntent para cartão de crédito via Stripe

## v1.2 - Autenticação, Painel do Cliente e Up-sell

### Autenticação Obrigatória
- [x] Exigir login para acessar o checkout (redirecionar para login se não autenticado)
- [x] Painel admin restrito exclusivamente ao dono (role=admin)
- [x] Mensagem clara de "crie sua conta para fazer pedidos" no cardápio

### Painel do Cliente
- [x] Página /minha-conta com identidade visual Bonatto Pizza
- [x] Aba: Meus Pedidos (com itens expansíveis e status em tempo real)
- [x] Aba: Meus Cupons (cupóns exclusivos do cliente)
- [x] Aba: Promoções (promoções ativas da pizzaria)
- [x] Aba: Sorteios (participar de sorteios ativos)
- [x] Dados do perfil do cliente (nome, telefone, endereço salvo)

### Sistema de Up-sell / Down-sell
- [x] Tabela upsells no banco (produto sugerido, gatilho, tipo: upsell/downsell)
- [x] Modal de up-sell antes de finalizar pedido no checkout
- [x] Lógica: sugerir produto complementar baseado nos itens do carrinho
- [x] Down-sell: se cliente recusar up-sell, oferecer versão menor/mais barata
- [x] Admin pode configurar up-sells no painel

### Admin - Novas Funcionalidades
- [x] Aba de gerenciamento de up-sells no painel admin
- [x] Aba de gerenciamento de sorteios (criar, editar, encerrar)
- [x] Aba de promoções exclusivas para clientes cadastrados
- [x] Enviar cupóm exclusivo para cliente específico pelo admin

## v1.3 - Redesign da Página Inicial

- [x] Hero section mais impactante com fundo escuro, tipografia grande e imagem de pizza em destaque
- [x] Seção "Por que escolher a Bonatto?" com ícones e diferenciais
- [x] Seção de categorias do cardápio com cards visuais clicáveis
- [x] Seção de destaques / pizzas mais pedidas
- [x] Seção de avaliações/depoimentos de clientes
- [x] Seção de informações da pizzaria (endereço, horários, WhatsApp)
- [x] Footer completo com logo, links e redes sociais
- [x] Animações suaves de entrada nas seções (scroll reveal)

## v1.5 - Banners Estratégicos e Carrossel Infinito

- [x] Gerar Banner 1: Promoção combo (ex: "2 pizzas + refrigerante com desconto")
- [x] Gerar Banner 2: Urgência/entrega (ex: "Peça agora, entrega em 50min")
- [x] Gerar Banner 3: Cadastro/fidelidade (ex: "Crie sua conta e ganhe cupom")
- [x] Fazer upload dos banners para CDN
- [x] Adicionar seção de banners rotativos na Home
- [x] Buscar 10+ fotos de pizzas de alta qualidade
- [x] Fazer upload das fotos para CDN
- [x] Implementar carrossel infinito auto-scroll de fotos de pizzas na Home

## v1.7 - Ajustes Visuais
- [x] Remover bloco vermelho de info (endereço/horários) da Home
- [x] Melhorar visual dos banners estratégicos

## v2.4 - Autenticação Obrigatória no Fluxo de Pedidos

- [x] orders.create alterado de publicProcedure para protectedProcedure (servidor exige login)
- [x] userId sempre preenchido com ctx.user.id no pedido (não mais nullable)
- [x] CartDrawer: botão "Finalizar Pedido" verifica auth antes de navegar
- [x] CartDrawer: se não logado, exibe "Entrar e Finalizar Pedido" com ícone de login
- [x] CartDrawer: redireciona para login com returnTo=/checkout após toast informativo
- [x] getLoginUrl() atualizado para aceitar returnPath e codificá-lo no state OAuth
- [x] OAuth callback atualizado para decodificar returnTo do state e redirecionar após login
- [x] Checkout.tsx: guard de auth usa getLoginUrl("/checkout") para preservar returnTo
- [x] Carrinho persiste no localStorage (bonatto_cart) durante o redirecionamento de login
- [x] MinhaConta: aba Pedidos exibe histórico completo vinculado ao usuário logado

## v3.0 - Funcionalidades Completas
- [x] Item 6: Modal de detalhe do produto com descrição, tamanhos e adicionais
- [x] Item 9: Validação de horário de funcionamento no checkout e cardápio
- [x] Item 10: Validação de CEP por área de entrega no checkout

## v3.5 - Rastreamento de Motoboy em Tempo Real
- [x] Tabela `drivers` (motoboys) no schema do banco
- [x] Tabela `driver_locations` para posição GPS em tempo real
- [x] Campo `driverId` na tabela `orders`
- [x] Procedure tRPC: admin atribui motoboy ao pedido
- [x] Procedure tRPC: motoboy atualiza localização GPS (polling)
- [x] Procedure tRPC: cliente consulta posição do motoboy
- [x] Página `/motoboy` — app mobile para motoboy compartilhar GPS
- [x] Página `/rastrear/:orderId` — mapa para cliente ver motoboy em rota
- [x] Integração no painel admin: dropdown de motoboy ao mudar status para out_for_delivery
- [x] Mapa no painel admin mostrando todos os motoboys ativos

## v3.6 - Avaliação de Entrega e Perfil do Motoboy
- [x] Tabela `delivery_ratings` no schema (orderId, driverId, userId, rating 1-5, comment, createdAt)
- [x] Procedures tRPC: submitRating, getRatingByOrder, getDriverRatings
- [x] Seção de avaliação na aba Pedidos do Minha Conta (aparece após status "delivered")
- [x] Estrelas interativas (1-5) + campo de comentário opcional
- [x] Página /motoboy/perfil com histórico de entregas e avaliações recebidas
- [x] Estatísticas do motoboy: total entregas, média de avaliação, avaliações recentes

## v4.0 - Melhorias do Painel do Cliente
- [x] Tabela `user_addresses` para múltiplos endereços
- [x] Tabela `favorites` para produtos favoritos
- [x] Tabela `loyalty_points` para programa de fidelidade
- [x] Tabela `notifications` para notificações in-app
- [x] Campo `avatarUrl` na tabela `users`
- [x] Procedures tRPC: endereços, favoritos, fidelidade, notificações, foto de perfil
- [x] Dashboard de boas-vindas com resumo (último pedido, cupons, pontos)
- [x] Badge vermelho na aba Pedidos quando houver pedido ativo
- [x] Barra de progresso visual de status dentro do card do pedido
- [x] Botão "Pedir novamente" em pedidos entregues
- [x] Programa de fidelidade com contador de pontos e barra de progresso
- [x] Histórico de gastos com gráfico mensal
- [x] Múltiplos endereços salvos (Casa, Trabalho, etc.)
- [x] Favoritos: marcar produtos no cardápio
- [x] Upload de foto de perfil
- [x] Central de notificações in-app

## v4.1 - Chat Cliente ↔ Restaurante
- [x] Tabela `order_messages` no schema (orderId, userId, senderRole, message, createdAt, readAt)
- [x] Procedures tRPC: sendMessage, getMessages, markRead, unreadCount, totalUnread
- [x] Chat do cliente na aba Pedidos do Minha Conta (pedidos em aberto)
- [x] Chat do restaurante no painel Admin → aba Pedidos (modo inline com header vermelho)
- [x] Polling automático a cada 5s para novas mensagens quando chat aberto
- [x] Badge de mensagem não lida no nav do cliente (Navbar) e no admin (chat inline)

## v5.0 - Melhoria Visual Admin: Dashboard e Pedidos

### Dashboard
- [x] Cards de métricas redesenhados com ícones coloridos, valor em destaque e comparativo (hoje vs ontem)
- [x] Gráfico de barras de receita dos últimos 7 dias (recharts, barra do dia de maior receita em vermelho)
- [x] Seção "Pedidos em Andamento" com contadores visuais por status (amarelo/azul/laranja/roxo)
- [x] Lista de Pedidos Recentes com tempo decorrido, badge de status e layout side-by-side com o gráfico
- [x] Data do dia no header do Dashboard

### Aba Pedidos
- [x] Filtros por status com contadores em chips coloridos (Todos 11 / Aguardando 2 / etc.)
- [x] Campo de busca por nome, telefone ou número do pedido
- [x] Cards de pedido redesenhados: layout grid com ícones, borda lateral vermelha nos ativos
- [x] Indicador visual de tempo decorrido (ex: "⏱ há 9h 45min", vermelho quando > 30min)
- [x] Botões de ação com ícones e separador visual, cancelar com ícone XCircle

## v5.1 - Aba Pedidos: Layout Kanban
- [x] Substituir lista de cards grandes por layout Kanban com colunas por status
- [x] Cards compactos: número do pedido, cliente, total, tempo decorrido e badge de mensagem
- [x] Colunas: Aguardando / Confirmado / Preparando / Na Entrega / Entregue
- [x] Modal de detalhes do pedido ao clicar no card (itens, endereço, chat, ações de status)
- [x] Busca por nome/telefone/número funcionando no kanban

## v5.2 - Kanban: Coluna Cancelado
- [x] Adicionar coluna "Cancelado" no Kanban (cinza, oculta por padrão)
- [x] Botão toggle "Mostrar/Ocultar Cancelados" no header da aba Pedidos com contador

## v5.3 - Alerta de Novo Pedido no Admin
- [x] Hook useNewOrderAlert: detectar novo pedido comparando IDs anteriores vs atuais
- [x] Som 'ding' via Web Audio API (dois dings com harmônicos, sem arquivo externo)
- [x] Título da aba pisca alternando entre "🔔 Novo Pedido!" e o título original
- [x] Parar alerta ao clicar em qualquer lugar ou ao clicar na aba Pedidos
- [x] Badge pulsante vermelho na aba Pedidos mostrando quantidade de pedidos aguardando

## v6.0 - Web Push Notifications (VAPID)
- [x] Instalar web-push e gerar chaves VAPID
- [x] Tabela push_subscriptions no schema (userId, endpoint, keys, createdAt)
- [x] Procedures tRPC: push.subscribe, push.unsubscribe, push.vapidPublicKey
- [x] Service Worker (sw.js) com handler de push e notificationclick
- [x] Hook usePushNotifications: pedir permissão, registrar/remover subscription
- [x] Botão "Ativar Push" no header do Admin (Bell/BellOff)
- [x] Disparar push para admins quando novo pedido chegar
- [x] Disparar push para o cliente quando status do pedido mudar

## v6.1 - WhatsApp Notifications (Z-API + Twilio)
- [x] Módulo server/whatsapp.ts com interface WhatsAppProvider (send)
- [x] Implementação Z-API (ZAPI_INSTANCE_ID + ZAPI_TOKEN + ZAPI_CLIENT_TOKEN)
- [x] Implementação Twilio (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM)
- [x] Variável WHATSAPP_PROVIDER (zapi | twilio | none) para alternar
- [x] Templates: orderConfirmed, orderPreparing, orderOutForDelivery, orderDelivered, orderCancelled
- [x] Disparar WhatsApp ao cliente em cada mudança de status do pedido
- [x] Configuração do provider via variáveis de ambiente (WHATSAPP_PROVIDER, ZAPI_INSTANCE_ID, ZAPI_TOKEN)

## v7.0 - Marketing Automation (Jornadas + Tags + Carrinho Abandonado)

### Schema & DB
- [x] Tabela `customer_tags` (userId, tag: novo|recorrente|indeciso|inativo_15|inativo_30|inativo_60, assignedAt)
- [x] Tabela `abandoned_carts` (userId, customerName, customerPhone, items JSON, total, createdAt, recoveredAt, status)
- [x] Tabela `journeys` (id, name, trigger, status: active|paused|draft, steps JSON, createdAt)
- [x] Tabela `journey_executions` (id, journeyId, userId, phone, status, currentStep, startedAt, completedAt, metadata JSON)

### Backend
- [x] Job de tags automáticas: rodar a cada hora, calcular tags por histórico de pedidos
- [x] Procedure automations.listTags / getCustomerTags
- [x] Procedure automations.listJourneys / createJourney / updateJourney / deleteJourney / toggleJourney
- [x] Procedure automations.listExecutions / cancelExecution
- [x] Motor de execução de jornadas: processar etapas com delay, condições e ações (sendWhatsApp, sendPush, addTag, wait)
- [x] Trigger de carrinho abandonado: registrar quando cliente chega no checkout e não finaliza
- [x] Recuperação de carrinho: 1ª mensagem em 15min, se não comprou manda 2ª em 25min com link

### Frontend (Admin → /automacoes)
- [x] Página de Automações com 4 abas: Jornadas, Tags de Clientes, Carrinho Abandonado, Execuções
- [x] Lista de jornadas com status (ativo/pausado/rascunho), trigger, botões de editar/pausar/excluir
- [x] Construtor de jornadas: editor sequencial de etapas (Aguardar, WhatsApp, Push, Condição, +Tag, -Tag)
- [x] Aba Tags: cards por tipo de tag com contagem + lista de clientes tagueados
- [x] Aba Carrinho Abandonado: lista com status (pendente/recuperado/expirado) e valor
- [x] Aba Execuções: histórico de execuções por jornada com status e ícones
- [x] Botão "Automações" no header do Admin (aba Zap)

### Jornadas Pré-prontas (seed)
- [x] "Boas-vindas" — trigger: primeiro pedido → aguarda 30min → WhatsApp de boas-vindas
- [x] "Carrinho Abandonado" — trigger: checkout_abandoned → 15min → WhatsApp + Push → se não comprou → 25min → WhatsApp com link
- [x] "Reativação 15 dias" — trigger: tag inativo_15 → WhatsApp "Sentimos sua falta"
- [x] "Reativação 30 dias" — trigger: tag inativo_30 → WhatsApp com cupom especial
- [x] "Reativação 60 dias" — trigger: tag inativo_60 → WhatsApp + Push última tentativa
- [x] "Promoção Semanal" — trigger: manual → WhatsApp/Push para todos os clientes

## v7.1 - PWA Install Banner (iOS)
- [x] Componente PWAInstallBanner: detectar iOS sem PWA instalado e exibir instruções
- [x] Instruções passo a passo: "Toque em Compartilhar → Adicionar à Tela de Início"
- [x] Integrar banner na aba Avisos do MinhaConta (onde o botão de push está)
- [x] manifest.json com nome, ícone e display: standalone para suporte PWA
- [x] Tags PWA no index.html: manifest, theme-color, apple-mobile-web-app-capable, apple-touch-icon

## v8.0 - CRM de Clientes + Automações Funcionais
- [x] Corrigir motor de tags automáticas (cálculo correto por histórico de pedidos)
- [x] Procedure crm.listCustomers: lista todos os clientes com tags, pedidos, total gasto
- [x] Procedure crm.getCustomerDetail: detalhes completos de um cliente
- [x] Procedure crm.assignTag / removeTag: atribuir/remover tag manualmente
- [x] Procedure crm.getStats: estatísticas por tag
- [x] Procedure crm.triggerJourneyForTag: disparar jornada para segmento por tag
- [x] Página /crm: tabela de clientes com filtro por tag, busca, total gasto, último pedido
- [x] Detalhe do cliente: histórico de pedidos, tags, carrinhos abandonados, execuções de jornada
- [x] Botão "Disparar jornada para segmento" no CRM e na aba Tags do Automações
- [x] Aba Tags na página Automações: botão de disparar jornada por segmento
- [x] Aba Carrinhos Abandonados: lista funcional com status e valor
- [x] Aba Execuções: histórico real de execuções por jornada
- [x] Link para CRM no header do Admin (botão Users)

## v8.1 - Templates de Notificação Variados

- [x] Tabela `notification_templates` (id, event, channel: push|whatsapp|both, title, body, isActive, createdAt)
- [x] Seed com 3+ variações por status (confirmed, preparing, out_for_delivery, delivered, cancelled) para push e whatsapp
- [x] Procedure templates.list / create / update / delete / toggleActive
- [x] Função pickRandomTemplate(event, channel): sorteia template ativo aleatoriamente
- [x] Integrar pickRandomTemplate no disparo de Push (substituir textos fixos)
- [x] Integrar pickRandomTemplate no disparo de WhatsApp (substituir textos fixos)
- [x] Página /notificacoes: lista de templates agrupados por status com CRUD
- [x] Suporte a variáveis: {{clientName}}, {{orderId}}, {{total}} interpolados no template
- [x] Link "Notificações" no header do Admin

## v8.2 - Notificações Personalizadas com Redirecionamento

- [x] Adicionar campo redirectUrl (text, nullable) na tabela notification_templates
- [x] Adicionar evento "custom" no enum event da tabela
- [x] Procedure notificationTemplates.sendCustom: dispara push para todos ou por tag com título, body e redirectUrl
- [x] Função sendPushToAllUsers: disparo em massa com filtro opcional por userId
- [x] Formulário de disparo na página /notificacoes: título, mensagem, URL de destino (com atalhos para telas), segmento (todos / por tag)
- [x] Atalhos de destino: Início, Cardápio, Promoções, Minha Conta, Sorteios, URL personalizada
- [x] Campo redirectUrl no formulário de criação/edição de templates (atalhos + URL livre)
- [x] Badge de destino exibido em cada template card

## v9.0 - Prefixos + Zonas de Entrega por Bairro

- [x] Corrigir campo de prefixos no Admin (useEffect em vez de setState no render)
- [x] Tabela `delivery_zones` (id, neighborhood, city, deliveryFee, estimatedMinutes, isActive)
- [x] Procedures tRPC: deliveryZones.list, create, update, delete, search, getByNeighborhood
- [x] Página /zonas-entrega: CRUD de zonas por bairro com valor fixo e tempo estimado
- [x] Checkout: campo de bairro com autocomplete e sugestões em tempo real
- [x] Checkout: card verde com taxa de entrega e tempo estimado ao selecionar bairro
- [x] Checkout: bloquear pedido se bairro não cadastrado (mensagem amigável)
- [x] Checkout: taxa de entrega integrada no total do pedido
- [x] Backend: deliveryFeeOverride no input de orders.create
- [x] Botão Zonas no header do Admin

## v9.1 - Capa do Cardápio + Edição no Admin

- [x] Redesenhar header do cardápio: fundo vermelho escuro + preto com grid de grade SVG
- [x] Logo centralizada com efeito de destaque (glow/sombra) na capa do cardápio
- [x] Altura da capa: ~220px com gradiente e grid sobreposto
- [x] Adicionar aba "Cardápio" no painel Admin com CRUD de produtos e categorias
- [x] Edição inline de produto: nome, preço, descrição, imagem, categoria, destaque, ativo
- [x] Toggle ativo/inativo inline nos produtos e categorias
- [x] Sub-abas Produtos / Categorias com contadores
- [x] Imagem do produto exibida na tabela de produtos
- [x] Botão "Novo Produto" e "Nova Categoria" no Admin

## v9.2 - Slider de Promoções na Capa do Cardápio

- [x] Tabela `menu_slides` (id, title, subtitle, imageUrl, badgeText, ctaText, ctaLink, sortOrder, isActive, createdAt)
- [x] Procedures tRPC: menuSlides.list (público), menuSlides.listAll, create, update, delete, seed
- [x] Capa do cardápio: logo fixa no topo (círculo com glow), slider de slides abaixo com auto-play
- [x] Slider: transição suave, indicadores de ponto, setas de navegação
- [x] Seed com 3 slides padrão (promoções da Bonatto Pizza)
- [x] Admin → aba Cardápio → sub-aba "Slides": CRUD de slides com preview
- [x] Campo de imagem, título, subtítulo, badge, CTA e link em cada slide
- [x] Toggle ativo/inativo por slide

## v10.0 - Reformulação do Cardápio (UX/Conversão)
- [x] Remover slider de promoções e logo flutuante da capa do cardápio (já removidos)
- [x] Remover sub-aba "Slides" do painel Admin (já removida do JSX)
- [x] Nova header sticky do cardápio: logo + nome + status (Aberto/Fechado) + lupa + badge carrinho
- [x] Header com fundo transparente → preto sólido com sombra ao rolar
- [x] Lupa na header expande campo de busca inline ao clicar
- [x] Badge vermelho com contador de itens no ícone do carrinho
- [x] Faixa de tempo de entrega abaixo da header
- [x] Banner de "loja fechada" mais discreto (faixa fina escura)
- [x] Cards de produto com imagem no topo (estilo iFood)
- [x] Badges visuais nos produtos: Mais Pedido, Destaque, Novo
- [x] Preço original riscado nos produtos com preço promocional
- [x] Barra de categorias sticky ao rolar
- [x] Scroll suave por âncora ao clicar em categoria
- [x] Botão flutuante de carrinho no rodapé ao adicionar primeiro item

## v11.0 - Clube do Bonatto (Assinatura Mensal via PIX)

### Schema & Banco
- [x] Adicionar campos clubPlan, clubStatus, clubStartDate, clubNextBillingDate, clubFreePizzaUsed, clubFreePizzaResetAt na tabela users
- [x] Criar tabela clubPayments (id, userId, plan, amount, pixCode, pixQrCode, status, paidAt, createdAt)
- [x] Executar pnpm db:push

### Backend
- [x] Procedure club.getPlans (público — retorna planos com preços e benefícios)
- [x] Procedure club.subscribe (gera PIX copia-e-cola + QR Code, cria clubPayment pendente)
- [x] Procedure club.confirmPayment (admin confirma pagamento PIX, ativa plano)
- [x] Procedure club.getMyPlan (usuário logado — retorna plano ativo, benefícios, datas)
- [x] Procedure club.cancelSubscription
- [x] Procedure club.useFreePizza (marca pizza grátis como usada no mês)
- [x] Procedure club.getMembers (admin — lista membros com status e plano)
- [x] Procedure club.sendPromotion (admin — dispara WhatsApp para todos os membros)
- [x] Aplicar desconto do clube no procedure orders.create (20% Bonattão / 15% Básico)
- [x] Aplicar frete grátis para membros Bonattão no procedure orders.create

### Frontend
- [x] Card promocional na Home para usuários não-membros
- [x] Card promocional no Cardápio para usuários não-membros
- [x] Página /clube: comparativo visual dos dois planos
- [x] Fluxo de assinatura: seleção de plano → geração de PIX → QR Code + copia-e-cola
- [x] Dashboard do membro na página /clube (plano ativo, pizza grátis, data de renovação)
- [x] Desconto automático exibido no Checkout para membros
- [x] Frete grátis exibido no Checkout para membros Bonattão
- [x] Notificação de pizza grátis disponível no Checkout

### Admin CRM
- [x] Aba "Clube do Bonatto" no CRM com lista de membros separada
- [x] Etiqueta "Clube do Bonatto" em cada perfil de membro
- [x] Botão "Confirmar Pagamento PIX" para pagamentos pendentes
- [x] Botão "Enviar Promoção" com modal para digitar mensagem e disparar via WhatsApp

## v11.1 - Clube do Bonatto na Minha Conta

- [x] Aba "Clube" na página /minha-conta mostrando plano ativo, benefícios, datas e pizza grátis
- [x] Se não for membro: card de convite com CTA para /clube

## v11.2 - Correção Dashboard e Relatórios

- [x] Investigar e corrigir erros no Dashboard do Admin
- [x] Investigar e corrigir erros na página de Relatórios do Admin

## v8.1 - Correção e Melhoria da Aba Automações

- [x] Corrigir engine de execução: processJourneyExecutions nunca era chamado (sem job periódico)
- [x] Adicionar jobs periódicos no servidor: journey execution (2min), abandoned carts (5min), customer tags (60min)
- [x] Corrigir add_tag/remove_tag: suporte a custom tags por ID além de system tags por nome
- [x] Corrigir refreshCustomerTags para disparar triggers de inatividade (tag_inativo_15/30/60)
- [x] Adicionar procedure processExecutions para disparar manualmente o job de execução
- [x] Adicionar procedure getExecutionLogs para visualizar logs de uma execução
- [x] Melhorar listJourneys para retornar execCount e lastRunAt
- [x] Corrigir FlowEditor: estado local localStatus para atualizar badge/botao apos toggle
- [x] Corrigir plural de execucao/execucoes na lista de jornadas
- [x] Criar testes vitest para o router de automacoes (9 testes, todos passando)
- [x] Validar fluxo completo: criar jornada, adicionar no WhatsApp, salvar, ativar, executar, ver logs

## v12.0 - Integração Stripe Checkout (Cartão + Pix Online)
- [x] Criar procedure payments.createCheckoutSession (Stripe Checkout com cartão + Pix)
- [x] Atualizar webhook Stripe: ao pagar, confirmar pedido (status confirmed → preparing) e notificar admin
- [x] Atualizar Checkout.tsx: ao selecionar cartão/pix online, redirecionar para Stripe Checkout
- [x] Criar página /pagamento/sucesso para retorno do Stripe (confirmar pedido na UI)
- [x] Criar página /pagamento/cancelado para retorno do Stripe (mensagem amigável)
- [x] Adicionar procedure payments.getMyTransactions para histórico de pagamentos do cliente
- [x] Exibir histórico de pagamentos na aba Minha Conta

## v10.1 - Agendamento de Notificações Personalizadas
- [x] Tabela `scheduled_notifications` no schema (título, mensagem, scheduledAt, recorrência, público-alvo, status, createdBy)
- [x] Procedure tRPC: criar notificação agendada (admin)
- [x] Procedure tRPC: listar notificações agendadas (admin)
- [x] Procedure tRPC: cancelar/excluir notificação agendada (admin)
- [x] UI: formulário de agendamento (título, mensagem, data/hora, recorrência: única/diária/semanal, público-alvo: todos/clientes ativos/inativos)
- [x] UI: lista de notificações agendadas com status (pendente/enviada/cancelada) e botão de cancelar
- [x] Job de disparo: verificar e enviar notificações agendadas pendentes (polling server-side, 1min)

## v9.1 - Notificações Agendadas

- [x] Tabela `scheduled_notifications` no schema (id, title, message, channel, targetAudience, scheduledAt, recurrence, status, sentCount, sentAt, createdBy, createdAt)
- [x] Migrar schema com pnpm db:push
- [x] Funções db.ts: createScheduledNotification, listScheduledNotifications, cancelScheduledNotification, deleteScheduledNotification, getPendingScheduledNotifications, markScheduledNotificationSent
- [x] Procedures tRPC: notifications.scheduleCreate, scheduleList, scheduleCancel, scheduleDelete
- [x] UI: Card "Notificações Agendadas" com botão "Agendar" na página /notificacoes
- [x] UI: ScheduleFormDialog com campos: título, mensagem, canal, público-alvo, data, hora, recorrência
- [x] UI: Lista de agendamentos com status, badges e botões de cancelar/remover

## v10.2 - Segmentação por Bairro nas Notificações Agendadas

- [x] Adicionar campo `neighborhoodFilter` (text, nullable) na tabela `scheduled_notifications`
- [x] Migrar schema com pnpm db:push
- [x] Atualizar procedure `notifications.scheduleCreate` para aceitar `neighborhoodFilter` opcional
- [x] Atualizar função `getUserIdsBySegment` no job para filtrar por bairro via histórico de pedidos
- [x] Frontend: seleção múltipla de bairro no formulário de agendamento (busca + checkboxes das zonas de entrega)
- [x] Frontend: exibir badge de bairro na lista de notificações agendadas

## v10.3 - Popup de Engajamento na Home (10% de Desconto)
- [x] Backend: procedure pública `coupons.getHomePopupCoupon` — cria/retorna cupom BONATTO10 (10% off, usos ilimitados)
- [x] Frontend: componente `HomePopup.tsx` com timer de 60s antes de aparecer
- [x] Frontend: exibição única por sessão (sessionStorage flag `bonatto_popup_shown`)
- [x] Frontend: copy persuasiva com urgência, benefício claro e CTA
- [x] Frontend: campo de código do cupom copiável com botão "Copiar"
- [x] Frontend: botão CTA "Pedir Agora com 10% OFF" → redireciona para /cardapio
- [x] Frontend: fechar popup não mostra novamente na sessão
- [x] Frontend: integrar HomePopup na página Home.tsx

## v11.0 - Painel de Visão Geral de Vendas (estilo Hotmart)
- [x] Backend: procedure `analytics.salesOverview` — KPIs (total vendas, nº pedidos, ticket médio, comparativo período anterior) com filtro de período
- [x] Backend: procedure `analytics.salesTimeSeries` — série temporal diária/semanal para o gráfico de linha
- [x] Backend: procedure `analytics.recentOrders` — feed dos últimos pedidos em tempo real (polling 30s)
- [x] Frontend: página `/vendas` acessível apenas para admin
- [x] Frontend: seletor de período (Hoje, 7 dias, 30 dias, 3 meses, Personalizado com date picker)
- [x] Frontend: 4 KPI cards (Total Vendas, Nº Pedidos, Ticket Médio, Pedidos Hoje)
- [x] Frontend: gráfico de área de vendas diárias (Recharts)
- [x] Frontend: feed de pedidos recentes com polling automático (30s)
- [x] Frontend: link "Painel de Vendas" no menu Ferramentas do Admin

## v11.1 - PWA do Painel de Vendas (App na Tela Inicial)
- [x] manifest.json com start_url=/app, display=standalone, theme_color vermelho Bonatto, ícones 192x192 e 512x512
- [x] Service worker já existente no projeto (sw.js)
- [x] Rota /app dedicada: painel de vendas em modo fullscreen sem navbar, sem menu lateral
- [x] Detecção de modo standalone: padding-top com safe-area-inset para iOS
- [x] Auto-login: se já tiver sessão ativa, entrar direto no painel; se não, tela de login inline
- [x] Banner "Adicionar à Tela Inicial" na página /vendas com botão "Abrir App"
- [x] Campo todayOrders e todayRevenue adicionados ao getSalesOverview

## v12.0 - Redesign da Home (Estilo Fast Food Premium)
- [x] Hero: fundo vermelho bordô, headline grande à esquerda, pizza artesanal gerada por IA à direita, botão CTA animado
- [x] 3 cards de categoria com imagem em destaque (Pizzas, Calzones, Bebidas)
- [x] Seção de entrega com motoboy Bonatto gerado por IA + lista de diferenciais
- [x] Manter cores atuais do projeto (#6E0D12 bordô, branco)

## v13.0 - Chat com IA + Avatares + Horário Dinâmico + Push Marketing
- [x] Frontend: horário de funcionamento lê do banco (storeSettings.storeHours) em vez de hardcoded em storeUtils.ts
- [x] Frontend: StoreClosedBanner exibe horários do banco dinamicamente
- [x] Frontend: Cardápio exibe horários do banco no badge Aberto/Fechado
- [x] Frontend: chat OrderChat com avatar do cliente (foto OAuth) e logo Bonatto
- [x] Backend: procedure push.sendCampaign já existia (sendCustom no notificationTemplates)
- [x] Frontend: tela de campanha push já existia no admin (NotificationTemplates)
- [x] Backend: procedure chat.requestHuman para pausar IA e notificar admin
- [x] Frontend: modo atendente humano no chat (botão "Falar com atendente" pausa IA, admin recebe push)

## v13.1 - IA com Horário Dinâmico
- [x] Prompt da IA usa horários reais do banco (buildHoursDescription) em vez de hardcoded
- [x] Prompt da IA usa WhatsApp real do banco em vez de hardcoded
- [x] Formulário de horários no admin já existia e funciona corretamente

## v14.0 - Aba Mensagens no Admin
- [x] Procedure chat.ordersWithMessages: lista pedidos com mensagens + contagem de não lidas
- [x] Aba "Mensagens" adicionada ao painel admin (grupo Operação)
- [x] Badge animado na sidebar com contagem de mensagens não lidas (atualiza a cada 15s)
- [x] Layout duas colunas: lista de conversas à esquerda + chat inline à direita
- [x] Badge "Humano" nas conversas com aiPaused=true
- [x] Polling automático da lista a cada 10s

## Paginação JoinedPagination (OriginUI)
- [x] Criar hook use-pagination em client/src/hooks/use-pagination.ts
- [x] Criar componente joined-pagination.tsx em client/src/components/ui/
- [x] Aplicar JoinedPagination na lista de produtos do admin (MenuTab)
- [x] Aplicar JoinedPagination na lista de clientes do CRM
- [x] Verificar TypeScript 0 erros

## Redesign Visual do Painel Admin (Identidade Bonatto)
- [x] Dashboard: cards de KPI com ícones coloridos bordô, títulos Poppins, gradiente no header
- [x] Dashboard: seção "Pedidos em Andamento" com badges bordô e fundo creme
- [x] Dashboard: gráfico de receita com cor primária bordô
- [x] Aba Pedidos (Kanban): ajustar tipografia e botões para padrão Bonatto
- [x] Aba Mensagens: header com gradiente bordô, cards de conversa com estilo Bonatto
- [x] Aba Cardápio: tabela de produtos com header bordô, botões alinhados
- [x] Aba Cupons: formulário e lista com visual Bonatto
- [x] Aba Configurações: seções com cards e tipografia Bonatto
- [x] CRM: header, cards e tabela com identidade Bonatto
- [x] VendasDashboard: cores e tipografia alinhadas
- [x] Automações: visual alinhado com identidade Bonatto
- [x] Verificar TypeScript 0 erros após redesign

## v15.0 - Melhorias Completas da Página do Motoboy
### Backend
- [x] Schema: tabela driver_push_subscriptions (driverId, endpoint, p256dh, auth, userAgent)
- [x] DB: saveDriverPushSubscription, removeDriverPushSubscription, sendPushToDriver
- [x] DB: getDriverTodayStats (entregas do dia, ganhos, avaliação média)
- [x] DB: getMyActiveOrderDetails (endereço, cliente, itens do pedido ativo)
- [x] Router: drivers.confirmDelivery (motoboy confirma entrega → status=delivered + push cliente)
- [x] Router: drivers.todayStats (dashboard do dia)
- [x] Router: drivers.activeOrderDetails (detalhes do pedido ativo para navegação)
- [x] Router: drivers.savePushSubscription (salvar sub push do motoboy)
- [x] Router: drivers.removePushSubscription (remover sub push do motoboy)
- [x] Push: sendPushToDriver (enviar notificação para motoboy específico)
- [x] Push: notificar motoboy quando admin atribui pedido a ele
### Frontend
- [x] DriverApp: redesign visual Bonatto (fundo escuro premium, tipografia Poppins)
- [x] DriverApp: botão GPS grande (h-20, área de toque 56px+)
- [x] DriverApp: indicador GPS pulsante verde/vermelho
- [x] DriverApp: navigator.wakeLock para manter tela ativa
- [x] DriverApp: navigator.vibrate ao confirmar entrega
- [x] DriverApp: dashboard do dia (entregas, avaliação, ganhos)
- [x] DriverApp: card do pedido ativo com endereço completo e cliente
- [x] DriverApp: botões "Abrir no Maps" e "Abrir no Waze" com coordenadas
- [x] DriverApp: botão "Confirmar Entrega" (grande, verde)
- [x] DriverApp: histórico de entregas do dia na aba inferior
- [x] DriverApp: push subscription para receber notificações de novos pedidos
- [x] DriverApp: link para /motoboy/perfil/:id
- [x] DriverProfile: link de volta para /motoboy

## v16.0 - Notificações Push para Motoboy
- [x] Backend: chamar sendPushToDriver em drivers.assignDriver (pedido atribuído)
- [x] Backend: chamar sendPushToDriver em orders.sendMessage quando sender=admin (mensagem do restaurante)
- [x] Backend: chamar sendPushToDriver em drivers.unassignDriver (pedido removido)
- [x] Service Worker: tratar eventos push com tag "driver-order" e "driver-message"
- [x] Service Worker: ação "Ver Pedido" abre /motoboy ao clicar na notificação
- [x] DriverApp: feedback visual quando push subscription falhar (permissão negada)
- [x] DriverApp: botão manual "Ativar Notificações" se permissão ainda não concedida
- [x] TypeScript 0 erros
- [x] Testes 25/25 passando

## v17.0 - Acesso ao App do Motoboy na Home
- [x] Adicionar card/botão "App do Motoboy" na Home com link para /motoboy
- [x] Garantir que /motoboy abre direto no DriverApp (sem redirect ou loading extra)
- [x] Checkpoint salvo

## v18.0 - PWA Dedicado para o Motoboy
- [x] Criar /motoboy-manifest.json com nome "Bonatto Motoboy", start_url /motoboy, display standalone
- [x] Fazer upload dos ícones PWA do motoboy (192x192 e 512x512)
- [x] Injetar <link rel="manifest"> e meta tags PWA dinamicamente na rota /motoboy via useEffect
- [x] Banner de instalação no DriverApp: Android (beforeinstallprompt) + instruções iOS
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v18.1 - Correção PWA Motoboy (start_url real)
- [x] Express: rota GET /motoboy serve HTML com <link rel="manifest" href="/driver-manifest.json"> injetado
- [x] Express: rota GET /motoboy/perfil/* também serve o HTML com manifest do motoboy
- [x] Remover troca dinâmica de manifest do hook useDriverPWA (não necessária com SSR)
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v19.0 - Correção Rastreamento GPS em Tempo Real

- [x] Investigar por que coordenadas GPS do motoboy não chegam ao banco de dados
- [x] Corrigir envio de updateLocation no DriverApp (garantir que mutation é chamada ao mover)
- [x] Verificar procedure drivers.updateLocation no backend
- [x] Verificar leitura de localização no TrackDelivery (app do cliente)
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v20.0 - Push pós-entrega para o cliente

- [x] Backend: chamar sendPushToUser(userId) em drivers.confirmDelivery com título "Pedido entregue!" e link para avaliação
- [x] Backend: criar notificação no banco (createClientNotification) para o cliente ao confirmar entrega
- [x] Service Worker: tratar tag "delivery-confirmed" — clique abre /minha-conta com scroll até o pedido
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v21.0 - Correção bug aba "Hoje" no DriverApp

- [x] Investigar getDriverTodayDeliveries no server/db.ts (filtro de data, campo deliveredAt)
- [x] Investigar procedure drivers.todayDeliveries no server/routers.ts
- [x] Verificar renderização da aba "Hoje" no client/src/pages/DriverApp.tsx
- [x] Corrigir a query/procedure/componente conforme necessário
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v22.0 - Estimativa de tempo de entrega no TrackOrder

- [x] Ler TrackOrder.tsx e entender estrutura atual (mapa, localização do motoboy, endereço destino)
- [x] Usar Google Directions API (frontend SDK via Map.tsx) para calcular rota motoboy → cliente
- [x] Exibir card com "~X min para chegar" e distância restante acima do mapa
- [x] Atualizar estimativa a cada 30s conforme motoboy se move
- [x] Mostrar skeleton/loading enquanto calcula e "—" se GPS indisponível
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v23.0 - Redesign visual da tela de rastreamento TrackOrder

- [x] Header com gradiente bordô + logo Bonatto + nome do motoboy em destaque
- [x] Mapa ocupa toda a altura disponível (flex-1, sem área preta)
- [x] Card ETA flutuante sobre o mapa (overlay) com blur + bordô, corrigir bug do throttle
- [x] Rodapé compacto e elegante com endereço, badge "Em rota" e botão de chat
- [x] Overlay "sem rastreamento" redesenhado com identidade Bonatto
- [x] TypeScript 0 erros
- [x] Checkpoint salvo

## v25.0 - Índices de banco de dados
- [x] Adicionar índices em orders (userId, status, driverId, createdAt)
- [x] Adicionar índices em order_items (orderId, productId)
- [x] Adicionar índices em driver_locations (driverId, updatedAt)
- [x] Adicionar índices em delivery_ratings (driverId, orderId)
- [x] Adicionar índices em user_addresses (userId)
- [x] Adicionar índices em favorites (userId, productId)
- [x] Adicionar índices em client_notifications (userId, createdAt)
- [x] Adicionar índices em order_messages (orderId, createdAt)
- [x] Adicionar índices em custom_customer_tags (userId, tagId)
- [x] Adicionar índices em journey_executions (journeyId, status, nextStepAt)
- [x] Adicionar índices em abandoned_carts (status, expiresAt)
- [x] Adicionar índices em scheduled_notifications (scheduledAt, status)
- [x] Executar pnpm db:push para migrar

## v26.0 - Scroll reveal + fix blur rodapé
- [x] Remover blur/filter do rodapé (Footer)
- [x] Criar hook useScrollReveal com IntersectionObserver
- [x] Aplicar scroll reveal com blur nos elementos da Home

## v27.0 - Multi-tenant (múltiplas unidades)

- [x] Criar tabela `stores` no schema (id, name, city, address, phone, active, slug)
- [x] Adicionar `storeId` nas tabelas: orders, products, drivers, transactions, club_payments, coupons
- [x] Adicionar role `manager` no enum de roles dos users
- [x] Criar tabela `store_managers` (storeId, userId) para associar gerentes a lojas
- [x] Executar migração pnpm db:push
- [x] Seed: criar loja padrão "Mateus Leme" e migrar dados existentes para ela
- [x] Backend: procedures stores CRUD (admin) e stores.list (público)
- [x] Backend: filtrar orders, products, drivers por storeId
- [x] Backend: adminProcedure verifica owner (vê tudo) ou manager (vê só sua loja)
- [x] Frontend: modal de seleção de cidade na Home (persiste em localStorage)
- [x] Frontend: painel Admin - aba "Lojas" para CRUD de unidades e gerentes
- [x] Frontend: painel Admin - filtro por loja nos relatórios e pedidos
- [x] Frontend: cardápio e checkout filtrados pela loja selecionada

## v30.0 - Isolamento total por loja no admin
- [x] Backend: filtrar orders.list por storeId (admin vê todas, manager vê só a sua)
- [x] Backend: filtrar drivers.list por storeId
- [x] Backend: filtrar products/categories por storeId
- [x] Backend: filtrar dashboard stats por storeId
- [x] Backend: filtrar reports por storeId
- [x] Backend: filtrar CRM/users por storeId (clientes que pediram na loja)
- [x] Backend: filtrar coupons por storeId
- [x] Frontend: AdminStoreContext — seletor global de loja no header do admin
- [x] Frontend: admin vê seletor "Todas as lojas" + lojas individuais
- [x] Frontend: manager vê apenas sua loja (sem seletor)
- [x] Frontend: todas as abas usam o storeId selecionado como filtro
- [x] TypeScript 0 erros
- [x] Testes passando

## v31.0 - Redesign StoresTab e gerentes
- [x] Redesign aba Lojas com identidade visual Bonatto (fundo branco/bordô, texto visível)
- [x] Adicionar botão de editar em cada card de loja
- [x] Adicionar campo de gerentes no modal de edição (buscar usuário por e-mail)
- [x] Corrigir botão Admin no Navbar para aparecer também para managers

## v32.0 - Fix manager role errors

- [x] Backend: converter adminProcedure → staffProcedure (categories.listAll, products.listAll, coupons.list, orders.list, drivers.allLocations, storeSettings.getAdmin, notificationTemplates.*, deliveryZones.*)
- [x] Frontend: mover guard de navegação para useEffect em VendasDashboard.tsx
- [x] Frontend: mover guard de navegação para useEffect em DeliveryZones.tsx
- [x] Frontend: mover guard de navegação para useEffect em NotificationTemplates.tsx
- [x] Atualizar guards para aceitar role 'manager' além de 'admin' nos 3 arquivos
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v33.0 - Filtro por loja na aba Relatórios

- [x] Backend: procedures analytics.salesOverview, salesTimeSeries, recentOrders, topProducts aceitam storeId
- [x] Backend: usar resolveStoreId para garantir isolamento manager vs admin
- [x] Backend: converter procedures analytics de adminProcedure para staffProcedure
- [x] Frontend: ReportsTab usa storeId do AdminStoreContext
- [x] Frontend: manager vê badge fixo com nome da sua loja (sem seletor)
- [x] Frontend: admin vê seletor inline de loja na aba Relatórios
- [x] Frontend: VendasDashboard (/vendas) também filtra por loja (manager automático, admin com seletor)
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v34.0 - Fix erros de permissão para managers no painel admin

- [x] Mapear todas as procedures chamadas pelo Admin.tsx que ainda usam adminProcedure
- [x] Converter 25+ procedures para staffProcedure (categories, products, coupons, orders.updateStatus/updatePaymentStatus, storeSettings.save, drivers CRUD, promotions, raffles, upsells, menuSlides, carousel, chat.ordersWithMessages, notifications.scheduleList, adminUsers.list)
- [x] Ocultar aba "Lojas/Unidades" do sidebar para managers
- [x] Adicionar guard enabled:isAdmin no StoresTab para não chamar stores.listAll para managers
- [x] Adicionar guard de loading no AdminStoreContext e VendasDashboard
- [x] Corrigir chat.totalUnread para incluir managers
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v35.0 - Redesign visual do painel admin (identidade Bonatto)

- [x] Sidebar: gradiente bordô escuro (#1a0406 → #2d0609), texto branco
- [x] Sidebar: logo real Bonatto (icon + tipografia) no topo com sombra lateral
- [x] Sidebar: item ativo com gradiente bordô (#9b1520 → #6E0D12) e sombra
- [x] Sidebar: labels de grupo Poppins uppercase opacidade 30%
- [x] Sidebar: hover states com rgba branco 7%
- [x] Mobile topbar: gradiente bordô com logo icon
- [x] Fundo do conteúdo: #f5f0f0 (creme levemente rosado)
- [x] MetricCards: fundo branco, sombra bordô suave, tipografia Poppins, barra inferior colorida
- [x] Dashboard header: título Poppins black bordô, botão btn-bonatto
- [x] Gráfico: barras bordô (#6E0D12) e rosa claro (#e8b4b8), sem Card wrapper
- [x] Card Pedidos Recentes: fundo branco com sombra, itens com tint bordô
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v36.0 - Redesign Admin inspirado na referência Flup

- [x] Sidebar duplo: coluna bordô de ícones (w-16) + painel submenu branco (w-52)
- [x] Fundo: grid de grade sutil rgba(110,13,18,0.04) 32x32px sobre #f8f8fa
- [x] Coluna de ícones: logo icon, ícones de navegação, ferramentas, push/home, avatar
- [x] Submenu branco: logo tipográfica, seletor de loja, nav groups, footer com avatar+nome
- [x] MetricCards: estilo Flup — borda fina, valor grande, badge colorido de variação
- [x] Dashboard header: título Poppins black, botão outline bordô
- [x] Active Orders Pipeline: div com borda fina (sem Card/CardContent)
- [x] Avatar + role do usuário no rodapé do submenu
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v37.0 - Sidebar bordô colapsável

- [x] Remover sidebar branca (submenu separado)
- [x] Sidebar bordô única com estado collapsed/expanded
- [x] Expandida (w-56): ícone + texto + labels de grupo + seletor de loja
- [x] Recolhida (w-16): apenas ícones com tooltip no hover
- [x] Botão de toggle (chevron) no topo da sidebar
- [x] Estado persistido no localStorage (bonatto_admin_sidebar_collapsed)
- [x] Sidebar anima com transition-all duration-300
- [x] Seletor de loja escuro (AdminStoreSelectorSidebarDark) na sidebar bordô
- [x] TypeScript: 0 erros
- [x] Testes: 25/25 passando

## v39.0 - Textos da navbar em branco

- [x] Links de navegação (Início, Cardápio, Clube, Minha Conta) em branco puro (removida opacidade /90)
- [x] Botão Sair: text-white/80 → text-white
- [x] Seletor de cidade: text-white/80 → text-white
- [x] TypeScript: 0 erros

## v41.0 - Corrigir imagens quebradas

- [x] Identificar todas as URLs de imagem quebradas (pizza-1 a pizza-7 com 403 no CDN)
- [x] Re-upload das 7 imagens para storage permanente (/manus-storage/)
- [x] Atualizar URLs no InfinitePhotoCarousel.tsx
- [x] TypeScript: 0 erros

## v42.0 - App motoboy: exibir todos os pedidos atribuídos simultaneamente

- [x] Identificar onde a lógica de "um pedido por vez" está implementada
- [x] Criar função getDriverAssignedOrders no db.ts (retorna todos os pedidos out_for_delivery)
- [x] Criar procedure drivers.assignedOrders no routers.ts
- [x] Corrigir para exibir todos os pedidos atribuídos em lista scrollável
- [x] Motoboy pode escolher qual pedido iniciar primeiro (cards expansíveis)
- [x] Cada card de pedido tem botão de ação independente (confirmar entrega individual)
- [x] Badge com contador de pedidos na aba "Pedidos Ativos"
- [x] TypeScript: 0 erros | Testes: 25/25 passando

## v43.0 - Corrigir todas as imagens CloudFront quebradas

- [x] Identificar todos os arquivos com URLs CloudFront expiradas (8 arquivos, 23 ocorrências)
- [x] Re-upload de todas as imagens para /manus-storage/ permanente (logo, mascote, ícones, pizzas 8-17, banner)
- [x] Navbar.tsx: 4 URLs atualizadas (ícone, logo tipográfica, bg vermelho, palmito circular)
- [x] CitySelectModal.tsx: 2 URLs atualizadas
- [x] Admin.tsx: 2 URLs atualizadas
- [x] DriverApp.tsx: 1 URL atualizada
- [x] DriverProfile.tsx: 1 URL atualizada
- [x] Home.tsx: 2 URLs atualizadas (LOGO_URL + footer)
- [x] BannerCarousel.tsx: 1 URL atualizada (banner-combo)
- [x] InfinitePhotoCarousel.tsx: 10 URLs atualizadas (pizzas 8-17)
- [x] OrderChat.tsx: 1 URL atualizada (avatar Bonatto)
- [x] Cardapio.tsx: 3 URLs atualizadas (logo, banner, palmito)
- [x] Login.tsx: 2 URLs atualizadas (mascote, logo tipográfica)
- [x] MinhaConta.tsx: 1 URL atualizada
- [x] ResetPassword.tsx: 1 URL atualizada
- [x] TypeScript: 0 erros | 0 URLs CloudFront restantes

## v44.0 - Sistema de Recuperação de Receita

- [x] Estender schema: abandonedCarts (orderId, whatsappPhone, currentStep, flowStatus, couponCode, thirdReminderSentAt)
- [x] Estender schema: journeyExecutions (lastMessageAt, convertedAt, conversionOrderId)
- [x] Nova tabela: automationEvents (log de auditoria de envios)
- [x] Rodar pnpm db:push com as migrações
- [x] Criar server/whatsapp.ts (interface desacoplada + MockProvider + ZApi + Twilio)
- [x] Melhorar processAbandonedCarts com 3 etapas (10/20/30min), anti-duplicação e cupom na etapa 3
- [x] Criar processReactivation com segmentos 15/30/60 dias e descontos crescentes
- [x] Criar markConversions integrado ao fluxo de pedido confirmado
- [x] Criar procedures tRPC: recovery.stats, recovery.abandonedCarts, recovery.triggerReactivation
- [x] Criar componente RecoveryTab no Admin com KPIs, performance por etapa e tabela de carrinhos
- [x] Adicionar aba "Recuperação de Receita" no painel Admin
- [x] Escrever testes vitest: 41/41 passando (recovery.test.ts)
- [x] Atualizar skill bonatto-pizza com tudo implementado

## v46.0 - Identidade Visual na Página de Automações
- [x] Ler skill bonatto-pizza-id-visual e mapear componentes
- [x] Reescrever Automacoes.tsx com header bordô gradiente, stats cards, info box, cards de jornada com accent por gatilho
- [x] Reescrever FlowNodes.tsx com nós premium (glow bordô, accent bars, indicadores de status)
- [x] Toolbar do editor com gradiente bordô escuro e paleta de passos estilizada
- [x] Canvas com fundo #080507 e dots bordô sutil
- [x] Edges com cor bordô #6E0D12 e seta animada
- [x] Sheet de edição de nó com tema bordô
- [x] TypeScript: 0 erros

## v50.0 - Visual SaaS Premium Light no Painel Admin Completo

- [x] Criar design tokens CSS compartilhados para o Admin (cards, headers, badges, tabelas)
- [x] DashboardTab: cards KPIs, gráficos, lista de pedidos recentes
- [x] OrdersTab: tabela kanban, badges de status, filtros
- [x] MenuTab: cards de produtos, categorias, sliders
- [x] CouponsTab, PromotionsTab, RafflesTab, UpsellsTab
- [x] UsersTab, ReportsTab, DriversTab, MessagesTab
- [x] SettingsTab, StoresTab, RecoveryTab
- [x] Páginas externas da sidebar: CRM (/crm), Notificações (/notificacoes), Zonas de Entrega (/zonas-entrega), Painel de Vendas (/vendas)
- [x] TypeScript: 0 erros
- [x] Atualizar skill bonatto-pizza-id-visual com padrões do Admin

## v51.0 - Dados fiscais no formulário de lojas (NFC-e)

- [x] Backend: stores.update aceitar campos fiscais (cnpj, inscricaoEstadual, regimeTributario, csc, cscId, focusNfeToken, nfceEnabled)
- [x] Frontend: seção "Dados Fiscais (NFC-e)" no modal de edição da StoresTab
- [x] Frontend: campos CNPJ, IE, regime tributário (select), CSC, CSC ID, token Focus NFe, toggle NFC-e habilitado
- [x] Frontend: openEdit carrega os campos fiscais existentes ao editar
- [x] TypeScript: 0 erros

## v52.0 - Deep link carrinho abandonado + seção Carrinhos Salvos no app cliente

- [x] Corrigir notificação push de carrinho abandonado: incluir URL com deep link para /checkout?restore=true
- [x] Service worker: ao clicar na notificação, abrir a URL do deep link em vez da home
- [x] Backend: procedure cart.myAbandoned para listar carrinhos abandonados do usuário logado
- [x] Backend: procedure cart.dismiss para marcar carrinho abandonado como descartado
- [x] Frontend: seção "Carrinhos Salvos" na página MinhaConta com botão Finalizar Pedido e Descartar
- [x] Frontend: ao clicar Finalizar, restaurar itens no carrinho e redirecionar para /checkout
- [x] TypeScript: 0 erros

## v53.0 - Migrar imagens do carrossel para jsDelivr via GitHub

- [x] Localizar URLs atuais das imagens do carrossel na home
- [x] Baixar as imagens e fazer push para o repositório GitHub de assets
- [x] Gerar URLs jsDelivr para cada imagem
- [x] Atualizar o código do carrossel com as novas URLs jsDelivr
- [x] TypeScript: 0 erros

## v54.0 - Templates configuráveis para carrinho abandonado e reativação de inativos

- [x] Schema: adicionar novos eventos no enum de notificationTemplates (cart_abandoned_step1/2/3, reactivation_15/30/60)
- [x] Migração: pnpm db:push para aplicar o novo enum
- [x] Seed: criar templates padrão para cada novo evento (mínimo 2 variações por etapa)
- [x] automation.ts: substituir textos hardcoded de carrinho abandonado por pickRandomTemplate
- [x] automation.ts: substituir textos hardcoded de reativação de inativos por pickRandomTemplate
- [x] UI NotificationTemplates: exibir os novos eventos com labels amigáveis em português
- [x] UI NotificationTemplates: suporte a variáveis {{total}}, {{coupon}}, {{clientName}} nos novos templates
- [x] TypeScript: 0 erros

## v55.0 - Sistema de alertas no painel do cliente

- [x] Schema: tabela clientAlerts (id, type, title, message, icon, url, storeId, expiresAt, createdAt)
- [x] Migração: pnpm db:push
- [x] Backend: hook automático nos routers de promoções, sorteios, cupons e clube ao criar novo item
- [x] Backend: procedure alerts.list (lista alertas ativos não lidos pelo usuário)
- [x] Backend: procedure alerts.dismiss (marca alerta como lido para o usuário)
- [x] Frontend: componente AlertBanner com badge de contagem não lidos
- [x] Frontend: exibir AlertBanner na Home (abaixo do carrossel) e na MinhaConta
- [x] Frontend: badge vermelho no nav "Minha Conta" quando houver alertas não lidos
- [x] TypeScript: 0 erros

## v58.0 - Correções ClientAlertsBanner

- [x] ClientAlertsBanner: melhorar espaçamento entre o card de alerta e o card azul (PWAInstallBanner) abaixo
- [x] ClientAlertsBanner: corrigir link 404 ao clicar no alerta de promoção (URL corrigida para /minha-conta em routers.ts)
- [x] PWAInstallBanner: corrigir botão "Entendi, fechar" que não estava funcionando (faltava condição dismissed no return)
- [x] TypeScript: 0 erros

## v60.0 - Redesign Completo Admin
- [x] Sidebar nova: fundo #dbd6db, item ativo com gradiente #ff0000→#920000 + glow
- [x] Layout base do admin: fundo acinzentado, cards brancos com sombra sutil
- [x] Transição fade na troca de abas
- [x] Dashboard: filtro de período 7d/14d/30d/Personalizado com seletor de datas
- [x] Relatórios: filtro de período com opção Personalizado + cards minimalistas com ícones gradiente
- [x] Gráficos atualizados para novo estilo (sem bordas, barras bordô)
- [x] Footer da sidebar atualizado para tema claro
- [x] AdminStoreSelectorSidebarDark atualizado para tema claro

## v61.0 - Gráfico de Pizza por Categoria nos Relatórios
- [x] Backend: query topCategories em server/db.ts agrupando order_items por categoria
- [x] Backend: procedure reports.topCategories em routers.ts
- [x] Frontend: PieChart (recharts) no ReportsTab com distribuição por categoria
- [x] TypeScript: 0 erros

## v62.0 - Refatoração Visual Completa do Admin (Clean/Minimalista)
- [x] Sidebar: fundo branco #fff, 8 itens principais com submenus colapsáveis
- [x] Sidebar: item ativo com barra vermelha lateral (não fundo inteiro)
- [x] Sidebar: agrupar Marketing, Clientes, Entregas em submenus
- [x] Layout: fundo #f5f5f5, cards brancos com border #e5e5e5, sem sombra pesada
- [x] Tipografia: Inter em todo admin, peso 500 títulos, 400 corpo
- [x] Dashboard: cards métrica com ícones neutros cinza, números leves
- [x] Dashboard: gráficos limpos sem excesso de cor
- [x] Todas as abas: visual consistente (headers, cards, espaçamentos padronizados)
- [x] Transições: fade na troca de abas
- [x] Pipeline de status com cores suaves (amarelo/verde/azul/rosa)
- [x] Botões de filtro de período discretos (fundo preto, sem gradiente)
- [x] Ícones do ReportsTab neutros (cinza, sem gradiente vermelho)
- [x] TypeScript: 0 erros

## v63.0 - Dark Mode Toggle no Admin
- [x] Criar variáveis CSS para tema escuro do admin (sidebar, fundo, cards, texto)
- [x] Implementar switch visual (toggle) na sidebar do admin
- [x] Persistir preferência de tema no localStorage
- [x] Aplicar tema escuro em todos os componentes do admin (MetricCards, Pipeline, Gráficos, Tabelas)
- [x] Garantir contraste adequado em ambos os temas
- [x] TypeScript: 0 erros

## Dark Mode Admin
- [x] Criar variáveis CSS isoladas com [data-admin-theme] para light e dark (paleta bordô monocromática)
- [x] Adicionar AdminThemeContext com estado persistido no localStorage
- [x] Toggle Sun/Moon na sidebar do admin (Tema Escuro / Tema Claro)
- [x] Substituir cores hardcoded na sidebar por variáveis CSS
- [x] Substituir cores hardcoded no DashboardTab (MetricCards, pipeline, gráfico, pedidos recentes)
- [x] Substituir cores hardcoded no ReportsTab (cards, gráficos, tabela de produtos)
- [x] Substituir cores hardcoded nos headers de todas as tabs (Pedidos, Cardápio, Cupons, Promoções, Sorteios, Upsells, Usuários, Motoboys, Mensagens, Configurações)
- [x] Kanban de pedidos com variantes dark (KANBAN_COLS_DARK) e cards adaptados
- [x] Overrides CSS globais para shadcn/Tailwind no dark mode (tabelas, inputs, cards, badges, scrollbar)
- [x] Tema não afeta Home/Cardápio público (isolado via data-admin-theme)

## Bugfix - Dashboard "Pedidos Hoje" / "Receita Hoje"
- [x] Identificar bug: endOfDay fixo no useState (não atualizava após pedidos novos) + timezone incorreto (UTC vs GMT-3)
- [x] Criar procedure reports.todaySummary no backend que calcula "hoje" com base no timezone do cliente
- [x] Atualizar DashboardTab para usar trpc.reports.todaySummary com refetchInterval de 30s
- [x] Remover queries reports.sales antigas com datas fixas do frontend
- [x] TypeScript: 0 erros
## BUG v2 - Dashboard "Pedidos Hoje" / "Receita Hoje" zerados
- [x] Investigar por que cards estão zerados novamente após merges/cherry-picks do GitHub
- [x] Verificar se procedure reports.todaySummary ainda existe e funciona corretamente (cálculo de timezone invertido: +offset em vez de -offset)
- [x] Corrigir e testar (invertido sinais em server/routers.ts: nowUtc-offsetMs e localMidnight+offsetMs)
## Timezone do gráfico "Receita por Período"
- [x] Corrigir getDailyRevenue para agrupar por data no timezone do cliente (GMT-3) em vez de UTC
- [x] Verificar e corrigir outras funções de relatório que agrupam por data (getSalesTimeSeries também corrigida)
- [x] Atualizar frontend para passar timezoneOffset nas queries de relatórios (DashboardTab + ReportsTab)
- [x] Testar gráfico e relatórios (verificado no browser, sem erros)
## BUG - Erro "Unable to transform response from server" ao confirmar pedido
- [x] Investigar logs do servidor para identificar o erro na criação de pedido (causa: Asaas não configurado)
- [x] Identificar causa raiz e corrigir (removida chamada Asaas do checkout)
- [x] Testar criação de pedido (41 testes passando, 0 erros TS)
## Remover Asaas do checkout (temporário)
- [x] Remover chamada asaas.createPix do fluxo de checkout para pedidos passarem sem erro
## Redesign DashboardTab
- [x] Implementar novo layout: topbar, KPI cards 4col, linha meio 2/3+1/3, linha inferior 2/3+1/3
## Redesign visual Mosaic em todas as abas do admin
- [x] Analisar design system do Mosaic (mosaic.cruip.com) - cores, tipografia, espaçamentos
- [x] Atualizar CSS variables do admin para visual Mosaic (gray-100 bg, white cards, backdrop blur)
- [x] Criar componente AdminTopbar (60px, título, subtítulo, botão Atualizar, actions)
- [x] Substituir AdminPageHeader por AdminTopbar em todas as 9 abas: Dashboard, Pedidos, Cardápio, Cupons, Relatórios, Promoções, Sorteios, Up-sells, Usuários, Configurações, Motoboys, Recuperação de receita
- [x] 0 erros TypeScript após migração completa

## Melhoria do card "Receita por Período"
- [x] Trocar gráfico de barras por área chart com gradiente vermelho→transparente
- [x] Adicionar KPIs secundários no cabeçalho (total, melhor dia, média diária)
- [x] Tooltip rico ao hover (data, receita, pedidos, ticket médio)
- [x] Destacar "hoje" no eixo X com cor diferente
- [x] Linha comparativa com período anterior (linha cinza sobreposta)

## Remover modo escuro
- [x] Remover botão "Alternar tema" do painel admin
- [x] Forçar ThemeProvider para defaultTheme="light" e desabilitar troca
- [x] Remover todos os blocos .dark do index.css (também removidos [data-admin-theme="dark"] e KANBAN_COLS_DARK)

## Correção de Fuso Horário (America/Sao_Paulo)
- [x] Criar utilitário central de timezone (shared/timezone.ts)
- [x] Corrigir todaySummary no routers.ts para usar America/Sao_Paulo
- [x] Corrigir getSalesReport, getDailyRevenue, getSalesTimeSeries no db.ts
- [x] Corrigir getSalesOverview (todayStart/todayEnd) no db.ts
- [x] Corrigir exibições de data no frontend (Admin.tsx - todayStr, today, startDate/endDate ReportsTab)
- [x] Garantir que pedidos às 23h BRT apareçam como "hoje" (hoje = 03:00 UTC a 02:59:59 UTC do dia seguinte)

## Redesign Visual Nexus — Unificação do Painel Admin
- [x] Commit 1: Tokens CSS (--admin-*) colapsados no :root com paleta Nexus (bg #f0f2f5, cards #fff, heading #1a1d23, muted #8a92a0, borda #e8ebf0)
- [x] Commit 2: admin/ui.tsx refatorado — AdminStat simplificado, AdminSearch corrigido, AdminPill com tokens warning/info, AdminToolbar exportado
- [x] Commit 3: 13 abas verificadas — 12 usam AdminTopbar+AdminPage, MessagesTab usa layout especial de chat
- [x] Commit 4: Páginas auxiliares (VendasDashboard, CRM, Automacoes, DeliveryZones, NotificationTemplates, AppDashboard) são rotas independentes, fora do escopo do painel admin
- [x] Commit 5: Dark mode JS já removido em sessões anteriores (AdminThemeContext, KANBAN_COLS_DARK, data-admin-theme="dark")
- [x] pnpm check: 0 erros TypeScript | pnpm test: 41 passando | pnpm build: sucesso
- [x] Checkpoint salvo: d633b0a3

## BUG - Checkout: "deliveryAddress too small" no modo retirada
- [x] Causa raiz: form.deliveryAddress vazio ("") enviado para orders.create quando deliveryMode="pickup"
- [x] Correção: usar fallback "Retirada no local" quando deliveryAddress.trim() estiver vazio no modo retirada
- [x] TypeScript: 0 erros | Testes: 41 passando

## v70.0 - Workflow Builder: Expansão de Funcionalidades + Redesign Nexus

### Backend — Novos Triggers
- [ ] Adicionar triggers ao enum: order_delivered, order_cancelled, birthday, loyalty_milestone, rating_submitted, club_expiring
- [ ] Migrar schema com pnpm db:push
- [ ] Implementar fireJourneyTrigger para order_delivered e order_cancelled em routers.ts
- [ ] Implementar fireJourneyTrigger para rating_submitted em routers.ts

### Backend — Novos Step Types
- [ ] Adicionar step type: send_coupon (gerar e enviar cupom exclusivo)
- [ ] Adicionar step type: update_loyalty (adicionar/remover pontos de fidelidade)
- [ ] Adicionar step type: send_alert (criar alerta no painel do cliente)
- [ ] Adicionar step type: split_ab (divisão A/B — enviar mensagem A para 50%, B para 50%)
- [ ] Implementar execução dos novos step types em automation.ts
- [ ] Atualizar schema Zod em routers.ts para aceitar novos step types e triggers

### Frontend — FlowNodes (visual Nexus)
- [ ] Migrar cores dos nodes de bordô escuro para paleta Nexus (--admin-*)
- [ ] Adicionar nodes visuais para: send_coupon, update_loyalty, send_alert, split_ab
- [ ] Melhorar node de condition com preview da condição no card
- [ ] Adicionar badge de tipo colorido por categoria no card do node

### Frontend — Automacoes.tsx (redesign Nexus + novas features)
- [ ] Migrar fundo/header de bordô escuro para paleta Nexus (bg #f0f2f5, cards #fff)
- [ ] Usar AdminTopbar/AdminPage/AdminSurface do design system
- [ ] Adicionar painel lateral de estatísticas (execuções por status, taxa de conversão)
- [ ] Adicionar filtro de jornadas por trigger e status
- [ ] Melhorar NodeEditor: campos para send_coupon, update_loyalty, send_alert, split_ab
- [ ] Adicionar aba "Execuções" na lista de jornadas com histórico expandível
- [ ] Adicionar templates prontos de jornada (ex: "Recuperação 3 etapas", "Boas-vindas", "Aniversário")

### Verificação
- [ ] TypeScript: 0 erros
- [ ] Testes: todos passando
- [ ] Build: sucesso

## v71.0 - Workflow Builder: 9 Novas Funcionalidades (backend + frontend) — CONCLUÍDO
- [x] Schema: novos triggers (inativo_custom, rating_negative, first_order_month) + exitCondition + campos de métricas nas execuções
- [x] Backend: Exit Condition (encerrar jornada se cliente fez pedido)
- [x] Backend: Trigger N dias configurável (inativo_custom com campo daysInactive)
- [x] Backend: Trigger avaliação negativa (≤3 estrelas)
- [x] Backend: Trigger primeiro pedido do mês
- [x] Backend: Step "pause_journey" (pausar outra jornada via step)
- [x] Backend: Step "notify_admin" (criar tarefa/notificação para o admin)
- [x] Backend: Métricas globais de automações (execuções, conversões, receita atribuída)
- [x] Backend: Histórico de jornadas por cliente (procedure no routers.ts)
- [x] Backend: Painel A/B — dados de grupo A vs B por jornada
- [x] Frontend: Automacoes.tsx — novos triggers no editor, exit condition toggle, steps pause_journey e notify_admin
- [x] Frontend: Painel A/B na aba de execuções
- [x] Frontend: Dashboard de métricas globais de automações
- [x] Frontend: Histórico de jornadas na aba do cliente no Admin.tsx
- [x] Testes vitest: 15 testes passando (exit condition, trigger N dias, métricas A/B, histórico)
