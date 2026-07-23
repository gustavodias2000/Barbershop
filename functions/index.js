/**
 * Cloud Functions — Barbershop
 *
 * `sendWhatsApp`: envia mensagem via WhatsApp Business API a partir do
 * SERVIDOR. O token de acesso fica guardado como "secret" do Firebase e
 * NUNCA é embutido no app — assim ninguém consegue extraí-lo do APK.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Secrets configurados via `firebase functions:secrets:set` (ver GUIA no final)
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');
const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');
// SMS (fallback quando o WhatsApp não pôde ser entregue) via Twilio.
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineSecret('TWILIO_FROM_NUMBER');
// Relatório semanal por email, via SMTP do Gmail (senha de app).
const EMAIL_USER = defineSecret('EMAIL_USER');
const EMAIL_PASS = defineSecret('EMAIL_PASS');

const API_VERSION = 'v21.0';

// Normaliza o telefone para o padrão internacional brasileiro (E.164 sem +)
function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/**
 * Envio de WhatsApp reutilizável pelo endpoint callable e pelos lembretes
 * agendados. Não lança: retorna { success, id? , error? } para que o
 * chamador decida como lidar com falhas (ex.: não interromper um lote).
 */
async function sendWhatsAppRaw(token, phoneId, to, message) {
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: formatPhone(to),
    type: 'text',
    text: { body: String(message) },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    if (!resp.ok) {
      return { success: false, error: result };
    }
    return { success: true, id: result?.messages?.[0]?.id || null };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Envio de SMS via Twilio — usado como FALLBACK dos lembretes quando o
 * WhatsApp não pôde ser entregue (token não configurado, número sem
 * WhatsApp, falha da API). Não é enviado em paralelo ao WhatsApp: evita
 * mandar duas notificações da mesma coisa para o mesmo cliente.
 *
 * RCS não foi implementado: exigiria um agente aprovado no Google RCS
 * Business Messaging + acordos com operadoras, fora do alcance de um app
 * único. Telegram também não foi implementado: exigiria que o cliente
 * iniciasse a conversa com o bot primeiro (Telegram não permite push por
 * número de telefone), o que quebraria o fluxo atual — o barbeiro cadastra
 * o cliente só com nome/telefone, sem nenhuma etapa de "vincular Telegram".
 */
async function sendSmsRaw(accountSid, authToken, from, to, message) {
  const digits = String(to || '').replace(/\D/g, '');
  const toE164 = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({ To: toE164, From: from, Body: String(message) });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const result = await resp.json();
    if (!resp.ok) {
      return { success: false, error: result };
    }
    return { success: true, id: result.sid || null };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
}

exports.sendWhatsApp = onCall(
  { secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID], region: 'us-central1' },
  async (request) => {
    // Só usuários autenticados podem disparar mensagens
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }

    const { to, message } = request.data || {};
    if (!to || !message) {
      throw new HttpsError('invalid-argument', 'Campos "to" e "message" são obrigatórios.');
    }

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();
    if (!token || !phoneId) {
      throw new HttpsError('failed-precondition', 'WhatsApp API não configurada no servidor.');
    }

    const result = await sendWhatsAppRaw(token, phoneId, to, message);
    if (!result.success) {
      logger.error('Erro da WhatsApp API', result.error);
      throw new HttpsError('internal', 'Falha ao enviar mensagem no WhatsApp.');
    }
    return { success: true, id: result.id };
  },
);

/**
 * placesAutocomplete / placesDetails — proxy da Google Places API.
 *
 * Mesma lógica de segurança do `sendWhatsApp`: a chave da API do Google
 * fica só no servidor (secret), o app nunca a carrega. Sem isso, qualquer
 * pessoa poderia extrair a chave do APK e usar a cota (e o cartão) do
 * Gustavo. Requer a "Places API" (legada) habilitada no Google Cloud
 * Console do mesmo projeto do Firebase.
 */
exports.placesAutocomplete = onCall(
  { secrets: [GOOGLE_PLACES_API_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }
    const input = String(request.data?.input || '').trim();
    if (input.length < 3) {
      return { predictions: [] };
    }

    const apiKey = GOOGLE_PLACES_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Geocoding não configurado no servidor.');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('components', 'country:br');
    url.searchParams.set('types', 'address');

    try {
      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        logger.error('Erro da Places Autocomplete API', data.status, data.error_message);
        throw new HttpsError('internal', 'Falha ao buscar endereços.');
      }
      const predictions = (data.predictions || []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
      }));
      return { predictions };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Erro ao chamar Places Autocomplete', error);
      throw new HttpsError('internal', 'Falha ao buscar endereços.');
    }
  },
);

exports.placesDetails = onCall(
  { secrets: [GOOGLE_PLACES_API_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar logado.');
    }
    const placeId = String(request.data?.placeId || '').trim();
    if (!placeId) {
      throw new HttpsError('invalid-argument', 'Campo "placeId" é obrigatório.');
    }

    const apiKey = GOOGLE_PLACES_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Geocoding não configurado no servidor.');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('fields', 'formatted_address,geometry');

    try {
      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status !== 'OK') {
        logger.error('Erro da Places Details API', data.status, data.error_message);
        throw new HttpsError('internal', 'Falha ao obter detalhes do endereço.');
      }
      const result = data.result || {};
      return {
        formattedAddress: result.formatted_address || null,
        latitude: result.geometry?.location?.lat ?? null,
        longitude: result.geometry?.location?.lng ?? null,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Erro ao chamar Places Details', error);
      throw new HttpsError('internal', 'Falha ao obter detalhes do endereço.');
    }
  },
);

/** Data local (YYYY-MM-DD) no fuso de São Paulo, com deslocamento de dias opcional. */
function dataSaoPaulo(deslocamentoDias = 0) {
  const agora = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  );
  agora.setDate(agora.getDate() + deslocamentoDias);
  return [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * lembretesAgendamento — item 18 da auditoria (reduz no-show).
 *
 * Nível 1 (D-1): roda todos os dias às 18h (horário de Brasília) e avisa,
 * por push E WhatsApp, cada cliente com agendamento CONFIRMADO no dia
 * seguinte. O push usa usuarios/{uid}.fcmToken; o WhatsApp usa
 * agendamento.clienteTelefone (com fallback silencioso se ausente/indisponível).
 */
exports.lembretesAgendamento = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER],
  },
  async () => {
    const db = admin.firestore();
    const amanha = dataSaoPaulo(1);

    const snap = await db
      .collection('agendamentos')
      .where('data', '==', amanha)
      .where('status', '==', 'confirmado')
      .get();

    if (snap.empty) {
      logger.info(`Sem agendamentos confirmados para ${amanha}.`);
      return;
    }

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();
    const twilioSid = TWILIO_ACCOUNT_SID.value();
    const twilioToken = TWILIO_AUTH_TOKEN.value();
    const twilioFrom = TWILIO_FROM_NUMBER.value();
    const smsConfigurado = !!(twilioSid && twilioToken && twilioFrom);

    let pushEnviados = 0;
    let whatsappEnviados = 0;
    let smsEnviados = 0;

    for (const docSnap of snap.docs) {
      const ag = docSnap.data();

      // Push
      if (ag.clienteUid) {
        try {
          const userSnap = await db.collection('usuarios').doc(ag.clienteUid).get();
          const fcmToken = userSnap.exists ? userSnap.data().fcmToken : null;
          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: {
                title: '💈 Lembrete de agendamento',
                body: `Amanhã às ${ag.horario} com ${ag.barbeiroNome}. Até lá!`,
              },
              data: {
                type: 'lembrete_agendamento',
                agendamentoId: docSnap.id,
              },
            });
            pushEnviados++;
          }
        } catch (error) {
          // Token inválido/expirado não deve interromper os demais envios
          logger.warn(`Falha ao notificar (push) ${ag.clienteUid}: ${error.message}`);
        }
      }

      // WhatsApp (fallback caso o cliente não tenha push habilitado)
      let whatsappOk = false;
      if (token && phoneId && ag.clienteTelefone) {
        const mensagem = `Olá ${ag.clienteNome || ''}! 👋\n\n🔔 Lembrete: seu agendamento é amanhã!\n\n👨‍💼 Barbeiro: ${ag.barbeiroNome}\n📅 Data: ${ag.data}\n🕐 Horário: ${ag.horario}\n\nTe esperamos! 💪`;
        const result = await sendWhatsAppRaw(token, phoneId, ag.clienteTelefone, mensagem);
        if (result.success) {
          whatsappEnviados++;
          whatsappOk = true;
        } else {
          logger.warn(`Falha ao notificar (WhatsApp) ${ag.clienteTelefone}`, result.error);
        }
      }

      // SMS — só como fallback quando o WhatsApp não foi entregue, para não
      // duplicar a mesma notificação em dois canais.
      if (!whatsappOk && smsConfigurado && ag.clienteTelefone) {
        const mensagemSms = `Barbershop: lembrete do seu agendamento amanha as ${ag.horario} com ${ag.barbeiroNome}.`;
        const result = await sendSmsRaw(twilioSid, twilioToken, twilioFrom, ag.clienteTelefone, mensagemSms);
        if (result.success) {
          smsEnviados++;
        } else {
          logger.warn(`Falha ao notificar (SMS) ${ag.clienteTelefone}`, result.error);
        }
      }
    }

    logger.info(
      `Lembretes D-1: push ${pushEnviados}/${snap.size}, WhatsApp ${whatsappEnviados}/${snap.size}, SMS ${smsEnviados}/${snap.size} para ${amanha}.`,
    );
  },
);

/**
 * lembretes2Horas — segundo nível de lembrete (H-2), inspirado no padrão de
 * dois avisos usado por concorrentes (Masters). Roda a cada 15 minutos e
 * notifica clientes com agendamento CONFIRMADO faltando entre 105 e 135
 * minutos (janela de ~30min em torno de "2 horas antes", compatível com a
 * granularidade do agendador). Usa o campo `lembrete2hEnviadoEm` no próprio
 * documento para nunca notificar duas vezes o mesmo agendamento.
 */
exports.lembretes2Horas = onSchedule(
  {
    schedule: '*/15 * * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER],
  },
  async () => {
    const db = admin.firestore();
    const hoje = dataSaoPaulo(0);

    const snap = await db
      .collection('agendamentos')
      .where('data', '==', hoje)
      .where('status', '==', 'confirmado')
      .get();

    if (snap.empty) return;

    const agoraSP = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );
    const agoraMin = agoraSP.getHours() * 60 + agoraSP.getMinutes();

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();
    const twilioSid = TWILIO_ACCOUNT_SID.value();
    const twilioToken = TWILIO_AUTH_TOKEN.value();
    const twilioFrom = TWILIO_FROM_NUMBER.value();
    const smsConfigurado = !!(twilioSid && twilioToken && twilioFrom);

    let pushEnviados = 0;
    let whatsappEnviados = 0;
    let smsEnviados = 0;

    for (const docSnap of snap.docs) {
      const ag = docSnap.data();
      if (ag.lembrete2hEnviadoEm) continue; // já notificado
      if (!ag.horario) continue;

      const [hh, mm] = String(ag.horario).split(':').map(Number);
      const horarioMin = hh * 60 + (mm || 0);
      const faltamMin = horarioMin - agoraMin;

      // Janela de ~105 a ~135 minutos antes do horário (centrada em 2h)
      if (faltamMin < 105 || faltamMin > 135) continue;

      let notificou = false;
      let whatsappOk = false;

      if (ag.clienteUid) {
        try {
          const userSnap = await db.collection('usuarios').doc(ag.clienteUid).get();
          const fcmToken = userSnap.exists ? userSnap.data().fcmToken : null;
          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: {
                title: '💈 Seu horário está chegando',
                body: `Hoje às ${ag.horario} com ${ag.barbeiroNome}. Nos vemos em breve!`,
              },
              data: { type: 'lembrete_2h', agendamentoId: docSnap.id },
            });
            pushEnviados++;
            notificou = true;
          }
        } catch (error) {
          logger.warn(`Falha ao notificar (push 2h) ${ag.clienteUid}: ${error.message}`);
        }
      }

      if (token && phoneId && ag.clienteTelefone) {
        const mensagem = `Olá ${ag.clienteNome || ''}! 👋\n\n🔔 Faltam cerca de 2 horas para o seu horário!\n\n👨‍💼 Barbeiro: ${ag.barbeiroNome}\n🕐 Horário: ${ag.horario}\n\nAté já! 💈`;
        const result = await sendWhatsAppRaw(token, phoneId, ag.clienteTelefone, mensagem);
        if (result.success) {
          whatsappEnviados++;
          notificou = true;
          whatsappOk = true;
        } else {
          logger.warn(`Falha ao notificar (WhatsApp 2h) ${ag.clienteTelefone}`, result.error);
        }
      }

      if (!whatsappOk && smsConfigurado && ag.clienteTelefone) {
        const mensagemSms = `Barbershop: faltam cerca de 2h para seu horario as ${ag.horario} com ${ag.barbeiroNome}.`;
        const result = await sendSmsRaw(twilioSid, twilioToken, twilioFrom, ag.clienteTelefone, mensagemSms);
        if (result.success) {
          smsEnviados++;
          notificou = true;
        } else {
          logger.warn(`Falha ao notificar (SMS 2h) ${ag.clienteTelefone}`, result.error);
        }
      }

      if (notificou) {
        await docSnap.ref.update({ lembrete2hEnviadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    if (pushEnviados || whatsappEnviados || smsEnviados) {
      logger.info(`Lembretes H-2: push ${pushEnviados}, WhatsApp ${whatsappEnviados}, SMS ${smsEnviados} para ${hoje}.`);
    }
  },
);

/**
 * relatorioSemanalEmail — envia todo segunda-feira, às 8h (horário de
 * Brasília), um resumo dos últimos 7 dias por email a cada barbeiro com
 * login próprio (profissionais de equipe sem conta — Opção A — não têm
 * email cadastrado e são pulados). Usa SMTP do Gmail (secrets EMAIL_USER =
 * endereço, EMAIL_PASS = senha de app, NÃO a senha normal da conta).
 *
 * Só envia para quem teve pelo menos um agendamento (concluído ou
 * cancelado) na semana — evita mandar relatório vazio toda semana.
 */
exports.relatorioSemanalEmail = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    secrets: [EMAIL_USER, EMAIL_PASS],
  },
  async () => {
    const db = admin.firestore();
    const emailUser = EMAIL_USER.value();
    const emailPass = EMAIL_PASS.value();

    if (!emailUser || !emailPass) {
      logger.info('Relatório semanal: EMAIL_USER/EMAIL_PASS não configurados, pulando.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    const hoje = dataSaoPaulo(0);
    const seteDiasAtras = dataSaoPaulo(-7);

    const barbeirosSnap = await db.collection('barbeiros').get();
    let relatoriosEnviados = 0;

    for (const barbeiroDoc of barbeirosSnap.docs) {
      const barbeiroId = barbeiroDoc.id;
      const barbeiro = barbeiroDoc.data();

      // Profissionais de equipe sem login próprio (Opção A) não têm doc em
      // `usuarios` nem email — nada a enviar.
      const usuarioSnap = await db.collection('usuarios').doc(barbeiroId).get();
      if (!usuarioSnap.exists) continue;
      const email = usuarioSnap.data().email;
      if (!email) continue;

      const agSnap = await db
        .collection('agendamentos')
        .where('barbeiroId', '==', barbeiroId)
        .where('data', '>=', seteDiasAtras)
        .where('data', '<=', hoje)
        .get();

      let concluidos = 0;
      let cancelados = 0;
      let faturamentoCentavos = 0;
      const clientesUnicos = new Set();

      agSnap.docs.forEach((d) => {
        const ag = d.data();
        if (ag.status === 'concluido') {
          concluidos++;
          faturamentoCentavos += ag.precoEmCentavos || 0;
          if (ag.clienteNome) clientesUnicos.add(ag.clienteNome);
        }
        if (ag.status === 'cancelado') cancelados++;
      });

      if (concluidos === 0 && cancelados === 0) continue; // nada a reportar essa semana

      const faturamento = (faturamentoCentavos / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      const nomeBarbeiro = barbeiro.nome || 'Barbeiro';
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0F1923;">💈 Seu relatório semanal</h2>
          <p>Olá, ${nomeBarbeiro}! Aqui está o resumo dos últimos 7 dias (${seteDiasAtras} a ${hoje}):</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding:8px 0; color:#555;">✅ Atendimentos concluídos</td><td style="text-align:right; font-weight:bold;">${concluidos}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">❌ Cancelamentos</td><td style="text-align:right; font-weight:bold;">${cancelados}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">👥 Clientes atendidos</td><td style="text-align:right; font-weight:bold;">${clientesUnicos.size}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">💰 Faturamento</td><td style="text-align:right; font-weight:bold; color:#16A34A;">${faturamento}</td></tr>
          </table>
          <p style="color:#888; font-size:12px;">Relatório automático do Barbershop. Continue acompanhando sua agenda pelo app.</p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `Barbershop <${emailUser}>`,
          to: email,
          subject: `📊 Seu relatório semanal — ${nomeBarbeiro}`,
          html,
        });
        relatoriosEnviados++;
      } catch (error) {
        logger.warn(`Falha ao enviar relatório semanal para ${email}`, error.message);
      }
    }

    logger.info(`Relatório semanal: ${relatoriosEnviados} email(s) enviado(s).`);
  },
);
