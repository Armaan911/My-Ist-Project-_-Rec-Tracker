import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.recruittracker.app",
  appName: "Podium",
  webDir: "mobile/www",
  // The Android app is a native shell that loads your deployed site.
  // 1) Deploy to Vercel, 2) put that HTTPS URL here, 3) rebuild the APK.
  server: {
    url: "https://YOUR-APP.vercel.app",
    cleartext: false,
  },
  backgroundColor: "#FFFFFF",
  android: {
    backgroundColor: "#FFFFFF",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FFFFFF",
    },
  },
};

export default config;
