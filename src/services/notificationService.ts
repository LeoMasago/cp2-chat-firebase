import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import type { ConversationType } from '../types/chat';
import type {
  DevicePlatform,
  DeviceRegistration,
  NotificationData,
  PushRegistrationResult,
  PushTokenType,
} from '../types/notification';
import { getErrorMessage } from '../utils/errors';
import { apiClient } from './apiClient';
import { firestore } from './firebase';
import { isRecord } from './parsers';

/** Canal Android usado pela API no campo `android.notification.channelId` do FCM. */
export const ANDROID_CHANNEL_ID = 'messages';
const DEVICE_ID_KEY = 'chat.deviceId';

/** Conversa aberta no momento: pushes dela não são exibidos (o usuário já está vendo a mensagem). */
let activeConversationId: string | null = null;

export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

const isConversationType = (value: unknown): value is ConversationType =>
  value === 'direct' || value === 'group';

function readNotificationData(source: Record<string, unknown>): NotificationData | null {
  const conversationId = source['conversationId'];
  const conversationType = source['conversationType'];
  if (typeof conversationId === 'string' && conversationId && isConversationType(conversationType)) {
    return { conversationId, conversationType };
  }
  return null;
}

/**
 * Lê `conversationId` e `conversationType` do payload do push. O expo-notifications entrega
 * o `data` do FCM como objeto; quando vem serializado no campo `body` (mensagens de dados),
 * o JSON também é aceito.
 */
export function parseNotificationData(data: unknown): NotificationData | null {
  if (!isRecord(data)) return null;
  const direct = readNotificationData(data);
  if (direct) return direct;

  const body = data['body'];
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isRecord(parsed)) return readNotificationData(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

/** Define como o push é exibido com o app aberto (chamado uma vez, na inicialização). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = parseNotificationData(notification.request.content.data);
      const alreadyViewing = data !== null && data.conversationId === activeConversationId;
      return {
        shouldShowBanner: !alreadyViewing,
        shouldShowList: !alreadyViewing,
        shouldPlaySound: !alreadyViewing,
        shouldSetBadge: false,
      };
    },
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Mensagens',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4F46E5',
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Identificador estável deste aparelho/instalação (nunca muda enquanto o app estiver instalado). */
export async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const created = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

type DeviceToken = { token: string; tokenType: PushTokenType };

function getEasProjectId(): string | null {
  const extra = Constants.expoConfig?.extra;
  const eas = isRecord(extra) ? extra['eas'] : null;
  const fromExtra = isRecord(eas) ? eas['projectId'] : null;
  if (typeof fromExtra === 'string' && fromExtra) return fromExtra;
  const fromEasConfig = Constants.easConfig?.projectId;
  return typeof fromEasConfig === 'string' && fromEasConfig ? fromEasConfig : null;
}

/**
 * Android → token nativo do FCM (a API envia pelo Firebase Cloud Messaging com o Admin SDK).
 * iOS → token do Expo Push Service (entrega via APNs); exige o `projectId` do EAS.
 */
async function fetchDeviceToken(): Promise<{ token: DeviceToken } | { error: string }> {
  if (Platform.OS === 'android') {
    const native = await Notifications.getDevicePushTokenAsync();
    return typeof native.data === 'string' && native.data
      ? { token: { token: native.data, tokenType: 'fcm' } }
      : { error: 'O Firebase Cloud Messaging não devolveu um token para este aparelho.' };
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    return { error: 'Configure o projectId do EAS (execute "eas init") para registrar o push no iOS.' };
  }
  const expo = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: { token: expo.data, tokenType: 'expo' } };
}

const currentPlatform = (): DevicePlatform => (Platform.OS === 'ios' ? 'ios' : 'android');

async function saveDevice(uid: string, deviceId: string, token: DeviceToken): Promise<void> {
  const deviceRef = doc(firestore, 'users', uid, 'devices', deviceId);
  const existing = await getDoc(deviceRef);
  const previous = existing.exists() ? existing.data() : null;
  // Respeita a escolha do usuário: se ele desligou as notificações neste aparelho, continua desligado.
  const keepDisabled = isRecord(previous) && previous['enabled'] === false;

  const registration: DeviceRegistration = {
    token: token.token,
    tokenType: token.tokenType,
    platform: currentPlatform(),
    enabled: !keepDisabled,
    updatedAt: Date.now(),
  };
  await setDoc(deviceRef, registration);
}

/**
 * Solicita permissão, obtém o token do dispositivo e o grava em `users/{uid}/devices/{deviceId}`.
 * O resultado descreve cada situação (negada, sem token, simulador...) para a interface exibir.
 *
 * Emuladores Android com Google Play recebem FCM normalmente ("ambiente compatível"), então
 * só são recusados os ambientes que de fato não recebem push: simulador do iOS e web.
 * Se o emulador não tiver os serviços do Google, a obtenção do token falha e vira `no_token`/`error`.
 */
export async function registerDevice(uid: string): Promise<PushRegistrationResult> {
  if (!Device.isDevice && Platform.OS !== 'android') {
    return {
      status: 'unsupported',
      reason: 'Notificações push exigem um aparelho físico (ou um emulador Android com Google Play).',
    };
  }
  try {
    await ensureAndroidChannel();
    if (!(await requestPermission())) return { status: 'denied' };

    const result = await fetchDeviceToken();
    if ('error' in result) return { status: 'no_token', reason: result.error };

    const deviceId = await getDeviceId();
    await saveDevice(uid, deviceId, result.token);
    // Garante que o token pertence só a este usuário (ex.: alguém usou o aparelho antes).
    apiClient.claimDevice(deviceId).catch(() => undefined);
    return { status: 'registered', tokenType: result.token.tokenType };
  } catch (error) {
    return { status: 'error', message: getErrorMessage(error) };
  }
}

/** Remove este aparelho dos destinos de push do usuário (usado no logout). */
export async function unregisterDevice(uid: string): Promise<void> {
  const deviceId = await getDeviceId();
  await deleteDoc(doc(firestore, 'users', uid, 'devices', deviceId));
}

/** Liga/desliga o recebimento de push neste aparelho sem apagar o registro. */
export async function setDeviceNotificationsEnabled(uid: string, enabled: boolean): Promise<void> {
  const deviceId = await getDeviceId();
  await updateDoc(doc(firestore, 'users', uid, 'devices', deviceId), { enabled, updatedAt: Date.now() });
}

export async function isDeviceNotificationsEnabled(uid: string): Promise<boolean | null> {
  const snapshot = await getDoc(doc(firestore, 'users', uid, 'devices', await getDeviceId()));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return isRecord(data) ? data['enabled'] !== false : null;
}

/** O FCM pode trocar o token do aparelho; esta assinatura mantém o Firestore atualizado (Android). */
export function subscribeToTokenRefresh(uid: string): () => void {
  const subscription = Notifications.addPushTokenListener((token) => {
    if (Platform.OS !== 'android' || typeof token.data !== 'string') return;
    const refreshed: DeviceToken = { token: token.data, tokenType: 'fcm' };
    getDeviceId()
      .then((deviceId) => saveDevice(uid, deviceId, refreshed))
      .catch(() => undefined);
  });
  return () => subscription.remove();
}
