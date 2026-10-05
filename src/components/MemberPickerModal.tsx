import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import { Avatar } from './Avatar';

export type PickableMember = { uid: string; name: string; photoUrl?: string };

type MemberPickerModalProps = {
  visible: boolean;
  title: string;
  members: readonly PickableMember[];
  /** Mostra a opção "Todos do grupo" no topo (seleção de destinatário). */
  allowAll?: boolean;
  selectedId?: string | null;
  onSelect: (memberId: string | null) => void;
  onClose: () => void;
};

/** Lista de integrantes do grupo para escolher destinatário ou inserir uma menção. */
export function MemberPickerModal({ visible, title, members, allowAll = false, selectedId = null, onSelect, onClose }: MemberPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <FlatList
          data={members}
          keyExtractor={(member) => member.uid}
          ListHeaderComponent={
            allowAll ? (
              <Pressable onPress={() => onSelect(null)} style={styles.row} accessibilityRole="button">
                <View style={styles.allIcon}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                </View>
                <Text style={styles.name}>Todos do grupo</Text>
                {selectedId === null ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item.uid)} style={styles.row} accessibilityRole="button">
              <Avatar uri={item.photoUrl} size={40} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {selectedId === item.uid ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum integrante disponível.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    maxHeight: '60%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  allIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, color: colors.text, fontSize: fontSize.md },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});
