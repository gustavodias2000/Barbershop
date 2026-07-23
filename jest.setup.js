import '@testing-library/jest-native/extend-expect';

// NÃO mockar 'react-native' globalmente: no RN 0.80 o spread do módulo
// dispara todos os getters lazy e quebra o preset do Jest.
// Cada teste mocka apenas o que precisa (Alert, Linking etc.).
jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(jest.fn());

// Animated.timing/spring usam setTimeout REAIS por baixo — inclusive o
// `delay` de animações de entrada (ex.: LoginScreen). Esses timers não são
// cancelados quando o teste termina, e como o processo Jest às vezes roda
// vários arquivos de teste no mesmo processo Node (--runInBand ou poucos
// arquivos), um timer real agendado por um arquivo pode disparar durante a
// execução de outro arquivo — e travar/derrubar a suíte inteira quando cai
// em código de animação nativa (findNodeHandle) fora do ambiente de teste
// que o agendou. Torna as animações síncronas nos testes para eliminar
// esses timers "órfãos" de vez.
const RNAnimated = require('react-native').Animated;
const instantAnimation = (value, config) => ({
  start: (callback) => {
    if (typeof config?.toValue === 'number') value.setValue(config.toValue);
    callback && callback({ finished: true });
  },
  stop: () => {},
  reset: () => {},
});
jest.spyOn(RNAnimated, 'timing').mockImplementation(instantAnimation);
jest.spyOn(RNAnimated, 'spring').mockImplementation(instantAnimation);

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase (app local)
jest.mock('./firebaseConfig', () => ({
  auth: {
    currentUser: { uid: 'test-uid', email: 'test@example.com' },
    signOut: jest.fn(),
  },
  db: {},
  functions: {},
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
  deleteUser: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  // Rejeita por padrão para exercitar o fallback do WhatsAppService
  httpsCallable: jest.fn(() => jest.fn(() => Promise.reject(new Error('offline')))),
}));

// Mock React Navigation (preserva o módulo real; só substitui os hooks)
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      replace: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Mock Firebase Messaging
jest.mock('@react-native-firebase/messaging', () => {
  const messagingInstance = {
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('mock-token')),
    onMessage: jest.fn(),
    onTokenRefresh: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  };
  const messagingFn = () => messagingInstance;
  messagingFn.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0 };
  return {
    __esModule: true,
    default: messagingFn,
  };
});

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);
