const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Fix for socket.io-client and expo-sqlite in React Native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Skip SQLite web worker on web platform (mobile-only app)
  if (platform === 'web' && moduleName.includes('expo-sqlite')) {
    return {
      type: 'empty',
    };
  }

  // Fix for zustand v5 ESM using import.meta.env on web
  // The ESM files (esm/middleware.mjs) contain `import.meta.env` (Vite-specific),
  // which crashes when loaded as a classic script in the browser.
  // Force CJS resolution (.js files) on web to avoid this.
  if (platform === 'web' && moduleName.startsWith('zustand')) {
    const cjsPath = path.join(__dirname, 'node_modules', `${moduleName}.js`);
    if (fs.existsSync(cjsPath)) {
      return { type: 'sourceFile', filePath: cjsPath };
    }
    const indexPath = path.join(__dirname, 'node_modules', moduleName, 'index.js');
    if (fs.existsSync(indexPath)) {
      return { type: 'sourceFile', filePath: indexPath };
    }
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
