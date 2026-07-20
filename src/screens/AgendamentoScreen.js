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
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import PaymentModal from '../components/PaymentModal';
import CalendarService from '../services/CalendarService';
import { getNextDays } from '../utils/dateUtils';

export default function AgendamentoScreen({ route, navigation }) {
  const { barbeiro } = route.params;
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdAgendamento, setCreatedAgendamento] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Horários disponíveis (9h às 18h)
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
    if (selectedDate) {
      fetchHorariosOcupados();
    }
  }, [selectedDate]);

  const fetchUserProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchHorariosOcupados = async () => {
    setLoadingHorarios(true);
    try {
      const q = query(
        collection(db, 'agendamentos'),
        where('barbeiroId', '==', barbeiro.id),
        where('data', '==', selectedDate),
        where('status', 'in', ['pendente', 'confirmado']),
      );

      const querySnapshot = await getDocs(q);
      const agendamentos = querySnapshot.docs.map((d) => d.data());
      const horariosOcupados = agendamentos.map((ag) => ag.horario);
      const horariosDisponiveis = horariosPadrao.filter(
        (h) => !horariosOcupados.includes(h),
      );

      setAvailableTimes(horariosDisponiveis);
      setSelectedTime(null); // Resetar horário ao trocar de data
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableTimes(horariosPadrao); // Fallback: mostrar todos
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

      // Salvar no Firestore
      await addDoc(collection(db, 'agendamentos'), novoAgendamento);

      setCreatedAgendamento(novoAgendamento);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Erro ao agendar:', error);
      Alert.alert('Erro', 'Não foi possível realizar o agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentResult) => {
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

      // CORRIGIDO: usa `createdAgendamento` (state) em vez de `novoAgendamento` (indefinido)
      const agendamentoParaCalendario = createdAgendamento;

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
              await CalendarService.addAgendamentoToCalendar(agendamentoParaCalendario);
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
    <ScrollView style={styles.container}>
      {/* Cabeçalho do barbeiro */}
      <View style={styles.header}>
        <Text style={styles.title}>Agendar com {barbeiro.nome}</Text>
        <Text style={styles.subtitle}>{barbeiro.especialidade || 'Corte e barba'}</Text>
        <Text style={styles.price}>R$ {barbeiro.preco || '25,00'}</Text>
      </View>

      {/* Seleção de data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selecione a Data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {availableDates.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateButton,
                selectedDate === day.date && styles.selectedDateButton,
              ]}
              onPress={() => setSelectedDate(day.date)}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  selectedDate === day.date && styles.selectedDateButtonText,
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selecione o Horário</Text>

          {loadingHorarios ? (
            <View style={styles.loadingHorarios}>
              <ActivityIndicator color="#3498db" />
              <Text style={styles.loadingHorariosText}>Verificando disponibilidade...</Text>
            </View>
          ) : availableTimes.length > 0 ? (
            <View style={styles.timeGrid}>
              {availableTimes.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeButton,
                    selectedTime === time && styles.selectedTimeButton,
                  ]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text
                    style={[
                      styles.timeButtonText,
                      selectedTime === time && styles.selectedTimeButtonText,
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noTimesContainer}>
              <Text style={styles.noTimesText}>
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
        <View style={styles.confirmSection}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo do Agendamento</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Barbeiro:</Text>
              <Text style={styles.summaryValue}>{barbeiro.nome}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Data:</Text>
              <Text style={styles.summaryValue}>{selectedDate}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Horário:</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Serviço:</Text>
              <Text style={styles.summaryValue}>
                {barbeiro.especialidade || 'Corte e barba'}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total:</Text>
              <Text style={styles.summaryPrice}>R$ {barbeiro.preco || '25,00'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
            onPress={confirmarAgendamento}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmar Agendamento</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  dateScroll: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedDateButton: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  dateButtonText: {
    fontSize: 13,
    color: '#495057',
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
    color: '#7f8c8d',
    fontSize: 14,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minWidth: 70,
  },
  selectedTimeButton: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#495057',
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
    color: '#7f8c8d',
    textAlign: 'center',
  },
  confirmSection: {
    margin: 16,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#7f8c8d',
  },
  summaryValue: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  confirmButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
