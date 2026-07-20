/**
 * PaymentService — versão simplificada sem Stripe.
 * O pagamento é confirmado presencialmente ou via PIX/transferência.
 * Para integrar o Stripe no futuro, configure as chaves reais e
 * reinstale @stripe/stripe-react-native.
 */
class PaymentService {
  constructor() {
    this.isInitialized = true;
  }

  /**
   * Confirma agendamento sem processar pagamento online.
   * O cliente paga presencialmente (dinheiro, PIX, cartão na maquininha).
   */
  async processPayment(agendamento, amount) {
    return {
      success: true,
      amount: amount / 100,
      paymentMethod: 'presential',
    };
  }

  validateConfiguration() {
    return { isValid: true, errors: [] };
  }

  /**
   * Formata valor em centavos para exibição em BRL.
   */
  formatCurrency(amountInCents) {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  }

  /**
   * Converte valor em reais para centavos.
   */
  convertToCents(amountInReais) {
    return Math.round(amountInReais * 100);
  }
}

export default new PaymentService();
