# Bonatto Pizza Mobile

Este projeto esta preparado para operar em tres camadas:

1. Web/PWA para aquisicao e retencao.
2. Shell nativa com Capacitor para iOS e Android.
3. Backend publicado separadamente para atender o app em producao.

## Stack mobile

- `Capacitor` para empacotar a experiencia web como app nativo.
- `VITE_API_BASE_URL` para apontar o app nativo para uma API publicada.
- `scripts/generate-mobile-assets.mjs` para gerar icones e splash a partir da marca.
- `scripts/fetch-magnific-icons.mjs` para sincronizar icones, imagens de categoria e presets de avatar via Magnific.

## Variaveis importantes

Crie um `.env` de producao com pelo menos:

```bash
VITE_API_BASE_URL=https://api.seudominio.com
MAGNIFIC_API_KEY=opcional-se-for-baixar-assets-premium
```

Sem `VITE_API_BASE_URL`, o app web continua funcionando com caminhos relativos.
Para `Capacitor`, a API publicada e obrigatoria.

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

Para puxar assets premium da API do Magnific:

```bash
npm run mobile:magnific
```

O script salva manifestos em:

- `client/public/magnific/icons/manifest.json`
- `client/public/magnific/category-images/manifest.json`
- `client/public/magnific/avatar-presets/manifest.json`

Se `MAGNIFIC_API_KEY` nao estiver configurada, o script gera manifestos fallback com imagens locais e avatares cartoon prontos para o app continuar funcionando.

## Publicacao para 40k+ usuarios/mes

- Hospedar API e banco fora do app nativo.
- Colocar imagens estaticas atras de CDN.
- Usar banco gerenciado e fila para notificacoes/push.
- Monitorar erros de cliente e backend.
- Separar ambiente staging e producao antes de publicar nas lojas.
