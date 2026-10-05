import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { UserListItem } from '../components/UserListItem';
import { useCurrentUser } from '../hooks/useAuth';
import { useUsers } from '../hooks/useUsers';
import { ensureDirectConversation } from '../services/chatService';
import { colors, fontSize, radius, spacing } from '../theme';
import type { ScreenProps } from '../types/navigation';
import type { PublicProfile } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { getAvailableSlots } from '../utils/groupValidation';

/**
 * Lista de usuários cadastrados com busca.
 *  - modo `direct`: tocar em um usuário abre (ou cria) a conversa individual;
 *  - modo `select`: escolha de integrantes de um grupo, respeitando o limite configurado.
 */
export function UsersScreen({ navigation, route }: ScreenProps<'Users'>) {
  const currentUser = useCurrentUser();
  const insets = useSafeAreaInsets();
  const params = route.params;
  const selectMode = params.mode === 'select';

  const { users, loading, error, retry } = useUsers(currentUser.uid);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(params.mode === 'select' ? params.selectedIds : []);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // O proprietário ocupa uma das vagas do grupo.
  const maxSelectable = params.mode === 'select' ? Math.max(params.memberLimit - 1, 0) : 0;
  const slotsLeft = getAvailableSlots(selectedIds.length, maxSelectable);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? users.filter((user) => user.name.toLowerCase().includes(term)) : users;
  }, [users, search]);

  const startConversation = useCallback(
    async (user: PublicProfile) => {
      setActionError(null);
      setStartingId(user.uid);
      try {
        const conversation = await ensureDirectConversation(currentUser.uid, user.uid);
        navigation.replace('Chat', { conversationId: conversation.id, conversationType: 'direct' });
      } catch (startError) {
        setActionError(getErrorMessage(startError));
        setStartingId(null);
      }
    },
    [currentUser.uid, navigation],
  );

  const toggleSelection = useCallback(
    (user: PublicProfile) => {
      setActionError(null);
      if (selectedIds.includes(user.uid)) {
        setSelectedIds(selectedIds.filter((id) => id !== user.uid));
      } else if (selectedIds.length >= maxSelectable) {
        setActionError(`O grupo atingiu o limite de ${maxSelectable + 1} integrantes. Não há mais vagas.`);
      } else {
        setSelectedIds([...selectedIds, user.uid]);
      }
    },
    [selectedIds, maxSelectable],
  );

  const handlePress = useCallback(
    (user: PublicProfile) => (selectMode ? toggleSelection(user) : startConversation(user)),
    [selectMode, toggleSelection, startConversation],
  );

  const confirmSelection = useCallback(() => {
    if (params.mode !== 'select') return;
    // `popTo` volta ao formulário que já está aberto (preservando o que foi digitado) em vez de abrir outro.
    navigation.popTo('GroupForm', { groupId: params.groupId, pickedMemberIds: selectedIds }, { merge: true });
  }, [navigation, params, selectedIds]);

  const renderItem = useCallback(
    ({ item }: { item: PublicProfile }) => (
      <UserListItem
        user={item}
        onPress={handlePress}
        selectable={selectMode}
        selected={selectedIds.includes(item.uid)}
        disabled={startingId !== null || (selectMode && !selectedIds.includes(item.uid) && slotsLeft === 0)}
        disabledReason={
          selectMode && !selectedIds.includes(item.uid) && slotsLeft === 0 ? 'Sem vagas no grupo' : undefined
        }
      />
    ),
    [handlePress, selectMode, selectedIds, startingId, slotsLeft],
  );

  let content;
  if (loading) {
    content = <Loading message="Carregando usuários..." fullScreen />;
  } else if (error) {
    content = <ErrorMessage message={error} onRetry={retry} />;
  } else {
    content = (
      <FlatList
        data={filteredUsers}
        keyExtractor={(user) => user.uid}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={filteredUsers.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState icon="search-outline" title="Nenhum usuário encontrado" description={`Nada corresponde a "${search.trim()}".`} />
          ) : (
            <EmptyState
              icon="people-outline"
              title="Nenhum usuário disponível"
              description="Quando outras pessoas criarem uma conta, elas aparecerão aqui."
            />
          )
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Buscar usuários"
        />
      </View>

      {actionError ? <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} /> : null}
      <View style={styles.content}>{content}</View>

      {params.mode === 'select' ? (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Text style={styles.counter}>
            {selectedIds.length}/{maxSelectable} selecionados ·{' '}
            {slotsLeft === 0 ? 'sem vagas' : `${slotsLeft} ${slotsLeft === 1 ? 'vaga' : 'vagas'}`}
          </Text>
          <Button title="Confirmar seleção" onPress={confirmSelection} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: fontSize.md },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  counter: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
});
