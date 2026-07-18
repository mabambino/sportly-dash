import type { CapacitorConfig } from "@capacitor/cli";

// Native shell loads the deployed app. The web build itself is unaffected.
const config: CapacitorConfig = {
  appId: "com.syncletics.app",
  appName: "Syncletics",
  webDir: "www",
  server: {
    url: "https://app.syncletics.com",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      // Keep the branded splash up while the remote app boots; JS hides it
      // with a fade as soon as the shell is ready (see src/lib/native.ts).
      // The 4s cap is a safety net so a failed load never traps the user.
      launchShowDuration: 4000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#F4F4F4",
      showSpinner: false,
    },
  },
};

export default config;
