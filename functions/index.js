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

admin.initializeApp();

// Secrets configurados via `firebase functions:secrets:set` (ver GUIA no final)
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');

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
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID],
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

    let pushEnviados = 0;
    let whatsappEnviados = 0;

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
      if (token && phoneId && ag.clienteTelefone) {
        const mensagem = `Olá ${ag.clienteNome || ''}! 👋\n\n🔔 Lembrete: seu agendamento é amanhã!\n\n👨‍💼 Barbeiro: ${ag.barbeiroNome}\n📅 Data: ${ag.data}\n🕐 Horário: ${ag.horario}\n\nTe esperamos! 💪`;
        const result = await sendWhatsAppRaw(token, phoneId, ag.clienteTelefone, mensagem);
        if (result.success) {
          whatsappEnviados++;
        } else {
          logger.warn(`Falha ao notificar (WhatsApp) ${ag.clienteTelefone}`, result.error);
        }
      }
    }

    logger.info(
      `Lembretes D-1: push ${pushEnviados}/${snap.size}, WhatsApp ${whatsappEnviados}/${snap.size} para ${amanha}.`,
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
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID],
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

    let pushEnviados = 0;
    let whatsappEnviados = 0;

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
        } else {
          logger.warn(`Falha ao notificar (WhatsApp 2h) ${ag.clienteTelefone}`, result.error);
        }
      }

      if (notificou) {
        await docSnap.ref.update({ lembrete2hEnviadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    if (pushEnviados || whatsappEnviados) {
      logger.info(`Lembretes H-2: push ${pushEnviados}, WhatsApp ${whatsappEnviados} para ${hoje}.`);
    }
  },
);
