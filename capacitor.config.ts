import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fisioactiv.app',
  appName: 'FisioActiv',
  webDir: 'www',
  plugins: {
    Camera: {
      permissions: ['camera'],
    },
  },
};

export default config;
