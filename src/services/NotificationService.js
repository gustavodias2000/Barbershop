/**
 * NotificationService — gerencia FCM push notifications.
 *
 * CORREÇÃO (auditoria item 2.5):
 * O construtor NÃO solicita permissão mais. A permissão só é pedida
 * explicitamente via `init()`, chamado pela tela principal APÓS o login,
 * no momento certo da jornada do usuário.
 *
 * Isso impede que o OS dialog "Permitir notificações?" apareça na tela
 * de carregamento, antes mesmo de o usuário entender o app — prática
 * reprovada pela Apple App Review e que reduz a taxa de opt-in.
 */
import messaging from '@react-native-firebase/messaging';
import { Alert } from 'react-native';

class NotificationService {
  constructor() {
    // Sem efeito colateral no import.
    // Configure listeners passivos aqui (sem pedir permissão):
    this._setupBackgroundListeners();
  }

  /**
   * Inicializa as notificações push.
   * Chame este método UMA VEZ após o login do usuário, em um momento
   * contextualmente adequado (ex.: depois de exibir uma explicação).
   */
  async init() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      await this.getFCMToken();
      this._setupForegroundListener();
    }

    return enabled;
  }

  _setupBackgroundListeners() {
    // Listener para quando o app é aberto via notificação (background)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      this._handleNotificationNavigation(remoteMessage);
    });

    // Notificação que abriu o app (quit state)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          this._handleNotificationNavigation(remoteMessage);
        }
      })
      .catch(() => {});
  }

  _setupForegroundListener() {
    messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage.notification?.title || 'Nova notificação',
        remoteMessage.notification?.body || 'Você tem uma nova mensagem',
      );
    });
  }

  async getFCMToken() {
    try {
      const token = await messaging().getToken();
      // Em produção: salvar token em usuarios/{uid}.fcmToken via Firestore
      return token;
    } catch (error) {
      console.error('Erro ao obter FCM token:', error);
      return null;
    }
  }

  _handleNotificationNavigation(remoteMessage) {
    const { data } = remoteMessage;
    // Futura implementação: navegar para Histórico ou Painel conforme data.type
    if (data?.type === 'agendamento_confirmado') {
      // navigate('Historico')
    } else if (data?.type === 'novo_agendamento') {
      // navigate('BarbeiroHome')
    }
  }
}

export default new NotificationService();
