const fs = require('fs');
const path = require('path');

function readLocalEnvValue(key) {
  const envPath = path.resolve(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const envText = fs.readFileSync(envPath, 'utf8');
  const line = envText
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^['\"]|['\"]$/g, '');
}

const twelveDataApiKey =
  process.env.EXPO_PUBLIC_TWELVE_DATA_API_KEY ||
  readLocalEnvValue('EXPO_PUBLIC_TWELVE_DATA_API_KEY') ||
  '';

module.exports = {
  expo: {
    name: 'MAG 7 Tactical Tracker',
    slug: 'mag7-tactical-tracker',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'mag7tracker',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0b0f14',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.trodick.mag7tracker',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#0b0f14',
      },
    },
    web: {
      favicon: './assets/icon.png',
    },
    extra: {
      EXPO_PUBLIC_TWELVE_DATA_API_KEY: twelveDataApiKey,
      eas: {
        projectId: '4cd3531d-3a3d-4d1d-a117-044baa894e6f',
      },
    },
    owner: 'strodick',
  },
};
