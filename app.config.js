const fs = require('node:fs');

/**
 * Estende o app.json com os arquivos de configuração nativa do Firebase, quando existem:
 *  - google-services.json      (Android — necessário para o FCM)
 *  - GoogleService-Info.plist  (iOS — opcional neste projeto: o push iOS usa o Expo Push Service)
 *
 * Esses arquivos contêm apenas identificadores do app (não são segredos). Baixe-os no
 * Console do Firebase > Configurações do projeto > Seus apps e coloque-os na raiz do projeto.
 *
 * @param {{ config: import('expo/config').ExpoConfig }} context
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const androidGoogleServices = './google-services.json';
  const iosGoogleServices = './GoogleService-Info.plist';

  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(androidGoogleServices) ? { googleServicesFile: androidGoogleServices } : {}),
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(iosGoogleServices) ? { googleServicesFile: iosGoogleServices } : {}),
    },
  };
};
