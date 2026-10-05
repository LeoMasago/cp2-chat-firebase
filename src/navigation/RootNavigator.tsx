import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Loading } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { GroupMembersScreen } from '../screens/GroupMembersScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { colors, fontSize, spacing } from '../theme';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

/**
 * Fluxo de navegação por estado de autenticação:
 *  - sem sessão → Login / Cadastro;
 *  - com sessão → telas protegidas.
 * Ao sair, as telas protegidas são desmontadas, o que remove todos os listeners do Firebase.
 */
export function RootNavigator() {
  const { status, errorMessage, signOut } = useAuth();

  let content;
  if (status === 'loading') {
    content = <Loading message="Abrindo o app..." fullScreen />;
  } else if (status === 'error') {
    content = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{errorMessage ?? 'Não foi possível carregar sua conta.'}</Text>
        <Button title="Sair" variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  } else {
    content = (
      <Stack.Navigator
        screenOptions={{
          headerBackTitle: 'Voltar',
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
        }}
      >
        {status === 'authenticated' ? (
          <>
            <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Conversas' }} />
            <Stack.Screen
              name="Users"
              component={UsersScreen}
              options={({ route }) => ({
                title: route.params.mode === 'select' ? 'Escolher integrantes' : 'Nova conversa',
              })}
            />
            <Stack.Screen
              name="GroupForm"
              component={GroupFormScreen}
              options={({ route }) => ({ title: route.params?.groupId ? 'Editar grupo' : 'Novo grupo' })}
            />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
            <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Grupo' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Criar conta' }} />
          </>
        )}
      </Stack.Navigator>
    );
  }

  return <NavigationContainer theme={navigationTheme}>{content}</NavigationContainer>;
}

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.background },
  errorText: { color: colors.text, fontSize: fontSize.md, textAlign: 'center' },
});
