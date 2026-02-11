import Constants from 'expo-constants';

const ENV = {
  development: {
    // Using LIVE Railway backend - same as web app
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://roomscore-production.up.railway.app/api',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://roomscore-production.up.railway.app',
  },
  production: {
    apiUrl: 'https://roomscore-production.up.railway.app/api',
    socketUrl: 'https://roomscore-production.up.railway.app',
  },
};

const getEnvVars = () => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  return ENV[env as keyof typeof ENV] || ENV.development;
};

export default getEnvVars();
