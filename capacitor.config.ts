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
      // false — Android only reports env(safe-area-inset-top) for actual
      // display cutouts (camera notch), not the general status bar height,
      // so an overlaid WebView on a non-notched phone had nothing to push
      // the topbar down by and the status bar (clock/wifi) covered it.
      // Non-overlay makes the OS reserve that space natively instead.
      overlaysWebView: false,
      backgroundColor: '#16181a',
    },
  },
};

export default config;
