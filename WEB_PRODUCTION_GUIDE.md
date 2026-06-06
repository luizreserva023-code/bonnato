# Publicacao Web Bonatto

## Objetivo

Este projeto agora esta preparado para publicar a versao web com hospedagem gratuita no Netlify.

## O que ja foi preparado

- Frontend SPA em `dist/public`
- Backend em funcao serverless `netlify/functions/api.ts`
- Jobs agendados separados para producao
- Rewrites configurados em `netlify.toml`

## Antes de publicar

Voce precisa ter:

1. Conta no Netlify
2. Banco MySQL compativel com `DATABASE_URL`
3. Variaveis de ambiente configuradas

## Variaveis minimas

Essas sao as mais importantes para o site abrir corretamente:

- `DATABASE_URL`
- `PUBLIC_APP_URL`
- `SESSION_SECRET` se existir no seu fluxo de auth
- `VITE_API_BASE_URL` quando o frontend precisar falar com outro dominio

## Comandos locais

```bash
npm install --legacy-peer-deps
npm run check
npm run build:web
```

Para testar o fluxo Netlify localmente:

```bash
npm run dev:netlify
```

## Como publicar no Netlify

1. Suba este projeto para um repositorio GitHub.
2. No Netlify, clique em `Add new site` e depois `Import an existing project`.
3. Escolha o repositorio.
4. Confirme estas configuracoes:
   - Build command: `npm run build:web`
   - Publish directory: `dist/public`
5. Adicione as variaveis de ambiente no painel do Netlify.
6. Publique.

## Jobs em producao

Os jobs ficaram separados assim:

- `jobs-notifications-ifood`: a cada 1 minuto
- `jobs-journeys`: a cada 2 minutos
- `jobs-abandoned-carts`: a cada 5 minutos
- `jobs-stale-orders`: a cada 10 minutos
- `jobs-tags-hourly`: de hora em hora
- `jobs-daily-report`: todo dia as 02:30 UTC

## Limitacao importante

No ambiente gratuito do Netlify, o polling do iFood passa a rodar a cada 1 minuto, nao a cada 30 segundos como no servidor tradicional.
