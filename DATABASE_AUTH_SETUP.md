# Banco, Login Social e E-mail

## Status real hoje

- O app usa MySQL via `mysql2` + `drizzle-orm`.
- O reset de senha ja existe no backend.
- O login social ja existe, mas depende de um gateway OAuth externo configurado por ambiente.
- O Netlify nao oferece MySQL nativo no mesmo formato do seu projeto atual.

## Melhor caminho pratico

### MySQL gratis para desenvolvimento

Use Aiven Free.

Motivos:

- e MySQL gerenciado
- nao pede cartao para comecar
- entrega `DATABASE_URL`
- encaixa no codigo atual sem migrar o projeto para Postgres

### MySQL compativel com foco melhor em producao e Netlify

Use PlanetScale.

Motivos:

- e MySQL-compativel
- tem integracao oficial com Netlify
- conversa bem com deploy por contexto e branching

Ponto honesto:

- para meta de muito trafego, eu nao trataria banco gratis como ambiente final
- gratis serve bem para validar fluxo, auth e reset
- para operar com folga, o banco provavelmente vai precisar subir de plano

## Variaveis obrigatorias

### Banco

- `DATABASE_URL`

### Auth social

- `VITE_APP_ID`
- `VITE_OAUTH_PORTAL_URL`
- `OAUTH_SERVER_URL`
- `JWT_SECRET`
- `PUBLIC_APP_URL`

### E-mail de redefinicao

- `RESEND_API_KEY`
- `EMAIL_FROM`

## Provedores de login

### Google

Suportado. Precisa de client OAuth web no Google Cloud.

### Apple

Suportado. Precisa de Services ID, dominio e callback web no ecossistema Apple.

### Facebook

Suportado. Precisa configurar o app na Meta com Web OAuth Login e redirect URI valido.

### Instagram

Importante:

- o caminho oficial atual da Meta para Instagram e focado em contas profissionais
- isso normalmente significa Business ou Creator
- para cadastro social comum de qualquer usuario, Instagram nao e tao direto quanto Google, Apple e Facebook

Na pratica:

- para login social amplo, use Google + Apple + Facebook
- so use Instagram se o produto realmente precisa do ecossistema profissional da Meta

## O que eu ajustei no codigo

- login social agora aceita `provider` na URL
- tela de login agora mostra Google, Facebook, Apple e Instagram
- backend agora reconhece `facebook` e `instagram` no mapeamento de plataforma
- e-mails agora usam `EMAIL_FROM`

## O que ainda depende das suas contas externas

Eu nao consigo criar daqui:

- a conta e o banco Aiven
- a conta e o banco PlanetScale
- o app OAuth do Google
- o setup de Sign in with Apple
- o app da Meta para Facebook/Instagram
- a conta e a chave da Resend

Tudo isso exige login seu nas plataformas externas.

## Ordem recomendada

1. Banco MySQL
2. Google login
3. Apple login
4. Facebook login
5. decidir se Instagram realmente entra
6. Resend para reset de senha
