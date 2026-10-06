import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatGroup, GroupChanges, NewGroupInput } from '../types/group';
import type { PickedImage } from '../types/media';
import { AppError } from '../utils/errors';
import {
  applyGroupChanges,
  validateGroupName,
  validateMemberLimit,
} from '../utils/groupValidation';
import { apiClient } from './apiClient';
import { firestore } from './firebase';
import { parseGroup } from './parsers';
import { uploadGroupPhoto } from './storageService';

export const SYNC_FAILED_MESSAGE =
  'O grupo foi salvo, mas o acesso dos integrantes às mensagens ainda não foi atualizado. Abra o grupo e toque em "Sincronizar acesso".';

export const PHOTO_FAILED_MESSAGE =
  'O grupo foi salvo, mas a foto não pôde ser enviada agora. Você pode tentar de novo editando o grupo.';

/**
 * Resultado de criar/alterar um grupo.
 *  - `accessSynced = false` → o grupo foi salvo, mas a API não respondeu;
 *  - `photoUploadFailed = true` → o grupo foi salvo sem a foto (ex.: Storage indisponível).
 */
export type GroupSaveResult = { group: ChatGroup; accessSynced: boolean; photoUploadFailed: boolean };

/** O envio da foto nunca impede salvar o grupo: em caso de falha o grupo segue com a imagem padrão. */
async function tryUploadGroupPhoto(
  ownerId: string,
  groupId: string,
  photo: PickedImage | null | undefined,
): Promise<{ photoUrl: string | null; failed: boolean }> {
  if (!photo) return { photoUrl: null, failed: false };
  try {
    return { photoUrl: await uploadGroupPhoto(ownerId, groupId, photo), failed: false };
  } catch {
    return { photoUrl: null, failed: true };
  }
}

async function trySyncGroupAccess(groupId: string): Promise<boolean> {
  try {
    await syncGroupAccess(groupId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copia os integrantes do Firestore para o Realtime Database (via API), de onde as regras
 * do RTDB decidem quem lê e escreve as mensagens do grupo. É idempotente: repetir é seguro.
 */
export async function syncGroupAccess(groupId: string): Promise<void> {
  try {
    await apiClient.syncGroupMembers(groupId);
  } catch {
    throw new AppError('group/sync-failed', SYNC_FAILED_MESSAGE);
  }
}

/** Grupos dos quais o usuário participa, em tempo real. */
export function subscribeUserGroups(
  uid: string,
  onData: (groups: ChatGroup[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const groupsQuery = query(collection(firestore, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    groupsQuery,
    (snapshot) => {
      const groups = snapshot.docs
        .map((document) => parseGroup(document.id, document.data()))
        .filter((group): group is ChatGroup => group !== null);
      onData(groups);
    },
    onError,
  );
}

/** Um grupo em tempo real; `null` se foi removido ou se o usuário não é mais integrante. */
export function subscribeGroup(
  groupId: string,
  onData: (group: ChatGroup | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'groups', groupId),
    (snapshot) => onData(snapshot.exists() ? parseGroup(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

/**
 * Cria o grupo. O proprietário é sempre integrante. As validações da interface são repetidas
 * aqui e nas regras do Firestore (`memberIds.size() <= memberLimit`).
 */
export async function createGroup(ownerId: string, input: NewGroupInput): Promise<GroupSaveResult> {
  const nameError = validateGroupName(input.name);
  if (nameError) throw new AppError('group/invalid-name', nameError);

  const memberIds = [ownerId, ...new Set(input.memberIds.filter((id) => id !== ownerId))];
  if (memberIds.length < 2) {
    throw new AppError('group/min-members', 'Selecione pelo menos um integrante para o grupo.');
  }
  const limitError = validateMemberLimit(input.memberLimit, memberIds.length);
  if (limitError) {
    throw new AppError(
      memberIds.length > input.memberLimit ? 'group/full' : 'group/invalid-limit',
      limitError,
    );
  }

  const groupRef = doc(collection(firestore, 'groups'));
  const upload = await tryUploadGroupPhoto(ownerId, groupRef.id, input.photo);
  const photoUrl = upload.photoUrl ?? '';

  const now = Date.now();
  const document: Omit<ChatGroup, 'id'> = {
    name: input.name.trim(),
    photoUrl,
    ownerId,
    memberIds,
    memberLimit: input.memberLimit,
    notificationPolicy: input.notificationPolicy,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(groupRef, document);

  const accessSynced = await trySyncGroupAccess(groupRef.id);
  return { group: { id: groupRef.id, ...document }, accessSynced, photoUploadFailed: upload.failed };
}

/**
 * Altera nome, foto, limite, política e integrantes.
 *
 * Proteção contra concorrência: as alterações de integrantes são aplicadas sobre o documento
 * *atual* dentro de uma transação do Firestore. Se duas pessoas (ou dois dispositivos)
 * tentarem preencher a última vaga ao mesmo tempo, uma transação é refeita sobre o estado
 * atualizado e falha com "grupo cheio". As regras do Firestore validam o resultado de novo
 * no servidor, no momento do commit.
 */
export async function updateGroup(
  groupId: string,
  actorId: string,
  changes: GroupChanges,
  newPhoto?: PickedImage,
): Promise<GroupSaveResult> {
  const effectiveChanges: GroupChanges = { ...changes };
  const upload = await tryUploadGroupPhoto(actorId, groupId, newPhoto);
  if (upload.photoUrl) effectiveChanges.photoUrl = upload.photoUrl;

  const groupRef = doc(firestore, 'groups', groupId);
  const updated = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    const current = snapshot.exists() ? parseGroup(groupId, snapshot.data()) : null;
    if (!current) throw new AppError('group/not-found', 'Este grupo não existe mais.');

    const next = applyGroupChanges(current, actorId, effectiveChanges, Date.now());
    transaction.update(groupRef, {
      name: next.name,
      photoUrl: next.photoUrl,
      memberIds: next.memberIds,
      memberLimit: next.memberLimit,
      notificationPolicy: next.notificationPolicy,
      updatedAt: next.updatedAt,
    });
    return next;
  });

  const membersChanged =
    (changes.addMemberIds?.length ?? 0) > 0 || (changes.removeMemberIds?.length ?? 0) > 0;
  const accessSynced = membersChanged ? await trySyncGroupAccess(groupId) : true;
  return { group: updated, accessSynced, photoUploadFailed: upload.failed };
}
