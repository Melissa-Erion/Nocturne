import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json. EXPO_BASE_URL lets the web build live under a sub-path, e.g. GitHub Pages at /Nocturne.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
});
