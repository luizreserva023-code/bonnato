# Guia Rápido

Este guia foi feito para você seguir sem precisar entender desenvolvimento a fundo.

## 1. Abrir o projeto

Pasta do projeto:

`C:\Users\luisg\Documents\New project\bonatto-mobile-app`

## 2. Instalar tudo uma vez

No terminal, dentro da pasta do projeto:

```bash
npm install --legacy-peer-deps
```

Isso baixa tudo que o app precisa para funcionar.

## 3. Rodar o app localmente

Para abrir o sistema no seu computador:

```bash
npm run dev
```

Depois abra no navegador:

[http://localhost:3000](http://localhost:3000)

## 4. Se quiser só gerar a versão web pronta

```bash
npm run build:web
```

Isso cria os arquivos finais da versão web em `dist/public`.

## 5. Gerar ícones e arquivos do app mobile

```bash
npm run mobile:assets
```

Isso cria:

- ícones do app
- splash/onboarding
- arquivos visuais para Android e iPhone

## 6. Preparar o projeto para app Android/iPhone

```bash
npm run mobile:sync
```

Esse comando:

1. gera os assets mobile
2. gera a versão web do app
3. sincroniza tudo com o Capacitor

## 7. Criar o projeto Android

Esse passo normalmente é feito uma vez:

```bash
npx cap add android
```

Depois, para abrir no Android Studio:

```bash
npm run mobile:open:android
```

## 8. Criar o projeto iPhone

Esse passo só funciona em Mac:

```bash
npx cap add ios
```

Depois, para abrir no Xcode:

```bash
npm run mobile:open:ios
```

## 9. O que ainda falta antes de publicar

Hoje o app já tem base visual e estrutura mobile, mas ainda faltam estas partes para produção:

1. Configurar banco de dados real.
2. Configurar variáveis `.env`.
3. Publicar a API/backend em um servidor.
4. Ligar o app mobile nessa API publicada.
5. Testar login, pedido, pagamento e notificações com dados reais.
6. Gerar APK/AAB no Android Studio e build iOS no Xcode.

## 10. Ordem recomendada para você agora

Siga exatamente esta ordem:

1. Rodar `npm run dev`
2. Abrir `http://localhost:3000`
3. Ver se visualmente está tudo como você quer
4. Rodar `npm run mobile:sync`
5. Criar Android com `npx cap add android`
6. Abrir Android Studio com `npm run mobile:open:android`
7. Testar o app no emulador ou celular Android
8. Só depois pensar em publicar

## 11. Se aparecer erro

Me mande exatamente:

1. o comando que você rodou
2. a mensagem de erro completa
3. em qual passo do guia você estava

Com isso eu consigo te orientar no próximo passo sem você precisar adivinhar nada.
