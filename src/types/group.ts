import type { PickedImage } from './media';
import type { NotificationPolicy } from './notification';

export type ChatGroup = {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  createdAt: number;
  updatedAt: number;
};

/** Limites de negócio (espelhados nas regras do Firestore). */
export const MIN_GROUP_MEMBERS = 2;
export const MAX_MEMBER_LIMIT = 50;
export const MIN_GROUP_NAME_LENGTH = 3;
export const MAX_GROUP_NAME_LENGTH = 60;

/** Dados do formulário de criação de grupo. */
export type NewGroupInput = {
  name: string;
  /** Foto escolhida na galeria, ou `null` para usar a imagem padrão. */
  photo: PickedImage | null;
  /** Integrantes além do proprietário (que sempre participa). */
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
};

/**
 * Alterações aplicadas por `updateGroup`. Integrantes são enviados como diferença
 * (adicionar/remover) e aplicados sobre o documento atual dentro da transação,
 * para que alterações concorrentes não se sobreponham nem estourem o limite.
 */
export type GroupChanges = {
  name?: string;
  photoUrl?: string;
  memberLimit?: number;
  notificationPolicy?: NotificationPolicy;
  addMemberIds?: string[];
  removeMemberIds?: string[];
};
