import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import type { RegisterInput, RegisterResult } from '../types/user';
import { auth } from './firebase';
import { clearProfileCache, createUserProfile } from './userService';
import { uploadProfilePhoto } from './storageService';

/** Observa a sessão (recuperada automaticamente do armazenamento local ao abrir o app). */
export function observeAuthState(listener: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, listener);
}

/** Login exclusivamente por e-mail e senha. */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Cadastro: cria a conta (Authentication), envia a foto (Storage) e grava o perfil (Firestore).
 * Se o perfil não puder ser gravado, a conta recém-criada é removida para não deixar cadastros pela metade.
 */
export async function registerWithEmail(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim();
  const { user } = await createUserWithEmailAndPassword(auth, email, input.password);

  try {
    let photoUrl = '';
    let photoUploadFailed = false;
    if (input.photo) {
      try {
        photoUrl = await uploadProfilePhoto(user.uid, input.photo);
      } catch {
        // A conta continua válida: o usuário pode escolher a foto depois, no perfil.
        photoUploadFailed = true;
      }
    }

    const { publicProfile, privateProfile } = await createUserProfile(user.uid, {
      name: input.name,
      photoUrl,
      email: user.email ?? email,
      phoneNumber: input.phoneNumber,
      birthDate: input.birthDate,
    });
    return { user: { ...publicProfile, ...privateProfile }, photoUploadFailed };
  } catch (error) {
    await deleteUser(user).catch(() => undefined);
    throw error;
  }
}

/** Encerra a sessão e limpa os dados em memória do usuário anterior. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  clearProfileCache();
}
