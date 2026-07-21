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

jest.mock('../../firebase', () => ({
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
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    expect(getByText('Barbershop')).toBeTruthy();
    expect(getByText('Faça seu login')).toBeTruthy();
    expect(getByPlaceholderText('Digite seu email')).toBeTruthy();
    expect(getByPlaceholderText('Digite sua senha')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
  });

  it('should show error for invalid email', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('Digite seu email');
    const loginButton = getByText('Entrar');

    fireEvent.changeText(emailInput, 'email-invalido');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText('Email inválido')).toBeTruthy();
    });
  });

  it('should show error for short password', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('Digite seu email');
    const passwordInput = getByPlaceholderText('Digite sua senha');
    const loginButton = getByText('Entrar');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, '123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText('Senha deve ter pelo menos 6 caracteres')).toBeTruthy();
    });
  });

  it('should clear error when user starts typing', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText('Digite seu email');
    const loginButton = getByText('Entrar');

    // Trigger error
    fireEvent.changeText(emailInput, 'email-invalido');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(queryByText('Email inválido')).toBeTruthy();
    });

    // Start typing to clear error
    fireEvent.changeText(emailInput, 'test@example.com');

    await waitFor(() => {
      expect(queryByText('Email inválido')).toBeNull();
    });
  });

  it('should validate form before submission', async () => {
    const { getByText } = renderWithTheme(
      <LoginScreen navigation={mockNavigation} />
    );

    const loginButton = getByText('Entrar');
    fireEvent.press(loginButton);

    // Should not call navigation if form is invalid
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});