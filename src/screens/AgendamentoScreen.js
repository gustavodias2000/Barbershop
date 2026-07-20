import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import PaymentModal from '../components/PaymentModal';
import CalendarService from '../services/CalendarService';
import { getHorariosOcupados, marcarOcupado } from '../services/OcupacaoService';
import { getNextDays } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';

export default function AgendamentoScreen({ route, navigation }) {
  const { barbeiro } = route.params;
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdAgendamento, setCreatedAgendamento] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const horariosPadrao = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ];

  const availableDates = getNextDays(7);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (selectedDate) fetchHorariosOcupados();
  }, [selectedDate]);

  const fetchUserProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) setUserProfile(userDoc.data());
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchHorariosOcupados = async () => {
    setLoadingHorarios(true);
    try {
      const horariosOcupados = await getHorariosOcupados(barbeiro.id, selectedDate);
      setAvailableTimes(horariosPadrao.filter((h) => !horariosOcupados.includes(h)));
      setSelectedTime(null);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableTimes(horariosPadrao);
    } finally {
      setLoadingHorarios(false);
    }
  };

  const confirmarAgendamento = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Atenção', 'Selecione uma data e um horário.');
      return;
    }

    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      const clienteNome = userProfile?.nome || userEmail.split('@')[0];
      const clienteTelefone = userProfile?.telefone || '';
      const barbeiroTelefone = barbeiro.telefone || '';

      const novoAgendamento = {
        barbeiroId: barbeiro.id,
        barbeiroNome: barbeiro.nome,
        barbeiroTelefone,
        cliente: userEmail,
        clienteUid: auth.currentUser?.uid || '',
        clienteNome,
        clienteTelefone,
        status: 'pendente',
        createdAt: new Date(),
        data: selectedDate,
        horario: selectedTime,
        servico: barbeiro.especialidade || 'Corte e barba',
        preco: barbeiro.preco || '25,00',
      };

      await addDoc(collection(db, 'agendamentos'), novoAgendamento);
      await marcarOcupado(barbeiro.id, selectedDate, selectedTime);

      setCreatedAgendamento(novoAgendamento);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Erro ao agendar:', error);
      Alert.alert('Erro', 'Não foi possível realizar o agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      if (!createdAgendamento) return;

      const clienteInfo = {
        nome: createdAgendamento.clienteNome,
        email: auth.currentUser?.email,
      };

      const mensagem = WhatsAppService.gerarMensagemAgendamento(
        { ...barbeiro, telefone: createdAgendamento.barbeiroTelefone },
        clienteInfo,
        createdAgendamento.data,
        createdAgendamento.horario,
      );

      const barbeiroPhone = createdAgendamento.barbeiroTelefone;
      const whatsappEnviado = barbeiroPhone
        ? await WhatsAppService.sendTextMessage(barbeiroPhone, mensagem)
        : false;

      Alert.alert(
        whatsappEnviado ? 'Sucesso!' : 'Agendamento Pago',
        whatsappEnviado
          ? 'Agendamento pago e confirmado! Mensagem enviada via WhatsApp.'
          : 'Agendamento pago com sucesso! Entre em contato para confirmar.',
        [
          { text: 'OK', onPress: () => navigation.goBack() },
          {
            text: 'Adicionar ao Calendário',
            onPress: async () => {
              await CalendarService.addAgendamentoToCalendar(createdAgendamento);
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error) {
      console.error('Erro pós-pagamento:', error);
      Alert.alert(
        'Pagamento realizado',
        'Agendamento pago, mas houve um erro ao enviar a mensagem.',
      );
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={s.container}>
        {/* Cabeçalho do barbeiro */}
        <View style={s.header}>
          <Text style={s.title}>Agendar com {barbeiro.nome}</Text>
          <Text style={s.subtitle}>{barbeiro.especialidade || 'Corte e barba'}</Text>
          <Text style={s.price}>R$ {barbeiro.preco || '25,00'}</Text>
        </View>

        {/* Seleção de data */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Selecione a Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
            {availableDates.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  s.dateButton,
                  selectedDate === day.date && s.selectedDateButton,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Data ${day.display}`}
                accessibilityState={{ selected: selectedDate === day.date }}
                onPress={() => setSelectedDate(day.date)}
              >
                <Text
                  style={[
                    s.dateButtonText,
                    selectedDate === day.date && s.selectedDateButtonText,
                  ]}
                >
                  {day.display}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Seleção de horário */}
        {selectedDate ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Selecione o Horário</Text>

            {loadingHorarios ? (
              <View style={s.loadingHorarios}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={s.loadingHorariosText}>Verificando disponibilidade...</Text>
              </View>
            ) : availableTimes.length > 0 ? (
              <View style={s.timeGrid}>
                {availableTimes.map((time, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      s.timeButton,
                      selectedTime === time && s.selectedTimeButton,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Horário ${time}`}
                    accessibilityState={{ selected: selectedTime === time }}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text
                      style={[
                        s.timeButtonText,
                        selectedTime === time && s.selectedTimeButtonText,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={s.noTimesContainer}>
                <Text style={s.noTimesText}>
                  Não há horários disponíveis para esta data. Escolha outro dia.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Modal de pagamento */}
        <PaymentModal
          visible={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setCreatedAgendamento(null);
            navigation.goBack();
          }}
          agendamento={createdAgendamento}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Resumo e botão confirmar */}
        {selectedDate && selectedTime ? (
          <View style={s.confirmSection}>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Resumo do Agendamento</Text>
              {[
                { label: 'Barbeiro', value: barbeiro.nome },
                { label: 'Data', value: selectedDate },
                { label: 'Horário', value: selectedTime },
                { label: 'Serviço', value: barbeiro.especialidade || 'Corte e barba' },
              ].map((row) => (
                <View key={row.label} style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{row.label}:</Text>
                  <Text style={s.summaryValue}>{row.value}</Text>
                </View>
              ))}
              <View style={[s.summaryRow, s.summaryTotal]}>
                <Text style={s.summaryTotalLabel}>Total:</Text>
                <Text style={s.summaryPrice}>R$ {barbeiro.preco || '25,00'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.confirmButton, loading && s.confirmButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Confirmar agendamento"
              accessibilityState={{ disabled: loading }}
              onPress={confirmarAgendamento}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.confirmButtonText}>Confirmar Agendamento</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  section: {
    backgroundColor: theme.colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  dateScroll: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedDateButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateButtonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  selectedDateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingHorarios: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  loadingHorariosText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 70,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedTimeButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  timeButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  selectedTimeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noTimesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noTimesText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  confirmSection: {
    margin: 16,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  confirmButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
