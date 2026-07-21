/**
 * WhatsAppService — envio de mensagens via WhatsApp.
 *
 * SEGURANÇA (item 5 da auditoria): o token da WhatsApp Business API vive
 * APENAS no servidor (Cloud Function `sendWhatsApp`, com secrets). O app
 * nunca carrega credenciais. Se a função estiver indisponível, o fallback
 * abre o WhatsApp do aparelho com a mensagem pronta.
 */
import { Alert, Linking } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';

interface PessoaInfo {
  nome: string;
  telefone?: string;
  email?: string;
}

interface BarbeiroInfo extends PessoaInfo {
  especialidade?: string;
}

const DEBUG_MODE: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const USE_DIRECT_LINK = true;

class WhatsAppService {
  /**
   * Envia uma mensagem de texto via Cloud Function (token no servidor).
   * @param to - Número do destinatário (ex.: 5511999999999)
   * @param message - Mensagem a ser enviada
   */
  async sendTextMessage(to: string, message: string): Promise<boolean> {
    try {
      const sendWhatsApp = httpsCallable(functions, 'sendWhatsApp');
      await sendWhatsApp({ to, message });
      return true;
    } catch (error: any) {
      if (DEBUG_MODE) {
        console.warn(
          'Cloud Function do WhatsApp indisponível, usando fallback:',
          error?.message,
        );
      }
      // Fallback: abre o WhatsApp no aparelho com a mensagem pronta.
      if (USE_DIRECT_LINK) {
        return this.fallbackToDirectLink(to, message);
      }
      return false;
    }
  }

  /**
   * Fallback: abre o WhatsApp instalado no aparelho com a mensagem pronta.
   *
   * NOTA: Linking.canOpenURL('whatsapp://...') retorna false no Android 11+
   * sem a declaração <queries> no AndroidManifest (já adicionada).
   * Mesmo assim preferimos abrir diretamente via openURL e capturar o erro:
   * é mais robusto e evita falso-negativo em alguns dispositivos.
   */
  async fallbackToDirectLink(phone: string, message: string): Promise<boolean> {
    try {
      const fullPhone = this.formatPhoneNumber(phone);
      const url = `whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;

      await Linking.openURL(url);
      return true;
    } catch (error) {
      console.error('Erro no fallback WhatsApp:', error);
      // Se o WhatsApp não estiver instalado, tenta o link web como último recurso
      try {
        const fullPhone = this.formatPhoneNumber(phone);
        const webUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
        return true;
      } catch {
        Alert.alert(
          'WhatsApp não encontrado',
          'Não foi possível abrir o WhatsApp. Verifique se ele está instalado.',
        );
        return false;
      }
    }
  }

  /**
   * Formata número de telefone para o padrão internacional brasileiro.
   */
  formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      return cleanPhone;
    }
    if (cleanPhone.length === 11 || cleanPhone.length === 10) {
      return `55${cleanPhone}`;
    }
    return cleanPhone;
  }

  /**
   * Gera mensagem de solicitação de agendamento (cliente → barbeiro).
   */
  gerarMensagemAgendamento(
    barbeiro: BarbeiroInfo,
    cliente: PessoaInfo,
    data: string,
    horario: string,
  ): string {
    return `Olá ${barbeiro.nome}! 👋

Sou ${cliente.nome} e gostaria de agendar um horário.

📅 Data: ${data}
🕐 Horário: ${horario}
💰 Serviço: ${barbeiro.especialidade || 'Corte e barba'}

Aguardo confirmação. Obrigado! 🙏`;
  }

  /**
   * Gera mensagem de confirmação (barbeiro → cliente).
   */
  gerarMensagemConfirmacao(
    cliente: PessoaInfo,
    data: string,
    horario: string,
    barbeiroNome: string,
  ): string {
    return `Olá ${cliente.nome}! 👋

Seu agendamento foi confirmado! ✅

👨‍💼 Barbeiro: ${barbeiroNome}
📅 Data: ${data}
🕐 Horário: ${horario}

📍 Endereço: [Inserir endereço da barbearia]

Nos vemos em breve! 💪`;
  }

  /**
   * Gera mensagem de cancelamento (barbeiro → cliente).
   */
  gerarMensagemCancelamento(
    cliente: PessoaInfo,
    data: string,
    horario: string,
    motivo: string = '',
  ): string {
    let mensagem = `Olá ${cliente.nome}! 👋

Infelizmente precisamos cancelar seu agendamento:

📅 Data: ${data}
🕐 Horário: ${horario}`;

    if (motivo) {
      mensagem += `\n\n❗ Motivo: ${motivo}`;
    }

    mensagem += `\n\nPor favor, reagende quando for conveniente. Obrigado pela compreensão! 🙏`;

    return mensagem;
  }

  /**
   * Gera mensagem de lembrete (barbeiro → cliente).
   */
  gerarMensagemLembrete(
    cliente: PessoaInfo,
    data: string,
    horario: string,
    barbeiroNome: string,
  ): string {
    return `Olá ${cliente.nome}! 👋

🔔 Lembrete do seu agendamento:

👨‍💼 Barbeiro: ${barbeiroNome}
📅 Data: ${data}
🕐 Horário: ${horario}

📍 Endereço: [Inserir endereço da barbearia]

Te esperamos! 💪`;
  }
}

// Exportar instância singleton
export default new WhatsAppService();
