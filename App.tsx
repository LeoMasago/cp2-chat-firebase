import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isFirebaseConfigured } from './src/config/env';
import { AuthProvider } from './src/contexts/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ConfigMissingScreen } from './src/screens/ConfigMissingScreen';
import { configureNotificationHandler } from './src/services/notificationService';

// Define como o push é exibido com o app aberto (uma vez, antes de qualquer tela).
configureNotificationHandler();

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ConfigMissingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
