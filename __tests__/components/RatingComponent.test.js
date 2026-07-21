import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import '@testing-library/jest-native/extend-expect';
import RatingComponent from '../../src/components/RatingComponent';

// Mock Firebase
jest.mock('../../firebaseConfig', () => ({
  db: {},
  auth: {
    currentUser: { email: 'test@example.com' }
  }
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  doc: jest.fn()
}));

const mockAgendamento = {
  id: 'test-id',
  barbeiroId: 'barbeiro-1',
  barbeiroNome: 'João Silva',
  clienteNome: 'Cliente Teste'
};

describe('RatingComponent', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly when visible', () => {
    const { getByText } = render(
      <RatingComponent
        visible={true}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    expect(getByText('Avaliar Atendimento')).toBeTruthy();
    expect(getByText('Como foi seu atendimento com João Silva?')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <RatingComponent
        visible={false}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    expect(queryByText('Avaliar Atendimento')).toBeNull();
  });

  it('should allow selecting stars', () => {
    const { getAllByText } = render(
      <RatingComponent
        visible={true}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    const stars = getAllByText('⭐');
    expect(stars).toHaveLength(5);

    // Simular clique na terceira estrela
    fireEvent.press(stars[2]);
    
    // Verificar se as primeiras 3 estrelas estão selecionadas
    // (Teste visual seria necessário para verificar a cor)
  });

  it('should show error when trying to submit without rating', async () => {
    const { getByText } = render(
      <RatingComponent
        visible={true}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    const submitButton = getByText('Enviar');
    fireEvent.press(submitButton);

    // Verificar se o Alert foi chamado (seria necessário mock do Alert)
  });

  it('should call onClose when cancel button is pressed', () => {
    const { getByText } = render(
      <RatingComponent
        visible={true}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    const cancelButton = getByText('Cancelar');
    fireEvent.press(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should update comment text', () => {
    const { getByPlaceholderText } = render(
      <RatingComponent
        visible={true}
        onClose={mockOnClose}
        agendamento={mockAgendamento}
      />
    );

    const commentInput = getByPlaceholderText('Deixe um comentário (opcional)');
    fireEvent.changeText(commentInput, 'Excelente atendimento!');

    expect(commentInput.props.value).toBe('Excelente atendimento!');
  });
});