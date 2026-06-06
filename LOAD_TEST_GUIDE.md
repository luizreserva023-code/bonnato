# Guia Simples de Teste de Carga

Este projeto agora tem um script pronto para testar a versao web com muitos acessos diferentes.

## O que ele faz

- Simula usuarios diferentes com IPs e cookies diferentes.
- Testa uma mistura de paginas publicas e endpoints publicos.
- Gera relatorio com:
  - total de requisicoes
  - falhas
  - requisicoes por segundo
  - latencia media
  - p50, p95 e p99

## Antes de rodar

Para teste local:

1. Rode `npm run dev`
2. Confirme que o site abre em `http://localhost:3000`

Para teste no site publicado:

1. Use a URL publicada
2. Evite comecar com 100 mil direto
3. Comece com smoke test, depois 5 mil, 20 mil e so depois 100 mil

## Comandos prontos

### 1. Smoke test local

```bash
npm run loadtest:smoke
```

### 2. Teste customizado no site publicado

```bash
cross-env LOAD_TEST_BASE_URL=https://bonatto.netlify.app LOAD_TEST_TOTAL=5000 LOAD_TEST_CONCURRENCY=100 LOAD_TEST_UNIQUE_USERS=5000 LOAD_TEST_SPOOF_IP=false npm run loadtest:public
```

### 3. Teste grande de 100 mil requisicoes

```bash
cross-env LOAD_TEST_BASE_URL=https://bonatto.netlify.app LOAD_TEST_TOTAL=100000 LOAD_TEST_CONCURRENCY=250 LOAD_TEST_UNIQUE_USERS=100000 LOAD_TEST_SPOOF_IP=true npm run loadtest:public
```

### 4. Atalho pronto para 100 mil

```bash
npm run loadtest:100k
```

Se quiser usar outra URL, troque `LOAD_TEST_BASE_URL`.

### Quando usar `LOAD_TEST_SPOOF_IP`

- `LOAD_TEST_SPOOF_IP=false`
  - melhor para validar o site publicado no Netlify como um navegador real
- `LOAD_TEST_SPOOF_IP=true`
  - tenta simular usuarios com IPs diferentes usando `X-Forwarded-For`
  - util para ambiente local e alguns proxies
  - em plataformas gerenciadas, parte das requisicoes pode ser rejeitada pelo proxy

## Onde sai o relatorio

Os resultados ficam em:

- `load-test-results/`

Cada execucao salva um arquivo `.json`.

## Como ler o resultado

- `successRate`:
  - ideal acima de 99%
- `requestsPerSecond`:
  - mostra o throughput real
- `latencyMs.p95`:
  - principal numero para experiencia do usuario
- `statusCounts`:
  - se aparecer muito `429`, o rate limit esta barrando seu teste
  - se aparecer muito `500`, o backend esta falhando

## Meta recomendada para publicar com seguranca

Para um app web com pico forte, eu recomendo mirar assim:

- homepage e cardapio publico:
  - `p95` abaixo de `800ms`
- endpoints publicos leves:
  - `p95` abaixo de `500ms`
- falhas:
  - abaixo de `1%`

## Limites atuais que ainda precisam ser resolvidos

Hoje o projeto ainda tem estes pontos antes de um teste completo de producao:

- `DATABASE_URL` nao esta acessivel para o ambiente local do Codex
- `JWT_SECRET` esta vazio no ambiente local
- `OAUTH_SERVER_URL` nao esta configurado localmente

Sem banco real acessivel no ambiente de teste, o script valida carga da camada web publica, mas nao valida fluxo real de login, pedido, admin e motoboy com dados persistidos.
