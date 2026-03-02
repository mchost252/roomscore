const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for socket.io-client and expo-sqlite in React Native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Skip SQLite web worker on web platform (mobile-only app)
  if (platform === 'web' && moduleName.includes('expo-sqlite')) {
    return {
      type: 'empty',
    };
  }

  // Redirect Node.js-specific WebSocket imports to standard ones
  if (moduleName === './transports/websocket.node.js') {
    return context.resolveRequest(
      context,
      './transports/websocket.js',
      platform
    );
  }
  
  // Redirect Node.js-specific polling imports
  if (moduleName === './transports/polling-xhr.node.js') {
    return context.resolveRequest(
      context,
      './transports/polling-xhr.js',
      platform
    );
  }

  // Let Metro handle all other requests
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
