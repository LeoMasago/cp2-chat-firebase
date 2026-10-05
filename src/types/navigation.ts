import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ConversationType } from './chat';

export type UsersScreenParams =
  | { mode: 'direct' }
  | {
      mode: 'select';
      /** Integrantes já escolhidos (sem o proprietário). */
      selectedIds: string[];
      ownerId: string;
      memberLimit: number;
      /** Grupo em edição; `undefined` na criação. */
      groupId?: string;
    };

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Conversations: undefined;
  Users: UsersScreenParams;
  GroupForm: { groupId?: string; pickedMemberIds?: string[] } | undefined;
  Chat: { conversationId: string; conversationType: ConversationType };
  GroupMembers: { groupId: string };
  Profile: { userId?: string } | undefined;
};

export type ScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  RouteName
>;
