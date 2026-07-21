/**
 * PaymentService — versão simplificada sem Stripe.
 * O pagamento é confirmado presencialmente ou via PIX/transferência.
 * Para integrar o Stripe no futuro, configure as chaves reais e
 * reinstale @stripe/stripe-react-native.
 */
import type { Agendamento } from '../types';

export interface PaymentResult {
  success: boolean;
  amount: number;
  paymentMethod: 'presential';
}

export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
}

class PaymentService {
  readonly isInitialized = true;

  /**
   * Confirma agendamento sem processar pagamento online.
   * O cliente paga presencialmente (dinheiro, PIX, cartão na maquininha).
   */
  async processPayment(
    _agendamento: Partial<Agendamento> | null,
    amount: number,
  ): Promise<PaymentResult> {
    return {
      success: true,
      amount: amount / 100,
      paymentMethod: 'presential',
    };
  }

  validateConfiguration(): PaymentValidation {
    return { isValid: true, errors: [] };
  }

  /**
   * Formata valor em centavos para exibição em BRL.
   */
  formatCurrency(amountInCents: number): string {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  }

  /**
   * Converte valor em reais para centavos.
   */
  convertToCents(amountInReais: number): number {
    return Math.round(amountInReais * 100);
  }
}

export default new PaymentService();
