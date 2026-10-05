import { Ionicons } from '@expo/vector-icons';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ConversationItem } from '../components/ConversationItem';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { useAuth, useCurrentUser } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { useNotificationNavigation, useNotifications } from '../hooks/useNotifications';
import { colors, spacing } from '../theme';
import type { ConversationSummary } from '../types/chat';
import type { ScreenProps } from '../types/navigation';
import type { PushRegistrationResult } from '../types/notification';
import { getErrorMessage } from '../utils/errors';

type PushNotice = { tone: 'warning' | 'info'; message: string; actionLabel?: string; onAction?: () => void };

function describeRegistration(result: PushRegistrationResult | null, retry: () => void): PushNotice | null {
  if (!result || result.status === 'registered') return null;
  switch (result.status) {
    case 'denied':
      return {
        tone: 'warning',
        message: 'Notificações desativadas: você não será avisado de novas mensagens com o app fechado.',
        actionLabel: 'Ativar',
        onAction: () => {
          Linking.openSettings().catch(() => undefined);
        },
      };
    case 'unsupported':
      return { tone: 'info', message: result.reason };
    case 'no_token':
      return { tone: 'warning', message: result.reason, actionLabel: 'Tentar de novo', onAction: retry };
    case 'error':
      return { tone: 'warning', message: `Não foi possível ativar as notificações. ${result.message}`, actionLabel: 'Tentar de novo', onAction: retry };
  }
}

export function ConversationsScreen({ navigation }: ScreenProps<'Conversations'>) {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { items, loading, error, retry } = useConversations(user.uid);
  const { registration, retry: retryRegistration } = useNotifications(user.uid);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // Toque em um push: abre a conversa indicada no payload.
  useNotificationNavigation();

  const handleLogout = useCallback(() => {
    Alert.alert('Sair da conta', 'Você deixará de receber notificações neste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          signOut().catch((signOutError: unknown) => Alert.alert('Não foi possível sair', getErrorMessage(signOutError)));
        },
      },
    ]);
  }, [signOut]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Avatar
            uri={user.photoUrl}
            size={32}
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Meu perfil"
          />
          <Pressable onPress={handleLogout} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sair">
            <Ionicons name="log-out-outline" size={26} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, user.photoUrl, handleLogout]);

  const openConversation = useCallback(
    (conversation: ConversationSummary) =>
      navigation.navigate('Chat', { conversationId: conversation.id, conversationType: conversation.type }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationItem conversation={item} currentUserId={user.uid} onPress={openConversation} />
    ),
    [user.uid, openConversation],
  );

  const notice = noticeDismissed ? null : describeRegistration(registration, retryRegistration);

  let content;
  if (loading) {
    content = <Loading message="Carregando conversas..." fullScreen />;
  } else if (error) {
    content = <ErrorMessage message={error} onRetry={retry} />;
  } else {
    content = (
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Nenhuma conversa ainda"
            description="Comece uma conversa individual ou crie um grupo para conversar com seus colegas."
            actionLabel="Nova conversa"
            onAction={() => navigation.navigate('Users', { mode: 'direct' })}
          />
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      {notice ? (
        <Banner
          tone={notice.tone}
          message={notice.message}
          actionLabel={notice.actionLabel}
          onAction={notice.onAction}
          onDismiss={() => setNoticeDismissed(true)}
        />
      ) : null}
      <View style={styles.content}>{content}</View>
      <View style={[styles.actions, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button
          title="Nova conversa"
          onPress={() => navigation.navigate('Users', { mode: 'direct' })}
          style={styles.actionButton}
        />
        <Button
          title="Novo grupo"
          variant="secondary"
          onPress={() => navigation.navigate('GroupForm')}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { flex: 1 },
});
