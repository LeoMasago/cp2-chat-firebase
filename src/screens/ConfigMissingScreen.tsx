import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

/** Exibida quando o `firebaseConfig.json` ainda tem os valores de exemplo. */
export function ConfigMissingScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Ionicons name="construct-outline" size={56} color={colors.warning} />
      <Text style={styles.title}>Configure o Firebase</Text>
      <Text style={styles.text}>
        O arquivo <Text style={styles.code}>firebaseConfig.json</Text> (na raiz do projeto) ainda está com os valores de
        exemplo.
      </Text>
      <View style={styles.steps}>
        <Text style={styles.step}>1. Crie um projeto no Console do Firebase e registre um app Web.</Text>
        <Text style={styles.step}>2. Copie o objeto firebaseConfig do app Web para o firebaseConfig.json.</Text>
        <Text style={styles.step}>3. Ative Authentication (e-mail/senha), Firestore, Realtime Database e Storage.</Text>
        <Text style={styles.step}>4. Reinicie o Metro: npx expo start -c</Text>
      </View>
      <Text style={styles.text}>Os passos completos estão no README.md.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', gap: spacing.lg, padding: spacing.xl, paddingTop: 96 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  text: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  code: { color: colors.text, fontWeight: '700' },
  steps: { alignSelf: 'stretch', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  step: { color: colors.text, fontSize: fontSize.sm },
});
