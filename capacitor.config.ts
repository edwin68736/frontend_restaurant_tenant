import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tukifac.tukichef',
  appName: 'Tukichef',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#fafaf9',
    minWebViewVersion: 60,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: '#00000000',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#fafaf9',
      showSpinner: false,
    },
  },
}

export default config
