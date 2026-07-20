# Backend do WhatsApp (Cloud Functions)

O token do WhatsApp Business **não fica mais no app**. Ele é guardado como
*secret* do Firebase e usado apenas pela Cloud Function `sendWhatsApp`, que roda
no servidor. O app chama essa função; ninguém consegue extrair o token do APK.

## Pré-requisitos

- Firebase CLI instalado: `npm install -g firebase-tools`
- Login: `firebase login`
- **Plano Blaze** ativo no projeto (Cloud Functions exige billing; o uso do
  Barbershop cabe folgado na cota gratuita do Blaze).

## Passo 1 — Instalar as dependências da função

```bash
cd functions
npm install
```

## Passo 2 — Configurar os secrets (token do WhatsApp)

```bash
firebase functions:secrets:set WHATSAPP_TOKEN
# cole o Access Token do Meta for Developers quando pedir

firebase functions:secrets:set WHATSAPP_PHONE_ID
# cole o Phone Number ID
```

## Passo 3 — Publicar a função

```bash
firebase deploy --only functions
```

Pronto. A partir daí, toda confirmação/cancelamento de agendamento envia a
mensagem pelo servidor.

## Enquanto não publicar

O app continua funcionando: se a função não estiver disponível, ele usa o
**fallback** — abre o WhatsApp no aparelho com a mensagem já digitada, como
antes. Ou seja, nada quebra; a diferença é que o envio automático (sem abrir o
app do WhatsApp) só passa a valer depois do deploy.

## Trocar o token no futuro

Basta rodar `firebase functions:secrets:set WHATSAPP_TOKEN` de novo e
`firebase deploy --only functions`. Nunca precisa mexer no código do app.
