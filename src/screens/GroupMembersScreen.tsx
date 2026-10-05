import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { usePublicProfiles } from '../hooks/useUsers';
import { colors, fontSize, spacing } from '../theme';
import type { ScreenProps } from '../types/navigation';
import { NOTIFICATION_POLICY_LABELS } from '../types/notification';
import { describeSlots } from '../utils/groupValidation';

/** Integrantes do grupo (aberta ao tocar na foto do grupo no chat). Tocar em um integrante abre seu perfil. */
export function GroupMembersScreen({ navigation, route }: ScreenProps<'GroupMembers'>) {
  const user = useCurrentUser();
  const groupState = useGroup(route.params.groupId);
  const group = groupState.status === 'ready' ? groupState.group : null;
  const profiles = usePublicProfiles(group?.memberIds ?? []);

  // Proprietário primeiro, depois os demais em ordem alfabética (sem mutar a lista original).
  const sortedMemberIds = useMemo(() => {
    if (!group) return [];
    const nameOf = (uid: string) => profiles[uid]?.name ?? '';
    return [...group.memberIds].sort((a, b) => {
      if (a === group.ownerId) return -1;
      if (b === group.ownerId) return 1;
      return nameOf(a).localeCompare(nameOf(b), 'pt-BR');
    });
  }, [group, profiles]);

  const openProfile = useCallback((uid: string) => navigation.navigate('Profile', { userId: uid }), [navigation]);

  if (groupState.status === 'loading' || groupState.status === 'idle') {
    return <Loading message="Carregando integrantes..." fullScreen />;
  }
  if (groupState.status === 'error') return <ErrorMessage message={groupState.message} />;
  if (!group) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Grupo indisponível"
        description="Você não participa mais deste grupo."
        actionLabel="Voltar"
        onAction={() => navigation.goBack()}
      />
    );
  }

  const isOwner = group.ownerId === user.uid;

  return (
    <FlatList
      style={styles.container}
      data={sortedMemberIds}
      keyExtractor={(uid) => uid}
      ListHeaderComponent={
        <View style={styles.header}>
          <Avatar uri={group.photoUrl} kind="group" size={96} />
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.slots}>{describeSlots(group.memberIds.length, group.memberLimit)}</Text>
          <Text style={styles.policy}>
            Notificações: {NOTIFICATION_POLICY_LABELS[group.notificationPolicy].title}
          </Text>
          {isOwner ? (
            <Button
              title="Gerenciar grupo"
              variant="secondary"
              onPress={() => navigation.navigate('GroupForm', { groupId: group.id })}
            />
          ) : null}
          <Text style={styles.section}>Integrantes</Text>
        </View>
      }
      renderItem={({ item: uid }) => (
        <GroupMemberItem
          uid={uid}
          name={profiles[uid]?.name ?? (uid === user.uid ? user.name : 'Usuário')}
          photoUrl={profiles[uid]?.photoUrl ?? (uid === user.uid ? user.photoUrl : undefined)}
          isOwner={uid === group.ownerId}
          isCurrentUser={uid === user.uid}
          onPress={openProfile}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'center' },
  slots: { color: colors.textMuted, fontSize: fontSize.md },
  policy: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  section: { alignSelf: 'flex-start', color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.md },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
});
