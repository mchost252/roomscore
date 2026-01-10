import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.krios.app',
  appName: 'Krios',
  webDir: 'dist',
  server: {
    // For production, comment out the url line below
    // For development/testing, you can point to your dev server
    // url: 'http://YOUR_LOCAL_IP:3000',
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#5865F2',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#5865F2'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#5865F2',
      sound: 'beep.wav'
    },
    // Appflow Live Updates configuration
    // Replace YOUR_APPFLOW_APP_ID with your actual Appflow App ID after setup
    LiveUpdates: {
      appId: '20a7c5e1',
      channel: 'Production',
      autoUpdateMethod: 'background',
      maxVersions: 2
    }
  }
};

export default config;
