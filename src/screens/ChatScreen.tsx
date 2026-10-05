import { useHeaderHeight } from '@react-navigation/elements';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../components/Banner';
import { ChatHeader } from '../components/ChatHeader';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { MemberPickerModal, type PickableMember } from '../components/MemberPickerModal';
import { useCurrentUser } from '../hooks/useAuth';
import { useChat, useConnectionStatus } from '../hooks/useChat';
import { useGroup } from '../hooks/useGroups';
import { usePublicProfiles } from '../hooks/useUsers';
import { syncGroupAccess } from '../services/groupService';
import { setActiveConversation } from '../services/notificationService';
import { colors } from '../theme';
import type { ChatMessage as ChatMessageData, MessageTarget } from '../types/chat';
import type { ScreenProps } from '../types/navigation';
import { getOtherParticipantId } from '../utils/conversationId';
import { extractMentionedUserIds, appendMention } from '../utils/mentions';

export function ChatScreen({ navigation, route }: ScreenProps<'Chat'>) {
  const { conversationId, conversationType } = route.params;
  const user = useCurrentUser();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isGroup = conversationType === 'group';

  const groupState = useGroup(isGroup ? conversationId : undefined);
  const group = groupState.status === 'ready' ? groupState.group : null;
  const peerId = isGroup ? null : getOtherParticipantId(conversationId, user.uid);

  const { messages, status, error, failedSend, pushWarning, send, retryFailedSend, dismissFailedSend, retry } = useChat({
    conversationId,
    conversationType,
    userId: user.uid,
  });
  const connected = useConnectionStatus();

  // Perfis de quem participa da conversa e de quem enviou mensagens (inclui ex-integrantes).
  const profileIds = useMemo(() => {
    const ids = new Set<string>(group?.memberIds ?? []);
    if (peerId) ids.add(peerId);
    messages.forEach((message) => ids.add(message.senderId));
    return [...ids];
  }, [group?.memberIds, peerId, messages]);
  const profiles = usePublicProfiles(profileIds);

  const [draft, setDraft] = useState('');
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);

  // Enquanto esta conversa está aberta, pushes dela não aparecem como notificação.
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);

  // Se o proprietário abre um grupo cujo acesso ainda não foi sincronizado, tenta sincronizar sozinho.
  const autoSyncTried = useRef(false);
  useEffect(() => {
    if (status !== 'error' || !group || group.ownerId !== user.uid || autoSyncTried.current) return;
    autoSyncTried.current = true;
    syncGroupAccess(group.id)
      .then(retry)
      .catch(() => undefined);
  }, [status, group, user.uid, retry]);

  const members = useMemo<PickableMember[]>(
    () =>
      (group?.memberIds ?? [])
        .filter((id) => id !== user.uid)
        .map((id) => ({ uid: id, name: profiles[id]?.name ?? 'Usuário', photoUrl: profiles[id]?.photoUrl })),
    [group?.memberIds, profiles, user.uid],
  );

  const peerProfile = peerId ? profiles[peerId] : undefined;
  const title = isGroup ? (group?.name ?? 'Grupo') : (peerProfile?.name ?? 'Conversa');
  const subtitle = isGroup && group ? `${group.memberIds.length} integrantes` : undefined;
  const headerPhoto = isGroup ? group?.photoUrl : peerProfile?.photoUrl;

  const handlePhotoPress = useCallback(() => {
    if (isGroup) navigation.navigate('GroupMembers', { groupId: conversationId });
    else if (peerId) navigation.navigate('Profile', { userId: peerId });
  }, [isGroup, navigation, conversationId, peerId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ChatHeader
          title={title}
          subtitle={subtitle}
          photoUrl={headerPhoto}
          kind={isGroup ? 'group' : 'user'}
          onPhotoPress={handlePhotoPress}
        />
      ),
    });
  }, [navigation, title, subtitle, headerPhoto, isGroup, handlePhotoPress]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const mentionedUserIds = isGroup
      ? extractMentionedUserIds(
          text,
          members.map((member) => ({ uid: member.uid, name: member.name })),
          user.uid,
        )
      : [];
    const target: MessageTarget = isGroup && targetMemberId ? { type: 'member', memberId: targetMemberId } : { type: 'conversation' };
    if (send({ text, target, mentionedUserIds })) {
      setDraft('');
      setTargetMemberId(null);
    }
  }, [draft, isGroup, members, user.uid, targetMemberId, send]);

  const recipientLabel = useMemo(() => {
    if (!targetMemberId) return 'Todos do grupo';
    return `@${members.find((member) => member.uid === targetMemberId)?.name ?? 'integrante'}`;
  }, [targetMemberId, members]);

  // Lista invertida: a mensagem mais recente fica junto ao campo de digitação e a rolagem acompanha.
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageData }) => {
      const isMine = item.senderId === user.uid;
      const targetName = item.target.type === 'member' ? (profiles[item.target.memberId]?.name ?? 'integrante') : undefined;
      return (
        <ChatMessage
          message={item}
          isMine={isMine}
          authorName={isGroup && !isMine ? (profiles[item.senderId]?.name ?? 'Usuário') : undefined}
          targetName={targetName}
        />
      );
    },
    [user.uid, isGroup, profiles],
  );

  if (isGroup && (groupState.status === 'loading' || groupState.status === 'idle')) {
    return <Loading message="Abrindo grupo..." fullScreen />;
  }
  if (isGroup && groupState.status === 'removed') {
    return (
      <EmptyState
        icon="exit-outline"
        title="Você não participa mais deste grupo"
        description="Você foi removido ou o grupo não existe mais. As novas mensagens não estão disponíveis."
        actionLabel="Voltar às conversas"
        onAction={() => navigation.popToTop()}
      />
    );
  }
  if (isGroup && groupState.status === 'error') return <ErrorMessage message={groupState.message} />;

  let body;
  if (status === 'loading') {
    body = <Loading message="Carregando mensagens..." fullScreen />;
  } else if (status === 'error') {
    body = <ErrorMessage message={error ?? 'Não foi possível carregar a conversa.'} onRetry={retry} />;
  } else {
    body = (
      <FlatList
        data={invertedMessages}
        keyExtractor={(message) => message.id}
        renderItem={renderMessage}
        inverted
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          // A lista é invertida; desfaz a inversão para o estado vazio ficar na posição correta.
          <View style={styles.emptyFlip}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="Nenhuma mensagem ainda"
              description="Envie a primeira mensagem para começar a conversa."
            />
          </View>
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ConnectionBanner connected={connected} />
      {failedSend ? (
        <Banner
          tone="error"
          message={`Falha no envio: ${failedSend.error}`}
          actionLabel="Reenviar"
          onAction={retryFailedSend}
          onDismiss={dismissFailedSend}
        />
      ) : null}
      {pushWarning ? <Banner tone="info" message={pushWarning} /> : null}

      <View style={styles.list}>{body}</View>

      <View style={{ paddingBottom: insets.bottom }}>
        <ChatInput
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          disabled={status !== 'ready'}
          recipient={
            isGroup
              ? {
                  label: recipientLabel,
                  isTargeted: targetMemberId !== null,
                  onPress: () => setRecipientPickerOpen(true),
                  onClear: () => setTargetMemberId(null),
                }
              : undefined
          }
          onMentionPress={isGroup ? () => setMentionPickerOpen(true) : undefined}
        />
      </View>

      {isGroup ? (
        <>
          <MemberPickerModal
            visible={recipientPickerOpen}
            title="Enviar mensagem para"
            members={members}
            allowAll
            selectedId={targetMemberId}
            onSelect={(memberId) => {
              setTargetMemberId(memberId);
              setRecipientPickerOpen(false);
            }}
            onClose={() => setRecipientPickerOpen(false)}
          />
          <MemberPickerModal
            visible={mentionPickerOpen}
            title="Mencionar integrante"
            members={members}
            onSelect={(memberId) => {
              const member = members.find((candidate) => candidate.uid === memberId);
              if (member) setDraft((current) => appendMention(current, member.name));
              setMentionPickerOpen(false);
            }}
            onClose={() => setMentionPickerOpen(false)}
          />
        </>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  emptyFlip: { transform: [{ scaleY: -1 }], flex: 1, justifyContent: 'center' },
});
