import * as Notifications from 'expo-notifications';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  parseNotificationData,
  registerDevice,
  subscribeToTokenRefresh,
} from '../services/notificationService';
import type { PushRegistrationResult } from '../types/notification';

/** Pushes já tratados, para não reabrir uma conversa antiga ao remontar a tela ou fazer novo login. */
const handledNotifications = new Set<string>();

/**
 * Registra este aparelho para receber push (permissão + token no Firestore) e mantém o token
 * atualizado. O resultado é exposto para a tela avisar sobre permissão negada, falta de token etc.
 */
export function useNotifications(uid: string) {
  const [registration, setRegistration] = useState<PushRegistrationResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    registerDevice(uid).then((result) => {
      if (!cancelled) setRegistration(result);
    });
    const unsubscribeTokenRefresh = subscribeToTokenRefresh(uid);
    return () => {
      cancelled = true;
      unsubscribeTokenRefresh();
    };
  }, [uid, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { registration, retry };
}

/**
 * Ao tocar em um push (app aberto, em segundo plano ou fechado), abre a conversa indicada em
 * `conversationId`/`conversationType`. O histórico fica `Conversas → Chat`, para o botão voltar funcionar.
 */
function useNotificationTapNavigation(): void {
  const navigation = useNavigation();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;
    const identifier = lastResponse.notification.request.identifier;
    if (handledNotifications.has(identifier)) return;
    handledNotifications.add(identifier);

    const target = parseNotificationData(lastResponse.notification.request.content.data);
    if (!target) return;
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'Conversations' }, { name: 'Chat', params: target }],
      }),
    );
  }, [lastResponse, navigation]);
}

function useNoNotificationNavigation(): void {
  // Sem efeitos: a web (usada apenas na pré-visualização em desenvolvimento) não recebe push.
}

/** Escolhido uma única vez na inicialização do módulo, portanto a ordem dos hooks nunca muda. */
export const useNotificationNavigation: () => void =
  Platform.OS === 'web' ? useNoNotificationNavigation : useNotificationTapNavigation;
