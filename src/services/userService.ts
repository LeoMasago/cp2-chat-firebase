import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { PickedImage } from '../types/media';
import type { PrivateProfile, ProfileView, PublicProfile } from '../types/user';
import { apiClient } from './apiClient';
import { firestore } from './firebase';
import { parsePrivateProfile, parsePublicProfile } from './parsers';
import { uploadProfilePhoto } from './storageService';

const USERS_LIMIT = 200;
/** Limite do operador `in` do Firestore. */
const IN_QUERY_LIMIT = 30;

/** Cache de perfis públicos (nome e foto) para exibir autores de mensagens sem reler o tempo todo. */
const profileCache = new Map<string, PublicProfile>();

export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Cria o perfil do usuário no Firestore:
 *  - `users/{uid}`: dados públicos (nome e foto), usados na lista de usuários;
 *  - `users/{uid}/private/profile`: e-mail, celular e nascimento (protegidos).
 * As duas escritas são atômicas.
 */
export async function createUserProfile(
  uid: string,
  data: { name: string; photoUrl: string } & PrivateProfile,
): Promise<{ publicProfile: PublicProfile; privateProfile: PrivateProfile }> {
  const createdAt = Date.now();
  const name = data.name.trim();
  const privateProfile: PrivateProfile = {
    email: data.email,
    phoneNumber: data.phoneNumber,
    birthDate: data.birthDate,
  };

  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'users', uid), {
    name,
    nameLower: name.toLowerCase(),
    photoUrl: data.photoUrl,
    createdAt,
  });
  batch.set(doc(firestore, 'users', uid, 'private', 'profile'), privateProfile);
  await batch.commit();

  const publicProfile: PublicProfile = { uid, name, photoUrl: data.photoUrl, createdAt };
  profileCache.set(uid, publicProfile);
  return { publicProfile, privateProfile };
}

export function subscribePublicProfile(
  uid: string,
  onData: (profile: PublicProfile | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'users', uid),
    (snapshot) => {
      const profile = snapshot.exists() ? parsePublicProfile(uid, snapshot.data()) : null;
      if (profile) profileCache.set(uid, profile);
      onData(profile);
    },
    onError,
  );
}

export function subscribePrivateProfile(
  uid: string,
  onData: (profile: PrivateProfile | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, 'users', uid, 'private', 'profile'),
    (snapshot) => onData(snapshot.exists() ? parsePrivateProfile(snapshot.data()) : null),
    onError,
  );
}

/** Lista de usuários cadastrados (nome e foto), em ordem alfabética, em tempo real. */
export function subscribeUsers(
  onData: (users: PublicProfile[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const usersQuery = query(collection(firestore, 'users'), orderBy('nameLower'), limit(USERS_LIMIT));
  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users = snapshot.docs
        .map((document) => parsePublicProfile(document.id, document.data()))
        .filter((profile): profile is PublicProfile => profile !== null);
      users.forEach((profile) => profileCache.set(profile.uid, profile));
      onData(users);
    },
    onError,
  );
}

/** Busca perfis públicos por `uid`, usando o cache e consultando só o que falta. */
export async function getPublicProfiles(uids: readonly string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(uids)];
  const missing = unique.filter((uid) => !profileCache.has(uid));

  for (let index = 0; index < missing.length; index += IN_QUERY_LIMIT) {
    const chunk = missing.slice(index, index + IN_QUERY_LIMIT);
    const snapshot = await getDocs(query(collection(firestore, 'users'), where(documentId(), 'in', chunk)));
    snapshot.docs.forEach((document) => {
      const profile = parsePublicProfile(document.id, document.data());
      if (profile) profileCache.set(profile.uid, profile);
    });
  }

  return unique
    .map((uid) => profileCache.get(uid))
    .filter((profile): profile is PublicProfile => profile !== undefined);
}

/** Troca a foto de perfil: envia ao Storage e grava apenas a URL no Firestore. */
export async function updateProfilePhoto(uid: string, image: PickedImage): Promise<string> {
  const photoUrl = await uploadProfilePhoto(uid, image);
  await updateDoc(doc(firestore, 'users', uid), { photoUrl });
  const cached = profileCache.get(uid);
  if (cached) profileCache.set(uid, { ...cached, photoUrl });
  return photoUrl;
}

/**
 * Perfil exibido na tela de perfil.
 *  - O próprio usuário lê tudo direto do Firestore.
 *  - Para outros usuários, a API confere se existe conversa individual ou grupo em comum
 *    antes de devolver e-mail, celular e nascimento (campos protegidos pelas regras).
 */
export async function getProfileView(viewerUid: string, targetUid: string): Promise<ProfileView> {
  if (viewerUid === targetUid) {
    const [publicProfiles, privateSnapshot] = await Promise.all([
      getPublicProfiles([targetUid]),
      getDoc(doc(firestore, 'users', targetUid, 'private', 'profile')),
    ]);
    const publicProfile = publicProfiles[0];
    if (!publicProfile) throw new Error('profile-not-found');
    const privateProfile = privateSnapshot.exists() ? parsePrivateProfile(privateSnapshot.data()) : null;
    return {
      ...publicProfile,
      email: privateProfile?.email ?? null,
      phoneNumber: privateProfile?.phoneNumber ?? null,
      birthDate: privateProfile?.birthDate ?? null,
    };
  }
  return apiClient.getProfile(targetUid);
}
