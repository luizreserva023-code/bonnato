# Bonatto Pizza Mobile

Este projeto agora está preparado para operar em três camadas:

1. Web/PWA para aquisição e retenção.
2. Shell nativa com Capacitor para iOS e Android.
3. Backend publicado separadamente para atender o app em produção.

## Stack mobile

- `Capacitor` para empacotar a experiência web como app nativo.
- `VITE_API_BASE_URL` para apontar o app nativo para uma API publicada.
- `scripts/generate-mobile-assets.mjs` para gerar ícones e splash a partir da marca.
- `scripts/fetch-magnific-icons.mjs` para baixar ícones do Magnific quando houver `MAGNIFIC_API_KEY`.

## Variáveis importantes

Crie um `.env` de produção com pelo menos:

```bash
VITE_API_BASE_URL=https://api.seudominio.com
MAGNIFIC_API_KEY=opcional-se-for-baixar-icones
```

Sem `VITE_API_BASE_URL`, o app web continua funcionando com caminhos relativos.
Para `Capacitor`, a API publicada é obrigatória.

## Fluxo recomendado

```bash
npm install
npm run mobile:assets
npm run build:web
npm run mobile:sync
```

Depois:

- Android: `npm run mobile:open:android`
- iOS: `npm run mobile:open:ios`

## Magnific

Para puxar ícones premium da API do Magnific:

```bash
npm run mobile:magnific
```

Os arquivos serão salvos em `client/public/magnific-icons/`.

## Publicação para 40k+ usuários/mês

- Hospedar API e banco fora do app nativo.
- Colocar imagens estáticas atrás de CDN.
- Usar banco gerenciado e fila para notificações/push.
- Monitorar erros de cliente e backend.
- Separar ambiente staging e produção antes de publicar nas lojas.
