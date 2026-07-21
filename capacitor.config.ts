import type { CapacitorConfig } from '@capacitor/cli';

// Конфиг Capacitor для сборки Android APK.
// webDir — папка production-сборки Vite (npm run build).
const config: CapacitorConfig = {
  appId: 'com.roguerings.game',
  appName: 'Rogue Rings',
  webDir: 'dist',
  android: {
    // разрешить альбомную ориентацию (игра рассчитана на landscape 960x640)
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
