/**
 * Cloud Functions — Barbershop
 *
 * `sendWhatsApp`: envia mensagem via WhatsApp Business API a partir do
 * SERVIDOR. O token de acesso fica guardado como "secret" do Firebase e
 * NUNCA é embutido no app — assim ninguém consegue extraí-lo do APK.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

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
        logger.error('Erro da WhatsApp API', result);
        throw new HttpsError('internal', 'Falha ao enviar mensagem no WhatsApp.');
      }

      return { success: true, id: result?.messages?.[0]?.id || null };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Erro na requisição WhatsApp', error);
      throw new HttpsError('internal', 'Erro ao contatar o WhatsApp.');
    }
  },
);
