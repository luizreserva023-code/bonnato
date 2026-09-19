# Autenticação social do Bonatto

O projeto usa React/Vite no cliente, Express/tRPC no servidor e MySQL/Drizzle. Não é necessário adicionar Supabase ou migrar para Next.js.

## O que está implementado

- Login e cadastro com Google, Facebook e Apple.
- Conexão opcional de Instagram profissional Business ou Creator no perfil.
- OAuth `state` criptografado, PKCE no Google e `nonce` em Google/Apple.
- Validação de assinatura, emissor, audiência e expiração dos ID tokens.
- Validação do access token do Facebook no backend.
- Tokens sociais criptografados com AES-256-GCM.
- Vinculação segura por e-mail apenas quando o provedor informa que ele foi verificado.
- Sincronização, revogação e desconexão pelo perfil.
- Consentimentos e eventos de autenticação registrados no banco.
- Exclusão com anonimização da conta.

## Banco de dados

Execute a migration antes de ativar os provedores:

```powershell
npm.cmd run db:runtime:migrate
```

A migration correspondente é `drizzle/0046_social_auth_foundation.sql`.

## URL de callback

Cadastre exatamente a mesma URL nos provedores:

```text
Desenvolvimento: http://localhost:3000/api/oauth/callback
Produção: https://SEU-DOMINIO/api/oauth/callback
```

O Apple exige HTTPS e não aceita `localhost` para o fluxo web. Para teste, use uma URL HTTPS de preview autorizada ou o domínio de produção.

## Google

1. Crie um cliente OAuth do tipo Aplicativo da Web no Google Cloud.
2. Cadastre a URL de callback.
3. Preencha `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
4. Use somente os escopos `openid email profile`.

## Facebook

1. Crie um app na Meta e adicione o produto Facebook Login.
2. Ative Web OAuth Login e cadastre a URL de callback em Valid OAuth Redirect URIs.
3. Preencha `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`.
4. Solicite somente `public_profile` e `email`.

## Apple

1. Crie um Services ID e ative Sign in with Apple.
2. Associe o domínio e a URL de retorno.
3. Crie uma chave Sign in with Apple e baixe o arquivo `.p8`.
4. Preencha `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY`.

## Instagram profissional

1. Configure Instagram API with Instagram Login no app Meta.
2. Cadastre a mesma URL de callback.
3. Preencha `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
4. O usuário conecta a conta em Minha conta > Perfil. Contas pessoais são recusadas com mensagem amigável.

## Produção

- Gere valores diferentes e fortes para `JWT_SECRET` e `OAUTH_ENCRYPTION_KEY`.
- Nunca use variáveis `VITE_` para client secrets.
- Aplique a migration antes de adicionar as credenciais no Vercel.
- Teste cada provedor em modo de desenvolvimento antes de solicitar revisão/publicação na Meta.
- Após alterar variáveis no Vercel, faça um novo deploy para que as Functions recebam os valores.
