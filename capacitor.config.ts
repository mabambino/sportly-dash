import type { CapacitorConfig } from "@capacitor/cli";

// Native shell loads the deployed app. The web build itself is unaffected.
const config: CapacitorConfig = {
  appId: "com.syncletics.app",
  appName: "Syncletics",
  webDir: "www",
  server: {
    url: "https://sportly-dash.lovable.app",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
  },
};

export default config;
