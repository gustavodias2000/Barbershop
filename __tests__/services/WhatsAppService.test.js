import WhatsAppService from '../../src/services/WhatsAppService';
import { Alert, Linking } from 'react-native';

// Mock React Native modules
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn()
  },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

// WhatsAppService.sendTextMessage tenta primeiro a Cloud Function
// `sendWhatsApp` (token no servidor) — o jest.setup.js global já mocka
// `firebase/functions` pra sempre rejeitar, exercitando o fallback local
// (Linking) testado abaixo. Ver comentário em jest.setup.js.

describe('WhatsAppService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('formatPhoneNumber', () => {
    it('should format Brazilian phone number correctly', () => {
      const formatted = WhatsAppService.formatPhoneNumber('11999999999');
      expect(formatted).toBe('5511999999999');
    });

    it('should keep already formatted number', () => {
      const formatted = WhatsAppService.formatPhoneNumber('5511999999999');
      expect(formatted).toBe('5511999999999');
    });

    it('should handle phone with special characters', () => {
      const formatted = WhatsAppService.formatPhoneNumber('(11) 99999-9999');
      expect(formatted).toBe('5511999999999');
    });
  });

  describe('gerarMensagemAgendamento', () => {
    it('should generate correct appointment message', () => {
      const barbeiro = {
        nome: 'João Silva',
        especialidade: 'Corte e barba'
      };
      const cliente = { nome: 'Maria' };
      const data = '2024-01-15';
      const horario = '14:00';

      const mensagem = WhatsAppService.gerarMensagemAgendamento(
        barbeiro, cliente, data, horario
      );

      expect(mensagem).toContain('João Silva');
      expect(mensagem).toContain('Maria');
      expect(mensagem).toContain('2024-01-15');
      expect(mensagem).toContain('14:00');
      expect(mensagem).toContain('Corte e barba');
    });
  });

  describe('sendTextMessage', () => {
    it('should use fallback when Cloud Function is not available', async () => {
      // A Cloud Function está mockada pra rejeitar (jest.setup.js), então
      // cai direto no fallback: abrir o WhatsApp via Linking.openURL.
      Linking.openURL.mockResolvedValue(true);

      const result = await WhatsAppService.sendTextMessage(
        '11999999999',
        'Teste'
      );

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('whatsapp://send?phone=5511999999999')
      );
    });

    it('should show alert when WhatsApp is not installed', async () => {
      // Falha tanto o link direto (whatsapp://) quanto o fallback web
      // (wa.me) — só aí o serviço desiste e mostra o alerta.
      Linking.openURL.mockRejectedValue(new Error('não instalado'));

      const result = await WhatsAppService.sendTextMessage(
        '11999999999',
        'Teste'
      );

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'WhatsApp não encontrado',
        'Não foi possível abrir o WhatsApp. Verifique se ele está instalado.'
      );
    });
  });

  describe('gerarMensagemConfirmacao', () => {
    it('should generate correct confirmation message', () => {
      const cliente = { nome: 'Maria' };
      const data = '2024-01-15';
      const horario = '14:00';
      const barbeiroNome = 'João';

      const mensagem = WhatsAppService.gerarMensagemConfirmacao(
        cliente, data, horario, barbeiroNome
      );

      expect(mensagem).toContain('Maria');
      expect(mensagem).toContain('confirmado');
      expect(mensagem).toContain('João');
      expect(mensagem).toContain('2024-01-15');
      expect(mensagem).toContain('14:00');
    });
  });
});