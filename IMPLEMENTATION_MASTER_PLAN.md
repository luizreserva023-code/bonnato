# Bonatto App Master Plan

## Objetivo

Transformar a base atual de delivery/CRM em uma plataforma operacional completa para restaurante, delivery, atendimento presencial, campanhas segmentadas e autenticação multicanal.

## Estado Atual

- Base forte de delivery, CRM, campanhas, notificações, motoboy e multiloja.
- Base inexistente ou incompleta para:
  - estoque por ingrediente
  - produtividade operacional por etapa
  - mesas, comandas e garçom
  - login por telefone com OTP
  - papéis operacionais finos
  - segmentação avançada baseada em métricas materiais

## Ordem Segura de Implementação

### Etapa 1 — Fundação operacional

- adicionar modelos de domínio compartilhado
- registrar lifecycle do pedido
- persistir previsão operacional
- consolidar métricas por cliente

Entregas previstas:

- `ingredients`
- `product_ingredients`
- `inventory_movements`
- `order_stage_logs`
- `productivity_events`
- `staff_members`
- `delivery_predictions`
- `dining_tables`
- `table_sessions`
- `table_order_links`
- `notification_campaigns`
- `campaign_segments`
- `notification_logs`
- `customer_metrics`
- `customer_auth_providers`
- `otp_codes`

### Etapa 2 — Estoque e ficha técnica

- CRUD de ingredientes
- ficha técnica por produto
- movimentação manual
- alerta de estoque baixo
- política de bloqueio/alerta por ingrediente crítico

### Etapa 3 — Baixa automática por pedido

- calcular consumo por item vendido
- aplicar baixa por transição válida
- estorno em cancelamento
- proteção contra reprocessamento

### Etapa 4 — Produtividade operacional

- capturar tempos reais por etapa
- dashboard operacional
- gargalos por horário e por etapa
- performance por colaborador e motoboy

### Etapa 5 — Clientes novos, ranking e métricas

- primeiro pedido
- ranking de recorrência
- ticket médio
- dias e horários preferidos
- bairros e produtos favoritos

### Etapa 6 — Notificações segmentadas avançadas

- motor de segmentos por filtros compostos
- campanhas com status, agendamento e log
- variáveis dinâmicas
- evolução para conversão/abertura/clique

### Etapa 7 — Atendimento presencial

- mesas
- comandas
- tela do garçom
- cozinha unificada
- fechamento e histórico

### Etapa 8 — Autenticação avançada

- OTP por telefone
- provider abstrato SMS/WhatsApp
- vínculo de providers sociais
- completar cadastro progressivamente

## Regras Críticas

- pedido cancelado não pode consumir estoque definitivo
- pedido entregue deve consolidar métricas
- alterações precisam ser idempotentes
- módulos de salão não podem quebrar o fluxo atual de delivery
- campanhas devem respeitar consentimento e canal disponível

## Status

- Etapa 1 iniciada no código
- Próximo bloco recomendado: serviços e rotas operacionais para estoque + lifecycle central do pedido
