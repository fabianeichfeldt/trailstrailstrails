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
    StatusBar: {
      style: 'DARK',
      // Only takes effect below Android 15 (targetSdk 35), where the OS
      // still honors it — Android 15+ enforces edge-to-edge and ignores
      // both of these, so MainActivity.java pads the WebView with real
      // WindowInsets instead. Kept for the pre-15 install base (minSdk 24).
      overlaysWebView: false,
      backgroundColor: '#16181a',
    },
  },
};

export default config;
