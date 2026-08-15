import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.trailradar.app',
  appName: 'Trailradar',
  webDir: '.output/public',
  plugins: {
    SplashScreen: {
      backgroundColor: '#6a8337',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
