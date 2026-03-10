import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gif2video.app',
  appName: 'GIF转视频',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
