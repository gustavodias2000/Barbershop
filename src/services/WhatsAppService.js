import { Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { WHATSAPP_CONFIG, validateConfig } from './WhatsAppConfig';

class WhatsAppService {
  constructor() {
    // Usar configuração do arquivo de config
    this.config = {
      accessToken: WHATSAPP_CONFIG.ACCESS_TOKEN,
      phoneNumberId: WHATSAPP_CONFIG.PHONE_NUMBER_ID,
      version: WHATSAPP_CONFIG.API_VERSION,
      baseUrl: WHATSAPP_CONFIG.BASE_URL,
      templates: WHATSAPP_CONFIG.TEMPLATES,
      fallback: WHATSAPP_CONFIG.FALLBACK
    };
    
    // Validar configuração na inicialização
    this.validation = validateConfig();
    
    if (this.config.fallback.DEBUG_MODE) {
      console.log('WhatsApp Service initialized:', this.validation);
    }
  }

  /**
   * Configura as credenciais da API do WhatsApp Business
   * @param {string} accessToken - Token de acesso
   * @param {string} phoneNumberId - ID do número de telefone
   */
  configure(accessToken, phoneNumberId) {
    this.config.accessToken = accessToken;
    this.config.phoneNumberId = phoneNumberId;
  }

  /**
   * Envia uma mensagem de texto via WhatsApp Business API
   * @param {string} to - Número de telefone do destinatário (formato: 5511999999999)
   * @param {string} message - Mensagem a ser enviada
   * @returns {Promise<boolean>} - Sucesso ou falha do envio
   */
  async sendTextMessage(to, message) {
    // O envio agora acontece via Cloud Function (`sendWhatsApp`), que guarda
    // o token no servidor. O app NÃO carrega mais o token do WhatsApp.
    try {
      const sendWhatsApp = httpsCallable(functions, 'sendWhatsApp');
      await sendWhatsApp({ to, message });
      return true;
    } catch (error) {
      if (this.config.fallback.DEBUG_MODE) {
        console.warn('Cloud Function do WhatsApp indisponível, usando fallback:', error?.message);
      }
      // Fallback: abre o WhatsApp no aparelho com a mensagem pronta.
      // Útil enquanto a função não está publicada ou em caso de erro.
      if (this.config.fallback.USE_DIRECT_LINK) {
        return this.fallbackToDirectLink(to, message);
      }
      return false;
    }
  }

  /**
   * Envia uma mensagem usando template aprovado
   * @param {string} to - Número de telefone do destinatário
   * @param {string} templateName - Nome do template aprovado
   * @param {Array} parameters - Parâmetros do template (opcional)
   * @returns {Promise<boolean>} - Sucesso ou falha do envio
   */
  async sendTemplateMessage(to, templateName, parameters = []) {
    try {
      if (!this.config.accessToken || this.config.accessToken === 'YOUR_ACCESS_TOKEN') {
        console.warn('WhatsApp API não configurada. Usando fallback.');
        return this.fallbackToDirectLink(to, `Template: ${templateName}`);
      }

      const url = `${this.config.baseUrl}/${this.config.version}/${this.config.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'pt_BR'
          }
        }
      };

      // Adicionar parâmetros se fornecidos
      if (parameters.length > 0) {
        payload.template.components = [
          {
            type: 'body',
            parameters: parameters.map(param => ({
              type: 'text',
              text: param
            }))
          }
        ];
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Template enviado com sucesso:', result);
        return true;
      } else {
        console.error('Erro ao enviar template:', result);
        return false;
      }
    } catch (error) {
      console.error('Erro na requisição de template:', error);
      return false;
    }
  }

  /**
   * Fallback para abrir WhatsApp diretamente (método anterior)
   * @param {string} phone - Número de telefone
   * @param {string} message - Mensagem
   * @returns {Promise<boolean>} - Sucesso ou falha
   */
  async fallbackToDirectLink(phone, message) {
    try {
      const { Linking } = require('react-native');
      
      // Remove caracteres especiais do telefone
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      
      // Adiciona código do país se não tiver
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      
      const url = `whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        Alert.alert(
          'WhatsApp não encontrado',
          'Por favor, instale o WhatsApp para enviar mensagens.'
        );
        return false;
      }
    } catch (error) {
      console.error('Erro no fallback WhatsApp:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
      return false;
    }
  }

  /**
   * Formata número de telefone para o padrão internacional
   * @param {string} phone - Número de telefone
   * @returns {string} - Número formatado
   */
  formatPhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // Se já tem código do país, retorna como está
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      return cleanPhone;
    }
    
    // Se tem 11 dígitos (celular brasileiro), adiciona código do país
    if (cleanPhone.length === 11) {
      return `55${cleanPhone}`;
    }
    
    // Se tem 10 dígitos (telefone fixo), adiciona código do país
    if (cleanPhone.length === 10) {
      return `55${cleanPhone}`;
    }
    
    // Retorna como está se não conseguir identificar o padrão
    return cleanPhone;
  }

  /**
   * Gera mensagem de agendamento
   * @param {Object} barbeiro - Dados do barbeiro
   * @param {Object} cliente - Dados do cliente
   * @param {string} data - Data do agendamento
   * @param {string} horario - Horário do agendamento
   * @returns {string} - Mensagem formatada
   */
  gerarMensagemAgendamento(barbeiro, cliente, data, horario) {
    return `Olá ${barbeiro.nome}! 👋

Sou ${cliente.nome} e gostaria de agendar um horário.

📅 Data: ${data}
🕐 Horário: ${horario}
💰 Serviço: ${barbeiro.especialidade || 'Corte e barba'}

Aguardo confirmação. Obrigado! 🙏`;
  }

  /**
   * Gera mensagem de confirmação
   * @param {Object} cliente - Dados do cliente
   * @param {string} data - Data do agendamento
   * @param {string} horario - Horário do agendamento
   * @param {string} barbeiroNome - Nome do barbeiro
   * @returns {string} - Mensagem formatada
   */
  gerarMensagemConfirmacao(cliente, data, horario, barbeiroNome) {
    return `Olá ${cliente.nome}! 👋

Seu agendamento foi confirmado! ✅

👨‍💼 Barbeiro: ${barbeiroNome}
📅 Data: ${data}
🕐 Horário: ${horario}

📍 Endereço: [Inserir endereço da barbearia]

Nos vemos em breve! 💪`;
  }

  /**
   * Gera mensagem de cancelamento
   * @param {Object} cliente - Dados do cliente
   * @param {string} data - Data do agendamento
   * @param {string} horario - Horário do agendamento
   * @param {string} motivo - Motivo do cancelamento (opcional)
   * @returns {string} - Mensagem formatada
   */
  gerarMensagemCancelamento(cliente, data, horario, motivo = '') {
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
   * Gera mensagem de lembrete
   * @param {Object} cliente - Dados do cliente
   * @param {string} data - Data do agendamento
   * @param {string} horario - Horário do agendamento
   * @param {string} barbeiroNome - Nome do barbeiro
   * @returns {string} - Mensagem formatada
   */
  gerarMensagemLembrete(cliente, data, horario, barbeiroNome) {
    return `Olá ${cliente.nome}! 👋

🔔 Lembrete do seu agendamento:

👨‍💼 Barbeiro: ${barbeiroNome}
📅 Data: ${data}
🕐 Horário: ${horario}

📍 Endereço: [Inserir endereço da barbearia]

Te esperamos! 💪`;
  }

  /**
   * Verifica se a API está configurada
   * @returns {boolean} - True se configurada
   */
  isConfigured() {
    return this.validation.isValid;
  }

  /**
   * Obtém informações de configuração (sem expor tokens)
   * @returns {Object} - Status da configuração
   */
  getConfigStatus() {
    return {
      configured: this.validation.isValid,
      errors: this.validation.errors,
      warnings: this.validation.warnings,
      version: this.config.version,
      fallbackEnabled: this.config.fallback.USE_DIRECT_LINK,
      debugMode: this.config.fallback.DEBUG_MODE
    };
  }
}

// Exportar instância singleton
export default new WhatsAppService();

