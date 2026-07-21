import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import PaymentService, { type PaymentResult } from '../services/PaymentService';
import { precoParaCentavos } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NovoAgendamento } from '../types';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  agendamento: NovoAgendamento | null;
  onPaymentSuccess?: (result: PaymentResult) => void;
}

export default function PaymentModal({
  visible,
  onClose,
  agendamento,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Aceita tanto o campo novo (precoEmCentavos: int) quanto o legado (preco: string)
  const precoEmCentavos =
    agendamento?.precoEmCentavos ?? precoParaCentavos(agendamento?.preco);

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      const result = await PaymentService.processPayment(agendamento, precoEmCentavos);
      
      if (result.success) {
        Alert.alert(
          'Pagamento Realizado!',
          `Pagamento de ${PaymentService.formatCurrency(precoEmCentavos)} realizado com sucesso!`,
          [
            {
              text: 'OK',
              onPress: () => {
                onPaymentSuccess && onPaymentSuccess(result);
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert('Erro', 'Erro no processamento do pagamento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível processar o pagamento');
    } finally {
      setLoading(false);
    }
  };

  const validateAndPay = () => {
    const validation = PaymentService.validateConfiguration();
    
    if (!validation.isValid) {
      Alert.alert(
        'Configuração Incompleta',
        'Sistema de pagamentos não configurado:\n\n' + validation.errors.join('\n'),
        [
          {
            text: 'Pagar Presencialmente',
            onPress: () => {
              Alert.alert(
                'Pagamento Presencial',
                'O pagamento será realizado presencialmente no estabelecimento.',
                [{ text: 'OK', onPress: onClose }]
              );
            }
          },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
      return;
    }

    handlePayment();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Confirmar Pagamento</Text>
          
          <View style={styles.agendamentoInfo}>
            <Text style={styles.infoLabel}>Barbeiro:</Text>
            <Text style={styles.infoValue}>{agendamento?.barbeiroNome}</Text>
            
            <Text style={styles.infoLabel}>Data:</Text>
            <Text style={styles.infoValue}>{agendamento?.data}</Text>
            
            <Text style={styles.infoLabel}>Horário:</Text>
            <Text style={styles.infoValue}>{agendamento?.horario}</Text>
            
            <Text style={styles.infoLabel}>Serviço:</Text>
            <Text style={styles.infoValue}>{agendamento?.servico || 'Corte e barba'}</Text>
          </View>

          <View style={styles.precoContainer}>
            <Text style={styles.precoLabel}>Total a pagar:</Text>
            <Text style={styles.precoValue}>
              {PaymentService.formatCurrency(precoEmCentavos)}
            </Text>
          </View>

          <View style={styles.paymentMethods}>
            <Text style={styles.methodsTitle}>Métodos de pagamento:</Text>
            <Text style={styles.methodsText}>• Cartão de crédito</Text>
            <Text style={styles.methodsText}>• Cartão de débito</Text>
            <Text style={styles.methodsText}>• PIX</Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.payButton]}
              onPress={validateAndPay}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>Pagar Agora</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.securityText}>
            🔒 Pagamento realizado no estabelecimento
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 24,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  agendamentoInfo: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  infoValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  precoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: theme.colors.success + '20',
    borderRadius: 8,
  },
  precoLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  precoValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.success,
    marginTop: 4,
  },
  paymentMethods: {
    marginBottom: 20,
  },
  methodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  methodsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: theme.colors.success,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  securityText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});