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
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Alert } from 'react-native';
import { auth } from '../../firebaseConfig';
import { saveFcmToken } from '../data/repositories/UsuarioRepository';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

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
  async init(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      await this.getFCMToken();
      this._setupForegroundListener();
      this._setupTokenRefreshListener();
    }

    return enabled;
  }

  private _setupBackgroundListeners(): void {
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

  private _setupForegroundListener(): void {
    messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage.notification?.title || 'Nova notificação',
        remoteMessage.notification?.body || 'Você tem uma nova mensagem',
      );
    });
  }

  private _setupTokenRefreshListener(): void {
    // O FCM pode girar o token; mantém o perfil sempre atualizado
    messaging().onTokenRefresh((token) => {
      const uid = auth.currentUser?.uid;
      if (uid && token) {
        saveFcmToken(uid, token);
      }
    });
  }

  async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      // Item 18: salva o token no perfil — os lembretes automáticos
      // (Cloud Function agendada) usam este campo para enviar o push.
      const uid = auth.currentUser?.uid;
      if (uid && token) {
        await saveFcmToken(uid, token);
      }
      return token;
    } catch (error) {
      console.error('Erro ao obter FCM token:', error);
      return null;
    }
  }

  private _handleNotificationNavigation(remoteMessage: RemoteMessage): void {
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
