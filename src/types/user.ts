import type { PickedImage } from './media';

/** Dados públicos (Firestore `users/{uid}`): visíveis a qualquer usuário autenticado. */
export type PublicProfile = {
  uid: string;
  name: string;
  photoUrl: string;
  createdAt: number;
};

/** Dados cadastrais (Firestore `users/{uid}/private/profile`): protegidos. */
export type PrivateProfile = {
  email: string;
  phoneNumber: string;
  /** ISO `AAAA-MM-DD`. */
  birthDate: string;
};

export type ChatUser = PublicProfile & PrivateProfile;

/** Perfil exibido na tela: os dados privados podem estar indisponíveis. */
export type ProfileView = PublicProfile & {
  email: string | null;
  phoneNumber: string | null;
  birthDate: string | null;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  /** ISO `AAAA-MM-DD`. */
  birthDate: string;
  /** Imagem escolhida na galeria (arquivo local; nunca Base64). */
  photo: PickedImage | null;
};

export type RegisterResult = {
  user: ChatUser;
  /** `true` quando a conta foi criada, mas o envio da foto falhou. */
  photoUploadFailed: boolean;
};
