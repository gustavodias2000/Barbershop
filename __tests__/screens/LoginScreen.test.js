import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import '@testing-library/jest-native/extend-expect';
import LoginScreen from '../../src/screens/LoginScreen';
import { ThemeProvider } from '../../src/context/ThemeContext';

const renderWithTheme = (ui) => render(<ThemeProvider>{ui}</ThemeProvider>);

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn()
}));

jest.mock('../../firebaseConfig', () => ({
  auth: {}
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form correctly', () => {
    const { getByText, getByPlaceholderText, getByLabelText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    expect(getByText('Barbershop')).toBeTruthy();
    expect(getByText('Entrar na conta')).toBeTruthy();
    expect(getByPlaceholderText('seu@email.com')).toBeTruthy();
    expect(getByPlaceholderText('Sua senha')).toBeTruthy();
    expect(getByLabelText('Entrar no aplicativo')).toBeTruthy();
  });

  it('should show error for invalid email', async () => {
    const { getByPlaceholderText, getByLabelText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('seu@email.com');
    const loginButton = getByLabelText('Entrar no aplicativo');

    fireEvent.changeText(emailInput, 'email-invalido');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText(/Email inválido/)).toBeTruthy();
    });
  });

  it('should show error for short password', async () => {
    const { getByPlaceholderText, getByLabelText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('seu@email.com');
    const passwordInput = getByPlaceholderText('Sua senha');
    const loginButton = getByLabelText('Entrar no aplicativo');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, '123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText(/Mínimo 6 caracteres/)).toBeTruthy();
    });
  });

  it('should clear error when user starts typing', async () => {
    const { getByPlaceholderText, getByLabelText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('seu@email.com');
    const loginButton = getByLabelText('Entrar no aplicativo');

    // Trigger error
    fireEvent.changeText(emailInput, 'email-invalido');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText(/Email inválido/)).toBeTruthy();
    });

    // Start typing to clear error
    fireEvent.changeText(emailInput, 'test@example.com');

    await waitFor(() => {
      expect(queryByText(/Email inválido/)).toBeNull();
    });
  });

  it('should validate form before submission', async () => {
    const { getByLabelText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const loginButton = getByLabelText('Entrar no aplicativo');
    fireEvent.press(loginButton);

    // Should not call navigation if form is invalid
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});