/**
 * CalendarService — adiciona agendamentos ao calendário do usuário.
 *
 * CORREÇÃO (migração TS): a versão anterior importava
 * `react-native-calendar-events`, que NÃO estava instalado no projeto —
 * o TypeScript flagrou a dependência fantasma. Esta versão usa o link
 * universal do Google Agenda via Linking: zero dependências nativas,
 * funciona em qualquer aparelho com o app ou navegador.
 */
import { Alert, Linking } from 'react-native';
import type { Agendamento } from '../types';

type AgendamentoCalendario = Pick<
  Agendamento,
  'data' | 'horario' | 'barbeiroNome' | 'servico'
>;

/** Formata Date para o padrão do Google Calendar: YYYYMMDDTHHMMSS (hora local) */
const toGCalDate = (d: Date): string =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    'T',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    '00',
  ].join('');

class CalendarService {
  /**
   * Abre o Google Agenda com o evento pré-preenchido para o usuário salvar.
   */
  async addAgendamentoToCalendar(
    agendamento: AgendamentoCalendario,
  ): Promise<boolean> {
    try {
      const start = new Date(`${agendamento.data}T${agendamento.horario}:00`);
      if (isNaN(start.getTime())) {
        Alert.alert('Erro', 'Data do agendamento inválida.');
        return false;
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hora

      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `Barbershop - ${agendamento.barbeiroNome}`,
        dates: `${toGCalDate(start)}/${toGCalDate(end)}`,
        details: `Agendamento com ${agendamento.barbeiroNome}\nServiço: ${
          agendamento.servico || 'Corte e barba'
        }`,
        location: 'Barbershop',
      });

      const url = `https://calendar.google.com/calendar/render?${params.toString()}`;

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Erro', 'Não foi possível abrir o calendário.');
        return false;
      }

      await Linking.openURL(url);
      return true;
    } catch (error) {
      console.error('Erro ao adicionar ao calendário:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o agendamento ao calendário.');
      return false;
    }
  }
}

export default new CalendarService();
