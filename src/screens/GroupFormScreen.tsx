import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormScreen } from '../components/FormScreen';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { PhotoPicker } from '../components/PhotoPicker';
import { PolicySelector } from '../components/PolicySelector';
import { TextField } from '../components/TextField';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { usePublicProfiles } from '../hooks/useUsers';
import { createGroup, PHOTO_FAILED_MESSAGE, SYNC_FAILED_MESSAGE, syncGroupAccess, updateGroup } from '../services/groupService';
import { colors, fontSize, radius, spacing } from '../theme';
import { MIN_GROUP_MEMBERS, type GroupChanges } from '../types/group';
import type { PickedImage } from '../types/media';
import type { ScreenProps } from '../types/navigation';
import type { NotificationPolicy } from '../types/notification';
import { getErrorMessage } from '../utils/errors';
import {
  describeSlots,
  getAvailableSlots,
  parseMemberLimit,
  validateGroupName,
  validateMemberLimit,
} from '../utils/groupValidation';

const DEFAULT_LIMIT = 10;

/** O grupo já foi salvo; avisa o que ficou pendente (acesso às mensagens e/ou foto). */
function notifyPartialSave(accessSynced: boolean, photoUploadFailed: boolean): void {
  const notices: string[] = [];
  if (!accessSynced) notices.push(SYNC_FAILED_MESSAGE);
  if (photoUploadFailed) notices.push(PHOTO_FAILED_MESSAGE);
  if (notices.length > 0) Alert.alert('Atenção', notices.join('\n\n'));
}

/** Criação e edição de grupos (nome, foto, integrantes, limite e política de notificações). */
export function GroupFormScreen({ navigation, route }: ScreenProps<'GroupForm'>) {
  const user = useCurrentUser();
  const groupId = route.params?.groupId;
  const pickedMemberIds = route.params?.pickedMemberIds;
  const isEdit = groupId !== undefined;
  const groupState = useGroup(groupId);
  const existingGroup = groupState.status === 'ready' ? groupState.group : null;
  const ownerId = existingGroup?.ownerId ?? user.uid;

  const [name, setName] = useState('');
  const [limitText, setLimitText] = useState(String(DEFAULT_LIMIT));
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  // Integrantes escolhidos, sem o proprietário (que sempre participa).
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const initialized = useRef(false);

  // Edição: preenche o formulário uma única vez com os dados atuais do grupo.
  useEffect(() => {
    if (!existingGroup || initialized.current) return;
    initialized.current = true;
    setName(existingGroup.name);
    setLimitText(String(existingGroup.memberLimit));
    setPolicy(existingGroup.notificationPolicy);
    setMemberIds(existingGroup.memberIds.filter((id) => id !== existingGroup.ownerId));
  }, [existingGroup]);

  // Integrantes devolvidos pela tela de usuários (modo seleção).
  useEffect(() => {
    if (pickedMemberIds) {
      setMemberIds(pickedMemberIds);
      setMembersError(null);
    }
  }, [pickedMemberIds]);

  const memberCount = memberIds.length + 1;
  const limit = parseMemberLimit(limitText);
  const limitError = validateMemberLimit(limit, memberCount);
  const effectiveLimit = limit ?? existingGroup?.memberLimit ?? DEFAULT_LIMIT;
  const slots = getAvailableSlots(memberCount, effectiveLimit);

  const displayedIds = useMemo(() => [ownerId, ...memberIds], [ownerId, memberIds]);
  const profiles = usePublicProfiles(displayedIds);

  const openMemberPicker = useCallback(() => {
    navigation.navigate('Users', {
      mode: 'select',
      selectedIds: memberIds,
      ownerId,
      memberLimit: effectiveLimit,
      groupId,
    });
  }, [navigation, memberIds, ownerId, effectiveLimit, groupId]);

  const removeMember = useCallback((uid: string) => {
    setMemberIds((current) => current.filter((id) => id !== uid));
  }, []);

  const handleSave = useCallback(async () => {
    const nextNameError = validateGroupName(name);
    const nextMembersError = memberCount < MIN_GROUP_MEMBERS ? 'Selecione pelo menos um integrante para o grupo.' : null;
    setNameError(nextNameError);
    setMembersError(nextMembersError);
    setSubmitError(null);
    if (nextNameError || nextMembersError || limitError || limit === null) return;

    setSaving(true);
    try {
      if (!existingGroup) {
        const { group, accessSynced, photoUploadFailed } = await createGroup(user.uid, {
          name,
          photo,
          memberIds,
          memberLimit: limit,
          notificationPolicy: policy,
        });
        notifyPartialSave(accessSynced, photoUploadFailed);
        navigation.replace('Chat', { conversationId: group.id, conversationType: 'group' });
        return;
      }

      const changes: GroupChanges = {
        addMemberIds: memberIds.filter((id) => !existingGroup.memberIds.includes(id)),
        removeMemberIds: existingGroup.memberIds.filter((id) => id !== existingGroup.ownerId && !memberIds.includes(id)),
      };
      if (name.trim() !== existingGroup.name) changes.name = name;
      if (limit !== existingGroup.memberLimit) changes.memberLimit = limit;
      if (policy !== existingGroup.notificationPolicy) changes.notificationPolicy = policy;

      const { accessSynced, photoUploadFailed } = await updateGroup(existingGroup.id, user.uid, changes, photo ?? undefined);
      notifyPartialSave(accessSynced, photoUploadFailed);
      navigation.goBack();
    } catch (saveError) {
      setSubmitError(getErrorMessage(saveError));
      setSaving(false);
    }
  }, [name, memberCount, limitError, limit, existingGroup, user.uid, photo, memberIds, policy, navigation]);

  const handleSyncAccess = useCallback(async () => {
    if (!existingGroup) return;
    setSyncing(true);
    try {
      await syncGroupAccess(existingGroup.id);
      Alert.alert('Acesso sincronizado', 'Os integrantes atuais já podem ler e enviar mensagens.');
    } catch (syncError) {
      Alert.alert('Não foi possível sincronizar', getErrorMessage(syncError));
    } finally {
      setSyncing(false);
    }
  }, [existingGroup]);

  if (isEdit && (groupState.status === 'loading' || groupState.status === 'idle')) {
    return <Loading message="Carregando grupo..." fullScreen />;
  }
  if (groupState.status === 'error') return <ErrorMessage message={groupState.message} />;
  if (groupState.status === 'removed') {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Grupo indisponível"
        description="Este grupo não existe mais ou você não participa dele."
        actionLabel="Voltar"
        onAction={() => navigation.goBack()}
      />
    );
  }
  if (existingGroup && existingGroup.ownerId !== user.uid) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Somente o proprietário"
        description="Apenas o proprietário pode editar este grupo."
        actionLabel="Voltar"
        onAction={() => navigation.goBack()}
      />
    );
  }

  return (
    <FormScreen keyboardVerticalOffset={64}>
      <View style={styles.photo}>
        <PhotoPicker
          kind="group"
          currentUrl={existingGroup?.photoUrl}
          picked={photo}
          onPick={setPhoto}
          label="Foto do grupo"
        />
      </View>

      <TextField
        label="Nome do grupo"
        value={name}
        onChangeText={setName}
        error={nameError}
        maxLength={60}
        placeholder="Ex.: Turma 3SI"
      />

      <View style={styles.section}>
        <TextField
          label="Limite de integrantes"
          value={limitText}
          onChangeText={setLimitText}
          error={limitError}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={[styles.slots, slots === 0 && styles.slotsFull]}>
          {limit === null ? 'Informe o limite' : describeSlots(memberCount, effectiveLimit)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrantes</Text>
        <View style={styles.list}>
          {displayedIds.map((uid) => {
            const profile = profiles[uid];
            const isOwner = uid === ownerId;
            return (
              <GroupMemberItem
                key={uid}
                uid={uid}
                name={profile?.name ?? (uid === user.uid ? user.name : 'Usuário')}
                photoUrl={profile?.photoUrl ?? (uid === user.uid ? user.photoUrl : undefined)}
                isOwner={isOwner}
                isCurrentUser={uid === user.uid}
                onRemove={isOwner ? undefined : removeMember}
              />
            );
          })}
        </View>
        {slots === 0 ? (
          <Text style={styles.hint}>Grupo sem vagas. Aumente o limite ou remova integrantes para adicionar mais pessoas.</Text>
        ) : null}
        {membersError ? <Text style={styles.error}>{membersError}</Text> : null}
        <Button title="Adicionar / remover integrantes" variant="secondary" onPress={openMemberPicker} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações push do grupo</Text>
        <PolicySelector value={policy} onChange={setPolicy} />
      </View>

      {submitError ? <ErrorMessage variant="inline" message={submitError} /> : null}

      <Button title={isEdit ? 'Salvar alterações' : 'Criar grupo'} onPress={handleSave} loading={saving} />
      {isEdit ? (
        <Button
          title="Sincronizar acesso às mensagens"
          variant="ghost"
          onPress={handleSyncAccess}
          loading={syncing}
          disabled={saving}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  slots: { color: colors.textMuted, fontSize: fontSize.sm },
  slotsFull: { color: colors.warning, fontWeight: '600' },
  list: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.warning, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
