# Cloud Run — Telegram Gateway

## Workflow de Desenvolvimento e Deploy (Google Apps Script)

Este projeto utiliza um fluxo de CI/CD para automatizar o deploy do código do Google Apps Script (arquivos `.gs` e `.html`) diretamente do GitHub.

### Fonte da Verdade
O repositório no **GitHub é a única fonte da verdade**. Nenhuma alteração de código deve ser feita diretamente no editor do Google Apps Script, pois será sobrescrita.

### Ciclo de Desenvolvimento
1.  **Edite Localmente:** Faça todas as alterações de código na sua máquina local, dentro da pasta `JET Promo/`.

2.  **Salve as Alterações (Commit):** Use o Git para salvar suas alterações com uma mensagem descritiva.
    ```bash
    # Adiciona todos os arquivos modificados
    git add .

    # Cria um "commit" com uma mensagem clara
    git commit -m "Descreva a mudança que você fez"
    ```

3.  **Envie para o GitHub (Gatilho do Deploy):** Envie suas alterações para o repositório remoto. Este passo aciona o deploy automático.
    ```bash
    git push origin master
    ```

### Deploy Automático
O `git push` para a branch `master` aciona um workflow no GitHub Actions que executa o `clasp push --force`. Isso atualiza os scripts no ambiente do Google Apps Script em 1-2 minutos. Você pode acompanhar o progresso na aba "Actions" do seu repositório.

### Observação sobre o Ambiente Local
Devido a um problema específico no ambiente local do Windows, os comandos `clasp pull` e `clasp status` podem não funcionar. O deploy via GitHub Actions, no entanto, funciona perfeitamente, pois ocorre em um ambiente limpo.

---

## Papel deste serviço
Este serviço é o **único responsável pelo Telegram**:
- recebe webhook
- processa inline keyboard
- faz cadastro/update via bot
- publica slots disponíveis/ocupados por tópico
- repassa eventos do app para o Apps Script
- executa as integrações de Telegram devolvidas pelo Apps Script

## Rotas
- `GET /healthz`
- `GET /app/query`
- `POST /app/event`
- `POST /internal/publish-available-slots`
- `POST /telegram/webhook/<TELEGRAM_WEBHOOK_SECRET_PATH>`

## Cadastro do promotor via bot
No privado do bot:
- `/start`
- `/cadastro`
- `/update`
- `/cancel`

Fluxo:
1. usuário envia `/cadastro` ou `/update`
2. bot pede `PROMOTOR_ID`
3. bot pede `Cidade`
4. Cloud Run chama `BOT_VINCULAR_PROMOTOR` no Apps Script
5. Apps Script grava `telegram_user_id` + `cidade` em `PROMOTORES`

## Estrutura multi-cidade
Use **1 Cloud Run** e **1 app**, com vários grupos no Telegram.
A variável `CITY_GROUPS_JSON` mapeia cidade -> grupo/tópicos.

## Deploy recomendado (CLI)
### 1. Pré-requisitos
```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### 2. Ajuste o `env.example.yaml`
Crie um arquivo `env.yaml` a partir do exemplo e preencha os valores reais.

### 3. Deploy do serviço
```bash
gcloud run deploy promo-telegram-gateway \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated
```

### 4. Configure as variáveis de ambiente
```bash
gcloud run services update promo-telegram-gateway \
  --region southamerica-east1 \
  --env-vars-file env.yaml
```

### 5. Descubra a URL pública
```bash
gcloud run services describe promo-telegram-gateway \
  --region southamerica-east1 \
  --format='value(status.url)'
```

Guarde a URL retornada como `CLOUD_RUN_URL`.

### 6. Registrar o webhook do Telegram
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<CLOUD_RUN_URL>/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET_PATH>",
    "drop_pending_updates": true
  }'
```

### 7. Publicar slots disponíveis no tópico
```bash
curl -X POST "<CLOUD_RUN_URL>/internal/publish-available-slots" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -d '{"cidade":"São Paulo","limit":50}'
```

## Interfaces de Usuário

O ecossistema JET possui duas interfaces principais servidas por este serviço:

### 1. App do Promotor / Operacional (PWA)
- **Acesso:** URL raiz (`/`)
- **Público:** Promotores (MEI), Fiscais (CLT), Motoristas e Scouts.
- **Funcionalidades:** 
  - Login via CPF e Data de Nascimento.
  - Controle de Jornada (Check-in, Pausa, Checkout).
  - **Módulo Fiscal:** Ferramentas exclusivas para o cargo **FISCAL** (Registro de Infrações, Botão SOS, Roteiro de Fiscalização e Mapa de Promotores).
  - Histórico, Ranking, Academy e Suporte.

### 2. Painel do Gestor (Restrito)
- **Acesso:** `/gestor`
- **Público:** Gestores Regionais e Líderes de Equipe.
- **Funcionalidades:** 
  - Visão macro da operação, Mapas de Calor, KPIs e Relatórios.
  - Gestão de Escalas CLT e Aprovação de Cadastros.
  - **Segurança:** O acesso de Fiscais a este painel foi desativado para garantir a separação entre operação de rua e gestão administrativa.

## App PWA
### Leituras
Pode consultar direto o Apps Script ou usar o proxy do Cloud Run:
- `GET /app/query?evento=GET_ME&token=...`
- `GET /app/query?evento=GET_SLOT_ATUAL&token=...`

### Escritas
Use o Cloud Run:
- `POST /app/event`
- `ACEITAR_SLOT`
- `CHECKIN`
- `PAUSE`
- `RESUME`
- `CHECKOUT`
- `CHECKOUT_EXCEPCIONAL`
- solicitações operacionais

## Observações importantes
- Regenerar o token do bot antes de produção.
- O Apps Script não envia Telegram.
- O Apps Script devolve `integracoes`, e o Cloud Run executa.
- Se a aba `SLOTS` tiver as colunas opcionais `tg_*`, o Cloud Run consegue editar a mensagem original de slot disponível quando ele é aceito.


## Observações de operação

- Serviço oficial atual: `promo-telegram-gateway-v3`.
- `v1` e `v2` devem ser tratados como descartados/legado.
- O `v3` foi estabilizado com `Dockerfile` explícito e rota raiz JSON.
- O endpoint `/app/query?evento=PING` está validado.
- O endpoint interno `/internal/publish-available-slots` funciona quando `X-Admin-Secret` e `APPS_SCRIPT_SHARED_SECRET` estão corretos.
- Rotacionar token do bot e segredos antes de produção.
